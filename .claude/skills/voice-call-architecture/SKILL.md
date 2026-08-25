---
name: voice-call-architecture
description: "Complete architectural reference for the Voco voice call system — Twilio SIP + LiveKit + cascaded-pipeline Python agent (Phase 66: Deepgram nova-3 STT with language=multi, gpt-4.1-mini LLM, ElevenLabs eleven_flash_v2_5 TTS) deployed on Railway. Covers the FastAPI webhook service (incoming-call routing, dial-status, dial-fallback, incoming-sms, priority-caller check), LiveKit agent entrypoint (tenant lookup, _run_db_queries background tasks, pre-session Xero/Jobber customer context fetch, Silero VAD + MultilingualModel turn detection, gpt-4.1-mini LLM with parallel_tool_calls=False, deterministic session.say() greeting with input-mute, session lifecycle), system-prompt building (STATE+DIRECTIVE tool returns, name-once policy, single-question address intake, booking readback), in-process tools (check_slot, check_day, next_available_days, book_appointment, capture_lead, validate_address, check_caller_history, check_customer_account, transfer_call, end_call), post-call pipeline (recording, transcript, triage, notifications, booking reconciliation), recovery SMS cron, usage tracking (3s-capped Stripe meter post + stripe_meter_failures outbox), shared subscription gate (src/lib/subscription_gate.py — past_due blocked after 3-day grace), __main__ boot preflight for cascade keys, fail-closed Twilio signature verification, Phase 58 integration telemetry (integration_fetch + integration_fetch_fanout activity_log rows). Use this skill whenever making changes to call handling, modifying agent prompts, updating triage logic, debugging the LiveKit agent, touching Twilio/LiveKit/OpenAI integration, or adjusting pre-session customer-context injection."
---

# Voice Call Architecture — Complete Reference

This document is the single source of truth for the Voco voice call system.
Read this before making any changes to call-related code.

> ✅ **Phase 66 MERGED to agent `main`** (merge commit `9773f11`). The voice brain is
> now a **cascaded STT → LLM → TTS pipeline** (replacing the Phase 65 gpt-realtime-2
> speech-to-speech model — migration rationale: a strong text LLM is a more reliable,
> debuggable tool-caller). Construction in `src/agent.py` (~L510-551):
> `deepgram.STT(model="nova-3", language="multi")` (EN+ES code-switching) +
> `MultilingualModel()` semantic end-of-turn detection +
> `openai.LLM(model=LLM_MODEL, parallel_tool_calls=False)` (`LLM_MODEL="gpt-4.1-mini"`;
> sequential tool calls preserve the slot_token contract) +
> `elevenlabs.TTS(model=ELEVENLABS_TTS_MODEL, voice_id=voice_id)`
> (`"eleven_flash_v2_5"`, ~75ms first byte) + `silero.VAD.load()` (defaults — do NOT
> port the realtime 2.5s silence value) → `AgentSession(stt=, llm=, tts=, vad=,
> turn_detection=, allow_interruptions=True)`. The greeting is **deterministic**:
> `session.say()` of fixed text from `src/messages/{en,es}.json`
> (`agent.greeting_onboarding` / `agent.greeting_default`), non-interruptible via
> caller input mute (`session.input.set_audio_enabled(False)`) +
> `allow_interruptions=False`, force-unmute after 10s `GREETING_UNMUTE_TIMEOUT_S`.
> Voice resolution maps `tenants.ai_voice` LABELS (professional/friendly/local_expert,
> main-repo migration 070) → ElevenLabs voice_ids via `ELEVENLABS_VOICE_MAP`.
> ⚠️ Sections below that still describe gpt-realtime-2 specifics
> (`openai.realtime.RealtimeModel` construction, native `generate_reply` greeting,
> `SemanticVad`, OpenAI voice names) are **historical** — trust `agent.py`.
> Deploy state: pending Railway `DEEPGRAM_API_KEY`/`ELEVEN_API_KEY` keys,
> ElevenLabs "My Voices" entries, and live UAT.

**Last updated**: 2026-08-25 (**Admin Web Test Console + test-call sandbox**, BOTH repos — browser-based testing of the live agent with hard data isolation; see the new "Test Calls & Admin Web Test Console" section before "Keeping this document updated" for the full contract: `calls.is_test_call` (migration 079), agent-side sandbox gates (no CRM writes / no owner or caller SMS-email / no calendar push / no billing / subscription-gate bypass), audio-only **MP4** egress for test calls, `test-web-*` rooms + explicit `AgentDispatchClient` dispatch, the `/admin/test-agent` console, tenant-surface filters, and the onboarding phone-test dispatch fix — the worker's `agent_name` registration disables automatic dispatch, so `/api/onboarding/test-call` previously placed the owner into an agent-less room.) + 2026-08-19 (**latency + reliability pass**, agent repo, uncommitted — (1) **Prewarmed Silero VAD**: new `prewarm(proc)` in `agent.py` loads `silero.VAD.load()` ONCE per worker process (`WorkerOptions(prewarm_fnc=prewarm)`); entrypoint reads `ctx.proc.userdata["vad"]` with a per-call load as belt-and-braces fallback — removes ~hundreds of ms of synchronous ONNX-session construction (and an event-loop stall) from the pre-greeting critical path of every call. (2) **Intake fetch folded into the pre-session gather**: the `services` (intake_questions + names) fetch no longer runs sequentially AFTER the customer_context+caller_history gather — all three run in ONE `asyncio.gather`, saving a Supabase round-trip of pre-greeting dead air on every tenant call; fanout telemetry `duration_ms` now = `max(merged_context, caller_history)` (preserves the D-07 p95 meaning) and `per_task_ms` gains `intake_services`. (3) **Same-day minimum-notice floor** (`_availability_lib.py`, new `MIN_NOTICE_TODAY_S=3600`): `calc_slots_for_dates` drops TODAY's slots starting < 1h out — previously `check_day`/`next_available_days` (and check_slot's match/ALTS paths) could offer + token-register a slot starting minutes from now, which `book_appointment` then booked, contradicting check_slot's own `too_soon` min_notice=1h rule; future days untouched; new `tests/test_availability_min_notice.py`. (4) **book_appointment reuses `deps["tenant"]`** (the session-init `select("*")` row) instead of an unconditional awaited tenants round-trip inside the booking turn; live fetch kept as fallback when deps lacks the row (structural null-timezone pins preserved). (5) **NEW `src/lib/background.py` — `create_background_task()`**: strong-reference holder for fire-and-forget asyncio tasks (asyncio keeps only weak refs; a GC'd task silently drops the work) — wired at agent.py (fanout emit, db_task, greeting-unmute, watchdog, `_begin_recovery`, no-input sequence, `_start_egress`), end_call.py (`_delayed_disconnect`), book_appointment.py (calendar push, caller SMS, recovery SMS). (6) **LiveKitAPI aclose hygiene**: `transfer_call.py`, agent.py egress start/stop + blocked-subscription disconnect now close the client in `finally` (best-effort) so error paths can't leak aiohttp sessions; a failed-close can never flip a successful REFER into the transfer_failed branch. (7) Blocked-subscription disconnect now sets `call_end_reason='subscription_blocked'` (previously recorded as the default `caller_hangup`). Suite: 508 passed / same 1 pre-existing VIP failure. Deliberately NOT done: deferring the context fetch past `session.say()` via `update_instructions` (marginal for v1 with Jobber/Xero flagged off; revisit if pre-greeting p95 is still high after this pass).) + 2026-06-21 (**LiveKit Section-A ship-blockers LK-B1/B2/B4** — agent repo + main repo. **LK-B1** (`agent.py` + `messages/{en,es}.json`): `on_error` now drives a guarded spoken-fallback → `_delayed_disconnect` graceful capture on unrecoverable/repeated errors; a no-input "are you still there?" handler (`user_state_changed` "away", armed after greeting unmute) ends the call after 2 unanswered prompts; ElevenLabs TTS wrapped in `tts.FallbackAdapter([ElevenLabs, openai.TTS])` (degrades to ElevenLabs-only). New env: `VOCO_OPENAI_TTS_MODEL/VOICE`, `VOCO_NO_INPUT_MAX_STRIKES`, `VOCO_NO_INPUT_RESPONSE_WINDOW_S`, `VOCO_ERROR_RECOVERY_THRESHOLD`. New strings `agent.recovery_error/no_input_prompt/no_input_goodbye`. See §6 step 14b/14-no-input + §1 step 11 TTS. **LK-B2** (`post_call.py` + `notifications.py` + main repo): owner SMS/email each sent under a 3s `asyncio.wait_for`; on timeout/failure a durable row is upserted into `owner_notification_failures` (migration **076**, keyed `{call_id}:{channel}`) drained by main-repo cron `/api/cron/retry-owner-notifications` (every 5 min); the slow Stripe meter POST moved to §7.5 AFTER notifications so billing never starves the alert. notifications.py split into pure builders + raising senders + swallow wrappers. See §6 steps 4/7/7.5. **LK-B4** (`webhook/`): `evaluate_schedule` wrapped fail-open (→`mode='ai'`) + a global `@app.exception_handler` returns AI TwiML on any unhandled voice-path error (re-raises HTTPException so signature 401/403 isn't masked). See §10 Endpoints + Schedule evaluator. **LK-B3** (IMPLEMENTED 2026-06-21, live-unverified): `_ai_sip_twiml(to_number)` now templates the SIP user-part with the dialed number (host from `LIVEKIT_SIP_URI`), threaded into all 7 call sites, fail-open to static — so R2-routed calls resolve the tenant. STILL must be confirmed with one real inbound PSTN call before trusting R2; safe MVP posture meanwhile is `RAILWAY_WEBHOOK_URL` unset (legacy trunk). See §10 webhook section. All edits py_compile/JSON-valid; new cron jest tests 6/6; notifications + schedule logic verified by direct execution under local py3.9.) + 2026-06-20 (M16 P2 — **Owner-adjustable travel buffer** (agent repo): `calculate_available_slots` (`src/lib/slot_calculator.py`) gains a `travel_buffer_mins: int = 30` kwarg; `_get_travel_buffer_mins` gains a `default_buffer_mins` param returned at its 3 prior literal-`30` sites (the same-zone `0` and zone-pair lookup are untouched/dormant); the backward adjacency block passes it through, and a NEW coordinate-free **FORWARD** adjacency case was added so the buffer applies on **both** sides of every booking. Four callers pass `travel_buffer_mins=tenant.get("travel_buffer_mins", 30)` (a stored `0` is honored; absent column → 30): `_availability_lib.calc_slots_for_dates`, `book_appointment.py` slot-taken recompute, `utils.calculate_initial_slots`, `post_call._calculate_suggested_slots`. `book_appointment.py`'s tenant SELECT was broadened from its named list to `select("*")` (parity with `agent.py`) so the live booking path carries the column with NO named-column pre-migration dependency; the other three already receive the tenant via `agent.py`'s `select("*")`. So the **entire agent path fails open** — a missing column (pre-migration) defaults to 30. Backed by main-repo migration `075_travel_buffer.sql` (`tenants.travel_buffer_mins int NOT NULL DEFAULT 30`); default 30 = zero regression; the coordinate/drive-time "Capability B" stays DEFERRED. New test `tests/test_slot_calculator_travel_buffer.py` (shared scenario with the JS twin). **Apply 075 before deploying the Next.js app** — only the JS `available-slots`/`working-hours` routes name the column; the Python agent is pre-migration-safe. + M16 P1 — **Service-Area gate (Capability A)**, agent repo: new pure module `src/lib/service_area.py` → `classify_service_area(*, zones, postal_code, locality)` returns `{"verdict": "in_area"|"out_of_area"|"unknown"|"unconfigured", "matched_on": "postal"|"city"|None}` — unions `postal_codes[]` + `cities[]` across the tenant's `service_zones` rows (normalized, case/punctuation-insensitive, CA/UK postal spaces ignored), biased HARD to false-ACCEPT (only `out_of_area` when there IS a coverage list AND a trusted postal/town signal that doesn't match; empty coverage → `unconfigured`, gate off). `validate_address.py` runs the gate after caching `deps["_validated_address"]`, but ONLY on a solidly confirmed address (`confirmed`/`confirmed_with_changes`, SKIPPING the `address_ok_confirm_postal` unconfirmed-lookup branch), reading the Google-normalized `address_components.postal_code` + `.locality` against `zones = deps["_slot_cache"]["service_zones"]`; result stored on `deps["_service_area"]`. On `out_of_area` it OVERRIDES the STATE+DIRECTIVE via new helper `_out_of_area_state(action, formatted, referral_note)` → new token `STATE:address_out_of_area action=<callback|decline_referral|trip_fee>` (owner action + referral note read from `deps["tenant"]` `out_of_area_action`/`out_of_area_referral_note`, loaded via the existing `select("*")`); a prohibited-phrase guard forbids the caller-facing wording from ever saying "zone"/"service area"/"coverage"/"buffer"/"travel time" — only "a bit outside the area we usually cover". Three modes: callback (default) = don't book, take a message + promise call-back; decline_referral = don't book, politely decline + optional referral; trip_fee = book as normal but mention a possible travel charge. Gate fails OPEN (any exception → normal flow), never blocks the call. `capture_lead.py` captures the `record_outcome` return, re-classifies from its OWN `validation_result` (confirmed* only), refreshes `deps["_service_area"]`, and on `out_of_area` stamps `inquiries.out_of_area = true` via a best-effort follow-up service-role UPDATE keyed by `inquiry_id` (the hardened `record_call_outcome` RPC is intentionally NOT overloaded; a failure never breaks lead capture). `agent.py`: the `service_zones` slot-cache prefetch SELECT widened to include `cities`; the dict passed to `run_post_call_pipeline(...)` gains `"service_area": deps.get("_service_area")`. `post_call.py` extracts `params.get("service_area")` → `is_out_of_area`, sets `notify_lead["out_of_area"]`, passes `out_of_area=is_out_of_area` to `send_owner_sms`. `src/lib/notifications.py`: `send_owner_sms` gains `out_of_area: bool = False` (appends "(OUTSIDE your area — confirm reachability)" to the body); `send_owner_email` reads `lead.get("out_of_area")` and inserts a highlighted red warning block before the dashboard link. Capability B (back-to-back travel feasibility, the coordinate/drive-time version) stays DEFERRED — NOT built; the 3 appointment SELECTs still pull only `start_time, end_time, zone_id`. (Superseded as P2 by the owner-adjustable travel buffer + forward adjacency — see the M16 P2 entry above; `slot_calculator.py` is no longer backward-only/flat-30.) New tests: `tests/test_service_area.py`, gate tests added to `test_validate_address_tool.py`, `tests/test_notifications_out_of_area.py`.) + 2026-06-12 (audit wave 1, BOTH repos — (1) **`__main__` boot preflight (S4)**: `agent.py` refuses to start when `OPENAI_API_KEY` / `DEEPGRAM_API_KEY` / `ELEVEN_API_KEY` are missing (the STT/LLM/TTS plugins are constructed per call, so a missing key previously made every inbound call connect then die silently with no audio while the liveness healthcheck stayed green). (2) **NEW shared `src/lib/subscription_gate.py` (H1)**: `is_subscription_blocked(status, current_period_end)` — canceled/paused/incomplete always blocked; **past_due blocked after the 3-day grace** anchored to `current_period_end` (the grace's END was never enforced anywhere before — a payment-failed tenant kept the AI answering forever). Used by `agent.py` (`_run_db_queries` subscription select now includes `current_period_end`) and `twilio_routes.py`, whose tenants query now filters the subscriptions embed with `.eq("subscriptions.is_current", True)` — it previously read an arbitrary history row (M3), so a canceled tenant whose random row read 'active' kept free owner-pickup forwarding. (3) **`webhook/security.py` fail-closed (M9)**: empty/missing `TWILIO_AUTH_TOKEN` → 503 (RequestValidator("") computes HMACs with an empty key — forgeable); `ALLOW_UNSIGNED_WEBHOOKS` is ignored when `PYTHON_ENV` is production OR unset. (4) **Timeouts (H8)**: triage layer-2 `TIMEOUT_S` 5.0 → **2.5s** (a slow Groq call starved the post-call 8s envelope); the Stripe meter post is capped at **3s** via `asyncio.wait_for` (stripe-python's default read timeout is ~80s). (5) **Meter outbox (H4)**: meter-post failures now upsert (on `call_id`) into the main repo's `stripe_meter_failures` table (migration 071) for the `/api/cron/retry-meter-events` retry cron — overage is no longer silently lost (replay was structurally impossible: `increment_calls_used` had already consumed the call_id). (6) **ai_voice labels are real**: main-repo migration **070** stores the 3 labels (professional/friendly/local_expert) the agent's `ELEVENLABS_VOICE_MAP` resolves — the phantom "migration 068 stores labels" comments now have a real migration; dashboard `VALID_VOICES` + picker use the 3 labels.) + 2026-06-12 (voice-naturalness pass P1–P8, uncommitted on the agent repo — full proposal + production-call evidence in `docs/findings.md` (main repo). **P1 guided-choice availability — REVERSES the "never speak slot times" / "AI never offers times first" design:** `check_day` now returns up to 3 spread windows with registered slot_tokens (`STATE:day_has_slots … | OPTIONS: 1.<speech> token=…; …`, via new `pick_spread()` in `_availability_lib.py`), `check_slot`'s `too_soon` branch moved BELOW the schedule fetch and pairs the rejection with the earliest viable time today (else the first opening in the next 2 days via new `_find_next_opening()`), `day_empty` also carries `next_open=… token=…`, `next_available_days` returns actual open-day labels (`days=Thursday, July 6th (5 open); …`); each alternative registers a token and sets `_last_offered_token`; the prompt's AVAILABILITY RULES now license offering at most 2–3 TOOL-RETURNED times and require every rejection to arrive with an alternative "in the same breath" — the anti-hallucination invariant is unchanged (every spoken time must come from a tool return), and a caller-picked offered time books directly with its token (NO DOUBLE-BOOKING wording now says "an availability tool (check_slot or check_day)"). **P2 caller-authority address flow:** new CALLER AUTHORITY block in `_build_address_validation_section` (the caller outranks the lookup — incident call 31559053 argued for Google's inferred postal code and leaked "from the address validation" on-air; internals-leak phrases added to the prohibited list), new `STATE:address_ok_confirm_postal` branch in `validate_address` (postal present in the result but never spoken by the caller → asked as a question, digit by digit, never asserted; `get_cached_validation` now matches when the cached input postal was empty and the requested postal equals the result's postal), new `_apply_country_guard` in `google_maps.validate_address_with_region_fallback` (a confirmed* result whose `country_code` contradicts the trusted region — caller-ID region when supported, else tenant country — is downgraded to `unconfirmed` with Google fields stripped, BEFORE the retry decision, so the caller-region retry self-heals the Utah-booking incident eef9f785; no DB change — 'unconfirmed' is already in the verdict CHECK constraints), `book_appointment`/`capture_lead` fallback-validated directives no longer re-read the address (the pre-booking readback already covered it; `confirmed_with_changes` still reads its corrected form), prompt AFTER BOOKING = day + time only, BEFORE BOOKING readback IS the single confirmation (offer folded in — no separate pre-confirm, no post-yes re-confirm). **P3:** `_build_intake_questions_section` reframed — technician-prep nice-to-haves, at most ONE before the slot is locked, rest after booking confirmation, skip-if-answered-in-substance, skip-all-if-rushed, rephrase never read verbatim. **P4:** `_build_voice_behavior_section` register contract (banned stock-phrase list, contractions required, hard never-two-questions rule with Call-B example) + SAYING NUMBERS AND DATES OUT LOUD (postal/phone/unit digits spelled out grouped, times as speech, dates without year, never announce today's date — the LLM text feeds TTS verbatim). **P5:** HEARING THROUGH THE PHONE block in `_build_corrections_section` (near-soundalike of confirmed data = mishearing — never adopt/parrot garbled strings, max 2 repeats then best-guess yes/no, spell names); TOOL NARRATION rule 5 cites the Call-D "review the situation" filler-without-tool lie. **P8:** `AgentSession(preemptive_generation=…)` gated by `VOCO_PREEMPTIVE_GENERATION` (default ON; verified in livekit-agents 1.5.7), Deepgram nova-3 `keyterm` prompting (business name + active service names, services fetch now selects `name`) gated by `VOCO_STT_KEYTERMS` (default OFF — keyterm + language="multi" unverified against Deepgram's API; flip on a UAT deploy first). Tests: 441 passed / same 1 pre-existing VIP failure; new `tests/test_availability_alternatives.py`; country-guard + confirm-postal + cache-tolerance tests added to `test_validate_address_tool.py`; `_bounded_result` fixture grew country params; fallback/directive pins updated in `test_book_appointment_validation.py` / `test_capture_lead_validation.py` / `test_slot_token_handoff.py`. Tenant-data fix SQL (tenants.country US→SG for Make It AI + audit query) staged in `My Prompts/text2` for MANUAL application — not yet run.) + 2026-06-11 (single-English-prompt collapse, uncommitted on the agent repo: `src/prompt.py`'s dual EN/ES section branches are GONE — the prompt is now ONE English prompt for every call (prompt.py 1607 → 1009 lines). `locale` drives exactly ONE thing: the tenant-default-language line in the LANGUAGE section ("Default to English on every call." vs "This business operates in Spanish — open in Spanish and default to Spanish on every call."). The LANGUAGE section now states the supported set is exactly English + Spanish (matches the Deepgram nova-3 `language="multi"` EN+ES pin; the 6-language list was a Gemini-era leftover), carries a new SPEAKING SPANISH — DELIVERY GUIDE (usted register, Spanish times/dates/addresses, "código postal" with the caller regardless of market, digit-by-digit phone readback, Spanish fillers, and any-language applicability of the reserved/prohibited-word rules incl. "validado/validada", "verificado/verificada", "coincide con nuestros registros"), and preserves the Phase 62 ANTI-HALLUCINATION block (now "English or Spanish audio", supported set "(English, Spanish)", explicit-switch examples in both directions). OUTCOME WORDS gained an "in any language, including Spanish: 'disponible', 'no disponible', 'confirmado', 'reservado'…" clause. ALL other EN section text is byte-identical to before; es-locale output is byte-identical to en-locale output except that one line (locked by new `tests/test_prompt_locale_collapse.py` structural-equivalence test); the assembled prompt for BOTH locales ends with the pinned "Don't interrogate the caller about the situation." `messages/{en,es}.json` (deterministic greeting + max_duration_goodbye) and post-call language detection are untouched. The D7 locale-parity tests were reworked to single-prompt invariants (each rework commented in the test files). Suite: 421 passed / same 1 pre-existing VIP failure. **Policy: do NOT reintroduce `if locale == "es"` branches in prompt section builders — see §4 Single-English-prompt policy.**) + 2026-06-11 (caller-region validation fallback, uncommitted on the agent repo: `derive_caller_region` in `src/lib/phone.py` parses caller-ID with `phonenumbers` → `deps["caller_region"]` (splits +1 US/CA by area code; None on anonymous/garbage, never raises); new `validate_address_with_region_fallback` orchestrator in `google_maps.py` — attempt 1 = tenant country, attempt 2 = caller region only when attempt 1 is unconfirmed/unsupported and caller region is supported + different; better verdict wins; per-attempt telemetry; used by all three validation sites. Tests extended in `test_validate_address_tool.py`; old book/lead validation fixtures repointed to the wrapper. Suite: 418 passed / 1 pre-existing failure.) + 2026-06-10 (early address validation + conciseness pass, uncommitted on the agent repo: NEW always-on `src/tools/validate_address.py` tool — validates the address the moment the caller says it via the unchanged `validate_address_bounded`, returns `STATE:address_ok|address_corrected|address_unclear|address_noted`, caches the full result on `deps["_validated_address"]`; `book_appointment`/`capture_lead` reuse the cache via `get_cached_validation` (normalized street+postal match, unit-tolerant, `error` never reused) with live validation as fallback — booking still never blocks on Google; their post-commit verdict directives SHORTENED (cached path = one short day+time sentence, no address re-read; verdict tokens unchanged); `_build_address_validation_section` rewritten EN+ES for the early flow (address spoken once, ≤1 correction loop, ≤2 readbacks/call, booking readback covers name+day/time with address only if never validated; no-silence + prohibited-phrase + verdict-token invariants preserved); `_build_voice_behavior_section` rewritten EN+ES to lead with the one-or-two-short-sentences/one-question-per-turn rule; FINAL — NON-NEGOTIABLES gains brevity item 4 (still ends with the pinned line); TOOL NARRATION filler target ~3s → ONE warm sentence ~2s + validate_address filler example; `openai.LLM(..., max_completion_tokens=500)` runaway backstop in agent.py. Tests: new `test_validate_address_tool.py`; 7 stale `check_availability` pins fixed; `test_check_availability_slot_cache.py` ported to `test_slot_cache.py`; `test_slot_token_handoff.py` ported to `register_slot_token`/check_slot.) + 2026-06-10 (Phase 66 — voice brain migrated gpt-realtime-2 → cascaded Deepgram nova-3 STT (language="multi") + Silero VAD + MultilingualModel turn detection + gpt-4.1-mini LLM (`parallel_tool_calls=False`) + ElevenLabs eleven_flash_v2_5 TTS, merged to agent `main` (`9773f11`); greeting now deterministic `session.say()` from `messages/{en,es}.json` with input-mute. PLUS this session's fixes (uncommitted on the agent repo at time of writing): Layer-1 triage now evaluates EMERGENCY patterns first and classifies on caller-only turns via `extract_caller_text()` (layer2 LLM also gets caller-only text; layer3 unchanged); post-call owner notifications decoupled from the `record_call_outcome` RPC (fire whenever tenant info exists, degrade to caller-ID + transcript-derived fields, `degraded=true` logging) and reordered to run before suggested-slots/hallucination detection; notify dict now carries `urgency` (emergency emails previously rendered "routine"); call-duration watchdog in `agent.py` (`VOCO_WRAP_UP_CALL_SECONDS`=540 wrap-up nudge, `VOCO_MAX_CALL_SECONDS`=600 localized goodbye + disconnect, `disconnection_reason='max_duration'`); `capture_lead` persists `notes` (folded into job_type) and prefers an explicitly captured callback phone over caller-ID when it parses to E.164; `record_outcome`'s RPC call moved to `asyncio.to_thread`; Python Outlook push sends naive tenant-local ISO (fixes UTC-offset double-shift); all-day calendar rows (`is_all_day`) expand to tenant-local day bounds in `slot_calculator` (all fetch sites updated); `transfer_call` failure restores prior `disconnection_reason` + nulls `exception_reason`.) + 2026-06-05 (Phase 65 — voice brain migrated Gemini 3.1 Flash Live → OpenAI gpt-realtime-2, merged to `main` on both repos; §1/§3/§11/§12/§13 rewritten for the OpenAI Realtime construction (SemanticVad, native `generate_reply` greeting, no TTS), Gemini cascade workarounds removed, §61.2/§61.3/§63.1 annotated as superseded; Railway deploy unverified.) + 2026-06-04 (prod-readiness 2026-06 — documented that Layer-3 owner per-service urgency escalation now actually fires: `apply_owner_rules` derives the service via word-boundary matching `services.name` against the transcript (`MIN_SERVICE_NAME_LEN=4` guard), `classify_call` threads the transcript through, `triage_layer_used` can now legitimately be `layer3`; the prior single-service auto-escalation is NOT reintroduced. See §7 Triage System.) + Phase 61 — Google Maps Address Validation API integrated as pre-check inside `book_appointment` + `capture_lead`; new `ADDRESS VALIDATION — CRITICAL RULE` block in `prompt.py` top-attention zone EN+ES via `_build_address_validation_section(locale)`; D-E2 STATE+DIRECTIVE tool returns with `verdict=validated|validated_with_corrections|unvalidated` tokens; D-D3' `service_address` overwrite on `confirmed`/`confirmed_with_changes`; new `src/integrations/google_maps.py` follows xero/jobber per-call `httpx.AsyncClient` pattern with 1.5s hard timeout, never-raises wrapper, Sentry-on-error-only gate, and per-validate telemetry to new `gmaps_validate_events` table. See `references/phase-history.md` for incremental phase-by-phase history.) + Phase 61.1 WR-03 — clarified success-path return shape (label-form, not STATE+DIRECTIVE; brittleness watch added) + Phase 61.1 — address-validation rule deadlock fix; WR-01/02 google_maps.py defects closed

---

## Architecture Overview

Two separate services, one call:

| Service | Runtime | Deployment | Purpose |
|---------|---------|------------|---------|
| **Next.js App** | Node | Vercel | Dashboard, API routes, cron, Stripe webhooks, phone provisioning |
| **LiveKit Voice Agent** | Python 3.12 | Railway | Real-time AI voice via cascade (Deepgram STT → gpt-4.1-mini → ElevenLabs TTS) + FastAPI webhook service |

The agent is a **separate repo** (`lerboi/livekit_agent`) cloned locally at
`C:/Users/leheh/.Projects/livekit-agent/` — this sibling repo is
authoritative for the agent. (There is no `livekit-agent/` mirror inside this
monorepo; the user syncs the sibling repo → GitHub → Railway on redeploy.)

### End-to-end call flow

```
Caller dials Twilio number
  │
  ▼
Twilio voice_url → Railway webhook POST /twilio/incoming-call  (Phase 40)
  │   1. Tenant lookup by To-number (_normalize_phone → tenants.phone_number;
  │        subscriptions embed filtered to .eq("subscriptions.is_current", True))
  │   2. Subscription check via shared is_subscription_blocked() — blocked
  │        (incl. past_due beyond 3-day grace) → AI route (never owner-pickup);
  │        the agent-side gate then disconnects. Errors fail open → AI
  │   3. Priority (VIP) caller check (Phase 46): tenants.vip_numbers OR leads.is_vip
  │        match → direct owner-pickup, bypasses steps 4–5
  │   4. evaluate_schedule(call_forwarding_schedule, tz, now_utc)
  │   5. owner_pickup only: check_outbound_cap(tenant_id, country)
  │        breach → downgrade to AI
  │   6. Return TwiML:
  │        AI mode:         <Dial><Sip>{LIVEKIT_SIP_URI}</Sip></Dial>
  │        Owner pickup:    <Dial><Number>*</Number></Dial>  (up to 5 pickup numbers)
  │
  ├── AI path ──▶ LiveKit SIP dispatch rule creates room: "call-{uuid}"
  │                 │
  │                 ▼
  │           Agent entrypoint (src/agent.py)
  │             - Tenant lookup by to_number
  │             - Pre-session Xero + Jobber customer context fetch (Phase 55/56)
  │             - build_system_prompt(locale, customer_context, ...)
  │             - AgentSession(stt=deepgram, llm=gpt-4.1-mini, tts=elevenlabs,
  │               vad=silero, turn_detection=MultilingualModel) starts
  │             - Deterministic session.say() greeting (input-muted)
  │             - _run_db_queries background tasks (subscription + intake + call insert)
  │             - Egress recording starts after DB task completes
  │             - Cascade handles each turn: Deepgram STT → gpt-4.1-mini → ElevenLabs TTS
  │             - 6 in-process tools execute during the call
  │             - Session close → run_post_call_pipeline()
  │
  └── Owner pickup ──▶ Twilio dials up to 5 pickup numbers in parallel
                        │
                        ├── Answered → call connects; /twilio/dial-status writes duration + routing_mode=owner_pickup
                        └── No answer → voice_fallback_url fires /twilio/dial-fallback → AI SIP TwiML
                                          dial-status writes routing_mode=fallback_to_ai
```

### Service boundaries

- **Next.js (Vercel)** — writes calls/appointments/leads (via RLS), dashboard
  reads, Stripe webhook for phone provisioning (Twilio purchase + SIP trunk
  association), cron jobs (recovery SMS, calendar channel renewal).
- **Python agent + FastAPI webhook (Railway)** — single process, both the
  LiveKit agent worker AND a FastAPI daemon thread on port 8080. Twilio
  webhooks + health checks hit port 8080; LiveKit room joins are via the
  agents SDK.

### Related skills

- `integrations-jobber-xero` — Xero + Jobber OAuth, caching, webhook HMAC,
  pre-session customer context fetch, `check_customer_account` tool,
  Phase 58 telemetry helpers. **Read this skill for anything touching
  Xero/Jobber code paths on either runtime.**
- `scheduling-calendar-system` — `calendar_events`, slot calculation,
  Google/Outlook/Jobber schedule sync, travel buffers.
- `auth-database-multitenancy` — tenant lookup, service-role Supabase,
  RLS, migration catalog.
- `payment-architecture` — post-call `increment_calls_used` RPC, Stripe
  overage metering, subscription gate.

---

## File Map

### Agent Repo (`lerboi/livekit_agent`, deployed to Railway)

| File | Role |
|------|------|
| `src/agent.py` | Entrypoint: tenant lookup, Phase 66 cascade session (Deepgram STT + Silero VAD + MultilingualModel + gpt-4.1-mini + ElevenLabs TTS), deterministic `session.say()` greeting, call-duration watchdog (2026-06-10), Egress, post-call trigger. Phase 58: `fetch_customer_context_with_fanout_telemetry` wrapper. Phase 59: `_persist_call_outcome()` calls `record_call_outcome` RPC (D-14) |
| `src/prompt.py` | System prompt builder — modular section builders, Phase 60 STATE+DIRECTIVE format. **Single-language ENGLISH prompt (2026-06-11 collapse)** — `locale` selects only the LANGUAGE section's tenant-default-language line |
| `src/post_call.py` | Post-call pipeline — triage, notifications, booking reconciliation. **Phase 59:** step 9 replaced `create_or_merge_lead()` with `record_outcome()` RPC call |
| `src/lib/write_outcome.py` | Phase 59 D-14: `record_outcome()` async helper — normalizes phone, calls `record_call_outcome` RPC, raises `RecordOutcomeError`; D-02a (no dual-write), D-02b (forward-fix only). 2026-06-10: the RPC `.execute()` now runs via `asyncio.to_thread` (was the only sync DB call — blocked the audio loop when invoked mid-call from capture_lead). (Path corrected — `src/post_call/` package never landed; post_call is the single module `src/post_call.py`) |
| `src/supabase_client.py` | Singleton service-role Supabase client |
| `src/utils.py` | Date/speech formatting helpers (`format_slot_for_speech`, `to_local_date_string`, `format_zone_pair_buffers`). 2026-08-20: `calculate_initial_slots` deleted — dead code, zero callers (Node-era `handleInbound` leftover) |
| `src/webhook/__init__.py` | Webhook subpackage + `start_webhook_server` daemon thread |
| `src/webhook/app.py` | FastAPI app — `GET /health`, `GET /health/db`, mounts `/twilio/*` router |
| `src/webhook/twilio_routes.py` | 4 signature-gated POST endpoints + `_is_vip_caller` priority caller check. 2026-06-12: tenants query filters the subscriptions embed with `.eq("subscriptions.is_current", True)` (previously read an arbitrary history row) and gates via shared `is_subscription_blocked` |
| `src/webhook/security.py` | `verify_twilio_signature` FastAPI dep + URL reconstruction from proxy headers. 2026-06-12 fail-closed: empty `TWILIO_AUTH_TOKEN` → 503; `ALLOW_UNSIGNED_WEBHOOKS` ignored when `PYTHON_ENV` is production or unset |
| `src/lib/subscription_gate.py` | NEW 2026-06-12 (audit H1): shared `is_subscription_blocked(status, current_period_end)` + `BLOCKED_STATUSES` — single source of truth for call blocking (canceled/paused/incomplete always; past_due after 3-day grace anchored to `current_period_end`). Used by `agent.py` + `twilio_routes.py`; mirrors the main repo's `subscription-gate.js` semantics |
| `src/webhook/schedule.py` | Pure-function `evaluate_schedule()` + frozen `ScheduleDecision` dataclass |
| `src/webhook/caps.py` | Async `check_outbound_cap()` — monthly outbound-minute cap |
| `src/lib/phone.py` | `_normalize_phone()` module-level helper |
| `src/lib/background.py` | NEW 2026-08-19: `create_background_task()` — strong-reference holder for fire-and-forget asyncio tasks (asyncio keeps only weak refs; a GC'd task silently drops the work). Used by agent.py, end_call.py, book_appointment.py |
| `src/lib/telemetry.py` | Phase 58: `emit_integration_fetch` + `emit_integration_fetch_fanout` helpers (see `integrations-jobber-xero` skill) |
| `src/tools/__init__.py` | Tool registry — conditional registration based on onboarding |
| `src/tools/book_appointment.py` | Atomic slot booking (slot_token-resolved) + address validation + calendar sync + SMS. (Phase 65: the Gemini-era `mute_input_during_tool` / `_last_tool_state` cascade-recovery plumbing was removed — gpt-realtime-2 async function calling makes it unnecessary.) |
| `src/tools/check_slot.py` | Verify a specific (date, time) is bookable; registers a `slot_token`. (Replaces the date+time branch of the former monolithic `check_availability`.) |
| `src/tools/check_day.py` | List open slots for a whole day; registers `slot_token`s. (Former day-listing branch of `check_availability`.) |
| `src/tools/next_available_days.py` | Find the next N days with any availability; registers `slot_token`s. (Former next-available branch of `check_availability`.) |
| `src/tools/capture_lead.py` | Mid-call lead capture on decline. M16 P1 (2026-06-20): re-classifies the service area from its own `validation_result` and stamps `inquiries.out_of_area=true` when out of area (best-effort follow-up UPDATE) |
| `src/tools/validate_address.py` | Early mid-call address validation (2026-06-10) — wraps `validate_address_bounded`, caches result on `deps["_validated_address"]`, exports `get_cached_validation` reused by book_appointment/capture_lead. Always-on. M16 P1 (2026-06-20): runs the Service-Area gate (`classify_service_area`) on a confirmed address → `deps["_service_area"]`, overrides to `STATE:address_out_of_area` when out of area |
| `src/tools/check_caller_history.py` | Silent context repeat-caller lookup |
| `src/tools/check_customer_account.py` | Re-serve pre-session Xero/Jobber context |
| `src/tools/transfer_call.py` | SIP REFER transfer to owner phone |
| `src/tools/end_call.py` | Graceful SIP participant disconnect |
| `src/integrations/xero.py` | Xero adapter (Python) — see `integrations-jobber-xero` skill |
| `src/integrations/jobber.py` | Jobber adapter (Python) — see `integrations-jobber-xero` skill |
| `src/lib/booking.py` | Atomic slot booking via Supabase RPC |
| `src/lib/slot_calculator.py` | Available slot calculation — 2026-06-10: `_all_day_busy_bounds()` expands `is_all_day` busy rows to tenant-local day bounds. **M16 P2 (2026-06-20):** adjacency is now **forward + backward**, and the default buffer is the owner-set `tenants.travel_buffer_mins` (migration 075) passed in via the `travel_buffer_mins` kwarg (default 30, 0 disables) — NOT a hardcoded 30. The coordinate/drive-time "Capability B" stays deferred (not built). |
| `src/lib/service_area.py` | NEW M16 P1 (2026-06-20): pure `classify_service_area(*, zones, postal_code, locality)` → `{verdict, matched_on}`. Unions `postal_codes[]` + `cities[]` across the tenant's `service_zones` rows (normalized; CA/UK postal spaces ignored); biased HARD to false-ACCEPT — only `out_of_area` with a coverage list AND a non-matching trusted postal/town signal; empty coverage → `unconfigured` (gate off). No DB/network — fed `zones = deps["_slot_cache"]["service_zones"]` |
| `src/lib/leads.py` | Lead creation/merge logic — **Phase 59:** `create_or_merge_lead()` replaced by `record_outcome()` in post-call step 9; file retained until Plan 08 drops legacy `leads` table |
| `src/lib/notifications.py` | SMS (Twilio) + Email (Resend) dispatch. M16 P1 (2026-06-20): `send_owner_sms(out_of_area=…)` appends an out-of-area SMS suffix; `send_owner_email` reads `lead.out_of_area` and renders a red out-of-area warning block |
| `src/lib/google_calendar.py` | Google Calendar push (`_to_naive_local_iso` helper shared with the Outlook push) |
| `src/lib/outlook_calendar.py` | Outlook Calendar push — 2026-06-10: start/end sent as **naive tenant-local ISO** via `google_calendar._to_naive_local_iso` with `timeZone` authoritative; Graph ignores the UTC offset in `dateTime` when `timeZone` is set, so the raw offset-suffixed ISO double-shifted events (e.g. +8h for SG) |
| `src/lib/whisper_message.py` | Whisper message for warm transfers |
| `src/lib/triage/classifier.py` | Three-layer triage orchestrator |
| `src/lib/triage/layer1_keywords.py` | Regex urgency detection |
| `src/lib/triage/layer2_llm.py` | LLM urgency classification (Groq/Llama 4 Scout) |
| `src/lib/triage/layer3_rules.py` | Owner service-tag escalation — transcript word-boundary matches `services.name` to find the call's service, raises urgency to its `urgency_tag` only on a genuine match (prod-readiness 2026-06: now actually wired; previously inert) |
| `src/messages/en.json`, `src/messages/es.json` | Agent utterances + notification templates |
| `pyproject.toml`, `Dockerfile`, `livekit.toml`, `sip-*.json` | Build + deploy config |

### Main Repo (`homeservice_agent`, deployed to Vercel)

| File | Role |
|------|------|
| `src/app/api/stripe/webhook/route.js` | Phone provisioning (Twilio purchase / SG inventory) + `configureNumberRouting` (set webhook voice/SMS URLs + remove from SIP trunk; trunk-only fallback when `RAILWAY_WEBHOOK_URL` unset) |
| `scripts/cutover-existing-numbers.js` | One-time migration of existing tenant numbers to webhook routing (sets URLs + disassociates the trunk) |
| `src/app/api/onboarding/test-call/route.js` | LiveKit SIP outbound test-call trigger (room `test-call-<tenantId>-<ts>`; sets `tenants.test_call_status='calling'`) |
| `src/app/api/webhooks/livekit/route.js` | LiveKit webhook (`WebhookReceiver` signature verify). On `participant_joined` for a `test-call-*` room by the owner's SIP leg (`caller-*` identity / kind SIP), sets `test_call_completed=true` + `test_call_status='connected'` + `test_call_last_at`. **Must be registered in the LiveKit project** (Cloud: Settings→Webhooks; self-hosted: `webhook.urls`) → `https://<domain>/api/webhooks/livekit` |
| `src/lib/subscription-gate.js` | JS reference gate — live enforcement moved to the agent repo's shared `src/lib/subscription_gate.py` (2026-06-12), which also blocks past_due after the 3-day grace |
| `src/app/api/cron/send-recovery-sms/route.js` | Recovery SMS cron |
| `src/app/api/notification-settings/route.js` | GET/PATCH `notification_preferences` JSONB |

---

## 1. Agent Service (LiveKit + Phase 66 cascade pipeline)

### Connection lifecycle

1. Agent connects — `await ctx.connect()` joins the LiveKit room.
2. Wait for SIP participant — `ctx.wait_for_participant()` with 30s timeout.
3. Extract phone numbers from SIP attributes (`sip.trunkPhoneNumber`,
   `sip.phoneNumber`).
4. Call ID = `ctx.room.name` (`call-{uuid}`).
5. Test-call detection — room metadata `{test_call: true}` set by test-call route.
6. Phone normalization — `_normalize_phone()` strips `sip:`/`tel:` prefixes,
   `@domain` suffixes, ensures `+` E.164 prefix.
7. Tenant lookup — query `tenants` by `phone_number = to_number`.
8. **Pre-session customer context fetch** — `fetch_customer_context_with_fanout_telemetry`
   wraps `fetch_merged_customer_context_bounded(tenant_id, from_number)`.
   See `integrations-jobber-xero/references/python-agent-injection.md` for
   the Xero+Jobber 2.5s-bounded `asyncio.gather`. Phase 58 wrapper emits
   `integration_fetch_fanout` to `activity_log` (fire-and-forget via
   `asyncio.create_task`). The term `pre-session` refers to this phase —
   it happens before `session.start()`.
9. `build_system_prompt(locale, ..., customer_context=..., working_hours=...,
   tenant_timezone=...)`.
10. `create_tools(deps)` — returns the in-process tools with a shared
    `deps` dict (mutable — filled in as the call progresses). `deps`
    now also carries `"country"` (tenant ISO country code) — read by
    `book_appointment.py`/`capture_lead.py` as the address-validation
    `region_code` (prod-readiness 2026-06 fix; previously absent, so
    non-US tenants always validated against region "US").
11. **Phase 66 cascade construction** (`src/agent.py` ~L510-551):
    - `stt = deepgram.STT(model="nova-3", language="multi")` — preserves EN+ES
      code-switching; deliberately isolated to one line so the STT is
      one-line-swappable (AssemblyAI Universal-3 Pro / Deepgram Flux-multi are
      the UAT A/B candidates).
    - `turn_detection = MultilingualModel()` — semantic end-of-turn detection
      (more robust to brief SIP echo than raw Silero endpointing); model files
      pre-downloaded in the Dockerfile.
    - `llm = openai.LLM(model=LLM_MODEL, parallel_tool_calls=False,
      max_completion_tokens=500)` — `LLM_MODEL = "gpt-4.1-mini"`
      (non-reasoning, low TTFT, strong tool calling);
      `parallel_tool_calls=False` keeps the booking flow strictly
      sequential (never fires `check_slot` + `book_appointment` in one turn —
      the slot_token contract assumes one tool call resolves before the next).
      `max_completion_tokens=500` (2026-06-10) is a RUNAWAY BACKSTOP only —
      conciseness is enforced by the prompt; 500 tokens never truncates a
      legitimate turn (even the booking readback), it just caps pathological
      generation loops before minutes of runaway TTS. Verified against the
      installed livekit-plugins-openai 1.5.7 `LLM.__init__` signature.
    - `tts = elevenlabs.TTS(model=ELEVENLABS_TTS_MODEL, voice_id=voice_id)` —
      `"eleven_flash_v2_5"` (~75ms first byte; the sub-500ms TTS that makes the
      cascade viable where Phase 64's GeminiTTS ~1.3s did not). `voice_id` from
      `_resolve_voice` over `ELEVENLABS_VOICE_MAP` (labels
      professional/friendly/local_expert; main-repo migration 070).
      **LK-B1 (2026-06-21):** ElevenLabs is now wrapped in
      `tts.FallbackAdapter([elevenlabs.TTS(...), openai.TTS(model=OPENAI_TTS_MODEL,
      voice=OPENAI_TTS_VOICE)])` so a single ElevenLabs outage fails over to OpenAI
      TTS mid-call instead of dead-airing. The adapter construction is itself
      try/except-wrapped → degrades to ElevenLabs-only (never worse than before).
      `VOCO_OPENAI_TTS_MODEL` (default `gpt-4o-mini-tts`) / `VOCO_OPENAI_TTS_VOICE`
      (default `alloy`) env-override the fallback leg.
    - `vad` — Silero, defaults for barge-in. Do NOT port the
      realtime model's 2.5s silence value (Phase 64 did and added ~2s/turn).
      **2026-08-19:** loaded ONCE per worker process in `prewarm(proc)`
      (`WorkerOptions(prewarm_fnc=prewarm)`) and read from
      `ctx.proc.userdata["vad"]`; a per-call `silero.VAD.load()` remains only
      as the logged fallback when prewarm didn't run.
    - `VocoAgent(instructions=system_prompt, tools=tools)` +
      `AgentSession(stt=stt, llm=llm, tts=tts, vad=vad,
      turn_detection=turn_detection, allow_interruptions=True)`; register
      event handlers BEFORE `session.start()`.
12. `_run_db_queries` background tasks: subscription check + intake
    questions + calls row insert, as `asyncio.create_task()`. The
    subscription select now includes `current_period_end` alongside `status`
    (2026-06-12 — feeds the past_due grace check in the shared gate).
13. `await session.start(agent=agent, room=ctx.room, room_options=...)` —
    runs in parallel with DB queries.
14. Greeting (Phase 66): **deterministic** via
    `session.say(greeting_text, allow_interruptions=False)` right after
    `session.start()` — the cascade has a TTS, so `say()` works again. The text
    is fixed, byte-identical per locale from `src/messages/{en,es}.json`:
    `agent.greeting_onboarding` (with `{business_name}`) when
    `onboarding_complete`, else `agent.greeting_default`. No LLM turn consumed,
    no per-call wording drift. `_build_greeting_section` in `prompt.py` tells
    the model the greeting was already delivered so it does not re-greet on
    turn 1. (The Phase 65 `generate_reply` greeting is historical.)
    - **Non-interruptible**: caller input is muted via
      `session.input.set_audio_enabled(False)` before the `say()` and unmuted
      once `SpeechHandle.wait_for_playout()` returns (10s
      `GREETING_UNMUTE_TIMEOUT_S` safety cap, force-unmute on timeout; if the
      `say()` dispatch failed, `greeting_handle` is None and input unmutes
      immediately). Unlike the realtime model (where it was ignored), the
      cascade AgentSession HONORS `allow_interruptions=False` on `say()` — it
      is a second echo defense behind the input mute (BVCTelephony is layer 1;
      the Phase-64 revert showed SIP self-echo can trip the VAD and cut the
      opening line in half). Barge-in resumes the moment the greeting finishes.
    - **LK-B1 no-input net (2026-06-21):** after the greeting unmutes
      (`_greeting_done` latch — so it NEVER fires during the muted greeting),
      `@session.on("user_state_changed")` "away" triggers `_no_input_sequence`,
      which speaks `agent.no_input_prompt` ("are you still there?") up to
      `VOCO_NO_INPUT_MAX_STRIKES` (2) times (waiting `VOCO_NO_INPUT_RESPONSE_WINDOW_S`
      =8s for a reply each), then ends the call via `agent.no_input_goodbye` +
      `_delayed_disconnect` — catches one-way-audio / dead-STT silence (which raise
      NO error) so the caller isn't stuck until the 10-min watchdog.
14b. **LK-B1 session error recovery (2026-06-21):** `@session.on("error")` still
    logs + Sentry-captures, but now also calls `_begin_recovery` on an
    UNRECOVERABLE error or after `VOCO_ERROR_RECOVERY_THRESHOLD` (3) errors →
    speaks `agent.recovery_error` ("trouble with the connection — let me take your
    details and have someone call you right back") then drives the SAME
    `_delayed_disconnect` graceful-capture teardown so the post-call pipeline still
    creates the lead + owner alert. Fully fail-open: `_recovery_started` idempotency
    latch, skips when `call_end_reason` is already agent_ended/transferred/max_duration,
    and `_speak_and_end` is try/except-wrapped (falls back to bare `ctx.shutdown()`)
    so a recovery can never throw or make the call worse. New strings
    `agent.recovery_error` / `no_input_prompt` / `no_input_goodbye` in en+es.
15. DB queries complete:
    - Subscription blocked → disconnect. Blocking is decided by the shared
      `is_subscription_blocked(status, current_period_end)`
      (`src/lib/subscription_gate.py`, 2026-06-12): canceled/paused/incomplete
      always; **past_due once the 3-day grace after `current_period_end` has
      elapsed** (fail-open on missing/unparseable period end).
    - Intake questions → injected into the system prompt pre-session
      (no longer via `generate_reply`).
    - Call record → `deps["call_uuid"]` updated.
16. Egress recording starts after DB task completes.
17. Session close → `_on_close_async` stops egress + runs
    `run_post_call_pipeline()`.
18. `entrypoint()` awaits a `close_complete` asyncio.Event so the LiveKit
    worker keeps the process alive through the post-call pipeline.

### Call-duration watchdog (2026-06-10)

The prompt's "wrap up at 9 / hard max 10 minutes" is prose, not enforcement —
`_call_duration_watchdog()` in `agent.py` (an `asyncio.create_task` started
right after the greeting-unmute task) is the server-side cap. Sleeps are
computed relative to `start_timestamp` so session-start latency doesn't extend
the cap. Both thresholds are env-overridable:

- **`VOCO_WRAP_UP_CALL_SECONDS` (default 540)** — appends a system-message
  wrap-up nudge via `agent.update_chat_ctx(nudge_ctx)` ("TIME LIMIT: ... Begin
  wrapping up now ..."). The LLM sees it on its next turn — cheap and
  non-disruptive (no forced speech mid-conversation).
- **`VOCO_MAX_CALL_SECONDS` (default 600)** — sets
  `call_end_reason[0] = 'max_duration'` (recorded as the call's
  `disconnection_reason` by post_call) BEFORE teardown, speaks a localized
  goodbye via `session.say(_msg(locale, "agent.max_duration_goodbye"),
  allow_interruptions=False)` with a 20s `wait_for_playout()` cap, then reuses
  end_call's `_delayed_disconnect(deps)` path (imported from
  `src/tools/end_call.py`): remove SIP participant → `ctx.shutdown()` → the
  post-call pipeline still runs.

The watchdog task is cancelled as the FIRST statement of `_on_close_async` on
normal close, so the max-duration goodbye/disconnect can never fire
mid-teardown.

### Webhook server boot (Phase 39) + boot preflight (2026-06-12)

`__main__` in `src/agent.py` runs a **boot preflight** (audit S4): it
raises `RuntimeError` and refuses to start when any of `OPENAI_API_KEY`,
`DEEPGRAM_API_KEY`, `ELEVEN_API_KEY` is missing. The STT/LLM/TTS plugins are
constructed PER CALL inside `entrypoint()`, so a missing key previously failed
at call time — every inbound call connected and died silently with no audio
while the liveness healthcheck stayed green. Failing the deploy visibly is the
fix.

**The preflight + `start_webhook_server()` are gated to the `start`/`dev`
subcommands** (`2026-06-26`): `__main__` reads `sys.argv[1]` and only enforces
the key check / starts the webhook for the worker-running modes. This is
load-bearing for the Docker build. The `Dockerfile` pre-downloads the
turn-detector + VAD models via `RUN python -m src.agent download-files` at
**build time, before any secrets exist**. That command also executes `__main__`;
before the gate, the preflight raised (no keys at build), `cli.run_app()` never
ran, so `download-files` never dispatched — and a stray `|| true` swallowed the
failure, shipping an image with **no turn-detector model files**. Every call
then crashed at `MultilingualModel()` (`agent.py` ~L625) with
`Could not find file "languages.json"`. `download-files` only fetches the
public `livekit/turn-detector` HF model (no keys needed) into
`/root/.cache/huggingface`, which bakes into the image layer (same path at
runtime; no `HF_HOME` override, no volume mount). The `|| true` was also removed
so a genuine download failure now fails the build loudly.

For the worker modes, before `cli.run_app()`, `__main__` calls
`start_webhook_server()` — spawns a daemon thread running uvicorn on port
8080. Serves `/health`, `/health/db`, and `/twilio/*`.

### Critical pin set — livekit-agents + sibling plugins

**Current pins (Phase 66):** everything livekit-* stays on the `1.5.7` line;
`livekit-plugins-openai` now provides the **LLM** (`openai.LLM`), not a
realtime model, and the cascade adds the Deepgram + ElevenLabs plugins:

```
livekit-agents==1.5.7
livekit-plugins-openai==1.5.7
livekit-plugins-deepgram==1.5.7
livekit-plugins-elevenlabs==1.5.7
livekit-plugins-silero==1.5.7
livekit-plugins-turn-detector==1.5.7
livekit-plugins-noise-cancellation>=0.2,<1
```

> (stale — superseded by the Phase 66 cascade, see agent.py; the RealtimeModel
> notes below are gpt-realtime-2 history.)
> **Verified against the installed `livekit-plugins-openai==1.5.7`
> (migration §17.1):**
> - **Model id `"gpt-realtime-2"` is NOT in the plugin's `RealtimeModels`
>   literal** (which knows `gpt-realtime` / `gpt-realtime-1.5` /
>   `gpt-realtime-2025-08-28`). The constructor accepts any `str`, so it
>   builds fine but is **verified only at the live OpenAI handshake (first
>   call)** — isolated as the single constant `OPENAI_REALTIME_MODEL` at the
>   top of `agent.py`. **← #1 UAT risk; change there if it 404s.**
> - **No `reasoning` kwarg** in the 1.5.7 constructor (would be silently
>   swallowed by `**kwargs`); omitted — gpt-realtime-2 defaults to `low`
>   effort, the desired low-latency setting.
> - **`input_audio_transcription` must be a typed
>   `openai.types.realtime.AudioTranscription`**, NOT a dict (the plugin's
>   `to_audio_transcription` only converts typed objects). Set to
>   `AudioTranscription(model="gpt-4o-mini-transcribe")` — caller-side
>   transcription feeds post-call triage + lead extraction.
> - **`TurnDetection` is NOT exported** from `livekit.plugins.openai.realtime`;
>   use `SemanticVad` from
>   `openai.types.realtime.realtime_audio_input_turn_detection` directly.
>   `semantic_vad`/`medium` is the plugin default. ServerVad fallback: swap to
>   `ServerVad(threshold=..., silence_duration_ms=...)`.
> - The Gemini-only config (`session_resumption`, `thinking_config`, the
>   `realtime_input_config` VAD, the `language=` STT pin) was removed.

**Do not bump carelessly.** Pin-version drift across `livekit-agents` and the
plugins has historically caused `RealtimeModel.__init__` signature mismatches
(see the Gemini-era 1.5.1→1.5.2 `RealtimeCapabilities` break, preserved in
`references/phase-history.md`). The rationale is duplicated in
`pyproject.toml` comments.

---

## 2. SIP Configuration

Three JSON files in `livekit-agent/`:

- `sip-inbound-trunk.json` — Twilio media server IP allowlist; Krisp on;
  empty numbers array (all routed via trunk).
- `sip-outbound-trunk.json` — used for outbound test calls.
- `sip-dispatch-rule.json` — `dispatchRuleIndividual` with
  `roomPrefix: "call-"` and `agentName: "voco-voice-agent"`.

Each inbound call creates a unique room. Twilio `voice_url` is the
primary routing lever since Phase 40 — but a number associated with a SIP
trunk *ignores* its `voice_url` (the trunk wins), so webhook-routed numbers are
**removed from the trunk** (provisioning + `cutover-existing-numbers.js` both
disassociate it; R2 fix). Rollback = re-add the number to the trunk.

---

## 3. OpenAI Realtime Session

> ⚠️ **(stale — superseded by the Phase 66 cascade, see agent.py.)** The whole
> section (RealtimeModel construction, SemanticVad turn detection, OpenAI voice
> resolution / `VOICE_MAP` / migration-067 CHECK) describes the Phase 65
> gpt-realtime-2 code. The live construction is the cascade in §1 step 11;
> voices are now ElevenLabs voice_ids resolved from LABELS
> (professional/friendly/local_expert) via `ELEVENLABS_VOICE_MAP` (main-repo
> migration 070 stores labels, clears stale OpenAI values — the "migration 068"
> the agent comments originally referenced was never the label migration (068 is
> billing hardening); 070 realized it. Every voice_id must
> exist in the ElevenLabs account's "My Voices"). Retained as historical record.

```python
from openai.types.realtime import AudioTranscription
from openai.types.realtime.realtime_audio_input_turn_detection import SemanticVad

OPENAI_REALTIME_MODEL = "gpt-realtime-2"  # isolated constant — see §1 UAT risk

model = openai.realtime.RealtimeModel(
    model=OPENAI_REALTIME_MODEL,
    voice=voice_name,
    turn_detection=SemanticVad(
        type="semantic_vad",
        eagerness="medium",
        create_response=True,
        interrupt_response=True,
    ),
    input_audio_transcription=AudioTranscription(
        model="gpt-4o-mini-transcribe",
    ),
)

agent = VocoAgent(instructions=system_prompt, tools=tools)
session = AgentSession(llm=model)  # no tts= — the realtime model emits audio itself
```

### Turn detection — SemanticVad (Phase 65)

gpt-realtime-2 uses OpenAI server-side turn detection. The agent constructs
`SemanticVad(eagerness="medium", create_response=True, interrupt_response=True)`
— the plugin default and the recommended starting point for this SIP topology.
Semantic VAD decides end-of-turn from the *content* of the caller's speech
rather than a fixed silence timer.

- `create_response=True` — the model responds automatically at end-of-turn.
- `interrupt_response=True` — caller speech can barge in (keep this on;
  callers must be able to interrupt for emergencies).

If live UAT shows over- or under-eager turn-taking, switch to
`ServerVad(threshold=..., prefix_padding_ms=..., silence_duration_ms=...)`
(the fixed-timer fallback). See `docs/OPENAI-REALTIME-2-MIGRATION.md` §7.5.

> **Why the Gemini VAD-tuning history is gone:** the old
> `START_SENSITIVITY_LOW` / `silence_duration_ms=1500` config and the
> `server cancelled tool calls` / `_SegmentSynchronizerImpl` cancellation
> cascade it fought were specific to Gemini 3.1's server-side VAD + blocking
> function calling. gpt-realtime-2 has native async function calling — an
> in-flight tool call is NOT cancelled when the caller speaks — so that
> failure class is gone at the source. The historical tuning is preserved in
> `references/phase-history.md`.

### Voice resolution (Phase 44 AI Voice Selection)

```python
ai_voice = tenant.get("ai_voice") if tenant else None
# Validate against the OpenAI voice set; an unsupported value (e.g. a stale
# Gemini voice like "Zephyr") errors the whole session at the OpenAI handshake.
voice_name = _resolve_voice(ai_voice, tone_preset)  # invalid -> VOICE_MAP[tone]
```

`_resolve_voice()` + the `OPENAI_VOICES` allowlist (agent commit `35238f7`)
guard against stale/drifted `ai_voice`. Incident 2026-06: tenant "Make It AI"
held the Gemini voice "Zephyr" — gpt-realtime-2 rejected it (`invalid_value`),
erroring the session on every call, because **migration 067 (NULL ai_voice +
OpenAI CHECK) had not been applied to prod**. Fix = apply 067 + redeploy.

`VOICE_MAP` (Phase 65 — OpenAI gpt-realtime voices; was Zephyr/Aoede/Achird under Gemini):
| tone_preset | Voice | Character |
|-------------|-------|-----------|
| `professional` | marin | Clear and professional |
| `friendly` | cedar | Warm and friendly |
| `local_expert` | alloy | Relaxed and neutral |

10 voices available in dashboard AI Voice Settings: alloy, ash, ballad,
coral, echo, sage, shimmer, verse, marin, cedar. `tenants.ai_voice` has a
CHECK constraint (migration 067) enforcing only these values or NULL.

> **Superseded (2026-06-12):** migration **070** replaced 067's OpenAI-name
> CHECK with the 3 stable labels (`professional`, `friendly`, `local_expert`);
> the dashboard `VALID_VOICES` allowlist + voice picker now use the 3 labels,
> and the agent resolves them via `ELEVENLABS_VOICE_MAP` (invalid/NULL → tone
> default). The 10-voice OpenAI picker above is historical.

### Non-blocking I/O pattern

All synchronous Supabase / Twilio / Resend / Stripe calls wrapped in
`asyncio.to_thread()`. Parallel queries use `asyncio.gather()`.

---

## 4. System Prompt (Phase 60 restructure)

**File**: `src/prompt.py`

`build_system_prompt(locale, *, business_name, onboarding_complete,
tone_preset, intake_questions, country, working_hours, tenant_timezone,
customer_context=None)`.

Sections (order):

1. **Identity** — role, tone, conciseness.
2. **Voice Behavior** — **conciseness-first since 2026-06-10**: leads with
   "Speak in one or two short sentences per turn, then stop and let the
   caller talk. Ask exactly one question per turn. The booking confirmation
   readback is the only turn that may run longer." The old "natural
   back-and-forth matters more than efficiency" opener was REMOVED (it
   licensed long turns); acknowledgments bounded to "a few words at most";
   the slow-on-readbacks guidance preserved ("slower there, never wordier"
   — pace, not length). English-only since the 2026-06-11 single-prompt
   collapse. A matching one-line brevity recap is item 4
   of FINAL — NON-NEGOTIABLES (recency position; the prompt still ends
   with the test-pinned "Don't interrogate the caller about the
   situation." line). TOOL NARRATION's filler target also tightened from
   "~3 seconds … longer, warmer filler" to ONE warm sentence (~2s) — the
   filler remains MANDATORY (covers tool latency; silence is never
   licensed), and `validate_address` has its own filler example ("Let me
   just check that address real quick."). **2026-06-12 (P4):** carries the
   register contract — banned stock phrases ("Thank you for that
   information", "How may I assist you", announced transitions, etc.),
   contractions required, hard never-two-questions rule with the Call-B
   counter-example — and a SAYING NUMBERS AND DATES OUT LOUD block
   (postal/phone/unit digits spelled out in groups, times as people say
   them, dates without the year, never announce today's date; the LLM's
   text feeds ElevenLabs verbatim, so these rules directly control TTS
   rendering).
3. **Corrections** — top-level section: caller correction ALWAYS replaces
   old value; never read back incorrect data. Concrete example included.
   **2026-06-12 (P5):** ends with a HEARING THROUGH THE PHONE block — a
   near-soundalike of already-confirmed data is a mishearing (never adopt
   or parrot it back, e.g. Call D's "Lucky Kenberg Drive"); never read back
   implausible strings; after two unclear repeats switch to a best-guess
   yes/no question; names get spelled.
4. **Business Hours** — computed from `working_hours` JSON, grouped
   (e.g., "Mon-Fri: 9:00 AM - 5:00 PM"). Includes lunch breaks. Empty if
   `working_hours` is None.
5. **Opening Line** — greeting + recording disclosure.
6. **Language** (2026-06-11 single-prompt collapse — the ONE place
   `locale` changes the prompt) — supported languages are exactly
   English and Spanish (matches the Deepgram nova-3 `language="multi"`
   EN+ES pin). The tenant-default-language line flips on `locale`:
   "Default to English on every call." vs "This business operates in
   Spanish — open in Spanish and default to Spanish on every call."
   Switch only on explicit caller request, switch back the same way,
   continue from where you left off. Carries a SPEAKING SPANISH —
   DELIVERY GUIDE in English (usted register; Spanish times/dates;
   "código postal" with the caller regardless of market; digit-by-digit
   phone readback; Spanish fillers; any-language applicability of the
   reserved/prohibited-word rules — incl. the Spanish address-validation
   forms "validado/validada", "verificado/verificada", "coincide con
   nuestros registros"). Unclear speech treated as connection issue,
   not language barrier. Phase 62 ANTI-HALLUCINATION preserved: when
   transcription appears in an unsupported language (German / French /
   Italian / etc.), treat it as an STT error of English or Spanish
   audio — do NOT respond in the perceived language and do NOT tell the
   caller "I only speak English" (both reveal the STT failure).
   Substitute a connection-issue framing: "Sorry, the audio cut out for
   a moment — could you say that again?" Real language switches require
   an explicit caller phrase like "Can we speak in Spanish?" /
   "¿Podemos hablar en inglés?" — foreign text in transcript is NOT
   consent. Call AJ_gpRzniyNoJBd (2026-05-07) is the regression source.
7. **Repeat Caller** — empty (never reveal prior history; silent context).
8. **Customer Context (Phase 55/56)** — `_build_customer_account_section`
   inserts a STATE+DIRECTIVE block if `customer_context` non-null.
   Field shape from the Xero+Jobber merge; DIRECTIVE forbids volunteering
   balance/invoices. Omitted entirely when None. See
   `integrations-jobber-xero` skill.
9. **Info Gathering (Phase 60 D-01..D-08)** — outcome-framed. Three needed
   before scheduling: issue, name, complete address. Order not forced.
   - NAME USE DURING THE CALL: capture silently; no name vocative
     mid-call. The booking readback is the SOLE on-air name moment.
     Phase 62 hardened the rule with an explicit forbidden-patterns
     enumeration ("Thanks, {name}", "Got it, {name}", "{name}, I have…",
     etc.) plus an outcome-based acknowledgment rule (acknowledgment
     must not contain the caller's name; tone-flexible). Call
     AJ_gpRzniyNoJBd (2026-05-07) caught Gemini violating the prior
     less-explicit phrasing. Caller-invited override ("you can call me X")
     honored.
   - SERVICE ADDRESS: single-question opener "What's the address where
     you need the service?" — replaces the old three-part walkthrough.
     One targeted follow-up per missing piece; never enumerate fields.
   - URGENCY: silent classification; never ask caller to rate; never use
     "emergency/urgent/routine" out loud.
10. **Intake Questions** — trade-specific, fetched pre-session and injected
    into the system prompt (Phase 63.1 moved this off `generate_reply`; the
    text arrives in the initial `build_system_prompt(intake_questions=...)`).
    **2026-06-12 (P3):** reframed as technician-prep nice-to-haves that must
    never delay scheduling — at most ONE asked before the slot is locked,
    the rest after booking confirmation; skip any answered in substance;
    skip all if the caller is rushed; rephrased, never read like a form
    (evidence: Call D's "Let me just skip the whatever", Call A re-asking
    an answered question). The services fetch in agent.py now also selects
    `name` (feeds P8.2 STT keyterms).
11. **Booking Protocol (Phase 60 D-02/D-09/D-10; AVAILABILITY rewritten 2026-06-12 P1)**:
    - SCHEDULING: only after name + issue + confirmed address.
    - AVAILABILITY RULES: every caller-named new date/time requires a fresh
      `check_slot` (or `check_day` / `next_available_days`). **2026-06-12:**
      the agent may OFFER at most 2–3 times taken from a tool return in this
      turn (never recite lists, never invent); every rejection pairs with a
      tool-returned alternative "in the same breath"; a caller-picked offered
      time books directly with its token.
    - READBACK (mandatory, and the ONLY confirmation): name + address-if-
      never-validated in ONE utterance, offer folded in ("…shall I lock that
      in?"); no separate pre-confirm question, no post-yes re-confirm.
      Accept-and-re-read correction loop until caller stops correcting.
      Address-only if no name captured.
    - AFTER BOOKING: confirm day + time ONLY (never re-read the address),
      ask if anything else.
12. **Decline Handling** — only when `onboarding_complete=True`. Judgment-
    based, not a two-strike counter. Silence/topic changes/thinking NOT declines.
13. **Transfer Rules** — 2 triggers only: caller asks for human, or 3
    failed clarifications. Transfer-recovery: on fail, offer callback
    booking or capture lead.
14. **Call Duration** — 9-min wrap-up, 10-min hard max. Goal-oriented
    end: speak goodbye, pause, then `end_call`.

### Tool return format (Phase 60 D-16)

Tool returns use the strict `STATE:<code>|DIRECTIVE:<imperative>` format —
machine-facing, not speakable — across `check_slot`/`check_day`/
`next_available_days`, `capture_lead`, `transfer_call`, and
`check_caller_history`. Every DIRECTIVE ends with "Do not repeat this message
text on-air." `end_call` is untouched (returns a space character). **Exception
(Phase 61):** the `book_appointment` / `capture_lead` *success* path uses a
label form `BOOKED [verdict=...]:` / `LEAD CAPTURED [verdict=...]:` instead of
`STATE:` (see the Phase 61 address-validation section + its brittleness watch).

### Single-English-prompt policy (2026-06-11 — replaces the dual-prompt/D7 locale-parity policy)

The prompt is **one English prompt for every call**. The Phase 60.3 D7
"EN+ES parity" era (every section builder carrying an `if locale == "es"`
branch) is OVER — all ES branches were removed on 2026-06-11 with the
English text preserved byte-identically. The model speaks Spanish at
runtime when the call is in Spanish; it is *instructed* in English.

- `build_system_prompt(locale, ...)` keeps its signature; `locale` drives
  exactly ONE thing — the tenant-default-language line in the LANGUAGE
  section. `tests/test_prompt_locale_collapse.py` locks this structurally:
  en/es assembled prompts must differ in exactly that one line.
- Spanish delivery conventions (usted register, "código postal", Spanish
  reserved/prohibited word forms, Spanish fillers, times/dates/phones)
  live in the LANGUAGE section's SPEAKING SPANISH — DELIVERY GUIDE, in
  English. OUTCOME WORDS carries the Spanish reserved words in its
  "in any language, including Spanish" clause.
- **Do NOT reintroduce `if locale == "es"` branches in section builders.**
  New behavioral rules are written once, in English; if a rule has a
  Spanish-delivery implication, extend the LANGUAGE delivery guide.
- Out of scope for the collapse (still per-locale): the deterministic
  `session.say()` greeting + `max_duration_goodbye` in
  `src/messages/{en,es}.json`, post-call language detection,
  notifications, whisper_message.
- The old "Phase 30 structural gap" note (some blocks English-only under
  the dual-prompt era) is obsolete — everything is English by design now.

---

## 5. Tools (10 in-process)

Registry: `src/tools/__init__.py`. All tools run in-process with direct
Supabase access. Factories return `@function_tool`-decorated callables
with `deps` captured via closure.

**Always available:** `transfer_call`, `capture_lead`, `validate_address`,
`check_caller_history`, `check_customer_account`, `end_call`.
(`validate_address` is always-on — 2026-06-10 — because `capture_lead`
needs addresses too and is itself always registered.)
**Onboarding-complete gated:** `check_slot`, `check_day`,
`next_available_days`, `book_appointment`.

> **Note (prod-readiness 2026-06):** the former monolithic
> `check_availability` tool has been **split into three** availability
> tools — `check_slot` (specific date+time), `check_day` (open slots for a
> day), `next_available_days` (next N days with any availability). Each
> registers a `slot_token` in a per-call registry (`deps["_slot_tokens"]`,
> via `register_slot_token`) and returns it in its STATE line. Booking no
> longer passes raw ISO `slot_start`/`slot_end`; instead Gemini passes the
> opaque `slot_token` to `book_appointment`, which resolves it to the
> authoritative UTC start/end on `deps`. This eliminated the Gemini-drift
> timezone bug where the model reconstructed naive ISO strings from the
> caller's wall-clock speech (8h-off bookings). Sections referring to
> `check_availability` below are retained as historical context.

### check_caller_history — Silent Context

Parallel query: leads (3 most recent) + appointments (3 upcoming).
Phase 60 STATE codes:
- `STATE:repeat_caller prior_appointments=N prior_leads=N` + CONTEXT
  block — directive: use silently, never recite.
- `STATE:first_time_caller` — proceed with normal intake.
- `STATE:history_lookup_failed` (3 error paths) — proceed silently.

### check_slot / check_day / next_available_days — Slot Query (split from check_availability)

**Current state (prod-readiness 2026-06):** the single `check_availability`
tool was split into three:
- **`check_slot`** (`src/tools/check_slot.py`) — verify one (date, time).
  raw_schema enforces `required:[date,time]` + HH:MM / YYYY-MM-DD patterns.
  On hit, registers a `slot_token` and returns `STATE:slot_ok token=… speech=…`;
  also stashes `deps["_last_offered_token"]` as defense-in-depth for booking.
  On miss, returns `STATE:slot_taken … | ALTS: …token=…` with up to 3 nearby
  alternatives (each carrying its own token). **2026-06-12 (P1):** the
  `too_soon` branch now runs AFTER the schedule fetch and returns
  `earliest_today=<speech> token=…` (or, when today is done,
  `nothing_left_today=true next_open=<speech> token=…` from
  `_find_next_opening()` scanning the next 2 days); `day_empty` likewise
  carries `next_open=… token=…` when a later day has slots — every rejection
  ships with a tool-licensed alternative.
- **`check_day`** (`src/tools/check_day.py`) — **2026-06-12 (P1):** no longer
  yes/no; returns up to 3 representative windows spread across the day
  (`STATE:day_has_slots date_label=… count=N | OPTIONS: 1.<speech> token=…; …`
  via `pick_spread()`), each token registered in the shared registry so a
  caller-picked option books directly without a second check_slot.
- **`next_available_days`** (`src/tools/next_available_days.py`) —
  **2026-06-12 (P1):** returns the actual open-day labels
  (`STATE:has_near_availability days=Thursday, July 6th (5 open); …`)
  instead of yes/no; the agent offers the days, then check_day supplies
  times for the chosen day.
- All three import shared helpers from `src/tools/_availability_lib.py`
  (`calc_slots_for_dates`, `register_slot_token`, `parse_hhmm_to_utc`,
  `tenant_today`, …). (Phase 65: the Gemini-era `mute_input_during_tool`
  call + `deps["_last_tool_state"]` cascade-recovery replay were **removed** —
  gpt-realtime-2's async function calling makes them unnecessary.)
- **Same-day minimum-notice floor (2026-08-19):** `calc_slots_for_dates`
  drops TODAY's slots starting inside `MIN_NOTICE_TODAY_S` (3600s) — the slot
  calculator only skips slots that already STARTED, so check_day /
  next_available_days (and check_slot's match/ALTS paths) could previously
  offer + token-register a slot starting minutes from now, which
  book_appointment then booked with less notice than check_slot's own
  `too_soon` rule permits. Future days are unaffected; `book_appointment`'s
  slot-taken recompute and `post_call._calculate_suggested_slots` call
  `calculate_available_slots` directly and are untouched. Tests:
  `tests/test_availability_min_notice.py`. (2026-08-20: the third direct
  caller, `utils.calculate_initial_slots`, was DELETED as dead code — zero
  callers repo-wide; a Node-era `handleInbound` leftover.)

`slot_token` registry: `register_slot_token(deps, start, end)` stores
`{slot_start_utc, slot_end_utc, created_at}` under an opaque key in
`deps["_slot_tokens"]` (10-min TTL). `book_appointment` resolves the token
to authoritative UTC times — this is what replaced raw ISO slot passing.

### All-day busy expansion (2026-06-10)

All-day mirror rows on `calendar_events` / `calendar_blocks` store pure dates
as UTC-midnight timestamps (e.g. Google's exclusive end.date `2026-06-11`
lands as `2026-06-11T00:00:00Z`). Compared literally they blocked the wrong
local hours (08:00 → 08:00-next-day for an Asia/Singapore tenant).

- `src/lib/slot_calculator.py` — new `_all_day_busy_bounds(start, end,
  tenant_timezone)`: derives the covered calendar days from the UTC date
  components (the pure-date encoding — NOT the local conversion, which would
  shift the day for negative-offset tenants) and expands to
  **[00:00 local of first day, 00:00 local of day-after-last-day)**. The
  exclusive end is stepped back 1µs so a provider-style next-day-midnight end
  doesn't over-block an extra day; degenerate end ≤ start still blocks the
  start day. Same semantics as the JS twin in the main repo.
  `calculate_available_slots` applies it to any external block with
  `is_all_day=true`.
- **All calendar fetch sites now select `is_all_day`:**
  `_availability_lib.fetch_scheduling_data` (events + blocks),
  `book_appointment.py` slot-taken recalculation (events), the `agent.py`
  prefetch (events + blocks), and `post_call._calculate_suggested_slots`
  (events). (`utils.calculate_initial_slots` was a fifth site until its
  2026-08-20 dead-code deletion.)
- Tests: `tests/test_slot_calculator_all_day.py` (new).

---

### check_availability — Slot Query (HISTORICAL — replaced by the split above)

Parameters: `date` (YYYY-MM-DD), `time` (HH:MM 24h), `urgency`.

- Past-date validation rejects dates before today in tenant timezone.
- 1-hour minimum buffer for today.
- Fetches tenant config + 4 scheduling tables in parallel.
- Calculates slots via `calculate_available_slots()` with `max_slots=50`.
- Specific time check returns "Yes, X is available" with start/end for
  booking, or no + up to 3 closest alternatives.
- General check (date only or neither) returns confirmation ONLY — no
  specific times, no earliest/latest anchors, no slot count.
- 10 STATE codes (Phase 60): `availability_lookup_failed` (3 variants),
  `date_in_past`, `requested_time_too_soon`, `slot_available` (carries
  `start=ISO end=ISO speech=<pre-formatted>`), `slot_not_available`
  (with alternatives), `no_slots_available` (2 variants),
  `slots_available_unverified`.
- Directives reinforce "do not read the full slots list out loud" and
  "do not fabricate times."

### validate_address — Early Mid-Call Address Validation (2026-06-10)

`src/tools/validate_address.py`, factory-over-deps, raw_schema. Params:
`street` (required), `unit`, `postal_code`, `city`. Called the MOMENT the
caller finishes giving their address (after a one-sentence filler) — no
longer deferred to the booking/lead commit. Internally calls
`validate_address_with_region_fallback` (google_maps.py), which orchestrates
the unchanged Phase 61 `validate_address_bounded` (1.5s timeout, never
raises, `gmaps_validate_events` telemetry per attempt, Sentry on
`verdict=error` only) and is itself wrapped in a belt-and-braces try/except
(returns `address_noted` if the wrapper somehow raises).

**Caller-region fallback (2026-06-11):** `derive_caller_region`
(`src/lib/phone.py`, `phonenumbers.region_code_for_number`, never raises,
None for anonymous/unparseable caller-ID) sets `deps["caller_region"]` at
session setup — it correctly splits +1 into US vs CA by area code.
`validate_address_with_region_fallback(…, primary_region=tenant country,
caller_region=…)` contract: attempt 1 uses the tenant's country (unless that
region is unsupported while caller_region IS supported — then caller_region
goes first); attempt 2 fires ONLY when attempt 1 returns
`unconfirmed`/`unsupported_region` AND caller_region is truthy, differs from
the region attempt 1 used, and is in SUPPORTED_REGION_CODES (US/CA/SG). The
better verdict wins (confirmed > confirmed_with_changes > unconfirmed >
unsupported_region/skipped/error); ties go to attempt 1. Worst case adds one
extra 1.5s-bounded call on the rare unconfirmed path. Both attempts write
their own telemetry rows. All three validation sites use this wrapper
(validate_address tool + the book_appointment/capture_lead cache-miss
fallbacks); the winning result is what gets cached.

Returns (STATE+DIRECTIVE, never spoken verbatim):
- `confirmed` → `STATE:address_ok speech={formatted} | DIRECTIVE:confirm
  the address back in ONE short sentence and continue…`
- `confirmed` + caller gave NO postal but the result has one (2026-06-12 P2)
  → `STATE:address_ok_confirm_postal speech={formatted} postal={postal} |
  DIRECTIVE:…ask whether the postal code is right as a QUESTION, digit by
  digit — never state it as a fact…` (incident call 31559053: a
  Google-inferred postal was asserted, then defended against the caller)
- `confirmed_with_changes` → `STATE:address_corrected speech={formatted} |
  DIRECTIVE:read the corrected address once, ask briefly if that's right…`
  (at most one correction loop, then re-call validate_address)
- `unconfirmed` → `STATE:address_unclear missing={hint} | DIRECTIVE:ask ONE
  targeted follow-up… After one retry, proceed with what the caller said.`
- `skipped`/`unsupported_region`/`error` → `STATE:address_noted
  speech={as caller said it} | DIRECTIVE:read it back once and continue.
  Never mention validation.` (never blocks, never exposes internals)

**Country guard (2026-06-12 P2):** `_apply_country_guard` inside
`validate_address_with_region_fallback` downgrades any confirmed*
result whose `address_components.country_code` contradicts the trusted
region (caller-ID region when in SUPPORTED_REGION_CODES, else tenant
country) to `unconfirmed` with all Google-derived fields stripped —
applied to BOTH attempts, before the retry decision, so a wrong-country
attempt-1 confirmation triggers the caller-region retry (self-heals the
Utah-booking incident eef9f785 even with a misconfigured tenant.country).

Caches the full bounded result on `deps["_validated_address"] =
{"input": {street,unit,postal_code,city}, "result": <bounded dict>,
"ts": …}` and sets `deps["_last_tool_state"]`.

**Cache reuse:** `book_appointment` / `capture_lead` call
`get_cached_validation(deps, street, postal_code)` (exported from
`validate_address.py`) before their own validation. On a match
(casefold/strip street + postal compare; **unit differences tolerated**;
cached `verdict=error` never reused — transient failures get a fresh
attempt; **2026-06-12 P2: an empty cached postal also matches when the
requested postal equals the result's looked-up postal** — the
address_ok_confirm_postal flow where the caller confirmed the suggested
postal) they reuse the cached result with NO second Google call; on a
miss they validate live exactly as before (safety fallback — booking
never gates on validate_address having run). The reused
verdict/formatted_address/place_id/lat/lng flow into `atomic_book_slot` /
`record_outcome` identically to a live validation; the D-D3' overwrite
rule is unchanged. Tests: `tests/test_validate_address_tool.py`.

**Service-Area gate (M16 P1, 2026-06-20 — Capability A):** after caching
`deps["_validated_address"]`, `validate_address` runs the gate via
`classify_service_area(zones=…, postal_code=…, locality=…)`
(`src/lib/service_area.py`, pure — no DB/network). It classifies **only on a
solidly confirmed address** (`confirmed` / `confirmed_with_changes`) and
deliberately **SKIPS the `address_ok_confirm_postal` branch** (that postal is
an unconfirmed Google lookup, not caller-said — never gate on it). Inputs are
the Google-normalized `address_components.postal_code` + `.locality`, classified
against `zones = deps["_slot_cache"]["service_zones"]` (the `agent.py`
slot-cache prefetch SELECT was widened to add `cities` alongside the existing
zone fields). The result is stored on `deps["_service_area"]`.

`classify_service_area` unions `postal_codes[]` + `cities[]` across the tenant's
`service_zones` rows (normalized — case/punctuation-insensitive, CA/UK postal
spaces ignored) and is **biased HARD to false-ACCEPT**: it returns
`out_of_area` ONLY when there IS a coverage list AND a trusted postal/town
signal that does not match; an empty coverage list yields `unconfigured` (gate
off), and a missing/ambiguous signal yields `unknown` — both fall through to the
normal flow. `matched_on` records `postal` / `city` / `None`.

When the verdict is `out_of_area`, the gate **OVERRIDES the STATE+DIRECTIVE**
the tool would otherwise return, via the new helper
`_out_of_area_state(action, formatted, referral_note)` → a new token
`STATE:address_out_of_area action=<callback|decline_referral|trip_fee>`. The
owner action + referral note are read from `deps["tenant"]`
(`out_of_area_action` / `out_of_area_referral_note`, loaded via the existing
`select("*")`). A **prohibited-phrase guard** forbids the caller-facing wording
from ever saying "zone" / "service area" / "coverage" / "buffer" /
"travel time" — only "a bit outside the area we usually cover". The three modes:

- **callback** (default) — don't book; take a message + promise a call-back.
- **decline_referral** — don't book; politely decline + optional referral
  (the `out_of_area_referral_note`).
- **trip_fee** — book as normal, but mention a possible travel charge.

The gate **fails OPEN**: any exception falls through to the normal flow and it
never blocks the call. (Capability B — back-to-back travel feasibility — is
M16 P2 and not yet built.) Tests: `tests/test_service_area.py` + gate tests
added to `tests/test_validate_address_tool.py`.

### book_appointment — Atomic Booking

Parameters (current, prod-readiness 2026-06): `slot_token`, `street_name`,
`postal_code`, `caller_name`, `unit_number?`, `urgency` (default "routine").
The raw_schema **no longer exposes `slot_start`/`slot_end`** — those are
resolved server-side from `slot_token` against `deps["_slot_tokens"]`. (The
handler keeps empty `slot_start`/`slot_end` locals only so the legacy
`_ensure_utc_iso` fallback branch stays syntactically intact; that branch is
dead when a valid token resolves.)

- **Phase 65 — input-mute / cascade-recovery removed:** the Gemini-era
  `mute_input_during_tool(deps)` call and the `deps["_last_tool_state"]`
  replay plumbing (consumed by the now-deleted `_attempt_tool_result_replay`)
  were removed. They existed only to survive Gemini 3.1's server-VAD
  cancellation cascade; gpt-realtime-2's async function calling does not
  cancel in-flight tool calls when the caller speaks, so they are obsolete.
- **slot_token resolution:** if Gemini supplies an unknown/empty token,
  falls back to `deps["_last_offered_token"]` (single-slot path only; the
  alternatives branch clears it). Token entry older than 600s → treated as
  expired.
- Urgency normalization (backlog 999.1 fix): `_normalize_urgency()` maps
  freeform `"high"` → `"urgent"`, `"low"/"normal"` → `"routine"`,
  `"critical"/"asap"` → `"emergency"`. Unknown → `"routine"`.
- **Idempotency cache**: checks `deps["_last_booked_slot_key"]` against
  `f"{slot_start}|{slot_end}"` (resolved from the token). Cache hit →
  return cached response, no re-run.
- Calls `atomic_book_slot()` via Supabase RPC.
- On success:
  - `booking_outcome='booked'` written IMMEDIATELY (before side effects).
  - Calendar push + caller SMS fired as `asyncio.create_task()` (truly
    non-blocking — previously awaited, caused 1-4s silence + duplicate
    invocations).
  - Returns in ~300ms.
- On slot taken: checks idempotency cache first (late duplicate → return
  cached success, no spurious recovery SMS). Otherwise recalculates,
  writes `booking_outcome='attempted'` (conditional on NULL), fires
  recovery SMS as `create_task`.
- Phase 60 STATE codes: `booking_succeeded appointment_id=...`,
  `slot_taken`, `booking_invalid reason=<snake>`,
  `booking_failed reason=rpc_error`.
- Phase 46 booking-reconciliation stamping: `deps["_booking_succeeded"]`,
  `deps["_booked_appointment_id"]`, `deps["_booked_caller_name"]`
  persisted for post-call pipeline to reconcile race.

### capture_lead — Lead Capture

Parameters: `caller_name`, `phone`, `street_name`, `unit_number`,
`postal_code`, `job_type`, `notes`.

- Computes mid-call duration from `start_timestamp`.
- Calls `create_or_merge_lead()`, writes `booking_outcome='declined'`.
- **`notes` persisted (2026-06-10):** the `record_call_outcome` RPC
  (migration 062, 14-arg) has no notes-like parameter and `inquiries` has no
  notes column, so `notes` is folded into the job_type free-text passed to
  the RPC — `"{job_type} — {notes}"` (or just `notes` when job_type is
  empty). Previously the captured notes were silently dropped.
- **Explicit callback phone preferred (2026-06-10):** when the model passes a
  `phone` AND it parses to a plausible E.164 via `_normalize_free_form`
  (imported from `src/integrations/jobber.py`; phonenumbers with the tenant's
  country as default region — handles spoken/free-form shapes the SIP-attr
  normalizer does not), that number is used as `raw_phone` for
  `record_outcome` instead of caller-ID. On parse failure, falls back to
  caller-ID (`deps["from_number"]`) as before. Callers who said "reach me on
  my other number" were previously losing it.
- STATE codes: `lead_captured lead_id=...`, `lead_invalid`, `lead_failed`.
- Phase 60 D-11 parity: same single-question address + readback rules as
  book_appointment.
- **Idempotent on `lead_calls` insert.** Mid-call `capture_lead` and the
  post-call pipeline (step 9, `create_or_merge_lead()`) can both route to
  the same (lead_id, call_id) pair. The junction write is an upsert with
  `on_conflict=('lead_id','call_id')` + `ignore_duplicates=true` —
  matches the TS-side `src/lib/leads.js` pattern. A plain INSERT would
  raise `lead_calls_pkey` 23505 on the second call.
- **Service-area stamp (M16 P1, 2026-06-20).** `capture_lead` now captures
  the `record_outcome` return, re-runs `classify_service_area` from its OWN
  `validation_result` (confirmed* only, same `confirmed`/`confirmed_with_changes`
  rule as the validate_address gate), and refreshes `deps["_service_area"]`.
  When the verdict is `out_of_area` it stamps `inquiries.out_of_area = true`
  via a follow-up service-role UPDATE keyed by the returned `inquiry_id` — the
  hardened `record_call_outcome` RPC is intentionally NOT overloaded with an
  out-of-area parameter. Best-effort: a failure here never breaks lead capture.

### check_customer_account — Re-serve Customer Context

Re-serves `deps["customer_context"]` (populated pre-session from Xero +
Jobber). Never re-fetches. See
`integrations-jobber-xero/references/python-agent-injection.md` for full
coverage of the Xero/Jobber merge and STATE format.

Returns locked `STATE:no_xero_contact_for_phone` when customer_context
is None. Always available (not gated on onboarding_complete).

### transfer_call — SIP REFER

Parameters: `caller_name`, `job_type`, `urgency`, `summary`, `reason`.
Writes `exception_reason` to calls row. Performs SIP REFER via
`LiveKitAPI().sip.transfer_sip_participant()` to `sip:{ownerPhone}@pstn.twilio.com`.

STATE codes preserved (Phase 30 names): `transfer_initiated`,
`transfer_failed reason=sip_error`, `transfer_unavailable` — now
wrapped in canonical `STATE|DIRECTIVE` envelope.

**Failed-transfer revert (2026-06-10):** the handler snapshots the prior
`deps["call_end_reason"][0]` before optimistically setting `"transferred"`;
on REFER failure it restores the prior reason AND nulls the calls row's
`exception_reason` (best-effort, non-fatal on revert error). The call
continues after a failed REFER — leaving "transferred"/exception_reason in
place poisoned the `disconnection_reason` recorded by the post-call pipeline.

### end_call — Graceful Termination

Returns a `STATE:call_ending | DIRECTIVE:...` envelope that tells the model
not to start a new turn after its current sentence completes.

Schedules a detached `_delayed_disconnect` task that:
1. Awaits `session.current_speech.wait_for_playout()` (livekit-agents 1.5.1
   native API) — blocks until the in-flight audio stream has fully drained
   through the SIP output. Capped at 20s as a hung-generation safety belt.
2. Removes the SIP participant via `LiveKitAPI().room.remove_participant()`.
3. Calls `ctx.shutdown()` which cascades into session close + post-call
   pipeline.

**Why not a fixed `asyncio.sleep(12)` (the legacy approach)?** A fixed
timer cut off long farewells when speech exceeded the budget and fired
too early on short ones. Worse, when the model called `end_call` mid-farewell,
the old return string `"[Call disconnected — do not produce any further
speech.]"` caused Gemini to abort its own in-flight audio, producing the
"speech cuts off halfway" symptom. The new return lets the current
sentence complete; the playout wait ensures the SIP buffer drains before
the participant is removed.

**Session handle plumbing:** `agent.py` sets `deps["session"] = session`
immediately after `AgentSession(...)` is constructed so the tool's
disconnect task can access `session.current_speech`.

### Phase 60.2 — Fix H reverted (accepted limitation)

Plan 03 implemented deterministic runtime filler in 4 scoped tools via
`context.session.say()`. Plan 05 UAT (2026-04-20, 226s call) revealed
`session.say()` raises `RuntimeError: trying to generate speech from
text without a TTS model` on `AgentSession(llm=RealtimeModel)` in
livekit-agents 1.5.1 — the session has no TTS because the realtime model
emits audio directly. Fix H reverted (commit `cbe1bb9` in livekit-agent repo).
**(stale — superseded by the Phase 66 cascade, see agent.py:** the cascade
session HAS a TTS, so `session.say()` works again and is used for the
deterministic greeting and the max-duration goodbye. The "no `session.say()`"
constraint applied only to `AgentSession(llm=RealtimeModel)`.) Pre-tool
preambles remain prompt-driven prose (`_build_tool_narration_section` in
`prompt.py`).

### Phase 60.3 — Goodbye cut-off diagnosis + prompt audit

**Stream A — Goodbye cut-off fix (Branch P, prompt-only):**

- **Plan 01 — Diagnostic instrumentation** (livekit-agent commit
  `c4f0570`). Added a per-call `[goodbye_race]` JSON logger.info line +
  Sentry breadcrumb emitted on every session close, via 6 public-API
  hooks in `src/agent.py` + `src/tools/end_call.py`: `end_call_invoked_at`,
  `last_text_token_at`, `last_audio_frame_at`, `playback_finished_at`
  (with `text_done` + `audio_done` flags sourced from the framework
  warning's `LogRecord extra=` fields — no private-symbol access),
  `participant_disconnect_at` + `disconnect_reason`, `session_close_at`
  + `close_reason`. Record also carries `transcript_tail` (last 3 turns,
  ≤500 chars, E.164-redacted via `_PHONE_REDACT_RE`) and
  `tool_call_log_tail`. Schema v1. `_flush_goodbye_diag` is the FIRST
  statement in `_on_close_async` so the record survives Fix I's 8s
  post-call pipeline timeout. `caller_phone_sha256` (SHA-256 first-16-hex)
  is used for operational grouping; raw E.164 numbers are NEVER logged.
- **Plan 02 — UAT #1 + analysis** (evidence in
  `.planning/phases/60.3-.../60.3-HUMAN-UAT.md` §"Stream A — UAT #1" +
  `60.3-STREAM-A-ANALYSIS.md`). Owner-placed call
  `call-_+6587528516_KwsBVWBZkKps` reproduced mid-word truncation
  (`"Alright, I'll get all"` [cut]); payload showed `text_done=false,
  audio_done=true` (textbook upstream #5096 signature) AND
  `end_call_invoked_at` -11ms before `last_text_token_at` (directional
  Branch P signal). 3× mid-call `_SegmentSynchronizerImpl` warnings
  (+152s/+202s/+222s) proved the pipeline race is systemic, not
  goodbye-isolated. Ambiguous evidence → **Branch P** selected
  (prompt-only, fully revertable); Branch G deferred per
  evidence-driven discipline.
- **Plan 03 — Branch P fix + UAT #2** (livekit-agent commit `ebaa556`).
  `_build_call_duration_section` promoted to `ENDING THE CALL — CRITICAL
  RULE:` block with WRONG/RIGHT inline failure-mode example (`"Thank
  you for calling Voco — have a' *click*` vs speak-→-silence-→-separate-
  turn-end_call); section reordered to position 5 of `build_system_prompt`
  (top-attention band, after `_build_outcome_words_section` before
  `_build_tool_narration_section`). 5 new TDD tests in
  `tests/test_prompt.py`. UAT #2 (`call-_+6587528516_B8XEm2FgLTGZ`, 62s)
  verdict **PARTIAL**: primary #5096-race goal achieved
  (`_SegmentSynchronizerImpl` warning absent, transcript ended on a
  complete sentence), but surfaced a decline-case farewell-content gap
  (model said only `"I understand."` and invoked end_call without any
  farewell phrase). Tracked as a Stream B candidate (see Plan 05 in the
  audit below).
- **Upstream reference:** livekit/agents#5096 (authoritative
  Gemini-Realtime + EndCallTool bug). **#4486 is a DIFFERENT race class
  — do not conflate.**
- **Instrumentation sample-rate dial-back (D-A-03):** currently
  every-call. Dial-back to race-detected-only (only emit when the
  synchronizer warning fires with `text_done=false`) is explicitly
  NOT recommended yet — the cumulative Stream B UAT (below) surfaced
  a new "never-ends-call" regression that benefits from full-sample
  coverage; re-evaluate inside Phase 60.4.

**Stream B — Prompt audit + locale parity (Plans 04-12):**

- **Plan 04 — Prompt audit doc** (homeservice_agent commit `6653675`).
  `60.3-PROMPT-AUDIT.md` scored all 16 `_build_*_section` builders
  across 7 dimensions (anti-hallucination, realtime-model phrasing,
  section ordering, STATE+DIRECTIVE, VAD-redundant, token economy,
  locale parity). Finding: **D7 locale parity ✗ on 13 of 15 active
  sections** — the dominant cross-cutting gap, responsible for the
  Plans 05-12 patch series.
- **Plans 05-12 — Per-section patches** (one atomic livekit-agent
  commit per plan, shipped Railway-live):
  - P05 `_build_call_duration_section` (RED `144cbf9`, GREEN `9f27a7a`)
    — EN CRITICAL RULE preserved verbatim, ES `"TERMINAR LA LLAMADA —
    REGLA CRÍTICA"` mirror added with USTED register + INCORRECTO /
    CORRECTO parallel example. Establishes the inline-branch pattern.
  - P06 `_build_tool_narration_section` (RED `1e0da25`, GREEN `c2bd059`)
    — ES filler-phrase examples per tool; 60.2 Pitfall-6 inverted
    assertions preserved (tool names `check_availability`,
    `book_appointment`, `capture_lead`, `transfer_call` NOT translated
    — code identifiers, enforced at the test layer).
  - P07 `_build_voice_behavior_section` (RED `2e035a4`, GREEN `2d24bbb`)
    — ES `"ESTILO DE VOZ Y CONVERSACIÓN"` (energy-matching, readback
    slowdown, one-focused-thing, acknowledge-before-advance). EN
    preserved (D5 VAD-redundant pacing is load-bearing for realtime
    boundary coaching, not redundant with Fix G VAD).
  - P08 `_build_corrections_section` (RED `fcf81d1`, GREEN `9336955`)
    — ES `"MANEJO DE CORRECCIONES — REGLA CRÍTICA"` (5 numbered rules;
    Spanish address example `"Calle Principal 123"` → `"Avenida Roble
    456"`). D2 negation-reframe deferred — corrections section IS the
    anti-hallucination spine for caller-supplied facts.
  - P09 `_build_outcome_words_section` (RED `10adac7`, GREEN `2ffffa1`)
    — ES `"PALABRAS DE RESULTADO — REGLA CRÍTICA"` with reserved-word
    enumeration (disponible / confirmado / reservado / specific time
    ↔ tool pre-condition). **Highest D1 anti-hallucination stakes in
    the entire prompt.** Top-attention-zone coverage complete in both
    locales.
  - P10 `_build_info_gathering_section` (RED `7f47488`, GREEN `b2b1027`)
    — outer-frame ES parity + D6 compression (dropped redundant
    language-switch reminder) + Rule-2 additions (PHONE NUMBER /
    NÚMERO DE TELÉFONO digit-by-digit readback block; `postal_label`
    wired into both address blocks). Invariant-lock plan pattern
    established via 10 inverted-substring assertions.
  - P11 `_build_booking_section` (RED `bd65986`, GREEN `af2653e`)
    — closed the 85% ES parity gap (previously only the READBACK block
    was localized). ES `RESERVA / PROGRAMACIÓN / REGLAS DE
    DISPONIBILIDAD / MANEJO DEL RESULTADO / ANTES DE RESERVAR — LECTURA
    DE CONFIRMACIÓN / DESPUÉS DE RESERVAR` mirrors EN 1:1. D1
    anti-hallucination invariants codified at test layer (two-step
    availability contract, mandatory readback, no "confirmed"/"booked"
    until `book_appointment` returns success).
  - P12 `_build_identity` + `_build_working_hours` + `_build_greeting`
    + `_build_language` + `_build_customer_account` + `_build_intake_questions`
    + `_build_decline_handling` + `_build_transfer` (RED `8535cb2`,
    GREEN `ffab7c0`) — 8 remaining builders batch-locale-branched with
    USTED register. Full assembled EN/ES length delta 10.2% (within
    30% drift guard).

**D-B-03 closure — "full 16 sections × 2 locales":**

The mandate is satisfied, with documented exceptions:

- `_build_repeat_caller_section` returns `""` unconditionally — no
  content, no parity work (intentional no-op).
- `_build_working_hours_section` internal dict KEYS (`"monday"` etc.)
  stay English for tenant-config lookup compatibility; caller-facing
  prose (day labels, "closed", lunch notes) IS translated.
- Tool names (`check_availability`, `book_appointment`, `capture_lead`,
  `end_call`, `transfer_call`) are code identifiers and never
  translated — enforced as a test assertion in `test_prompt_tool_narration.py`.
- `TONE_LABELS` dict values (`"measured and formal"` etc.) are not
  translated — embedded in identity_section prose; low-impact.
- `customer_context` STATE block from `format_customer_context_state`
  remains English (structured data; Jobber/Xero field-name cross-runtime
  Python ↔ TS consistency per Phase 55/56).

`grep 'if locale == "es":' src/prompt.py` count at phase close: **15**
(booking counted once post-Plan-11 top-level promotion). Test count at
phase close: **205 passed, 1 deselected** on livekit-agent pytest
(baseline 101 from 60.2; +104 new tests across 8 new files
`test_prompt_call_duration.py`, `test_prompt_tool_narration.py`,
`test_prompt_voice_behavior.py`, `test_prompt_corrections.py`,
`test_prompt_outcome_words.py`, `test_prompt_info_gathering.py`,
`test_prompt_booking.py`, `test_prompt_tail_sections.py`, plus
existing `test_prompt.py` extensions — 60.2 Plan 05 inverted
assertions preserved).

**Cumulative UAT (Plan 13) — VERDICT: PARTIAL, new regression surfaced:**

Live call `call-_+6587528516_wZcRQ5JBcMq3` (386s, booked appointment
`d46bab5e-fe58-4a99-90ea-4a9704453a1c` for 2026-04-30 14:00). Full
goodbye phrase completed — Stream A Branch P primary goal **ACHIEVED**
(`"Thank you for calling make it ai. Have a great day. Goodbye."` with
no mid-word truncation). But the Branch P CRITICAL RULE's "THEN in a
separate turn with no additional speech, call end_call" over-corrected
— the model waited **16.177 seconds** between `last_text_token_at` and
`end_call_invoked_at`, and the caller (who said "Hello." into the
post-goodbye silence) manually hung up. Tracked as the anchor
follow-up for Phase 60.4; see `60.3-SUMMARY.md` §Follow-ups.

**Spanish locale branches remain unverified in production.** Call B-2
(Spanish language-detection path) was not placed during the cumulative
UAT. Plans 05-12 ES code has shipped to Railway but only symmetry
(structural parity with EN) is proven; live Gemini Realtime behavior
against Spanish prose will be verified in Phase 60.4.

**Plans 60.3-01 through 60.3-13 full documentation** — see
`.planning/phases/60.3-voice-agent-goodbye-cutoff-and-prompt-audit/`
(context, research, audit, analysis, HUMAN-UAT, phase rollup).

### Phase 63.1 — generate_reply regression fix (Gemini 3.1 + plugins-google 1.5.6)

> ⚠️ **SUPERSEDED by Phase 65 (gpt-realtime-2 migration).** This worked around
> Gemini 3.1 capability-gating `generate_reply` closed (which forced the
> separate-TTS greeting + pre-session intake injection). gpt-realtime-2
> supports `generate_reply`, so the greeting is native again. The **pre-session
> intake-injection pattern still holds** (intake text goes into the initial
> `build_system_prompt(...)`), but the `test_no_generate_reply_in_src` guard was
> deleted in the migration. Retained as debugging history.

**What broke.** On the Phase 63 upgrade to `livekit-agents==1.5.6` +
`livekit-plugins-google==1.5.6`, `RealtimeModel` for
`gemini-3.1-flash-live-preview` began silently capability-dropping any
`session.generate_reply(...)` call. Plugin warning + error logs:
`generate_reply is not compatible with 'gemini-3.1-flash-live-preview'`
and `failed to generate a reply: generate_reply is not compatible`.
User-visible symptom: the agent never spoke the greeting, and tenant
intake questions were never injected. The caller had to speak first
for any agent turn to be emitted.

**Root cause.** The 1.5.6 google plugin guards `generate_reply` on a
per-model capability matrix; `gemini-3.1-flash-live-preview` is marked
incompatible. Unlike the 1.5.1 + git `43d3734` pin (which supported
it), the 1.5.6 mainline no-ops these calls rather than raising — they
fail silently at runtime with only warnings, so tests and imports pass
but live calls regress.

**Fix shape (Plans 02 + 03).** Two-part hybrid:

- **Plan 02 — `src/agent.py`.** Both `session.generate_reply(...)` call
  sites deleted (intake injection L702-717 + greeting L754-758). The
  intake_questions Supabase fetch was hoisted OUT of `_run_db_queries`
  (parallel gather) and INTO the pre-session construction block
  (mirroring the existing Xero/Jobber customer_context pattern), so
  the fetched list is threaded through
  `build_system_prompt(intake_questions=intake_questions_text)` and
  arrives in Gemini's initial `instructions=system_prompt` payload.
  `session_ready = asyncio.Event()` + `.set()` + `.wait()` fully
  removed as dead code. `_run_db_queries` result-unpacking converted
  from index-based (`results[N]`) to named tuple unpacking to prevent
  reindex bugs.
- **Plan 03 — `src/prompt.py`.** `_build_greeting_section` extended
  append-only with a `FIRST TURN:` / `PRIMER TURNO:` block prepended
  to the existing `OPENING:` / `APERTURA:` structure (both locale
  branches, USTED register). Outcome-shaped (describes what the
  caller hears, not a mechanical instruction sequence) — no verbatim
  script strings like `"Thank you for calling"` / `"Gracias por
  llamar"`. The replacement mechanism is the Gemini server VAD:
  with `system_prompt` now containing a "the FIRST thing the caller
  hears is a warm, branded greeting" directive, the VAD firing on the
  caller's first audio frame elicits the greeting organically.

**Regression guard.** `tests/test_no_generate_reply_in_src.py` — pure
stdlib regex scan of `src/**/*.py` (skipping `__pycache__`) for
`\bgenerate_reply\s*\(` with leading-`#` comment skip. Failure message
embeds `file:lineno:line_content` and documents the 1.5.6+3.1 silent-
drop failure mode so future regressions are caught at test time rather
than in production. Paired with 6 `tests/test_prompt_greeting_directive.py`
RED→GREEN tests locking the EN+ES directive contract at the
`_build_greeting_section` section surface (scoped, not full-prompt, to
avoid false positives from Phase 60.3 Plan 03
`_build_call_duration_section`'s `"Thank you for calling Voco"` WRONG-
example teaching string).

**Commits (livekit-agent branch `phase-63.1-generate-reply-fix` →
merged to `main` via `--no-ff` merge commit `bc4befd`):**

| SHA     | Plan | Message |
|---------|------|---------|
| `943c9d9` | 01 | `test(63.1): RED tests for greeting directive + intake audit` |
| `dab383e` | 01 | `test(63.1): RED grep-guard against session.generate_reply( in src/` |
| `3e43bb3` | 02 | `fix(63.1): hoist intake_questions fetch pre-session; delete intake-side generate_reply` |
| `823aab3` | 02 | `fix(63.1): delete greeting-side generate_reply + session_ready.set (grep-guard GREEN)` |
| `cc5e43a` | 03 | `fix(63.1): outcome-shaped first-turn greeting directive in _build_greeting_section (EN+ES)` |
| `bc4befd` | 04 | `merge(63.1): generate_reply regression fix` (--no-ff, preserves all Phase 60.4 + Phase 63 D-08 SHAs) |

**Test suite status at phase close.** 254 passed, 1 pre-existing
deferred VIP failure (`test_incoming_call_vip_lead`, tracked since
Plan 60.3-01 in `deferred-items.md`). All 6 greeting-directive tests
GREEN post-Plan-03; grep-guard GREEN on post-merge main.

**Live UAT disposition.** Plan 04 Task 2 (live UAT call on Railway
preview) was **skipped by explicit user directive** in favor of
direct merge-to-main + prod Railway auto-deploy. D-09 #1 (zero
`generate_reply is not compatible` warnings) verified offline via
grep-guard test; D-09 #2 (agent speaks first) verification deferred
to the next live call on prod. See
`.planning/phases/63.1-gemini-3-generate-reply-regression-fix/63.1-UAT.md`
for the exact disposition record.

**Applies to any future 1.5.6 + Gemini-3.x data-injection need.** The
generalizable pattern this phase establishes:

- Needed tenant/caller-specific data injected at call start → fetch
  it pre-`session.start()` and include it in the initial
  `build_system_prompt(...)` payload via a new kwarg.
- Needed the agent to speak first / open with a specific shape →
  encode it as an outcome-shaped directive in the relevant prompt
  section; rely on Gemini server VAD (`silence_duration_ms`) firing
  on first caller audio to elicit the turn.
- Needed a regression guard against future `session.generate_reply(`
  creep → extend `tests/test_no_generate_reply_in_src.py` or mirror
  its pure-stdlib regex-scan pattern.

**Plans 63.1-01 through 63.1-04 full documentation** — see
`.planning/phases/63.1-gemini-3-generate-reply-regression-fix/`
(context, research, per-plan SUMMARY, UAT, phase rollup).

### Phase 63.2 — LiveKit SDK patch upgrade 1.5.6 → 1.5.7 (hygiene + dry run)

**What shipped.** Pure patch-version bump in
`livekit-agent/pyproject.toml`: all four livekit-* pins moved from
`==1.5.6` to `==1.5.7` (released 2026-04-30). Zero `src/` files
modified — the audit-driven D-05 zero-forced-edits thesis held.

**Upstream contents of 1.5.7 (per PyPI release notes):**

1. `fix(gemini live): use parameters instead of parameters_json_schema for raw schema function tools`
2. `fix: realtime reply generation after interruption`

**Why neither fix forced a code edit (2026-05-05 audit).** Fix #1
does not apply: all four `@function_tool(raw_schema=...)` call sites
(`book_appointment.py:251`, `check_slot.py:70`, `check_day.py:53`,
`next_available_days.py:43`) already use the standard JSON Schema
`parameters` key; zero references to `parameters_json_schema` exist
in `src/`. Fix #2 has no code dependency: the agent has no custom
interruption-recovery path — only one `@session.on("agent_false_interruption")`
diagnostic log handler at `src/agent.py:582-586`. Reply-after-
interruption is fully delegated to Gemini server VAD + the SDK's
internal handling.

**Honest framing.** This is a **hygiene patch bump**, not a behavior
fix. Motivations: (a) staying current with upstream patch fixes for
bug-class reduction we don't yet know about, (b) dry-run muscle-
memory before the next material upgrade. The SegmentSynchronizer
cutoff race (`_SegmentSynchronizerImpl.playback_finished called
before text/audio input is done`) and the `server cancelled tool
calls` warnings remain byte-identical at 1.5.7 — tracked separately
for a future phase, NOT this one's scope.

**Branch + merge protocol (D-02 / D-10).** Cut feature branch
`phase-63.2-livekit-1.5.7` from `livekit-agent/main` tip
(`187d207`), single-commit pin bump (`8850b4f`), Railway preview
green + one UAT call to `+14783755631` (SG tenant `+6587528516`)
booking confirmed end-to-end with `check_availability` →
`book_appointment` → Google Calendar event. User issued `merge`
verdict; merged via `--no-ff` to `livekit-agent/main` as commit
`d3b1f0a` (`fix(63.2): merge 1.5.7 patch upgrade`). All 12 D-04
preserved SHAs (Phase 60.4 + 63 + 63.1 + Phase-64-revert) verified
present on post-merge main.

**Local preflight (Task 2).** Clean `pip uninstall` + `pip install
--no-cache-dir -e .` resolved all four packages from
`site-packages` (NOT a stale git-builds cache — Pitfall 3 mitigated
the same way Phase 63 did). RealtimeModel boot-smoke green; the
benign `'gemini-3.1-flash-live-preview' has limited mid-session
update support` capability-hint console line still fires at 1.5.7,
confirming PR #5413 capability routing remains active. Grep-guard
`tests/test_no_generate_reply_in_src.py` GREEN.

**Pytest deviation note.** Plan authored against expected baseline
"254 passed / 1 failed" (Phase 60.4 era). Actual at execute time
was "9 failed, 284 passed, 2 collection errors" — drift caused by
codebase advancing through Phase 61 / 61.1 / Phase 64-revert
between plan-authoring (2026-05-05) and execute. Executor verified
all 9 failures + 2 collection errors are pre-existing on the 1.5.6
baseline by rolling the venv back to 1.5.6 and re-running the same
five test files; identical failures. None are 1.5.7-induced.
Pre-existing baseline failures logged to `deferred-items.md`
(Rule 1 scope-boundary path) — D-05, D-06, D-07 all hold.

**Commit (livekit-agent branch `phase-63.2-livekit-1.5.7` →
merged to `main` via `--no-ff` merge commit `d3b1f0a`):**

| SHA       | Plan | Message |
|-----------|------|---------|
| `8850b4f` | 01   | `fix(63.2): bump livekit-* pins to 1.5.7 patch release` |
| `d3b1f0a` | 01   | `fix(63.2): merge 1.5.7 patch upgrade` (--no-ff, preserves all 12 D-04 SHAs) |

**Pyproject.toml comment block at 1.5.7 (lines 7-12):**

```toml
# Pinned at 1.5.7 (2026-04-30) — patch bump on top of Phase 63's 1.5.6 mainline.
# 1.5.7 picks up: gemini-live raw-schema parameters fix + realtime reply-after-interruption fix.
# See .planning/phases/63.2-livekit-sdk-patch-1-5-7/63.2-CONTEXT.md (audit confirms neither fix forces src/ edits in this stack).
"livekit-agents==1.5.7",
"livekit-plugins-google==1.5.7",
"livekit-plugins-silero==1.5.7",
"livekit-plugins-turn-detector==1.5.7",
```

**Hygiene-bump pattern established for future patch releases.**
Single-commit pin-only branch, ~30-min checkpoint cycle, Railway
preview gate, one UAT call before `--no-ff` merge. The pattern is
valid for any future patch (1.5.8, 1.5.9) where upstream changelog
inspection + `src/` audit shows zero forced edits. If any future
patch *does* force a code edit, the branch grows scope or splits
into a follow-up — this branch's thesis stays "pure pin bump".

**Date.** Merged 2026-05-05.

**Plan 63.2-01 full documentation** — see
`.planning/phases/63.2-livekit-sdk-patch-1-5-7/`
(context, plan, HUMAN-UAT, per-plan SUMMARY, phase rollup).

---

## 6. Post-Call Pipeline

**File**: `src/post_call.py`

Runs in-process immediately on AgentSession close.

`run_post_call_pipeline(params)` steps:

1. Build transcript — `transcript_text` (string) + `transcript_structured`
   (JSON list).
2. Update call record — `status='analyzed'`, transcript, recording path,
   disconnection_reason.
2b. **Booking reconciliation (Phase 46)** — if
    `booking_succeeded`, force `calls.booking_outcome='booked'`
    unconditionally; backfill `appointments.call_id = call_uuid` for the
    returned `booked_appointment_id` with `.is_("call_id", "null")`
    guard. Closes race where mid-call update matched zero rows because
    the `_run_db_queries` task hadn't inserted the calls row yet.
3. Test-call auto-cancel — cancel appointment + reset lead if
   `is_test_call` (benefits from the backfill too).
4. Usage tracking — `increment_calls_used` RPC; resolve the Stripe customer if
   over limit. **LK-B2 (2026-06-21): the slow Stripe meter POST was MOVED OUT of
   §4 into §7.5 (after owner notifications)** so billing can never starve the
   owner alert in the 8s budget. §4 now only runs the fast local `increment_calls_used`
   + the `subscriptions` customer lookup, carrying `overage_customer_id` forward
   (None = nothing to bill). See §7.5 for the deferred meter post + outbox.
5. Language detection — multi-language regex: CJK→zh, Tamil→ta,
   Vietnamese→vi, Spanish→es (keyword ≥2), Malay→ms (≥2), default en.
6. Triage classification — `classify_call()` three-layer pipeline.
6.5. **Phase 59 — Record call outcome via RPC** — if duration ≥ 15s and
   `call_uuid` exists, calls `record_outcome()` from
   `src/lib/write_outcome.py`. Single `record_call_outcome` RPC call that
   atomically upserts customer + creates job (booked) or inquiry (unbooked)
   + links call junctions (D-14/D-16). Replaces prior
   `create_or_merge_lead()` + `lead_calls` insert. D-02a: NO fallback to
   legacy `leads`/`lead_calls`. D-02b: on `RecordOutcomeError`, log call_id
   + tenant_id and continue — do NOT re-raise or insert into legacy schema.
   2026-06-10: the RPC `.execute()` inside `record_outcome()` now runs via
   `asyncio.to_thread` — it was the only synchronous DB call left, and when
   `capture_lead` invoked it mid-call it blocked the audio loop.
   `caller_name`/`job_type` extraction now happens OUTSIDE the `call_uuid`
   gate (booked_caller_name preferred over the regex fallback) so step 7 can
   use them even when the calls-row insert or the RPC failed.
7. **Owner notifications (moved up + decoupled, 2026-06-10)** — run
   IMMEDIATELY after triage + the record_outcome attempt, BEFORE the slower
   optional steps (suggested slots, hallucination detection), so the 8s
   post-call budget can never starve the owner alert. Notifications **no
   longer require the `record_call_outcome` RPC to have succeeded** — they
   fire whenever tenant info exists. The `lead` dict only enriches the
   message; when it is None the notify dict degrades to call metadata
   (caller-ID + transcript-derived name/job, no CRM ids/address) and the
   log line carries `degraded=true` — a transient DB error can never
   silently drop an EMERGENCY alert. The notify dict now also carries
   `urgency` (`send_owner_email` reads urgency off the lead dict —
   previously absent, so emergency emails rendered "routine"). Uses the
   in-memory `booking_outcome` instead of re-querying the calls row.
   SMS/email per outcome preferences; emergency always sends both.
   `send_owner_sms(from_number=to_number)` (Phase 46 per-tenant from-number
   fix; `TWILIO_FROM_NUMBER` retained only as dev fallback).
   **M16 P1 (2026-06-20):** `run_post_call_pipeline` extracts
   `params.get("service_area")` (the `agent.py` post-call dict now passes
   `"service_area": deps.get("_service_area")`) → `is_out_of_area`, sets
   `notify_lead["out_of_area"]`, and passes `out_of_area=is_out_of_area` to
   `send_owner_sms`. `send_owner_sms` (signature gained `out_of_area: bool =
   False`) appends "(OUTSIDE your area — confirm reachability)" to the SMS body;
   `send_owner_email` reads `lead.get("out_of_area")` and inserts a highlighted
   red warning block before the dashboard link. Tests:
   `tests/test_notifications_out_of_area.py`.
   **LK-B2 (2026-06-21) — per-send timeout + durable outbox:** notifications.py
   was split into PURE builders (`build_owner_sms_body` / `build_owner_email_content`)
   + low-level RAISING senders (`send_owner_sms_body` / `send_owner_email_content`);
   the legacy `send_owner_sms`/`send_owner_email` wrappers still swallow→None for
   external callers (out-of-area test unaffected). §7 now renders the body, then
   sends each channel under `asyncio.wait_for(..., OWNER_NOTIFY_TIMEOUT_S=3.0)`; on
   timeout/failure `_enqueue_owner_notification_failure` upserts a durable row
   (best-effort/fail-open) into the main-repo `owner_notification_failures` table
   (migration 076), keyed `notification_key='{call_id}:{channel}'` so SMS+email
   retry independently. The main-repo cron `/api/cron/retry-owner-notifications`
   (every 5 min) re-sends the stored payload and deletes on success. At-least-once
   (no Stripe-style provider dedupe) → a rare duplicate alert is acceptable vs a miss.
7.5. **Deferred Stripe overage meter POST (LK-B2, 2026-06-21)** — runs AFTER §7
   so a slow Stripe call can never starve the owner alert. If `overage_customer_id`
   (set in §4), posts `billing.meter_events.create` (`identifier=overage_{call_id}`)
   capped at **3s** via `asyncio.wait_for`; on failure upserts an outbox row (on
   `call_id`) into `stripe_meter_failures` (migration 071) for
   `/api/cron/retry-meter-events` to re-post with the same idempotent identifier
   (Stripe dedupes by identifier → no double-bill). Replay is otherwise impossible
   (`increment_calls_used` already consumed the call_id).
8. Suggested slots — unbooked calls get up to 3 slots across next 3 days.
   2026-06-10: the `calendar_events` fetch in
   `_calculate_suggested_slots` now selects `is_all_day` (feeds the
   all-day busy expansion in `slot_calculator`).
9. Update call with triage + NULL fallback → `booking_outcome='not_attempted'`
   only where still NULL. (9b: silent hallucination detection follows.)

### Transcript field extraction fallback

`_extract_field_from_transcript(turns, field)` — regex ONLY when the
tool wasn't invoked. Name branch uses explicit trigger alternation +
post-match `name[0].isupper()` check + blocklist. Do not reintroduce
`[A-Z]` inside the capture group — keep the post-match guard.

---

## 7. Triage System

**Directory**: `src/lib/triage/`

Three-layer pipeline. Layer 3 can only ESCALATE, never downgrade.
Valid urgencies: `{emergency, routine, urgent}`.

- **Layer 1 — Keywords** (`layer1_keywords.py`): synchronous regex.
  2026-06-10: EMERGENCY patterns checked FIRST (emergency beats routine —
  "gas leak, but no rush" is still an emergency; previously routine-first),
  and classification runs on **caller-only turns** via `extract_caller_text()`.
- **Layer 2 — LLM** (`layer2_llm.py`): only when Layer 1 not confident.
  Groq + Llama 4 Scout via AsyncOpenAI, JSON mode, temp 0, **2.5s timeout**
  (`TIMEOUT_S` 5.0 → 2.5, 2026-06-12 audit H8: a slow Groq call inside the
  post-call 8s envelope starved the outcome + notification writes; a layer-2
  timeout falls back to the Layer-1 verdict, so the trade is marginal triage
  precision for guaranteed delivery).
  2026-06-10: receives caller-only text (`caller_text or transcript`).
- **Layer 3 — Owner Rules** (`layer3_rules.py`): always runs. Queries the
  tenant's active `services` (name + `urgency_tag`); escalates the call's
  urgency to a matched service's tag **only when its severity is higher**.
  Unchanged 2026-06-10 — still matches against the **full transcript**.

### Caller-only classification + emergency-first ordering (2026-06-10)

The agent's own speech must never drive urgency — the prompt makes the agent
say things like "let me take a look at the schedule", which confidently
matched `ROUTINE_PATTERNS` and downgraded real emergencies. Two changes:

- `extract_caller_text(transcript)` (new, `layer1_keywords.py`): returns only
  the `"Caller:"`-prefixed lines from the transcript (post_call builds it as
  `"Caller:"` / `"AI:"` prefixed lines). Falls back to the full text when the
  input has no speaker prefixes (raw text), and to `""` when only `AI:` lines
  are present. `run_keyword_classifier` filters internally via this helper;
  `classify_call` (`classifier.py`) extracts it once and hands the caller-only
  text to the layer-2 LLM too (defense in depth).
- `run_keyword_classifier` now evaluates **EMERGENCY_PATTERNS before
  ROUTINE_PATTERNS** — an emergency match always wins over any routine match.
  The old routine-first order (built to stop "not urgent" matching emergency)
  let a routine phrase mask a genuine emergency in the same transcript.

Layer 3 is deliberately untouched: service-name matching needs the full
transcript (the agent often names the service back to the caller).
Tests: `tests/test_triage_layer1_keywords.py` (new).

### Layer 3 service detection — now actually fires (prod-readiness 2026-06)

**Prior bug (fixed 2026-06-04).** `classify_call` (`classifier.py`) never
passed `detected_service` into `apply_owner_rules`, so Layer 3 could never
identify which service the call was about — the owner's per-service
`services.urgency_tag` config was **inert** and Layer 3 never escalated.

**Fix.** `apply_owner_rules` now derives the service itself by
**word-boundary matching each active `services.name` against the call
transcript** (`re.search(rf"\b{re.escape(name)}\b", transcript_lower)`), with a
`MIN_SERVICE_NAME_LEN=4` guard that skips short/generic names (e.g. "AC",
"gas", "tap") to prevent spurious over-matching. First match wins.
`classify_call` now threads the `transcript` through to `apply_owner_rules`
on both the layer1-confident and layer2 paths.

Constraints (the escalation stays conservative):

- Layer 3 can only **raise** urgency, and only on a **genuine service-name
  match** — no match leaves `base_urgency` untouched.
- Layer 1 keywords + Layer 2 LLM remain the **emergency floor**; Layer 3
  cannot downgrade below them.
- The previously-removed **single-service auto-escalation is NOT
  reintroduced** — a single-service tenant no longer adopts its one service's
  tag on every call; the tag applies only when the transcript names it.
- `triage_layer_used` (the calls-row column written from `triage_result["layer"]`
  in `post_call.py`) can now legitimately be **`layer3`** — `classifier.py`
  returns `layer="layer3"` whenever `apply_owner_rules` reports `escalated`.

(`apply_owner_rules` still accepts an explicit `detected_service` arg, checked
before the transcript fallback, for any future caller that supplies one.)

---

## 8. Recording & Transcripts

### Recording — LiveKit Egress

```python
await lk.egress.start_room_composite_egress(
    api.RoomCompositeEgressRequest(
        room_name=call_id, audio_only=True,
        file_outputs=[api.EncodedFileOutput(
            file_type=api.EncodedFileType.OGG,
            filepath=f"{tenant_id}/{call_id}.ogg",
            s3=api.S3Upload(...),
        )],
    )
)
```

- Storage: Supabase Storage `call-recordings` bucket via S3.
- Format: OGG audio-only.
- Path: `{tenant_id}/{call_id}.ogg`.
- **Early path persistence**: `recording_storage_path` written to calls
  row at egress start (not only post-call) as safety net.
- Lifecycle: starts after DB task completes (needs `call_uuid`), stops
  on session close.

### Transcripts

Collected via `conversation_item_added` session events.
`transcript_text` (string) + `transcript_structured` (JSONB array of
`{role, content}`).

---

## 9. Webhook Service (Phase 39 / 40)

**Directory**: `livekit-agent/src/webhook/` — FastAPI daemon thread on
port 8080 in the same Railway container.

### Endpoints

| Path | Purpose |
|------|---------|
| `GET /health` | Liveness — `{status, uptime, version}` (Dockerfile HEALTHCHECK) |
| `GET /health/db` | 200 if `SELECT id FROM tenants LIMIT 1` ok, else 503 |
| `POST /twilio/incoming-call` | Routing composition → AI or owner-pickup TwiML. Inserts calls row for owner-pickup before TwiML response (Phase 40 D-22) |
| `POST /twilio/dial-status` | Writes `outbound_dial_duration_sec` + `routing_mode` (`owner_pickup` or `fallback_to_ai`) via `call_sid` |
| `POST /twilio/dial-fallback` | Returns AI SIP TwiML on owner no-answer (same greeting as direct AI) |
| `POST /twilio/incoming-sms` | Forwards message to `pickup_numbers` with `sms_forward=true`. Format: `[Voco] From {sender}: {body}`. MMS → `[Media attached]` note. Logs inbound + forwarded rows to `sms_messages` |

All `/twilio/*` signature-gated via router-level FastAPI dependency
(zero per-route boilerplate).

**LK-B3 — per-tenant SIP routing (2026-06-21, implemented; LIVE-UNVERIFIED):**
`_ai_sip_twiml(to_number=None)` templates the SIP URI's user-part with the DIALED
number (`sip:{to_number}@{host}`, host from `LIVEKIT_SIP_URI`) so the agent can
resolve the tenant from `sip.to`/`sip.trunkPhoneNumber` → `tenants.phone_number`.
Without it, the R2 webhook path (new numbers route via `/twilio/incoming-call`
with the trunk disassociated) dials a STATIC user-part → every new-tenant call
resolves to NO tenant → generic receptionist, no booking/capture/CRM/owner-alert.
The normalized dialed number is threaded into all 7 call sites (4 `incoming_call`
branches + `dial_status` fallback + `dial_fallback` + the `app.py` global-handler
fallback); fail-open to the static URI when the number is absent. **Must still be
confirmed with ONE real inbound PSTN call** (`Tenant: <id>`, not `NONE (Voco)`):
only a live call proves `LIVEKIT_SIP_URI`'s host accepts a Twilio `<Dial><Sip>`
INVITE and that LiveKit passes the user-part through. Until verified, the safe MVP
posture is `RAILWAY_WEBHOOK_URL` UNSET in Vercel → new numbers use the proven
legacy trunk path (agent resolves the tenant identically, no webhook hop).

**LK-B4 — front door never returns a non-TwiML 5xx (2026-06-21):** `app.py` adds
`@app.exception_handler(Exception)` that, for the voice paths (`/twilio/incoming-call`,
`/dial-status`, `/dial-fallback`), returns AI SIP TwiML on ANY unhandled error
(empty TwiML for `/incoming-sms`); other paths get a normal 500. It explicitly
re-raises `HTTPException`/`StarletteHTTPException` so the fail-CLOSED signature
401/403 is NEVER masked into a 200. This is the second line of defense behind the
per-step `try/except`es in `incoming_call` — Twilio would otherwise play "application
error, goodbye" and hang up on any uncaught error.

### Signature verification

`verify_twilio_signature` async FastAPI dep. URL reconstructed via
proxy headers:
```python
proto = request.headers.get("x-forwarded-proto", "https")
host = request.headers["host"]
url = f"{proto}://{host}{request.url.path}"
```
uvicorn started with `proxy_headers=True, forwarded_allow_ips='*'`.

The dep reads `await request.form()` ONCE and stashes on
`request.state.form_data`. Tests that override must replicate this
side effect (Plan 39-06 conftest pattern).

**Fail-closed hardening (2026-06-12 audit M9):**
- **Empty/missing `TWILIO_AUTH_TOKEN` → 503** ("Webhook validation
  unavailable"). `RequestValidator("")` computes HMACs with an EMPTY key, so a
  misconfigured deploy would otherwise accept forged signatures.
- **`ALLOW_UNSIGNED_WEBHOOKS=true` is IGNORED when `PYTHON_ENV` is
  `production` OR unset** (unset defaults to production, matching the Sentry
  init default) — one stray env var can no longer disable signature checks in
  prod. In non-production it still bypasses with a warning (and still stashes
  `request.state.form_data` so handlers behave uniformly).

### Schedule evaluator

`evaluate_schedule(schedule, tenant_timezone, now_utc) -> ScheduleDecision`

Pure function — no DB, no HTTP, no logging. JSONB shape:
`{enabled, days: {mon|...|sun: [{start:"HH:MM", end:"HH:MM"}]}}`.
Overnight ranges (`end < start`) via two-branch check. DST via
`zoneinfo.astimezone()`. Same-day lookup only — Phase 41 UI writes
overnight ranges under both day keys if cross-day matching needed.

**LK-B4 (2026-06-21):** `evaluate_schedule` RAISES on a corrupt/invalid
`tenant_timezone` (`ZoneInfo(...)` → `ZoneInfoNotFoundError`/`ValueError`) — it
does NOT swallow it, and the `'UTC'` call-site default only covers a MISSING key.
So the `incoming_call` call site now wraps it in `try/except` → defaults to
`ScheduleDecision(mode='ai', reason='schedule_error')`, matching every other
fail-open routing step. Tests: corrupt-tz/empty-tz `pytest.raises` in
`test_schedule.py`; route fail-open + global-handler tests in `test_routes.py`.

### Outbound cap

`check_outbound_cap(tenant_id, country) -> bool`.
Limits: US/CA 300000s (5000 min), SG 150000s (2500 min), unknown → US.
Query sums `calls.outbound_dial_duration_sec` where
`created_at >= date_trunc('month', now())` via `idx_calls_tenant_month`.

### Priority (VIP) caller check (Phase 46)

`_is_vip_caller(tenant, from_number)` — two sources:
1. `tenants.vip_numbers` JSONB (standalone, no DB hit).
2. `leads.is_vip=true` via sparse partial index
   `idx_leads_vip_lookup ON leads (tenant_id, from_number) WHERE is_vip = true`.

Match → `_insert_owner_pickup_call()` → parallel `<Dial>` TwiML to
`tenant.pickup_numbers`. **Skips `evaluate_schedule` AND
`check_outbound_cap`** — priority callers always ring regardless of
off-hours or cap breach. No pickup_numbers → fall through to AI
(safety net per D-03).

User-facing brand: "Priority Callers". DB columns keep `vip_*` names
(commit `72f6572` renamed UI only; migration 049 pre-rename). Preserve
this split.

### Database schema additions

- Migration **042** (Phase 39): `call_forwarding_schedule`,
  `pickup_numbers`, `dial_timeout_seconds` on tenants; `routing_mode`,
  `outbound_dial_duration_sec` on calls; `idx_calls_tenant_month`.
- Migration **045** (Phase 40): `sms_messages` table; `calls.call_sid`.
- Migration **049** (Phase 46): `tenants.vip_numbers` JSONB;
  `leads.is_vip` boolean; `idx_leads_vip_lookup` sparse partial index.

---

## 10. Phase 58 Telemetry — integration_fetch + integration_fetch_fanout

`src/lib/telemetry.py` shared helpers `emit_integration_fetch` +
`emit_integration_fetch_fanout`. Silent-on-failure (try/except +
`logger.warning`, never propagates).

- **Per-fetch row** (`event_type='integration_fetch'`): one per
  successful `fetch_xero_customer_by_phone` / `fetch_jobber_customer_by_phone`.
  Written in parallel with `_touch_last_context_fetch_at` via
  `asyncio.gather` — zero added latency.
- **Per-call fanout row** (`event_type='integration_fetch_fanout'`):
  wrapper `fetch_customer_context_with_fanout_telemetry` in `agent.py`
  captures `time.perf_counter()` around the merged Xero+Jobber fetch
  and emits via `asyncio.create_task` — `session.start` is NEVER
  delayed.
- Admin client INJECTED as first parameter to helpers (not imported
  inside) — lets tests patch the caller's module-level symbol.

D-07 latency budget (p95 ≤ 2.5s) queried via SQL on
`integration_fetch_fanout` rows. See
`integrations-jobber-xero/references/telemetry.md` for aggregation
queries and deployment handoff.

---

## 11. Environment Variables

### Agent service (Railway)

| Variable | Purpose |
|---|---|
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | LiveKit Cloud auth |
| `OPENAI_API_KEY` | gpt-4.1-mini LLM (Phase 66 cascade; was gpt-realtime-2). **Required at boot** — the `__main__` preflight refuses to start without it |
| `DEEPGRAM_API_KEY` | Deepgram nova-3 STT (Phase 66) — pending on Railway at time of writing. **Required at boot** (preflight) |
| `ELEVEN_API_KEY` | ElevenLabs eleven_flash_v2_5 TTS (Phase 66) — pending on Railway at time of writing. **Required at boot** (preflight) |
| `VOCO_WRAP_UP_CALL_SECONDS`, `VOCO_MAX_CALL_SECONDS` | Call-duration watchdog overrides (defaults 540 / 600 — see §1) |
| `VOCO_PREEMPTIVE_GENERATION` | P8.1 (2026-06-12): `AgentSession(preemptive_generation=…)` — speculative LLM+TTS on interim transcripts. Default ON; set `false` to revert |
| `VOCO_STT_KEYTERMS` | P8.2 (2026-06-12): Deepgram nova-3 `keyterm` prompting with business + service names. Default OFF (keyterm + `language="multi"` unverified against Deepgram's API — enable on a UAT deploy first) |
| `SUPABASE_S3_*` (4 vars) | Supabase Storage S3 |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | SMS auth (FROM is dev-fallback only) |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Transactional email |
| `GROQ_API_KEY` | Layer 2 triage |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Calendar OAuth |
| `STRIPE_SECRET_KEY` | Overage billing |
| `NEXT_PUBLIC_APP_URL` | Dashboard links in notifications |
| `SENTRY_DSN` | Error tracking |
| `ALLOW_UNSIGNED_WEBHOOKS` | Dev-only signature bypass — IGNORED when `PYTHON_ENV` is production or unset (2026-06-12) |
| `PYTHON_ENV` | Environment name; unset defaults to `production` (fail closed — gates the unsigned-webhook bypass + Sentry init) |
| `LIVEKIT_SIP_URI` | SIP URI in AI TwiML |
| `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET` | Xero OAuth (see integrations-jobber-xero) |
| `JOBBER_CLIENT_ID`, `JOBBER_CLIENT_SECRET` | Jobber OAuth + webhook HMAC key |

### Main repo (Vercel)

| Variable | Purpose |
|---|---|
| `RAILWAY_WEBHOOK_URL` | Base URL for `voice_url`, `voice_fallback_url`, `sms_url` on provisioned Twilio numbers |
| `XERO_WEBHOOK_KEY` | Xero webhook HMAC key (distinct from client_secret) |

---

## 12. Key Design Decisions

- **Python 3.12 + LiveKit Agents SDK** — replaced Node.js; primary SDK with
  native OpenAI Realtime support.
- **Cascaded pipeline (Phase 66)** — Deepgram nova-3 STT → gpt-4.1-mini LLM →
  ElevenLabs Flash v2.5 TTS. Migration rationale: a strong text LLM is a more
  reliable, debuggable tool-caller than a realtime speech model, on LiveKit's
  mature pipeline plugin APIs. (The prior gpt-realtime-2 speech-to-speech
  bullets are historical.)
- **Silero VAD + MultilingualModel turn detection (Phase 66)** — semantic
  end-of-turn; Silero defaults for barge-in (do NOT port the realtime 2.5s
  silence value — Phase 64 did and added ~2s/turn).
- **asyncio.to_thread() everywhere** — all sync Supabase/Twilio/Resend
  calls wrapped to prevent blocking audio.
- **In-process tool execution** — all 6 tools run directly in the agent
  process; zero webhook round-trips.
- **Single post-call pipeline** — combines `processCallEnded` +
  `processCallAnalyzed` into one function.
- **Silent repeat caller context** — `check_caller_history` instructs AI
  never to mention it.
- **Caller-preference-first booking; agent offers only tool-returned times
  (2026-06-12 — replaces "Caller-led booking — AI never offers times
  first")** — the agent asks the caller's preference first, but when the
  caller is vague, asks what's available, or their time is rejected, it
  offers at most 2–3 times/days taken VERBATIM from the availability tool
  return (check_day OPTIONS, check_slot ALTS/earliest_today/next_open,
  next_available_days days). The old absolute ban was a Gemini-era
  anti-fabrication guard that forced callers into a guess-reject loop
  (hang-up evidence: call 31559053). Anti-hallucination invariant
  unchanged: a time never present in a tool return is never speakable.
- **Event handlers before `session.start()`** — prevents race.
- **`close_complete` event keeps entrypoint alive** — without this, the
  LiveKit worker exits immediately after entrypoint returns, killing
  the post-call pipeline.
- **Atomic booking via Postgres advisory locks** — `book_appointment_atomic`
  RPC with `tstzrange` overlap checking.
- **`booking_outcome` written before side effects** — persists even if
  caller hangs up during calendar push / SMS.
- **`end_call` triggers `ctx.shutdown()`** — cascades into session
  close → post-call pipeline.
- **Past-date validation** — check_slot rejects past dates;
  1-hour buffer for today.
- **`recording_storage_path` at egress start** — safety net for post-call
  failure.
- **Triage never downgrades** — Layer 3 only escalates.
- **Fail-open on ERRORS, fail-closed on known-bad status (2026-06-12)** —
  missing tenant, slot failures, and subscription QUERY errors all route to
  AI; but a successfully-read blocked status (canceled/paused/incomplete, or
  past_due beyond the 3-day grace) disconnects via the shared
  `subscription_gate.py`. The grace's end was previously banner copy only —
  no code ever enforced it.
- **Shared subscription gate module** — `BLOCKED_STATUSES` was hand-copied in
  `agent.py` + `twilio_routes.py` (and mirrored in the main repo's JS), which
  is how the past_due gap survived. `src/lib/subscription_gate.py` is now the
  single source of truth on the call path.
- **Boot preflight for cascade keys** — missing `OPENAI_API_KEY` /
  `DEEPGRAM_API_KEY` / `ELEVEN_API_KEY` fails the deploy at startup instead
  of silently killing every call behind a green healthcheck.
- **Meter failures go to a durable outbox** — `stripe_meter_failures` upsert
  on `call_id` (migration 071, main repo) + retry cron; the meter post itself
  is capped at 3s so Stripe latency can't starve the post-call envelope.
- **Webhook routing replaces SIP-only routing (Phase 40)** — numbers route
  via `voice_url` → `/twilio/incoming-call`. A trunk-associated number IGNORES
  its `voice_url` (the trunk's origination wins), so webhook-routed numbers are
  **removed from the SIP trunk**; provisioning (`configureNumberRouting`) and
  `cutover-existing-numbers.js` both set the URLs AND disassociate the trunk
  when `RAILWAY_WEBHOOK_URL` is set, falling back to trunk-only AI-direct when
  it isn't (R2 fix — trunk-only provisioning had left the routing layer dead
  for new tenants). Rollback = re-associate the number with the trunk.
- **Fail-open at every webhook stage** — blocked tenants, unknown
  numbers, subscription errors, schedule evaluation errors, cap errors
  → AI. (Blocked tenants get the AI route — never paid owner-pickup
  forwarding — and the agent-side gate then disconnects them.)
- **Pre-TwiML calls row insert for owner-pickup** — ensures row exists
  before dial-status callback.
- **Owner-pickup calls are lightweight** — no transcript, no recording,
  no triage, no lead, no notifications, no `increment_calls_used`.
- **Same AI greeting for all paths** — direct AI or fallback-after-no-answer
  get identical greeting.
- **Soft cap gates owner-pickup only** — AI calls allowed regardless of
  cap.
- **`call_sid` for dial-status correlation** — more reliable than
  phone+timestamp matching.
- **Router-level Twilio signature dep** — single dep applied to all
  `/twilio/*`.
- **Pure-function schedule evaluator** — zero side effects; trivially
  unit-testable.
- **Cross-runtime customer_context casing divergence is intentional** —
  Next.js camelCase, Python snake_case. Don't "unify" (see
  `integrations-jobber-xero`).
- **Phase 58 telemetry uses real `activity_log` column names
  (`event_type` + `metadata`)** — NOT CONTEXT D-06 wording
  (`action` + `meta`). Matches existing `src/lib/leads.js` writers.
- **Integration telemetry inserted via injected admin client** — tests
  patch caller's module-level `get_supabase_admin`, never the helper.

---

## 13. Debugging playbook

> (rows referencing `generate_reply`, SemanticVad, `AudioTranscription`, or
> OpenAI voices/migration 067 are stale — superseded by the Phase 66 cascade,
> see agent.py. Greeting issues now trace to `session.say()` + the input-mute
> block; voice issues to `ELEVENLABS_VOICE_MAP` / ElevenLabs "My Voices".)

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Greeting never plays / agent silent until caller speaks | `generate_reply` greeting failed, or model id rejected at handshake | Check `[agent] greeting generate_reply failed` log; verify `OPENAI_REALTIME_MODEL` + `OPENAI_API_KEY` (model 404s on the first call if invalid) |
| Greeting cuts off mid-sentence | SIP echo/noise tripping server VAD during the opening | Confirm the greeting input-mute is intact: `set_audio_enabled(False)` before `generate_reply` + `wait_for_playout()` unmute (agent `1a300d2`) |
| `Invalid value: 'Zephyr'` / session error on every call for a tenant | stale Gemini `ai_voice` + migration 067 not applied to prod | Apply migrations 067 + **070** (070 is the current label CHECK — professional/friendly/local_expert); the `_resolve_voice` guard (agent `35238f7`) already falls back to the tone default |
| Empty/garbled post-call transcript or degraded triage | `input_audio_transcription` not a typed `AudioTranscription` | Confirm `AudioTranscription(model="gpt-4o-mini-transcribe")` is passed (a plain dict is silently dropped) |
| Over- or under-eager turn-taking on SIP | `SemanticVad` eagerness mismatch | Try the `ServerVad(...)` fixed-timer fallback (migration §7.5) |
| Post-call pipeline never runs | `close_complete` event missing | Check `entrypoint` awaits event + `done_callback` sets it |
| Recording missing | `recording_storage_path` not written at egress start | Check egress start awaits `db_task` |
| Test call not auto-cancelled | Booking-reconciliation backfill missed | Verify `booked_appointment_id` forwarded from `deps` |
| Webhook 403 on every request | Signature verification failing | Check `TWILIO_AUTH_TOKEN` env; confirm `proxy_headers=True` on uvicorn |
| Webhook 503 on every request | `TWILIO_AUTH_TOKEN` empty/missing (2026-06-12 fail-closed) | Set the token on Railway — empty-key HMAC validation would accept forgeries, so the dep rejects instead |
| Agent container exits at boot with `Missing required env vars` | Boot preflight (2026-06-12) — `OPENAI_API_KEY` / `DEEPGRAM_API_KEY` / `ELEVEN_API_KEY` unset | Set the missing keys on Railway; this is intentional (previously every call connected then died silently) |
| Every call crashes at `MultilingualModel()` with `Could not find file "languages.json"` | Turn-detector model files not baked into the image — `download-files` was skipped during the Docker build | Fixed 2026-06-26 by gating the `__main__` preflight/webhook to `start`/`dev` so build-time `download-files` reaches `cli.run_app()`, + removing `\|\| true` from the Dockerfile. If it recurs, confirm the build log shows the model actually downloading and that no `HF_HOME`/volume diverts the cache path between build and runtime |
| VIP caller routing to AI | Missing `pickup_numbers` OR `is_vip=false` | Check `tenants.vip_numbers` JSONB + `leads.is_vip` + `pickup_numbers` populated |
| `customer_context` empty despite connected Xero | `error_state` set on row OR 2.5s timeout | Check `accounting_credentials.error_state`; query `activity_log WHERE event_type='integration_fetch'` |
| No `integration_fetch_fanout` rows in activity_log | Railway not redeployed after Phase 58 | Sync Voco worktree → sibling repo → GitHub → Railway |
| Goodbye cut off before "Thank you for calling" completes | #5096-class race (mid-word truncation) — diagnosed Phase 60.3 Stream A | Check `[goodbye_race]` log: `text_done=false` + mid-call `_SegmentSynchronizerImpl` warnings → Phase 60.3 Branch P CRITICAL RULE is live; if still reproducing, re-evaluate Branch G (`wait_for_playout` pre-guard in `end_call.py`) |
| Goodbye completes but agent never invokes `end_call` (16+ s idle, caller manually hangs up) | Phase 60.3 cumulative UAT regression — Branch P "separate turn with no additional speech" over-corrected | Check `[goodbye_race]` log for `last_text_token_at` → `end_call_invoked_at` delta > 2s with complete farewell in `transcript_tail`; tracked for Phase 60.4 call-teardown follow-up |

---

## Test Calls & Admin Web Test Console (2026-08-25)

Browser-based testing of the LIVE production agent — no phone call, no Twilio.
An admin talks to the agent over a LiveKit WebRTC room from `/admin/test-agent`;
the same Railway worker, prompt, tools, and post-call pipeline run, but every
real-world side effect is sandboxed.

### Room + dispatch contract

- Rooms are named **`test-web-{tenantId}-{ts}`** — deliberately NOT `call-*`
  (SIP dispatch rule) and NOT `test-call-*` (the LiveKit webhook flips
  `tenants.test_call_status` for those). The main-repo LiveKit webhook ignores
  `test-web-*` rooms entirely.
- Room **metadata is server-set** by `POST /api/admin/test-agent/session`
  (verifyAdmin): `{ test_call: true, web_test: true, tenant_id, to_number:
  tenant.phone_number, from_number? }`. The browser token has join/publish/
  subscribe grants only — it cannot alter metadata. `from_number` is an
  optional simulated caller-ID (exercises the repeat-caller/caller-history
  path, read-only); `agent.py` honors it only on test calls and only when the
  participant has no SIP caller-ID.
- **The worker registers `agent_name="voco-voice-agent"`, which DISABLES
  automatic dispatch.** The console connects the browser mic first, then
  `POST /api/admin/test-agent/dispatch` runs
  `AgentDispatchClient.createDispatch(roomName, 'voco-voice-agent')` — so
  `wait_for_participant` resolves instantly (no 30s race). The SAME fix was
  applied to `/api/onboarding/test-call` (phone test): it previously created
  the room + dialed the owner but never dispatched the agent → the owner
  connected to an agent-less room.

### Sandbox gates (`deps["is_test_call"]` / `params["is_test_call"]`)

A test call's ONLY durable footprint: its flagged `calls` row, its MP4
recording, and transient appointment rows that post_call auto-cancels.

| Site | Test-call behavior |
|---|---|
| `agent.py` calls upsert | writes `is_test_call: true` (migration **079**) — the key is included ONLY for test calls, so production inserts never reference the column (fail-open if 079 lags the agent deploy) |
| `agent.py` subscription gate | bypassed (admin can test canceled/past-due tenants; test calls never bill) |
| `agent.py` egress | audio-only **MP4** (`EncodedFileType.MP4`, path `{tenant_id}/{call_id}.mp4`) instead of OGG — directly downloadable from the console |
| `book_appointment` success | appointment row still created (realistic; briefly occupies the real slot) but **no Google/Outlook calendar push, no caller confirmation SMS** |
| `book_appointment` slot-taken | **no recovery SMS** |
| `capture_lead` | **skips the `record_call_outcome` RPC** (no customer/inquiry writes — a simulated number matching a real customer must never merge); verdict-driven return strings unchanged so the conversation is identical |
| `post_call` §3 auto-cancel | cancels **ALL** appointments the call created (union of the `call_id` FK lookup + `tool_call_log` appointment_ids; the old `limit(1)` leaked multi-booking tests) |
| `post_call` §4 usage | already skipped (pre-existing) |
| `post_call` §6.5 record_outcome | **skipped** — no CRM rows at all for test calls |
| `post_call` §7 owner notifications | **skipped** — no owner SMS/email |
| `transfer_call` | not gated: SIP REFER on a web participant fails fast → exercises the transfer-failure recovery path (documented in the console UI) |
| `agent.py` voice override | test calls only: metadata `voice_override` (an ElevenLabs voice_id) replaces the resolved `voice_id` AFTER normal `_resolve_voice` resolution, guarded by an `[A-Za-z0-9]{10,40}` shape check. The value comes exclusively from the session route's curated `VOICE_OPTIONS` allowlist (server-set metadata); production voice resolution (`tenants.ai_voice` → `ELEVENLABS_VOICE_MAP`) is untouched |

Still live on test calls (intentionally): full cascade pipeline, all tools,
real slot math, triage (incl. the Groq layer-2 call), transcript, recording,
hallucination detection, `gmaps_validate_events` telemetry rows (ops-only).

Locked by `livekit_agent/tests/test_test_call_sandbox.py` (source-grep
invariants, 12 tests).

### Tenant-surface filters (main repo)

`calls.is_test_call` (migration 079, NOT NULL DEFAULT false) is filtered with
`.eq('is_test_call', false)` in: `/api/calls`, `/api/dashboard/stats`
(missed-calls-today), `/api/search` (calls group), and the recovery-SMS cron
Branch A (**a simulated caller number is never texted**; Branch B is covered
transitively). The calls page Realtime INSERT/UPDATE handlers skip
`payload.new.is_test_call` client-side. NOT filtered (by design):
`cleanup-orphaned-calls` (should clean test rooms too), `customer-timeline` /
`invoice-describe` (test calls create no junction rows).

### Admin console files (main repo)

| File | Role |
|---|---|
| `src/app/admin/test-agent/page.js` | Console UI: tenant picker, simulated caller number, mic connect (livekit-client), live captions via `lk.transcription` text streams, mute/hang-up, 10-min timer, post-call results + MP4 player/download |
| `src/app/api/admin/test-agent/session/route.js` | verifyAdmin → createRoom (server-set sandbox metadata, emptyTimeout 600) + AccessToken (30m, join/publish/subscribe only). Holds the curated `VOICE_OPTIONS` allowlist (grouped by accent; GET serves it to the picker, POST validates `voice_override` against it — 400 on anything else). Voice IDs must be usable by the Voco ElevenLabs account (premade defaults are; Voice Library picks must be saved to "My Voices" first — an Asian-accented-English slot is stubbed in the list awaiting a chosen library voice ID) |
| `src/app/api/admin/test-agent/dispatch/route.js` | verifyAdmin → `createDispatch` — refuses non-`test-web-*` rooms |
| `src/app/api/admin/test-agent/result/route.js` | verifyAdmin → flagged calls row + **service-role** signed URL for the MP4 (dashboard flyouts sign with the user's own RLS-scoped session; an admin needs the service-role path). Refuses rows where `is_test_call` is false |

New dependency: `livekit-client`. Tests: `tests/api/admin-test-agent.test.js`,
dispatch assertion added to `tests/onboarding/test-call.test.js`, Branch A
chain updated in `tests/cron/recovery-sms-retry.test.js`.

### Deployment order

1. Apply migration **079** (manual, Supabase) — the main-repo filters 400
   without the column.
2. Deploy the main repo (filters are inert until a test call exists).
3. Deploy the agent (its writes are test-call-only, so it is safe in any
   order relative to the main repo — but after 079).

---

## Keeping this document updated

When modifying any file listed in the File Map, update the relevant
sections here. When modifying the agent repo (`lerboi/livekit_agent`),
remember to update this skill file in the main repo.

**For Xero/Jobber-specific changes:** update `integrations-jobber-xero`
primarily. Cross-ref back to this skill for call-path integration
touchpoints.

Phase-by-phase history lives at `references/phase-history.md` (absorbs
the prior header's 10+ "Previous:" paragraphs).

---

## Phase 61 — Google Maps Address Validation Integration

### What changed
- **New module:** `src/integrations/google_maps.py` (412 LOC) —
  `validate_address_bounded()` is the public entry point. Per-call
  `httpx.AsyncClient` (matching `xero.py` / `jobber.py` pattern, NOT a
  module-level singleton), 1.5s hard timeout (D-C1, dual-layer:
  socket-level `httpx.Timeout` + task-level `asyncio.wait_for`), never
  raises, always returns Voco-shaped dict with `verdict` key. Maps
  Google's `verdict.possibleNextAction` → Voco verdicts
  (`confirmed | confirmed_with_changes | unconfirmed | error | skipped | unsupported_region`)
  via `map_verdict`; maps `result.address.addressComponents` → 9-key
  Voco-normalized dict via `map_components` (D-D1).
- **Pre-check in `book_appointment.py`:** validate runs BEFORE
  `atomic_book_slot` (D-B2 — external HTTP outside slot-lock contention
  window). On `confirmed` / `confirmed_with_changes`, `service_address`
  is overwritten with Google's `formatted_address` (D-D3'). Booking
  never blocks on Google — every verdict path proceeds to the RPC.
  **`region_code` source (prod-readiness 2026-06 fix):** both
  `book_appointment.py` and `capture_lead.py` read
  `region_code = (deps.get("country") or "US").upper()`. `deps["country"]`
  is now populated in `agent.py` from `tenant.get("country", "US")`.
  Previously the `deps` literal omitted `"country"`, so EVERY non-US
  tenant validated against region "US" — a silent correctness bug fixed
  by adding the one `"country": country` key to the deps dict.
- **Pre-check in `capture_lead.py`:** symmetric validation pre-check
  (D-B4); same overwrite logic applied to inquiries via
  `record_outcome` 14-arg RPC overload.
- **Tool returns (D-E2):** Tool returns use TWO shapes — the success
  path uses a label form `BOOKED [verdict=...]: <directive>` /
  `LEAD CAPTURED [verdict=...]: <directive>` (battle-tested pre-Phase-61
  label convention extended with the verdict token), and the failure
  path uses the documented `STATE:... | DIRECTIVE:...` shape
  (e.g. `STATE:lead_capture_failed reason=db_error | DIRECTIVE:...`).
  Phase 61 (D-E2) extended the success label form with verdict tokens —
  `BOOKED [verdict=validated]:`, `BOOKED [verdict=validated_with_corrections]:`,
  `BOOKED [verdict=unvalidated]:` (and `LEAD CAPTURED` equivalents).
  The prompt CRITICAL RULE (`_build_address_validation_section`)
  matches via SUBSTRING on the verdict tokens, so both shapes work.
  Strings are NEVER spoken aloud; the agent reads them and decides how
  to phrase the readback.

  **Brittleness watch (WR-03 follow-up):** A future prompt revision
  that keys on the `STATE:` prefix or the `|` separator would silently
  drop the success paths. If you change how the prompt parses these
  returns, audit `book_appointment.py` and `capture_lead.py` success
  branches for symmetric updates.

  **Directives SHORTENED (2026-06-10 early-validation pass; fallback
  `validated` variants trimmed again 2026-06-12 P2):** each
  verdict has TWO variants keyed on whether the mid-call
  `validate_address` cache was reused (`used_cached_validation`). On the
  cached path the address was already confirmed mid-call, so the
  post-commit directive is ONE short sentence — day + time only, with an
  explicit "do not re-read it" for the address. **2026-06-12:** the
  fallback `validated` variants ALSO no longer re-read the address — the
  caller already heard it in the mandatory pre-booking readback (Call B
  40b13227 spoke one address ~5 times under the old directive); only
  `validated_with_corrections` still reads its corrected form (Google
  materially changed something the caller hasn't heard). Verdict tokens
  are unchanged (tests + the
  prompt rule key on them). Representative samples:
    - cached: `BOOKED [verdict=validated]: confirm day and time [...] in ONE short sentence; the address was already confirmed — do not re-read it; ask if anything else is needed`
    - fallback: `BOOKED [verdict=validated]: confirm day and time [...] in ONE short sentence; do not re-read the address — the caller already heard it in the readback; ask if anything else is needed`
    - fallback: `BOOKED [verdict=validated_with_corrections]: confirm day and time [...]; read corrected address [...] once and explicitly invite caller confirmation; ...`
    - `BOOKED [verdict=unvalidated]: confirm day and time [...] in ONE short sentence; relay address as caller spoke it only if it was never read back; do NOT claim "validated"...`
    - `LEAD CAPTURED` equivalents mirror the same cached/fallback split.
- **New CRITICAL RULE (D-E3):** `_build_address_validation_section(locale)`
  in `prompt.py` sits in the top-attention zone between
  `_build_corrections_section` and `_build_outcome_words_section` —
  alongside `outcome_words` / `corrections` / `call_duration`.
  Prohibits 6 verbatim phrases (`"validated"`, `"verified"`,
  `"confirmed against Google"`, `"found your address"`,
  `"looked up your address"`, `"matches our records"`) unless preceding
  tool return contained `verdict=validated` or
  `verdict=validated_with_corrections`. Spanish mirror present per
  Phase 60.3 D-B-03 locale-parity pattern (`VALIDACIÓN DE DIRECCIÓN —
  REGLA CRÍTICA`).

  **REWRITTEN 2026-06-10 for the early-validation flow:** the rule now
  teaches — caller finishes the address → ONE short filler → call
  `validate_address` in the same turn → speak the result ONCE in its
  final form per the four `STATE:address_*` branches → at most one
  correction loop → the address is never read aloud more than twice per
  call → booking does NOT re-read a validated address (the booking
  readback covers name + day/time; address included only if never
  validated mid-call — `_build_booking_section`'s BEFORE BOOKING —
  READBACK block was updated to match in both locales). Preserved
  invariants: 6 prohibited phrases, untranslated verdict tokens, section
  before tool_narration, NO silence license anywhere (Phase 61.1
  deadlock class), explicit caller-words readback license
  (the `address_noted` branch). Gating sentence now reads "After
  validate_address, book_appointment, or capture_lead returns…".

  **EXTENDED 2026-06-12 (findings.md P2):** the rule now also carries —
  (a) the `STATE:address_ok_confirm_postal` branch teaching (lookup-
  supplied postal asked as a QUESTION, digit by digit, never asserted;
  caller's answer wins); (b) a CALLER AUTHORITY block — the caller
  outranks the lookup, always: accept their correction immediately, never
  defend the old value or say where it came from, re-validate once with
  their pieces, and if validation still disagrees keep the caller's
  version as noted-not-validated (incident: call 31559053 defended a
  Google-inferred postal against the caller); (c) an unconditional
  never-speak list for internal-machinery phrases ("the address
  validation", "from the validation", "our system shows"). All prior
  invariants preserved; `tests/test_prompt_address_validation_rule.py`
  still green unmodified.
- **Tool descriptions rewritten (D-E1):** `book_appointment` +
  `capture_lead` descriptions encode the validation precondition as
  outcome-framed prompt-surface language. Gemini 3.1 Flash Live reads
  tool descriptions during function-call decisions — the description
  tells Gemini "consult the verdict in my return value before speaking"
  without prescribing exact wording.
- **Telemetry:** every validate writes one row to `gmaps_validate_events`
  (new sibling table — D-C2' overrides CONTEXT D-C2 because
  `usage_events` schema is call-billing-PK and cannot hold per-validate
  rows). Sentry only on `verdict='error'` (D-A3 + D-C3) — unsupported
  region and skipped paths never page.

### Env var
- `GOOGLE_MAPS_API_KEY` on Railway only (D-G1). Restricted to
  "Address Validation API" via Cloud Console API restrictions (NOT
  IP restrictions — D-G2; Railway egress IPs rotate). Module returns
  `verdict='skipped'` if env var missing — graceful degradation.

### Files
| File | Role |
|------|------|
| `src/integrations/google_maps.py` | API client + verdict mapper + components mapper (Plan 02) |
| `src/lib/booking.py` | `atomic_book_slot` wrapper extended with 6 new kwargs (Plan 03) |
| `src/lib/write_outcome.py` | `record_outcome` wrapper extended with 6 new kwargs (Plan 03) |
| `src/tools/book_appointment.py` | Validation pre-check + D-E1 description + D-E2 returns (Plans 03+04) |
| `src/tools/capture_lead.py` | Symmetric pre-check + D-E1 description + D-E2 returns (Plans 03+04) |
| `src/prompt.py` | `_build_address_validation_section` EN+ES (D-E3, Plan 04) |

### Anti-hallucination invariants locked at the test layer
- `tests/test_prompt_address_validation_rule.py` — EN+ES presence +
  position (before tool_narration) + 6 prohibited phrases + verdict
  tokens (Plan 04)
- `tests/test_tool_descriptions_validation_precondition.py` — D-E1
  outcome-framed wording in both tool specs (Plan 04)
- `tests/test_book_appointment_validation.py` — D-D3' overwrite + D-E2
  return shapes (10 tests, Plan 03)
- `tests/test_capture_lead_validation.py` — D-B4 symmetry (8 tests,
  Plan 03)
- `tests/test_google_maps.py` — verdict + components mappers, HTTP
  error paths, Sentry gate, telemetry shape (20 tests, Plan 02)
- `tests/test_no_generate_reply_in_src.py` — Phase 63.1 regression
  guard preserved

---

## Phase 61.1 — Address-Validation Rule Deadlock Fix + WR-01/02/03 Closeout

Phase 61 shipped to production on 2026-05-03 (Plan 04 GREEN, sibling commit
`590669f`). The first production call after ship (call AJ_ZhhHTywMieAi,
2026-05-05 07:09 UTC, tenant "make it ai", caller +6587528516) deadlocked
the agent for 44 seconds after the caller spoke their postal code, ending
in CLIENT_INITIATED disconnect with `outcome=not_attempted`. Diagnosis:
the new `_build_address_validation_section` CRITICAL RULE plus its
explicit "Silence is always acceptable" escape hatch caused a
chicken-and-egg deadlock — the agent had to read back the address to get
acknowledgment before invoking the tool, but the rule flagged any
address-related utterance without a verdict as the worst possible failure,
and silence was the only explicitly-licensed safe fallback. Phase 61.1
fixed this regression and closed the three advisory warnings from
`61-REVIEW.md` (WR-01, WR-02, WR-03).

### What changed in Phase 61.1

- **Prompt reframe (Plan 01):** `_build_address_validation_section`
  EN+ES rewritten so the CRITICAL RULE governs ONLY post-tool speech.
  Pre-tool readback is now explicitly licensed via the substrings
  `After book_appointment or capture_lead returns` (EN) /
  `Después de que book_appointment o capture_lead retorne` (ES),
  paired with `read back what the caller said` (EN) /
  `repita lo que el llamante dijo` (ES). The "Silence or a neutral
  readback is always acceptable" line was REMOVED — the model was
  selecting it as the safe path and breaking the conversation. The
  "worst failure mode in this section" framing was qualified to apply
  only after a tool return. Anti-hallucination guarantee for post-tool
  speech (the original D-E3 invariant) is preserved.

- **Tool descriptions (Plan 01):** `book_appointment.py` description
  changed from `the caller has acknowledged the name+address readback`
  to `the caller has acknowledged the address you heard back from them
  — that pre-tool readback is the ordinary 'I heard you say X, is that
  right?' exchange, not a 'validated' claim`. `capture_lead.py`
  description changed symmetrically. Both stay under the 1024-char
  Pitfall A6 budget.

- **WR-01 fix (Plan 02):** `validate_address_bounded` now skips the
  `gmaps_validate_events` insert with an explicit warn log when
  `tenant_id` is falsy, instead of swallowing the NOT NULL constraint
  violation in a bare except. Restores D-C2' observability semantics
  for early/anonymous calls.

- **WR-02 fix (Plan 02):** `validate_address` short-circuits empty /
  whitespace-only `address_lines` to `verdict=error` BEFORE the HTTP
  call, preventing the 400 INVALID_ARGUMENT misclassification as
  `unsupported_region`. The bounded wrapper's Sentry-on-error gate
  (D-A3) now correctly fires for "we never captured an address" — was
  silently masked as a region-coverage problem.

- **WR-03 closeout (Plan 03):** `voice-call-architecture/SKILL.md` and
  `integrations-jobber-xero/SKILL.md` updated to accurately document
  both tool-return shapes (label form on success, STATE+DIRECTIVE on
  failure). Brittleness watch-item added (a future prompt rev keying
  on the `STATE:` prefix would silently drop the success paths).

### New / updated test invariants

- `tests/test_prompt_address_validation_rule.py::test_both_locales_pre_tool_readback_explicit`
  (replaces `test_both_locales_silence_acceptable`) locks all 8
  reframe substrings (4 must-be-present, 4 must-be-absent) at the
  test layer.
- `tests/test_google_maps.py::test_telemetry_skipped_when_tenant_id_none`
  + `test_telemetry_skipped_when_tenant_id_empty_string` lock WR-01.
- `tests/test_google_maps.py::test_empty_address_lines_short_circuits_to_error`
  + `test_whitespace_only_address_lines_short_circuits_to_error`
  + `test_empty_address_lines_triggers_sentry_via_wrapper` lock WR-02.

### Lesson learned

A directive CRITICAL RULE that explicitly licenses silence as a "safe
fallback" can deadlock the model under Gemini 3.1 Flash Live. The model
takes the safe path. The fix is two-pronged: (a) scope every CRITICAL
RULE explicitly to the conversational moment it governs (NOT the entire
turn, NOT the entire conversation), and (b) NEVER include "silence is
acceptable" as an escape hatch in a section that governs an
information-gathering loop — silence is the failure mode, not the
remedy. See user memory `feedback_directive_prompt_silence_deadlock.md`.

---

## Phase 61.2 — Gemini-Server Cancellation Cascade Mitigation (2026-05-06)

> ⚠️ **SUPERSEDED by Phase 65 (gpt-realtime-2 migration).** Everything below
> mitigated Gemini 3.1 Flash Live's server-side VAD cancellation cascade.
> gpt-realtime-2 has native async function calling — in-flight tool calls are
> NOT cancelled on caller speech — so the root cause is gone. The mechanisms
> described here (`mute_input_during_tool`, the robust-unmute lifecycle,
> `_ServerCancelHandler`) were **removed from the code** in the migration.
> Retained as debugging history only.

The first Phase 61 production regression after 61.1 shipped (call
`AJ_vV4DM5AG9t7W`, 2026-05-05 11:04 UTC, tenant "make it ai", caller
+6587528516, 132s, `outcome=not_attempted`, `tool_call_log_tail: []`)
was filed under the hypothesis "zero tool invocations + slot
fabrication." The pre-fix UAT (D-09) **did not reproduce that
hypothesis.** Tools fire. The actual failure is structural in the
LiveKit / Gemini Realtime stack, not in the prompt.

### Failure mode — server-side VAD cancellation cascade

Gemini 3.1 Flash Live performs server-side VAD on the inbound audio
stream and cancels in-flight generation + discards pending function
calls when caller speech is detected — including very brief utterances
("Hello.") that fall well below the configured
`silence_duration_ms=2500`. The agent's response to a tool result can
be cancelled mid-sentence; the next generation regenerates from a
context where the tool result has already been consumed and discarded.
The user-visible symptoms are:

- Fragmented agent speech (turns split mid-sentence; continuation
  turns starting with leading double-spaces).
- Cascading cancellations (one cancel triggers a recovery generation
  which is itself cancelled by the next caller turn; pre-fix baseline
  was 5 cancellations in 230s).
- Silent recovery deadlocks (the cancelled generation and the recovery
  generation both fail to produce a clean speak/listen cycle).

The original Phase 61.2 hypothesis (zero tool invocations + slot
fabrication) was symptomatic of this cascade — `tool_call_log_tail: []`
in the baseline call reflected tool calls that fired but were
server-cancelled before they could be logged via the goodbye diag.

### Wave 1 fixes (livekit-agent commits 93dd4b5, 1afde0e, 1b636bc, c66e435)

**Fix A — Mute pattern extension**
(`livekit-agent/src/tools/{check_caller_history,check_customer_account,capture_lead}.py`,
commit `93dd4b5`): The `mute_input_during_tool` helper from
`_availability_lib.py` was previously called only by the four
availability/booking tools. Phase 61.2 extends it to the three
data-fetch tools that run BLOCKING Supabase / HTTP I/O. Each new call
site is the FIRST I/O-touching statement in its function body,
mirroring the `check_day.py:61` reference shape, with a Phase
61.2-anchored comment pointing back to `61.2-RESEARCH.md` § 4 fix A.
`transfer_call` and `end_call` remain intentionally untouched —
muting during teardown could mask the caller-cancellation signal.

**Fix B — Robust unmute lifecycle**
(`livekit-agent/src/tools/_availability_lib.py`, commit `1afde0e`):
Two surgical changes to `mute_input_during_tool`:
1. `_TOOL_MUTE_FALLBACK_S` raised from 15.0s to 25.0s. The
   booking-section name+address readback runs 10-14s; on a
   server-cancelled call the recovery generation may extend further.
   15s left no margin and the safety unmute fired mid-recovery.
2. New `_on_tools_executed` listener subscribed via
   `session.on("function_tools_executed", ...)` immediately after the
   existing `agent_state_changed` listener. Resets
   `saw_fresh_speaking[0] = False` on each fresh tool execution
   during the mute window, re-anchoring the unmute on the recovery
   generation's clean speak/listen cycle rather than on the
   cancelled original. Symmetric cleanup unsubscribes both pyee
   surfaces (`off` + `remove_listener`) in `_unmute_logic()`'s
   finally block.

**Fix C — Server-cancellation telemetry**
(`livekit-agent/src/agent.py`, commit `1b636bc`): New
`_ServerCancelHandler(logging.Handler)` mirrors the
`_GoodbyeDiagHandler` shape from Phase 60.3 (constructor takes
`diag_record` list-of-1, try/except no-raise contract, per-call
install + finally-block cleanup). Installed on BOTH
`livekit.plugins.google.realtime` (where Gemini-Live emits the
warnings today) AND parent `livekit.plugins.google` (defensive
fallback for SDK namespace shifts). Watches two warning substrings:

- `"server cancelled tool calls"` →
  `_diag_record[0]["server_tool_cancellations"] += 1`
- `"received server content but no active generation"` →
  `_diag_record[0]["orphaned_server_content"] += 1`

Counters use lazy default-zero `dict.get(key, 0) + 1` so the fields
are OMITTED on healthy calls — mere field presence in the
`[goodbye_race]` JSON line + Sentry breadcrumb signals "cascade fired
on this call." Pure observability — zero behavior change.

### Test invariants (`livekit-agent/tests/test_tool_mute_invariants.py`, commit c66e435)

5 substring-grep pytest tests (101 lines) lock the structural pattern
against silent regression. Pattern follows
`tests/test_no_generate_reply_in_src.py` from Phase 63.1 — open source
files as text via `Path.read_text(encoding='utf-8')`, assert/refute
keyword presence; no SDK imports, no mocks, no fixtures.

| Test | Guards |
|------|--------|
| `test_data_fetch_tools_mute` | All 6 tools (3 Plan-02 additions + 3 pre-existing availability tools) call `mute_input_during_tool` |
| `test_terminal_tools_do_not_mute` | `transfer_call.py` and `end_call.py` do NOT call it (negative invariant) |
| `test_unmute_fallback_at_least_25s` | `_TOOL_MUTE_FALLBACK_S` regex-extracted, FLOOR (≥ 25.0) — tolerates future raises |
| `test_function_tools_executed_listener` | `_availability_lib.py` contains `function_tools_executed` substring |
| `test_server_cancel_handler_installed` | `agent.py` contains `class _ServerCancelHandler`, `livekit.plugins.google.realtime`, `server_tool_cancellations`, `orphaned_server_content` |

Suite delta: +5 passed / 0 new failures (pre-Plan-05 baseline 282
passed/11 failed at HEAD `1b636bc`; post-Plan-05 287/11). The 11
pre-existing failures from 60.3 / 60.4 / 63.1 prompt-builder drift
are tracked in `deferred-items.md` as out of scope.

### D-12 post-fix UAT verdict — gap (call AJ_5NcSoiaZGZTJ)

A live SIP call placed against the test tenant after Wave 1 deployed
to Railway (worker `AW_jUYX6EriSybE`, livekit-agents 1.5.7,
registered 07:59:29 UTC; 202s, `outcome=not_attempted`,
CLIENT_INITIATED) produced the following telemetry from Fix C:

| Field | Pre-fix baseline (`AJ_vV4DM5AG9t7W`) | Post-fix (`AJ_5NcSoiaZGZTJ`) | Delta |
|-------|--------------------------------------|------------------------------|-------|
| `server_tool_cancellations` | 5 (3 logged + 2 inferred) | 1 | **-80%** |
| `orphaned_server_content` | 1 | 1 | flat |
| Total cascade events | 5 | 2 | **-60%** |

**The cascade is structurally contained but a new failure mode
surfaced.** D-12-rev verdict: 1 of 3 criteria pass (`gap`).

- ✅ Cascade rate strictly < 5 (2 < 5).
- ✗ Transcript fragmenting still present — 1 leading-double-space
  pair + 1 self-restart pair (`"Let me see what that day looks like
  for you. Give me just a second to check that day."`) consistent
  with cancel-and-regenerate.
- ✗ No booking and no clean lead-capture — **slot hallucination after
  cancellation** (see below).

### NEW failure mode — slot hallucination after cancellation

`check_day` returned `STATE:day_has_slots date_label=Thursday, May
7th count=9` at 08:05:46. After the 1 server-cancellation at 08:06:14
(function_call_id `fc_15328661595426966818`) and the 25s mute
fallback at 08:06:08, the regenerated agent response told the
caller: **"it looks like we don't have anything open tomorrow"** —
directly contradicting the tool result.

The cascade is structurally contained (no deadlock — the agent
successfully regenerated 23 seconds after the server-cancel), but the
residual cascade now produces a **slot inversion** instead of a
recovery deadlock. From the caller's perspective this is worse than
the pre-fix deadlock — they get an answer, but it's wrong. The
working hypothesis is that when the agent's response to `check_day`
is cancelled and regenerated, the regeneration runs from a context
where the tool result has already been consumed/discarded, and the
model fills in plausible-sounding text — including text that inverts
the tool's STATE. **Triaged to Phase 61.3** (highest severity).

### NEW finding — Plan 03 listener-missed regression

The `mute_input_during_tool` unmute log line on the post-fix call
read:

```
[tool_mute] unmuted input id=1 (fallback timeout 25.0s)
```

The unmute came via the 25s fallback timer, **not** via the
`function_tools_executed` re-anchor listener Plan 03 added. The 15→25s
raise correctly absorbed the cascade window (the call did not
deadlock), but the listener as currently registered does not catch
the event for the `check_day` path. The 25s fallback covered for it
this time; **triaged to Phase 61.3** to investigate which
emitter/event the listener should bind to.

### SDK 1.5.7 note (cross-link to Phase 63.2)

`livekit-agents==1.5.7` ships `fix: realtime reply generation after
interruption` (one-line `return` in
`agent_activity._realtime_reply_task:2811`) — addresses a downstream
client-side symptom, NOT the upstream Gemini-server cancel-and-discard
behavior. PR #5535 / #5594 add a pausable-output mechanism but
require opt-in via `RoomOutputOptions` and `can_pause`-capable
output (deferred from 61.2 scope; future spike).

### Phase 61.3 forward-pointer

Three closure items, in severity order:

1. **Slot-hallucination-after-cancellation** (highest severity) —
   when the agent's response to `check_day` is cancelled and
   regenerated from stale/cleared context, it inverts the tool
   result. Likely fixes: on `function_call_cancelled`, inject a
   synthetic user turn that re-states the last successful tool's
   STATE so the regenerated response sees ground truth; OR mark the
   tool result as "must-include" in the regeneration context.
   Investigation in `agent.py` `_ServerCancelHandler` — escalate
   from telemetry to recovery action.
2. **Fix B listener wiring** — `function_tools_executed` did not
   fire for the `check_day` path. Investigate which event/emitter
   the listener should bind to, and whether `_TOOL_MUTE_FALLBACK_S`
   should be tuned (25s feels long when the caller is silent).
3. **Greeting playout timeout robustness** — Call 2 of the post-fix
   UAT (`AJ_dTnDR7CQo8vD`, 37s) timed out on greeting playout
   (`[63.1-07] greeting playout wait timed out at 10s; force-unmuting
   input`). Pre-existing fragility in `wait_for_playout()` when SIP
   audio drops mid-playout. Plan: extend the timeout failure path so
   the agent is robust to partial-audio greetings (consider awaiting
   only first-frame-sent rather than full playout).

### Lessons learned

- **Prompt edits cannot prevent server-side VAD cancellations on
  Gemini 3.1 Flash Live.** The structural mute pattern is the only
  known mitigation today (see user memory
  `project_phase_61_cascade_failure_mode.md`).
- **Cascade-mitigation is necessary but not sufficient.** Containing
  the cascade rate (5→2, -60%) eliminates recovery deadlocks but can
  unmask a slot-hallucination failure mode where the regenerated
  response runs without the tool result in context. Telemetry now
  exists (Fix C) so future regressions in this area land with
  quantitative evidence rather than transcript-tail snapshots.
- **Net-positive structural progress is worth shipping even when
  verdict=gap.** Wave 1 fixes stay on `livekit-agent/main` because
  they cut cascade rate by 60% and provide the measurement
  instrument Phase 61.3 will use to verify its hypothesis-driven
  fixes.

### Wave 1 commits (livekit-agent main)

- `93dd4b5` — `fix(61.2-A): mute input during BLOCKING data-fetch tools`
- `1afde0e` — `fix(61.2-B): robust unmute lifecycle for multi-step Gemini recovery`
- `1b636bc` — `fix(61.2-C): server-cancellation telemetry on goodbye diag record`
- `c66e435` — `test(61.2): static invariants locking Fix A/B/C against regression`

Pre-fix baseline call: `AJ_vV4DM5AG9t7W` (5 cascade events / 230s,
recovery deadlock). Post-fix verification call: `AJ_5NcSoiaZGZTJ`
(2 cascade events / 202s, slot hallucination — triaged to 61.3).

---

## Phase 61.3 — Cascade-Recovery via Tool-Result Replay (2026-05-07)

> ⚠️ **SUPERSEDED by Phase 65 (gpt-realtime-2 migration).** The
> `_attempt_tool_result_replay` / `update_chat_ctx` cascade-recovery mechanism
> below existed only to repair Gemini 3.1's cancel-and-discard behavior. It was
> **removed from the code** in the migration (gpt-realtime-2 does not drop the
> tool result on caller speech). Retained as debugging history only.

Phase 61.2 contained the cascade (cancellation rate -80%) but did not
close the slot-hallucination failure mode. UAT call `AJ_5NcSoiaZGZTJ`
showed `check_day` returning `STATE:day_has_slots count=9` followed by
a Gemini-server stall + cancellation, then an agent regeneration that
told the caller "we don't have anything open tomorrow" — direct
inversion of the tool result. From the caller's perspective this is
worse than the pre-61.2 deadlock (an authoritative wrong answer
instead of dead air). Phase 61.3 closes this gap with one mechanism:
stall-detection + tool-result replay via `update_chat_ctx`.

### Failure mode — regeneration without tool-result context

When Gemini's server-side VAD cancels an in-flight generation that
was responding to a tool call, the next regeneration runs from a
chat context where the tool result has been consumed and discarded.
The 61.2 mute pattern prevents the user from talking over the
response (preventing CASCADE) but does not put the tool result
BACK into the chat context for the regeneration to see (preventing
INVERSION). The Gemini server provides no auto-replay mechanism
(verified at `realtime_api.py:1302-1308` — `_handle_tool_call_cancellation`
only logs and marks the generation done).

### The mechanism — stall-detection + synthetic FunctionCallOutput replay

Located in `livekit-agent/src/tools/_availability_lib.py`. New
`_attempt_tool_result_replay` async helper invoked from
`_unmute_logic()`'s `TimeoutError` branch BEFORE the listener
cleanup AND BEFORE `set_audio_enabled(True)`. Steps:

1. **Stall confirmation (D-04):** compare
   `deps["_diag_record"][0]["last_audio_frame_at"]` against
   `mute_set_at_ms` (captured the moment input was muted). If no
   audio frames advanced during the speaking window, stall is
   confirmed. (Reuses Phase 60.3 Fix C's `last_audio_frame_at`
   — D-09: no parallel tracking mechanism.)
2. **Data lookup:** read `deps["_last_tool_state"]` (set by tools
   in their return path), `deps["_last_tool_call_id"]` and
   `deps["_last_tool_name"]` (set by an extension to the existing
   `_on_tools_executed` listener that captures
   `FunctionToolsExecutedEvent.function_calls[-1]`). Null guard
   short-circuits with no replay if any are missing.
3. **Replay construction (D-05):** build a synthetic
   `livekit.agents.llm.FunctionCallOutput` with the captured
   `call_id`, `name`, and STATE+DIRECTIVE string as `output`.
   Append to a copy of `rt_session.chat_ctx.items`, then
   `await rt_session.update_chat_ctx(chat_ctx)`.
4. **Order (D-06):** replay completes (or fails) BEFORE
   `set_audio_enabled(True)`. VAD cannot fire on muted input, so
   user speech cannot race the recovery.
5. **Best-effort (D-07):** the entire replay is wrapped in
   `try/except Exception` — any failure logs and increments a
   counter; `_unmute_logic` continues to the unmute path. Replay
   failure does not block the call.

### The unlock — tool_results send is unconditional

The replay relies on a SDK invariant the original Phase 61.2
research mis-characterized:

| Old understanding | Corrected understanding (verified) |
|-------------------|-------------------------------------|
| "`mutable_chat_context=False` blocks all context updates for Gemini 3.1" | The gate at `realtime_api.py:628` only blocks the `turns` append (LiveClientContent). The `tool_results` send at `realtime_api.py:637-638` is OUTSIDE the gate and fires unconditionally — including for `gemini-3.1-flash-live-preview`. (Verified against installed livekit-plugins-google 1.5.7.) |
| "Recovery requires `generate_reply()`" | `generate_reply()` is gated for 3.1 (raises `RealtimeError` on 1.5.7); `update_chat_ctx` with a synthetic `FunctionCallOutput` triggers Gemini-server-side regeneration without it. |

The `FunctionResponse` lands on the Gemini server, which then
auto-generates a new agent turn that has the tool result in its
context — closing the slot-inversion failure mode.

### Listener-miss correction (closes 61.2-VERIFICATION.md gap #2)

Phase 61.2-VERIFICATION.md filed gap #2 as "the
`function_tools_executed` listener does not fire for the
`check_day` path." This framing is **incorrect** and is closed
here:

- The listener fires on the correct emitter
  (`session.on("function_tools_executed", ...)` — `session` is
  the `AgentSession` and the event is emitted at
  `agent_activity.py:3372`).
- What the 61.2 UAT actually showed was that the unmute came via
  the 25s safety fallback rather than via the listener-driven
  path. That happened because Gemini's server-side TTS stalled —
  the agent never transitioned `listening → speaking → listening`
  cleanly. The listener can only fire on a clean tool-execution
  cycle; if the cycle never completes, the SDK has no signal to
  emit. **The listener works as designed.**
- 61.3 ADDS recovery as a complementary structural pattern: when
  the 25s fallback fires (the "listener didn't get a clean
  cycle" signal), the replay attempts to recover. The listener
  does not need to be rebuilt or rebound.

Future phases should NOT chase the listener-miss thread — that
investigation is closed.

### Telemetry (D-08)

Two new counters extend Phase 61.2's `_ServerCancelHandler` shape
via the same conditional-emit pattern (`dict.get(key, 0) + 1`):

- `stalled_generation_recoveries` — number of times the replay
  helper attempted recovery (i.e. confirmed stall + had data to
  replay).
- `stalled_generation_replay_failed` — number of times the
  `update_chat_ctx` call raised or `rt_session` was unavailable.

Like the 61.2 counters, these keys are OMITTED from `[goodbye_race]`
JSON / Sentry breadcrumb on healthy calls (count == 0). Mere field
presence signals "stall fired on this call."

Counter values are written from `_attempt_tool_result_replay` via
`deps["_diag_record"][0]` — the same list reference shared with
`agent.py`'s `_GoodbyeDiagHandler` and `_ServerCancelHandler`.
Updates from the async helper flow into `_flush_goodbye_diag`
automatically.

### Test invariants (`livekit-agent/tests/test_cascade_recovery_invariants.py`)

Six substring-grep invariants (same shape as 61.2's
`test_tool_mute_invariants.py` — pure structural guards, no SDK
imports, no mocks, no fixtures):

| Test | Guards |
|------|--------|
| `test_replay_path_in_fallback` | `_attempt_tool_result_replay` defined and awaited inside `_unmute_logic` |
| `test_replay_uses_update_chat_ctx` | Helper calls `update_chat_ctx` and constructs `FunctionCallOutput` |
| `test_replay_not_generate_reply` | NO `generate_reply` substring in `_availability_lib.py` (gated for 3.1) |
| `test_replay_before_set_audio_enabled` | Source-order: replay invocation appears BEFORE `set_audio_enabled(True)` |
| `test_stall_recovery_counters_present` | Both new counter names present |
| `test_stall_counters_conditional_emit` | Both counters use `.get(key, 0) + 1` pattern |

Behavioral testing of the replay was deferred (D-11): mocking
`RealtimeSession.update_chat_ctx` doesn't faithfully exercise the
cascade. The D-12 live SIP UAT is the behavioral gate, matching the
61.2 deferral pattern.

### D-12 post-fix UAT verdict — call `{UAT_CALL_ID}` (UPDATE POST-UAT)

{UAT_VERDICT_TABLE_PLACEHOLDER — populate from 61.3-UAT.md after the live call. Expected
fields: server_tool_cancellations, orphaned_server_content,
stalled_generation_recoveries, stalled_generation_replay_failed,
booking_outcome, transcript inversion check.}

Pre-fix baseline for cascade-recovery verdict is the 61.2 UAT call
`AJ_5NcSoiaZGZTJ` — that call had `server_tool_cancellations=1`
AND a slot-inverted regeneration ("we don't have anything open
tomorrow" against `STATE:day_has_slots count=9`). 61.3 ships when
a similar cascade event produces `stalled_generation_recoveries >=
1` AND the agent does NOT invert the tool result.

### Memory pointer update

The user-memory entry `project_phase_61_cascade_failure_mode`
documents the structural mute pattern as the only known prevention.
61.3 ADDS the structural replay pattern as a complementary
recovery. The memory entry should be updated post-UAT to note both
layers:

- Prevention (61.2): mute caller input during tool execution +
  booking-section response window; raises fallback to 25s; adds
  `function_tools_executed` re-anchor listener; installs
  `_ServerCancelHandler` telemetry.
- Recovery (61.3): on 25s fallback fire + confirmed stall, replay
  last tool's STATE+DIRECTIVE as a synthetic `FunctionCallOutput`
  via `update_chat_ctx` BEFORE unmuting.

Together these close the slot-hallucination cascade. Future phases
that observe new failure modes after both fixes are in place should
re-measure the cascade rate against the 61.3 baseline rather than
the pre-61.2 baseline (`AJ_vV4DM5AG9t7W`).

### Deferred items (closed via re-measurement plan, not separate fixes)

- **Transcript fragmenting** (gap #3 from 61.2-VERIFICATION.md) —
  symptom of the cancel-and-regenerate cycle. Re-measure after
  61.3's recovery lands; if still present, surface as a new phase.
- **Greeting playout 10s timeout** (gap #4 from
  61.2-VERIFICATION.md) — orthogonal to the cascade (different
  code path: `_unmute_after_greeting`). Future polish phase.
- **Lowering `_TOOL_MUTE_FALLBACK_S`** — the 25s window IS the
  design; lowering it would expose more calls to the same race.
  Don't touch.


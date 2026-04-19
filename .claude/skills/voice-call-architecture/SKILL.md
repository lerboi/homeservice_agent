---
name: voice-call-architecture
description: "Complete architectural reference for the voice call system — Twilio SIP + LiveKit + Gemini 3.1 Flash Live Python agent, SIP trunking, in-process tool execution, post-call pipeline, triage, scheduling, booking, notifications, and lead management. Use this skill whenever making changes to the call system, voice agent prompts, triage logic, booking flow, post-call pipeline, notifications, lead creation, or any Twilio/LiveKit/Gemini integration. Also use when the user asks about how calls work, wants to modify agent behavior, or needs to debug call-related issues."
---

# Voice Call Architecture — Complete Reference

This document is the single source of truth for the entire voice call system. Read this before making any changes to call-related code.

**Last updated**: 2026-04-20 (**Phase 60.2: Voice tool-call filler race + VAD tuning.** Fix G (shipped) raised server-VAD `silence_duration_ms` from `1000` → `1500` in `src/agent.py`; UAT (Persona 1, 226s call on 2026-04-20, call-_+6587528516_945EJsSSXxWh) confirmed `server cancelled tool calls` warnings dropped 2/call → 0/call, no mid-sentence `[cut]` at tool boundaries, `book_appointment: idempotent re-invocation` gone on happy path. Fix H (deterministic runtime filler via `context.session.say()` inside 4 scoped tools — `check_availability`, `book_appointment`, `capture_lead`, `transfer_call` — with `_FILLER_PHRASES` rotation via deps-scoped `_filler_idx_<tool>` counter and `allow_interruptions=False`) was implemented (Plan 03) and **reverted** (commit `cbe1bb9` in livekit-agent repo) after Plan 05 UAT caught every filler raising `RuntimeError: trying to generate speech from text without a TTS model` — `AgentSession(llm=RealtimeModel)` on livekit-agents 1.5.1 has no TTS attached because Gemini Live emits audio directly, and `session.say()` requires one; repairing would force a non-Gemini TTS (voice mismatch) so Fix H was dropped rather than fixed. Plan 04's `_build_tool_narration_section()` prompt change (telling Gemini "runtime plays filler") was reverted verbatim alongside; model now speaks its own filler again via prompt-driven prose. `tests/test_filler_audio.py` deleted; `tests/test_prompt.py` inverted to guard against re-landing the broken runtime-filler claim. Accepted limitation recorded in section 5 "Phase 60.2 — Fix H reverted" — do not reintroduce `session.say()` on a RealtimeModel-only session without attaching a TTS or using a separate audio source. **Fix I** (post-call pipeline 8s timeout) self-resolved — post-call completed ~12s after session close without triggering the timeout on the post-G UAT call. **Fix J** (upstream google plugin upgrade past commit `43d3734`) declined — commit `3e51d8e` ambiguously changes `generate_reply()` compatibility for `gemini-3.1-flash-live-preview`, risking silent breakage of the greeting and intake-injection paths; `_SegmentSynchronizerImpl.playback_finished` race tracked as livekit/agents#4486 (OPEN since Jan 2026, no upstream fix). Open for Phase 60.3: goodbye cut-off diagnosis (different race class from tool-call race Fix G solves — needs `end_call` invocation-timing + last-text-token logging) and a Gemini 3.1 Flash Live + v1.5.1 + plugin-@43d3734 prompt-best-practices audit of the full `build_system_prompt()`. See `.planning/phases/60.2-voice-tool-call-filler-race-and-vad-tuning/60.2-05-SUMMARY.md` for the remediation story and `60.2-06-SUMMARY.md` for this skill update. Previous: **Phase 60: Voice prompt polish — name-once + single-question address intake**. `prompt.py` gains three new blocks in `_build_info_gathering_section` and `_build_booking_section` (both now accept `locale: str = "en"`): (1) **NAME USE DURING THE CALL** — capture the caller's name silently, no name vocative mid-call (no "Thanks, {name}" or "Okay {name}"), single authoritative readback at booking is the only on-air name-confirmation moment; caller-invited override path ("you can call me X", "I go by X"); no-name path never blocks booking; references existing CORRECTIONS rule for mispronunciations (D-01..D-05). (2) **SERVICE ADDRESS** — single natural opener `"What's the address where you need the service?"` replaces the old three-part walkthrough; one targeted follow-up at a time for missing pieces; outcome-framed minimum capture ("enough for us to find the place"); no field enumeration on-air (D-06..D-08). (3) **BEFORE BOOKING — READBACK (mandatory)** — mandatory name+address readback in one utterance before `book_appointment` fires, accept-and-re-read correction loop referencing CORRECTIONS until caller stops correcting; no-name path reads address only (D-02, D-09, D-10). Spanish mirror (usted register) added for all three blocks via `locale='es'` conditionals in the same two builders (D-13, D-14 — user-approved). All 5 tool returns in `src/tools/*.py` (book_appointment, capture_lead, transfer_call, check_availability, check_caller_history) rewritten to strict `STATE:<code>|DIRECTIVE:<imperative>` format — machine-facing, not speakable English; generalizes the prior check_availability parrot-loop fix across every tool (D-16). Every DIRECTIVE ends with "Do not repeat this message text on-air." `capture_lead` description reaches single-question-intake + readback parity with `book_appointment` (D-11, D-12). `end_call.py` untouched (space-character return not a parrot-loop risk). Tool signatures frozen — no new input surface. Phase 46 `deps["_booking_succeeded"]` / `deps["_booked_appointment_id"]` stamping preserved. Pre-existing Phase 30 Spanish structural gap (intro paragraphs, URGENCY, SCHEDULING, AVAILABILITY RULES remain English-only regardless of locale) was intentionally NOT retroactively fixed (Pitfall 4). Previous: Phase 46: Priority (VIP) caller direct routing** — webhook `_is_vip_caller(tenant, from_number)` check added between subscription and schedule evaluation in `/twilio/incoming-call`. Two sources: `tenants.vip_numbers` JSONB (standalone priority numbers, no DB hit) and lead-based lookup via `leads.is_vip=true` (sparse partial index `idx_leads_vip_lookup`). On match → direct owner-pickup parallel ring, bypasses schedule + cap. User-facing brand is "Priority"; DB columns keep "vip" naming. Migration 049. **Post-call booking reconciliation** — `tools/book_appointment.py` stamps `deps["_booking_succeeded"]`, `deps["_booked_appointment_id"]`, `deps["_booked_caller_name"]` synchronously on success. `agent.py:_on_close_async` forwards these as `booking_succeeded`/`booked_appointment_id`/`booked_caller_name` params to `run_post_call_pipeline`. Post-call uses these as authoritative truth to fix `calls.booking_outcome='booked'` and backfill `appointments.call_id` (guard: `.is_("call_id","null")`), closing the race where the mid-call `.update().eq("call_id", …).execute()` matched zero rows because the background `_run_db_queries` task had not yet inserted the calls row. Also hardens `_extract_field_from_transcript` name regex — explicit `[Mm]y name is` alternation + post-match `name[0].isupper()` check + expanded blocklist. **Owner SMS `from_number`** — `send_owner_sms` now accepts a `from_number` parameter (matches `send_caller_sms`/`send_caller_recovery_sms`). Post-call passes `to_number` (the tenant's own Twilio number). Removes reliance on global `TWILIO_FROM_NUMBER` env var, which was unset in multi-tenant deployments. Previous: Phase 40: Live webhook routing composition wired in `/twilio/incoming-call` (tenant lookup -> sub check -> evaluate_schedule -> check_outbound_cap -> TwiML), dial-status writeback, dial-fallback AI TwiML, SMS forwarding to pickup_numbers with sms_forward=true, migration 045 (sms_messages table + call_sid on calls), provisioning update sets voice_url/voice_fallback_url/sms_url from RAILWAY_WEBHOOK_URL on new Twilio numbers, cutover script updates existing tenant numbers. Phase 39: FastAPI webhook service replaces `src/health.py`. New `src/webhook/` subpackage with `app.py` (FastAPI instance + `/health` + `/health/db`), `twilio_routes.py` (4 signature-gated POST endpoints under `/twilio`), `security.py` (`verify_twilio_signature` dependency), `schedule.py` (pure-function `evaluate_schedule` + frozen `ScheduleDecision` dataclass), `caps.py` (`check_outbound_cap` async function with US/CA 5000-min and SG 2500-min monthly limits). `_normalize_phone` extracted from `agent.py` inline closure to `src/lib/phone.py` for reuse between webhook + agent. Migration 042 adds `call_forwarding_schedule`, `pickup_numbers`, `dial_timeout_seconds` to `tenants`; `routing_mode`, `outbound_dial_duration_sec` to `calls`; `idx_calls_tenant_month` compound index. Phase 39 is purely additive — zero production Twilio numbers reconfigured; `/twilio/incoming-call` always returns hardcoded AI TwiML per D-13 dead-weight pattern so Phase 40's diff is a one-line branch swap. Webhook test suite: 35 tests (17 schedule + 8 caps + 6 routes + 4 security) green in ~1.3s. New deps: `fastapi>=0.115,<1`, `uvicorn[standard]>=0.30,<1`, `python-multipart>=0.0.9,<1`. Previous: Pin fix — livekit-agents, livekit-plugins-silero, livekit-plugins-turn-detector locked to ==1.5.1 in pyproject.toml. PyPI livekit-agents 1.5.2 shipped Apr 8 2026 with PR #5211, which added a required 7th field `per_response_tool_choice` to `llm.RealtimeCapabilities`. The git-pinned google plugin at commit 43d3734 still constructs RealtimeCapabilities with 6 fields, so any Railway rebuild after Apr 8 produced a TypeError at RealtimeModel.__init__ on every inbound call. The plugin pin must stay because commit 43d3734 is the only google plugin version supporting `generate_reply()` with `gemini-3.1-flash-live-preview` (via the `A2A_ONLY_MODELS` branch). See "Why livekit-agents and sibling plugins are pinned to 1.5.1" in section 1 for details. Previous: book_appointment tool now truly fire-and-forget for calendar push and caller SMS — was previously blocking for 1-4s while awaited, causing the AI to go silent and triggering duplicate invocations that fired spurious recovery SMS. Added idempotency cache keyed on slot_start|slot_end stored in deps, and a late-duplicate guard in the slot_taken branch. check_availability general-summary return no longer leaks earliest/latest slot time anchors — AI was mining them to fabricate specific times. Added anti-shortcut rules to booking section (different-time re-check, vague-window handling) with a concrete 2pm/3pm example. Updated check_availability tool description to forbid picking times for vague windows like "afternoon.")

---

## Architecture Overview

Two separate services work together:

| Service | Runtime | Deployment | Purpose |
|---------|---------|------------|---------|
| **Next.js App** | Vercel | Vercel | Dashboard, API routes, cron jobs, Stripe webhooks, phone provisioning |
| **LiveKit Voice Agent** | Python 3.12 | Railway | Real-time AI voice conversation via Gemini 3.1 Flash Live |

The agent is a **separate repo** (`lerboi/livekit_agent`) at `C:/Users/leheh/.Projects/livekit-agent/`.

**LiveKit Railway service webhook surface (Phase 39 + 40):** The LiveKit Voice Agent Python process also runs a FastAPI webhook server on port 8080 via a daemon thread started before `cli.run_app()`. This surface exposes `GET /health`, `GET /health/db` (ported from the deleted `src/health.py`), and four signature-gated Twilio endpoints: `POST /twilio/incoming-call` (live routing composition: tenant lookup -> sub check -> evaluate_schedule -> check_outbound_cap -> AI or owner-pickup TwiML), `POST /twilio/dial-status` (writes duration + routing_mode to calls row), `POST /twilio/dial-fallback` (returns AI SIP TwiML for unanswered owner calls), `POST /twilio/incoming-sms` (forwards to sms_forward=true pickup_numbers, logs to sms_messages). All production Twilio numbers route through this webhook via `voice_url` set during provisioning or cutover.

```
Caller dials Twilio number
       |
  Twilio voice_url -> Railway webhook /twilio/incoming-call (Phase 40)
       |  (SIP trunk preserved as rollback safety net — Twilio prioritizes voice_url over SIP trunk)
       |
  Webhook routing composition:
       |  1. Tenant lookup by To number (_normalize_phone -> tenants.phone_number)
       |  2. Subscription check (fail-open: blocked/unknown -> AI)
       |  3. Priority (VIP) caller check — _is_vip_caller(tenant, from_number)
       |     - Match via tenants.vip_numbers JSONB OR leads.is_vip=true
       |     - Match -> direct owner-pickup parallel ring (bypasses steps 4-5)
       |  4. evaluate_schedule(call_forwarding_schedule, tenant_timezone, now_utc)
       |  5. If owner_pickup: check_outbound_cap(tenant_id, country)
       |     - Cap breach -> downgrade to AI
       |  6. Return TwiML:
       |     - AI mode: <Dial><Sip>{LIVEKIT_SIP_URI}</Sip></Dial>
       |     - Owner pickup: <Dial timeout callerId action="/twilio/dial-status">
       |                       <Number>pickup1</Number>...<Number>pickup5</Number>
       |                     </Dial>
       |
  [AI path] LiveKit SIP dispatch rule creates room: "call-{uuid}"
       |
  Agent joins room (entrypoint function, agent_name="voco-voice-agent")
       |  Looks up tenant by to_number (sip.trunkPhoneNumber)
       |  Calculates initial available slots
       |  Builds system prompt (locale, tone, intake questions)
       |  Creates call record in DB
       |
  Opens Gemini 3.1 Flash Live session (native audio-to-audio)
       |  Starts Egress recording -> Supabase S3 (call-recordings bucket)
       |  Gemini's native server VAD handles turn detection
       |
       |  During call: AI uses 6 tools (in-process, direct Supabase access)
       |    check_caller_history -> read-only leads + appointments lookup
       |    check_availability   -> real-time slot calculation
       |    book_appointment     -> atomic_book_slot() + calendar sync + caller SMS
       |    capture_lead         -> create_or_merge_lead() (mid-call lead)
       |    transfer_call        -> SIP REFER via LiveKit SipClient
       |    end_call             -> removes SIP participant after 3s delay
       |
  Session closes -> Post-call pipeline runs immediately (in-process)
       |  Transcript + recording saved to call record
       |  Test call auto-cancel (if applicable)
       |  Usage tracking + overage billing
       |  Language barrier detection
       |  3-layer triage classification
       |  Suggested slot calculation (unbooked calls)
       |  Lead creation/merging
       |  Owner notifications (SMS + email, preference-gated)
       |
  ~60s after call -> Recovery SMS cron (for not_attempted calls, with retry)

  [Owner pickup path] Twilio dials up to 5 pickup numbers simultaneously
       |  Owner answers -> call connected, dial-status writes duration + routing_mode='owner_pickup'
       |  No answer -> voice_fallback_url fires /twilio/dial-fallback -> returns AI SIP TwiML
       |               dial-status writes routing_mode='fallback_to_ai'
       |               Caller enters AI path (same greeting as direct AI, no fallback-aware behavior)

  [SMS path] /twilio/incoming-sms forwards to pickup_numbers with sms_forward=true
       |  Format: "[Voco] From {sender}: {body}"
       |  MMS: "[Media attached - view in Twilio console]" note appended
       |  Logged to sms_messages table (inbound + forwarded rows)
```

---

## File Map

### Agent Repo (`lerboi/livekit_agent` — deployed to Railway)

| File | Role |
|------|------|
| `src/agent.py` | Main entry point — `entrypoint()`, tenant lookup, Gemini session, Egress recording, post-call trigger |
| `src/prompt.py` | System prompt builder — all behavioral sections |
| `src/post_call.py` | Post-call pipeline — triage, leads, notifications, usage tracking |
| `src/supabase_client.py` | Singleton service-role Supabase client |
| `src/utils.py` | Date formatting, initial slot calculation |
| `src/webhook/__init__.py` | Webhook subpackage entry — exports `app` and `start_webhook_server` (daemon thread uvicorn boot) |
| `src/webhook/app.py` | FastAPI app instance — `GET /health`, `GET /health/db` (ported from deleted `src/health.py`); mounts `twilio_routes` router |
| `src/webhook/twilio_routes.py` | APIRouter with prefix `/twilio`, router-level signature dependency, 4 live POST endpoints: `incoming-call` (tenant lookup -> sub check -> evaluate_schedule -> check_outbound_cap -> AI or owner-pickup TwiML), `dial-status` (writes duration + routing_mode to calls row), `dial-fallback` (returns AI SIP TwiML for unanswered owner calls), `incoming-sms` (forwards to sms_forward=true pickup_numbers, logs to sms_messages) |
| `src/webhook/security.py` | `verify_twilio_signature` FastAPI dependency — URL reconstruction via `x-forwarded-proto` + `host` headers, twilio `RequestValidator`, `ALLOW_UNSIGNED_WEBHOOKS` bypass for dev |
| `src/webhook/schedule.py` | Pure-function `evaluate_schedule()` + frozen `ScheduleDecision` dataclass — DST-aware via `zoneinfo`, handles overnight ranges and empty/disabled schedules |
| `src/webhook/caps.py` | Async `check_outbound_cap()` — monthly outbound-minute soft cap per country (US/CA 5000 min, SG 2500 min); sums `calls.outbound_dial_duration_sec` via `idx_calls_tenant_month` index |
| `src/lib/phone.py` | `_normalize_phone()` module-level helper — extracted from `agent.py` inline closure in Phase 39 so `src/webhook` and `src/agent` share the same E.164 normalization |
| `src/tools/__init__.py` | Tool registry — conditional registration based on onboarding state |
| `src/tools/book_appointment.py` | Atomic slot booking + calendar sync + SMS |
| `src/tools/check_availability.py` | Real-time slot query for requested dates |
| `src/tools/capture_lead.py` | Mid-call lead capture on booking decline |
| `src/tools/check_caller_history.py` | Repeat caller lookup (read-only, silent context) |
| `src/tools/transfer_call.py` | SIP REFER transfer to owner phone |
| `src/tools/end_call.py` | Graceful SIP participant disconnect |
| `src/lib/booking.py` | Atomic slot booking via Supabase RPC |
| `src/lib/slot_calculator.py` | Available slot calculation algorithm |
| `src/lib/leads.py` | Lead creation/merge logic |
| `src/lib/notifications.py` | SMS (Twilio) + Email (Resend) dispatch |
| `src/lib/google_calendar.py` | Google Calendar push (OAuth2) |
| `src/lib/whisper_message.py` | Whisper message builder for warm transfers |
| `src/lib/triage/classifier.py` | Three-layer triage orchestrator |
| `src/lib/triage/layer1_keywords.py` | Regex urgency detection |
| `src/lib/triage/layer2_llm.py` | LLM urgency classification (Groq/Llama 4 Scout) |
| `src/lib/triage/layer3_rules.py` | Owner service tag override |
| `src/messages/en.json` | English agent utterances + notification templates |
| `src/messages/es.json` | Spanish agent utterances + notification templates |
| `pyproject.toml` | Dependencies and build config |
| `Dockerfile` | Python 3.12-slim, runs `python -m src.agent start` |
| `livekit.toml` | LiveKit agent name and entrypoint config |
| `sip-inbound-trunk.json` | Twilio SIP inbound trunk config (allowed IPs, Krisp enabled) |
| `sip-outbound-trunk.json` | Twilio SIP outbound trunk config (for test calls) |
| `sip-dispatch-rule.json` | LiveKit SIP dispatch rule (roomPrefix: "call-") |

### Main Repo (`homeservice_agent` — deployed to Vercel)

| File | Role |
|------|------|
| `src/app/api/stripe/webhook/route.js` | Phone provisioning (US/CA Twilio purchase, SG inventory) + SIP trunk association + webhook URL config (voice_url, voice_fallback_url, sms_url from RAILWAY_WEBHOOK_URL) |
| `scripts/cutover-existing-numbers.js` | One-time script to update all existing tenant Twilio numbers to webhook routing (idempotent, supports --dry-run) |
| `src/app/api/onboarding/test-call/route.js` | LiveKit SIP outbound test call trigger |
| `src/lib/subscription-gate.js` | Subscription enforcement gate for the agent |
| `src/app/api/cron/send-recovery-sms/route.js` | Recovery SMS cron job |
| `src/app/api/notification-settings/route.js` | GET/PATCH notification_preferences JSONB for dashboard |

---

## 1. Agent Service

**Repo**: `lerboi/livekit_agent` — **File**: `src/agent.py`

The agent runs as a LiveKit Agents worker on Railway using Python 3.12.

### Connection Lifecycle

1. **Agent connects** — `await ctx.connect()` joins the LiveKit room
2. **Wait for participant** — `asyncio.wait_for(ctx.wait_for_participant(), timeout=30)` blocks until the SIP caller joins
3. **Extract phone numbers** — `sip.trunkPhoneNumber` (to_number for tenant lookup), `sip.phoneNumber` (from_number / caller) from `participant.attributes`. Raw SIP attributes are logged for debugging.
4. **Call ID** — `ctx.room.name` (e.g., `call-{uuid}`) serves as the call identifier
5. **Test call detection** — room metadata `{ test_call: true }` set by test-call route. For test calls, `to_number` is read from room metadata (outbound SIP participants don't have `sip.trunkPhoneNumber` set to the tenant's number).
6. **Phone normalization** — `_normalize_phone()` strips `sip:`/`tel:` prefixes, `@domain` suffixes, and ensures `+` prefix for E.164 format. Applied to both `to_number` and `from_number` before tenant lookup.
7. **Tenant lookup** — query `tenants` by `phone_number = to_number` via `asyncio.to_thread()`
8. **Build system prompt** — `build_system_prompt(locale, ..., working_hours=..., tenant_timezone=...)` immediately after tenant lookup (without intake questions — injected later). Includes business hours and corrections sections.
8. **Create tools** — `create_tools(deps)` with mutable `deps` dict (call_uuid=None initially, filled in after call record insert)
9. **Create Gemini session** — `RealtimeModel` + `VocoAgent` + `AgentSession`
10. **Register event handlers** — transcript collection, error handler, close handler (all BEFORE session.start)
11. **Fire DB queries in background** — subscription check, intake questions, call record upsert run as `asyncio.create_task()` (non-blocking)
12. **Start session** — `await session.start(agent=agent, room=ctx.room, room_options=...)` — runs in parallel with DB queries
13. **Greeting** — `session.generate_reply(instructions="Greet the caller now.")` fires immediately after session starts
14. **DB queries complete** — subscription blocked? disconnect. Intake questions? injected via `session.generate_reply(instructions=...)`. Call record? `deps["call_uuid"]` updated.
15. **Start Egress** — `LiveKitAPI().egress.start_room_composite_egress()` -> Supabase S3 (after DB task completes)
16. **Session close** — async handler stops Egress, runs `run_post_call_pipeline()`

**Webhook server boot (Phase 39):** Before `cli.run_app()` in `__main__`, `src/agent.py` calls `start_webhook_server()` from `src/webhook/__init__.py`. This spawns a daemon thread that runs `uvicorn.run(app, host='0.0.0.0', port=8080, proxy_headers=True, forwarded_allow_ips='*')`. The thread exits automatically with the process on Railway SIGTERM. Previous versions called `start_health_server()` from the (now deleted) `src/health.py` — the FastAPI app replaces that stdlib HTTP server and owns port 8080 exclusively, serving both the ported health endpoints and the new `/twilio/*` webhook surface.

### Key Dependencies

```
livekit-agents (==1.5.1)            — PINNED. Agent framework (AgentSession, Agent, WorkerOptions, cli)
livekit-plugins-google (git 43d3734)— PINNED. Gemini RealtimeModel (gemini-3.1-flash-live-preview support)
livekit-plugins-silero (==1.5.1)    — PINNED. ML model dep (download-files only; not imported)
livekit-plugins-turn-detector (==1.5.1)— PINNED. ML model dep (download-files only; not imported)
livekit-plugins-noise-cancellation  — BVCTelephony for SIP audio quality
livekit-api (>=1.0)                 — LiveKitAPI (egress, room, sip management)
supabase (>=2.0)                    — Database access (service-role)
fastapi (>=0.115,<1)                — FastAPI webhook server (src/webhook/app.py)
uvicorn[standard] (>=0.30,<1)       — ASGI server for FastAPI (daemon thread boot)
python-multipart (>=0.0.9,<1)       — FastAPI form parser for Twilio application/x-www-form-urlencoded webhook bodies
```

### CRITICAL: Why livekit-agents and sibling plugins are pinned to 1.5.1

The google plugin git commit `43d3734` is the ONLY version in existence that supports `session.generate_reply()` with `gemini-3.1-flash-live-preview`. It does this through an `A2A_ONLY_MODELS` branch in `generate_reply()` that uses `send_realtime_input(text=prompt)` instead of `send_client_content` (which gemini-3.1 rejects). Both PyPI `livekit-plugins-google==1.5.2` and the latest main commit explicitly disable `generate_reply()` for gemini-3.1 and raise `RealtimeError` — they removed the A2A branch when they added per-response tool support.

The pinned plugin commit constructs `llm.RealtimeCapabilities` with **6 fields**: `message_truncation`, `turn_detection`, `user_transcription`, `auto_tool_reply_generation`, `audio_output`, `manual_function_calls`. PR #5211 (merged Apr 2 2026, shipped in `livekit-agents==1.5.2` on Apr 8) added a required 7th field `per_response_tool_choice: bool` (no default) to that dataclass. With `livekit-agents==1.5.2` installed, the pinned plugin's 6-kwarg constructor raises `TypeError: RealtimeCapabilities.__init__() missing 1 required positional argument: 'per_response_tool_choice'` at `RealtimeModel.__init__` — every call dies before `session.start()`.

`livekit-plugins-silero` and `livekit-plugins-turn-detector` ship from the same monorepo with matching version numbers; their `1.5.2` wheels declare `livekit-agents>=1.5.2`, so they must be pinned to `1.5.1` in lockstep.

**Lifting the pins**: do not bump any of the three `==1.5.1` pins until LiveKit ships a google plugin release that supports both `generate_reply()` for gemini-3.1 AND the 7-field `RealtimeCapabilities`. When that happens, update the git pin first, then relax the three core pins together. The pinning rationale is duplicated in `pyproject.toml` as a comment for future maintainers.

`livekit-api`, `livekit-plugins-noise-cancellation`, and the LiveKit client SDK (`livekit==1.1.3`, transitively pinned by agents 1.5.1) are unaffected by this constraint.

**Phase 60.2 — Upgrade research (Fix J): accepted limitation.** The `_SegmentSynchronizerImpl.playback_finished called before text/audio input is done` warnings at tool-call boundaries and session-close are a known upstream limitation (livekit/agents issue #4486, OPEN since Jan 2026, no fix available). Commit `3e51d8e` (2026-04-11) on the google plugin was investigated as a candidate upgrade but cannot advance the pin — it restructures `RealtimeCapabilities` and ambiguously changes `generate_reply()` compatibility for `gemini-3.1-flash-live-preview`, risking silent breakage of the greeting and intake-injection paths. Phase 60.2 Fix G (server-VAD `silence_duration_ms` raised 1000→1500ms) is the mitigation that shipped and carried the phase through UAT; Fix H (a deterministic runtime filler via `context.session.say()`) was implemented and reverted — see the "Phase 60.2 — Fix H reverted" note in section 5 for why. Re-evaluate the upgrade when upstream closes #4486 OR when a Railway preview environment can be stood up to test a post-`3e51d8e` pin end-to-end.

### Deployment

- **Runtime**: Railway (Python 3.12)
- **Dockerfile**: `python:3.12-slim`, installs deps via pip, pre-downloads ML models, runs `python -m src.agent start`
- **Entry**: `cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, agent_name="voco-voice-agent"))`

---

## 2. SIP Configuration

Three JSON config files in the agent repo define the SIP routing:

### Inbound Trunk (`sip-inbound-trunk.json`)
- **Allowed addresses**: Twilio media server IP ranges (global)
- **Krisp**: Noise cancellation enabled for call audio quality
- **Numbers**: Empty array — all Twilio numbers routed via the Elastic SIP trunk

### Outbound Trunk (`sip-outbound-trunk.json`)
- Used for test calls (LiveKit -> Twilio -> owner's phone)
- Credentials are environment-specific

### Dispatch Rule (`sip-dispatch-rule.json`)
- `dispatchRuleIndividual` with `roomPrefix: "call-"`
- `roomConfig.agents` with `agentName: "voco-voice-agent"`
- Each inbound call creates a unique room

---

## 3. Gemini Live Session

**File**: `src/agent.py`

### Model Configuration

```python
realtime_input_config = genai_types.RealtimeInputConfig(
    automatic_activity_detection=genai_types.AutomaticActivityDetection(
        start_of_speech_sensitivity=genai_types.StartSensitivity.START_SENSITIVITY_LOW,
        end_of_speech_sensitivity=genai_types.EndSensitivity.END_SENSITIVITY_LOW,
        prefix_padding_ms=400,
        silence_duration_ms=1500,  # phase 60.2 Fix G (was 1000 in phase 55 999.2 fix)
    ),
)

model = google.realtime.RealtimeModel(
    model="gemini-3.1-flash-live-preview",
    voice=voice_name,
    temperature=0.3,
    instructions=system_prompt,
    realtime_input_config=realtime_input_config,
    thinking_config=genai_types.ThinkingConfig(
        thinking_level="minimal",
        include_thoughts=False,
    ),
)
```

### VAD Tuning — Gemini Server-Side Activity Detection (backlog 999.2 fix)

The pinned `livekit-plugins-google` commit exposes the full Gemini `RealtimeInputConfig` via the `realtime_input_config=` kwarg on `RealtimeModel`. With the default (`START_SENSITIVITY_HIGH` / `END_SENSITIVITY_HIGH`, ~20ms prefix padding), Gemini's server VAD fires on caller breaths and minor overlap, and each false positive cancels the current response — including any in-flight tool calls. Symptoms during Phase 55 UAT: `server cancelled tool calls` warnings, AI voice cutting off mid-sentence, and the `_SegmentSynchronizerImpl.playback_finished called before text/audio input is done` warning. Root cause tracked upstream as livekit/agents#4441.

Our config dampens server VAD so only deliberate caller speech triggers interruption:
- `START_SENSITIVITY_LOW` + `prefix_padding_ms=400` — caller must speak ~400ms of sustained audio before barge-in fires.
- `END_SENSITIVITY_LOW` + `silence_duration_ms=1500` — the server waits 1.5s of silence before treating the caller's turn as finished.

**Phase 60.2 Fix G (shipped)** raised `silence_duration_ms` from `1000` → `1500`. The earlier 1000ms threshold still produced 2 `server cancelled tool calls` warnings per call (the UAT on 2026-04-19 15:32Z captured filler audio truncated mid-sentence around `book_appointment` and `check_availability`, plus an `idempotent re-invocation` cancel/retry loop). 1500ms reduced that to 0 cancellations on the post-fix UAT call (2026-04-20, Persona 1, 226s) with no mid-sentence cuts at tool boundaries. Citations: upstream livekit/agents issues #4441 ("Spurious Server VAD events cause unavoidable tool cancellation") and #4486 ("Agent audio cuts off after one word"); see section 1 Fix J note for why a plugin upgrade was not the answer. Tradeoff: deliberate caller barge-in now requires ~1.5s of sustained speech rather than ~1s — acceptable for the common case.

Do **not** switch to `activity_handling=NO_INTERRUPTION` — that kills barge-in entirely, and callers need to be able to cut the AI off for emergencies.

### Voice Resolution (Phase 44: AI Voice Selection)

Voice name is resolved via a two-step priority check:

```python
# Use explicitly selected voice if set, else fall back to tone-based mapping (Phase 44: AI Voice Selection)
ai_voice = tenant.get("ai_voice") if tenant else None
voice_name = ai_voice if ai_voice else VOICE_MAP.get(tone_preset, "Kore")
```

1. **`tenant.ai_voice`** (explicit user selection): checked first. Set via `PATCH /api/ai-voice-settings` in the Next.js app and stored in `tenants.ai_voice` (varchar, nullable). Read by the agent at call time.
2. **`VOICE_MAP[tone_preset]`** fallback: used when `ai_voice` is NULL (tenant has not explicitly chosen a voice).
3. **`"Kore"`**: final default if both are missing.

### Voice Map (tone_preset -> Gemini voice)

| `tone_preset` | Voice | Character |
|----------------|-------|-----------|
| `professional` | Zephyr | Clear and measured |
| `friendly` | Aoede | Upbeat and warm |
| `local_expert` | Achird | Relaxed and neighborly |

### Available Voices for Selection (Phase 44)

6 curated Gemini voices available in the AI Voice Settings dashboard:

| Voice | Style |
|-------|-------|
| Aoede | Warm and friendly |
| Erinome | Calm and clear |
| Sulafat | Smooth and professional |
| Zephyr | Clear and measured |
| Achird | Relaxed and neighborly |
| Charon | Deep and authoritative |

Voice names are stored in DB with exact Gemini capitalization (e.g., `Aoede` not `aoede`). The `tenants.ai_voice` column has a CHECK constraint enforcing only these 6 values or NULL.

### Session Architecture

```python
agent = VocoAgent(instructions=system_prompt, tools=tools)
session = AgentSession(llm=model)
await session.start(agent=agent, room=ctx.room, room_options=...)
```

- **Native audio-to-audio**: Gemini processes audio directly — no separate STT/TTS pipeline
- **Server VAD**: Uses Gemini's built-in voice activity detection (client-side VAD disabled to prevent echo/self-interruption)
- **Minimal thinking**: `thinking_level="minimal"` for lowest latency
- **Noise cancellation**: `BVCTelephony` for SIP calls, `BVC` for WebRTC
- **Greeting**: `session.generate_reply(instructions="Greet the caller now.")` called immediately after `session.start()` — DB queries run in background

### Non-Blocking I/O Pattern

All synchronous Supabase calls are wrapped with `asyncio.to_thread()` to prevent blocking the audio event loop:

```python
response = await asyncio.to_thread(
    lambda: supabase.table("tenants").select("*").eq("id", tenant_id).single().execute()
)
```

Parallel queries use `asyncio.gather()`:

```python
appointments, events, zones, buffers = await asyncio.gather(
    asyncio.to_thread(lambda: supabase.table("appointments")...execute()),
    asyncio.to_thread(lambda: supabase.table("calendar_events")...execute()),
    asyncio.to_thread(lambda: supabase.table("service_zones")...execute()),
    asyncio.to_thread(lambda: supabase.table("zone_travel_buffers")...execute()),
)
```

---

## 4. System Prompt

**File**: `src/prompt.py`

### `build_system_prompt(locale, *, business_name, onboarding_complete, tone_preset, intake_questions, country, working_hours, tenant_timezone)`

The prompt is assembled from modular section builder functions. Conditional sections are filtered via list comprehension.

### Section Order

1. **Identity** — role, tone, conciseness rule
2. **Voice Behavior** — outcome-oriented guidance: match caller energy, slow down on readbacks, one focused question at a time with brief acknowledgment, announce before tool calls. Trimmed of redundant instructions that Gemini's server VAD already handles (don't-talk-over, let-caller-finish).
3. **Corrections** — top-level section with strong language and concrete example. When the caller corrects any information, the correction ALWAYS replaces the old value entirely. The AI must never read back or reference the old incorrect value.
4. **Business Hours** — computed from `working_hours` JSON. Groups consecutive days with the same schedule (e.g., "Mon-Fri: 9:00 AM - 5:00 PM"). Includes lunch breaks. Instructs AI to use these hours when asked, never guess. Empty if `working_hours` is None.
5. **Opening Line** — greeting with business name + recording disclosure. Echo awareness.
6. **Language** — compressed to 2 paragraphs. Default English. Switch only on explicit caller request to one of: English, Spanish, Chinese (Mandarin), Malay, Tamil, Vietnamese. Continue from where you left off without re-asking. Unclear speech treated as connection issue, not language barrier. Gather info in best-effort language for unsupported requests.
7. **Repeat Caller** — empty (all calls treated as new — never reveal prior history)
8. **Info Gathering** — outcome-framed. Three things needed before scheduling: caller's issue, name, and complete service address. Order is NOT forced — adapts to whatever the caller volunteers first. **NAME USE DURING THE CALL (Phase 60, D-01..D-05)**: capture silently for records; no name vocative mid-call (no "Thanks, {name}" or "Okay {name}"); single on-air name-confirmation is the booking readback; caller-invited override path (e.g. "you can call me X", "I go by X"); no-name path never blocks booking; cultural-awareness rules (accept romanized names like "Jia En") preserved. **SERVICE ADDRESS (Phase 60, D-06..D-08)**: single-question opener `"What's the address where you need the service?"` replaces the old three-part walkthrough; one targeted follow-up per missing piece (never a field list on-air); outcome-framed minimum capture — "enough for us to find the place." Phase 60 removed the old VERIFICATION subsection (which prescribed per-field readbacks) — the single authoritative verification now lives in the booking section's READBACK block (item 10). URGENCY: silent classification, never ask caller to rate, never use the words "emergency/urgent/routine" out loud. Emergency examples: flooding, gas smells, no heat in cold weather, electrical sparks, sewage backup.
9. **Intake Questions** — trade-specific questions asked naturally (injected via `session.generate_reply` after DB query completes)
10. **Booking Protocol** — restructured into hard rules vs. soft guidance:
    - **SCHEDULING**: only after name + issue + confirmed address; only upcoming dates/times; needs both day AND time
    - **AVAILABILITY RULES (non-negotiable)**: every new date/time requires a fresh `check_availability` call (never rely on earlier results); never read out or list available slot times
    - **HANDLING THE RESULT**: book if available; offer 2-3 nearest alternatives if not; try another day if current is full; capture lead if fully booked; quote requests framed as visits
    - **BEFORE BOOKING — READBACK (mandatory, Phase 60, D-02/D-09/D-10)**: read the caller's name (if captured) and the full service address in **one utterance** — the single authoritative verification moment for both. Order: name first, then address. Accept-and-re-read correction loop referencing the existing CORRECTIONS rule ("the caller's correction is ALWAYS correct"): accept → re-read full corrected line → if they correct again, loop until they stop. If no name was captured, read back only the address. Call `book_appointment` only after the caller acknowledges (silence or explicit "yes"/"that's right" counts).
    - **AFTER BOOKING**: confirm full details, ask if anything else
11. **Decline Handling** — only injected when `onboarding_complete=True`. Judgment-based (not a two-strike counter): if the caller hesitates, try once more with a different angle; if they firmly refuse, capture lead and wrap up. Silence, topic changes, and thinking pauses are NOT declines.
12. **Transfer Rules** — only 2 triggers: caller asks for human, or 3 failed clarifications. **Transfer recovery**: if the transfer fails, AI offers to book a callback appointment instead; if the caller declines, captures their info as a lead for follow-up. If no transfer number is available, AI takes the caller's info and promises someone will reach out.
13. **Call Duration** — 9-minute wrap-up warning, 10-minute hard max. Goal-oriented end-call: farewell must be fully heard before disconnect, two separate steps (speak goodbye, then call end_call after pause)

### Phase 60: Name-vocative suppression + single-question address intake (D-01..D-10)

The caller's name is captured silently for records and is **never spoken back to the caller mid-call** — no "Thanks, {name}", no "Okay {name}". The booking readback is the single on-air name-confirmation moment. Callers may explicitly invite name use ("you can call me X", "I go by X"); the AI uses judgment, not a keyword match. Service address intake opens with a single natural question — `"What's the address where you need the service?"` — replacing the old three-part walkthrough; missing pieces are collected one targeted follow-up at a time, never a field list on-air. Before `book_appointment` fires, the AI reads back the caller's name (if captured) and full service address in **one utterance** and loops accept-and-re-read until the caller stops correcting. If no name was captured, the readback is address-only and booking still completes. See D-01..D-10 in `.planning/phases/60-voice-prompt-polish-*/60-CONTEXT.md`.



Both files contain two top-level sections:
- `agent.*` — recording_disclosure, language_clarification, capture_name, etc.
- `notifications.*` — booking_confirmation, recovery_sms_attempted_routine, recovery_sms_attempted_emergency

**Inline locale-conditional prompt blocks (Phase 60)**: The three Phase 60 blocks (NAME USE DURING THE CALL, SERVICE ADDRESS, BEFORE BOOKING — READBACK) are NOT driven from `messages/*.json`. They live as inline literals in `_build_info_gathering_section` and `_build_booking_section` under `if locale == "es"` conditionals. Spanish text is idiomatic (usted register, D-13/D-14 user-approved). Pre-existing Phase 30 sections (intro paragraphs, URGENCY, SCHEDULING, AVAILABILITY RULES, HANDLING THE RESULT, AFTER BOOKING) remain English-only regardless of locale — this is an intentional pre-existing structural gap that Phase 60 did NOT retroactively fix (Pitfall 4). Spanish callers get Spanish for the three new blocks + English instructions to the model for the rest.

---

## 5. Tools

**Registry**: `src/tools/__init__.py`

### Tool Registration

```python
# Always available:
transfer_call, capture_lead, check_caller_history, end_call

# Only when onboarding_complete:
check_availability, book_appointment
```

All tools execute **in-process** with direct Supabase access — no webhook round-trips. Tools are created via factory functions that return `@function_tool` decorated callables, capturing a `deps` dict via closure. All blocking calls within tools use `asyncio.to_thread()`.

### `check_caller_history` — Repeat Caller Awareness (Silent Context)

**File**: `src/tools/check_caller_history.py`

- Parallel query: leads (3 most recent) + appointments (3 upcoming) via `asyncio.gather()`
- **Return format (Phase 60, D-16)**: `STATE:<code> [key=value ...] | DIRECTIVE:<imperative>` — machine-facing, every directive ends with "Do not repeat this message text on-air."
- State codes:
  - `STATE:repeat_caller prior_appointments=N prior_leads=N` (+ CONTEXT block) — directive: use silently to personalize follow-up questions, do not recite history, do not say we have their info on file, ask every question as if first-time
  - `STATE:first_time_caller` — directive: proceed with normal intake, do not mention the caller is new
  - `STATE:history_lookup_failed` (covers 3 error paths: missing tenant/from_number, tenant fetch exception, history fetch exception) — directive: proceed with normal intake, do not apologize or mention failure
- Silent-context discipline preserved: 5 instances of "do not recite" across directives

### `check_availability` — Real-Time Slot Query

**File**: `src/tools/check_availability.py`

- Parameters: `date` (optional YYYY-MM-DD), `time` (optional HH:MM 24h format), `urgency` (optional)
- **Past-date validation**: rejects dates before today in tenant timezone with a natural message
- **Minimum buffer**: rejects times within the next 1 hour for today's date
- Fetches tenant config + 4 scheduling tables in parallel via `asyncio.gather()`
- Calculates slots using `calculate_available_slots()` with `max_slots=50` (effectively unlimited)
- **Specific time check**: when both `date` and `time` provided, checks if that exact slot is available. Returns "Yes, X is available" with start/end for booking, or no + up to 3 closest alternatives.
- **General check**: when only `date` (or neither), returns a **confirmation only** — no specific times, no earliest/latest anchors, no slot count. The return explicitly instructs the AI that no slot has been verified yet and that the caller must name a concrete hour before any slot can be confirmed. Range queries like "afternoon" or "morning" are explicitly handled in the return text (telling the AI to ask the caller for a specific hour).
- Tool description forbids picking a time on the caller's behalf for vague windows; the AI must ask the caller for a concrete hour before calling the tool with a `time` argument
- Tool description instructs AI to call this for every time the caller asks about — never rely on cached results, and never answer about a different time based on an earlier check (e.g., if 2pm was verified, a question about 3pm still requires a fresh call)
- **Return format (Phase 60, D-16)**: all 10 return branches rewritten to `STATE:<code> [key=value ...] | DIRECTIVE:<imperative>` — machine-facing, no speakable English. State codes: `availability_lookup_failed` (3 variants: no_tenant, tenant_config_error, scheduling_data_error), `date_in_past`, `requested_time_too_soon`, `slot_available` (carries `start=ISO end=ISO speech=<pre-formatted>` for `book_appointment`), `slot_not_available` (with inline ALTERNATIVES list), `no_slots_available` (2 variants), `slots_available_unverified` (day-level confirmation with no specific times leaked). Directives reinforce "do not read the full slots list out loud" (×2), "do not fabricate times" (×3) — the prior parrot-loop fix generalized.

### `book_appointment` — Atomic Slot Booking

**File**: `src/tools/book_appointment.py`

- Parameters: `slot_start`, `slot_end`, `street_name`, `postal_code`, `caller_name`, `unit_number` (optional), `urgency` (default "routine", must be one of `emergency`/`urgent`/`routine`)
- **Urgency normalization**: `_normalize_urgency()` at the top of the module maps freeform Gemini output (e.g. `"high"` → `"urgent"`, `"low"`/`"normal"` → `"routine"`, `"critical"`/`"asap"` → `"emergency"`) to the three values accepted by `appointments_urgency_check`. Unknown values fall back to `"routine"`. Fix for backlog 999.1 after Phase 55 UAT call raised `appointments_urgency_check` with `urgency='high'`. Tool description also enumerates the allowed values so Gemini stops inventing new ones.
- **Idempotency cache**: at the top of the function (after parameter validation), checks `deps["_last_booked_slot_key"]` against `f"{slot_start}|{slot_end}"`. On cache hit, returns the cached response immediately without re-running the booking. Prevents duplicate side effects when Gemini invokes the tool twice for the same slot.
- Calls `atomic_book_slot()` via Supabase RPC
- **On success**: booking_outcome='booked' written IMMEDIATELY (before side effects). Then `return_msg` is computed and **cached in deps BEFORE firing background tasks**. Calendar push and caller SMS are fired as **truly** non-blocking `asyncio.create_task()` (previously the `fire-and-forget` comments were inaccurate — both were awaited, blocking the tool for 1-4s). The tool now returns in ~300ms, eliminating the silence window that was triggering duplicate invocations.
- **On slot taken**: BEFORE recalculating alternatives, checks `deps["_last_booked_slot_key"]` — if a prior successful booking has cached a response, this is a late duplicate invocation, so the cached success response is returned and **no recovery SMS is fired**. Otherwise: recalculates next available (parallel queries), writes booking_outcome='attempted' (conditional on null so it never overwrites 'booked'), sends recovery SMS as `asyncio.create_task()`.
- Recovery SMS tracks pending/sent/retrying status in calls table
- The idempotency cache and slot_taken guard together eliminate the double-booking race where the AI would invoke the tool twice and cause a spurious "slot was just taken" response + recovery SMS on an already-booked call.
- **Return format (Phase 60, D-11/D-12/D-16)**: all 4 return branches rewritten to `STATE:<code> [key=value ...] | DIRECTIVE:<imperative>`. State codes: `STATE:booking_succeeded appointment_id=...`, `STATE:slot_taken`, `STATE:booking_invalid reason=<snake_case>`, `STATE:booking_failed reason=rpc_error`. Directive on success tells the model to confirm verbally using the name+address already read back (no time restatement — the caller heard it at slot offer). Phase 46 `deps["_booking_succeeded"]`, `deps["_booked_appointment_id"]`, `deps["_booked_caller_name"]` stamping preserved.
- **Description reinforces (Phase 60, D-12)**: CRITICAL PRECONDITION — readback-before-call. Do not call this tool until the name+address readback is complete. "Tool's return is a state+directive string — do not read it aloud."

### `capture_lead` — Lead Capture on Decline

**File**: `src/tools/capture_lead.py`

- Parameters: `caller_name` (required), `phone`, `street_name`, `unit_number`, `postal_code`, `job_type`, `notes` (optional)
- Computes mid-call duration from `start_timestamp` (milliseconds)
- Calls `create_or_merge_lead()`, writes booking_outcome='declined'
- **Return format (Phase 60, D-16)**: `STATE:<code> [key=value ...] | DIRECTIVE:<imperative>`. State codes: `lead_captured lead_id=...`, `lead_invalid`, `lead_failed`.
- **Description reinforced to parity with book_appointment (Phase 60, D-11)**: references the same **single-question address rule** as the booking path — one natural question ("What's the address where you need the service?"), loop one targeted follow-up at a time, capture enough to find the place. Also reinforces the readback-before-call precondition (same rule as book_appointment). "Tool's return is a state+directive string — do not read it aloud."

### `transfer_call` — SIP REFER Transfer

**File**: `src/tools/transfer_call.py`

- Parameters: `caller_name`, `job_type`, `urgency`, `summary`, `reason` (all optional)
- Writes `exception_reason` to calls record
- Performs SIP REFER via `LiveKitAPI().sip.transfer_sip_participant()`
- Destination: `sip:{ownerPhone}@pstn.twilio.com`
- **Return format (Phase 60, D-16)**: Phase 30 state code *names* preserved exactly (`transfer_initiated`, `transfer_failed`, `transfer_unavailable`) but now wrapped in the canonical `STATE:<code> [reason=...] | DIRECTIVE:<imperative>` envelope with terminating "Do not repeat this message text on-air." Directive per state: `transfer_initiated` → tell caller you're connecting them now, one sentence; `transfer_failed reason=sip_error` → apologize briefly, offer callback via book_appointment or capture_lead, do not retry transfer in this call; `transfer_unavailable` → tell caller nobody is available, offer appointment or callback.

### `end_call` — Graceful Termination

**File**: `src/tools/end_call.py`

- Returns a space character immediately
- After 12-second `asyncio.sleep()`: removes SIP participant via `LiveKitAPI().room.remove_participant()`
- After removing participant, calls `ctx.shutdown()` to disconnect the agent from the room, which triggers session close and the post-call pipeline
- Delay allows farewell audio to play through SIP buffering before disconnection

### Phase 60.2 — Pre-tool filler: Fix H reverted (accepted limitation)

**What was attempted.** Phase 60.2 Plan 03 implemented a deterministic runtime filler inside the 4 scoped tools (`check_availability`, `book_appointment`, `capture_lead`, `transfer_call` — NOT `check_caller_history` which is silent-context, NOT `check_customer_account` which is pre-session data, NOT `end_call` whose return is a space character). Each tool rotated through 2-3 `_FILLER_PHRASES` using a per-session deps-scoped counter (e.g. `deps["_filler_idx_check_availability"]`, NOT a module-level `global _filler_idx` — concurrent calls on one Railway worker would share module state and desync rotation) and awaited `context.session.say(phrase, allow_interruptions=False)` as the first line of the tool body, wrapped in a try/except that logged and continued so filler audio failure never blocked tool execution. Plan 04 updated `_build_tool_narration_section()` in `src/prompt.py` to tell Gemini "the tool runtime plays a filler automatically — do not speak your own filler."

**Why it was reverted.** The Phase 60.2 Plan 05 UAT (Persona 1, 226s call on 2026-04-20) exposed that `session.say()` is **unusable on an `AgentSession(llm=RealtimeModel)` in livekit-agents 1.5.1**. Every filler attempt raised `RuntimeError: trying to generate speech from text without a TTS model` — Railway logs captured three of them (2× from `check_availability`, 1× from `book_appointment`) on that one call. Root cause: `session.say()` requires a TTS to be attached to the session; our session is wired as `AgentSession(llm=RealtimeModel)` with no separate TTS because Gemini Live emits audio directly. The try/except swallowed the error, the caller heard silence, and the "runtime plays filler" prompt claim was a silent lie. Fix G alone (VAD 1500ms) still passed all 7 UAT gates, so Fix H was dropped rather than repaired — repairing would require attaching a non-Gemini TTS (Google, Cartesia, ElevenLabs) which introduces voice mismatch against Gemini's native speaker identity for a 1-3s filler. Commit `cbe1bb9` in the livekit-agent repo removed the `_FILLER_PHRASES` arrays, deps-scoped rotation counters, and `await context.session.say(...)` calls from all 4 tools; restored `_build_tool_narration_section()` to its pre-Plan-04 content (Gemini speaks its own filler again via prompt-driven prose); deleted `tests/test_filler_audio.py`; and inverted `tests/test_prompt.py` to guard against re-landing a broken runtime-filler claim. Also relevant: livekit-agents 1.5.1 `agent_activity.py:905-914` silently downgrades `allow_interruptions=False` to `NOT_GIVEN` whenever the underlying LLM is a `RealtimeModel` with server-side turn detection — so even if `session.say()` had worked, the kwarg would have been dropped; the real un-interruption lever is Fix G's 1500ms `silence_duration_ms`.

**Accepted limitation (Fix J sibling).** Do not reintroduce `session.say()` on this session shape without first attaching a TTS and accepting the voice-mismatch tradeoff, or without switching to an alternate audio source (pre-recorded audio track, separate LiveKit publisher). The tool-boundary race is now handled purely by Fix G's VAD tuning; pre-tool filler is back to being prompt-driven prose in `_build_tool_narration_section()`. If a future phase wants deterministic per-tool audio, the path is: (a) attach a secondary TTS plugin to the session, or (b) pre-render filler WAVs and publish via a separate `rtc.AudioSource` bypassing `AgentSession.say()` entirely.

**Open for Phase 60.3.** UAT also surfaced a goodbye cut-off ("Thank you for calling" → audio truncation → silence → caller hangs up) that is a **different race class** from the tool-call race Fix G addresses — it's end-of-call turn timing between the model's goodbye speech and either `end_call` tool invocation, an ambient-noise VAD trigger, or model self-termination. Needs diagnostic instrumentation (`end_call` invocation timing + last-text-token timestamp logs) before a fix can be chosen; existing `prompt.py:562-567` goodbye-protection and `end_call` tool description already contain the correct rule and Gemini ignored it on this call. Also deferred to 60.3: a Gemini 3.1 Flash Live + livekit-agents 1.5.1 + `livekit-plugins-google @ 43d3734` prompt-best-practices audit of the full `build_system_prompt()`. Fix I (post-call pipeline 8s timeout) **self-resolved** on the 60.2 post-fix UAT — pipeline completed ~12s after session close without the timeout firing, no code change needed; keep monitoring in 60.3 UAT.

---

## 6. Post-Call Pipeline

**File**: `src/post_call.py`

Runs immediately when the AgentSession closes (in-process, no webhook delay).

### `run_post_call_pipeline(params)`

Params include the usual call/tenant fields plus three **booking-reconciliation flags** stamped by `book_appointment` on the shared `deps` dict:

- `booking_succeeded: bool` — `True` iff `atomic_book_slot` returned success during the call.
- `booked_appointment_id: str | None` — the appointment PK the RPC returned.
- `booked_caller_name: str | None` — the verified name the AI passed to `book_appointment` (which is a required tool parameter).

`agent.py:_on_close_async` forwards these through to `run_post_call_pipeline` via the params dict. They exist to close a race where the mid-call `.update({"booking_outcome":"booked"}).eq("call_id", …)` in `book_appointment` can match zero rows — the background `_run_db_queries` task may not have inserted the calls row yet when the AI books.

1. **Build transcript** — `transcript_text` (string) + `transcript_structured` (JSON list)
2. **Update call record** — status='analyzed', transcript, recording path, disconnection_reason
2b. **Booking reconciliation** (section 2b in the file) — if `booking_succeeded`, force `calls.booking_outcome='booked'` (unconditional update at this point — the calls row is guaranteed to exist because `_on_close_async` awaits `db_task` before calling the pipeline), and backfill `appointments.call_id = call_uuid` for the returned `booked_appointment_id` with `.is_("call_id", "null")` guard (safe to re-run, no-op if already set). `booking_outcome` local variable is then derived as `"booked" if booking_succeeded else updated_call.get("booking_outcome")` so the suggested-slots gate (step 7) and appointment lookup (step 9) see the corrected value.
3. **Test call auto-cancel** — cancel appointment + reset lead if `is_test_call` (now also benefits from the backfill — the `.eq("call_id", call_uuid)` lookup at line 79–87 now finds race-affected appointments).
4. **Usage tracking** — `increment_calls_used` RPC; Stripe overage if limit_exceeded
5. **Language detection** — multi-language regex detection: CJK→'zh', Tamil Unicode→'ta', Vietnamese diacriticals (>=3)→'vi', Spanish keywords (>=2)→'es', Malay keywords (>=2)→'ms', default→'en'
6. **Triage classification** — `classify_call()` three-layer pipeline
7. **Suggested slots** — for unbooked calls, up to 3 slots spread across the next 3 days (tomorrow through day+3)
8. **Update call with triage** — urgency, confidence, layer, language, notification_priority. Then the NULL-fallback sets `booking_outcome='not_attempted'` only where still NULL (genuine no-booking calls).
9. **Create/merge lead** — if duration >= 15s, via `create_or_merge_lead()`. Caller name resolution: `booked_caller_name or _extract_field_from_transcript(turns, "name")` — the booking tool's verified name wins over regex extraction. Appointment lookup: `booked_appointment_id` preferred over FK query (avoids the `appointments.call_id` FK being NULL on race-affected calls).
10. **Owner notifications** — SMS/email per outcome preferences, emergency always sends both. **`send_owner_sms` accepts `from_number`** and is called with `from_number=to_number` (the tenant's own Twilio number — same pattern as `send_caller_sms`/`send_caller_recovery_sms`). Environment var `TWILIO_FROM_NUMBER` is retained as a fallback but multi-tenant deployments should never rely on it — each tenant has their own provisioned number.

### Transcript Field Extraction Fallback

`post_call.py::_extract_field_from_transcript(turns, field)` is a best-effort regex used ONLY when the relevant tool wasn't invoked (e.g. `booked_caller_name` is None). The name branch uses explicit case-insensitive trigger alternation and post-match capitalization enforcement (because `re.IGNORECASE` nullifies `[A-Z]` inside the capture group):

```python
patterns = [r"(?:my name is|this is|i'm|i am|it's|name'?s)\s+(\w+(?:\s+\w+)?)"]
# ... match with re.IGNORECASE ...
if not name or not name[0].isupper(): continue  # proper-noun heuristic
# plus blocklist: {"here","there","calling","sorry","raining","cold","hot",
#                  "just","trying","looking","about","a","the","an","ok",...}
```

This regex previously captured garbage like "Raining" from "it's raining outside" because the blocklist was tiny and `re.IGNORECASE` defeated the capitalization guard. Do not reintroduce `[A-Z]` inside the capture group — keep the post-match `isupper()` check.

---

## 7. Triage System

**Directory**: `src/lib/triage/`

Three-layer pipeline. Layer 3 can only ESCALATE, never downgrade. Urgency values validated to `{emergency, routine, urgent}`.

### Layer 1 — Keywords (`layer1_keywords.py`)
Synchronous regex matching. Routine patterns checked FIRST (prevents "not urgent" from matching emergency "urgent").

### Layer 2 — LLM (`layer2_llm.py`)
Only called when Layer 1 is NOT confident. Uses Groq with Llama 4 Scout via AsyncOpenAI, JSON mode, temperature 0, 5s timeout.

### Layer 3 — Owner Rules (`layer3_rules.py`)
Always runs as final step. Queries tenant's services for urgency_tag. Matches detected service, applies escalation if higher severity.

---

## 8. Recording & Transcripts

### Recording — LiveKit Egress

```python
await lk.egress.start_room_composite_egress(
    api.RoomCompositeEgressRequest(
        room_name=call_id,
        audio_only=True,
        file_outputs=[api.EncodedFileOutput(
            file_type=api.EncodedFileType.OGG,
            filepath=f"{tenant_id}/{call_id}.ogg",
            s3=api.S3Upload(...)
        )],
    )
)
```

- **Storage**: Supabase Storage -> `call-recordings` bucket via S3 protocol
- **Format**: OGG (audio-only)
- **Path**: `{tenant_id}/{call_id}.ogg`
- **Early path persistence**: `recording_storage_path` is written to the calls table at egress start (if `call_uuid` is populated), not just in the post-call pipeline. This is a safety net so the dashboard can find recordings even if post-call fails.
- **Lifecycle**: starts as a background task after session.start(), waits for DB task first (to get call_uuid), stops on session close

### Transcripts

Collected via `conversation_item_added` session events. Stored as both `transcript_text` (string) and `transcript_structured` (JSONB array of `{role, content}`).

---

## 9. Environment Variables

### Agent Service (Railway)

| Variable | Purpose |
|---|---|
| `LIVEKIT_URL` | LiveKit Cloud WebSocket URL (wss://...) |
| `LIVEKIT_API_KEY` | LiveKit API authentication |
| `LIVEKIT_API_SECRET` | LiveKit API authentication |
| `GOOGLE_API_KEY` | Gemini 3.1 Flash Live API key |
| `SUPABASE_S3_ACCESS_KEY` | Supabase Storage S3 access |
| `SUPABASE_S3_SECRET_KEY` | Supabase Storage S3 secret |
| `SUPABASE_S3_ENDPOINT` | Supabase Storage S3 endpoint URL |
| `SUPABASE_S3_REGION` | Supabase Storage region |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key (bypasses RLS) |
| `TWILIO_ACCOUNT_SID` | Twilio SMS auth |
| `TWILIO_AUTH_TOKEN` | Twilio SMS auth |
| `TWILIO_FROM_NUMBER` | Twilio SMS sender number |
| `RESEND_API_KEY` | Resend email API |
| `RESEND_FROM_EMAIL` | Resend sender address (default: alerts@voco.live) |
| `GROQ_API_KEY` | Groq API for Layer 2 triage (Llama 4 Scout) |
| `GOOGLE_CLIENT_ID` | Google OAuth (calendar sync) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth (calendar sync) |
| `STRIPE_SECRET_KEY` | Stripe API for overage billing |
| `NEXT_PUBLIC_APP_URL` | Base URL for dashboard links in notifications |
| `SENTRY_DSN` | Sentry error tracking |
| `ALLOW_UNSIGNED_WEBHOOKS` | Dev/staging only — bypass Twilio signature verification for `src/webhook/*` routes. Never set in production. Fail-closed default (signature enforced when unset). |
| `LIVEKIT_SIP_URI` | SIP URI used in AI TwiML responses (`<Dial><Sip>{LIVEKIT_SIP_URI}</Sip></Dial>`) for both direct AI routing and dial-fallback. Defaults to `sip:voco@sip.livekit.cloud` placeholder if unset. |

### Main Repo (Vercel)

| Variable | Purpose |
|---|---|
| `RAILWAY_WEBHOOK_URL` | Base URL of the Railway webhook service (e.g., `https://livekitagent-production.up.railway.app`). Used by `provisionPhoneNumber` to set `voice_url` (`{base}/twilio/incoming-call`), `voice_fallback_url` (`{base}/twilio/dial-fallback`), and `sms_url` (`{base}/twilio/incoming-sms`) on new Twilio numbers. If unset, numbers use SIP trunk routing only (warning logged). Also used by `scripts/cutover-existing-numbers.js` for existing number migration. |

---

## 10. Key Design Decisions

- **Python 3.12 + LiveKit Agents SDK**: Replaced Node.js agent. Python SDK is LiveKit's primary SDK with faster updates and native Gemini 3.1 support (via PR#5238).
- **Gemini 3.1 Flash Live**: Native audio-to-audio model. No separate STT/TTS pipeline. Minimal thinking for lowest latency.
- **Server VAD only**: Client-side Silero VAD was removed — it caused `commit_audio` errors and self-interruption on SIP calls. Gemini's native server VAD handles turn detection and echo cancellation.
- **asyncio.to_thread() everywhere**: All synchronous Supabase, Twilio, Resend, Stripe, and Google Calendar calls run in thread pools to prevent blocking audio processing.
- **asyncio.gather() for parallel queries**: Independent DB queries (appointments, events, zones, buffers) run concurrently for reduced latency.
- **In-process tool execution**: All 6 tools run directly in the agent process with direct Supabase access — zero webhook round-trips.
- **Single post-call pipeline**: Combines processCallEnded + processCallAnalyzed into one `run_post_call_pipeline()`.
- **Silent repeat caller context**: `check_caller_history` tool returns history but instructs AI to never mention it. AI treats all calls as new unless the caller explicitly asks about prior calls.
- **Caller-led booking flow**: AI never offers times first. Asks the caller when they prefer, checks availability after getting both day and time preference, offers alternatives if unavailable.
- **Event handlers before session.start()**: Prevents race conditions where session closes before handlers are registered.
- **`close_complete` event keeps entrypoint alive**: `entrypoint()` awaits a `close_complete` asyncio.Event at the end. The `on_close` handler's `done_callback` sets this event after `_on_close_async()` finishes. Without this, the LiveKit worker exits the process immediately after `entrypoint()` returns, killing the post-call pipeline mid-flight.
- **Greeting via generate_reply()**: `session.generate_reply(instructions="Greet the caller now.")` fires after session.start(). This relies on the git-pinned livekit-plugins-google commit (43d3734) which workarounds Gemini 3.1's restriction on `send_client_content`. The official PyPI release (1.5.1) does NOT support `generate_reply()` with Gemini 3.1 — do not switch to the stable release until LiveKit ships an official fix.
- **Noise cancellation**: `BVCTelephony` for SIP calls, `BVC` for WebRTC — improves audio quality without interfering with VAD.
- **Atomic booking via Postgres advisory locks**: `book_appointment_atomic` RPC with `tstzrange` overlap checking.
- **booking_outcome written before side effects**: The `booking_outcome='booked'` write happens immediately after the booking RPC succeeds, before calendar push or SMS. This ensures the outcome persists even if the caller hangs up during side effects.
- **end_call triggers ctx.shutdown()**: After removing the SIP participant, `ctx.shutdown()` disconnects the agent from the room, which cascades into session close → post-call pipeline. Without this, the agent stays in the room and post-call never runs.
- **Past-date validation**: check_availability rejects past dates. slot_calculator returns [] if the entire working window is past. 1-hour minimum buffer for today's slots.
- **recording_storage_path written at egress start**: Safety net — the path is written to the calls table when egress starts, not just in the post-call pipeline. Ensures the dashboard can find recordings even if post-call fails.
- **Triage never downgrades**: Layer 3 can only escalate urgency.
- **Fail-open design**: Missing tenant, slots, or subscription errors don't block calls.
- **Phone number normalization**: `_normalize_phone()` in `agent.py` strips `sip:`/`tel:` prefixes, `@domain` suffixes, and ensures `+` E.164 prefix before tenant lookup. LiveKit SIP attributes may include these prefixes depending on the trunk configuration.
- **Test call metadata fallback**: For outbound test calls, `sip.trunkPhoneNumber` doesn't contain the tenant's number (it's the outbound trunk's FROM number). The agent reads `to_number` from room metadata (set by test-call route) as a fallback.
- **Business hours in system prompt**: Working hours JSON is formatted into a grouped schedule (e.g., "Mon-Fri: 9:00 AM - 5:00 PM") and included in the system prompt so the AI can answer "what are your hours?" accurately instead of hallucinating.
- **Corrections as top-level prompt section**: Corrections are a standalone section placed after Voice Behavior with strong language and a concrete example, rather than a paragraph buried in Info Gathering. This gives it higher visibility in the prompt for Gemini's attention.
- **Calls table in Realtime publication**: Migration 041 adds calls to `supabase_realtime` with `REPLICA IDENTITY FULL` so the dashboard calls page receives live INSERT/UPDATE events.
- **FastAPI replaces stdlib HTTPServer on port 8080 (Phase 39)**: The deleted `src/health.py` used Python's `http.server.HTTPServer` in a daemon thread. Phase 39 swaps this for a FastAPI app on the same port, same boot pattern (daemon thread before `cli.run_app()`), unified logging, and room to grow the `/twilio/*` surface without a second port. Dockerfile HEALTHCHECK line is unchanged because FastAPI serves the same `/health` path on the same port.
- **Router-level Twilio signature dependency (Phase 39)**: `APIRouter(prefix="/twilio", dependencies=[Depends(verify_twilio_signature)])` applies the signature check once to all four `/twilio/*` endpoints — no per-route boilerplate. The dependency caches form data on `request.state.form_data` so handlers don't re-parse.
- **Pure-function schedule evaluator (Phase 39, wired in Phase 40)**: `evaluate_schedule(schedule, tenant_timezone, now_utc)` in `src/webhook/schedule.py` has zero side effects -- no DB access, no HTTP, no logging. Trivially unit-testable (17 tests in `tests/webhook/test_schedule.py`). Phase 40 wired it into the live `/twilio/incoming-call` routing handler.
- **D-13 dead-weight tenant lookup (Phase 39, superseded by Phase 40)**: Phase 39's `/twilio/incoming-call` originally returned hardcoded AI TwiML per D-13. Phase 40 replaced this with the live routing composition (evaluate_schedule + check_outbound_cap). The dead-weight pattern served its purpose -- Phase 40's diff was a clean branch swap on the existing wiring.
- **`_normalize_phone` extracted to `src/lib/phone.py` (Phase 39)**: Phase 39 extracted the inline closure from `src/agent.py::entrypoint()` to a module-level function in `src/lib/phone.py`. Both `src/agent.py` and `src/webhook/twilio_routes.py` import from the same module — no duplication.
- **`calls.routing_mode` is nullable with NULL = AI (Phase 39, D-19)**: No historical backfill. Phase 41's dashboard badge interprets `NULL` as "AI" for pre-cutover calls. Legacy calls keep rendering correctly without a data migration.
- **UTC-anchored monthly cap (Phase 39)**: `check_outbound_cap` anchors to `date_trunc('month', now())` in UTC, not tenant-local time. Up to 8 hours of pre-month calls near the boundary are excluded from the cap for tenants not at UTC. Acceptable at current scale per D-17 — revisit only if it materially affects enforcement.
- **Form-stashing dependency overrides in tests (Phase 39-06)**: FastAPI `dependency_overrides` that replace a dependency producing request-scoped state must replicate that state mutation, not return `None`. `client_no_auth` in `tests/webhook/conftest.py` uses an async override that calls `await request.form()` and sets `request.state.form_data`, mirroring `verify_twilio_signature`'s side effect so the incoming-call handler doesn't crash with `AttributeError` on `request.state.form_data`.
- **Webhook routing replaces SIP-only routing (Phase 40)**: All Twilio numbers now have `voice_url` set to `/twilio/incoming-call` on Railway. Twilio prioritizes `voice_url` over SIP trunk, so the webhook receives all inbound calls first and decides routing (AI vs owner-pickup). SIP trunk associations are preserved as rollback — clearing `voice_url` on a number restores SIP trunk routing automatically (D-21).
- **Fail-open at every stage (Phase 40)**: Blocked tenants (canceled/paused/incomplete), unknown numbers (no tenant match), subscription check errors, schedule evaluation errors, and cap check errors all route to AI. No call is ever rejected or given a busy signal at the webhook layer (D-01).
- **Pre-TwiML calls row insert (Phase 40, D-22)**: Owner-pickup calls insert a minimal `calls` row (tenant_id, from_number, to_number, routing_mode='owner_pickup', call_sid) BEFORE returning TwiML to Twilio. This ensures the row exists before the dial-status callback fires.
- **Owner-pickup calls are lightweight (Phase 40, D-07/D-08)**: No transcript, no recording, no triage, no lead creation, no notifications, no `increment_calls_used`. The owner talked to the customer directly.
- **Same AI greeting for all paths (Phase 40, D-05)**: Whether a call goes directly to AI or falls back after owner no-answer, the caller gets the identical greeting. No fallback-aware behavior.
- **Soft cap gates owner-pickup only (Phase 40, D-11)**: Cap breach downgrades `owner_pickup` to AI and logs a warning. AI calls are always allowed regardless of cap status — the cap only gates the outbound dial leg.
- **SMS forwarding is non-fatal per-recipient (Phase 40, D-16)**: If forwarding to one pickup number fails, others still proceed. Errors logged but not surfaced to the original sender. MMS not forwarded — `[Media attached]` note appended instead (D-14).
- **call_sid for dial-status correlation (Phase 40)**: The `calls` row uses Twilio's `CallSid` (passed in the webhook form data) to correlate the dial-status callback with the calls row. This is more reliable than from_number + to_number + timestamp window matching.
- **`python-multipart` required in production (Phase 39-06)**: FastAPI cannot parse Twilio's `application/x-www-form-urlencoded` webhook bodies without `python-multipart`. Discovered when the first integration test raised `AssertionError` on form parsing. Added to `[project.dependencies]` (not dev) so Railway picks it up on deploy. Without it, every production Twilio webhook would 500 on first hit.

---

## 11. Webhook Service

**Repo**: `lerboi/livekit_agent` — **Directory**: `src/webhook/`

Phase 39 added a FastAPI webhook service running in the same Railway container as the LiveKit agent. One process, one Dockerfile, one public URL — the webhook is a quiet second face on the existing container.

### Files

See the File Map table above. The subpackage is `src/webhook/` with `app.py`, `twilio_routes.py`, `security.py`, `schedule.py`, `caps.py`, and `__init__.py`.

### Endpoints

| Method | Path | Purpose | Behavior |
|--------|------|---------|----------|
| GET | `/health` | Liveness probe | Returns `{"status":"ok","uptime":<int>,"version":"1.0.0"}` (Dockerfile HEALTHCHECK) |
| GET | `/health/db` | DB connectivity probe | 200 if `SELECT id FROM tenants LIMIT 1` succeeds, 503 otherwise |
| POST | `/twilio/incoming-call` | Twilio voice webhook | Routing composition: tenant lookup -> subscription check (fail-open) -> **`_is_vip_caller` check (direct owner-pickup if priority, bypasses schedule + cap)** -> `evaluate_schedule` -> `check_outbound_cap` (owner_pickup only) -> returns AI `<Dial><Sip>` or owner-pickup `<Dial><Number>` TwiML. Inserts `calls` row for owner-pickup before returning TwiML. |
| POST | `/twilio/dial-status` | Dial-status callback | Writes `outbound_dial_duration_sec` and `routing_mode` (`owner_pickup` or `fallback_to_ai`) to the calls row via `call_sid`. Returns `<Response/>`. |
| POST | `/twilio/dial-fallback` | Dial-fallback (owner no-answer) | Returns AI SIP TwiML `<Dial><Sip>{LIVEKIT_SIP_URI}</Sip></Dial>` — same as direct AI path. No fallback-aware greeting. |
| POST | `/twilio/incoming-sms` | SMS forwarding webhook | Forwards message text to `pickup_numbers` entries with `sms_forward=true`. Format: `[Voco] From {sender}: {body}`. MMS gets `[Media attached]` note. Logs inbound + forwarded rows to `sms_messages` table. Non-fatal per-recipient. |

All `/twilio/*` endpoints are signature-gated via a single router-level FastAPI dependency — zero per-route boilerplate.

### Signature Verification

`src/webhook/security.py` defines `verify_twilio_signature(request)` as an async FastAPI dependency. Applied once on the `APIRouter(prefix="/twilio", dependencies=[Depends(verify_twilio_signature)])`. Raises `HTTPException(403)` on invalid or missing signature.

URL reconstruction trusts Railway's edge proxy headers:

```python
proto = request.headers.get("x-forwarded-proto", "https")
host = request.headers["host"]
url = f"{proto}://{host}{request.url.path}"
```

uvicorn is started with `proxy_headers=True, forwarded_allow_ips='*'` so this pattern works behind Railway's edge.

The dependency also reads `await request.form()` once and stashes the parsed dict on `request.state.form_data` — handlers read from there, never re-parse. Any FastAPI test that overrides this dependency must replicate the `request.state.form_data` side effect, not return a plain `None` (see Plan 39-06 conftest pattern).

`ALLOW_UNSIGNED_WEBHOOKS=true` env var bypasses verification with a warning log. Only set in local dev and staging; production Railway never has it set. Fail-closed default: if the env var is unset, validation always runs.

### Schedule Evaluator

`src/webhook/schedule.py` exports:

```python
@dataclass(frozen=True)
class ScheduleDecision:
    mode: Literal["ai", "owner_pickup"]
    reason: Literal["schedule_disabled", "empty_schedule", "outside_window", "inside_window"]

def evaluate_schedule(
    schedule: dict,
    tenant_timezone: str,
    now_utc: datetime,
) -> ScheduleDecision: ...
```

Pure function — no DB access, no HTTP, no logging. Schedule JSONB shape is `{enabled: bool, days: {mon|tue|...|sun: [{start:"HH:MM", end:"HH:MM"}, ...]}}`. Times stored in tenant-local 24-hour format. `enabled:false` means "schedule off, always AI". Overnight ranges use `end < start` convention (e.g. `19:00`-`09:00`) and are matched via a two-branch `local >= start or local < end` check. DST transitions are handled entirely by Python's `zoneinfo.astimezone()` — no special-case code. Start boundary is inclusive, end boundary exclusive.

Same-day lookup only: a `mon 19:00-09:00` range matches Mon 08:00 local (morning branch) and Mon 20:00 local (evening branch) because the evaluator only reads `days[current_day_key]`. Phase 41 UI writes the range under both day keys if true cross-day matching is required — the evaluator does NOT synthesize cross-day lookups.

The evaluator emits `ai` or `owner_pickup`. `fallback_to_ai` is written by the dial-status handler when Twilio reports a no-answer on the owner-pickup dial -- it is a post-call observation on the `calls.routing_mode` column, not a schedule evaluator output.

### Outbound Cap

`src/webhook/caps.py` exports:

```python
async def check_outbound_cap(tenant_id: str, country: str) -> bool: ...
```

Returns `True` if the tenant is under the monthly outbound cap, `False` at/over. Limits: US/CA 300000 seconds (5000 min), SG 150000 seconds (2500 min); unknown country falls back to the US limit as a fail-open safe default. Query sums `outbound_dial_duration_sec` from `calls` where `created_at >= date_trunc('month', now())` via the `idx_calls_tenant_month` compound index (added in migration 042). SUM is computed in Python from returned rows — no PostgREST aggregate RPC needed at current scale per D-17. `get_supabase_admin` is lazy-imported inside the function so tests can monkeypatch before first call. Cap breaches emit `logger.warning` only in Phase 39; dedicated event logging is deferred to Phase 40 per D-11.

### Priority (VIP) Caller Check (Phase 46)

`webhook/twilio_routes.py::_is_vip_caller(tenant, from_number) -> bool` runs between the subscription check and `evaluate_schedule`. Two-source lookup (D-01/D-02):

```python
async def _is_vip_caller(tenant: dict, from_number: str) -> bool:
    # Source 1: Standalone VIP numbers in tenants.vip_numbers (no DB hit)
    for entry in (tenant.get("vip_numbers") or []):
        if entry.get("number") == from_number:
            return True
    # Source 2: Lead-based VIP via leads.is_vip=true (sparse partial index)
    response = await asyncio.to_thread(
        lambda: get_supabase_admin()
        .table("leads").select("id")
        .eq("tenant_id", tenant["id"]).eq("from_number", from_number)
        .eq("is_vip", True).limit(1).execute()
    )
    return bool(response.data)
```

On match:
- Calls `_insert_owner_pickup_call(tenant_id, call_sid, from_number, to_number)` — writes calls row with `routing_mode=owner_pickup` (stamped later by `/twilio/dial-status`).
- Returns parallel-ring `<Dial>` TwiML targeting `tenant.pickup_numbers[*].number`.
- **Skips** `evaluate_schedule` AND `check_outbound_cap` — priority callers always ring the owner regardless of off-hours or monthly cap breach.
- If the tenant has no `pickup_numbers` configured, falls through to AI (safety net — per D-03 we never leave a priority caller without an answer).

**Fail-open**: a Supabase error in the lead-based lookup returns `False` (logs a warning). No false-positive risk (worst case the caller is routed to AI, same as a non-priority caller).

**DB shape** (migration 049): `tenants.vip_numbers JSONB NOT NULL DEFAULT '[]'::jsonb` (no CHECK on length — D-09); `leads.is_vip BOOLEAN NOT NULL DEFAULT false`; sparse partial index `idx_leads_vip_lookup ON leads (tenant_id, from_number) WHERE is_vip = true` keeps the lookup cheap as leads grow.

**Branding**: user-facing UI says "Priority Callers" throughout (dashboard `/more/call-routing`, LeadFlyout badge). DB columns keep the `vip_*` names (commit `72f6572` renamed UI strings; schema migration 049 was pre-rename and kept). When editing, preserve this split — never rename columns without a coordinated migration.

### Database Schema (Phase 39 Migration 042)

`supabase/migrations/042_call_routing_schema.sql` adds:

- `tenants.call_forwarding_schedule JSONB NOT NULL DEFAULT '{"enabled":false,"days":{}}'::jsonb`
- `tenants.pickup_numbers JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_array_length(pickup_numbers) <= 5)`
- `tenants.dial_timeout_seconds INTEGER NOT NULL DEFAULT 15`
- `calls.routing_mode TEXT CHECK (routing_mode IN ('ai','owner_pickup','fallback_to_ai'))` — nullable, no default (NULL means "legacy AI call" per D-19, no historical backfill)
- `calls.outbound_dial_duration_sec INTEGER` — nullable, populated by Phase 40's dial-status handler
- Index `idx_calls_tenant_month ON calls (tenant_id, created_at)` for the cap SUM query

`pickup_numbers` item shape (enforced at Phase 41 API layer, not DB): `{number: string (E.164), label: string, sms_forward: boolean}`.

### Database Schema (Phase 40 Migration 045)

`supabase/migrations/045_sms_messages_and_call_sid.sql` adds:

- **`sms_messages` table**: `id` (UUID PK), `tenant_id` (FK), `from_number` (text), `to_number` (text), `body` (text), `direction` (text, 'inbound' or 'forwarded'), `created_at` (timestamptz). RLS enabled with tenant isolation. One row for the inbound message, one row per forwarded copy.
- **`calls.call_sid` column**: `TEXT` — Twilio's CallSid, used by `/twilio/dial-status` to find the calls row for duration writeback. Populated at owner-pickup call insert time (before TwiML response).

### Test Infrastructure

pytest lives in `livekit-agent/tests/webhook/` (Phase 39 Wave 0). Test files:

- `test_schedule.py` — 17 unit tests for `evaluate_schedule` (DST, overnight, boundaries, multi-range)
- `test_caps.py` — 8 unit tests for `check_outbound_cap` (mocked Supabase chains)
- `test_routes.py` — 6 integration tests against the FastAPI app via `TestClient` with `dependency_overrides`
- `test_security.py` — 4 signature verification tests using real `RequestValidator.compute_signature` from `twilio` 9.x

Configured via `[tool.pytest.ini_options]` in `pyproject.toml` with `testpaths = ["tests"]`, `asyncio_mode = "auto"`, `pythonpath = ["."]`. Dev deps in `[project.optional-dependencies].dev`: `pytest`, `pytest-asyncio`, `httpx`.

Run: `cd livekit-agent && python -m pytest tests/webhook/ -q` — target runtime <10 seconds, current wall ~1.3s for all 35 tests.

### Phase 40 Completed Changes

Phase 40 completed the architectural cutover from SIP-only routing to webhook-based routing:

- `/twilio/incoming-call` now runs the live routing composition: tenant lookup -> subscription check (fail-open) -> `evaluate_schedule` -> `check_outbound_cap` (if owner_pickup) -> AI or owner-pickup TwiML
- `/twilio/dial-status` writes `outbound_dial_duration_sec` and `routing_mode` to the calls row via `call_sid`
- `/twilio/dial-fallback` returns AI SIP TwiML for unanswered owner-pickup calls (same greeting as direct AI, no fallback-aware behavior per D-05)
- `/twilio/incoming-sms` forwards messages to `pickup_numbers` entries with `sms_forward=true`, logs to `sms_messages` table
- `provisionPhoneNumber` in `src/app/api/stripe/webhook/route.js` sets `voice_url`, `voice_fallback_url`, `sms_url` from `RAILWAY_WEBHOOK_URL` on new Twilio numbers (both US/CA at purchase time and SG after assignment)
- SIP trunk associations preserved on all numbers as rollback safety net (D-21): clearing `voice_url` restores SIP trunk routing
- All existing tenant numbers cutover to webhook routing via `scripts/cutover-existing-numbers.js`
- Migration 045 adds `sms_messages` table and `call_sid` column on `calls`

### Phase 41 Extension Points

- Phase 41 ships the dashboard UI at `/dashboard/more/call-routing` that writes `call_forwarding_schedule` + `pickup_numbers` + `dial_timeout_seconds`
- Phase 41 adds routing mode badges on the dashboard calls page (NULL = AI for pre-cutover calls per D-19)
- Phase 41 adds a usage meter showing outbound minutes used this month

---

## Phase 55: Xero Read-Side Caller Context (cross-repo)

### Integration module (livekit-agent repo)

- `livekit-agent/src/integrations/xero.py` — refresh-aware Xero REST fetcher via raw `httpx` (chosen over `xero-python` SDK for tighter timeout control and smaller dep footprint)
- Service-role Supabase reads `accounting_credentials` row; refresh write-back persists `access_token + refresh_token + expiry_date + error_state=null` together to prevent Next.js/Python stale-token races
- On refresh failure: writes `error_state='token_refresh_failed'` on the row and returns None silently. The **Next.js dashboard** surfaces the banner + Resend email (Plan 05). The Python agent **NEVER** sends email — would be noisy across calls
- `expiry_date` column is BIGINT (epoch ms, written by Next.js as `Date.now() + expires_in*1000`); the Python parser handles both bigint and ISO 8601 strings
- Default page of Xero contacts (up to 100) is fetched and digit-matched in code via compound PhoneCountryCode/AreaCode/Number fields — no OData Contains filter (was too strict across country formats)

### Pre-session Xero fetch (D-08)

The pre-session fetch for Xero customer context runs **before** `build_system_prompt` — the prompt-block injection requires data pre-session. Flow:

1. `fetch_xero_context_bounded(tenant_id, from_number, timeout_seconds=2.5)` runs awaited before the prompt is built
2. On timeout / exception / no-match: returns None → `customer_context=None` → prompt block omitted (D-11 uniform cold-call)
3. Budget 2.5s covers refresh (if needed) + `getContacts` + 2 parallel `getInvoices` calls on Xero's cold API
4. `_run_db_queries` then runs the 3 existing parallel tasks (subscription / intake / call_record) — xero is NOT inside _run_db_queries anymore
5. Sentry captures timeout/error with tenant_id + hashed phone tag (SHA-256 first 8 chars — no PII)

### customer_context prompt block

`build_system_prompt(..., customer_context=None)` accepts the kwarg; the new `_build_customer_account_section` injects a CRITICAL RULE-framed STATE+DIRECTIVE block between repeat_caller and info_gathering. When customer_context is None, the block is omitted entirely.

- STATE line: `contact=<name>; outstanding=$X across N invoices; last_invoice=INV-YYY $Z dated ... (status); last_payment=DATE`
- DIRECTIVE: Answer factually ONLY when caller explicitly asks about balance/bill/recent work; do not volunteer
- Extra CRITICAL RULE paragraph: "NEVER volunteer...Ask every question as if no records...If asked 'do you have my info?', confirm presence WITHOUT specifics"

### check_customer_account tool

- `livekit-agent/src/tools/check_customer_account.py` — factory `create_check_customer_account_tool(deps)` registered in `tools/__init__.py`
- Re-serves `deps["customer_context"]` via shared formatter `format_customer_context_state()`; NEVER re-fetches from Xero
- Returns locked `STATE: no_xero_contact_for_phone` string when customer_context is None
- Always available (not gated on onboarding_complete)

### Cross-runtime customer_context casing — INTENTIONAL divergence

`fetchCustomerByPhone` in Next.js and `fetch_xero_customer_by_phone` in Python return the SAME LOGICAL SHAPE, but with LANGUAGE-IDIOMATIC casing:

- **Next.js (camelCase):** `{ contact, outstandingBalance, lastInvoices, lastPaymentDate }`
- **Python (snake_case):** `{ contact, outstanding_balance, last_invoices, last_payment_date }`

This is **intentional** language-idiomatic divergence — each runtime serializes per its ecosystem convention. They NEVER cross runtime boundaries: the agent prompt formatter (`format_customer_context_state` in tools/check_customer_account.py) reads the snake_case shape; the dashboard reads the camelCase shape. **DO NOT "unify" the casing** — it would break one side without benefit.

### Privacy rule (D-10)

The agent must NEVER volunteer customer name, outstanding balance, invoice numbers, or payment history. Answer factually only when explicitly asked. Mirrors `check_caller_history.py:107-117` phrasing.

---

## Phase 56 — Jobber read-side integration (customer context)

**Shipped:** 2026-04-18

**What changed:**
- `_run_db_queries` (livekit-agent `src/agent.py` ~line 316) now runs **five** parallel tasks. The 5th is `jobber_context_task` — identical shape to P55's `xero_context_task`, running `asyncio.wait_for(fetch_jobber_customer_by_phone(tenant_id, from_number), timeout=0.8)` concurrently with (not after) the Xero task. Outer budget stays 2.5s.
- New `src/integrations/jobber.py` (cross-repo — livekit-agent repo, not this monorepo) — service-role Supabase read of `accounting_credentials`, `httpx.AsyncClient` Jobber GraphQL POST with `X-JOBBER-GRAPHQL-VERSION: 2024-04-01` header, refresh-token rotation with mandatory write-back of the NEW refresh_token on every refresh.
- New `src/lib/customer_context.py::merge_customer_context(jobber, xero) -> dict | None` — field-level merge with source annotations per Phase 56 CONTEXT D-07:
  | Field | Winner | Fallback |
  |-------|--------|----------|
  | `client` | Jobber | Xero (renamed from `contact`) |
  | `recentJobs` | Jobber | (omitted — Xero has no jobs) |
  | `lastVisitDate` | Jobber | (omitted — Xero has no visits) |
  | `outstandingBalance` | Xero | Jobber |
  | `lastPaymentDate` | Xero | (omitted — Jobber has no field) |
  | `lastInvoices` | Xero | Jobber.outstandingInvoices (renamed) |
  Returns None when both miss (customer_context block omitted — D-11).
- Merged dict carries `_sources` inner dict marking per-field provenance (`'Jobber' | 'Xero'`) — rendered as `(source)` suffix in STATE body (D-08).
- `src/prompt.py::build_system_prompt` accepts the merged dict (not Xero-only); rendering omits fields that were absent (no `null` lines).
- `src/tools/check_customer_account.py` — P55 registered; P56 extended its data source. Serializes merged `deps.customer_context` as STATE + DIRECTIVE (P55 D-09 verbatim shape). No re-fetch; no GraphQL/DB call.
- Sentry captures on timeout/exception include tags `{tenant_id, provider: 'jobber'|'xero', phone_hash}` where phone_hash = first 8 chars of sha256 hex of from_number (never raw E.164).

**Key files (cross-repo — livekit-agent):**
- `src/integrations/jobber.py` — adapter with GraphQL fetch + refresh write-back
- `src/lib/customer_context.py` — merge helper
- `src/agent.py` — 5-task parallel + merge call
- `src/prompt.py` — customer_context block with source annotations
- `src/tools/check_customer_account.py` — extended data source

**Key files (Next.js monorepo):**
- `src/lib/integrations/jobber.js` — module-level `fetchJobberCustomerByPhone` cached with `'use cache'` + two-tier `cacheTag` (dashboard reads only; call path stays Python-direct)
- `src/app/api/webhooks/jobber/route.js` — HMAC-SHA256 verify (key IS `JOBBER_CLIENT_SECRET`), 5-event routing, per-phone `revalidateTag`

**Known limitations (document for future contributors):**
- **Field-level merge silently suppresses Jobber/Xero discrepancies** in the prompt by design (e.g., Jobber shows $500 outstanding but Xero shows $0 after reconciliation → Gemini speaks $0). Owner-facing discrepancy telemetry is a Phase 58 CTX-01 candidate; out of P56 scope.
- **7-digit local phone numbers** (e.g., `"555-1234"`) cannot be normalized to E.164 and are skipped during the phone match. Rare in practice (Jobber admin would have entered an area code); logged-but-unactionable.
- **Voice pipeline does NOT validate ANI** (caller-ID). A caller spoofing a customer's phone number will be treated as that customer for `customer_context` purposes. Treat the block as convenience, not proof of identity. CNAM / STIR-SHAKEN validation is a future enhancement.
- **Refresh-token rotation theft race** — if an attacker obtains a refresh token and races the legitimate refresh, Jobber invalidates whichever loses. Tenant must re-authenticate. Jobber's default policy; accepted.

**Carried-forward constraints (Phase 55 decisions still apply):**
- E.164 exact match (no fuzzy fallback) — Jobber's free-form phones normalized server-side before compare
- 800ms per-provider timeout; silent-skip on failure
- Pre-session prompt injection only (no post-greeting injection); tool re-serve on explicit ask
- SDK pins: `livekit-agents==1.5.1`, `livekit-plugins-google@43d3734` — MUST NOT BUMP without revisiting P55 UAT findings 999.1/999.2

---

## Important: Keeping This Document Updated

When making changes to any file listed in the File Map above, update the relevant sections of this skill document to reflect the new behavior. This ensures future conversations always have an accurate reference.

When modifying the agent repo (`lerboi/livekit_agent`), remember to update this skill file in the main repo (`homeservice_agent`).

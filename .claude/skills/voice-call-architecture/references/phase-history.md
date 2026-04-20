# Voice Call Architecture — Phase History

Incremental phase milestones absorbed from the prior `Last updated` header
paragraph (which had accumulated 10+ "Previous:" entries). The main SKILL.md
body reflects the CURRENT STATE — this file is the chronological trail.

## Phase 60.2 — Voice tool-call filler race + VAD tuning (2026-04-20)

- **Fix G (shipped)**: Raised server-VAD `silence_duration_ms` from
  `1000` → `1500` in `src/agent.py`. UAT (Persona 1, 226s call on
  2026-04-20, `call-_+6587528516_945EJsSSXxWh`) confirmed
  `server cancelled tool calls` warnings dropped 2/call → 0/call; no
  mid-sentence `[cut]` at tool boundaries; `book_appointment: idempotent
  re-invocation` gone on happy path.
- **Fix H (reverted)**: Deterministic runtime filler via
  `context.session.say()` inside 4 scoped tools
  (`check_availability`, `book_appointment`, `capture_lead`,
  `transfer_call`) with `_FILLER_PHRASES` rotation via deps-scoped
  `_filler_idx_<tool>` counter and `allow_interruptions=False`. Plan 05
  UAT caught every filler raising `RuntimeError: trying to generate
  speech from text without a TTS model` — `AgentSession(llm=RealtimeModel)`
  on livekit-agents 1.5.1 has no TTS attached because Gemini Live emits
  audio directly, and `session.say()` requires one. Reverted (commit
  `cbe1bb9` in livekit-agent repo). Repairing would force a non-Gemini
  TTS (voice mismatch), so Fix H dropped rather than fixed. Plan 04
  `_build_tool_narration_section` prompt change reverted verbatim.
  `tests/test_filler_audio.py` deleted; `tests/test_prompt.py` inverted
  to guard against re-landing. **Do not reintroduce `session.say()` on
  a RealtimeModel-only session without attaching a TTS or using a
  separate audio source.**
- **Fix I (self-resolved)**: Post-call pipeline 8s timeout. Pipeline
  completed ~12s after session close without triggering timeout on the
  post-G UAT call. No code change.
- **Fix J (declined)**: Upstream google plugin upgrade past commit
  `43d3734`. Commit `3e51d8e` ambiguously changes `generate_reply()`
  compatibility for `gemini-3.1-flash-live-preview` — risks silent
  breakage of greeting + intake-injection paths. Upstream issue #4486
  (`_SegmentSynchronizerImpl.playback_finished` race) OPEN since Jan 2026.
- **Open for Phase 60.3**: Goodbye cut-off diagnosis (different race
  class from tool-call race — needs `end_call` invocation-timing +
  last-text-token logging); Gemini 3.1 Flash Live + v1.5.1 + plugin
  `@43d3734` prompt-best-practices audit of full `build_system_prompt()`.

## Phase 60 — Voice prompt polish: name-once + single-question address (2026-04-19)

- `prompt.py` gains three new blocks in `_build_info_gathering_section`
  and `_build_booking_section` (both now accept `locale: str = "en"`):
  1. **NAME USE DURING THE CALL** — capture silently, no name vocative
     mid-call, single authoritative readback at booking, caller-invited
     override path, no-name path never blocks booking. D-01..D-05.
  2. **SERVICE ADDRESS** — single natural opener "What's the address
     where you need the service?" replaces three-part walkthrough.
     One targeted follow-up at a time. No field enumeration. D-06..D-08.
  3. **BEFORE BOOKING — READBACK (mandatory)** — mandatory
     name+address readback in one utterance before `book_appointment`.
     Accept-and-re-read correction loop. No-name path reads address
     only. D-02, D-09, D-10.
- Spanish mirror (usted register) added for all three blocks via
  `locale='es'` conditionals (D-13, D-14).
- All 5 tool returns in `src/tools/*.py` rewritten to strict
  `STATE:<code>|DIRECTIVE:<imperative>` format — machine-facing, not
  speakable English. Every DIRECTIVE ends with "Do not repeat this
  message text on-air." D-16.
- `capture_lead` description reaches single-question-intake + readback
  parity with `book_appointment` (D-11, D-12).
- `end_call.py` untouched (space-character return not a parrot-loop risk).
- Tool signatures frozen; Phase 46 `deps["_booking_succeeded"]` /
  `deps["_booked_appointment_id"]` stamping preserved.
- Pre-existing Phase 30 Spanish structural gap (intro paragraphs,
  URGENCY, SCHEDULING, AVAILABILITY RULES remain English-only
  regardless of locale) intentionally NOT retroactively fixed (Pitfall 4).

## Phase 58 — Setup checklist + skills + telemetry + UAT (2026-04-20)

- Python telemetry helpers (`emit_integration_fetch`,
  `emit_integration_fetch_fanout`) shipped to `src/lib/telemetry.py`.
- Pre-session fanout telemetry wrapper
  `fetch_customer_context_with_fanout_telemetry` in `agent.py`.
- See `integrations-jobber-xero/references/telemetry.md` for full
  coverage.

## Phase 56 — Jobber read-side integration: customer context (2026-04-18)

- `_run_db_queries` (~line 316) now runs **five** parallel tasks —
  Jobber added alongside Xero with identical 0.8s bounded timeout
  inside an outer 2.5s budget.
- `src/integrations/jobber.py` — service-role Supabase read of
  `accounting_credentials`, `httpx.AsyncClient` Jobber GraphQL with
  `X-JOBBER-GRAPHQL-VERSION: 2024-04-01` header, refresh-token rotation
  with mandatory write-back of new refresh_token on every refresh.
- `src/lib/customer_context.py :: merge_customer_context(jobber, xero)` —
  field-level merge (P56 CONTEXT D-07): Jobber-preferred for `client`,
  `recentJobs`, `lastVisitDate`; Xero-preferred for `outstandingBalance`,
  `lastPaymentDate`, `lastInvoices`.
- `build_system_prompt` accepts merged dict (not Xero-only); omits
  absent fields (no `null` lines).
- `check_customer_account` serializes merged `deps.customer_context`
  as STATE+DIRECTIVE; no re-fetch.
- **Known limitations**: field-level merge silently suppresses
  Jobber/Xero discrepancies; 7-digit local phones cannot be normalized;
  voice pipeline does NOT validate ANI (caller-ID spoofing risk);
  refresh-token theft race accepted.

## Phase 55 — Xero read-side caller context (2026-04-17)

- `livekit-agent/src/integrations/xero.py` — refresh-aware Xero REST
  fetcher via raw `httpx` (chosen over `xero-python` SDK for tighter
  timeout control and smaller dep footprint).
- Service-role Supabase reads `accounting_credentials` row; refresh
  write-back persists `access_token + refresh_token + expiry_date +
  error_state=null` together to prevent stale-token races.
- On refresh failure: writes `error_state='token_refresh_failed'` and
  returns None silently. The **Next.js dashboard** surfaces the banner
  + Resend email (Plan 05). Python agent **NEVER** sends email.
- Pre-session Xero fetch runs **before** `build_system_prompt` (D-08).
  Budget 2.5s covers refresh + getContacts + 2 parallel getInvoices.
  On timeout/exception/no-match: customer_context=None, block omitted
  (D-11 uniform cold-call).
- `check_customer_account` tool registered. Re-serves
  `deps["customer_context"]`; NEVER re-fetches.
- **Cross-runtime casing divergence is intentional** — Next.js
  camelCase vs Python snake_case. DO NOT "unify".

## Phase 46 — Priority (VIP) caller direct routing (2026-04-10)

- Webhook `_is_vip_caller(tenant, from_number)` check added between
  subscription and schedule evaluation in `/twilio/incoming-call`.
- Two sources: `tenants.vip_numbers` JSONB (standalone, no DB hit) and
  lead-based lookup via `leads.is_vip=true` (sparse partial index
  `idx_leads_vip_lookup`).
- On match: direct owner-pickup parallel ring, bypasses schedule + cap.
- User-facing brand is "Priority"; DB columns keep "vip" naming.
- Migration 049.
- **Post-call booking reconciliation** — `tools/book_appointment.py`
  stamps `deps["_booking_succeeded"]`, `deps["_booked_appointment_id"]`,
  `deps["_booked_caller_name"]` synchronously on success.
  `agent.py:_on_close_async` forwards as params to
  `run_post_call_pipeline`. Closes race where mid-call update matched
  zero rows because `_run_db_queries` hadn't inserted the calls row yet.
- **Owner SMS `from_number`** — `send_owner_sms` accepts `from_number`
  param (matches `send_caller_sms`/`send_caller_recovery_sms`). Removes
  reliance on global `TWILIO_FROM_NUMBER` env var.

## Phase 40 — Live webhook routing composition (2026-04-08)

- Wired in `/twilio/incoming-call`: tenant lookup → sub check →
  evaluate_schedule → check_outbound_cap → TwiML.
- Dial-status writeback; dial-fallback AI TwiML.
- SMS forwarding to `pickup_numbers` with `sms_forward=true`.
- Migration 045 (sms_messages table + call_sid on calls).
- Provisioning update sets `voice_url`, `voice_fallback_url`, `sms_url`
  from `RAILWAY_WEBHOOK_URL` on new Twilio numbers.
- Cutover script updates existing tenant numbers.

## Phase 39 — FastAPI webhook service (2026-04-06)

- Replaces `src/health.py` with `src/webhook/` subpackage:
  `app.py` (FastAPI + `/health` + `/health/db`), `twilio_routes.py`
  (4 signature-gated POST endpoints), `security.py`
  (`verify_twilio_signature` dep), `schedule.py` (pure-function
  `evaluate_schedule` + frozen `ScheduleDecision`), `caps.py`
  (`check_outbound_cap`).
- `_normalize_phone` extracted to `src/lib/phone.py`.
- Migration 042: `call_forwarding_schedule`, `pickup_numbers`,
  `dial_timeout_seconds` on tenants; `routing_mode`,
  `outbound_dial_duration_sec` on calls; `idx_calls_tenant_month`.
- Purely additive — zero production Twilio numbers reconfigured;
  `/twilio/incoming-call` always returned hardcoded AI TwiML per D-13
  dead-weight pattern so Phase 40's diff was a one-line branch swap.
- 35 webhook tests green in ~1.3s.
- New deps: `fastapi>=0.115,<1`, `uvicorn[standard]>=0.30,<1`,
  `python-multipart>=0.0.9,<1`.

## Earlier — pin fix (2026-04-08 plugins emergency)

- `livekit-agents`, `livekit-plugins-silero`,
  `livekit-plugins-turn-detector` locked to `==1.5.1` in `pyproject.toml`.
- PyPI `livekit-agents 1.5.2` (Apr 8 2026, PR #5211) added a required
  7th field `per_response_tool_choice` to `llm.RealtimeCapabilities`.
- The git-pinned google plugin at `43d3734` still constructs
  `RealtimeCapabilities` with 6 fields, so any Railway rebuild after
  Apr 8 produced `TypeError` at `RealtimeModel.__init__` on every
  inbound call.
- The plugin pin must stay because commit `43d3734` is the only google
  plugin version supporting `generate_reply()` with
  `gemini-3.1-flash-live-preview` (via `A2A_ONLY_MODELS` branch).

## Earlier — book_appointment non-blocking + check_availability anti-leak

- `book_appointment` tool now truly fire-and-forget for calendar push
  and caller SMS — was previously blocking for 1-4s while awaited,
  causing AI to go silent and triggering duplicate invocations that
  fired spurious recovery SMS.
- Idempotency cache keyed on `slot_start|slot_end` stored in deps;
  late-duplicate guard in slot_taken branch.
- `check_availability` general-summary return no longer leaks
  earliest/latest slot time anchors — AI was mining them to fabricate
  specific times. Added anti-shortcut rules to booking section
  (different-time re-check, vague-window handling) with a concrete
  2pm/3pm example.
- Updated `check_availability` tool description to forbid picking times
  for vague windows like "afternoon".

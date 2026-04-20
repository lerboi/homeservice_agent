---
name: voice-call-architecture
description: "Complete architectural reference for the Voco voice call system — Twilio SIP + LiveKit + Gemini 3.1 Flash Live Python agent deployed on Railway. Covers the FastAPI webhook service (incoming-call routing, dial-status, dial-fallback, incoming-sms, priority-caller check), LiveKit agent entrypoint (tenant lookup, _run_db_queries background tasks, pre-session Xero/Jobber customer context fetch, Gemini server VAD tuning with silence_duration_ms, session lifecycle), system-prompt building (STATE+DIRECTIVE tool returns, name-once policy, single-question address intake, booking readback), 6 in-process tools (check_availability, book_appointment, capture_lead, check_caller_history, check_customer_account, transfer_call, end_call), post-call pipeline (recording, transcript, triage, notifications, booking reconciliation), recovery SMS cron, usage tracking, Phase 58 integration telemetry (integration_fetch + integration_fetch_fanout activity_log rows). Use this skill whenever making changes to call handling, modifying agent prompts, updating triage logic, debugging the LiveKit agent, touching Twilio/LiveKit/Gemini integration, or adjusting pre-session customer-context injection."
---

# Voice Call Architecture — Complete Reference

This document is the single source of truth for the Voco voice call system.
Read this before making any changes to call-related code.

**Last updated**: 2026-04-20 (Phase 58 — integration telemetry `integration_fetch_fanout` + skill consolidation cross-refs. See `references/phase-history.md` for incremental phase-by-phase history.)

---

## Architecture Overview

Two separate services, one call:

| Service | Runtime | Deployment | Purpose |
|---------|---------|------------|---------|
| **Next.js App** | Node | Vercel | Dashboard, API routes, cron, Stripe webhooks, phone provisioning |
| **LiveKit Voice Agent** | Python 3.12 | Railway | Real-time AI voice via Gemini 3.1 Flash Live + FastAPI webhook service |

The agent is a **separate repo** (`lerboi/livekit_agent`) cloned locally at
`C:/Users/leheh/.Projects/livekit-agent/`. This Voco monorepo contains a
mirror at `livekit-agent/` used for plan-authoritative changes + local
pytest; user syncs worktree → sibling repo → GitHub → Railway on redeploy.

### End-to-end call flow

```
Caller dials Twilio number
  │
  ▼
Twilio voice_url → Railway webhook POST /twilio/incoming-call  (Phase 40)
  │   1. Tenant lookup by To-number (_normalize_phone → tenants.phone_number)
  │   2. Subscription check (fail-open: blocked/unknown → AI)
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
  │             - AgentSession(llm=RealtimeModel) starts
  │             - _run_db_queries background tasks (subscription + intake + call insert)
  │             - Egress recording starts after DB task completes
  │             - Gemini 3.1 Flash Live handles audio-to-audio turn
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
| `src/agent.py` | Entrypoint: tenant lookup, Gemini session, Egress, post-call trigger. Phase 58: `fetch_customer_context_with_fanout_telemetry` wrapper around pre-session merged fetch |
| `src/prompt.py` | System prompt builder — modular section builders, Phase 60 STATE+DIRECTIVE format, locale-conditional blocks |
| `src/post_call.py` | Post-call pipeline — triage, notifications, lead creation, booking reconciliation |
| `src/supabase_client.py` | Singleton service-role Supabase client |
| `src/utils.py` | Date formatting, initial slot calculation |
| `src/webhook/__init__.py` | Webhook subpackage + `start_webhook_server` daemon thread |
| `src/webhook/app.py` | FastAPI app — `GET /health`, `GET /health/db`, mounts `/twilio/*` router |
| `src/webhook/twilio_routes.py` | 4 signature-gated POST endpoints + `_is_vip_caller` priority caller check |
| `src/webhook/security.py` | `verify_twilio_signature` FastAPI dep + URL reconstruction from proxy headers |
| `src/webhook/schedule.py` | Pure-function `evaluate_schedule()` + frozen `ScheduleDecision` dataclass |
| `src/webhook/caps.py` | Async `check_outbound_cap()` — monthly outbound-minute cap |
| `src/lib/phone.py` | `_normalize_phone()` module-level helper |
| `src/lib/telemetry.py` | Phase 58: `emit_integration_fetch` + `emit_integration_fetch_fanout` helpers (see `integrations-jobber-xero` skill) |
| `src/tools/__init__.py` | Tool registry — conditional registration based on onboarding |
| `src/tools/book_appointment.py` | Atomic slot booking + calendar sync + SMS |
| `src/tools/check_availability.py` | Real-time slot query + past-date validation |
| `src/tools/capture_lead.py` | Mid-call lead capture on decline |
| `src/tools/check_caller_history.py` | Silent context repeat-caller lookup |
| `src/tools/check_customer_account.py` | Re-serve pre-session Xero/Jobber context |
| `src/tools/transfer_call.py` | SIP REFER transfer to owner phone |
| `src/tools/end_call.py` | Graceful SIP participant disconnect |
| `src/integrations/xero.py` | Xero adapter (Python) — see `integrations-jobber-xero` skill |
| `src/integrations/jobber.py` | Jobber adapter (Python) — see `integrations-jobber-xero` skill |
| `src/lib/booking.py` | Atomic slot booking via Supabase RPC |
| `src/lib/slot_calculator.py` | Available slot calculation |
| `src/lib/leads.py` | Lead creation/merge logic |
| `src/lib/notifications.py` | SMS (Twilio) + Email (Resend) dispatch |
| `src/lib/google_calendar.py` | Google Calendar push |
| `src/lib/whisper_message.py` | Whisper message for warm transfers |
| `src/lib/triage/classifier.py` | Three-layer triage orchestrator |
| `src/lib/triage/layer1_keywords.py` | Regex urgency detection |
| `src/lib/triage/layer2_llm.py` | LLM urgency classification (Groq/Llama 4 Scout) |
| `src/lib/triage/layer3_rules.py` | Owner service-tag override |
| `src/messages/en.json`, `src/messages/es.json` | Agent utterances + notification templates |
| `pyproject.toml`, `Dockerfile`, `livekit.toml`, `sip-*.json` | Build + deploy config |

### Main Repo (`homeservice_agent`, deployed to Vercel)

| File | Role |
|------|------|
| `src/app/api/stripe/webhook/route.js` | Phone provisioning (Twilio purchase) + SIP trunk + webhook URL config |
| `scripts/cutover-existing-numbers.js` | One-time migration of existing tenant numbers to webhook routing |
| `src/app/api/onboarding/test-call/route.js` | LiveKit SIP outbound test call trigger |
| `src/lib/subscription-gate.js` | Subscription enforcement for the agent |
| `src/app/api/cron/send-recovery-sms/route.js` | Recovery SMS cron |
| `src/app/api/notification-settings/route.js` | GET/PATCH `notification_preferences` JSONB |

---

## 1. Agent Service (LiveKit + Gemini)

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
10. `create_tools(deps)` — returns all 6 in-process tools with a shared
    `deps` dict (mutable — filled in as the call progresses).
11. `RealtimeModel` + `VocoAgent` + `AgentSession(llm=model)` — register
    event handlers BEFORE `session.start()` to avoid race conditions.
12. `_run_db_queries` background tasks: subscription check + intake
    questions + calls row insert, as `asyncio.create_task()`.
13. `await session.start(agent=agent, room=ctx.room, room_options=...)` —
    runs in parallel with DB queries.
14. Greeting: `session.generate_reply(instructions="Greet the caller now.")`.
15. DB queries complete:
    - Subscription blocked → disconnect.
    - Intake questions → injected via `session.generate_reply(instructions=...)`.
    - Call record → `deps["call_uuid"]` updated.
16. Egress recording starts after DB task completes.
17. Session close → `_on_close_async` stops egress + runs
    `run_post_call_pipeline()`.
18. `entrypoint()` awaits a `close_complete` asyncio.Event so the LiveKit
    worker keeps the process alive through the post-call pipeline.

### Webhook server boot (Phase 39)

Before `cli.run_app()` in `__main__`, `src/agent.py` calls
`start_webhook_server()` — spawns a daemon thread running uvicorn on port
8080. Serves `/health`, `/health/db`, and `/twilio/*`.

### Critical pin set — livekit-agents + sibling plugins

Both the framework and the three plugins are pinned to `1.5.1`:

```
livekit-agents==1.5.1
livekit-plugins-google (git 43d3734)   — ONLY commit supporting generate_reply on gemini-3.1-flash-live-preview
livekit-plugins-silero==1.5.1
livekit-plugins-turn-detector==1.5.1
```

**Do not bump.** The google plugin at `43d3734` constructs
`llm.RealtimeCapabilities` with 6 fields; PR #5211 (livekit-agents 1.5.2
on Apr 8 2026) added a 7th required field `per_response_tool_choice`.
Any mismatch → `TypeError` at `RealtimeModel.__init__` on every inbound
call. The rationale is duplicated in `pyproject.toml` comments.

**Phase 60.2 Fix J — accepted limitation.** Upstream issue #4486
(`_SegmentSynchronizerImpl.playback_finished` warnings) has no fix.
Commit `3e51d8e` (2026-04-11) on the google plugin was investigated as
an upgrade candidate but ambiguously changes `generate_reply()`
compatibility for `gemini-3.1-flash-live-preview` — declined. Revisit
when #4486 closes.

---

## 2. SIP Configuration

Three JSON files in `livekit-agent/`:

- `sip-inbound-trunk.json` — Twilio media server IP allowlist; Krisp on;
  empty numbers array (all routed via trunk).
- `sip-outbound-trunk.json` — used for outbound test calls.
- `sip-dispatch-rule.json` — `dispatchRuleIndividual` with
  `roomPrefix: "call-"` and `agentName: "voco-voice-agent"`.

Each inbound call creates a unique room. Twilio `voice_url` is the
primary routing lever since Phase 40; SIP trunk preserved as rollback.

---

## 3. Gemini Live Session

```python
realtime_input_config = genai_types.RealtimeInputConfig(
    automatic_activity_detection=genai_types.AutomaticActivityDetection(
        start_of_speech_sensitivity=genai_types.StartSensitivity.START_SENSITIVITY_LOW,
        end_of_speech_sensitivity=genai_types.EndSensitivity.END_SENSITIVITY_LOW,
        prefix_padding_ms=400,
        silence_duration_ms=1500,  # Phase 60.2 Fix G (was 1000 in Phase 55 999.2)
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

### VAD tuning — backlog 999.2 + Phase 60.2 Fix G

The default (`START_SENSITIVITY_HIGH` / `END_SENSITIVITY_HIGH`, ~20ms
prefix padding) fires on breaths + minor overlap and cancels in-flight
responses. Symptoms: `server cancelled tool calls` warnings, mid-sentence
audio cuts, `_SegmentSynchronizerImpl.playback_finished` warning (upstream
`livekit/agents#4441`).

Current config:

- `START_SENSITIVITY_LOW` + `prefix_padding_ms=400` — ~400ms of sustained
  audio required for barge-in.
- `END_SENSITIVITY_LOW` + `silence_duration_ms=1500` — the server waits
  1.5s of silence before treating the caller's turn as finished.

Phase 60.2 Fix G raised `silence_duration_ms` from 1000 → 1500 after the
2026-04-19 UAT captured 2 cancellations per call at 1000ms. 1500ms
cleared that to 0 on the 226s post-fix call. Tradeoff: deliberate
barge-in needs ~1.5s sustained speech.

**Do not switch to `activity_handling=NO_INTERRUPTION`** — kills barge-in
entirely; callers must be able to interrupt for emergencies.

### Voice resolution (Phase 44 AI Voice Selection)

```python
ai_voice = tenant.get("ai_voice") if tenant else None
voice_name = ai_voice if ai_voice else VOICE_MAP.get(tone_preset, "Kore")
```

`VOICE_MAP`:
| tone_preset | Voice | Character |
|-------------|-------|-----------|
| `professional` | Zephyr | Clear and measured |
| `friendly` | Aoede | Upbeat and warm |
| `local_expert` | Achird | Relaxed and neighborly |

6 curated voices available in dashboard AI Voice Settings: Aoede,
Erinome, Sulafat, Zephyr, Achird, Charon. `tenants.ai_voice` has a CHECK
constraint enforcing only these 6 values or NULL.

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
2. **Voice Behavior** — match energy, slow on readbacks, one focused
   question at a time, announce before tool calls.
3. **Corrections** — top-level section: caller correction ALWAYS replaces
   old value; never read back incorrect data. Concrete example included.
4. **Business Hours** — computed from `working_hours` JSON, grouped
   (e.g., "Mon-Fri: 9:00 AM - 5:00 PM"). Includes lunch breaks. Empty if
   `working_hours` is None.
5. **Opening Line** — greeting + recording disclosure.
6. **Language** — default English. Switch only on explicit caller request
   to English / Spanish / Chinese / Malay / Tamil / Vietnamese. Unclear
   speech treated as connection issue, not language barrier.
7. **Repeat Caller** — empty (never reveal prior history; silent context).
8. **Customer Context (Phase 55/56)** — `_build_customer_account_section`
   inserts a STATE+DIRECTIVE block if `customer_context` non-null.
   Field shape from the Xero+Jobber merge; DIRECTIVE forbids volunteering
   balance/invoices. Omitted entirely when None. See
   `integrations-jobber-xero` skill.
9. **Info Gathering (Phase 60 D-01..D-08)** — outcome-framed. Three needed
   before scheduling: issue, name, complete address. Order not forced.
   - NAME USE DURING THE CALL: capture silently; no name vocative
     mid-call. Single on-air confirmation is the booking readback.
     Caller-invited override ("you can call me X") honored.
   - SERVICE ADDRESS: single-question opener "What's the address where
     you need the service?" — replaces the old three-part walkthrough.
     One targeted follow-up per missing piece; never enumerate fields.
   - URGENCY: silent classification; never ask caller to rate; never use
     "emergency/urgent/routine" out loud.
10. **Intake Questions** — trade-specific, injected via
    `session.generate_reply(instructions=...)` after DB query completes.
11. **Booking Protocol (Phase 60 D-02/D-09/D-10)**:
    - SCHEDULING: only after name + issue + confirmed address.
    - AVAILABILITY RULES: every new date/time requires fresh
      `check_availability`; never list slot times.
    - READBACK (mandatory): read name + full address in ONE utterance.
      Accept-and-re-read correction loop until caller stops correcting.
      Address-only if no name captured.
    - AFTER BOOKING: confirm full details, ask if anything else.
12. **Decline Handling** — only when `onboarding_complete=True`. Judgment-
    based, not a two-strike counter. Silence/topic changes/thinking NOT declines.
13. **Transfer Rules** — 2 triggers only: caller asks for human, or 3
    failed clarifications. Transfer-recovery: on fail, offer callback
    booking or capture lead.
14. **Call Duration** — 9-min wrap-up, 10-min hard max. Goal-oriented
    end: speak goodbye, pause, then `end_call`.

### Tool return format (Phase 60 D-16)

All 5 tool returns (book_appointment, capture_lead, transfer_call,
check_availability, check_caller_history) use the strict
`STATE:<code>|DIRECTIVE:<imperative>` format — machine-facing, not
speakable. Every DIRECTIVE ends with "Do not repeat this message text
on-air." `end_call` is untouched (returns a space character).

### Locale-conditional blocks

The three Phase 60 blocks (NAME, SERVICE ADDRESS, READBACK) live as
inline literals in `_build_info_gathering_section` and
`_build_booking_section` with `if locale == "es"` conditionals — NOT
from `messages/*.json`. Spanish uses usted register (D-13/D-14).

Pre-existing Phase 30 structural gap: intro paragraphs, URGENCY,
SCHEDULING, AVAILABILITY RULES remain English-only regardless of locale.
Intentional pre-existing (Pitfall 4) — Phase 60 did NOT retroactively
fix.

---

## 5. Tools (6 in-process)

Registry: `src/tools/__init__.py`. All tools run in-process with direct
Supabase access. Factories return `@function_tool`-decorated callables
with `deps` captured via closure.

**Always available:** `transfer_call`, `capture_lead`,
`check_caller_history`, `check_customer_account`, `end_call`.
**Onboarding-complete gated:** `check_availability`, `book_appointment`.

### check_caller_history — Silent Context

Parallel query: leads (3 most recent) + appointments (3 upcoming).
Phase 60 STATE codes:
- `STATE:repeat_caller prior_appointments=N prior_leads=N` + CONTEXT
  block — directive: use silently, never recite.
- `STATE:first_time_caller` — proceed with normal intake.
- `STATE:history_lookup_failed` (3 error paths) — proceed silently.

### check_availability — Slot Query

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

### book_appointment — Atomic Booking

Parameters: `slot_start`, `slot_end`, `street_name`, `postal_code`,
`caller_name`, `unit_number?`, `urgency` (default "routine").

- Urgency normalization (backlog 999.1 fix): `_normalize_urgency()` maps
  freeform `"high"` → `"urgent"`, `"low"/"normal"` → `"routine"`,
  `"critical"/"asap"` → `"emergency"`. Unknown → `"routine"`.
- **Idempotency cache**: checks `deps["_last_booked_slot_key"]` against
  `f"{slot_start}|{slot_end}"`. Cache hit → return cached response,
  no re-run.
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
- STATE codes: `lead_captured lead_id=...`, `lead_invalid`, `lead_failed`.
- Phase 60 D-11 parity: same single-question address + readback rules as
  book_appointment.
- **Idempotent on `lead_calls` insert.** Mid-call `capture_lead` and the
  post-call pipeline (step 9, `create_or_merge_lead()`) can both route to
  the same (lead_id, call_id) pair. The junction write is an upsert with
  `on_conflict=('lead_id','call_id')` + `ignore_duplicates=true` —
  matches the TS-side `src/lib/leads.js` pattern. A plain INSERT would
  raise `lead_calls_pkey` 23505 on the second call.

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

### end_call — Graceful Termination

Returns a `STATE:call_ending | DIRECTIVE:...` envelope that tells Gemini
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
too early on short ones. Worse, when Gemini called `end_call` mid-farewell,
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
livekit-agents 1.5.1 — the session has no TTS because Gemini Live emits
audio directly. Fix H reverted (commit `cbe1bb9` in livekit-agent repo).
Do not reintroduce `session.say()` on a RealtimeModel-only session
without attaching a separate TTS. Pre-tool filler is now prompt-driven
prose again (`_build_tool_narration_section` in `prompt.py`).

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
4. Usage tracking — `increment_calls_used` RPC; Stripe overage if limit.
5. Language detection — multi-language regex: CJK→zh, Tamil→ta,
   Vietnamese→vi, Spanish→es (keyword ≥2), Malay→ms (≥2), default en.
6. Triage classification — `classify_call()` three-layer pipeline.
7. Suggested slots — unbooked calls get up to 3 slots across next 3 days.
8. Update call with triage + NULL fallback → `booking_outcome='not_attempted'`
   only where still NULL.
9. Create/merge lead — if duration ≥ 15s via `create_or_merge_lead()`.
   Name resolution: `booked_caller_name or _extract_field_from_transcript(...)`.
   Appointment lookup: `booked_appointment_id` preferred over FK query.
10. Owner notifications — SMS/email per outcome preferences. Emergency
    always sends both. `send_owner_sms(from_number=to_number)` (Phase 46
    per-tenant from-number fix; `TWILIO_FROM_NUMBER` retained only as
    dev fallback).

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
  Routine patterns checked FIRST (prevents "not urgent" matching emergency).
- **Layer 2 — LLM** (`layer2_llm.py`): only when Layer 1 not confident.
  Groq + Llama 4 Scout via AsyncOpenAI, JSON mode, temp 0, 5s timeout.
- **Layer 3 — Owner Rules** (`layer3_rules.py`): always runs. Queries
  tenant's services for urgency_tag; escalates if higher severity.

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

`ALLOW_UNSIGNED_WEBHOOKS=true` bypasses verification (dev/staging only).
Fail-closed default.

### Schedule evaluator

`evaluate_schedule(schedule, tenant_timezone, now_utc) -> ScheduleDecision`

Pure function — no DB, no HTTP, no logging. JSONB shape:
`{enabled, days: {mon|...|sun: [{start:"HH:MM", end:"HH:MM"}]}}`.
Overnight ranges (`end < start`) via two-branch check. DST via
`zoneinfo.astimezone()`. Same-day lookup only — Phase 41 UI writes
overnight ranges under both day keys if cross-day matching needed.

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
| `GOOGLE_API_KEY` | Gemini 3.1 Flash Live |
| `SUPABASE_S3_*` (4 vars) | Supabase Storage S3 |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | SMS auth (FROM is dev-fallback only) |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Transactional email |
| `GROQ_API_KEY` | Layer 2 triage |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Calendar OAuth |
| `STRIPE_SECRET_KEY` | Overage billing |
| `NEXT_PUBLIC_APP_URL` | Dashboard links in notifications |
| `SENTRY_DSN` | Error tracking |
| `ALLOW_UNSIGNED_WEBHOOKS` | Dev-only signature bypass |
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
  native Gemini 3.1 support.
- **Gemini 3.1 Flash Live** — native audio-to-audio; no separate STT/TTS.
- **Server VAD only** — client-side Silero caused commit_audio errors and
  self-interruption on SIP calls.
- **asyncio.to_thread() everywhere** — all sync Supabase/Twilio/Resend
  calls wrapped to prevent blocking audio.
- **In-process tool execution** — all 6 tools run directly in the agent
  process; zero webhook round-trips.
- **Single post-call pipeline** — combines `processCallEnded` +
  `processCallAnalyzed` into one function.
- **Silent repeat caller context** — `check_caller_history` instructs AI
  never to mention it.
- **Caller-led booking** — AI never offers times first.
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
- **Past-date validation** — check_availability rejects past dates;
  1-hour buffer for today.
- **`recording_storage_path` at egress start** — safety net for post-call
  failure.
- **Triage never downgrades** — Layer 3 only escalates.
- **Fail-open design** — missing tenant, slots, subscription errors all
  route to AI; no call ever rejected.
- **Webhook routing replaces SIP-only routing (Phase 40)** — `voice_url`
  takes priority; SIP trunk preserved as rollback.
- **Fail-open at every webhook stage** — blocked tenants, unknown
  numbers, subscription errors, schedule evaluation errors, cap errors
  → AI.
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

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `server cancelled tool calls` warnings | VAD too sensitive | Confirm `silence_duration_ms=1500` (Phase 60.2 Fix G) |
| Mid-sentence audio cuts at tool boundaries | Same | Same |
| `TypeError: RealtimeCapabilities.__init__() missing argument 'per_response_tool_choice'` | Plugin pin drift | Restore `livekit-agents==1.5.1` pin trio |
| Post-call pipeline never runs | `close_complete` event missing | Check `entrypoint` awaits event + `done_callback` sets it |
| Recording missing | `recording_storage_path` not written at egress start | Check egress start awaits `db_task` |
| Test call not auto-cancelled | Booking-reconciliation backfill missed | Verify `booked_appointment_id` forwarded from `deps` |
| Webhook 403 on every request | Signature verification failing | Check `TWILIO_AUTH_TOKEN` env; confirm `proxy_headers=True` on uvicorn |
| VIP caller routing to AI | Missing `pickup_numbers` OR `is_vip=false` | Check `tenants.vip_numbers` JSONB + `leads.is_vip` + `pickup_numbers` populated |
| `customer_context` empty despite connected Xero | `error_state` set on row OR 2.5s timeout | Check `accounting_credentials.error_state`; query `activity_log WHERE event_type='integration_fetch'` |
| No `integration_fetch_fanout` rows in activity_log | Railway not redeployed after Phase 58 | Sync Voco worktree → sibling repo → GitHub → Railway |
| Goodbye cut off before "Thank you for calling" completes | Phase 60.3 open issue — end-of-call turn timing race | Needs diagnostic: `end_call` invocation + last-text-token timestamp log |

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

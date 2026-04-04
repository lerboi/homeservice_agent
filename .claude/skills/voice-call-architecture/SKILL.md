---
name: voice-call-architecture
description: "Complete architectural reference for the voice call system — Twilio SIP + LiveKit + Gemini 3.1 Flash Live Python agent, SIP trunking, in-process tool execution, post-call pipeline, triage, scheduling, booking, notifications, and lead management. Use this skill whenever making changes to the call system, voice agent prompts, triage logic, booking flow, post-call pipeline, notifications, lead creation, or any Twilio/LiveKit/Gemini integration. Also use when the user asks about how calls work, wants to modify agent behavior, or needs to debug call-related issues."
---

# Voice Call Architecture — Complete Reference

This document is the single source of truth for the entire voice call system. Read this before making any changes to call-related code.

**Last updated**: 2026-04-02 (Prompt fixes: pacing, language, unit number, address readback. Agent restructure: parallel DB queries + session start. check_availability: time parameter + uncapped slots)

---

## Architecture Overview

Two separate services work together:

| Service | Runtime | Deployment | Purpose |
|---------|---------|------------|---------|
| **Next.js App** | Vercel | Vercel | Dashboard, API routes, cron jobs, Stripe webhooks, phone provisioning |
| **LiveKit Voice Agent** | Python 3.12 | Railway | Real-time AI voice conversation via Gemini 3.1 Flash Live |

The agent is a **separate repo** (`lerboi/livekit_agent`) at `C:/Users/leheh/.Projects/livekit-agent/`.

```
Caller dials Twilio number
       |
  Twilio routes via Elastic SIP Trunk -> LiveKit Cloud
       |                                 (SIP inbound trunk: voco-twilio-inbound)
  LiveKit SIP dispatch rule creates room: "call-{uuid}"
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
| `src/health.py` | HTTP health check server on port 8080 |
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
| `src/app/api/stripe/webhook/route.js` | Phone provisioning (US/CA Twilio purchase, SG inventory) + SIP trunk association |
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
3. **Extract phone numbers** — `sip.trunkPhoneNumber` (to_number for tenant lookup), `sip.phoneNumber` (from_number / caller) from `participant.attributes`
4. **Call ID** — `ctx.room.name` (e.g., `call-{uuid}`) serves as the call identifier
5. **Test call detection** — room metadata `{ test_call: true }` set by test-call route
6. **Tenant lookup** — query `tenants` by `phone_number = to_number` via `asyncio.to_thread()`
7. **Build system prompt** — `build_system_prompt(locale, ...)` immediately after tenant lookup (without intake questions — injected later)
8. **Create tools** — `create_tools(deps)` with mutable `deps` dict (call_uuid=None initially, filled in after call record insert)
9. **Create Gemini session** — `RealtimeModel` + `VocoAgent` + `AgentSession`
10. **Register event handlers** — transcript collection, error handler, close handler (all BEFORE session.start)
11. **Fire DB queries in background** — subscription check, intake questions, call record upsert run as `asyncio.create_task()` (non-blocking)
12. **Start session** — `await session.start(agent=agent, room=ctx.room, room_options=...)` — runs in parallel with DB queries
13. **Greeting** — `session.generate_reply(instructions="Greet the caller now.")` fires immediately after session starts
14. **DB queries complete** — subscription blocked? disconnect. Intake questions? injected via `session.generate_reply(instructions=...)`. Call record? `deps["call_uuid"]` updated.
15. **Start Egress** — `LiveKitAPI().egress.start_room_composite_egress()` -> Supabase S3 (after DB task completes)
16. **Session close** — async handler stops Egress, runs `run_post_call_pipeline()`

### Key Dependencies

```
livekit-agents (>=1.5)           — Agent framework (AgentSession, Agent, WorkerOptions, cli)
livekit-plugins-google (PR#5238) — Gemini RealtimeModel (gemini-3.1-flash-live-preview support)
livekit-plugins-noise-cancellation — BVCTelephony for SIP audio quality
livekit-api (>=1.0)              — LiveKitAPI (egress, room, sip management)
supabase (>=2.0)                 — Database access (service-role)
```

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
model = google.realtime.RealtimeModel(
    model="gemini-3.1-flash-live-preview",
    voice=voice_name,
    temperature=0.3,
    instructions=system_prompt,
    thinking_config=genai_types.ThinkingConfig(
        thinking_level="minimal",
        include_thoughts=False,
    ),
)
```

### Voice Mapping (tone_preset -> Gemini voice)

| `tone_preset` | Voice | Character |
|----------------|-------|-----------|
| `professional` | Zephyr | Clear and measured |
| `friendly` | Aoede | Upbeat and warm |
| `local_expert` | Achird | Relaxed and neighborly |

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

### `build_system_prompt(locale, *, business_name, onboarding_complete, tone_preset, intake_questions)`

The prompt is assembled from modular section builder functions. Conditional sections are filtered via list comprehension.

### Section Order

1. **Identity** — role, tone, conciseness rule
2. **Voice Behavior** — energy matching, pacing, tool announcement. PACING subsection: one question per turn, wait for full response, acknowledge before next question.
3. **Opening Line** — greeting with business name + recording disclosure. Echo awareness.
4. **Language** — default English always. Unclear speech treated as hearing issue ("I didn't catch that"), not language barrier. Only switch if caller explicitly asks. Gather info for unsupported languages.
5. **Repeat Caller** — empty (all calls treated as new — never reveal prior history)
6. **Info Gathering** — collect issue, name, then address (postal/zip, street name, unit/apartment number). ADDRESS CONFIRMATION: read full address back, wait for caller to confirm, re-read if corrected. Urgency classified silently.
7. **Intake Questions** — trade-specific questions asked naturally (injected via `session.generate_reply` after DB query completes)
8. **Booking Protocol** — caller-led scheduling flow:
   - Never list available slots unprompted — ask the caller when they prefer
   - If they give day without time, ask for time; if time without day, ask for day
   - Call check_availability with specific date+time for every time the caller asks about — never assume from earlier results
   - If unavailable, offer 2-3 closest alternatives
   - Handle edge cases (vague, ASAP, fully booked) by narrowing to specific date+time
9. **Decline Handling** — two-strike: first decline = soft re-offer, second = capture_lead
10. **Transfer Rules** — only 2 triggers: caller asks for human, or 3 failed clarifications
11. **Call Duration** — 9-minute wrap-up warning, 10-minute hard max

### Translation Keys (`messages/en.json`, `messages/es.json`)

Both files contain two top-level sections:
- `agent.*` — recording_disclosure, language_clarification, capture_name, etc.
- `notifications.*` — booking_confirmation, recovery_sms_attempted_routine, recovery_sms_attempted_emergency

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
- Returns natural-language summary BUT instructs AI to **never mention history to the caller**
- AI uses context silently (e.g., avoids re-asking known name/address)
- Only references history if the caller explicitly asks

### `check_availability` — Real-Time Slot Query

**File**: `src/tools/check_availability.py`

- Parameters: `date` (optional YYYY-MM-DD), `time` (optional HH:MM 24h format), `urgency` (optional)
- Fetches tenant config + 4 scheduling tables in parallel via `asyncio.gather()`
- Calculates slots using `calculate_available_slots()` with `max_slots=50` (effectively unlimited)
- **Specific time check**: when both `date` and `time` provided, checks if that exact slot is available. Returns yes + start/end for booking, or no + 3 closest alternatives.
- **General check**: when only `date` (or neither), returns all available slots for the day(s)
- Tool description instructs AI to call this for every time the caller asks about — never rely on cached results

### `book_appointment` — Atomic Slot Booking

**File**: `src/tools/book_appointment.py`

- Parameters: `slot_start`, `slot_end`, `service_address`, `caller_name`, `urgency`
- Calls `atomic_book_slot()` via Supabase RPC
- **On success**: calendar push (fire-and-forget), booking_outcome='booked', caller SMS
- **On slot taken**: recalculates next available (parallel queries), booking_outcome='attempted', recovery SMS
- Recovery SMS tracks pending/sent/retrying status in calls table

### `capture_lead` — Lead Capture on Decline

**File**: `src/tools/capture_lead.py`

- Parameters: `caller_name` (required), `phone`, `address`, `job_type`, `notes` (optional)
- Computes mid-call duration from `start_timestamp` (milliseconds)
- Calls `create_or_merge_lead()`, writes booking_outcome='declined'

### `transfer_call` — SIP REFER Transfer

**File**: `src/tools/transfer_call.py`

- Parameters: `caller_name`, `job_type`, `urgency`, `summary`, `reason` (all optional)
- Writes `exception_reason` to calls record
- Performs SIP REFER via `LiveKitAPI().sip.transfer_sip_participant()`
- Destination: `sip:{ownerPhone}@pstn.twilio.com`

### `end_call` — Graceful Termination

**File**: `src/tools/end_call.py`

- Returns a space character immediately
- After 7-second `asyncio.sleep()`: removes SIP participant via `LiveKitAPI().room.remove_participant()`
- Delay allows farewell audio to play before disconnection

---

## 6. Post-Call Pipeline

**File**: `src/post_call.py`

Runs immediately when the AgentSession closes (in-process, no webhook delay).

### `run_post_call_pipeline(params)`

1. **Build transcript** — `transcript_text` (string) + `transcript_structured` (JSON list)
2. **Update call record** — status='analyzed', transcript, recording path, disconnection_reason
3. **Test call auto-cancel** — cancel appointment + reset lead if `is_test_call`
4. **Usage tracking** — `increment_calls_used` RPC; Stripe overage if limit_exceeded
5. **Language detection** — Spanish markers regex (>=2 matches -> 'es', else 'en')
6. **Triage classification** — `classify_call()` three-layer pipeline
7. **Suggested slots** — for unbooked calls, next 3 slots from tomorrow
8. **Update call with triage** — urgency, confidence, layer, language, notification_priority
9. **Create/merge lead** — if duration >= 15s, via `create_or_merge_lead()`
10. **Owner notifications** — SMS/email per outcome preferences, emergency always sends both

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
            filepath=f"{call_id}.mp4",
            s3=api.S3Upload(...)
        )],
    )
)
```

- **Storage**: Supabase Storage -> `call-recordings` bucket via S3 protocol
- **Format**: MP4 (audio-only)
- **Lifecycle**: starts after session begins, stops on session close

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
- **Greeting via system prompt**: Gemini starts speaking automatically from the OPENING LINE section — no `generate_reply()` call needed.
- **Noise cancellation**: `BVCTelephony` for SIP calls, `BVC` for WebRTC — improves audio quality without interfering with VAD.
- **Atomic booking via Postgres advisory locks**: `book_appointment_atomic` RPC with `tstzrange` overlap checking.
- **Triage never downgrades**: Layer 3 can only escalate urgency.
- **Fail-open design**: Missing tenant, slots, or subscription errors don't block calls.

---

## Important: Keeping This Document Updated

When making changes to any file listed in the File Map above, update the relevant sections of this skill document to reflect the new behavior. This ensures future conversations always have an accurate reference.

When modifying the agent repo (`lerboi/livekit_agent`), remember to update this skill file in the main repo (`homeservice_agent`).

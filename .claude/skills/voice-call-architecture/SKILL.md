---
name: voice-call-architecture
description: "Complete architectural reference for the voice call system — WebSocket LLM server, Retell webhooks, agent prompts, triage pipeline, scheduling, booking, notifications, and lead management. Use this skill whenever making changes to the call system, voice agent prompts, triage logic, booking flow, call processing pipeline, notifications, lead creation, or any Retell/Groq/Twilio integration. Also use when the user asks about how calls work, wants to modify agent behavior, or needs to debug call-related issues."
---

# Voice Call Architecture — Complete Reference

This document is the single source of truth for the entire voice call system. Read this before making any changes to call-related code.

**Last updated**: 2026-03-26 (Phase 23-01: processCallEnded now calls increment_calls_used RPC for real calls >= 10 seconds — usage tracking added after isTestCall block)

---

## Architecture Overview

Two separate processes work together:

| Process | Runtime | Port | Purpose |
|---------|---------|------|---------|
| **Next.js App** | Vercel | 3000 | Webhooks, dashboard, cron jobs |
| **WebSocket LLM Server** | Railway (standalone Node.js) | 8081 | Real-time AI voice conversation via Groq |

```
Caller dials Retell number
       ↓
  Retell sends call_inbound webhook → Next.js /api/webhooks/retell
       ↓                               (tenant lookup, slot calc, returns dynamic_variables)
  Retell connects WebSocket → Railway wss://url/llm-websocket/{call_id}
       ↓                       (streams Groq responses back to Retell for TTS)
       ↓  During call: AI uses 4 tools
       ↓    capture_lead → webhook handler → createOrMergeLead() (mid-call lead)
       ↓    end_call     → WebSocket sends end_call:true to Retell
       ↓    transfer_call → webhook handler → retell.call.transfer() with whisper_message
       ↓    book_appointment → webhook handler → atomicBookSlot()
  Call ends → call_ended webhook → processCallEnded()
       ↓
  ~Minutes later → call_analyzed webhook → processCallAnalyzed()
       ↓                                    (recording upload, triage, lead creation, notifications)
  ~60s after call → Recovery SMS cron (urgency-aware, delivery tracking, exponential backoff retry)
  During call (slot taken) → Real-time recovery SMS via after() in handleBookAppointment
```

---

## File Map

| File | Role |
|------|------|
| `C:/Users/leheh/.Projects/Retell-ws-server/server.js` | WebSocket LLM server (Railway production) |
| `C:/Users/leheh/.Projects/Retell-ws-server/agent-prompt.js` | Agent prompt builder (Railway production) |
| `src/app/api/webhooks/retell/route.js` | All Retell webhook event handling |
| `src/lib/whisper-message.js` | Whisper message builder for warm transfers |
| `src/lib/call-processor.js` | Post-call pipeline (recording, triage, leads, notifications) |
| `src/lib/triage/classifier.js` | Three-layer triage orchestrator |
| `src/lib/triage/layer1-keywords.js` | Regex urgency detection |
| `src/lib/triage/layer2-llm.js` | LLM urgency classification (Groq) |
| `src/lib/triage/layer3-rules.js` | Owner service tag override |
| `src/lib/scheduling/slot-calculator.js` | Available slot calculation |
| `src/lib/scheduling/booking.js` | Atomic slot booking (Postgres advisory lock) |
| `src/lib/scheduling/google-calendar.js` | Calendar sync + push notifications |
| `src/lib/leads.js` | Lead creation and merge logic |
| `src/lib/notifications.js` | SMS (Twilio) + Email (Resend) dispatch |
| `src/app/api/cron/send-recovery-sms/route.js` | Recovery SMS cron job |
| `src/app/api/onboarding/test-call/route.js` | Onboarding test call trigger — passes `test_call: 'true'` in dynamic variables |
| `messages/en.json` | English agent utterances |
| `messages/es.json` | Spanish agent utterances |
| `supabase/migrations/003_scheduling.sql` | Scheduling schema + `book_appointment_atomic` function |
| `supabase/migrations/004_leads_crm.sql` | Leads + activity_log schema |
| `supabase/migrations/008_call_outcomes.sql` | booking_outcome, exception_reason, notification_priority columns |
| `supabase/migrations/009_recovery_sms_tracking.sql` | Recovery SMS delivery tracking columns (recovery_sms_status, recovery_sms_retry_count, recovery_sms_last_error, recovery_sms_last_attempt_at) |
| `supabase/migrations/013_usage_events.sql` | usage_events idempotency table + increment_calls_used RPC (Phase 23) |

---

## 1. WebSocket LLM Server

**File**: `C:/Users/leheh/.Projects/Retell-ws-server/server.js` (Railway production)
**Prompt**: `C:/Users/leheh/.Projects/Retell-ws-server/agent-prompt.js`

**How it works**: Retell connects via WebSocket for each call. The server receives conversation transcripts, sends them to Groq for inference, and streams response tokens back to Retell for text-to-speech.

### Connection Lifecycle

1. **Connection opens** — server extracts `call_id` from URL path `/llm-websocket/{call_id}`
2. **Config sent** — `{ response_type: "config", config: { auto_reconnect: true, call_details: true } }`
3. **call_details received** — extracts `retell_llm_dynamic_variables`, builds system prompt, sends locale-aware greeting (from messages JSON files), starts 5s TTS guard
4. **Greeting TTS guard** — `response_required`/`reminder_required` messages are suppressed for 5 seconds after greeting is sent. Without this, ambient noise triggers Groq during TTS playback and Retell cuts off the greeting mid-sentence.
5. **Conversation loop** — receives `response_required`/`reminder_required`, calls Groq, streams back
6. **Tool calls** — Groq returns `finish_reason: "tool_calls"` → server sends `tool_call_invocation` to Retell → waits for `tool_call_result` → calls Groq again with result (except `end_call` — see below). **Chained tool calls supported**: if Groq returns another tool call after processing a tool result (e.g., `end_call` after `capture_lead`), it's accumulated and dispatched — same logic as the initial tool call handler.
7. **Connection closes** — cleanup

### Message Types Handled

| `interaction_type` | Action |
|---|---|
| `ping_pong` | Echo back with same timestamp |
| `call_details` | Build prompt, set tools, send greeting |
| `response_required` | Call Groq with transcript, stream response |
| `reminder_required` | Same as above + inject "caller silent" nudge |
| `tool_call_result` | Continue conversation with tool result (skip Groq for end_call) |
| `update_only` | Ignored (transcript update, no response needed) |

### Groq Configuration

```
Model: meta-llama/llama-4-scout-17b-16e-instruct
Temperature: 0.3
Max tokens: 500
Streaming: true
SDK: openai (Groq-compatible base URL)
```

### Tool Definitions

**`transfer_call`** — Always available. Optional parameters for whisper message context:
- `caller_name` (string, optional) — caller full name if captured
- `job_type` (string, optional) — type of job or service needed
- `urgency` (enum: `emergency`|`routine`|`high_ticket`, optional) — urgency level
- `summary` (string, optional) — 1-line summary for the receiving human
- `reason` (enum: `caller_requested`|`clarification_limit`, optional) — why the transfer is happening. Webhook uses this for `exception_reason` column; falls back to summary heuristic if not provided
- `required: []` — all parameters optional (AI provides whatever it has captured)

**`capture_lead`** — Always available (NOT gated by onboarding_complete). Parameters:
- `caller_name` (string, optional)
- `phone` (string, optional)
- `address` (string, optional)
- `job_type` (string, optional)
- `notes` (string, optional)
- `required: []` — all parameters optional

**`end_call`** — Always available (NOT gated by onboarding_complete). No parameters. Sends `end_call: true` to Retell — bypasses Groq continuation entirely.

**`book_appointment`** — Only when `onboarding_complete === true`. Parameters:
- `slot_start` (ISO 8601, required)
- `slot_end` (ISO 8601, required)
- `service_address` (string, required)
- `caller_name` (string, required)
- `urgency` (enum: `emergency`|`routine`|`high_ticket`, required)

**Tool ordering**: `transfer_call`, `capture_lead`, `end_call`, then conditionally `book_appointment`.

### end_call Handler

When `tool_call_result` arrives for `end_call`, the server skips Groq entirely and sends:
```js
{
  response_type: 'response',
  response_id: responseId,
  content: 'Thank you for calling. Have a great day!',
  content_complete: true,
  end_call: true,
}
```

---

## 2. Agent System Prompt

**File**: `C:/Users/leheh/.Projects/Retell-ws-server/agent-prompt.js`

### `buildSystemPrompt(locale, { business_name, onboarding_complete, tone_preset })`

The prompt is constructed from modular section builder functions assembled per call. Each section is a separate builder function — composable and developer-controlled (not tenant-configurable from dashboard).

### Core Identity
```
You are a professional AI receptionist for {business_name}. You are warm, friendly, calm, and speak at a moderate pace.
```

### Personality (varies by tone_preset)
- `professional` → "measured and formal"
- `friendly` → "upbeat and warm"
- `local_expert` → "relaxed and neighborly"

### Recording Notice
Always states: "This call may be recorded for quality purposes."

### Greeting
- **With onboarding**: "Hello, thank you for calling {business_name}. {recording_disclosure} {capture_job_type}"
- **Without onboarding**: "{recording_disclosure} {default_greeting}"

### Language Instructions
- Detect caller language from first utterance
- Respond exclusively in caller's language
- If uncertain, ask: "Would you prefer English or Spanish?"
- If unsupported language: apologize, gather name/phone/issue, tag as LANGUAGE_BARRIER
- Switch language mid-conversation if caller switches

### Information Gathering
- Ask for name, service address, and issue description
- Capture all details before attempting any action

### BOOKING-FIRST PROTOCOL (only when onboarding_complete)

The AI books every caller by default — no caller goes without a booking offer.

1. **Answer first, then pivot**: For info-only or quote calls, answer the question first, then naturally offer a slot ("I can get you on the schedule if you'd like")
2. **Quote reframe**: "To give you an accurate quote, we'd need to see the space. Let me book a time for {owner} to come take a look."
3. **Offer slots**: Present 2-3 available slots from `available_slots` data
4. **Address read-back**: Mandatory — must wait for verbal "yes" before booking
5. **Book**: Invoke `book_appointment` only after slot selected + name + address confirmed

#### URGENCY DETECTION
Urgency affects slot selection only — tone stays unified (no emergency/routine tone split):
- Emergency cues ("pipe burst", "gas leak", "flooding"): offer same-day/nearest slots first
- Routine cues ("next month", "no rush", "whenever"): offer next available in order

### DECLINE HANDLING (only when onboarding_complete)

Two-strike decline pattern:
- **First decline**: Soft re-offer — "No problem — if you change your mind, I can book anytime."
- **Second explicit decline**: Invoke `capture_lead` with whatever info was gathered, confirm: "I've saved your info — {business_name} will reach out." Then invoke `end_call`.
- Only explicit verbal decline counts ("no thanks", "not right now") — passive non-engagement is not a decline.

### CALL TRANSFER

Two exception states only (D-06, D-07):

#### EXPLICIT REQUEST
If caller says "let me talk to a person" or similar: instant transfer, zero friction.
- AI says: "Absolutely, let me connect you now."
- Invoke `transfer_call` immediately with whatever context is available.

#### CLARIFICATION LIMIT
After 3 failed clarification attempts (2 standard + 1 "Could you describe what you're seeing?"):
- Invoke `transfer_call` with whatever context was captured.

No other transfer triggers (no language barrier transfer, no emotional distress transfer).

### Call Duration
- After 9 minutes: begin wrap-up
- 10-minute hard maximum

### Available Slots
Appended at the end of the prompt when present:
```
AVAILABLE APPOINTMENT SLOTS:
1. Monday March 23rd at 10 AM
2. Monday March 23rd at 2 PM
...
```

### Translation Keys (messages/en.json and messages/es.json)
Only the `agent` section is used by the voice system:
- `default_greeting`, `recording_disclosure`, `language_clarification`
- `unsupported_language_apology`, `call_wrap_up`, `transfer_attempt`
- `capture_name`, `capture_address`, `capture_job_type`
- `fallback_no_booking`, `language_barrier_escalation`

---

## 3. Whisper Message Builder

**File**: `src/lib/whisper-message.js`

### `buildWhisperMessage({ callerName, jobType, urgency, summary })`

Builds the D-08 whisper template for warm transfers: `"[Name] calling about [job type]. [Emergency/Routine]. [1-line summary]."`

All parameters are optional with graceful fallbacks:
- Missing `callerName` → "Unknown caller"
- Missing `jobType` → "unspecified job"
- Missing `urgency` → treated as Routine
- `urgency === 'emergency'` → "Emergency"; all others (routine, high_ticket) → "Routine"
- Missing `summary` → omitted (no trailing space)

---

## 4. Retell Webhook

**File**: `src/app/api/webhooks/retell/route.js`

**Endpoint**: `POST /api/webhooks/retell`

### Signature Verification
```js
Retell.verify(rawBody, process.env.RETELL_API_KEY, signature)
```
Returns 401 if invalid. Body must be read as text first for HMAC integrity.

### Event: `call_inbound`
Synchronous — must respond fast (within Retell timeout).

1. Look up tenant by `to_number` from `tenants` table
2. If no tenant: return defaults (`onboarding_complete: false`)
3. Fetch in parallel: appointments, calendar_events, service_zones, zone_travel_buffers
4. Calculate available slots (today + next 2 days, up to 6 slots)
5. Format slots as numbered list with timezone conversion
6. Return `dynamic_variables`: `business_name`, `default_locale`, `onboarding_complete`, `caller_number`, `tenant_id`, `owner_phone`, `tone_preset`, `available_slots`, `booking_enabled`

These variables are injected into the WebSocket call_details message.

### Event: `call_ended`
Non-blocking via `after()`. Calls `processCallEnded()`. Returns `{ received: true }` immediately.

### Event: `call_analyzed`
Non-blocking via `after()`. Calls `processCallAnalyzed()`. Fires ~minutes after call ends.

### Event: `call_function_invoked`

**`end_call`**:
- Safety guard — end_call is handled by WebSocket server (sends end_call:true).
- If it reaches the webhook: return `{ result: 'Call ending.' }` and acknowledge.

**`capture_lead`**:
1. Resolve tenant from call record: `calls.select('id, tenant_id, from_number, start_timestamp').eq('retell_call_id', call_id)`
2. Compute `durationSeconds` from `start_timestamp` to current time (avoids 15s short-call filter)
3. Call `createOrMergeLead()` with all AI-provided fields
4. Write `booking_outcome: 'declined'` to calls record (D-02)
5. Look up `business_name` for personalized confirmation message
6. Return: `"I've saved your information. {bizName} will reach out soon."`
7. On error: return `"I've noted your details and someone will follow up."`

**`transfer_call`**:
1. Look up call → tenant → `owner_phone` (two-hop query)
2. Build whisper message via `buildWhisperMessage({ callerName, jobType, urgency, summary })` from AI-provided arguments
3. Call `retell.call.transfer({ call_id, transfer_to: ownerPhone, whisper_message: whisperMsg })`
4. Return `transfer_initiated` or graceful fallback if no phone configured
5. Write `exception_reason` to calls record (`clarification_limit` or `caller_requested`, inferred from summary)

**`book_appointment`**:
1. Resolve tenant via calls → tenants
2. Call `atomicBookSlot()` with all parameters
3. On slot_taken: recalculate next available, return alternative speech
4. On success: async push to Google Calendar via `after()`
5. Return confirmation speech
6. On success: async write `booking_outcome: 'booked'` via `after()`
7. On success: async send caller SMS confirmation via `sendCallerSMS()` (locale from detected_language or tenant default_locale)
8. On failure: async write `booking_outcome: 'attempted'` via `after()`
9. On failure: async send real-time recovery SMS via `sendCallerRecoverySMS()` in second `after()` block (Phase 17 RECOVER-01)

---

## 5. Call Processor

**File**: `src/lib/call-processor.js`

### `processCallEnded(call)`
Lightweight. Upserts `calls` row with: `from_number`, `to_number`, `direction`, `disconnection_reason`, timestamps, `retell_metadata`.

**Test call auto-cancel (Phase 18 D-08):** After the upsert, checks `metadata?.test_call === 'true'` OR `metadata?.retell_llm_dynamic_variables?.test_call === 'true'`. If `isTestCall && tenantId`:
1. Queries `appointments` for a row with matching `retell_call_id` and `tenant_id`.
2. If found: sets `appointments.status = 'cancelled'`.
3. Resets associated `leads.status = 'new'` and nullifies `leads.appointment_id` (prevents dashboard showing "booked" lead with no active calendar appointment — Pitfall 6).

The `test_call: 'true'` flag is set in `test-call/route.js` as a `retell_llm_dynamic_variables` entry when triggering the onboarding test call. Auto-cancel fires at `call_ended` (not `call_analyzed`) so the calendar clears immediately after the call, not minutes later.

**Usage Tracking (Phase 23):**
After the test call auto-cancel block, `processCallEnded()` conditionally calls the `increment_calls_used` RPC:
- **Duration filter**: `durationSeconds = Math.round((end_timestamp - start_timestamp) / 1000)` — computed from raw timestamps (NOT the `duration_seconds` generated column which isn't returned by the upsert). RPC only called when duration >= 10 seconds — short calls skip the RPC entirely.
- **Test call exclusion**: Reuses `isTestCall` already in scope — no RPC call for test calls.
- **Tenant guard**: Skipped if `tenantId` is null (no tenant found for this number).
- **RPC call**: `supabase.rpc('increment_calls_used', { p_tenant_id: tenantId, p_call_id: call_id })`
- **Error-resilient**: Entire block wrapped in try/catch — RPC failures logged (`[usage] increment_calls_used RPC error:` and `[usage] increment failed (non-fatal):`) but never thrown (D-06: billing counter glitch must not lose call data)
- **Runs inside `after()` callback** — non-blocking to webhook response (D-01)
- **RPC returns** `{ success, calls_used, calls_limit, limit_exceeded }` — logged for observability, not used for enforcement (Phase 25 will add enforcement)

### `processCallAnalyzed(call)`
Heavy pipeline:
1. Tenant lookup by `to_number`
2. Download recording → upload to Supabase Storage (`call-recordings/{call_id}.wav`)
3. Language barrier detection (check against `SUPPORTED_LANGUAGES: ['en', 'es']`)
4. Triage classification via 3-layer pipeline
5. Check if appointment exists for this call
6. If unbooked (no appointment for this call, any urgency): calculate suggested slots (next 3 from tomorrow)
7a. Compute notification_priority from urgency (emergency/high_ticket → 'high', routine → 'standard')
7b. Upsert `calls` with all analyzed data including notification_priority (does NOT include booking_outcome) — chains `.select('id').single()` to retrieve the Supabase UUID (`callUuid`) for downstream lead creation
7c. Conditional update: set `booking_outcome='not_attempted'` where `booking_outcome IS NULL`
8. Create/merge lead via `createOrMergeLead()` using `callUuid` (NOT the Retell string `call_id`) — guarded: skips lead creation if UUID retrieval failed
9. Send owner notifications (SMS + email) via `sendOwnerNotifications()`

---

## 6. Triage System

**Directory**: `src/lib/triage/`

Three-layer pipeline. Layer 3 can only ESCALATE, never downgrade.

### Layer 1 — Keywords (`layer1-keywords.js`)
Synchronous regex matching. Checks routine patterns first (to prevent false positives), then emergency patterns:
- Routine: `quote`, `estimate`, `next week`, `no rush`, `whenever`
- Emergency: `flooding`, `gas leak`, `no heat`, `sewer backup`, `pipe burst`, `electrical fire`, `carbon monoxide`, `emergency`, `happening now`

### Layer 2 — LLM (`layer2-llm.js`)
Only called when Layer 1 is NOT confident. Uses Groq with JSON mode, temperature 0.
Classifies into: `emergency` (immediate safety risk), `high_ticket` (>$500), `routine` (future scheduling).

### Layer 3 — Owner Rules (`layer3-rules.js`)
Always runs as final step. Checks tenant's `services` table for `urgency_tag` values. Matches detected service name → uses that service's tag. Otherwise takes highest severity across all services. Severity: `emergency(3) > high_ticket(2) > routine(1)`.

### Orchestrator (`classifier.js`)
Pipeline: Layer1 → (if confident) Layer3 → return. Or Layer1 → Layer2 → Layer3 → return. Short transcripts (<10 chars) short-circuit to routine.

---

## 7. Scheduling System

### Slot Calculator (`src/lib/scheduling/slot-calculator.js`)

`calculateAvailableSlots()` — pure function, no DB access.

Inputs: `workingHours` (per day), `slotDurationMins`, `existingBookings`, `externalBlocks` (Google Calendar), `zones`, `zonePairBuffers`, `targetDate`, `tenantTimezone`, `maxSlots`.

Algorithm: Walk forward from day open time in slot-duration steps, skipping slots that overlap lunch, existing bookings, calendar blocks, or violate travel buffers.

Travel buffer: no zones = 30 min flat. Same zone = 0. Cross-zone = lookup or default 30 min.

### Atomic Booking (`src/lib/scheduling/booking.js`)

Calls Supabase RPC `book_appointment_atomic`:
1. Postgres advisory lock: `pg_try_advisory_xact_lock(abs(hashtext(tenant_id || epoch(start_time))))`
2. Check overlapping appointments via `tsrange` overlap
3. If overlap: return `{ success: false, reason: "slot_taken" }`
4. If clear: insert appointment, return `{ success: true, appointment_id }`

Secondary defense: `UNIQUE (tenant_id, start_time)` constraint.

### Google Calendar (`src/lib/scheduling/google-calendar.js`)

- `pushBookingToCalendar()` — creates event, adds `[URGENT]` prefix for emergencies
- `syncCalendarEvents()` — incremental sync via `last_sync_token`, full re-sync on 410
- `registerWatch()` — push notification channel with 7-day TTL
- `revokeAndDisconnect()` — cleanup

---

## 8. Notification System

**File**: `src/lib/notifications.js`

### `sendOwnerSMS()`
Twilio SMS to owner. Emergency format: `"EMERGENCY: {businessName} — {name} needs urgent {job} at {addr}. Call NOW: {callbackLink} | Dashboard: {dashboardLink}"`. Non-emergency: `"{businessName}: New booking — {name}, {job} at {addr}. Callback: {callbackLink} | Dashboard: {dashboardLink}"`.

### `sendOwnerEmail()`
Resend email with React Email template.

### `sendCallerRecoverySMS({ to, callerName, businessName, locale, urgency, bookingLink })`
Urgency-aware recovery SMS to callers whose booking failed. Phase 17:
- **Signature**: accepts `locale` ('en'|'es'), `urgency` ('emergency'|'routine'|'high_ticket'), `bookingLink` (D-10 placeholder — accepted but unused). `ownerPhone` removed per D-09.
- **Returns**: `{ success: boolean, sid?: string, error?: { code: string|number, message: string } }` — structured return, not fire-and-forget
- **Emergency**: `recovery_sms_attempted_emergency` template — empathetic urgency tone ("your situation is time-sensitive")
- **Routine/other**: `recovery_sms_attempted_routine` template — standard warm tone ("sorry we couldn't get your appointment booked")
- **i18n**: `locale === 'es'` selects Spanish templates via `interpolate()` + JSON import; falls back to 'en' for unknown locales
- **Null guard**: `to` missing → `{ success: false, error: { code: 'NO_PHONE' } }` without calling Twilio

### `sendCallerSMS()`
Booking confirmation SMS to caller: "Your appointment with {business_name} is confirmed for {date} at {time} at {address}." Multi-language (en/es) via direct JSON import of messages files. Fire-and-forget — errors logged but never thrown. Null guard on `to` prevents Twilio calls when no phone number.

### `sendOwnerNotifications()`
Fires SMS + email in parallel via `Promise.allSettled()`.

### Recovery SMS Cron (`src/app/api/cron/send-recovery-sms/route.js`)
Runs every minute. Phase 17 two-branch design:

**Branch A — First-send for not_attempted / legacy calls:**
Finds `status='analyzed'`, `recovery_sms_sent_at IS NULL`, `recovery_sms_status IS NULL`, ended >60s ago, `booking_outcome = 'not_attempted'` (Pitfall 4: only not_attempted). Skips calls <15s and booked calls. Sends urgency-aware recovery SMS (uses `urgency_classification` + `detected_language` from calls row — Pitfall 2). Writes delivery status: `pending` → `sent` or `retrying`.

**Branch B — Retry for failed deliveries:**
Finds `recovery_sms_status = 'retrying'` with `recovery_sms_retry_count < 3`. Respects exponential backoff: 30s before 2nd attempt, 120s before 3rd. After 3 total attempts, sets `recovery_sms_status = 'failed'` permanently (D-14).

**DB columns (migration 009):** `recovery_sms_status` (pending/sent/failed/retrying), `recovery_sms_retry_count`, `recovery_sms_last_error`, `recovery_sms_last_attempt_at`.

**Real-time trigger**: `handleBookAppointment` in webhook route fires recovery SMS via `after()` when `atomicBookSlot` fails (slot taken). Uses `args.urgency` from AI tool args (not DB field — Pitfall 1). Writes `pending` → `sent`/`retrying` status to DB. On exception, writes `retrying` for cron pickup.

---

## 9. Lead Management

**File**: `src/lib/leads.js`

### `createOrMergeLead()` Flow
1. Skip calls <15 seconds (misdial/voicemail) — callDuration must be >= 15
2. Check for open lead (same `tenant_id` + `from_number`, status `new` or `booked`)
3. Repeat caller → attach to existing lead via `lead_calls` junction
4. New caller → insert `leads` row (status: `booked` if appointment, else `new`)
5. Insert `activity_log` entry

Statuses: `new` → `booked` → `completed` → `paid` / `lost`

**Mid-call invocation (capture_lead)**: When called from the `capture_lead` webhook handler, `callDuration` is computed from `start_timestamp` to current time — not from a post-call field — ensuring the 15s filter is satisfied for any real conversation.

---

## 10. End-to-End Call Flows

### Flow A: Booking
Caller dials → `call_inbound` webhook (slot calc) → WebSocket connects → AI conversation (BOOKING-FIRST PROTOCOL) → caller selects slot → `book_appointment` tool → atomic booking → Google Calendar sync → call ends → recording upload → triage → lead created (status: `booked`) → owner SMS + email

### Flow B: Transfer to Owner
Caller explicitly requests human (or 3 clarification attempts exhausted) → AI invokes `transfer_call` with caller context → webhook builds whisper message → Retell transfers with `whisper_message` → if fails, agent reassures caller → call ends → lead created (status: `new`) → owner notified

### Flow C: Language Barrier
Unsupported language detected → agent apologizes → gathers what info possible → tags LANGUAGE_BARRIER → call ends → `language_barrier: true` stored → lead created → owner notified

### Flow D: Routine No-Book + Recovery
Caller doesn't book → call ends → triage: routine → suggested slots calculated → lead created (status: `new`) → owner notified → ~60s later: recovery SMS sent to caller with booking link

### Flow E: Decline → Lead Capture
Caller declines booking first time → AI soft re-offer ("No problem — if you change your mind, I can book anytime") → caller declines again → AI invokes `capture_lead` with all gathered info → webhook handler creates lead immediately via `createOrMergeLead()` (duration computed from start_timestamp) → AI confirms "I've saved your information. {bizName} will reach out soon." → AI invokes `end_call` → WebSocket sends `end_call: true` to Retell → call ends

---

## 11. Database Tables

| Table | Purpose |
|---|---|
| `tenants` | Business config: phone, name, locale, hours, tone, timezone |
| `calls` | Full call record: metadata, transcript, recording, triage, language flags, booking_outcome, exception_reason, notification_priority |
| `appointments` | Bookings. `UNIQUE(tenant_id, start_time)`. Links to call + Google Calendar |
| `services` | Service catalog with `urgency_tag` for Layer 3 triage |
| `service_zones` | Geographic zones for travel buffers |
| `zone_travel_buffers` | Travel time between zone pairs |
| `calendar_credentials` | Google OAuth + watch channel state |
| `calendar_events` | Mirror of Google Calendar events |
| `leads` | CRM records. Realtime-enabled for live dashboard |
| `lead_calls` | Junction: many calls → one lead |
| `activity_log` | Dashboard event feed |

---

## 12. Environment Variables

| Variable | Service | Purpose |
|---|---|---|
| `RETELL_API_KEY` | Retell | SDK auth + webhook HMAC verification |
| `GROQ_API_KEY` | Groq | LLM inference (WS server + Layer 2 triage) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase | Client-side auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | Server-side (bypasses RLS) |
| `TWILIO_ACCOUNT_SID` | Twilio | SMS auth |
| `TWILIO_AUTH_TOKEN` | Twilio | SMS auth |
| `TWILIO_FROM_NUMBER` | Twilio | SMS sender |
| `RESEND_API_KEY` | Resend | Email API |
| `GOOGLE_CLIENT_ID` | Google | OAuth |
| `GOOGLE_CLIENT_SECRET` | Google | OAuth |
| `NEXT_PUBLIC_APP_URL` | App | Base URL for links |
| `CRON_SECRET` | Vercel | Cron endpoint auth |
| `WS_PORT` / `PORT` | WS Server | WebSocket port (default 8081) |

---

## 13. Key Design Decisions

- **WebSocket separate from Next.js**: Next.js doesn't support WS upgrades → standalone process on Railway
- **`after()` for async work**: Heavy processing deferred until after HTTP response → stays within Retell's timeout
- **Atomic booking via Postgres advisory locks**: Prevents double-booking under concurrent calls
- **Triage never downgrades**: Layer 3 can only escalate urgency (safety decision)
- **Slot calculation is pure**: No DB access, fully testable
- **Lead merge for repeat callers**: Same `from_number` → attach to existing open lead
- **Service role client for webhooks**: Bypasses RLS for server-side cross-tenant access
- **Booking-first AI**: Every caller gets a booking offer by default; info-only calls pivot after answering; quotes convert to site visits
- **Two transfer triggers only**: Explicit human request + 3 clarification failures (D-06, D-07)
- **Unified tone**: No emergency/routine tone split — urgency affects slot priority only (D-11, D-12)
- **Whisper message on transfer**: AI passes caller context; webhook builds structured whisper for receiving human (D-08)
- **Mid-call lead capture**: `capture_lead` tool creates lead immediately during call — no post-call wait for declined callers (D-14, D-15)
- **end_call bypasses Groq**: WebSocket handles end_call in handleToolResult before Groq call — sends end_call:true directly (D-14)
- **Chained tool calls supported**: handleToolResult now handles `finish_reason: 'tool_calls'` — enables multi-step flows like capture_lead → end_call without dropping the second tool call
- **Locale-aware greeting**: server.js reads greeting text from messages/{locale}.json with `{business_name}` interpolation — Spanish-default tenants hear Spanish greeting
- **Prompt greeting deduplication**: agent-prompt.js greeting section says "already greeted, do not repeat" — prevents AI from re-greeting after the 5s TTS guard expires
- **Slot-taken recalculation accuracy**: handleBookAppointment fetches real appointments/events before recalculating next available slot — no longer offers potentially-taken slots
- **Book_appointment error fallback**: if Groq fails after booking tool result, uses webhook confirmation text instead of generic fallback — caller hears the actual confirmation
- **Transfer reason explicit**: transfer_call tool accepts `reason` enum (caller_requested/clarification_limit) — webhook uses it for exception_reason, falls back to summary heuristic
- **booking_outcome set real-time**: booked/attempted/declined written during live call via `after()`; not_attempted defaulted post-call with conditional `WHERE IS NULL` update
- **notification_priority decoupled from urgency**: separate column maps emergency/high_ticket→high, routine→standard; Phase 16 reads this column, not urgency directly
- **Caller SMS confirmation**: sent via `after()` in handleBookAppointment after successful booking; locale from detected_language or tenant default_locale; uses i18n JSON templates
- **Recovery SMS real-time trigger**: second `after()` in handleBookAppointment slot-taken branch fires recovery SMS immediately; uses `args.urgency` NOT `calls.urgency_classification` (processCallAnalyzed hasn't run yet — Pitfall 1)
- **Recovery SMS urgency-aware**: emergency → empathetic-urgency template; routine/other → warm standard template; locale fallback chain: detected_language → tenant.default_locale → 'en'
- **Recovery SMS structured return**: `{ success, sid?, error? }` enables real-time delivery status writes to DB (pending → sent/retrying); cron retries on 'retrying' status
- **Recovery SMS exponential backoff**: 30s before 2nd attempt, 120s before 3rd; max 3 total attempts; permanent 'failed' after exhaustion (D-14)
- **Recovery cron two-branch**: Branch A for not_attempted first-send; Branch B for retrying status; both write delivery tracking columns from migration 009
- **processCallAnalyzed UUID retrieval**: The calls upsert chains `.select('id').single()` to get the Supabase UUID (`callUuid`). This is critical because the Retell `call_id` (e.g., "call_337593af...") is a text string, not a UUID — passing it to `createOrMergeLead` would fail with `22P02` on `leads.primary_call_id` and `lead_calls.call_id` (both UUID FK columns). The webhook handlers (`capture_lead`, `book_appointment`) already do this correctly via a separate query; `processCallAnalyzed` now matches that pattern.
- **Test call auto-cancel**: `test-call/route.js` passes `test_call: 'true'` in `retell_llm_dynamic_variables`; `processCallEnded` checks this flag and cancels any appointment + resets lead status — owner experiences booking-first flow during onboarding without cluttering the real calendar (D-07, D-08)

---

## Important: Keeping This Document Updated

When making changes to any file listed in the File Map above, update the relevant sections of this skill document to reflect the new behavior. This ensures future conversations always have an accurate reference.

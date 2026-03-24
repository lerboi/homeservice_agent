---
name: voice-call-architecture
description: "Complete architectural reference for the voice call system — WebSocket LLM server, Retell webhooks, agent prompts, triage pipeline, scheduling, booking, notifications, and lead management. Use this skill whenever making changes to the call system, voice agent prompts, triage logic, booking flow, call processing pipeline, notifications, lead creation, or any Retell/Groq/Twilio integration. Also use when the user asks about how calls work, wants to modify agent behavior, or needs to debug call-related issues."
---

# Voice Call Architecture — Complete Reference

This document is the single source of truth for the entire voice call system. Read this before making any changes to call-related code.

**Last updated**: 2026-03-24

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
  Call ends → call_ended webhook → processCallEnded()
       ↓
  ~Minutes later → call_analyzed webhook → processCallAnalyzed()
       ↓                                    (recording upload, triage, lead creation, notifications)
  ~60s after call → Recovery SMS cron (for unbooked callers)
```

---

## File Map

| File | Role |
|------|------|
| `src/server/retell-llm-ws.js` | WebSocket LLM server (main codebase version) |
| `retell-ws-server/server.js` | WebSocket LLM server (standalone deploy version) |
| `retell-ws-server/agent-prompt.js` | Agent prompt builder (standalone deploy version) |
| `src/lib/agent-prompt.js` | System prompt construction |
| `src/lib/retell-agent-config.js` | Retell agent config + tool definitions |
| `src/app/api/webhooks/retell/route.js` | All Retell webhook event handling |
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
| `messages/en.json` | English agent utterances |
| `messages/es.json` | Spanish agent utterances |
| `supabase/migrations/003_scheduling.sql` | Scheduling schema + `book_appointment_atomic` function |
| `supabase/migrations/004_leads_crm.sql` | Leads + activity_log schema |

---

## 1. WebSocket LLM Server

**Files**: `src/server/retell-llm-ws.js` (dev), `retell-ws-server/server.js` (deploy)

**How it works**: Retell connects via WebSocket for each call. The server receives conversation transcripts, sends them to Groq for inference, and streams response tokens back to Retell for text-to-speech.

### Connection Lifecycle

1. **Connection opens** — server extracts `call_id` from URL path `/llm-websocket/{call_id}`
2. **Config sent** — `{ response_type: "config", config: { auto_reconnect: true, call_details: true } }`
3. **call_details received** — extracts `retell_llm_dynamic_variables`, builds system prompt, sends greeting
4. **Conversation loop** — receives `response_required`/`reminder_required`, calls Groq, streams back
5. **Tool calls** — Groq returns `finish_reason: "tool_calls"` → server sends `tool_call_invocation` to Retell → waits for `tool_call_result` → calls Groq again with result
6. **Connection closes** — cleanup

### Message Types Handled

| `interaction_type` | Action |
|---|---|
| `ping_pong` | Echo back with same timestamp |
| `call_details` | Build prompt, set tools, send greeting |
| `response_required` | Call Groq with transcript, stream response |
| `reminder_required` | Same as above + inject "caller silent" nudge |
| `tool_call_result` | Continue conversation with tool result |
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

**`transfer_call`** — Always available. No parameters. Transfers call to business owner.

**`book_appointment`** — Only when `onboarding_complete === true`. Parameters:
- `slot_start` (ISO 8601, required)
- `slot_end` (ISO 8601, required)
- `service_address` (string, required)
- `caller_name` (string, required)
- `urgency` (enum: `emergency`|`routine`|`high_ticket`, required)

---

## 2. Agent System Prompt

**File**: `src/lib/agent-prompt.js`

### `buildSystemPrompt(locale, { business_name, onboarding_complete, tone_preset })`

The prompt is constructed dynamically based on tenant configuration. Here is the full structure:

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

### Capabilities
- **With booking**: Can capture info AND book appointments (follows BOOKING FLOW)
- **Without booking**: Can only capture info, tells caller someone will follow up

### Booking Flow (only when onboarding_complete)
8-step protocol:
1. Identify need (service type + urgency)
2. Offer 2-3 available slots from `available_slots` data
3. Collect service address
4. **Mandatory address read-back** — must wait for verbal "yes"
5. Book appointment (only after slot selected + name + address confirmed)
6. Confirm booking to caller
7. Handle slot-taken (offer next available)
8. Handle routine decline (save info, owner will follow up)

Emergency calls: urgent tone, earliest slot. Routine calls: relaxed, no pressure.

### Triage-Aware Behavior (only when onboarding_complete)
- Emergency (flooding, gas, fire): faster, more direct speech
- Routine: relaxed approach

### Call Transfer
1. FIRST capture name, phone, issue
2. Say "Let me transfer you to the team now."
3. Invoke `transfer_call`
4. If fails: "I've noted your information and someone from our team will follow up shortly."

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

## 3. Agent Config

**File**: `src/lib/retell-agent-config.js`

Used when creating/updating the Retell agent via API (not during live calls).

### Voice Settings by Tone Preset
| Preset | voice_speed | responsiveness |
|--------|------------|---------------|
| professional | 0.95 | 0.75 |
| friendly | 1.05 | 0.85 |
| local_expert | 0.90 | 0.80 |

### Fixed Settings
- `interruption_sensitivity`: 0.7
- `ambient_sound`: "off"
- `max_call_duration_ms`: 600000 (10 minutes)
- `language`: "multilingual"

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

**`transfer_call`**:
1. Look up call → tenant → `owner_phone`
2. Call `retell.call.transfer({ call_id, transfer_to: ownerPhone })`
3. Return success/failure speech text

**`book_appointment`**:
1. Resolve tenant via calls → tenants
2. Call `atomicBookSlot()` with all parameters
3. On slot_taken: recalculate next available, return alternative speech
4. On success: async push to Google Calendar via `after()`
5. Return confirmation speech

---

## 5. Call Processor

**File**: `src/lib/call-processor.js`

### `processCallEnded(call)`
Lightweight. Upserts `calls` row with: `from_number`, `to_number`, `direction`, `disconnection_reason`, timestamps, `retell_metadata`.

### `processCallAnalyzed(call)`
Heavy pipeline:
1. Tenant lookup by `to_number`
2. Download recording → upload to Supabase Storage (`call-recordings/{call_id}.wav`)
3. Language barrier detection (check against `SUPPORTED_LANGUAGES: ['en', 'es']`)
4. Triage classification via 3-layer pipeline
5. Check if appointment exists for this call
6. If routine + unbooked: calculate suggested slots (next 3 from tomorrow)
7. Upsert `calls` with all analyzed data
8. Create/merge lead via `createOrMergeLead()`
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
Twilio SMS to owner: "{businessName}: New {urgency} lead -- {callerName}, {jobType} at {address}..."

### `sendOwnerEmail()`
Resend email with React Email template.

### `sendCallerRecoverySMS()`
Warm text to unbooked callers: "Hi {name}, thanks for calling {business}. Book online at {link} or call back at {phone}."

### `sendOwnerNotifications()`
Fires SMS + email in parallel via `Promise.allSettled()`.

### Recovery SMS Cron (`src/app/api/cron/send-recovery-sms/route.js`)
Runs every minute. Finds calls where: `status='analyzed'`, `recovery_sms_sent_at IS NULL`, ended >60s ago. Skips calls <15s and booked calls. Sends recovery SMS to `from_number`.

---

## 9. Lead Management

**File**: `src/lib/leads.js`

### `createOrMergeLead()` Flow
1. Skip calls <15 seconds (misdial/voicemail)
2. Check for open lead (same `tenant_id` + `from_number`, status `new` or `booked`)
3. Repeat caller → attach to existing lead via `lead_calls` junction
4. New caller → insert `leads` row (status: `booked` if appointment, else `new`)
5. Insert `activity_log` entry

Statuses: `new` → `booked` → `completed` → `paid` / `lost`

---

## 10. End-to-End Call Flows

### Flow A: Booking
Caller dials → `call_inbound` webhook (slot calc) → WebSocket connects → AI conversation → caller selects slot → `book_appointment` tool → atomic booking → Google Calendar sync → call ends → recording upload → triage → lead created (status: `booked`) → owner SMS + email

### Flow B: Transfer to Owner
Caller wants human → agent captures info first → `transfer_call` tool → Retell transfers → if fails, agent reassures caller → call ends → lead created (status: `new`) → owner notified

### Flow C: Language Barrier
Unsupported language detected → agent apologizes → gathers what info possible → tags LANGUAGE_BARRIER → call ends → `language_barrier: true` stored → lead created → owner notified

### Flow D: Routine No-Book + Recovery
Caller doesn't book → call ends → triage: routine → suggested slots calculated → lead created (status: `new`) → owner notified → ~60s later: recovery SMS sent to caller with booking link

---

## 11. Database Tables

| Table | Purpose |
|---|---|
| `tenants` | Business config: phone, name, locale, hours, tone, timezone |
| `calls` | Full call record: metadata, transcript, recording, triage, language flags |
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

---

## Important: Keeping This Document Updated

When making changes to any file listed in the File Map above, update the relevant sections of this skill document to reflect the new behavior. This ensures future conversations always have an accurate reference.

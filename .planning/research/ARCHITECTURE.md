# Architecture Research

**Domain:** AI voice receptionist with real-time scheduling and CRM (home services SaaS)
**Researched:** 2026-03-18
**Confidence:** MEDIUM — web access was unavailable; based on training data (cutoff August 2025) covering Vapi, Retell, Google Calendar API, and voice AI system design patterns. Flag for verification against current Vapi/Retell docs before implementation.

---

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                        TELEPHONY LAYER                               │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │  Vapi / Retell  (PSTN inbound, STT, TTS, session mgmt)     │     │
│  └──────────────────────────┬────────────────────────────────┘      │
│                             │  webhooks / tool-call requests         │
└─────────────────────────────┼────────────────────────────────────────┘
                              │
┌─────────────────────────────▼────────────────────────────────────────┐
│                        APPLICATION LAYER                             │
│                                                                      │
│  ┌──────────────┐  ┌───────────────┐  ┌───────────────────────┐     │
│  │ Voice Event  │  │ Triage Engine │  │  Scheduler Service    │     │
│  │ Gateway      │  │ (classify     │  │  (slot locking,       │     │
│  │ (webhooks)   │  │  emergency vs │  │   calendar sync,      │     │
│  └──────┬───────┘  │  routine)     │  │   booking)            │     │
│         │          └───────┬───────┘  └──────────┬────────────┘     │
│         │                  │                     │                   │
│  ┌──────▼──────────────────▼─────────────────────▼────────────┐     │
│  │                   Core API Server (REST/JSON)               │     │
│  └──────────────────────────────────────────────────────────┬─┘     │
│                                                             │        │
│  ┌───────────────────┐  ┌─────────────────────────────────┐ │        │
│  │  Notification     │  │  CRM / Lead Pipeline Service    │ │        │
│  │  Service          │  │  (state machine, audit log)     │ │        │
│  │  (SMS/email/push) │  └─────────────────────────────────┘ │        │
│  └───────────────────┘                                      │        │
└─────────────────────────────────────────────────────────────┼────────┘
                                                              │
┌─────────────────────────────────────────────────────────────▼────────┐
│                        DATA LAYER                                    │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐                 │
│  │  Postgres   │  │  Redis       │  │  Object      │                 │
│  │  (primary   │  │  (slot lock  │  │  Storage     │                 │
│  │   records)  │  │   cache,     │  │  (recordings,│                 │
│  │             │  │   sessions)  │  │  transcripts)│                 │
│  └─────────────┘  └──────────────┘  └──────────────┘                 │
└──────────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼────────────────────────────────────────┐
│                    EXTERNAL INTEGRATIONS                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │ Google       │  │ Microsoft    │  │ Twilio/      │               │
│  │ Calendar API │  │ Graph API    │  │ Vonage       │               │
│  │ (OAuth 2.0)  │  │ (Outlook)    │  │ (phone #     │               │
│  └──────────────┘  └──────────────┘  │  provisioning│               │
│                                      └──────────────┘               │
└──────────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼────────────────────────────────────────┐
│                        CLIENT LAYER                                  │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │  Web Dashboard (Next.js)  —  Owner-facing SPA                │    │
│  │  Leads pipeline │ Calendar view │ Settings │ Call recordings  │    │
│  └──────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Telephony Platform (Vapi/Retell) | Inbound PSTN call handling, STT, LLM orchestration, TTS, call session lifecycle | Managed SaaS — no self-hosting required |
| Voice Event Gateway | Receives webhooks from Vapi/Retell (`call-started`, `end-of-call-report`, `tool-calls`), validates signatures, routes to handlers | Express/Fastify middleware, verified webhook endpoint |
| Triage Engine | Classifies call as emergency vs routine using keyword rules + LLM-extracted urgency signals + owner-configured service tiers | Pure function / rule engine; receives structured transcript segments or LLM tool-call output |
| Scheduler Service | Queries available slots, atomically locks a slot, creates booking record, triggers calendar sync | Database transaction + Redis distributed lock; exposes book/cancel/reschedule operations |
| Calendar Sync Service | Bidirectional sync with Google Calendar and Outlook; resolves external events that block availability | OAuth token manager + Google Calendar API + Microsoft Graph API; runs on webhook push + polling fallback |
| CRM / Lead Pipeline Service | Manages lead state machine (new → contacted → booked → completed → paid), stores caller details, job type, urgency, address, notes | State machine in Postgres; appends events to audit log |
| Notification Service | Fires SMS/email/push alerts to business owner on new leads, emergency calls, and booking confirmations | Twilio SMS + SendGrid/Resend email + Web Push; queue-backed |
| Core API Server | Unified REST API consumed by the dashboard; orchestrates above services | Node.js/Next.js API routes or standalone Express; JWT-authenticated |
| Web Dashboard | Owner-facing SPA for lead management, calendar, settings, onboarding, call recordings | Next.js App Router; mobile-responsive |
| Object Storage | Stores call recordings and transcripts linked to lead records | S3-compatible (AWS S3 or Cloudflare R2) |

---

## Recommended Project Structure

```
src/
├── app/                      # Next.js App Router (UI + API routes)
│   ├── (dashboard)/          # Owner-facing pages (auth-gated)
│   │   ├── leads/            # Lead pipeline view
│   │   ├── calendar/         # Availability and bookings
│   │   ├── settings/         # Business config, services, tiers
│   │   └── calls/            # Call recordings and transcripts
│   ├── api/
│   │   ├── webhooks/
│   │   │   └── voice/        # Vapi/Retell event endpoint
│   │   ├── leads/            # Lead CRUD
│   │   ├── bookings/         # Booking + slot management
│   │   ├── calendar/         # Availability windows + sync
│   │   └── notifications/    # Notification preferences
│   └── auth/                 # NextAuth / Clerk routes
│
├── lib/
│   ├── voice/
│   │   ├── gateway.ts        # Webhook signature verification + routing
│   │   ├── triage.ts         # Emergency vs routine classification
│   │   └── prompts.ts        # System prompt templates per business
│   ├── scheduler/
│   │   ├── slots.ts          # Available slot query logic
│   │   ├── lock.ts           # Redis-based atomic slot locking
│   │   └── booking.ts        # Booking create/cancel/reschedule
│   ├── calendar/
│   │   ├── google.ts         # Google Calendar OAuth + API client
│   │   ├── outlook.ts        # Microsoft Graph OAuth + API client
│   │   └── sync.ts           # Bidirectional sync coordinator
│   ├── crm/
│   │   ├── lead.ts           # Lead state machine
│   │   └── pipeline.ts       # Stage transitions + validation
│   ├── notifications/
│   │   ├── sms.ts            # Twilio SMS
│   │   ├── email.ts          # SendGrid/Resend
│   │   └── push.ts           # Web Push
│   └── db/
│       ├── schema.ts         # Drizzle/Prisma schema
│       └── client.ts         # Database client singleton
│
├── workers/                  # Background jobs (if using queue)
│   ├── calendar-sync.ts      # Periodic sync for polling fallback
│   └── notification.ts       # Async notification dispatch
│
└── types/                    # Shared TypeScript types
    ├── voice.ts              # Vapi/Retell event shapes
    ├── lead.ts               # Lead and booking types
    └── business.ts           # Business config types
```

### Structure Rationale

- **app/api/webhooks/voice/:** Isolated webhook endpoint with dedicated signature verification — never mixed with regular API routes to prevent accidental auth bypass.
- **lib/voice/:** Voice-specific logic (triage, prompts) separated from scheduler — triage emits a classification result that the scheduler consumes, not a direct dependency.
- **lib/scheduler/lock.ts:** Slot locking extracted into its own module because it crosses the Redis/Postgres boundary and requires careful transaction semantics.
- **lib/calendar/:** Each provider has its own client file because OAuth token refresh and API shapes differ significantly between Google and Microsoft.
- **workers/:** Anything that must not block the webhook response (calendar sync, async notifications) lives here to run off the critical path.

---

## Architectural Patterns

### Pattern 1: Tool-Call / Function-Calling for Real-Time Actions

**What:** Vapi and Retell both support LLM "tool calls" (function calling) during a live call. When the LLM decides it needs to book a slot, it emits a tool-call event. Your server receives this as an HTTP POST, executes the action (query slots, lock, book), and returns the result synchronously so the LLM can speak the confirmation.

**When to use:** Any action that must happen during the live call and be confirmed to the caller — slot availability checks, booking confirmation, triage classification.

**Trade-offs:** Response must be fast (< 1-2 seconds to avoid awkward silence). Keep tool implementations lean — no slow external API chains in the hot path.

**Confidence:** HIGH — this is the standard Vapi/Retell integration pattern as of mid-2025.

**Example:**
```typescript
// lib/voice/gateway.ts
export async function handleToolCall(event: VapiToolCallEvent) {
  switch (event.toolName) {
    case 'check_availability':
      const slots = await getAvailableSlots(event.args.date, event.businessId);
      return { available_slots: slots };

    case 'book_appointment':
      const booking = await atomicBookSlot({
        businessId: event.businessId,
        slotId: event.args.slot_id,
        caller: event.args.caller_details,
      });
      return { booking_id: booking.id, confirmed_time: booking.startTime };

    default:
      return { error: 'Unknown tool' };
  }
}
```

### Pattern 2: Atomic Slot Locking with Redis + Postgres

**What:** When a caller requests a slot, acquire a Redis lock on the slot key before writing to Postgres. This prevents the race condition where two simultaneous calls grab the same slot. Lock TTL is set to the maximum expected booking transaction time (e.g., 10 seconds). On Postgres write success, lock is released. On failure, lock expires automatically.

**When to use:** Any booking write — this is non-negotiable given the PROJECT.md requirement for zero double-bookings.

**Trade-offs:** Adds Redis as an infrastructure dependency. Lock TTL must be tuned — too short risks false conflict, too long blocks legitimate concurrent callers unnecessarily.

**Confidence:** HIGH — Redis distributed locking (Redlock pattern) is the standard solution for this class of problem.

**Example:**
```typescript
// lib/scheduler/lock.ts
const LOCK_TTL_MS = 10_000;

export async function atomicBookSlot(params: BookingParams): Promise<Booking> {
  const lockKey = `slot:${params.slotId}`;
  const lock = await redis.set(lockKey, params.callId, 'NX', 'PX', LOCK_TTL_MS);

  if (!lock) throw new SlotUnavailableError(params.slotId);

  try {
    const booking = await db.transaction(async (tx) => {
      // Verify slot still open inside transaction
      const slot = await tx.query.slots.findFirst({
        where: and(eq(slots.id, params.slotId), eq(slots.status, 'available')),
        for: 'update', // row-level lock in Postgres
      });
      if (!slot) throw new SlotUnavailableError(params.slotId);

      return await tx.insert(bookings).values({ ...params, slotId: params.slotId }).returning();
    });
    return booking[0];
  } finally {
    await redis.del(lockKey); // always release
  }
}
```

### Pattern 3: Lead State Machine with Event Log

**What:** Rather than mutating a `status` column directly, model lead lifecycle as a state machine (new → contacted → booked → confirmed → completed) and append each transition to an immutable event log. The current state is derived from the latest event.

**When to use:** CRM pipeline where audit trail matters (call recordings, dispatcher confirmations, payment status).

**Trade-offs:** Slightly more complex than a single status column but provides full history with timestamps and actor (AI vs owner vs system). Avoids lost-update problems.

**Confidence:** MEDIUM — standard event-sourcing-lite pattern, well established but more complex than needed for an MVP. A simpler status column with an updated_at timestamp may suffice for phase 1 if audit trail is not a launch requirement.

**Example:**
```typescript
// lib/crm/lead.ts
type LeadStatus = 'new' | 'contacted' | 'booked' | 'confirmed' | 'completed' | 'lost';

const VALID_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  new:       ['contacted', 'lost'],
  contacted: ['booked', 'lost'],
  booked:    ['confirmed', 'lost'],
  confirmed: ['completed', 'lost'],
  completed: [],
  lost:      [],
};

export async function transitionLead(leadId: string, to: LeadStatus, actor: string) {
  const lead = await db.query.leads.findFirst({ where: eq(leads.id, leadId) });
  if (!VALID_TRANSITIONS[lead.status].includes(to)) {
    throw new InvalidTransitionError(lead.status, to);
  }
  await db.update(leads).set({ status: to, updatedAt: new Date() }).where(eq(leads.id, leadId));
  await db.insert(leadEvents).values({ leadId, fromStatus: lead.status, toStatus: to, actor });
}
```

---

## Data Flow

### Inbound Call Flow (Happy Path — Emergency Booking)

```
Caller dials phone number
    │
    ▼
Vapi/Retell (PSTN → STT → LLM session starts)
    │  LLM emits tool-call: "classify_call"
    ▼
Voice Event Gateway (POST /api/webhooks/voice)
    │  validates signature, routes tool-call
    ▼
Triage Engine
    │  keyword match + LLM urgency signals → "emergency"
    ▼
Gateway returns tool-call result to Vapi/Retell
    │  LLM says "I'll book you right now" → emits "check_availability"
    ▼
Scheduler Service (getAvailableSlots)
    │  queries Postgres slots table (filtered by business calendar + Google/Outlook blocks)
    ▼
Gateway returns available slots to LLM
    │  LLM offers slot, caller confirms → LLM emits "book_appointment"
    ▼
Scheduler Service (atomicBookSlot)
    │  Redis lock → Postgres transaction → booking record created
    ▼
CRM Service (createLead → status: "booked")
    │
    ▼
Notification Service (async, off hot path)
    │  SMS + email + push to business owner
    ▼
Vapi/Retell call ends → "end-of-call-report" webhook fires
    │
    ▼
Voice Event Gateway stores transcript + recording URL → linked to lead record
```

### Calendar Sync Flow

```
Google/Outlook calendar event created/modified
    │  (push notification via webhook subscription)
    ▼
Calendar Sync Service receives change notification
    │
    ▼
Fetch updated event details from Google/Microsoft API
    │
    ▼
Map external event → block internal availability slots
    │  (Postgres: mark slots as 'blocked' for overlap window)
    ▼
Invalidate any cached availability for affected business
```

### Dashboard Data Flow

```
Owner opens Lead Pipeline view
    │
    ▼
Next.js page (server component) → Core API: GET /api/leads
    │
    ▼
API queries Postgres (leads + bookings + lead_events)
    │
    ▼
Returns paginated lead list with status + latest event
    │
    ▼
Client hydrates; real-time updates via polling or WebSocket (optional v1)
```

### Key Data Flows Summary

1. **Tool-call hot path:** Vapi/Retell → webhook → triage/scheduler → synchronous JSON response → LLM speaks result. Must complete in < 2 seconds.
2. **Booking commit:** Webhook handler → Redis lock → Postgres transaction → booking record + lead record created atomically.
3. **Async fan-out:** After booking, notifications (SMS/email/push) and transcript storage are queued and processed outside the webhook response cycle.
4. **Calendar availability:** Derived at query time by joining internal slots against Google/Outlook blocked periods. Cached in Redis with short TTL (30-60 seconds) to avoid repeated external API calls during active calls.
5. **Lead lifecycle:** Every state transition appended to event log; dashboard reads from materialized lead status column updated in the same transaction.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-100 businesses | Monolith is fine. Single Next.js app + Postgres + Redis. No queue needed; fire-and-forget async with `Promise.resolve().then(...)` or lightweight `setImmediate`. |
| 100-1k businesses | Add a proper job queue (BullMQ on Redis) for notifications and calendar sync. Consider read replicas for dashboard queries if lead volume grows. Webhook handler remains critical path — keep it fast. |
| 1k-10k businesses | Separate the webhook handler service from the dashboard API (can scale independently). Calendar sync becomes a dedicated worker pool. Redis cluster for slot locking if concurrent booking volume spikes. |
| 10k+ businesses | Consider separate microservices for voice, scheduling, and CRM. Multi-region Postgres (Neon or PlanetScale) if global latency matters. But this is premature for v1. |

### Scaling Priorities

1. **First bottleneck:** Webhook response latency. If the tool-call handler is slow (> 1.5s), callers hear silence. Fix: optimize slot query with proper indexes, cache availability in Redis, keep tool handlers pure and fast.
2. **Second bottleneck:** Calendar sync rate limits. Google Calendar API has per-user quotas. Fix: cache aggressively, use push webhooks instead of polling, implement exponential backoff on 429s.
3. **Third bottleneck:** Notification throughput. If 100 calls come in simultaneously, 100 SMS/email jobs queue up. Fix: BullMQ with concurrency limits and Twilio/SendGrid rate-aware retries.

---

## Anti-Patterns

### Anti-Pattern 1: Booking Inside Webhook Without Distributed Lock

**What people do:** Query available slots and insert a booking in a single Postgres query inside the webhook handler, without any locking.

**Why it's wrong:** Two simultaneous calls for the same business can both pass the "is slot available?" check before either has committed, resulting in a double-booking. Postgres transaction isolation at READ COMMITTED does not prevent this race.

**Do this instead:** Redis `SET NX` lock on the slot key before the Postgres transaction. Combined with `SELECT FOR UPDATE` inside the transaction as a belt-and-suspenders second check.

### Anti-Pattern 2: Calling Google Calendar API in the Webhook Hot Path

**What people do:** When the LLM calls "check_availability", query Google Calendar API in real-time to see if the owner is free.

**Why it's wrong:** Google Calendar API p99 latency can be 500-1500ms. Chained with slot query and Postgres write, you'll routinely exceed the 2-second threshold for natural-sounding voice AI. Callers hear awkward pauses.

**Do this instead:** Maintain a local mirror of the owner's calendar in Postgres/Redis, updated by push webhooks from Google/Outlook. Serve availability queries from the local mirror — never from the external API in the hot path.

### Anti-Pattern 3: One Vapi/Retell Assistant Configuration for All Businesses

**What people do:** Create one assistant in Vapi/Retell with a generic system prompt, and try to handle all business context at runtime via tool calls.

**Why it's wrong:** Business-specific configuration (services offered, greeting name, emergency types, service zones) needs to be in the system prompt at call-start for the LLM to behave correctly throughout the call. Fetching it mid-call via tool calls is fragile and slow.

**Do this instead:** Dynamically generate a business-specific system prompt at call-start time. Vapi supports `serverMessages` and `assistantOverrides` on a per-call basis — use these to inject business context before the LLM speaks its first word.

### Anti-Pattern 4: Storing Recordings Locally Instead of Object Storage

**What people do:** Save Vapi/Retell call recordings to the local server filesystem.

**Why it's wrong:** Files are lost on redeploy, can't be served with signed URLs, and don't scale.

**Do this instead:** Upload recordings to S3 or Cloudflare R2 immediately on receipt of the `end-of-call-report` webhook. Store only the object URL in Postgres, linked to the lead record. Generate short-lived signed URLs for dashboard playback.

### Anti-Pattern 5: Polling Google/Outlook Calendar on Every Availability Check

**What people do:** Call Google Calendar API every time a caller asks "are you free Thursday afternoon?"

**Why it's wrong:** Rate limits, latency, and cost compound as business count grows. This hits Google's per-user API quotas quickly under load.

**Do this instead:** Subscribe to Google Calendar push notifications (webhook channel) and Outlook change notifications. On each push, update the local mirror. Poll as a fallback only when push notifications fail or the subscription expires.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Vapi | Webhook receiver + REST API (assistant config, call history) | Signature verification required on all incoming webhooks. Tool-call responses must be synchronous and fast. Confidence: HIGH |
| Retell AI | WebSocket-based custom LLM server OR REST webhook mode | Retell's "custom LLM" mode allows full control over response generation; webhook mode is simpler for most cases. Confidence: HIGH |
| Google Calendar API | OAuth 2.0 (per business owner), push notifications, Events API | Store refresh tokens encrypted in Postgres. Push notification channels expire every 7 days — must re-register. Confidence: HIGH |
| Microsoft Graph API (Outlook) | OAuth 2.0, change notifications (subscriptions), Calendar API | Similar pattern to Google but different scopes and subscription renewal logic. Confidence: MEDIUM |
| Twilio SMS | REST API, outbound SMS for owner notifications | Use messaging service SID for production (not raw phone numbers) to get send queuing and geo-routing. Confidence: HIGH |
| SendGrid / Resend | REST API, transactional email | Resend is a simpler modern alternative; SendGrid has more deliverability tooling. Either works for v1. Confidence: HIGH |
| Cloudflare R2 / AWS S3 | S3-compatible API, pre-signed URLs | R2 is cheaper for egress (free egress); AWS S3 is more standard. Confidence: HIGH |
| Auth provider (Clerk / NextAuth) | SDK-level, session management | Clerk is faster to set up; NextAuth gives more control. Either works. Confidence: HIGH |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Webhook Gateway ↔ Triage Engine | Direct function call (same process) | Keep in-process — must be fast. Do not make this an HTTP boundary for v1. |
| Webhook Gateway ↔ Scheduler Service | Direct function call (same process) | Same rationale — on the hot path, in-process is required. |
| Scheduler Service ↔ Redis | Redis client (ioredis) | Slot lock acquisition. TTL must be set on every lock — never acquire without a TTL. |
| Scheduler Service ↔ Postgres | ORM/query builder (Drizzle or Prisma) | All booking writes must be in a transaction. Never partial writes. |
| CRM Service ↔ Notification Service | Async (BullMQ job queue or Promise chain for v1) | Do NOT block the booking confirmation on notification delivery. Fire and forget with retry. |
| Calendar Sync ↔ Scheduler | Postgres (shared data store) | Calendar sync writes to `calendar_blocks` table; Scheduler reads it when computing availability. No direct service call needed. |
| Dashboard API ↔ All services | Next.js API routes calling service functions | Server components can call service functions directly — no HTTP hop needed within Next.js. |

---

## Suggested Build Order (Phase Dependencies)

Based on the component dependency graph above, the natural build order is:

1. **Foundation (database schema + auth):** All other components depend on Postgres schema and authenticated API. Build schema (leads, bookings, slots, businesses, calendar_blocks) first. Add auth gating to API routes.

2. **Business onboarding + configuration:** The voice agent needs business context (services, tiers, greeting, availability windows) to function. Onboarding UI and API must exist before voice integration can be tested end-to-end.

3. **Scheduling core (without calendar sync):** Build slot management, availability query, and atomic booking using internal schedule only. No Google/Outlook yet — just database-driven availability windows. This unblocks voice integration testing.

4. **Voice integration (Vapi/Retell webhook + triage + booking):** Wire up the webhook endpoint, triage engine, and scheduler. Test with real calls. This is the highest-risk component — surface integration unknowns early.

5. **CRM lead pipeline + dashboard:** Build lead state machine and owner-facing pipeline view. At this point, calls create real leads visible in the dashboard.

6. **Notification service:** SMS/email/push alerts to owner. Depends on lead creation (step 5) and booking (step 3).

7. **Calendar integration (Google/Outlook sync):** Adds real availability from external calendars. This is a distinct integration effort and can be phased — v1 might ship with internal availability only, with calendar sync as an early follow-on.

8. **Call recordings + transcripts:** Store and surface in dashboard. Depends on voice integration (step 4) and object storage setup.

---

## Sources

- Training data: Vapi documentation and webhook architecture (confidence: MEDIUM — verified against Vapi docs knowledge as of August 2025; recommend re-checking current docs before implementation)
- Training data: Retell AI integration patterns (confidence: MEDIUM — same caveat)
- Redis Redlock pattern for distributed locking — well-established, documented at redis.io (confidence: HIGH)
- Google Calendar API push notifications — documented pattern, 7-day expiry is a known gotcha (confidence: HIGH)
- Microsoft Graph API change notifications — similar pattern to Google (confidence: MEDIUM — details should be verified against current MS docs)
- General voice AI latency requirements (< 2s tool-call response) — derived from Vapi/Retell community guidance and product constraints (confidence: MEDIUM)

---
*Architecture research for: AI voice receptionist + scheduling + CRM (home services SaaS)*
*Researched: 2026-03-18*

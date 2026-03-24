# Architecture Research: Booking-First Digital Dispatcher Pivot

**Domain:** Voice AI receptionist for home service SMEs -- pivot from escalation-first to booking-first
**Researched:** 2026-03-24
**Confidence:** HIGH (analysis based on direct codebase audit of all affected components)

## Integration Strategy: Modify, Don't Replace

The booking-first pivot is a behavioral change, not an infrastructure change. Every existing component survives. No new services, no new databases, no new deploy targets. The question is what gets modified and in what order.

**Key insight:** The current architecture already books emergency calls. The pivot extends that same booking path to ALL calls and demotes triage from a routing decision to a metadata tag. This is a narrowing of code paths, not a widening -- fewer branches, not more.

## System Overview: Current vs. Pivot

```
CURRENT (v1.0 -- Escalation-First)
====================================

Retell Call
    |
    v
[call_inbound webhook] --> dynamic_variables (slots, tenant config)
    |
    v
[WebSocket LLM Server] --> Groq Llama 4 Scout
    |                       |
    | transcript            | tool calls
    |                       v
    |                  book_appointment (emergency/willing routine)
    |                  transfer_call (emergency escalation, human request)
    |
    v
[call_ended webhook] --> lightweight call record
    |
    v
[call_analyzed webhook] --> recording --> triage pipeline --> lead creation
    |                                         |
    |                                    [ROUTES behavior]
    |                                    emergency --> owner alert (urgent)
    |                                    routine --> lead (standard notify)
    v
[recovery SMS cron] --> unbooked callers get SMS


PIVOT (v2.0 -- Booking-First)
================================

Retell Call
    |
    v
[call_inbound webhook] --> dynamic_variables (slots, tenant config)
    |                       [CHANGE: more slots, emergency-priority sorting]
    v
[WebSocket LLM Server] --> Groq Llama 4 Scout
    |                       |
    | transcript            | tool calls
    |                       v
    |                  book_appointment (ALL calls)
    |                  transfer_call (EXCEPTION ONLY)
    |                  [NEW] flag_exception (AI confusion signal)
    |
    v
[call_ended webhook] --> lightweight call record (unchanged)
    |
    v
[call_analyzed webhook] --> recording --> triage pipeline --> lead creation
    |                                         |
    |                                    [CHANGE: TAGS only, no routing]
    |                                    emergency tag --> HIGH priority notification
    |                                    routine tag --> STANDARD notification
    |                                    high_ticket tag --> HIGH priority notification
    v
[recovery SMS cron] --> ALL unbooked callers (universal fallback)
```

## Component-by-Component Integration Plan

### 1. Agent Prompt (`src/lib/agent-prompt.js`) -- REWRITE

**Current state:** `buildSystemPrompt()` has a `triageSection` that tells the AI to behave differently for emergency vs. routine calls. The `bookingFlowSection` treats booking as optional for routine callers with language like "No problem! I'll save your information and ${business_name} will follow up with available times."

**What changes:**

- **Delete** the `triageSection` entirely. The block starting with "TRIAGE-AWARE BEHAVIOR" that says "If the caller describes an emergency, respond with urgency" and "For routine requests, take a relaxed approach" -- gone. AI no longer bifurcates behavior based on urgency classification.

- **Rewrite** `bookingFlowSection` to be the PRIMARY behavior, not a conditional section. Every call follows the booking flow. The "ROUTINE CALLER DECLINES" path (step 8) changes from "No problem! I'll save your information" to "I understand. I'll make sure [business_name] has your details. In the meantime, you can always book online -- we'll send you a link."

- **Keep** emergency keyword sensitivity but reframe it as slot selection strategy only: "If the caller describes something urgent (flooding, gas leak, no heat), offer the EARLIEST available slot first and communicate that you're prioritizing their timing."

- **Add** exception state instructions: "Transfer the call ONLY when: (1) you genuinely cannot determine what service the caller needs after two clarification attempts, OR (2) the caller explicitly asks to speak with a person. In all other cases, guide the conversation toward booking."

- **Delete** the line "For ROUTINE calls: Use relaxed tone. Offer booking but don't pressure -- create lead if they decline." This is the single most important line to remove. The new behavior is: always guide toward booking, handle refusal gracefully, but make booking the default outcome.

- **Keep** the booking flow structure (steps 1-7: identify need, offer slots, collect address, mandatory read-back, book, confirm, handle slot-taken). This flow is already correct for all call types.

**Dependency:** None. Can be built first. Highest behavioral impact per line of code changed.

**Risk:** Prompt wording directly controls live call behavior. Must be tested with simulated calls across scenarios (emergency, routine, price-shopper, confused caller, non-English speaker) before deploying.

### 2. WebSocket LLM Server (`src/server/retell-llm-ws.js`) -- MODIFY

**Current state:** Has `transfer_call` and `book_appointment` tools defined in `getTools()`. The `transfer_call` description says "Use when the caller wants to speak with a human." The `book_appointment` description has no urgency-specific gating but requires slot selection and address confirmation.

**What changes:**

- **Update** `transfer_call` tool description to restrict usage: "Transfer ONLY when the AI cannot determine the caller's service need after multiple attempts, OR the caller explicitly requests to speak with a human. Do NOT transfer for emergencies -- book them instead."

- **Add** optional `reason` parameter to `transfer_call` so the AI must articulate why it's escalating. This feeds into exception tracking.

- **Add** `flag_exception` tool (optional but recommended). This lets the AI signal "I'm confused about this caller's need" without immediately transferring. The exception gets logged and the owner receives a high-priority notification post-call. Parameters: `{ reason: string, caller_name?: string }`. This tool does NOT end the call -- the AI continues trying.

- **Update** `book_appointment` tool description to remove any emergency-specific language and make it the universal action tool. Current description is already mostly neutral -- just verify no residual escalation language.

- **Keep** the `urgency` parameter on `book_appointment`. It becomes a metadata tag that flows through to the appointment record and notification system.

**Dependency:** Agent prompt should be updated first (prompt and tool descriptions must be coherent with each other).

**Risk:** Low. Tool definitions are JSON schema; the behavioral change is prompt-driven.

### 3. Retell Webhook (`src/app/api/webhooks/retell/route.js`) -- MINOR MODIFY

**Current state:** `handleInbound` calculates 6 slots across 3 days. `handleBookAppointment` does atomic booking with slot-taken fallback. `handleFunctionCall` routes `transfer_call` and `book_appointment`.

**What changes:**

- **`handleInbound`**: Increase slot count from 6 across 3 days to 8-10 across 5 days. Booking-first means every caller needs viable options. Emergency callers need same-day slots; routine callers need flexibility across multiple days. The current slot calculation logic in the loop (lines 139-156) just needs the constants tuned: `dayOffset < 5` and `allSlots.length < 10`.

- **`handleBookAppointment`**: No structural changes needed. The atomic booking path is already universal. The `urgency` field from the tool call already flows through `atomicBookSlot` to the appointment record.

- **`handleFunctionCall`**: Add logging when `transfer_call` is invoked including the new `reason` parameter. Add handler for `flag_exception` tool if implemented -- log the exception to the `calls` table and trigger a high-priority notification.

- **Add** `flag_exception` handler: write to `calls.exception_reason` column, set a `booking_exception` flag so the call processor can fire high-priority notifications.

**Dependency:** WebSocket server tool definitions must match what this handler expects.

### 4. Triage Pipeline (`src/lib/triage/classifier.js` + layer1, layer2, layer3) -- NO CODE CHANGE

**Current state:** Three-layer classifier: `layer1-keywords.js` (regex) -> `layer2-llm.js` (Groq) -> `layer3-rules.js` (owner config). Returns `{ urgency, confidence, layer }`. Called from `processCallAnalyzed` in the call processor.

**What changes:** Nothing. The triage pipeline code is untouched.

**Why:** The pipeline is already a pure classifier -- it returns data but takes no action. The routing behavior lives in the agent prompt (during the call) and the notification system (after the call). The pivot changes only the consumers of triage output, not the producer.

- Layer 1 keyword detection still tags "flooding", "gas smell" as emergency -- now this tag means "send high-priority notification" instead of "escalate call."
- Layer 2 LLM scoring still resolves ambiguous transcripts -- the confidence level helps notification priority.
- Layer 3 owner rules still allow owners to override service types to emergency/high_ticket -- this controls notification priority for their specific business.

**Key architectural validation:** This is good separation of concerns. The classifier does classification; the consumers do action. The pivot validates the original design.

### 5. Call Processor (`src/lib/call-processor.js`) -- MODIFY

**Current state:** `processCallAnalyzed` runs triage, checks for existing booking, calculates suggested slots for routine unbooked calls (guarded by `isRoutineUnbooked`), creates lead, sends owner notifications.

**What changes:**

- **Remove** the `isRoutineUnbooked` guard on suggested slot calculation (line 172: `const isRoutineUnbooked = triageResult.urgency === 'routine' && !appointmentExists;`). In booking-first, ANY unbooked call should have suggested slots calculated for owner follow-up. An emergency caller who hung up before booking is MORE important to follow up with, not less.

  Change to: `const needsSuggestedSlots = !appointmentExists;`

- **Upgrade** the emergency console.warn (line 153-154) to a real notification signal. Currently it's `console.warn('EMERGENCY TRIAGE:...')` which does nothing operational. In the pivot, emergency urgency must flow through to `sendOwnerNotifications` with a priority flag. The notification system already receives `lead.urgency_classification` -- the enhancement is in the notification system, not here.

- **Add** `booking_outcome` tracking. Check call metadata/transcript for evidence of `book_appointment` tool invocation. Distinguish three states:
  - `booked` -- appointment exists for this call
  - `attempted_not_booked` -- book_appointment was invoked but no appointment record (slot conflict, caller hung up during retry)
  - `not_attempted` -- caller hung up before booking flow started

  This enables targeted analytics and smarter recovery SMS.

- **Lead creation** logic is unchanged. The `urgency` field on the lead already comes from `triageResult.urgency` and flows correctly.

**Dependency:** Notification system should handle priority formatting before this change has full effect.

### 6. Notification System (`src/lib/notifications.js`) -- MODIFY

**Current state:** `sendOwnerNotifications` fires SMS + email in parallel via Promise.allSettled. SMS body includes urgency as a label (`New ${urgency} lead`). No differentiation in delivery behavior, formatting, or recipient list based on urgency.

**What changes:**

- **Add priority-based formatting:**
  - `emergency` / `high_ticket` urgency: SMS body gets "URGENT:" prefix and uppercase job type. Email subject gets "[URGENT]" prefix. Body language is action-oriented ("Immediate attention needed").
  - `routine` urgency: Current formatting unchanged.

- **Add escalation contact chain for high-priority notifications:**
  - The `escalation_contacts` table and `/api/escalation-contacts` route already exist in the codebase (migration 006). Currently unused in the notification flow.
  - For emergency/high_ticket urgency: query escalation contacts for the tenant, send SMS to each contact in addition to the owner. This ensures someone sees urgent bookings even if the owner's phone is off.

- **Interface change:** `sendOwnerNotifications` signature already receives the full lead object which contains `urgency`. No parameter changes needed -- just internal behavior branching.

- **Enhance `sendOwnerSMS` template** to include booking details when an appointment exists: "URGENT: Emergency plumbing -- John Doe booked for Tuesday March 24th at 10 AM at 123 Main St. Dashboard: [link]"

**Dependency:** Lead creation must set urgency correctly (already does via `triageResult.urgency`).

### 7. Recovery SMS Cron (`src/app/api/cron/send-recovery-sms/route.js`) -- MODIFY

**Current state:** Sends recovery SMS to callers who ended the call without booking. Skips calls < 15s and calls where a booking exists. Runs every minute, processes max 10 calls per invocation. 60-second delay before sending.

**What changes:**

- **Urgency-aware SMS content:** Join `calls.urgency_classification` in the cron query (currently not fetched). For emergency-tagged unbooked calls, send urgency-aware message: "Hi [name], we understand you have an urgent [job_type] issue. Book your emergency appointment now: [link] or call us back at [number]."

- **Shorter delay for emergencies:** Consider checking urgency and using a 30-second cutoff instead of 60 seconds. The caller with a gas leak who hung up needs faster follow-up than the price shopper.

- **Current behavior is already universal:** The cron already sends recovery SMS to ALL unbooked calls regardless of urgency. The booking-first pivot's "universal recovery fallback" requirement is already met. Only the content and timing need enhancement.

**Dependency:** Call processor must tag `urgency_classification` on the calls table (already does, line 258 in call-processor.js).

### 8. Dashboard -- COSMETIC CHANGES ONLY

**Current state:** Leads page shows urgency badges via `LeadCard.jsx`. Calendar shows appointments via `CalendarView.js`. Analytics via `AnalyticsCharts.jsx`. `BookingStatusBadge.js` exists.

**What changes:**

- **Urgency badges stay** but their semantic meaning shifts from "how the call was routed" to "notification priority level." The visual presentation is identical -- red for emergency, yellow for high_ticket, gray for routine. No component changes needed.

- **Add "booking rate" metric** to analytics: percentage of calls that result in a confirmed booking. This is THE key KPI for booking-first. Calculate from `appointments` count vs `calls` count per time period.

- **Add booking outcome indicator** on lead cards: show whether the call resulted in a booking, an attempted booking that failed, or no booking attempt. Uses the `booking_outcome` field added to the call processor.

- **No structural dashboard changes.** All data model changes are additive. The dashboard reads from the same tables with the same schemas.

**Dependency:** All backend changes must be deployed first. Dashboard reads from the data they produce.

## Data Flow: Booking-First Call Lifecycle

```
1. INBOUND CALL
   Retell --> call_inbound webhook
   Webhook: tenant lookup, calculate 8-10 available slots across 5 days
   Return: dynamic_variables { available_slots, business_name, ... }
   [CHANGE: more slots, wider date range]

2. LIVE CONVERSATION
   Retell <--> WebSocket LLM Server <--> Groq Llama 4 Scout
   AI: greets caller, identifies service need
   AI: detects urgency signals for slot strategy (earliest vs. flexible)
   AI: offers available slots -- earliest first for emergencies
   AI: collects name, address (mandatory read-back confirmation), slot selection
   AI: invokes book_appointment tool with urgency tag
   [CHANGE: AI always drives toward booking, never toward "save as lead"]

3. BOOKING ATTEMPT
   WebSocket --> Retell --> call_function_invoked webhook
   Webhook: atomicBookSlot() via Postgres advisory lock
   Success: confirm to caller, async Google Calendar push
   Slot taken: offer alternative slot, retry booking
   [NO CHANGE in booking mechanics]

4. EXCEPTION PATH (rare -- the only transfer scenario)
   Trigger: AI cannot understand caller OR caller explicitly requests human
   AI: invokes transfer_call(reason: "...") or flag_exception(reason: "...")
   Webhook: logs reason to calls table, transfers if transfer_call
   Post-call: high-priority notification to owner about exception
   [CHANGE: transfer is last resort, not urgency-based]

5. CALL ENDS
   Retell --> call_ended webhook
   Webhook: create lightweight call record in calls table
   [NO CHANGE]

6. POST-CALL ANALYSIS
   Retell --> call_analyzed webhook
   Pipeline: upload recording
        --> detect language barrier
        --> run 3-layer triage (keywords -> LLM -> owner rules)
        --> determine booking_outcome (booked / attempted / not_attempted)
        --> create or merge lead
        --> send priority-formatted owner notifications
   [CHANGE: triage output drives notification priority, not routing]
   [CHANGE: booking_outcome tracked for analytics]
   [CHANGE: suggested slots calculated for ALL unbooked calls]

7. RECOVERY FALLBACK (universal)
   Cron (every minute): find unbooked calls > 30-60s old
   Urgency-aware content: emergency callers get urgent recovery message
   Send recovery SMS with booking link
   [CHANGE: urgency-aware content, faster for emergencies]
```

## Architectural Patterns

### Pattern 1: Tag-and-Notify (replaces Route-and-Escalate)

**What:** Urgency classification produces a tag that travels with the call/lead record through the entire pipeline. The tag influences notification formatting and delivery priority but never alters the call flow. All calls follow the identical book-first path.

**When to use:** Every call, every notification decision.

**Trade-offs:**
- Pro: Single code path for all calls (simpler to test, fewer bugs, easier to reason about)
- Pro: Every call produces a booking or a near-miss with recovery -- no "black holes" in the funnel
- Con: True emergencies where the owner MUST drop everything get the same call outcome (a booking) -- differentiation is only in notification urgency
- Mitigation: Escalation contacts chain for emergency tags ensures multiple people get pinged immediately

### Pattern 2: Exception-Only Escalation

**What:** Transfer/escalation is reserved for AI failure states, not urgency levels. The AI must provide a `reason` parameter when escalating, creating an audit trail.

**When to use:** When the AI invokes `transfer_call` or `flag_exception`.

**Trade-offs:**
- Pro: Dramatically reduces owner interruptions (most "emergencies" get booked, not transferred)
- Pro: Every call produces a lead record and almost always a booking
- Con: Caller with a gas leak might prefer immediate human contact
- Mitigation: Emergency bookings get the nearest available slot + urgent owner notification. If no same-day slot exists, the AI says "I'm booking the earliest slot AND alerting [business] immediately so they can try to fit you in sooner."

### Pattern 3: Universal Recovery Fallback

**What:** Every call that ends without a booking triggers a recovery SMS. No call path ends in a dead end for the caller.

**When to use:** Post-call, via recovery SMS cron.

**Trade-offs:**
- Pro: Catches every dropped ball -- caller hung up, booking failed, AI got confused
- Pro: Already implemented; just needs urgency-aware content
- Con: May send SMS to callers who intentionally didn't book (price shoppers, wrong numbers > 15s)
- Mitigation: Short call filter (< 15s) handles mis-dials. Recovery SMS is warm, not pushy. Callers can ignore it.

## Anti-Patterns

### Anti-Pattern 1: Triage-Gated Booking

**What people do:** Check urgency BEFORE deciding whether to book. Emergency -> book immediately. Routine -> "save as lead, owner follows up."

**Why it's wrong:** Creates two code paths with different outcomes. Routine callers who WANT to book right now are pushed to a slower path. Lead follow-up by the owner has a 50%+ drop-off rate because the owner is on a job site. The AI already has the caller on the phone -- book them now.

**Do this instead:** Book all calls. Use urgency only for slot selection strategy (earliest vs. flexible) and notification priority.

### Anti-Pattern 2: Transfer as Default Emergency Handler

**What people do:** Emergency detected -> immediately transfer to owner's phone.

**Why it's wrong:** Owner is on a job site, doesn't answer. Caller gets voicemail. Lead is lost. This recreates the very problem the product exists to solve.

**Do this instead:** Book the emergency into the nearest slot. Notify the owner with high-priority alert including escalation contacts. Owner can call the customer back or rearrange schedule -- but the booking is locked in.

### Anti-Pattern 3: Dual Prompt Paths

**What people do:** Build separate prompt branches for emergency vs. routine conversations, with different tool availability, different greeting flows, or different conversation structures.

**Why it's wrong:** Prompt complexity explodes. Edge cases multiply (caller starts routine, reveals emergency mid-call -- which path now?). The LLM gets confused about which behavioral mode it's in.

**Do this instead:** Single prompt, single conversation flow. Urgency influences TONE and SLOT SELECTION ORDER only, not the conversation structure or tool availability.

### Anti-Pattern 4: Removing Triage Pipeline Code

**What people do:** Since triage no longer routes calls, delete the classifier code.

**Why it's wrong:** Triage output still drives notification priority, analytics, and dashboard badges. The classification is valuable data even when it doesn't control routing.

**Do this instead:** Keep the pipeline unchanged. Change only the consumers. The classifier is a pure function; its value increases when freed from routing responsibility.

## Schema Impact Assessment

No new tables required. No columns need removal. Two additive column changes:

| Table | Column | Type | Purpose |
|-------|--------|------|---------|
| `calls` | `booking_outcome` | text (enum: 'booked', 'attempted', 'not_attempted') | Track whether booking was attempted/succeeded |
| `calls` | `exception_reason` | text (nullable) | Store AI's reason when flag_exception or transfer_call invoked |

The existing data model was designed well -- `urgency` is already a data field on `appointments`, `calls`, and `leads` tables. The pivot is almost entirely behavioral (prompt + notification formatting), not structural.

## Build Order (Dependency-Driven)

```
Phase 1: Agent Prompt Rewrite
  Files: src/lib/agent-prompt.js
  Dependencies: None
  Risk: HIGH (controls live call behavior)
  Test: Simulated calls across all scenarios before deploy

Phase 2: WebSocket Server Tool Updates
  Files: src/server/retell-llm-ws.js
  Dependencies: Phase 1 (prompt and tools must be coherent)
  Risk: LOW (JSON schema changes)

Phase 3: Notification Priority System
  Files: src/lib/notifications.js, src/emails/NewLeadEmail.jsx
  Dependencies: None (data already flows correctly)
  Risk: LOW
  Can be parallelized with Phase 2

Phase 4: Call Processor Updates + Schema Migration
  Files: src/lib/call-processor.js, new migration for booking_outcome + exception_reason
  Dependencies: None structurally, but notification changes (Phase 3) give full effect
  Risk: MEDIUM (touches the post-call pipeline)

Phase 5: Recovery SMS Enhancement
  Files: src/app/api/cron/send-recovery-sms/route.js
  Dependencies: Call processor urgency tagging (already works)
  Risk: LOW

Phase 6: Webhook Handler Updates
  Files: src/app/api/webhooks/retell/route.js
  Dependencies: Phase 2 (tool definitions must match)
  Risk: LOW (additive changes to existing handlers)

Phase 7: Dashboard Updates
  Files: src/components/dashboard/AnalyticsCharts.jsx, LeadCard.jsx
  Dependencies: All backend changes deployed
  Risk: LOW (read-only UI changes)

Phase 8: Hardening and QA
  Scope: End-to-end validation across all call scenarios
  Dependencies: All phases complete
  Test matrix:
    - Emergency call -> booking -> urgent notification + escalation contacts
    - Routine call -> booking -> standard notification
    - Routine call -> caller declines -> recovery SMS with booking link
    - Exception state -> flag/transfer with reason -> high-priority notification
    - Simultaneous bookings -> advisory lock prevents double-booking
    - Non-English caller -> booking in caller's language -> correct notifications
    - No available slots -> graceful handling + recovery SMS
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-50 tenants | Current architecture is fine. Single WebSocket server, single Vercel deployment. Booking-first increases booking volume ~2-3x but atomicBookSlot handles concurrency. |
| 50-500 tenants | WebSocket server on Railway may need horizontal scaling. Slot calculation in `handleInbound` gets heavier with more appointments per tenant. Add caching for tenant scheduling config (TTL 5min). |
| 500+ tenants | Recovery SMS cron processing 10/min will fall behind with higher booking-first call volume. Switch to event-driven: trigger recovery SMS from `processCallAnalyzed` as a delayed async task rather than polling. Slot calculation should be cached per-tenant with invalidation on booking/calendar events. |

### First Bottleneck

The `handleInbound` webhook does 4 parallel Supabase queries + slot calculation on every inbound call. With booking-first generating more slot requests (8-10 per call vs 6), this hot path gets heavier. Solution: cache tenant scheduling config and recent appointment list with 60-second TTL, invalidate on booking events.

### Second Bottleneck

Recovery SMS cron processes max 10 calls per minute. Booking-first increases the number of calls that go through the full pipeline, and the universal fallback means more recovery SMS targets. At high volume, unbooked callers wait too long. Solution: fire recovery SMS as a delayed async task from `processCallAnalyzed` (using `setTimeout` or a job queue) instead of relying on cron polling.

## Integration Points

### External Services

| Service | Integration Pattern | Pivot Impact |
|---------|---------------------|-------------|
| Retell | Webhooks + WebSocket LLM | Tool descriptions change; webhook handlers get minor additions |
| Groq (Llama 4 Scout) | OpenAI-compatible streaming via WebSocket server | No change -- prompt content changes, not API usage |
| Google Calendar | Push sync via `pushBookingToCalendar` after booking | More bookings = more pushes. Already async via `after()`. No concern. |
| Twilio SMS | Owner alerts + caller recovery | Urgency-aware formatting. Same API, different message templates. |
| Resend Email | Owner alerts via React Email template | Urgency-aware subject/body. May need [URGENT] template variant. |
| Supabase/Postgres | All data persistence, advisory locks | Two additive columns. No schema-breaking changes. |

### Internal Boundaries

| Boundary | Communication | Pivot Impact |
|----------|---------------|-------------|
| Agent Prompt <-> WebSocket Server | Prompt string built at connection time | Content changes, interface unchanged |
| WebSocket Server <-> Retell Webhook | Tool calls via Retell protocol | New tool (flag_exception), updated descriptions |
| Call Processor <-> Triage Pipeline | Direct function call (`classifyCall`) | Consumer interpretation changes, interface unchanged |
| Call Processor <-> Notification System | Direct function call (`sendOwnerNotifications`) | Notification system adds priority formatting internally |
| Call Processor <-> Lead System | Direct function call (`createOrMergeLead`) | No change -- urgency already flows through |
| Recovery Cron <-> Notification System | Direct function call (`sendCallerRecoverySMS`) | Urgency-aware content, same interface |
| Recovery Cron <-> Calls Table | Supabase query | Needs to join urgency_classification for content |
| Webhook <-> Escalation Contacts | New: query escalation_contacts for emergency notifications | Currently unused table gets wired in |

## Files Changed Summary

### Modified Files

| File | Change Scope | Description |
|------|-------------|-------------|
| `src/lib/agent-prompt.js` | REWRITE | Remove triage routing, make booking-first the default behavior |
| `src/server/retell-llm-ws.js` | MODERATE | Update tool descriptions, add flag_exception tool, add reason to transfer_call |
| `src/app/api/webhooks/retell/route.js` | MINOR | Increase slot count, add flag_exception handler, log transfer reasons |
| `src/lib/call-processor.js` | MODERATE | Remove isRoutineUnbooked guard, add booking_outcome tracking |
| `src/lib/notifications.js` | MODERATE | Priority-based formatting, escalation contacts for emergency |
| `src/app/api/cron/send-recovery-sms/route.js` | MINOR | Urgency-aware SMS content, join urgency_classification |
| `src/components/dashboard/AnalyticsCharts.jsx` | MINOR | Add booking rate metric |
| `src/components/dashboard/LeadCard.jsx` | MINOR | Show booking outcome indicator |

### New Files

| File | Purpose |
|------|---------|
| `supabase/migrations/007_booking_first.sql` | Add `booking_outcome` and `exception_reason` columns to calls table |

### Unchanged Files (explicitly confirmed)

| File | Why Unchanged |
|------|---------------|
| `src/lib/triage/classifier.js` | Pure classifier, consumers change not producer |
| `src/lib/triage/layer1-keywords.js` | Keyword detection still needed for urgency tagging |
| `src/lib/triage/layer2-llm.js` | LLM scoring still needed for ambiguous calls |
| `src/lib/triage/layer3-rules.js` | Owner rules still control urgency overrides |
| `src/lib/scheduling/booking.js` | atomicBookSlot is already universal |
| `src/lib/scheduling/slot-calculator.js` | Calculation logic unchanged, just called with different params |
| `src/lib/scheduling/google-calendar.js` | Calendar push is already async and universal |
| `src/lib/leads.js` | Lead creation already handles urgency as data field |

## Sources

- Direct codebase audit of all files listed above
- Project context: `.planning/PROJECT.md` (v2.0 milestone definition)
- Database schema: `supabase/migrations/001-006`

---
*Architecture research for: Booking-First Digital Dispatcher Pivot*
*Researched: 2026-03-24*

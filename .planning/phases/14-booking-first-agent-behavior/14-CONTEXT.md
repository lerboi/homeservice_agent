# Phase 14: Booking-First Agent Behavior - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Rewrite the AI voice agent from escalation-first to booking-first: the AI books every inbound call by default — emergencies into the nearest same-day slot, routine calls into next available — with human transfer restricted to exception states only. Full call context preserved on any transfer via structured whisper message. Two new WebSocket tools (end_call, capture_lead) expand the AI's action surface. Prompt rebuilt as modular, composable sections (developer-controlled).

</domain>

<decisions>
## Implementation Decisions

### Intent Detection & Non-Booking Calls
- **D-01:** AI books every call by default. Info-only and quote calls are NOT exempt from booking — AI answers the question first, then naturally pivots to offering available slots ("I can get you on the schedule if you'd like").
- **D-02:** Quote requests are treated as booking opportunities: "To give you an accurate quote, we'd need to see the space. Let me book a time for [owner] to come take a look."
- **D-03:** Soft re-offer on first decline — AI says "No problem — if you change your mind, I can book anytime." Second explicit decline ends the booking push.
- **D-04:** After two declines, AI captures caller info (name, phone, issue) as a lead for owner follow-up: "I've noted your details — [owner] will reach out." Call wraps up with lead created.
- **D-05:** Only an explicit verbal decline ("no thanks", "not right now", "I don't want an appointment") stops the booking push. Passive non-engagement does NOT count as decline — AI continues guiding toward booking.

### Exception & Transfer Triggers
- **D-06:** Only two transfer triggers exist: (1) AI cannot understand the job after 3 clarification attempts (2 standard + 1 "could you describe what you're seeing?"), (2) caller explicitly requests a human ("let me talk to a person").
- **D-07:** Explicit transfer request = instant transfer. AI says "Absolutely, let me connect you now" — zero friction, zero pushback, no questions asked (BOOK-05).
- **D-08:** Whisper message uses structured template format: "[Name] calling about [job type]. [Emergency/Routine]. [1-line summary]." Consistent and scannable for the receiving human.
- **D-09:** No other transfer triggers — no language barrier transfer, no emotional distress transfer. Just the two exception states.

### Prompt Rewrite Strategy
- **D-10:** Modular prompt builder — break prompt into composable, developer-controlled code-level modules (greeting, booking, transfer, info-handling, closing). Modules are assembled per call based on tenant config. Not tenant-configurable from dashboard.
- **D-11:** Unified tone for all calls — no emergency/routine tone split. Single professional-friendly tone regardless of urgency. Simplifies prompt.
- **D-12:** Urgency cues still affect slot selection: AI reads urgency cues from caller ("my pipe burst" vs "next month") and offers same-day/nearest slots for emergencies, next-available for routine. Tone stays the same, but slot priority differs.

### WebSocket Tool Updates
- **D-13:** Four tools available to AI during calls: `book_appointment`, `transfer_call`, `end_call` (new), `capture_lead` (new).
- **D-14:** `end_call` tool — signals Retell to hang up AND triggers immediate post-call processing (triage, lead creation, notifications) in parallel. Faster lead capture path.
- **D-15:** `capture_lead` tool — AI passes structured fields: caller_name, phone, address, job_type, notes. Matches existing lead schema. Used when caller declines booking — AI confirms "I've saved your info for [owner]."
- **D-16:** `book_appointment` remains gated behind `onboarding_complete`. Businesses that haven't completed onboarding can't accept bookings — AI still answers but only captures leads and transfers.

### Claude's Discretion
- Modular prompt builder architecture (exact module boundaries, composition logic)
- `end_call` implementation (how to trigger both Retell hangup and post-call processing)
- `capture_lead` schema mapping to existing lead/calls tables
- Whisper message template field mapping
- Clarification attempt counting mechanism (how AI tracks 3 attempts)
- How urgency cues affect slot ordering without changing tone

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Agent Prompt & LLM
- `src/lib/agent-prompt.js` — Current dynamic system prompt (will be refactored into modular builder)
- `src/lib/retell-agent-config.js` — Retell API config (voice speed, functions, dynamic variables)

### WebSocket Server
- `src/server/retell-llm-ws.js` — Real-time LLM inference server handling Groq calls and tool invocations

### Webhook Handler
- `src/app/api/webhooks/retell/route.js` — Inbound call prep, function invocations (book_appointment, transfer_call), call lifecycle events

### Booking & Scheduling
- `src/lib/scheduling/booking.js` — Atomic slot booking via Postgres advisory lock
- `src/lib/scheduling/slot-calculator.js` — Available slot calculation with travel buffers

### Call Processing & Triage
- `src/lib/call-processor.js` — Post-call analysis, recording upload, lead creation, notifications
- `src/lib/triage/classifier.js` — Three-layer triage orchestrator

### Prior Phase Context
- `.planning/phases/03-scheduling-and-calendar-sync/03-CONTEXT.md` — Booking conversation flow, address read-back, slot offering decisions
- `.planning/phases/12-dashboard-configurable-triage-and-call-escalation/12-CONTEXT.md` — Escalation chain, slot-first fallback waterfall

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `agent-prompt.js` `buildSystemPrompt()`: Dynamic prompt builder with tenant config injection — foundation for modular refactor
- `book_appointment` tool definition in `retell-llm-ws.js`: Existing tool schema with slot_start, caller_name, address, job_type params
- `transfer_call` tool definition: Existing transfer implementation with Retell SDK
- `atomicBookSlot()` in `booking.js`: Postgres advisory lock booking — no changes needed
- `createOrMergeLead()` in `call-processor.js`: Lead creation/dedup — extend for mid-call `capture_lead` tool
- Slot calculator: Already computes available slots per call with travel buffers

### Established Patterns
- Groq LLM (Llama 4 Scout 17B) via WebSocket with streaming text + tool call accumulation
- Tool result continuation (feed tool result back to LLM for next response)
- Dynamic variables passed from webhook to WebSocket for prompt injection
- Post-call processing triggered by Retell `call_ended` webhook

### Integration Points
- `retell-llm-ws.js` tool definitions: Add `end_call` and `capture_lead` tool schemas
- `retell/route.js` `handleFunctionCall()`: Add handlers for new tool invocations
- `agent-prompt.js`: Refactor from single function to modular builder with composable sections
- `call-processor.js`: Support early invocation from `end_call` tool (not just webhook)

</code_context>

<specifics>
## Specific Ideas

- Quote calls naturally convert to site visits: "To give you an accurate quote, we'd need to see the space"
- Soft re-offer phrasing: "No problem — if you change your mind, I can book anytime"
- Third clarification attempt uses different approach: "Could you describe what you're seeing or what's happening?" before transferring
- Whisper template: "[Name] calling about [job type]. [Emergency/Routine]. [1-line summary]."

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 14-booking-first-agent-behavior*
*Context gathered: 2026-03-24*

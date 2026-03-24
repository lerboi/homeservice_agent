# Phase 15: Call Processor and Triage Reclassification - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Flatten the call processing pipeline so every call follows the same booking-first path regardless of urgency tag. Add `booking_outcome` and `exception_reason` columns to the calls table for analytics. Add `notification_priority` column derived from urgency classification for Phase 16 handoff. Remove the `isRoutineUnbooked` guard that prevents routine calls from being booked autonomously. Send caller SMS confirmation (multi-language) immediately after successful bookings.

</domain>

<decisions>
## Implementation Decisions

### booking_outcome Tracking
- **D-01:** Four outcome categories: `booked` (slot confirmed), `attempted` (booking offered but failed technically), `declined` (caller explicitly declined booking offer), `not_attempted` (info-only call where booking was never offered or relevant).
- **D-02:** booking_outcome is set **real-time** during the live call as events happen — `booked` when `book_appointment` succeeds, `declined` when `capture_lead` fires after decline, `attempted` on `book_appointment` failure. Post-call processor fills `not_attempted` as default for calls with no booking activity recorded.
- **D-03:** exception_reason is also set **real-time** at the moment `transfer_call` fires — values like `clarification_limit` (3 failed clarifications) or `caller_requested` (caller asked for human). Consistent with real-time booking_outcome approach.

### isRoutineUnbooked Removal
- **D-04:** Remove the `isRoutineUnbooked` guard entirely from `call-processor.js`. The `triageResult.urgency === 'routine' && !appointmentExists` check no longer gates any logic — all calls follow the same processing path.
- **D-05:** Keep suggested_slots calculation but expand scope — calculate for ANY unbooked call (routine or emergency), not just routine. Useful for owner follow-up on calls where booking was declined or attempted-but-failed. Gate on `!appointmentExists` only.

### Caller SMS Confirmation
- **D-06:** Trigger SMS from `handleBookAppointment` in the webhook handler immediately after `atomicBookSlot` succeeds. Fire-and-forget (non-blocking) using existing Twilio infrastructure in `notifications.js`. Meets <60s delivery requirement.
- **D-07:** Multi-language from day one — use `detected_language` from call metadata to send SMS in the caller's language (en/es). Aligns with HARDEN-01 (Spanish E2E validation).
- **D-08:** SMS content: "Your appointment with [Business Name] is confirmed for [Date] at [Time] at [Address]." Includes business name, date, time, and service address. Matches what the AI reads aloud during the call.

### Triage Tag Reclassification
- **D-09:** Triage classifier (`classifyCall`) remains unchanged — still outputs `urgency_classification` (emergency/routine/high_ticket). The change is in what consumes its output: urgency no longer gates call routing or processing paths.
- **D-10:** Emergency console.warn in call-processor.js stays as-is — useful server-side debugging log that doesn't affect call routing.
- **D-11:** New `notification_priority` column on calls table, derived from urgency: `emergency`/`high_ticket` maps to `high`, `routine` maps to `standard`. Mapping computed in call-processor after triage runs, stored alongside urgency_classification.
- **D-12:** Phase 16 handoff contract: Phase 16 reads `notification_priority` column from the call/lead record to determine SMS/email formatting tier. Clean decoupling — triage classification and notification priority are separate concerns.

### Claude's Discretion
- Schema migration strategy (Supabase migration file vs direct ALTER TABLE)
- Exact placement of real-time booking_outcome writes in webhook handler code
- SMS function signature and error handling pattern (following existing sendOwnerSMS pattern)
- i18n approach for SMS templates (translation files vs inline)
- Whether notification_priority should also be set on the leads table or only calls

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Call Processing Pipeline
- `src/lib/call-processor.js` — Post-call analysis, triage, lead creation, notifications. Contains `isRoutineUnbooked` guard (line 172) to remove and suggested_slots logic to modify.
- `src/lib/triage/classifier.js` — Three-layer triage orchestrator (unchanged, but its output consumption changes)

### Webhook Handler
- `src/app/api/webhooks/retell/route.js` — Function invocation handlers for `book_appointment`, `transfer_call`, `capture_lead`, `end_call`. SMS confirmation trigger point in `handleBookAppointment`.

### Notifications & SMS
- `src/lib/notifications.js` — Twilio SMS and Resend email infrastructure. Lazy-instantiated clients, sendOwnerSMS pattern to follow for caller SMS.

### Booking & Scheduling
- `src/lib/scheduling/booking.js` — `atomicBookSlot()` — the success path that triggers caller SMS
- `src/lib/scheduling/slot-calculator.js` — `calculateAvailableSlots()` for suggested_slots

### Prior Phase Context
- `.planning/phases/14-booking-first-agent-behavior/14-CONTEXT.md` — Booking-first decisions (D-01 through D-16), 4-tool system, exception triggers
- `.planning/phases/14-booking-first-agent-behavior/14-VERIFICATION.md` — Unmerged worktree gaps (capture_lead handler, whisper message, SKILL.md) — must be resolved before Phase 15

### Requirements
- `.planning/REQUIREMENTS.md` — BOOK-04 (caller SMS confirmation), TRIAGE-R01 (urgency tags retained but don't route), TRIAGE-R02 (triage drives notification priority)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `sendOwnerSMS()` in `notifications.js`: Pattern to follow for `sendCallerSMS()` — lazy Twilio client, try/catch non-throwing, fire-and-forget
- `createOrMergeLead()` in `src/lib/leads.js`: Already called from both call-processor and capture_lead webhook handler
- `formatSlotForSpeech()` in `route.js`: Date formatting for human-readable times — reusable for SMS content
- i18n translation files in `src/i18n/` — existing en/es locale support

### Established Patterns
- Groq LLM via WebSocket with tool call accumulation (real-time booking_outcome writes align with existing tool result flow)
- `after()` from `next/server` for non-blocking async work (used for calendar sync, can use for SMS)
- Supabase upsert with `onConflict: 'retell_call_id'` for call record updates
- Fire-and-forget notification pattern: `.catch(err => console.error(...))` — never blocks webhook

### Integration Points
- `handleBookAppointment()`: Add caller SMS send after `atomicBookSlot` success (alongside existing calendar sync)
- `handleFunctionCall()`: Update call record with booking_outcome/exception_reason on each tool invocation
- `processCallAnalyzed()`: Remove isRoutineUnbooked guard, expand suggested_slots to all unbooked, add notification_priority mapping after triage

</code_context>

<specifics>
## Specific Ideas

- 4 booking_outcome values: `booked`, `attempted`, `declined`, `not_attempted` — mirrors the actual call flow states
- notification_priority as a separate column decouples triage classification (what IS the urgency) from notification behavior (what DO we do about it) — cleaner for Phase 16
- SMS sent from webhook handler (not post-call) ensures <60s delivery while the caller is still on or just ending the call

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 15-call-processor-and-triage-reclassification*
*Context gathered: 2026-03-25*

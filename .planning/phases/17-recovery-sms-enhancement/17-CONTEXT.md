# Phase 17: Recovery SMS Enhancement - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Enhance the recovery SMS system so every failed booking triggers a recovery SMS to the caller with urgency-aware content, and delivery failures are logged with full error details and retried via exponential backoff. The real-time path fires from the webhook handler for `attempted` bookings; the existing cron path is updated for consistency. Recovery SMS content is empathy-first with no booking link (placeholder for future SMS chatbot or public booking page). Multi-language (en/es) support from day one.

</domain>

<decisions>
## Implementation Decisions

### Recovery Trigger Scope
- **D-01:** Only `booking_outcome = 'attempted'` triggers recovery SMS from the new real-time path. This covers callers who tried to book but the slot was taken during the call.
- **D-02:** `declined` does NOT trigger recovery SMS — respects the caller's explicit choice not to book.
- **D-03:** `not_attempted` stays handled by the existing cron-based recovery SMS (Phase 4 infrastructure) — no change to that trigger logic.
- **D-04:** Real-time trigger fires from the webhook handler via `after()` immediately when `atomicBookSlot` fails and caller gets the "slot taken" response. Matches Phase 15 caller SMS pattern. Meets <60s delivery requirement.
- **D-05:** Existing cron-based recovery SMS (`/api/cron/send-recovery-sms`) is ALSO updated with urgency-aware content and delivery failure logging for consistency across both paths.

### Urgency-Aware Content
- **D-06:** Emergency recovery SMS uses empathetic urgency — warm and understanding, NOT alarm-bell tone. Example: "We understand your situation is time-sensitive" rather than "URGENT" or "EMERGENCY" prefix. Dialed back from Phase 16's owner-facing pattern because this is caller-facing.
- **D-07:** Routine recovery SMS uses standard warm tone: "We're sorry we couldn't book your appointment. We'll be in touch shortly."
- **D-08:** Multi-language (en/es) matching Phase 15 pattern — uses `detected_language` from call record, defaults to `en`. i18n via JSON translation files consistent with `sendCallerSMS()`.

### Recovery SMS Content (Temporary)
- **D-09:** Recovery SMS is empathy-first with NO booking link or callback number. Message acknowledges the failed booking and signals the business will follow up. The owner notification (Phase 16) gives the owner context to reach out.
- **D-10:** This content is a **placeholder** — will be upgraded when SMS chatbot (inbound SMS booking) or public booking page is built in a future phase. Design the SMS content function to accept an optional `bookingLink` parameter that's unused for now.

### Delivery Failure Handling
- **D-11:** Exponential backoff retry — 3 attempts total at ~30s, ~2min, ~5min intervals.
- **D-12:** Retry logic lives in the database + cron, NOT in-process setTimeout. First attempt fires from webhook `after()` or existing cron. On failure, status is written to DB. Cron picks up failed records and retries with backoff counter. Survives serverless lifecycle limits.
- **D-13:** New `recovery_sms_status` tracking on calls table (or dedicated column set): status (pending/sent/failed/retrying), retry_count, last_error (Twilio error code + message), last_attempt_at. Full error details for debugging.
- **D-14:** After 3 failed attempts, status is set to `failed` permanently. No further retries — but the record is queryable for monitoring/alerting.

### Claude's Discretion
- Schema migration approach (new columns on calls table vs separate sms_log table)
- Exact backoff timing (approximate targets: 30s, 2min, 5min)
- Whether to extend the existing cron endpoint or create a new retry-specific cron
- i18n template structure (inline vs translation file entries)
- Emergency vs routine tone exact copy (within the "empathetic urgency, not alarm-bell" constraint)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Recovery SMS Infrastructure (Existing)
- `src/app/api/cron/send-recovery-sms/route.js` — Existing cron endpoint (runs every minute, processes max 10 calls). Must be updated for urgency-aware content and delivery logging.
- `src/lib/notifications.js` — `sendCallerRecoverySMS()` (lines 114-138) for existing recovery SMS, `sendCallerSMS()` (lines 162-187) for Phase 15 i18n pattern to follow

### Webhook Handler
- `src/app/api/webhooks/retell/route.js` — `handleBookAppointment()` slot-taken failure path (lines 390-420) where real-time recovery SMS trigger is added

### Call Processing
- `src/lib/call-processor.js` — `processCallAnalyzed()` post-call pipeline, booking_outcome defaulting logic
- `src/lib/scheduling/booking.js` — `atomicBookSlot()` failure return shape: `{ success: false, reason: 'slot_taken' }`

### Schema & Migrations
- `supabase/migrations/004_leads_crm.sql` — `recovery_sms_sent_at` column on calls table
- `supabase/migrations/008_call_outcomes.sql` — `booking_outcome` enum (Phase 15)

### Prior Phase Context
- `.planning/phases/15-call-processor-and-triage-reclassification/15-CONTEXT.md` — booking_outcome states, caller SMS pattern, real-time writes via after()
- `.planning/phases/16-notification-priority-system/16-CONTEXT.md` — Emergency formatting pattern (owner-facing), urgency detection field

### Requirements
- `.planning/REQUIREMENTS.md` — RECOVER-01 (recovery SMS within 60s), RECOVER-02 (urgency-aware content), RECOVER-03 (delivery failure logging + retry)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `sendCallerRecoverySMS()` in `notifications.js`: Existing recovery SMS function — needs urgency-aware content branch and delivery status return
- `sendCallerSMS()` in `notifications.js`: Phase 15 i18n pattern (en/es JSON imports, locale parameter, interpolation) — reuse for recovery SMS multi-language
- `getTwilioClient()`: Lazy-instantiated Twilio client shared across all SMS functions
- `after()` from `next/server`: Non-blocking async execution pattern used throughout webhook handler

### Established Patterns
- Fire-and-forget SMS with try/catch (needs enhancement to return success/failure for retry tracking)
- Supabase upsert with `onConflict: 'retell_call_id'` for call record updates
- Cron endpoint with max-per-invocation limit (10 calls) to respect Twilio rate limits
- `booking_outcome` conditional update with `IS NULL` guard to avoid overwriting live values

### Integration Points
- `handleBookAppointment()` slot-taken branch: Add real-time recovery SMS trigger after `booking_outcome: 'attempted'` write
- Existing recovery cron: Add urgency-aware content branching and delivery status tracking
- New or extended cron: Retry logic for failed SMS deliveries with backoff counter

</code_context>

<specifics>
## Specific Ideas

- Recovery SMS content is intentionally a placeholder — designed with an optional `bookingLink` parameter so future phases (SMS chatbot, public booking page) can upgrade the CTA without touching the trigger/retry infrastructure
- Emergency tone is "empathetic urgency, not alarm-bell" — caller-facing warmth differs from owner-facing Phase 16 "EMERGENCY:" prefix pattern
- Exponential backoff via database state means retry survives serverless cold starts and function lifecycle limits
- Both real-time and cron paths share the same urgency-aware content and delivery logging — consistent caller experience regardless of trigger

</specifics>

<deferred>
## Deferred Ideas

- **SMS chatbot for booking via text** — Caller replies to recovery SMS and an AI chatbot walks them through scheduling over text. Aligns with OMNI-01 (SMS two-way messaging). Significant new capability: inbound SMS webhook, conversational state machine, text-based slot selection, non-voice atomicBookSlot integration. Future phase.
- **Dashboard SMS log** — Business owners can see all outbound SMS sent to callers (recovery, confirmation) on the dashboard lead detail view. New table, API route, dashboard UI. **Must-have capability, do next after Phase 17.**
- **Public booking page** — Hosted booking page per tenant (`/book/{tenant-slug}`) so recovery SMS can link to self-service booking. New route, public UI, slot picker. Future phase.

</deferred>

---

*Phase: 17-recovery-sms-enhancement*
*Context gathered: 2026-03-25*

---
phase: 24-subscription-lifecycle-and-notifications
plan: 01
subsystem: payments
tags: [stripe, webhooks, resend, twilio, react-email, supabase, rls, billing-notifications]

# Dependency graph
requires:
  - phase: 22-billing-foundation
    provides: "stripe webhook route with handleTrialWillEnd/handleInvoicePaymentFailed stubs, subscriptions table"
  - phase: 23-usage-tracking
    provides: "billing test patterns (usage-tracking.test.js), subscriptions.calls_used tracking"
provides:
  - billing_notifications table (016_billing_notifications.sql) for idempotency across all billing notification types
  - PaymentFailedEmail React email template with amber-700 header and Stripe portal URL CTA
  - TrialReminderEmail React email template with usage stats rows and dynamic heading
  - Filled handleInvoicePaymentFailed — subscription lookup, portal URL, SMS + email via Promise.allSettled
  - Filled handleTrialWillEnd — idempotency check, email + SMS, billing_notifications insert
affects: [24-02, 24-03, billing, notifications]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "getResendClient() lazy init in webhook route following getTwilioClient() pattern"
    - "Promise.allSettled for dual notifications — failures logged, never thrown"
    - "billing_notifications table for notification idempotency — check-before-send pattern"
    - "TDD inline logic replication for webhook handler tests (same as usage-tracking.test.js)"

key-files:
  created:
    - supabase/migrations/016_billing_notifications.sql
    - src/emails/PaymentFailedEmail.jsx
    - src/emails/TrialReminderEmail.jsx
    - tests/billing/payment-failed-notifications.test.js
    - tests/billing/trial-will-end.test.js
  modified:
    - src/app/api/stripe/webhook/route.js

key-decisions:
  - "Migration renumbered 015→016: 015_notification_preferences.sql already existed from a prior phase"
  - "Resend client initialized via require() (not import) in getResendClient() to match the synchronous lazy-init pattern already used by getTwilioClient()"
  - "handleInvoicePaymentFailed uses try/catch at top level — notification failures logged but never rethrown to avoid Stripe retry conflicts (Pitfall 3)"
  - "TrialReminderEmail heading is dynamically chosen by daysUsed/daysRemaining — single template covers day 7, day 12, and trial_will_end"

patterns-established:
  - "Pattern: billing_notifications idempotency — .maybeSingle() check before send, .insert() after send"
  - "Pattern: Promise.allSettled for dual notification sends — failures captured per-channel, never propagate"
  - "Pattern: Webhook handler try/catch wrapper — all notification errors caught, logged, and swallowed to prevent Stripe retries"

requirements-completed: [BILLNOTIF-01, BILLNOTIF-03]

# Metrics
duration: 8min
completed: 2026-03-26
---

# Phase 24 Plan 01: Billing Notifications Foundation Summary

**billing_notifications idempotency table, PaymentFailedEmail and TrialReminderEmail React email templates, and filled handleInvoicePaymentFailed + handleTrialWillEnd Stripe webhook stubs with SMS + email + Promise.allSettled pattern**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-26T21:32:00Z
- **Completed:** 2026-03-26T21:38:29Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Created 016_billing_notifications.sql migration with RLS (service_role only) and idempotency index
- Created PaymentFailedEmail with amber-700 header, portal URL CTA, D-04 helpfulness tone
- Created TrialReminderEmail with usage stats detail rows, dynamic heading for day 7/12/trial_will_end, Upgrade Now CTA
- Filled handleInvoicePaymentFailed: subscription lookup → tenant lookup → Stripe portal URL → SMS + email via Promise.allSettled (BILLNOTIF-01)
- Filled handleTrialWillEnd: billing_notifications idempotency check → tenant lookup → email + SMS → billing_notifications insert (BILLNOTIF-03)
- 7 tests green: 3 for payment-failed (happy path, no-throw on failure, early return) + 4 for trial-will-end (happy path, idempotency check, idempotency block, insert after send)

## Task Commits

1. **Task 1: Migration + email templates** - `aa6bd52` (feat)
2. **Task 2 RED: Failing tests** - `a7fdd3d` (test)
3. **Task 2 GREEN: Webhook stubs implementation** - `8214349` (feat)

## Files Created/Modified

- `supabase/migrations/016_billing_notifications.sql` - billing_notifications table with tenant FK, notification_type, RLS service_role policy
- `src/emails/PaymentFailedEmail.jsx` - React email template for payment failure; amber-700 header, portal URL CTA, D-04 copy
- `src/emails/TrialReminderEmail.jsx` - React email template for trial reminders; usage stats rows, dynamic heading, Upgrade Now CTA
- `tests/billing/payment-failed-notifications.test.js` - 3 behavior tests for handleInvoicePaymentFailed (BILLNOTIF-01)
- `tests/billing/trial-will-end.test.js` - 4 behavior tests for handleTrialWillEnd (BILLNOTIF-03)
- `src/app/api/stripe/webhook/route.js` - Added imports, getResendClient(), filled both webhook stubs

## Decisions Made

- Migration renumbered 015→016 (auto-fix): 015_notification_preferences.sql already existed
- Resend client uses `require('resend')` in a synchronous lazy-init function to match the getTwilioClient() pattern already in the file (ESM import would require `await import()` which can't be used in sync context)
- Both handlers wrapped in try/catch at top level — notification failures never re-throw so Stripe doesn't retry the event (Pitfall 3 in RESEARCH.md)
- TrialReminderEmail is a single template that handles all three reminder stages (day 7, day 12, trial_will_end) via dynamic heading based on daysUsed/daysRemaining props

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Migration renumbered 015→016**
- **Found during:** Task 1 (billing_notifications migration)
- **Issue:** Plan specified `015_billing_notifications.sql` but `015_notification_preferences.sql` already existed from a prior phase
- **Fix:** Created `016_billing_notifications.sql` instead; all references in the plan still hold as the file purpose is identical
- **Files modified:** supabase/migrations/016_billing_notifications.sql (created)
- **Verification:** `grep -q "CREATE TABLE billing_notifications" supabase/migrations/016_billing_notifications.sql` passes
- **Committed in:** aa6bd52 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — migration numbering collision)
**Impact on plan:** Minimal — only filename changed. No functional difference. All acceptance criteria met.

## Issues Encountered

None — plan executed cleanly after the migration renumbering fix.

## Known Stubs

None — all functionality is fully wired:
- handleInvoicePaymentFailed sends real Twilio SMS and Resend email via Promise.allSettled
- handleTrialWillEnd performs real idempotency check, sends email + SMS, inserts billing_notifications row
- Email templates export named functions with all required props wired

## Next Phase Readiness

- Phase 24-02 (BillingWarningBanner + middleware gate) can use billing_notifications table and the subscription status patterns established here
- Phase 24-03 (trial reminders cron) can use billing_notifications idempotency table and TrialReminderEmail template
- All BILLNOTIF-01 and BILLNOTIF-03 requirements satisfied

---
*Phase: 24-subscription-lifecycle-and-notifications*
*Completed: 2026-03-26*

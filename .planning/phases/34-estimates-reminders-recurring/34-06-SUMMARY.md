---
phase: 34-estimates-reminders-recurring
plan: 06
subsystem: api, ui
tags: [cron, resend, twilio, react-email, date-fns, late-fees, reminders, idempotency]

# Dependency graph
requires:
  - phase: 34-01
    provides: invoices table, invoice_line_items table, invoice_settings table
  - phase: 34-03
    provides: invoice_reminders table, reminders_enabled column, late_fee columns on invoice_settings
provides:
  - late-fee-calculations.js pure functions (calculateLateFee, shouldApplyLateFee)
  - Daily cron for payment reminder dispatch at 4 intervals
  - Late fee auto-application to overdue invoices via cron
  - InvoiceReminderEmail React Email template with 4 tones
  - ReminderToggle component for per-invoice reminder control
  - Late fee settings UI in invoice settings page
affects: [34-07, recurring-invoices, invoice-detail]

# Tech tracking
tech-stack:
  added: [date-fns (addDays, differenceInDays, format)]
  patterns: [cron idempotency via upsert on UNIQUE constraint, pure calculation module for testability, white-labeled email templates]

key-files:
  created:
    - src/lib/late-fee-calculations.js
    - src/app/api/cron/invoice-reminders/route.js
    - src/emails/InvoiceReminderEmail.jsx
    - src/components/dashboard/ReminderToggle.jsx
    - tests/unit/late-fee.test.js
  modified:
    - vercel.json
    - src/app/dashboard/more/invoice-settings/page.js

key-decisions:
  - "Wave 0 late-fee tests run with NODE_OPTIONS=--experimental-vm-modules for ESM support in Jest"
  - "getReminderSubject exported separately from InvoiceReminderEmail for cron route to set email subject"
  - "SMS failure is non-fatal in cron -- try/catch around Twilio call, email is primary channel"

patterns-established:
  - "Pure calculation module pattern: extract business logic into pure functions tested by Wave 0 tests"
  - "Cron idempotency pattern: upsert with onConflict + ignoreDuplicates on UNIQUE constraint"
  - "White-labeled email: business name in header, noreply@getvoco.ai from address, no platform branding"

requirements-completed: [D-11, D-12, D-13, D-14, D-15]

# Metrics
duration: 5min
completed: 2026-04-01
---

# Phase 34 Plan 06: Payment Reminders and Late Fees Summary

**Daily cron sends escalating payment reminders at -3/0/+3/+7 days with idempotent dispatch, auto-applies late fees to overdue invoices, and provides per-invoice reminder toggle and late fee settings UI**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-01T11:36:49Z
- **Completed:** 2026-04-01T11:41:55Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Pure late fee calculation module with 9 Wave 0 tests passing (flat and percentage fee types, 30-day re-application guard)
- Daily cron route dispatches 4 reminder types with escalating tone via Resend email and Twilio SMS, plus auto-applies late fees to overdue invoices
- InvoiceReminderEmail white-labeled React Email template with business name header and 4 copy variants matching UI-SPEC
- ReminderToggle component with Switch, schedule description, and sent reminder history display
- Invoice settings page extended with Late Fees section (enable/disable switch, flat/percentage selector, amount input)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create late-fee-calculations module, reminder email template, and cron job** - `43a9eaf` (feat)
2. **Task 2: Create ReminderToggle component and add late fee settings to invoice settings page** - `9c77207` (feat)

## Files Created/Modified
- `src/lib/late-fee-calculations.js` - Pure functions: calculateLateFee, shouldApplyLateFee
- `src/app/api/cron/invoice-reminders/route.js` - Daily cron: reminder dispatch + late fee application
- `src/emails/InvoiceReminderEmail.jsx` - React Email template for 4 reminder types
- `src/components/dashboard/ReminderToggle.jsx` - Per-invoice reminder Switch with history
- `tests/unit/late-fee.test.js` - Wave 0 tests for late fee calculations (9 tests)
- `vercel.json` - Added invoice-reminders cron entry (0 9 * * *)
- `src/app/dashboard/more/invoice-settings/page.js` - Added Late Fees section with enable/type/amount controls

## Decisions Made
- Wave 0 late-fee tests require NODE_OPTIONS=--experimental-vm-modules for ESM import support in Jest
- getReminderSubject exported as a separate function from InvoiceReminderEmail for the cron route to set the email subject independently
- SMS failure is non-fatal in the cron -- wrapped in try/catch, email is the primary delivery channel

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Jest ESM support required NODE_OPTIONS=--experimental-vm-modules flag for the Wave 0 tests to parse import statements -- resolved by running with the flag

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Reminder cron and late fee application are complete and ready for production deployment
- ReminderToggle component can be integrated into invoice detail views
- Late fee settings persist via existing invoice settings PATCH endpoint

---
*Phase: 34-estimates-reminders-recurring*
*Completed: 2026-04-01*

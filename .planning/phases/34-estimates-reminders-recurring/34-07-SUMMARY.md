---
phase: 34-estimates-reminders-recurring
plan: 07
subsystem: invoicing
tags: [recurring, cron, date-fns, invoices, scheduling]

requires:
  - phase: 34-01
    provides: "DB schema with recurring invoice columns on invoices table (migration 032)"
  - phase: 34-03
    provides: "PaymentLog component for invoice detail integration"
  - phase: 34-06
    provides: "ReminderToggle component for invoice detail integration"
provides:
  - "calculateNextDate pure function for drift-free recurring date calculation"
  - "Recurring invoices cron job (daily 8AM UTC) auto-generating draft invoices"
  - "RecurringSetupDialog for setting up recurring schedules"
  - "RecurringBadge visual indicator for recurring templates"
  - "Invoice detail page integrates PaymentLog, ReminderToggle, and recurring management"
  - "Invoice list page with Recurring, Partially Paid, and Void filter tabs"
affects: [invoice-core, dashboard-crm-system]

tech-stack:
  added: [date-fns]
  patterns: [UTC-safe date calculation, cron-based invoice generation, drift-free scheduling]

key-files:
  created:
    - src/lib/recurring-calculations.js
    - src/app/api/cron/recurring-invoices/route.js
    - src/components/dashboard/RecurringBadge.jsx
    - src/components/dashboard/RecurringSetupDialog.jsx
  modified:
    - src/app/api/invoices/route.js
    - src/app/api/invoices/[id]/route.js
    - src/app/dashboard/invoices/[id]/page.js
    - src/app/dashboard/invoices/page.js
    - vercel.json

key-decisions:
  - "UTC date parsing (Date.UTC) and formatting (getUTCFullYear/Month/Date) to prevent timezone-induced off-by-one errors in recurring date calculations"
  - "Recurring fields (is_recurring_template, recurring_active, etc.) editable on sent/overdue invoices, not just drafts, so Stop Recurring works on any non-paid/void status"

patterns-established:
  - "Drift-free date calculation: always compute from start_date + N*interval, never from currentNextDate + interval"
  - "Cron scheduling order: recurring-invoices at 8AM before reminders at 9AM so generated drafts exist before reminder checks"

requirements-completed: [D-16, D-17, D-18]

duration: 9min
completed: 2026-04-02
---

# Phase 34 Plan 07: Recurring Invoices Summary

**Drift-free recurring invoice system with daily cron auto-generation, setup dialog, badges, and full invoice detail integration of PaymentLog and ReminderToggle**

## Performance

- **Duration:** 9 min
- **Started:** 2026-04-02T11:26:12Z
- **Completed:** 2026-04-02T11:35:38Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Pure `calculateNextDate` function passes all 6 Wave 0 tests with UTC-safe date handling
- Daily cron at 8AM UTC auto-generates draft invoices from recurring templates, copies line items, advances next_date without drift
- Invoice detail page now shows PaymentLog, ReminderToggle, recurring info/badge, Make Recurring button, and Stop Recurring with confirmation
- Invoice list page has Recurring, Partially Paid, and Void filter tabs with RecurringBadge on template rows

## Task Commits

Each task was committed atomically:

1. **Task 1: Create recurring-calculations module, cron job, and update invoice API routes** - `e9b1d0f` (feat)
2. **Task 2: Create RecurringSetupDialog, RecurringBadge, and update invoice list/detail pages** - `9721910` (feat)

## Files Created/Modified
- `src/lib/recurring-calculations.js` - Pure calculateNextDate function with UTC date handling
- `src/app/api/cron/recurring-invoices/route.js` - Daily cron for auto-generating draft invoices from templates
- `src/components/dashboard/RecurringBadge.jsx` - Violet badge with Repeat icon for recurring templates
- `src/components/dashboard/RecurringSetupDialog.jsx` - Dialog for setting up recurring frequency, start/end dates
- `src/app/api/invoices/route.js` - Added partially_paid status and recurring special filter
- `src/app/api/invoices/[id]/route.js` - Accept recurring fields and reminders_enabled in PATCH
- `src/app/dashboard/invoices/[id]/page.js` - Integrated PaymentLog, ReminderToggle, recurring management UI
- `src/app/dashboard/invoices/page.js` - Added Recurring, Partially Paid, Void tabs and RecurringBadge on rows
- `vercel.json` - Added recurring-invoices cron at 0 8 * * *
- `tests/unit/recurring-schedule.test.js` - Copied Wave 0 tests (all 6 pass)

## Decisions Made
- Used UTC date parsing (Date.UTC) and formatting (getUTCFullYear/Month/Date) to prevent timezone-induced off-by-one errors in recurring date calculations
- Recurring fields (is_recurring_template, recurring_active, etc.) are editable on sent/overdue invoices so Stop Recurring works regardless of invoice status

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed timezone-induced off-by-one in calculateNextDate**
- **Found during:** Task 1 (recurring-calculations module)
- **Issue:** Plan's code used `new Date(dateStr + 'T00:00:00')` which parses as local time, then `toISOString().split('T')[0]` converts to UTC -- causing dates to shift by -1 day in negative-offset timezones
- **Fix:** Used `Date.UTC()` for parsing and `getUTCFullYear/Month/Date` for formatting
- **Files modified:** src/lib/recurring-calculations.js
- **Verification:** All 6 Wave 0 tests pass
- **Committed in:** e9b1d0f (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential for correctness. No scope creep.

## Issues Encountered
- date-fns not installed in worktree node_modules despite being in package.json -- ran npm install
- tests/unit/recurring-schedule.test.js missing from worktree -- copied from main repo
- Jest ESM parsing required `node --experimental-vm-modules` for direct jest invocation

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - PaymentLog and ReminderToggle are imported from Plans 03 and 06 (which create the actual components). If those plans have not yet merged, the imports will fail at build time until they are merged.

## Next Phase Readiness
- Recurring invoice system complete: setup, generation, badges, and management
- Invoice detail page now integrates all Phase 34 features (payment log, reminders, recurring)
- Ready for Phase 35 integrations (QuickBooks/Xero sync, AI work descriptions)

---
*Phase: 34-estimates-reminders-recurring*
*Completed: 2026-04-02*

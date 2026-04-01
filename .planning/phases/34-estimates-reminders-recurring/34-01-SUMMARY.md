---
phase: 34-estimates-reminders-recurring
plan: 01
subsystem: database
tags: [postgres, supabase, rls, migrations, estimates, invoices, recurring, reminders]

# Dependency graph
requires:
  - phase: 33-invoice-core
    provides: "invoices, invoice_line_items, invoice_settings, invoice_sequences tables + get_next_invoice_number RPC"
provides:
  - "estimates, estimate_tiers, estimate_line_items, estimate_sequences tables + get_next_estimate_number RPC"
  - "invoice_payments table for partial payment tracking"
  - "invoice_reminders idempotency table"
  - "invoices status expanded with partially_paid"
  - "invoice_line_items item_type expanded with late_fee"
  - "late fee settings on invoice_settings"
  - "recurring invoice columns on invoices table"
  - "estimate_prefix column on invoice_settings"
  - "formatEstimateNumber utility function"
affects: [34-02, 34-03, 34-04, 34-05, 34-06, 34-07, 34-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Estimate numbering follows same atomic RPC pattern as invoices (INSERT ON CONFLICT DO UPDATE)"
    - "Tiered estimates use estimate_tiers + estimate_line_items with optional tier_id FK"

key-files:
  created:
    - supabase/migrations/030_estimates_schema.sql
    - supabase/migrations/031_payment_log_schema.sql
    - supabase/migrations/032_reminders_recurring.sql
    - src/lib/estimate-number.js
    - tests/unit/estimate-calculations.test.js
  modified: []

key-decisions:
  - "Estimate line items are a separate table from invoice line items (not shared) per D-01"
  - "Tiered estimates use nullable tier_id FK on estimate_line_items — NULL means single-price estimate"
  - "Estimate totals (subtotal/tax_amount/total) are nullable on estimates table to support tiered pricing where totals live on tiers"

patterns-established:
  - "Estimate RLS: same tenant_own + service_role_all pattern as invoices"
  - "Constraint expansion: DROP then ADD constraint for CHECK modifications on existing tables"

requirements-completed: [D-01, D-02, D-04, D-07, D-08, D-09, D-10, D-12, D-14, D-15, D-16, D-17, D-18]

# Metrics
duration: 3min
completed: 2026-04-01
---

# Phase 34 Plan 01: Database Schema Foundation Summary

**3 migrations creating estimates schema (4 tables + RPC), payment log, invoice status/type expansion, reminders idempotency, late fee settings, and recurring invoice columns + formatEstimateNumber utility**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-01T11:19:31Z
- **Completed:** 2026-04-01T11:22:08Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created complete estimates data foundation: estimate_sequences, estimates, estimate_tiers, estimate_line_items tables with RLS + atomic numbering RPC
- Created invoice_payments table and expanded invoices status CHECK (partially_paid) and line_items item_type CHECK (late_fee)
- Created invoice_reminders idempotency table, late fee settings columns, and all recurring invoice columns on invoices table
- formatEstimateNumber utility passes all 4 Wave 0 tests

## Task Commits

Each task was committed atomically:

1. **Task 1: Create estimates schema migration (030)** - `fcf5396` (feat)
2. **Task 2: Create payment log and reminders/recurring migrations (031, 032) + estimate number utility** - `2e16309` (feat)

## Files Created/Modified
- `supabase/migrations/030_estimates_schema.sql` - estimate_sequences, estimates, estimate_tiers, estimate_line_items tables + get_next_estimate_number RPC + estimate_prefix on invoice_settings
- `supabase/migrations/031_payment_log_schema.sql` - invoice_payments table + invoices status expansion (partially_paid) + item_type expansion (late_fee)
- `supabase/migrations/032_reminders_recurring.sql` - invoice_reminders table + late fee settings on invoice_settings + recurring columns on invoices
- `src/lib/estimate-number.js` - formatEstimateNumber utility mirroring invoice-number.js pattern
- `tests/unit/estimate-calculations.test.js` - Wave 0 tests for formatEstimateNumber (copied from test agent)

## Decisions Made
- Estimate line items are a separate table from invoice line items (not shared) per D-01
- Tiered estimates use nullable tier_id FK on estimate_line_items — NULL means single-price estimate
- Estimate totals (subtotal/tax_amount/total) are nullable on estimates table to support tiered pricing where totals live on tiers

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Wave 0 test required NODE_OPTIONS for ESM**
- **Found during:** Task 2 (running estimate-calculations tests)
- **Issue:** Jest config uses ESM but test runner needed --experimental-vm-modules flag
- **Fix:** Ran with NODE_OPTIONS="--experimental-vm-modules" to enable ESM support
- **Verification:** All 4 tests pass
- **Committed in:** 2e16309 (part of Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minor runtime flag needed for ESM test execution. No scope creep.

## Issues Encountered
None beyond the ESM flag for tests.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all files contain complete implementations.

## Next Phase Readiness
- All database tables, constraints, RLS policies, RPCs, and utility functions are ready for API/UI plans (34-02 through 34-08)
- estimate_prefix on invoice_settings ready for estimate numbering in API layer
- invoice_payments table ready for payment log API
- Recurring columns on invoices ready for recurring invoice logic
- Reminder idempotency table ready for reminder sending logic

## Self-Check: PASSED

All 5 created files verified on disk. Both task commits (fcf5396, 2e16309) verified in git log.

---
*Phase: 34-estimates-reminders-recurring*
*Completed: 2026-04-01*

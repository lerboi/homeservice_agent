---
phase: 34-estimates-reminders-recurring
plan: 02
subsystem: api, ui
tags: [nextjs, supabase, estimates, crud, react, dashboard]

# Dependency graph
requires:
  - phase: 34-estimates-reminders-recurring
    plan: 01
    provides: "estimates, estimate_tiers, estimate_line_items, estimate_sequences tables + get_next_estimate_number RPC + formatEstimateNumber utility"
provides:
  - "GET/POST /api/estimates — list with summary aggregates and create (single-price + tiered)"
  - "GET/PATCH/DELETE /api/estimates/[id] — detail, update with status transitions, draft-only delete"
  - "EstimateStatusBadge component with ESTIMATE_STATUS_CONFIG export"
  - "EstimateSummaryCards component with pending_count, approved_value, conversion_rate"
  - "Estimate list page at /dashboard/estimates with status tabs, tier range display, empty states"
affects: [34-03, 34-04, 34-05, 34-06, 34-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Estimate API mirrors invoice API pattern (createSupabaseServer + getTenantId + status filter + summary aggregates)"
    - "Tiered estimates: estimate-level totals NULL, per-tier totals from estimate_tiers table"
    - "Tier range display in list: min-max from estimate_tiers for amount column"

key-files:
  created:
    - src/app/api/estimates/route.js
    - src/app/api/estimates/[id]/route.js
    - src/components/dashboard/EstimateStatusBadge.jsx
    - src/components/dashboard/EstimateSummaryCards.jsx
    - src/app/dashboard/estimates/page.js
  modified: []

key-decisions:
  - "Tiered estimate approved_value uses highest tier total (max) as representative value in summary"
  - "Summary metrics fetched once on mount only — filter changes do not re-fetch summary, matching invoice pattern"
  - "Create Estimate button uses Link component (not onClick + router.push) for better accessibility"

patterns-established:
  - "Estimate status tabs include all 5 statuses (draft/sent/approved/declined/expired) unlike invoices which have 5 different ones"
  - "formatAmountRange helper displays $min - $max for tiered estimates in list table"

requirements-completed: [D-01, D-02, D-04, D-06, D-07]

# Metrics
duration: 3min
completed: 2026-04-01
---

# Phase 34 Plan 02: Estimates CRUD API & List Page Summary

**Estimates CRUD API with single-price and tiered support, status badges, summary cards, and list page with status filtering at /dashboard/estimates**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-01T11:28:59Z
- **Completed:** 2026-04-01T11:32:41Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Built complete estimates CRUD API: list with summary aggregates (pending_count, approved_value, conversion_rate), create supporting both single-price and tiered (Good/Better/Best), detail with tiers and line items, update with status transitions, and draft-only delete
- Created EstimateStatusBadge with 5-status config and EstimateSummaryCards with 3 metric cards matching UI-SPEC colors
- Built estimate list page with status tabs, desktop table + mobile cards, tiered amount range display, empty/error/loading states

## Task Commits

Each task was committed atomically:

1. **Task 1: Create estimates CRUD API routes** - `475f7a1` (feat)
2. **Task 2: Create EstimateStatusBadge and EstimateSummaryCards components** - `5f58f3f` (feat)
3. **Task 3: Create estimate list page with status tabs and empty state** - `7c8aca5` (feat)

## Files Created/Modified
- `src/app/api/estimates/route.js` - GET list with summary/status_counts + POST create (single-price and tiered)
- `src/app/api/estimates/[id]/route.js` - GET detail + PATCH update with status transitions + DELETE (draft only)
- `src/components/dashboard/EstimateStatusBadge.jsx` - Status badge with ESTIMATE_STATUS_CONFIG for 5 statuses
- `src/components/dashboard/EstimateSummaryCards.jsx` - 3 summary cards: Pending Estimates, Approved Value, Conversion Rate
- `src/app/dashboard/estimates/page.js` - List page with tabs, table/cards, tier range display, empty states

## Decisions Made
- Tiered estimate approved_value uses highest tier total (max) as representative value in summary aggregates
- Summary metrics fetched once on mount only — filter changes do not re-fetch summary, matching the established invoice pattern
- Create Estimate button uses Link component for better accessibility and prefetching

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all files contain complete implementations with data wired to API endpoints.

## Next Phase Readiness
- CRUD API ready for estimate detail page (34-03), estimate create/edit form (34-04)
- EstimateStatusBadge and EstimateSummaryCards ready for reuse across estimate pages
- Status transitions (sent_at, approved_at, declined_at) ready for workflow actions

## Self-Check: PASSED

All 5 created files verified on disk. All 3 task commits (475f7a1, 5f58f3f, 7c8aca5) verified in git log.

---
*Phase: 34-estimates-reminders-recurring*
*Completed: 2026-04-01*

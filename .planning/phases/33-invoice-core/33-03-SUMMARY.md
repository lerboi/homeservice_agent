---
phase: 33-invoice-core
plan: 03
subsystem: api, ui
tags: [invoices, supabase, next-api-routes, navigation, react]

# Dependency graph
requires:
  - phase: 33-invoice-core
    plan: 01
    provides: invoice DB schema, invoice_sequences table, get_next_invoice_number RPC, formatInvoiceNumber, calculateLineTotal, calculateInvoiceTotals
  - phase: 33-invoice-core
    plan: 02
    provides: invoice_settings table and API, invoice prefix/tax-rate stored per tenant
provides:
  - Invoice CRUD API at /api/invoices (GET list + POST create) and /api/invoices/[id] (GET detail + PATCH update)
  - Atomic sequential invoice numbering via get_next_invoice_number RPC
  - Overdue bulk-update on every GET /api/invoices call
  - Summary aggregates (total_outstanding, overdue_amount, paid_this_month) and status counts
  - Status-gated PATCH: draft = all editable, sent/overdue = status only, paid/void = no edits
  - Invoices tab in sidebar and mobile bottom bar (replacing Analytics)
  - Analytics relocated to /dashboard/more/analytics with redirect at old URL
  - Placeholder /dashboard/invoices page (for Plan 04 to replace)
affects:
  - 33-invoice-core plan 04 (Invoice List UI — depends on GET /api/invoices shape)
  - 33-invoice-core plan 05 (Invoice Editor — depends on POST and PATCH shapes)
  - 33-invoice-core plan 07 (Delivery — depends on PATCH status transitions)
  - dashboard-crm-system skill (navigation changed)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Status-gated mutation: PATCH checks current status before allowing field edits
    - Overdue bulk-update on read: GET runs UPDATE before SELECT so list is always current
    - Aggregate summary pattern: 3 separate aggregate queries return summary card data alongside list

key-files:
  created:
    - src/app/api/invoices/route.js
    - src/app/api/invoices/[id]/route.js
    - src/app/dashboard/invoices/page.js
    - src/app/dashboard/more/analytics/page.js
  modified:
    - src/components/dashboard/DashboardSidebar.jsx
    - src/components/dashboard/BottomTabBar.jsx
    - src/app/dashboard/analytics/page.js
    - src/app/dashboard/more/page.js

key-decisions:
  - "Analytics relocated to /dashboard/more/analytics (not removed) — existing data preserved, redirect handles old URL"
  - "Overdue detection runs on every GET /api/invoices (not a cron) — simpler, no infra cost, list always accurate"
  - "Aggregate summary queries are separate Supabase queries (not SQL aggregates) — compatible with RLS row-level policies"
  - "Placeholder invoices page created now so navigation link does not 404 before Plan 04"

patterns-established:
  - "Status-gated mutation: check current invoice status before allowing any field edits in PATCH handler"
  - "Overdue bulk-update on read: run UPDATE before SELECT in list endpoint to keep status current without cron"

requirements-completed: [D-01, D-13, D-14, D-15]

# Metrics
duration: ~30min
completed: 2026-04-01
---

# Phase 33 Plan 03: Invoice CRUD API and Navigation Surgery Summary

**Invoice CRUD API with atomic numbering and overdue detection, plus Analytics relocated to /more/analytics and Invoices promoted to primary nav tab**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-04-01T18:00:00Z
- **Completed:** 2026-04-01T18:24:43Z
- **Tasks:** 2 of 2
- **Files modified:** 8

## Accomplishments

- Invoice list/create API at `/api/invoices` with atomic sequential numbering via `get_next_invoice_number` RPC, overdue bulk-update on every GET, and summary aggregates (total_outstanding, overdue_amount, paid_this_month, status_counts)
- Invoice detail/update API at `/api/invoices/[id]` with status-gated PATCH (draft = all fields, sent/overdue = status only, paid/void = blocked)
- Navigation surgery: Invoices replaces Analytics in both sidebar and mobile bottom bar; Analytics relocated to `/dashboard/more/analytics` with server-side redirect at old URL

## Task Commits

Each task was committed atomically:

1. **Task 1: Create invoice CRUD API routes** - `d8cdcf1` (feat)
2. **Task 2: Navigation surgery** - `ddbfd47` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified

- `src/app/api/invoices/route.js` - GET list with overdue bulk-update + summary aggregates; POST create with atomic invoice numbering
- `src/app/api/invoices/[id]/route.js` - GET detail with line items; PATCH update with status-gated edit restrictions
- `src/app/dashboard/invoices/page.js` - Placeholder page so nav link doesn't 404 (Plan 04 will replace)
- `src/app/dashboard/more/analytics/page.js` - Analytics page moved here from /dashboard/analytics
- `src/components/dashboard/DashboardSidebar.jsx` - BarChart3 replaced by FileText; Analytics nav entry replaced by Invoices
- `src/components/dashboard/BottomTabBar.jsx` - BarChart3 replaced by FileText; Analytics tab replaced by Invoices
- `src/app/dashboard/analytics/page.js` - Converted to server-side redirect to /dashboard/more/analytics
- `src/app/dashboard/more/page.js` - Analytics link href updated to /dashboard/more/analytics

## Decisions Made

- Analytics relocated to `/dashboard/more/analytics` rather than removed — preserves existing user data and feature, redirect handles old URL transparently.
- Overdue detection runs on every `GET /api/invoices` (bulk UPDATE before SELECT) rather than a cron job — simpler, zero infra cost, list is always accurate without needing a scheduler.
- Aggregate summary queries use separate Supabase queries (not raw SQL aggregates) to remain compatible with RLS row-level policies that filter by tenant_id.
- Placeholder invoices page created in this plan so the nav link is immediately functional; Plan 04 replaces it with the full Invoice List UI.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Updated More page Analytics link to new URL**
- **Found during:** Task 2 (Navigation surgery)
- **Issue:** Plan specified converting /dashboard/analytics to a redirect and creating /dashboard/more/analytics, but did not mention updating the More page's Analytics link (which pointed to /dashboard/analytics). Without this fix, the More page would link to the redirect rather than the canonical URL, causing a double redirect on every click.
- **Fix:** Updated `MORE_ITEMS` in `src/app/dashboard/more/page.js` to use `/dashboard/more/analytics` as the href.
- **Files modified:** src/app/dashboard/more/page.js
- **Verification:** More page Analytics entry now links directly to /dashboard/more/analytics.
- **Committed in:** ddbfd47 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 - missing critical link update)
**Impact on plan:** Necessary for correctness — without it the More page would have a broken/double-redirect link. No scope creep.

## Known Stubs

- `src/app/dashboard/invoices/page.js` — Intentional placeholder. Shows "Invoice list loading..." text. Plan 04 (Invoice List UI) will replace this with the full data-fetching invoice list component. This stub does not prevent the plan goal (navigation surgery) from being achieved.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `/api/invoices` and `/api/invoices/[id]` are ready for Plan 04 (Invoice List UI) and Plan 05 (Invoice Editor) to consume
- Navigation is in place — users can navigate to /dashboard/invoices immediately
- Plan 04 can safely overwrite `src/app/dashboard/invoices/page.js` with full list UI

---
*Phase: 33-invoice-core*
*Completed: 2026-04-01*

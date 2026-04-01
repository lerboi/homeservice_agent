---
phase: 35-invoice-integrations-and-ai
plan: 03
subsystem: api, ui
tags: [batch-invoicing, invoice-send, leads, react-pdf, resend]

requires:
  - phase: 33-invoice-core
    provides: Invoice CRUD, PDF generation, email delivery, invoice settings, invoice_line_items table
provides:
  - Shared sendSingleInvoice function in src/lib/invoice-send.js
  - Batch invoice creation from multiple leads via POST /api/invoices/batch
  - Batch invoice sending via POST /api/invoices/batch-send
  - Multi-select UI on leads page for batch invoicing
  - Batch review page at /dashboard/invoices/batch-review
  - Checkbox shadcn component
affects: [35-invoice-integrations-and-ai, dashboard-crm-system]

tech-stack:
  added: ["@radix-ui/react-checkbox"]
  patterns: ["Shared send function pattern — single source of truth for invoice delivery", "Batch API pattern with per-item error tracking"]

key-files:
  created:
    - src/lib/invoice-send.js
    - src/app/api/invoices/batch/route.js
    - src/app/api/invoices/batch-send/route.js
    - src/app/dashboard/invoices/batch-review/page.js
    - src/components/ui/checkbox.jsx
  modified:
    - src/app/api/invoices/[id]/send/route.js
    - src/app/dashboard/leads/page.js

key-decisions:
  - "Extracted sendSingleInvoice as shared function so batch-send and single-send both call same code — future hooks (accounting sync) apply to both paths"
  - "Batch create produces shell drafts (subtotal/tax/total=0, no line items) — owner adds line items during review per D-11"
  - "Batch-send continues on individual failure — does not stop on first error, returns per-invoice results"
  - "Added @radix-ui/react-checkbox for Checkbox shadcn component (was missing from project)"

patterns-established:
  - "Shared send function: All invoice sending goes through sendSingleInvoice — never inline send logic in routes"
  - "Batch API pattern: Accept array of IDs, process sequentially, return per-item results with summary counts"

requirements-completed: [D-10, D-11]

duration: 7min
completed: 2026-04-01
---

# Phase 35 Plan 03: Batch Invoice Creation and Sending Summary

**Shared sendSingleInvoice function extracted from send route, batch create/send APIs, leads multi-select with batch review page**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-01T11:11:34Z
- **Completed:** 2026-04-01T11:18:56Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Extracted invoice send logic into shared `sendSingleInvoice` function so both single and batch sends use same code path
- Created batch invoice creation endpoint that produces draft invoices from completed leads with pre-filled customer data
- Created batch send endpoint that sends all invoices with per-invoice result tracking (continues on failure)
- Added multi-select checkboxes on leads page for eligible leads (completed, no existing invoice) with sticky batch action bar
- Built batch review page with draft list, edit/remove per invoice, Send All with progress tracking and results display

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract shared send logic and create batch API endpoints** - `ea99009` (feat)
2. **Task 2: Leads multi-select UI and batch review page** - `6f2542f` (feat)

## Files Created/Modified
- `src/lib/invoice-send.js` - Shared sendSingleInvoice function (single source of truth for invoice delivery)
- `src/app/api/invoices/[id]/send/route.js` - Refactored to thin wrapper delegating to sendSingleInvoice
- `src/app/api/invoices/batch/route.js` - POST endpoint for batch draft creation from lead IDs
- `src/app/api/invoices/batch-send/route.js` - POST endpoint for batch sending via sendSingleInvoice loop
- `src/app/dashboard/leads/page.js` - Added multi-select checkboxes, batch select bar, Create Invoices flow
- `src/app/dashboard/invoices/batch-review/page.js` - Batch review page with Send All and progress tracking
- `src/components/ui/checkbox.jsx` - Checkbox shadcn component using @radix-ui/react-checkbox

## Decisions Made
- Extracted sendSingleInvoice as shared function so batch-send and single-send both call same code — future hooks (accounting sync in Plan 04) apply to both paths automatically
- Batch create produces shell drafts (subtotal/tax/total=0, no line items) — owner adds line items during review per D-11
- Batch-send continues on individual failure — does not stop on first error, returns per-invoice results with summary counts
- Added @radix-ui/react-checkbox for Checkbox shadcn component (was missing from project)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added missing Checkbox shadcn component and @radix-ui/react-checkbox dependency**
- **Found during:** Task 2 (Leads multi-select UI)
- **Issue:** Plan references Checkbox component from shadcn but it did not exist in the project, nor was the radix checkbox package installed
- **Fix:** Created src/components/ui/checkbox.jsx following shadcn new-york preset pattern, installed @radix-ui/react-checkbox
- **Files modified:** src/components/ui/checkbox.jsx, package.json, package-lock.json
- **Verification:** Import resolves correctly in leads page
- **Committed in:** 6f2542f (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix necessary for component to exist. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all data flows are wired to real API endpoints.

## Next Phase Readiness
- sendSingleInvoice is ready for Plan 04 to add accounting sync hooks
- Batch review page navigates to existing invoice detail page for editing
- All batch endpoints follow same auth/tenant pattern as existing invoice APIs

---
*Phase: 35-invoice-integrations-and-ai*
*Completed: 2026-04-01*

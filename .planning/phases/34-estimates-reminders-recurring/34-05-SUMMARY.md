---
phase: 34-estimates-reminders-recurring
plan: 05
subsystem: api, ui
tags: [estimates, pdf, email, sms, resend, twilio, invoice-conversion, sidebar-nav]

# Dependency graph
requires:
  - phase: 34-04
    provides: "Estimate editor, PDF generation (generateEstimatePDF), estimate CRUD API, EstimateStatusBadge"
  - phase: 33-invoice-core
    provides: "Invoice CRUD API, invoice_line_items table, get_next_invoice_number RPC, invoice send pattern, InvoiceStatusBadge"
provides:
  - "Estimate send route (email + SMS with PDF attachment)"
  - "Estimate convert-to-invoice route (idempotent, single-price and tiered)"
  - "Estimate detail page with full lifecycle actions"
  - "Sidebar navigation for estimates"
  - "LeadFlyout Create Estimate button"
affects: [dashboard-crm-system, public-site-i18n]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Estimate send mirrors invoice send pattern (Resend email + Twilio SMS, SMS non-fatal)"
    - "Idempotent convert-to-invoice via converted_to_invoice_id null check"
    - "Tiered convert flow uses Dialog with radio tier selection"

key-files:
  created:
    - src/app/api/estimates/[id]/send/route.js
    - src/app/api/estimates/[id]/convert/route.js
    - src/app/dashboard/estimates/[id]/page.js
  modified:
    - src/components/dashboard/DashboardSidebar.jsx
    - src/components/dashboard/LeadFlyout.jsx

key-decisions:
  - "Inline HTML email template for estimates (not React Email) -- simpler for estimate-only delivery"
  - "Convert route returns existing invoice_id if already converted (idempotency, not error)"

patterns-established:
  - "Estimate send: generateEstimatePDF -> Resend email with attachment -> optional Twilio SMS (non-fatal)"
  - "Convert-to-invoice: idempotent check, tier selection for tiered estimates, atomic invoice number via RPC"

requirements-completed: [D-03, D-04, D-05, D-06]

# Metrics
duration: 5min
completed: 2026-04-01
---

# Phase 34 Plan 05: Estimate Detail, Send, and Convert-to-Invoice Summary

**Estimate send via email/SMS with PDF, convert-to-invoice with tier selection, detail page with full lifecycle actions, sidebar nav and LeadFlyout integration**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-01T16:45:54Z
- **Completed:** 2026-04-01T16:51:08Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Estimate send route delivers email with PDF attachment via Resend, optional SMS via Twilio with single-price and tiered copy patterns
- Convert-to-invoice route creates draft invoice from estimate with idempotency check, supports both single-price and tiered (tier selection required)
- Estimate detail page with 70/30 layout, all status actions (send, approve, decline, expire), convert-to-invoice flow, download PDF, edit link
- Estimates nav item added to DashboardSidebar after Invoices
- Create Estimate button added to LeadFlyout alongside Create Invoice

## Task Commits

Each task was committed atomically:

1. **Task 1: Create estimate send and convert-to-invoice API routes** - `941049a` (feat)
2. **Task 2: Create estimate detail page and update navigation + LeadFlyout** - `7e5b4f2` (feat)

## Files Created/Modified
- `src/app/api/estimates/[id]/send/route.js` - POST handler: generates PDF, sends email via Resend with attachment, SMS via Twilio (non-fatal), updates status to sent
- `src/app/api/estimates/[id]/convert/route.js` - POST handler: creates draft invoice from estimate, idempotent, handles single-price and tiered with tier_id selection
- `src/app/dashboard/estimates/[id]/page.js` - Estimate detail page with preview, metadata, and all lifecycle action buttons
- `src/components/dashboard/DashboardSidebar.jsx` - Added Estimates nav item with ClipboardList icon
- `src/components/dashboard/LeadFlyout.jsx` - Added Create Estimate button with ClipboardList icon and brandOrange border

## Decisions Made
- Used inline HTML email template for estimate delivery rather than a React Email component -- simpler for a single send route, can be upgraded to React Email later if needed
- Convert route returns existing invoice_id with `already_converted: true` flag instead of erroring when estimate is already converted -- better UX for double-click scenarios
- Download PDF uses client-side blob download pattern (fetch -> blob -> anchor click) matching the invoice detail approach

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Estimate lifecycle is complete: create, edit, send, view detail, manage status, convert to invoice
- All entry points wired: sidebar nav, LeadFlyout Create Estimate button
- Ready for reminder and recurring invoice features in subsequent plans

---
*Phase: 34-estimates-reminders-recurring*
*Completed: 2026-04-01*

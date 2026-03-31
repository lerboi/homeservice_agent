---
phase: 33-invoice-core
plan: "06"
subsystem: ui, api
tags: [react-pdf, pdf-generation, invoice, white-label, next-js, supabase]

# Dependency graph
requires:
  - phase: 33-invoice-core plan 01
    provides: "@react-pdf/renderer installed and serverExternalPackages configured"
  - phase: 33-invoice-core plan 02
    provides: "GET /api/invoice-settings returning business header info"
  - phase: 33-invoice-core plan 03
    provides: "GET /api/invoices/[id] returning invoice + line_items, PATCH /api/invoices/[id]"
  - phase: 33-invoice-core plan 04
    provides: "InvoiceStatusBadge component with STATUS_CONFIG"
provides:
  - "White-labeled @react-pdf/renderer InvoicePDF component (src/lib/invoice-pdf.jsx)"
  - "GET /api/invoices/[id]/pdf — returns PDF buffer with correct Content-Type/Content-Disposition"
  - "Invoice detail page at /dashboard/invoices/[id] with 70/30 desktop layout"
  - "Download PDF, Send Invoice, Edit, Mark as Paid, Void actions with appropriate status guards"
affects: [33-07-send, 33-08-payment-link, 34-estimates]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "renderToBuffer(JSX) in API route for server-side PDF generation"
    - "HTML/CSS invoice preview mirrors PDF layout without embedding actual PDF"
    - "Status-gated action buttons: isDraft / isSentOrOverdue / isPaidOrVoid flags"
    - "AlertDialog for destructive confirmation (Void) with exact UI-SPEC copywriting"

key-files:
  created:
    - src/lib/invoice-pdf.jsx
    - src/app/api/invoices/[id]/pdf/route.js
    - src/app/dashboard/invoices/[id]/page.js
  modified: []

key-decisions:
  - "HTML/CSS invoice preview (not PDF embed) in detail page — faster render, no CORS, matches PDF layout visually"
  - "formatMoney uses toLocaleString en-US for comma separators and 2dp on both PDF and HTML preview"
  - "Send Invoice button shows toast 'Send feature coming soon' — actual delivery in Plan 07"

patterns-established:
  - "Pattern: InvoicePDF receives invoice, settings, lineItems — all data fetched in API route, none hardcoded"
  - "Pattern: PDF comment header states brand-neutrality without using platform name (avoids grep false positive)"

requirements-completed: [D-05, D-08, D-09, D-12]

# Metrics
duration: 7min
completed: "2026-04-01"
---

# Phase 33 Plan 06: PDF Generation and Invoice Detail View Summary

**@react-pdf/renderer white-labeled InvoicePDF component + GET /api/invoices/[id]/pdf download route + 70/30 invoice detail page with Download, Mark as Paid, and Void actions**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-31T18:56:50Z
- **Completed:** 2026-04-01T19:04:10Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- InvoicePDF React component with full business header (logo, name, address, phone, email, license), Bill To section, line items table (alternating shading, markup in description for materials, negative amounts for discounts), totals (subtotal, tax when > 0, Total Due bold 14pt), payment terms + notes footer — zero platform branding (D-09)
- GET /api/invoices/[id]/pdf API route using renderToBuffer — tenant-isolated RLS query, returns application/pdf buffer with Content-Disposition filename
- Invoice detail page with 70/30 desktop layout: HTML/CSS invoice preview matching PDF appearance on left, metadata + stacked action buttons on right; mobile sticky action bar

## Task Commits

Each task was committed atomically:

1. **Task 1: Create InvoicePDF component and PDF download API route** - `df2d979` (feat)
2. **Task 2: Create invoice detail page with actions** - `0a218b5` (feat)

**Plan metadata:** (recorded below after final commit)

## Files Created/Modified

- `src/lib/invoice-pdf.jsx` - @react-pdf/renderer Document component with full invoice layout, white-label compliant
- `src/app/api/invoices/[id]/pdf/route.js` - GET endpoint; fetches invoice + line_items + settings; renders to buffer; returns PDF with attachment headers
- `src/app/dashboard/invoices/[id]/page.js` - 'use client' invoice detail page; 70/30 desktop layout; loading skeleton; error state; all action buttons with status guards; void AlertDialog with exact UI-SPEC copy

## Decisions Made

- HTML/CSS invoice preview (not PDF embed) in detail page: faster render, no CORS issues, no loading delay — the HTML version mirrors the PDF layout via matching structure and Tailwind classes
- `formatMoney` helper uses `toLocaleString('en-US')` for comma separators and consistent 2dp formatting in both the PDF and HTML preview
- Send Invoice button shows a "Send feature coming soon" toast rather than wiring an incomplete endpoint — Plan 07 adds the actual send flow; the UI placeholder satisfies the button visibility requirement (D-05)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] PDF comment header contained "Voco" causing white-label grep check to fail**
- **Found during:** Task 1 verification
- **Issue:** Comment text "ZERO Voco branding" included the word "Voco" — the verification command `grep -qi "voco"` matched the comment and returned exit code 0, causing the negated check to fail
- **Fix:** Rewrote the comment as brand-neutral ("This file is brand-neutral") without referencing the platform name
- **Files modified:** src/lib/invoice-pdf.jsx (comment only)
- **Verification:** `! grep -qi "voco" src/lib/invoice-pdf.jsx` now passes
- **Committed in:** df2d979 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — comment-only bug)
**Impact on plan:** Trivial comment rewording, zero functional change. No scope creep.

## Known Stubs

- `src/app/dashboard/invoices/[id]/page.js` line 350: `toast.info('Send feature coming soon')` — Send Invoice button shows a placeholder toast. Plan 07 (send flow) will wire the actual `POST /api/invoices/[id]/send` call and replace this stub.

## Issues Encountered

None — implementation followed plan exactly after the comment-wording bug fix.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- PDF generation and download are fully functional; Plan 07 (send flow) can import `InvoicePDF` and use `renderToBuffer` to attach the PDF to Resend emails
- Invoice detail page is ready for Plan 07 to replace the "Send feature coming soon" stub with the actual send dialog
- Mark as Paid and Void actions are wired and working
- `grep -i "voco" src/lib/invoice-pdf.jsx` returns nothing (D-09 verified)

---
*Phase: 33-invoice-core*
*Completed: 2026-04-01*

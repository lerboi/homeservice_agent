---
phase: 33-invoice-core
plan: "05"
subsystem: invoices
tags: [invoice-editor, line-items, lead-prefill, calculations]
dependency_graph:
  requires: [33-01, 33-03]
  provides: [invoice-creation-page, line-item-editor, lead-prefill-flow]
  affects: [dashboard-invoices, lead-flyout-create-invoice]
tech_stack:
  added: []
  patterns:
    - Type-dependent field visibility via getFieldConfig helper
    - Sticky bottom action bar for mobile via fixed positioning + md:hidden
    - Auto due-date calculation via date-fns addDays on paymentTerms change
key_files:
  created:
    - src/components/dashboard/LineItemRow.jsx
    - src/components/dashboard/InvoiceEditor.jsx
    - src/app/dashboard/invoices/new/page.js
  modified: []
decisions:
  - Discount line total displayed as "$X.XX (-)" with red text to make discount visually clear
  - Send flow creates invoice first then fires /api/invoices/:id/send; delivery silently ignored until Plan 07 wires it
  - Payment terms dropdown includes "Due on Receipt" (0 days) alongside Net 15/30/45/60
  - useEffect watches initialData changes so async lead pre-fill (from parent fetch) applies after mount
metrics:
  duration_minutes: 12
  completed_date: "2026-04-01"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 0
---

# Phase 33 Plan 05: Invoice Editor Summary

Invoice editor with typed line items, auto-calculated totals, customer info fields, and async lead pre-fill at /dashboard/invoices/new.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create LineItemRow component | 4433a8f | src/components/dashboard/LineItemRow.jsx |
| 2 | Create InvoiceEditor and new invoice page | 33ceea3 | src/components/dashboard/InvoiceEditor.jsx, src/app/dashboard/invoices/new/page.js |

## What Was Built

### LineItemRow (`src/components/dashboard/LineItemRow.jsx`)
- `'use client'` component rendering a single editable invoice line item row
- 5 item types via shadcn Select: labor, materials, travel, flat_rate, discount
- Type-dependent field visibility via `getFieldConfig()`: qty hidden for travel/flat_rate/discount, markup % only shown for materials, taxable switch hidden for discount
- Imports and calls `calculateLineTotal` from `@/lib/invoice-calculations` to display real-time line total
- Discount type: total rendered in red (`text-red-600`)
- Trash2 (lucide) remove button
- Type change resets: quantity=1, markup_pct=0, taxable=type-appropriate default

### InvoiceEditor (`src/components/dashboard/InvoiceEditor.jsx`)
- `'use client'` component with full invoice form
- Customer info card: name (required), email, phone, address, job type — 2-col grid on desktop
- Dates card: issue date (default today), payment terms select (Due on Receipt / Net 15/30/45/60), due date (auto-calculated via date-fns `addDays`)
- Line items card: renders `<LineItemRow>` for each item; "Add Line Item" (outline, Plus icon) adds new labor item
- Totals section: Subtotal, Tax line (hidden when tax_amount = 0), Total Due — right-aligned using Separator
- Notes textarea pre-filled from `settings.default_notes` per D-07
- Mobile: sticky bottom action bar (fixed, z-40, bg-white, border-t)
- Desktop: right-aligned button group
- Both action bars: "Save as Draft" (outline) + "Send Invoice" (bg-[#C2410C]) with Loader2 spinner when saving

### New Invoice Page (`src/app/dashboard/invoices/new/page.js`)
- `'use client'` page reads `lead_id` from `useSearchParams()` per D-02
- On mount: fetches `GET /api/invoice-settings`; if lead_id present also fetches `GET /api/leads/${lead_id}`
- Maps lead fields: `caller_name → customer_name`, `caller_phone → customer_phone`, `service_address → customer_address`, `service_type → job_type`
- `handleSave`: POSTs to `/api/invoices`, toasts "Invoice saved as draft", navigates to `/dashboard/invoices/${id}`
- `handleSend`: creates invoice then fires `/api/invoices/${id}/send` (silently ignored until Plan 07 wires delivery); toasts "Invoice created"
- Loading skeleton shown while fetching settings/lead data
- Back arrow (ArrowLeft lucide) linking to `/dashboard/invoices`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

- `handleSend` fires POST to `/api/invoices/${id}/send` but catches and ignores any error — intentional stub per plan spec. Plan 07 will wire delivery. The invoice IS created; only the send delivery is deferred.

## Self-Check

### Files exist
- [x] src/components/dashboard/LineItemRow.jsx
- [x] src/components/dashboard/InvoiceEditor.jsx
- [x] src/app/dashboard/invoices/new/page.js

### Commits exist
- [x] 4433a8f — feat(33-05): create LineItemRow component
- [x] 33ceea3 — feat(33-05): create InvoiceEditor and new invoice page

## Self-Check: PASSED

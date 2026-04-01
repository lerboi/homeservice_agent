---
phase: 35-invoice-integrations-and-ai
plan: "06"
subsystem: invoices
tags: [invoice, edit-mode, ai-describe, gap-closure]
dependency_graph:
  requires: []
  provides: [edit-mode-invoice-new-page, ai-describe-button-reachable]
  affects: [src/app/dashboard/invoices/new/page.js, src/components/dashboard/InvoiceEditor.jsx]
tech_stack:
  added: []
  patterns: [edit-mode via query param, PATCH for updates, prop drilling invoiceId/leadId/hasTranscript]
key_files:
  created: []
  modified:
    - src/app/dashboard/invoices/new/page.js
    - src/components/dashboard/InvoiceEditor.jsx
decisions:
  - hasTranscript uses !!invoice.lead_id as proxy — ai-describe endpoint validates transcript availability and returns clear error if none found
  - edit param takes precedence over lead_id param in new/page.js — prevents conflicting pre-fill
  - Back link in edit mode navigates to invoice detail page (not invoice list) for UX continuity
metrics:
  duration_minutes: 15
  completed_date: "2026-04-02"
  tasks_completed: 1
  tasks_planned: 1
  files_modified: 2
---

# Phase 35 Plan 06: Invoice Edit Mode and AI Describe Gap Closure Summary

Edit mode wired to `new/page.js` via `?edit=id` query param — fetches existing invoice, pre-populates all fields including line items, uses PATCH on save, and passes `invoiceId`/`leadId`/`hasTranscript` props to InvoiceEditor so the AI Describe button is now reachable.

## What Was Built

### Task 1: Edit mode for new/page.js + InvoiceEditor field hydration (bf23261)

**`src/app/dashboard/invoices/new/page.js`:**
- Reads `?edit=id` query param via `searchParams.get('edit')`
- When `editId` present, fetches `GET /api/invoices/${editId}` to load existing invoice + line_items
- Stores three new state vars: `editInvoiceId`, `editLeadId`, `editHasTranscript`
- `handleSave`: uses `PATCH /api/invoices/${editInvoiceId}` in edit mode, redirects to detail page
- `handleSend`: PATCHes invoice first in edit mode, then fires send endpoint, redirects to detail page
- Page heading shows "Edit Invoice" when `editInvoiceId` is set, "New Invoice" otherwise
- Back link navigates to invoice detail page in edit mode
- Passes `invoiceId={editInvoiceId}`, `leadId={editLeadId}`, `hasTranscript={editHasTranscript}` to InvoiceEditor
- Create mode (no `edit` param) fully preserved

**`src/components/dashboard/InvoiceEditor.jsx`:**
- Extended `initialData` useEffect to hydrate: `issued_date`, `payment_terms`, `due_date`, `notes`, `line_items`
- `line_items` from `initialData` replaces the default `[emptyLineItem(0)]` state when present

## Deviations from Plan

None — plan executed exactly as written, with one minor clarification: `hasTranscript` is set to `!!invoice.lead_id` (presence of lead_id) rather than a separate API call for transcript existence. The `ai-describe` endpoint validates transcript availability internally and returns a user-friendly error message when no transcripts exist, making a separate check unnecessary.

## Known Stubs

None — all data is live-fetched from the API.

## Self-Check: PASSED

- `src/app/dashboard/invoices/new/page.js` contains all required patterns: `searchParams.get('edit')`, `api/invoices/`, `invoiceId={editInvoiceId}`, `leadId={editLeadId}`, `hasTranscript={editHasTranscript}`, `Edit Invoice`, `PATCH`, `editInvoiceId`
- `src/components/dashboard/InvoiceEditor.jsx` contains all hydration patterns: `initialData.line_items`, `setLineItems(initialData`, `initialData.issued_date`, `initialData.payment_terms`, `initialData.due_date`, `initialData.notes`
- Commit bf23261 exists and contains both files

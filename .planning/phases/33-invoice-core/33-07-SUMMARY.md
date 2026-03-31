---
phase: 33-invoice-core
plan: "07"
subsystem: invoices
tags: [invoices, email, sms, pdf, react-email, bidirectional-sync, lead-flyout, resend, twilio]
dependency_graph:
  requires: [33-02, 33-03, 33-06]
  provides: [invoice-delivery, bidirectional-sync, lead-invoice-entry-point]
  affects: [leads, invoices, notifications]
tech_stack:
  added: []
  patterns:
    - React Email template for invoice HTML body (InvoiceEmail.jsx)
    - renderToBuffer for PDF attachment generation
    - sync_source flag for circular-update prevention in bidirectional sync
    - Pure guard functions (shouldSyncToLead, shouldSyncToInvoice) for testable sync logic
key_files:
  created:
    - src/emails/InvoiceEmail.jsx
    - src/app/api/invoices/[id]/send/route.js
    - src/lib/invoice-sync.js
    - tests/unit/invoice-sync.test.js
  modified:
    - src/lib/notifications.js
    - src/app/api/invoices/[id]/route.js
    - src/app/api/invoices/route.js
    - src/app/api/leads/[id]/route.js
    - src/components/dashboard/LeadFlyout.jsx
    - .claude/skills/dashboard-crm-system/SKILL.md
decisions:
  - getResendClient and getTwilioClient exported from notifications.js — required for invoice send route to use shared lazy-init clients
  - Lead PATCH to 'paid' uses direct Supabase update for invoice sync (not internal fetch) to avoid HTTP round-trip overhead
  - Invoice PATCH to 'paid' uses internal fetch to lead PATCH route to reuse all lead update logic including activity log
  - SMS failure is non-fatal — email is already delivered before SMS attempt, Twilio errors are caught and logged only
metrics:
  duration_seconds: 1187
  completed_date: "2026-04-01"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 10
---

# Phase 33 Plan 07: Invoice Delivery, Bidirectional Sync, and LeadFlyout Integration Summary

Invoice email delivery via Resend with PDF attachment, optional SMS from business phone number, bidirectional invoice-lead status sync with circular-update guard, and Create Invoice entry point in LeadFlyout.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | InvoiceEmail template and send API route | d97ec69 | src/emails/InvoiceEmail.jsx, src/app/api/invoices/[id]/send/route.js |
| 2 | Bidirectional sync between invoices and leads | fc774a6 | src/lib/invoice-sync.js, tests/unit/invoice-sync.test.js, src/app/api/invoices/[id]/route.js, src/app/api/leads/[id]/route.js |
| 3 | "Create Invoice" button in LeadFlyout | 983ec4e | src/components/dashboard/LeadFlyout.jsx, src/app/api/invoices/route.js |

## What Was Built

### Task 1: InvoiceEmail template and send API route

`src/emails/InvoiceEmail.jsx` — React Email template for the invoice email body. Uses `@react-email/components` (Html, Head, Body, Container, Section, Text, Hr, Img). White-labeled per D-09: shows business name, invoice number, amount, due date, payment terms. Footer says "Sent by {business_name}" with no platform branding. Verified: `grep -i "voco" src/emails/InvoiceEmail.jsx` returns nothing.

`src/app/api/invoices/[id]/send/route.js` — POST endpoint that:
1. Validates customer_email exists (400 if missing)
2. Generates PDF buffer via `renderToBuffer(<InvoicePDF />)`
3. Sends email via Resend with PDF attachment (`from: "${business_name} <invoices@getvoco.ai>"`)
4. Conditionally sends SMS via Twilio from tenant's `retell_phone_number` (if `send_sms=true` and `customer_phone` present)
5. SMS failure caught and logged — does NOT block email delivery
6. Updates invoice to `status='sent'`, `sent_at=now()`

`src/lib/notifications.js` — Exported `getResendClient` and `getTwilioClient` as named exports (previously unexported local functions) so the invoice send route can import them.

### Task 2: Bidirectional sync

`src/lib/invoice-sync.js` — Two pure guard functions:
- `shouldSyncToLead(invoiceStatus, leadId, syncSource)` — returns true only when invoice becomes 'paid', has a linked lead, and was not triggered by the lead route
- `shouldSyncToInvoice(leadStatus, syncSource)` — returns true only when lead becomes 'paid' and was not triggered by the invoice route

`tests/unit/invoice-sync.test.js` — 13 unit tests covering all sync cases including circular-update prevention. All pass.

**Invoice route wiring** (`src/app/api/invoices/[id]/route.js`): After PATCH updates invoice to 'paid', calls `fetch()` to `/api/leads/${lead_id}` with `sync_source='invoice_paid'` and `revenue_amount=invoice.total`. Wrapped in try/catch.

**Lead route wiring** (`src/app/api/leads/[id]/route.js`): After PATCH updates lead to 'paid', queries for a linked `sent` or `overdue` invoice and marks it paid via direct Supabase update. Wrapped in try/catch.

### Task 3: LeadFlyout invoice integration

`src/components/dashboard/LeadFlyout.jsx`:
- Added `useRouter` (next/navigation) and `FileText` (lucide-react) imports
- Added `linkedInvoice` state (null on open until fetched, reset on close)
- `fetchLead` now also calls `GET /api/invoices?lead_id=${leadId}` to populate `linkedInvoice`
- "Create Invoice" button: renders when lead status is 'completed' or 'paid' AND `linkedInvoice` is null. Navigates to `/dashboard/invoices/new?lead_id=${lead.id}`. Style: `text-[#C2410C] border-[#C2410C]` brandOrange outline.
- "View Invoice" button: renders when `linkedInvoice` exists. Shows invoice number. Navigates to `/dashboard/invoices/${linkedInvoice.id}`. Style: `text-stone-600 border-stone-300`.

`src/app/api/invoices/route.js` — Added `lead_id` query parameter support: reads `searchParams.get('lead_id')` and applies `.eq('lead_id', leadId)` filter when present.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Export getResendClient and getTwilioClient from notifications.js**
- **Found during:** Task 1 implementation
- **Issue:** Plan specified importing `getResendClient` and `getTwilioClient` from `@/lib/notifications`, but both functions were unexported local functions in that file
- **Fix:** Added `export` keyword to both function declarations in `src/lib/notifications.js`
- **Files modified:** `src/lib/notifications.js`
- **Commit:** d97ec69

## Known Stubs

None — all functionality is fully wired.

## Self-Check: PASSED

- src/emails/InvoiceEmail.jsx: FOUND
- src/app/api/invoices/[id]/send/route.js: FOUND
- src/lib/invoice-sync.js: FOUND
- tests/unit/invoice-sync.test.js: FOUND
- Commits d97ec69, fc774a6, 983ec4e: all present in git log
- 13/13 invoice-sync tests passing
- D-09 compliance: grep -i "voco" src/emails/InvoiceEmail.jsx returns nothing

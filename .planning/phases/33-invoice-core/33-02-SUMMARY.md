---
phase: 33-invoice-core
plan: 02
subsystem: invoicing
tags: [invoice-settings, api, supabase-storage, more-menu]
dependency_graph:
  requires: []
  provides: [invoice_settings_api, invoice_settings_page]
  affects: [more_menu, invoices, invoice_pdf]
tech_stack:
  added: []
  patterns: [createSupabaseServer, getTenantId, supabase-storage-upload, design-tokens]
key_files:
  created:
    - src/app/api/invoice-settings/route.js
    - src/app/dashboard/more/invoice-settings/page.js
  modified:
    - src/app/dashboard/more/page.js
decisions:
  - "Tax rate stored as decimal (0–1) in DB, converted to percentage for display; input field shows 8.25, stores 0.0825"
  - "Logo upload uses supabase-browser client-side (not server route) per plan spec for direct Storage access"
  - "GET auto-creates row from tenants.business_name and tenants.owner_email on first fetch (no explicit setup step)"
metrics:
  duration: "5m"
  completed: "2026-03-31"
  tasks_completed: 2
  files_created: 2
  files_modified: 1
---

# Phase 33 Plan 02: Invoice Settings Summary

**One-liner:** Invoice Settings API with auto-create from tenant data and GET/PATCH validation, plus full settings page (business identity, logo upload to Supabase Storage, tax rate, payment terms, numbering) accessible from More menu.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create invoice-settings API route (GET auto-creates, PATCH updates) | b4bf3eb | src/app/api/invoice-settings/route.js |
| 2 | Create Invoice Settings page and add to More menu | 0dfc93b | src/app/dashboard/more/invoice-settings/page.js, src/app/dashboard/more/page.js |

## What Was Built

### Task 1 — Invoice Settings API Route

`src/app/api/invoice-settings/route.js` with two handlers:

**GET:** Authenticates via `createSupabaseServer` + `getTenantId`. On first call (no row exists), auto-creates a row in `invoice_settings` seeded from `tenants.business_name` and `tenants.owner_email` with defaults: `tax_rate=0`, `payment_terms='Net 30'`, `invoice_prefix='INV'`. Returns the settings row.

**PATCH:** Validates `tax_rate` (number 0–1), `payment_terms` (one of Net 15/30/45/60), and `invoice_prefix` (1–10 alphanumeric chars). Only allows writes to the 10 declared allowed fields. Updates the row and returns the updated settings.

### Task 2 — Invoice Settings Page + More Menu

`src/app/dashboard/more/invoice-settings/page.js` is a `'use client'` page with 4 card sections:

- **Business Identity**: business_name, address, phone, email, license_number, and a 96x96px logo upload area. Logo upload validates PNG/JPG and <2MB, uploads to Supabase Storage bucket `invoice-logos` at `{tenantId}/logo.{ext}` with upsert, gets public URL, and updates `settings.logo_url`.
- **Tax Configuration**: Input displaying tax rate as % (stored decimal × 100), converts back on change.
- **Invoice Defaults**: Payment terms Select (Net 15/30/45/60) and default notes textarea.
- **Numbering**: Invoice prefix input (max 10 chars) with a read-only preview showing `{prefix}-{year}-0001`.

Loading state uses Skeleton placeholders. Save button uses `btn.primary` design token with `Loader2` spinner during save. Toast messages match UI-SPEC: "Invoice settings saved", "Logo uploaded", "Logo upload failed. File must be PNG or JPG under 2MB."

`src/app/dashboard/more/page.js` updated:
- Added `BarChart3` and `FileText` lucide icon imports.
- Added Analytics entry `{ href: '/dashboard/analytics', ... icon: BarChart3 }` after Billing (per D-01 relocation).
- Added Invoice Settings entry `{ href: '/dashboard/more/invoice-settings', ... icon: FileText }` after Analytics.

## Decisions Made

1. **Tax rate decimal/percent conversion**: Stored as decimal (0–1) to match DB schema `numeric(5,4)`. UI input shows percentage (multiply by 100 for display, divide by 100 on change). This prevents floating-point issues at the PATCH boundary — the API validates 0–1.

2. **Logo upload client-side**: Used `supabase-browser` directly in the page component for Storage upload, consistent with the billing page pattern and plan specification. No server route required since public URL is sufficient.

3. **Auto-create on GET**: First GET to the API bootstraps the settings row from tenant data, so the settings page always has something to display without requiring an explicit "setup" action.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all fields are wired to the API. The logo upload requires the `invoice-logos` Supabase Storage bucket to exist (created in plan 33-01 migration). If the bucket does not exist, upload will fail gracefully with a toast error.

## Self-Check: PASSED

Files created:
- src/app/api/invoice-settings/route.js — FOUND
- src/app/dashboard/more/invoice-settings/page.js — FOUND

Files modified:
- src/app/dashboard/more/page.js — FOUND

Commits:
- b4bf3eb — feat(33-02): create invoice-settings API route
- 0dfc93b — feat(33-02): create Invoice Settings page and add to More menu

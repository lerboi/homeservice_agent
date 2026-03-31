---
phase: 33-invoice-core
plan: "04"
subsystem: dashboard/invoices
tags: [invoices, ui, dashboard, status-badge, summary-cards, table]
dependency_graph:
  requires: [33-01, 33-03]
  provides: [invoice-list-ui, invoice-status-badge, invoice-summary-cards]
  affects: [dashboard-invoices-tab]
tech_stack:
  added: []
  patterns: [fetch-on-mount, status-tabs-filter, responsive-table-card-fallback, skeleton-loading]
key_files:
  created:
    - src/components/dashboard/InvoiceStatusBadge.jsx
    - src/components/dashboard/InvoiceSummaryCards.jsx
  modified:
    - src/app/dashboard/invoices/page.js
decisions:
  - "Summary metrics fetched once on mount only — filter changes do not re-fetch summary, only the invoice list"
  - "STATUS_CONFIG exported as named export from InvoiceStatusBadge for reuse by other components"
  - "Mobile FAB at fixed bottom-right (z-50, 56px) hidden on sm+ breakpoint; desktop button in header hidden on mobile"
metrics:
  duration_seconds: 188
  completed_date: "2026-03-31T18:33:03Z"
  tasks_completed: 2
  files_changed: 3
---

# Phase 33 Plan 04: Invoice List UI Summary

**One-liner:** Responsive Invoices tab with three metric summary cards, five status filter tabs with counts, sortable table (desktop) / card list (mobile), skeleton loading states, and copywriting-exact empty states.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Create InvoiceStatusBadge and InvoiceSummaryCards components | cfcfb52 | src/components/dashboard/InvoiceStatusBadge.jsx, src/components/dashboard/InvoiceSummaryCards.jsx |
| 2 | Build full Invoices tab page with filter tabs, table, and empty states | 3d6f6a0 | src/app/dashboard/invoices/page.js |

## What Was Built

### InvoiceStatusBadge (`src/components/dashboard/InvoiceStatusBadge.jsx`)
Reusable `'use client'` component rendering a shadcn Badge with status-specific Tailwind classes. Exports both a default component and `STATUS_CONFIG` named export for consumption by other components (e.g., detail page). All five statuses covered: draft (stone), sent (blue), paid (emerald), overdue (red), void (stone-muted).

### InvoiceSummaryCards (`src/components/dashboard/InvoiceSummaryCards.jsx`)
Three-card responsive grid (1-col mobile / 2-col sm / 3-col lg) showing Total Outstanding, Overdue Amount, Paid This Month. Each card has: lucide icon + label on top row, 28px semibold amount below. Accent colors: brandOrange `#C2410C` / red-600 / emerald-600 per UI-SPEC. `loading` prop renders 3 Skeleton placeholders (h-20).

### Invoices Page (`src/app/dashboard/invoices/page.js`)
Full replacement of the placeholder stub. Key behaviors:
- Fetches `/api/invoices` on mount and on status tab change
- Summary metrics (total_outstanding, overdue_amount, paid_this_month) loaded once and pinned — not re-fetched on filter change
- Five status tabs (All / Draft / Sent / Overdue / Paid) with live counts; active tab highlighted with `border-b-2 border-[#C2410C] text-[#C2410C]`
- Desktop: shadcn Table with 7 columns (Invoice #, Customer, Job Type, Amount, Issued, Due, Status); rows are clickable with `cursor-pointer hover:bg-stone-50`; `router.push('/dashboard/invoices/${id}')` on click
- Mobile: `sm:hidden` card list with invoice number, customer name, amount, status badge, due date
- Empty state (no invoices): FileText icon, "No invoices yet" heading, body copy per UI-SPEC, "Create Your First Invoice" CTA
- Filtered empty state: "No {status} invoices" heading, descriptive body
- Error state: message + inline "Try again" link
- Loading state: 5 skeleton rows
- Create Invoice button (desktop header) + mobile FAB (fixed bottom-right, 56px rounded-full, z-50)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all data is wired to live API calls (`/api/invoices`). Summary cards and table both receive real data from the API response.

## Self-Check: PASSED

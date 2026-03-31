---
phase: 33-invoice-core
plan: 01
subsystem: invoicing
tags: [database, migration, calculations, tdd, pdf, rls]
dependency_graph:
  requires: []
  provides:
    - Invoice DB schema (invoices, invoice_line_items, invoice_settings, invoice_sequences)
    - get_next_invoice_number atomic Postgres function
    - invoice-logos storage bucket with RLS
    - calculateLineTotal pure function (5 item types)
    - calculateInvoiceTotals pure function (subtotal/tax/total)
    - formatInvoiceNumber pure function (PREFIX-YEAR-NNNN)
  affects:
    - Plans 33-02 through 33-07 (all depend on DB schema and calculation functions)
tech_stack:
  added:
    - "@react-pdf/renderer ^4.3.2"
  patterns:
    - TDD red-green cycle for pure business logic
    - Atomic Postgres function with INSERT ... ON CONFLICT for race-safe sequence generation
    - RLS tenant isolation pattern (tenant_own + service_role policies)
key_files:
  created:
    - supabase/migrations/029_invoice_schema.sql
    - src/lib/invoice-calculations.js
    - src/lib/invoice-number.js
    - tests/unit/invoice-calculations.test.js
    - tests/unit/invoice-number.test.js
  modified:
    - next.config.js
    - package.json
    - package-lock.json
decisions:
  - "@react-pdf/renderer added to serverExternalPackages to prevent Next.js bundler from breaking its custom reconciler"
  - "get_next_invoice_number uses INSERT ... ON CONFLICT DO UPDATE with composite PK (tenant_id, year) for atomic race-safe numbering; year rollover is automatic (new year = new row)"
  - "discount item type always returns negative value via -Math.abs(unit_price) to prevent sign errors in caller code"
  - "calculateInvoiceTotals computes line totals internally from item fields (not pre-computed line_total) to ensure consistency"
metrics:
  duration_seconds: 1046
  completed_date: "2026-03-31"
  tasks_completed: 2
  tasks_total: 2
  files_created: 5
  files_modified: 3
---

# Phase 33 Plan 01: Invoice Foundation — Schema, PDF Config, and Calculation Functions

Invoice schema migration with 4 tables, atomic Postgres numbering function, @react-pdf/renderer installed and configured in Next.js, pure calculation JS functions with 18 passing TDD tests covering all 5 line item types and tax-on-taxable-only logic.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install @react-pdf/renderer, configure next.config.js, create DB migration | 1dedd5c | next.config.js, package.json, package-lock.json, supabase/migrations/029_invoice_schema.sql |
| 2 | Pure calculation functions and invoice number formatter with TDD tests | 5ce5707 | src/lib/invoice-calculations.js, src/lib/invoice-number.js, tests/unit/invoice-calculations.test.js, tests/unit/invoice-number.test.js |

## What Was Built

### Database Schema (029_invoice_schema.sql)

Four tables created with full RLS:

- **invoice_settings** — per-tenant invoice configuration (prefix, tax_rate, payment_terms, logo_url, etc.)
- **invoice_sequences** — atomic counter keyed on (tenant_id, year) for year-rollover-safe numbering
- **invoices** — the core invoice record with status CHECK constraint (draft/sent/paid/overdue/void), customer details, financial totals, and timestamps
- **invoice_line_items** — 5 item types (labor/materials/travel/flat_rate/discount) with quantity, unit_price, markup_pct, taxable flag, and computed line_total

All 4 tables have tenant_own + service_role RLS policies. Three indexes on invoices for common query patterns.

**get_next_invoice_number** function uses INSERT ON CONFLICT DO UPDATE to atomically increment a counter and return the allocated number. This guarantees no two concurrent calls can get the same number.

**invoice-logos** storage bucket created as public with tenant-scoped RLS for logo uploads.

### Next.js Configuration

`serverExternalPackages: ['@react-pdf/renderer']` added so Next.js does not attempt to bundle `@react-pdf/renderer`'s custom React reconciler (which breaks when bundled).

### Pure Calculation Functions

**src/lib/invoice-calculations.js**:
- `calculateLineTotal(type, { quantity, unit_price, markup_pct })` — 5 type dispatch
- `calculateInvoiceTotals(lineItems, taxRate)` — returns `{ subtotal, tax_amount, total }` with tax applied only to taxable items, all values rounded to 2dp

**src/lib/invoice-number.js**:
- `formatInvoiceNumber(prefix, year, sequenceNumber)` — returns `{PREFIX}-{YEAR}-{NNNN}` with padStart(4) and no truncation beyond 4 digits

### Test Results

18 tests across 2 suites, all passing:
- `tests/unit/invoice-calculations.test.js` — 13 tests: all 5 item types, discount sign behavior, default quantity, tax-on-taxable-only logic, materials markup inclusion in tax base, empty line items
- `tests/unit/invoice-number.test.js` — 6 tests: formatting, zero-padding, 4-digit exact, 5-digit no-truncation

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan creates pure data and logic layers with no UI or stub data.

## Self-Check: PASSED

Files exist:
- FOUND: supabase/migrations/029_invoice_schema.sql
- FOUND: src/lib/invoice-calculations.js
- FOUND: src/lib/invoice-number.js
- FOUND: tests/unit/invoice-calculations.test.js
- FOUND: tests/unit/invoice-number.test.js

Commits exist:
- FOUND: 1dedd5c (Task 1)
- FOUND: 5ce5707 (Task 2)

Tests: 18 passed, 0 failed

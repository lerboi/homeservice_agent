---
phase: 59-customer-job-model-separation-split-leads-into-customers-ded
plan: "04"
subsystem: api
status: complete
tasks_complete: 2
tasks_total: 2
tags: [phase-59, wave-2, api-routes, customers, jobs, inquiries, merge, d-19]

dependency_graph:
  requires:
    - phase: 59-customer-job-model-separation-split-leads-into-customers-ded
      plan: "02"
      provides: "059_customers_jobs_inquiries.sql (tables these routes query)"
    - phase: 59-customer-job-model-separation-split-leads-into-customers-ded
      plan: "03"
      provides: "060_phase59_rpcs.sql (merge_customer, unmerge_customer RPCs)"
  provides:
    - "GET /api/customers — list with jobs_count + open_inquiries_count aggregates"
    - "GET /api/customers/[id] — detail with live-computed stats (lifetime_value, outstanding_balance, jobs_count, open_inquiries_count)"
    - "PATCH /api/customers/[id] — update name/email/notes/default_address/tags; 400 on phone_e164 (D-05)"
    - "POST /api/customers/[id]/merge — merge_customer RPC with p_merged_by from auth session; returns audit_id (D-19 expanded)"
    - "POST /api/customers/[id]/unmerge — unmerge_customer RPC; 410 on expired window; returns audit_id"
    - "GET /api/jobs — list with customer + appointment + calls joined"
    - "GET /api/jobs/[id] — detail"
    - "PATCH /api/jobs/[id] — status/urgency/revenue_amount/is_vip with enum guard"
    - "GET /api/inquiries — list with customer joined"
    - "GET /api/inquiries/[id] — detail"
    - "PATCH /api/inquiries/[id] — open ↔ lost only; 400 on 'converted' (D-10)"
    - "POST /api/inquiries/[id]/convert — appointment_id required; inserts job with originated_as_inquiry_id; updates inquiry status=converted (D-10 offline)"
    - "src/lib/customers.js, src/lib/jobs.js, src/lib/inquiries.js — business logic libs"
  affects:
    - "59-06 (UI/Realtime dashboard: Jobs + Inquiries tabs call these routes)"
    - "59-07 (Merge UI: calls /merge + /unmerge endpoints, reads audit_id)"

tech-stack:
  added: []
  patterns:
    - "getTenantId() + .eq('tenant_id', tenantId) double enforcement (T-59-04-01 RLS + app layer)"
    - "Forbidden field whitelist in updateCustomer (5 fields only) — mass-assignment guard (T-59-04-04)"
    - "p_merged_by sourced from auth.getUser() server-side, never request body (T-59-04-09)"
    - ".limit(200) on all list queries — bounded list DoS guard (T-59-04-07)"
    - "Live-computed stats via computeStatsInline() — no denormalized column (RESEARCH Pitfall 3)"
    - "convert route uses RLS-bound server client for both statements (T-59-04-08)"
    - "merge/unmerge use service-role client for SECURITY DEFINER RPCs"
    - "410 Gone for merge_window_expired — clear HTTP semantics for 7-day undo rule"

key-files:
  created:
    - "src/lib/customers.js"
    - "src/lib/jobs.js"
    - "src/lib/inquiries.js"
    - "src/app/api/customers/route.js"
    - "src/app/api/customers/[id]/route.js"
    - "src/app/api/customers/[id]/merge/route.js"
    - "src/app/api/customers/[id]/unmerge/route.js"
    - "src/app/api/jobs/route.js"
    - "src/app/api/jobs/[id]/route.js"
    - "src/app/api/inquiries/route.js"
    - "src/app/api/inquiries/[id]/route.js"
    - "src/app/api/inquiries/[id]/convert/route.js"
  modified:
    - "tests/api/customers.test.js — flipped from vitest scaffold to active Jest tests (16 tests)"
    - "tests/api/jobs-list.test.js — flipped from vitest scaffold to active Jest tests (11 tests)"
    - "tests/api/inquiries-list.test.js — flipped from vitest scaffold to active Jest tests (8 tests)"

key-decisions:
  - "Test framework: scaffold files used 'vitest' imports; project uses Jest — converted to @jest/globals"
  - "Test regex for p_merged_by audit: use body?.merged_by / body?.p_merged_by patterns (not broad comment-matching regex)"
  - "computeStatsInline: inline aggregate computation (no get_customer_stats RPC needed at this phase) per RESEARCH Pitfall 3"
  - "convert route: two separate DB statements (insert job + update inquiry) with RLS-bound client; Plan 08 can consolidate to RPC if atomicity required"

metrics:
  duration: "~8 min"
  completed: "2026-04-21"
  tasks_completed: 2
  files_created: 12
  files_modified: 3
---

# Phase 59 Plan 04: New /api/customers + /api/jobs + /api/inquiries REST Surface Summary

Three new business-logic libs (customers, jobs, inquiries) + 11 route files replacing /api/leads, with merge/unmerge/convert wired from HTTP to Postgres RPCs and audit trail surfaced via audit_id in responses.

## Performance

- **Duration:** ~8 min
- **Completed:** 2026-04-21
- **Tasks complete:** 2 of 2
- **Files created:** 12
- **Files modified:** 3

## What Was Built

### Business Logic Libs (3)

| File | Key exports | Notes |
|------|-------------|-------|
| `src/lib/customers.js` | `listCustomers`, `getCustomerWithStats`, `updateCustomer`, `mergeCustomer`, `unmergeCustomer` | `computeStatsInline` helper (no denormalized column per Pitfall 3); `mergedBy` from auth session (T-59-04-09) |
| `src/lib/jobs.js` | `listJobs`, `getJob`, `updateJob` | Status enum guard against 5-value CHECK constraint; `.limit(200)` |
| `src/lib/inquiries.js` | `listInquiries`, `getInquiry`, `updateInquiry` | `converted` rejected via PATCH — enforces D-10 (use /convert route) |

### Route Files (11)

| Route | Methods | Key behavior |
|-------|---------|--------------|
| `/api/customers` | GET | Search by name/phone; excludes merged rows |
| `/api/customers/[id]` | GET, PATCH | Stats live-computed; PATCH rejects phone_e164/tenant_id (D-05, T-59-04-02) |
| `/api/customers/[id]/merge` | POST | Verifies both in tenant; passes auth.uid() as p_merged_by; returns audit_id |
| `/api/customers/[id]/unmerge` | POST | 410 on expired window; returns audit_id |
| `/api/jobs` | GET | Filters: status/urgency/customer_id; joined customer+appointment+calls |
| `/api/jobs/[id]` | GET, PATCH | Status/urgency enum-guarded |
| `/api/inquiries` | GET | Filter by status; joined customer |
| `/api/inquiries/[id]` | GET, PATCH | Only open ↔ lost via PATCH |
| `/api/inquiries/[id]/convert` | POST | Requires appointment_id; inserts job with originated_as_inquiry_id FK |

### Tests (35 total, 0 skipped)

| File | Tests | Key assertions |
|------|-------|----------------|
| `tests/api/customers.test.js` | 16 | D-05 immutable, D-18 allowed fields, self-merge 400, cross-tenant 404, audit_id in response, auth session sourcing for p_merged_by, 410 on expired window |
| `tests/api/jobs-list.test.js` | 11 | 200 list, 401 auth, status/urgency/customer_id filters, invalid status 400, D-02a grep |
| `tests/api/inquiries-list.test.js` | 8 | 200 list, 401 auth, status filter, converted via PATCH → 400, appointment_required hint, D-02a grep |

## Task Commits

| Task | Commit | Files |
|------|--------|-------|
| Tasks 1 + 2: all libs + routes + tests | `4dcba14` | 12 new files, 3 modified test files |

## Deviations from Plan

### [Rule 3 - Blocking] Test framework mismatch: vitest vs Jest

- **Found during:** Task 1 (reading scaffold test files)
- **Issue:** Plan 01 scaffolds imported from `'vitest'` (`import { describe, it } from 'vitest'`), but the project's test runner is Jest (`package.json` scripts + `jest.config.js`). Vitest is not installed. Tests would fail to import.
- **Fix:** Rewrote all three test files using `@jest/globals` (`import { jest, describe, it, expect, beforeAll, beforeEach } from '@jest/globals'`). Test pattern follows existing `tests/api/appointments-complete.test.js` exactly (jest.unstable_mockModule pattern for ESM mocking).
- **Files modified:** `tests/api/customers.test.js`, `tests/api/jobs-list.test.js`, `tests/api/inquiries-list.test.js`
- **Commit:** `4dcba14`

### [Rule 2 - Missing] p_merged_by test regex too broad

- **Found during:** Task 2 (first test run)
- **Issue:** The initial test regex `/merged_by.*body/` matched comments in the route file (the comment says "never from request body"), causing a false negative assertion failure.
- **Fix:** Changed regex to specifically check `body?.merged_by` and `body?.p_merged_by` property accesses (what actual body-reading code would look like), plus positive assertion that `mergedBy: userId` is in the source.
- **Files modified:** `tests/api/customers.test.js`
- **Commit:** `4dcba14`

## Known Stubs

None. All routes read/write to real tables. Stats are live-computed. No hardcoded values or placeholder data flows to responses.

## Threat Surface Scan

New network endpoints introduced: 11 route files under `/api/customers/`, `/api/jobs/`, `/api/inquiries/`. All are authenticated (getTenantId() returns null → 401) and all have explicit `tenant_id` filter on every query (RLS + app-layer double enforcement per T-59-04-01). No new unauthenticated surface. No new file access patterns. No schema changes in this plan (schema is from Plan 02/03).

All plan `<threat_model>` mitigations applied:

| Threat ID | Mitigation Status |
|-----------|-------------------|
| T-59-04-01 | RLS-bound `createSupabaseServer()` + explicit `.eq('tenant_id', tenantId)` on every query |
| T-59-04-02 | `updateCustomer` whitelists 5 fields; HTTP layer also rejects forbidden fields first |
| T-59-04-03 | `mergeCustomer` does explicit SELECT both source + target by `(id, tenant_id)` before RPC call |
| T-59-04-04 | `updateCustomer` picks only 5 fields by name; extras silently ignored |
| T-59-04-05 | All errors return `{error: 'slug', field?}` — no PII echoed in responses |
| T-59-04-06 | Accepted: URL-param, Postgres-parameterized, XSS at React render layer |
| T-59-04-07 | `.limit(200)` on `listCustomers`, `listJobs`, `listInquiries` |
| T-59-04-08 | Accepted: convert route uses RLS-bound client; Plan 08 note added in code comment |
| T-59-04-09 | `p_merged_by` from `supabase.auth.getUser()` server-side; test asserts `body?.merged_by` never accessed |
| T-59-04-10 | D-02a grep-check: 0 `.from('leads')` / `.from('lead_calls')` in new files |

## Self-Check: PASSED

Files verified:
- FOUND: `src/lib/customers.js`
- FOUND: `src/lib/jobs.js`
- FOUND: `src/lib/inquiries.js`
- FOUND: `src/app/api/customers/route.js`
- FOUND: `src/app/api/customers/[id]/route.js`
- FOUND: `src/app/api/customers/[id]/merge/route.js`
- FOUND: `src/app/api/customers/[id]/unmerge/route.js`
- FOUND: `src/app/api/jobs/route.js`
- FOUND: `src/app/api/jobs/[id]/route.js`
- FOUND: `src/app/api/inquiries/route.js`
- FOUND: `src/app/api/inquiries/[id]/route.js`
- FOUND: `src/app/api/inquiries/[id]/convert/route.js`

Commit verified:
- FOUND: `4dcba14` in git log

Test counts verified:
- 35 tests, 0 skipped, 3 test files PASSED
- D-02a: ZERO legacy table references in new files

---
*Phase: 59-customer-job-model-separation-split-leads-into-customers-ded*
*Plan 04 status: complete*
*Last updated: 2026-04-21*

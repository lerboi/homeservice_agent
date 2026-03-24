---
phase: 12
plan: 01
subsystem: data-layer
tags: [database, api, escalation, services, migration]
dependency_graph:
  requires: []
  provides:
    - escalation_contacts table with full RLS
    - services.sort_order column with backfill
    - /api/escalation-contacts (GET/POST/PUT/DELETE/PATCH)
    - /api/services extended (sort_order, bulk PUT, PATCH reorder)
  affects:
    - src/app/api/services/route.js
    - supabase schema
tech_stack:
  added: []
  patterns:
    - Supabase upsert with tenant_id in every row for RLS WITH CHECK compliance
    - sort_order backfill via row_number() OVER (PARTITION BY tenant_id ORDER BY created_at)
    - Max-N active records enforcement via count query before INSERT
    - Bulk update via .in('id', ids) filter
key_files:
  created:
    - supabase/migrations/006_escalation_contacts.sql
    - src/app/api/escalation-contacts/route.js
    - tests/escalation/escalation-contacts.test.js
    - tests/services/services-api.test.js
  modified:
    - src/app/api/services/route.js
decisions:
  - "RLS policy uses tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()) to match existing services table pattern from 002_onboarding_triage.sql — not tenant_id = auth.uid()"
  - "PATCH reorder always includes tenant_id in every upsert row per RESEARCH.md Pitfall 3 — RLS WITH CHECK requires it"
  - "Max 5 active contacts enforced server-side via count query before insert — prevents silent bypass"
  - "services GET now orders by sort_order ASC then created_at ASC — dual-order prevents randomization when sort_order values are equal after migration"
metrics:
  duration: "3 minutes"
  completed: "2026-03-24"
  tasks_completed: 3
  files_created: 4
  files_modified: 1
---

# Phase 12 Plan 01: Database Foundation and API Layer Summary

**One-liner:** Supabase migration creating `escalation_contacts` table with RLS + `sort_order` on services, plus full CRUD/reorder API routes for both resources.

## What Was Built

### Task 1: Database Migration (006_escalation_contacts.sql)

- Created `escalation_contacts` table with all required columns: `notification_pref` (CHECK: sms/email/both), `timeout_seconds` (CHECK: 15/30/45/60), `sort_order`, `is_active`, `created_at`, `updated_at`
- RLS policies match existing `services` table pattern from migration 002: `tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid())` — NOT `tenant_id = auth.uid()`
- `idx_escalation_contacts_tenant` composite index on `(tenant_id, sort_order)` for ordered tenant queries
- Added `sort_order int NOT NULL DEFAULT 0` to `services` table via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
- Backfill: `UPDATE services SET sort_order = row_number() OVER (PARTITION BY tenant_id ORDER BY created_at)` — prevents all existing rows from colliding at 0
- `idx_services_sort_order` index on `(tenant_id, sort_order)`

### Task 2: Escalation Contacts API (src/app/api/escalation-contacts/route.js)

Five HTTP handlers following the exact `services/route.js` pattern (import supabase, import getTenantId, 401 guard):

- **GET**: Select all active contacts ordered by `sort_order ASC`
- **POST**: Validates name required + phone/email per notification_pref; enforces max 5 active contacts via count query; computes `sort_order = max + 1`
- **PUT**: Updates all contact fields + sets `updated_at`
- **DELETE**: Soft-delete via `is_active = false` + `updated_at`
- **PATCH**: Reorders contacts via upsert with `{ id, tenant_id, sort_order }` in each row

Test scaffold at `tests/escalation/escalation-contacts.test.js` — 19 test.todo blocks covering all endpoint behaviors.

### Task 3: Services API Extensions (src/app/api/services/route.js)

Three changes to the existing route:

- **GET**: Added `sort_order` to select columns; changed order to `sort_order ASC` then `created_at ASC`
- **PUT**: Added bulk update branch — detects `Array.isArray(ids)`, uses `.in('id', ids).eq('tenant_id', tenantId)` for multi-row updates; returns `{ updated: true, count: N }`; single update path unchanged
- **PATCH**: New handler — reorders services via upsert with `tenant_id` in every row

Test scaffold at `tests/services/services-api.test.js` — 12 test.todo blocks.

## Test Results

Both test scaffolds pass without import errors:
```
PASS tests/services/services-api.test.js
PASS tests/escalation/escalation-contacts.test.js
Test Suites: 2 passed, 2 total
Tests: 31 todo, 31 total
```

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 74cb84e | feat(12-01): database migration — escalation_contacts table + services sort_order |
| 2 | 2c0ae3b | feat(12-01): escalation contacts API — full CRUD + PATCH reorder |
| 3 | c70eb6d | feat(12-01): services API extensions — sort_order in GET, bulk PUT, PATCH reorder |

## Deviations from Plan

None — plan executed exactly as written. RLS policy pattern deviation was caught by reading migration 002 first as instructed (the plan's own note warned about this) and the correct pattern was applied.

## Known Stubs

None — all API routes are fully implemented with no placeholder logic. Test scaffolds use `test.todo()` by design per plan spec.

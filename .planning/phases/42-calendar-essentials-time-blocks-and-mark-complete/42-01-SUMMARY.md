---
phase: 42-calendar-essentials-time-blocks-and-mark-complete
plan: "01"
subsystem: scheduling-api
tags: [calendar-blocks, mark-complete, migration, api-routes, tdd]
dependency_graph:
  requires: []
  provides:
    - calendar_blocks table (DB + RLS)
    - completed_at column on appointments
    - GET/POST /api/calendar-blocks
    - PATCH/DELETE /api/calendar-blocks/[id]
    - completed + confirmed PATCH branches on /api/appointments/[id]
    - calendar_blocks fed into available-slots externalBlocks
  affects:
    - src/app/api/appointments/[id]/route.js
    - src/app/api/appointments/available-slots/route.js
tech_stack:
  added: []
  patterns:
    - Supabase RLS 4-policy pattern (select/insert/update/delete) for new table
    - 5-way parallel Promise.all for slot scheduling data fetch
    - Append-if-exists notes pattern with [Completed] prefix
key_files:
  created:
    - supabase/migrations/046_calendar_blocks_and_completed_at.sql
    - src/app/api/calendar-blocks/route.js
    - src/app/api/calendar-blocks/[id]/route.js
    - tests/api/calendar-blocks.test.js
    - tests/api/appointments-complete.test.js
  modified:
    - src/app/api/appointments/[id]/route.js
    - src/app/api/appointments/available-slots/route.js
decisions:
  - "Migration numbered 046 (not 044 as planned) — 044 and 045 already existed from Phase 44 and SMS schema additions"
  - "calendar_blocks excluded from slot calculator via externalBlocks merge — aligns with D-11 (Claude's discretion)"
  - "completed appointments excluded from available-slots query with .neq('status', 'completed') — prevents ghost slots"
metrics:
  duration_seconds: 275
  completed_date: "2026-04-11"
  tasks_completed: 2
  files_created: 5
  files_modified: 2
  tests_added: 21
---

# Phase 42 Plan 01: Migration + Calendar Blocks CRUD + Mark Complete Summary

**One-liner:** Supabase migration adding `calendar_blocks` table with 4 RLS policies + `completed_at` column, CRUD API routes with tenant isolation, mark-complete/undo PATCH branches with note appending, and calendar_blocks fed into slot calculator as external blocks.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Migration + Calendar Blocks CRUD API + Tests | `164183c` | migration, 2 API routes, 1 test file |
| 2 | Mark Complete + Undo PATCH + Available-Slots Integration + Tests | `5266e75` | 2 modified routes, 1 test file |

## Artifacts Created

### supabase/migrations/046_calendar_blocks_and_completed_at.sql
- `CREATE TABLE calendar_blocks` with `id`, `tenant_id`, `title`, `start_time`, `end_time`, `is_all_day`, `note`, `created_at`
- 4 RLS policies: `tenant_select`, `tenant_insert`, `tenant_update`, `tenant_delete`
- `CREATE INDEX idx_calendar_blocks_tenant_time` on `(tenant_id, start_time, end_time)`
- `ALTER TABLE appointments ADD COLUMN completed_at timestamptz`

### src/app/api/calendar-blocks/route.js
- `GET`: requires `start`/`end` query params, filters by range with `.lte('start_time', end).gte('end_time', start)`
- `POST`: validates `title`, `start_time`, `end_time`, inserts with tenant isolation, returns 201

### src/app/api/calendar-blocks/[id]/route.js
- `PATCH`: partial update — only updates fields present in body
- `DELETE`: deletes with `.eq('id', id).eq('tenant_id', tenantId)` guard

### src/app/api/appointments/[id]/route.js (modified)
- Added Branch 3: `status === 'completed'` — sets `completed_at: new Date().toISOString()`, optionally appends `[Completed] {notes}` to existing notes or sets notes fresh
- Added Branch 4: `status === 'confirmed'` — reverts `completed_at: null`, restores `status: 'confirmed'`

### src/app/api/appointments/available-slots/route.js (modified)
- Extended 4-way `Promise.all` to 5-way by adding `calendar_blocks` query
- Merged `blocksResult.data` into `externalBlocks` array fed to `calculateAvailableSlots`
- Added `.neq('status', 'completed')` to appointments query so completed jobs don't block slot availability

## Test Results

- `tests/api/calendar-blocks.test.js` — 12 tests, all passing
- `tests/api/appointments-complete.test.js` — 9 tests, all passing
- Total: **21 tests passing**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] Migration renumbered from 044 to 046**
- **Found during:** Task 1
- **Issue:** Migrations `044_ai_voice_column.sql` (Phase 44) and `045_sms_messages_and_call_sid.sql` already existed in the codebase — the plan specified `044_calendar_blocks_and_completed_at.sql` which would have conflicted
- **Fix:** Used next available number `046_calendar_blocks_and_completed_at.sql`
- **Files modified:** `supabase/migrations/046_calendar_blocks_and_completed_at.sql`
- **Commit:** `164183c`

## Known Stubs

None — all routes are fully implemented with real Supabase queries and proper tenant isolation.

## Self-Check: PASSED

Files verified:
- `supabase/migrations/046_calendar_blocks_and_completed_at.sql` — FOUND
- `src/app/api/calendar-blocks/route.js` — FOUND
- `src/app/api/calendar-blocks/[id]/route.js` — FOUND
- `tests/api/calendar-blocks.test.js` — FOUND
- `tests/api/appointments-complete.test.js` — FOUND
- Modified: `src/app/api/appointments/[id]/route.js` — FOUND
- Modified: `src/app/api/appointments/available-slots/route.js` — FOUND

Commits verified:
- `164183c` — FOUND
- `5266e75` — FOUND

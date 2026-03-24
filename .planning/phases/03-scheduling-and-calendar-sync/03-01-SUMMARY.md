---
phase: 03-scheduling-and-calendar-sync
plan: "01"
subsystem: scheduling-foundation
tags: [database, migration, slot-calculator, atomic-booking, rls, tdd]
dependency_graph:
  requires: [002_onboarding_triage.sql, src/lib/supabase.js]
  provides: [003_scheduling.sql, src/lib/scheduling/slot-calculator.js, src/lib/scheduling/booking.js]
  affects: [phase-03-all-plans]
tech_stack:
  added: [date-fns@4.1.0, date-fns-tz@3.2.0]
  patterns: [pg-try-advisory-xact-lock, tsrange-overlap, TDD-ESM-jest.unstable_mockModule]
key_files:
  created:
    - supabase/migrations/003_scheduling.sql
    - src/lib/scheduling/slot-calculator.js
    - src/lib/scheduling/booking.js
    - tests/scheduling/slot-calculator.test.js
    - tests/scheduling/booking.test.js
  modified:
    - package.json
    - package-lock.json
decisions:
  - "Used pg_try_advisory_xact_lock (non-blocking) over pg_advisory_xact_lock (blocking) — per RESEARCH.md Pitfall 1, prevents queue buildup under concurrent booking load"
  - "Test files placed in tests/scheduling/ (not src/lib/scheduling/__tests__/) — matches existing project test convention; jest.config.js matches **/tests/**/*.test.js"
  - "jest.unstable_mockModule used for Supabase mock in booking.test.js — required for ESM module system (project uses type:module)"
  - "candidateZoneId parameter added to calculateAvailableSlots — allows same-zone/cross-zone buffer resolution without modifying function signature later"
metrics:
  duration_mins: 8
  completed_date: "2026-03-20"
  tasks_completed: 2
  files_created: 7
requirements_satisfied: [SCHED-01, SCHED-04, SCHED-07, SCHED-08, SCHED-09, SCHED-03]
---

# Phase 3 Plan 01: Scheduling Foundation Summary

**One-liner:** Postgres scheduling schema (5 tables + atomic RPC with pg_try_advisory_xact_lock) and pure JS slot calculator with zone-aware travel buffer logic.

## Tasks Completed

| # | Name | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Database migration — scheduling tables and atomic booking RPC | 67bc3f5 | supabase/migrations/003_scheduling.sql |
| 2 | Slot calculator + atomic booking JS modules with tests (TDD RED) | 593ff88 | tests/scheduling/slot-calculator.test.js, tests/scheduling/booking.test.js |
| 2 | Slot calculator + atomic booking JS modules (TDD GREEN) | 1a59879 | src/lib/scheduling/slot-calculator.js, src/lib/scheduling/booking.js |

## What Was Built

### Database Migration (003_scheduling.sql)

Five new tables extend the scheduling domain:

- **appointments** — core booking record with `UNIQUE(tenant_id, start_time)` as the concurrency backstop. RLS restricts to owner; service_role bypass for webhook handlers.
- **service_zones** — owner-defined zones with `postal_codes text[]` groupings for geographic buffer logic.
- **zone_travel_buffers** — per-zone-pair custom buffer overrides; `UNIQUE(zone_a_id, zone_b_id)` prevents duplicates.
- **calendar_credentials** — OAuth tokens per provider with `CHECK provider IN ('google', 'outlook')` for future Outlook support. `UNIQUE(tenant_id, provider)` ensures one credential set per provider.
- **calendar_events** — local mirror of external calendar events with `UNIQUE(tenant_id, provider, external_id)` for idempotent sync.

**tenants** table extended with `tenant_timezone` (DEFAULT 'America/Chicago') and `slot_duration_mins` (DEFAULT 60).

**book_appointment_atomic** PL/pgSQL function:
- Acquires `pg_try_advisory_xact_lock` keyed on `abs(hashtext(tenant_id || epoch))` — non-blocking, returns `slot_taken` immediately if lock held
- Checks `tsrange(start_time, end_time, '[)') && tsrange(p_start_time, p_end_time, '[)')` for overlap, excluding cancelled appointments
- Inserts and returns `{ success: true, appointment_id }` or `{ success: false, reason: 'slot_taken' }`

### Slot Calculator (src/lib/scheduling/slot-calculator.js)

Pure function `calculateAvailableSlots(config)` with no database calls:
- Converts working hours local time strings to UTC via `date-fns-tz` `fromZonedTime`
- Generates candidate slots in `slotDurationMins` increments within the working window
- Excludes slots overlapping `existingBookings`, `externalBlocks`, or lunch break
- Travel buffer logic: same-zone = 0min, cross-zone = 30min default (or `zonePairBuffers` lookup), no zones = flat 30min
- Returns first `maxSlots` available `{ start, end }` ISO string pairs

### Atomic Booking Wrapper (src/lib/scheduling/booking.js)

`atomicBookSlot(params)` maps camelCase JS params to `p_` prefixed RPC params and calls `supabase.rpc('book_appointment_atomic', ...)`. Throws on Supabase transport error; returns RPC data on success.

## Verification

```
Tests: 139 passed, 0 failed (--runInBand)
- tests/scheduling/slot-calculator.test.js: 9/9
- tests/scheduling/booking.test.js: 3/3
- All prior tests: 127/127 (no regressions)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test placement: tests/ directory instead of src/lib/scheduling/__tests__/**
- **Found during:** Task 2 (TDD RED)
- **Issue:** Plan specified test files at `src/lib/scheduling/__tests__/`, but jest.config.js `testMatch` is `**/tests/**/*.test.js` — files in `__tests__` subdirectory would not be discovered by the test runner
- **Fix:** Placed tests in `tests/scheduling/slot-calculator.test.js` and `tests/scheduling/booking.test.js` following existing project convention
- **Files modified:** tests/scheduling/ (created)
- **Commits:** 593ff88, 1a59879

**2. [Rule 3 - Blocking] ESM mock: jest.mock → jest.unstable_mockModule**
- **Found during:** Task 2 (TDD GREEN), booking.test.js run
- **Issue:** `jest.mock()` uses CommonJS `require` internally and throws `ReferenceError: require is not defined` in the project's ESM module system (`"type": "module"`)
- **Fix:** Changed to `jest.unstable_mockModule('@/lib/supabase.js', ...)` with dynamic `await import()` after the mock — consistent with the pattern in `tests/triage/classifier.test.js`
- **Files modified:** tests/scheduling/booking.test.js
- **Commit:** 1a59879

## Self-Check: PASSED

- [x] supabase/migrations/003_scheduling.sql exists
- [x] src/lib/scheduling/slot-calculator.js exists
- [x] src/lib/scheduling/booking.js exists
- [x] tests/scheduling/slot-calculator.test.js exists
- [x] tests/scheduling/booking.test.js exists
- [x] Commits 67bc3f5, 593ff88, 1a59879 exist
- [x] 139 tests pass with --runInBand

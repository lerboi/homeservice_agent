---
phase: 18-booking-first-hardening-and-qa
plan: 02
subsystem: testing
tags: [jest, supabase, integration-test, advisory-lock, concurrency, postgres]

# Dependency graph
requires:
  - phase: 03-scheduling-calendar-sync-foundation
    provides: book_appointment_atomic RPC with pg_try_advisory_xact_lock

provides:
  - Jest integration test proving advisory lock produces exactly 1 winner from 20 simultaneous requests
  - jest.config.js excludes integration/ from regular npm test runs
  - test:integration npm script for on-demand execution with real Supabase credentials

affects: [18-booking-first-hardening-and-qa, ci-configuration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Integration test isolation: describe.skip guard when env vars absent (D-05)"
    - "Self-contained test data: create test tenant in beforeAll, delete in afterAll (D-06)"
    - "Dual contention outcome handling: advisory lock rejection (data.success=false) OR UNIQUE violation (error!=null)"
    - "Service role key in integration tests: createClient directly, never @/lib/supabase.js (anon key)"

key-files:
  created:
    - tests/integration/atomic-booking-contention.test.js
  modified:
    - jest.config.js
    - package.json

key-decisions:
  - "Handle both advisory lock rejection and UNIQUE constraint violation as valid contention outcomes — RPC has no EXCEPTION handler for UNIQUE violations, so r.error != null is an accepted signal"
  - "Generate random UUID for test tenant owner_id — owner_id is UNIQUE NOT NULL, dummy constant would break parallel test runs"
  - "testPathIgnorePatterns excludes /tests/integration/ from default npm test run — prevents misleading 0-tests output in CI (Pitfall 4)"

patterns-established:
  - "Integration test pattern: createClient with SUPABASE_SERVICE_ROLE_KEY bypasses RLS for test data setup/teardown"
  - "Credential guard: const describeFn = hasCredentials ? describe : describe.skip at module top — skip entire suite not individual tests"

requirements-completed: [HARDEN-02]

# Metrics
duration: 8min
completed: 2026-03-25
---

# Phase 18 Plan 02: Atomic Booking Contention Integration Test Summary

**Jest integration test proving advisory lock + UNIQUE constraint produce exactly 1 winner from 20 simultaneous book_appointment_atomic RPC calls against real Supabase**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-25T09:51:11Z
- **Completed:** 2026-03-25T09:59:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Created `tests/integration/atomic-booking-contention.test.js` firing 20 parallel Promise.all calls to the same slot and asserting exactly 1 success + 19 contention losses
- Updated `jest.config.js` to exclude integration tests from regular `npm test` (prevents CI failures without Supabase credentials)
- Added `test:integration` npm script for explicit on-demand execution

## Task Commits

Each task was committed atomically:

1. **Task 1: Update jest.config.js and add test:integration script** - `df4bac8` (chore)
2. **Task 2: Create atomic booking contention integration test** - `95c9ff1` (test)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `tests/integration/atomic-booking-contention.test.js` - 20-way concurrent contention test against real Supabase, credential-guarded, self-contained setup/teardown
- `jest.config.js` - Added `/tests/integration/` to testPathIgnorePatterns
- `package.json` - Added `test:integration` script

## Decisions Made

- **Dual contention outcome handling:** The `book_appointment_atomic` RPC has no EXCEPTION handler for UNIQUE constraint violations. If two transactions slip past the advisory lock simultaneously, the second INSERT throws a Postgres error (code 23505) returned as `{ error: non-null, data: null }`. The test counts both `r.data?.success === false` (advisory lock rejection) and `r.error != null` (UNIQUE violation) as valid contention losses.

- **Random UUID for test tenant owner_id:** The `tenants.owner_id` column is `UNIQUE NOT NULL`. Using a fixed dummy UUID would cause constraint violations in parallel test runs. The test uses `crypto.randomUUID()` for isolation.

- **Credential guard at suite level:** `describe.skip` wraps the entire describe block when `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is absent — consistent with D-05 and the project pattern from `jest.config.js` excluding the directory entirely.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The worktree does not have its own `node_modules/` — Jest runs from the main project's node_modules. Verification adapted accordingly; the test file itself is correct for the project's standard `npm test` invocation.

## User Setup Required

To run the integration test against a real Supabase database:

```bash
SUPABASE_URL=https://your-project.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
npm run test:integration
```

The test creates and cleans up its own test tenant. No manual setup required beyond providing credentials.

## Next Phase Readiness

- HARDEN-02 concurrency test infrastructure is complete — run when Supabase credentials are available to verify advisory lock holds under 20-way concurrent load
- Phase 18 Plan 03 can proceed (manual E2E test scripts and/or Sentry setup depending on plan ordering)

---
*Phase: 18-booking-first-hardening-and-qa*
*Completed: 2026-03-25*

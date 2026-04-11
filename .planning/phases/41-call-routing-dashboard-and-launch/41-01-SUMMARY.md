---
phase: 41-call-routing-dashboard-and-launch
plan: 01
subsystem: api
tags: [next.js, supabase, validation, e164, call-routing, api-routes]

# Dependency graph
requires:
  - phase: 39-call-routing-webhook-foundation
    provides: "DB schema (migration 042) with call_forwarding_schedule, pickup_numbers, dial_timeout_seconds on tenants and routing_mode, outbound_dial_duration_sec on calls"
provides:
  - "GET /api/call-routing — returns schedule, pickup_numbers, dial_timeout, usage meter, working_hours"
  - "PUT /api/call-routing — validates and persists schedule, pickup_numbers, dial_timeout with 7 validation rules"
  - "Calls API extended with routing_mode and outbound_dial_duration_sec columns"
  - "13 test cases covering all API validation and integration contracts"
affects: [41-02-PLAN, 41-03-PLAN, 41-04-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: ["E.164 phone validation regex", "cross-field validation (enabled schedule requires pickup numbers)", "monthly usage SUM aggregation from calls table"]

key-files:
  created:
    - src/app/api/call-routing/route.js
    - tests/api/call-routing.test.js
    - tests/api/calls-routing.test.js
  modified:
    - src/app/api/calls/route.js

key-decisions:
  - "ESM test pattern (jest.unstable_mockModule) used instead of CommonJS jest.mock to match existing project infrastructure"
  - "calls-routing test converted from CommonJS require to ESM import for consistency with --experimental-vm-modules runner"

patterns-established:
  - "Multi-from() mock pattern: mockSupabase.from.mockImplementation() with callCount to handle sequential tenant lookup + update calls"
  - "File-content assertion pattern for verifying select query columns without full mock setup"

requirements-completed: [ROUTE-14, ROUTE-15, ROUTE-17]

# Metrics
duration: 4min
completed: 2026-04-11
---

# Phase 41 Plan 01: Call Routing API Summary

**GET+PUT /api/call-routing with 7 validation rules (E.164, duplicates, self-ref, max 5, HH:MM, timeout 10-30, zero-numbers guard) plus calls API routing_mode extension**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-11T14:02:04Z
- **Completed:** 2026-04-11T14:06:15Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- GET /api/call-routing returns schedule, pickup_numbers, dial_timeout, monthly usage meter (SUM of outbound_dial_duration_sec), and working_hours for authenticated tenant
- PUT /api/call-routing enforces all 7 validation rules with specific 400 error messages: E.164 format, no duplicates, no self-reference to Twilio number, max 5 entries, valid HH:MM time format, dial_timeout 10-30s range, zero-numbers guard when schedule enabled
- Calls API extended with routing_mode and outbound_dial_duration_sec columns without filtering out owner-pickup calls
- 13 tests covering complete validation and integration contract (10 call-routing + 3 calls-routing)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create test stubs for call-routing API and calls-routing API (Wave 0)** - `7bdca17` (test)
2. **Task 2: Create GET and PUT /api/call-routing route** - `1c1a328` (feat)
3. **Task 3: Extend calls API select to include routing_mode** - `0a35d49` (feat)

## Files Created/Modified
- `src/app/api/call-routing/route.js` - GET + PUT handlers for call routing configuration with comprehensive validation
- `src/app/api/calls/route.js` - Extended select query with routing_mode and outbound_dial_duration_sec
- `tests/api/call-routing.test.js` - 10 test cases for PUT validation rules and GET usage null guard
- `tests/api/calls-routing.test.js` - 3 file-content tests verifying routing columns and owner-pickup non-filtering

## Decisions Made
- Used ESM test pattern (jest.unstable_mockModule) instead of CommonJS jest.mock to match the existing project test infrastructure which runs with --experimental-vm-modules
- Converted calls-routing test from plan-specified CommonJS (require) to ESM imports for consistency with project runner

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Converted test files from CommonJS to ESM module syntax**
- **Found during:** Task 1 and Task 3 (test execution)
- **Issue:** Plan specified CommonJS `jest.mock`/`require` pattern but project runs Jest with `--experimental-vm-modules` (ESM). Tests failed with "Cannot use import statement outside a module" and "require is not defined"
- **Fix:** Used `jest.unstable_mockModule` and ESM `import` syntax matching the existing `calendar-blocks.test.js` pattern
- **Files modified:** tests/api/call-routing.test.js, tests/api/calls-routing.test.js
- **Verification:** All 13 tests pass with `node --experimental-vm-modules`
- **Committed in:** 7bdca17 (Task 1), 0a35d49 (Task 3)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Module syntax change was necessary for tests to run. No scope creep.

## Issues Encountered
None beyond the module system deviation noted above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- API layer complete and tested, ready for Plan 02 (call-routing settings page UI)
- Plan 03 (calls page routing badges) can consume routing_mode and outbound_dial_duration_sec from the calls API
- All validation rules enforced server-side, UI can rely on 400 error messages for client-side display

## Self-Check: PASSED

All 4 files verified present. All 3 task commits verified in git log.

---
*Phase: 41-call-routing-dashboard-and-launch*
*Completed: 2026-04-11*

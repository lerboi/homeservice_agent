---
phase: 40-call-routing-provisioning-cutover
plan: 01
subsystem: api
tags: [twilio, fastapi, twiml, sip, routing, postgres, rls]

# Dependency graph
requires:
  - phase: 39-call-routing-webhook-foundation
    provides: "Twilio webhook scaffold, schedule evaluator, caps checker, security layer"
provides:
  - "Live incoming-call routing handler (tenant lookup -> sub check -> schedule -> cap -> TwiML)"
  - "Migration 045: sms_messages table and call_sid column on calls"
  - "_owner_pickup_twiml parallel-ring Dial builder"
  - "_insert_owner_pickup_call pre-TwiML calls row insertion"
affects: [40-02, 40-03, 41-call-routing-dashboard-and-launch]

# Tech tracking
tech-stack:
  added: []
  patterns: ["fail-open routing: every stage falls through to AI TwiML on error", "pre-TwiML DB insert: calls row written before Twilio response"]

key-files:
  created:
    - "supabase/migrations/045_sms_messages_and_call_sid.sql"
  modified:
    - "C:/Users/leheh/.Projects/livekit-agent/src/webhook/twilio_routes.py"
    - "C:/Users/leheh/.Projects/livekit-agent/tests/webhook/test_routes.py"

key-decisions:
  - "BLOCKED_STATUSES duplicated from agent.py into twilio_routes.py (avoid cross-module import coupling)"
  - "Fail-open at every routing stage: DB down, sub check fail, cap check fail all fall through to AI TwiML"
  - "calls row inserted BEFORE TwiML response to ensure dial-status callback can link back"

patterns-established:
  - "Fail-open routing: all routing failures default to AI TwiML so no call is ever dropped"
  - "Pre-TwiML insert: owner-pickup calls insert a calls row before returning Dial TwiML"

requirements-completed: [ROUTE-07, ROUTE-08]

# Metrics
duration: 3min
completed: 2026-04-11
---

# Phase 40 Plan 01: Incoming-Call Routing Handler Summary

**Live incoming-call routing with tenant lookup, subscription gate, schedule evaluation, outbound cap check, and parallel-ring owner-pickup TwiML**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-10T19:41:12Z
- **Completed:** 2026-04-10T19:44:36Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Migration 045 creates sms_messages table (RLS, indexes) and adds call_sid column to calls
- Incoming-call handler implements full D-02 composition: tenant lookup -> subscription check -> evaluate_schedule -> check_outbound_cap -> AI or owner-pickup TwiML
- 8 new tests covering all routing scenarios (AI mode, owner pickup, unknown tenant, blocked sub, cap breach, no pickup numbers, TwiML structure, calls row insert)
- All 43 webhook tests pass (8 new + 35 existing)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create migration 045** - `f149f15` (feat)
2. **Task 2: RED — failing tests** - `d489be8` (test)
3. **Task 2: GREEN — implement routing handler** - `0ffabff` (feat)

## Files Created/Modified
- `supabase/migrations/045_sms_messages_and_call_sid.sql` - sms_messages table, call_sid column, RLS policy, indexes
- `livekit-agent/src/webhook/twilio_routes.py` - Live routing composition replacing hardcoded AI branch
- `livekit-agent/tests/webhook/test_routes.py` - 8 new tests for routing scenarios

## Decisions Made
- BLOCKED_STATUSES duplicated from agent.py into twilio_routes.py to avoid cross-module import coupling
- Fail-open at every routing stage so no call is ever dropped regardless of failures
- calls row inserted BEFORE TwiML response to ensure dial-status callback can link

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Migration 045 ready for `supabase db push`
- Handler wired and tested; Plans 40-02 and 40-03 can build on dial-status and SMS forwarding
- Dashboard UI for pickup_numbers and schedule configuration is Phase 41

## Self-Check: PASSED

- FOUND: supabase/migrations/045_sms_messages_and_call_sid.sql
- FOUND: .planning/phases/40-call-routing-provisioning-cutover/40-01-SUMMARY.md
- FOUND: f149f15 (Task 1 commit)
- FOUND: d489be8 (Task 2 RED commit)
- FOUND: 0ffabff (Task 2 GREEN commit)

---
*Phase: 40-call-routing-provisioning-cutover*
*Completed: 2026-04-11*

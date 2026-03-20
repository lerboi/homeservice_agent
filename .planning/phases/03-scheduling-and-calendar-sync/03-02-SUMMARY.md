---
phase: 03-scheduling-and-calendar-sync
plan: 02
subsystem: api
tags: [retell, ai-agent, prompt-engineering, booking, voice]

# Dependency graph
requires:
  - phase: 02-onboarding-and-triage
    provides: onboarding_complete flag, triage classification, TRIAGE-AWARE BEHAVIOR prompt pattern
  - phase: 03-scheduling-and-calendar-sync
    plan: 01
    provides: database schema for slots and bookings
provides:
  - book_appointment custom function registered in Retell agent config with 5 required parameters
  - BOOKING FLOW prompt section with mandatory address read-back and slot offering flow
  - Conditional injection pattern: book_appointment and BOOKING FLOW only active when onboarding_complete=true
affects: [webhook-handler, retell-function-call-processing, booking-api-endpoint]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Retell functions array conditionally extended when onboarding_complete=true — same gate as TRIAGE-AWARE BEHAVIOR
    - Agent prompt section injection pattern: build section string as empty string or full content based on onboarding flag
    - TDD RED→GREEN for each task: write failing tests, commit, implement, verify

key-files:
  created:
    - tests/scheduling/book-appointment-handler.test.js
  modified:
    - src/lib/retell-agent-config.js
    - src/lib/agent-prompt.js
    - tests/agent/prompt.test.js

key-decisions:
  - "book_appointment only injected when onboarding_complete=true — consistent with TRIAGE-AWARE BEHAVIOR gate established in Phase 02"
  - "BOOKING FLOW prompt section replaces 'cannot book appointments yet' placeholder when onboarding complete"
  - "Address read-back is a mandatory blocking step in the booking conversation — AI must not invoke book_appointment until caller verbally confirms"
  - "available_slots dynamic variable referenced in prompt for runtime slot injection from availability DB"

patterns-established:
  - "Retell functions array: build list, conditionally push feature functions based on onboarding state"
  - "Agent prompt: empty string or full section content — concat to base prompt at end"

requirements-completed: [VOICE-03, VOICE-04, SCHED-05]

# Metrics
duration: 3min
completed: 2026-03-20
---

# Phase 3 Plan 02: Retell Config and Agent Prompt for Booking

**book_appointment Retell function with 5 typed parameters and BOOKING FLOW prompt section with mandatory address read-back, both gated on onboarding_complete**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-20T13:08:00Z
- **Completed:** 2026-03-20T13:11:13Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Registered `book_appointment` custom function in Retell agent config alongside `transfer_call`, injected only when `onboarding_complete=true`
- Implemented BOOKING FLOW prompt section with 8-step conversation flow: slot offering, address collection, mandatory read-back, booking invocation, slot-taken fallback, routine-decline lead capture
- Removed "cannot book appointments yet" placeholder from prompt when onboarding complete
- 9 new tests for retell-config, 8 new tests for agent-prompt — all 127 tests passing

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: book_appointment handler tests** - `16b37f2` (test)
2. **Task 1 GREEN: book_appointment function in retell config** - `40c62fc` (feat)
3. **Task 2 RED: BOOKING FLOW prompt tests** - `ec0fa12` (test)
4. **Task 2 GREEN: BOOKING FLOW section in agent-prompt** - `c4abe53` (feat)

_Note: TDD tasks have multiple commits (test RED → feat GREEN)_

## Files Created/Modified
- `src/lib/retell-agent-config.js` - Added book_appointment function definition with 5 typed parameters, conditional on onboarding_complete
- `src/lib/agent-prompt.js` - Added BOOKING FLOW section (8 steps), updated capabilities section to reflect booking availability
- `tests/scheduling/book-appointment-handler.test.js` - New: 9 tests verifying book_appointment function shape and gating
- `tests/agent/prompt.test.js` - Added 8 new tests for BOOKING FLOW section presence/absence and content

## Decisions Made
- book_appointment only injected when `onboarding_complete=true` — consistent with TRIAGE-AWARE BEHAVIOR gate from Phase 02. Pre-onboarding agents should not be able to book.
- BOOKING FLOW replaces the placeholder "cannot book appointments yet" line — single source of truth for booking capability state.
- Prompt section uses `available_slots` dynamic variable name — this must match the variable name injected by the webhook handler (future plan).
- Address read-back is designed as a blocking conversation step — "Do NOT proceed until they confirm." This is a VOICE-04 compliance requirement.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- AI agent config now has `book_appointment` function ready to invoke during calls
- Agent prompt guides the full booking conversation including slot offering, address confirmation, and error handling
- Next: implement the webhook handler that receives `book_appointment` function-call events and actually creates bookings in the database (Plan 03)

## Self-Check: PASSED

All files verified present. All 4 task commits verified in git history.

---
*Phase: 03-scheduling-and-calendar-sync*
*Completed: 2026-03-20*

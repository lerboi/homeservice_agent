---
phase: 15-call-processor-and-triage-reclassification
plan: "02"
subsystem: webhooks, call-processor, notifications, testing
tags: [booking-outcome, notification-priority, caller-sms, webhook, real-time, i18n, wave-2]
dependency_graph:
  requires:
    - phase: 15-01
      provides: sendCallerSMS in notifications.js, booking-outcome test scaffolds, schema migration
  provides:
    - src/lib/call-processor.js#flattened-pipeline
    - src/lib/call-processor.js#notification_priority
    - src/app/api/webhooks/retell/route.js#booking_outcome_writes
    - src/app/api/webhooks/retell/route.js#caller_sms
    - src/app/api/webhooks/retell/route.js#exception_reason
    - .claude/skills/voice-call-architecture/SKILL.md#phase-15-state
  affects:
    - phase-16-notification-priority-system
    - phase-17-recovery-sms

tech-stack:
  added: []
  patterns:
    - "booking_outcome written real-time via after() during live call, not post-call"
    - "not_attempted default via conditional .update().eq().is() — avoids overwriting real-time values"
    - "notification_priority computed from urgency after triage, stored as separate column for Phase 16"
    - "Caller SMS fired via after() in webhook handler (not post-call processor) for <60s delivery"
    - "shouldCalculateSlots = !appointmentExists && tenantId replaces isRoutineUnbooked guard"

key-files:
  created: []
  modified:
    - src/lib/call-processor.js
    - src/app/api/webhooks/retell/route.js
    - .claude/skills/voice-call-architecture/SKILL.md
    - tests/call-processor/booking-outcome.test.js
    - tests/webhooks/call-analyzed.test.js

key-decisions:
  - "[Phase 15-02]: shouldCalculateSlots = !appointmentExists && tenantId replaces isRoutineUnbooked — all unbooked calls get suggested_slots regardless of urgency (D-04, D-05)"
  - "[Phase 15-02]: notification_priority NOT included in booking_outcome conditional update — separate concern, mapping only in main upsert"
  - "[Phase 15-02]: booking-outcome.test.js mock fix: single-hop .eq().is() chain matches plan specification (not double-hop as originally written)"
  - "[Phase 15-02]: call-analyzed.test.js mock fix: added .update() and .is() to mockCallsQuery, sendCallerSMS to notifications mock"

requirements-completed: [TRIAGE-R01, TRIAGE-R02, BOOK-04]

duration: 7min
completed: 2026-03-25
---

# Phase 15 Plan 02: Call Processor + Webhook Pipeline Summary

**Flattened booking-first pipeline: booking_outcome written real-time at 4 points, notification_priority computed from urgency, caller SMS sent on successful booking with i18n locale detection, suggested_slots expanded to all unbooked calls**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-24T21:18:46Z
- **Completed:** 2026-03-24T21:25:46Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Removed `isRoutineUnbooked` guard from call-processor; expanded suggested_slots to any unbooked call regardless of urgency (D-04, D-05)
- Added `notification_priority` column write (`high` for emergency/high_ticket, `standard` for routine) in processCallAnalyzed (D-11)
- Added conditional post-call update: `booking_outcome='not_attempted'` where IS NULL (D-02), preventing overwrite of real-time values
- Wired real-time `booking_outcome` writes in webhook handler: `booked` (success), `attempted` (failure), `declined` (capture_lead) via `after()` (D-02)
- Added `exception_reason` write on `transfer_call` fire (D-03), inferred from summary text (`clarification_limit` or `caller_requested`)
- Caller SMS confirmation sent after successful booking via `sendCallerSMS()` with i18n locale detection from `detected_language` (D-06, D-07, D-08, BOOK-04)
- Updated SKILL.md to reflect all Phase 15 behavioral changes per CLAUDE.md directive

## Task Commits

Each task was committed atomically:

1. **Task 1: Flatten pipeline + notification_priority + not_attempted default** - `0f9c1b3` (feat)
2. **Task 2: Webhook booking_outcome writes + caller SMS + exception_reason** - `699a50c` (feat)
3. **Task 3: Update voice-call-architecture skill file** - `f26f254` (docs)
4. **Deviation fix: call-analyzed test mock** - `08516a7` (fix)

**Plan metadata:** (final commit to follow)

## Files Created/Modified

- `src/lib/call-processor.js` — Flattened pipeline: isRoutineUnbooked removed, shouldCalculateSlots added, notification_priority computed and upserted, not_attempted conditional update added
- `src/app/api/webhooks/retell/route.js` — sendCallerSMS import, booking_outcome writes (booked/attempted/declined), exception_reason on transfer, tenant query expanded to include business_name/default_locale
- `.claude/skills/voice-call-architecture/SKILL.md` — All Phase 15 changes documented: booking_outcome lifecycle, notification_priority, caller SMS, exception_reason, flattened pipeline
- `tests/call-processor/booking-outcome.test.js` — Mock fixes: single-hop eq().is() chain, .neq() support for Promise.all selects
- `tests/webhooks/call-analyzed.test.js` — Mock fixes: .update()/.is() added to mockCallsQuery, sendCallerSMS added to notifications mock

## Decisions Made

- booking_outcome written via `after()` in webhook handler (real-time, during live call) — NOT in processCallAnalyzed (post-call)
- not_attempted default uses conditional `.update().eq().is('booking_outcome', null)` — ensures it never overwrites real-time values set during the call
- Caller SMS uses `detected_language` from call record with fallback to `tenant.default_locale` — avoids extra DB query by reusing tenant data already fetched
- All booking_outcome upserts use `onConflict: 'retell_call_id'` consistent with existing patterns

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed booking-outcome.test.js update mock chain depth**
- **Found during:** Task 1 (booking-outcome tests)
- **Issue:** Test mock had two-hop `.eq().eq().is()` for update chain, but plan specification shows single-hop `.eq().is()`. Tests failed with "is is not a function".
- **Fix:** Changed `mockUpdateEqEq` (double-hop) to single-hop: `mockUpdateEq` returns `{ is: mockIs }` directly.
- **Files modified:** `tests/call-processor/booking-outcome.test.js`
- **Verification:** 7/7 tests pass GREEN
- **Committed in:** 0f9c1b3 (Task 1 commit)

**2. [Rule 1 - Bug] Added .neq() and thenability to makeSelectChain for Promise.all DB queries**
- **Found during:** Task 1 (booking-outcome test — suggested_slots for emergency calls)
- **Issue:** The `makeSelectChain` mock didn't support `.neq()` (used by appointments query in Promise.all inside shouldCalculateSlots block). Exception was caught silently, so calculateAvailableSlots was never called.
- **Fix:** Added `leaf.neq` and `leaf.then` to `makeSelectChain` so all four parallel supabase queries in the slots calculation block resolve without errors.
- **Files modified:** `tests/call-processor/booking-outcome.test.js`
- **Verification:** 7/7 tests pass GREEN including the emergency-urgency suggested_slots test
- **Committed in:** 0f9c1b3 (Task 1 commit)

**3. [Rule 1 - Bug] Fixed call-analyzed.test.js mock missing .update() and sendCallerSMS**
- **Found during:** After Task 3 (full test suite run)
- **Issue:** `mockCallsQuery` in `tests/webhooks/call-analyzed.test.js` lacked `.update()` and `.is()` methods. Also `notifications` mock was missing `sendCallerSMS` export which call-processor now imports.
- **Fix:** Added `update: jest.fn().mockReturnThis()` and `is: jest.fn().mockResolvedValue(...)` to `mockCallsQuery`; added `sendCallerSMS` to notifications mock.
- **Files modified:** `tests/webhooks/call-analyzed.test.js`
- **Verification:** 13/13 tests pass GREEN
- **Committed in:** 08516a7 (separate fix commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 - Bug)
**Impact on plan:** All fixes were test mock corrections needed for the new code paths. No scope creep. 5 pre-existing test failures (JSX syntax in NewLeadEmail.jsx) remain unrelated to this plan.

## Issues Encountered

- Pre-existing test failures in `retell-inbound.test.js`, `retell-signature.test.js`, `retell-webhook-scheduling.test.js`, and onboarding tests — all caused by `SyntaxError: Support for the experimental syntax 'jsx' isn't currently enabled` in `src/emails/NewLeadEmail.jsx`. These are pre-existing, out of scope for Phase 15, and logged to deferred-items.

## Known Stubs

None — all artifacts are fully implemented. booking_outcome writes, notification_priority mapping, caller SMS, exception_reason, and skill file updates are complete.

## Next Phase Readiness

- Phase 16 (Notification Priority System) can now read `notification_priority` from calls table (high/standard values populated from Phase 15)
- Phase 17 (Recovery SMS) can use `booking_outcome` column to identify unbooked calls more precisely
- SKILL.md is accurate and up-to-date for any future voice-call architecture changes

---
*Phase: 15-call-processor-and-triage-reclassification*
*Completed: 2026-03-25*

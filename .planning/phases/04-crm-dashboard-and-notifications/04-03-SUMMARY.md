---
phase: 04-crm-dashboard-and-notifications
plan: 03
subsystem: api
tags: [crm, notifications, twilio, vercel-cron, call-processor, leads, recovery-sms]

requires:
  - phase: 04-01
    provides: createOrMergeLead and getLeads functions in src/lib/leads.js
  - phase: 04-02
    provides: sendOwnerNotifications and sendCallerRecoverySMS in src/lib/notifications.js

provides:
  - processCallAnalyzed now creates/merges leads and triggers owner SMS+email after every analyzed call
  - Vercel Cron endpoint (GET /api/cron/send-recovery-sms) sends warm recovery SMS to callers who hung up without booking
  - Lead creation and notification failures are isolated — call record persistence is never affected

affects:
  - 04-04 (CRM dashboard will display leads created by this integration)
  - 04-05 (any dashboard stats/metrics depend on leads flowing through this pipeline)

tech-stack:
  added: []
  patterns:
    - fire-and-forget .catch() for owner notification (non-blocking, after call upsert)
    - Vercel Cron with CRON_SECRET Bearer authorization
    - appointmentId lookup via targeted supabase query after appointmentExists boolean check

key-files:
  created:
    - src/app/api/cron/send-recovery-sms/route.js
    - vercel.json
    - tests/crm/webhook-lead-creation.test.js
  modified:
    - src/lib/call-processor.js
    - tests/webhooks/call-analyzed.test.js
    - .env.example

key-decisions:
  - "appointmentId lookup uses targeted select after appointmentExists boolean — avoids redundant query when no booking"
  - "sendOwnerNotifications is fire-and-forget (.catch pattern) — failure never blocks call record persistence"
  - "Recovery cron limits to 10 calls per invocation for Twilio rate limit safety"
  - "Short calls (<15s) in cron endpoint are marked as processed immediately to prevent perpetual re-querying"
  - "Booked calls in cron endpoint also marked processed — recovery SMS only for unbooked callers"

patterns-established:
  - "Non-blocking notification: fire-and-forget sendOwnerNotifications().catch() after successful upsert"
  - "Cron endpoint pattern: Bearer auth, cutoff query, per-row error isolation, processed-count response"

requirements-completed: [CRM-01, CRM-03, NOTIF-01, NOTIF-02, NOTIF-03]

duration: 11min
completed: 2026-03-21
---

# Phase 04 Plan 03: Call-to-Lead Integration and Recovery Cron Summary

**processCallAnalyzed now auto-creates leads and triggers owner SMS+email via fire-and-forget, with Vercel Cron recovery for callers who hung up without booking**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-03-21T07:54:07Z
- **Completed:** 2026-03-21T08:04:31Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Wired `createOrMergeLead` + `sendOwnerNotifications` into `processCallAnalyzed` — every analyzed call now automatically creates/merges a lead and triggers owner alerts
- Created Vercel Cron endpoint (`GET /api/cron/send-recovery-sms`) running every minute to find unbooked callers and send warm recovery SMS
- All notification and lead creation failures are isolated with try/catch — call record upsert is never blocked
- 200 tests pass across 21 test suites (up from 187 before this plan)

## Task Commits

Each task was committed atomically:

1. **RED: Failing tests for lead creation wiring** - `77c2752` (test)
2. **GREEN: Wire createOrMergeLead + sendOwnerNotifications into processCallAnalyzed** - `a47c493` (feat)
3. **Task 2: Vercel Cron endpoint for caller recovery SMS** - `f8ffe21` (feat)

_Note: Task 1 used TDD (RED → GREEN). Task 2 implemented directly per plan spec._

## Files Created/Modified

- `src/lib/call-processor.js` - Added createOrMergeLead + sendOwnerNotifications calls after upsert block
- `src/app/api/cron/send-recovery-sms/route.js` - New Vercel Cron handler for NOTIF-03 recovery SMS
- `vercel.json` - Cron schedule config: every minute for /api/cron/send-recovery-sms
- `tests/crm/webhook-lead-creation.test.js` - 7 integration tests for lead creation wiring
- `tests/webhooks/call-analyzed.test.js` - Added leads/notifications mocks (auto-fix for import chain)
- `.env.example` - Added CRON_SECRET variable

## Decisions Made

- `sendOwnerNotifications` is fire-and-forget (`.catch` pattern): ensures notification failure never delays or prevents the `processCallAnalyzed` function from completing
- `appointmentId` uses a targeted `maybeSingle` query only when `appointmentExists` is already true — avoids an extra DB round-trip for calls with no booking
- Recovery cron caps at 10 calls/invocation to respect Twilio rate limits
- Short calls and booked calls in the cron path are marked `recovery_sms_sent_at` immediately to avoid perpetual re-querying

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed broken existing tests caused by new imports in call-processor.js**
- **Found during:** Task 1 verification
- **Issue:** Adding `import { createOrMergeLead } from '@/lib/leads'` and `import { sendOwnerNotifications } from '@/lib/notifications'` to call-processor.js caused `tests/webhooks/call-analyzed.test.js` to fail with JSX parse error (notifications.js transitively imports NewLeadEmail.jsx, which Jest cannot parse without Babel config)
- **Fix:** Added `jest.unstable_mockModule` for both `@/lib/leads` and `@/lib/notifications` in the existing test file
- **Files modified:** `tests/webhooks/call-analyzed.test.js`
- **Verification:** `tests/webhooks/call-analyzed.test.js` — 13/13 tests pass
- **Committed in:** `a47c493` (Task 1 feat commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Necessary fix to keep existing test suite green. No scope creep.

## Issues Encountered

None beyond the auto-fixed JSX import chain issue above.

## User Setup Required

Add to your `.env` (or Vercel Environment Variables):
- `CRON_SECRET` — a random secret string; Vercel sets it as `Authorization: Bearer <CRON_SECRET>` on cron requests

## Next Phase Readiness

- Lead pipeline is fully wired: call analyzed → lead created → owner notified → recovery SMS for unbooked callers
- Plan 04 (CRM dashboard) can now display real leads from the database
- Plan 05/06 (remaining CRM features) have the complete data flow in place

---
*Phase: 04-crm-dashboard-and-notifications*
*Completed: 2026-03-21*

## Self-Check: PASSED

- FOUND: src/lib/call-processor.js
- FOUND: src/app/api/cron/send-recovery-sms/route.js
- FOUND: vercel.json
- FOUND: tests/crm/webhook-lead-creation.test.js
- FOUND: .planning/phases/04-crm-dashboard-and-notifications/04-03-SUMMARY.md
- FOUND commit: 77c2752 (test RED)
- FOUND commit: a47c493 (feat GREEN)
- FOUND commit: f8ffe21 (feat cron)
- All 200 tests pass across 21 suites

---
phase: 04-crm-dashboard-and-notifications
plan: 02
subsystem: notifications
tags: [twilio, resend, react-email, sms, email]

requires:
  - phase: 04-01
    provides: leads data structure for notification content
provides:
  - sendOwnerSMS() — Twilio SMS with lead details to owner
  - sendOwnerEmail() — Resend email with React Email template to owner
  - sendCallerRecoverySMS() — warm recovery SMS to caller
  - sendOwnerNotifications() — parallel SMS+email convenience wrapper
affects: [04-03-webhook-integration, 04-06-dashboard]

tech-stack:
  added: [twilio ^5.13.0, resend ^6.9.4, @react-email/components ^1.0.10]
  patterns: [lazy-instantiated SDK clients, try/catch non-throwing notification pattern]

key-files:
  created:
    - src/lib/notifications.js
    - src/emails/NewLeadEmail.jsx
    - tests/notifications/owner-sms.test.js
    - tests/notifications/owner-email.test.js
    - tests/notifications/caller-recovery.test.js
    - tests/__mocks__/twilio.js
    - tests/__mocks__/resend.js
  modified: [package.json]

key-decisions:
  - "Lazy-instantiated Twilio/Resend clients (getClient pattern) — prevents build failure without env vars"
  - "Try/catch non-throwing pattern — notification failure must never crash webhook handler"
  - "Inline Jest mocks for twilio/resend — avoids OOM from loading real packages in ESM test mode"

patterns-established:
  - "Notification non-throw: all send* functions catch errors and log, never throw"
  - "Inline mock pattern for heavy npm packages in ESM Jest tests"

requirements-completed: [NOTIF-01, NOTIF-02, NOTIF-03]

duration: 8min
completed: 2026-03-21
---

# Plan 04-02: Notification Service Summary

**Twilio SMS + Resend email notification module with React Email template and 16 passing tests**

## Performance

- **Duration:** 8 min (pre-existing code verified + test OOM fix)
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Notification module with 4 exported functions (sendOwnerSMS, sendOwnerEmail, sendCallerRecoverySMS, sendOwnerNotifications)
- React Email template using project design tokens (navy, brandOrange, warmSurface, bodyText)
- All 16 notification tests passing in <1s after fixing OOM from loading real twilio package in ESM Jest

## Task Commits

1. **Task 1: Notification module + email template** - `17569fe` (feat)
2. **Task 2: Test OOM fix** — inline mocks replacing imported mock files

## Files Created/Modified
- `src/lib/notifications.js` — 4 notification functions with lazy SDK clients
- `src/emails/NewLeadEmail.jsx` — React Email template with design tokens
- `tests/notifications/owner-sms.test.js` — 5 SMS content + error tests
- `tests/notifications/owner-email.test.js` — 5 email delivery tests
- `tests/notifications/caller-recovery.test.js` — 6 recovery SMS tests
- `tests/__mocks__/twilio.js` — Twilio mock factory
- `tests/__mocks__/resend.js` — Resend mock class

## Decisions Made
- Lazy-instantiated Twilio/Resend clients (same getClient() pattern as layer2-llm.js)
- Notification functions never throw — try/catch with console.error only
- Rewrote test mocks from imported files to inline to fix Jest ESM OOM with heavy twilio package

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Jest OOM with twilio/resend mock imports**
- **Found during:** Task 2 (test execution)
- **Issue:** `jest.unstable_mockModule('twilio', async () => { await import('../__mocks__/twilio.js') })` caused Jest ESM resolver to load real twilio package (18MB), triggering 4GB+ OOM
- **Fix:** Replaced imported mock pattern with inline mock definitions (matching classifier.test.js pattern)
- **Files modified:** tests/notifications/owner-sms.test.js, owner-email.test.js, caller-recovery.test.js
- **Verification:** All 16 tests pass in 0.8s with default heap
- **Committed in:** pending (part of plan completion)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix for test execution. No scope creep.

## Issues Encountered
- Jest ESM + `jest.unstable_mockModule` with `await import()` inside factory triggers full module resolution of heavy packages, causing OOM. Inline mocks bypass this entirely.

## User Setup Required

**External services require manual configuration:**
- `TWILIO_ACCOUNT_SID` — Twilio Console > Account > Account SID
- `TWILIO_AUTH_TOKEN` — Twilio Console > Account > Auth Token
- `TWILIO_FROM_NUMBER` — Twilio Console > Phone Numbers > Buy SMS-capable number
- `RESEND_API_KEY` — Resend Dashboard > API Keys > Create API Key
- `RESEND_FROM_EMAIL` — Resend Dashboard > Domains > Verify domain

## Next Phase Readiness
- Notification functions ready for webhook integration (Plan 04-03)
- sendOwnerNotifications() convenience wrapper handles parallel SMS+email
- All functions are async and safe for after() post-response execution

---
*Phase: 04-crm-dashboard-and-notifications*
*Completed: 2026-03-21*

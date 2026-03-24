---
phase: 08-outlook-calendar-sync
plan: 02
subsystem: api
tags: [microsoft-graph, oauth, webhook, outlook, calendar-sync, next-api-routes]

# Dependency graph
requires:
  - phase: 08-outlook-calendar-sync-01
    provides: outlook-calendar.js module with getOutlookAuthUrl, exchangeCodeForTokens, createOutlookSubscription, syncOutlookCalendarEvents
provides:
  - GET /api/outlook-calendar/auth endpoint returning Microsoft OAuth consent URL
  - GET /api/outlook-calendar/callback endpoint handling OAuth redirect with admin consent error detection
  - POST /api/webhooks/outlook-calendar endpoint with Graph validation handshake
  - handleOutlookCalendarPush function for processing Graph subscription notifications
affects: [08-outlook-calendar-sync-03, dashboard-calendar-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: [graph-webhook-validation-handshake, admin-consent-error-detection, is-primary-auto-detection]

key-files:
  created:
    - src/app/api/outlook-calendar/auth/route.js
    - src/app/api/outlook-calendar/callback/route.js
    - src/app/api/webhooks/outlook-calendar/route.js
    - src/lib/webhooks/outlook-calendar-push.js
    - tests/scheduling/outlook-calendar-push.test.js
  modified:
    - src/lib/scheduling/outlook-calendar.js

key-decisions:
  - "Direct fetch to Graph /me endpoint for calendar display name instead of exporting graphFetch -- simpler for single use"
  - "after() captures callback without executing for route tests -- prevents side effects in webhook response tests"
  - "Stub outlook-calendar.js created for import resolution since Plan 01 runs in parallel"

patterns-established:
  - "Graph webhook validation: check validationToken query param, return plain text with text/plain Content-Type"
  - "Admin consent error detection: check for consent_required, interaction_required, AADSTS65001, AADSTS90094 in OAuth callback"
  - "is_primary auto-detection: count existing calendar_credentials for tenant, first provider gets is_primary=true"

requirements-completed: [OUTLOOK-01, OUTLOOK-02]

# Metrics
duration: 4min
completed: 2026-03-24
---

# Phase 08 Plan 02: Outlook OAuth Routes and Webhook Endpoint Summary

**Outlook OAuth auth/callback routes with admin consent error detection and Graph webhook endpoint with validation handshake returning plain text**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-24T12:01:48Z
- **Completed:** 2026-03-24T12:05:58Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- OAuth auth route mirrors Google pattern: authenticate user, retrieve tenant, return Microsoft consent URL
- OAuth callback handles code exchange, admin consent errors (AADSTS65001/consent_required), is_primary detection (D-03), credential upsert, subscription registration, and initial sync
- Webhook endpoint handles Graph validation handshake with plain text response (Pitfall 1 addressed)
- Push handler validates clientState against OUTLOOK_WEBHOOK_SECRET, looks up tenant by subscription ID with provider filter
- 7 tests passing covering validation handshake, URL decoding, notification processing, and error cases

## Task Commits

Each task was committed atomically:

1. **Task 1: Outlook OAuth auth + callback routes** - `b7d7602` (feat)
2. **Task 2: Outlook webhook endpoint + push handler + tests (RED)** - `4be79c9` (test)
3. **Task 2: Outlook webhook endpoint + push handler + tests (GREEN)** - `fd5b065` (feat)

## Files Created/Modified
- `src/app/api/outlook-calendar/auth/route.js` - GET endpoint returning Microsoft OAuth consent URL
- `src/app/api/outlook-calendar/callback/route.js` - GET endpoint handling OAuth redirect, token exchange, admin consent errors, initial sync
- `src/app/api/webhooks/outlook-calendar/route.js` - POST endpoint for Graph subscription notifications with validation handshake
- `src/lib/webhooks/outlook-calendar-push.js` - Push notification handler calling syncOutlookCalendarEvents per tenant
- `src/lib/scheduling/outlook-calendar.js` - Stub module for import resolution (Plan 01 provides full implementation)
- `tests/scheduling/outlook-calendar-push.test.js` - 7 tests for webhook validation and notification processing

## Decisions Made
- Used direct `fetch('https://graph.microsoft.com/v1.0/me')` in callback for user profile instead of importing/exporting graphFetch -- single use case doesn't justify the coupling
- Created stub `outlook-calendar.js` with throwing implementations so Plan 02 routes and tests can resolve imports while Plan 01 runs in parallel
- Captured `after()` callbacks without executing in route tests to prevent side effects during webhook response verification

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created stub outlook-calendar.js for import resolution**
- **Found during:** Task 2 (test execution)
- **Issue:** Plan 01 runs in parallel and hasn't created outlook-calendar.js yet; Jest unstable_mockModule requires the file to exist for module resolution even when mocking
- **Fix:** Created minimal stub with all 5 exported functions that throw "Not implemented" errors; Plan 01 will overwrite with full implementation
- **Files modified:** src/lib/scheduling/outlook-calendar.js
- **Verification:** All 7 tests pass with mocked imports
- **Committed in:** fd5b065 (Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Stub is temporary -- Plan 01 overwrites with full implementation. No scope creep.

## Known Stubs

- `src/lib/scheduling/outlook-calendar.js` - Temporary stub with 5 throwing functions; will be replaced by Plan 01's full implementation

## Issues Encountered
None beyond the stub creation documented above.

## User Setup Required
None - no external service configuration required. Azure AD app registration and environment variables (MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, OUTLOOK_WEBHOOK_SECRET) are handled by Plan 01 or deployment configuration.

## Next Phase Readiness
- OAuth and webhook routes are complete and ready for integration with Plan 01's outlook-calendar.js module
- Plan 03 (UI and cron) can reference these routes for dashboard connect/disconnect flows
- Webhook endpoint ready to receive Graph subscription notifications once subscriptions are created

---
*Phase: 08-outlook-calendar-sync*
*Completed: 2026-03-24*

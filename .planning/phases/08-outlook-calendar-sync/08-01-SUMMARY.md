---
phase: 08-outlook-calendar-sync
plan: 01
subsystem: api, database
tags: [microsoft-graph, msal-node, outlook, calendar, oauth, delta-query, supabase]

# Dependency graph
requires:
  - phase: 03-scheduling-and-calendar-sync
    provides: calendar_credentials and calendar_events tables, Google Calendar module
provides:
  - Database migration for dual-provider calendar support (is_primary, external_event_id, external_event_provider)
  - Google Calendar module with provider-filtered queries (D-08 fix)
  - Outlook Calendar module with 8 exported functions (OAuth, sync, CRUD, subscription, disconnect)
affects: [08-02, 08-03, outlook-calendar-sync]

# Tech tracking
tech-stack:
  added: ["@azure/msal-node"]
  patterns: [graphFetch REST wrapper for Microsoft Graph, lazy MSAL singleton, delta query incremental sync, direct token refresh for serverless]

key-files:
  created:
    - supabase/migrations/007_outlook_calendar.sql
    - src/lib/scheduling/outlook-calendar.js
    - tests/scheduling/outlook-calendar.test.js
    - tests/scheduling/google-calendar-provider-filter.test.js
  modified:
    - src/lib/scheduling/google-calendar.js
    - tests/scheduling/google-calendar-push.test.js
    - package.json

key-decisions:
  - "Direct fetch for Outlook token refresh instead of MSAL cache (serverless-safe, Pitfall 3)"
  - "Store full deltaLink URL as last_sync_token (Graph API anti-pattern avoidance)"
  - "pushBookingToCalendar queries by is_primary=true for D-02 (push to primary calendar only)"
  - "7-day subscription expiry matching corrected Graph API docs (not 3-day)"

patterns-established:
  - "graphFetch: centralized Graph REST wrapper handling full URLs for deltaLink and relative paths"
  - "Provider filter on all calendar_credentials queries: .eq('provider', 'google'|'outlook')"
  - "getValidAccessToken helper with 5-min buffer for token refresh"

requirements-completed: [OUTLOOK-01, OUTLOOK-02, OUTLOOK-04]

# Metrics
duration: 7min
completed: 2026-03-24
---

# Phase 08 Plan 01: Outlook Calendar Core Module Summary

**Dual-provider calendar migration, Google module provider filters (D-08), and complete Outlook Calendar module with MSAL OAuth, Graph API delta sync, subscription management, and disconnect flow**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-24T12:01:47Z
- **Completed:** 2026-03-24T12:09:16Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Database migration adding is_primary, external_event_id, and external_event_provider columns
- Fixed all 5 Google Calendar module queries with provider filters (D-08) preventing dual-provider breakage
- Complete Outlook Calendar module with 8 exported functions mirroring Google module structure
- 13 new tests across 2 test files; all 55 scheduling tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: DB migration + fix Google module provider filters** - `d1d167d` (feat)
2. **Task 2: Create Outlook Calendar module + tests (TDD RED)** - `2dd344c` (test)
3. **Task 2: Create Outlook Calendar module + tests (TDD GREEN)** - `e44f756` (feat)

## Files Created/Modified
- `supabase/migrations/007_outlook_calendar.sql` - is_primary, external_event_id, external_event_provider migration
- `src/lib/scheduling/outlook-calendar.js` - Full Outlook module: OAuth, token refresh, event CRUD, subscription, delta sync, disconnect
- `src/lib/scheduling/google-calendar.js` - Added .eq('provider', 'google') on all 5 query sites, is_primary on pushBookingToCalendar
- `tests/scheduling/outlook-calendar.test.js` - 8 tests for Outlook module
- `tests/scheduling/google-calendar-provider-filter.test.js` - 5 tests verifying provider filters
- `tests/scheduling/google-calendar-push.test.js` - Fixed mock chain for new provider filter
- `package.json` - Added @azure/msal-node dependency

## Decisions Made
- Used direct HTTP POST for token refresh instead of MSAL acquireTokenSilent (serverless-safe, Pitfall 3)
- Store full deltaLink URL as last_sync_token, not just the token portion (anti-pattern avoidance)
- pushBookingToCalendar queries by is_primary=true implementing D-02 (push to primary calendar only)
- 7-day subscription expiry per corrected Graph API documentation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed google-calendar-push.test.js mock chain for provider filter**
- **Found during:** Task 2 (running full scheduling test suite)
- **Issue:** Existing test mock chain had `.eq()` returning a resolved Promise directly instead of a chainable object, breaking when the new `.eq('provider', 'google')` call was chained after `.eq('tenant_id', ...)`
- **Fix:** Changed mock to use `.mockReturnThis()` for chainable `.eq()` calls
- **Files modified:** tests/scheduling/google-calendar-push.test.js
- **Verification:** All 55 scheduling tests pass
- **Committed in:** e44f756 (Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix - our provider filter changes broke the existing test mock. No scope creep.

## Issues Encountered
None

## User Setup Required

**External services require manual configuration.** Azure AD app registration needed:
- Environment variables: MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, OUTLOOK_WEBHOOK_SECRET
- Azure Portal: Create app registration with redirect URI `{NEXT_PUBLIC_APP_URL}/api/outlook-calendar/callback`
- API Permissions: Microsoft Graph -> Delegated -> Calendars.ReadWrite + offline_access

## Known Stubs
None - all functions are fully implemented.

## Next Phase Readiness
- Outlook Calendar module ready for API route integration (Plan 02)
- Database migration ready for deployment
- Google module safe for dual-provider operation
- All scheduling tests green

## Self-Check: PASSED

All 5 key files verified present. All 3 task commits verified in git log.

---
*Phase: 08-outlook-calendar-sync*
*Completed: 2026-03-24*

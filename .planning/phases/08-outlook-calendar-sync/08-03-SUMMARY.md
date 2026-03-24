---
phase: 08-outlook-calendar-sync
plan: 03
subsystem: api, ui
tags: [dual-provider, calendar-sync, set-primary, cron-renewal, shadcn, dashboard]

# Dependency graph
requires:
  - phase: 08-outlook-calendar-sync-01
    provides: outlook-calendar.js module with revokeAndDisconnectOutlook, renewOutlookSubscription
  - phase: 08-outlook-calendar-sync-02
    provides: Outlook OAuth auth/callback routes, Graph webhook endpoint
provides:
  - Dual-provider status API returning both Google and Outlook with is_primary
  - Provider-aware disconnect route with auto-promote on primary disconnect (D-04)
  - New set-primary endpoint for swapping primary calendar between providers
  - Extended cron handling both Google watch and Outlook subscription renewal
  - Rewritten CalendarSyncCard UI as dual-provider card per UI-SPEC
affects: [dashboard-calendar-ui, scheduling, availability]

# Tech tracking
tech-stack:
  added: []
  patterns: [dual-provider-status-api, optimistic-ui-primary-swap, provider-config-map, CalendarProviderRow-subcomponent]

key-files:
  created:
    - src/app/api/calendar-sync/set-primary/route.js
  modified:
    - src/app/api/calendar-sync/status/route.js
    - src/app/api/calendar-sync/disconnect/route.js
    - src/app/api/cron/renew-calendar-channels/route.js
    - src/components/dashboard/CalendarSyncCard.js

key-decisions:
  - "PROVIDER_CONFIG map centralizes auth endpoints, icon colors, popup names per provider -- avoids scattered conditionals"
  - "Optimistic UI for make-primary: badge swap is instant, reverts on server error -- matches UI-SPEC animation contract (0ms badge swap)"
  - "URL param detection (window.location.search) for OAuth success/error toasts instead of sessionStorage -- simpler, works across popup close"
  - "CalendarProviderRow extracted as subcomponent for DRY Google/Outlook rendering -- both connected and disconnected states handled in one component"

patterns-established:
  - "PROVIDER_CONFIG constant map for provider-specific auth endpoints, icon styling, and popup config"
  - "Optimistic UI pattern with revert-on-error for immediate feedback on settings changes"
  - "Dual-provider API response shape: { google: {...} | null, outlook: {...} | null }"

requirements-completed: [OUTLOOK-01, OUTLOOK-02, OUTLOOK-03, OUTLOOK-04]

# Metrics
duration: 41min
completed: 2026-03-24
---

# Phase 08 Plan 03: Dual-Provider API Routes and CalendarSyncCard Rewrite Summary

**Dual-provider status/disconnect/set-primary API routes with auto-promote on primary disconnect, extended cron for both providers, and rewritten CalendarSyncCard with Google/Outlook rows, PRIMARY badge, Make Primary button, and admin consent error handling**

## Performance

- **Duration:** 41 min
- **Started:** 2026-03-24T12:14:47Z
- **Completed:** 2026-03-24T12:56:13Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Status API returns both providers with is_primary field, replacing single-provider Google-only response
- Disconnect route accepts provider parameter and auto-promotes remaining provider when primary is disconnected (D-04)
- New set-primary endpoint enables swapping primary calendar between connected providers
- Cron route extended to renew both Google watch channels and Outlook subscriptions
- CalendarSyncCard fully rewritten as dual-provider card with empty state (D-07), connected provider rows (D-05), PRIMARY badge and Make Primary button (D-06), admin consent error handling, and optimistic UI for primary swap
- Human verification approved by user

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite status/disconnect/set-primary API routes + extend cron** - `5862cd5` (feat)
2. **Task 2: Rewrite CalendarSyncCard as dual-provider card per UI-SPEC** - `4614042` (feat)
3. **Task 3: Human verification of dual-provider calendar sync** - approved (no code commit)

## Files Created/Modified
- `src/app/api/calendar-sync/status/route.js` - Returns `{ google: {...}|null, outlook: {...}|null }` with is_primary field
- `src/app/api/calendar-sync/disconnect/route.js` - Accepts `{ provider }` body, auto-promotes remaining on primary disconnect (D-04)
- `src/app/api/calendar-sync/set-primary/route.js` - New POST endpoint swapping is_primary between providers
- `src/app/api/cron/renew-calendar-channels/route.js` - Handles both Google registerWatch and Outlook renewOutlookSubscription
- `src/components/dashboard/CalendarSyncCard.js` - Full rewrite: PROVIDER_CONFIG map, CalendarProviderRow subcomponent, SyncStatusDot with aria, empty state with two connect buttons, connected state with provider rows, PRIMARY badge, Make Primary, disconnect AlertDialog, admin consent error alert, optimistic UI

## Decisions Made
- Used PROVIDER_CONFIG constant map to centralize auth endpoints, icon colors, and popup names per provider -- avoids scattered conditionals throughout the component
- Implemented optimistic UI for make-primary action: badge swap is instant, reverts on server error -- matches UI-SPEC animation contract (0ms badge swap)
- URL param detection via window.location.search for OAuth success/error toasts instead of sessionStorage -- simpler and works reliably across popup close
- Extracted CalendarProviderRow as subcomponent for DRY rendering of both connected and disconnected states

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs
None - all endpoints and UI states are fully wired.

## Issues Encountered
None

## User Setup Required
None - no new external service configuration required. Azure AD app registration and environment variables were handled by Plan 01.

## Next Phase Readiness
- Phase 08 (Outlook Calendar Sync) is now complete across all 3 plans
- All dual-provider calendar functionality is operational: connect, disconnect, make-primary, sync, cron renewal
- Phase 9 (Hardening and Launch QA) can proceed

## Self-Check: PASSED

All 5 key files verified present. Both task commits (5862cd5, 4614042) verified in git log.

---
*Phase: 08-outlook-calendar-sync*
*Completed: 2026-03-24*

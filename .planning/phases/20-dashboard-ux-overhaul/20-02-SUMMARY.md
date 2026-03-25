---
phase: 20-dashboard-ux-overhaul
plan: 02
subsystem: ui
tags: [next-js, dashboard, routing, lucide-react, design-tokens]

# Dependency graph
requires:
  - phase: 12-dashboard-configurable-triage
    provides: ServicesPage with DnD reorder, urgency tags, SortableServiceRow component
  - phase: 19-codebase-skill-files
    provides: dashboard-crm-system skill reference
provides:
  - More menu page at /dashboard/more listing 7 config sections
  - 7 sub-page routes under /dashboard/more/* wrapping existing components
  - Redirects from /dashboard/services and /dashboard/settings to new routes
  - Updated setup-checklist API hrefs pointing to new More sub-page routes
affects:
  - 20-03 (5-tab nav will link to /dashboard/more)
  - 20-04 (Joyride tour uses data-tour="more-page")

# Tech tracking
tech-stack:
  added: []
  patterns:
    - More menu list page pattern: card.base container with divide-y rows, each row is a Link with icon + label + description + ChevronRight
    - Sub-page wrapping pattern: thin page.js files that wrap existing components in card.base with h1 heading

key-files:
  created:
    - src/app/dashboard/more/page.js
    - src/app/dashboard/more/layout.js
    - src/app/dashboard/more/services-pricing/page.js
    - src/app/dashboard/more/working-hours/page.js
    - src/app/dashboard/more/calendar-connections/page.js
    - src/app/dashboard/more/service-zones/page.js
    - src/app/dashboard/more/escalation-contacts/page.js
    - src/app/dashboard/more/ai-voice-settings/page.js
    - src/app/dashboard/more/account/page.js
  modified:
    - src/app/dashboard/services/page.js
    - src/app/dashboard/settings/page.js
    - src/app/api/setup-checklist/route.js

key-decisions:
  - "More menu consolidates Services + Settings into single config hub at /dashboard/more, making room for 5-tab nav structure"
  - "Sub-pages are thin wrappers — feature logic stays in existing components, no duplication"
  - "Old /dashboard/services and /dashboard/settings replaced with Next.js redirect() calls — bookmarks preserved"
  - "account/page.js is a placeholder stub — account management features deferred to a future plan"

patterns-established:
  - "More sub-page pattern: 'use client', import card from design-tokens, wrap component in card.base div with h1"
  - "Route redirect pattern: import redirect from next/navigation, call redirect() as sole export default function body"

requirements-completed:
  - SETUP-01
  - SETUP-03

# Metrics
duration: 15min
completed: 2026-03-25
---

# Phase 20 Plan 02: More Menu and Sub-Page Routes Summary

**More config hub at /dashboard/more with 7 sub-pages wrapping existing components, old pages redirecting, and setup-checklist hrefs updated to new routes**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-25T19:02:46Z
- **Completed:** 2026-03-25T19:06:47Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- More menu page renders 7 config sections as a card list with icons, labels, descriptions, and chevrons
- All 7 sub-page routes created under /dashboard/more/* — each wraps the existing component in a card.base wrapper
- Setup-checklist API hrefs updated: connect_calendar, configure_hours, make_test_call all point to new More routes
- Old /dashboard/services and /dashboard/settings pages replaced with redirect() calls

## Task Commits

Each task was committed atomically:

1. **Task 1: Create More menu page and layout** - `de4a80b` (feat)
2. **Task 2: Create 7 More sub-page routes** - `148b014` (feat)
3. **Task 3: Update checklist hrefs and replace old pages with redirects** - `12b433d` (feat)

## Files Created/Modified

- `src/app/dashboard/more/page.js` - More menu list page with 7 config section links
- `src/app/dashboard/more/layout.js` - Pass-through layout for route group
- `src/app/dashboard/more/services-pricing/page.js` - Full service table (DnD, urgency tags, bulk select) in card wrapper
- `src/app/dashboard/more/working-hours/page.js` - Wraps WorkingHoursEditor
- `src/app/dashboard/more/calendar-connections/page.js` - Wraps CalendarSyncCard
- `src/app/dashboard/more/service-zones/page.js` - Wraps ZoneManager
- `src/app/dashboard/more/escalation-contacts/page.js` - Wraps EscalationChainSection
- `src/app/dashboard/more/ai-voice-settings/page.js` - Wraps SettingsAISection with tenant phone number load
- `src/app/dashboard/more/account/page.js` - Placeholder for future account management
- `src/app/dashboard/services/page.js` - Replaced with redirect to /dashboard/more/services-pricing
- `src/app/dashboard/settings/page.js` - Replaced with redirect to /dashboard/more
- `src/app/api/setup-checklist/route.js` - Updated 3 hrefs to new More sub-page routes

## Decisions Made

- More menu consolidates Services + Settings into a single config hub, making room for the 5-tab nav structure in plan 20-03
- Sub-page files are thin wrappers — all feature logic stays in existing components
- account/page.js is intentionally a placeholder stub; account management features are not yet scoped
- CalendarSync icon from lucide-react was available (no fallback needed)

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

- `src/app/dashboard/more/account/page.js` — placeholder with "Account management coming soon." text. This is intentional per plan spec; account features are deferred to a future plan. Does not block the plan's goal (More menu structure is complete).

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- More menu hub is ready; plan 20-03 (5-tab nav) can now link /dashboard/more as the 5th tab
- All sub-page routes accessible for Joyride tour integration in plan 20-04
- No blockers

---
*Phase: 20-dashboard-ux-overhaul*
*Completed: 2026-03-25*

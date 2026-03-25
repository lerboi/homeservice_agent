---
phase: 20-dashboard-ux-overhaul
plan: 01
subsystem: ui
tags: [next.js, tailwind, react, dashboard, navigation, mobile]

# Dependency graph
requires:
  - phase: 04-crm-dashboard-and-notifications
    provides: "Original dashboard layout, leads/analytics/calendar pages, DashboardSidebar"
  - phase: 19-skill-files
    provides: "dashboard-crm-system skill file with all component paths"
provides:
  - "5-tab navigation structure (Home, Leads, Calendar, Analytics, More)"
  - "BottomTabBar.jsx — mobile-only fixed bottom tab bar replacing hamburger drawer"
  - "Updated DashboardSidebar — desktop-only, 5 nav items, no mobile drawer"
  - "Updated layout.js — no card wrapper, pb-[72px] mobile padding, breadcrumb for More sub-pages"
  - "Self-contained card wrappers on leads/analytics/calendar pages"
  - "data-tour attributes on all major sections for Joyride (Plan 04)"
affects:
  - 20-02-plan
  - 20-03-plan
  - 20-04-plan
  - "Any plan that imports DashboardSidebar or references dashboard layout"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Page-level card ownership — layout no longer wraps children; each page uses card.base token"
    - "BottomTabBar replaces hamburger drawer on mobile — fixed position, z-40, 56px height"
    - "data-tour attributes as Joyride targeting mechanism (not CSS class selectors)"
    - "BREADCRUMB_LABELS handles 3-segment paths via crumbs.map() loop"

key-files:
  created:
    - src/components/dashboard/BottomTabBar.jsx
  modified:
    - src/app/dashboard/layout.js
    - src/components/dashboard/DashboardSidebar.jsx
    - src/app/dashboard/leads/page.js
    - src/app/dashboard/analytics/page.js
    - src/app/dashboard/calendar/page.js

key-decisions:
  - "Layout removes card wrapper entirely — page-level card ownership established as the pattern for all dashboard pages going forward"
  - "BottomTabBar uses h-[56px] bar height with min-h-[48px] per tab for 48px touch targets on mobile"
  - "Mobile hamburger drawer fully removed — no partial state — BottomTabBar is the complete mobile nav replacement"
  - "pb-[72px] lg:pb-6 on main content div to clear 56px bar + 16px breathing room on mobile"
  - "Settings gear icon (lg:hidden) in top bar links to /dashboard/more — consistent mobile access to config hub"
  - "LeadFlyout kept outside card wrapper in leads page to prevent Sheet overlay stacking context issues"

patterns-established:
  - "Card wrapper pattern: each page wraps return in <div className={`${card.base} p-0`} data-tour='X-page'>"
  - "BottomTabBar tab detection: exact=true for /dashboard, startsWith for all sub-routes"

requirements-completed:
  - SETUP-05

# Metrics
duration: 5min
completed: 2026-03-25
---

# Phase 20 Plan 01: Dashboard Layout & Navigation Restructure Summary

**5-tab dashboard navigation with mobile BottomTabBar replacing hamburger drawer, layout card wrapper removed, and page-level card wrappers added to preserve visual appearance**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-25T19:03:33Z
- **Completed:** 2026-03-25T19:08:30Z
- **Tasks:** 3
- **Files modified:** 6 (5 modified, 1 created)

## Accomplishments

- Removed layout-level white card wrapper so each page owns its own card styling (structural foundation for rest of Phase 20)
- Created BottomTabBar.jsx: fixed mobile-only 5-tab bar with 56px height, 48px touch targets, brand colors, safe-area-inset support
- Updated DashboardSidebar: removed mobile hamburger button and mobile drawer entirely; nav now has 5 items (Home, Leads, Calendar, Analytics, More replacing Services+Settings)
- Updated layout.js: expanded breadcrumb support for More sub-pages, added bottom padding for tab bar, mounted BottomTabBar, added mobile Settings gear icon
- Added self-contained card wrappers to leads, analytics, and calendar pages with data-tour attributes for Joyride

## Task Commits

1. **Tasks 1+2: Layout, BottomTabBar, Sidebar** - `bab6d4d` (feat)
2. **Task 3: Card wrappers on leads/analytics/calendar** - `f5edcde` (feat)

## Files Created/Modified

- `src/components/dashboard/BottomTabBar.jsx` — New: mobile-only fixed bottom nav, 5 tabs, h-[56px], lg:hidden
- `src/app/dashboard/layout.js` — Updated: no card wrapper, BottomTabBar mount, expanded breadcrumbs, mobile gear icon, data-tour
- `src/components/dashboard/DashboardSidebar.jsx` — Updated: 5 nav items, no mobile drawer/hamburger, data-tour="sidebar-nav"
- `src/app/dashboard/leads/page.js` — Updated: card.base wrapper on all return paths, data-tour="leads-page"
- `src/app/dashboard/analytics/page.js` — Updated: card.base wrapper, data-tour="analytics-page"
- `src/app/dashboard/calendar/page.js` — Updated: card.base wrapper, data-tour="calendar-page"

## Decisions Made

- Layout removes card wrapper entirely — plan 02 (home page) and plan 05 (More sub-pages) will each control their own card styling without layout interference
- BottomTabBar tab active state: `pathname === tab.href` for exact (/dashboard home), `pathname.startsWith(tab.href)` for all sub-routes including /dashboard/more/*
- Mobile hamburger drawer removed completely (no conditional show/hide) — BottomTabBar is the sole mobile nav
- LeadFlyout kept outside the card wrapper — prevents Sheet overlay stacking context bug (established Phase 04 decision preserved)
- Settings gear icon added to mobile top bar as direct access to More hub without requiring bottom tab navigation (D-10)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Worktree vs project root: this execution writes to the git worktree at `.claude/worktrees/agent-a0169d71/` rather than the main project root. All file writes targeted the worktree path correctly.

## Known Stubs

None — all changes are structural. No hardcoded empty values or placeholder data. The `/dashboard/more` route does not exist yet (will be created in Plan 05) but the navigation links to it correctly.

## Next Phase Readiness

- Plan 02 (Home page adaptive states) can proceed — layout card wrapper is removed, home page renders without double-card
- Plan 03 (Setup checklist redesign) can proceed — no layout changes needed
- Plan 04 (Joyride tour) can proceed — data-tour attributes are in place on all major sections
- Plan 05 (More sub-pages) can proceed — /dashboard/more route is linked but not yet implemented

---
*Phase: 20-dashboard-ux-overhaul*
*Completed: 2026-03-25*

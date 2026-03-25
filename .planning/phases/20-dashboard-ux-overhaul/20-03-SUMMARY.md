---
phase: 20-dashboard-ux-overhaul
plan: 03
subsystem: ui
tags: [next.js, tailwind, react, dashboard, checklist, adaptive-layout, framer-motion]

# Dependency graph
requires:
  - phase: 20-01
    provides: "5-tab nav structure, layout card wrapper removed, data-tour attributes"
  - phase: 20-02
    provides: "More sub-pages with correct hrefs for checklist items"
provides:
  - "Redesigned SetupChecklist.jsx with required/recommended split and conic-gradient progress ring"
  - "Redesigned ChecklistItem.jsx with expand/collapse, type badges, description, action link"
  - "Adaptive dashboard/page.js: setup mode (checklist hero) vs active mode (command center)"
  - "onDataLoaded callback for setup state sharing without double-fetch"
affects:
  - 20-04 (Joyride tour — data-tour attributes are in place on home page and hero metric)
  - Any component that renders SetupChecklist — now accepts onDataLoaded prop

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "onDataLoaded callback pattern for lifting checklist state to parent without double-fetch"
    - "ITEM_TYPE / ITEM_DESCRIPTION frontend classification maps — no API change required"
    - "conic-gradient progress ring: two-segment (required=orange, recommended=stone) with donut cutout"
    - "Adaptive page pattern: single component with setup/active branch based on isSetupComplete"
    - "Appointments API absent — graceful fallback with null nextAppointment, no crash"

key-files:
  created: []
  modified:
    - src/components/dashboard/SetupChecklist.jsx
    - src/components/dashboard/ChecklistItem.jsx
    - src/app/dashboard/page.js

key-decisions:
  - "ITEM_TYPE classification is frontend-only — no API changes; setup-checklist API returns same shape as before"
  - "onDataLoaded callback used to lift checklist data to page — avoids double-fetching /api/setup-checklist"
  - "isSetupComplete derived from REQUIRED_IDS array (4 items) — setup mode shown until all 4 are complete"
  - "Appointments API does not exist yet — nextAppointment hardcoded to null with 'No upcoming appointments' fallback; no crash"
  - "WelcomeBanner removed from page.js import and usage — replaced by setup mode checklist hero"
  - "Tour button (Take a quick tour) shows only if gsd_has_seen_tour not set in localStorage"

# Metrics
duration: ~12min
completed: 2026-03-25
---

# Phase 20 Plan 03: Checklist Redesign and Adaptive Home Page Summary

**Required/recommended checklist with expandable items and conic-gradient progress ring; dashboard home adapts between setup-hero mode and active command center based on required setup completion**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-03-25T19:03:00Z
- **Completed:** 2026-03-25T19:15:26Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- SetupChecklist.jsx redesigned: ITEM_TYPE/ITEM_DESCRIPTION classification maps, conic-gradient ProgressRing component showing required (orange) and recommended (stone) segments, Required/Recommended section headers, onDataLoaded callback for parent state sharing
- ChecklistItem.jsx redesigned: expand/collapse with AnimatePresence + framer-motion height animation, Required (orange) / Recommended (gray) type badges, description text and action Link in expanded state, min-h-[44px] touch target, useReducedMotion support
- dashboard/page.js fully rewritten: setup mode (checklist hero + AI status + tour button) and active mode (hero metric, action-required card, next appointment card, this-week summary card, recent activity capped at 5)
- WelcomeBanner import and usage removed entirely
- All active mode cards use card.base from design tokens
- data-tour="home-page" and data-tour="hero-metric" attributes in place for Plan 04 Joyride

## Task Commits

1. **Task 1: Redesign SetupChecklist and ChecklistItem** - `6994375` (feat)
2. **Task 2: Rewrite adaptive dashboard home page** - `904f024` (feat)

## Files Created/Modified

- `src/components/dashboard/SetupChecklist.jsx` — Redesigned with ITEM_TYPE/ITEM_DESCRIPTION maps, ProgressRing (conic-gradient), Required/Recommended sections, onDataLoaded callback
- `src/components/dashboard/ChecklistItem.jsx` — Redesigned with expand/collapse, AnimatePresence, type badges, description prop, action Link
- `src/app/dashboard/page.js` — Fully rewritten with setup/active adaptive modes, REQUIRED_IDS, isSetupComplete derivation, WelcomeBanner removed

## Decisions Made

- ITEM_TYPE classification is frontend-only — no API changes needed; setup-checklist API returns same shape
- onDataLoaded callback pattern used to lift checklist data to page without double-fetching
- isSetupComplete derives from REQUIRED_IDS (create_account, setup_profile, configure_services, make_test_call) — 4 required items must all be complete
- Appointments API does not yet exist — nextAppointment set to null with graceful fallback text
- WelcomeBanner component file retained but no longer imported or used in page.js
- Tour button shows until gsd_has_seen_tour is set in localStorage (Plan 04 Joyride will use this)

## Deviations from Plan

### Pre-existing Issue (Out of Scope)

**`@sentry/nextjs` missing package — build fails**
- Found during: Task 2 verification (npm run build)
- This is a pre-existing issue unrelated to this plan's changes (confirmed: error exists in commits before this plan)
- Scope: instrumentation.js and sentry.server.config.js reference @sentry/nextjs which is not installed
- Action: Not fixed — out of scope per deviation scope boundary rule. Logged to deferred-items.

## Known Stubs

- **Next Appointment card** — always shows "No upcoming appointments" because `/api/appointments` route does not exist yet. This is by design (plan spec says: "If it does not exist, skip the appointments fetch entirely and render the Next Appointment card with a fallback"). A future plan will create the appointments API and wire the card.

## Self-Check: PASSED

- FOUND: src/components/dashboard/SetupChecklist.jsx (ITEM_TYPE, conic-gradient, Required/Recommended sections)
- FOUND: src/components/dashboard/ChecklistItem.jsx (AnimatePresence, expanded state, Required badge, Recommended badge, description prop)
- FOUND: src/app/dashboard/page.js (REQUIRED_IDS, isSetupComplete, card.base, AI Receptionist, Action Required, Next Appointment, This Week, slice(0,5), data-tour, no WelcomeBanner)
- FOUND: commit 6994375 (feat: redesign SetupChecklist and ChecklistItem)
- FOUND: commit 904f024 (feat: rewrite adaptive dashboard home page)

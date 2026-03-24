---
phase: 07-unified-signup-and-onboarding-wizard
plan: 01
subsystem: auth, ui
tags: [nextjs, middleware, supabase, sessionstorage, css-animations, onboarding]

# Dependency graph
requires:
  - phase: 02-onboarding-wizard
    provides: Existing middleware pattern with createServerClient cookie handling

provides:
  - Rewritten middleware with AUTH_REQUIRED_PATHS and onboarding_complete routing
  - 5-step onboarding layout with aria-progressbar and step counter
  - useWizardSession hook with gsd_onboarding_ prefix and clearWizardSession
  - Celebration animation CSS keyframes (draw-in, radial-pulse) with reduced-motion guard
  - /auth/signin simplified to a permanent redirect to /onboarding
  - OAuth callback defaults to /onboarding/profile (step 2)
affects:
  - 07-02-PLAN
  - 07-03-PLAN
  - 07-04-PLAN

# Tech tracking
tech-stack:
  added: []
  patterns:
    - AUTH_REQUIRED_PATHS array pattern — single source of truth for protected sub-routes
    - gsd_onboarding_ prefix for sessionStorage keys — avoids collisions across apps
    - Lazy onboarding_complete DB query — only on /onboarding paths, never /dashboard (latency optimization)

key-files:
  created:
    - src/hooks/useWizardSession.js
  modified:
    - src/middleware.js
    - src/app/onboarding/layout.js
    - src/app/auth/signin/page.js
    - src/app/auth/callback/route.js
    - src/app/globals.css

key-decisions:
  - "AUTH_REQUIRED_PATHS guards wizard sub-paths and dashboard; /onboarding itself is public (it is the auth step)"
  - "Middleware only queries onboarding_complete on /onboarding paths, not /dashboard — avoids unnecessary DB latency on every dashboard page load"
  - "useWizardSession uses gsd_onboarding_ prefix for sessionStorage key isolation"
  - "clearWizardSession bulk-removes all gsd_onboarding_ keys on wizard completion"
  - "/auth/signin replaced with a pure server redirect — no client component needed"
  - "OAuth callback default changed to /onboarding/profile so Google users skip step 1 (auth is already done)"

patterns-established:
  - "Pattern: Middleware AUTH_REQUIRED_PATHS array — add future protected paths here"
  - "Pattern: useWizardSession(key, defaultValue) returns [value, setValue] like useState; persists to sessionStorage"
  - "Pattern: prefers-reduced-motion guard wraps all animation utility classes in globals.css"

requirements-completed: [WIZARD-03, WIZARD-05, WIZARD-07]

# Metrics
duration: 15min
completed: 2026-03-22
---

# Phase 7 Plan 01: Unified Wizard Foundation Summary

**Middleware rewritten to allow unauthenticated access to /onboarding step 1, 5-step layout with ARIA progressbar, useWizardSession sessionStorage hook, and celebration keyframes for step 5 overlay**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-22T10:31:21Z
- **Completed:** 2026-03-22T10:46:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Middleware completely rewritten: unauthenticated users can access /onboarding (step 1 is public), auth-required paths redirect to /onboarding instead of /auth/signin, onboarding_complete check redirects completed users to /dashboard
- Onboarding layout updated from 3-step to 5-step (profile/services/contact/test-call added) with correct progress percentages and ARIA progressbar attributes
- New useWizardSession hook provides sessionStorage persistence with gsd_onboarding_ prefix and bulk-clear function for wizard completion
- draw-in and radial-pulse CSS keyframes added with prefers-reduced-motion guard — ready for Plan 04 CelebrationOverlay
- /auth/signin converted from full client component to 2-line server redirect
- OAuth callback default changed from /onboarding to /onboarding/profile

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite middleware + update auth redirect pages** - `634fe23` (feat)
2. **Task 2: Update layout to 5 steps + create useWizardSession hook + add celebration CSS keyframes** - `b5965e5` (feat)

## Files Created/Modified
- `src/middleware.js` - Rewritten routing with AUTH_REQUIRED_PATHS, onboarding_complete checks, /dashboard latency optimization
- `src/app/auth/signin/page.js` - Replaced with 2-line server redirect to /onboarding
- `src/app/auth/callback/route.js` - Default next changed to /onboarding/profile
- `src/app/onboarding/layout.js` - 5-step getStep(), /5 progress calc, aria-progressbar attributes
- `src/hooks/useWizardSession.js` - New: useWizardSession hook + clearWizardSession export
- `src/app/globals.css` - draw-in, radial-pulse keyframes + animate-* utility classes with reduced-motion guard

## Decisions Made
- Middleware only queries `onboarding_complete` on `/onboarding` paths, never on `/dashboard` — avoids a DB round-trip on every dashboard page load (latency optimization per RESEARCH.md Pitfall 1)
- `/auth/signin` is now a pure server component redirect — no `'use client'` needed since there's no interactive form
- OAuth callback default changed to `/onboarding/profile` because OAuth users complete step 1 (auth) via Google, so they should land on step 2

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - all acceptance criteria met, build passes (228 tests pass, next build completes without errors).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Foundation complete: Plans 02-04 can build wizard step pages on top of middleware routing, layout shell, and session persistence hook
- /onboarding/profile, /onboarding/services, /onboarding/contact, /onboarding/test-call routes need page components (Plans 02-04)
- Celebration overlay in Plan 04 can use the draw-in and radial-pulse keyframes now in globals.css

---
*Phase: 07-unified-signup-and-onboarding-wizard*
*Completed: 2026-03-22*

---
phase: 29-hero-section-interactive-demo
plan: 01
subsystem: ui
tags: [react, framer-motion, animation, landing-page, rotating-text]

# Dependency graph
requires:
  - phase: 11-landing-page-redesign
    provides: RotatingText component and HeroSection base implementation
provides:
  - RotatingText with dynamic width animation (useRef + getBoundingClientRect)
  - HeroSection with updated copy and placeholder for demo input
affects:
  - 29-03 (HeroDemoInput wiring into placeholder div)
  - 29-04 (full demo pipeline integration)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - useLayoutEffect + getBoundingClientRect for dynamic width measurement on animated text
    - CSS transition-[width] with Tailwind for smooth container width animation

key-files:
  created: []
  modified:
    - src/app/components/landing/RotatingText.jsx
    - src/app/components/landing/HeroSection.jsx

key-decisions:
  - "RotatingText measures current word width (not longest) via measureRef + getBoundingClientRect on each currentIndex change"
  - "HeroSection stripped to minimum: h1, subtitle, placeholder div — no eyebrow/CTA/social proof (cleaner focus for demo input)"

patterns-established:
  - "Pattern 1: containerRef receives inline width style from useLayoutEffect after getBoundingClientRect measurement on measureRef"
  - "Pattern 2: prefersReducedMotion guard skips width update in useLayoutEffect to respect accessibility preference"

requirements-completed: [DEMO-04, DEMO-01]

# Metrics
duration: 3min
completed: 2026-03-26
---

# Phase 29 Plan 01: RotatingText Dynamic Width + Hero Copy Update Summary

**RotatingText rewritten to animate container width to the current word via useRef/getBoundingClientRect, and HeroSection stripped to new 'Every Missed Call' headline with demo input placeholder**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-26T09:11:02Z
- **Completed:** 2026-03-26T09:13:30Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- RotatingText now dynamically sizes its container to the currently displayed word with a 200ms CSS width transition
- Replaced the longest-word invisible sizer with a current-word measurement span using useRef + getBoundingClientRect
- HeroSection headline changed from "Every Call You Miss" to "Every Missed Call Is a Job Your {Competitor|Rival|Neighbor} Just Booked"
- Removed eyebrow pill, CTA button block (AuthAwareCTA + Watch Demo), and social proof row from HeroSection
- Added placeholder div for Plan 04 HeroDemoInput wiring
- Build passes with no import errors after removing AuthAwareCTA, Button, Link, and Phone imports

## Task Commits

Each task was committed atomically:

1. **Task 1: RotatingText dynamic width via useRef + getBoundingClientRect** - `f102cb4` (feat)
2. **Task 2: Update HeroSection copy and remove old CTA block** - `c50266f` (feat)

## Files Created/Modified
- `src/app/components/landing/RotatingText.jsx` - Added containerRef/measureRef, useLayoutEffect for width measurement, transition-[width] CSS class on outer span
- `src/app/components/landing/HeroSection.jsx` - New h1 copy, new subtitle, removed eyebrow/CTA/social proof, added demo input placeholder

## Decisions Made
- Rotating words changed from `['Competitor', 'Revenue', 'Customer']` to `['Competitor', 'Rival', 'Neighbor']` — all 8 chars ensures smooth RotatingText width transitions with minimal delta
- measureRef renders `texts[currentIndex]` (not longest word) so the container tracks the actual displayed word

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- RotatingText width animation is ready for use across the site
- HeroSection placeholder div (`mt-8 pointer-events-auto`) is wired in, ready for Plan 04 HeroDemoInput insertion
- Build is clean, no broken imports

---
*Phase: 29-hero-section-interactive-demo*
*Completed: 2026-03-26*

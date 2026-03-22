---
phase: 07-unified-signup-and-onboarding-wizard
plan: 02
subsystem: ui
tags: [supabase, auth, otp, onboarding, wizard, react, shadcn, lucide]

# Dependency graph
requires:
  - phase: 07-01
    provides: useWizardSession hook, onboarding layout, middleware routing, AnimatedSection/AnimatedStagger/AnimatedItem

provides:
  - /onboarding page: Google OAuth + email+password signup + inline OTP verification (Step 1)
  - /onboarding/profile page: trade selector + business name + tone preset (Step 2)
  - OtpInput component: 6-digit auto-advance inputs with ARIA, paste support, cooldown
  - TradeSelector component: TRADE_TEMPLATES radio card grid with Lucide icons

affects:
  - 07-03 (services step — profile page routes to /onboarding/services)
  - 07-04 (contact step — wizard flow continues)
  - 07-05 (test call finale — wizard flow continues)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Inline OTP phase using local state toggle (no page navigation) — avoids route flicker, UX stays in wizard card
    - Two-step API call pattern for /api/onboarding/start — business info first (creates tenant), trade+services second (depends on tenant existing)
    - useWizardSession for all multi-step form persistence — sessionStorage with gsd_onboarding_ prefix
    - Conditional reveal — business name + tone preset section only renders after trade is selected

key-files:
  created:
    - src/app/onboarding/profile/page.js
    - src/components/onboarding/OtpInput.js
    - src/components/onboarding/TradeSelector.js
  modified:
    - src/app/onboarding/page.js (replaced business name form with full auth page)

key-decisions:
  - "Step 1 OTP phase transforms in-place (state toggle, not router.push) — preserves AnimatedSection context and avoids route re-render"
  - "shouldCreateUser: false on signInWithOtp — prevents duplicate user creation when OTP sent post-signUp"
  - "Two sequential API calls to /api/onboarding/start in Step 2 — not parallel; second call (trade+services) depends on tenant row created by first call"
  - "TONE_PRESETS defined inline in profile/page.js — decoupled from translation keys, plain English labels for new wizard"

patterns-established:
  - "Pattern 1: OtpInput uses uncontrolled inputs (inputsRef) for direct DOM manipulation — avoids React re-render lag on each keystroke"
  - "Pattern 2: TradeSelector wraps AnimatedStagger so trade cards animate in on mount — consistent with rest of wizard"
  - "Pattern 3: Conditional section reveal (trade && (...)) — simple and readable, no animation required for correctness"

requirements-completed: [WIZARD-01, WIZARD-02, WIZARD-04]

# Metrics
duration: 5min
completed: 2026-03-22
---

# Phase 7 Plan 02: Unified Signup and Onboarding Wizard (Steps 1-2) Summary

**Google OAuth + email+password signup with inline OTP verification at /onboarding, plus trade-selector + business-name + tone-preset combined into /onboarding/profile**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-22T10:37:54Z
- **Completed:** 2026-03-22T10:42:44Z
- **Tasks:** 2
- **Files modified:** 4 (1 modified, 3 created)

## Accomplishments

- /onboarding now serves as the auth entry point: Google OAuth + email+password signup (with inline OTP verification) + returning-user sign-in toggle
- OtpInput component: 6-digit auto-advance, backspace navigation, paste distribution, 30s resend cooldown, full ARIA attributes
- /onboarding/profile consolidates three previously separate concepts (trade selection, business name, tone preset) into a single wizard step
- TradeSelector renders all 4 TRADE_TEMPLATES as interactive radio cards (Lucide icon + label) in a 2/3-column grid

## Task Commits

Each task was committed atomically:

1. **Task 1: Build Step 1 Create Account page with Google OAuth, email/password, and inline OTP** - `04f1b62` (feat)
2. **Task 2: Build Step 2 Business Profile page with TradeSelector, business name, and tone preset** - `621478f` (feat)

## Files Created/Modified

- `src/app/onboarding/page.js` — Replaced old business-name form with full auth page (Google OAuth, email+password, OTP inline phase)
- `src/components/onboarding/OtpInput.js` — 6-digit OTP component with auto-advance, paste, backspace, ARIA
- `src/app/onboarding/profile/page.js` — New Step 2: trade grid, conditional business name + tone preset, two API calls to /api/onboarding/start
- `src/components/onboarding/TradeSelector.js` — Radio card grid using TRADE_TEMPLATES, Lucide trade icons, AnimatedStagger wrapper

## Decisions Made

- OTP phase uses `useState` toggle (not `router.push`) to keep the user in the same wizard card — avoids layout re-mount and progress bar flicker
- `shouldCreateUser: false` on `signInWithOtp` call after `signUp` — prevents Supabase from creating a duplicate auth user (per RESEARCH.md Pitfall 2)
- Two sequential POST calls to `/api/onboarding/start` in Step 2: first creates the tenant row with business_name + tone_preset; second saves trade_type + services which requires the tenant to exist
- TONE_PRESETS defined inline in profile page with plain English labels rather than next-intl translation keys — this wizard is English-first, translation can be added later

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- A prior `next build` process was still running when verification started. Terminated stale Node processes before re-running — build completed cleanly on second attempt.

## Next Phase Readiness

- /onboarding and /onboarding/profile are complete and tested via build
- /onboarding/services (Step 3) already exists as a route — Plan 07-03 will review and connect it to the new profile step's sessionStorage state
- SessionStorage keys (gsd_onboarding_trade, gsd_onboarding_business_name, gsd_onboarding_tone_preset) are written on Step 2 — available for Step 3 pre-population

---
*Phase: 07-unified-signup-and-onboarding-wizard*
*Completed: 2026-03-22*

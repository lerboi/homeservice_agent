---
phase: 25-enforcement-gate-and-billing-dashboard
plan: 02
subsystem: ui
tags: [stripe, billing, svg, react, supabase, shadcn, tailwind]

# Dependency graph
requires:
  - phase: 22-billing-foundation
    provides: subscriptions table schema, stripe customer portal route, billing infrastructure
  - phase: 23-usage-tracking
    provides: calls_used/calls_limit fields on subscriptions, overage tracking
  - phase: 24-subscription-lifecycle-and-notifications
    provides: BillingWarningBanner pattern, dashboard layout banner slot, past_due handling

provides:
  - UsageRingGauge: SVG donut ring gauge component with brand orange fill and amber overage arc
  - TrialCountdownBanner: sticky dashboard banner for trialing users with info/urgent states
  - BillingPage: full billing dashboard at /dashboard/more/billing with 4 sections
  - Billing entry in More menu (CreditCard icon, between Notifications and AI & Voice Settings)
  - breadcrumb label for /dashboard/more/billing

affects: [dashboard-crm-system, 25-03-enforcement-gate, billing-documentation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Pure SVG donut ring gauge with stroke-dasharray/dashoffset animation and prefers-reduced-motion support
    - Exported pure calculation functions from client components for unit testing without JSX environment
    - Parallel Supabase + fetch() data loading in useEffect with unified loading/error state

key-files:
  created:
    - src/components/dashboard/UsageRingGauge.js
    - src/app/dashboard/TrialCountdownBanner.js
    - src/app/dashboard/more/billing/page.js
    - tests/billing/trial-countdown.test.js
  modified:
    - src/app/dashboard/layout.js
    - src/app/dashboard/more/page.js

key-decisions:
  - "Pure SVG implementation for UsageRingGauge (no external library) — consistent with existing SVG animation patterns in globals.css"
  - "Overage arc capped at 50% additional visual arc to prevent ring from wrapping more than 1.5x — per UI-SPEC Pitfall 8"
  - "calculateTrialDaysRemaining and getTrialBannerState exported as named functions for unit testing in node environment (no JSX)"
  - "TrialCountdownBanner and BillingWarningBanner are mutually exclusive by status — no coordination needed"
  - "Billing page uses parallel Promise.all for subscription + invoices fetch — reduces perceived load time"

patterns-established:
  - "SVG ring gauge: viewBox 0 0 120 120, radius 50, strokeWidth 10, rotate(-90 60 60) for 12-oclock start"
  - "Banner pattern: sticky top-0 z-39 h-11 flex items-center justify-between px-4 lg:px-8 (matches BillingWarningBanner)"
  - "Export pure calculation functions from client components for isolated unit testing"

requirements-completed: [BILLUI-01, BILLUI-02]

# Metrics
duration: 5min
completed: 2026-03-28
---

# Phase 25 Plan 02: Billing Dashboard Summary

**Animated SVG usage ring gauge, trial countdown banner with info/urgent states, and full 4-section billing dashboard page wired into dashboard layout and More menu**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-28T20:59:33Z
- **Completed:** 2026-03-28T21:03:47Z
- **Tasks:** 2
- **Files modified:** 6 (4 created, 2 modified)

## Accomplishments
- Created `UsageRingGauge` SVG component with brand orange fill arc, amber overage arc (capped at 50% additional), mount animation with prefers-reduced-motion support, and full accessibility attributes
- Created `TrialCountdownBanner` with blue info state (>3 days) and amber urgent state (<=3 days), exported pure calculation functions for unit testing, all 8 TDD tests pass
- Created billing page at `/dashboard/more/billing` with 4 sections: plan card (status badge + cancel warning), usage meter, billing details (renewal date + manage subscription), and invoice table with empty/error states
- Wired TrialCountdownBanner into dashboard layout alongside BillingWarningBanner (mutually exclusive by status)
- Added Billing entry to More menu between Notifications and AI & Voice Settings with CreditCard icon
- Added `billing: 'Billing'` to BREADCRUMB_LABELS for proper breadcrumb display

## Task Commits

Each task was committed atomically:

1. **Task 1: UsageRingGauge, TrialCountdownBanner, and layout wiring** - `ae2a5c2` (feat)
2. **Task 2: Billing dashboard page with all 4 sections** - `3267506` (feat)

**Plan metadata:** (docs commit - see below)

_Note: Task 1 used TDD flow (tests written inline in test file, verified passing before implementation)_

## Files Created/Modified
- `src/components/dashboard/UsageRingGauge.js` - SVG donut ring gauge with overage visualization, animation, and a11y
- `src/app/dashboard/TrialCountdownBanner.js` - Trial countdown banner with info/urgent states and exported pure functions
- `src/app/dashboard/more/billing/page.js` - Full billing dashboard: plan card, usage meter, billing details, invoices
- `src/app/dashboard/layout.js` - Added TrialCountdownBanner import/render and billing breadcrumb label
- `src/app/dashboard/more/page.js` - Added CreditCard import and Billing entry to MORE_ITEMS
- `tests/billing/trial-countdown.test.js` - 8 tests for calculateTrialDaysRemaining and getTrialBannerState

## Decisions Made
- Pure SVG for UsageRingGauge (no library) — consistent with existing codebase SVG patterns
- Overage arc capped at 50% additional to prevent visual confusion when overage is very large
- Pure calculation functions exported from TrialCountdownBanner for node-env unit testing (no JSX)
- Billing page loads subscription + invoices in parallel via Promise.all to minimize loading time

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Jest `npx jest` command failed with ESM import error — resolved by using `node --experimental-vm-modules` runner matching the project's `"type": "module"` and existing test script pattern.

## User Setup Required
None - no external service configuration required. The billing page reads from the existing subscriptions table and calls the already-implemented `/api/billing/invoices` and `/api/billing/portal` routes.

## Known Stubs
None. All data is fetched from live Supabase subscriptions table and `/api/billing/invoices` API. The billing page will show real subscription data when subscription records exist.

## Next Phase Readiness
- Phase 25-03 (enforcement gate) can proceed — billing page is fully functional
- UsageRingGauge is available for reuse in future dashboard widgets
- Trial countdown banner covers the trialing user experience across all dashboard pages

---
*Phase: 25-enforcement-gate-and-billing-dashboard*
*Completed: 2026-03-28*

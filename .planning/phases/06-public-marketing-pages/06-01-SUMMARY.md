---
phase: 06
plan: 01
subsystem: public-marketing-pages
tags: [routing, layout, navigation, footer, pricing-data, test-scaffolds]
dependency_graph:
  requires: []
  provides:
    - "(public) route group layout with shared LandingNav + LandingFooter + Toaster"
    - "Landing page at src/app/(public)/page.js"
    - "Pricing data constants (PRICING_TIERS, COMPARISON_FEATURES, getAnnualPrice)"
    - "Wave 0 test scaffolds for pricing calc (GREEN) and contact API (RED)"
  affects:
    - "All plans in Phase 6 (depend on (public) layout)"
    - "src/app/components/landing/LandingNav.jsx (extended)"
    - "src/app/components/landing/LandingFooter.jsx (expanded)"
tech_stack:
  added: []
  patterns:
    - "Next.js route group (public) — parenthesized name does not affect URL"
    - "LandingNav extends to 5-link desktop nav + Framer Motion mobile drawer"
    - "isRoot pattern for anchor link routing from sub-pages"
    - "Wave 0 test scaffold: RED tests that will pass when route is implemented"
key_files:
  created:
    - src/app/(public)/layout.js
    - src/app/(public)/page.js
    - src/app/(public)/pricing/pricingData.js
    - tests/pricing/pricing-calc.test.js
    - tests/contact/contact-api.test.js
  modified:
    - src/app/components/landing/LandingNav.jsx
    - src/app/components/landing/LandingFooter.jsx
  deleted:
    - src/app/page.js
decisions:
  - "[Phase 06-01]: (public) route group layout wraps all public pages — LandingNav and LandingFooter are not rendered inline in page components but via the layout"
  - "[Phase 06-01]: isRoot pattern (pathname === '/') for anchor links (#how-it-works, #features) — href from sub-pages prefixed with / to navigate back to root then scroll"
  - "[Phase 06-01]: Wave 0 contact-api.test.js intentionally RED — stub for Plan 06-03 API route implementation"
metrics:
  duration: "~6 minutes"
  completed_date: "2026-03-22"
  tasks_completed: 3
  tasks_total: 3
  files_created: 5
  files_modified: 2
  files_deleted: 1
  tests_added: 15
  tests_passing: 7
  tests_red_scaffold: 8
---

# Phase 6 Plan 01: Public Marketing Foundation Summary

**One-liner:** (public) route group with extended 5-link nav + mobile drawer, multi-column footer, pricing data constants, and Wave 0 test scaffolds.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create (public) route group layout + migrate landing page + pricing data | 62a7646 | src/app/(public)/layout.js, src/app/(public)/page.js, src/app/(public)/pricing/pricingData.js (deleted src/app/page.js) |
| 2 | Extend LandingNav + expand LandingFooter | af437ba | src/app/components/landing/LandingNav.jsx, src/app/components/landing/LandingFooter.jsx |
| 3 | Wave 0 test scaffolds (TDD) | b895a80 | tests/pricing/pricing-calc.test.js, tests/contact/contact-api.test.js |

## What Was Built

### (public) Route Group

Created `src/app/(public)/layout.js` as a Server Component that wraps all public pages with `LandingNav`, `LandingFooter`, and a `Toaster` provider. The parenthesized route group name does not affect URLs — `src/app/(public)/page.js` serves `/` exactly as `src/app/page.js` did.

The landing page was migrated to `src/app/(public)/page.js` with `LandingNav` and `LandingFooter` removed from the page component (the layout now handles them). The old `src/app/page.js` was deleted.

### Extended LandingNav

The nav was fully rewritten to preserve all existing behavior while adding:
- 5 desktop links: How it works, Features, Pricing, About, Contact
- Anchor links use `isRoot` (pathname === '/') — on root page, `href="#hash"`; on sub-pages, `href="/#hash"` to navigate back and scroll
- Mobile hamburger (Lucide `<Menu>`/`<X>`) with 44px touch target, `aria-expanded`, `aria-label`
- Framer Motion AnimatePresence slide-in drawer from right (250ms ease-out) with dark overlay
- Drawer closes on route change (`useEffect` on pathname) and locks body scroll when open
- CTA button pinned to drawer bottom (full-width Heritage Copper)

### Expanded LandingFooter

Replaced single-row layout with three-column grid (Product, Company, Legal). Logo + tagline "Every call answered. Every job booked." above columns. Copyright line below.

### Pricing Data Constants

`src/app/(public)/pricing/pricingData.js` exports:
- `PRICING_TIERS` — 4 tiers (Starter $99, Growth $249 "Most Popular", Scale $599, Enterprise custom)
- `COMPARISON_FEATURES` — 14-row feature matrix across all tiers
- `getAnnualPrice(monthlyPrice)` — returns `Math.round(monthlyPrice * 0.8)` or null for Enterprise

### Wave 0 Test Scaffolds

- `tests/pricing/pricing-calc.test.js` — 7 tests, all GREEN. Validates annual price calculation and PRICING_TIERS data integrity.
- `tests/contact/contact-api.test.js` — 8 tests, intentionally RED. Stubs for the contact API route to be implemented in Plan 06-03. Tests honeypot spam protection, field validation, inquiry type routing, and replyTo behavior.

## Verification

- Next.js build: clean (0 errors, 1 pre-existing warning from Turbopack)
- Pricing tests: 7/7 passing
- Contact API tests: 8/8 RED (intentional Wave 0 scaffold)
- Full existing suite: 220/220 passing (no regressions)
- Old `src/app/page.js` confirmed deleted
- `getAnnualPrice(249)` returns 199 (Math.round(249 * 0.8) = Math.round(199.2) = 199)

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

All created files verified present on disk. All 3 task commits confirmed in git log (62a7646, af437ba, b895a80).

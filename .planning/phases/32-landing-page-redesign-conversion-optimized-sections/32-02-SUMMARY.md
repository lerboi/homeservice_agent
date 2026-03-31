---
phase: 32-landing-page-redesign-conversion-optimized-sections
plan: "02"
subsystem: landing-page
tags: [features-grid, micro-visuals, conversion, mobile-scroll-snap]
dependency_graph:
  requires: []
  provides: [FeaturesGrid]
  affects: [src/app/(public)/page.js]
tech_stack:
  added: []
  patterns: [inline-svg-css-micro-visuals, horizontal-scroll-snap, prefers-reduced-motion-gating]
key_files:
  modified:
    - src/app/components/landing/FeaturesGrid.jsx
decisions:
  - Full-width language hero card placed at top of 2-col grid using md:col-span-2 for visual hierarchy
  - Mobile scroll-snap implemented via Tailwind arbitrary value [scroll-snap-type:x_mandatory] + [scroll-snap-align:center] — no extra dependencies
  - All 7 CSS keyframe animations wrapped in prefers-reduced-motion: no-preference media query for accessibility compliance
  - microValue bottom-of-card statements added only to first 2 feature cards where they materially strengthen the value proposition
metrics:
  duration: ~15min
  completed: "2026-04-01"
  tasks_completed: 1
  tasks_total: 1
  files_changed: 1
---

# Phase 32 Plan 02: Features Grid Rewrite Summary

2-col staggered FeaturesGrid with full-width 70+ Languages hero card, 6 uniform feature cards, and 7 inline SVG/CSS micro visuals replacing the old 5-card asymmetric bento grid.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Rewrite FeaturesGrid — section heading, grid layout, language hero card, 6 feature cards, 7 micro visuals | d3d1fd9 | src/app/components/landing/FeaturesGrid.jsx |

## What Was Built

**FeaturesGrid.jsx** fully rewritten (347 additions, 189 deletions):

- **Section heading:** Pain-point-first — "Every feature built to turn missed calls into money." with eyebrow "Built for the trades" in brand orange.
- **Grid layout:** Desktop 2-column grid (`md:grid-cols-2`). Mobile: horizontal `overflow-x-auto` flex container with `[scroll-snap-type:x_mandatory]`.
- **Language hero card:** Full-width (`md:col-span-2`) card with Globe icon, "70+ Languages. Zero Frustration." heading, description, "Powered by Gemini 3.1 Flash Live" caption, and `LanguageHeroVisual` animated floating bubble component.
- **6 feature cards:** Uniform cards for 24/7 AI Answering, Real-Time Calendar Booking, Post-Call SMS & Notifications, Call Analytics & Dashboard, Lead Capture & CRM, Google & Outlook Calendar Sync.
- **7 inline micro visual components:**
  1. `LanguageHeroVisual` — floating EN/ES/ZH/MS/70+ bubbles with `langFloat` CSS keyframes
  2. `AnsweringVisual` — SVG clock with animated stroke-dashoffset arc + "24/7 ACTIVE" badge
  3. `BookingVisual` — mini calendar grid with booked (orange fill) + locked (orange border) day indicators
  4. `SMSVisual` — stacked notification cards representing post-call SMS confirmations
  5. `AnalyticsVisual` — mini bar chart with accent orange on tallest bar + `barGrow` entry animation
  6. `LeadVisual` — mini lead card showing caller name, address, job type, EMERGENCY urgency badge
  7. `CalSyncVisual` — inline SVG calendar icons with bidirectional orange/slate sync arrows

## Decisions Made

- **Mobile scroll-snap via Tailwind arbitrary values** — `[scroll-snap-type:x_mandatory]` on container + `[scroll-snap-align:center]` on each card. No additional packages needed.
- **microValue statements on 2 of 6 cards** — Added only to 24/7 Answering ("One emergency booking at 2 AM covers your entire month") and Calendar Booking ("Booked means committed — leads don't cool off") where the revenue angle is strongest. Omitted from Analytics/Lead/CalSync to avoid card height bloat.
- **Pre-existing build failure not introduced by this plan** — `npm run build` surfaces a `prettier/standalone` resolution error in `@react-email/render` affecting unrelated API routes. No FeaturesGrid-related build errors.

## Deviations from Plan

None — plan executed exactly as written. All acceptance criteria met.

## Known Stubs

None. All 7 cards have complete copy, icons, and inline micro visuals. No placeholder text or TODO comments.

## Self-Check: PASSED

- `src/app/components/landing/FeaturesGrid.jsx` — FOUND
- Commit d3d1fd9 — FOUND
- `grep -c "function.*Visual"` returns 7 — CONFIRMED
- `grep "md:col-span-2"` matches language hero card AnimatedItem — CONFIRMED
- `grep "70+"` matches hero card title and bubble label — CONFIRMED
- `grep "scroll-snap"` matches container class string — CONFIRMED
- `grep "prefers-reduced-motion"` returns 3 matches (LanguageHeroVisual, AnsweringVisual, AnalyticsVisual) — CONFIRMED
- `grep "backdrop-blur\|canvas\|Lottie"` returns empty — CONFIRMED

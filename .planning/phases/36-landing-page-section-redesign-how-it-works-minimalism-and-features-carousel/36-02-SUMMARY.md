---
phase: 36-landing-page-section-redesign-how-it-works-minimalism-and-features-carousel
plan: 02
subsystem: landing-page
tags: [carousel, features, landing-page, animation, css-scroll-snap]
dependency_graph:
  requires: []
  provides:
    - FeaturesCarousel component at src/app/components/landing/FeaturesCarousel.jsx
    - Updated page.js with FeaturesCarousel replacing FeaturesGrid
  affects:
    - src/app/(public)/page.js
    - ScrollLinePath wrapping (section heights changed)
tech_stack:
  added: []
  patterns:
    - CSS scroll-snap carousel (no external library)
    - IntersectionObserver for activeIndex sync on swipe
    - setInterval auto-advance with pause-on-interaction via clearInterval + setTimeout
    - animationPlayState gating for micro visual animations
    - useReducedMotion from framer-motion for accessibility
key_files:
  created:
    - src/app/components/landing/FeaturesCarousel.jsx
  modified:
    - src/app/(public)/page.js
decisions:
  - Carried all 7 micro visual functions from FeaturesGrid with isActive prop added; animationPlayState toggling gates all CSS keyframe animations
  - CSS scroll-snap (no external library) — consistent with project's zero-library pattern for carousels
  - IntersectionObserver with root=trackRef and threshold=0.5 syncs activeIndex on swipe without scroll event overhead
  - Auto-advance interval 5000ms; resumes after 8000ms pause following user interaction
  - scrollbar-hide via inline style jsx — avoids Tailwind plugin dependency
  - HowItWorksSection skeleton updated to full-viewport min-h-screen per step to match Phase 36 plan 01 new section height
metrics:
  duration: ~20 minutes
  completed_date: "2026-04-01"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 1
---

# Phase 36 Plan 02: FeaturesCarousel Component Summary

**One-liner:** Horizontal CSS scroll-snap carousel with 7 feature cards, icon nav grid, auto-advance, and micro visual animation gating via isActive prop.

## What Was Built

### FeaturesCarousel.jsx (src/app/components/landing/FeaturesCarousel.jsx)

A `'use client'` component with named export `FeaturesCarousel` implementing:

- **Horizontal carousel** using CSS `scrollSnapType: 'x mandatory'` — no external library
- **7 feature cards** carried from FeaturesGrid: 70+ Languages, 24/7 AI Answering, Real-Time Calendar Booking, Post-Call SMS & Notifications, Call Analytics & Dashboard, Lead Capture & CRM, Google & Outlook Calendar Sync
- **Active card** scaled to `1.04` with orange top border (`border-t-2 border-t-[#F97316]`) at full opacity; peek cards at `0.7` opacity
- **Arrow buttons** (desktop only, `hidden md:flex`) with orange hover state and proper aria-labels
- **Icon nav grid** with 7 icons + text labels; active item shows underline dot (`w-1 h-1 bg-[#F97316]`); mobile horizontally scrollable
- **Auto-advance** every 5000ms via `setInterval`; pauses on user interaction (scroll, arrow click, icon click), restarts after 8000ms
- **IntersectionObserver** with `threshold: 0.5` and `root: trackRef.current` syncs `activeIndex` state on swipe without scroll event listeners
- **Micro visual animation gating** — all 7 visuals accept `{ isActive }` prop; every CSS `animation` property has `animationPlayState: isActive ? 'running' : 'paused'`
- **`useReducedMotion()`** from framer-motion disables auto-advance entirely when user prefers reduced motion
- **Section ID `features`** preserved on outermost `<section>` for ScrollLinePath anchor detection
- **Section heading**: eyebrow "Built for the trades", h2 "Every call handled. Every job captured."
- **WCAG accessibility**: `role="region"` + `aria-label="Features"` on carousel, `aria-label` on all buttons, `aria-hidden="true"` on micro visuals

### page.js (src/app/(public)/page.js)

- **Removed** `FeaturesGrid` dynamic import (0 references remain)
- **Added** `FeaturesCarousel` dynamic import with loading skeleton: `h-[480px]` card placeholder + `h-16` icon nav placeholder
- **Updated** `HowItWorksSection` loading skeleton to full-viewport style: `bg-white` section wrapper + 4 `min-h-screen` step placeholders alternating `bg-white` / `bg-[#FAFAF9]`
- **Preserved** `ScrollLinePath` wrapping order: `HowItWorksSection` → `FeaturesCarousel` → `SocialProofSection`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all 7 feature cards are fully wired with real content and animated micro visuals.

## Verification

- `npm run build` completed without errors
- `grep -c "FeaturesGrid" src/app/(public)/page.js` returns `0`
- `grep -n "id=\"features\""` returns line 453 in FeaturesCarousel.jsx
- `grep -c "isActive"` returns `18` (7 function params + 7 visual usages + 4 card render usages)
- `grep -c "IntersectionObserver"` returns `2` (creation + usage)
- Build output confirms landing page `/` rendered successfully

## Commits

- `e23ec6c` — feat(36-02): create FeaturesCarousel component with CSS scroll-snap, icon nav, auto-advance
- `a3209ed` — feat(36-02): swap FeaturesGrid for FeaturesCarousel in page.js, update skeletons

## Self-Check: PASSED

- [x] `src/app/components/landing/FeaturesCarousel.jsx` exists (581 lines)
- [x] `src/app/(public)/page.js` contains FeaturesCarousel, no FeaturesGrid
- [x] Commits `e23ec6c` and `a3209ed` exist in git log
- [x] Build passes without errors

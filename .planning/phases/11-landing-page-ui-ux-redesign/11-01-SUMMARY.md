---
phase: 11
plan: 01
subsystem: landing-page
tags: [ui, accessibility, framer-motion, tabs, bento-grid]
dependency_graph:
  requires: []
  provides:
    - HowItWorksTabs (client tabbed panel with ARIA + AnimatePresence)
    - HowItWorksSection (Server Component with dynamic import)
    - FeaturesGrid 5th card (Speaks Their Language)
  affects:
    - src/app/(public)/page.js (loading skeletons updated)
tech_stack:
  added: []
  patterns:
    - Server Component shell + dynamic-imported client component (HowItWorksSection/HowItWorksTabs)
    - WAI-ARIA Tabs pattern with roving tabindex
    - AnimatePresence mode=wait with useReducedMotion guard
key_files:
  created:
    - src/app/components/landing/HowItWorksTabs.jsx
  modified:
    - src/app/components/landing/HowItWorksSection.jsx
    - src/app/components/landing/FeaturesGrid.jsx
    - src/app/(public)/page.js
decisions:
  - "HowItWorksTabs uses roving tabindex (tabIndex 0/-1) per WAI-ARIA Tabs authoring pattern — keyboard focus follows active tab"
  - "AnimatePresence mode=wait with key={active} ensures exit animation completes before enter begins — prevents cross-fade overlap"
  - "HowItWorksSection rebuilt as Server Component (no use client) with dynamic import of HowItWorksTabs for bundle splitting"
  - "5th bento card uses variant=default (light card, bg-white) consistent with cards 2 and 3 — dark card anchor is card 1 only"
metrics:
  duration: "~205s"
  completed_date: "2026-03-23"
  tasks_completed: 2
  files_modified: 4
---

# Phase 11 Plan 01: HowItWorks Tab Redesign + 5th Feature Card Summary

**One-liner:** Rebuilt How It Works section from stacked AnimatedItem cards to a fully accessible WAI-ARIA tabbed panel with AnimatePresence transitions, and added the multilingual "Speaks Their Language" 5th bento card.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create HowItWorksTabs client component and rebuild HowItWorksSection | d476117 | HowItWorksTabs.jsx (new), HowItWorksSection.jsx (rebuilt) |
| 2 | Add 5th feature card and update page.js loading skeletons | 8e0cd88 | FeaturesGrid.jsx, page.js |

## What Was Built

**HowItWorksTabs.jsx** — New `'use client'` component implementing the WAI-ARIA Tabs design pattern:
- Three numbered tabs (01, 02, 03) with `role="tablist"` / `role="tab"` / `role="tabpanel"` ARIA attributes
- `aria-selected`, `aria-controls`, `aria-labelledby` on every tab and panel
- Roving tabindex (active tab gets tabIndex=0, others get tabIndex=-1)
- Keyboard navigation: ArrowRight/ArrowLeft (with wrap), Home, End
- `AnimatePresence mode="wait"` with `key={active}` for sequential fade+translate transitions
- 250ms ease-out, 8px vertical translate — `useReducedMotion` guard skips animation entirely
- Panel `min-h-[280px]` prevents height jump between tab changes

**HowItWorksSection.jsx** — Rebuilt as a pure Server Component:
- Removed `AnimatedStagger`, `AnimatedItem` — replaced with `dynamic()` import of HowItWorksTabs
- Loading skeleton: 3 tab placeholder divs + `h-[280px]` panel for zero CLS
- Preserved: same H2 copy, same section structure, same "Start My 5-Minute Setup" CTA button

**FeaturesGrid.jsx** — Added 5th card:
- Added `Globe` import from lucide-react
- 5th feature entry: title "Speaks Their Language", body highlights multi-language capability, justification "Every caller heard. Every job captured.", `md:col-span-2`, `variant: 'default'`
- H2 updated from "Four features" to "Five features. One question:"

**page.js** — Updated loading skeletons:
- HowItWorksSection skeleton: replaced 3x h-32 stacked cards with 3 tab placeholders + `h-[280px]` panel
- FeaturesGrid skeleton: added 5th card placeholder `md:col-span-2 h-40`

## Verification

Build: `npx next build` completed successfully with no errors.

All automated checks passed:
- HowItWorksTabs.jsx: `'use client'`, all ARIA attributes, AnimatePresence, useReducedMotion, key={active}
- HowItWorksSection.jsx: no `'use client'`, dynamic import, h-[280px] skeleton, correct heading, CTA preserved
- FeaturesGrid.jsx: Globe import, "Speaks Their Language", "Five features", "Every caller heard"
- page.js: h-[280px] skeleton, 3 tab placeholders, 5th card md:col-span-2 in FeaturesGrid skeleton

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all feature card content is wired, all tab content uses real step data from steps array.

## Self-Check: PASSED

Files verified to exist:
- src/app/components/landing/HowItWorksTabs.jsx — FOUND
- src/app/components/landing/HowItWorksSection.jsx — FOUND (rebuilt)
- src/app/components/landing/FeaturesGrid.jsx — FOUND (updated)
- src/app/(public)/page.js — FOUND (updated)

Commits verified:
- d476117 — feat(11-01): create HowItWorksTabs client component and rebuild HowItWorksSection
- 8e0cd88 — feat(11-01): add 5th feature card and update page.js loading skeletons

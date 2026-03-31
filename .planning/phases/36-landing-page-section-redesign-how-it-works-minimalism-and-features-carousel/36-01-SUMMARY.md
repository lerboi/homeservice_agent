---
phase: 36
plan: 01
subsystem: landing-page
tags: [framer-motion, scroll-animation, parallax, how-it-works, landing-page]
dependency_graph:
  requires: []
  provides: [HowItWorksMinimal, updated-HowItWorksSection]
  affects: [ScrollLinePath, landing-page-composition]
tech_stack:
  added: []
  patterns: [useInView-per-step, useScroll-parallax, stagger-fade-in, matchMedia-mobile-detect]
key_files:
  created:
    - src/app/components/landing/HowItWorksMinimal.jsx
  modified:
    - src/app/components/landing/HowItWorksSection.jsx
key_decisions:
  - HowItWorksMinimal uses 4 individual top-level ref/useInView/useScroll calls per React Rules of Hooks (not inside .map)
  - StepBlock sub-component receives pre-computed inView/iconY props — hooks remain in parent
  - matchMedia(max-width 767px) disables parallax on mobile to avoid jank
  - useReducedMotion respected throughout — static positions when true
  - Loading skeleton uses 4 min-h-screen divs to prevent layout shift during lazy load
metrics:
  duration: ~3 minutes
  completed: 2026-04-01
  tasks_completed: 2
  files_changed: 2
---

# Phase 36 Plan 01: HowItWorksMinimal — Full-Viewport Scroll Steps Summary

**One-liner:** Apple-style minimal full-viewport How It Works redesign with Framer Motion stagger fade-in, per-step parallax on icons, and alternating white/off-white backgrounds.

## What Was Built

Created `HowItWorksMinimal.jsx` — a `'use client'` component with 4 full-viewport scroll steps replacing the Phase 32 sticky folder-stack design. Each step occupies `min-h-screen` with centered content, staggered fade-in animations, subtle icon parallax (desktop only), soft background shape, and a gradient accent line.

Updated `HowItWorksSection.jsx` to swap the dynamic import from `HowItWorksSticky` to `HowItWorksMinimal`, updated the heading copy, removed the section-level background and constrained wrapper, and updated the loading skeleton to match the new layout.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create HowItWorksMinimal.jsx | ef428ed | src/app/components/landing/HowItWorksMinimal.jsx |
| 2 | Update HowItWorksSection.jsx | 5466533 | src/app/components/landing/HowItWorksSection.jsx |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all step data is fully wired with real copy and colors.

## Self-Check: PASSED

- [x] `src/app/components/landing/HowItWorksMinimal.jsx` exists
- [x] `src/app/components/landing/HowItWorksSection.jsx` updated
- [x] Commit ef428ed exists
- [x] Commit 5466533 exists
- [x] `npm run build` passes without errors
- [x] `HowItWorksSticky` has 0 references in HowItWorksSection.jsx
- [x] `id="how-it-works"` preserved in HowItWorksSection.jsx

---
phase: 32-landing-page-redesign-conversion-optimized-sections
plan: "03"
subsystem: landing-page
tags: [loading-skeletons, scroll-line, CLS-prevention, checkpoint-pending]
dependency_graph:
  requires: [32-01, 32-02]
  provides: [updated-page-skeletons, scroll-line-verified]
  affects: [src/app/(public)/page.js, src/app/components/landing/ScrollLinePath.jsx]
tech_stack:
  added: []
  patterns: [dynamic-import-skeletons, self-adjusting-scroll-path]
key_files:
  created: []
  modified:
    - src/app/(public)/page.js
decisions:
  - ScrollLinePath left unchanged — already self-adjusts to new section heights via getElementById measurement at 100ms and 1000ms post-render
  - HowItWorks skeleton updated to 4 rounded-3xl cards matching the actual sticky card radius from HowItWorksSticky.jsx
  - Features skeleton updated to md:grid-cols-2 with md:col-span-2 hero placeholder and 6 uniform h-64 cards matching the new FeaturesGrid layout
metrics:
  duration: ~5min
  completed_date: "2026-03-31"
  tasks_completed: 2
  tasks_total: 3
  status: checkpoint-pending
---

# Phase 32 Plan 03: Landing Page Composition — Skeleton Updates + Visual Checkpoint Summary

Updated page.js loading skeletons to match redesigned 4-step HowItWorks and 2-col FeaturesGrid layouts, confirmed ScrollLinePath self-adjusts via dynamic measurement, paused at human-verify checkpoint for visual approval of the complete landing page redesign.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update page.js loading skeletons for redesigned sections | c3532db | src/app/(public)/page.js |
| 2 | Verify and adjust ScrollLinePath for new section dimensions | (no-change) | src/app/components/landing/ScrollLinePath.jsx |

## Task 3 — Checkpoint Pending

Task 3 is a `checkpoint:human-verify` gate. Human visual verification of the complete landing page redesign (all 3 plans: hero copy, HowItWorks 4-steps, FeaturesGrid 2-col) is required before this plan can be marked complete.

## What Was Built

### Task 1 — Loading Skeleton Updates

Updated two dynamic import loading skeletons in `page.js`:

**HowItWorks skeleton (lines 13-28):**
- Replaced: 3 tab-block divs + 1 h-[280px] card placeholder (old 3-step layout)
- Now: 4 `h-[180px] rounded-3xl` card placeholders — matches actual HowItWorksSticky card radius (`rounded-3xl`) and count (4 steps)
- Background, padding, and heading skeleton unchanged (`bg-[#F5F5F4]`, `py-20 md:py-28`)

**Features skeleton (lines 31-51):**
- Replaced: old `sm:grid-cols-5` bento layout with 5 cells of mixed col-spans
- Now: `md:grid-cols-2 gap-4` with `md:col-span-2 h-48` hero card placeholder + 6 uniform `h-64 rounded-2xl` feature card placeholders
- Background and heading skeleton unchanged (`bg-[#FAFAF9]`, `py-20 md:py-28`)

Section order in JSX confirmed: `HeroSection > ScrollLinePath(HowItWorksSection, FeaturesGrid, SocialProofSection) > FinalCTASection`.

### Task 2 — ScrollLinePath Verification (No Changes)

Verified all acceptance criteria pass:
- `getElementById('features')` used for FeaturesGrid section boundary detection
- `getElementById('testimonials')` used for SocialProofSection boundary detection
- No `backdrop-blur` in the component
- `buildSineWave()` generates the sine wave path dynamically from measured `w`, `h`, `featuresY`, `testimonialsY`
- SVG element has `hidden md:block` — desktop only, not visible on mobile
- Remeasure timers at 100ms and 1000ms handle dynamic import hydration timing
- `useReducedMotion()` gate returns a plain `<div>` wrapper with no SVG on reduced-motion preference

No code changes were needed. The component already self-adjusts to new section heights because it measures via `getBoundingClientRect()` at runtime, not hardcoded values.

## Deviations from Plan

None — plan executed exactly as written. Task 2 correctly identified no changes needed.

## Known Stubs

None. All skeleton changes are pure layout placeholders matching actual section structure.

## Self-Check: PARTIAL (checkpoint pending)

Files:
- FOUND: src/app/(public)/page.js

Commits:
- c3532db — feat(32-03): update loading skeletons to match redesigned 4-card HowItWorks and 2-col FeaturesGrid

Build: Pre-existing 4 errors in `trial-reminders` and `admin/inventory` routes (prettier/standalone + react-email). No new build errors from this plan. Landing page components compile without errors.

## Checkpoint Status

**Task 3 (Visual Verification) — AWAITING HUMAN APPROVAL**

The human verifier should:
1. Run `npm run dev` and open http://localhost:3000
2. Verify Hero section headline cycling $3,000/$5,000/$10,000 with RotatingText
3. Scroll to How It Works — 4 sticky cards with folder-stack effect, no "triage" word
4. Scroll to Features — full-width 70+ Languages hero card, 6 feature cards in 2-col grid with micro visuals
5. Test mobile at 375px — Features horizontal scroll-snap, HowItWorks tighter sticky offsets
6. Desktop — copper ScrollLinePath sine wave draws during scroll
7. Enable prefers-reduced-motion — CSS keyframe animations disabled, sticky scroll still functional

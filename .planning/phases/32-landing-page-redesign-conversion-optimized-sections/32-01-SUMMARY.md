---
phase: 32-landing-page-redesign-conversion-optimized-sections
plan: "01"
subsystem: landing-page
tags: [hero, how-it-works, conversion, copy, sticky-cards, folder-stack]
dependency_graph:
  requires: []
  provides: [hero-copy-loss-aversion, how-it-works-4-steps, folder-stack-offsets]
  affects: [HeroSection, HowItWorksSticky, HowItWorksSection]
tech_stack:
  added: []
  patterns: [sticky-scroll-cards, folder-stack-cascade, isCompact-responsive-hook]
key_files:
  created: []
  modified:
    - src/app/components/landing/HeroSection.jsx
    - src/app/components/landing/HowItWorksSticky.jsx
    - src/app/components/landing/HowItWorksSection.jsx
decisions:
  - "Used Option B revenue-forward RotatingText words ($3,000/$5,000/$10,000) over Option A competitor words — more direct loss aversion framing"
  - "Computed top offset dynamically via baseTop + index * peekDelta rather than hardcoded per-card values for maintainability"
  - "isCompact state driven by both viewport height (<700px) AND width (<640px) — covers short phones and narrow viewports"
metrics:
  duration: "~5 minutes"
  completed_date: "2026-03-31"
  tasks_completed: 3
  files_modified: 3
---

# Phase 32 Plan 01: Hero Copy + How It Works 4-Step Expansion Summary

Updated hero headline to missed-revenue loss aversion angle with RotatingText cycling $3,000/$5,000/$10,000, and expanded How It Works from 3 to 4 steps with folder-stack sticky card cascading offsets (80/128/176/224px desktop, 60/92/124/156px mobile).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update Hero section copy — headline and subtitle | e703bf5 | HeroSection.jsx |
| 2 | Expand HowItWorksSticky to 4 steps with folder-stack cascading effect | e3c99c1 | HowItWorksSticky.jsx |
| 3 | Update HowItWorksSection heading and loading skeleton | c136755 | HowItWorksSection.jsx |

## What Was Built

### Task 1 — Hero Copy Update

Updated `HeroSection.jsx` headline from "Every Missed Call Is a Job Your {Competitor/Rival/Neighbor} Just Booked" to "Every Missed Call Costs You {$3,000/$5,000/$10,000} in Lost Revenue". This is a direct revenue loss framing that hits the missed-revenue pain angle (D-01). The RotatingText loading fallback was updated from "Competitor" to "$5,000" to match the new word set. Subtitle unchanged.

### Task 2 — HowItWorksSticky Rewrite

Fully rewrote `HowItWorksSticky.jsx`:
- Added 4th step "Your Dashboard Does the Rest" with LayoutDashboard icon (violet color scheme)
- Renamed step 2 from "AI triages instantly" to "AI Handles the Conversation" (D-11 — no triage jargon)
- Updated step 2 and 3 copy to match D-10 narrative
- Implemented folder-stack cascading offsets: desktop 80/128/176/224px (48px delta), mobile 60/92/124/156px (32px delta)
- Added `isCompact` state driven by `useEffect` + resize listener (`window.innerHeight < 700 || window.innerWidth < 640`)
- Mobile cards also reduce marginBottom from 25vh to 20vh
- Removed `backdrop-blur-sm` from icon container (D-17 compliance)
- Changed h3 title from `font-bold` to `font-semibold` per UI-SPEC
- Progress dots render from `steps.map()` — automatically shows 4 dots

### Task 3 — HowItWorksSection Heading + Skeleton

Updated `HowItWorksSection.jsx`:
- Section heading refreshed from "From missed call to booked job. In under two minutes." to "From missed call to booked revenue. No callbacks. No voicemail. No lost jobs."
- Loading skeleton updated from `[1, 2, 3]` to `[1, 2, 3, 4]` to match 4-step layout
- "How it works" eyebrow, "See It In Action" CTA, and Server Component status all unchanged

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all changes are copy/layout. No data stubs introduced.

## Self-Check: PASSED

Files exist:
- FOUND: src/app/components/landing/HeroSection.jsx
- FOUND: src/app/components/landing/HowItWorksSticky.jsx
- FOUND: src/app/components/landing/HowItWorksSection.jsx

Commits exist:
- e703bf5 — feat(32-01): update hero headline to missed-revenue loss aversion angle
- e3c99c1 — feat(32-01): expand HowItWorksSticky to 4 steps with folder-stack cascading effect
- c136755 — feat(32-01): update HowItWorksSection heading and 4-card loading skeleton

Build note: 4 pre-existing build errors in unrelated routes (`trial-reminders`, `admin/inventory`) involving `prettier/standalone` and `react-email` — confirmed present before this plan's changes. Landing page components compile without errors.

---
phase: 11-landing-page-ui-ux-redesign
plan: "02"
subsystem: landing-page
tags: [ui, polish, animation, hover-effects, css, spline]
dependency_graph:
  requires: []
  provides: [social-proof-hover-polish, final-cta-animation, hero-spline-url-todo]
  affects: [HeroSection, SocialProofSection, FinalCTASection, globals.css]
tech_stack:
  added: []
  patterns: [css-keyframe-animation, reduced-motion-guard, tailwind-group-hover]
key_files:
  created: []
  modified:
    - src/app/components/landing/HeroSection.jsx
    - src/app/components/landing/SocialProofSection.jsx
    - src/app/components/landing/FinalCTASection.jsx
    - src/app/globals.css
decisions:
  - "Hero Spline URL kept as existing prod URL with TODO comment — D-03 community model prod URL requires manual extraction from Spline UI"
  - "CTA animation uses CSS-only @media(prefers-reduced-motion) guard — FinalCTASection stays a Server Component, no useReducedMotion hook needed"
  - "animate-cta-glow defined inside prefers-reduced-motion: no-preference block — class exists in DOM but animation property only applies when motion is allowed"
metrics:
  duration_minutes: 7
  completed_date: "2026-03-23"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 4
requirements: [REDESIGN-HERO, REDESIGN-SOCIAL, REDESIGN-CTA]
---

# Phase 11 Plan 02: Hero + Social Proof + Final CTA Polish Summary

**One-liner:** Social Proof cards lift 4px on hover with green badge glow; Final CTA gains 10s CSS breathing animation across 5 gradient layers while staying a Server Component.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update Hero Spline URL and Social Proof hover polish | 136592b | HeroSection.jsx, SocialProofSection.jsx |
| 2 | Final CTA gradient depth and CSS keyframe animation | 67540d7 | FinalCTASection.jsx, globals.css |

## What Was Built

### Task 1: Hero + Social Proof

**HeroSection.jsx:**
- Kept existing `SPLINE_SCENE_URL` (`https://prod.spline.design/PyzDhpQ9E5f1E3MT/scene.splinecode`)
- Added TODO comment with the D-03 community model URL for future extraction
- All locked content (RotatingText, AuthAwareCTA, mobile fallback Image with priority) preserved unchanged

**SocialProofSection.jsx:**
- Added `hover:-translate-y-1` to testimonial card container — 4px upward lift on hover with smooth 300ms transition
- Added `transition-shadow duration-300 group-hover:shadow-[0_0_16px_rgba(22,101,52,0.2)]` to metric badge div — subtle green glow activates on card hover via group-hover
- All 3 testimonials (Dave R., James K., Mark T.), StarRating component, and testimonial copy preserved

### Task 2: Final CTA

**FinalCTASection.jsx:**
- Added Layer 4: static center ellipse — `radial-gradient(ellipse_at_center, rgba(255,255,255,0.05), transparent_40%)`
- Added Layer 5: animated center ellipse — `radial-gradient(ellipse_at_center, rgba(255,255,255,0.12), transparent_50%)` with `animate-cta-glow`
- File has 5 total absolute overlay divs (base color + 4 gradient layers)
- No `'use client'` directive — remains a Server Component

**globals.css:**
- Added `@keyframes cta-glow-shift` block: `0%/100% { opacity: 0.6; transform: scale(1); }` / `50% { opacity: 1; transform: scale(1.05); }`
- Added `.animate-cta-glow { animation: cta-glow-shift 10s ease-in-out infinite; }` inside existing `@media (prefers-reduced-motion: no-preference)` block
- When reduced-motion is active, `.animate-cta-glow` class has no animation rule — pure CSS guard, no JS hook needed

## Decisions Made

1. **Spline URL as TODO:** The D-03 Spline community URL (`https://app.spline.design/community/file/2ce6351a-d7a5-4c4e-bf13-75bc9f841891`) requires visiting the Spline UI to extract the production `.splinecode` URL. Per RESEARCH.md Pitfall 1, the community browser URL is not the runtime URL. Kept existing URL with clear TODO comment rather than breaking the scene.

2. **CSS-only reduced-motion guard:** Instead of a `useReducedMotion` React hook (which would force `'use client'`), the `.animate-cta-glow` animation class is declared exclusively inside `@media (prefers-reduced-motion: no-preference)`. Class is present in DOM always, but animation property only applies when motion is allowed — standard CSS pattern per RESEARCH.md Pattern 4 and Pitfall 7.

## Deviations from Plan

None — plan executed exactly as written. The Spline URL fallback to TODO was explicitly specified as an option in the task action.

## Known Stubs

- **HeroSection.jsx line 30-32:** Spline URL TODO — current URL is functional but not the D-03 community model. Future plan must extract `https://prod.spline.design/[D-03-ID]/scene.splinecode` from Spline UI and update `SPLINE_SCENE_URL`. This does not prevent the plan's goal (3D scene still loads and responds to cursor).

## Self-Check: PASSED

Files exist:
- src/app/components/landing/HeroSection.jsx — FOUND
- src/app/components/landing/SocialProofSection.jsx — FOUND
- src/app/components/landing/FinalCTASection.jsx — FOUND
- src/app/globals.css — FOUND

Commits exist:
- 136592b — FOUND
- 67540d7 — FOUND

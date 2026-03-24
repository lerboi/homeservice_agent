---
phase: 13-frontend-public-pages-redesign
plan: 05
subsystem: ui
tags: [nextjs, tailwindcss, landing-page, components, dark-mode, responsive]

# Dependency graph
requires:
  - phase: 13-frontend-public-pages-redesign
    provides: Prior plans 01-04 established base component structure, color tokens, and AnimatedSection system
provides:
  - Light-background HowItWorksSection with tightened layout and dark text
  - Dark dramatic FeaturesGrid with dark cards, copper hover glow, grid texture
  - SocialProofSection with charcoal bg (contrast fix vs Features section)
  - LandingFooter with newsletter CTA, social links bottom bar, back-to-top
  - Updated page.js loading skeletons matching new section backgrounds
affects: [13-frontend-public-pages-redesign, future landing page work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Light-dark-light-charcoal visual rhythm across landing page sections
    - Copper hover glow pattern: hover:border-[#C2410C]/40 hover:shadow-[0_0_20px_rgba(194,65,12,0.15)] on dark cards
    - use client directive in footer for scroll interactivity (back-to-top)

key-files:
  created: []
  modified:
    - src/app/components/landing/HowItWorksSection.jsx
    - src/app/components/landing/FeaturesGrid.jsx
    - src/app/components/landing/SocialProofSection.jsx
    - src/app/components/landing/LandingFooter.jsx
    - src/app/(public)/page.js

key-decisions:
  - "HowItWorksSection uses #F5F5F4 light bg (user override of D-18 charcoal spec) — explicitly requested by user during gap review"
  - "FeaturesGrid moved to dark #0F172A bg with #1E293B cards to create dramatic visual contrast vs prior stone bg treatment"
  - "SocialProofSection changed from #0F172A to #1E293B charcoal — prevents visual merge with adjacent Features section"
  - "LandingFooter adds use client directive for back-to-top scrollTo — footer was previously Server Component"
  - "Newsletter form in footer is display-only (no API wired) — purely presentational for visual upgrade"

patterns-established:
  - "Section visual rhythm: Dark hero (#0F172A) -> Light HIW (#F5F5F4) -> Dark Features (#0F172A) -> Charcoal Social (#1E293B) -> Copper CTA"
  - "Copper hover glow on dark cards: border-white/[0.06] hover:border-[#C2410C]/40 hover:shadow copper"

requirements-completed: [D-03, D-04, D-05, D-06, D-10, D-11, D-12, D-18, D-19, D-20, D-23, D-25]

# Metrics
duration: 25min
completed: 2026-03-25
---

# Phase 13 Plan 05: Dramatic Visual Transformation of Landing Page Sections and Footer Summary

**Rebuilt HowItWorks (light bg), FeaturesGrid (dark dramatic cards with copper glow), SocialProof (charcoal contrast fix), and LandingFooter (newsletter + social links + back-to-top) to deliver unmistakable visual transformation beyond color swaps**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-03-25T00:00:00Z
- **Completed:** 2026-03-25T00:25:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- HowItWorksSection rebuilt with #F5F5F4 light background, dark text, white mobile step cards, and mt-8 (was mt-16) CTA gap fix
- FeaturesGrid completely reworked: dark #0F172A background, ALL BentoCards use #1E293B with copper hover glow, green justification text visible on dark bg, grid texture overlay
- SocialProofSection contrast-fixed to #1E293B charcoal base with #0F172A/60 cards — prevents visual merge with Features section
- LandingFooter dramatically upgraded: newsletter CTA section, 3-column grid preserved per D-10, social links (Twitter/X, LinkedIn, GitHub) in bottom bar, logo size-9, back-to-top button with smooth scroll
- page.js loading skeletons updated to match new section backgrounds across all 3 dynamic imports

## Task Commits

Each task was committed atomically:

1. **Task 1: Rebuild HIW/Features/SocialProof + page.js skeletons** - `871fda3` (feat)
2. **Task 2: Dramatically upgrade LandingFooter** - `f5e6521` (feat)

## Files Created/Modified
- `src/app/components/landing/HowItWorksSection.jsx` - Changed to #F5F5F4 light bg, dark text, white mobile cards, mt-8 CTA spacing, removed grid texture (not needed on light bg)
- `src/app/components/landing/FeaturesGrid.jsx` - Changed to #0F172A bg, all BentoCards #1E293B with copper hover glow and border, grid texture overlay, #22C55E justification text for dark bg visibility
- `src/app/components/landing/SocialProofSection.jsx` - Changed section bg to #1E293B charcoal, cards to #0F172A/60 for visual depth on charcoal
- `src/app/components/landing/LandingFooter.jsx` - Added use client, newsletter CTA section, 3-col grid preserved, column heading upgrade, social links bottom bar, size-9 logo, back-to-top scrollTo
- `src/app/(public)/page.js` - HowItWorks skeleton bg-[#F5F5F4], FeaturesGrid skeleton bg-[#0F172A] with dark card placeholders, SocialProof skeleton bg-[#1E293B]

## Decisions Made
- HowItWorksSection uses #F5F5F4 light background (user override of D-18 charcoal spec) — creates essential visual rhythm break between dark hero and dark features sections
- BentoCard system unified: all variants (hero, default, wide) now use same #1E293B bg on #0F172A section — previously hero was dark on dark (#0F172A on #F5F5F4), now cohesive
- SocialProofSection charcoal (#1E293B) instead of midnight (#0F172A) to prevent two adjacent sections being the exact same dark color
- LandingFooter requires use client directive for back-to-top scrollTo functionality — acceptable trade-off for interactivity
- Newsletter form is display-only (no API wired) — documented as known stub, future plan will wire subscription endpoint

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs
- `src/app/components/landing/LandingFooter.jsx` (newsletter input + Subscribe button) — display-only form, no API endpoint wired. The newsletter subscription functionality is intentionally deferred. The input and button exist purely as visual elements for the UI upgrade. Future plan will implement the subscription endpoint.

## Issues Encountered
- Another `next build` process was running when Task 1 completed (likely from a parallel agent). Waited ~45 seconds for it to complete before retrying — build passed on retry.

## Next Phase Readiness
- Landing page sections now have strong visual rhythm and dramatic differentiation between sections
- All 5 target components updated and building cleanly
- Footer is structurally enhanced without violating D-10 3-column constraint
- Ready for verifier review of visual changes

---
*Phase: 13-frontend-public-pages-redesign*
*Completed: 2026-03-25*

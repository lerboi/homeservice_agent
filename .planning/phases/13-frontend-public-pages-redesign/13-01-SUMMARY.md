---
phase: 13-frontend-public-pages-redesign
plan: 01
subsystem: ui
tags: [tailwind, css-tokens, framer-motion, next-js, landing-page, dark-theme]

# Dependency graph
requires: []
provides:
  - Three new Tailwind color utilities: bg-landing-charcoal, text-landing-light-text, text-landing-muted-text
  - AnimatedSection scroll reveal at 200ms with 50ms stagger (was 600ms/120ms)
  - LandingNav transparent-to-solid scroll transition with copper active link underline
  - LandingNav mobile drawer in charcoal (#1E293B) with copper active link color
  - LandingFooter copper gradient top border (transparent-copper-transparent)
  - LandingFooter links turn copper (#C2410C) on hover
affects:
  - 13-02 (pricing page reskin uses these shared components)
  - 13-03 (about/contact page reskin uses these shared components)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - CSS custom properties registered in both @theme inline (Tailwind alias) and :root (actual value) for v4 token pattern
    - isActive helper using usePathname for copper underline on current page link
    - Copper gradient top border via inline style div (h-px w-full) instead of CSS border-t

key-files:
  created: []
  modified:
    - src/app/globals.css
    - src/app/components/landing/AnimatedSection.jsx
    - src/app/components/landing/LandingNav.jsx
    - src/app/components/landing/LandingFooter.jsx

key-decisions:
  - "LandingNav backdrop-blur changed from backdrop-blur-xl to backdrop-blur-[12px] per D-08 spec — explicit value enforces design contract"
  - "Mobile drawer active links use text-[#C2410C] (color only) rather than underline span — drawer layout uses full-width rows, inline underline approach would be visually inconsistent"

patterns-established:
  - "Three-token registration pattern: @theme inline alias + :root hex value enables Tailwind v4 utility generation"
  - "isActive helper: pathname === href || pathname.startsWith(href + '/') for nested route support"

requirements-completed: [D-01, D-02, D-07, D-08, D-09, D-10, D-11, D-12, D-19, D-20, D-23]

# Metrics
duration: 12min
completed: 2026-03-25
---

# Phase 13 Plan 01: Shared Landing Component Foundation Summary

**Three new dark palette CSS tokens + AnimatedSection 200ms timing + LandingNav transparent-scroll with copper active link + LandingFooter copper gradient border, applied across all public pages via shared components**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-25T08:25:00Z
- **Completed:** 2026-03-25T08:37:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Registered `--color-landing-charcoal` (#1E293B), `--color-landing-light-text` (#F1F5F9), `--color-landing-muted-text` (#94A3B8) in both `@theme inline` and `:root` blocks — enabling Tailwind utilities `bg-landing-charcoal`, `text-landing-light-text`, `text-landing-muted-text`
- Updated AnimatedSection duration from 0.6s to 0.2s, stagger from 120ms to 50ms, AnimatedItem duration from 0.5s to 0.2s — faster, crisper reveal animations per D-19
- LandingNav now transparent at page top, transitions to `bg-[#0F172A]/95 backdrop-blur-[12px]` on scroll with `duration-500 ease-in-out`; active page links (pricing/about/contact) show copper underline span; mobile drawer upgraded to charcoal `bg-[#1E293B]` with copper active text
- LandingFooter top border replaced with a 1px copper gradient div (`transparent -> #C2410C -> transparent`); all column links now turn `#C2410C` on hover; logo resized from 28px to 32px; list spacing increased from 12px to 16px

## Task Commits

1. **Task 1: Register dark palette tokens + update AnimatedSection timing** - `36aa27e` (feat)
2. **Task 2: Restyle LandingNav** - `81f07a6` (feat)
3. **Task 3: Restyle LandingFooter** - `39e541e` (feat)

## Files Created/Modified

- `src/app/globals.css` - Added 3 new landing color tokens to @theme inline and :root blocks
- `src/app/components/landing/AnimatedSection.jsx` - Updated duration/stagger to 200ms/50ms timing
- `src/app/components/landing/LandingNav.jsx` - Transparent scroll, isActive helper, copper underline, charcoal mobile drawer
- `src/app/components/landing/LandingFooter.jsx` - Copper gradient border, copper link hover, logo size-8, space-y-4

## Decisions Made

- LandingNav already had `bg-transparent` and `bg-[#0F172A]/95` from a prior iteration; updated to use `backdrop-blur-[12px]` (explicit) instead of `backdrop-blur-xl`, added `border-b border-white/[0.06]` always present, and `h-16` explicit height for layout stability
- Mobile drawer active links use `text-[#C2410C]` color only (no underline span) — the drawer uses full-width block links where an underline would look visually inconsistent with the layout

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Build passed without errors confirming all Tailwind token registrations are valid.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All shared landing components updated to Premium Dark SaaS design language
- Plans 02 and 03 can immediately consume `bg-landing-charcoal`, `text-landing-light-text`, `text-landing-muted-text` tokens
- All public pages now inherit correct nav, footer, and animation behavior without further changes to those components

---
*Phase: 13-frontend-public-pages-redesign*
*Completed: 2026-03-25*

# Project Research Summary

**Project:** Voco — v5.0 Trust & Polish
**Domain:** SaaS landing page trust/conversion + dashboard dark mode retrofit + UI/UX polish (Next.js + Tailwind + shadcn)
**Researched:** 2026-04-13
**Confidence:** HIGH

## Executive Summary

Voco v5.0 is a polish-and-conversion milestone, not a feature milestone. The research establishes three independent work streams: (1) landing page objection-busting to address five identified conversion blockers from PROBLEMS.md, (2) dark mode retrofit across ~51 dashboard components, and (3) UI/UX polish for empty/loading/error states and micro-interactions. The key finding across all four research files is that the infrastructure for all three streams is already installed and partially wired — `next-themes` v0.4.6, the `.dark {}` CSS variable block, framer-motion's `AnimatedSection` wrapper, and shadcn Skeleton — but none are fully connected. The milestone is primarily configuration, token migration, and copy work, not new system design.

The single highest-risk item is the dark mode token migration: 293 hardcoded color occurrences across 51 dashboard component files, plus `design-tokens.js` which exports raw hex strings as JS constants used across the codebase. This cannot be done with a bulk find-replace — each instance requires context review. The `ThemeProvider` wiring is a 5-line change; the token audit that follows is a multi-session pass. Build order matters: ThemeProvider must be wired before any dark-mode color work, and the token audit must complete before the theme toggle is user-accessible. Partial dark mode (sidebar dark, content light) is visually worse than no dark mode.

The landing page risk is different in nature: copy quality. The five objection-busting sections must be written from an outcome-first, confident voice that matches the existing page tone — not as a list of defensive rebuttals. The existing page structure (ScrollLinePath, FinalCTA as last section) must be respected. The recommendation is a single `ObjectionSection` component addressing all objections plus a standalone `FAQSection`, both inserted between `FeaturesCarousel` and `SocialProofSection`, with `FinalCTASection` remaining the last content before footer.

## Key Findings

### Recommended Stack

No new npm packages are needed. `next-themes` v0.4.6 is already installed and is the correct tool for dark mode. The `.dark {}` CSS variable block already exists in `globals.css` with well-designed oklch tokens. `framer-motion` v12's `AnimatedSection` wrapper handles reduced-motion compliance for all new landing animations. The only work is wiring and migration.

Two configuration bugs block dark mode today: (1) `@custom-variant dark (&:is(.dark *))` in `globals.css` should be `(&:where(.dark, .dark *))` to match elements that have `.dark` applied to themselves, not just their children; (2) `dashboard/layout.js` has a hardcoded `bg-[#F5F5F4]` that will not respond to the theme token until replaced with `bg-background`.

**Core technologies:**
- `next-themes` v0.4.6: theme provider, `.dark` class injection, localStorage persistence — already installed, wire `ThemeProvider` into root `layout.js`
- Tailwind CSS v4 `dark:` utilities + CSS variable overrides: the mechanism for all component dark mode — `.dark {}` block already complete in `globals.css`
- `framer-motion` v12 `AnimatedSection`: scroll-triggered animations with reduced-motion compliance — reuse existing wrappers, do not create new raw `motion.div` usage
- `recharts` v3 + `useTheme()` hook: chart dark mode — CSS variables cannot be used in SVG props; must resolve colors conditionally via `resolvedTheme` at render time
- shadcn `Skeleton` + `Accordion`: already installed — `loading.js` files for streaming skeletons, Radix Accordion for FAQ section

### Expected Features

**Must have (table stakes — P1):**
- FAQ accordion section — addresses all 5 PROBLEMS.md objections, highest ROI / lowest cost
- Hero + FinalCTA copy reframe — "complement not replacement" repositioning, copy-only changes
- "Cost of inaction" stat callout block — reframes price objection with $260k/year anchoring
- "Sounds robotic" counter block — #1 objection by volume, links back to live demo as proof
- ThemeProvider + theme toggle in DashboardSidebar — gating prerequisite for all dark mode work
- Dashboard layout dark mode — `layout.js`, `GridTexture`, sidebar, `BottomTabBar`
- Full design token audit — all 51 dashboard components, `design-tokens.js` JS constants
- Empty states for leads and calls pages — highest-value polish for new users pre-first-call

**Should have (competitive — P2):**
- Chart dark mode via `useTheme()` + conditional recharts color props — dependent on ThemeProvider
- Flyout + modal dark mode — `LeadFlyout`, `AppointmentFlyout`, `QuickBookSheet`
- Identity/change-aversion landing section — emotional "you are still in control" copy block
- Revenue loss calculator widget — interactive, high conversion value, needs design iteration
- Loading skeleton screens and button loading states — polish layer after dark mode stable
- Hover micro-interactions on stat cards — zero-cost CSS addition

**Defer to v6+ (P3):**
- Trade specificity proof block — FeaturesCarousel already covers this angle
- Anchor-linked section navigation — low conversion value vs nav complexity
- Supabase `tenants.ui_preferences` for cross-device theme persistence — localStorage is sufficient for v5.0
- Deep mobile responsiveness audit — app is already responsive; this is ongoing maintenance

### Architecture Approach

The `ThemeProvider` must live in the root `src/app/layout.js` as a `'use client'` wrapper component (`src/components/providers/ThemeProvider.jsx`). This is the only placement where next-themes injects its SSR anti-flash script into `<head>` correctly. The public landing page is safe from dark mode side effects because its sections use hardcoded hex colors that do not respond to `.dark` on `<html>`. New landing sections live in `src/app/components/landing/` (not `src/components/landing/` — two different directories exist), are dynamically imported with loading skeletons, and should be placed between `FeaturesCarousel` and `SocialProofSection` inside the existing `ScrollLinePath` wrapper, or after it before `FinalCTASection`.

**Major components (new/modified):**
1. `src/components/providers/ThemeProvider.jsx` (NEW) — `'use client'` wrapper for next-themes ThemeProvider; keeps root layout a Server Component
2. `src/components/dashboard/ThemeToggle.jsx` (NEW) — Sun/Moon toggle using `useTheme().setTheme()`; placed in DashboardSidebar bottom section
3. `src/app/components/landing/ObjectionSection.jsx` (NEW) — single component addressing all 5 objections in cards/grid; dynamically imported
4. `src/app/components/landing/FAQSection.jsx` (NEW) — Radix Accordion FAQ, placed just above `FinalCTASection`
5. `src/app/layout.js` (MODIFY) — add `suppressHydrationWarning` to `<html>`, wrap with `ThemeProviderWrapper`
6. `src/lib/design-tokens.js` (MODIFY) — replace all hardcoded hex strings with Tailwind semantic equivalents (`bg-card`, `text-foreground`, `bg-background`)
7. All 51 dashboard component files (MODIFY) — replace hardcoded color classes with semantic tokens + `dark:` variants where needed

### Critical Pitfalls

1. **ThemeProvider must be wired before any color work** — `useTheme()` silently returns `undefined` with no error when no provider exists. Building a toggle before the provider is in the tree produces a non-functional UI. Gate all dark mode work on: provider wired + no hydration warning in console + `.dark` class visible on `<html>` in DevTools.

2. **Hardcoded colors across 51 files cannot be bulk-replaced** — 293 occurrences in `src/components/dashboard/` alone. Context matters: `bg-white` on a logo container must stay white; `bg-white` on a card surface must become `bg-card`. `design-tokens.js` exports raw hex as JS string constants — it is a centralization trap that defeats the CSS variable system entirely.

3. **Dashboard sidebar must stay dark in dark mode** — `DashboardSidebar` uses `bg-[#0F172A]` intentionally. This must NOT be migrated to a semantic token. If the main content area also goes near-black, the sidebar loses its visual identity. Dark oklch values in `globals.css` must be tuned so `--card` is lighter than `--background`, creating visible hierarchy.

4. **Recharts requires `useTheme()` in the component, not CSS variables** — SVG `fill`/`stroke`/`contentStyle` are inline styles; `.dark` on `<html>` has no effect on them. `AnalyticsCharts.jsx` must call `useTheme()` and conditionally resolve color values at render. Same applies to `CalendarView.js` urgency color blocks.

5. **Landing sections must not proliferate — FinalCTA must stay last** — Consolidate all objection content into one `ObjectionSection` + one `FAQSection`. Count top-level section imports in `page.js` as the enforcement gate (max 6).

6. **Objection copy written defensively tanks conversion** — Any heading mirroring the fear plants doubts in visitors who had none. Write every heading as a positive assertion or proof claim. Run a forbidden-words grep before marking the landing phase complete.

7. **ScrollLinePath breaks if new sections are inserted carelessly** — The copper sine wave SVG is anchored to exactly three children. Place new sections after the `</ScrollLinePath>` closing tag (before `FinalCTASection`) unless the path coordinates are explicitly recalculated.

## Implications for Roadmap

Based on research, the dependency graph mandates strict build order within dark mode. Landing page work is fully independent and can proceed in parallel with a separate developer if available.

### Phase 1: Dark Mode Foundation
**Rationale:** ThemeProvider is a hard prerequisite. No dark mode work is meaningful without it. This phase unblocks the entire dark mode stream.
**Delivers:** Working theme toggle in DashboardSidebar; `class="dark"` on `<html>` when toggled; zero hydration warnings; no flash on hard reload; sonner toasts auto-switch as a side effect.
**Addresses:** ThemeProvider + theme toggle (P1 must-have).
**Avoids:** Hydration flash (FOUC), missing provider blocking all subsequent dark mode work.
**Key tasks:** Create `src/components/providers/ThemeProvider.jsx`; add `suppressHydrationWarning` to `<html>`; wire inside `NextIntlClientProvider`; fix `@custom-variant dark` selector in `globals.css`; create and wire `ThemeToggle.jsx` into `DashboardSidebar`.

### Phase 2: Dashboard Dark Mode — Token Migration
**Rationale:** The largest effort in the milestone. Must complete as a coherent single pass — partial dark mode is visually broken and worse than no dark mode.
**Delivers:** All dashboard pages, layout shells, sidebars, flyouts, and settings panels render correctly in both modes. `design-tokens.js` no longer contains hardcoded hex strings.
**Addresses:** Design token audit (P1); dashboard layout dark mode (P1); flyout/modal dark mode (P2).
**Avoids:** 51-file hardcoded color pitfall, `design-tokens.js` CSS variable drift, sidebar double-dark problem, focus state regressions.
**Key tasks:** Migrate `dashboard/layout.js`; update `design-tokens.js`; file-by-file audit of all 51 dashboard component files (sidebar excluded from semantic token migration); visual review pass in both modes before shipping.

### Phase 3: Dashboard Dark Mode — Charts and Calendar
**Rationale:** Separate from token migration because Recharts and CalendarView require a different fix pattern than CSS class replacement. Keeps Phase 2 scope clean.
**Delivers:** Analytics charts with dark-mode-aware axes, gridlines, tooltips, fills. Calendar urgency event blocks readable in dark mode.
**Addresses:** Chart dark mode (P2).
**Avoids:** Recharts chart colors breaking, CalendarView urgency colors disappearing on dark backgrounds.
**Key tasks:** Update `AnalyticsCharts.jsx` with `useTheme()` + conditional recharts color resolution; update `CalendarView.js` `URGENCY_STYLES` with `dark:` Tailwind variants.

### Phase 4: Landing Page — Repositioning and Objection Sections
**Rationale:** Fully independent of dark mode. Can run in parallel with Phases 1-3 if separate developer capacity exists.
**Delivers:** Hero + FinalCTA copy reframed to complement-not-replacement. New `ObjectionSection` addressing all 5 objections. `FAQSection` just above FinalCTA. ScrollLinePath unbroken.
**Addresses:** All P1 landing must-haves; identity/change-aversion section (P2).
**Avoids:** Defensive copy pitfall, section proliferation burying the CTA, tone mismatch, raw `motion.div` bypassing reduced-motion, ScrollLinePath breaking.
**Key tasks:** Update `HeroSection.jsx` and `FinalCTASection.jsx` copy; create `ObjectionSection.jsx` using `AnimatedSection` wrappers; create `FAQSection.jsx` using shadcn Accordion; insert both with `dynamic()` imports into `page.js`; run forbidden-words grep on all new copy before marking done.

### Phase 5: UI/UX Polish Pass
**Rationale:** Last because empty/loading states must account for stable dark mode token values, and the no-API-changes scope boundary must be enforced from the start.
**Delivers:** Empty states for leads, calls, calendar, analytics. Loading skeleton screens. Button loading states. Hover micro-interactions on stat cards. Focus state audit in dark mode. Error states for data fetches.
**Addresses:** Empty states (P1); loading skeletons, button loading states, hover states (P2).
**Avoids:** Polish scope creep into API/business logic.
**Key tasks:** Create `EmptyState` component; add `loading.js` files to route segments; verify Skeleton uses `bg-muted` not `bg-stone-200`; button loading states with `<Loader2 animate-spin />`; hover states on stat cards; keyboard focus ring audit in dark mode.

### Phase Ordering Rationale

- Phase 1 is a hard gate for Phases 2 and 3 — confirmed by PITFALLS.md and ARCHITECTURE.md. No dark mode component work proceeds without it.
- Phase 2 before Phase 3 — establish verified token migration baseline first, then layer chart-specific conditional logic.
- Phase 4 is fully independent — parallelize with Phases 1-3 if two developers are available.
- Phase 5 last — empty states and skeletons need verified dark mode tokens to avoid invisible elements on dark backgrounds.

### Research Flags

All phases have well-documented patterns — no additional research-phase calls are needed:
- **Phase 1:** next-themes ThemeProvider wiring is thoroughly documented in official shadcn and next-themes docs. Zero ambiguity.
- **Phase 2:** Token migration is effort-heavy but mechanically documented. The token mapping table in ARCHITECTURE.md is complete. Developer judgment required per instance (not automatable with a bulk replace).
- **Phase 3:** Recharts `useTheme()` pattern is the established community approach. SVG props cannot use CSS variables — this is a specification fact, not an opinion.
- **Phase 4:** Landing sections are static content with established framer-motion patterns. Copy quality requires a human read-aloud review — not a researchable problem.
- **Phase 5:** All polish patterns (empty states, skeletons, loading buttons) are documented shadcn/standard patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All findings from direct `package.json` + codebase inspection. No new packages needed. Zero speculation. |
| Features | HIGH (P1) / MEDIUM (P2) | P1 features grounded in PROBLEMS.md and verified codebase gaps. Revenue calculator 40% conversion rate claim is from a single marketing source — treat as directional. |
| Architecture | HIGH | ThemeProvider placement, provider chain, component inventory — all from direct file inspection. Grep counts verified in source files. |
| Pitfalls | HIGH (dark mode, animations) / MEDIUM (copy quality) | Dark mode pitfalls are code-verified or SVG-specification facts. Copy quality pitfalls are conversion-pattern-based — directionally correct, execution depends on the writer. |

**Overall confidence:** HIGH

### Gaps to Address

- **Dark oklch token values need Voco-specific tuning:** Current `.dark {}` block uses shadcn defaults. After Phase 1, compare rendered dark palette against Voco brand intent (orange `#C2410C`, navy `#0F172A`). Card/background separation may need adjustment before Phase 2 passes visual review.
- **`design-tokens.js` import scope:** All import sites were not exhaustively enumerated in research. Run `grep -r "design-tokens" src/` at the start of Phase 2 to scope the migration correctly.
- **ScrollLinePath height after new section insertion:** Research flags this but does not resolve it. Visual review required after inserting `ObjectionSection`. If the path breaks, move the section outside `</ScrollLinePath>` to between the closing tag and `FinalCTASection`.
- **Revenue calculator widget design:** No wireframe or interaction spec exists. Requires a design decision before implementation begins in Phase 4 or 5.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — `package.json`, `src/app/layout.js`, `src/app/globals.css`, `src/app/dashboard/layout.js`, `src/components/dashboard/AnalyticsCharts.jsx`, `src/app/(public)/page.js`, `src/app/components/landing/AnimatedSection.jsx`
- PROBLEMS.md — 5 objections and counters from owner/market research (primary conversion research source)
- next-themes GitHub (https://github.com/pacocoursey/next-themes) — `suppressHydrationWarning` requirement, `attribute="class"` config
- shadcn/ui dark mode docs (https://ui.shadcn.com/docs/dark-mode/next) — ThemeProvider setup pattern
- Tailwind CSS v4 dark mode docs (https://tailwindcss.com/docs/dark-mode) — `@custom-variant dark` CSS-first config

### Secondary (MEDIUM confidence)
- Tailwind v4 + next-themes integration guide (https://medium.com/@kevstrosky/theme-colors-with-tailwind-css-v4-0-and-next-themes-dark-light-custom-mode-36dca1e20419) — `&:where(.dark, .dark *)` vs `&:is(.dark *)` distinction (community, verified against Tailwind v4 docs)
- WebSearch: SaaS landing page objection patterns 2025 — FAQ placement, cost-of-inaction framing
- WebSearch: AI receptionist trust objections — 85-95% blind test stat for modern AI voice quality
- WebSearch: next-themes 0.4 React 19 compatibility confirmation

### Tertiary (LOW confidence)
- Outgrow marketing material — revenue calculator 40%+ conversion rate claim (single marketing source, not independently validated)

---
*Research completed: 2026-04-13*
*Ready for roadmap: yes*

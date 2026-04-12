# Feature Research

**Domain:** SaaS landing page trust/objection-busting + dashboard dark mode + UI/UX polish
**Milestone:** v5.0 Trust & Polish
**Researched:** 2026-04-13
**Confidence:** HIGH (landing page patterns, dark mode) | MEDIUM (UI polish specifics)

---

## Context: What's Already Built

Before cataloguing new features, these existing sections must NOT be duplicated:

| Section | Location | What it does |
|---------|----------|--------------|
| HeroSection | `HeroSection.jsx` | Dark hero, rotating text ("Phone Calls / Bookings / Invoices / Paperwork"), live demo input, integration logo marquee |
| HowItWorksSection | `HowItWorksSection.jsx` → `HowItWorksMinimal.jsx` | 4-step sticky scroll flow |
| FeaturesCarousel | `FeaturesCarousel.jsx` | 7-feature swipe carousel with micro-visuals (languages, clock, booking, SMS, analytics, leads, calendar) |
| SocialProofSection | `SocialProofSection.jsx` | 3 testimonial cards with metric badges (Dave R./plumber, James K./HVAC, Mark T./electrician) |
| FinalCTASection | `FinalCTASection.jsx` | Dark CTA — "Your next emergency call is tonight. Set up in 5 minutes." |

**New sections must insert between FeaturesCarousel → SocialProofSection → FinalCTASection or after SocialProofSection, not replace existing sections.**

The landing page currently has NO objection-handling section, NO FAQ, NO pricing counter, NO comparison table, NO repositioning section addressing the "complement not replacement" angle, and NO identity/change-aversion counter.

The dashboard has `.dark {}` CSS variables defined in `globals.css` (oklch tokens for background, card, border, muted, chart-1 through chart-5), the `next-themes` package installed (`^0.4.6`), and a `@custom-variant dark (&:is(.dark *))` directive. However, zero dashboard components use `dark:` Tailwind classes — hardcoded hex colors throughout (`bg-[#F5F5F4]`, `bg-white`, `text-[#0F172A]`, etc.). Chart colors are hardcoded hex in `AnalyticsCharts.jsx`. The `design-tokens.js` file has no dark variants.

---

## Category 1: Objection-Busting Landing Page Sections

### Table Stakes (Must Have)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| FAQ accordion section | 48% of visitors exit without converting — FAQ catches 90%-convinced-but-one-doubt visitors. Industry standard for AI/SaaS. | LOW | Radix Accordion (shadcn) already installed. 5–7 questions covering all 5 PROBLEMS.md objections. Place just above FinalCTASection. |
| "Sounds robotic" counter block | #1 objection by volume per PROBLEMS.md. Must be addressed visually, not buried in FAQ. | LOW–MED | Audio waveform icon or "hear it" CTA. Reinforce the live demo already in HeroSection — link back to it as proof. "85% of callers can't tell it's AI" stat. |
| Pricing objection reframe | #3 objection. "It's too expensive" without anchoring to cost of inaction loses the price-sensitive segment. | LOW | A dedicated cost-comparison callout or single stat card: "$260,400/year lost to voicemail" vs "starts at $X/month". NOT a full pricing page — FinalCTA links to pricing. |
| Trust/accuracy objection counter | #2 objection — contractors fear hallucination and losing job details. | LOW | Short copy block: "AI captures the lead, you make the call." Escalation chain visual (human backup badge). |
| Identity/change-aversion section | The "bonus" objection from PROBLEMS.md — the real one nobody says out loud. Owner identity is tied to being the one who answers. | MED | Requires emotional reframe copy, not feature bullets. "Your voice. Your business. Just always-on." Frame it as amplification, not replacement. |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Interactive revenue loss calculator | "What's voicemail costing you?" — user inputs calls/month, conversion rate, average job value → outputs annual revenue lost. Interactive widgets convert at 40%+ vs 2-12% for static pages. | MED | Build in React with controlled inputs. No external dependency needed. Outputs: "You're losing $X/year to voicemail." Ties directly into PROBLEMS.md objection #3. |
| "Before vs After" workflow comparison strip | Repositioning as complement-not-replacement requires a side-by-side: "Before Voco" (miss calls, lose leads) vs "With Voco" (every call answered, jobs booked). Distinct from feature carousel which shows individual features. | LOW–MED | Two-column card or toggle layout. Addresses the identity objection by showing owner still dispatches jobs — AI only captures them. |
| Trade specificity proof block | PROBLEMS.md objection #4 — "generic AI won't know my trade." Trades-specific terminology display builds immediate credibility. | LOW | Icon grid of supported trades + one trade-specific call transcript snippet showing correct terminology (e.g., "tankless vs tank", "240V circuit"). Leverages existing trade-specific training. |
| Setup simplicity counter | PROBLEMS.md objection #5 — "I'm not tech-savvy." "4-minute setup" is already in SocialProofSection (Mark T.'s testimonial), but needs dedicated visual proof. | LOW | 3-step numbered flow: "1. Forward your number → 2. Set your hours → 3. You're live." Timer graphic. |
| Trust/hybrid backup badge row | Positions hybrid AI+human escalation chain as proof that nothing falls through cracks. | LOW | Row of badges/chips: "Human backup if AI can't handle it", "All calls recorded + transcribed", "You control the escalation chain". Leverages existing escalation chain feature. |

### Anti-Features (Avoid)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Full pricing table on landing page | Users want to see cost upfront | Anchors price conversation before trust is built; existing /pricing page handles this | Teaser: "Starts at $X/month — less than one missed job" with link to pricing |
| Live chatbot on landing page (AI-powered) | Demo of product | Existing HeroDemoBlock already serves this role; adding a chatbot creates mode confusion and competes with the live audio demo | Keep HeroDemoBlock, don't duplicate with text chatbot |
| Video explainer embed (YouTube/Vimeo) | Common objection-busting pattern | Adds third-party cookie consent complexity, hurts LCP, competes with Spline scene and audio demo | Use the live audio demo (HeroDemoBlock) — it's the same proof, interactive and on-brand |
| Customer logo bar (enterprise logos) | Social proof pattern | Target market (plumbers, HVAC, electricians) does not identify with enterprise logos; creates aspiration mismatch | Trade-specific testimonial cards (already in SocialProofSection) are more resonant |
| "Compare us to competitors" table | Shows buyers alternatives exist | In a trust-building context, name-dropping competitors primes comparison shopping | Frame vs the pain (voicemail), not vs competitors. "Better than voicemail" not "better than [Competitor]" |
| Pop-up modal for lead capture | Common conversion tactic | Kills the premium feel; home service owners are skeptical of "salesy" patterns; the demographic has low tolerance | Sticky CTA bar (low-friction) or inline CTAs in objection sections |

---

## Category 2: Landing Page Repositioning

### Table Stakes (Must Have)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Hero copy reframe: complement not replacement | Current H1 "Let Voco Handle Your Phone Calls" implies replacement. The identity objection requires "your voice, just always-on" framing. | LOW | Copy change only — no new component. Subtitle update: "Voco answers when you can't. You stay in charge of every job." RotatingText can stay. |
| FinalCTA reframe | Current CTA: "Your next emergency call is tonight." Strong but doesn't reinforce the control/complement angle. | LOW | Update subtitle copy. No structural change. Add: "Your rules. Your schedule. AI does the answering." |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| "Full-stack workflow" positioning strip | New messaging frame: Voco as AI that handles the whole inbound workflow (answer → triage → book → notify → CRM), not just a voice bot. | LOW | 5-icon horizontal strip showing the workflow chain. Inserted after HeroSection or before FeaturesCarousel. |
| Owner-control emphasis callout | Addresses change-aversion by showing owner retains every important decision — only the "answering the phone at 2am" part is delegated. | LOW | Small callout card or pull-quote block. "You set the rules. Voco follows them." |

### Anti-Features

| Feature | Why Problematic | Alternative |
|---------|-----------------|-------------|
| "AI replacing receptionist" framing | Activates loss aversion in owners who feel personal connection to their customer relationships | "AI answering when you're on-site" — situational framing, not replacement framing |
| Feature-first above-the-fold | Features without emotional context don't convert skeptical trades owners | Lead with the pain (missed calls = lost money), then features as proof |

---

## Category 3: Dashboard Dark Mode

### Table Stakes (Must Have)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| ThemeProvider wrapper in root layout | Without it, next-themes cannot detect system preference or persist user choice. `next-themes ^0.4.6` is already installed. | LOW | Add `<ThemeProvider attribute="class" defaultTheme="system" enableSystem>` to `src/app/layout.js`. Must wrap Suspense boundaries carefully to avoid hydration mismatch. `suppressHydrationWarning` on `<html>` tag is required. |
| Theme toggle in DashboardSidebar | Best-in-class placement per industry convention: sidebar bottom or header. User must have access without hunting for it. | LOW | Sun/Moon icon button using `useTheme()` from next-themes. Persists to localStorage automatically via next-themes. |
| Design token audit: replace all hardcoded hex in dashboard | This is the bulk of the dark mode work. Every `bg-white`, `bg-[#F5F5F4]`, `text-[#0F172A]`, `border-stone-200`, `text-[#475569]` in dashboard components needs a dark-mode counterpart. Tailwind `dark:` prefix is the mechanism (globals.css already defines `.dark {}` variables). | HIGH | Scope: all files in `src/components/dashboard/` and `src/app/dashboard/**/*.js`. `design-tokens.js` must gain dark variants. DashboardSidebar, layout, all page content, flyouts, modals, settings panels. |
| Dashboard layout background | `min-h-screen bg-[#F5F5F4]` in `layout.js` must become `dark:bg-[#0F172A]` or use CSS variable. GridTexture variant must swap. | LOW | Single-file change in `layout.js` + `GridTexture` component. |
| Sidebar dark mode | `DashboardSidebar.jsx` hardcodes light colors throughout. Nav items, active state, logo area, bottom section. | MED | Replace with `dark:` prefixed equivalents. |
| Bottom tab bar dark mode | `BottomTabBar.jsx` hardcodes light background. Mobile users see persistent light bar in dark mode — visually broken. | LOW | Single component, limited tokens. |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Chart dark mode via CSS variables | `AnalyticsCharts.jsx` uses Recharts with hardcoded hex colors. In dark mode, dark text on dark backgrounds becomes unreadable. Shadcn chart approach: route through `--chart-1` through `--chart-5` CSS vars which already have dark values in globals.css. | MED | Requires updating `AnalyticsCharts.jsx` chartConfig to use `var(--chart-1)` etc. instead of hex. Also affects axis labels, grid lines, tooltip background. |
| System preference detection | Users expect the product to honor `prefers-color-scheme: dark` without needing to manually toggle. next-themes `enableSystem` prop handles this. | LOW | Enabled via ThemeProvider config. Zero additional code beyond the ThemeProvider setup. |
| Smooth theme transition | Abrupt color flips feel unfinished. 150–200ms transition on body or layout prevents jarring switch. | LOW | One CSS rule on `body` in globals.css: `transition: background-color 150ms, color 150ms`. Apply carefully to avoid slowing non-theme transitions. |
| Flyout and modal dark mode | LeadFlyout, AppointmentFlyout, QuickBookSheet, ChatbotSheet — all use Sheet from shadcn (which respects CSS variables). The card content inside is hardcoded. | MED | Flyout interiors need `dark:` audit. shadcn Sheet itself uses `--card` variable which dark mode already defines. The card interiors are the issue. |
| Status badges and urgency pills dark mode | LeadStatusPills, urgency badges use hardcoded colors (`bg-red-50 text-red-700`). In dark mode these become barely readable. | LOW | Map to semantic Tailwind classes (`dark:bg-red-900/30 dark:text-red-400`) for each badge variant. |

### Anti-Features

| Feature | Why Problematic | Alternative |
|---------|-----------------|-------------|
| `filter: invert()` on chart SVGs for dark mode | Inverts all colors including brand orange; produces muddy, incorrect results | CSS variables routed through shadcn chart config |
| Auto-generated dark palette from light palette | "Darken everything by X%" produces murky mid-tones, not a proper dark theme | Use the existing `.dark` oklch values already in globals.css — they are well-designed |
| Dark mode on the public/landing pages | Landing page uses a dark hero section intentionally (art direction). Adding OS-level dark mode to landing page risks making light sections too dark and breaking contrast. | Scope dark mode to dashboard only — use the `.dark` class which next-themes applies to `<html>`, then conditionally apply it only when on dashboard routes, OR accept it applies globally but keep landing page colors as hardcoded (non-variable) hex so they don't shift. |
| Storing theme preference in database | Adds a round-trip on every load; next-themes localStorage persistence is sufficient and instant | localStorage via next-themes default behavior |

---

## Category 4: UI/UX Polish — Dashboard

### Table Stakes (Must Have)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Empty states for all list views | Leads page (no leads yet), Calls page (no calls yet), Calendar (no appointments), Analytics (no data). Currently unclear what empty state renders. Empty states reduce churn for new users who haven't received calls yet. | LOW–MED | Pattern: Icon + "Nothing here yet" headline + primary action CTA. For leads: "Your first call will appear here the moment it comes in." |
| Loading skeletons matching layout | Dashboard pages may show blank flashes during data fetch. Skeleton widths must match final content layout to prevent CLS. | LOW–MED | Use Tailwind `animate-pulse` with `bg-stone-200 dark:bg-stone-700` placeholders. One skeleton per page type (leads, calendar, calls, analytics). |
| Consistent focus states | `design-tokens.js` has a focus ring token (`focus:ring-[#C2410C]`) but not all interactive elements use it. Missing focus states fail WCAG 2.1 AA. | LOW | Audit: all buttons, inputs, nav items, pill filters. Apply `focus-visible:` ring consistently (not `focus:` which fires on mouse click too). |
| Error states for data fetches | When API calls fail, users see nothing or a frozen UI. Every page with a fetch needs an error state. | LOW | Pattern: "Something went wrong. Try refreshing." with retry button. Use Sonner toast for transient errors, inline error component for load failures. |
| Mobile responsiveness audit | All page content must work at 375px viewport. DashboardSidebar is desktop-only; BottomTabBar is mobile-only — these are correct. The page content within is the concern. | MED | Focus: calendar grid (week view at 375px), analytics charts (Recharts ResponsiveContainer handles width but chart labels may overflow at small sizes), invoice/estimate tables (need horizontal scroll or card layout on mobile). |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Micro-interaction on lead status change | When a lead status is updated in LeadFlyout, a brief scale + opacity animation on the list item reinforces the action. Framer Motion `AnimatePresence` + `layout` prop on the lead list. Already uses framer-motion in layout.js. | LOW | Pattern already established in codebase. |
| Button loading states | CTA buttons during async operations (save settings, send invoice, sync calendar) should show spinner + disable, not silently process. | LOW | Replace button text with `<Loader2 className="animate-spin" />` during pending state. Standard pattern. |
| Hover states on stat cards | DashboardHomeStats 4 cards animate on mount but have no hover state. `hover:-translate-y-0.5 hover:shadow-md` adds polish at zero cost. | LOW | CSS only. Apply `transition-all duration-200` to each stat card wrapper. |
| Command palette completeness | CommandPalette is mounted at layout level. Ensure all major navigation targets are in it (all pages from SKILL.md file map). | LOW | Audit existing commands against full page list. Estimated 3–4 missing destinations. |
| Typography consistency pass | Dashboard mixes hardcoded hex (`text-[#0F172A]`, `text-[#475569]`) with Tailwind semantic colors (`text-slate-900`, `text-gray-600`). Consolidate to design-token values. | LOW–MED | Pure CSS/Tailwind find-and-replace. No behavior changes. |

### Anti-Features

| Feature | Why Problematic | Alternative |
|---------|-----------------|-------------|
| Page-level loading spinners (full-page overlay) | Blocks the entire UI; users lose context of where they are | Skeleton screens that mirror the page layout |
| Animated route transitions with slide in/out | Creates perceptual lag in a data-heavy dashboard; users are navigating efficiently | The existing `opacity: 0 → 1, y: 6 → 0` in layout.js is already correct — subtle and functional, don't change it |
| Tooltips on every element | Tooltip overload creates cognitive noise in a tool used repeatedly | Reserve tooltips for icon-only buttons that need a label, or for data points in charts |
| "Success" confetti on booking | Cute in consumer apps; operators use this 50+ times/day — confetti becomes noise | A brief green checkmark animation on the status pill is sufficient |

---

## Category 5: UI/UX Polish — Landing Page

### Table Stakes (Must Have)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Consistent section spacing | Current landing alternates bg-white / bg-[#FAFAF9] / bg-[#F5F5F4] / bg-[#1C1412]. New objection sections must match this rhythm or feel grafted on. | LOW | Use established background colors. New sections should alternate between the existing warm-neutral palette. |
| Mobile layout for new sections | New objection sections must work at 375px. Single-column stack at mobile, two-column or grid at md+. | LOW | Standard Tailwind responsive grid pattern. |
| AnimatedSection wrapper for all new blocks | All existing below-fold sections use `AnimatedSection` (Framer Motion fade-up on scroll). New sections must follow this for visual consistency. | LOW | Import and wrap. Zero implementation complexity — pattern is established throughout landing. |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Reduced motion compliance for new animations | FeaturesCarousel already respects `prefersReducedMotion`. Any new animated counters, number tickers, or waveform animations must check this. | LOW | `useReducedMotion()` from framer-motion is already used in codebase — follow the same pattern. |

---

## Feature Dependencies

```
ThemeProvider (root layout)
    └──required by──> Theme Toggle (DashboardSidebar)
    └──required by──> dark: classes across all dashboard components
    └──required by──> Chart dark mode (CSS variable routing)

Design Token Audit (design-tokens.js dark variants)
    └──feeds into──> All dashboard component dark: classes

FAQ Accordion Section
    └──no dependencies — standalone new component using existing shadcn Accordion

Revenue Calculator Widget
    └──no external deps — pure React controlled inputs

Objection Counter Sections (5+ blocks)
    └──insert between──> existing landing page sections
    └──must respect──> AnimatedSection wrapper pattern
    └──must coordinate with──> ScrollLinePath boundary

Chart Dark Mode
    └──requires──> ThemeProvider (above)
    └──requires──> AnalyticsCharts.jsx color config updated to var(--chart-N)
    └──already has──> dark chart vars in globals.css (.dark { --chart-1: oklch(...) })
```

### Dependency Notes

- **ThemeProvider requires `suppressHydrationWarning` on `<html>`:** This is a next-themes requirement. Without it, server/client mismatch on the `class` attribute causes hydration errors.
- **Dark mode requires complete token audit before shipping:** Partial dark mode where the sidebar is dark but page content remains `bg-white` looks broken. The token audit (HIGH complexity) must be done as a coherent single pass.
- **ScrollLinePath boundary for new landing sections:** The SVG scroll-draw line wraps `HowItWorksSection → FeaturesCarousel → SocialProofSection`. New sections placed between or after must not extend the SVG path unexpectedly. Recommended placement: new objection sections AFTER `SocialProofSection` but INSIDE the `ScrollLinePath` wrapper (or between `ScrollLinePath` closing and `FinalCTASection`). Verify path alignment when inserting.
- **Landing page dark mode scoping:** Since next-themes applies `.dark` class to `<html>`, and landing pages use hardcoded hex colors (not CSS variables), they naturally won't shift with the theme. This is correct and intentional — no extra scoping needed. Only dashboard components that use CSS variables or `dark:` Tailwind classes will respond to the theme.

---

## MVP Definition (v5.0 Scope)

### Launch With (P1)

- [ ] **FAQ accordion** — highest ROI, lowest complexity, addresses all 5 objections in one component
- [ ] **Hero + FinalCTA copy reframe** — complement-not-replacement repositioning, copy changes only
- [ ] **"Cost of inaction" stat block** — objection #3 (price), the $260k/year number from PROBLEMS.md rendered as a visual callout
- [ ] **"Sounds robotic" counter** — objection #1, most common, link back to live demo as proof
- [ ] **"5-minute setup" visual strip** — objection #5, 3-step flow graphic
- [ ] **ThemeProvider + theme toggle** — foundation for dark mode, must be in place before any dark: classes work
- [ ] **Dashboard layout dark mode** — layout.js background + GridTexture + sidebar + bottom tab bar
- [ ] **Design token audit pass** — replace hardcoded hex with dark-mode-aware values across all dashboard components
- [ ] **Empty states for leads and calls pages** — highest-value polish for new users pre-first-call

### Add After Core Is Working (P2)

- [ ] **Chart dark mode** — dependent on ThemeProvider; add after layout dark mode is confirmed stable
- [ ] **Identity/change-aversion section** — emotional copy block, requires copy iteration
- [ ] **Revenue calculator widget** — high conversion value but needs design iteration
- [ ] **"Before vs After" workflow comparison** — repositioning content, lower urgency than objection blockers
- [ ] **Flyout and modal dark mode** — second-pass dark mode after layout + pages are done
- [ ] **Loading skeleton screens** — polish pass after dark mode is stable
- [ ] **Button loading states + hover micro-interactions** — polish layer

### Defer (P3)

- [ ] **Trade specificity proof block** — FeaturesCarousel already covers "built for the trades"; duplication risk
- [ ] **Anchor-linked section navigation in LandingNav** — low incremental conversion value vs added nav complexity
- [ ] **Full mobile responsiveness deep audit** — app is already mobile-responsive; deep audit is ongoing maintenance

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| FAQ Accordion (objections 1–5) | HIGH | LOW | P1 |
| Hero/CTA copy reframe | HIGH | LOW | P1 |
| "Sounds robotic" counter block | HIGH | LOW | P1 |
| "Cost of inaction" stat block | HIGH | LOW | P1 |
| ThemeProvider + theme toggle | HIGH | LOW | P1 |
| Dashboard design token audit (dark mode) | HIGH | HIGH | P1 |
| Empty states (leads, calls) | MED | LOW | P1 |
| "5-minute setup" visual strip | MED | LOW | P2 |
| Trust/hybrid backup badges | MED | LOW | P2 |
| Chart dark mode (CSS variables) | MED | MED | P2 |
| Identity/change-aversion section | HIGH | MED | P2 |
| Flyout/modal dark mode | MED | MED | P2 |
| Revenue calculator widget | HIGH | MED | P2 |
| Loading skeleton screens | MED | LOW | P2 |
| Button loading states | MED | LOW | P2 |
| Hover micro-interactions on stat cards | LOW | LOW | P2 |
| "Before vs After" comparison strip | MED | MED | P3 |
| Trade specificity proof block | MED | LOW | P3 |
| Anchor-linked landing nav | LOW | MED | P3 |

---

## Implementation Notes for Roadmap

### Landing Page Section Insertion Order

Recommended order after research:

```
HeroSection (existing — copy update only)
ScrollLinePath {
  HowItWorksSection (existing)
  FeaturesCarousel (existing)
  [NEW] ObjectionCounterSection — 5 objection counter cards in responsive grid
  SocialProofSection (existing)
}
[NEW] FAQSection — Radix Accordion, just above FinalCTASection
FinalCTASection (existing — copy update only)
```

The "full-stack workflow positioning strip" can be a lightweight addition inside the existing HowItWorksSection header or between HeroSection and ScrollLinePath — no new section needed if the copy is updated in HowItWorks heading.

### Dark Mode Implementation Order (Phase Within Milestone)

1. Add ThemeProvider to root layout (`src/app/layout.js`) + `suppressHydrationWarning` on `<html>`
2. Add theme toggle to DashboardSidebar
3. Update `layout.js` background, GridTexture, system banners (ImpersonationBanner, BillingWarningBanner, TrialCountdownBanner)
4. Update `design-tokens.js` with dark variants for all tokens (card.base, glass.topBar, heading, body, focus, selected)
5. Audit and update all dashboard page components file by file
6. Audit and update flyouts, modals, settings panels
7. Update AnalyticsCharts.jsx chart colors to `var(--chart-N)` CSS variable routing
8. Test status badges, urgency pills, all colored UI elements in dark mode

### Chart CSS Variable Routing (Confirmed Pattern)

The globals.css already defines:
- Light: `--chart-1: oklch(0.646 0.222 41.116)` through `--chart-5`
- Dark: `.dark { --chart-1: oklch(0.488 0.243 264.376) }` through `--chart-5`

`AnalyticsCharts.jsx` currently uses hardcoded hex. Migration: replace with `color: "var(--chart-1)"` in the Recharts chartConfig. Axis colors, grid line colors, and tooltip backgrounds also need CSS variable routing.

---

## Sources

- PROBLEMS.md — 5 objections and counters sourced directly from owner/market research (PRIMARY SOURCE)
- Codebase reading — all existing sections inventoried from `src/app/(public)/page.js` and `src/app/components/landing/`
- `src/app/globals.css` — confirmed existing `.dark` CSS variable set (oklch tokens, chart-1 through chart-5 dark values already defined)
- `package.json` — `next-themes ^0.4.6` already installed; confirmed via grep
- shadcn/ui chart docs (https://ui.shadcn.com/docs/components/radix/chart) — CSS variable approach for Recharts dark mode (HIGH confidence)
- WebSearch: SaaS landing page objection patterns 2025 — FAQ as objection handler, 48% exit stat, "cost of inaction" technique
- WebSearch: AI receptionist trust objections — 85-95% blind test stat for modern AI voice quality
- WebSearch: Revenue calculator widget 40%+ conversion rate (MEDIUM confidence — from Outgrow marketing material, not independent research)
- WebSearch: empty state UX best practices 2025, micro-interaction patterns, skeleton screen vs spinner guidance

---

*Feature research for: v5.0 Trust & Polish — Objection-Busting Landing Page, Dark Mode, UI/UX Polish*
*Researched: 2026-04-13*

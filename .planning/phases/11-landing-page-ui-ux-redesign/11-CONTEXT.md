# Phase 11: Landing Page UI/UX Redesign - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Redesign and polish the Hero, How It Works, Features, Social Proof, and Final CTA sections of the public landing page for premium, handcrafted quality. Uses 21st.dev components (Magic MCP), Spline 3D, and performance-first implementation. No new pages — this is a visual/UX overhaul of the existing `(public)/page.js` landing sections.

</domain>

<decisions>
## Implementation Decisions

### Hero Section
- **D-01:** Full-width split layout — text/copy on the left, interactive 3D Spline scene on the right
- **D-02:** Use 21st.dev `serafim/splite` component (https://21st.dev/community/components/serafim/splite/default) for the 3D interactive element
- **D-03:** Spline model: https://app.spline.design/community/file/2ce6351a-d7a5-4c4e-bf13-75bc9f841891 — reacts to cursor movement
- **D-04:** Keep existing RotatingText headline: "Every Call You Miss Is a Job Your [Competitor/Revenue/Customer] Just Won"
- **D-05:** Keep avatar stack + "Trusted by 500+ trades businesses" social proof micro-line
- **D-06:** Keep current CTA pair: "Start My 5-Minute Setup" (primary) + "Watch Demo" (secondary)
- **D-07:** Mobile: lightweight static fallback replaces 3D scene (no Spline on mobile)

### How It Works Section
- **D-08:** Animated scenario walkthrough with tabs — single card/panel that transitions between 3 steps (Call → Triage → Book)
- **D-09:** Tab navigation at top ([01] [02] [03]) with active state indication
- **D-10:** Each step shows icon + text content; transitions between steps are animated
- **D-11:** Keep Lucide icons only (Phone, Brain, CalendarCheck) — no custom illustrations
- **D-12:** Keep existing step content/copy and "Start My 5-Minute Setup" CTA below

### Features Section
- **D-13:** Use Aceternity bento grid from 21st.dev (https://21st.dev/community/components/aceternity/bento-grid/default) as the layout foundation
- **D-14:** 5 feature cards (adding 1 new):
  1. "The Night Shift, Sorted" — 24/7 AI answering
  2. "The Golden Lead Filter" — smart triage
  3. "Money in the Calendar" — instant booking
  4. "Instant Emergency SMS" — priority alerts
  5. "Speaks Their Language" — multi-language support (NEW — leverages existing next-intl/i18n from Phase 1)
- **D-15:** Each card retains "justification" line tying feature to ROI

### Social Proof Section
- **D-16:** Polish existing 3-card testimonial layout — upgraded hover effects, refined metric badges, subtle animations
- **D-17:** Keep existing testimonial content (Dave R., James K., Mark T.)

### Final CTA Section
- **D-18:** Polish existing Heritage Copper CTA — upgraded gradient treatment, subtle animation, stronger visual impact
- **D-19:** Keep existing copy and AuthAwareCTA component

### Section Transitions & Animations
- **D-20:** Keep smooth scroll reveal animations (AnimatedSection with Framer Motion intersection observer)
- **D-21:** Maintain existing section color flow: Dark hero → White (How It Works) → Stone (Features) → Dark (Social Proof) → Copper (CTA)

### Performance Requirements (applies to ALL sections)
- **D-22:** All 21st.dev components implemented via Next.js dynamic imports for lazy loading and aggressive code-splitting
- **D-23:** Core Web Vitals priority: high LCP, low CLS — height reservations for dynamically loaded components
- **D-24:** Mobile devices: automatically simplify or swap heavy interactive elements for lightweight static fallbacks
- **D-25:** Loading skeletons must match final component dimensions to prevent layout shift

### Claude's Discretion
- Exact Aceternity bento grid column/row spans for the 5-card layout
- Card hover micro-interactions and animation timing
- How It Works tab transition animation style (slide, fade, etc.)
- Typography refinements within established palette
- Social Proof card hover effect details
- Final CTA gradient/animation specifics
- Responsive breakpoints and mobile adaptations
- 5th feature card visual treatment and copy

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 21st.dev Components
- `serafim/splite` — https://21st.dev/community/components/serafim/splite/default — Spline 3D scene wrapper for Hero section
- `aceternity/bento-grid` — https://21st.dev/community/components/aceternity/bento-grid/default — Bento grid layout for Features section

### Spline 3D Model
- Hero 3D model — https://app.spline.design/community/file/2ce6351a-d7a5-4c4e-bf13-75bc9f841891 — cursor-reactive model for right side of hero

### Prior phase context
- `.planning/phases/02.1-public-marketing-landing-page/02.1-CONTEXT.md` — Original landing page design decisions: Heritage Copper palette, Foreman voice, AnimatedSection pattern, section structure
- `.planning/phases/06-public-marketing-pages/06-CONTEXT.md` — Public marketing pages: nav, footer, visual continuity decisions

### Existing landing components
- `src/app/(public)/page.js` — Page composition with dynamic imports and loading skeletons
- `src/app/components/landing/HeroSection.jsx` — Current hero with Spline 3D + RotatingText
- `src/app/components/landing/HowItWorksSection.jsx` — Current 3-step cards
- `src/app/components/landing/FeaturesGrid.jsx` — Current bento grid with 4 cards
- `src/app/components/landing/SocialProofSection.jsx` — Current 3-card testimonials
- `src/app/components/landing/FinalCTASection.jsx` — Current Heritage Copper CTA
- `src/app/components/landing/AnimatedSection.jsx` — Scroll animation wrapper (reuse)
- `src/app/components/landing/RotatingText.jsx` — 21st.dev text rotation (keep)
- `src/app/components/landing/SplineScene.jsx` — Spline 3D loader (update with new model)
- `src/components/landing/AuthAwareCTA.jsx` — Auth-aware CTA button (keep)

### Design tokens
- `src/app/globals.css` — Landing color tokens: landing-surface (#F5F5F4), landing-dark (#0F172A), landing-accent (#C2410C), landing-muted (#475569), landing-success (#166534)

### Project context
- `.planning/PROJECT.md` — Core value prop, target market (home service SMEs)
- `.planning/REQUIREMENTS.md` — Landing page requirements context

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AnimatedSection` — Scroll-triggered fade/slide with direction prop (up/left/right), stagger support, useReducedMotion. Keep as-is.
- `RotatingText` — 21st.dev staggered text rotation. Already dynamically imported. Keep as-is.
- `SplineScene` — Spline 3D lazy loader with fallback. Update to use new model URL and serafim/splite component.
- `AuthAwareCTA` — Auth-aware CTA button with hero/cta variants. Keep as-is.
- Landing color tokens in globals.css — full palette already defined.
- shadcn components: Button, Card, Badge — available for card styling.

### Established Patterns
- Next.js dynamic imports with explicit loading skeletons (height-matched) for CLS prevention
- Server Components default; `'use client'` only where interactivity required
- Framer Motion v12 for scroll animations via AnimatedSection/AnimatedStagger/AnimatedItem
- Tailwind v4 CSS-based theming with `@import 'tailwindcss'`

### Integration Points
- `src/app/(public)/page.js` — Composition file imports all sections; update dynamic imports for new components
- Loading skeletons in page.js must be updated to match new component dimensions
- `src/app/components/landing/` — All section components live here; update in-place
- No nav/footer changes needed (handled by Phase 6 `(public)` layout)

</code_context>

<specifics>
## Specific Ideas

- Hero 3D model must react to cursor movement — the interactivity is the selling point
- Aceternity bento grid should feel premium, not cookie-cutter — the grid structure from 21st.dev is a starting point, not a copy
- "Speaks Their Language" 5th feature leverages existing multi-language capability (next-intl, Phase 1) — makes it a differentiator on the landing page
- Performance is non-negotiable: every 21st.dev component gets dynamic imported, every interactive element gets a mobile fallback
- The overall feel should be handcrafted and premium, not generic AI-generated (per user preference)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-landing-page-ui-ux-redesign*
*Context gathered: 2026-03-23*

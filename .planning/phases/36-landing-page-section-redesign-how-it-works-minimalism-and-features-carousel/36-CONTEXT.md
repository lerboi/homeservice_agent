# Phase 36: Landing Page Section Redesign — How It Works Minimalism & Features Carousel - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Redesign the How It Works and Features sections on the landing page. Strip How It Works down to minimal full-viewport scroll-animated steps. Convert Features into a horizontal carousel with an icon-based nav grid below. Both sections must be fully mobile responsive.

</domain>

<decisions>
## Implementation Decisions

### How It Works — Scroll Animation Style
- **D-01:** Full-viewport steps — each of the 4 steps occupies roughly one viewport height. As the user scrolls, content fades/slides in cleanly.
- **D-02:** Apple product page style — professional, minimal, lots of white space. Not AI-generated looking.
- **D-03:** Alternating backgrounds between steps (e.g. white → off-white → white) to give each viewport a distinct section feel.
- **D-04:** Illustration-style shape icons — not standard Lucide line icons. Larger, bolder, simple illustration feel.
- **D-05:** Centered text alignment — step number, icon, title, description all centered on the page.
- **D-06:** Simple fade-up entrance animation as each step scrolls into view.
- **D-07:** One-sentence descriptions only — extremely concise. E.g. "Your phone rings. Voco picks up instantly."
- **D-08:** Keep the 4 steps from Phase 32: "Call Comes In", "AI Handles the Conversation", "Job Is Booked", "Your Dashboard Does the Rest"

### How It Works — Animation Polish (avoid "boring text site")
- **D-09:** Staggered fade-in — step number appears first, then icon, then title, then description with slight delays (200-300ms between each element)
- **D-10:** Subtle parallax on icons/illustrations — slight vertical offset difference between icon and text creates depth as user scrolls
- **D-11:** Soft background shapes — very faint geometric shapes (circles, rounded rects) in the background of each viewport step for texture
- **D-12:** Gradient accent lines — thin copper/orange gradient dividers or accent strokes near each step. Claude's discretion on exact placement.

### Features — Carousel Behavior
- **D-13:** 2-3 feature cards visible at once on desktop. Active/centered card slightly larger than peek cards on either side.
- **D-14:** Navigation: swipe (mobile) + arrows (desktop) + icon nav grid below. All three methods work.
- **D-15:** Auto-advance on a timer. Pauses when user interacts.
- **D-16:** Keep the micro SVG/CSS visuals from Phase 32 inside each carousel card. Micro visual animations trigger when card scrolls into view.
- **D-17:** Feature card copy trimmed slightly from Phase 32 — shorter descriptions, same structure.
- **D-18:** Smooth momentum scrolling with snap points.

### Features — Icon Nav Grid
- **D-19:** Single horizontal row of 7 icons below the carousel.
- **D-20:** Active state: underline dot below the currently visible/selected feature icon.
- **D-21:** Always show text labels under each icon — not hover-only.
- **D-22:** Mobile adaptation required — may change layout (e.g. horizontally scrollable row, or 2-row grid) to fit smaller screens. Claude's discretion on mobile treatment.

### Content & Copy
- **D-23:** How It Works: one sentence per step. Extremely minimal.
- **D-24:** Features carousel: slightly trimmed descriptions from Phase 32. Same content, tighter wording.
- **D-25:** Keep eyebrow + heading pattern for both section headings.

### Performance & Accessibility
- **D-26:** All animations transform/opacity only — no backdrop-blur on large surfaces (carried from Phase 32)
- **D-27:** CSS keyframe animations wrapped in `prefers-reduced-motion: no-preference` (carried from Phase 32)
- **D-28:** Fully mobile responsive — both sections must work well on mobile viewports

### Claude's Discretion
- Exact parallax offset values and stagger timing
- Background shape styles and opacity levels
- Gradient accent line placement and styling
- Carousel auto-advance interval
- Mobile icon nav grid adaptation (scrollable row vs 2-row grid vs other)
- Illustration icon style — simple geometric shapes with brand colors, professional feel
- Carousel arrow button styling
- Exact card scale difference between active and peek cards

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Landing Page Components
- `src/app/components/landing/HowItWorksSticky.jsx` — Current 4-step sticky scroll implementation (being replaced)
- `src/app/components/landing/HowItWorksSection.jsx` — Server component wrapper with lazy loading
- `src/app/components/landing/FeaturesGrid.jsx` — Current 2-col grid with 7 inline micro visual components (being replaced)
- `src/app/components/landing/AnimatedSection.jsx` — Reusable fade/stagger animation components
- `src/app/components/landing/ScrollLinePath.jsx` — Copper sine wave spanning HowItWorks→Features→SocialProof (may need adjustment)
- `src/app/(public)/page.js` — Landing page composition with dynamic imports and loading skeletons

### Phase 32 Context (prior redesign)
- `.planning/phases/32-landing-page-redesign-conversion-optimized-sections/32-CONTEXT.md` — Prior design decisions
- `.planning/phases/32-landing-page-redesign-conversion-optimized-sections/32-UI-SPEC.md` — Prior UI spec with color tokens, spacing, typography

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AnimatedSection` / `AnimatedStagger` / `AnimatedItem` — fade/stagger animation wrappers (reuse for fade-up)
- 7 inline micro visual components in `FeaturesGrid.jsx` — LanguageHeroVisual, AnsweringVisual, BookingVisual, SMSVisual, AnalyticsVisual, LeadVisual, CalSyncVisual (carry into carousel cards)
- `ScrollLinePath.jsx` — self-adjusting sine wave via dynamic measurement (will need re-tuning for new section heights)
- Framer Motion available in project — useScroll, useTransform for scroll-driven animations

### Established Patterns
- Dynamic imports with loading skeletons for landing page sections
- 'use client' on interactive components, Server Components for wrappers
- Tailwind CSS with design tokens: `#F97316` (brand orange), `#0F172A` (dark text), `#475569` (body text), `#FAFAF9` / `#F5F5F4` (section backgrounds)
- IntersectionObserver pattern used in current HowItWorksSticky for scroll-based card activation

### Integration Points
- `page.js` dynamic imports need skeleton updates for new section layouts
- ScrollLinePath wraps HowItWorks + Features + SocialProof — section height changes affect path calculation
- Section IDs (`how-it-works`, `features`) must be preserved for anchor links and ScrollLinePath boundary detection

</code_context>

<specifics>
## Specific Ideas

- Apple product page style for How It Works — professional, spacious, each step breathes
- Must not look "AI generated" — tasteful, professional design
- Animation polish is critical to avoid "boring text site" feel — staggered reveals, parallax, background shapes
- Mobile responsiveness explicitly called out as important for all components

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 36-landing-page-section-redesign-how-it-works-minimalism-and-features-carousel*
*Context gathered: 2026-04-01*

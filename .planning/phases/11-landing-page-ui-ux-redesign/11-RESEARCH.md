# Phase 11: Landing Page UI/UX Redesign - Research

**Researched:** 2026-03-23
**Domain:** Next.js 16 / React 19 landing page UI — Spline 3D, Framer Motion v12, Tailwind v4, Aceternity bento grid, animated tabs
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Hero Section**
- D-01: Full-width split layout — text/copy on the left, interactive 3D Spline scene on the right
- D-02: Use 21st.dev `serafim/splite` component for the 3D interactive element
- D-03: Spline model: https://app.spline.design/community/file/2ce6351a-d7a5-4c4e-bf13-75bc9f841891 — reacts to cursor movement
- D-04: Keep existing RotatingText headline: "Every Call You Miss Is a Job Your [Competitor/Revenue/Customer] Just Won"
- D-05: Keep avatar stack + "Trusted by 500+ trades businesses" social proof micro-line
- D-06: Keep current CTA pair: "Start My 5-Minute Setup" (primary) + "Watch Demo" (secondary)
- D-07: Mobile: lightweight static fallback replaces 3D scene (no Spline on mobile)

**How It Works Section**
- D-08: Animated scenario walkthrough with tabs — single card/panel that transitions between 3 steps (Call → Triage → Book)
- D-09: Tab navigation at top ([01] [02] [03]) with active state indication
- D-10: Each step shows icon + text content; transitions between steps are animated
- D-11: Keep Lucide icons only (Phone, Brain, CalendarCheck) — no custom illustrations
- D-12: Keep existing step content/copy and "Start My 5-Minute Setup" CTA below

**Features Section**
- D-13: Use Aceternity bento grid from 21st.dev as the layout foundation
- D-14: 5 feature cards (adding 1 new): Night Shift Sorted, Golden Lead Filter, Money in Calendar, Instant Emergency SMS, Speaks Their Language (NEW)
- D-15: Each card retains "justification" line tying feature to ROI

**Social Proof Section**
- D-16: Polish existing 3-card testimonial layout — upgraded hover effects, refined metric badges, subtle animations
- D-17: Keep existing testimonial content (Dave R., James K., Mark T.)

**Final CTA Section**
- D-18: Polish existing Heritage Copper CTA — upgraded gradient treatment, subtle animation, stronger visual impact
- D-19: Keep existing copy and AuthAwareCTA component

**Section Transitions & Animations**
- D-20: Keep smooth scroll reveal animations (AnimatedSection with Framer Motion intersection observer)
- D-21: Maintain existing section color flow: Dark hero → White (How It Works) → Stone (Features) → Dark (Social Proof) → Copper (CTA)

**Performance Requirements (applies to ALL sections)**
- D-22: All 21st.dev components implemented via Next.js dynamic imports for lazy loading and aggressive code-splitting
- D-23: Core Web Vitals priority: high LCP, low CLS — height reservations for dynamically loaded components
- D-24: Mobile devices: automatically simplify or swap heavy interactive elements for lightweight static fallbacks
- D-25: Loading skeletons must match final component dimensions to prevent layout shift

### Claude's Discretion
- Exact Aceternity bento grid column/row spans for the 5-card layout
- Card hover micro-interactions and animation timing
- How It Works tab transition animation style (slide, fade, etc.)
- Typography refinements within established palette
- Social Proof card hover effect details
- Final CTA gradient/animation specifics
- Responsive breakpoints and mobile adaptations
- 5th feature card visual treatment and copy

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

## Summary

Phase 11 is a visual/UX overhaul of five existing landing page sections. No new pages, no new routes, no backend changes. Every section component lives in `src/app/components/landing/` and is composed in `src/app/(public)/page.js`. The scope is:

1. **Hero:** Polish + update Spline model URL to the cursor-reactive community scene (D-03). The split layout (D-01) and the serafim/splite wrapper (D-02) are already partially implemented — the existing `SplineScene.jsx` uses `React.lazy + Suspense` over `@splinetool/react-spline`. The update is a model URL swap and any tightening of the serafim/splite pattern.

2. **How It Works:** Full rebuild of the 3-card stacked layout into a tabbed single-panel component. This is the most technically non-trivial task: a `'use client'` component (`HowItWorksTabs`) with animated panel transitions via Framer Motion `AnimatePresence`, accessible `role="tablist"` markup, and `useReducedMotion` guard.

3. **Features:** Add the 5th card ("Speaks Their Language") and refine bento grid spans. The existing 4-card `FeaturesGrid.jsx` already uses a custom bento structure — the Aceternity grid is a reference, not a copy-paste.

4. **Social Proof + Final CTA:** Hover polish, upgraded gradient depth, subtle CSS keyframe animation on CTA background. Low-risk polishing work.

The stack is fully determined: Next.js 16 + React 19, Tailwind v4 CSS-based theming, Framer Motion v12 (confirmed React 19 compatible as of v12), `@splinetool/react-spline` v4.1.0, Lucide React, shadcn (new-york/neutral). No new npm packages needed.

**Primary recommendation:** Work section-by-section, starting with HowItWorksTabs (highest complexity, pure client component), then FeaturesGrid (grid math), then Hero (model URL + mobile fallback), then polish-only sections last.

---

## Standard Stack

### Core (all already installed — no new packages needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | ^16.1.7 | App router, dynamic imports, Image optimization | Project framework — locked |
| react | ^19.0.0 | Component model | Project framework — locked |
| framer-motion | ^12.38.0 | AnimatePresence, AnimatedSection, whileInView | Already in use; v12 confirmed React 19 compatible |
| @splinetool/react-spline | ^4.1.0 | Spline 3D scene rendering | Already installed; used in SplineScene.jsx |
| @splinetool/runtime | ^1.12.70 | Spline runtime peer dep | Already installed |
| tailwindcss | ^4.2.2 | Utility-first styling, Tailwind v4 CSS-based config | Project standard |
| lucide-react | ^0.577.0 | Icons (Phone, Brain, CalendarCheck, Globe) | Project standard; D-11 mandates Lucide only |
| radix-ui | ^1.4.3 | Tab primitives available if needed | Available — but plain `useState` tabs are simpler for this use case |

### No New Dependencies Required

All required packages are already installed. The plan MUST NOT add new npm packages. Build from installed stack.

**Version verification (run on 2026-03-23):**
- `@splinetool/react-spline`: installed ^4.1.0, npm registry latest 4.1.0 — current
- `framer-motion`: installed ^12.38.0, npm registry latest 12.38.0 — current

---

## Architecture Patterns

### Recommended File Structure (no changes to directory layout)

```
src/app/(public)/
└── page.js                        # Update dynamic import skeletons only

src/app/components/landing/
├── AnimatedSection.jsx            # KEEP AS-IS — do not modify
├── RotatingText.jsx               # KEEP AS-IS — do not modify
├── HeroSection.jsx                # UPDATE — model URL, minor polish
├── SplineScene.jsx                # UPDATE — serafim/splite pattern tightening
├── HowItWorksSection.jsx          # REBUILD — add HowItWorksTabs sub-component
├── HowItWorksTabs.jsx             # NEW — 'use client' tab state + AnimatePresence
├── FeaturesGrid.jsx               # UPDATE — add 5th card, update spans
├── SocialProofSection.jsx         # UPDATE — hover polish
└── FinalCTASection.jsx            # UPDATE — gradient depth + CSS keyframe

src/components/landing/
└── AuthAwareCTA.js                # KEEP AS-IS — do not modify
```

### Pattern 1: HowItWorksTabs — Animated Tab Panel

The How It Works section requires a `'use client'` component because tab state is interactive. The outer `HowItWorksSection` stays as a Server Component; it renders the section shell and imports the tabs sub-component via `dynamic()` with a skeleton.

**Tab state pattern** — plain `useState`, not Radix UI Tabs (simpler, less overhead for 3 tabs):

```jsx
// Source: project pattern — ibelick.com sliding tab indicator approach
'use client';
import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

export function HowItWorksTabs({ steps }) {
  const [active, setActive] = useState(0);
  const prefersReducedMotion = useReducedMotion();

  return (
    <div>
      {/* Tab bar — role="tablist" for accessibility (D in UI-SPEC) */}
      <div role="tablist" className="flex gap-2 mb-8">
        {steps.map((step, i) => (
          <button
            key={step.number}
            role="tab"
            aria-selected={active === i}
            aria-controls={`panel-${step.number}`}
            onClick={() => setActive(i)}
            className={`...`}
          >
            {step.number}
          </button>
        ))}
      </div>

      {/* Single panel with AnimatePresence for exit/enter */}
      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          id={`panel-${steps[active].number}`}
          role="tabpanel"
          initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? {} : { opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          {/* Step content: icon, title, description, italic detail */}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
```

**Key details:**
- `AnimatePresence mode="wait"` — exit animation completes before enter begins. Prevents overlap.
- `key={active}` on the motion.div — required for AnimatePresence to detect the change and run exit + enter animations.
- `prefersReducedMotion` — when true, `initial={false}` and `exit={}` skip all animation entirely.
- Duration 250ms ease-out per UI-SPEC interaction contract.
- Dynamic import skeleton for `HowItWorksTabs` in `HowItWorksSection`: a simple `h-64 rounded-2xl bg-[#F5F5F4]/50` block matching the panel height.

### Pattern 2: SplineScene — serafim/splite Pattern

The existing `SplineScene.jsx` already implements the serafim/splite approach (React.lazy + Suspense over `@splinetool/react-spline`). The update is:
1. Update the `SPLINE_SCENE_URL` in `HeroSection.jsx` to the new community model.
2. The new Spline community model URL format is: `https://prod.spline.design/[scene-id]/scene.splinecode` — the community file ID `2ce6351a-d7a5-4c4e-bf13-75bc9f841891` maps to a prod.spline.design URL. The implementor MUST load the Spline community page to extract the `.splinecode` URL before committing code.
3. The `SplineScene` component passes `scene` URL to `<Spline />`. Cursor reactivity is built into the Spline scene itself — no `onSplineMouseMove` handler needed in React; the Spline runtime handles it internally via scene-configured interactions.
4. Mobile fallback: `block md:hidden` for `<Image>` and `hidden md:block` for `<SplineScene>` — existing pattern, keep unchanged.
5. CLS prevention: SplineScene container uses `aspect-[4/3]` — never `height: auto`. Loading skeleton must also use `aspect-[4/3]`.

```jsx
// Source: existing SplineScene.jsx + react-spline README
'use client';
import { Suspense, lazy } from 'react';
const Spline = lazy(() => import('@splinetool/react-spline'));

export function SplineScene({ scene, className = '' }) {
  return (
    <Suspense fallback={<SpinnerFallback className={className} />}>
      <Spline scene={scene} className={className} />
    </Suspense>
  );
}
```

**Cursor reactivity:** The Spline scene at the D-03 URL was built in Spline with "Follow Mouse" or cursor-reactive interactions baked into the model. No additional React event wiring needed — the Spline runtime handles pointer events on the canvas.

### Pattern 3: Bento Grid 5-Card Layout

The existing `FeaturesGrid.jsx` uses a 6-column bento grid (`grid-cols-6` on md+). The locked spans from the UI-SPEC:

```
Card 1 "Night Shift, Sorted"   → md:col-span-4 md:row-span-2  (hero dark card)
Card 2 "Golden Lead Filter"    → md:col-span-2
Card 3 "Money in Calendar"     → md:col-span-2
Card 4 "Instant Emergency SMS" → md:col-span-4
Card 5 "Speaks Their Language" → md:col-span-2 (light card)
```

Row math: Cards 1-3 share rows 1-2 (card 1 spans both rows); cards 4-5 share row 3. Total: 3 grid rows.

Grid skeleton in page.js must be updated to match:
```jsx
// Old skeleton (4 cards):
<div className="md:col-span-4 md:row-span-2 h-64 ..." />
<div className="md:col-span-2 h-40 ..." />
<div className="md:col-span-2 h-40 ..." />
<div className="md:col-span-4 h-40 ..." />

// New skeleton (5 cards — add the 5th):
<div className="md:col-span-4 md:row-span-2 h-64 ..." />
<div className="md:col-span-2 h-40 ..." />
<div className="md:col-span-2 h-40 ..." />
<div className="md:col-span-4 h-40 ..." />
<div className="md:col-span-2 h-40 ..." />  {/* NEW */}
```

5th card visual treatment: light card (`bg-white`), Globe icon from Lucide, language badge or small flag treatment. Body copy from UI-SPEC copywriting contract. Justification line: "Every caller heard. Every job captured."

### Pattern 4: Final CTA Background Animation

CSS keyframe for the slow-moving radial gradient shift (Claude's discretion — 10s infinite):

```css
/* In FinalCTASection.jsx inline or globals.css */
@keyframes cta-glow-shift {
  0%, 100% { opacity: 0.6; transform: scale(1); }
  50%       { opacity: 1;   transform: scale(1.05); }
}
```

```jsx
// Animated overlay div on top of static #C2410C base
<div
  className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.12),transparent_50%)]"
  style={{ animation: prefersReducedMotion ? 'none' : 'cta-glow-shift 10s ease-in-out infinite' }}
/>
```

This requires `FinalCTASection` to become `'use client'` (for `useReducedMotion`) OR inline a CSS `@media (prefers-reduced-motion)` rule. Simpler approach: add `@media (prefers-reduced-motion: reduce)` in globals.css targeting the keyframe class, keeping `FinalCTASection` as a Server Component.

### Anti-Patterns to Avoid

- **Using Radix UI Tabs for the How It Works panel:** Adds unnecessary markup complexity. Plain `useState` + `AnimatePresence` is cleaner for 3 tabs.
- **Server Component for HowItWorksTabs:** Tab state requires `'use client'`. The outer section can be a Server Component; only the interactive sub-component needs client boundary.
- **Auto-advancing tabs:** UI-SPEC explicitly disables auto-advance. Do not add an `useEffect` interval.
- **Using `mode="popLayout"` in AnimatePresence for tabs:** Use `mode="wait"` so exit completes before enter. `popLayout` is for list reordering.
- **Spline on mobile:** Hard block with CSS (`hidden md:block`) — not JS conditional. The static `<Image>` is always rendered on mobile; Spline bundle must never load on small screens.
- **Height: auto on SplineScene container:** Causes CLS. Use `aspect-[4/3]` container always.
- **Animating `height` or `width` on the bento cards:** Triggers layout. Use `transform: translateY` (hover lift only) for GPU-accelerated hover effects.
- **Making FinalCTASection 'use client' unnecessarily:** Use CSS `@media (prefers-reduced-motion: reduce)` to disable the keyframe instead of useReducedMotion hook, to keep it a Server Component.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Animated tab panel exit/enter | Custom CSS transitions with class toggling | `AnimatePresence mode="wait"` from framer-motion | Already installed; handles exit animation before enter; cleaner state model |
| Spline 3D lazy loader | Custom webpack lazy-split | `React.lazy + Suspense` (existing SplineScene.jsx) | Already implemented correctly |
| Reduced-motion detection | `window.matchMedia` event listener | `useReducedMotion()` from framer-motion | Already project pattern (AnimatedSection.jsx) |
| Bento grid layout | CSS Grid hand-coded | Tailwind `grid-cols-6 col-span-*` utilities | Existing pattern in FeaturesGrid.jsx |
| Tab active indicator animation | JavaScript measuring DOM widths | Simple `border-b-2` or filled pill via conditional class + Tailwind `transition-colors` | 3 fixed-width tabs — no need for dynamic measurement; simpler = more reliable |

**Key insight:** This phase has no new npm packages and no novel patterns. Everything needed is already installed and partially implemented. The implementation work is refinement, rebuilding the How It Works component, and adding the 5th feature card.

---

## Common Pitfalls

### Pitfall 1: Spline Scene URL — Community File vs. Production URL
**What goes wrong:** Developer uses the community browser URL (`https://app.spline.design/community/file/2ce6351a...`) as the `scene` prop. The Spline runtime rejects it — it expects a `.splinecode` file URL (`https://prod.spline.design/[ID]/scene.splinecode`).
**Why it happens:** The community file URL is a viewer page URL, not the exportable scene URL.
**How to avoid:** Open the community model in the Spline editor, click "Export → Web" or inspect the embed code to get the `prod.spline.design/...scene.splinecode` URL. The current model in `HeroSection.jsx` (`SPLINE_SCENE_URL`) can serve as the format reference.
**Warning signs:** `SplineScene` fallback spinner shows indefinitely; browser network tab shows 404 on the scene URL.

### Pitfall 2: AnimatePresence Requires `key` on Direct Child
**What goes wrong:** `AnimatePresence` doesn't trigger exit animation — panels replace instantly.
**Why it happens:** `AnimatePresence` tracks children by `key` prop. If the motion.div doesn't have `key={active}`, React may reuse the DOM node and AnimatePresence sees no unmount event.
**How to avoid:** Always set `key={active}` (or `key={step.number}`) on the direct child of `AnimatePresence`.
**Warning signs:** Tab content changes without transition animation.

### Pitfall 3: CLS from Spline Container Missing Aspect Ratio
**What goes wrong:** Spline container collapses to 0 height while loading, causing a large layout shift when the scene renders.
**Why it happens:** `@splinetool/react-spline` renders a `<canvas>` that has no intrinsic size until the scene loads.
**How to avoid:** Always wrap `SplineScene` in a container with `aspect-[4/3]` (or explicit height). The loading skeleton must also use `aspect-[4/3]`.
**Warning signs:** CLS score > 0.1 in Lighthouse; page jumps when Spline loads.

### Pitfall 4: FeaturesGrid Missing `md:grid-rows-3` for Row Span
**What goes wrong:** `md:row-span-2` on card 1 doesn't work — card 1 squishes to 1 row.
**Why it happens:** CSS Grid `grid-template-rows` must be explicitly declared (or use `auto-rows`) for `row-span` to work as expected with varying-height content.
**How to avoid:** The existing code uses `md:row-span-2` without explicit row count — it works because `auto` rows expand to content. Adding a 5th card should not break this, but verify visually. If needed, add `md:grid-rows-3` to the grid container.
**Warning signs:** Card 1 doesn't span 2 rows; cards 2-3 don't sit beside card 1 on desktop.

### Pitfall 5: Bento Grid Skeleton in page.js — Forgetting the 5th Card
**What goes wrong:** FeaturesGrid renders 5 cards but the loading skeleton only shows 4 — causes significant CLS shift when the 5th card appears.
**Why it happens:** `page.js` loading skeleton and the actual component are defined separately. Adding a card to the component without updating the skeleton breaks the height reservation.
**How to avoid:** Update the FeaturesGrid loading skeleton in `page.js` simultaneously with the component change. The new row for cards 4+5 (both in the 3rd grid row) adds approximately 160px height.
**Warning signs:** Layout shift on Features section load in Lighthouse.

### Pitfall 6: HowItWorksSection — Server vs. Client Boundary
**What goes wrong:** Dev adds `useState` directly to `HowItWorksSection.jsx` and adds `'use client'` to the top — this pulls all child components (including static content) into the client bundle unnecessarily.
**Why it happens:** React requires the nearest ancestor with `'use client'` to have the state.
**How to avoid:** Keep `HowItWorksSection.jsx` as a Server Component. Create a separate `HowItWorksTabs.jsx` with `'use client'`. `HowItWorksSection` renders the section shell (heading, CTA) and imports `HowItWorksTabs` via `dynamic()`. Only the tab interaction logic is client-side.
**Warning signs:** `HowItWorksSection` file starts with `'use client'`; entire section in client bundle.

### Pitfall 7: `FinalCTASection` Animation Breaking Server Component
**What goes wrong:** Adding `useReducedMotion` hook to `FinalCTASection` forces it to become `'use client'`.
**Why it happens:** React hooks require client boundary.
**How to avoid:** Implement the CTA background animation as a pure CSS keyframe. Add `@media (prefers-reduced-motion: reduce) { .cta-animate { animation: none !important; } }` to `globals.css`. The component stays a Server Component. Apply the animation via a utility class name, not inline styles.
**Warning signs:** `FinalCTASection.jsx` has `'use client'` at the top.

---

## Code Examples

Verified patterns from existing codebase and official sources:

### AnimatePresence for Tab Panels (framer-motion v12)
```jsx
// Source: framer-motion docs — AnimatePresence mode="wait"
// Project pattern: framer-motion already used in AnimatedSection.jsx
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

const prefersReducedMotion = useReducedMotion();

<AnimatePresence mode="wait">
  <motion.div
    key={activeStep}
    role="tabpanel"
    id={`panel-${steps[activeStep].number}`}
    initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={prefersReducedMotion ? {} : { opacity: 0, y: -8 }}
    transition={{ duration: 0.25, ease: 'easeOut' }}
  >
    {/* panel content */}
  </motion.div>
</AnimatePresence>
```

### Accessible Tab Bar (ARIA pattern)
```jsx
// Source: UI-SPEC accessibility contract + ARIA authoring practices
<div role="tablist" aria-label="How it works steps" className="flex gap-2">
  {steps.map((step, i) => (
    <button
      key={step.number}
      role="tab"
      aria-selected={active === i}
      aria-controls={`panel-${step.number}`}
      id={`tab-${step.number}`}
      tabIndex={active === i ? 0 : -1}
      onClick={() => setActive(i)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') setActive((active + 1) % steps.length);
        if (e.key === 'ArrowLeft') setActive((active - 1 + steps.length) % steps.length);
      }}
      className={`...`}
    >
      {step.number}
    </button>
  ))}
</div>
```

### Dynamic Import with Height-Matched Skeleton (CLS prevention)
```jsx
// Source: existing page.js pattern — project convention
const HowItWorksSection = dynamic(
  () => import('@/app/components/landing/HowItWorksSection').then((m) => m.HowItWorksSection),
  {
    loading: () => (
      <section className="bg-white py-20 md:py-28 px-6" aria-hidden="true">
        <div className="max-w-5xl mx-auto">
          {/* skeleton head */}
          <div className="text-center mb-16">
            <div className="h-4 w-24 bg-black/10 rounded mx-auto mb-3" />
            <div className="h-10 w-80 bg-black/10 rounded mx-auto" />
          </div>
          {/* skeleton tabs row */}
          <div className="flex gap-2 mb-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 w-28 bg-black/10 rounded-full" />
            ))}
          </div>
          {/* skeleton panel */}
          <div className="h-48 rounded-2xl bg-[#F5F5F4]/50 border border-black/[0.04]" />
        </div>
      </section>
    ),
  }
);
```

### Spline Scene — Correct Component Shape
```jsx
// Source: existing SplineScene.jsx + @splinetool/react-spline v4.1.0 README
'use client';
import { Suspense, lazy } from 'react';
const Spline = lazy(() => import('@splinetool/react-spline'));

export function SplineScene({ scene, className = '' }) {
  return (
    <Suspense fallback={<LoadingSpinner className={className} />}>
      <Spline scene={scene} className={className} />
    </Suspense>
  );
}
// scene prop format: 'https://prod.spline.design/[ID]/scene.splinecode'
// Cursor reactivity: built into the Spline scene — no React event handlers needed
```

### 5th Bento Card — "Speaks Their Language"
```jsx
// Source: Claude's discretion (UI-SPEC) + existing BentoCard pattern
{
  icon: Globe,       // lucide-react Globe icon
  title: 'Speaks Their Language',
  body: "Your AI receptionist answers in Spanish, Singlish, or English — switching language the moment it hears the caller. No frustrated hang-ups, no lost leads.",
  justification: 'Every caller heard. Every job captured.',
  span: 'md:col-span-2',
  variant: 'default',  // light card (bg-white), same as cards 2 and 3
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `import { motion } from "framer-motion"` | `import { motion } from "motion/react"` (new package name) | Motion v11+ | Project uses framer-motion import — both work in v12, framer-motion is the backward-compatible alias |
| Radix UI Tabs for animated tab panels | AnimatePresence + useState for simple 3-tab cases | —— | Less overhead; no Radix import needed for this use case |
| Tailwind v3 `tailwind.config.js` | Tailwind v4 `@import 'tailwindcss'` in CSS | v4.0 (2025) | Project already on v4 — all utilities work, no config file |

**Deprecated/outdated:**
- `@splinetool/react-spline` v2.x: Used a different import path and older Spline runtime. Project is on v4.1.0 — current.
- framer-motion `AnimatePresence exitBeforeEnter`: Replaced by `mode="wait"` in v6+. Project is on v12 — use `mode="wait"`.

---

## Open Questions

1. **Spline Community Model — Production URL**
   - What we know: The community file ID is `2ce6351a-d7a5-4c4e-bf13-75bc9f841891`. The current model in HeroSection uses URL `https://prod.spline.design/PyzDhpQ9E5f1E3MT/scene.splinecode`.
   - What's unclear: The `prod.spline.design` URL for the NEW community model cannot be retrieved from the community browser URL alone — requires loading the Spline editor or embed page.
   - Recommendation: Wave 0 task — the implementor must visit `https://app.spline.design/community/file/2ce6351a-d7a5-4c4e-bf13-75bc9f841891`, click "Open in Editor" or "Export", and copy the `.splinecode` URL. This URL goes into `HeroSection.jsx` as `SPLINE_SCENE_URL`. If the URL cannot be extracted, the existing model is kept as fallback per D-07 mobile-fallback spirit.

2. **FinalCTASection — Server Component vs. 'use client' for animation**
   - What we know: Adding a CSS keyframe via globals.css keeps it a Server Component. The `@media (prefers-reduced-motion: reduce)` CSS rule disables it without JS.
   - What's unclear: Whether the existing `FinalCTASection.jsx` imports `AnimatedSection` (which is already a client component) affects the bundle.
   - Recommendation: Keep `FinalCTASection` as a Server Component. Add the animated overlay div with a named CSS class (`cta-bg-pulse`). Add `@media (prefers-reduced-motion: reduce) { .cta-bg-pulse { animation: none !important; } }` to globals.css.

3. **HowItWorksSection Skeleton Height**
   - What we know: The current skeleton uses 3 × `h-32` rows (~128px each = ~384px + gap). The new tabbed design has a tabs bar + single panel. Approximate height: tabs bar (~56px) + panel (~220px) = ~276px + section padding.
   - What's unclear: Exact rendered height of the tab panel depends on content.
   - Recommendation: Wave 0 task — build the component first, measure its rendered height (browser DevTools), then update the skeleton to match. Initial estimate: `h-16` for tabs bar + `h-56` for panel.

---

## Environment Availability

Step 2.6: The phase is entirely code changes within an existing Next.js project. No external services, databases, or CLI tools required beyond what's already running.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build + dev server | Yes | v22.16.0 | — |
| npm | Package install | Yes | 10.9.2 | — |
| @splinetool/react-spline | SplineScene component | Yes (installed) | ^4.1.0 | Static image fallback (D-07) |
| framer-motion | AnimatedSection, AnimatePresence | Yes (installed) | ^12.38.0 | — |
| lucide-react | Icons (Globe for card 5) | Yes (installed) | ^0.577.0 | — |
| /public/images/dashboard-mockup.png | Mobile Spline fallback image | Yes (file exists) | — | — |

**Missing dependencies with no fallback:** None.

---

## Validation Architecture

nyquist_validation is enabled (config.json `workflow.nyquist_validation: true`).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 29.7 |
| Config file | `jest.config.js` (exists) |
| Quick run command | `node node_modules/jest-cli/bin/jest.js --testPathPattern=landing` |
| Full suite command | `node node_modules/jest-cli/bin/jest.js` |

### Phase Nature — UI-Only, No Logic Tests Required

This phase modifies React component markup, CSS classes, and animation patterns. There is no business logic, API routes, database queries, or state management that requires unit testing. The validation strategy for this phase is:

| Behavior | Test Type | Automated Command | Rationale |
|----------|-----------|-------------------|-----------|
| Tab state changes correctly | manual | — | DOM interaction; no pure-function logic to unit test |
| AnimatePresence renders without error | smoke | `node node_modules/jest-cli/bin/jest.js --testPathPattern=landing` | If existing landing tests pass, component renders |
| Bento grid renders 5 cards | smoke | snapshot or render test | Can add if required |
| No console errors on render | smoke | manual (dev server) | |

**Recommendation:** This phase does not need new test files. Existing test infrastructure (if any landing page tests exist) covers render integrity. The primary validation is:
1. Visual inspection in dev server — all 5 sections render correctly
2. Lighthouse Core Web Vitals check — CLS < 0.1, LCP acceptable
3. Keyboard navigation test — How It Works tabs navigable via Tab + Arrow keys
4. Mobile viewport check — Spline static fallback renders; no 3D bundle on mobile

### Wave 0 Gaps

None — no new test files are required. The implementation work is UI-only. If a smoke test for the 5-card bento grid is desired, it can be added as a Wave 0 item by the planner.

---

## Project Constraints (from CLAUDE.md)

CLAUDE.md does not exist in the project root. Project conventions are derived from STATE.md accumulated decisions and existing code patterns:

| Constraint | Source | Rule |
|-----------|--------|------|
| Tailwind v4 syntax | STATE.md Phase 02-03 | Use `@import 'tailwindcss'` in CSS; no tailwind.config.js; `@tailwindcss/postcss` plugin |
| shadcn CLI v4 | STATE.md Phase 02-03 | `--style` flag removed; components.json exists with new-york/neutral/cssVariables |
| Server Components default | STATE.md Phase 02.1-02 | `'use client'` only where interactivity required |
| `use client` for client work | STATE.md Phase 02.1-02 | All section components are Server Components — client animation delegated to AnimatedSection |
| Framer Motion pattern | STATE.md Phase 02.1-01 | `useReducedMotion` with `initial={false}` skips animation state entirely — existing AnimatedSection pattern |
| Jest invocation on Windows | STATE.md Phase 01 | `node node_modules/jest-cli/bin/jest.js` not `.bin/jest` shim |
| Hex color values | STATE.md Phase 02.1-01 | Landing tokens use hex values (not oklch) — #F5F5F4, #0F172A, #C2410C, #475569, #166534 |
| Dynamic imports + skeletons | STATE.md Phase 02.1-02 | All section components dynamically imported with explicit CLS-preventing skeletons |
| UI quality standard | user memory (feedback_ui_quality.md) | UI must feel handcrafted, not AI-generated; reference 21st.dev quality, ui-ux-pro-max skill level |

---

## Sources

### Primary (HIGH confidence)
- Existing project source files (`HeroSection.jsx`, `FeaturesGrid.jsx`, `HowItWorksSection.jsx`, `SplineScene.jsx`, `AnimatedSection.jsx`, `FinalCTASection.jsx`, `SocialProofSection.jsx`, `AuthAwareCTA.js`, `page.js`, `globals.css`) — direct code inspection
- `11-CONTEXT.md` — locked decisions D-01 through D-25
- `11-UI-SPEC.md` — interaction contracts, color/typography/spacing system, component inventory, accessibility contracts, copywriting contract
- `package.json` — installed package versions (verified 2026-03-23)
- `@splinetool/react-spline` README (github.com/splinetool/react-spline) — props API, scene URL format, onLoad pattern

### Secondary (MEDIUM confidence)
- framer-motion v12 / React 19 compatibility — confirmed by motion.dev upgrade guide and community reports (motion.dev/docs/react-upgrade-guide)
- AnimatePresence `mode="wait"` pattern — framer-motion docs (framer.com/motion/animation)
- Animated sliding tab indicator — ibelick.com (verified against React/Tailwind CSS pattern)
- Aceternity bento-grid — ui.aceternity.com + 21st.dev component viewer (verified structure)

### Tertiary (LOW confidence)
- Spline community file → prod.spline.design URL mapping: unable to extract production `.splinecode` URL from the community file without loading the Spline editor. The URL format is HIGH confidence (`prod.spline.design/[ID]/scene.splinecode`); the specific ID for this model requires manual extraction.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed, versions verified against npm registry
- Architecture: HIGH — patterns derived directly from existing project code
- Pitfalls: HIGH — derived from existing implementation patterns and known Framer Motion/Spline gotchas
- Spline model URL: LOW — cannot extract production URL without loading Spline editor

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (stable libraries; Spline URL must be extracted fresh at implementation time)

# Phase 36: Landing Page Section Redesign — How It Works Minimalism & Features Carousel - Research

**Researched:** 2026-04-01
**Domain:** React/Next.js landing page animation — Framer Motion scroll-driven effects, CSS carousel, micro visual gating
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**How It Works — Scroll Animation Style**
- D-01: Full-viewport steps — each of the 4 steps occupies roughly one viewport height. As the user scrolls, content fades/slides in cleanly.
- D-02: Apple product page style — professional, minimal, lots of white space. Not AI-generated looking.
- D-03: Alternating backgrounds between steps (white → off-white → white → off-white).
- D-04: Illustration-style shape icons — not standard Lucide line icons. Larger, bolder, simple illustration feel.
- D-05: Centered text alignment — step number, icon, title, description all centered on the page.
- D-06: Simple fade-up entrance animation as each step scrolls into view.
- D-07: One-sentence descriptions only — extremely concise.
- D-08: Keep the 4 steps from Phase 32: "Call Comes In", "AI Handles the Conversation", "Job Is Booked", "Your Dashboard Does the Rest"

**How It Works — Animation Polish**
- D-09: Staggered fade-in — step number first, then icon, then title, then description (200-300ms between each element).
- D-10: Subtle parallax on icons/illustrations — slight vertical offset difference between icon and text.
- D-11: Soft background shapes — very faint geometric shapes (circles, rounded rects) in the background.
- D-12: Gradient accent lines — thin copper/orange gradient dividers or accent strokes near each step.

**Features — Carousel Behavior**
- D-13: 2-3 feature cards visible at once on desktop. Active/centered card slightly larger than peek cards.
- D-14: Navigation: swipe (mobile) + arrows (desktop) + icon nav grid below. All three work.
- D-15: Auto-advance on a timer. Pauses when user interacts.
- D-16: Keep the micro SVG/CSS visuals from Phase 32 inside each carousel card. Trigger when card is active.
- D-17: Feature card copy trimmed slightly from Phase 32 — shorter descriptions, same structure.
- D-18: Smooth momentum scrolling with snap points.

**Features — Icon Nav Grid**
- D-19: Single horizontal row of 7 icons below the carousel.
- D-20: Active state: underline dot below the currently visible/selected feature icon.
- D-21: Always show text labels under each icon — not hover-only.
- D-22: Mobile adaptation required — horizontally scrollable row (Claude's discretion).

**Content & Copy**
- D-23: How It Works: one sentence per step. Extremely minimal.
- D-24: Features carousel: slightly trimmed descriptions from Phase 32.
- D-25: Keep eyebrow + heading pattern for both section headings.

**Performance & Accessibility**
- D-26: All animations transform/opacity only — no backdrop-blur on large surfaces.
- D-27: CSS keyframe animations wrapped in `prefers-reduced-motion: no-preference`.
- D-28: Fully mobile responsive — both sections must work well on mobile viewports.

### Claude's Discretion
- Exact parallax offset values and stagger timing
- Background shape styles and opacity levels
- Gradient accent line placement and styling
- Carousel auto-advance interval
- Mobile icon nav grid adaptation (scrollable row vs 2-row grid vs other)
- Illustration icon style — simple geometric shapes with brand colors, professional feel
- Carousel arrow button styling
- Exact card scale difference between active and peek cards

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

## Summary

Phase 36 replaces two landing page sections. `HowItWorksSticky.jsx` (sticky folder-stack cards) is replaced by `HowItWorksMinimal.jsx` (four full-viewport scroll steps, each `min-h-screen`, centered content with Framer Motion staggered fade-up and per-step parallax). `FeaturesGrid.jsx` (2-column static grid) is replaced by `FeaturesCarousel.jsx` (horizontal carousel with active/peek cards, swipe + arrows + icon nav grid, auto-advance, micro visual gating).

The project already has Framer Motion 12.x (`framer-motion: ^12.38.0`) and uses its `useInView`, `useScroll`, and `useTransform` hooks in `AnimatedSection.jsx` and `ScrollLinePath.jsx`. The carousel is implemented without an external carousel library — pure CSS scroll-snap with JS state for activeIndex. This is already the approach specified in the UI-SPEC and is consistent with the codebase's preference for minimal dependencies.

The ScrollLinePath copper sine wave spanning HowItWorks → Features → SocialProof uses `getBoundingClientRect` for dynamic measurement, so it self-adjusts to new section heights — no manual pixel edits required, but the executor must verify visual alignment after both sections are replaced.

**Primary recommendation:** Build `HowItWorksMinimal` and `FeaturesCarousel` as new files, then swap imports in `HowItWorksSection.jsx` and `page.js`. Do not modify `AnimatedSection.jsx` or `ScrollLinePath.jsx` — reuse them unchanged.

---

## Standard Stack

### Core (already installed — no new dependencies required)

| Library | Version (installed) | Purpose | Why Used |
|---------|-------------------|---------|----------|
| `framer-motion` | ^12.38.0 | Scroll-driven animation, parallax, stagger | Already in project; `useInView`, `useScroll`, `useTransform`, `useReducedMotion` all available |
| `lucide-react` | ^0.577.0 | Icons for illustration icon containers + carousel nav arrows | Already in project; Phase 32 icons carried forward |
| `next` | ^16.1.7 | Dynamic imports, Server/Client component boundary | Already in project |
| `react` | ^19.0.0 | Hooks: `useRef`, `useState`, `useEffect`, `useCallback` | Already in project |

### No new packages needed

This phase is purely UI replacement within existing infrastructure. The Framer Motion version (12.x) is current and fully supports all required APIs. No installation step required.

**Version verification (npm registry confirmed 2026-04-01):**
- `framer-motion` latest: 12.x — installed version satisfies requirement
- `lucide-react` latest: 0.577.0 — installed version is current

---

## Architecture Patterns

### Recommended Project Structure

```
src/app/components/landing/
├── HowItWorksMinimal.jsx     NEW — full-viewport scroll steps ('use client')
├── FeaturesCarousel.jsx      NEW — horizontal carousel + icon nav ('use client')
├── HowItWorksSection.jsx     MODIFIED — swap HowItWorksSticky import → HowItWorksMinimal
├── HowItWorksSticky.jsx      KEPT (not deleted) — no longer imported
├── FeaturesGrid.jsx          KEPT (not deleted) — no longer imported
├── AnimatedSection.jsx       UNCHANGED — reused for section headings
└── ScrollLinePath.jsx        UNCHANGED — self-adjusts to new heights
src/app/(public)/
└── page.js                   MODIFIED — swap FeaturesGrid import → FeaturesCarousel
```

### Pattern 1: Framer Motion Per-Step Stagger (HowItWorksMinimal)

**What:** Each full-viewport step uses `useInView` with `once: true` to detect when the step enters the viewport. On entry, a `variants`-based stagger animates 5 child elements (number → icon → title → accent line → description) with 200ms delays between each.

**When to use:** Linear scroll-through content where each section should animate once on first view.

**Key implementation note:** Do NOT use `AnimatedStagger` + `AnimatedItem` wrappers here — those use a uniform 50ms stagger. The step requires explicit 200ms delays. Use `motion.div` directly with inline `transition.delay` per element.

```jsx
// Source: Framer Motion docs (useInView) + AnimatedSection.jsx pattern in codebase
const ref = useRef(null);
const isInView = useInView(ref, { once: true, margin: '-20% 0px -20% 0px' });

const elementVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

// Each element: transition.delay = 0, 0.2, 0.4, 0.6, 0.8
<motion.span variants={elementVariants} initial="hidden" animate={isInView ? "visible" : "hidden"}
             transition={{ delay: 0 }}>{step.number}</motion.span>
<motion.div  variants={elementVariants} transition={{ delay: 0.2 }}>...</motion.div>
```

### Pattern 2: Framer Motion Scroll Parallax (HowItWorksMinimal)

**What:** Per-step scroll progress drives a `translateY` transform on the illustration icon container only. Text has zero parallax.

**When to use:** Only on desktop (`md` breakpoint and above) — disable on mobile per UI-SPEC.

```jsx
// Source: ScrollLinePath.jsx in codebase (useScroll + useTransform pattern)
const stepRef = useRef(null);
const { scrollYProgress } = useScroll({
  target: stepRef,
  offset: ['start end', 'end start'],
});
const iconY = useTransform(scrollYProgress, [0, 1], [-12, 12]);

// Apply only on md+; mobile: set iconY to motionValue(0) or skip useTransform
```

**Mobile disabling:** Check `window.matchMedia('(max-width: 767px)')` in a `useEffect` and conditionally skip the `useTransform` binding. The UI-SPEC specifies parallax disabled on mobile.

### Pattern 3: CSS Scroll-Snap Carousel (FeaturesCarousel)

**What:** Pure CSS `scroll-snap-type: x mandatory` container with `scroll-snap-align: center` on each card. JS tracks `activeIndex` state. No external carousel library.

**When to use:** Always — this is the approach specified in UI-SPEC (D-18). Do not introduce `embla-carousel`, `swiper`, or similar libraries.

```jsx
// Source: Existing FeaturesGrid.jsx mobile scroll pattern + UI-SPEC contract
const trackRef = useRef(null);
const [activeIndex, setActiveIndex] = useState(0);

// Scroll to card programmatically
const scrollToIndex = (idx) => {
  const track = trackRef.current;
  const cards = track?.children;
  if (!cards?.[idx]) return;
  cards[idx].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
};

// Container: overflow-x-auto, scroll-snap-type: x mandatory
// Card: scroll-snap-align: center, transition-all for scale/opacity
```

**IntersectionObserver for activeIndex sync:** Same pattern as the old `HowItWorksSticky` — observe each card with threshold 0.5, update `activeIndex` when a card is ≥50% visible in the scroll container. This keeps the icon nav in sync when the user swipes.

### Pattern 4: Auto-Advance with Pause-on-Interaction

```jsx
const intervalRef = useRef(null);
const [isPaused, setIsPaused] = useState(false);

const startAutoAdvance = () => {
  clearInterval(intervalRef.current);
  intervalRef.current = setInterval(() => {
    setActiveIndex(prev => (prev + 1) % FEATURES.length);
  }, 5000);
};

const handleUserInteraction = () => {
  clearInterval(intervalRef.current);
  // Resume after 8s of inactivity
  setTimeout(startAutoAdvance, 8000);
};

useEffect(() => { startAutoAdvance(); return () => clearInterval(intervalRef.current); }, []);
```

### Pattern 5: Micro Visual Animation Gating

**What:** Pass `isActive` boolean to each micro visual component. Apply `animationPlayState: isActive ? 'running' : 'paused'` to the CSS keyframe animation elements.

**Why it matters:** All 7 micro visuals have CSS `@keyframes` (`langFloat`, `clockSpin`, `barGrow`) that currently run simultaneously in `FeaturesGrid`. In the carousel, only the active card's visual should animate.

```jsx
// Source: FeaturesGrid.jsx micro visual patterns
function AnsweringVisual({ isActive }) {
  return (
    <circle
      style={{ animationPlayState: isActive ? 'running' : 'paused' }}
      // ...
    />
  );
}
```

**Note:** The `style jsx` blocks in micro visuals define `@keyframes` under `@media (prefers-reduced-motion: no-preference)`. This satisfies D-27. The `animationPlayState` approach works correctly even when `prefers-reduced-motion` is active — the animation is simply never started.

### Anti-Patterns to Avoid

- **Don't use `position: sticky` in HowItWorksMinimal.** The old `HowItWorksSticky` used sticky positioning to create the folder-stack effect. The new design uses natural full-viewport scroll — no sticky.
- **Don't remove the `id="how-it-works"` and `id="features"` section IDs.** ScrollLinePath uses `document.getElementById('features')` for path measurement. The anchor link `#how-it-works` is referenced from nav.
- **Don't put `HowItWorksSection`'s outer `<section id="how-it-works">` inside `HowItWorksMinimal`.** The section ID belongs on the outer wrapper in `HowItWorksSection.jsx`, not inside the new component. This preserves the current structural contract.
- **Don't animate `background-color` on large surfaces.** All animations must be `transform` and `opacity` only (D-26). The alternating step backgrounds are static CSS classes, not animated.
- **Don't use `AnimatedStagger` + `AnimatedItem` for the per-step stagger.** Those use 50ms stagger gaps. The per-step contract requires 200ms gaps. Use explicit `transition.delay` on each `motion.div`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scroll-driven animation | Custom rAF loop + scroll listener | Framer Motion `useScroll` + `useTransform` | Already in project; GPU-composited; handles edge cases |
| Reduced motion detection | Custom media query hook | Framer Motion `useReducedMotion()` | Already used in `AnimatedSection.jsx` — consistent pattern |
| Carousel scroll position | Manual `scrollLeft` math | CSS `scroll-snap-type: x mandatory` + `scrollIntoView` | Browser-native momentum, rubber-banding on iOS, snap points |
| Active card detection on swipe | `scroll` event + manual math | `IntersectionObserver` with `rootMargin` on carousel track | Same pattern as existing `HowItWorksSticky` — proven in codebase |
| Touch swipe detection | Custom `touchstart`/`touchend` listeners | CSS `overflow-x: auto` + `-webkit-overflow-scrolling: touch` | Browser handles momentum natively; no JS needed for swipe |

**Key insight:** The existing codebase already solved the hard problems (scroll animation, reduced motion, intersection detection). The task is reorganization and layout, not invention.

---

## Common Pitfalls

### Pitfall 1: ScrollLinePath Misalignment After Section Height Change

**What goes wrong:** The How It Works section changes from ~4× 40vh cards to 4× 100vh (400vh total). The Features section changes from a fixed-height 2-col grid to a carousel. ScrollLinePath measures heights on mount + after 1 second. If sections haven't finished loading within 1 second, measurements are stale.

**Why it happens:** Dynamic imports + hydration can delay section render beyond 1000ms. ScrollLinePath's `setTimeout(measure, 1000)` is a best-effort, not a guarantee.

**How to avoid:** After both new components are implemented, manually verify ScrollLinePath renders correctly at multiple scroll positions. If misaligned: trigger a resize event after the sections mount, or extend the measurement timeout.

**Warning signs:** The copper sine wave appears too short, too long, or visually disconnected from section boundaries.

### Pitfall 2: Framer Motion `useScroll` + `useTransform` on Each of 4 Steps

**What goes wrong:** Creating 4 separate `useScroll` instances (one per step) in a single component causes excessive scroll listener overhead.

**Why it happens:** Each `useScroll` with a `target` ref registers its own scroll event listener.

**How to avoid:** Create the 4 step refs and useScroll calls at the component level (not inside a `.map()` call — hooks must be called at top level). This is unavoidable but acceptable for 4 instances.

**Warning signs:** Console warnings about hook rule violations if placed inside map. Performance degradation on low-end mobile.

### Pitfall 3: Carousel activeIndex Out of Sync with Swipe

**What goes wrong:** User swipes the carousel (CSS scroll-snap handles the animation), but `activeIndex` state doesn't update because there's no JS scroll event listener.

**Why it happens:** CSS scroll-snap scrolls without triggering programmatic state updates.

**How to avoid:** Use `IntersectionObserver` to watch each card with `root: trackRef.current` and `threshold: 0.5`. When a card crosses 50% visibility in the scroll container, set it as active. This is the same pattern used in `HowItWorksSticky.jsx` (line 91-104).

**Warning signs:** Icon nav doesn't update when user swipes manually; active card styling doesn't change.

### Pitfall 4: Micro Visuals All Animating Simultaneously

**What goes wrong:** All 7 micro visual CSS keyframe animations run simultaneously even when their card is off-screen, causing jank on mobile.

**Why it happens:** CSS animations run whenever the element is in the DOM, regardless of whether it's visible in the carousel viewport.

**How to avoid:** Refactor each micro visual function to accept an `isActive: boolean` prop. Apply `style={{ animationPlayState: isActive ? 'running' : 'paused' }}` to every animated element. Call as `<feat.Visual isActive={index === activeIndex} />`.

**Warning signs:** All 7 clock/float/bar animations visible simultaneously when inspecting composited layers.

### Pitfall 5: `min-h-screen` on How It Works Steps Breaking on Mobile

**What goes wrong:** `min-h-screen` uses `100vh`, which on iOS Safari includes the browser chrome height. Steps appear taller than the visual viewport. User sees incomplete steps without realizing they need to scroll.

**Why it happens:** iOS Safari's `100vh` bug — the address bar is included in the viewport height.

**How to avoid:** Use `min-h-screen` as specified (UI-SPEC lock). For a future improvement, `100dvh` (dynamic viewport height) is a CSS-native fix. For this phase, `min-h-screen` is the specified value — do not deviate.

**Warning signs:** Steps look cut off on iOS Safari in testing.

### Pitfall 6: `useRef` Arrays for 4 Step Refs Must Be Pre-Allocated

**What goes wrong:** Using `useRef([])` and assigning via `ref={(el) => (stepRefs.current[i] = el)}` inside a `.map()` is correct. But calling `useScroll({ target: stepRefs.current[0] })` at the top level before the array is populated returns undefined.

**Why it happens:** Refs are populated during render, but hooks run before the DOM is attached.

**How to avoid:** Use 4 individual `useRef(null)` calls at the top level — one per step. This is the recommended pattern for a fixed-length list.

```jsx
const step0Ref = useRef(null);
const step1Ref = useRef(null);
const step2Ref = useRef(null);
const step3Ref = useRef(null);
const stepRefs = [step0Ref, step1Ref, step2Ref, step3Ref];
```

---

## Code Examples

### How It Works Step Structure (from UI-SPEC)

```jsx
// Source: 36-UI-SPEC.md — How It Works Section Layout Contract
<section
  ref={stepRefs[index]}
  className={`relative flex flex-col items-center justify-center min-h-screen
              py-16 md:py-24 lg:py-32 px-6 overflow-hidden
              ${index % 2 === 0 ? 'bg-white' : 'bg-[#FAFAF9]'}`}
>
  {/* Soft background shape */}
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none"
       aria-hidden="true">
    <div className={`w-[280px] h-[280px] md:w-[400px] md:h-[400px] rounded-full ${step.shapeFill}`} />
  </div>

  {/* Centered content stack */}
  <div className="relative z-10 flex flex-col items-center text-center max-w-xl gap-6">
    {/* 1 → step number (delay 0ms) */}
    {/* 2 → illustration icon with parallax (delay 200ms) */}
    {/* 3 → title (delay 400ms) */}
    {/* 4 → gradient accent line: scaleX: 0→1 (delay 600ms) */}
    {/* 5 → description (delay 800ms) */}
  </div>
</section>
```

### Gradient Accent Line (from UI-SPEC)

```jsx
// Source: 36-UI-SPEC.md Color section — Gradient accent lines (D-12)
<motion.div
  className="w-20 h-0.5 rounded-full bg-gradient-to-r from-[#F97316] to-[#FB923C] origin-left"
  initial={{ opacity: 0, scaleX: 0 }}
  animate={isInView ? { opacity: 1, scaleX: 1 } : { opacity: 0, scaleX: 0 }}
  transition={{ delay: 0.6, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
/>
```

### Icon Nav Item (from UI-SPEC)

```jsx
// Source: 36-UI-SPEC.md — Icon nav grid anatomy (D-19, D-20, D-21)
<button
  className={`flex flex-col items-center gap-1.5 px-3 py-2 min-w-[60px] min-h-[44px]
              transition-opacity duration-200
              ${active ? 'opacity-100' : 'opacity-40 hover:opacity-70'}`}
  onClick={() => { setActiveIndex(i); handleUserInteraction(); scrollToIndex(i); }}
  aria-label={`Go to feature: ${feat.title}`}
>
  <LucideIcon className={`w-5 h-5 ${active ? 'text-[#0F172A]' : 'text-[#94A3B8]'}`} />
  <span className={`text-[11px] md:text-xs font-semibold
                    ${active ? 'text-[#0F172A]' : 'text-[#94A3B8]'}`}>
    {label}
  </span>
  <span className={`w-1 h-1 rounded-full bg-[#F97316]
                    transition-opacity duration-200
                    ${active ? 'opacity-100' : 'opacity-0'}`} />
</button>
```

### HowItWorksSection.jsx Import Swap

```jsx
// BEFORE (current):
const HowItWorksSticky = dynamic(
  () => import('./HowItWorksSticky').then((m) => m.HowItWorksSticky), ...
);

// AFTER:
const HowItWorksMinimal = dynamic(
  () => import('./HowItWorksMinimal').then((m) => m.HowItWorksMinimal),
  {
    loading: () => (
      <div>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="min-h-screen bg-white" />
        ))}
      </div>
    ),
  }
);
```

### page.js FeaturesGrid → FeaturesCarousel Swap

```jsx
// BEFORE:
const FeaturesGrid = dynamic(
  () => import('@/app/components/landing/FeaturesGrid').then((m) => m.FeaturesGrid), ...
);
// In JSX: <FeaturesGrid />

// AFTER:
const FeaturesCarousel = dynamic(
  () => import('@/app/components/landing/FeaturesCarousel').then((m) => m.FeaturesCarousel),
  {
    loading: () => (
      <section className="bg-[#FAFAF9] py-20 md:py-28 px-6" aria-hidden="true">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="h-4 w-32 bg-black/10 rounded mx-auto mb-3" />
            <div className="h-10 w-96 bg-black/10 rounded mx-auto" />
          </div>
          <div className="h-[480px] rounded-2xl bg-white border border-stone-200/60 shadow-sm" />
          <div className="mt-6 h-16 rounded-xl bg-white/60" />
        </div>
      </section>
    ),
  }
);
// In JSX: <FeaturesCarousel />
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sticky folder-stack (Phase 32) | Full-viewport scroll steps (Phase 36) | This phase | Simpler DOM, no `position: sticky` complexity, natural scroll behavior |
| 2-col static grid (Phase 32) | Horizontal carousel with icon nav (Phase 36) | This phase | Interactive engagement, progressive disclosure of 7 features |
| Step text: multi-paragraph with extended copy | Step text: one sentence only (D-07/D-23) | This phase | Much cleaner, Apple-like reading experience |
| All micro visuals animate simultaneously | Micro visuals gated by `isActive` prop | This phase | Reduced GPU load, animations only where user attention is |

**Framer Motion v12 notes:**
- `useInView` is stable and available in v12. Signature: `useInView(ref, { once, margin })` — same API used in `AnimatedSection.jsx`.
- `useScroll` + `useTransform` both stable in v12. Used in `ScrollLinePath.jsx`.
- `useReducedMotion()` is stable in v12. Used in `AnimatedSection.jsx` — same import pattern applies.

---

## Integration Points — What Must Not Break

| Integration | What It Does | Risk | Mitigation |
|------------|-------------|------|------------|
| `id="how-it-works"` on outer section | Anchor link from nav; ScrollLinePath measures `#features` relative to container | HIGH — if removed, ScrollLinePath loses reference | Keep ID on `HowItWorksSection.jsx`'s outer `<section>`, not inside `HowItWorksMinimal` |
| `id="features"` on `FeaturesCarousel`'s outer section | ScrollLinePath `document.getElementById('features')` for path measurement | HIGH — if removed, path breaks | Place `id="features"` on the outermost section element in `FeaturesCarousel.jsx` |
| `ScrollLinePath` wrapping in `page.js` | Copper sine wave spans the 3 sections | MEDIUM — heights change, path may misalign | Path self-measures via `getBoundingClientRect` — verify visually after implementation |
| `HowItWorksSection.jsx` CTA button | "See It In Action" → /pricing CTA below the steps | LOW — currently inside `HowItWorksSection.jsx`, not `HowItWorksSticky.jsx` | This CTA is in the wrapper, not the component being replaced. Keep as-is. |
| Dynamic import skeleton in `page.js` | Prevents CLS while section loads | MEDIUM — skeleton shape should approximate new section height | Update `HowItWorksSection` skeleton to `4 × min-h-screen` shapes; `FeaturesCarousel` skeleton to single tall card + icon row |

---

## Environment Availability

Step 2.6: SKIPPED — this phase is purely frontend component replacement within the existing Next.js project. No external CLI tools, databases, or services are required beyond the running dev server.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Not applicable — landing page UI (visual regression only) |
| Config file | No automated test infrastructure for landing components |
| Quick run command | `npm run dev` and manual browser inspection |
| Full suite command | n/a |

Landing page components in this codebase do not have automated tests. Validation is visual + interactive:

### Phase Requirements → Test Map

| Behavior | Test Type | Command / Verification |
|----------|-----------|----------------------|
| How It Works shows 4 full-viewport steps | Manual | Scroll through — each step fills viewport on desktop |
| Step content stagger animates on scroll-in | Manual | Each step: number → icon → title → line → description reveals in order |
| Parallax on icons visible on desktop | Manual | Scroll slowly — icon moves slightly relative to text |
| Parallax disabled on mobile | Manual | Inspect on 375px viewport — icon has no translateY |
| Features carousel shows 3 cards on desktop | Manual | Desktop: active card center, 2 peek cards |
| Swipe on mobile advances carousel | Manual | Touch drag on mobile viewport |
| Arrow buttons advance carousel | Manual | Desktop: click prev/next |
| Icon nav syncs with carousel position | Manual | Swipe carousel — active dot moves |
| Icon nav click scrolls carousel | Manual | Click any icon — carousel scrolls to that card |
| Auto-advance advances every 5s | Manual | Wait 5s — card advances; interact — pauses |
| Micro visuals animate only on active card | Manual | All 7 cards inspected — animations only on visible card |
| `prefers-reduced-motion` stops animations | Manual | Enable reduced motion in OS settings — no animations |
| `id="how-it-works"` preserved | Automated | `grep -r 'how-it-works' src/` |
| `id="features"` preserved | Automated | `grep -r 'id="features"' src/` |
| ScrollLinePath renders correctly | Manual | Scroll full page — copper line follows sections |
| Mobile responsive both sections | Manual | Test at 375px, 768px, 1280px |

### Wave 0 Gaps
None — no automated test infrastructure expected for landing page visual components. All validation is manual browser testing.

---

## Project Constraints (from CLAUDE.md)

| Directive | Implication for This Phase |
|-----------|--------------------------|
| Brand name is "Voco" — not HomeService AI | Step copy and feature card copy must use "Voco" — already specified in UI-SPEC copy contract |
| Keep skills in sync | After implementing, update `public-site-i18n` skill to reflect new components `HowItWorksMinimal` and `FeaturesCarousel` |
| Tech stack: Next.js App Router, Tailwind CSS, shadcn/ui | All new components use Tailwind utility classes, shadcn primitives if needed, App Router `'use client'` directive |
| Framer Motion available | Use for stagger + parallax — already in project |

---

## Open Questions

1. **HowItWorksSection.jsx outer wrapper vs. HowItWorksMinimal inner sections**
   - What we know: The current `HowItWorksSection.jsx` wraps `HowItWorksSticky` inside a single `<section id="how-it-works" className="bg-[#F5F5F4] py-20...">`. The new design requires 4 separate full-viewport steps, each with their own background color.
   - What's unclear: Should `HowItWorksMinimal` render 4 `<section>` elements (each with their own background), or should `HowItWorksSection.jsx` become a thin pass-through and `HowItWorksMinimal` own the entire structure including the `id="how-it-works"` and section heading?
   - Recommendation: `HowItWorksMinimal` should own the full structure — a heading block followed by 4 full-viewport `<section>`-like `<div>` steps. `HowItWorksSection.jsx` becomes a wrapper that renders `<section id="how-it-works">` (thin container, no background) containing `<HowItWorksMinimal />`. This preserves the scroll boundary detection contract.

2. **CTA button in HowItWorksSection.jsx**
   - What we know: The current `HowItWorksSection.jsx` has a "See It In Action" CTA button below `<HowItWorksSticky />`.
   - What's unclear: The UI-SPEC does not mention this CTA — is it still needed?
   - Recommendation: Keep the CTA. It's in the wrapper, not the component being replaced. The UI-SPEC says "no new CTA introduced in this phase" which means the existing one should remain unless the executor decides otherwise.

---

## Sources

### Primary (HIGH confidence)
- `src/app/components/landing/HowItWorksSticky.jsx` — existing implementation patterns (IntersectionObserver, step data structure, color tokens)
- `src/app/components/landing/FeaturesGrid.jsx` — all 7 micro visual implementations, FEATURES data array, CSS keyframe patterns
- `src/app/components/landing/AnimatedSection.jsx` — Framer Motion `useReducedMotion`, `useInView` via `whileInView`, stagger pattern
- `src/app/components/landing/ScrollLinePath.jsx` — `useScroll`, `useTransform`, `getBoundingClientRect` measurement pattern
- `src/app/(public)/page.js` — dynamic import skeleton pattern, section composition
- `src/app/components/landing/HowItWorksSection.jsx` — wrapper structure, existing CTA
- `.planning/phases/36-landing-page-section-redesign-how-it-works-minimalism-and-features-carousel/36-CONTEXT.md` — all locked decisions
- `.planning/phases/36-landing-page-section-redesign-how-it-works-minimalism-and-features-carousel/36-UI-SPEC.md` — complete visual + interaction contract

### Secondary (MEDIUM confidence)
- Framer Motion v12 `useInView`, `useScroll`, `useTransform` — API confirmed stable from existing codebase usage (ScrollLinePath.jsx, AnimatedSection.jsx use these hooks currently)
- CSS `scroll-snap-type: x mandatory` + `scroll-snap-align: center` — confirmed in existing `FeaturesGrid.jsx` mobile pattern (already implemented and working)

### Tertiary (LOW confidence — not needed)
None — all required patterns are confirmed in the existing codebase.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all libraries confirmed installed and in active use
- Architecture patterns: HIGH — all patterns extracted directly from existing codebase implementations
- Pitfalls: HIGH — derived from direct code analysis of components being modified or replaced
- Integration points: HIGH — confirmed by reading all affected files

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable UI libraries, Framer Motion API unlikely to change)

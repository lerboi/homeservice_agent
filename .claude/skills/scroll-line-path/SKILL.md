---
name: scroll-line-path
description: >
  Architectural reference for the decorative SVG scroll-draw line on the landing page — a copper-colored sine wave that progressively draws itself as the user scrolls through the middle sections. Use this skill whenever modifying the scroll line path, adjusting wave amplitude or speed, changing section order on the landing page, debugging the scroll animation, or tuning the line's opacity/color/width. Also use when the user mentions "the line", "scroll path", "SVG animation on the homepage", or asks why the line doesn't align with a section.
---

# Scroll Line Path System

A decorative copper sine wave that draws itself as the user scrolls through the middle of the home page. The wave is **single-segment**: it starts at the Features boundary dot (at FeaturesCarousel top, `#features` anchor) and continues to the bottom of the wrapper. Phase 48.1: wraps exactly 3 children (IntegrationsStrip, CostOfSilenceBlock, FeaturesCarousel). There is no wave above the dot.

## File Locations

| File | Role |
|------|------|
| `src/app/components/landing/ScrollLinePath.jsx` | The component — SVG, measurement, animation, wave builder |
| `src/app/(public)/page.js` | Integration — wraps exactly 3 sections as children (Phase 48.1) |

## Architecture

### Page Integration

`ScrollLinePath` wraps exactly **3 children** in this JSX order (Phase 48.1 — source of truth: `src/app/(public)/page.js`):

```jsx
<HeroSection />          {/* static, outside ScrollLinePath */}
<AudioDemoSection />     {/* dynamic, outside ScrollLinePath */}
<ScrollLinePath>
  <IntegrationsStrip />  {/* Section 3 — inside wave */}
  <CostOfSilenceBlock /> {/* Section 4 — inside wave */}
  <FeaturesCarousel />   {/* Section 5 — inside wave, owns id="features" */}
</ScrollLinePath>
<YouStayInControlSection /> {/* OUTSIDE ScrollLinePath — dark pull quote creates CLS boundary */}
<FAQSection />
<FinalCTASection />
```

**WARNING: Do NOT add `id="features"` removal or rename** — the copper wave dot anchors on this element. FeaturesCarousel's outer `<section id="features">` must be preserved.

Historical note (Phase 47 → 48.1): previously wrapped 4 children (HowItWorksSection, BeyondReceptionistSection, FeaturesCarousel, SocialProofSection). Phase 48.1 deleted HowItWorks, BeyondReceptionist, and SocialProof; added IntegrationsStrip and CostOfSilenceBlock. `id="testimonials"` (previously on SocialProofSection) no longer exists — ScrollLinePath's 65%-height fallback for the `crossings` array handles this gracefully. Expected post-48.1 behavior: no `#testimonials` element, wave still draws correctly.

**Sections after `</ScrollLinePath>`** (YouStayInControlSection, FAQSection, FinalCTASection) are NOT threaded by the line. The wave ends at the bottom of the wrapper.

### CSS Stacking (critical — do not change without understanding this)

The line renders **between** section backgrounds and section content:

1. Section `<section>` elements are **non-positioned** (no `relative`) → backgrounds paint in normal flow
2. The SVG is `position: absolute; z-index: 0` → paints ABOVE section backgrounds
3. Section inner `<div class="relative z-[1] max-w-5xl">` → paints ABOVE the SVG

**Result:** section background → SVG line → cards/text

**If the line overlaps content:** a section probably has `relative` on its `<section>` tag. Remove it — only the inner `<div>` should have `relative z-[1]`.

**If the line disappears:** a section probably lost `relative z-[1]` on its inner content div.

### How the SVG Works

The component uses **real pixel coordinates** (not a stretched viewBox). On mount and resize, it:

1. Measures the container's `offsetWidth` (`w`) and `offsetHeight` (`h`)
2. Finds `#features` and `#testimonials` elements to get their exact Y positions (`featuresY`, `testimonialsY`)
3. Builds the SVG path using `buildSineWave()` with real pixel values
4. Sets the SVG `width`, `height`, and `viewBox` to match the container exactly

This avoids all squishing/stretching issues from `preserveAspectRatio`.

### The Wave Path (single-segment, starts at Features dot)

```
startY = featuresY + 60          // dot position
endY   = h                       // bottom of wrapper
amp    = Math.min(512 + 120, (w - 48) / 2)   // amplitude
cx     = w / 2                   // horizontal centerline
```

`buildSineWave(cx, amp, startY, endY, crossings)` generates a cubic-Bézier-approximated sine wave from `startY` to `endY`. Segments divide dynamically:

```
count = Math.max(Math.round(span / 400), 1)
```

Each segment is half a wave: alternates left/right peaks at `cx ± amp`, with control points at 33% and 67% of the segment height for smooth curvature. `dir` flips each segment so peaks alternate.

**Crossings** (intermediate Y positions where the wave must pass through the centerline) are filtered to only those between `startY` and `endY`. Previously this was `testimonialsY` (from `SocialProofSection id="testimonials"`). Post-Phase 48.1: `SocialProofSection` is deleted, so `#testimonials` no longer exists. `ScrollLinePath` falls back to a default crossing at 65% of wrapper height — this is expected behavior and requires no code change.

### The Dot

One copper dot at `featuresY + 60` (the IntegrationsStrip → CostOfSilenceBlock → FeaturesCarousel boundary region — top of FeaturesCarousel). Two concentric circles:

- Filled: `r="5"`, `fill="#F97316"`, `fillOpacity="0.6"`
- Ring: `r="13"`, `stroke="#F97316"`, `strokeWidth="1.5"`, `strokeOpacity="0.15"`

Fades in via `featuresDotOpacity` = `useTransform(scrollYProgress, [Math.max(featuresDotFrac - 0.06, 0), featuresDotFrac], [0, 1])` — appears 6% before reaching the dot's scroll position, fully opaque at the dot.

### Three Rendered Layers

| Layer | strokeWidth | Opacity | Purpose |
|-------|-------------|---------|---------|
| Ghost trail | 1.5 | 0.04 | Static full path — faint route preview |
| Glow | 14 | 0.035 | Animated draw — soft bloom behind the line |
| Main line | 2 | Gradient 0.12–0.4 | Animated draw — the visible copper line |

The main line uses `<linearGradient id="slpGrad">` (vertical `y1="0" y2="1"`) with 4 stops:

- 0%: `#F97316` @ 0.12
- 30%: `#F97316` @ 0.30
- 70%: `#F97316` @ 0.25
- 100%: `#F97316` @ 0.40

### Scroll Animation

```js
useScroll({ target: containerRef, offset: ['start 0.85', 'end 0.5'] })
```

- **Start**: drawing begins when container top reaches 85% of viewport
- **End**: drawing completes when container bottom reaches 50% of viewport
- `featuresDotFrac = (featuresY + 60) / h` — the normalized progress at which the dot sits (default 0.4 if measurement fails)
- `pathLength = useTransform(scrollYProgress, [featuresDotFrac, 1], [0, 1])` — draw only begins once scroll reaches the dot
- `pathOpacity = useTransform(scrollYProgress, [featuresDotFrac, min(featuresDotFrac + 0.03, 1), 0.85, 0.95], [0, 1, 1, 0.5])` — fades in across a 3% scroll window after the dot, holds, then softens in the last 10%

## Updating

### Wave too fast/slow

Edit the `offset` array in `useScroll`:
- `'start 0.85'` → lower number = starts earlier (faster)
- `'end 0.5'` → higher number = finishes later (slower)

### Wave amplitude (how wide it swings)

Edit `const waveAmp = Math.min(512 + 120, (w - 48) / 2)`:
- `512` = half of max-w-5xl content width
- `120` = overshoot beyond content edges
- Increase 120 for wider swings, decrease for tighter

### Wave frequency (how many curves)

Edit `buildSineWave`: `const count = Math.max(Math.round(span / 400), 1)`
- `400` = pixels per half-wave. Lower = more waves. Higher = fewer, wider waves.

### Dot position

Edit `dotCy = featuresY + 60`
- Increase to move dot further below the Features section top

### Line color

All three layers use `#F97316` (copper). The gradient `#slpGrad` controls the main line's varying opacity.

### Section added or removed (inside ScrollLinePath)

1. Add/remove the section from the `<ScrollLinePath>` wrapper in `page.js`
2. Child identity doesn't change wave geometry — only **measured Y positions** (`featuresY`, `testimonialsY`) matter. If the new section shifts either anchor up or down, the wave repositions automatically on measure.
3. If you add a new id-bearing anchor that the wave must cross, add a `document.getElementById('new-id')` measurement in `ScrollLinePath.jsx` and include its Y in the `crossings` array passed to `buildSineWave`. The crossings must be in ascending Y order.

### Sections reordered (inside ScrollLinePath)

Reorder the children in `page.js`. As long as `#features` and `#testimonials` anchor ids remain on the correct sections, the wave repositions via the measurement pass. If a reordering changes which section carries `#features`, rebind the id accordingly — the dot anchors on `#features`.

## Performance

- **Mobile**: Hidden entirely (`hidden md:block`)
- **Reduced motion**: Returns children only, no SVG
- **GPU compositing**: `pathLength` only animates `stroke-dashoffset`
- **No layout impact**: absolute positioned, pointer-events-none
- **Lazy measurement**: SVG not rendered until `dims !== null` (after first measurement)

## Debugging

**Line doesn't appear**: Check (1) `ScrollLinePath` wraps sections in `page.js`, (2) `md:block` — desktop only, (3) sections don't have `relative` on their `<section>` tag, (4) sections have `relative z-[1]` on inner content div, (5) `#features` element exists (dot+wave start depend on it).

**Line overlaps cards**: A section's `<section>` element has `relative` — remove it. Only the inner `<div class="max-w-5xl">` should be positioned.

**Line draws too fast**: Increase the second offset value (e.g., `'end 0.3'` → `'end 0.5'`).

**Dot in wrong position**: Check that `#features` element exists and is the correct `<section>` tag. The dot is placed at `featuresY + 60` pixels.

**Wave looks wrong after layout change**: The measurements happen on mount + 100ms + 1000ms delays. If sections load later (heavy dynamic imports — several ScrollLinePath children use `next/dynamic`), add another `setTimeout(measure, ...)` or trigger a re-measure.

**Wave appears at top of wrapper or dot is at position 0**: `#features` is missing. `featuresY` defaults to 0. Verify `FeaturesCarousel.jsx` outer `<section>` still has `id="features"` — **do NOT remove this id**. The copper wave dot and wave start-point depend entirely on this element.

**No `#testimonials` element (post-Phase 48.1)**: This is expected. `SocialProofSection` was deleted in Phase 48.1. ScrollLinePath falls back to a 65% crossing — no fix needed. Do not add a fake `id="testimonials"` element.

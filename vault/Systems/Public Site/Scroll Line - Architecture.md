---
type: system
system: Public Site
status: pending-rebuild
description: "ScrollLinePath wraps exactly 3 children in this JSX order (Phase 48.1 — source of truth: src/app/(public)/page.js): Covers: Page Integration; CSS Stacking (critical — do not change without understanding this); How the SVG Works; The Wave Path (single-segment, starts at Features dot); The Dot; Three "
source: .claude/skills/scroll-line-path/SKILL.md § Architecture
migrated: 2026-11-23
verified:
tags: [voco/system/public-site]
---

# Architecture

Part of [[Public Site]]. Migrated verbatim from the `scroll-line-path` skill; check `verified` before trusting details.

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

---
name: scroll-line-path
description: >
  Architectural reference for the decorative SVG scroll-draw line on the landing page — a copper-colored sine wave that progressively draws itself as the user scrolls from How It Works through to the Get Started CTA. Use this skill whenever modifying the scroll line path, adjusting wave amplitude or speed, changing section order on the landing page, debugging the scroll animation, or tuning the line's opacity/color/width. Also use when the user mentions "the line", "scroll path", "SVG animation on the homepage", or asks why the line doesn't align with a section.
---

# Scroll Line Path System

A decorative copper sine wave that draws itself as the user scrolls through the home page, connecting How It Works → Features → Social Proof, then pointing at the Get Started CTA below.

## File Locations

| File | Role |
|------|------|
| `src/app/components/landing/ScrollLinePath.jsx` | The component — SVG, measurement, animation, wave builder |
| `src/app/(public)/page.js` | Integration — wraps 3 sections as children |

## Architecture

### Page Integration

`ScrollLinePath` wraps the 3 middle sections. FinalCTASection sits **outside** the wrapper so the line ends pointing at it:

```jsx
<ScrollLinePath>
  <HowItWorksSection />
  <FeaturesGrid />
  <SocialProofSection />
</ScrollLinePath>
<FinalCTASection />
```

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

1. Measures the container's `offsetWidth` and `offsetHeight`
2. Finds `#features` and `#testimonials` elements to get their exact Y positions
3. Builds the SVG path using `buildSineWave()` with real pixel values
4. Sets the SVG `width`, `height`, and `viewBox` to match the container exactly

This avoids all squishing/stretching issues from `preserveAspectRatio`.

### The Wave Path

`buildSineWave(cx, amp, totalH, crossings)` generates a smooth sine wave:

- **cx**: center X (viewport width / 2)
- **amp**: amplitude — 632px (512px content half-width + 120px overshoot)
- **totalH**: container height in pixels
- **crossings**: array of Y positions where the wave must pass through center `[featuresY+60, testimonialsY]`

The wave crosses center (x=cx) at:
- y=0 (start, below hero)
- featuresY + 60 (dot position, How It Works → Features boundary)
- testimonialsY (Features → Social Proof boundary)
- totalH (end, pointing at CTA)

Between crossings, the function calculates ~1 half-wave per 400px. Each half-wave is a cubic bezier from center → peak → center, alternating left/right.

### The Dot

One copper dot at the How It Works → Features boundary (60px below the `#features` element top). Two circles: solid fill (r=5, 60% opacity) and glow ring (r=13, 15% opacity). Fades in as the scroll-draw line reaches it.

### Three Rendered Layers

| Layer | strokeWidth | Opacity | Purpose |
|-------|-------------|---------|---------|
| Ghost trail | 1.5 | 4% | Static full path — faint route preview |
| Glow | 14 | 3.5% | Animated draw — soft bloom behind the line |
| Main line | 2 | Gradient 12–40% | Animated draw — the visible copper line |

The main line uses `<linearGradient id="slpGrad">` varying opacity along the Y axis.

### Scroll Animation

```js
useScroll({ target: containerRef, offset: ['start 0.85', 'end 0.5'] })
```

- **Start**: drawing begins when container top reaches 85% of viewport (user scrolls into How It Works)
- **End**: drawing completes when container bottom reaches 50% of viewport (halfway through scrolling past)
- `pathLength` maps `scrollYProgress [0, 1]` → `[0, 1]`
- Line opacity fades in at 5-10% progress, fades slightly at 85-95%

## Updating

### Wave too fast/slow

Edit the `offset` array in `useScroll`:
- `'start 0.85'` → lower number = starts earlier (faster)
- `'end 0.5'` → higher number = finishes later (slower)

### Wave amplitude (how wide it swings)

Edit line 88: `const waveAmp = Math.min(512 + 120, (w - 48) / 2)`
- `512` = half of max-w-5xl content width
- `120` = overshoot beyond content edges
- Increase 120 for wider swings, decrease for tighter

### Wave frequency (how many curves)

Edit `buildSineWave` line 175: `const count = Math.max(Math.round(span / 400), 1)`
- `400` = pixels per half-wave. Lower = more waves. Higher = fewer, wider waves.

### Dot position

Edit line 84: `dotCy = featuresY + 60`
- Increase to move dot further below the Features section top

### Line color

All three layers use `#F97316` (copper). The gradient `#slpGrad` controls the main line's varying opacity.

### Section added or removed

1. Add/remove the section from the `<ScrollLinePath>` wrapper in `page.js`
2. In `ScrollLinePath.jsx`, add a `document.getElementById('new-section-id')` measurement
3. Add the new Y position to the `crossings` array passed to `buildSineWave`
4. The wave builder automatically distributes half-waves between crossings

### Sections reordered

Reorder both the children in `page.js` and the crossings array. The crossings must be in ascending Y order.

## Performance

- **Mobile**: Hidden entirely (`hidden md:block`)
- **Reduced motion**: Returns children only, no SVG
- **GPU compositing**: `pathLength` only animates `stroke-dashoffset`
- **No layout impact**: absolute positioned, pointer-events-none
- **Lazy measurement**: SVG not rendered until `dims !== null` (after first measurement)

## Debugging

**Line doesn't appear**: Check (1) `ScrollLinePath` wraps sections in `page.js`, (2) `md:block` — desktop only, (3) sections don't have `relative` on their `<section>` tag, (4) sections have `relative z-[1]` on inner content div.

**Line overlaps cards**: A section's `<section>` element has `relative` — remove it. Only the inner `<div class="max-w-5xl">` should be positioned.

**Line draws too fast**: Increase the second offset value (e.g., `'end 0.3'` → `'end 0.5'`).

**Dot in wrong position**: Check that `#features` element exists and is the correct `<section>` tag. The dot is placed at `featuresY + 60` pixels.

**Wave looks wrong after layout change**: The measurements happen on mount + 100ms + 1000ms delays. If sections load later (heavy dynamic imports), add another `setTimeout(measure, ...)` or trigger a re-measure.

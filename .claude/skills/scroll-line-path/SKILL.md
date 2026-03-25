---
name: scroll-line-path
description: >
  Architectural reference for the decorative SVG scroll-draw line on the landing page — a copper-colored path that progressively draws itself as the user scrolls from How It Works through Final CTA. Use this skill whenever modifying the scroll line path, adjusting SVG coordinates after section layout changes, adding or removing landing page sections, reordering sections, debugging the scroll animation, or tuning the line's opacity/color/width. Also use when the user mentions "the line", "scroll path", "SVG animation on the homepage", or asks why the line doesn't align with a section.
---

# Scroll Line Path System

A decorative copper SVG path that draws itself as the user scrolls through the home page. It weaves left-right across 4 sections, creating a visual thread connecting the page narrative.

## File Locations

| File | Role |
|------|------|
| `src/app/components/landing/ScrollLinePath.jsx` | The component — SVG, animation, path data |
| `src/app/(public)/page.js` | Integration — wraps 4 sections as children |

## How It Works

`ScrollLinePath` is a wrapper component. In `page.js`, it wraps the 4 below-the-fold sections:

```jsx
<ScrollLinePath>
  <HowItWorksSection />
  <FeaturesGrid />
  <SocialProofSection />
  <FinalCTASection />
</ScrollLinePath>
```

The component renders:
1. A `<div ref={containerRef}>` that wraps children
2. An absolutely positioned `<svg>` overlay on top (desktop only)
3. The SVG contains 3 layered `<path>` elements sharing the same `d` attribute

Framer Motion's `useScroll({ target: containerRef })` tracks how far the user has scrolled through the wrapper. `useTransform` maps `scrollYProgress [0, 0.95]` → `pathLength [0, 1]`, which Framer applies as `stroke-dashoffset` — drawing the path progressively.

## The SVG Coordinate System

```
ViewBox: 0 0 200 4000
preserveAspectRatio="none"  (stretches to fill container height)

X axis: 20–180 usable range (margins prevent edge clipping)
Y axis: 0–4000, divided into 4 sections of ~1000 units each
```

The path is defined in the `SNAKE_PATH` constant as a series of SVG cubic bezier commands:
- `M x y` — move to starting point
- `C cx1,cy1 cx2,cy2 x,y` — cubic bezier curve (one "swoop")
- `L x y` — straight line (used only at the very end)

Each `C` command creates one left-right swoop. The path snakes by alternating between high-X (right side, ~160-180) and low-X (left side, ~30-50) endpoints.

## Section-to-Path Mapping

This is the key reference for maintenance. Each section maps to specific Y ranges and swoops in `SNAKE_PATH`:

| Section | Y Range | Swoops | Path Segments |
|---------|---------|--------|---------------|
| How It Works | 0–1000 | 3 | Lines 2–4 of SNAKE_PATH array |
| Features | 1000–2000 | 2 | Lines 5–6 |
| Social Proof | 2000–3000 | 2 | Lines 7–8 |
| Final CTA | 3000–4000 | 2 + straighten | Lines 9–11 |

The SNAKE_PATH array in the source has inline comments labeling each segment. When editing, use these comments to find the right segment.

## Three Rendered Layers

The SVG renders three copies of the same path, stacked:

| Layer | strokeWidth | Opacity | Purpose |
|-------|-------------|---------|---------|
| Ghost trail | 1 | 6% | Static full path — faintly shows the route ahead |
| Main path | 2 | Gradient 20–50% | Animated draw — the visible copper line |
| Glow path | 8 | 8% | Animated draw — soft bloom/glow behind the main line |

The main path uses a `<linearGradient>` (`#copperGradient`) that varies opacity along the Y axis to create visual depth.

## Updating the Path

### Section got taller or shorter

If a section's content changes height, the SVG stretches automatically (`preserveAspectRatio="none"`). But the swoops may no longer align with the visual content. To fix:

1. Identify which section changed using the mapping table above
2. Adjust the Y values in the corresponding `C` commands
3. If the section grew, spread the swoops over a wider Y range (or add a swoop)
4. If it shrank, compress the Y range (or remove a swoop)

Example: Features section grew from ~1000 units to ~1400 units
- Shift all Features Y values to span 1000–2400 instead of 1000–2000
- Shift all subsequent sections down by 400 (Social Proof: 2400–3400, CTA: 3400–4400)
- Update viewBox height: `0 0 200 4400`

### Section added or removed

1. Add/remove `C` segments (1-3 per section, depending on visual density)
2. Adjust total viewBox height (add/remove ~1000 per section)
3. Shift Y values of all subsequent sections
4. Update the inline comments

### Sections reordered

Reorder the corresponding `C` segment groups in the SNAKE_PATH array. The Y values should stay sequential (0→1000→2000→...) regardless of which section they belong to.

### Changing the line appearance

- **Color**: Edit `stroke="#F97316"` on all three paths + the gradient `<stop>` colors
- **Thickness**: Edit `strokeWidth` on each layer
- **Glow intensity**: Edit `strokeOpacity` on the glow path
- **Ghost visibility**: Edit `strokeOpacity` on the ghost trail
- **Draw speed**: Edit the `useTransform` mapping — e.g., `[0, 0.8]` makes it complete faster
- **Fade in/out**: Edit the opacity `useTransform` breakpoints

## Performance

- **Mobile**: Hidden entirely (`hidden md:block` on the SVG element)
- **Reduced motion**: Component returns children only, no SVG rendered
- **GPU compositing**: `pathLength` animates `stroke-dashoffset` only — no layout/paint
- **No layout impact**: SVG is `position: absolute`, `pointer-events-none`, `z-10`
- **No CLS**: SVG doesn't affect document flow

## Debugging

**Line doesn't appear**: Check that `ScrollLinePath` wraps the sections in `page.js`. Check `md:block` — only visible on desktop. Check `useReducedMotion` — disabled when OS prefers reduced motion.

**Line draws too fast/slow**: Adjust the `useTransform` input range. `[0, 0.95]` means "finish drawing at 95% scroll". Lowering to `[0, 0.7]` makes it complete earlier.

**Line misaligned with content**: The path coordinates are fixed in viewBox space. If section heights change, the swoops won't match. Use the section mapping table to identify and adjust the relevant `C` commands.

**Line clips at edges**: Increase X margins in the path. Keep endpoints within 20–180 range (viewBox width is 200).

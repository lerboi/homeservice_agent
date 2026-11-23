---
type: system
system: Public Site
status: pending-rebuild
description: "Updating. Covers: Wave too fast/slow; Wave amplitude (how wide it swings); Wave frequency (how many curves); Dot position; Line color; Section added or removed (inside ScrollLinePath); Sections reordered (inside ScrollLinePath)"
source: .claude/skills/scroll-line-path/SKILL.md § Updating
migrated: 2026-11-23
verified:
tags: [voco/system/public-site]
---

# Updating

Part of [[Public Site]]. Migrated verbatim from the `scroll-line-path` skill; check `verified` before trusting details.

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

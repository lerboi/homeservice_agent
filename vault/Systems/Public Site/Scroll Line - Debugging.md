---
type: system
system: Public Site
status: pending-rebuild
description: "Line doesn't appear: Check (1) ScrollLinePath wraps sections in page.js, (2) md:block — desktop only, (3) sections don't have relative on their <section> tag…"
source: .claude/skills/scroll-line-path/SKILL.md § Debugging
migrated: 2026-11-23
verified:
tags: [voco/system/public-site]
---

# Debugging

Part of [[Public Site]]. Migrated verbatim from the `scroll-line-path` skill; check `verified` before trusting details.

**Line doesn't appear**: Check (1) `ScrollLinePath` wraps sections in `page.js`, (2) `md:block` — desktop only, (3) sections don't have `relative` on their `<section>` tag, (4) sections have `relative z-[1]` on inner content div, (5) `#features` element exists (dot+wave start depend on it).

**Line overlaps cards**: A section's `<section>` element has `relative` — remove it. Only the inner `<div class="max-w-5xl">` should be positioned.

**Line draws too fast**: Increase the second offset value (e.g., `'end 0.3'` → `'end 0.5'`).

**Dot in wrong position**: Check that `#features` element exists and is the correct `<section>` tag. The dot is placed at `featuresY + 60` pixels.

**Wave looks wrong after layout change**: The measurements happen on mount + 100ms + 1000ms delays. If sections load later (heavy dynamic imports — several ScrollLinePath children use `next/dynamic`), add another `setTimeout(measure, ...)` or trigger a re-measure.

**Wave appears at top of wrapper or dot is at position 0**: `#features` is missing. `featuresY` defaults to 0. Verify `FeaturesCarousel.jsx` outer `<section>` still has `id="features"` — **do NOT remove this id**. The copper wave dot and wave start-point depend entirely on this element.

**No `#testimonials` element (post-Phase 48.1)**: This is expected. `SocialProofSection` was deleted in Phase 48.1. ScrollLinePath falls back to a 65% crossing — no fix needed. Do not add a fake `id="testimonials"` element.

# Phase 36: Landing Page Section Redesign — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-01
**Phase:** 36-landing-page-section-redesign-how-it-works-minimalism-and-features-carousel
**Areas discussed:** How It Works scroll animation, Features carousel behavior, Features icon nav grid, Content density and copy

---

## How It Works Scroll Animation Style

| Option | Description | Selected |
|--------|-------------|----------|
| Fade-in text blocks | Steps fade/slide in as you scroll. Clean white space. Apple style. | partial |
| Vertical timeline | Thin line with nodes, progress fills as you scroll | |
| Full-viewport steps | Each step takes ~1 viewport height, transitions between steps | partial |
| Sticky counter | Step stays pinned, content swaps | |

**User's choice:** Mix of fade-in text blocks (Apple style) and full-viewport steps
**Notes:** User emphasized professional look, not AI-generated. Wants illustration-style icons, alternating backgrounds, centered alignment, simple fade-up.

### Animation polish follow-up

**User's concern:** "This can easily fall into a very boring just text site, find a way to implement some sort of nice looking animation"
**Resolution:** Staggered fade-in, subtle parallax, gradient accent lines, soft background shapes. Claude's discretion on exact implementation.

---

## Features Carousel Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| 1 card per view | Full-width, big and detailed | |
| 2-3 cards per view | Partial peek of next card, invites interaction | ✓ |

| Option | Description | Selected |
|--------|-------------|----------|
| Arrows only | Left/right buttons | |
| Swipe + arrows | Touch swipe + desktop arrows | |
| Icon nav only | Grid below is sole navigation | |
| Both (arrows/swipe + icon nav) | All navigation methods | ✓ |

**Auto-play:** Yes, auto-advance on timer
**Card content:** Keep micro SVG visuals from Phase 32
**Notes:** Mobile responsiveness explicitly important

---

## Features Icon Nav Grid

| Option | Description | Selected |
|--------|-------------|----------|
| Single horizontal row | 7 icons in a row | ✓ |
| 2-row grid | 4 on top, 3 below | |

| Option | Description | Selected |
|--------|-------------|----------|
| Orange highlight | Background pill or underline in brand orange | |
| Scale + color | Active icon larger with orange tint | |
| Underline dot | Small dot below active icon | ✓ |

**Labels:** Always show text labels under each icon
**Notes:** Must work on mobile — adapt design if needed

---

## Content Density and Copy

| Option | Description | Selected |
|--------|-------------|----------|
| One sentence | E.g. "Your phone rings. Voco picks up instantly." | ✓ |
| Two short lines | Title + supporting detail | |
| Title only | Pure minimal, no description | |

**Features copy:** Trim slightly from Phase 32
**Section headings:** Keep eyebrow + heading pattern

---

## Claude's Discretion

- Parallax values, stagger timing, background shape styles
- Carousel auto-advance interval, arrow styling, card scale differences
- Mobile icon nav adaptation
- Illustration icon design approach

## Deferred Ideas

None

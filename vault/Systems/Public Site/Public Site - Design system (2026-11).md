---
type: system
system: Public Site
status: current
description: "The marketing site's palette, type and primitives: token names, where they are defined, the components every page is built from, and the contrast rule for the signal colour."
verified: 2026-11-24
tags: [voco/system/public-site]
---

# Public Site - Design system (2026-11)

Part of [[Public Site]]. Decided in [[Plan 2 - Frontend rebrand to voice integration for any backend]] section 6: light first, one accent, hairline borders instead of shadows and gradients.

## Tokens

Defined in the `@theme inline` block of `src/app/globals.css`, so they are ordinary Tailwind utilities (`bg-mk-paper`, `text-mk-muted`, `border-mk-line`). The `mk-` prefix marks them as marketing-only; the dashboard has its own tokens.

| Token | Value | Use |
|---|---|---|
| `mk-paper` | `#F7F8F5` | Default page surface |
| white | `#FFFFFF` | Alternating sections, cards |
| `mk-ink` | `#0B0F14` | Text; the dark sections and footer |
| `mk-ink-soft` | `#151B23` | Hover on ink buttons |
| `mk-signal` | `#00B37E` | Live states, primary button fill, accents on ink |
| `mk-signal-deep` | `#007A57` | Links, eyebrows and icons on light surfaces |
| `mk-muted` | `#55606B` | Secondary text |
| `mk-faint` | `#8A929C` | Tertiary labels |
| `mk-line` | ink at 10% | Hairline borders |

**Contrast rule.** White text on `mk-signal` fails (about 2.7:1). The primary button is ink text on signal (about 7:1). For signal-coloured text on a light surface use `mk-signal-deep`, never `mk-signal`. On ink, `mk-signal` is fine.

## Type

| Class | Face | Use |
|---|---|---|
| `font-display` | Space Grotesk | Headlines, card titles, big numbers |
| (default) | Inter | Body |
| `font-code` | JetBrains Mono | Eyebrows, transcript speaker labels, action logs |

Space Grotesk and JetBrains Mono are loaded with `next/font` in `src/app/(public)/layout.js`, not the root layout, so the app does not load them.

## Primitives

`src/components/marketing/primitives.jsx`. Build pages from these rather than writing section markup by hand.

| Export | What it gives |
|---|---|
| `Section` | `tone="paper" | "white" | "ink"`, standard vertical padding, optional top hairline, an `id` for anchors |
| `Container` | Width (`narrow`, default, `wide`) and side padding |
| `PageHero` | Interior page opener: eyebrow, title, lede, slot for CTAs, room for the fixed nav |
| `SectionHeader` | Eyebrow + title + lede |
| `Eyebrow`, `PageTitle`, `SectionTitle`, `Lede` | Type styles; `onInk` variants |
| `ButtonLink`, `buttonClasses` | `primary`, `secondary`, `secondaryOnInk`, `ink`; sizes `sm`, `md`, `lg` |
| `Card`, `TextLink` | Bordered white card; signal-coloured link |

Recurring patterns: numbered steps under a 1px ink rule; grids made with `gap-px` over a line-coloured background; pill links for integrations.

## Motion

Two keyframes at the end of `globals.css`: `mk-rise` (new transcript and log lines) and `mk-bar` (the speaking indicator). Both sit inside `prefers-reduced-motion: no-preference`. framer-motion is not used on public pages.

## Logo

The existing wordmark is black with no background, so it is used as is on paper (`VOCO Logo V1 (no bg).png`); the white version is used on the ink footer.

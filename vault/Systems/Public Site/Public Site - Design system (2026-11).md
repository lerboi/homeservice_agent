---
type: system
system: Public Site
status: current
description: "The marketing site's palette, type and primitives: token names, where they are defined, one colour per product (green for Voco Voice, amber for Voco Agent), the components every page is built from, and the contrast rules."
verified: 2026-11-24
tags: [voco/system/public-site]
---

# Public Site - Design system (2026-11)

Part of [[Public Site]]. First decided in [[Plan 2 - Frontend rebrand to voice integration for any backend]] section 6, then changed on 2026-11-24 after the owner found the first pass "boring" and without identity: [[2026-11-24 Public site second pass - two products and identity]].

## Principles

- **One colour per product.** Signal green is Voco Voice; spark amber is Voco Agent. A page or section about one product uses that product's colour for its eyebrow, checks, wash and primary button.
- **Each page opens differently.** Home is an ink hero with both products; `/voice` is a green wash with the call illustration beside the headline; `/agent` is an amber wash with a centred headline and the chat in the middle. Do not reuse one hero block for every page.
- **Headline emphasis is colour.** One face throughout; the words that matter take the product colour through `<Em tone>`. An italic serif was tried on 2026-11-24 and removed the same day: the owner found it hard to read. Do not bring italics back into headlines.
- **One page width.** Every `Container` (and the nav and footer) is `max-w-7xl`, so section edges line up; text blocks set their own narrower measure.
- Hairline borders, no drop shadows. The dark heroes carry a dot grid and two soft colour glows; that is the only gradient use.

## Tokens

Defined in the `@theme inline` block of `src/app/globals.css`, so they are ordinary Tailwind utilities (`bg-mk-paper`, `text-mk-muted`, `border-mk-line`). The `mk-` prefix marks them as marketing-only; the dashboard has its own tokens.

| Token | Value | Use |
|---|---|---|
| `mk-paper` | `#F7F8F5` | Default page surface |
| white | `#FFFFFF` | Alternating sections, cards |
| `mk-ink` | `#0B0F14` | Text; dark sections and footer |
| `mk-ink-soft` | `#151B23` | Hover on ink buttons |
| `mk-signal` | `#00B37E` | Voco Voice: live states, primary button fill, accents on ink |
| `mk-signal-deep` | `#007A57` | Voice-coloured text and icons on light surfaces |
| `mk-signal-wash` | `#E3F6EE` | Voice panels and the `/voice` hero |
| `mk-spark` | `#FFB020` | Voco Agent: button fill, checks, accents on ink |
| `mk-spark-deep` | `#8F5B00` | Agent-coloured text and icons on light surfaces |
| `mk-spark-wash` | `#FFF4DC` | Agent panels and the `/agent` hero |
| `mk-muted` | `#55606B` | Secondary text |
| `mk-faint` | `#8A929C` | Tertiary labels |
| `mk-line` | ink at 10% | Hairline borders |

**Contrast rule.** White text on `mk-signal` or `mk-spark` fails. Buttons are ink text on the colour. Coloured text on a light surface uses the `-deep` variant, never the base colour. On ink, the base colours are fine.

## Type

| Class | Face | Use |
|---|---|---|
| `font-display` | Bricolage Grotesque | Headlines, card titles, big numbers (semibold, tight tracking) |
| (default) | Inter | Body |
| `font-code` | JetBrains Mono | Eyebrows, transcript speaker labels, action logs, chips |

The two marketing faces are loaded with `next/font` in `src/app/(public)/layout.js`, not the root layout, so the app does not load them.

## Primitives

`src/components/marketing/primitives.jsx`.

| Export | What it gives |
|---|---|
| `Section` | `tone="paper" | "white" | "ink"`, standard vertical padding, optional top hairline, an `id` for anchors |
| `Container` | Side padding and the page width (`narrow` for legal text; everything else is one width) |
| `PageHero` | Interior page opener with a dot grid; `tone="paper" | "white" | "signal" | "spark" | "ink"` so pages do not open alike (`/use-cases` signal, `/integrations` ink) |
| `SectionHeader` | Eyebrow + title + lede; takes `tone` |
| `Eyebrow` | Mono label; `tone="signal" | "spark"`, `onInk` |
| `Em` | Coloured emphasis inside a headline: `tone="signal" | "spark"` on ink, `"signal-deep" | "spark-deep"` on light, `"both"` (green running into amber, home hero only) |
| `PageTitle`, `SectionTitle`, `Lede` | Type styles |
| `ButtonLink`, `buttonClasses` | `primary` (green), `spark` (amber), `secondary`, `secondaryOnInk`, `ink`; sizes `sm`, `md`, `lg` |
| `Card`, `TextLink` | Bordered white card; signal-coloured link |

Utility classes in `globals.css`: `mk-grid-ink` and `mk-grid-paper` (dot grids), `mk-rise`, `mk-bar`, `mk-dot` (motion).

## Motion

Keyframes at the end of `globals.css`: `mk-rise` (new transcript, chat and log lines), `mk-bar` (the speaking indicator), `mk-dot` (the agent's "reading" dots). All sit inside `prefers-reduced-motion: no-preference`. framer-motion is not used on public pages.

## Logo

The existing wordmark is black with no background, so it is used as is on paper (`VOCO Logo V1 (no bg).png`); the white version is used on the ink footer. The nav is a light bar on every page, including over the ink hero.

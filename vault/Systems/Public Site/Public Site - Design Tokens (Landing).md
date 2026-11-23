---
type: system
system: Public Site
status: pending-rebuild
description: "Landing pages use a separate set of design tokens from the dashboard. These are NOT in src/lib/design-tokens.js (which is dashboard/onboarding). Landing toke…"
source: .claude/skills/public-site-i18n/SKILL.md § 13. Design Tokens (Landing)
migrated: 2026-11-23
verified:
tags: [voco/system/public-site]
---

# Design Tokens (Landing)

Part of [[Public Site]]. Migrated verbatim from the `public-site-i18n` skill; check `verified` before trusting details.

Landing pages use a separate set of design tokens from the dashboard. These are NOT in `src/lib/design-tokens.js` (which is dashboard/onboarding). Landing tokens are expressed directly as Tailwind utilities.

| Token | Hex Value | Usage |
|-------|-----------|-------|
| Hero/Footer background | `#050505` / `#090807` | Near-black, deepest dark surfaces |
| Accent orange | `#F97316` | CTAs, active links, accent highlights |
| Section light | `#F5F5F4` | Alternating light sections (HowItWorks, Social Proof, Comparison Table) |
| Warm stone | `#EDEAE7` | ROI Calculator section — distinct from `#F5F5F4`, gradient-blended at bottom |
| Muted text | `#475569` | Body text on light backgrounds |
| Success / brand | `#166534` | Not prominent on landing (used in badge variants) |
| About page navy | `#0F172A` | Shared with dashboard |
| About page accent | `#C2410C` | Darker orange for about/contact (matches dashboard brandOrange) |

**Tailwind v4 pattern**: Landing uses `@import 'tailwindcss'` in CSS + `@tailwindcss/postcss` plugin. No `tailwind.config.js`. Custom animation variants registered via `--animate-*` convention in `@theme` inline block.

---

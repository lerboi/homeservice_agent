---
type: system
system: Dashboard and CRM
status: legacy-app
description: "Design Tokens. Covers: Sidebar tokens (2026-06-10 dark pass); Dark mode rules; Badge/chip dark pairing — CANONICAL pattern for new badges"
source: .claude/skills/dashboard-crm-system/SKILL.md § 12. Design Tokens
migrated: 2026-11-23
verified:
tags: [voco/system/dashboard-and-crm]
---

# Design Tokens

Part of [[Dashboard and CRM]]. Migrated verbatim from the `dashboard-crm-system` skill; check `verified` before trusting details.

**File**: `src/lib/design-tokens.js`

Phase 49 rewrite: all hex literals replaced with `var(--*)` references.
CSS variables defined in `globals.css`, flip between light/dark via
`.dark` class on `<html>`.

```js
export const colors = {
  brandOrange: 'var(--brand-accent)',          // #C2410C light / brighter dark
  brandOrangeDark: 'var(--brand-accent-hover)',
  navy: 'var(--sidebar-bg)',                    // #0F172A light / oklch(0.185 0 0) dark
  warmSurface: 'var(--warm-surface)',
  bodyText: 'var(--muted-foreground)',
};
```

Other tokens: `btn`, `card`, `glass`, `gridTexture`, `focus` (Phase 58
focus-visible), `selected`. Consumers read via named import only — do
not inline hex codes in dashboard components.

### Sidebar tokens (2026-06-10 dark pass)

- **`--sidebar-bg`** — light mode keeps the navy `#0F172A`; dark mode is
  now **neutral `oklch(0.185 0 0)`** — one elevation step between
  `--background` (`0.145`) and `--card` (`0.205`), joining the
  zero-chroma dark family instead of clashing navy.
- **`--sidebar-bg-border`** (NEW) — hairline between the desktop sidebar
  and page content: `transparent` light / `oklch(1 0 0 / 8%)` dark.
  Applied via a scoped rule in `globals.css` —
  `aside[data-tour="sidebar-nav"] { border-right: 1px solid
  var(--sidebar-bg-border); }` — so `DashboardSidebar.jsx` needs no border
  class (border-box keeps the 240px width unchanged).

### Dark mode rules

- NO hardcoded `bg-white` / `bg-stone-*` / `text-stone-*` without `dark:`
  variants. Use semantic tokens: `bg-card`, `bg-muted`, `bg-background`,
  `text-foreground`, `text-muted-foreground`, `border-border`.
- Sidebar: navy in light, neutral `oklch(0.185 0 0)` in dark
  (`bg-[var(--sidebar-bg)]` — see Sidebar tokens above).
- `URGENCY_STYLES` in CalendarView has full dark variants.
- `@custom-variant dark :where(.dark, .dark *)` in `globals.css`.
- 150ms body crossfade on theme change.

### Badge/chip dark pairing — CANONICAL pattern for new badges

2026-06-10 system-wide pass: **~107 className locations across 26
dashboard files** gained additive `dark:` variants for light-only pastel
badges/chips/banners, following the **BookingStatusBadge convention**:

```
bg-{hue}-100 text-{hue}-700  +  dark:bg-{hue}-950/40 dark:text-{hue}-300
borders:                        dark:border-{hue}-800/60
```

Applied to status badges, amber banners, icon tiles, ghost destructive
hovers, and stone→muted swaps. Raw slate/stone hexes in
`calendar/page.js`, `CalendarView.js`, and `UsageRingGauge.js` were
replaced with tokens (`text-muted-foreground`, `var(--border)` for the
usage ring track) + dark pairs. **Deliberate exclusion**:
`src/components/billing/UpgradeCheckoutCards.js` is an intentionally
light-fixed pricing card — do not add `dark:` variants there. Any NEW
light-pastel badge MUST ship with this dark pairing.

---

---
phase: 49
slug: dark-mode-foundation-and-token-migration
status: approved
shadcn_initialized: true
preset: new-york / neutral
created: 2026-04-15
reviewed_at: 2026-04-15
---

# Phase 49 — UI Design Contract

> Visual and interaction contract for Phase 49 (Dark Mode Foundation + Token Migration).
> This is a **cross-cutting paint-only phase** — no new screens, no new flows. The contract governs:
> 1. The single new UI element (sidebar theme toggle button).
> 2. The semantic color token taxonomy that replaces ~537 hardcoded hex occurrences.
> 3. The dark-mode values for each token family.
> 4. Component-category treatments (badges, pills, banners, flyouts).
> 5. Motion (150ms theme crossfade).
>
> Charts (AnalyticsCharts.jsx) and CalendarView urgency colors are explicitly deferred to Phase 50 and must NOT be touched here.

---

## Design System

| Property | Value | Source |
|----------|-------|--------|
| Tool | shadcn | `components.json` present |
| Preset | new-york / neutral / cssVariables=true | `components.json` |
| Component library | Radix (via shadcn) | already installed |
| Icon library | lucide-react ^0.577.0 | `package.json` |
| Font | Inter (`--font-inter`) via `next/font` | `@theme inline` in globals.css |
| Theme library | next-themes ^0.4.6 | `package.json` (already installed) |
| Dark variant strategy | `@custom-variant dark (&:is(.dark *))` — class-based, toggled on `<html>` | `globals.css` line 3 |

**Existing token scaffolding (already in `globals.css`):**
- `:root` (lines 127–170) — light mode tokens: `--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--primary`, `--secondary`, `--muted`, `--muted-foreground`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--sidebar*`, `--chart-*`, landing tokens.
- `.dark` (lines 172–204) — dark mode overrides for the same set (missing landing tokens, which is fine — landing stays light-only).
- `@theme inline` (lines 5–54) — Tailwind utility bindings (`bg-background`, `text-foreground`, `bg-card`, etc. already work).

**Gaps this phase fills (new CSS variables to add):**
- `--brand-accent` (orange) — missing entirely, replaces literal `#C2410C` / `#FB923C`.
- `--brand-accent-hover` — replaces literal `#9A3412` / `#B53B0A` in `btn.primary` and logout dialog.
- `--selected-fill` — replaces `#C2410C/[0.04]` literal in `selected.card`.
- `--warm-surface` and `--warm-surface-elevated` — replace dashboard's `#F5F5F4` / `#FAFAF9` base backgrounds in dark-aware form.
- `--body-text` / `--heading-text` aliases — POLISH-08 typography consolidation (map to existing `--muted-foreground` / `--foreground`).

---

## Spacing Scale

Declared values (multiples of 4, matching Tailwind default):

| Token | Value | Usage in this phase |
|-------|-------|---------------------|
| xs | 4px | Icon↔label gap inside toggle button (gap-1) |
| sm | 8px | Tooltip offset from toggle trigger |
| md | 16px | Default element padding (carries over from existing sidebar) |
| lg | 24px | Section padding (unchanged) |
| xl | 32px | Layout gaps (unchanged) |
| 2xl | 48px | Major section breaks (unchanged) |
| 3xl | 64px | Page-level spacing (unchanged) |

**Exceptions:**
- Theme toggle button matches existing sidebar footer button geometry: `px-3 py-2.5 rounded-lg` with `h-4 w-4` icon (identical to "Ask Voco AI" and "Log Out" buttons — deliberate, enforces visual uniformity in the footer cluster).
- No new spacing primitives introduced. This phase reuses the full existing spacing language.

---

## Typography

POLISH-08 consolidates dashboard typography onto two tokens that map to shadcn semantics. No new sizes are introduced — the role table below reflects **what sizes currently exist in the dashboard** and how they must migrate to tokenized colors.

| Role | Size | Weight | Line Height | Color Token (light) | Color Token (dark) |
|------|------|--------|-------------|---------------------|--------------------|
| Body | 14px | 400 | 1.5 | `var(--muted-foreground)` via `body` token | `var(--muted-foreground)` via `body` token |
| Label | 13px | 500 | 1.4 | `var(--foreground)` via `heading` token | `var(--foreground)` via `heading` token |
| Heading | 18px | 600 | 1.2 | `var(--foreground)` via `heading` token | `var(--foreground)` via `heading` token |
| Display | 28px | 700 | 1.2 | `var(--foreground)` via `heading` token | `var(--foreground)` via `heading` token |

**Consolidation rule (POLISH-08):**
- `src/lib/design-tokens.js` line 30 (`heading = 'text-[#0F172A] tracking-tight'`) → becomes `heading = 'text-foreground tracking-tight'`.
- `src/lib/design-tokens.js` line 31 (`body = 'text-[#475569]'`) → becomes `body = 'text-muted-foreground'`.
- Grep acceptance: `grep -r "text-\[#0F172A\]\|text-\[#475569\]" src/app/dashboard src/components/dashboard` returns 0 matches after migration.

**Weights used:** 400 (regular), 500 (medium, for labels only), 600 (semibold), 700 (bold, for display only). Four weights is acceptable here because Inter loads a single variable font file — this is not a weight-count problem.

**Font stack:** `var(--font-inter), system-ui, sans-serif` (unchanged from `globals.css` line 212).

---

## Color

The 60/30/10 split describes the **dashboard surface in dark mode** (the new addition). Light mode percentages are identical in role but with inverted values.

| Role | Light value | Dark value | Usage |
|------|-------------|------------|-------|
| Dominant (60%) | `#F5F5F4` (warm-neutral) | `oklch(0.145 0 0)` ≈ `#252525` (near-black) | Main content background, page canvas |
| Secondary (30%) | `#FFFFFF` | `oklch(0.205 0 0)` ≈ `#353535` (elevated dark) | Cards, flyouts, modals, popovers, top bar glass |
| Accent (10%) | `#C2410C` (copper) | `#FB923C` (Tailwind orange-400) | See reserved list below |
| Destructive | `oklch(0.577 0.245 27.325)` ≈ `#DC2626` | `oklch(0.704 0.191 22.216)` ≈ `#EF4444` | Destructive actions only |

**Accent reserved for (explicit list — NEVER for arbitrary interactive elements):**
1. Primary CTA buttons (`design-tokens.js` → `btn.primary`).
2. Active nav indicator in `DashboardSidebar` (current `border-[#C2410C]` left border on active route).
3. Focus rings (`design-tokens.js` → `focus.ring`).
4. Selection borders (`design-tokens.js` → `selected.card` — the border, not the fill; see D-11).
5. Logout-confirm destructive button (`DashboardSidebar.jsx` line 135 — note: this is intentionally orange-not-red per existing design; migrates to `var(--brand-accent)` and `var(--brand-accent-hover)`).
6. Setup checklist progress fill.
7. Any "primary" variant of shadcn Button in dashboard scope.

**Accent NOT used for:**
- Generic hover states (those use `bg-accent` / `hover:bg-accent`).
- Badges (those use their categorical color families — see Component Category Treatments below).
- Links (those use `var(--foreground)` with underline, not accent color).

---

### New Semantic Tokens to Add

Add these to `globals.css` `:root` and `.dark` blocks. This is the complete taxonomy executor must create.

| Token | `:root` value (light) | `.dark` value | Replaces (hex audit) |
|-------|----------------------|---------------|----------------------|
| `--brand-accent` | `#C2410C` | `#FB923C` | `#C2410C` (active nav border, focus ring, primary button bg, selected border) |
| `--brand-accent-hover` | `#B53B0A` | `#F97316` | `#9A3412` (btn.primary active), `#B53B0A` (logout dialog hover) |
| `--brand-accent-fg` | `#FFFFFF` | `#0F172A` | Text color on top of `--brand-accent` buttons (dark mode uses dark text on light-orange per D-10 AA contrast) |
| `--selected-fill` | `rgba(194, 65, 12, 0.04)` | `rgba(255, 255, 255, 0.04)` | `bg-[#C2410C]/[0.04]` (D-11) |
| `--warm-surface` | `#F5F5F4` | `oklch(0.145 0 0)` | `bg-[#F5F5F4]` in `dashboard/layout.js` |
| `--warm-surface-elevated` | `#FAFAF9` | `oklch(0.205 0 0)` | `bg-[#FAFAF9]` in dashboard pages |
| `--body-text` | `var(--muted-foreground)` | `var(--muted-foreground)` | Alias for clarity; `body` token in `design-tokens.js` resolves to this |
| `--heading-text` | `var(--foreground)` | `var(--foreground)` | Alias for clarity; `heading` token resolves to this |

**Contrast validation (WCAG AA — 4.5:1 minimum for body text, 3:1 for large/UI):**

| Pair (dark mode) | Ratio | AA? |
|------------------|-------|-----|
| `--foreground` (`oklch(0.985 0 0)`) on `--background` (`oklch(0.145 0 0)`) | ~15.8:1 | ✅ AAA |
| `--muted-foreground` (`oklch(0.708 0 0)`) on `--background` | ~5.7:1 | ✅ AA body |
| `--brand-accent` (`#FB923C`) on `--background` (`oklch(0.145 0 0)`) | ~8.2:1 | ✅ AAA |
| `--brand-accent-fg` (`#0F172A`) on `--brand-accent` (`#FB923C`) | ~8.9:1 | ✅ AAA |
| `--foreground` on `--card` (`oklch(0.205 0 0)`) | ~14.2:1 | ✅ AAA |
| `--muted-foreground` on `--card` | ~5.2:1 | ✅ AA body |

**Light mode contrast (already established, verified baseline):**
- `#0F172A` on `#F5F5F4` → ~17:1 (AAA)
- `#475569` on `#FFFFFF` → ~7.5:1 (AAA)
- `#FFFFFF` on `#C2410C` → ~5.4:1 (AA for body, AAA for large)

All pairings validated. **Executor must not introduce any new color that has not been checked against these contrast rules.**

---

## Component Category Treatments

This phase migrates ~537 hex occurrences across 74 files. Instead of listing every component, below is the treatment rule per **category**. Executor applies the matching rule by category.

### Layout Shell

| Surface | Light | Dark | Notes |
|---------|-------|------|-------|
| `dashboard/layout.js` main wrapper | `bg-background` (resolves to `#F5F5F4` via new `--background` override or warm surface var) | `bg-background` (resolves to near-black) | D-09 planner decides surface strategy |
| Top bar glass | `bg-white/80 backdrop-blur-md border-b border-stone-200/60` (existing `glass.topBar`) | `bg-card/80 backdrop-blur-md border-b border-border` | `glass.topBar` token migrates |
| Sidebar (`DashboardSidebar`) | `bg-[#0F172A]` (stays navy) | `bg-[#0F172A]` (stays navy — D-07 intentional) | Sidebar does NOT flip |
| Sidebar active indicator | `border-[#C2410C]` | `border-[#FB923C]` via `var(--brand-accent)` | Uses new token |
| Bottom tab bar (mobile) | `bg-white border-t border-stone-200` | `bg-card border-t border-border` | Standard card→card migration |

### System Banners

All three banners sit at the top of dashboard content. They must remain visually **urgent** in both modes.

| Banner | Light | Dark |
|--------|-------|------|
| `ImpersonationBanner` | `bg-amber-50 text-amber-900 border-amber-200` | `bg-amber-950/40 text-amber-200 border-amber-800/60` |
| `TrialCountdownBanner` | `bg-blue-50 text-blue-900 border-blue-200` | `bg-blue-950/40 text-blue-200 border-blue-800/60` |
| `BillingWarningBanner` (destructive) | `bg-red-50 text-red-900 border-red-200` | `bg-red-950/40 text-red-200 border-red-800/60` |

**Pattern:** tint `{color}-50` → `{color}-950/40`, text `{color}-900` → `{color}-200`, border `{color}-200` → `{color}-800/60`. Same shape, shifted 900 points.

### Status Badges and Urgency Pills

Status badges encode categorical meaning — category identity must survive the theme flip.

| Category | Light | Dark |
|----------|-------|------|
| Success (booked, completed) | `bg-green-50 text-green-700 border-green-200` | `bg-green-950/40 text-green-300 border-green-800/60` |
| Warning (pending, follow-up) | `bg-amber-50 text-amber-700 border-amber-200` | `bg-amber-950/40 text-amber-300 border-amber-800/60` |
| Info (new, triage) | `bg-blue-50 text-blue-700 border-blue-200` | `bg-blue-950/40 text-blue-300 border-blue-800/60` |
| Neutral (archived) | `bg-stone-100 text-stone-700 border-stone-200` | `bg-muted text-muted-foreground border-border` |
| Destructive (lost, cancelled) | `bg-red-50 text-red-700 border-red-200` | `bg-red-950/40 text-red-300 border-red-800/60` |
| Active / brand (hot, priority) | `bg-orange-50 text-orange-700 border-orange-200` | `bg-orange-950/40 text-orange-300 border-orange-800/60` |

**Target files:** `LeadStatusPills.jsx` (4 hex), `BookingStatusBadge.js` (2 hex), `EstimateStatusBadge.jsx`. Executor applies the category mapping above; no per-component creativity.

### Flyouts and Modals

Flyouts and modals use `--card` and `--popover` respectively (already dark-aware via shadcn scaffolding).

| Element | Light | Dark |
|---------|-------|------|
| Flyout/sheet background | `bg-white` | `bg-card` |
| Flyout header | `bg-white border-b border-stone-200` | `bg-card border-b border-border` |
| Flyout body text | `text-[#475569]` → `text-muted-foreground` | `text-muted-foreground` |
| Flyout heading | `text-[#0F172A]` → `text-foreground` | `text-foreground` |
| Flyout close button hover | `hover:bg-stone-100` | `hover:bg-accent` |

**Target files:** `LeadFlyout.jsx` (30 hex), `AppointmentFlyout.js` (12 hex), `QuickBookSheet.js` (3 hex), `ChatbotSheet.jsx` (2 hex). DARK-06 coverage.

### Selection and Focus States

| State | Light | Dark |
|-------|-------|------|
| Selected card border | `border-[#C2410C]` | `border-[#FB923C]` via `var(--brand-accent)` |
| Selected card fill | `bg-[#C2410C]/[0.04]` | `bg-white/[0.04]` via `var(--selected-fill)` (D-11) |
| Idle card background | `bg-[#F5F5F4] hover:bg-stone-100` | `bg-muted hover:bg-accent` |
| Focus ring | `focus:ring-2 focus:ring-[#C2410C] focus:ring-offset-1` | `focus:ring-2 focus:ring-[#FB923C] focus:ring-offset-1 focus:ring-offset-background` |

---

## The Single New UI Element — Theme Toggle Button

This is the only net-new component this phase introduces.

### Placement
Inside `DashboardSidebar.jsx`, in the sidebar footer cluster. Insertion order from bottom to top:
1. `Log Out` (existing, line 96–105)
2. `Ask Voco AI` (existing, line 85–94)
3. **`Theme Toggle` (new — insert between Ask Voco AI and Log Out — i.e. *above* Log Out and *below* Ask Voco AI)**

Per D-03: "above the Log Out button and adjacent to Ask Voco AI."

### Visual Specification

```
┌─────────────────────────────────────┐
│  [🌙]  Dark mode                     │   (when current theme is light, clicking switches to dark)
└─────────────────────────────────────┘
```

| Property | Value |
|----------|-------|
| Container | `<button>` identical shape to sibling sidebar footer buttons |
| Container classes | `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-white/60 hover:bg-white/[0.04] hover:text-white/80 border-l-2 border-transparent ml-0 pl-[10px] w-full` |
| Icon size | `h-4 w-4 shrink-0` (matches siblings) |
| Icon (light mode active) | `<Moon />` from lucide-react — "click to go dark" |
| Icon (dark mode active) | `<Sun />` from lucide-react — "click to go light" |
| Label (light mode active) | "Dark mode" |
| Label (dark mode active) | "Light mode" |
| aria-label | `"Switch to {target} mode"` where target is the opposite of current |
| Tooltip trigger | `onHover` — uses existing shadcn `Tooltip` primitive |
| Tooltip content | `"Switch to dark mode"` / `"Switch to light mode"` |
| Tooltip side | `right` (tooltip appears outside the sidebar, adjacent to the button) |
| onClick behavior | `setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')` — binary flip (D-02) |

### Hydration Safety

Per `next-themes` requirements:
- The toggle must render a stable placeholder until `mounted === true` to avoid a hydration mismatch. Use the standard next-themes pattern:
  ```jsx
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <button className="... opacity-0" aria-hidden="true" />;
  ```
- Button dimensions must match mounted state exactly so there's no layout shift when it hydrates.

### Accessibility

- Button is reachable via Tab (native `<button>` element).
- `aria-label` updates with current state.
- `aria-pressed` is NOT used (this is a mode switcher, not a toggle state — it's stateful action, two distinct destinations). Instead rely on `aria-label` clarity.
- Tooltip is screen-reader inert (`aria-hidden` per Radix Tooltip default) — the `aria-label` carries the accessible name.
- Icon has no accessible name of its own (decorative).

### Interaction States

| State | Visual |
|-------|--------|
| Default (light mode) | Moon icon, white/60 text, transparent background |
| Default (dark mode) | Sun icon, white/60 text (sidebar stays navy), transparent background |
| Hover | `bg-white/[0.04]` + `text-white/80` (matches siblings) |
| Focus-visible | `ring-2 ring-[#FB923C] ring-offset-2 ring-offset-[#0F172A]` (sidebar is always navy so offset color is fixed) |
| Active (pressed) | Icon briefly scales to 95% during click — inherits `active:scale-95` like `btn.primary` |
| Click → transition | Body crossfades background + text over 150ms; icon swaps immediately (no icon-morph animation) |

### Motion Spec (DARK-09)

Add exactly one CSS rule to `globals.css` (do NOT add transition classes to individual components):

```css
@layer base {
  body {
    transition:
      background-color 150ms ease,
      color 150ms ease;
  }
}
```

- Applies to `<body>` only. Individual elements inherit via their own color resolution timing (which is effectively instant for CSS-variable-backed declarations — the 150ms body transition reads as a global wash).
- Respect `prefers-reduced-motion`: wrap in `@media (prefers-reduced-motion: no-preference)` block to disable transition for motion-sensitive users.
- No transition on borders, shadows, or fills at the component level — keep it simple. The perceived effect is "the page washes from light to dark in 150ms."

---

## Copywriting Contract

Phase 49 is paint-only — it introduces **one** new piece of user-visible copy (the theme toggle label + tooltip) and **consolidates** existing dashboard copy (no new strings outside the toggle).

| Element | Copy |
|---------|------|
| Primary CTA | N/A — no CTAs introduced this phase |
| Theme toggle label (light mode active) | "Dark mode" |
| Theme toggle label (dark mode active) | "Light mode" |
| Theme toggle tooltip (light mode active) | "Switch to dark mode" |
| Theme toggle tooltip (dark mode active) | "Switch to light mode" |
| Theme toggle aria-label | "Switch to {target} mode" (dynamic) |
| Empty state heading | N/A — no new empty states (deferred to Phase 51 POLISH-01) |
| Empty state body | N/A |
| Error state | N/A — no new error states (deferred to Phase 51 POLISH-04) |
| Destructive confirmation | N/A — no new destructive actions |

**Copy style rules (inherited from existing dashboard):**
- Sentence case (not Title Case): "Dark mode" not "Dark Mode".
- Action-oriented tooltips: "Switch to X" not "Toggle theme" or "Change mode."
- No emoji or punctuation in button labels.
- aria-label uses same verb-object form as tooltip for consistency between visual and assistive contexts.

---

## Files Executor Will Touch (Informational — Scope Reference)

This phase touches ~74 files. The UI contract governs each by the category rules above. Listed here so the planner can scope plans.

**Core infrastructure (4 files):**
- `src/app/layout.js` — add ThemeProvider wrapper and `suppressHydrationWarning`.
- `src/app/globals.css` — add new CSS variables to `:root` and `.dark`; add 150ms body transition; fix `@custom-variant dark` bleed selector.
- `src/lib/design-tokens.js` — convert hex literals to `var(--*)` references.
- `src/components/dashboard/DashboardSidebar.jsx` — add theme toggle button.

**Component migration (59 dashboard component files):** Apply category treatments above. Notable: `LeadFlyout.jsx` (30 hex), `AppointmentFlyout.js` (12 hex), `LeadStatusPills.jsx` (4 hex), `BookingStatusBadge.js` (2 hex), `QuickBookSheet.js` (3 hex), `ChatbotSheet.jsx` (2 hex).

**Page migration (15 dashboard page files):** Apply same category treatments. Touch `dashboard/layout.js` explicitly for the `bg-[#F5F5F4]` → `bg-background` swap.

**Banners (3 files in `src/app/dashboard/`):** `ImpersonationBanner.js`, `TrialCountdownBanner.js`, `BillingWarningBanner.js` — apply banner category rule.

**Files NOT to touch this phase (Phase 50 scope):**
- `AnalyticsCharts.jsx` (41 hex — SVG inline style, needs `useTheme()` hook).
- `CalendarView.js` (23 hex — dynamic class concatenation, needs `useTheme()` hook).

**Files NOT to touch ever (landing page — out of scope by brand decision):**
- `src/app/(public)/**` — landing, about, pricing, contact all stay permanently light-only.
- `src/components/landing/**` — same.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | Tooltip (for theme toggle hover), Button, AlertDialog, Separator — all already in use | not required |
| Third-party registries | **none** | not applicable |

No third-party blocks declared. No `npx shadcn view` vetting required. Registry safety gate: clean.

---

## Contract Summary

- **Spacing:** 8-point scale, no new primitives, toggle button reuses sidebar footer geometry.
- **Typography:** 4 sizes, 4 weights (within acceptable single-family Inter var-font budget), POLISH-08 consolidates to `text-foreground` / `text-muted-foreground`.
- **Color:** Dominant warm-neutral (light) / near-black (dark) / 30% card-elevated / 10% brand orange with a calibrated dark variant `#FB923C`. Accent reserved for 7 explicit use cases.
- **Copy:** 1 new string (theme toggle + tooltip + aria-label, 4 variants).
- **Registry:** shadcn official only — no vetting gate required.
- **Motion:** Single 150ms body-level color transition, reduced-motion-aware.
- **Contrast:** All new pairings validated ≥ WCAG AA.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending

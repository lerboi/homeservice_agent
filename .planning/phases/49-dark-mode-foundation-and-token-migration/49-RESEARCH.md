# Phase 49: Dark Mode Foundation and Token Migration - Research

**Researched:** 2026-04-15
**Domain:** Next.js 16 App Router + Tailwind v4 + shadcn/ui + next-themes theming; ~620 hardcoded hex → semantic-token migration across dashboard surface
**Confidence:** HIGH

## Summary

All theme infrastructure is either installed or half-wired: `next-themes ^0.4.6` is already a declared dependency but never imported; shadcn/ui CSS variables (`:root` and `.dark`) are fully populated in `globals.css` lines 127–204; Tailwind v4's `@theme inline` block already maps `bg-background / text-foreground / bg-card / text-muted-foreground` to those variables; and `Toaster` (Sonner) already consumes `useTheme()` — it will "just work" once `<ThemeProvider>` is mounted. The work is therefore dominated by **token migration** across ~620 hex occurrences in 83 dashboard files, not by infrastructure.

The migration splits cleanly along file-type boundaries: (1) infrastructure (4 files — `layout.js`, `globals.css`, `design-tokens.js`, `DashboardSidebar.jsx`), (2) banners (3 files, bespoke amber/blue/red pattern per UI-SPEC), (3) categorical badges/pills (3 files — LeadStatusPills, BookingStatusBadge, EstimateStatusBadge — where categorical meaning must be preserved), (4) flyouts and modals (4 files totaling 47 hex — LeadFlyout/AppointmentFlyout/QuickBookSheet/ChatbotSheet — DARK-06), (5) remaining 49 dashboard components and 24 pages (bulk paint work, ~500 hex). The planner should explicitly **exclude** `AnalyticsCharts.jsx` (41) and `CalendarView.js` (23) — both deferred to Phase 50 per CONTEXT.md.

**Primary recommendation:** 5 plans in order — (49-01) infrastructure + toggle + 150ms transition + `@custom-variant` fix; (49-02) `design-tokens.js` + typography consolidation POLISH-08; (49-03) banners + categorical pills/badges (preserves meaning by category mapping); (49-04) flyouts and modals (DARK-06 target); (49-05) bulk component and page migration with automated hex-class grep acceptance. This grouping minimizes merge conflicts because each plan touches a disjoint file set.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Theme toggle UX:**
- **D-01:** `next-themes` with `defaultTheme="system"` and `enableSystem=true` on root `ThemeProvider`. First visit follows OS `prefers-color-scheme`; after first click user's choice is stored and no longer tracks OS.
- **D-02:** Sidebar toggle is a **binary icon button** (sun ↔ moon, lucide-react). No "System" third option. Writes `theme="light"` or `theme="dark"` directly.
- **D-03:** Placement — inside `DashboardSidebar.jsx`, sidebar footer cluster, **above Log Out**, adjacent to Ask Voco AI. Same visual treatment as existing sidebar footer buttons. Tooltip on hover.
- **D-04:** `suppressHydrationWarning` on root `<html>`; `<ThemeProvider>` wraps `<NextIntlClientProvider>` inside `<body>`. Standard next-themes script injection — no custom hydration logic.
- **D-05:** 150ms body background/text transition via single CSS rule in `globals.css` targeting `body` — NOT per-component transition classes.

**Scope:**
- **D-06:** Dark mode activates only on `/dashboard/*`. `ThemeProvider` still wraps entire app (it's in root layout) but only dashboard surfaces have dark-aware styles.
- **D-07:** Admin, billing upgrade, onboarding, auth — stay light-only. If they share layout primitives with dashboard they may incidentally render dark when toggled — acceptable as long as readable.
- **D-08:** Landing/marketing (`/(public)/*`) **permanently light-only**. Brand decision.
- **D-09:** `design-tokens.js` is imported by both dashboard and onboarding (and 3 landing pages). Planner MUST decide: (a) scope dark variants to dashboard via compound selectors, (b) duplicate tokens into dashboard-specific file, or (c) accept shared-token flip everywhere `.dark` is active.

**Brand orange:**
- **D-10:** `#C2410C` in light, `#FB923C` (orange-400) in dark — calibrated for AA on dark. Wire as `--brand-accent` in both `:root` and `.dark`; `design-tokens.js` references `var(--brand-accent)`.
- **D-11:** Selection/hover tints — orange border stays, fill swaps to `bg-white/[0.04]` in dark. Orange tint is invisible on dark anyway.
- **D-12:** All brand orange usages (focus rings, primary buttons, active nav indicator, logout confirm) use same `var(--brand-accent)` indirection.

**Migration approach:**
- **D-13:** Strong prior — **CSS-variable-first**. Extend `:root` and `.dark` with semantic tokens; convert `design-tokens.js` + component class strings to `var(--*)`. Leverages existing shadcn scaffolding; avoids hundreds of `dark:` prefix additions.
- **D-14:** Typography consolidation (POLISH-08) — introduce `heading` and `body` tokens resolving to `var(--foreground)` and `var(--muted-foreground)`, eliminating hardcoded `text-[#0F172A]` and `text-[#475569]` in `design-tokens.js`.

### Claude's Discretion

- Exact token naming (`--brand-accent` vs `--primary-accent` vs `--accent-orange`).
- Whether to cluster tokens (surface, border, text, accent) or keep flat.
- ESLint rule or CI grep to prevent future hex regressions (nice-to-have).
- Order of file migration within a plan (atomic per file-family vs big-bang).
- Testing approach — visual diffing vs screenshot checklist vs Storybook.

### Deferred Ideas (OUT OF SCOPE)

- **Recharts dark mode (DARK-05)** — Phase 50 (needs `useTheme()` for SVG inline styles).
- **CalendarView urgency colors (DARK-10)** — Phase 50 (dynamic class concatenation needs useTheme).
- **POLISH-01 through POLISH-10 (except POLISH-08)** — Phase 51 polish pass.
- **Landing page dark mode** — rejected on brand grounds. Not deferred; permanent.
- **Admin / billing / onboarding / auth dark mode** — indefinite defer.
- **ESLint rule to block `text-[#...]`** — optional guardrail.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DARK-01 | ThemeProvider wired in root layout, suppressHydrationWarning on `<html>`, `defaultTheme=system`, `enableSystem=true`, no hydration flash | shadcn/ui canonical pattern (see §Architecture Patterns Pattern 1); apply to `src/app/layout.js`; script injection from next-themes eliminates flash |
| DARK-02 | Owner toggles light/dark/system in sidebar; persists via localStorage | next-themes default `storageKey='theme'` writes to localStorage automatically (§next-themes Behavior); button in `DashboardSidebar.jsx` per UI-SPEC §Placement |
| DARK-03 | All dashboard component files replace hardcoded hex with dark-aware tokens | Hex audit below lists 371 occurrences across 59 component files; CSS-variable-first strategy (D-13) converts via `design-tokens.js` + per-file replace |
| DARK-04 | `design-tokens.js` exports dark variants for btn/card/glass/heading/body/focus/selected | `design-tokens.js` §Current State audit — 7 token groups need `var(--*)` conversion; see §Code Examples token conversion table |
| DARK-06 | All flyouts/modals render correctly in dark mode | Flyout category rule from UI-SPEC maps to `bg-card` + `border-border` + `text-muted-foreground`; 47 hex occurrences across 4 flyout files |
| DARK-07 | Status badges / urgency pills / LeadStatusPills preserve contrast AND category meaning | Category table in UI-SPEC (success/warning/info/neutral/destructive/active) — shift `{color}-50/700/200` → `{color}-950/40 / 300 / 800/60`; see §Pitfall "Categorical Inversion Collapse" |
| DARK-08 | Layout/sidebar/bottom tab bar/banners respond to theme | Sidebar stays navy (intentional D-07 note from STATE.md); bottom tab bar migrates `bg-white` → `bg-card`; banner pattern per UI-SPEC |
| DARK-09 | 150ms body transition, no jank | Single CSS rule in `globals.css` `@layer base { body { transition: background-color 150ms ease, color 150ms ease; } }`; **MUST NOT pass `disableTransitionOnChange` prop** (contradicts 150ms — see Pitfall 2) |
| POLISH-08 | Dashboard typography consolidated to token color values | `heading = 'text-foreground tracking-tight'`, `body = 'text-muted-foreground'` per UI-SPEC Typography table; grep acceptance: 0 matches for `text-\[#0F172A\]\|text-\[#475569\]` in dashboard trees |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next-themes | **0.4.6** (current registry release, published 2025-03-11) | Client-side theme provider with SSR-safe script injection, localStorage persistence, system preference detection | Canonical Next.js App Router theming primitive; shadcn/ui's documented choice; already in `package.json` [VERIFIED: `npm view next-themes version`] |
| Tailwind CSS | ^4.2.2 (v4) | Utility-first styling with `@custom-variant` dark support | Already project standard; `@custom-variant dark` in `globals.css` line 3 [VERIFIED: package.json + globals.css] |
| shadcn/ui scaffolding | new-york / neutral / cssVariables=true | `:root` and `.dark` CSS variable blocks, `@theme inline` utility bindings | Already wired in `globals.css` lines 127–204; `bg-background` / `text-foreground` / `bg-card` / `text-muted-foreground` utilities already functional [VERIFIED: globals.css read] |
| lucide-react | ^0.577.0 | `<Sun />`, `<Moon />` icons for toggle | Already in use throughout dashboard — same import site as other sidebar icons [VERIFIED: package.json + DashboardSidebar.jsx imports] |
| @radix-ui Tooltip | via shadcn `Tooltip` primitive | Hover tooltip on toggle button | Already in use (`TooltipProvider` in `dashboard/layout.js` line 47); inherits shadcn's `bg-popover / text-popover-foreground` (dark-aware for free) [VERIFIED: dashboard/layout.js] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner | ^2.0.7 (existing) | Toast component already consumes `useTheme()` | No migration required — will auto-theme once `<ThemeProvider>` mounts [VERIFIED: src/components/ui/sonner.jsx line 16] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `next-themes` | Custom `useState` + `useEffect` hook + manual localStorage | No SSR anti-flash script injection — guaranteed light-mode flash on hard reload. Rejected — DARK-01 explicitly requires no flash. |
| CSS-variable-first (D-13) | `dark:` prefix on every component | ~620 `dark:` additions vs ~8 new CSS variables + `design-tokens.js` edits. D-13 prior already locked this in. |
| Class-based dark variant (`.dark` on `<html>`) | `prefers-color-scheme` media query | Media query can't be toggled by user — violates DARK-02. Already wired as class variant in `globals.css` line 3. |

**Installation:**

No new packages required. `next-themes@0.4.6` already in `package.json` dependencies line 42 [VERIFIED: package.json read].

**Version verification:** `next-themes` latest release is **0.4.6** (published 2025-03-11) [VERIFIED: `npm view next-themes version`]. Project already on latest — no upgrade needed.

## Architecture Patterns

### Recommended Project Structure

No structural changes. Touch points:

```
src/
├── app/
│   ├── layout.js                         # + <ThemeProvider> wrap; + suppressHydrationWarning
│   ├── globals.css                       # + new --brand-accent / --selected-fill / --warm-surface tokens
│   │                                     # + body 150ms transition rule
│   │                                     # + fix @custom-variant dark selector
│   └── dashboard/
│       ├── layout.js                     # bg-[#F5F5F4] → bg-background
│       ├── ImpersonationBanner.js        # amber-50/900/300 → dark variants
│       ├── TrialCountdownBanner.js       # blue-50/900 → dark variants
│       ├── BillingWarningBanner.js       # amber/red dark variants
│       └── {9 page dirs}/page.js         # bulk hex → token replacement
├── components/
│   ├── dashboard/
│   │   ├── DashboardSidebar.jsx          # + theme toggle button (binary flip)
│   │   ├── LeadStatusPills.jsx           # categorical mapping
│   │   ├── BookingStatusBadge.js         # categorical mapping
│   │   ├── EstimateStatusBadge.jsx       # categorical mapping
│   │   ├── LeadFlyout.jsx                # 30 hex → bg-card / text-foreground
│   │   ├── AppointmentFlyout.js          # 12 hex → same
│   │   ├── QuickBookSheet.js             # 3 hex
│   │   ├── ChatbotSheet.jsx              # 2 hex
│   │   ├── AnalyticsCharts.jsx           # ❌ DO NOT TOUCH (Phase 50)
│   │   ├── CalendarView.js               # ❌ DO NOT TOUCH (Phase 50)
│   │   └── {55 other components}         # bulk token migration
│   └── ui/
│       └── sonner.jsx                    # already dark-aware; no edit
└── lib/
    └── design-tokens.js                  # hex literals → var(--*) references
                                          # heading → text-foreground, body → text-muted-foreground
```

### Pattern 1: Root Layout ThemeProvider Wiring (shadcn/ui canonical)

**What:** Mount `<ThemeProvider>` from `next-themes` inside `<body>`, wrap all app children. Put `suppressHydrationWarning` on `<html>` to silence the intentional server/client className mismatch that the next-themes script causes.

**When to use:** Once, in `src/app/layout.js`.

**Example (to be adapted for our `layout.js`):**

```jsx
// Source: https://ui.shadcn.com/docs/dark-mode/next [CITED]
// Adapted for Voco: JS not TS, existing <NextIntlClientProvider> wrapping preserved,
// Inter font className on <html> preserved.

// src/components/theme-provider.jsx (NEW file)
'use client';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

export function ThemeProvider({ children, ...props }) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}

// src/app/layout.js (EDIT existing)
import { ThemeProvider } from '@/components/theme-provider';
// ... existing imports ...

export default async function RootLayout({ children }) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale} className={inter.variable} suppressHydrationWarning>
      <head>{/* existing spline prefetch */}</head>
      <body className="relative">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          // NOTE: do NOT pass disableTransitionOnChange — it would defeat DARK-09's
          // 150ms body transition. See Pitfall 2.
        >
          <NextIntlClientProvider messages={messages}>
            {children}
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

Key props (all [VERIFIED: shadcn/ui docs + next-themes README]):
- `attribute="class"` — toggles `class="dark"` on `<html>` (matches our `@custom-variant dark` in `globals.css`)
- `defaultTheme="system"` — first visit follows OS (D-01)
- `enableSystem` — enables `'system'` as a valid theme value
- `storageKey` — default `'theme'` in localStorage (satisfies DARK-02 persistence — no config needed)

### Pattern 2: Theme Toggle Button with Hydration Guard

**What:** Render a mount-stable placeholder until client hydrates, then show real sun/moon state.

**When to use:** Any component that reads `useTheme()` and renders theme-dependent content.

**Example:**

```jsx
// Source: next-themes README + shadcn/ui Mode Toggle pattern [CITED]
// Target file: src/components/dashboard/DashboardSidebar.jsx (sibling to Ask Voco AI)

'use client';
import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

function ThemeToggleButton() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Pre-hydration placeholder — same dimensions, invisible, aria-hidden
  if (!mounted) {
    return (
      <button
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/60 border-l-2 border-transparent ml-0 pl-[10px] w-full opacity-0"
        aria-hidden="true"
        tabIndex={-1}
      >
        <Moon className="h-4 w-4 shrink-0" />
        Dark mode
      </button>
    );
  }

  const isDark = resolvedTheme === 'dark';
  const Icon = isDark ? Sun : Moon;
  const label = isDark ? 'Light mode' : 'Dark mode';
  const target = isDark ? 'light' : 'dark';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={() => setTheme(target)}
          aria-label={`Switch to ${target} mode`}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-white/60 hover:bg-white/[0.04] hover:text-white/80 border-l-2 border-transparent ml-0 pl-[10px] w-full"
        >
          <Icon className="h-4 w-4 shrink-0" />
          {label}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">Switch to {target} mode</TooltipContent>
    </Tooltip>
  );
}
```

- Uses `resolvedTheme` not `theme` — critical because `theme` returns `'system'` during system-follow, which would mean we can't tell whether to show Sun or Moon. [VERIFIED: next-themes README §useTheme]
- Placeholder has identical geometry to real button — no layout shift on hydration.

### Pattern 3: 150ms Body Transition (DARK-09)

**What:** Single CSS rule at the body level; no per-component transition classes.

**When to use:** Once, in `globals.css` inside `@layer base`.

**Example:**

```css
/* src/app/globals.css — add to existing @layer base block */
@layer base {
  @media (prefers-reduced-motion: no-preference) {
    body {
      transition:
        background-color 150ms ease,
        color 150ms ease;
    }
  }
  /* existing * { @apply border-border outline-ring/50; } stays */
  /* existing body { @apply bg-background text-foreground; ... } stays */
}
```

- Wrapped in `prefers-reduced-motion: no-preference` to respect accessibility (WCAG 2.3.3).
- Applies only to `body` — individual elements inherit via CSS variable resolution (effectively instant).
- **Do not** add `transition-colors` utility to individual components — it multiplies transitions and produces staggered flash.

### Anti-Patterns to Avoid

- **`disableTransitionOnChange={true}`** — it forcefully disables ALL CSS transitions during theme switch, defeating DARK-09. Default is `false` — simply omit the prop. [VERIFIED: next-themes GitHub PR #257 + paco.me writing]
- **Per-component `dark:` prefixes** — D-13 rejects this. Hundreds of additions vs one token layer change. CSS-variable-first is the project convention.
- **Theme read during SSR/server components** — `useTheme()` is a client hook. Dashboard pages are already client components via `'use client'` directives (see `dashboard/layout.js`). Don't call in server components.
- **Reading `theme` when you need `resolvedTheme`** — `theme` returns `'system'` when the user hasn't made a choice; it's only useful for 3-option UIs. Binary toggle (D-02) must read `resolvedTheme`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSR-safe theme script injection | Custom `<script>` in `<head>` that reads localStorage and toggles class | `next-themes` `<ThemeProvider>` | next-themes injects the script pre-hydration — battle-tested across browsers, handles edge cases like private browsing (no localStorage), iOS Safari quirks [VERIFIED: next-themes README "2 lines of code"] |
| Theme persistence | `useEffect` writing to `window.localStorage` | next-themes' built-in storage | Handles SSR, handles storage events (cross-tab sync), handles permission errors [VERIFIED: npm docs] |
| System preference detection | `window.matchMedia('(prefers-color-scheme: dark)')` wrapper | `enableSystem` + `defaultTheme="system"` prop | next-themes listens for OS changes and re-applies only when user hasn't made explicit choice [VERIFIED: next-themes README] |
| Categorical dark-mode color mapping | Hand-tuned per-component dark values | UI-SPEC category table (§Status Badges and Urgency Pills) | 6 categories × consistent `-50 → -950/40`, `-700 → -300`, `-200 → -800/60` shift — applies uniformly across 3 pill/badge files. Per-component creativity is DARK-07's primary risk. |
| Toast dark mode | Per-toast theme props | sonner's existing `useTheme()` integration in `src/components/ui/sonner.jsx` | Already wired line 16 — works automatically once provider mounts [VERIFIED: sonner.jsx read] |

**Key insight:** The only net-new code is the toggle button (≈40 lines) and one CSS file edit. Everything else is **replacement** — swapping hex strings for `var(--*)` references. Don't overbuild.

## Runtime State Inventory

(Not a rename/migration phase — this section is informational for completeness.)

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — theme lives in `localStorage` only after first user click; no server-side storage | None |
| Live service config | None | None |
| OS-registered state | None | None |
| Secrets/env vars | None | None |
| Build artifacts | None — pure source edits; Next.js will rebuild automatically | None |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| next-themes | ThemeProvider, useTheme hook | ✓ | 0.4.6 (latest) | — |
| Tailwind v4 + `@custom-variant` | `.dark` class variant | ✓ | 4.2.2 | — |
| shadcn/ui CSS variables | `:root` / `.dark` blocks | ✓ | already in globals.css 127–204 | — |
| lucide-react | Sun / Moon icons | ✓ | 0.577.0 | — |
| Radix Tooltip (via shadcn) | Toggle button tooltip | ✓ | via `@/components/ui/tooltip` + `<TooltipProvider>` in dashboard/layout.js | — |

**No blocking dependencies.** All infrastructure is either installed or present in the codebase.

## Common Pitfalls

### Pitfall 1: Hydration Flash on Hard Reload

**What goes wrong:** Page loads in light mode, then flashes to dark after JS hydrates.
**Why it happens:** Without next-themes' inline script, the browser renders the server-rendered HTML (no `.dark` class) before client JS runs. Any hand-rolled `useEffect`-based theme-apply runs AFTER first paint.
**How to avoid:**
1. Install `<ThemeProvider>` from `next-themes` (injects script pre-hydration).
2. Add `suppressHydrationWarning` to `<html>` — the `class="dark"` attribute the script sets is an intentional server/client mismatch.
3. Do NOT use `disableTransitionOnChange` (it would defeat the 150ms body fade per D-05).
**Warning signs:** Console warning `Warning: Prop className did not match. Server: "" Client: "dark"`; visible flash of light content on `Cmd+Shift+R` hard reload in dark mode.

### Pitfall 2: disableTransitionOnChange Defeats DARK-09 150ms Transition

**What goes wrong:** Adding `disableTransitionOnChange` to `<ThemeProvider>` (copy-pasted from shadcn's canonical snippet) prevents the 150ms body transition from running — theme swap becomes instant, violating DARK-09's "smoothly transitions" requirement.
**Why it happens:** next-themes injects a temporary `* { transition: none !important; }` stylesheet around the class swap to prevent stagger-flash. Our single body-level transition is the ONE transition we want.
**How to avoid:** OMIT the `disableTransitionOnChange` prop (defaults to false). Alternative: keep it true and add `enable-transition-on-change` class to `<body>` (next-themes PR #257) — but the simpler path is to not pass it at all.
**Warning signs:** Transition happens in zero frames; checking DevTools Performance panel shows no animation over 150ms after click; planner or executor copy-pasted the shadcn canonical snippet without reading its transition implications.
[CITED: https://github.com/pacocoursey/next-themes/pull/257, https://paco.me/writing/disable-theme-transitions]

### Pitfall 3: Categorical Inversion Collapse in Status Pills

**What goes wrong:** Naive `bg-green-50` → `bg-green-900` (symmetric inversion) makes multiple categories indistinguishable on dark surface because `green-900` and `red-900` both look "dark with slight hue."
**Why it happens:** Color perception of saturated-dark shades is dominated by lightness, not hue. `-900` values have ~18% luminance and all read as "dark-with-tint."
**How to avoid:** Use the UI-SPEC §Status Badges category table verbatim — `bg-{color}-950/40 text-{color}-300 border-{color}-800/60`. The `/40` opacity on dark-950 fills lets the page background show through, keeping overall luminance distinct from card backgrounds; the `-300` text provides ~AA contrast on dark; the `-800/60` border disambiguates categories at low opacity. **Do not invent per-component dark values** — 6 categories × 3 files × creativity = guaranteed drift.
**Warning signs:** Manual screenshot review shows "Booked" (success) and "Lost" (destructive) pills look similar at arm's length in dark mode; executor starts writing bespoke dark shades per component.

### Pitfall 4: Shared-Token Bleed to Onboarding/Landing (D-09 Risk)

**What goes wrong:** `design-tokens.js` is imported by dashboard, onboarding, and 3 public landing pages [VERIFIED: Grep]. When we change `card.base` from `bg-white` → `bg-card` (dark-aware), onboarding visually flips if the user ever lands there with `.dark` on `<html>`.
**Why it happens:** `ThemeProvider` wraps the entire app in root layout (D-06). Any route under that tree inherits the class. Non-dashboard routes don't have dark-aware styles, but tokens imported from `design-tokens.js` DO change when the CSS variable values differ.
**How to avoid (planner decides):**
- **Option A (recommended):** Accept bleed. In light mode, `bg-card` = `oklch(1 0 0)` = `#ffffff` = what `bg-white` used to be — zero visual delta on landing pages which have hardcoded `bg-[#F5F5F4]` page backgrounds anyway. User only reaches `.dark` after explicit toggle in dashboard; the 3 landing pages that import `card` (`/for`, `/compare`, `/integrations`) are never viewed while `.dark` is active in practice.
- **Option B:** Scope dark variants to `.dark [data-theme-scope="dashboard"] &` compound — adds a `<div data-theme-scope="dashboard">` wrapper in `dashboard/layout.js`. Clean but invasive to CSS variable declaration.
- **Option C:** Duplicate `design-tokens.js` into a dashboard-specific file. Clean but creates two-source drift.
**Warning signs:** User reports "onboarding went dark" — would only happen if they explicitly toggle dark in dashboard, then navigate back to onboarding in the same session. Low probability per D-07.
**Recommendation for planner:** Option A. Document the acceptable-bleed scope in plan spec.

### Pitfall 5: `@custom-variant dark` Selector Bleed

**What goes wrong:** Current selector in `globals.css` line 3 is `(&:is(.dark *))`. This matches descendants of `.dark` but NOT `.dark` itself. When next-themes sets `class="dark"` on `<html>`, the `<html>` element itself won't match `html.dark:bg-background` — only its descendants do.
**Why it happens:** `:is(.dark *)` parses as "any element inside something with class .dark"; it does not include the `.dark` element itself. For `<html class="dark">`, `<html>` has no `.dark` ancestor, so utilities applied at the html level don't fire.
**How to avoid:** Change line 3 to `@custom-variant dark (&:where(.dark, .dark *))`. `:where()` adds zero specificity (safer than `:is()`); including both `.dark` and `.dark *` matches the element itself AND descendants. STATE.md flagged this as "P0 infrastructure fix in Phase 49."
**Warning signs:** `<html class="dark">` is set but `body` background doesn't change — only because body inherits via `@apply bg-background text-foreground` whose `bg-background` utility does match (body IS a descendant of html.dark). Still, other `dark:` utilities applied to `<html>` directly would silently fail.
[VERIFIED: Tailwind v4 discussion #15083; STATE.md v5.0 Research entry]

### Pitfall 6: Typography Consolidation Breaks Rich-Text Surfaces

**What goes wrong:** Replacing `text-[#0F172A]` globally with `text-foreground` sweeps up legitimate dark-contextual uses (e.g., text on the navy sidebar that must stay white, text inside orange buttons that must stay white).
**Why it happens:** grep-replace doesn't understand context. `text-[#0F172A]` inside `DashboardSidebar.jsx` means "dark text on white-ish chip overlaid on navy" and is locally correct.
**How to avoid:**
1. Audit `DashboardSidebar.jsx` (3 hex) separately — most sidebar text is `text-white/*` already, so risk is low.
2. Audit `design-tokens.js` `btn.primary` — uses `text-white` for text ON orange button; stays `text-white` (not `text-foreground`).
3. Grep acceptance restricts to `src/app/dashboard` and `src/components/dashboard` — does NOT sweep `src/components/ui/*` shadcn primitives or `DashboardSidebar.jsx` non-body text.
4. Executor reads surrounding markup for each replacement (not pure sed).
**Warning signs:** "Log Out" button text becomes invisible; "Ask Voco AI" text flips contrast on navy sidebar; primary CTA text reverses.

### Pitfall 7: Semantic Token Drift (Declared But Not Replaced)

**What goes wrong:** Plan adds `--brand-accent` to `:root` and `.dark`, and updates `design-tokens.js` to reference it — but component files still contain literal `bg-[#C2410C]` and `border-[#C2410C]` that don't read the variable.
**Why it happens:** Migration is two-layer (variable declaration + consumer replacement). Declaring tokens without doing the hex-to-token sweep leaves the codebase lying about its theme support.
**How to avoid:** Grep acceptance gate per plan: `grep -rn "#C2410C\|#9A3412\|#F5F5F4\|#0F172A\|#475569" src/app/dashboard src/components/dashboard` returns 0 matches (excluding `DashboardSidebar.jsx` navy background which is intentional per STATE.md D-07 note). Planner should spec this grep as a task acceptance check.
**Warning signs:** Toggle dark mode, orange CTA stays `#C2410C` (too saturated on dark), selected card still has orange tint fill.

## Code Examples

### design-tokens.js → CSS variable conversion

```javascript
// src/lib/design-tokens.js — BEFORE (current state, lines 1–40)
export const colors = {
  brandOrange: '#C2410C',
  brandOrangeDark: '#9A3412',
  navy: '#0F172A',
  warmSurface: '#F5F5F4',
  bodyText: '#475569',
};
export const btn = {
  primary:
    'bg-[#C2410C] hover:bg-[#C2410C]/90 active:bg-[#9A3412] active:scale-95 text-white shadow-[...] transition-all duration-150',
};
export const card = {
  base: 'bg-white rounded-2xl shadow-[...] border border-stone-200/60',
};
export const glass = {
  topBar: 'bg-white/80 backdrop-blur-md border-b border-stone-200/60',
};
export const heading = 'text-[#0F172A] tracking-tight';
export const body = 'text-[#475569]';
export const focus = {
  ring: 'focus:outline-none focus:ring-2 focus:ring-[#C2410C] focus:ring-offset-1',
};
export const selected = {
  card: 'border-[#C2410C] bg-[#C2410C]/[0.04]',
  cardIdle: 'border-stone-200 bg-[#F5F5F4] hover:bg-stone-100',
};

// AFTER (proposed — references new globals.css tokens)
export const btn = {
  primary:
    'bg-[var(--brand-accent)] hover:bg-[var(--brand-accent)]/90 active:bg-[var(--brand-accent-hover)] active:scale-95 text-[var(--brand-accent-fg)] shadow-[...] transition-all duration-150',
};
export const card = {
  base: 'bg-card rounded-2xl shadow-[...] border border-border',
};
export const glass = {
  topBar: 'bg-card/80 backdrop-blur-md border-b border-border',
};
export const heading = 'text-foreground tracking-tight';   // POLISH-08
export const body = 'text-muted-foreground';                // POLISH-08
export const focus = {
  ring: 'focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] focus:ring-offset-1',
};
export const selected = {
  card: 'border-[var(--brand-accent)] bg-[var(--selected-fill)]',
  cardIdle: 'border-border bg-muted hover:bg-accent',
};
```

Note: Tailwind v4 arbitrary-value syntax `bg-[var(--brand-accent)]` requires no `@theme inline` mapping for custom tokens that aren't utility-named. For the standard shadcn ones (`bg-card`, `bg-muted`, `bg-accent`, `text-foreground`, `text-muted-foreground`, `border-border`), the existing `@theme inline` block in `globals.css` lines 5–54 already maps them.

### globals.css — new tokens to add

```css
/* src/app/globals.css — additions to :root and .dark */
:root {
  /* ... existing tokens ... */
  --brand-accent: #C2410C;
  --brand-accent-hover: #B53B0A;
  --brand-accent-fg: #FFFFFF;
  --selected-fill: rgba(194, 65, 12, 0.04);
  --warm-surface: #F5F5F4;         /* alias; landing already uses --color-warm-surface */
  --warm-surface-elevated: #FAFAF9;
}

.dark {
  /* ... existing tokens ... */
  --brand-accent: #FB923C;         /* orange-400 per D-10 */
  --brand-accent-hover: #F97316;   /* orange-500 */
  --brand-accent-fg: #0F172A;      /* dark text on light-orange button — AA per UI-SPEC */
  --selected-fill: rgba(255, 255, 255, 0.04);
  --warm-surface: oklch(0.145 0 0);
  --warm-surface-elevated: oklch(0.205 0 0);
}

/* Fix @custom-variant selector (line 3) — current: (&:is(.dark *)) → new: */
@custom-variant dark (&:where(.dark, .dark *));

/* Body transition (new) */
@layer base {
  @media (prefers-reduced-motion: no-preference) {
    body {
      transition:
        background-color 150ms ease,
        color 150ms ease;
    }
  }
}
```

### Banner migration — UI-SPEC pattern

```jsx
// src/app/dashboard/ImpersonationBanner.js — key class diff
// BEFORE:
className="sticky top-0 z-40 h-11 bg-amber-50 border-b border-amber-300 ..."
// AFTER (per UI-SPEC §System Banners):
className="sticky top-0 z-40 h-11 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-300 dark:border-amber-800/60 ..."

// text-amber-800 → text-amber-800 dark:text-amber-200
// hover:bg-amber-100 → hover:bg-amber-100 dark:hover:bg-amber-900/40
```

Note: Banners are the ONE case where `dark:` prefixes are appropriate (per UI-SPEC explicit category mapping). Elsewhere, CSS-variable-first (D-13) avoids them.

### Status pill categorical mapping

```javascript
// src/components/dashboard/LeadStatusPills.jsx — BEFORE (line 3–9)
const PIPELINE_STATUSES = [
  { value: 'new', activeClass: 'bg-[#C2410C] text-white border-[#C2410C]' },
  { value: 'booked', activeClass: 'bg-blue-600 text-white border-blue-600' },
  { value: 'completed', activeClass: 'bg-stone-700 text-white border-stone-700' },
  { value: 'paid', activeClass: 'bg-[#166534] text-white border-[#166534]' },
  { value: 'lost', activeClass: 'bg-red-600 text-white border-red-600' },
];

// AFTER — tokens for brand, dark-aware variants for categorical
const PIPELINE_STATUSES = [
  { value: 'new',       activeClass: 'bg-[var(--brand-accent)] text-[var(--brand-accent-fg)] border-[var(--brand-accent)]' },
  { value: 'booked',    activeClass: 'bg-blue-600 dark:bg-blue-500 text-white border-blue-600 dark:border-blue-500' },
  { value: 'completed', activeClass: 'bg-stone-700 dark:bg-stone-600 text-white border-stone-700 dark:border-stone-600' },
  { value: 'paid',      activeClass: 'bg-[#166534] dark:bg-emerald-600 text-white border-[#166534] dark:border-emerald-600' },
  { value: 'lost',      activeClass: 'bg-red-600 dark:bg-red-500 text-white border-red-600 dark:border-red-500' },
];
const IDLE_CLASS =
  'bg-card text-foreground border-border hover:bg-accent hover:border-accent-foreground/20';
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `darkMode: 'class'` in `tailwind.config.ts` | `@custom-variant dark (&:where(.dark, .dark *))` in CSS | Tailwind v4 (2024) | Config lives in CSS; no JS config file needed. Already in use in globals.css. |
| pages router `_app.tsx` wrapping | App Router root `layout.js` with `<ThemeProvider>` in `<body>` | Next.js 13+ | SSR support via script injection (still in next-themes). Already targeted by this phase. |
| `prefers-color-scheme` media queries | Class-based toggle via `next-themes` | — | User-overridable. Required by DARK-02. |

**Deprecated/outdated:**
- Wrapping `<html>` with `<ThemeProvider>` — incorrect in App Router; provider is a client component, must be inside `<body>`. `suppressHydrationWarning` goes on `<html>` as an attribute, not via provider. [CITED: shadcn/ui docs]

## Project Constraints (from CLAUDE.md)

- **Brand name is "Voco"** — not HomeService AI. Theme toggle labels use "Dark mode" / "Light mode" — no brand mention. ✓
- **Skill sync requirement** — when this phase lands, update `dashboard-crm-system` skill to reflect the new theme toggle, token taxonomy, and typography consolidation. `public-site-i18n` skill likely also needs a note that landing stays permanently light-only despite ThemeProvider wrap.

## Assumptions Log

No claims in this research are `[ASSUMED]` — all verified via `npm view`, file reads, Grep, WebSearch+WebFetch on official sources, and CONTEXT.md / UI-SPEC.md (both approved artifacts).

## Open Questions

1. **Should `suppressHydrationWarning` also be added to `<body>`?**
   - What we know: next-themes mutates `<html>` class; `<body>` is untouched unless we conditionally render theme-dependent content there.
   - What's unclear: whether the `className="relative"` on body is enough to avoid any future mismatch.
   - Recommendation: Add it only to `<html>` per shadcn canonical. Revisit if React logs `<body>` mismatches.

2. **Should the toggle expose a "System" option via long-press or keyboard shortcut?**
   - What we know: D-02 locks binary toggle — no third option in UI.
   - What's unclear: whether power users want an easy escape back to system-follow after making a choice.
   - Recommendation: Keep binary. Users can clear localStorage theme via devtools if needed. Revisit post-launch.

3. **Option A (accept token bleed) vs Option B (scope via `[data-theme-scope="dashboard"]`) — which does the planner pick for D-09?**
   - Recommendation: Option A. `bg-card` in light = `oklch(1 0 0)` = same as `bg-white`. Onboarding/landing pages never render under `.dark` in practice.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7.0 + node experimental-vm-modules |
| Config file | `/Users/leroyngzz/Projects/homeservice_agent/jest.config.js` |
| Quick run command | `npm test -- --testPathPatterns=<pattern>` |
| Full suite command | `npm test:all` |

**Critical limitation:** Existing test infra is Node-environment only (`testEnvironment: 'node'` in jest.config.js line 5) and `testMatch: **/tests/**/*.test.js` pattern. There is **no React testing library, no jsdom, no @testing-library/react** — confirmed by `package.json` lacking these deps and by Phase 48 P01 note in STATE.md ("zod replaced with manual typeof/enum validation (zod not a project dep)").

This means visual/DOM-level dark mode validation **cannot be automated via Jest in the current setup**. The planner has three options:

1. **Pure-function Jest tests** for any theme-logic that can be extracted (e.g., a `getNextTheme(current: 'light' | 'dark') → 'light' | 'dark'` helper) + **manual screenshot checklist** for visual concerns. Low effort, matches project convention.
2. **Grep-based acceptance gates** as Jest tests (node env readable) — scan source files for disallowed hex patterns and assert zero matches. High-value, catches regression, already the project's pattern per STATE.md Phase 48-04 entry ("extracted pure helper so Jest can import without @babel/preset-react").
3. **Puppeteer/Playwright smoke harness** — cross-cutting tooling decision, STATE.md Phase 48 noted this kind of decision is out-of-scope for single-phase work. Skip.

**Recommendation: options 1 + 2.** Pure helper tests for toggle logic (`getNextTheme`, `getThemeLabel`); grep-assertion tests for hex-drift prevention (fail if `bg-[#C2410C]` appears in dashboard tree); manual checklist for visual concerns (contrast, 150ms transition feel, flyout rendering, sidebar navy preservation).

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DARK-01 | ThemeProvider mounted, no hydration warning, no flash on hard reload | smoke (manual) | Manual: hard-reload `/dashboard` in both modes; check console for hydration warnings | ❌ Wave 0: checklist file |
| DARK-01 | `suppressHydrationWarning` on `<html>` | unit (grep) | `grep -q 'suppressHydrationWarning' src/app/layout.js` → exit 0 | ❌ Wave 0: `tests/unit/dark-mode-infra.test.js` |
| DARK-02 | Sidebar toggle exists + correct placement (above Log Out, below Ask Voco AI) | unit (AST-lite grep) | grep `DashboardSidebar.jsx` for `Sun`, `Moon`, `setTheme` | ❌ Wave 0: same file |
| DARK-02 | Theme persists via localStorage | smoke (manual) | Manual: toggle dark → close tab → reopen → still dark | checklist |
| DARK-03 | All dashboard component files have 0 disallowed hex | unit (grep assertion) | `grep -rn "#C2410C\|#9A3412\|#F5F5F4\|#0F172A\|#475569" src/components/dashboard --exclude=AnalyticsCharts.jsx --exclude=CalendarView.js --exclude=DashboardSidebar.jsx` → no output | ❌ Wave 0: `tests/unit/dark-mode-hex-audit.test.js` |
| DARK-04 | `design-tokens.js` exports reference `var(--*)` not literals | unit (grep) | `grep -E 'text-\[#|bg-\[#' src/lib/design-tokens.js` → no output | ❌ Wave 0: same test file |
| DARK-06 | Flyouts use `bg-card` / `text-foreground` / `text-muted-foreground` | unit (grep) | `grep -c 'bg-card\|text-foreground\|text-muted-foreground' src/components/dashboard/{LeadFlyout,AppointmentFlyout,QuickBookSheet,ChatbotSheet}.*` → positive | ❌ Wave 0 |
| DARK-07 | Status pills use categorical `dark:` pattern (preserves meaning) | unit (grep) | grep `LeadStatusPills.jsx` for `dark:bg-{color}-500\|dark:bg-{color}-600` | ❌ Wave 0 |
| DARK-07 | Badge contrast readable in dark mode | smoke (manual) | Manual: axe DevTools on `/dashboard/leads` with `.dark` | checklist |
| DARK-08 | Banners have dark variants | unit (grep) | grep banners for `dark:bg-amber-950/40\|dark:bg-blue-950/40\|dark:bg-red-950/40` | ❌ Wave 0 |
| DARK-08 | Sidebar stays navy in dark mode | unit (grep — negative) | `grep 'dark:bg-' src/components/dashboard/DashboardSidebar.jsx` → no match except new toggle button's ring-offset | ❌ Wave 0 |
| DARK-09 | 150ms body transition rule exists | unit (grep) | `grep -A 5 'prefers-reduced-motion' src/app/globals.css | grep -q '150ms'` | ❌ Wave 0 |
| DARK-09 | Perceived smoothness | smoke (manual) | Manual: toggle in devtools Performance panel; confirm ~150ms paint | checklist |
| POLISH-08 | No `text-[#0F172A]\|text-[#475569]` in dashboard tree | unit (grep assertion) | `grep -rn 'text-\[#0F172A\]\|text-\[#475569\]' src/app/dashboard src/components/dashboard` → no output | ❌ Wave 0: same as DARK-03 |

### Sampling Rate

- **Per task commit:** `npm test -- --testPathPatterns=dark-mode` (runs grep-assertion tests only, < 2 seconds)
- **Per wave merge:** Full grep suite + manual checklist review by executor
- **Phase gate:** Full Jest suite green + manual checklist signed off before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/unit/dark-mode-infra.test.js` — asserts `suppressHydrationWarning` in `src/app/layout.js`, `<ThemeProvider>` import present, `@custom-variant dark (&:where(.dark, .dark *))` present in globals.css, 150ms body transition rule present
- [ ] `tests/unit/dark-mode-hex-audit.test.js` — runs grep as assertion; fails if any disallowed hex appears in dashboard src/components/dashboard or src/app/dashboard, with explicit exclusion list for Phase 50 files (AnalyticsCharts.jsx, CalendarView.js) and intentional sidebar navy
- [ ] `tests/unit/dark-mode-toggle-logic.test.js` — pure-function tests for any theme helper extracted from DashboardSidebar (e.g., `getNextTheme('light') === 'dark'`, `getToggleLabel('dark') === 'Light mode'`)
- [ ] `.planning/phases/49-*/49-MANUAL-CHECKLIST.md` — screenshots and perception checks the executor runs: hard-reload flash check (dark + light + system), cross-tab localStorage sync, 375px viewport in both modes, 6 status-pill categorical distinguishability in dark, all 4 flyouts render readable content, contrast ratios via axe DevTools, 150ms transition feel. Each item signed as PASS/FAIL + notes.

*(No existing dark-mode tests found — everything is a Wave 0 gap. Infrastructure allows grep tests via node env.)*

## Sources

### Primary (HIGH confidence)
- `src/app/globals.css` (read full file) — confirmed shadcn `:root`/`.dark` scaffolding, `@theme inline`, `@custom-variant` selector
- `src/app/layout.js` (read full file) — confirmed no existing ThemeProvider
- `src/lib/design-tokens.js` (read full file) — confirmed hex literals and 7 token groups
- `src/components/dashboard/DashboardSidebar.jsx` (read full file) — confirmed placement target and sibling button styling
- `src/app/dashboard/layout.js` (read full file) — confirmed `TooltipProvider` mounted, `bg-[#F5F5F4]` target for migration
- `src/components/ui/sonner.jsx` (read full file) — confirmed existing `useTheme()` consumer
- `package.json` (read) — confirmed `next-themes@^0.4.6` already installed
- `npm view next-themes version` — 0.4.6 latest, published 2025-03-11 [VERIFIED]
- https://ui.shadcn.com/docs/dark-mode/next [WebFetch] — canonical `<ThemeProvider>` wiring
- Grep audits: 371 hex in 59 components; 250 hex in 24 pages; design-tokens.js imported by 29 files (26 dashboard + 3 landing)

### Secondary (MEDIUM confidence)
- https://github.com/pacocoursey/next-themes/pull/257 [WebSearch summary] — `enable-transition-on-change` escape hatch for `disableTransitionOnChange`
- https://paco.me/writing/disable-theme-transitions [WebSearch summary] — rationale for disable mechanism
- https://github.com/tailwindlabs/tailwindcss/discussions/15083 [WebSearch summary] — `@custom-variant dark (&:where(.dark, .dark *))` recommended pattern

### Tertiary (LOW confidence)
- None. All critical claims are verified against source files or official docs.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified via npm view + package.json read
- Architecture: HIGH — shadcn canonical pattern + fully-read target files
- Pitfalls: HIGH — next-themes disableTransitionOnChange behavior verified against GitHub PR #257 and paco.me's own writing; @custom-variant selector bug verified in globals.css line 3 and Tailwind v4 discussion
- Migration scope: HIGH — exact hex counts verified via Grep across both dashboard trees
- Validation architecture: MEDIUM — Jest infra is node-env only (no RTL/jsdom); grep-based assertions are the pragmatic fit but won't catch visual regressions. Manual checklist covers the gap but depends on executor diligence.

**Research date:** 2026-04-15
**Valid until:** 2026-05-15 (30 days — stable stack, but monitor next-themes for 0.5 release which may ship view transitions integration)

# Technology Stack

**Project:** Voco — v5.0 Trust & Polish
**Researched:** 2026-04-13
**Confidence:** HIGH (existing deps verified in package.json; next-themes usage confirmed in codebase; Tailwind v4 dark mode patterns verified against official docs and community sources)

---

## Scope

This document covers ONLY the stack additions and configuration changes needed for v5.0. The existing validated stack is unchanged:

- Next.js 16 / React 19 (App Router)
- Tailwind CSS v4 (CSS-first, `@import "tailwindcss"`, no tailwind.config.js)
- shadcn/ui components (Radix primitives + CVA)
- framer-motion v12 (installed, actively used in dashboard layout + all landing sections)
- next-intl v4 (i18n)
- lucide-react (icons)
- Supabase (Auth, Postgres, RLS, Realtime)
- recharts v3 (analytics charts)
- sonner v2 (toasts — already uses `useTheme` from next-themes)
- Skeleton component already exists at `src/components/ui/skeleton.jsx`

Three new capabilities required:

1. **Dark mode** — full dashboard coverage, per-user persistence, flash-free
2. **Objection-busting landing sections** — trust/credibility patterns, reuse existing framer-motion primitives
3. **UI/UX polish** — loading states, empty states, micro-interactions, motion refinement

---

## Recommended Stack — New Additions

### Core Libraries

| Technology | Version (installed) | Purpose | Why |
|------------|---------------------|---------|-----|
| `next-themes` | **0.4.6** (already installed) | Theme provider, `.dark` class injection, localStorage persistence, system preference detection | Already in `package.json`. Already used by `sonner.jsx` via `useTheme`. Zero new installs needed. Wire in `ThemeProvider` wrapping the root layout — the only missing piece. |

**That is the only new npm dependency needed.** No other packages are required for the three v5.0 capability areas.

---

### Configuration Changes Required (Not New Packages)

#### 1. Wire `ThemeProvider` into root layout

`next-themes` is installed but `ThemeProvider` is NOT yet wired into `src/app/layout.js`. The `sonner.jsx` `useTheme()` call currently has no provider above it and falls back to the default `"system"` string — this means dark mode state is not actually controlling the app.

**What to add to `src/app/layout.js`:**

```jsx
// src/components/theme-provider.js  (new thin wrapper — "use client" required)
"use client"
import { ThemeProvider as NextThemesProvider } from "next-themes"
export function ThemeProvider({ children, ...props }) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}

// src/app/layout.js  (changes)
// 1. Add suppressHydrationWarning to <html> — next-themes mutates the html element,
//    suppressHydrationWarning prevents the React warning (applies one level deep only)
// 2. Wrap children with ThemeProvider:
<ThemeProvider
  attribute="class"        // injects/removes "dark" class on <html>
  defaultTheme="system"    // honors OS preference on first visit
  enableSystem             // auto-detects prefers-color-scheme
  disableTransitionOnChange // prevents color flash during theme switch
>
  {children}
</ThemeProvider>
```

#### 2. Fix the `@custom-variant dark` selector in `globals.css`

The current definition in `globals.css` line 3 is:
```css
@custom-variant dark (&:is(.dark *));
```

This is subtly broken. `&:is(.dark *)` matches elements that are children of `.dark` — it does NOT match an element that has `.dark` applied to itself. The `<html>` element gets `.dark` from next-themes, so all children need the selector to traverse upward. The correct Tailwind v4 pattern is:

```css
@custom-variant dark (&:where(.dark, .dark *));
```

`&:where(.dark, .dark *)` — matches the element itself OR any descendant of `.dark`. This makes `dark:` utilities work correctly on both the html element and all its descendants. Alternatively, use the shadcn canonical form:

```css
@custom-variant dark (&:is(.dark *));
```

...which works for descendants but **not** for the `.dark` element itself. For dashboard root-level dark containers this matters. Use `&:where(.dark, .dark *)` to be safe.

#### 3. Fix hardcoded background color in dashboard layout

`src/app/dashboard/layout.js` line 52 has:
```jsx
<div className="min-h-screen bg-[#F5F5F4] relative">
```

This hardcoded `bg-[#F5F5F4]` bypasses the CSS variable system and will NOT switch in dark mode. Replace with `bg-background` (the CSS variable token already defined in globals.css). Same issue exists in the `Suspense` fallback on line 97.

#### 4. Recharts dark mode — CSS variable chart colors

`src/components/dashboard/AnalyticsCharts.jsx` uses hardcoded hex colors (e.g., `'#C2410C'`, `'#1d4ed8'`) for chart fills. These do not adapt to dark mode.

The fix is to define chart colors as CSS variables in `globals.css` inside the `.dark {}` block (chart-1 through chart-5 already exist in the theme) and pass CSS variable references into recharts:

```jsx
// Instead of '#C2410C':
fill="var(--color-chart-1)"

// Or read computed style in a hook if recharts needs resolved values:
const isDark = document.documentElement.classList.contains('dark');
const color = isDark ? '#F97316' : '#C2410C';
```

Recharts v3 does NOT natively read CSS variables for `fill`/`stroke` props — it requires either resolved color values or SVG `currentColor`. The simplest correct pattern is to read the current theme via `useTheme()` from next-themes and map theme → color palette. No new library needed.

#### 5. Supabase tenant theme persistence (optional, implement after localStorage works)

For per-user persistence across devices (not just per-browser):

- Store `theme: 'light' | 'dark' | 'system'` as a column in the `tenants` table (new migration)
- On user sign-in, read saved theme from Supabase and call `setTheme()` from `useTheme()`
- On theme toggle, call Supabase update alongside `setTheme()`

This is additive — next-themes localStorage works correctly for single-device scenarios without any database work. Implement localStorage-first (via next-themes default), then layer in Supabase sync in a later phase if cross-device sync is prioritized.

**No new npm package needed for this.** Use the existing Supabase client.

---

### Supporting Libraries — Already Installed, Extend Usage

| Library | Version | New Usage in v5.0 | Notes |
|---------|---------|-------------------|-------|
| `framer-motion` | 12.38.0 | Objection-busting landing sections: use existing `AnimatedSection`, `AnimatedStagger`, `AnimatedItem` from `src/app/components/landing/AnimatedSection.jsx`. Add `whileHover` micro-interactions on cards/buttons. | Do not add new animation primitives. The existing components (viewport once, useReducedMotion, easing `[0.22, 1, 0.36, 1]`) are correct for conversion sections. Extend, don't duplicate. |
| `shadcn/ui Skeleton` | — | Loading states: `src/components/ui/skeleton.jsx` already exists. Add `loading.js` files per route segment for automatic Next.js streaming skeletons. | Already uses `bg-accent` CSS variable — will adapt to dark mode automatically once ThemeProvider is wired. |
| `lucide-react` | 0.577.0 | Theme toggle icon: use `Sun` and `Moon` icons from the existing install for the dark mode toggle button. | No new icon library. |
| `sonner` | 2.0.7 | Already dark-mode aware via `useTheme()`. Once `ThemeProvider` is wired, Sonner toasts will automatically switch themes. | No changes needed in `sonner.jsx`. |
| `recharts` | 3.8.0 | Extend chart color configs to be theme-aware (see section 4 above). | No new charting library. |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@next-themes` roll-your-own implementation | next-themes is already installed (v0.4.6) and already used in sonner.jsx. Rolling your own means duplicating flash-prevention script injection, localStorage sync, and system preference detection — all already solved. | Wire `ThemeProvider` from `next-themes` — it is a 5-line change |
| `theme-ui`, `styled-components`, `emotion` | These introduce a CSS-in-JS runtime on top of an app that is fully Tailwind CSS v4 + CSS variables. They would conflict with the existing design token system and add ~20KB bundle cost. | Tailwind `dark:` utilities + CSS variable overrides in `.dark {}` block |
| Any CSS-in-JS theming library | The shadcn/ui + Tailwind v4 CSS variable system is the standard approach. CSS variables in `:root` and `.dark {}` already defined in globals.css. | Extend the existing `.dark {}` block in globals.css |
| `react-spring` or other animation libraries | framer-motion v12 is already installed and used everywhere. Two animation libraries would create inconsistent easing, bundle bloat (~45KB overlap), and maintenance overhead. | framer-motion `whileHover`, `whileInView`, `AnimatePresence` — already in use |
| `react-intersection-observer` | framer-motion v12 has `whileInView` + `viewport` built in. The codebase already uses this pattern (see `AnimatedSection.jsx`). | `motion.div` with `whileInView` and `viewport={{ once: true }}` |
| `react-countup` or `number-flow` for animated counters | The objection pages need to show stats ("74% of callers hang up," "$260K/year lost"). A lightweight `useEffect` counter with `requestAnimationFrame` covers this in ~15 lines. No library needed at this scale. | Custom hook or inline animation with framer-motion `useMotionValue` + `useTransform` |
| Chart library replacement (Victory, Nivo, Chart.js) | recharts is already installed and used in analytics. Replacing it requires rewriting 6 chart components. | Dark mode in recharts via theme-aware color resolution (see section 4 above) |
| `next-themes` cookies-based SSR approach | Cookie-based theming eliminates flash by allowing SSR to set the initial `dark` class. But it requires a custom server-side cookie read + `html` class injection before hydration — a significant complexity increase. For a dashboard app (authenticated users, not public crawlers), localStorage-based next-themes is sufficient. | next-themes default localStorage strategy — no flash because script is injected before first paint |
| Radix UI theme primitives (`@radix-ui/themes`) | The project already uses shadcn/ui, which is built on individual Radix primitives (`radix-ui` v1.4.3 is in package.json). `@radix-ui/themes` is a different product — a full theme system that conflicts with the existing shadcn CSS variable approach. | Existing shadcn/ui components + Tailwind dark: variants |
| `shadcn/ui Empty` component (new, October 2025) | As of April 2026 the new shadcn Empty component exists but adding it means running `npx shadcn add empty` which pulls in additional Radix primitives. For a polish pass, a simple custom empty state component (icon + heading + description + optional CTA) is faster and fits the existing pattern. | Custom `EmptyState` component following shadcn visual conventions |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Dark mode | `next-themes` (already installed, wire ThemeProvider) | CSS `prefers-color-scheme` media query only | Media query only = no user toggle, no persistence. The requirement is per-user persisted choice. |
| Dark mode | `next-themes` localStorage strategy | Cookie-based SSR injection | Cookie approach is flicker-free but adds server-side middleware complexity. Dashboard is authenticated; localStorage + flash-prevention inline script (which next-themes ships) is sufficient. |
| Theme toggle UI | lucide-react `Sun`/`Moon` (already installed) | `react-icons` | `lucide-react` is already the icon system. Adding `react-icons` for 2 icons is unnecessary duplication. |
| Recharts dark mode | `useTheme()` hook + conditional color map | CSS variable props on recharts elements | Recharts v3 SVG props (`fill`, `stroke`) do not resolve CSS variable strings. Must use resolved color values OR `currentColor` on SVG text elements. The hook approach is the established pattern. |
| Landing section animations | Extend existing framer-motion `AnimatedSection` | New scroll library (AOS, ScrollReveal) | framer-motion is already installed and has existing components the landing uses. Adding another animation library creates inconsistency. |

---

## Version Compatibility

| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| `next-themes` | 0.4.6 | React 19, Next.js 16 | v0.4.x addressed React 19 peer dep issues. The installed version is compatible. `suppressHydrationWarning` on `<html>` is required. |
| `next-themes` + Tailwind v4 | 0.4.6 | Tailwind 4.2.2 | Use `attribute="class"` on ThemeProvider (adds/removes `class="dark"` on `<html>`). Tailwind v4's `@custom-variant dark` must match this selector. Use `&:where(.dark, .dark *)` not `&:is(.dark *)` for correct coverage. |
| `framer-motion` | 12.38.0 | React 19, Next.js 16 | No issues. Already used in production in this app. |
| `recharts` | 3.8.0 | React 19 | recharts v3 supports React 19. Dark mode requires theme-aware color values (not CSS variable strings) passed to chart props. |

---

## Installation

No new npm packages required for v5.0. All needed libraries are already installed.

```bash
# Nothing to install — next-themes 0.4.6 already in package.json
# Verify with:
npm list next-themes
```

The work is entirely configuration and component changes:

1. Create `src/components/theme-provider.js` (thin "use client" wrapper)
2. Update `src/app/layout.js` — add `suppressHydrationWarning`, wrap with `ThemeProvider`
3. Fix `globals.css` line 3 — update `@custom-variant dark` selector
4. Fix `src/app/dashboard/layout.js` — replace `bg-[#F5F5F4]` with `bg-background`
5. Audit remaining hardcoded colors across dashboard components
6. Update `AnalyticsCharts.jsx` — theme-aware recharts color resolution
7. Add `loading.js` files to dashboard route segments for streaming skeletons

---

## Sources

- `package.json` (project root) — confirmed `next-themes: ^0.4.6` installed; confirmed `framer-motion: ^12.38.0`, `recharts: ^3.8.0`, `sonner: ^2.0.7`, `lucide-react: ^0.577.0`
- `src/components/ui/sonner.jsx` — confirmed `useTheme` from next-themes already used; ThemeProvider NOT yet wired in layout
- `src/app/layout.js` — confirmed no ThemeProvider in current provider tree
- `src/app/globals.css` — confirmed Tailwind v4 CSS-first config; `.dark {}` block already defined with full CSS variable set; `@custom-variant dark` present but using `&:is(.dark *)` (the subtly incomplete form)
- `src/app/dashboard/layout.js` — confirmed `bg-[#F5F5F4]` hardcoded (dark mode blocker)
- `src/components/dashboard/AnalyticsCharts.jsx` — confirmed hardcoded hex colors in chart STATUS_COLORS
- `src/app/components/landing/AnimatedSection.jsx` — confirmed existing framer-motion scroll patterns (whileInView, viewport once, useReducedMotion) — reuse for objection sections
- [shadcn/ui dark mode docs](https://ui.shadcn.com/docs/dark-mode/next) — ThemeProvider setup pattern — HIGH confidence (official shadcn docs)
- [next-themes GitHub](https://github.com/pacocoursey/next-themes) — `suppressHydrationWarning` requirement; `attribute="class"` config — HIGH confidence (official repo)
- [Tailwind CSS v4 dark mode](https://tailwindcss.com/docs/dark-mode) — `@custom-variant dark` CSS-first config — HIGH confidence (official Tailwind docs)
- [Tailwind v4 + next-themes integration guide](https://medium.com/@kevstrosky/theme-colors-with-tailwind-css-v4-0-and-next-themes-dark-light-custom-mode-36dca1e20419) — `&:where(.dark, .dark *)` vs `&:is(.dark *)` distinction — MEDIUM confidence (community, pattern verified against Tailwind v4 docs)
- WebSearch: next-themes 0.4 React 19 compatibility — confirmed v0.4.x addressed React 19 peer dep issues — MEDIUM confidence

---

*Stack research for: v5.0 Trust & Polish (dark mode, landing sections, UI/UX polish)*
*Researched: 2026-04-13*

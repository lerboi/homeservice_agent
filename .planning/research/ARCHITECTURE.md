# Architecture Research

**Domain:** Next.js App Router SaaS — dark mode + landing page integration
**Researched:** 2026-04-13
**Confidence:** HIGH (all findings from direct codebase inspection)

---

## Standard Architecture

### System Overview

```
src/app/
├── layout.js                    ← ROOT: NextIntlClientProvider only — NO ThemeProvider yet
│
├── (public)/
│   ├── layout.js                ← LandingNav + LandingFooter + PublicChatButton
│   └── page.js                  ← Landing entry: HeroSection + ScrollLinePath + sections
│
└── dashboard/
    ├── layout.js                ← 'use client', hardcoded bg-[#F5F5F4], NO ThemeProvider
    └── */page.js                ← All pages use hardcoded hex colors, no semantic tokens
```

**Current state:** `next-themes` v0.4.6 is installed but has no `ThemeProvider` anywhere in the tree. Only `sonner.jsx` calls `useTheme()` — it will silently fall back to `"system"` since no provider exists. The `.dark {}` CSS variable block and `@custom-variant dark` are already defined in `globals.css`. The CSS infrastructure exists; the provider wiring and token migration are what's missing.

---

## Integration Architecture for v5.0

### (a) Where the ThemeProvider Lives

**Place `ThemeProvider` in `src/app/layout.js` — the root layout.**

This is the only correct answer for this codebase. Here is why:

- The root layout wraps both `(public)/layout.js` and `dashboard/layout.js`. One provider placement covers everything.
- `next-themes` requires a single `ThemeProvider` ancestor. Placing it in `dashboard/layout.js` only would exclude the public site; placing it in `(public)/layout.js` would exclude the dashboard.
- `dashboard/layout.js` is `'use client'` but `layout.js` (root) is a Server Component — `ThemeProvider` must be wrapped in a `'use client'` boundary. The pattern is a thin `src/components/providers/ThemeProvider.jsx` client wrapper that re-exports `next-themes`' ThemeProvider.

```
src/app/layout.js  (Server Component, stays server)
  └── <NextIntlClientProvider>
        └── <ThemeProviderWrapper>        ← NEW: 'use client' wrapper component
              └── {children}
```

The `ThemeProviderWrapper` component lives at `src/components/providers/ThemeProvider.jsx`. It is the only new file needed at the provider layer.

**Public site dark mode scope:** The public site landing sections use hardcoded colors (`bg-[#050505]`, `bg-white`, `bg-[#F5F5F4]`) — they are effectively dark-on-dark-hero already. Do NOT apply dark-mode toggling to the public site in this milestone. Set `ThemeProvider` with `enableSystem={false}` and scope dark class application to dashboard only via `attribute="class"` on a dashboard-level wrapper element rather than `<html>`. See section (c) for the exact pattern.

---

### (b) Theme Preference Storage

**Use cookie storage via `next-themes` built-in `storageKey` + `attribute="class"` — no Supabase column needed for v5.0.**

Analysis of options:

| Option | SSR Flash Risk | Complexity | Cross-device | Verdict |
|--------|---------------|------------|--------------|---------|
| `localStorage` (next-themes default) | HIGH — value unavailable on server | Low | No | Reject |
| Cookie (`next-themes` + `storageKey`) | NONE when read in middleware | Low | No | Accept for v5.0 |
| Supabase `tenants.ui_preferences` JSONB | NONE | High — requires migration + API | Yes | Defer to v6+ |

`next-themes` has a `storageKey` prop (defaults to `"theme"`) and stores the preference in `localStorage` by default. To get SSR-safe cookie storage, use the `ThemeProvider` with `storageKey="voco-theme"` and add a middleware cookie read OR use the `next-themes` `attribute="class"` approach with the hydration suppression technique described in (c).

**For v5.0:** Use `next-themes` with `attribute="class"`, `defaultTheme="light"`, `enableSystem={false}`, `disableTransitionOnChange`. The localStorage read on the client is fast enough that the flash suppression script (described in (c)) eliminates visible flicker. Skip the Supabase migration — preferences that don't sync across devices are acceptable for a polish milestone.

**No new migration needed.** The `notification_preferences` JSONB pattern on `tenants` table (migration 015) could be extended with `ui_preferences` in a future milestone when cross-device sync matters.

---

### (c) Avoiding Hydration Flash on Dark Mode

**The hydration flash problem:** On first SSR render, the server emits HTML with no class. The client reads `localStorage`, finds `"dark"`, and adds `.dark` to the DOM. If this happens after paint, there is a visible white flash.

**The fix: `suppressHydrationWarning` on `<html>` + `next-themes` built-in script injection.**

`next-themes` automatically injects a blocking inline `<script>` into `<head>` that reads localStorage and applies the theme class before first paint — this is their core anti-flash mechanism. It works IF `suppressHydrationWarning={true}` is set on the `<html>` element (because the server-rendered HTML and client-hydrated HTML will differ in the `class` attribute).

Required changes to `src/app/layout.js`:

```jsx
// src/app/layout.js — root layout changes
<html lang={locale} className={inter.variable} suppressHydrationWarning>
```

And in `src/components/providers/ThemeProvider.jsx`:

```jsx
'use client';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

export function ThemeProviderWrapper({ children }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
      storageKey="voco-theme"
    >
      {children}
    </NextThemesProvider>
  );
}
```

**Scoping dark mode to the dashboard only (keeping public site always-light):**

The `attribute="class"` prop makes `next-themes` toggle the class on `<html>`. This would affect the public site too. To scope it:

Option A: Keep `attribute="class"` on `<html>` but override public site sections with explicit light colors (they already use hardcoded colors so they're immune — `bg-[#050505]` ignores `.dark` body background).

Option B: Pass a custom `attribute` selector targeting only the dashboard wrapper div. This is more complex and non-standard.

**Recommendation: Use Option A.** The public site landing sections are dark-hero by design and use hardcoded values — they will not be affected by `.dark` on `<html>`. The only public site components using semantic Tailwind tokens (like `bg-background`, `text-foreground`) would need audit, but the public layout uses hardcoded colors throughout. This is safe.

---

### (d) Landing Section Insertion Points

The landing page flow is defined in `src/app/(public)/page.js`:

```
Current structure:
  <ScrollProgress />
  <HeroSection />
  <ScrollLinePath>
    <HowItWorksSection />
    <FeaturesCarousel />
    <SocialProofSection />
  </ScrollLinePath>
  <FinalCTASection />
```

**Where new objection-busting sections slot in:**

```
Proposed structure:
  <ScrollProgress />
  <HeroSection />                     ← MODIFY: reposition copy + CTA framing
  <ScrollLinePath>
    <HowItWorksSection />             ← existing, may get copy tweaks
    <FeaturesCarousel />              ← existing, audit for feature completeness
    [ObjectionSection]                ← NEW: after features, before social proof
                                         Addresses: robotic voice, trust, trade specificity,
                                         tech-savvy setup, price, identity/change aversion
    <SocialProofSection />            ← existing, may add more proof points
    [IdentityObjectionSection]        ← OPTIONAL NEW: "you're still in control" section
                                         OR fold into ObjectionSection as a sub-block
  </ScrollLinePath>
  <FinalCTASection />                 ← MODIFY: reframe CTA copy (complement not replace)
```

**Insertion rules:**

1. New sections use `dynamic()` with a loading skeleton — same pattern as existing sections. Static import only for HeroSection (LCP-critical).
2. New sections live in `src/app/components/landing/` alongside existing ones (not in `src/components/landing/` — note the two different landing component directories; `src/app/components/landing/` is the primary location).
3. `<ScrollLinePath>` wraps the middle sections and manages the SVG copper sine wave animation. Any new section inside `ScrollLinePath` automatically participates in the scroll-draw. Verify `ScrollLinePath` height calculations if adding tall sections.
4. `<HeroSection>` and `<FinalCTASection>` are modified in-place — they are not replaced with new components.

**Hero modification note:** `HeroSection` uses `AnimatedSection` (client wrapper with framer-motion). It imports `RotatingText`, `SplineScene`, and `HeroDemoBlock` dynamically. Modifying copy and CTA structure does not require changing the dynamic import pattern.

---

## Component Inventory: New vs Modified

### New Components

| Component | Path | Purpose |
|-----------|------|---------|
| `ThemeProviderWrapper` | `src/components/providers/ThemeProvider.jsx` | Wraps `next-themes` ThemeProvider as a client boundary |
| `ThemeToggle` | `src/components/dashboard/ThemeToggle.jsx` | Sun/moon toggle button for dashboard sidebar or settings |
| `ObjectionSection` (name TBD) | `src/app/components/landing/ObjectionSection.jsx` | 6-objection bust section, dynamic import |
| Optionally: `IdentityObjectionSection` | `src/app/components/landing/IdentityObjectionSection.jsx` | "Still in control" framing, or folded into ObjectionSection |

### Modified Components/Files

| Component/File | Change Required |
|----------------|----------------|
| `src/app/layout.js` | Add `suppressHydrationWarning` to `<html>`. Wrap children with `ThemeProviderWrapper`. |
| `src/app/dashboard/layout.js` | Replace hardcoded `bg-[#F5F5F4]` with `bg-background` (semantic token). Remove hardcoded Suspense fallback color. Add `ThemeToggle` to sidebar or header area. |
| `src/app/(public)/page.js` | Insert new objection section(s) into the JSX order. Modify `HeroSection` and `FinalCTASection` imports if they remain named exports. |
| `src/app/components/landing/HeroSection.jsx` | Copy/CTA reposition — structural changes to h1, p, CTA framing. No import changes. |
| `src/app/components/landing/FinalCTASection.jsx` | Copy reframe — "complement not replacement" messaging. |
| `src/components/dashboard/DashboardSidebar.jsx` | Add `ThemeToggle` button. Hardcoded `bg-white/[0.06]` and `bg-white/[0.04]` on NavLink are relative to sidebar background — audit against dark sidebar background. |
| `src/app/globals.css` | The `.dark {}` block exists but needs audit. Dashboard-specific color overrides may need addition (e.g., `bg-[#F5F5F4]` does not respond to `.dark`). |
| Every dashboard component with hardcoded hex colors | Replace `bg-[#F5F5F4]` → `bg-background`, `bg-white` → `bg-card`, `text-[#0F172A]` → `text-foreground` etc. across ~42 files. |

**Scale of token migration:** The Grep found 130 occurrences of raw color classes across 42 dashboard component files. This is the largest effort in the milestone — not the provider wiring, which is trivial.

---

## Data Flow

### Theme Toggle Flow

```
User clicks ThemeToggle
    ↓
useTheme().setTheme('dark' | 'light')    [next-themes hook]
    ↓
next-themes writes localStorage 'voco-theme'
    ↓
next-themes toggles .dark class on <html>
    ↓
CSS custom properties in .dark {} block activate
    ↓
All Tailwind dark: variants + semantic tokens flip simultaneously
    ↓
(No server round-trip, no API call, no Supabase write)
```

### SSR Theme Resolution Flow (page load)

```
Next.js renders root layout on server
    ↓
<html> emitted WITHOUT .dark class (server has no localStorage access)
    ↓
next-themes inline script injected into <head>
    ↓
Script reads localStorage synchronously before paint
    ↓
If 'dark' found: adds .dark to <html> before first paint
    ↓
React hydrates — suppressHydrationWarning suppresses class mismatch warning
    ↓
No flash visible to user
```

### Landing Section Data Flow

```
page.js (Server Component)
    ↓
dynamic() import with loading skeleton (prevents CLS)
    ↓
<ObjectionSection /> — Server Component (static content, no client state)
    ↓
AnimatedSection client wrapper handles scroll-triggered animation
    ↓
No API calls, no Supabase reads — purely static marketing content
```

---

## Recommended Project Structure (additions only)

```
src/
├── components/
│   ├── providers/
│   │   └── ThemeProvider.jsx       ← NEW: 'use client' ThemeProvider wrapper
│   └── dashboard/
│       └── ThemeToggle.jsx         ← NEW: toggle button component
└── app/
    └── components/
        └── landing/
            └── ObjectionSection.jsx  ← NEW: objection-busting section
```

No new directories needed beyond `src/components/providers/`.

---

## Architectural Patterns

### Pattern 1: Semantic Token Migration Pattern

**What:** Replace hardcoded hex colors in dashboard components with shadcn/ui semantic CSS variable tokens so `.dark {}` overrides propagate automatically.

**When to use:** Every dashboard component touched during polish pass.

**Token mapping for this codebase:**

| Hardcoded class | Semantic replacement | Notes |
|-----------------|---------------------|-------|
| `bg-[#F5F5F4]` | `bg-background` or `bg-muted` | `--background` is white in light, near-black in dark |
| `bg-white` | `bg-card` | Use `bg-card` for surface cards |
| `text-[#0F172A]` | `text-foreground` | Dark slate → foreground token |
| `border-stone-200` | `border-border` | |
| `bg-[#0F172A]/[0.06]` | `bg-muted` | Low-opacity dark → muted |
| `text-[#A1A1AA]` | `text-muted-foreground` | Zinc-400 → muted-foreground |

**Sidebar exception:** `DashboardSidebar` uses a fixed dark sidebar with `bg-white/[0.06]` hover states relative to a dark base. Dark mode should not change the sidebar's dark appearance. Do not migrate sidebar-internal colors to semantic tokens.

**Trade-off:** Semantic tokens lose color precision vs design intent. Audit `.dark {}` values in `globals.css` to ensure they match the intended dark palette (the current dark values are shadcn defaults, not Voco-specific — they will need tuning).

### Pattern 2: Dynamic Import with Loading Skeleton for Landing Sections

**What:** All below-the-fold landing sections use `dynamic()` with an `{ loading: () => <skeleton /> }` that reserves the correct height to prevent CLS.

**When to use:** Every new landing section.

**Example (from existing codebase pattern):**

```jsx
const ObjectionSection = dynamic(
  () => import('@/app/components/landing/ObjectionSection').then((m) => m.ObjectionSection),
  {
    loading: () => (
      <section className="bg-[#FAFAF9] py-20 md:py-28 px-6" aria-hidden="true">
        <div className="h-4 w-32 bg-black/10 rounded mx-auto mb-3" />
        <div className="h-10 w-80 bg-black/10 rounded mx-auto" />
      </section>
    ),
  }
);
```

New sections should be Server Components if they contain only static content — only wrap in `AnimatedSection` (client component) for scroll-triggered animation, per the existing pattern in `HowItWorksSection.jsx` and `SocialProofSection.jsx`.

### Pattern 3: Dashboard Layout Dark Mode Scoping

**What:** The dashboard layout shell (`dashboard/layout.js`) needs its own dark surface. The hardcoded `bg-[#F5F5F4]` must become `bg-background` to respond to the theme class.

**Complication:** The Suspense fallback at the bottom of `dashboard/layout.js` also has `bg-[#F5F5F4]`. Both must be migrated together to avoid flash-on-navigation.

**Pattern:**

```jsx
// dashboard/layout.js — before
<div className="min-h-screen bg-[#F5F5F4] relative">

// dashboard/layout.js — after
<div className="min-h-screen bg-background relative transition-colors duration-200">
```

---

## Suggested Build Order (Phase Dependencies)

This order ensures each phase builds on a stable foundation and dark mode doesn't cause regressions:

### Phase 1 — Foundation (required before any visible work)
1. Add `suppressHydrationWarning` to `<html>` in `layout.js`
2. Create `src/components/providers/ThemeProvider.jsx`
3. Wire `ThemeProviderWrapper` into `layout.js` (inside `NextIntlClientProvider`)
4. Audit `globals.css` dark token values — replace shadcn defaults with Voco-appropriate dark values for `--background`, `--card`, `--muted`, `--border`
5. Create `ThemeToggle` component
6. Wire `ThemeToggle` into `DashboardSidebar` — verify no visual regression in light mode

**Gate:** Toggle works, no hydration warning in console, no flash on hard reload, sidebar unaffected.

### Phase 2 — Dashboard Token Migration
7. Migrate `dashboard/layout.js` hardcoded colors to semantic tokens
8. Migrate dashboard page files (`/dashboard`, `/dashboard/leads`, `/dashboard/calendar`, `/dashboard/calls`, `/dashboard/analytics`, `/dashboard/more/*`)
9. Migrate flyout components (`LeadFlyout`, `AppointmentFlyout`, `QuickBookSheet`) — these are modal surfaces; critical for dark mode feel
10. Migrate dashboard component library files (42 files, prioritize by user-facing visibility)
11. Audit chart components (`AnalyticsCharts.jsx`, recharts) — recharts colors are passed as props/inline styles, not Tailwind classes; they need explicit dark mode color switching via `useTheme()` hook

**Gate:** All dashboard pages render correctly in both light and dark mode with no white flashes on navigation.

### Phase 3 — Landing Page Repositioning
12. Modify `HeroSection.jsx` — copy/CTA reframe (no structural changes to import pattern)
13. Modify `FinalCTASection.jsx` — copy reframe
14. Create `ObjectionSection.jsx` — new component with static content + `AnimatedSection` wrappers
15. Wire into `page.js` — add `dynamic()` import + insert between `FeaturesCarousel` and `SocialProofSection`
16. Verify `ScrollLinePath` path rendering with added section height

**Gate:** Landing page lighthouse score maintained, no CLS regression, objection section visible on all breakpoints.

### Phase 4 — Polish Pass
17. Typography, spacing, motion audit across public + dashboard
18. Empty states, loading states, hover/focus/error states
19. Mobile responsiveness audit
20. Cross-browser dark mode validation

---

## Anti-Patterns

### Anti-Pattern 1: ThemeProvider in Dashboard Layout Only

**What people do:** Place `ThemeProvider` in `dashboard/layout.js` to scope it to the dashboard.

**Why it's wrong:** `next-themes` injects its SSR anti-flash script into `<head>` only when the provider is in the root layout. Placing it in the dashboard layout means the script doesn't run on the dashboard route's initial server render, causing the flash on first load even if localStorage has the user's preference.

**Do this instead:** Root layout placement with a `'use client'` wrapper component.

### Anti-Pattern 2: Migrating Landing Page Colors to Semantic Tokens

**What people do:** Replace `bg-[#050505]` in `HeroSection` with `bg-background` to make it "dark mode aware."

**Why it's wrong:** The landing page is intentionally dark-hero-then-light-sections. These are brand decisions, not light/dark theme decisions. `bg-background` in dark mode resolves to near-black — the hero would become near-black on near-black with no contrast.

**Do this instead:** Leave all landing page colors as hardcoded hex values. The `.dark` class on `<html>` does not affect Tailwind arbitrary values.

### Anti-Pattern 3: Using `enableSystem: true` Without Explicit Default

**What people do:** Enable system preference detection without setting `defaultTheme="light"`.

**Why it's wrong:** For a B2B SaaS dashboard, demos occur in daylight. System dark mode on a demo would make the product look unpolished if the dark tokens aren't fully audited.

**Do this instead:** `defaultTheme="light"`, `enableSystem={false}`. Add system preference support after the dark token audit is complete.

### Anti-Pattern 4: Migrating recharts Colors via Tailwind Classes

**What people do:** Try to make recharts charts dark-mode-aware by changing Tailwind classes on wrapper divs.

**Why it's wrong:** recharts renders SVG. SVG fill/stroke colors are set via recharts props (`stroke="#8884d8"`, `fill="..."`) or inline styles — not via CSS classes on a container div.

**Do this instead:** Read `useTheme()` in chart components and conditionally pass color props: `stroke={theme === 'dark' ? '#fff' : '#0F172A'}`. This requires the chart component to be `'use client'`.

---

## Integration Points

### Provider Chain in Root Layout

| Layer | Component | Notes |
|-------|-----------|-------|
| Root layout | `<html suppressHydrationWarning>` | Required for next-themes |
| L1 | `<NextIntlClientProvider>` | Already exists, wraps everything |
| L2 (NEW) | `<ThemeProviderWrapper>` | Goes inside NextIntlClientProvider |
| L3 | `{children}` | Dashboard + public routes |

### Internal Component Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `ThemeProviderWrapper` → dashboard components | CSS `.dark` class on `<html>` | Tailwind dark: variants activate |
| `ThemeToggle` → theme state | `useTheme().setTheme()` | next-themes context |
| Chart components → dark tokens | `useTheme()` hook | Must be 'use client' |
| Landing sections → dark mode | None (isolated by hardcoded colors) | No wiring needed |

### External Libraries

| Library | Dark Mode Integration | Notes |
|---------|----------------------|-------|
| `next-themes` v0.4.6 | Built-in via `attribute="class"` | Already installed, just needs wiring |
| `sonner` / `Toaster` | `useTheme()` already wired in `sonner.jsx` | Will work once provider exists |
| `recharts` | Manual via `useTheme()` hook in chart components | Requires explicit color prop switching |
| `framer-motion` | Theme-agnostic | No integration needed |
| `radix-ui` / `shadcn` | CSS variables respond to `.dark` | Works automatically once tokens audited |

---

## Confidence Assessment

| Finding | Confidence | Basis |
|---------|------------|-------|
| `next-themes` v0.4.6 installed, no provider wired | HIGH | Direct `package.json` + grep of codebase |
| `.dark {}` CSS block exists in `globals.css` | HIGH | Direct file read |
| `@custom-variant dark` in Tailwind v4 syntax | HIGH | Direct `globals.css` read |
| 130 hardcoded color occurrences across 42 dashboard files | HIGH | Direct grep count |
| No `theme_preference` Supabase column exists | HIGH | All migrations inspected |
| `sonner.jsx` has `useTheme()` but no provider | HIGH | Direct file read |
| Landing page colors are hardcoded hex, immune to `.dark` | HIGH | Direct file read of all landing sections |
| `suppressHydrationWarning` approach for SSR flash | HIGH | next-themes standard documented pattern |

---

*Architecture research for: v5.0 Trust & Polish — dark mode + landing integration*
*Researched: 2026-04-13*

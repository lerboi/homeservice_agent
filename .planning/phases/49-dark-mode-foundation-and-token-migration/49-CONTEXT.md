# Phase 49: Dark Mode Foundation and Token Migration - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire up theme infrastructure (next-themes + ThemeProvider + sidebar toggle) and migrate dashboard components from hardcoded hex colors to dark-mode-aware semantic tokens. The entire **dashboard surface** (pages, flyouts, modals, banners, badges, pills) renders correctly in both light and dark mode with no hydration flash, smooth 150ms transitions, and persistent user preference.

**Explicitly in scope:** Dashboard routes (`/dashboard/*`) including flyouts (LeadFlyout, AppointmentFlyout, QuickBookSheet, ChatbotSheet), system banners (impersonation, trial countdown, billing warning), status badges, urgency pills, LeadStatusPills, layout shell (sidebar, top bar, bottom tab bar, main content background), `design-tokens.js`, and typography consolidation (POLISH-08).

**Explicitly out of scope:** Recharts charts (Phase 50 — DARK-05), CalendarView urgency colors (Phase 50 — DARK-10), UI polish pass (Phase 51), admin pages, billing upgrade page, onboarding wizard, auth signin, and the entire landing/marketing site (stays permanently light-only).

</domain>

<decisions>
## Implementation Decisions

### Theme Toggle UX
- **D-01:** Use `next-themes` with `defaultTheme="system"` and `enableSystem=true` on the root layout's `ThemeProvider`. First visit follows OS `prefers-color-scheme`; after first click the user's explicit choice is stored in localStorage and no longer tracks OS.
- **D-02:** The sidebar toggle UI is a **binary icon button** (sun ↔ moon, lucide-react icons) — it does not expose a third "System" option. The toggle writes `theme="light"` or `theme="dark"` directly, breaking the initial system-follow behavior intentionally once the user makes a choice.
- **D-03:** Placement — inside `DashboardSidebar.jsx`, as a new icon button in the sidebar footer cluster, positioned **above the "Log Out" button** and adjacent to "Ask Voco AI". Use the same visual treatment as existing sidebar footer buttons (white/[0.04] hover, rounded-lg, h-4 w-4 icon). Tooltip on hover shows the current mode.
- **D-04:** `suppressHydrationWarning` goes on the root `<html>` element in `src/app/layout.js`; `<ThemeProvider>` wraps `<NextIntlClientProvider>` inside `<body>`. Theme class is applied via next-themes' standard script injection — no custom hydration logic.
- **D-05:** Transition duration for the body background/text color swap is **150ms** (DARK-09). Apply as a one-time CSS rule in `globals.css` targeting `body` (or `html`) — do not add transition classes to every individual component.

### Scope and Surface Coverage
- **D-06:** Dark mode activates only on `/dashboard/*` routes and the components they render. The `ThemeProvider` still wraps the entire app (it has to, it's in root layout), but only dashboard surfaces have dark-aware styles.
- **D-07:** Admin (`/admin/*`), billing upgrade (`/billing/upgrade`), onboarding wizard (`/onboarding/*`), and auth (`/auth/*`) stay light-only for this phase. If they share layout primitives with the dashboard they may incidentally render with dark styles when the user toggles dark — this is acceptable as long as the pages remain readable. The planner should check whether this is actually the case once the token migration lands.
- **D-08:** Landing/marketing pages (`/(public)/*`) stay **permanently light-only**. The warm-neutral aesthetic established in Phases 11 and 47 is a brand decision, not a limitation of this phase. Do not add dark variants to any landing section.
- **D-09:** Shared-token bleed risk — `src/lib/design-tokens.js` is imported by both dashboard and onboarding components. The planner MUST decide one of: (a) scope dark variants to dashboard-only by using `.dark .dashboard-root &` compound selectors, (b) duplicate tokens into a dashboard-specific file and convert only those to dark-aware, or (c) accept that shared tokens flip everywhere `.dark` is active (simplest but affects onboarding visually — may be acceptable since onboarding is never viewed once the user reaches the dashboard). Research should confirm which approach existing onboarding flows tolerate.

### Brand Orange Handling
- **D-10:** Primary brand accent is **`#C2410C` in light mode** and **`#FB923C` (Tailwind orange-400) in dark mode** — a calibrated lighter variant tuned for AA contrast on dark surfaces. Wire this as a single CSS variable (e.g., `--brand-accent`) defined in both `:root` and `.dark` blocks of `globals.css`; update `design-tokens.js` to reference `var(--brand-accent)` instead of the literal hex.
- **D-11:** Selection/hover tinted backgrounds — the current `selected.card` token uses `border-[#C2410C] bg-[#C2410C]/[0.04]`. In dark mode: keep the (new `#FB923C`) orange border, but swap the fill to a neutral `bg-white/[0.04]` (or equivalent `var(--foreground) / 0.04`). The orange border alone provides enough selection signal; the tinted fill is invisible on dark surfaces anyway.
- **D-12:** All other brand orange usages (focus rings, primary buttons, active nav indicators) use the same `var(--brand-accent)` indirection. The sidebar's existing `border-[#C2410C]` active nav indicator and the `bg-[#C2410C]` logout confirm button both switch to `#FB923C` in dark mode via the shared token.

### Token Migration Approach (Claude's Discretion)
- **D-13:** The planner will choose the concrete migration strategy. Strong prior: **CSS-variable-first** — extend the `:root` and `.dark` blocks in `globals.css` with semantic tokens (brand accent, surface tints, border/ring colors, text colors) and convert `design-tokens.js` + component class strings to reference `var(--*)`. This leverages the shadcn/ui scaffolding that already exists (lines 127–221 of `globals.css`) and avoids hundreds of `dark:` prefix additions scattered through component files.
- **D-14:** Typography consolidation (POLISH-08) — the planner decides the exact token taxonomy. Strong prior: introduce `heading` and `body` tokens that resolve to `var(--foreground)` and `var(--muted-foreground)` respectively (matching shadcn conventions), eliminating the hardcoded `text-[#0F172A]` and `text-[#475569]` in `design-tokens.js` lines 30–31.

### Claude's Discretion
- Exact token naming (`--brand-accent` vs `--primary-accent` vs `--accent-orange` — planner picks one convention and applies consistently).
- Whether to group related tokens (surface, border, text, accent) into named clusters or keep a flat list.
- ESLint rule or CI grep to prevent future hardcoded hex regressions (nice-to-have — not required by success criteria).
- Order of file migration (sidebar/layout first? all-at-once? atomic commit per component family?) — planner optimizes for reviewability.
- Testing approach — visual diffing vs manual screenshot checklist vs Storybook — planner chooses.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap and requirements
- `.planning/ROADMAP.md` §Phase 49 (lines 653–665) — goal, depends-on, success criteria
- `.planning/REQUIREMENTS.md` §Dark Mode (lines 567–576) — DARK-01 through DARK-10 acceptance criteria
- `.planning/REQUIREMENTS.md` §UI/UX Polish line 587 — POLISH-08 typography consolidation requirement

### Existing infrastructure
- `src/app/globals.css` lines 3 (`@custom-variant dark`), 127–170 (`:root` tokens), 172–221 (`.dark` tokens) — shadcn/ui CSS variable scaffolding already defined
- `src/lib/design-tokens.js` — the 7 shared token groups (btn, card, glass, heading, body, focus, selected, gridTexture) that must be converted to theme-aware values
- `src/app/layout.js` — root layout where `<ThemeProvider>` must wrap `<NextIntlClientProvider>` inside `<body>`
- `src/components/dashboard/DashboardSidebar.jsx` — target for the theme toggle button (insert above Log Out, lines 96–105)

### Prior design decisions
- Phase 11, 47 landing aesthetics — warm-neutral surface `#F5F5F4`, brand orange system that must stay unchanged on landing
- Phase 48 dashboard home redesign — light-mode appearance is the baseline; dark mode must not alter light-mode rendering in any visible way

### Next-themes library
- `next-themes` npm package (to be installed) — `ThemeProvider`, `useTheme`, `suppressHydrationWarning` usage

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **shadcn/ui CSS variables in `globals.css`** — `:root` and `.dark` blocks already define `--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--primary`, `--secondary`, `--muted`, `--muted-foreground`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--sidebar`, `--sidebar-foreground`, etc. These can be referenced directly via `var(--*)` or Tailwind's `@theme inline` mapping.
- **Tailwind `@theme inline` block** (lines 5–54 of `globals.css`) — already maps `--color-*` vars so Tailwind classes like `bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground` work out of the box.
- **`useTheme()` hook already working** in `src/components/ui/sonner.jsx` — provides a reference implementation of client-side theme reads for Phase 50 chart work.
- **lucide-react** (already in use throughout dashboard) provides `Sun`, `Moon`, `Monitor` icons for the toggle button.
- **Radix primitives** (Alert Dialog, Separator, etc.) already support dark mode automatically via shadcn variables — no migration work required for wrapper components.

### Established Patterns
- **Hardcoded hex classes are pervasive** — `text-[#0F172A]`, `text-[#475569]`, `bg-[#F5F5F4]`, `border-[#C2410C]`, `bg-[#C2410C]` appear ~537 times across dashboard pages and components (369 in 59 component files, 168 in 15 page files). This is the main migration surface.
- **Sidebar is already dark** (`bg-[#0F172A]` navy) — it will not visibly flip in dark mode. The sidebar's white text, white/[0.04] hovers, and `#C2410C` active accent will need `#FB923C` treatment in dark mode via the shared brand-accent variable.
- **Class-based dark variant** (`@custom-variant dark (&:is(.dark *))`) is the Tailwind configuration — we toggle a `.dark` class on `<html>`, not `prefers-color-scheme` media queries.
- **`design-tokens.js` is the single source of truth** for the 7 shared token groups — migrating this file once propagates to dozens of consumers (onboarding, dashboard, billing).

### Integration Points
- `src/app/layout.js` — wraps everything; the `<ThemeProvider>` goes here.
- `src/components/dashboard/DashboardSidebar.jsx` — the toggle button UI lives here.
- `src/lib/design-tokens.js` — token values get converted to `var(--*)` references.
- `src/app/globals.css` — new semantic tokens (`--brand-accent`, typography colors, etc.) get added to `:root` and `.dark` blocks.
- 59 dashboard component files and 15 dashboard page files — the bulk of the hex-to-token migration.
- Flyouts specifically: `LeadFlyout.jsx` (30 hex), `AppointmentFlyout.js` (12 hex), `QuickBookSheet.js` (3 hex), `ChatbotSheet.jsx` (2 hex) — DARK-06 coverage.
- Banners: `BillingWarningBanner.js`, `ImpersonationBanner.js`, `TrialCountdownBanner.js` in `src/app/dashboard/` — DARK-08 coverage.
- Status pills: `LeadStatusPills.jsx` (4 hex), `BookingStatusBadge.js` (2 hex), `EstimateStatusBadge.jsx` — DARK-07 coverage.
- `AnalyticsCharts.jsx` (41 hex) and `CalendarView.js` (23 hex) are deferred to **Phase 50** — do not migrate chart stroke/fill colors or calendar urgency classes in this phase.

</code_context>

<specifics>
## Specific Ideas

- "The sidebar is already dark — the theme toggle is about flipping the rest of the dashboard to match it."
- Brand orange should breathe — same accent intent in both modes, but lighter (`#FB923C`) in dark so it doesn't look muddy on a dark background.
- Toggle UX reference: the sun/moon icon button pattern used by Vercel, Linear, GitHub settings — minimal, tucked into sidebar footer, not a hero UI element.
- Landing page is sacrosanct — the warm-neutral `#F5F5F4` + copper orange aesthetic is the brand, don't touch it.

</specifics>

<deferred>
## Deferred Ideas

- **Recharts dark mode** (DARK-05) — deferred to Phase 50 because SVG inline styles require `useTheme()`-based conditional rendering, not CSS class migration.
- **CalendarView urgency colors** (DARK-10) — deferred to Phase 50 alongside charts; urgency color blocks are driven by dynamic class concatenation that needs the same useTheme approach.
- **Polish pass** (POLISH-01 through POLISH-10 except POLISH-08) — empty states, loading skeletons, focus rings, error retry, async button states, stat card hover, AnimatePresence transitions, CommandPalette audit, 375px layout — all Phase 51.
- **Landing page dark mode** — permanently out of scope; not deferred to a later phase, rejected on brand grounds.
- **Admin / billing / onboarding / auth dark mode** — deferred indefinitely. Revisit only if user feedback demands it.
- **ESLint rule to block future `text-[#...]` / `bg-[#...]` usage** — nice-to-have guardrail, planner may include if cheap, otherwise backlog.

</deferred>

---

*Phase: 49-dark-mode-foundation-and-token-migration*
*Context gathered: 2026-04-15*

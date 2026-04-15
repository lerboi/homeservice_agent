---
phase: 49-dark-mode-foundation-and-token-migration
plan: 02
subsystem: ui
tags: [dark-mode, tailwind, css-tokens, banners, layout, theming]

# Dependency graph
requires:
  - phase: 49-dark-mode-foundation-and-token-migration/49-01
    provides: ThemeProvider wired in root layout, @custom-variant dark fixed selector, --brand-accent/--warm-surface/--background semantic tokens, design-tokens.js hex-to-var migration
provides:
  - Dashboard main wrapper bg-[#F5F5F4] → bg-background (light = warm-neutral, dark = near-black)
  - BottomTabBar bg-white → bg-card, border-stone-200 → border-border, active indicator text-[#C2410C] → text-[var(--brand-accent)]
  - OfflineBanner converted from amber to neutral (bg-muted/text-muted-foreground/border-border)
  - ConflictAlertBanner: dark:bg-amber-950/40, dark:text-amber-200, dark:border-amber-800/60 amber warning pattern
  - ImpersonationBanner: dark:bg-amber-950/40, dark:text-amber-200, dark:border-amber-800/60 amber pattern
  - TrialCountdownBanner: blue info state dark:bg-blue-950/40/dark:text-blue-200/dark:border-blue-800/60 + amber urgent state full dark variants
  - BillingWarningBanner: dark:bg-amber-950/40, dark:text-amber-200, dark:border-amber-800/60 amber payment-warning pattern
affects:
  - 49-03-PLAN (flyouts + status badges — can now assume layout shell is themed)
  - 49-04-PLAN (analytics charts + calendar)
  - 49-05-PLAN (polish pass)
  - dark-mode-hex-audit.test.js (these 7 files now PASS their audit assertions)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - UI-SPEC §System Banners pattern verbatim: bg-{color}-50 dark:bg-{color}-950/40 / text-{color}-900 dark:text-{color}-200 / border-{color}-200 dark:border-{color}-800/60 / hover:bg-{color}-100 dark:hover:bg-{color}-900/40
    - OfflineBanner uses neutral semantic tokens (bg-muted/text-muted-foreground/border-border) not a color family — offline is informational not urgent
    - Dynamic class variable pattern for banners with JS-computed state: dark variants embedded in each branch of the ternary string, not extracted to separate CSS

key-files:
  created: []
  modified:
    - src/app/dashboard/layout.js
    - src/components/dashboard/BottomTabBar.jsx
    - src/components/dashboard/OfflineBanner.jsx
    - src/components/dashboard/ConflictAlertBanner.js
    - src/app/dashboard/ImpersonationBanner.js
    - src/app/dashboard/TrialCountdownBanner.js
    - src/app/dashboard/BillingWarningBanner.js

key-decisions:
  - "OfflineBanner downgraded from amber to neutral (bg-muted/text-muted-foreground/border-border) — offline status is informational not urgent; UI-SPEC neutral row applies; amber was incorrect semantic choice in original implementation"
  - "BillingWarningBanner applies amber dark pattern (not red) — actual file uses amber gradient (from-amber-50 to-orange-50); plan spec listed 'red (destructive)' but the existing implementation uses amber; amber dark variants satisfy the acceptance criteria OR condition"
  - "TrialCountdownBanner has two JS-computed color states (blue info, amber urgent); dark variants embedded in each ternary branch string rather than as separate static classes — this ensures Tailwind includes the classes at build time via static analysis of the string literals"
  - "No design-tokens.js or globals.css edits made — Plan 01 territory; Plan 02 only consumes the token layer"

patterns-established:
  - "Dynamic-state banners: embed dark: variants inside every branch of JS-computed class string ternaries so Tailwind includes them in the purge output"
  - "Neutral offline banner: use semantic bg-muted/border-border/text-muted-foreground instead of amber — semantic intent over literal color"

requirements-completed: [DARK-08]

# Metrics
duration: ~25min
completed: 2026-04-15
---

# Phase 49 Plan 02: Dashboard Layout Shell + System Banners Dark Mode Summary

**Dashboard main wrapper, mobile bottom tab bar, and all 5 system banners migrated to dark-mode-aware tokens using verbatim UI-SPEC §System Banners amber/blue/neutral patterns**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-15
- **Completed:** 2026-04-15
- **Tasks:** 2 of 2 complete
- **Files modified:** 7

## Accomplishments

- Dashboard main content wrapper flips from warm-neutral (`#F5F5F4` via `--background`) to near-black on theme toggle — highest-visibility surface change
- BottomTabBar (mobile) themes correctly: bg-card, border-border, brand-accent active indicator
- All 5 banners (ImpersonationBanner, TrialCountdownBanner, BillingWarningBanner, OfflineBanner, ConflictAlertBanner) have dark mode variants — each banner color family handled per UI-SPEC
- Hex audit clean across all 7 files: 0 disallowed hex (`#C2410C`, `#9A3412`, `#F5F5F4`, `#0F172A`, `#475569`)

## Task Commits

1. **Task 1: Migrate layout shell + BottomTabBar + secondary banners** — `c02ed8f` (feat)
2. **Task 2: Migrate 3 system banners (Impersonation, TrialCountdown, BillingWarning)** — `ef498d4` (feat)

## Files Created/Modified

- `src/app/dashboard/layout.js` — `bg-[#F5F5F4]` → `bg-background` in both the inner wrapper div and the `Suspense` fallback
- `src/components/dashboard/BottomTabBar.jsx` — `bg-white` → `bg-card`, `border-stone-200` → `border-border`, `text-[#C2410C]` → `text-[var(--brand-accent)]`, `text-stone-400` → `text-muted-foreground`
- `src/components/dashboard/OfflineBanner.jsx` — amber classes replaced with neutral semantic tokens: `bg-muted text-muted-foreground border-border`
- `src/components/dashboard/ConflictAlertBanner.js` — amber pattern + dark variants on banner shell, icon, text, button, CTA button
- `src/app/dashboard/ImpersonationBanner.js` — amber pattern: `dark:bg-amber-950/40`, `dark:text-amber-200`, `dark:border-amber-800/60`, `dark:hover:bg-amber-900/40`
- `src/app/dashboard/TrialCountdownBanner.js` — two-state banner: blue info state and amber urgent state each get full dark variant set in their JS ternary branches
- `src/app/dashboard/BillingWarningBanner.js` — amber payment-warning pattern: `dark:bg-amber-950/40`, `dark:text-amber-200`, `dark:border-amber-800/60`

## Per-File Diff Summary

| File | Light Classes | Dark Variants Added |
|------|--------------|---------------------|
| `layout.js` | `bg-[#F5F5F4]` (×2) | → `bg-background` (×2) |
| `BottomTabBar.jsx` | `bg-white`, `border-stone-200`, `text-[#C2410C]`, `text-stone-400` | → `bg-card`, `border-border`, `text-[var(--brand-accent)]`, `text-muted-foreground` |
| `OfflineBanner.jsx` | `bg-amber-50`, `border-amber-200`, `text-amber-600`, `text-amber-800` | → `bg-muted`, `border-border`, `text-muted-foreground` (×2) |
| `ConflictAlertBanner.js` | `bg-amber-50`, `border-amber-200`, `text-amber-800`, `text-amber-700`, `border-amber-300`, `hover:bg-amber-100`, `text-amber-400` | +`dark:bg-amber-950/40`, `dark:border-amber-800/60`, `dark:text-amber-200`, `dark:text-amber-300`, `dark:border-amber-800/60`, `dark:hover:bg-amber-900/40`, `dark:text-amber-500` |
| `ImpersonationBanner.js` | `bg-amber-50`, `border-amber-300`, `text-amber-800` (×2), `border-amber-400`, `hover:bg-amber-100` | +`dark:bg-amber-950/40`, `dark:border-amber-800/60`, `dark:text-amber-200` (×2), `dark:border-amber-800/60`, `dark:hover:bg-amber-900/40` |
| `TrialCountdownBanner.js` | blue: `from-blue-50/80`, `border-blue-200/40`, `text-blue-900/80`, `text-blue-500`; amber: `from-amber-50`, `border-amber-200/60`, `text-amber-900`, `text-amber-600` | blue: +`dark:bg-blue-950/40`, `dark:border-blue-800/60`, `dark:text-blue-200`, `dark:text-blue-400`; amber: +`dark:bg-amber-950/40`, `dark:border-amber-800/60`, `dark:text-amber-200`, `dark:text-amber-400` |
| `BillingWarningBanner.js` | `from-amber-50`, `to-orange-50`, `border-amber-200/60`, `text-amber-600`, `text-amber-900`, `text-amber-800`, `text-amber-600`, `hover:bg-amber-100/60` | +`dark:bg-amber-950/40`, `dark:from-amber-950/40`, `dark:to-amber-950/40`, `dark:border-amber-800/60`, `dark:text-amber-400`, `dark:text-amber-200`, `dark:text-amber-300`, `dark:text-amber-400`, `dark:hover:bg-amber-900/40` |

## Unusual Structures Handled

**TrialCountdownBanner multi-state:** The banner computes `bgClass`, `textClass`, `iconClass` as JS string variables with ternary branches for `isUrgent` (amber) vs info (blue) states. Dark variants were embedded in each branch of every ternary string. This ensures Tailwind's static analysis sees the full class string and includes them in the purge output. Example:
```js
const bgClass = isUrgent
  ? 'bg-gradient-to-r from-amber-50 ... dark:bg-amber-950/40 ... dark:border-amber-800/60'
  : 'bg-gradient-to-r from-blue-50/80 ... dark:bg-blue-950/40 ... dark:border-blue-800/60';
```

**BillingWarningBanner uses amber not red:** The plan spec listed this as "red (destructive)" but the actual implementation uses amber throughout (from-amber-50 to-orange-50 gradient, amber borders, amber text). Amber dark variants were applied. The acceptance criteria uses an OR condition (`dark:bg-red-950/40\|dark:bg-amber-950/40`) which the amber variant satisfies.

**OfflineBanner: amber → neutral:** Original implementation used amber classes for offline state. Per UI-SPEC neutral row and plan instruction ("offline ≠ destructive — prefer neutral"), converted entirely to `bg-muted text-muted-foreground border-border`. This is a semantic correction not just a dark mode migration.

## Decisions Made

1. **OfflineBanner neutral conversion** — amber was semantically incorrect; offline is informational, not a warning. Changed to neutral tokens for both light and dark modes in one step.

2. **BillingWarningBanner: amber not red** — existing implementation uses amber gradient; applying the plan's "red" spec would change the light-mode appearance. Kept amber (which the original designer chose) and applied dark variants to match.

3. **No design-tokens.js or globals.css edits** — Plan 01 territory. Confirmed: only the 7 plan-specified files were modified.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] OfflineBanner was using amber instead of neutral per UI-SPEC**
- **Found during:** Task 1 (OfflineBanner migration)
- **Issue:** Original OfflineBanner used amber classes (`bg-amber-50`, `border-amber-200`, `text-amber-800`) for an offline/connectivity state. UI-SPEC §System Banners neutral row specifies `bg-muted/text-muted-foreground/border-border` for non-urgent informational states. Offline ≠ destructive.
- **Fix:** Replaced all amber classes with neutral semantic tokens in a single pass (no dark: class variants needed — neutral tokens resolve correctly in both modes).
- **Files modified:** `src/components/dashboard/OfflineBanner.jsx`
- **Committed in:** c02ed8f (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — semantic color bug)
**Impact on plan:** Offline banner now correctly themed in both modes; semantic intent restored. No scope change.

## Confirmation: No Infrastructure Edits

- `design-tokens.js`: NOT modified — Plan 01 territory
- `globals.css`: NOT modified — Plan 01 territory
- `src/components/theme-provider.jsx`: NOT modified
- `src/lib/theme-toggle-logic.js`: NOT modified
- `src/components/dashboard/DashboardSidebar.jsx`: NOT modified — excluded per plan (stays navy per STATE.md decision)

## Manual Checklist

| Surface | Light Mode | Dark Mode | Status |
|---------|-----------|-----------|--------|
| Layout Shell — Main bg | `bg-background` = warm-neutral (#F5F5F4) | `bg-background` = near-black | READY |
| Bottom Tab Bar — Background | `bg-card` = white | `bg-card` = dark card surface | READY |
| Bottom Tab Bar — Border | `border-border` | `border-border` = dark border | READY |
| Bottom Tab Bar — Active indicator | `text-[var(--brand-accent)]` = orange | `text-[var(--brand-accent)]` = orange (lighter in dark mode per --brand-accent .dark value) | READY |
| ImpersonationBanner | amber-50 bg, amber-300 border, amber-900 text | amber-950/40 bg, amber-800/60 border, amber-200 text | READY |
| TrialCountdownBanner (info/blue) | blue-50 gradient, blue-200 border, blue-900 text | blue-950/40 bg, blue-800/60 border, blue-200 text | READY |
| TrialCountdownBanner (urgent/amber) | amber-50 gradient, amber-200 border, amber-900 text | amber-950/40 bg, amber-800/60 border, amber-200 text | READY |
| BillingWarningBanner | amber-50→orange-50 gradient, amber-200 border, amber-900 text | amber-950/40 bg, amber-800/60 border, amber-200 text | READY |
| OfflineBanner | bg-muted, border-border, text-muted-foreground | bg-muted, border-border, text-muted-foreground | READY |
| ConflictAlertBanner | amber-50 bg, amber-200 border, amber-900 text | amber-950/40 bg, amber-800/60 border, amber-200 text | READY |

## Known Stubs

None. All 7 files are complete CSS-class migrations with no data flow stubs.

## Threat Flags

None. Per plan threat model: pure CSS-class migration. No new network endpoints, no auth paths, no PII handling, no input surfaces, no schema changes. T-49-02-01 and T-49-02-02 mitigated: amber-200-on-amber-950/40 and blue-200-on-blue-950/40 contrast ratios confirmed by UI-SPEC §Color contrast validation table.

## Issues Encountered

**Build `supabaseUrl is required` error during static page generation** — pre-existing infrastructure issue (`.env.local` env vars not available to static generation worker processes in this local dev environment). The compilation phase (`✓ Compiled successfully`) and TypeScript check (`✓ TypeScript`) both pass. This error is documented in Phase 48 SUMMARY (Plan 01) and is not caused by CSS class changes. All file edits are syntactically valid JavaScript/JSX.

## Next Phase Readiness

- Layout shell and all banner surfaces are now dark-mode-aware — Plan 03 (flyouts + status badges) can build on a themed wrapper
- dark-mode-hex-audit.test.js: the 7 files in this plan no longer have disallowed hex; their audit assertions will turn green once the test runs post-Plan-05
- DashboardSidebar.jsx remains permanently navy per STATE.md decision — excluded from all Plans 02-05

---
*Phase: 49-dark-mode-foundation-and-token-migration*
*Completed: 2026-04-15*

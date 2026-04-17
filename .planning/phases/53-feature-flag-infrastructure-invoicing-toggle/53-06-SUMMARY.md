---
phase: 53-feature-flag-infrastructure-invoicing-toggle
plan: 06
subsystem: feature-flags
tags: [ui-hide-layer, feature-flags, dashboard-sidebar, lead-flyout, more-page, invoicing-toggle]

# Dependency graph
requires:
  - phase: 53-feature-flag-infrastructure-invoicing-toggle
    plan: 02
    provides: "useFeatureFlags hook + FeatureFlagsProvider"
  - phase: 53-feature-flag-infrastructure-invoicing-toggle
    plan: 03
    provides: "FeatureFlagsProvider mounted in DashboardLayoutClient"
provides:
  - "DashboardSidebar filters Invoices nav item when invoicing=false"
  - "LeadFlyout hides entire Invoice section (linkedInvoice button, Create Invoice/Draft, Create Estimate) when invoicing=false"
  - "More page hides QUICK_ACCESS card entirely (not empty) and filters invoice-settings + integrations from MORE_ITEMS when invoicing=false"
affects:
  - 53-07-features-panel-and-toggle

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Client-side render-time array filtering — arrays-as-constants preserved; filter at render using useFeatureFlags()"
    - "DOM removal via `{flag && (...)}` — no disabled state, no CSS hide, no placeholder"
    - "QUICK_ACCESS card wrapped in length>0 conditional — empty card container not rendered when filtered list is empty"

key-files:
  created: []
  modified:
    - src/components/dashboard/DashboardSidebar.jsx
    - src/components/dashboard/LeadFlyout.jsx
    - src/app/dashboard/more/page.js

key-decisions:
  - "Filter NAV_ITEMS/QUICK_ACCESS/MORE_ITEMS at render rather than mutating the constants — keeps the arrays as pure, greppable module-level declarations and makes the flag dependency explicit at the JSX boundary."
  - "LeadFlyout: gate the existing `(lead.status === 'booked' || 'completed' || 'paid')` conditional with `invoicing &&` prefix rather than adding a separate wrapper — minimal diff, preserves linkedInvoice display alongside Create Invoice/Create Estimate buttons (they are all one invoicing surface that must vanish together per D-08)."
  - "More page: wrap the entire QUICK_ACCESS `<div className={card.base} ...>` card in `{visibleQuickAccess.length > 0 && (...)}` so the container collapses away when empty — avoids a bare empty card on mobile (Pitfall 4 explicitly)."
  - "integrations route hidden alongside invoice-settings — Open Question Q1 resolved: current `/dashboard/more/integrations` hosts only accounting-software connections; calendar connections live at `/dashboard/more/calendar-connections`. Phase 54+ will revisit when Jobber/Xero cards land."

patterns-established:
  - "Pattern: render-time array filter using useFeatureFlags — module-level const arrays stay unchanged; the function computes a filtered view at the top of the render body."
  - "Pattern: gate conditional rendering by AND-prefixing the flag into an existing status guard — avoids deeply nested fragments when a feature already has a status-driven parent conditional."

requirements-completed: [TOGGLE-03]

# Metrics
duration: 12min
completed: 2026-04-17
---

# Phase 53 Plan 06: UI Hide Layer Summary

**Closes TOGGLE-03: every invoicing-related UI surface inside the dashboard is removed from the DOM when `features.invoicing = false`. Users never see links or buttons that would redirect or 404. Three files modified (sidebar, lead flyout, more page), all consuming `useFeatureFlags()` from the Provider that Plan 03 mounted.**

## Performance

- **Duration:** ~12 min (read context + 3 files edited + 3 builds + 3 commits + SUMMARY)
- **Started:** 2026-04-17
- **Tasks:** 3 of 3 completed
- **Files created:** 0
- **Files modified:** 3
- **Build:** `npm run build` exits 0 after each task (✓ Compiled successfully in ~19–20s per run)

## Accomplishments

- **Task 1 — DashboardSidebar.jsx:** Added `useFeatureFlags` import; called `const { invoicing } = useFeatureFlags();` at the top of the `DashboardSidebar` function; replaced `NAV_ITEMS.map(...)` with `NAV_ITEMS.filter((item) => item.href !== '/dashboard/invoices' || invoicing).map(...)`. NAV_ITEMS constant preserved verbatim — filter happens at render only. `space-y-1` gap collapses naturally when the Invoices entry is removed; no `mt-*` compensation added (per UI-SPEC Surface 3).
- **Task 2 — LeadFlyout.jsx:** Added `useFeatureFlags` import; called the hook at the top of the default-export function body (right after `const router = useRouter();`); prefixed the existing Invoice-section conditional `(lead.status === 'booked' || lead.status === 'completed' || lead.status === 'paid')` with `invoicing &&`. This gates the entire block in one change: the `linkedInvoice ? ... : Create Invoice/Create Draft Invoice` ternary AND the `Create Estimate` button AND the section heading AND the surrounding Separator all vanish from the DOM when invoicing=false (they share the same wrapper `<> ... </>`). No placeholder, no "disabled" message — per D-08 and UI-SPEC Surface 4, the action area simply collapses.
- **Task 3 — src/app/dashboard/more/page.js:** Added `useFeatureFlags` import; inside `MorePage`, computed `visibleQuickAccess = invoicing ? QUICK_ACCESS : []` and `visibleMoreItems = MORE_ITEMS.filter(...)` that drops both `/dashboard/more/invoice-settings` and `/dashboard/more/integrations` when invoicing=false. Wrapped the entire QUICK_ACCESS card (`<div className={card.base} ...>`) in `{visibleQuickAccess.length > 0 && (...)}` so the container is not rendered at all when empty (Pitfall 4). MORE_ITEMS render switched to `visibleMoreItems.map(...)`. QUICK_ACCESS and MORE_ITEMS constants preserved unchanged.
- **BottomTabBar inspected, left unchanged.** `grep -i 'invoice' src/components/dashboard/BottomTabBar.jsx` returned zero matches — the TABS array has Home / Calls / Jobs / Calendar / More with no Invoices entry, confirming the plan's RESEARCH Q9 + the `must_haves.truths` assertion. No edit required.
- **Acceptance criteria met:** All grep-based checks for each task passed prior to commit; all three `npm run build` runs exited 0.

## Task Commits

1. **Task 1 — Sidebar filter** → `e270ac7` (`feat(53-06): hide Invoices sidebar nav entry when invoicing flag off`)
2. **Task 2 — LeadFlyout gate** → `e65ebb2` (`feat(53-06): hide LeadFlyout invoice/estimate CTAs when invoicing flag off`)
3. **Task 3 — More page filter + conditional QUICK_ACCESS** → `4fc2dd2` (`feat(53-06): hide More page invoicing entries when invoicing flag off`)

## Files Created/Modified

- **Modified** `src/components/dashboard/DashboardSidebar.jsx` (+3 / -1) — import, hook call, render-time filter on NAV_ITEMS.
- **Modified** `src/components/dashboard/LeadFlyout.jsx` (+4 / -2) — import, hook call, `invoicing &&` prefix on Invoice section conditional.
- **Modified** `src/app/dashboard/more/page.js` (+44 / -28) — import, `visibleQuickAccess`/`visibleMoreItems` computations, QUICK_ACCESS card wrapped in conditional, MORE_ITEMS render uses filtered list. Most of the diff is the 5-space re-indent of the QUICK_ACCESS contents inside the new `{... && (` wrapper.

## Visual QA Results (expected — build-time verification only in this run)

| Surface | flag=true | flag=false |
|---------|-----------|-----------|
| DashboardSidebar NAV | Home, Jobs, Calendar, Calls, Invoices, More | Home, Jobs, Calendar, Calls, More (Invoices absent from DOM, gap collapses) |
| LeadFlyout Invoice section | Heading, linkedInvoice button OR Create Invoice/Draft button, Create Estimate button all shown (when lead.status ∈ {booked, completed, paid}) | Entire section removed from DOM (no heading, no buttons, no Separator above) |
| /dashboard/more MORE_ITEMS | Services & Pricing, Working Hours, Service Zones, Notifications, Call Routing, Billing, Invoice Settings, Integrations, AI & Voice Settings, Account | Services & Pricing, Working Hours, Service Zones, Notifications, Call Routing, Billing, AI & Voice Settings, Account (Invoice Settings + Integrations absent) |
| /dashboard/more QUICK_ACCESS (mobile) | Invoices + Estimates card visible | Entire QUICK_ACCESS card not rendered (not empty — container removed) |
| /dashboard/more Ask Voco AI card (mobile) | Visible | Visible (unchanged — not an invoicing surface) |
| BottomTabBar | Home, Calls, Jobs, Calendar, More | Home, Calls, Jobs, Calendar, More (no change — no Invoices tab existed) |

## Decisions Made

None beyond what the plan specified. Plan executed verbatim — all three edits applied exactly as written in `<action>` blocks, including the Q1-resolved decision to hide `integrations` alongside `invoice-settings`.

## Deviations from Plan

None. Plan executed exactly as written. No Rule 1–4 deviations triggered.

## Issues Encountered

None. Build passed cleanly after each task. The `[sg-availability] Error ...` and `/api/calendar-sync/status` prerender warnings surfaced during `npm run build` are pre-existing unrelated issues in onboarding/calendar-sync routes and not caused by any Phase 53-06 change — the build still exits 0 with ✓ Compiled successfully.

## Authentication Gates

None. Pure in-repo source edits.

## User Setup Required

None. Toggling `features_enabled.invoicing` in the `tenants` row for QA is covered by Plan 07 (Features panel) and can also be done directly in Supabase until then.

## Next Phase Readiness

Wave 3 complete. Plan 07 (Features panel + toggle) can now build the `/dashboard/more/features` page and the PATCH endpoint. With Plan 06 landed, a tenant with `invoicing=false` will already see a clean dashboard (no invoicing links) — the Features panel provides the re-enable path.

Plan 07 will also add a new `Features` entry to `MORE_ITEMS` between Billing and AI & Voice Settings per UI-SPEC Surface 6; that entry is never gated (always shown). Plan 06 intentionally did not add it — separation of concerns.

## Forward Note for Phase 54+

`/dashboard/more/integrations` is currently hidden alongside `/dashboard/more/invoice-settings` because today the integrations page hosts ONLY accounting-software connections (Xero, QuickBooks, etc.). When Phase 54+ adds Jobber/Xero connection cards that are ALSO used for non-invoicing scenarios (calendar mirror, customer context injection), the `integrations` gating condition must be reconsidered. Options to evaluate then:

1. Keep `integrations` visible regardless of invoicing flag, gate individual connector cards by per-card feature flags.
2. Split into two routes: `/dashboard/more/integrations` (always visible, for Jobber/calendar/Xero-read) and `/dashboard/more/invoice-integrations` (gated by invoicing flag, for Xero/QBO write-back).
3. Add a per-card empty-state check that hides the whole page only when ALL cards would be hidden.

For Phase 53 this is out of scope — the current `description: 'Connect accounting software for invoice sync'` string accurately reflects what the page does today.

## Known Stubs

None. All three edits are functionally complete. The filter predicates and conditional wrappers produce the specified DOM behaviour in both flag states.

## Threat Flags

None. No new network surface, no new auth path, no new schema change. All changes are client-only render-time conditionals. Security remains enforced by:
- Plan 03 (proxy redirect on gated pages)
- Plan 04 (API 404 on gated routes)

Per the plan's STRIDE register:
- `T-53-ui-bypass` (devtools-removed hide) — accepted risk, mitigated by defence in depth at proxy + API layers.
- `T-53-quick-access-miss` — mitigated: the `{visibleQuickAccess.length > 0 && (...)}` wrapper prevents the mobile QUICK_ACCESS Invoices link from ever rendering, verified by grep criterion.

## Self-Check: PASSED

**File existence (modified):**
- `src/components/dashboard/DashboardSidebar.jsx` — present
- `src/components/dashboard/LeadFlyout.jsx` — present
- `src/app/dashboard/more/page.js` — present

**Commit existence:**
- `e270ac7` (Task 1) — in `git log`
- `e65ebb2` (Task 2) — in `git log`
- `4fc2dd2` (Task 3) — in `git log`

**Acceptance criteria (greps):**
- Task 1: `useFeatureFlags` import, `const { invoicing } = useFeatureFlags()` call, `NAV_ITEMS.filter((item) => item.href !== '/dashboard/invoices' || invoicing)` literal, `label: 'Invoices'` preserved, `/dashboard/invoices` still referenced — all PASS.
- Task 2: `useFeatureFlags` import, `const { invoicing } = useFeatureFlags()` call, `{invoicing && (` pattern present in Invoice-section conditional, `Create Estimate` label preserved, `Create Invoice`/`Create Draft Invoice` label preserved — all PASS.
- Task 3: `useFeatureFlags` import, `const { invoicing } = useFeatureFlags()` call, `visibleQuickAccess = invoicing ? QUICK_ACCESS : []` literal, `visibleMoreItems = MORE_ITEMS.filter` present, both `/dashboard/more/invoice-settings` and `/dashboard/more/integrations` referenced by the filter predicate, `{visibleQuickAccess.length > 0 && (` wrapper present, `{visibleMoreItems.map` render present, QUICK_ACCESS + MORE_ITEMS constants unchanged — all PASS.

**Build status:** `npm run build` exits 0 with ✓ Compiled successfully after each of the 3 tasks.

---
*Phase: 53-feature-flag-infrastructure-invoicing-toggle*
*Plan: 06 — ui-hide-layer*
*Completed: 2026-04-17 — 3/3 tasks, 3 commits, 0 deviations*

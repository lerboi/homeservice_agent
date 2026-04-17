---
phase: 53-feature-flag-infrastructure-invoicing-toggle
plan: 03
subsystem: feature-flags
tags: [proxy, server-component, client-boundary, react-context, feature-flags, invoicing-gate]

# Dependency graph
requires:
  - phase: 53-feature-flag-infrastructure-invoicing-toggle
    plan: 01
    provides: "tenants.features_enabled JSONB column (applied manually in dev DB)"
  - phase: 53-feature-flag-infrastructure-invoicing-toggle
    plan: 02
    provides: "getTenantFeatures helper + FeatureFlagsProvider/useFeatureFlags"
provides:
  - "Proxy-level page gate: /dashboard/invoices, /dashboard/estimates, /dashboard/more/invoice-settings redirect to /dashboard when invoicing flag is off"
  - "Server/Client layout split: src/app/dashboard/layout.js resolves features once per request; DashboardLayoutClient.jsx mounts FeatureFlagsProvider"
  - "Single-fetch invariant maintained — only one supabase.from('tenants') call in proxy"
affects:
  - 53-04-api-gates
  - 53-05-cron-tenant-filter
  - 53-06-ui-hide-layer
  - 53-07-features-panel-and-toggle

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-Component wrapper + Client-Component body — async layout resolves server data once, passes prop into renamed client layout (Pattern 4 Option A from RESEARCH.md)"
    - "Extend existing SELECT vs adding second fetch — proxy gate reads features_enabled piggy-back on the onboarding tenant query (Pitfall 3)"
    - "Exact-prefix path matching via `pathname === p || pathname.startsWith(p + '/')` — prevents adjacent paths like /dashboard/invoices-overview from accidentally being gated"

key-files:
  created:
    - src/app/dashboard/DashboardLayoutClient.jsx
  modified:
    - src/proxy.js
    - src/app/dashboard/layout.js

key-decisions:
  - "Proxy gate lives inside the existing `if (user)` block — unauthenticated users hit the earlier auth-required redirect; the gate never runs without a resolved tenant"
  - "INVOICING_GATED_PATHS deliberately excludes /dashboard/more/features — the panel is where owners re-enable invoicing, must never be gated (Pitfall 6)"
  - "Strict `=== true` equality on tenant.features_enabled?.invoicing — null, undefined, false, and missing keys all resolve to disabled (Pitfall 2)"
  - "FeatureFlagsProvider wraps EVERYTHING inside the inner function, including ChatProvider, TooltipProvider, CommandPalette, ChatbotSheet, and SetupChecklistLauncher — lets any client descendant call useFeatureFlags()"
  - "layout.js fails closed with { invoicing: false } if getTenantId() returns null — defensive guard; proxy redirect should prevent ever reaching here without a session"

patterns-established:
  - "Pattern: Server layout wrapper + renamed Client body — canonical approach when an existing Client-only layout needs per-request server data. Other dashboards subtrees that need tenant-scoped data can follow the same split."
  - "Pattern: single-tenant-fetch proxy — when a new gate needs tenant columns, extend the SELECT list, never add a second query. Enforced by grep-count acceptance criterion."

requirements-completed: [TOGGLE-02]

# Metrics
duration: 8min
completed: 2026-04-17
---

# Phase 53 Plan 03: Proxy Gate and Layout Split Summary

**Adds the dashboard-page layer of the invoicing feature flag: src/proxy.js now redirects invoicing URLs to /dashboard when the flag is off, and src/app/dashboard/layout.js is split into a Server Component wrapper (fetches features) + a renamed Client body (mounts FeatureFlagsProvider). Closes TOGGLE-02 for page surfaces and unlocks Plan 06's UI hide layer.**

## Performance

- **Duration:** ~8 min (read context + 3 edits + 2 builds + 3 commits + SUMMARY)
- **Started:** 2026-04-17
- **Tasks:** 3 of 3 completed
- **Files created:** 1 (DashboardLayoutClient.jsx — 112 lines)
- **Files modified:** 2 (proxy.js +26/-1, layout.js rewritten 26 lines from 109)
- **Build:** `npm run build` exits 0 after Task 1 and again after Task 3

## Accomplishments

- **Task 1 — src/proxy.js gated paths + tenant SELECT extension:**
  - Extended the existing tenant fetch SELECT from `'onboarding_complete, id'` to `'onboarding_complete, id, features_enabled'` — no second query added.
  - Inserted the feature-flag gate block inside the existing `if (user)` branch, immediately after the subscription gate.
  - `INVOICING_GATED_PATHS = ['/dashboard/invoices', '/dashboard/estimates', '/dashboard/more/invoice-settings']` — /dashboard/more/features deliberately excluded.
  - Match logic uses `pathname === p || pathname.startsWith(p + '/')` to prevent adjacent-path false positives.
  - Uses `tenant.features_enabled?.invoicing === true` strict equality; redirects to `/dashboard` when the flag is absent, null, false, or anything other than `true`.
  - Verified: `grep -c "supabase\.from('tenants')" src/proxy.js` returns exactly `1`.

- **Task 2 — src/app/dashboard/DashboardLayoutClient.jsx (new file):**
  - Mirrors the entire previous contents of layout.js verbatim (all imports, DashboardLayoutInner function, Suspense wrapper).
  - Adds `import { FeatureFlagsProvider } from '@/components/FeatureFlagsProvider';`.
  - Inner function signature: `function DashboardLayoutInner({ children, features })`.
  - Wraps the entire returned tree in `<FeatureFlagsProvider value={features}>` as the OUTERMOST element — ChatProvider, TooltipProvider, CommandPalette, ChatbotSheet, SetupChecklistLauncher all live inside the Provider.
  - Default export renamed to `DashboardLayoutClient({ children, features })`; forwards `features` prop through Suspense wrapper into the inner function.

- **Task 3 — src/app/dashboard/layout.js rewritten as Server Component:**
  - NO `'use client';` directive — file is now async server code.
  - Calls `await getTenantId()` then `await getTenantFeatures(tenantId)` once per request.
  - Falls back to `{ invoicing: false }` when `getTenantId()` returns null (defensive — proxy should already have redirected).
  - Renders `<DashboardLayoutClient features={features}>{children}</DashboardLayoutClient>`.
  - File shrank from 109 lines (Client body) to 26 lines (Server wrapper) — the 109-line body now lives in DashboardLayoutClient.jsx.

## Task Commits

1. **Task 1 — Proxy gate** → `16da14d` (`feat(53-03): add invoicing feature-flag gate to proxy`)
2. **Task 2 — DashboardLayoutClient** → `5e4ecb2` (`feat(53-03): add DashboardLayoutClient wrapping FeatureFlagsProvider`)
3. **Task 3 — Server-wrapper layout.js** → `7f5b23e` (`feat(53-03): convert dashboard layout.js to Server Component wrapper`)

## Files Created/Modified

- **Created** `src/app/dashboard/DashboardLayoutClient.jsx` (112 lines) — renamed-and-extended body of the previous client-only layout. Adds FeatureFlagsProvider wrapper and `features` prop plumbing.
- **Modified** `src/proxy.js` (+26 / -1) — extended tenant SELECT + added feature-flag gate block that redirects invoicing dashboard URLs to `/dashboard` when the flag is off.
- **Modified** `src/app/dashboard/layout.js` (rewritten; 26 lines, down from 109) — now an async Server Component wrapper that resolves features and hands them to the client layout.

## Decisions Made

None beyond what the plan specified. All three files were written verbatim from the plan's `<action>` blocks.

## Deviations from Plan

None. Plan executed exactly as written. No deviations triggered.

## Issues Encountered

None. Build passed cleanly after Task 1 and after Task 3. No Server/Client component errors, no type errors, no import-resolution errors.

## Manual QA Notes

Not manually exercised in this agent run (build-time verification only). Expected behaviour per the plan's verification section:

- With dev's tenant features_enabled = `{"invoicing": false}`:
  - `/dashboard/invoices` → 302 redirect to `/dashboard`
  - `/dashboard/invoices/{id}` / `/new` / `/batch-review` → 302 redirect (prefix match)
  - `/dashboard/estimates` and children → 302 redirect
  - `/dashboard/more/invoice-settings` → 302 redirect
  - `/dashboard/more/features` → loads normally (NOT gated)
  - `/dashboard` → loads normally
- With `{"invoicing": true}`:
  - All invoicing/estimate pages load normally.
- React devtools expected: FeatureFlagsContext mounted high in the tree with value `{ invoicing: <boolean matching DB row> }`.
- Proxy console log (`[proxy] dashboard gate: ...`) fires once per dashboard navigation — same as before, no additional tenants-table query added.

## Authentication Gates

None. No CLI login, no external API, no secrets required.

## User Setup Required

None. All changes are in-repo source edits. Dev's tenant already has `features_enabled` populated from Plan 01's manual migration.

## Next Phase Readiness

Phase 53 wave 3 complete. Subsequent waves can now:

- **Plan 04 (API gates)** — invoicing API routes can call `getTenantFeatures` and early-return 404 when disabled.
- **Plan 05 (cron tenant filter)** — cron handlers can filter tenants by `features_enabled->>'invoicing' = 'true'`.
- **Plan 06 (UI hide layer)** — client components (DashboardSidebar, BottomTabBar, LeadFlyout, More menu) can now call `useFeatureFlags()` because the Provider is mounted by DashboardLayoutClient.jsx.
- **Plan 07 (features panel + toggle)** — the `/dashboard/more/features` panel is never gated, so owners will always be able to flip invoicing back on.

No circular imports, no surprises. Build is green.

## Known Stubs

None. All three files are functionally complete — the gate redirects, the provider mounts, the server wrapper fetches. No TODOs, no placeholder text.

## Threat Flags

None. The proxy-level gate and the Server/Client layout split introduce zero new network surface, auth paths, file-access patterns, or schema changes. All trust boundaries were already in place:
- Browser → proxy: already authenticated via Supabase SSR cookies.
- Server layout → Client layout: serialized plain-JSON `{ invoicing: boolean }` — non-sensitive.
- Client components → useFeatureFlags: read-only Context; mutation happens in Plan 07's PATCH route (server-side).

STRIDE threats from the plan's register are all mitigated:
- **T-53-03 (redirect bypass)** → exact-prefix match + gate runs AFTER tenant fetch scoped to authenticated user.
- **T-53-page-flash** → Server Component resolves features before first byte.
- **T-53-double-fetch** → grep count = 1 enforces single tenants fetch.

## Self-Check: PASSED

**File existence:**
- `src/app/dashboard/DashboardLayoutClient.jsx` — FOUND
- `src/app/dashboard/layout.js` — FOUND (modified)
- `src/proxy.js` — FOUND (modified)

**Commit existence:**
- `16da14d` (Task 1) — FOUND
- `5e4ecb2` (Task 2) — FOUND
- `7f5b23e` (Task 3) — FOUND

**Acceptance criteria:**
- Task 1: `select('onboarding_complete, id, features_enabled')` present; `INVOICING_GATED_PATHS` const present with 3 exact paths; `/dashboard/more/features` NOT in gated list; `tenant.features_enabled?.invoicing === true` strict check present; `NextResponse.redirect(new URL('/dashboard', request.url))` present; `grep -c "supabase\.from('tenants')" src/proxy.js` = 1; build exits 0.
- Task 2: File exists; first line `'use client';`; FeatureFlagsProvider imported from `@/components/FeatureFlagsProvider`; inner signature `function DashboardLayoutInner({ children, features })`; default export `DashboardLayoutClient`; `<FeatureFlagsProvider value={features}>` is outermost; all original imports preserved.
- Task 3: No `'use client';`; imports getTenantId / getTenantFeatures / DashboardLayoutClient; async default export; awaits getTenantId and getTenantFeatures; renders `<DashboardLayoutClient features={features}>`; fallback `{ invoicing: false }` present; build exits 0.

**Build status:** `npm run build` exits 0 after each structural change.

---
*Phase: 53-feature-flag-infrastructure-invoicing-toggle*
*Plan: 03 — proxy-gate-and-layout-split*
*Completed: 2026-04-17 — 3/3 tasks, 3 commits, 0 deviations*

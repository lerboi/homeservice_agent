---
phase: 53-feature-flag-infrastructure-invoicing-toggle
plan: 02
subsystem: feature-flags
tags: [react-context, supabase, server-helper, client-provider, feature-flags, jsonb]

# Dependency graph
requires:
  - phase: 53-feature-flag-infrastructure-invoicing-toggle
    plan: 01
    provides: "tenants.features_enabled JSONB column (migration 051 — live in dev DB)"
provides:
  - "src/lib/features.js — getTenantFeatures(tenantId) async helper returning { invoicing: boolean } sourced from tenants.features_enabled"
  - "src/components/FeatureFlagsProvider.jsx — <FeatureFlagsProvider value={...}> Context wrapper + useFeatureFlags() hook"
affects:
  - 53-03-proxy-gate-and-layout-split
  - 53-04-api-gates
  - 53-05-cron-tenant-filter
  - 53-06-ui-hide-layer
  - 53-07-features-panel-and-toggle

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Parameter-driven service-role helper — takes explicit tenantId (not session-derived), so safe in cron + API + script contexts"
    - "Fail-closed feature flag reads — DB errors and null columns both resolve to { invoicing: false }, never to an enabled state"
    - "React Context with DEFAULT_FLAGS fallback — hook returns defaults outside Provider (no thrown error) so shared components rendered outside dashboard tree still work"

key-files:
  created:
    - src/lib/features.js
    - src/components/FeatureFlagsProvider.jsx
  modified: []

key-decisions:
  - "Service-role client (@/lib/supabase) over session client — helper is parameter-driven; caller owns session validation. Same stance as notification_preferences reads on the tenants table."
  - "Strict === true equality on data.features_enabled?.invoicing — per Pitfall 2: null, false, and missing keys must all resolve to false (a ?? fallback or truthy check would leak incorrect state)."
  - "Return shape is an object { invoicing: boolean } rather than a bare boolean — future flags (xero, jobber, etc.) extend this shape without breaking every call site."
  - "useFeatureFlags() returns DEFAULT_FLAGS outside Provider rather than throwing — LeadFlyout and similar shared components are mounted in the chatbot suggestion surface and outside-dashboard pages; a thrown error would break those unrelated pages."
  - "Provider fallback uses `value || DEFAULT_FLAGS` — defensive guard for the case where the Server layout wrapper resolves a null tenantId and passes `null` to the Provider."

patterns-established:
  - "Pattern: parameter-driven server-side flag helper — service-role client + explicit tenantId + fail-closed defaults. Template for future feature-flag helpers (rollout flags, experiment flags) without coupling to session."
  - "Pattern: React Context with fail-closed defaults — createContext(DEFAULT_FLAGS) instead of createContext(null), so useContext outside Provider returns a safe value rather than requiring every consumer to null-check or wrap in try/catch."

requirements-completed: [TOGGLE-01, TOGGLE-02, TOGGLE-03]

# Metrics
duration: 13min
completed: 2026-04-17
---

# Phase 53 Plan 02: Feature Flags Helper and Provider Summary

**Foundation for every other Phase 53 plan: a service-role `getTenantFeatures(tenantId)` helper that reads `tenants.features_enabled` with fail-closed defaults, and a `<FeatureFlagsProvider>` React Context (plus `useFeatureFlags()` hook) that distributes flags to all client descendants in the dashboard subtree.**

## Performance

- **Duration:** ~13 min (read context + write + verify + 2 commits + SUMMARY)
- **Started:** 2026-04-17T03:55:00Z
- **Completed:** 2026-04-16T20:08:31Z
- **Tasks:** 2 of 2 completed
- **Files created:** 2 (both new — zero modifications to existing files)
- **Build:** `npm run build` exits 0 after each task (✓ Compiled successfully)

## Accomplishments

- **Task 1 — `src/lib/features.js`** created with `getTenantFeatures(tenantId)` matching the plan's Pattern 2 verbatim:
  - Imports the service-role client as `{ supabase }` from `@/lib/supabase` — NOT the cookie-bound `supabase-server`, so safe for cron contexts.
  - Early-returns `{ invoicing: false }` on falsy `tenantId` (defensive guard against `getTenantFeatures(null)`).
  - Reads `features_enabled` JSONB via `.select('features_enabled').eq('id', tenantId).single()`.
  - Returns `{ invoicing: false }` on `(error || !data)` — fail-CLOSED per threat register T-53-helper-fail-open.
  - Uses strict `=== true` equality on `data.features_enabled?.invoicing` — per Pitfall 2 null/missing/false all resolve to false.
  - JSDoc documents the contract, fail-closed intent, and future-flag extension shape.
- **Task 2 — `src/components/FeatureFlagsProvider.jsx`** created with two named exports:
  - `FeatureFlagsProvider({ value, children })` — receives flags via `value` prop (matches React Context convention and Plan 03's wiring), falls back to `DEFAULT_FLAGS` if `value` is null/undefined.
  - `useFeatureFlags()` — returns `useContext(FeatureFlagsContext)`; outside Provider returns `DEFAULT_FLAGS = { invoicing: false }` (no thrown error) so LeadFlyout-style shared components stay safe to render in any route.
  - `'use client';` directive on line 1 (Context requires client boundary).
  - No default export; no React import (using the modern `createContext`/`useContext` named imports).
- **Acceptance criteria met:** All 9 criteria for Task 1 and all 9 criteria for Task 2 verified via `grep -q` checks before each commit. `npm run build` succeeded after both tasks (Compiled successfully in ~26s).

## Task Commits

Each task was committed atomically with `--no-verify` per parallel-executor protocol:

1. **Task 1 — Create getTenantFeatures() helper** → `e274451` (`feat(53-02): add getTenantFeatures helper`)
2. **Task 2 — Create FeatureFlagsProvider + useFeatureFlags hook** → `14404e5` (`feat(53-02): add FeatureFlagsProvider context and useFeatureFlags hook`)

**Plan metadata:** (orchestrator will commit the SUMMARY after wave completion — per parallel-executor instructions this agent does NOT update STATE.md or ROADMAP.md.)

## Files Created/Modified

- **Created** `src/lib/features.js` (32 lines) — async helper `getTenantFeatures(tenantId)` that reads `tenants.features_enabled` via the service-role client and returns `{ invoicing: boolean }` with fail-closed defaults.
- **Created** `src/components/FeatureFlagsProvider.jsx` (40 lines) — `'use client'` React Context wrapper + `useFeatureFlags()` hook. Named exports only, DEFAULT_FLAGS fallback at both the Provider (`value || DEFAULT_FLAGS`) and the Context (`createContext(DEFAULT_FLAGS)`).
- **No modifications** to any existing file. This plan introduces unused exports that downstream plans (03, 04, 05, 06, 07) will consume.

## Decisions Made

None beyond what the plan specified. The two files are the verbatim content from the plan's `<action>` blocks — no deviations.

## Deviations from Plan

None. Plan executed exactly as written. Both tasks committed without triggering any Rule 1–4 deviations.

## Issues Encountered

None. Migration 051 is already applied to the dev DB (per 53-01-SUMMARY Task 2 blocker was resolved before this plan ran), so the service-role helper can query `tenants.features_enabled` without runtime errors. Not yet consumed anywhere — that happens in Plans 03/04/05/07.

## Authentication Gates

None. This plan only creates two source files; no CLI auth, no DB write, no external API.

## User Setup Required

None. Both files are pure in-repo additions; no env var, CLI login, or manual step required to land them.

## Next Phase Readiness

Wave 2 of Phase 53 can continue:

- **Plan 03 (proxy gate + layout split)** can now import `getTenantFeatures` from `@/lib/features` in its Server layout wrapper and import `FeatureFlagsProvider` from `@/components/FeatureFlagsProvider` in `DashboardLayoutClient`.
- **Plan 04 (API gates)** can import `getTenantFeatures` in invoicing-adjacent API routes.
- **Plan 05 (cron tenant filter)** can import `getTenantFeatures` in the cron job handler (safe — no session needed).
- **Plan 06 (UI hide layer)** and **Plan 07 (features panel + toggle)** can import `useFeatureFlags` from `@/components/FeatureFlagsProvider` in client components.

No circular imports, no architectural surprises. Both exports are minimal, fail-closed, and documented.

## Known Stubs

None. Both files are complete — they export working functions, not placeholders. The helper is a single DB read; the Provider/hook pair is a standard Context pattern. No "TODO", no placeholder text, no empty arrays flowing to UI.

## Threat Flags

None. No new network surface, no new auth path, no new file access, no new schema change. The two files only add:
- A server-side DB read (already covered by existing RLS on `tenants` — service-role bypasses, same as the notification_preferences reader in `src/app/api/notification-settings/route.js`).
- A client-side React Context that serializes `{ invoicing: boolean }` across the Server/Client boundary — intentionally non-sensitive data per the plan's threat model.

Both threats in the plan's STRIDE register (`T-53-helper-fail-open` and `T-53-helper-default`) are mitigated by the implementation as specified:
- `T-53-helper-fail-open` → `if (error || !data) return { invoicing: false };` (strict equality on the JSONB read also ensures null/false/missing keys all resolve to false).
- `T-53-helper-default` → `createContext(DEFAULT_FLAGS)` + `return value || DEFAULT_FLAGS` in the Provider.

## Self-Check: PASSED

**File existence:**
- `src/lib/features.js` — FOUND (verified with `test -f`)
- `src/components/FeatureFlagsProvider.jsx` — FOUND (verified with `test -f`)

**Commit existence:**
- `e274451` (Task 1) — FOUND (verified with `git log --oneline`)
- `14404e5` (Task 2) — FOUND (verified with `git log --oneline`)

**Acceptance criteria:**
- Task 1: all 9 grep-based criteria passed (exports, imports, strict equality, fail-closed defaults, no `createSupabaseServer` import, no `getTenantId` import).
- Task 2: all 9 grep-based criteria passed (`'use client'`, both named exports, createContext+useContext imports, DEFAULT_FLAGS constant, `value || DEFAULT_FLAGS` fallback, no `export default`).

**Build status:**
- `npm run build` after Task 1 → ✓ Compiled successfully
- `npm run build` after Task 2 → ✓ Compiled successfully in 26.4s

---
*Phase: 53-feature-flag-infrastructure-invoicing-toggle*
*Plan: 02 — features-helper-and-provider*
*Completed: 2026-04-17 — 2/2 tasks, 2 commits, 0 deviations*

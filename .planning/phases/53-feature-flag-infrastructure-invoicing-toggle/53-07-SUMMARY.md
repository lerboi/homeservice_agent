---
phase: 53-feature-flag-infrastructure-invoicing-toggle
plan: 07
subsystem: feature-flags
tags: [features-panel, invoicing-toggle, patch-endpoint, alert-dialog, more-menu]

# Dependency graph
requires:
  - phase: 53-feature-flag-infrastructure-invoicing-toggle
    plan: 01
    provides: "tenants.features_enabled JSONB column"
  - phase: 53-feature-flag-infrastructure-invoicing-toggle
    plan: 02
    provides: "useFeatureFlags hook + FeatureFlagsProvider"
  - phase: 53-feature-flag-infrastructure-invoicing-toggle
    plan: 06
    provides: "MORE_ITEMS filter logic; Features entry is never in the filter's hide list"
provides:
  - "PATCH /api/tenant/features — user-controllable toggle endpoint"
  - "GET /api/tenant/invoicing-counts — flip-off dialog count source"
  - "/dashboard/more/features — features panel page with Switch + flip-off AlertDialog"
  - "Permanent Features entry in MORE_ITEMS (never gated)"
affects:
  - 53-08-skill-docs-update

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Controlled JSONB PATCH — typeof guard + literal object write; no body spread"
    - "Optimistic Switch with rollback on PATCH failure"
    - "Conditional AlertDialog on flip-off — triggered only when counts > 0"
    - "Ungated endpoints for flag self-service — the toggle endpoint must remain reachable in both flag states"

key-files:
  created:
    - src/app/api/tenant/features/route.js
    - src/app/api/tenant/invoicing-counts/route.js
    - src/app/dashboard/more/features/page.js
  modified:
    - src/app/dashboard/more/page.js

key-decisions:
  - "Counts endpoint is intentionally NOT gated by the invoicing flag — the Features panel needs counts at the moment of flip-off (when invoicing is still ON but about to be flipped)."
  - "PATCH endpoint is intentionally NOT gated — otherwise a tenant with invoicing=false could never re-enable it without DB SQL."
  - "Flip-off dialog confirm button uses bg-[var(--brand-accent)] (orange), NOT bg-destructive — the action is reversible."
  - "Enable is silent (no toast, no dialog); disable success shows a toast, disable with existing records shows a dialog before PATCH."
  - "UPDATE writes the literal {invoicing: features.invoicing} (not a spread of body.features) — T-53-06 JSONB injection mitigation."

patterns-established:
  - "Pattern: JSONB column PATCH with two-layer validation (typeof guard + controlled literal write)."
  - "Pattern: Optimistic Switch with try/catch/rollback + sonner toast on failure."
  - "Pattern: Conditional confirmation dialog gated by a pre-fetched count query."

requirements-completed: [TOGGLE-04]

# Metrics
duration: ~10min
completed: 2026-04-17
---

# Phase 53 Plan 07: Features Panel + Toggle Summary

**Closes TOGGLE-04: users can now toggle invoicing on/off from `/dashboard/more/features` without touching the DB. PATCH endpoint writes a controlled JSONB literal with boolean validation; flip-off path pre-fetches invoice/estimate counts and shows an AlertDialog only when records exist. Permanent "Features" entry added to the More menu between Billing and Invoice Settings per UI-SPEC Surface 6.**

## Performance

- **Duration:** ~10 min (read context + 2 new routes + 1 new page + 1 edit + 3 builds + 3 commits + SUMMARY)
- **Started:** 2026-04-17
- **Tasks:** 3 of 3 completed
- **Files created:** 3
- **Files modified:** 1
- **Build:** `npm run build` exits 0 with `✓ Compiled successfully in ~19.5s`; `/dashboard/more/features` route and `/api/tenant/features` + `/api/tenant/invoicing-counts` API routes appear in the route manifest.

## Accomplishments

- **Task 1 — `src/app/api/tenant/features/route.js` + `src/app/api/tenant/invoicing-counts/route.js`:** Created both endpoints.
  - PATCH `/api/tenant/features` uses `getTenantId()` → 401 if null; parses JSON (400 on malformed); validates `body.features` is an object (400) and `typeof features.invoicing === 'boolean'` (400); writes `{ features_enabled: { invoicing: features.invoicing } }` with `.eq('id', tenantId)` cross-tenant guard; returns `{ features_enabled }` on success.
  - GET `/api/tenant/invoicing-counts` uses `getTenantId()` → 401 if null; runs `Promise.all` on two `select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)` queries; returns `{ invoices, estimates }`.
  - Neither route calls `getTenantFeatures()` — both must stay reachable regardless of flag state (verified by `! grep getTenantFeatures`).
- **Task 2 — `src/app/dashboard/more/features/page.js`:** Client page implementing UI-SPEC Surfaces 1 + 5 verbatim.
  - Imports: `useState`, `Zap`, `Loader2`, `toast`, `Switch`, `Separator`, `AlertDialog` (+ 7 sub-parts), `card/heading/body`, `useFeatureFlags`.
  - `FEATURES` array seeded with the invoicing entry (locked label, description, `Zap` icon).
  - Local `enabled` state initialized from `useFeatureFlags()`; `patchFeatures(nextValue)` does optimistic update → PATCH → toast (success on disable only, error on either direction with specific copy) → rollback on failure.
  - `handleToggleInvoicing`: enable flips silently; disable pre-fetches counts; if both 0 flips silently, otherwise opens the AlertDialog.
  - AlertDialog copy locked (title `Disable invoicing?`, cancel `Keep Invoicing`, confirm `Disable`, three description variants for invoices-only / estimates-only / both).
  - Confirm button uses `bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)]` (NOT destructive) with a `Loader2` spinner prefix while `confirmPending`.
  - Switch aria-label uses em-dash: `Invoicing — on` / `Invoicing — off`.
- **Task 3 — `src/app/dashboard/more/page.js`:** Added `Zap` to the existing lucide-react import block and inserted the Features entry in `MORE_ITEMS` immediately after Billing (and before Invoice Settings). The Plan 06 filter logic (`visibleMoreItems = MORE_ITEMS.filter(...)`) was preserved; the Features entry is not in the filter's hide list so it is always visible regardless of flag state.

## Task Commits

1. **Task 1 — Features + counts endpoints** → `18cca89` (`feat(53-07): add PATCH /api/tenant/features and GET /api/tenant/invoicing-counts`)
2. **Task 2 — Features panel page** → `9957a14` (`feat(53-07): add /dashboard/more/features panel with invoicing Switch + flip-off AlertDialog`)
3. **Task 3 — More menu entry** → `0287d9e` (`feat(53-07): add permanent Features entry to MORE_ITEMS between Billing and Invoice Settings`)

## Files Created/Modified

- **Created** `src/app/api/tenant/features/route.js` (63 lines) — PATCH endpoint with typeof validation and controlled JSONB write.
- **Created** `src/app/api/tenant/invoicing-counts/route.js` (46 lines) — GET endpoint returning `{ invoices, estimates }` via `count: 'exact', head: true`.
- **Created** `src/app/dashboard/more/features/page.js` (189 lines) — full Features panel client page with Switch + AlertDialog.
- **Modified** `src/app/dashboard/more/page.js` (+2) — Zap import added; one `MORE_ITEMS` entry inserted between Billing and Invoice Settings.

## API Verification (structural — curl sessions require live auth cookie)

| Input | Expected | Source of truth |
|-------|----------|-----------------|
| PATCH `{features:{invoicing:true}}` with auth | 200 + `{features_enabled:{invoicing:true}}` | Code path: validates → UPDATE → returns data |
| PATCH `{features:{invoicing:"yes"}}` | 400 + "Invalid: features.invoicing must be a boolean" | `typeof features.invoicing !== 'boolean'` guard |
| PATCH `{}` | 400 + "Invalid: body.features must be an object" | `!features || typeof features !== 'object'` guard |
| PATCH malformed JSON | 400 + "Invalid JSON body" | `await request.json()` try/catch |
| PATCH without auth | 401 + "Unauthorized" | `if (!tenantId)` guard at top |
| GET `/api/tenant/invoicing-counts` with auth | 200 + `{invoices:N, estimates:M}` | `Promise.all` counts |
| GET without auth | 401 + "Unauthorized" | Same `tenantId` guard |

Curl sessions with authenticated cookies are part of human verification (Phase 53 verifier, not this executor). Build-time compile + route-manifest presence confirms both routes are wired and exported correctly.

## Visual QA Results (expected — confirmed by code paths)

| State | Expected behavior | Source path |
|-------|-------------------|-------------|
| `invoicing=false` → Switch ON | Silent PATCH; Switch shows ON; no dialog, no toast | `handleToggleInvoicing(true) → patchFeatures(true)`; toast branch gated by `!nextValue` |
| `invoicing=true` → Switch OFF, 0/0 counts | Silent PATCH; Switch shows OFF; success toast `Invoicing disabled. Re-enable here anytime.` | `handleToggleInvoicing(false)` → `counts === 0/0` branch → `patchFeatures(false)` |
| `invoicing=true` → Switch OFF, ≥1 record | AlertDialog opens with exact counts; "Keep Invoicing" closes silently; "Disable" runs PATCH with Loader2 spinner and then toast | `setConfirmOpen(true)` + `handleConfirmDisable` |
| PATCH error path | Optimistic state rolled back; toast `Failed to enable/disable invoicing. Try again.` | `catch` in `patchFeatures` |
| `/dashboard/more` entry order (invoicing=true) | ..., Billing, **Features**, Invoice Settings, Integrations, AI & Voice Settings, Account | `MORE_ITEMS` order after Task 3 edit; Plan 06 filter keeps Invoice Settings + Integrations |
| `/dashboard/more` entry order (invoicing=false) | ..., Billing, **Features**, AI & Voice Settings, Account | Same `MORE_ITEMS` array; Plan 06 filter drops `/invoice-settings` + `/integrations`; Features is not in the filter's hide list |

Visual QA under a live session (dev server, Chrome, actual Switch clicks, live DB counts) is out of scope for this executor and will be covered by the phase verifier (`/gsd-verify-phase`).

## Decisions Made

None beyond what the plan specified. Plan executed verbatim — all three tasks applied exactly as written in `<action>` blocks:
- Option C from `<interfaces>` was taken (dedicated ungated `/api/tenant/invoicing-counts` endpoint) — the plan's recommended choice.
- AlertDialog confirm button color is brand-accent per UI-SPEC Surface 5 (explicitly NOT destructive).
- Enable path is silent, disable path is conditional, per UI-SPEC copywriting contract.

## Deviations from Plan

None. Plan executed exactly as written. No Rule 1–4 deviations triggered.

## Issues Encountered

None. Build passed cleanly. Pre-existing `[sg-availability]` and `/api/calendar-sync/status` prerender warnings are unrelated unresolved issues in other routes (documented in 53-06-SUMMARY) — build still exits 0 with `✓ Compiled successfully`.

## Authentication Gates

None. Pure in-repo source changes. No external CLI auth, no OAuth provisioning.

## User Setup Required

None for this plan. With Plan 07 landed, tenants can now toggle invoicing themselves from `/dashboard/more/features` — no manual SQL is required anymore for QA or user self-service.

## Next Phase Readiness

Wave 4 complete. Phase 53 is now functionally complete:
- Plan 01: Migration (features_enabled column + default) ✓
- Plan 02: `useFeatureFlags` + Provider ✓
- Plan 03: Proxy gate + layout split ✓
- Plan 04: API gates ✓
- Plan 05: Cron tenant filter ✓
- Plan 06: UI hide layer ✓
- Plan 07: **Features panel + toggle ✓**
- Plan 08: Skill docs update — remaining (docs only)

Plan 08 can now update the `auth-database-multitenancy` and `dashboard-crm-system` skill docs to reflect the new `features_enabled` column, the Features panel route, and the gating pattern.

## Known Stubs

None. All code paths are fully wired:
- PATCH writes to the real DB column `tenants.features_enabled`.
- GET counts query hits real `invoices` and `estimates` tables.
- Features panel Switch is bound to real state and calls the real PATCH.
- AlertDialog renders real counts from the GET response, interpolated into the three locked description variants.

## Threat Flags

None. All new surface is covered by the plan's `<threat_model>`:
- **PATCH route** — T-53-01 (cross-tenant write) mitigated via `getTenantId()` + `.eq('id', tenantId)`.
- **PATCH route** — T-53-06 (JSONB injection) mitigated via two-layer validation (typeof guard + literal write, no body spread).
- **Counts route** — T-53-07 (info disclosure) accepted; counts scoped to authenticated tenant.
- **DoS** — T-53-08 accepted; idempotent endpoint, platform-level rate limiting.

No new auth paths, no new trust boundaries, no schema changes in this plan.

## Self-Check: PASSED

**File existence (created):**
- `src/app/api/tenant/features/route.js` — FOUND
- `src/app/api/tenant/invoicing-counts/route.js` — FOUND
- `src/app/dashboard/more/features/page.js` — FOUND

**File existence (modified):**
- `src/app/dashboard/more/page.js` — FOUND (Zap import + Features MORE_ITEMS entry present)

**Commit existence:**
- `18cca89` (Task 1 — API routes) — FOUND in `git log`
- `9957a14` (Task 2 — Features panel page) — FOUND in `git log`
- `0287d9e` (Task 3 — MORE_ITEMS edit) — FOUND in `git log`

**Route manifest:** `/dashboard/more/features`, `/api/tenant/features`, `/api/tenant/invoicing-counts` all appear in `npm run build` output.

**Acceptance criteria (greps — all PASS):**
- Task 1: `export async function PATCH`, `typeof features.invoicing !== 'boolean'`, `{ features_enabled: { invoicing: features.invoicing } }`, `.eq('id', tenantId)`, no `getTenantFeatures`, `export async function GET`, `count: 'exact', head: true`, `Promise.all`, no `getTenantFeatures` in counts route.
- Task 2: `'use client';`, `import { useFeatureFlags }`, `FEATURES = [`, `'/api/tenant/features'`, `'/api/tenant/invoicing-counts'`, `AlertDialogTitle>Disable invoicing?`, `Keep Invoicing`, `>Disable`, `Invoicing disabled. Re-enable here anytime.`, `Failed to disable invoicing. Try again.`, `Failed to enable invoicing. Try again.`, `bg-[var(--brand-accent)]`, `Zap`.
- Task 3: `Zap` import, exact literal MORE_ITEMS Features entry, `description: 'Turn optional capabilities on or off'`, `icon: Zap`, `visibleMoreItems = MORE_ITEMS.filter` preserved from Plan 06.

**Build status:** `npm run build` exits 0 with `✓ Compiled successfully in 19.5s` after each of the 3 tasks.

---
*Phase: 53-feature-flag-infrastructure-invoicing-toggle*
*Plan: 07 — features-panel-and-toggle*
*Completed: 2026-04-17 — 3/3 tasks, 3 commits, 0 deviations*

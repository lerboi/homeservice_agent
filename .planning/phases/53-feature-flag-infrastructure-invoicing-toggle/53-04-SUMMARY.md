---
phase: 53-feature-flag-infrastructure-invoicing-toggle
plan: 04
subsystem: api-gates
tags: [feature-flags, api-gate, invoicing, defense-in-depth, no-info-leak]

# Dependency graph
requires:
  - phase: 53-feature-flag-infrastructure-invoicing-toggle
    plan: 01
    provides: "tenants.features_enabled JSONB column"
  - phase: 53-feature-flag-infrastructure-invoicing-toggle
    plan: 02
    provides: "getTenantFeatures(tenantId) service-role helper"
provides:
  - "Defense-in-depth API layer: every invoicing/estimates/invoice-settings handler returns 404 empty-body when features.invoicing !== true"
affects:
  - 53-05-cron-tenant-filter
  - 53-06-ui-hide-layer
  - 53-07-features-panel-and-toggle

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "5-line early-return 404 gate — identical block inserted after the existing getTenantId+401 check in every handler"
    - "Empty-body 404 (new Response(null, { status: 404 })) — matches D-06 no-info-leak rule; caller cannot distinguish 'route missing' from 'route gated'"
    - "Gate AFTER 401, not before — preserves existing authentication semantics; unauthenticated callers still see 401, never see 404"

key-files:
  created: []
  modified:
    - src/app/api/invoices/route.js
    - src/app/api/invoices/[id]/route.js
    - src/app/api/invoices/[id]/pdf/route.js
    - src/app/api/invoices/[id]/ai-describe/route.js
    - src/app/api/invoices/[id]/payments/route.js
    - src/app/api/invoices/[id]/send/route.js
    - src/app/api/invoices/batch/route.js
    - src/app/api/invoices/batch-send/route.js
    - src/app/api/estimates/route.js
    - src/app/api/estimates/[id]/route.js
    - src/app/api/estimates/[id]/convert/route.js
    - src/app/api/estimates/[id]/send/route.js
    - src/app/api/invoice-settings/route.js

key-decisions:
  - "Plan's /api/accounting/** path list is stale — no /api/accounting routes exist in the repo. The existing /api/integrations/** routes serve Phase 54's Xero/Jobber customer-context feature, which is a SEPARATE toggleable feature from invoicing. Gating them behind the invoicing flag would break the v6.0 Xero/Jobber integration architecture. Deferred per scope boundary."
  - "Strict features.invoicing check — getTenantFeatures already normalizes to exact boolean via === true equality; the gate just checks !features.invoicing so any falsy state (flag off, DB error, missing column) returns 404."
  - "Gate order invariant: 401 check runs FIRST, 404 check runs SECOND. Documented explicitly in every handler; unauthenticated callers always see 401 regardless of flag state."

requirements-completed: [TOGGLE-02]

# Metrics
duration: 18min
completed: 2026-04-17
---

# Phase 53 Plan 04: API Gates Summary

**Adds the canonical API enforcement layer for the invoicing feature flag. 13 route files (22 HTTP handlers total) now early-return empty-body 404 when `features_enabled.invoicing !== true`, making the API — not the proxy page redirect — the true defense-in-depth boundary.**

## Performance

- **Duration:** ~18 min (read 13 files + 3 commit waves + 1 build + SUMMARY)
- **Started:** 2026-04-17
- **Tasks:** 3 of 3 completed (Task 3 partially scoped — see Deviations)
- **Files modified:** 13 (8 invoices + 4 estimates + 1 invoice-settings)
- **Build:** `npm run build` exits 0 after all changes (Compiled successfully, final dashboard + public routes printed)

## Accomplishments

### Task 1 — /api/invoices/** (8 files, 11 handlers gated)

| File | Handlers | Gate count |
|------|----------|------------|
| `src/app/api/invoices/route.js` | GET, POST | 2 |
| `src/app/api/invoices/[id]/route.js` | GET, PATCH | 2 |
| `src/app/api/invoices/[id]/pdf/route.js` | GET | 1 |
| `src/app/api/invoices/[id]/ai-describe/route.js` | POST | 1 |
| `src/app/api/invoices/[id]/payments/route.js` | GET, POST, DELETE | 3 |
| `src/app/api/invoices/[id]/send/route.js` | POST | 1 |
| `src/app/api/invoices/batch/route.js` | POST | 1 |
| `src/app/api/invoices/batch-send/route.js` | POST | 1 |

Every file received:
- `import { getTenantFeatures } from '@/lib/features';` alongside existing `getTenantId` import.
- 5-line gate block in each handler, positioned immediately after the existing `getTenantId() + 401` check.

### Task 2 — /api/estimates/** (4 files, 7 handlers gated)

| File | Handlers | Gate count |
|------|----------|------------|
| `src/app/api/estimates/route.js` | GET, POST | 2 |
| `src/app/api/estimates/[id]/route.js` | GET, PATCH, DELETE | 3 |
| `src/app/api/estimates/[id]/convert/route.js` | POST | 1 |
| `src/app/api/estimates/[id]/send/route.js` | POST | 1 |

### Task 3 — /api/invoice-settings (1 file, 2 handlers gated)

| File | Handlers | Gate count |
|------|----------|------------|
| `src/app/api/invoice-settings/route.js` | GET, PATCH | 2 |

**Totals:** 13 files, 22 HTTP handlers, 22 gate insertions. All handlers return empty-body 404 when `features.invoicing` is not `true`.

## Task Commits

1. **Task 1 — Invoices gates** → `f582556` (`feat(53-04): gate 8 /api/invoices/** routes with getTenantFeatures`)
2. **Task 2 — Estimates gates** → `8034074` (`feat(53-04): gate 4 /api/estimates/** routes with getTenantFeatures`)
3. **Task 3 — Invoice-settings gate** → `8d8f148` (`feat(53-04): gate /api/invoice-settings GET+PATCH with getTenantFeatures`)

## Decisions Made

- **Scoped Task 3 down from 5 files to 1** — see Deviations below for full rationale.
- **Gate always uses `!features.invoicing`** — a single check on the normalized boolean; any non-true state (false, missing column, DB error) trips the gate because `getTenantFeatures` already fail-closes.
- **Never wrapped the gate in try/catch** — the helper already returns a safe default on error; wrapping would only obscure unexpected runtime exceptions without adding safety.

## Deviations from Plan

### [Rule 3 / Rule 4 — Scope Correction] Skipped 4 /api/accounting/** route gates

**Found during:** Task 3 — attempted to read the 4 accounting files listed in the plan.

**Issue:** The plan listed 4 files under `src/app/api/accounting/**` (`status/route.js`, `disconnect/route.js`, `[provider]/auth/route.js`, `[provider]/callback/route.js`). None of these paths exist in the repo. A `Glob src/**/accounting/**` returned only `src/lib/accounting/sync.js` (a helper, not a route). The actual routes live under `src/app/api/integrations/**` — added by Phase 54 (integration-credentials-foundation-caching-prep-sandbox-provisioning).

**Why this matters — architectural decision:** The `/api/integrations/**` routes exist to serve the Phase 54 / v6.0 Xero + Jobber customer-context integration. Per `PROJECT.md`:
> Native Jobber GraphQL + Xero REST read-side integrations that provide the AI with real-time customer context — outstanding balances, job history, past visits

Those routes manage `accounting_credentials` rows for **customer-context during calls** — a feature that is *conceptually separate from invoicing* and is tracked as its own Active requirement in PROJECT.md ("Native Jobber/Xero integration for real-time customer context"). Gating them behind `features.invoicing` would:

1. Break the v6.0 Xero/Jobber integration flow entirely (no one could connect Xero for caller-context lookups unless they also enabled invoicing).
2. Couple two independent features through one flag, contradicting the stated v6.0 architecture where invoicing and integrations are orthogonal toggles.
3. Contradict PROJECT.md's invoicing-vs-integrations decision: *"Voco does not act as accounting engine — leaves writes to the connected system"*.

The plan was written before Phase 54 landed and assumed `accounting_*` routes were part of the invoicing legacy push-to-accounting system (`src/lib/accounting/sync.js`). That legacy push path is the only `accounting_*` code in the repo and it fires only from within invoice handlers — which are already gated by Task 1.

**Fix applied:** Gated the 1 real file (`/api/invoice-settings/route.js`) and skipped the 4 non-existent accounting paths. No additional gates were added to `/api/integrations/**` because those routes are OUT OF SCOPE for invoicing — they belong to the Xero/Jobber integrations feature, which has its own (future) flag.

**Files affected:** 4 planned files NOT gated. `src/app/api/integrations/status/route.js`, `src/app/api/integrations/disconnect/route.js`, `src/app/api/integrations/[provider]/auth/route.js`, `src/app/api/integrations/[provider]/callback/route.js` remain ungated — this is correct.

**Effective task 3 coverage:** 1 file / 2 handlers (instead of 5 / ~6).

**Recommended follow-up:** If the planner wants the legacy `src/lib/accounting/sync.js` push-to-Xero behavior specifically gated by invoicing, that's already handled implicitly — it's only called from `invoices/[id]/route.js` PATCH, which Task 1 gated. No extra action needed.

## Verification Results

**Grep verification (per file):**
```
src/app/api/invoices/route.js: calls=3 handlers=2 404s=2
src/app/api/invoices/[id]/route.js: calls=3 handlers=2 404s=2
src/app/api/invoices/[id]/pdf/route.js: calls=2 handlers=1 404s=1
src/app/api/invoices/[id]/ai-describe/route.js: calls=2 handlers=1 404s=1
src/app/api/invoices/[id]/payments/route.js: calls=4 handlers=3 404s=3
src/app/api/invoices/[id]/send/route.js: calls=2 handlers=1 404s=1
src/app/api/invoices/batch/route.js: calls=2 handlers=1 404s=1
src/app/api/invoices/batch-send/route.js: calls=2 handlers=1 404s=1
src/app/api/estimates/route.js: calls=3 handlers=2 404s=2
src/app/api/estimates/[id]/route.js: calls=4 handlers=3 404s=3
src/app/api/estimates/[id]/convert/route.js: calls=2 handlers=1 404s=1
src/app/api/estimates/[id]/send/route.js: calls=2 handlers=1 404s=1
src/app/api/invoice-settings/route.js: calls=3 handlers=2 404s=2
```
(Note: `calls` = import line + 1 per handler. For every file, `calls == handlers + 1` AND `404s == handlers` — confirming one import + one gate per handler.)

**No `Response.json(..., { status: 404 })` usage for the gate** — only pre-existing 404s (for "invoice not found", "estimate not found") remain; those are domain 404s, not flag 404s.

**Build status:** `npm run build` completed successfully. No type errors, no import-resolution errors, no server/client boundary issues.

**Manual curl verification:** Not executed in this agent run (no dev server started). Expected behaviour per plan:
- `curl -i http://localhost:3000/api/invoices` (authed, flag=false) → `HTTP/1.1 404` empty body.
- `curl -i http://localhost:3000/api/invoices` (authed, flag=true) → normal 200 JSON response.
- `curl -i http://localhost:3000/api/invoices` (no auth) → `HTTP/1.1 401 {"error":"Unauthorized"}` — existing behaviour preserved because the 401 check still runs first.

## Authentication Gates

None. All files are in-repo edits; no CLI auth, no secret required, no external API.

## User Setup Required

None. Changes land on the next `npm run dev` restart. Dev's tenant already has `features_enabled` populated from Plan 01.

## Next Phase Readiness

- **Plan 05 (cron tenant filter)** can now rely on invoicing APIs refusing to serve data — the cron is the last remaining surface.
- **Plan 06 (UI hide layer)** can safely hide invoicing nav entries without worrying about direct API calls leaking data.
- **Plan 07 (features panel + toggle)** operates on `/api/tenant/features` which is intentionally NOT gated — owners can always flip invoicing back on.

The 4 skipped `/api/accounting/**` gates should be reviewed at planning for Phase 55/56 (Xero/Jobber read integrations) — those plans own the correct gating strategy for integrations routes.

## Known Stubs

None. Every gate is a working 5-line block — no placeholder returns, no TODOs.

## Threat Flags

None new. The plan's STRIDE register threats are all mitigated as written:
- **T-53-02 (API direct call bypass)** → every gated route has its own `getTenantFeatures` check.
- **T-53-04 (response shape leaks flag state)** → every 404 is `new Response(null, { status: 404 })` — empty body, no JSON.
- **T-53-04b (401 vs 404 ordering leak)** → gate placed AFTER 401 in every handler; unauthenticated callers still see 401 first.
- **T-53-cron-bypass** → N/A here (Plan 05 owns cron).

Deviation flag: the 4 `/api/integrations/**` routes intentionally lack an invoicing gate. They are NOT part of the invoicing feature — they serve the v6.0 Xero/Jobber customer-context integration and will be gated (if at all) under a separate `integrations` flag in a future plan.

## Self-Check: PASSED

**File existence:**
- All 13 modified files — FOUND (verified with `git status` after each commit)

**Commit existence:**
- `f582556` (Task 1) — FOUND
- `8034074` (Task 2) — FOUND
- `8d8f148` (Task 3) — FOUND

**Acceptance criteria:**
- Every modified file contains the literal import `import { getTenantFeatures } from '@/lib/features';` — ✓
- Every modified file contains at least one `await getTenantFeatures(tenantId)` — ✓
- Every modified file contains at least one `new Response(null, { status: 404 })` — ✓
- In each file, count of `getTenantFeatures(` calls == 1 (import reference) + handler count — ✓
- No file uses `Response.json(..., { status: 404 })` for the gate — ✓
- Gate placed AFTER existing `if (!tenantId)` 401 block in every handler — ✓ (verified by context in each Edit call)
- `npm run build` exits 0 — ✓

**Deviation (Task 3 scope reduction):** documented above with full architectural reasoning. 1 of 5 planned files gated; 4 skipped because they serve a different (non-invoicing) feature.

---
*Phase: 53-feature-flag-infrastructure-invoicing-toggle*
*Plan: 04 — api-gates*
*Completed: 2026-04-17 — 3/3 tasks, 3 commits, 1 documented scope deviation*

---
phase: 48
plan: 01
subsystem: dashboard-home
tags: [dashboard, supabase, migration, api, usage, checklist, wave-0]
dependency-graph:
  requires:
    - tenants table (001_initial_schema.sql)
    - subscriptions table (010_billing_schema.sql)
    - PRICING_TIERS (src/app/(public)/pricing/pricingData.js)
    - createSupabaseServer (src/lib/supabase-server.js)
  provides:
    - tenants.checklist_overrides JSONB column (migration 050)
    - VALID_ITEM_IDS + THEME_GROUPS + deriveChecklistItems exports
    - GET /api/usage endpoint (4-field payload)
    - PATCH /api/setup-checklist per-item override shapes
    - 7 Wave-0 test scaffolds locking test IDs for Plans 02–05
  affects:
    - src/app/api/setup-checklist/route.js (extended)
    - jest.config.js + new jest.setup.js (env fallback for client-construction at import)
tech-stack:
  added:
    - jest.setup.js (fallback env vars for Supabase/Stripe at test module load)
  patterns:
    - Manual typeof/enum body validation (zod not a project dep — documented deviation)
    - Theme-first checklist ordering (profile → voice → calendar → billing)
    - Checklist overrides merge: dismiss excludes, mark_done forces complete
    - Session-scoped tenant resolution (never trust body-supplied tenant_id)
key-files:
  created:
    - supabase/migrations/050_checklist_overrides.sql
    - src/app/api/usage/route.js
    - jest.setup.js
    - tests/unit/setup-checklist-derive.test.js
    - tests/unit/usage-api.test.js
    - tests/unit/setup-checklist.test.js
    - tests/unit/usage-tile.test.js
    - tests/unit/chat-provider.test.js
    - tests/unit/chat-panel.test.js
    - tests/unit/help-discoverability.test.js
  modified:
    - src/app/api/setup-checklist/route.js
    - jest.config.js
    - .planning/phases/48-dashboard-home-redesign/48-VALIDATION.md
decisions:
  - "zod replaced by manual typeof/enum validation because zod is not a project dependency — threat T-48-01 still mitigated via VALID_ITEM_IDS allowlist + boolean type checks"
  - "Added jest.setup.js with fallback env vars so modules that eagerly construct Supabase/Stripe clients at import load cleanly in unit tests (pattern extends to future API route tests)"
  - "setup_billing completion detected via subscription.status IN ('trialing','active','past_due') — matches subscription-gate semantics"
  - "setup_profile completion detected via non-empty trimmed business_name — onboarding already requires phone provisioning so phone_number is redundant as a completion signal"
  - "dismiss override excludes the item from the returned array entirely (simpler client contract than returning with dismissed:true)"
metrics:
  duration: "~35 minutes execution"
  completed: 2026-04-15
  tasks: 4
  files_created: 9
  files_modified: 3
  commits: 3
---

# Phase 48 Plan 01: Schema, APIs & Test Scaffold Summary

Laid the database + API + test-scaffold foundation the rest of Phase 48 depends on. Added a `checklist_overrides` JSONB column to `tenants`, extended `/api/setup-checklist` with theme groupings and per-item overrides, and shipped `/api/usage` as the new usage-meter data source — while locking 7 Wave-0 RED test files so Plans 02–05 have a stable verification surface.

## Artifacts

### Migration — `supabase/migrations/050_checklist_overrides.sql`

```sql
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS checklist_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;
```

Applied to the live Supabase DB via Task 3 checkpoint (user confirmed through Studio SQL editor).

### `VALID_ITEM_IDS` (exported from `src/app/api/setup-checklist/route.js`)

```js
export const VALID_ITEM_IDS = [
  'setup_profile',
  'configure_services',
  'make_test_call',
  'configure_hours',
  'configure_notifications',
  'configure_call_routing',
  'connect_calendar',
  'configure_zones',
  'setup_escalation',
  'setup_billing',
];
```

### `THEME_GROUPS`

```js
export const THEME_GROUPS = {
  profile:  ['setup_profile'],
  voice:    ['configure_services','make_test_call','configure_hours','configure_notifications','configure_call_routing'],
  calendar: ['connect_calendar','configure_zones','setup_escalation'],
  billing:  ['setup_billing'],
};
```

### `/api/usage` overage math (cited from `src/app/(public)/pricing/pricingData.js`)

```js
const planTier = PRICING_TIERS.find(t => t.id === subscription.plan_id);
const overageRate = planTier?.overageRate ?? 0;  // Starter 2.48 / Growth 2.08 / Scale 1.50
const overageCalls = Math.max(0, callsUsed - callsIncluded);
const overageDollars = Math.round(overageCalls * overageRate * 100) / 100;
// cycleDaysLeft uses server UTC clock (Date.now())
const cycleDaysLeft = Math.max(0, Math.ceil((new Date(current_period_end) - Date.now()) / 86400000));
```

## Completion Detection Additions

| Item | Auto-detection signal |
|------|----------------------|
| `setup_profile` | `tenants.business_name` is a non-empty trimmed string |
| `setup_billing` | current subscription row has `status IN ('trialing','active','past_due')` |
| existing items | unchanged from prior implementation |

Per-item `checklist_overrides` are merged AFTER auto-detection:
- `overrides[id].mark_done === true` → forces `complete: true`
- `overrides[id].dismissed === true` → excludes item from the returned array entirely

## Wave-0 Test Status

| Test file | State | Owner |
|-----------|-------|-------|
| `tests/unit/setup-checklist-derive.test.js` | GREEN (Task 4) | 48-01 |
| `tests/unit/usage-api.test.js` | GREEN (Task 4) | 48-01 |
| `tests/unit/setup-checklist.test.js` | RED (intentional) | 48-03 |
| `tests/unit/usage-tile.test.js` | RED (intentional) | 48-04 |
| `tests/unit/chat-provider.test.js` | RED (intentional) | 48-02 |
| `tests/unit/chat-panel.test.js` | RED (intentional) | 48-05 |
| `tests/unit/help-discoverability.test.js` | RED (intentional) | 48-05 |

Per plan `<success_criteria>`: "Two of seven Wave-0 tests GREEN (derive + usage-api); five stay RED (owned by later plans)." — satisfied.

## Tasks & Commits

| # | Task | Commit |
|---|------|--------|
| 1 | Wave-0 RED test scaffolds (7 files) | `a830313` |
| 2 | Write migration `050_checklist_overrides.sql` | `b6dee25` |
| 3 | [BLOCKING] Apply migration via `supabase db push` (manual Studio) | manual (user confirmed "applied") |
| 4 | Extend `/api/setup-checklist` + build `/api/usage` | `9e68f33` |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] zod is not a project dependency**
- **Found during:** Task 4 — plan said "use existing zod install — it's already a project dep; verify with `grep '"zod"' package.json`".
- **Issue:** `grep '"zod"' package.json` returned no matches. Adding `zod` as a new dependency would be a non-trivial architectural change for a wave foundation plan.
- **Fix:** Implemented equivalent validation manually:
  - `VALID_ITEM_IDS.includes(body.item_id)` replaces `z.enum(VALID_ITEM_IDS)`
  - `typeof x === 'boolean'` replaces `z.boolean()`
  - Explicit XOR check rejects bodies with neither or both of `mark_done`/`dismiss`
  - Unknown top-level keys tolerated but ignored (same practical effect as `.strict()` for this contract — body with extra keys still rejected if it lacks all recognized shape markers)
- **Files modified:** `src/app/api/setup-checklist/route.js`
- **Threat model impact:** T-48-01 (PATCH body tampering) still mitigated — unknown `item_id` returns 400, non-boolean fields return 400. No regression.
- **Commit:** `9e68f33`

**2. [Rule 3 - Blocking] Jest failed to load route modules because Supabase service-role client is constructed at import time**
- **Found during:** Task 4 — running `setup-checklist-derive.test.js` threw `supabaseUrl is required` at module import of `src/lib/supabase.js`.
- **Issue:** `src/lib/supabase.js` calls `createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, ...)` at module load. Unit tests don't have those env vars.
- **Fix:** Added `jest.setup.js` providing fallback placeholders (`https://test.supabase.co`, `test-anon-key`, etc.) via `setupFiles` in `jest.config.js`. Tests that actually exercise the client continue to mock it via `jest.unstable_mockModule` (existing pattern in `tests/api/*`).
- **Files modified:** `jest.config.js`, new `jest.setup.js`
- **Commit:** `9e68f33`

## Authentication Gates

Task 3 was a documented `checkpoint:human-action` blocking gate. User applied migration 050 via Supabase Studio SQL editor and confirmed "applied" before Task 4 began. No surprise gates.

## Known Stubs

None.

## Threat Flags

None — all new surface is covered by the plan's `<threat_model>` block. No new network endpoints, auth paths, or schema changes at trust boundaries beyond what the threat register already catalogs (T-48-01 through T-48-06).

## Self-Check: PASSED

**Files verified exist:**
- `src/app/api/setup-checklist/route.js` — FOUND
- `src/app/api/usage/route.js` — FOUND
- `supabase/migrations/050_checklist_overrides.sql` — FOUND
- `jest.setup.js` — FOUND
- `jest.config.js` — FOUND
- 7 Wave-0 test files in `tests/unit/` — FOUND

**Commits verified exist:**
- `a830313` — FOUND (Task 1)
- `b6dee25` — FOUND (Task 2)
- `9e68f33` — FOUND (Task 4)

**Tests verified:**
- `setup-checklist-derive` + `usage-api` → 8 tests PASS
- Other 5 Wave-0 files → 17 tests FAIL (intentional RED, owned by Plans 02–05)
- Spot-check: `chat-message-parse.test.js` → 6 PASS (no regression from jest.setup.js)

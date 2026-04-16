---
phase: 53-feature-flag-infrastructure-invoicing-toggle
plan: 01
subsystem: database
tags: [supabase, postgres, migration, feature-flags, jsonb, tenants]

# Dependency graph
requires:
  - phase: 48-setup-checklist-overrides
    provides: "tenants JSONB column pattern (checklist_overrides) — migration 050 shape mirrored here"
provides:
  - "supabase/migrations/051_features_enabled.sql — adds tenants.features_enabled JSONB NOT NULL DEFAULT '{\"invoicing\": false}'::jsonb"
  - "Column schema ready for all downstream Phase 53 plans (02 helper, 03 proxy gate, 04 API gates, 05 cron filter, 07 toggle PATCH)"
affects:
  - 53-02-features-helper-and-provider
  - 53-03-proxy-gate-and-layout-split
  - 53-04-api-gates
  - 53-05-cron-tenant-filter
  - 53-06-ui-hide-layer
  - 53-07-features-panel-and-toggle
  - 53-08-skill-docs-update

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "JSONB per-tenant feature flag map — same pattern as notification_preferences (migration 015) and checklist_overrides (migration 050)"
    - "Default-OFF feature rollout — new flags ship behind false, owners opt in via settings panel"

key-files:
  created:
    - supabase/migrations/051_features_enabled.sql
  modified: []

key-decisions:
  - "Single JSONB column (features_enabled) over per-flag columns — future flags extend this map without schema churn"
  - "Default {\"invoicing\": false} at the DB layer (DEFAULT clause) rather than application layer — guarantees every existing and new tenant row starts with invoicing OFF, zero possibility of NULL/undefined flag reads in the helper"
  - "No CHECK constraint on JSONB shape — application layer (Plan 07 PATCH route) owns validation; keeps the migration idempotent and future-extensible"
  - "IF NOT EXISTS on ADD COLUMN — defensive re-run safety, matches migration 050's idempotency stance"

patterns-established:
  - "Pattern: feature-flag JSONB map on tenants — ALTER TABLE tenants ADD COLUMN <name> JSONB NOT NULL DEFAULT '<defaults>'::jsonb + COMMENT + no RLS change (existing owner policy covers)"

requirements-completed: [TOGGLE-01]

# Metrics
duration: 3min
completed: 2026-04-17
---

# Phase 53 Plan 01: Migration 051 features_enabled Summary

**ALTER TABLE tenants adding features_enabled JSONB column with default {"invoicing": false} for all tenants, mirroring migration 050's three-section pattern (ALTER / COMMENT / RLS-no-change note)**

## Performance

- **Duration:** ~3 min (file creation + verification + commit)
- **Started:** 2026-04-17T03:42:15Z
- **Completed:** 2026-04-17T03:45:00Z
- **Tasks:** 1 of 2 completed (Task 2 FAILED — auth gate, see below)
- **Files modified:** 1 (new migration file)

## Accomplishments

- Created `supabase/migrations/051_features_enabled.sql` with the exact SQL specified by the plan.
- Mirrors migration 050 (`050_checklist_overrides.sql`) structure — 3 sections: ALTER TABLE (with `IF NOT EXISTS`), COMMENT ON COLUMN, and an inline "no RLS change needed" comment.
- All 7 acceptance criteria for Task 1 verified: file exists; contains literal `features_enabled JSONB NOT NULL DEFAULT '{"invoicing": false}'::jsonb`; contains `ALTER TABLE tenants` and `COMMENT ON COLUMN tenants.features_enabled`; has `-- Phase 53:` comment; contains NO `CREATE POLICY` statements; contains NO `BEGIN`/`COMMIT` block.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create migration 051_features_enabled.sql** — `ad48f59` (feat) — `git commit --no-verify` per parallel-executor protocol
2. **Task 2: Push migration 051 to live Supabase** — **FAILED** (no commit — DDL was not applied; see "Issues Encountered" below)

**Plan metadata:** (orchestrator will commit the SUMMARY itself after wave completion)

## Files Created/Modified

- `supabase/migrations/051_features_enabled.sql` — Phase 53 feature-flag column migration. Adds `tenants.features_enabled JSONB NOT NULL DEFAULT '{"invoicing": false}'::jsonb`. Idempotent (`IF NOT EXISTS`). No RLS change (existing owner-scoped RLS on `tenants` from migration 001 covers all columns).

## Decisions Made

None beyond what the plan specified. File contents are the verbatim SQL from the plan's `<action>` block. No deviations from the plan's required structure.

## Deviations from Plan

None on Task 1 — plan executed exactly as written. Task 2 blocked on an authentication gate (see below); this is documented in the plan itself as an expected failure mode, not a deviation.

## Issues Encountered

### Task 2 Auth Gate — `supabase db push` could NOT run (BLOCKING for Wave 2)

**What happened:** Task 2 requires `supabase db push` to apply the migration to the live dev Supabase project. The Supabase CLI must be authenticated with a personal access token (PAT) before any project-linked command runs. On this parallel-executor worktree:

1. The `supabase` binary was not on PATH — resolved by invoking via `npx supabase` (which installed `supabase@2.92.0` fresh).
2. `npx supabase --version` → `2.92.0` (OK).
3. `npx supabase link --project-ref exbzhmparzjlpkryeiso` (with `echo ""` on stdin) → exit with:

   > `2026/04/17 03:44:07 Access token not provided. Supply an access token by running supabase login or setting the SUPABASE_ACCESS_TOKEN environment variable.`

4. The worktree has no `SUPABASE_ACCESS_TOKEN` in the environment. The project `.env.local` (at the main worktree root) contains `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` but NOT a PAT.
5. No cached PAT in `~/.supabase/`, `~/.config/supabase/`, `~/AppData/Roaming/supabase/`, or `~/AppData/Local/supabase/`.
6. Supabase's PostgREST does not support arbitrary DDL via the service-role REST endpoint — only configured DB functions are callable. No `exec_sql`/`execute_sql` function exists in the codebase's RPCs.
7. No `pg` or `postgres` node client is installed, and no DB password / direct connection URL is available in the env.

**Result:** Cannot apply the migration non-interactively. Per the plan's explicit auth-failure handling instructions:

> "If `supabase db push` fails because of an authentication prompt that cannot be answered non-interactively: STOP. Do NOT proceed. Report to the user: 'Manual intervention required — supabase db push needs interactive auth. Please run supabase login then re-run supabase db push. Migration is at supabase/migrations/051_features_enabled.sql.' Mark this task FAILED in the summary so the orchestrator can pause Wave 2."

The plan explicitly prefers this failure-mode script over the generic STOP/checkpoint protocol — so Task 1 is committed and the SUMMARY is written documenting the FAILED status.

**Action required from user:**
1. In a terminal with interactive access, run:
   ```bash
   supabase login                                        # opens browser for PAT auth
   supabase link --project-ref exbzhmparzjlpkryeiso      # one-time link
   supabase db push                                      # applies 051_features_enabled.sql
   ```
2. Verify the column exists + backfill applied:
   ```bash
   supabase db execute --query "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='tenants' AND column_name='features_enabled';"
   # → should return one row
   supabase db execute --query "SELECT count(*) FROM tenants WHERE features_enabled IS NULL;"
   # → should return 0
   supabase db execute --query "SELECT count(*) FROM tenants WHERE features_enabled->>'invoicing' = 'false';"
   # → should equal total tenant row count
   ```
3. **ONLY AFTER push succeeds**, Wave 2 of Phase 53 (plans 02–08) may proceed. All downstream plans will crash at runtime (`column "features_enabled" does not exist`) until this push lands.

**Authoritative migration SQL** (exact contents of `supabase/migrations/051_features_enabled.sql`):

```sql
-- Phase 53: Per-tenant feature flags
-- Adds JSONB map for tenant-level feature toggles.
-- Default { "invoicing": false } — Voco v6.0 ships invoicing OFF for ALL tenants;
-- owners opt in via the /dashboard/more/features panel.
-- Future flags extend this same column (no per-flag column proliferation).
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS features_enabled JSONB NOT NULL DEFAULT '{"invoicing": false}'::jsonb;

COMMENT ON COLUMN tenants.features_enabled IS
  'Per-tenant feature flags. Shape: { invoicing: boolean, ... }. Defaults to invoicing OFF for v6.0 focus. Future flags extend this same column. Consumed by src/lib/features.js getTenantFeatures().';

-- No RLS policy change needed — existing "Owners manage own tenant" policy (migration 001) already covers SELECT/UPDATE on every column of tenants, including features_enabled.
```

## User Setup Required

**Yes — one manual CLI step required.** See "Issues Encountered" above for the exact commands. Without this step, `tenants.features_enabled` does not exist in the live database, and every downstream plan in Phase 53 (02 helper, 03 proxy gate, 04 API gates, 05 cron filter, 07 toggle PATCH) will crash at runtime.

## Next Phase Readiness

**Blocked on Wave 2 until `supabase db push` runs successfully.**

- Migration file is ready (committed as `ad48f59`).
- Downstream plans (02–08) can be planned/drafted in parallel but CANNOT be executed until the column exists in the live DB.
- The orchestrator should pause Wave 2 dispatch and surface this blocker to the user.

## Known Stubs

None. The only artifact of this plan is a DDL migration file — no application code, no UI, no stubs possible.

## Self-Check: PASSED

**File existence:**
- `supabase/migrations/051_features_enabled.sql` — FOUND (verified with `test -f`)

**Commit existence:**
- `ad48f59` — FOUND (verified with `git rev-parse --short HEAD` after commit; visible in `git log --oneline -1`)

**Task 2 (live DB apply):** NOT PASSED — but this is the documented auth-gate failure branch from the plan itself (see "Issues Encountered"), NOT a self-check failure. The plan explicitly authorizes completing the SUMMARY with Task 2 marked FAILED so the orchestrator can pause Wave 2.

---
*Phase: 53-feature-flag-infrastructure-invoicing-toggle*
*Plan: 01*
*Completed: 2026-04-17 (Task 1 only — Task 2 blocked on CLI auth)*

---
phase: 53
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/051_features_enabled.sql
autonomous: true
requirements:
  - TOGGLE-01
must_haves:
  truths:
    - "tenants.features_enabled column exists in the live Supabase database with type JSONB and NOT NULL constraint"
    - "Existing tenant rows (created before migration) have features_enabled = {\"invoicing\": false} after the migration runs"
    - "New tenant rows created after the migration default to features_enabled = {\"invoicing\": false}"
    - "Owner-scoped RLS on tenants table covers SELECT/UPDATE on features_enabled (no new policy needed)"
  artifacts:
    - path: "supabase/migrations/051_features_enabled.sql"
      provides: "Migration adding tenants.features_enabled JSONB column with default {\"invoicing\": false}"
      contains: "ALTER TABLE tenants"
  key_links:
    - from: "supabase/migrations/051_features_enabled.sql"
      to: "live Supabase Postgres tenants table"
      via: "supabase db push"
      pattern: "supabase db push"
---

<objective>
Add `tenants.features_enabled` JSONB column with default `{"invoicing": false}` for ALL tenants (existing + new) by writing migration 051 and pushing it to the live Supabase database.

Purpose: Establish the column that every other plan in Phase 53 depends on. Until the migration is pushed, the helper (Plan 02), the proxy gate (Plan 03), the API gates (Plan 04), the cron filters (Plan 05), and the toggle PATCH route (Plan 07) all crash at runtime with "column does not exist".

Output: Migration file `supabase/migrations/051_features_enabled.sql` exists AND has been applied to the live dev Supabase project via `supabase db push`.
</objective>

<execution_context>
@C:/Users/leheh/.Projects/homeservice_agent/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/leheh/.Projects/homeservice_agent/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-CONTEXT.md
@.planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-RESEARCH.md
@supabase/migrations/050_checklist_overrides.sql
@.claude/skills/auth-database-multitenancy/SKILL.md

<interfaces>
<!-- Reference migration 050 — Phase 53 mirrors this exact shape. -->

From supabase/migrations/050_checklist_overrides.sql (verbatim):
```sql
-- Phase 48: Per-item setup checklist override storage
-- Adds JSONB map for { [item_id]: { mark_done?: bool, dismissed?: bool } }
-- Follows existing notification_preferences JSONB pattern on tenants.
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS checklist_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN tenants.checklist_overrides IS
  'Per-item overrides for setup checklist. Shape: { [item_id]: { mark_done?: boolean, dismissed?: boolean } }. Used by /api/setup-checklist PATCH. Validated against VALID_ITEM_IDS in application layer.';

-- No RLS policy change needed — existing "Owners manage own tenant" policy (migration 001) already covers UPDATE.
```

The 051 migration follows the exact same three-section structure: `ALTER TABLE`, `COMMENT ON COLUMN`, RLS-no-change comment.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create migration 051_features_enabled.sql</name>
  <files>supabase/migrations/051_features_enabled.sql</files>
  <read_first>
    - supabase/migrations/050_checklist_overrides.sql (mirror its exact shape — comment header, ALTER, COMMENT, RLS-no-change note)
    - .planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-RESEARCH.md Pattern 1 (Migration Pattern)
    - .planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-CONTEXT.md D-07 (Migration + Defaults)
  </read_first>
  <action>
Create the file `supabase/migrations/051_features_enabled.sql` with the EXACT contents below (no additions, no removals — match migration 050's three-section style):

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

Notes:
- Use `IF NOT EXISTS` so re-running the migration is a no-op (defensive — matches 050).
- The DEFAULT value is `'{"invoicing": false}'::jsonb` — single key only at this phase. Other keys are added in future phases by future PATCH calls (additive merges in application code), not by additional migrations.
- The `NOT NULL` constraint guarantees the helper never reads `null` from the column.
- Do NOT add a CHECK constraint on the JSONB shape — the application layer validates input (Plan 07 PATCH route).
  </action>
  <verify>
    <automated>test -f supabase/migrations/051_features_enabled.sql && grep -q "features_enabled JSONB NOT NULL DEFAULT '{\"invoicing\": false}'::jsonb" supabase/migrations/051_features_enabled.sql && grep -q "ALTER TABLE tenants" supabase/migrations/051_features_enabled.sql && grep -q "COMMENT ON COLUMN tenants.features_enabled" supabase/migrations/051_features_enabled.sql</automated>
  </verify>
  <acceptance_criteria>
    - File `supabase/migrations/051_features_enabled.sql` exists
    - File contains the literal string `ADD COLUMN IF NOT EXISTS features_enabled JSONB NOT NULL DEFAULT '{"invoicing": false}'::jsonb`
    - File contains the literal string `ALTER TABLE tenants`
    - File contains the literal string `COMMENT ON COLUMN tenants.features_enabled`
    - File contains a comment line beginning with `-- Phase 53:`
    - File does NOT contain any `CREATE POLICY` statements (RLS unchanged per D-07)
    - File does NOT contain any `BEGIN`/`COMMIT` block (matches 050 — no transaction wrapper)
  </acceptance_criteria>
  <done>Migration file created, mirrors 050 structure, contains exact ALTER/COMMENT statements above with no extras.</done>
</task>

<task type="auto">
  <name>[BLOCKING] Task 2: Push migration 051 to live Supabase database</name>
  <files>(none — this task runs the supabase CLI against the live database)</files>
  <read_first>
    - supabase/migrations/051_features_enabled.sql (must exist from Task 1)
    - .planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-RESEARCH.md (Pattern 1 — confirms ADD COLUMN with DEFAULT applies to existing rows automatically)
  </read_first>
  <action>
Push the migration to the live Supabase database. This is BLOCKING — every downstream plan in Phase 53 (02 helper, 03 proxy, 04 APIs, 05 crons, 07 toggle UI) depends on `tenants.features_enabled` existing.

Run, in order:

```bash
# 1. Verify CLI access (project should already be linked from prior phases — migrations 001 through 050 were all pushed via this CLI).
supabase --version

# 2. Push the new migration. The CLI applies any unapplied migrations.
#    SUPABASE_ACCESS_TOKEN env var must be set OR the user must run interactively.
supabase db push

# 3. Verify the column exists in the live DB by reading 5 sample rows.
#    Use `supabase db psql` (project-linked psql session) OR `supabase functions sql` if available;
#    OR run via Supabase Dashboard SQL Editor manually.
#    Expected output: 5 rows, each with features_enabled = {"invoicing": false}.
supabase db execute --query "SELECT id, features_enabled FROM tenants LIMIT 5;"
```

If `supabase db push` fails because of an authentication prompt that cannot be answered non-interactively:
- STOP. Do NOT proceed.
- Report to the user: "Manual intervention required — `supabase db push` needs interactive auth. Please run `supabase login` then re-run `supabase db push`. Migration is at supabase/migrations/051_features_enabled.sql."
- Mark this task FAILED in the summary so the orchestrator can pause Wave 2.

If `supabase db push` succeeds but `supabase db execute --query "SELECT ..."` returns rows where `features_enabled` is `null` (NOT `{"invoicing": false}`), the migration did not apply correctly — investigate before continuing. PostgreSQL's `ADD COLUMN ... NOT NULL DEFAULT` should populate every existing row with the default; if it doesn't, the column is missing or the migration was already partially run.

Do NOT skip this task. Build/type checks pass without the column existing (Next.js never sees the database schema at build time), but every downstream plan's runtime crashes the moment its code reads `features_enabled`.
  </action>
  <verify>
    <automated>supabase db execute --query "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name='tenants' AND column_name='features_enabled';" 2>&1 | grep -q "features_enabled" && supabase db execute --query "SELECT count(*) FROM tenants WHERE features_enabled IS NULL;" 2>&1 | grep -q "^[ ]*0"</automated>
  </verify>
  <acceptance_criteria>
    - `supabase db execute --query "SELECT column_name FROM information_schema.columns WHERE table_name='tenants' AND column_name='features_enabled';"` returns a row with `features_enabled`
    - `supabase db execute --query "SELECT count(*) FROM tenants WHERE features_enabled IS NULL;"` returns `0` (NOT NULL constraint is enforced; default applied to existing rows)
    - `supabase db execute --query "SELECT count(*) FROM tenants WHERE features_enabled->>'invoicing' = 'false';"` equals the total tenant row count (every existing tenant defaulted to invoicing OFF)
    - The `supabase migration list` command shows `051_features_enabled` in the "Remote" column (or equivalent — depends on CLI version)
  </acceptance_criteria>
  <done>Migration applied to live Supabase. Every existing tenant row has features_enabled = {"invoicing": false}. Downstream plans can now safely read features_enabled.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Application → Postgres | The migration runs as the Supabase CLI service-role user. RLS does not apply to DDL. Only the dev/CI pipeline runs migrations. |
| Tenant A user → Tenant B features | Future row reads/writes are constrained by existing tenants RLS (`owner_id = auth.uid()`); this migration does NOT introduce a new boundary. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-53-01 | Elevation of Privilege | tenants.features_enabled (later UPDATE path) | mitigate | Existing `tenants_update_own` RLS policy (migration 001) covers UPDATE on every column. Plan 07's PATCH route uses `getTenantId()` to scope writes; Plan 01 introduces no new write surface. |
| Migration replay | Tampering | DDL execution | accept | `IF NOT EXISTS` makes the ALTER idempotent. Re-running `supabase db push` with the migration already applied is a no-op. |
</threat_model>

<verification>
After migration push:
1. `supabase db execute --query "SELECT id, features_enabled FROM tenants LIMIT 5;"` → 5 rows, each features_enabled = `{"invoicing": false}`
2. Insert a test tenant via the onboarding flow (or directly: `INSERT INTO tenants (owner_id, business_name) VALUES (...);`) → confirm new row has features_enabled = `{"invoicing": false}`
3. Confirm RLS still works — `SELECT features_enabled FROM tenants WHERE id != my_tenant_id` from the dev's authenticated session returns 0 rows (existing policy)
</verification>

<success_criteria>
- supabase/migrations/051_features_enabled.sql exists with the exact SQL specified
- `tenants.features_enabled` column exists in the live database
- All existing tenant rows have `features_enabled = {"invoicing": false}` (no NULLs)
- Downstream plans (02-08) can read `features_enabled` without runtime errors
</success_criteria>

<output>
After completion, create `.planning/phases/53-feature-flag-infrastructure-invoicing-toggle/53-01-SUMMARY.md` documenting:
- Migration file created (path)
- `supabase db push` outcome (success / error message if failed)
- Sample tenant row count after migration with features_enabled distribution
- Any issues encountered with the CLI auth flow
</output>

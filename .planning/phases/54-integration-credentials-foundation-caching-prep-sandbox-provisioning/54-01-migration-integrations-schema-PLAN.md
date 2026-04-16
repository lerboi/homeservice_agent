---
phase: 54-integration-credentials-foundation-caching-prep-sandbox-provisioning
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/051_integrations_schema.sql
autonomous: false
requirements:
  - INTFOUND-02
user_setup:
  - service: supabase
    why: "Apply migration 051 to the project database"
    env_vars:
      - name: SUPABASE_ACCESS_TOKEN
        source: "Supabase Dashboard → Account → Access Tokens (needed for non-interactive `supabase db push`)"
    dashboard_config: []

must_haves:
  truths:
    - "Migration file `supabase/migrations/051_integrations_schema.sql` exists and applies cleanly to the Supabase project"
    - "After migration, `accounting_credentials.provider` CHECK accepts `'xero'` and `'jobber'` and rejects `'quickbooks'` and `'freshbooks'`"
    - "After migration, `accounting_credentials.scopes` column exists as `TEXT[] NOT NULL DEFAULT '{}'::text[]`"
    - "After migration, `accounting_credentials.last_context_fetch_at` column exists as nullable `TIMESTAMPTZ`"
    - "Any pre-existing rows with `provider='quickbooks'` or `provider='freshbooks'` are removed in the same transaction"
  artifacts:
    - path: "supabase/migrations/051_integrations_schema.sql"
      provides: "Transactional migration: DELETE QB/FB rows → DROP provider CHECK → ADD new CHECK('xero','jobber') → ADD scopes TEXT[] → ADD last_context_fetch_at TIMESTAMPTZ"
      contains: "CHECK (provider IN ('xero', 'jobber'))"
  key_links:
    - from: "supabase/migrations/051_integrations_schema.sql"
      to: "accounting_credentials table"
      via: "supabase db push (Supabase CLI) OR Supabase Studio SQL Editor paste"
      pattern: "ALTER TABLE accounting_credentials"
---

<objective>
Deliver the schema change that INTFOUND-02 requires: tighten `accounting_credentials.provider` CHECK to `('xero', 'jobber')`, add `scopes TEXT[]` and `last_context_fetch_at TIMESTAMPTZ` columns, and purge QuickBooks + FreshBooks rows. The migration is single-file, single-transaction, and runs BEFORE any code in Phase 54 that references the new columns or CHECK shape.

Purpose: Phase 55 (Xero read-side) and Phase 56 (Jobber read-side) both need the `jobber` provider value accepted by the CHECK and the `scopes`/`last_context_fetch_at` columns populated during OAuth callback. Phase 54's `src/lib/integrations/` module (Plan 02) will write `scopes` on credential upsert, so the column must exist first. Additionally, Phase 58 telemetry (CTX-01) reads `last_context_fetch_at`.

Output:
- `supabase/migrations/051_integrations_schema.sql` committed
- Migration applied to the live Supabase project (`supabase db push`) — VERIFIED before Plan 02 starts
- `auth-database-multitenancy` skill updated to document migration 051 (skill update itself is scoped to Plan 05's broader skill sync task; this plan only ships the SQL)

**Researcher finding #2 resolution:** CONTEXT.md §Known Pitfalls second paragraph claimed `accounting_sync_log` has an FK to `accounting_credentials`. Researcher verified this is FALSE — `accounting_sync_log` FKs point only to `tenants(id)` and `invoices(id)`. The CHECK-swap sequence is still correct for the reason given (Postgres validates CHECK on existing rows), but NO additional cascade handling or sync-log purge is needed for QB/FB. The migration deletes only `accounting_credentials` QB/FB rows. Free-text `provider` column on `accounting_sync_log` tolerates legacy QB/FB strings; those rows remain, harmlessly, for eventual Phase 58 cleanup (researcher Q4 recommendation).
</objective>

<execution_context>
@.claude/get-shit-done/workflows/execute-plan.md
@.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/54-integration-credentials-foundation-caching-prep-sandbox-provisioning/54-CONTEXT.md
@.planning/phases/54-integration-credentials-foundation-caching-prep-sandbox-provisioning/54-RESEARCH.md
@supabase/migrations/030_accounting_integrations.sql
@supabase/migrations/050_checklist_overrides.sql

<interfaces>
<!-- Existing accounting_credentials table shape (from 030_accounting_integrations.sql) -->
<!-- Executor must preserve all existing columns; migration adds two + swaps CHECK. -->

Existing table (from supabase/migrations/030_accounting_integrations.sql lines 9-26):

```sql
CREATE TABLE accounting_credentials (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider        text NOT NULL
    CHECK (provider IN ('quickbooks', 'xero', 'freshbooks')),  -- ← this CHECK gets swapped
  access_token    text NOT NULL,
  refresh_token   text NOT NULL,
  expiry_date     bigint,
  realm_id        text,
  xero_tenant_id  text,
  account_id      text,
  display_name    text,
  connected_at    timestamptz NOT NULL DEFAULT now(),
  last_synced_at  timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider)
);
```

Auto-generated CHECK constraint name follows Postgres convention: `{table}_{column}_check` → `accounting_credentials_provider_check`. If the actual name differs, the executor queries `pg_constraint` and adjusts.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create migration 051_integrations_schema.sql</name>
  <files>supabase/migrations/051_integrations_schema.sql</files>
  <read_first>
    - supabase/migrations/030_accounting_integrations.sql (confirm existing CHECK shape + constraint name convention)
    - supabase/migrations/050_checklist_overrides.sql (confirm sequence number 051 is next and follow header-comment + transactional style)
    - .planning/phases/54-integration-credentials-foundation-caching-prep-sandbox-provisioning/54-RESEARCH.md §Pattern 2 (verified SQL sequence)
    - .planning/phases/54-integration-credentials-foundation-caching-prep-sandbox-provisioning/54-CONTEXT.md D-11, D-12, D-13, D-14 (locked migration shape)
  </read_first>
  <action>
Create `supabase/migrations/051_integrations_schema.sql` with the following exact content (transactional, single-file):

```sql
-- ============================================================
-- 051_integrations_schema.sql
-- Phase 54: Integration credentials foundation + Next.js 16 caching prep
-- Adds: scopes TEXT[], last_context_fetch_at TIMESTAMPTZ
-- Tightens: provider CHECK to ('xero','jobber') — drops QuickBooks + FreshBooks
-- ============================================================

BEGIN;

-- Step 1 (per D-11.a, D-15): Purge QB/FB rows BEFORE tightening CHECK, otherwise
-- ALTER TABLE ... ADD CONSTRAINT fails with "check constraint is violated by some row".
-- NOTE: accounting_sync_log has NO FK to accounting_credentials (FKs are tenants+invoices
-- only — verified in Phase 54 research); no cascade to worry about.
DELETE FROM accounting_credentials
  WHERE provider IN ('quickbooks', 'freshbooks');

-- Step 2 (per D-11.b): Drop old CHECK constraint.
-- Postgres auto-names unnamed inline CHECKs as {table}_{column}_check.
-- If the name is different in the live project, this will fail loudly — the fix
-- is to query pg_constraint, identify the actual name, and adjust the DROP line.
ALTER TABLE accounting_credentials
  DROP CONSTRAINT accounting_credentials_provider_check;

-- Step 3 (per D-11.c, D-14): Add tightened CHECK permitting xero + jobber.
-- Forward-compatible: any future provider requires another DROP+ADD cycle.
ALTER TABLE accounting_credentials
  ADD CONSTRAINT accounting_credentials_provider_check
  CHECK (provider IN ('xero', 'jobber'));

-- Step 4 (per D-11.d, D-12): scopes column — TEXT[] NOT NULL DEFAULT empty array.
-- Existing Xero rows backfill to '{}'. Dev Xero sandboxes reconnect through the
-- unified OAuth flow (Plan 03) to populate real granular scopes.
ALTER TABLE accounting_credentials
  ADD COLUMN scopes TEXT[] NOT NULL DEFAULT '{}'::text[];

-- Step 5 (per D-11.e, D-13): last_context_fetch_at — TIMESTAMPTZ, nullable, no default.
-- Populated by Phase 55 Xero + Phase 56 Jobber fetchCustomerByPhone implementations.
-- Phase 54 leaves this NULL.
ALTER TABLE accounting_credentials
  ADD COLUMN last_context_fetch_at TIMESTAMPTZ;

COMMIT;
```

Do NOT add indexes (D-13 locks: no new index; existing `UNIQUE (tenant_id, provider)` covers tenant-scoped reads). Do NOT touch `accounting_sync_log` (researcher verified no FK cascade concern; purging free-text legacy QB/FB provider strings there is Phase 58 cleanup work). Do NOT rename `accounting_credentials` to `integration_credentials` (CONTEXT.md Deferred Ideas — explicitly rejected for Phase 54).
  </action>
  <verify>
    <automated>test -f supabase/migrations/051_integrations_schema.sql &amp;&amp; grep -c "CHECK (provider IN ('xero', 'jobber'))" supabase/migrations/051_integrations_schema.sql &amp;&amp; grep -c "ADD COLUMN scopes TEXT\[\] NOT NULL DEFAULT '{}'" supabase/migrations/051_integrations_schema.sql &amp;&amp; grep -c "ADD COLUMN last_context_fetch_at TIMESTAMPTZ" supabase/migrations/051_integrations_schema.sql &amp;&amp; grep -c "DELETE FROM accounting_credentials" supabase/migrations/051_integrations_schema.sql</automated>
  </verify>
  <acceptance_criteria>
    - `supabase/migrations/051_integrations_schema.sql` exists
    - File contains literal string `BEGIN;` and `COMMIT;` (transactional wrapper)
    - File contains literal string `DELETE FROM accounting_credentials` and `WHERE provider IN ('quickbooks', 'freshbooks')`
    - File contains literal string `DROP CONSTRAINT accounting_credentials_provider_check`
    - File contains literal string `CHECK (provider IN ('xero', 'jobber'))`
    - File contains literal string `ADD COLUMN scopes TEXT[] NOT NULL DEFAULT '{}'::text[]`
    - File contains literal string `ADD COLUMN last_context_fetch_at TIMESTAMPTZ`
    - File does NOT contain `accounting_sync_log` (verified via grep — should return 0 matches)
    - File does NOT contain `CREATE INDEX` (verified via grep — should return 0 matches; per D-13)
    - File does NOT contain `integration_credentials` (deferred rename — verified via grep)
  </acceptance_criteria>
  <done>
Migration file is present, transactional, and encodes the locked D-11 sequence. Every acceptance grep returns the expected count (>=1 for required strings, 0 for prohibited strings).
  </done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 2: [BLOCKING] Apply migration 051 to Supabase via `supabase db push`</name>
  <what-automated>Migration file committed in Task 1</what-automated>
  <what-built>Schema changes are on the live Supabase project so Plan 02+ can reference `scopes` and `last_context_fetch_at` columns, and CHECK accepts `jobber` for Phase 55/56.</what-built>
  <how-to-verify>
Run the schema push command from the repo root:

```bash
SUPABASE_ACCESS_TOKEN=<paste-from-dashboard> supabase db push
```

If `supabase` CLI is unavailable or the command errors with auth issues, fallback option:

1. Open Supabase Studio → SQL Editor for the project
2. Paste the entire contents of `supabase/migrations/051_integrations_schema.sql`
3. Run

After the migration lands, verify in Supabase Studio → SQL Editor:

```sql
-- Expected: scopes (text[]) and last_context_fetch_at (timestamp with time zone) present
SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_name = 'accounting_credentials'
  ORDER BY ordinal_position;

-- Expected: new CHECK with xero + jobber
SELECT pg_get_constraintdef(oid) AS definition
  FROM pg_constraint
  WHERE conname = 'accounting_credentials_provider_check';

-- Expected: ERROR — new row for relation violates check constraint
INSERT INTO accounting_credentials
  (tenant_id, provider, access_token, refresh_token)
  VALUES
  ((SELECT id FROM tenants LIMIT 1), 'quickbooks', 'x', 'x');
```

Confirm all three queries return the expected results.
  </how-to-verify>
  <files>supabase (project database — migration applied via CLI or Studio)</files>
  <action>Apply `supabase/migrations/051_integrations_schema.sql` to the project database. Primary path: `SUPABASE_ACCESS_TOKEN=<token> supabase db push` from repo root. Fallback: paste the migration SQL into Supabase Studio SQL Editor and run. Verify with three SQL queries described in <how-to-verify> (information_schema.columns, pg_get_constraintdef, QB insert rejection).</action>
  <verify>
    <automated>MISSING — manual migration apply; confirmed via three Supabase Studio queries (see how-to-verify). Downstream plans run `npm test -- --testPathPatterns=integrations` which verifies module behavior but NOT live schema state.</automated>
  </verify>
  <done>Migration is applied to the live Supabase project; scopes + last_context_fetch_at columns present; QB insert rejected with check_violation; user confirms "migration applied" to resume.</done>
  <resume-signal>Type "migration applied" with a one-line summary of what `information_schema.columns` returned (did you see `scopes` and `last_context_fetch_at`? did the insert of `'quickbooks'` fail with check_violation?). If the CHECK constraint DROP failed because the real constraint name differed, paste the actual name — the executor will write a follow-up fix migration.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Developer → Supabase (service-role) | Migration SQL runs as service role; touches an RLS-protected table. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-54-01 | Tampering | CHECK constraint DROP + ADD atomicity | mitigate | Whole migration wrapped in `BEGIN`/`COMMIT` so a failure mid-sequence rolls back. If `DROP CONSTRAINT` fails because the constraint name differs, the transaction rolls back with no change. |
| T-54-02 | Denial-of-Service | Step 3 `ADD CONSTRAINT` fails because QB/FB rows still present | mitigate | Step 1 `DELETE FROM accounting_credentials WHERE provider IN ('quickbooks', 'freshbooks')` runs BEFORE the CHECK is re-added — covers the known Postgres pitfall (researcher §Pattern 2, CONTEXT.md Known Pitfalls #1). |
| T-54-03 | Information Disclosure | `scopes TEXT[]` column leaking OAuth scopes to non-tenant readers | accept | `accounting_credentials` RLS policies unchanged — service_role + tenant_own only. New columns inherit existing policies. Scopes are not secret (they're sent to provider dev-console anyway); RLS still prevents cross-tenant reads. |
| T-54-04 | Repudiation | Migration applied to production without commit in git | mitigate | File is committed in git BEFORE `supabase db push` runs. Audit trail = git log + Supabase migration history. Task 2 is gated `autonomous: false` and requires explicit user confirmation of successful apply. |
| T-54-05 | Elevation of Privilege | Hardcoded `accounting_credentials_provider_check` name mismatch lets an attacker inject a different constraint via race | accept | Migration runs in a dev-only window (v6.0 not in prod); no attacker surface during the DDL window; CI/CD gate enforces single-developer migration runs. |
</threat_model>

<verification>
- `supabase/migrations/051_integrations_schema.sql` exists with exact content per Task 1
- `supabase db push` succeeds OR Supabase Studio SQL editor paste succeeds
- Post-migration sanity queries (Task 2 verification) all pass
- No changes to `accounting_sync_log`, no renames, no index additions
</verification>

<success_criteria>
- Migration file present, transactional, encodes all D-11 steps in correct order
- Migration applied to the project database — confirmed via information_schema query
- CHECK constraint rejects `'quickbooks'` inserts and accepts `'xero'` + `'jobber'` inserts
- `scopes TEXT[] NOT NULL DEFAULT '{}'` column present; existing Xero rows (if any) backfilled to empty array
- `last_context_fetch_at TIMESTAMPTZ` nullable column present
- No production migration attempted (v6.0 is dev-only; migration lands in the dev Supabase project)
</success_criteria>

<output>
After completion, create `.planning/phases/54-integration-credentials-foundation-caching-prep-sandbox-provisioning/54-01-SUMMARY.md`

Required fields in SUMMARY:
- Applied: yes/no (output of `supabase db push` or Studio paste)
- Constraint name confirmed: `accounting_credentials_provider_check` OR `<actual-name-if-different>`
- Verification queries results: `scopes` column present (yes/no), `last_context_fetch_at` column present (yes/no), QB insert rejected (yes/no)
- Any follow-up fix migration file needed (yes/no + path if yes)
</output>

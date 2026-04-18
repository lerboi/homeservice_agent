-- Phase 56 Plan 02 — provider-agnostic external account identifier.
--
-- Context:
--   P54 migration 052 shipped `accounting_credentials.xero_tenant_id TEXT` for Xero's
--   orgId. Phase 56's Jobber integration receives `accountId` in webhook payloads — the
--   same concept under a different name. Reusing `xero_tenant_id` would keep the column
--   name misleading; research Pitfall 8 flagged option (b) — add a provider-agnostic
--   column — as the cleaner path, especially given P57 will store Jobber's accountId
--   for the schedule-mirror lookups too.
--
-- Safety:
--   - Additive only: `xero_tenant_id` is preserved so P55 code paths remain functional.
--     A future P58 cleanup migration will drop `xero_tenant_id` once all consumers
--     have migrated to read `external_account_id`.
--   - Idempotent: safe to re-run (ADD COLUMN IF NOT EXISTS + conditional UPDATE +
--     CREATE UNIQUE INDEX IF NOT EXISTS).
--
-- Source: .planning/phases/56-jobber-read-side-integration-customer-context-clients-jobs-invoices/56-RESEARCH.md Pattern 4 + Pitfall 8

ALTER TABLE accounting_credentials
  ADD COLUMN IF NOT EXISTS external_account_id TEXT;

COMMENT ON COLUMN accounting_credentials.external_account_id IS
  'Provider-side account identifier (Xero orgId, Jobber accountId). Replaces provider-specific xero_tenant_id usage. Phase 56 migration 054.';

-- Backfill Xero rows idempotently — copies xero_tenant_id into external_account_id
-- ONLY where the new column is still null (so rerunning the migration is a no-op).
UPDATE accounting_credentials
   SET external_account_id = xero_tenant_id
 WHERE provider = 'xero'
   AND xero_tenant_id IS NOT NULL
   AND external_account_id IS NULL;

-- Prevent the same Jobber accountId (or Xero orgId) from being registered under the
-- same Voco tenant twice. Partial index (WHERE external_account_id IS NOT NULL) lets
-- disconnected rows coexist as NULL without unique-constraint contention.
CREATE UNIQUE INDEX IF NOT EXISTS
  idx_accounting_credentials_tenant_provider_external_unique
  ON accounting_credentials (tenant_id, provider, external_account_id)
  WHERE external_account_id IS NOT NULL;

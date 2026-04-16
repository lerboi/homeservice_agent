-- ============================================================
-- 051_integrations_schema.sql
-- Phase 54: Integration credentials foundation + Next.js 16 caching prep
-- Adds: scopes TEXT[], last_context_fetch_at TIMESTAMPTZ
-- Tightens: provider CHECK to ('xero','jobber') — drops QuickBooks + FreshBooks
-- ============================================================

BEGIN;

-- Step 1 (per D-11.a, D-15): Purge QB/FB rows BEFORE tightening CHECK, otherwise
-- ALTER TABLE ... ADD CONSTRAINT fails with "check constraint is violated by some row".
-- NOTE: Phase 54 research verified no FK cascade concern from the related sync log
-- (its FKs are tenants+invoices only); no cascade to worry about.
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

-- Phase 56 Plan 02 (Review Fix WR-03) — global uniqueness on (provider, external_account_id).
--
-- Context:
--   Migration 054 added idx_accounting_credentials_tenant_provider_external_unique,
--   which prevents the same Jobber accountId from appearing twice under ONE tenant.
--   It does NOT prevent the same Jobber accountId from being connected across two
--   different Voco tenants (e.g. a franchise with two sub-accounts). If that happens:
--     - /api/webhooks/jobber uses .maybeSingle() on (provider, external_account_id),
--       which errors when >1 row matches. The catch-all returns 200 and drops
--       webhooks for BOTH tenants silently.
--   For a B2B product, a given provider-side account should be owned by at most one
--   Voco tenant. Enforce that at the DB layer so the OAuth callback fails fast with
--   a unique-violation (handled in callback/route.js → ?error=account_already_connected).
--
-- Safety:
--   - Additive only: adds a new partial unique index alongside the existing
--     per-tenant index from migration 054.
--   - Idempotent: CREATE UNIQUE INDEX IF NOT EXISTS.
--   - Partial (WHERE external_account_id IS NOT NULL) so disconnected rows with NULL
--     values coexist freely.
--   - If the production DB already contains >1 row with the same
--     (provider, external_account_id) and non-NULL external_account_id, this index
--     creation will FAIL. That is the correct behavior — requires operator resolution
--     before enforcing the invariant.
--
-- Source: .planning/phases/56-jobber-read-side-integration-customer-context-clients-jobs-invoices/56-REVIEW.md WR-03

CREATE UNIQUE INDEX IF NOT EXISTS
  idx_accounting_credentials_provider_external_unique
  ON accounting_credentials (provider, external_account_id)
  WHERE external_account_id IS NOT NULL;

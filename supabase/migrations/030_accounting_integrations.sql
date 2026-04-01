-- ============================================================
-- 030_accounting_integrations.sql
-- Phase 35: Invoice Integrations — Accounting Credentials & Sync Log
-- ============================================================

-- ============================================================
-- accounting_credentials (one row per tenant per provider)
-- ============================================================
CREATE TABLE accounting_credentials (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider        text NOT NULL
    CHECK (provider IN ('quickbooks', 'xero', 'freshbooks')),
  access_token    text NOT NULL,
  refresh_token   text NOT NULL,
  expiry_date     bigint,
  -- Platform-specific identifiers
  realm_id        text,          -- QBO company/realm ID
  xero_tenant_id  text,          -- Xero organization ID
  account_id      text,          -- FreshBooks account ID
  display_name    text,          -- Company name from accounting software
  connected_at    timestamptz NOT NULL DEFAULT now(),
  last_synced_at  timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider)
);

ALTER TABLE accounting_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounting_credentials_tenant_own" ON accounting_credentials
  FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

CREATE POLICY "service_role_all_accounting_credentials" ON accounting_credentials
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- accounting_sync_log (track push status per invoice per provider)
-- ============================================================
CREATE TABLE accounting_sync_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_id      uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  provider        text NOT NULL,
  external_id     text,            -- ID in accounting software
  status          text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'synced', 'failed')),
  error_message   text,
  attempted_at    timestamptz NOT NULL DEFAULT now(),
  synced_at       timestamptz,
  UNIQUE (invoice_id, provider)    -- one sync record per invoice per provider
);

ALTER TABLE accounting_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounting_sync_log_tenant_own" ON accounting_sync_log
  FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

CREATE POLICY "service_role_all_accounting_sync_log" ON accounting_sync_log
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_accounting_sync_log_invoice ON accounting_sync_log(invoice_id);
CREATE INDEX idx_accounting_sync_log_tenant ON accounting_sync_log(tenant_id, status);

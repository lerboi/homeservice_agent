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

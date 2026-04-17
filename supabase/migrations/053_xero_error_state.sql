-- Migration 053: accounting_credentials.error_state
-- Phase 55 (Xero read-side integration). Persists token-refresh failure state
-- so the Business Integrations card can render a "Reconnect needed" banner
-- and the dashboard refresh path can email the owner once.
--
-- Values:
--   NULL                      -- no error (default)
--   'token_refresh_failed'    -- background refresh failed (refresh_token revoked or expired)
--
-- Cleared by:
--   - Successful OAuth re-callback (set NULL in callback handler)
--   - Successful token refresh (set NULL in refreshTokenIfNeeded)
--   - Disconnect (row deleted entirely)

ALTER TABLE accounting_credentials
  ADD COLUMN IF NOT EXISTS error_state TEXT NULL;

COMMENT ON COLUMN accounting_credentials.error_state IS
  'Phase 55: NULL = healthy. Non-null string identifies degraded state, e.g. ''token_refresh_failed''. Cleared on successful OAuth callback or refresh.';

-- Partial index for the dashboard cron / status reads that fetch only failed rows.
CREATE INDEX IF NOT EXISTS idx_accounting_credentials_error_state
  ON accounting_credentials (tenant_id, provider)
  WHERE error_state IS NOT NULL;

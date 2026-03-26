-- Migration 013: Usage events (idempotency table + increment RPC)
-- Phase 23-01: usage-tracking
-- Requirements: USAGE-01, USAGE-02
-- Note: Plan specified 012 but 012_admin_users.sql already exists — renumbered to 013.

-- =============================================================================
-- 1. usage_events table (D-04: minimal — call_id idempotency key only)
-- =============================================================================
CREATE TABLE usage_events (
  call_id    text PRIMARY KEY,
  tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_usage_events_tenant_id ON usage_events(tenant_id);

-- =============================================================================
-- 2. RLS: service_role only — webhook handlers write, no direct user access
-- =============================================================================
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_all_usage_events ON usage_events
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- 3. increment_calls_used RPC (D-08: returns success, calls_used, calls_limit, limit_exceeded)
-- =============================================================================
CREATE OR REPLACE FUNCTION increment_calls_used(
  p_tenant_id  uuid,
  p_call_id    text
)
RETURNS TABLE(
  success        boolean,
  calls_used     int,
  calls_limit    int,
  limit_exceeded boolean
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_calls_used   int;
  v_calls_limit  int;
BEGIN
  -- Idempotency guard: INSERT the usage event row; if call_id already exists,
  -- ON CONFLICT DO NOTHING sets FOUND = false.
  INSERT INTO usage_events (call_id, tenant_id)
  VALUES (p_call_id, p_tenant_id)
  ON CONFLICT (call_id) DO NOTHING;

  -- If no row was inserted (duplicate call_id), return current state without incrementing
  IF NOT FOUND THEN
    SELECT s.calls_used, s.calls_limit
    INTO v_calls_used, v_calls_limit
    FROM subscriptions s
    WHERE s.tenant_id = p_tenant_id AND s.is_current = true;

    RETURN QUERY SELECT false, COALESCE(v_calls_used, 0), COALESCE(v_calls_limit, 0),
      COALESCE(v_calls_used >= v_calls_limit, false);
    RETURN;
  END IF;

  -- Atomic increment: single UPDATE statement, Postgres guarantees atomicity
  UPDATE subscriptions
  SET calls_used = calls_used + 1
  WHERE tenant_id = p_tenant_id AND is_current = true
  RETURNING subscriptions.calls_used, subscriptions.calls_limit
  INTO v_calls_used, v_calls_limit;

  -- No active subscription row
  IF v_calls_used IS NULL THEN
    RETURN QUERY SELECT false, 0, 0, false;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, v_calls_used, v_calls_limit,
    (v_calls_used >= v_calls_limit);
END;
$$;

-- Migration 037: Fix off-by-one error in increment_calls_used overage check
--
-- The limit_exceeded flag used >= (calls_used >= calls_limit), which caused
-- the LAST included call to be flagged as overage. For a Starter plan with
-- 40 calls, call #40 was reported to Stripe as overage even though it's
-- the 40th included call. The correct check is > (strictly greater than),
-- so only call #41 onward triggers overage billing.
--
-- This affected both the increment path (line 79) and the duplicate-call
-- read-only path (line 60) of the original function.

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
      COALESCE(v_calls_used > v_calls_limit, false);
    RETURN;
  END IF;

  -- Atomic increment: single UPDATE statement, Postgres guarantees atomicity
  -- Alias 's' required to disambiguate table columns from RETURNS TABLE output columns
  UPDATE subscriptions s
  SET calls_used = s.calls_used + 1
  WHERE s.tenant_id = p_tenant_id AND s.is_current = true
  RETURNING s.calls_used, s.calls_limit
  INTO v_calls_used, v_calls_limit;

  -- No active subscription row
  IF v_calls_used IS NULL THEN
    RETURN QUERY SELECT false, 0, 0, false;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, v_calls_used, v_calls_limit,
    (v_calls_used > v_calls_limit);
END;
$$;

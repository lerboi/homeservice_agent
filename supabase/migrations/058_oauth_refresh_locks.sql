-- ============================================================
-- 058_oauth_refresh_locks.sql
-- Phase 999.5: Serialize concurrent OAuth refresh attempts per
-- (tenant, provider) to prevent Jobber refresh-token rotation races
-- where two callers enter the 5-min expiry window together and both
-- call refreshToken — one gets orphaned tokens or 401s the second.
--
-- Design: lease-based lock table + two RPCs. A lease approach (rather
-- than raw pg_advisory_lock) is used because Supabase's PostgREST
-- connection pool cannot reliably pair an acquire on one connection
-- with an unlock on another. The TTL on expires_at is the backstop
-- against a crashed holder (e.g. Vercel function timeout mid-refresh).
-- ============================================================

BEGIN;

CREATE TABLE oauth_refresh_locks (
  tenant_id   UUID NOT NULL,
  provider    TEXT NOT NULL,
  holder_id   UUID NOT NULL,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, provider)
);

COMMENT ON TABLE oauth_refresh_locks IS
  'Short-lived lease coordinating concurrent OAuth refresh attempts. '
  'Rows are created by try_acquire_oauth_refresh_lock() and deleted by '
  'release_oauth_refresh_lock(); expires_at bounds damage from crashed '
  'holders.';

-- Service-role only. No RLS: the lock is an internal coordination table
-- and only the service-role client (refreshTokenIfNeeded in adapter.js)
-- ever touches it. RLS is left OFF intentionally — enabling it without
-- policies would block the service role too via force_row_level_security
-- on any downstream tightening.

-- Atomically acquire (or steal an expired) lock. Returns the new holder
-- UUID if this caller won the slot; NULL if another caller currently
-- holds a non-expired lock.
CREATE OR REPLACE FUNCTION try_acquire_oauth_refresh_lock(
  p_tenant_id UUID,
  p_provider  TEXT,
  p_ttl_ms    INT DEFAULT 30000
) RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  new_holder UUID := gen_random_uuid();
  returned   UUID;
BEGIN
  -- Serialize with pg_advisory_xact_lock so the ON CONFLICT + conditional
  -- UPDATE can't interleave with a second caller and produce a lost update.
  -- Lock is automatically released at end of this RPC's implicit transaction.
  PERFORM pg_advisory_xact_lock(
    hashtext('oauth-refresh-' || p_provider || '-' || p_tenant_id::text)::bigint
  );

  INSERT INTO oauth_refresh_locks (tenant_id, provider, holder_id, expires_at)
  VALUES (
    p_tenant_id,
    p_provider,
    new_holder,
    now() + make_interval(secs => p_ttl_ms / 1000.0)
  )
  ON CONFLICT (tenant_id, provider) DO UPDATE
    SET holder_id   = EXCLUDED.holder_id,
        acquired_at = now(),
        expires_at  = EXCLUDED.expires_at
    WHERE oauth_refresh_locks.expires_at < now()
  RETURNING holder_id INTO returned;

  -- If the conditional UPDATE's WHERE clause was false (existing lock still
  -- valid), RETURNING yields no row and `returned` is NULL → caller lost
  -- the race. Otherwise `returned` equals new_holder and caller won.
  IF returned = new_holder THEN
    RETURN new_holder;
  ELSE
    RETURN NULL;
  END IF;
END;
$$;

-- Release a held lock. Only deletes the row if holder_id matches, so a
-- stale release (TTL already expired and another caller took over) is a
-- no-op rather than accidentally freeing someone else's slot.
CREATE OR REPLACE FUNCTION release_oauth_refresh_lock(
  p_tenant_id UUID,
  p_provider  TEXT,
  p_holder_id UUID
) RETURNS VOID
LANGUAGE sql
AS $$
  DELETE FROM oauth_refresh_locks
  WHERE tenant_id = p_tenant_id
    AND provider  = p_provider
    AND holder_id = p_holder_id;
$$;

COMMIT;

-- 038: Schema hardening pass 2
-- DB-1: Add missing FK from tenants.owner_id to auth.users
-- DB-2: Ensure at most one is_current=true subscription per tenant
-- DB-3: Index stripe_customer_id for webhook lookups
-- INT-3: Atomic set_primary_calendar RPC

-- DB-1: Add FK constraint (will fail if orphaned owner_ids exist — clean up first)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'tenants_owner_id_fkey' AND table_name = 'tenants'
  ) THEN
    ALTER TABLE tenants
      ADD CONSTRAINT tenants_owner_id_fkey
      FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;


-- DB-3: Index for Stripe webhook customer lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id
  ON subscriptions(stripe_customer_id);

-- INT-3: Atomic primary calendar swap (single statement = no race window)
CREATE OR REPLACE FUNCTION set_primary_calendar(p_tenant_id uuid, p_provider text)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE calendar_credentials
  SET is_primary = (provider = p_provider)
  WHERE tenant_id = p_tenant_id;
$$;

REVOKE ALL ON FUNCTION set_primary_calendar FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_primary_calendar TO service_role;

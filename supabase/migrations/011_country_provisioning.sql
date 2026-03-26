-- Migration 011: Country-aware provisioning schema
-- Phase 27-01: country-aware-onboarding-and-number-provisioning

-- =============================================================================
-- 1. Add columns to tenants table (per D-05 + BLOCKER 3 fix for provisioning_failed)
-- =============================================================================
-- No NOT NULL constraint — existing tenants have no country/name yet.
-- These fields are required at the application level (enforced by the Your Details step).
-- provisioning_failed is used by the Stripe webhook handler (Plan 27-03) to flag tenants
-- whose number provisioning failed after checkout, enabling admin follow-up.

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS owner_name text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS provisioning_failed boolean DEFAULT false;

-- =============================================================================
-- 2. Create phone_inventory table (per D-09)
-- =============================================================================
CREATE TABLE phone_inventory (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number       text NOT NULL UNIQUE,
  country            text NOT NULL DEFAULT 'SG',
  status             text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'assigned', 'retired')),
  assigned_tenant_id uuid REFERENCES tenants(id),
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 3. Unique partial index to prevent double-assignment
-- =============================================================================
-- Ensures a tenant cannot be assigned more than one number at 'assigned' status.
CREATE UNIQUE INDEX idx_phone_inventory_assigned_tenant
  ON phone_inventory (assigned_tenant_id)
  WHERE status = 'assigned';

-- =============================================================================
-- 4. Create phone_inventory_waitlist table
-- =============================================================================
CREATE TABLE phone_inventory_waitlist (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL,
  country     text NOT NULL DEFAULT 'SG',
  created_at  timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz
);

-- =============================================================================
-- 5. Create assign_sg_number RPC function (race-safe, per D-11)
-- =============================================================================
-- SECURITY DEFINER runs as the function owner (service role level) so it can
-- bypass RLS on phone_inventory. FOR UPDATE SKIP LOCKED prevents double-assignment
-- when two concurrent checkout webhooks both attempt to claim the last available slot.

CREATE OR REPLACE FUNCTION assign_sg_number(p_tenant_id uuid)
RETURNS TABLE(phone_number text) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  UPDATE phone_inventory
  SET status = 'assigned', assigned_tenant_id = p_tenant_id
  WHERE id = (
    SELECT pi.id FROM phone_inventory pi
    WHERE pi.country = 'SG' AND pi.status = 'available'
    ORDER BY pi.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING phone_inventory.phone_number;
END;
$$;

-- =============================================================================
-- 6. Row Level Security
-- =============================================================================
-- phone_inventory: Enable RLS. No policies for authenticated users — all access
-- is via service_role (bypasses RLS by default) or the assign_sg_number RPC
-- (SECURITY DEFINER, runs as function owner with service_role privileges).
-- phone_inventory_waitlist: Enable RLS. Allow INSERT for anon/authenticated
-- (anyone can join the waitlist). No SELECT/UPDATE/DELETE for non-service-role.

ALTER TABLE phone_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_inventory_waitlist ENABLE ROW LEVEL SECURITY;

-- Waitlist: anyone can insert (anon users joining waitlist before auth)
CREATE POLICY "Anyone can join waitlist"
  ON phone_inventory_waitlist FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- =============================================================================
-- 7. Index for fast availability count (used by sg-availability API route)
-- =============================================================================
CREATE INDEX idx_phone_inventory_available
  ON phone_inventory (country, status)
  WHERE status = 'available';

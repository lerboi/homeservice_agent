-- ============================================================
-- 006_escalation_contacts.sql
-- Phase 12: Dashboard-configurable Triage and Call Escalation
-- ============================================================

-- ============================================================
-- 1. escalation_contacts table
-- ============================================================
CREATE TABLE escalation_contacts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                text NOT NULL,
  role                text,
  phone               text,
  email               text,
  notification_pref   text NOT NULL DEFAULT 'both'
    CHECK (notification_pref IN ('sms', 'email', 'both')),
  timeout_seconds     int NOT NULL DEFAULT 30
    CHECK (timeout_seconds IN (15, 30, 45, 60)),
  sort_order          int NOT NULL DEFAULT 0,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. Index on escalation_contacts
-- ============================================================
CREATE INDEX idx_escalation_contacts_tenant ON escalation_contacts(tenant_id, sort_order);

-- ============================================================
-- 3. RLS policies for escalation_contacts
--    Matches the services table pattern from 002_onboarding_triage.sql:
--    tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid())
-- ============================================================
ALTER TABLE escalation_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "escalation_contacts_tenant_own"
  ON escalation_contacts FOR ALL
  USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

CREATE POLICY "service_role_all_escalation_contacts"
  ON escalation_contacts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 4. Add sort_order column to services table
-- ============================================================
ALTER TABLE services ADD COLUMN IF NOT EXISTS sort_order int NOT NULL DEFAULT 0;

-- ============================================================
-- 5. Backfill sort_order on existing services
--    Assigns sequential numbers per tenant ordered by created_at.
--    Prevents all existing rows from sitting at sort_order = 0.
-- ============================================================
UPDATE services SET sort_order = sub.rn
FROM (
  SELECT id, row_number() OVER (PARTITION BY tenant_id ORDER BY created_at) AS rn
  FROM services
) sub
WHERE services.id = sub.id;

-- ============================================================
-- 6. Index for services sort_order
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_services_sort_order ON services(tenant_id, sort_order);

-- Extend tenants table for onboarding config
ALTER TABLE tenants
  ADD COLUMN tone_preset text NOT NULL DEFAULT 'professional'
    CHECK (tone_preset IN ('professional', 'friendly', 'local_expert')),
  ADD COLUMN trade_type text,
  ADD COLUMN test_call_completed boolean NOT NULL DEFAULT false;

-- Services table (one row per service per tenant)
CREATE TABLE services (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        text NOT NULL,
  urgency_tag text NOT NULL DEFAULT 'routine'
    CHECK (urgency_tag IN ('emergency', 'routine', 'high_ticket')),
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_services_tenant_id ON services(tenant_id);
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "services_tenant_own" ON services
  FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));
CREATE POLICY "service_role_all_services" ON services
  FOR ALL USING (auth.role() = 'service_role');

-- Working hours stub (ONBOARD-03 — full UI deferred to Phase 3)
ALTER TABLE tenants ADD COLUMN working_hours jsonb;

-- Triage result columns on calls table
ALTER TABLE calls
  ADD COLUMN urgency_classification text
    CHECK (urgency_classification IN ('emergency', 'routine', 'high_ticket')),
  ADD COLUMN urgency_confidence text
    CHECK (urgency_confidence IN ('high', 'medium', 'low')),
  ADD COLUMN triage_layer_used text
    CHECK (triage_layer_used IN ('layer1', 'layer2', 'layer3'));

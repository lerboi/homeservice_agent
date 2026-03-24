-- ============================================================
-- 004_leads_crm.sql
-- Phase 4: CRM Dashboard and Notifications — Data Foundation
-- ============================================================

-- ============================================================
-- leads table
-- ============================================================
CREATE TABLE leads (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  from_number      text NOT NULL,
  caller_name      text,
  job_type         text,
  service_address  text,
  urgency          text NOT NULL DEFAULT 'routine'
    CHECK (urgency IN ('emergency', 'routine', 'high_ticket')),
  status           text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'booked', 'completed', 'paid', 'lost')),
  revenue_amount   numeric(10,2),
  primary_call_id  uuid REFERENCES calls(id) ON DELETE SET NULL,
  appointment_id   uuid REFERENCES appointments(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Indexes on leads
CREATE INDEX idx_leads_tenant_status  ON leads(tenant_id, status);
CREATE INDEX idx_leads_tenant_phone   ON leads(tenant_id, from_number);
CREATE INDEX idx_leads_tenant_created ON leads(tenant_id, created_at DESC);

-- RLS for leads
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_tenant_own" ON leads
  FOR ALL
  USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

CREATE POLICY "service_role_all_leads" ON leads
  FOR ALL USING (auth.role() = 'service_role');

-- Realtime (CRITICAL: publish leads changes so dashboard home feed updates live)
ALTER PUBLICATION supabase_realtime ADD TABLE leads;
ALTER TABLE leads REPLICA IDENTITY FULL;

-- ============================================================
-- lead_calls junction table (one lead, many calls for repeat callers)
-- ============================================================
CREATE TABLE lead_calls (
  lead_id  uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  call_id  uuid NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  PRIMARY KEY (lead_id, call_id)
);

-- RLS for lead_calls (join through leads.tenant_id)
ALTER TABLE lead_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_calls_tenant_own" ON lead_calls
  FOR ALL
  USING (lead_id IN (
    SELECT id FROM leads
    WHERE tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid())
  ))
  WITH CHECK (lead_id IN (
    SELECT id FROM leads
    WHERE tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid())
  ));

CREATE POLICY "service_role_all_lead_calls" ON lead_calls
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- activity_log table — dashboard home feed
-- ============================================================
CREATE TABLE activity_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type  text NOT NULL,
  lead_id     uuid REFERENCES leads(id) ON DELETE SET NULL,
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_log_tenant ON activity_log(tenant_id, created_at DESC);

-- RLS for activity_log
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_log_tenant_own" ON activity_log
  FOR ALL
  USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

CREATE POLICY "service_role_all_activity_log" ON activity_log
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- Extend calls table with recovery_sms_sent_at
-- (for NOTIF-03 Vercel Cron approach — tracks missed-call SMS recovery)
-- ============================================================
ALTER TABLE calls ADD COLUMN recovery_sms_sent_at timestamptz;

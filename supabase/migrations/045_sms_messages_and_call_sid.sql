-- Phase 40: SMS forwarding audit log + call_sid for owner-pickup dial-status linking

-- Section 1: sms_messages table (per D-15)
CREATE TABLE sms_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  from_number TEXT NOT NULL,
  to_number   TEXT NOT NULL,
  body        TEXT NOT NULL,
  direction   TEXT NOT NULL CHECK (direction IN ('inbound', 'forwarded')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sms_messages_tenant_created ON sms_messages (tenant_id, created_at);

ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_sms" ON sms_messages
  FOR SELECT USING (tenant_id = (SELECT id FROM tenants WHERE owner_id = auth.uid()));

-- Section 2: call_sid column on calls table
ALTER TABLE calls ADD COLUMN call_sid TEXT;
CREATE INDEX idx_calls_call_sid ON calls (call_sid) WHERE call_sid IS NOT NULL;

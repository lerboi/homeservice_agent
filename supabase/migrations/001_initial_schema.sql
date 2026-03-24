-- Tenants table (one row per business account)
CREATE TABLE tenants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  owner_id        uuid UNIQUE NOT NULL,
  business_name   text,
  retell_phone_number text UNIQUE,
  owner_phone     text,
  owner_email     text,
  default_locale  text NOT NULL DEFAULT 'en',
  onboarding_complete boolean NOT NULL DEFAULT false
);

-- Calls table (one row per Retell call)
CREATE TABLE calls (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES tenants(id),
  retell_call_id        text UNIQUE NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  from_number           text,
  to_number             text,
  direction             text DEFAULT 'inbound',
  status                text NOT NULL DEFAULT 'started',
  disconnection_reason  text,
  start_timestamp       bigint,
  end_timestamp         bigint,
  duration_seconds      int GENERATED ALWAYS AS (
    CASE WHEN end_timestamp IS NOT NULL AND start_timestamp IS NOT NULL
    THEN ((end_timestamp - start_timestamp) / 1000)::int
    ELSE NULL END
  ) STORED,
  recording_url         text,
  recording_storage_path text,
  transcript_text       text,
  transcript_structured jsonb,
  detected_language     text,
  language_barrier      boolean DEFAULT false,
  barrier_language      text,
  retell_metadata       jsonb
);

-- Indexes
CREATE INDEX idx_calls_tenant_id ON calls(tenant_id);
CREATE INDEX idx_calls_from_number ON calls(tenant_id, from_number);
CREATE INDEX idx_calls_retell_call_id ON calls(retell_call_id);

-- Enable RLS
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

-- RLS policies for tenant isolation
CREATE POLICY "tenants_read_own" ON tenants
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "tenants_update_own" ON tenants
  FOR UPDATE USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "tenants_insert_own" ON tenants
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "calls_all_own" ON calls
  FOR ALL
  USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

-- Service role bypass (for webhook handlers using service role key)
CREATE POLICY "service_role_all_tenants" ON tenants
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all_calls" ON calls
  FOR ALL USING (auth.role() = 'service_role');

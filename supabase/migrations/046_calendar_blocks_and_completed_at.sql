-- ============================================================
-- 046_calendar_blocks_and_completed_at.sql
-- Phase 42: Time blocks + mark-complete support
-- ============================================================

CREATE TABLE calendar_blocks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title       text NOT NULL,
  start_time  timestamptz NOT NULL,
  end_time    timestamptz NOT NULL,
  is_all_day  boolean NOT NULL DEFAULT false,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE calendar_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON calendar_blocks
  FOR SELECT USING (tenant_id = (SELECT id FROM tenants WHERE owner_id = auth.uid()));
CREATE POLICY "tenant_insert" ON calendar_blocks
  FOR INSERT WITH CHECK (tenant_id = (SELECT id FROM tenants WHERE owner_id = auth.uid()));
CREATE POLICY "tenant_update" ON calendar_blocks
  FOR UPDATE USING (tenant_id = (SELECT id FROM tenants WHERE owner_id = auth.uid()));
CREATE POLICY "tenant_delete" ON calendar_blocks
  FOR DELETE USING (tenant_id = (SELECT id FROM tenants WHERE owner_id = auth.uid()));

CREATE INDEX idx_calendar_blocks_tenant_time
  ON calendar_blocks (tenant_id, start_time, end_time);

ALTER TABLE appointments ADD COLUMN completed_at timestamptz;

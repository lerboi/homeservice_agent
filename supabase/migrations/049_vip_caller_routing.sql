-- Migration 049: VIP caller routing
-- Phase 46: VIP Caller Direct Routing
--
-- Adds vip_numbers JSONB array to tenants for standalone VIP phone numbers,
-- and is_vip boolean to leads for marking existing customers as VIP.
-- Both sources are checked at webhook routing time (per D-01, D-02).

-- Standalone VIP numbers on tenant (unlimited, no CHECK constraint per D-09)
ALTER TABLE tenants
  ADD COLUMN vip_numbers JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Lead-based VIP flag
ALTER TABLE leads
  ADD COLUMN is_vip BOOLEAN NOT NULL DEFAULT false;

-- Partial index for webhook lookup: only index VIP leads (sparse, fast)
CREATE INDEX idx_leads_vip_lookup
  ON leads (tenant_id, from_number)
  WHERE is_vip = true;

-- ============================================================
-- 030_estimates_schema.sql
-- Phase 34: Estimates, Reminders, and Recurring Invoices
-- Estimates data foundation: tables, RPC, RLS
-- ============================================================

-- ============================================================
-- estimate_sequences (atomic counter, composite PK on tenant_id + year)
-- ============================================================
CREATE TABLE estimate_sequences (
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  year        int  NOT NULL,
  next_number int  NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id, year)
);

ALTER TABLE estimate_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "estimate_sequences_tenant_own" ON estimate_sequences
  FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

CREATE POLICY "service_role_all_estimate_sequences" ON estimate_sequences
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- estimates
-- ============================================================
CREATE TABLE estimates (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id                 uuid REFERENCES leads(id) ON DELETE SET NULL,
  estimate_number         text NOT NULL,
  status                  text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'approved', 'declined', 'expired')),
  customer_name           text,
  customer_phone          text,
  customer_email          text,
  customer_address        text,
  job_type                text,
  created_date            date NOT NULL DEFAULT CURRENT_DATE,
  valid_until             date,
  notes                   text,
  subtotal                numeric(10,2),
  tax_amount              numeric(10,2),
  total                   numeric(10,2),
  converted_to_invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  sent_at                 timestamptz,
  approved_at             timestamptz,
  declined_at             timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, estimate_number)
);

CREATE INDEX idx_estimates_tenant_status  ON estimates(tenant_id, status);
CREATE INDEX idx_estimates_tenant_created ON estimates(tenant_id, created_at DESC);
CREATE INDEX idx_estimates_lead_id        ON estimates(lead_id);

ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "estimates_tenant_own" ON estimates
  FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

CREATE POLICY "service_role_all_estimates" ON estimates
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- estimate_tiers (Good / Better / Best per D-02)
-- ============================================================
CREATE TABLE estimate_tiers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id  uuid NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tier_label   text NOT NULL DEFAULT 'Good',
  sort_order   int NOT NULL DEFAULT 0,
  subtotal     numeric(10,2) NOT NULL DEFAULT 0,
  tax_amount   numeric(10,2) NOT NULL DEFAULT 0,
  total        numeric(10,2) NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_estimate_tiers_estimate ON estimate_tiers(estimate_id);

ALTER TABLE estimate_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "estimate_tiers_tenant_own" ON estimate_tiers
  FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

CREATE POLICY "service_role_all_estimate_tiers" ON estimate_tiers
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- estimate_line_items (per D-01 — separate from invoice_line_items)
-- ============================================================
CREATE TABLE estimate_line_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id  uuid NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  tier_id      uuid REFERENCES estimate_tiers(id) ON DELETE CASCADE,
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sort_order   int NOT NULL DEFAULT 0,
  item_type    text NOT NULL
    CHECK (item_type IN ('labor', 'materials', 'travel', 'flat_rate', 'discount')),
  description  text NOT NULL DEFAULT '',
  quantity     numeric(10,3) NOT NULL DEFAULT 1,
  unit_price   numeric(10,2) NOT NULL DEFAULT 0,
  markup_pct   numeric(5,4) NOT NULL DEFAULT 0,
  taxable      boolean NOT NULL DEFAULT true,
  line_total   numeric(10,2) NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_estimate_line_items_estimate ON estimate_line_items(estimate_id);

ALTER TABLE estimate_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "estimate_line_items_tenant_own" ON estimate_line_items
  FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

CREATE POLICY "service_role_all_estimate_line_items" ON estimate_line_items
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- get_next_estimate_number (atomic counter function, per D-07)
-- Same pattern as get_next_invoice_number but uses estimate_sequences
-- ============================================================
CREATE OR REPLACE FUNCTION get_next_estimate_number(p_tenant_id uuid, p_year int)
RETURNS int LANGUAGE plpgsql AS $$
DECLARE v_next int;
BEGIN
  INSERT INTO estimate_sequences (tenant_id, year, next_number)
  VALUES (p_tenant_id, p_year, 2)
  ON CONFLICT (tenant_id, year) DO UPDATE
    SET next_number = estimate_sequences.next_number + 1
  RETURNING next_number - 1 INTO v_next;
  RETURN v_next;
END;
$$;

-- ============================================================
-- Add estimate_prefix to invoice_settings
-- ============================================================
ALTER TABLE invoice_settings ADD COLUMN estimate_prefix text NOT NULL DEFAULT 'EST';

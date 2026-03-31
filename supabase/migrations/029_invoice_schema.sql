-- ============================================================
-- 029_invoice_schema.sql
-- Phase 33: Invoice Core — Data Foundation
-- ============================================================

-- ============================================================
-- invoice_settings (one row per tenant)
-- ============================================================
CREATE TABLE invoice_settings (
  tenant_id          uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  business_name      text,
  address            text,
  phone              text,
  email              text,
  logo_url           text,
  license_number     text,
  tax_rate           numeric(5,4) NOT NULL DEFAULT 0,
  payment_terms      text NOT NULL DEFAULT 'Net 30',
  default_notes      text,
  invoice_prefix     text NOT NULL DEFAULT 'INV',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE invoice_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoice_settings_tenant_own" ON invoice_settings
  FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

CREATE POLICY "service_role_all_invoice_settings" ON invoice_settings
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- invoice_sequences (atomic counter, composite PK on tenant_id + year)
-- ============================================================
CREATE TABLE invoice_sequences (
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  year        int  NOT NULL,
  next_number int  NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id, year)
);

ALTER TABLE invoice_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoice_sequences_tenant_own" ON invoice_sequences
  FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

CREATE POLICY "service_role_all_invoice_sequences" ON invoice_sequences
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- invoices
-- ============================================================
CREATE TABLE invoices (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id          uuid REFERENCES leads(id) ON DELETE SET NULL,
  invoice_number   text NOT NULL,
  status           text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'void')),
  customer_name    text,
  customer_phone   text,
  customer_email   text,
  customer_address text,
  job_type         text,
  issued_date      date NOT NULL DEFAULT CURRENT_DATE,
  due_date         date,
  notes            text,
  payment_terms    text,
  subtotal         numeric(10,2) NOT NULL DEFAULT 0,
  tax_amount       numeric(10,2) NOT NULL DEFAULT 0,
  total            numeric(10,2) NOT NULL DEFAULT 0,
  sent_at          timestamptz,
  paid_at          timestamptz,
  voided_at        timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, invoice_number)
);

CREATE INDEX idx_invoices_tenant_status  ON invoices(tenant_id, status);
CREATE INDEX idx_invoices_tenant_created ON invoices(tenant_id, created_at DESC);
CREATE INDEX idx_invoices_lead_id        ON invoices(lead_id);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_tenant_own" ON invoices
  FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

CREATE POLICY "service_role_all_invoices" ON invoices
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- invoice_line_items
-- ============================================================
CREATE TABLE invoice_line_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id   uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
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

CREATE INDEX idx_invoice_line_items_invoice ON invoice_line_items(invoice_id);

ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoice_line_items_tenant_own" ON invoice_line_items
  FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

CREATE POLICY "service_role_all_invoice_line_items" ON invoice_line_items
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- get_next_invoice_number (atomic counter function)
-- ============================================================
CREATE OR REPLACE FUNCTION get_next_invoice_number(p_tenant_id uuid, p_year int)
RETURNS int LANGUAGE plpgsql AS $$
DECLARE v_next int;
BEGIN
  INSERT INTO invoice_sequences (tenant_id, year, next_number)
  VALUES (p_tenant_id, p_year, 2)
  ON CONFLICT (tenant_id, year) DO UPDATE
    SET next_number = invoice_sequences.next_number + 1
  RETURNING next_number - 1 INTO v_next;
  RETURN v_next;
END;
$$;

-- ============================================================
-- invoice-logos Supabase Storage bucket
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('invoice-logos', 'invoice-logos', true);

CREATE POLICY "tenant_logo_upload" ON storage.objects
  FOR ALL USING (bucket_id = 'invoice-logos' AND (storage.foldername(name))[1] IN (SELECT id::text FROM tenants WHERE owner_id = auth.uid()))
  WITH CHECK (bucket_id = 'invoice-logos' AND (storage.foldername(name))[1] IN (SELECT id::text FROM tenants WHERE owner_id = auth.uid()));

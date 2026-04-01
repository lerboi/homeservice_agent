-- ============================================================
-- 031_payment_log_schema.sql
-- Phase 34: Payment log + invoice status/item_type expansion
-- ============================================================

-- ============================================================
-- invoice_payments (per D-08)
-- ============================================================
CREATE TABLE invoice_payments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  amount        numeric(10,2) NOT NULL,
  payment_date  date NOT NULL DEFAULT CURRENT_DATE,
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoice_payments_invoice ON invoice_payments(invoice_id);

ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoice_payments_tenant_own" ON invoice_payments
  FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

CREATE POLICY "service_role_all_invoice_payments" ON invoice_payments
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- Expand invoices status CHECK to include partially_paid (per D-09)
-- ============================================================
ALTER TABLE invoices DROP CONSTRAINT invoices_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'void', 'partially_paid'));

-- ============================================================
-- Expand invoice_line_items item_type CHECK to include late_fee (per D-14)
-- ============================================================
ALTER TABLE invoice_line_items DROP CONSTRAINT invoice_line_items_item_type_check;
ALTER TABLE invoice_line_items ADD CONSTRAINT invoice_line_items_item_type_check
  CHECK (item_type IN ('labor', 'materials', 'travel', 'flat_rate', 'discount', 'late_fee'));

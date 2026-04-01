-- ============================================================
-- 032_reminders_recurring.sql
-- Phase 34: Invoice reminders idempotency, late fee settings,
--           recurring invoice columns
-- ============================================================

-- ============================================================
-- invoice_reminders (idempotency table, per D-11)
-- ============================================================
CREATE TABLE invoice_reminders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reminder_type   text NOT NULL
    CHECK (reminder_type IN ('before_3', 'due_date', 'overdue_3', 'overdue_7')),
  sent_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (invoice_id, reminder_type)
);

ALTER TABLE invoice_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoice_reminders_tenant_own" ON invoice_reminders
  FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

CREATE POLICY "service_role_all_invoice_reminders" ON invoice_reminders
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- Late fee settings on invoice_settings (per D-14, D-15)
-- ============================================================
ALTER TABLE invoice_settings ADD COLUMN late_fee_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE invoice_settings ADD COLUMN late_fee_type text NOT NULL DEFAULT 'flat'
  CHECK (late_fee_type IN ('flat', 'percentage'));
ALTER TABLE invoice_settings ADD COLUMN late_fee_amount numeric(10,2) NOT NULL DEFAULT 0;

-- ============================================================
-- Reminders + recurring columns on invoices (per D-12, D-16, D-17, D-18)
-- ============================================================
ALTER TABLE invoices ADD COLUMN reminders_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE invoices ADD COLUMN late_fee_applied_at timestamptz;
ALTER TABLE invoices ADD COLUMN is_recurring_template boolean NOT NULL DEFAULT false;
ALTER TABLE invoices ADD COLUMN recurring_frequency text
  CHECK (recurring_frequency IN ('weekly', 'monthly', 'quarterly', 'annually'));
ALTER TABLE invoices ADD COLUMN recurring_start_date date;
ALTER TABLE invoices ADD COLUMN recurring_end_date date;
ALTER TABLE invoices ADD COLUMN recurring_next_date date;
ALTER TABLE invoices ADD COLUMN recurring_active boolean NOT NULL DEFAULT false;
ALTER TABLE invoices ADD COLUMN generated_from_id uuid REFERENCES invoices(id) ON DELETE SET NULL;

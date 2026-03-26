-- Migration 016: Billing notifications idempotency table
-- Phase 24-01: subscription-lifecycle-and-notifications
--
-- Tracks sent billing notifications to prevent duplicate sends.
-- Covers: trial_reminder_day_7, trial_reminder_day_12, trial_will_end, payment_failed.

CREATE TABLE billing_notifications (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  sent_at           timestamptz NOT NULL DEFAULT now(),
  metadata          jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_billing_notifications_tenant_type ON billing_notifications(tenant_id, notification_type);

ALTER TABLE billing_notifications ENABLE ROW LEVEL SECURITY;

-- Service role only — written by webhook handlers and cron jobs
CREATE POLICY service_role_all_billing_notifications ON billing_notifications
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Migration 020: Add UNIQUE constraint on billing_notifications(tenant_id, notification_type)
--
-- Eliminates TOCTOU race condition in the idempotency check (SELECT then INSERT).
-- Application code uses upsert with ignoreDuplicates as belt-and-suspenders.
--
-- Pre-migration safety: deduplicate any existing rows before adding the constraint.

DELETE FROM billing_notifications
WHERE id NOT IN (
  SELECT DISTINCT ON (tenant_id, notification_type) id
  FROM billing_notifications
  ORDER BY tenant_id, notification_type, created_at ASC
);

ALTER TABLE billing_notifications
  ADD CONSTRAINT uq_billing_notifications_tenant_type
  UNIQUE (tenant_id, notification_type);

-- ============================================================
-- 063_estimates_customer_id.sql
-- Prod-readiness 2026-06: repoint estimates off dropped leads schema.
-- ============================================================
--
-- Migration 061 dropped the legacy `leads` table along with estimates.lead_id's
-- FK target. Phase 59 replaced leads with customers/jobs/inquiries. Estimates are
-- customer-facing quotes (not booked work), so the natural new linkage is to a
-- CUSTOMER, not a job. This migration adds a nullable customer_id column with a
-- FK → customers(id) ON DELETE SET NULL, mirroring the original lead_id semantics.
--
-- NO BACKFILL: existing estimates retain their denormalized customer snapshot
-- (customer_name / customer_phone / customer_email / customer_address columns).
-- The dropped leads table is gone, so there is no source to backfill from anyway.
--
-- Pattern source: 030_estimates_schema.sql (estimates table + index style) +
--                 059_customers_jobs_inquiries.sql (invoices.job_id additive FK
--                 ON DELETE SET NULL, tenant-scoped composite index style).
--
-- All changes additive. Historical rows remain valid (new column NULL).

BEGIN;

-- Nullable FK → customers. ON DELETE SET NULL: deleting a customer must not
-- cascade-delete their estimates (mirrors the old leads ON DELETE SET NULL).
ALTER TABLE estimates
  ADD COLUMN customer_id uuid REFERENCES customers(id) ON DELETE SET NULL;

-- Composite index for tenant-scoped customer lookups (estimate timeline / customer detail).
CREATE INDEX idx_estimates_tenant_customer ON estimates(tenant_id, customer_id);

COMMIT;

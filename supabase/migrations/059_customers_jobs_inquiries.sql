-- ============================================================
-- 059_customers_jobs_inquiries.sql
-- Phase 59: Customer/Job model separation — CREATE + backfill.
-- ============================================================

-- 059 — Phase 59 Customer/Job model separation: create new schema + backfill.
-- Per CONTEXT D-01: two-phase cutover. 061 (Plan 08) drops legacy after Python agent lockstep.
-- Per CONTEXT D-02a: FROM COMMIT FORWARD, legacy leads/lead_calls are READ-ONLY.
--   All writers (Next.js API routes + Python agent via record_call_outcome RPC) write
--   exclusively to customers/jobs/inquiries. NO DUAL-WRITE. Legacy tables exist only as
--   rollback snapshot until Plan 08.
-- Per CONTEXT D-02b: Forward-fix-only rollback. No down-migration. If downstream deploy
--   fails, fix the code and redeploy — do NOT revert this migration.
-- Per CONTEXT D-13a/b/c: backfill preserves orphan-lead status verbatim, collapses
--   duplicate-phone leads by (tenant_id, phone) with latest name/address wins, and
--   applies NO quality filtering (test/spam data backfills as-is; owner cleans up).
-- Per CONTEXT D-19 expanded (2026-04-21): customer_merge_audit table retained forever.
-- Per CONTEXT D-12a: activity_log.event_type strict enum migration is deliberately
--   DEFERRED to Plan 08 / 061. 059 only adds the three new FK columns.

BEGIN;

-- ============================================================
-- Section 1: CREATE TABLE (6 tables)
-- ============================================================

-- customers: one row per (tenant_id, phone_e164). D-05 dedup key.
-- merged_into + merged_at: D-19 soft-delete support (source gets merged_into = target).
-- merge_snapshot: D-19 undo — stores repointed child IDs so unmerge_customer RPC
--   knows exactly which rows to reverse (prevents blanket UPDATE from clobbering later changes).
CREATE TABLE customers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone_e164       text NOT NULL,
  name             text,
  default_address  text,
  email            text,
  notes            text,
  tags             text[] NOT NULL DEFAULT '{}',
  merged_into      uuid REFERENCES customers(id) ON DELETE SET NULL,
  merged_at        timestamptz,
  merge_snapshot   jsonb,  -- D-19 undo: JSON of {jobs:[...], inquiries:[...], ...} repointed child IDs
  lifetime_value   numeric(12,2) NOT NULL DEFAULT 0,  -- denormalized; live-computed at dev scale (Pitfall 3)
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, phone_e164)  -- D-05: dedup enforced at DB level
);

-- inquiries: D-07 unbooked calls. status 3-value enum.
-- converted_to_job_id added via ALTER TABLE below (after jobs is created — circular FK pair).
-- NOTE (D-07a): stale open inquiries stay open indefinitely — owner's responsibility. No cron/auto-timeout in V1.
CREATE TABLE inquiries (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id      uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  job_type         text,
  service_address  text,
  urgency          text NOT NULL DEFAULT 'routine'
    CHECK (urgency IN ('emergency', 'urgent', 'routine')),
  status           text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'converted', 'lost')),  -- D-07: minimal 3-state enum (no follow_up_scheduled in V1 per D-07a)
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
  -- converted_to_job_id added below after jobs table is created (circular FK)
);

-- jobs: D-06 strict 1:1 with appointments. appointment_id NOT NULL + UNIQUE enforced.
-- originated_as_inquiry_id: D-10 audit FK — same-call auto-convert sets this (references inquiries above).
CREATE TABLE jobs (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id               uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  appointment_id            uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,  -- D-06: strict 1:1 with appointments
  originated_as_inquiry_id  uuid REFERENCES inquiries(id) ON DELETE SET NULL,  -- D-10: same-call auto-convert audit FK
  status                    text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'completed', 'paid', 'cancelled', 'lost')),  -- D-07 / D-09
  urgency                   text NOT NULL DEFAULT 'routine'
    CHECK (urgency IN ('emergency', 'urgent', 'routine')),  -- matches appointments post-036
  revenue_amount            numeric(10,2),
  is_vip                    boolean NOT NULL DEFAULT false,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (appointment_id)   -- D-06: enforce 1:1; prevents double-job for same appointment
);

-- Close the circular FK: inquiries.converted_to_job_id → jobs.id (D-10 audit FK set on conversion)
ALTER TABLE inquiries
  ADD COLUMN converted_to_job_id uuid REFERENCES jobs(id) ON DELETE SET NULL;

-- customer_calls: D-16 junction — a call links to one customer always.
CREATE TABLE customer_calls (
  customer_id  uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  call_id      uuid NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  PRIMARY KEY (customer_id, call_id)
);

-- job_calls: D-16 junction — a call links optionally to one job.
CREATE TABLE job_calls (
  job_id   uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  call_id  uuid NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  PRIMARY KEY (job_id, call_id)
);

-- customer_merge_audit: D-19 expanded (2026-04-21). Retention: FOREVER.
-- Plan 03 RPCs (merge_customer / unmerge_customer) write here.
-- Plan 07 surfaces an admin "Merges" view reading this table.
-- row_counts JSONB: {jobs, inquiries, invoices, activity_log, customer_calls, job_calls}
CREATE TABLE customer_merge_audit (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  target_customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  merged_by          uuid REFERENCES auth.users(id),      -- nullable; service-role merges have no user
  merged_at          timestamptz NOT NULL DEFAULT now(),
  unmerged_at        timestamptz NULL,
  row_counts         jsonb NOT NULL DEFAULT '{}'::jsonb  -- {jobs, inquiries, invoices, activity_log, customer_calls, job_calls}
);
-- Retention: FOREVER. Plan 03 RPCs (merge_customer / unmerge_customer) write here.
-- Plan 07 surfaces an admin "Merges" view reading this table.

-- ============================================================
-- Section 2: Indexes
-- ============================================================

CREATE INDEX idx_customers_tenant_phone ON customers(tenant_id, phone_e164) WHERE merged_into IS NULL;
CREATE INDEX idx_jobs_tenant_status_created ON jobs(tenant_id, status, created_at DESC);
CREATE INDEX idx_jobs_customer ON jobs(customer_id);
CREATE INDEX idx_inquiries_tenant_status_created ON inquiries(tenant_id, status, created_at DESC);
CREATE INDEX idx_inquiries_customer ON inquiries(customer_id);
CREATE INDEX idx_customers_merged_at ON customers(merged_at) WHERE merged_into IS NOT NULL;  -- for 7-day undo window queries
CREATE INDEX idx_customer_merge_audit_tenant_merged_at ON customer_merge_audit(tenant_id, merged_at DESC);
CREATE INDEX idx_customer_merge_audit_source ON customer_merge_audit(source_customer_id) WHERE unmerged_at IS NULL;

-- ============================================================
-- Section 3: RLS — 2 policies per table (12 total)
-- ============================================================
-- Mirror leads pattern from 004_leads_crm.sql exactly:
--   tenant_own: FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()))
--   service_role_all: FOR ALL USING (auth.role() = 'service_role')

-- customers (direct tenant_id column)
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customers_tenant_own" ON customers
  FOR ALL
  USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));
CREATE POLICY "service_role_all_customers" ON customers FOR ALL USING (auth.role() = 'service_role');

-- jobs (direct tenant_id column)
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jobs_tenant_own" ON jobs
  FOR ALL
  USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));
CREATE POLICY "service_role_all_jobs" ON jobs FOR ALL USING (auth.role() = 'service_role');

-- inquiries (direct tenant_id column)
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inquiries_tenant_own" ON inquiries
  FOR ALL
  USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));
CREATE POLICY "service_role_all_inquiries" ON inquiries FOR ALL USING (auth.role() = 'service_role');

-- customer_calls (no direct tenant_id — join through customers)
ALTER TABLE customer_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customer_calls_tenant_own" ON customer_calls
  FOR ALL
  USING (customer_id IN (
    SELECT id FROM customers
    WHERE tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid())
  ))
  WITH CHECK (customer_id IN (
    SELECT id FROM customers
    WHERE tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid())
  ));
CREATE POLICY "service_role_all_customer_calls" ON customer_calls FOR ALL USING (auth.role() = 'service_role');

-- job_calls (no direct tenant_id — join through jobs)
ALTER TABLE job_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "job_calls_tenant_own" ON job_calls
  FOR ALL
  USING (job_id IN (
    SELECT id FROM jobs
    WHERE tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid())
  ))
  WITH CHECK (job_id IN (
    SELECT id FROM jobs
    WHERE tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid())
  ));
CREATE POLICY "service_role_all_job_calls" ON job_calls FOR ALL USING (auth.role() = 'service_role');

-- customer_merge_audit (direct tenant_id column)
ALTER TABLE customer_merge_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customer_merge_audit_tenant_own" ON customer_merge_audit
  FOR ALL
  USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));
CREATE POLICY "service_role_all_customer_merge_audit" ON customer_merge_audit FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- Section 4: Realtime (D-15)
-- ============================================================
-- Publish customers, jobs, inquiries — NOT customer_calls / job_calls / customer_merge_audit
-- (derived / audit-only data; no dashboard subscription needed per Claude's discretion)
ALTER PUBLICATION supabase_realtime ADD TABLE customers, jobs, inquiries;
ALTER TABLE customers REPLICA IDENTITY FULL;
ALTER TABLE jobs REPLICA IDENTITY FULL;
ALTER TABLE inquiries REPLICA IDENTITY FULL;

-- ============================================================
-- Section 5: NEW columns on existing tables
-- ============================================================

-- D-11: invoices.job_id — NULLABLE in 059 per Pitfall 1.
-- Plan 08 inspects COUNT(*) WHERE lead_id IS NOT NULL AND job_id IS NULL — if 0, flips to NOT NULL;
-- if > 0, escalates to discuss-phase.
ALTER TABLE invoices
  ADD COLUMN job_id uuid REFERENCES jobs(id) ON DELETE SET NULL;
-- invoices.lead_id STAYS; Plan 08 drops after manual survey of NULL rows confirms coverage.

-- D-12: activity_log three new FK columns (customer_id, job_id, inquiry_id).
-- NOTE (D-12a): activity_log.event_type strict enum migration is deliberately DEFERRED to Plan 08 / 061.
-- Rationale: 059 is already large; coercing event_type to the strict 16-value enum requires
-- first verifying backfill coverage mapped every legacy row into one of the enum values.
-- Plan 08 / 061 adds the enum type + ALTER COLUMN TYPE coercion atomically.
ALTER TABLE activity_log
  ADD COLUMN customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  ADD COLUMN job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  ADD COLUMN inquiry_id uuid REFERENCES inquiries(id) ON DELETE SET NULL;
-- activity_log.lead_id STAYS NOT NULL in 059; Plan 08 flips to NULLABLE + drops after verifying backfill coverage.

-- ============================================================
-- Section 6: Backfill from legacy tables
-- ============================================================

-- ----
-- 5a: Customers backfill (D-13b duplicate-phone collapse with LATEST-WINS for name/address)
-- D-13b: GROUP BY (tenant_id, from_number). One customer per group.
-- Name + default_address come from the MOST RECENT lead in the group (ORDER BY created_at DESC LIMIT 1
-- via array_agg ordering).
-- D-13c: no WHERE filter beyond phone-non-null. Test/spam data backfills as-is.
-- ----
INSERT INTO customers (tenant_id, phone_e164, name, default_address, created_at, updated_at)
SELECT
  tenant_id,
  from_number,
  (array_agg(caller_name ORDER BY created_at DESC) FILTER (WHERE caller_name IS NOT NULL))[1] AS latest_name,
  (array_agg(service_address ORDER BY created_at DESC) FILTER (WHERE service_address IS NOT NULL))[1] AS latest_address,
  MIN(created_at),
  MAX(updated_at)
FROM leads
WHERE from_number IS NOT NULL
GROUP BY tenant_id, from_number
ON CONFLICT (tenant_id, phone_e164) DO NOTHING;

-- ----
-- 5b: Jobs backfill (D-13c no filter; status mapping: booked→scheduled, etc.)
-- ----
INSERT INTO jobs (tenant_id, customer_id, appointment_id, status, urgency, revenue_amount, is_vip, created_at, updated_at)
SELECT
  l.tenant_id,
  c.id,
  l.appointment_id,
  CASE l.status
    WHEN 'new'       THEN 'scheduled'
    WHEN 'booked'    THEN 'scheduled'
    WHEN 'completed' THEN 'completed'
    WHEN 'paid'      THEN 'paid'
    WHEN 'lost'      THEN 'lost'
    ELSE 'scheduled'
  END,
  COALESCE(l.urgency, 'routine'),
  l.revenue_amount,
  COALESCE(l.is_vip, false),
  l.created_at,
  l.updated_at
FROM leads l
JOIN customers c ON c.tenant_id = l.tenant_id AND c.phone_e164 = l.from_number
WHERE l.appointment_id IS NOT NULL
ON CONFLICT (appointment_id) DO NOTHING;

-- ----
-- 5c: Inquiries backfill (D-13a orphan handling — preserve lead.status verbatim)
-- D-13a: orphan leads (appointment_id IS NULL) become Inquiries with status preserved verbatim.
-- open → open, lost → lost. Any 'new'/'followup' legacy values map to 'open' (the only sensible
-- inbox-state equivalent); 'converted' should never appear on an orphan (that status implies a
-- job existed), but if it does, map to 'converted' unchanged.
-- ----
INSERT INTO inquiries (tenant_id, customer_id, job_type, service_address, urgency, status, created_at, updated_at)
SELECT
  l.tenant_id,
  c.id,
  l.job_type,
  l.service_address,
  COALESCE(l.urgency, 'routine'),
  CASE l.status
    WHEN 'open'      THEN 'open'
    WHEN 'lost'      THEN 'lost'
    WHEN 'converted' THEN 'converted'
    WHEN 'new'       THEN 'open'        -- legacy 'new' → inbox 'open'
    WHEN 'followup'  THEN 'open'        -- legacy 'followup' → inbox 'open' (D-07a: no follow_up_scheduled state in V1)
    ELSE 'open'                         -- any unknown legacy status defaults to 'open' per D-13a spirit
  END,
  l.created_at,
  l.updated_at
FROM leads l
JOIN customers c ON c.tenant_id = l.tenant_id AND c.phone_e164 = l.from_number
WHERE l.appointment_id IS NULL;

-- ----
-- 5d: Junction tables backfill (D-16)
-- ----
INSERT INTO customer_calls (customer_id, call_id)
SELECT DISTINCT c.id, lc.call_id
FROM lead_calls lc
JOIN leads l ON l.id = lc.lead_id
JOIN customers c ON c.tenant_id = l.tenant_id AND c.phone_e164 = l.from_number
ON CONFLICT DO NOTHING;

INSERT INTO job_calls (job_id, call_id)
SELECT j.id, lc.call_id
FROM lead_calls lc
JOIN leads l ON l.id = lc.lead_id AND l.appointment_id IS NOT NULL
JOIN jobs j ON j.appointment_id = l.appointment_id
ON CONFLICT DO NOTHING;

-- ----
-- 6: Invoice FK backfill (D-11)
-- Per Pitfall 1 + D-11 tension: NOT NULL enforcement deferred to Plan 08 after manual survey
-- of NULL rows. Plan 08 task inspects COUNT(*) WHERE lead_id IS NOT NULL AND job_id IS NULL —
-- if 0, flips to NOT NULL; if > 0, escalates to discuss-phase.
-- ----
UPDATE invoices i
SET job_id = j.id
FROM leads l
JOIN jobs j ON j.appointment_id = l.appointment_id
WHERE i.lead_id = l.id
  AND l.appointment_id IS NOT NULL;

-- ----
-- 7: activity_log backfill (D-12, D-13)
-- Plan 08 flips activity_log.customer_id to NOT NULL + drops lead_id AFTER verifying 100% coverage.
-- Plan 08 also adds the event_type strict enum (D-12a) after verifying every legacy event_type
-- value maps to one of the 16 starting enum values.
-- ----
UPDATE activity_log a
SET
  customer_id = c.id,
  job_id      = CASE WHEN l.appointment_id IS NOT NULL THEN j.id ELSE NULL END,
  inquiry_id  = CASE WHEN l.appointment_id IS NULL THEN i.id ELSE NULL END
FROM leads l
LEFT JOIN customers c ON c.tenant_id = l.tenant_id AND c.phone_e164 = l.from_number
LEFT JOIN jobs j ON j.appointment_id = l.appointment_id
LEFT JOIN inquiries i ON i.tenant_id = l.tenant_id AND i.customer_id = c.id AND i.created_at = l.created_at
WHERE a.lead_id = l.id;
-- Plan 08 flips activity_log.customer_id to NOT NULL + drops lead_id AFTER verifying 100% coverage.
-- Plan 08 also adds the event_type strict enum (D-12a) after verifying every legacy event_type
-- value maps to one of the 16 starting enum values.

-- ============================================================
-- DO NOT in 059:
--   DROP TABLE leads
--   DROP TABLE lead_calls
--   DROP COLUMN invoices.lead_id
--   DROP COLUMN activity_log.lead_id
--   ALTER COLUMN activity_log.customer_id SET NOT NULL
--   CREATE TYPE event_type (Plan 08 / 061 owns this per D-12a)
--   CREATE FUNCTION record_call_outcome (Plan 03 owns this)
--   CREATE FUNCTION merge_customer / unmerge_customer (Plan 03 owns this)
-- Per D-02: forward-only, no down script.
-- Per D-02b: no revert; forward-fix only.
-- Per Pitfall 5: legacy tables retained until Plan 08 confirms Python agent redeployed.
-- ============================================================

COMMIT;

-- READ-ONLY AUDIT. Do not run via supabase db push. Run manually before 053a.
--
-- Purpose: Validate data assumptions in the leads + invoices tables before
-- running the Phase 59 Plan 02 migration (053a) that creates the customers
-- and jobs tables. Output of these queries determines whether 053a can
-- proceed as-designed or whether a fix-up pass is needed first.
--
-- D-13c: This audit makes NO quality judgments — do not filter test/spam data.
-- Backfill in Plan 02 processes every row as-is; owner deletes test customers
-- and inquiries post-cutover.
--
-- How to run:
--   supabase db execute --file supabase/migrations/053_pre_audit.sql
--   OR: psql $DATABASE_URL -f supabase/migrations/053_pre_audit.sql
--
-- Expected clean-slate output (no legacy data):
--   non_e164_phones               = 0
--   invoices_for_unbooked_leads   = 0
--
-- These counts also seed the assertions in tests/migrations/test_053_backfill.py
-- (expected_customers / expected_jobs / expected_inquiries) and the D-13a/D-13b
-- backfill correctness checks in Plan 02.

-- -----------------------------------------------------------------------
-- Pitfall 2 (A2): leads.from_number not in E.164
-- -----------------------------------------------------------------------

-- Count of leads whose from_number is NULL or does not match E.164 regex.
-- Expected: 0 before running 053a. Any non-zero count requires a data fix-up.
SELECT COUNT(*) AS non_e164_phones FROM leads
WHERE from_number IS NULL OR from_number !~ '^\+[1-9]\d{6,14}$';

-- Sample the offenders (up to 50 rows) so the operator can inspect raw values.
SELECT DISTINCT from_number FROM leads
WHERE from_number IS NULL OR from_number !~ '^\+[1-9]\d{6,14}$'
LIMIT 50;

-- -----------------------------------------------------------------------
-- Pitfall 1 (A3): invoices attached to leads with NULL appointment_id
-- -----------------------------------------------------------------------

-- Invoices that belong to leads with no confirmed appointment.
-- These would be orphaned when invoices.lead_id is repointed to jobs.id
-- (since jobs require appointment_id IS NOT NULL).
-- Expected: 0 before running 053a.
SELECT COUNT(*) AS invoices_for_unbooked_leads
FROM invoices i
JOIN leads l ON l.id = i.lead_id
WHERE l.appointment_id IS NULL;

-- Orphaned invoices (no lead at all — ad-hoc)
SELECT COUNT(*) AS invoices_without_lead FROM invoices WHERE lead_id IS NULL;

-- -----------------------------------------------------------------------
-- Post-migration row count predictions (used by test_053_backfill.py)
-- -----------------------------------------------------------------------

-- Number of distinct (tenant_id, from_number) pairs = expected customers after backfill.
-- D-13b dedup key: this count IS the post-collapse customer count.
SELECT COUNT(*) AS expected_customers FROM (
  SELECT DISTINCT tenant_id, from_number FROM leads WHERE from_number IS NOT NULL
) s;

-- Leads with a confirmed appointment = expected jobs after backfill (D-06: booked work only).
SELECT COUNT(*) AS expected_jobs FROM leads WHERE appointment_id IS NOT NULL;

-- Leads without a confirmed appointment = expected inquiries after backfill (D-13a orphan branch).
SELECT COUNT(*) AS expected_inquiries FROM leads WHERE appointment_id IS NULL;

-- -----------------------------------------------------------------------
-- D-13a: Orphan leads (no appointment_id) broken down by existing status.
-- Each row becomes an Inquiry with status preserved verbatim
-- (open → open, lost → lost, etc.).
-- -----------------------------------------------------------------------
SELECT status, COUNT(*) AS orphan_leads_by_status
FROM leads
WHERE appointment_id IS NULL
GROUP BY status
ORDER BY orphan_leads_by_status DESC;

-- -----------------------------------------------------------------------
-- D-13b: Duplicate-phone leads — groups where multiple leads share
-- (tenant_id, phone). These collapse to ONE customer per group in the
-- Plan 02 backfill, with name/address taken from the MOST RECENT lead
-- (ORDER BY created_at DESC LIMIT 1).
-- -----------------------------------------------------------------------
SELECT COUNT(*) AS duplicate_phone_groups FROM (
  SELECT tenant_id, from_number, COUNT(*) AS lead_count
  FROM leads
  WHERE from_number IS NOT NULL
  GROUP BY tenant_id, from_number
  HAVING COUNT(*) > 1
) d;

-- Total leads involved in duplicate-phone collapse (N leads → 1 customer per group)
SELECT COALESCE(SUM(lead_count), 0) AS leads_in_duplicate_groups FROM (
  SELECT tenant_id, from_number, COUNT(*) AS lead_count
  FROM leads
  WHERE from_number IS NOT NULL
  GROUP BY tenant_id, from_number
  HAVING COUNT(*) > 1
) d;

-- Sample of the largest duplicate-phone groups so the operator can sanity-check
-- that collapses look reasonable (same person repeat-calling) rather than artifacts.
SELECT tenant_id, from_number, COUNT(*) AS lead_count,
       array_agg(DISTINCT caller_name) AS names_seen,
       MIN(created_at) AS first_seen,
       MAX(created_at) AS last_seen
FROM leads
WHERE from_number IS NOT NULL
GROUP BY tenant_id, from_number
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC
LIMIT 20;

-- -----------------------------------------------------------------------
-- Cross-check: expected_customers + duplicate_phone_groups relationship.
-- expected_customers = distinct (tenant_id, from_number) pairs — already collapsed.
-- Internal consistency: (total_leads_with_phone - distinct_tenant_phone_pairs)
-- should equal (leads_in_duplicate_groups - duplicate_phone_groups).
-- -----------------------------------------------------------------------
SELECT
  (SELECT COUNT(*) FROM leads WHERE from_number IS NOT NULL) AS total_leads_with_phone,
  (SELECT COUNT(*) FROM (SELECT DISTINCT tenant_id, from_number FROM leads WHERE from_number IS NOT NULL) s) AS distinct_tenant_phone_pairs;

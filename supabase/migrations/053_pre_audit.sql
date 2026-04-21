-- READ-ONLY AUDIT. Do not run via supabase db push. Run manually before 053a.
--
-- Purpose: Validate data assumptions in the leads + invoices tables before
-- running the Phase 59 Plan 02 migration (053a) that creates the customers
-- and jobs tables. Output of these queries determines whether 053a can
-- proceed as-designed or whether a fix-up pass is needed first.
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
-- (expected_customers / expected_jobs / expected_inquiries).

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

-- -----------------------------------------------------------------------
-- Orphaned invoices (no lead at all)
-- -----------------------------------------------------------------------
SELECT COUNT(*) AS invoices_without_lead FROM invoices WHERE lead_id IS NULL;

-- -----------------------------------------------------------------------
-- Post-migration row count predictions (used by test_053_backfill.py)
-- -----------------------------------------------------------------------

-- Number of distinct (tenant_id, from_number) pairs = expected customers after backfill.
SELECT COUNT(*) AS expected_customers FROM (
  SELECT DISTINCT tenant_id, from_number FROM leads WHERE from_number IS NOT NULL
) s;

-- Leads with a confirmed appointment = expected jobs after backfill.
SELECT COUNT(*) AS expected_jobs FROM leads WHERE appointment_id IS NOT NULL;

-- Leads without a confirmed appointment = expected inquiries after backfill.
SELECT COUNT(*) AS expected_inquiries FROM leads WHERE appointment_id IS NULL;

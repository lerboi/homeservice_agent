-- 061 — Phase 59 Customer/Job model separation: drop legacy schema + event_type enum.
-- Depends on: Plan 05 Python agent deployed (no more writes to leads/lead_calls) — verified
--             by live test call in Task 2 of this plan BEFORE this migration runs.
--             Plan 02 migration 059 successfully backfilled.
-- Pitfall 1 + 5 resolution checkpoint; see Task 2 human-verify survey.
-- D-01: Ships same PR / same day as 059 after Python agent verified on new RPC.
-- D-02b: Forward-fix-only rollback. No down-migration exists or will be written.
--        If 061 applies successfully but downstream breaks, fix forward — do NOT
--        author a 053c_restore_leads.sql or any Phase 59 down-migration.
-- D-12a: Create activity_log.event_type strict enum with 16 starting values verbatim.
--        Adding new values requires a future migration — deliberate friction
--        keeps analytics from accumulating free-form drift.

BEGIN;

-- ========================================================================
-- D-12a: activity_log.event_type STRICT ENUM (16 starting values)
-- Adding new values requires a future migration — deliberate friction
-- keeps analytics from accumulating free-form drift.
-- ========================================================================
CREATE TYPE activity_event_type AS ENUM (
  'call_received',
  'inquiry_opened',
  'inquiry_converted',
  'inquiry_lost',
  'job_booked',
  'job_completed',
  'job_paid',
  'job_cancelled',
  'customer_created',
  'customer_updated',
  'customer_merged',
  'customer_unmerged',
  'invoice_created',
  'invoice_paid',
  'invoice_voided',
  'other'
);

-- Coerce existing activity_log.event_type column into the enum.
-- Pre-push Task 2 survey confirms every legacy value maps to one of the 16.
-- Unknown legacy values fall through to 'other' via the CASE below.
ALTER TABLE activity_log
  ALTER COLUMN event_type TYPE activity_event_type
  USING (
    CASE event_type
      WHEN 'call_received'     THEN 'call_received'::activity_event_type
      WHEN 'inquiry_opened'    THEN 'inquiry_opened'::activity_event_type
      WHEN 'inquiry_converted' THEN 'inquiry_converted'::activity_event_type
      WHEN 'inquiry_lost'      THEN 'inquiry_lost'::activity_event_type
      WHEN 'job_booked'        THEN 'job_booked'::activity_event_type
      WHEN 'job_completed'     THEN 'job_completed'::activity_event_type
      WHEN 'job_paid'          THEN 'job_paid'::activity_event_type
      WHEN 'job_cancelled'     THEN 'job_cancelled'::activity_event_type
      WHEN 'customer_created'  THEN 'customer_created'::activity_event_type
      WHEN 'customer_updated'  THEN 'customer_updated'::activity_event_type
      WHEN 'customer_merged'   THEN 'customer_merged'::activity_event_type
      WHEN 'customer_unmerged' THEN 'customer_unmerged'::activity_event_type
      WHEN 'invoice_created'   THEN 'invoice_created'::activity_event_type
      WHEN 'invoice_paid'      THEN 'invoice_paid'::activity_event_type
      WHEN 'invoice_voided'    THEN 'invoice_voided'::activity_event_type
      ELSE                          'other'::activity_event_type
    END
  );

-- ========================================================================
-- activity_log.customer_id stays NULLABLE.
-- Rationale: system events (billing, subscription, integration_fetch,
-- setup_checklist, etc.) legitimately have no customer context. The
-- record_call_outcome RPC always populates customer_id for call events,
-- which is where the invariant actually matters. Forcing NOT NULL on the
-- column would require deleting or synthesizing customers for non-call
-- events, which is wrong. (Original design aspiration overridden by real
-- data — Task 2 survey on 2026-04-21 found non-zero NULLs for system
-- event types.)
-- ========================================================================

-- Drop lead_id from activity_log (backfilled in 059; no longer needed)
ALTER TABLE activity_log DROP COLUMN lead_id;

-- ========================================================================
-- invoices.job_id NOT NULL flip —
-- CONDITIONAL per Task 3 survey result (Survey 2). If survey returned 0 rows with
-- lead_id IS NOT NULL AND job_id IS NULL, uncomment the NOT NULL line below
-- before push. If survey returned >0, leave commented and file a follow-up
-- issue to reconcile ad-hoc invoices per D-11.
-- ========================================================================
-- ALTER TABLE invoices ALTER COLUMN job_id SET NOT NULL;  -- ENABLE IF TASK 3 SURVEY 2 = 0

-- Drop lead_id from invoices (backfilled in 059; no longer needed)
ALTER TABLE invoices DROP COLUMN lead_id;

-- ========================================================================
-- Drop legacy tables
-- (059's Realtime publication entry added customers/jobs/inquiries;
--  leads/lead_calls Realtime entries cascade automatically with DROP TABLE)
-- ========================================================================
DROP TABLE IF EXISTS lead_calls;
DROP TABLE IF EXISTS leads;

COMMIT;

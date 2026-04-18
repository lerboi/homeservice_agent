-- Migration 055: Jobber schedule mirror foundation
-- Phase 57 — JOBSCHED-01, JOBSCHED-04, JOBSCHED-07
-- Widens calendar_events.provider CHECK to include 'jobber',
-- adds bookable-users storage on accounting_credentials,
-- adds forward-compat idempotency column on appointments.

-- Step 1: Widen calendar_events.provider CHECK to include 'jobber'.
-- Defensive drop: constraint name may have been auto-generated differently
-- across environments. Find-and-drop any CHECK on calendar_events whose body
-- references the `provider` column, then recreate with the widened list.
DO $$
DECLARE
  check_name text;
BEGIN
  SELECT conname INTO check_name
  FROM pg_constraint
  WHERE conrelid = 'calendar_events'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%provider%';
  IF check_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE calendar_events DROP CONSTRAINT %I', check_name);
  END IF;
END $$;

ALTER TABLE calendar_events
  ADD CONSTRAINT calendar_events_provider_check
  CHECK (provider IN ('google', 'outlook', 'jobber'));

-- Step 2: Per-tenant bookable Jobber user IDs.
-- NULL = not yet configured (mirror all). [] = explicit empty.
-- [...ids] = intersect visits whose assigned_user_id ∈ this set (D-01, D-04).
-- Unassigned visits ALWAYS pass through regardless of this set (D-05).
ALTER TABLE accounting_credentials
  ADD COLUMN IF NOT EXISTS jobber_bookable_user_ids TEXT[];

COMMENT ON COLUMN accounting_credentials.jobber_bookable_user_ids IS
  'Phase 57: per-tenant bookable Jobber user IDs. NULL=not configured (mirror all); []=explicit empty; [...ids]=intersect. D-01/D-04/D-05.';

-- Step 2b: Dedicated cursor for the Jobber schedule poll cron (JOBSCHED-03).
-- Kept SEPARATE from accounting_credentials.last_context_fetch_at, which Phase 56
-- customer-context fetches advance. Overloading would cause: a customer-context
-- GraphQL call between polls advances the cursor; the next poll reads
-- updatedAfter=<that moment> and MISSES every visit updated between the previous
-- poll and that customer-context touch. See RESEARCH line ~496 RESOLVED note.
ALTER TABLE accounting_credentials
  ADD COLUMN IF NOT EXISTS jobber_last_schedule_poll_at TIMESTAMPTZ;

COMMENT ON COLUMN accounting_credentials.jobber_last_schedule_poll_at IS
  'Phase 57: dedicated cursor for /api/cron/poll-jobber-visits. Advanced ONLY by the schedule poll path, never by customer-context fetches. NULL on first run — cron falls back to now()-1h.';

-- Step 3: Forward-compat idempotency key for Phase 999.3 push (JOBSCHED-07).
-- NOTE ON IDEMPOTENCY MAPPING (D-13):
--   - appointments.id (existing UUID, generated at Voco booking time) is the
--     Voco-side idempotency key. Phase 999.3 will send it as an external
--     reference on the Jobber create-visit mutation so Jobber-side retries
--     collapse to the same visit.
--   - appointments.jobber_visit_id (added below) is the POST-PUSH
--     acknowledgement column — populated once Jobber returns the visit ID.
--     Presence of a non-NULL value switches the "Not in Jobber yet" pill off
--     in the UI (Plan 05) and prevents re-push.
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS jobber_visit_id TEXT;

COMMENT ON COLUMN appointments.jobber_visit_id IS
  'Phase 57 (forward-compat for Phase 999.3): Jobber visit ID once this appointment has been pushed. NULL = not-yet-pushed (drives "Not in Jobber yet" pill). JOBSCHED-07.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_jobber_visit_id_unique
  ON appointments (jobber_visit_id)
  WHERE jobber_visit_id IS NOT NULL;

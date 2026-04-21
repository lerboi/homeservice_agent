-- D-06: jobs.appointment_id NOT NULL UNIQUE enforced
-- TODO(Plan 02): uncomment after 053a migration applied

-- This scaffold verifies the jobs table constraints once Plan 02 creates the table.
-- Run manually via psql after 053a is applied and before running Plan 03.
--
-- How to run:
--   psql $DATABASE_URL -f tests/db/test_jobs_constraints.sql

-- ---- Scaffold placeholder (Plan 02 will enable) ----
-- DO $$ BEGIN
--   INSERT INTO jobs (tenant_id, customer_id) VALUES (
--     '00000000-0000-0000-0000-000000000000',
--     '00000000-0000-0000-0000-000000000001'
--   );
--   RAISE EXCEPTION 'should have failed: appointment_id is NOT NULL';
-- EXCEPTION WHEN not_null_violation THEN
--   NULL; -- expected
-- END $$;

-- DO $$ BEGIN
--   INSERT INTO jobs (tenant_id, customer_id, appointment_id) VALUES (
--     '00000000-0000-0000-0000-000000000000',
--     '00000000-0000-0000-0000-000000000001',
--     '00000000-0000-0000-0000-000000000002'
--   );
--   INSERT INTO jobs (tenant_id, customer_id, appointment_id) VALUES (
--     '00000000-0000-0000-0000-000000000000',
--     '00000000-0000-0000-0000-000000000001',
--     '00000000-0000-0000-0000-000000000002'
--   );
--   RAISE EXCEPTION 'should have failed: appointment_id UNIQUE violation';
-- EXCEPTION WHEN unique_violation THEN
--   NULL; -- expected
-- END $$;

SELECT 'scaffold' AS status;

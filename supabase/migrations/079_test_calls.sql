-- 079: Test-call isolation flag on calls
--
-- Web/admin test calls (and onboarding phone test calls) get a durable marker
-- on their calls row so every tenant-facing surface and cron can exclude them:
--   1. The Python agent writes is_test_call = true on the calls upsert when the
--      LiveKit room metadata carries { test_call: true }. It only includes the
--      column for TEST calls, so production call inserts never reference it
--      (fail-open if this migration lags the agent deploy — but apply this
--      BEFORE deploying the main repo, whose filters DO reference the column).
--   2. Dashboard surfaces filter it out: /api/calls, /api/dashboard/stats
--      (missed-calls-today), /api/search (calls group), and the calls page
--      Realtime handlers skip flagged rows client-side.
--   3. The recovery-SMS cron (Branch A) excludes flagged calls so a simulated
--      caller number is never texted.
--
-- NOT NULL DEFAULT false keeps every existing and future production row
-- filterable with a plain .eq('is_test_call', false).

ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS is_test_call boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN calls.is_test_call IS
  'True when this call was a test call (admin web test console or onboarding phone test). Excluded from dashboard surfaces, stats, search, and the recovery-SMS cron.';

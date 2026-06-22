-- 077: test-call verification
--
-- Distinguishes a test call that ACTUALLY CONNECTED from mere onboarding
-- completion. Flow:
--   1. /api/onboarding/test-call places an outbound SIP call to the owner and
--      sets test_call_status = 'calling'.
--   2. The LiveKit `participant_joined` webhook (/api/webhooks/livekit) flips
--      test_call_status = 'connected' + test_call_completed = true +
--      test_call_last_at = now() once the owner's SIP leg actually joins the
--      `test-call-*` room — i.e. the call genuinely connected.
--   3. The setup checklist's `make_test_call` item reads test_call_completed
--      (the durable "ever connected" signal); the TestCallPanel polls
--      test_call_status for the live state of the current attempt.
--
-- test_call_completed (boolean NOT NULL DEFAULT false) already exists from
-- migration 002. This migration is additive + idempotent. PENDING manual apply
-- alongside the 072–076 tail (the Supabase MCP is read-only).

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS test_call_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS test_call_last_at timestamptz;

-- Guarded so re-applying (or a pipeline replay) is a no-op.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenants_test_call_status_check'
  ) THEN
    ALTER TABLE tenants
      ADD CONSTRAINT tenants_test_call_status_check
      CHECK (test_call_status IN ('none', 'calling', 'connected', 'failed'));
  END IF;
END $$;

COMMENT ON COLUMN tenants.test_call_status IS
  'Live test-call state: none|calling|connected|failed. Set to ''calling'' by /api/onboarding/test-call and to ''connected'' by the LiveKit participant_joined webhook (/api/webhooks/livekit).';
COMMENT ON COLUMN tenants.test_call_last_at IS
  'Timestamp of the last test call that actually connected.';

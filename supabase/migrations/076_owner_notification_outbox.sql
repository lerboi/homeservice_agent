-- ============================================================
-- 076_owner_notification_outbox.sql
-- Durable outbox for failed owner missed-job ALERTS (LK-B2).
--
-- The voice agent's post-call pipeline (livekit-agent src/post_call.py §7)
-- sends the owner an SMS (Twilio) and/or email (Resend) for every call —
-- the headline "never miss a job" alert. Those sends had NO per-send timeout
-- and NO retry: on a slow/failed provider inside the 8s post-call budget the
-- alert was SILENTLY dropped (the inquiry sat in the DB, owner never pinged).
--
-- New flow (mirrors the stripe_meter_failures pattern, migration 071): each
-- send is now hard-capped (~3s) in the agent; on timeout/failure the agent
-- UPSERTs a row here, and the main-repo cron /api/cron/retry-owner-notifications
-- re-sends the STORED payload verbatim and deletes the row on success.
--
-- notification_key = '{call_id}:{channel}' (UNIQUE) keys the outbox so SMS and
-- email retry independently and duplicate failures for the same call+channel
-- collapse to one row. Delivery is at-least-once (Twilio/Resend have no
-- server-side dedupe like Stripe's meter identifier), so a rare duplicate alert
-- is possible on retry — acceptable, and far better than a missed job.
--
-- Service-role only (RLS enabled, no policies; client-role privileges revoked):
-- the Python agent (writer) and the Next.js cron (drainer) both use the
-- service-role key, which bypasses RLS.
--
-- Idempotent / re-runnable: CREATE TABLE / INDEX IF NOT EXISTS.
-- DEPLOY ORDER: apply this BEFORE deploying the Next.js cron (it names the
-- table). The Python agent's outbox write is best-effort/fail-open, so the
-- agent is safe to deploy before this is applied (it just loses retry
-- durability until the table exists — the in-band send is still attempted).
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS owner_notification_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  notification_key text NOT NULL UNIQUE,
  channel text NOT NULL CHECK (channel IN ('sms', 'email')),
  recipient text NOT NULL,
  payload jsonb NOT NULL,
  failure_reason text,
  attempts int NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE owner_notification_failures ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE owner_notification_failures FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_owner_notif_failures_created
  ON owner_notification_failures(created_at);

COMMENT ON TABLE owner_notification_failures IS
  'LK-B2 durable outbox for failed owner SMS/email alerts. Agent UPSERTs on send '
  'failure (key=call_id:channel); /api/cron/retry-owner-notifications re-sends the '
  'stored payload and deletes on success. Service-role only.';

COMMIT;

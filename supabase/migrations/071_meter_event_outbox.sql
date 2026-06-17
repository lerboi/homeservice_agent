-- ============================================================
-- 071_meter_event_outbox.sql
-- Durable outbox for failed Stripe Billing Meter overage posts.
--
-- The voice agent's post-call pipeline (livekit-agent src/post_call.py §4)
-- posts one meter event per over-quota call. A transient Stripe/network
-- failure there was permanently unbilled revenue: the increment_calls_used
-- RPC has already consumed the call_id (usage_events PK), so re-running the
-- pipeline skips the meter branch — there was no retry path.
--
-- New flow: on meter-post failure the agent INSERTs a row here; the main-repo
-- cron /api/cron/retry-meter-events re-posts with the same idempotent
-- identifier (overage_{call_id} — Stripe dedupes server-side) and deletes the
-- row on success. UNIQUE(call_id) keeps the outbox idempotent too.
--
-- Service-role only (RLS enabled, no policies; client-role privileges revoked).
--
-- Also extends activity_event_type with the two integration-telemetry values
-- the Python agent has been writing since Phase 58 — every such INSERT failed
-- the enum cast and was silently swallowed (verified live 2026-06-12: 0 rows
-- ever written). ALTER TYPE ... ADD VALUE cannot run inside the transaction
-- that also uses the value, so they sit outside the BEGIN/COMMIT block; both
-- are IF NOT EXISTS so the file stays re-runnable.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS stripe_meter_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  call_id text NOT NULL UNIQUE,
  stripe_customer_id text NOT NULL,
  failure_reason text,
  attempts int NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE stripe_meter_failures ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE stripe_meter_failures FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_meter_failures_created
  ON stripe_meter_failures(created_at);

COMMIT;

-- Outside the transaction (see header note):
ALTER TYPE activity_event_type ADD VALUE IF NOT EXISTS 'integration_fetch';
ALTER TYPE activity_event_type ADD VALUE IF NOT EXISTS 'integration_fetch_fanout';

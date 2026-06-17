-- ============================================================
-- 068_billing_and_security_hardening.sql
-- Billing/security hardening pass (2026-06 audit follow-up).
-- ============================================================
--
-- Section 1: Dedupe duplicate is_current=true subscription rows per tenant.
--   The webhook's history-table pattern (insert new current row, then unmark
--   old ones) unmarked by stripe_subscription_id, so cancel→re-subscribe (new
--   subscription id) could leave two is_current rows for one tenant. Keep the
--   most recently created row (tiebreak on id), unmark the rest.
--
-- Section 2: Partial unique index enforcing at most ONE is_current=true row
--   per tenant. Delivers the constraint migration 038's header (DB-2) promised
--   but never shipped. Requires Section 1's dedupe to run first (same txn).
--   NOTE: the webhook + verify-checkout now unmark old rows BEFORE inserting
--   the new current row (the old insert-first order would violate this index).
--
-- Section 3: oauth_refresh_locks lockdown. Migration 058 left RLS off and the
--   two lock RPCs executable by PUBLIC/anon/authenticated (Postgres default).
--   Enable RLS with no policies (service_role bypasses RLS; anon/authenticated
--   are fully blocked) and restrict EXECUTE on both RPCs to service_role.
--   Pattern source: 060/062/065 REVOKE-from-public / GRANT-to-service_role.
--
-- Section 4: Hot-path indexes (verified hot by audit):
--   - activity_log(customer_id)            — customer detail Activity tab +
--                                            merge/unmerge RPC repointing
--   - invoices(job_id)                     — customer Invoices tab JOIN
--   - appointments(external_event_id)      — calendar webhook sync lookups
--   - calendar_blocks(external_event_id)   — calendar webhook sync lookups
--
-- Section 5: stripe_webhook_events.processing_started_at — atomic processing
--   claim for the webhook handler. A duplicate delivery may only re-run the
--   handler if it can claim the row (processed=false AND no live claim within
--   10 minutes), closing the concurrent-delivery double-processing hole
--   (double Twilio number purchase, zero is_current rows).
--
-- Idempotent: dedupe UPDATE is a no-op on clean data; index creation uses
-- IF NOT EXISTS; ENABLE RLS / REVOKE / GRANT are safely re-runnable; column
-- add uses IF NOT EXISTS.

BEGIN;

-- ============================================================
-- Section 1: Dedupe duplicate is_current=true rows per tenant
-- ============================================================

WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY tenant_id
           ORDER BY created_at DESC, id DESC
         ) AS rn
  FROM subscriptions
  WHERE is_current
)
UPDATE subscriptions s
SET is_current = false
FROM ranked r
WHERE s.id = r.id
  AND r.rn > 1;

-- ============================================================
-- Section 2: One is_current row per tenant (038 DB-2, delivered)
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_one_current
  ON subscriptions(tenant_id)
  WHERE is_current;

-- ============================================================
-- Section 3: oauth_refresh_locks lockdown
-- ============================================================

-- No policies on purpose: service_role bypasses RLS; everyone else is blocked.
ALTER TABLE oauth_refresh_locks ENABLE ROW LEVEL SECURITY;

REVOKE EXECUTE ON FUNCTION public.try_acquire_oauth_refresh_lock(uuid, text, int)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.try_acquire_oauth_refresh_lock(uuid, text, int)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.release_oauth_refresh_lock(uuid, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_oauth_refresh_lock(uuid, text, uuid)
  TO service_role;

-- ============================================================
-- Section 4: Hot-path indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_activity_log_customer
  ON activity_log(customer_id)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_job_id
  ON invoices(job_id);

CREATE INDEX IF NOT EXISTS idx_appointments_external_event_id
  ON appointments(external_event_id)
  WHERE external_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_blocks_external_event_id
  ON calendar_blocks(external_event_id)
  WHERE external_event_id IS NOT NULL;

-- ============================================================
-- Section 5: Webhook processing claim
-- ============================================================

ALTER TABLE stripe_webhook_events
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz;

COMMIT;

-- ============================================================
-- 064_webhook_event_status.sql
-- Prod-readiness 2026-06: make Stripe webhook idempotency atomic.
-- ============================================================
--
-- The webhook handler inserts the event_id BEFORE running its side-effecting
-- handler. A handler that rethrows (handleSubscriptionEvent, handleInvoicePaid)
-- left the event_id row committed; Stripe's retry then hit the UNIQUE constraint
-- (23505) and returned received:true WITHOUT ever completing the side effects.
--
-- Fix: add a `processed` flag. The pre-handler INSERT still wins the concurrency
-- race, but completion is now gated on processed=true. On a duplicate, the handler
-- reads `processed`: if true → already done; if false → re-run (handlers are
-- idempotent via the stripe_updated_at out-of-order guard + calls_used=0 reset).
-- The webhook UPDATEs processed=true only after the handler block succeeds.
--
-- NO BACKFILL: existing rows default to false. They are never retried by Stripe
-- (delivery windows have long since closed), so the default is inert for history
-- and only governs in-flight/future deliveries.
--
-- Pattern source: 063_estimates_customer_id.sql header style; additive ALTER TABLE
-- ADD COLUMN with a NOT NULL DEFAULT (safe — existing rows take the default).
--
-- All changes additive. Historical rows remain valid.

ALTER TABLE stripe_webhook_events
  ADD COLUMN processed boolean NOT NULL DEFAULT false;

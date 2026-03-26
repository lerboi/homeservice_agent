-- Migration 010: Billing schema (subscriptions + webhook event idempotency)
-- Phase 22-01: billing-foundation

-- =============================================================================
-- 1. subscriptions table (per BILL-02, D-10, D-12, D-13, D-14)
-- =============================================================================
CREATE TABLE subscriptions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stripe_customer_id     text NOT NULL,
  stripe_subscription_id text NOT NULL,
  stripe_price_id        text,
  plan_id                text NOT NULL CHECK (plan_id IN ('starter', 'growth', 'scale')),
  status                 text NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'paused', 'incomplete')),
  calls_limit            int NOT NULL,
  calls_used             int NOT NULL DEFAULT 0,
  trial_ends_at          timestamptz,
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean NOT NULL DEFAULT false,
  stripe_updated_at      timestamptz,
  is_current             boolean NOT NULL DEFAULT true,
  created_at             timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_subscriptions_tenant_current ON subscriptions(tenant_id, is_current);
CREATE INDEX idx_subscriptions_stripe_sub_id ON subscriptions(stripe_subscription_id);

-- =============================================================================
-- 2. stripe_webhook_events table (BILL-03, BILL-04/D-09 idempotency)
-- =============================================================================
CREATE TABLE stripe_webhook_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     text UNIQUE NOT NULL,
  event_type   text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 3. Row Level Security
-- =============================================================================

-- subscriptions RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Authenticated users can only SELECT their own tenant's subscriptions
CREATE POLICY subscriptions_select_own ON subscriptions
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

-- Service role has full access (webhook handler uses service role)
CREATE POLICY service_role_all_subscriptions ON subscriptions
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- stripe_webhook_events RLS
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- Only service role accesses webhook events (no authenticated access needed)
CREATE POLICY service_role_all_stripe_events ON stripe_webhook_events
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

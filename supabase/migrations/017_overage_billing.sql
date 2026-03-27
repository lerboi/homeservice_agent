-- Migration 017: Overage billing support
-- Adds metered subscription item ID to subscriptions table for Stripe usage-based overage charging.
-- When a tenant exceeds their calls_limit, each additional call reports 1 usage unit
-- to the metered subscription item, which Stripe bills at the plan's overage rate.

-- =============================================================================
-- 1. Add overage_stripe_item_id to subscriptions
-- =============================================================================
ALTER TABLE subscriptions
  ADD COLUMN overage_stripe_item_id text;

-- No RLS changes needed — existing policies cover all columns on the subscriptions table.

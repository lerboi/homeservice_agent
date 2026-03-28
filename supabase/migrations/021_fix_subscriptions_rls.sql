-- Migration 021: Fix subscriptions RLS policy role restriction
--
-- The subscriptions_select_own policy was restricted to TO authenticated,
-- but the proxy (middleware) Supabase client may resolve as the anon role
-- even for logged-in users. This caused the subscription query to return
-- zero rows, triggering a redirect to /billing/upgrade.
--
-- All other tables (tenants, calls, etc.) omit the TO clause so their
-- policies apply to all roles. Align subscriptions to the same pattern.

DROP POLICY subscriptions_select_own ON subscriptions;

CREATE POLICY subscriptions_select_own ON subscriptions
  FOR SELECT
  USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

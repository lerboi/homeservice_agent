-- Migration 042: Call routing schema
-- Phase 39: Call Routing Webhook Foundation
--
-- Additive-only migration. Adds columns required by the call routing feature
-- (schedule evaluation, pickup numbers, dial timeout, routing mode, outbound
-- dial duration) and a supporting index for the monthly outbound cap query.
--
-- Phase 39 does not populate any of these columns from production traffic.
-- Phase 40 wires the schedule evaluator and pickup_numbers into the webhook
-- handler. Phase 41 ships the dashboard UI that lets tenants set them.
--
-- No column name or index name conflicts with migrations 001-041 (verified
-- in .planning/phases/39-call-routing-webhook-foundation/39-RESEARCH.md §7).

ALTER TABLE tenants
  ADD COLUMN call_forwarding_schedule JSONB NOT NULL DEFAULT '{"enabled":false,"days":{}}'::jsonb,
  ADD COLUMN pickup_numbers JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_array_length(pickup_numbers) <= 5),
  ADD COLUMN dial_timeout_seconds INTEGER NOT NULL DEFAULT 15;

ALTER TABLE calls
  ADD COLUMN routing_mode TEXT CHECK (routing_mode IN ('ai','owner_pickup','fallback_to_ai')),
  ADD COLUMN outbound_dial_duration_sec INTEGER;

CREATE INDEX IF NOT EXISTS idx_calls_tenant_month ON calls (tenant_id, created_at);

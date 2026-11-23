---
type: system
system: Billing
status: record
description: "The former payment-architecture skill's scope statement, preamble and running 'last updated' change history. Read only when you need to know when or why something changed."
source: ".claude/skills/payment-architecture/SKILL.md § frontmatter description + preamble"
migrated: 2026-11-23
verified:
tags: [voco/system/billing]
---

# Scope and change history

Part of [[Billing]]. Migrated verbatim from the `payment-architecture` skill.

## Scope: what the former skill covered

Complete architectural reference for the payment, billing, and subscription system — Stripe Checkout Sessions (onboarding + upgrade, both with a 409 double-subscription guard and flexible billing mode for annual intervals), webhook handler (9 event types, history table pattern with unmark-by-tenant-before-insert, atomic processing-claim idempotency via stripe_webhook_events.processed + processing_started_at / migrations 064+068, processed-state check on failed claims, partial unique index idx_subscriptions_one_current), Basil API version pin (2025-06-30.basil) with subscription-item period reads + invoice.parent.subscription_details, Billing Meters overage system (Python agent is sole reporter via stripe.billing.meter_events.create, with stripe_meter_failures outbox + retry-meter-events cron / migration 071), subscription lifecycle (trialing/active/past_due/canceled/paused), usage tracking (increment_calls_used RPC), subscription enforcement gate (past_due blocked after 3-day grace via the Python agent's shared subscription_gate.py), churned-number release cron, billing notifications (trial_will_end, payment_failed), billing dashboard (plan card, UsageRingGauge, invoices, Stripe Customer Portal), pricing page (3 plans with monthly/annual/overage), all 5 billing DB tables with RLS policies. Phase 59: invoices.job_id attribution (lead_id removed — customer derivable via job.customer_id; ad-hoc invoices without a job remain possible per D-11). Use this skill whenever making changes to Stripe integration, checkout sessions, subscription handling, usage tracking, overage billing, billing notifications, billing dashboard, pricing page, or any payment-related API route. Also use when the user asks about how billing works, wants to modify subscription logic, or needs to debug payment/webhook issues.

## Preamble and change history

## Payment Architecture — Complete Reference

This document is the single source of truth for the entire payment, billing, and subscription system. Read this before making any changes to Stripe integration, checkout flows, subscription handling, usage tracking, overage billing, or the billing dashboard.

**Last updated**: 2026-06-12 (audit wave 1 — (1) Basil pin bumped `2025-03-31.basil` → `2025-06-30.basil` (`src/lib/stripe.js`) to enable **flexible billing mode**; both checkout routes set `subscription_data.billing_mode = { type: 'flexible' }` for ANNUAL intervals only — required so the webhook can attach the monthly metered overage price to annual subscriptions (classic mode rejects mixed intervals; verified test-mode). (2) Onboarding checkout `ui_mode` is `'embedded'` — the prior `'embedded_page'` value is a dahlia-only enum REJECTED under the Basil pin, which had broken signup checkout (verified test-mode). (3) Webhook idempotency: a duplicate delivery that fails to claim no longer acks 200 unconditionally — it checks `processed` (true → 200, false → 500 so Stripe retries; stale claims >10min get stolen); the old unconditional ack permanently lost events whose first delivery died un-gracefully. (4) Overage attach failures in webhook + verify-checkout now `Sentry.captureMessage` (no longer silent). (5) `handleInvoicePaid` throws when the `calls_used` reset matches 0 rows (racing the unmark→insert window) so Stripe retries — previously the reset was silently lost (spurious overage next cycle). (6) NEW crons: `/api/cron/release-churned-numbers` (daily 04:00) and `/api/cron/retry-meter-events` (every 6h, drains the `stripe_meter_failures` outbox, migration 071). (7) Subscription gate: past_due is now BLOCKED after the 3-day grace via the shared livekit-agent `src/lib/subscription_gate.py` (agent.py gate + twilio_routes); `proxy.js` no longer runs the dead status query; `BillingWarningBanner` shows a RED "AI receptionist is paused" variant post-grace and is no longer dismissible; `TrialCountdownBanner` no longer dismissible.)

**Previous update**: 2026-06-10 (Billing hardening, migration 068 — (1) Webhook idempotency upgraded from "processed flag" to an **atomic processing claim**: `stripe_webhook_events.processing_started_at` (068); duplicates may only re-run after claiming the row with a conditional UPDATE (`processed=false` AND claim NULL/stale >10min), closing the concurrent-delivery double-processing hole; handler failure resets the claim for immediate retry. (2) `handleSubscriptionEvent` now unmarks `is_current` by TENANT (not stripe_subscription_id), unmark-BEFORE-insert; `calls_used` carry-forward only within the same `stripe_subscription_id`; out-of-order protection now uses the event envelope's `event.created` (the old `subscription.updated` read was dead code — that field doesn't exist). Same unmark-by-tenant reorder in verify-checkout's `syncSubscription`. (3) Both checkout-session routes 409 when the tenant already has a live `is_current` subscription (active/trialing/past_due) — fixes double-subscription/double-billing. (4) `handleCheckoutCompleted` now THROWS on tenant-update failure so Stripe retries. (5) Migration 068 adds partial unique index `idx_subscriptions_one_current` (+ dedupe of pre-existing duplicate current rows). Earlier prod-readiness 2026-06 items (Basil pin, Billing Meters Python path, migration 064 `processed` flag) still apply.)

---

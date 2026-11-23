---
name: payment-architecture
description: Complete architectural reference for the payment, billing, and subscription system — Stripe Checkout Sessions (onboarding + upgrade, both with a 409 double-subscription guard and flexible billing mode for annual intervals), webhook handler (9 event types, history table pattern with unmark-by-tenant-before-insert, atomic processing-claim idempotency via stripe_webhook_events.processed + processing_started_at / migrations 064+068, processed-state check on failed claims, partial unique index idx_subscriptions_one_current), Basil API version pin (2025-06-30.basil) with subscription-item period reads + invoice.parent.subscription_details, Billing Meters overage system (Python agent is sole reporter via stripe.billing.meter_events.create, with stripe_meter_failures outbox + retry-meter-events cron / migration 071), subscription lifecycle (trialing/active/past_due/canceled/paused), usage tracking (increment_calls_used RPC), subscription enforcement gate (past_due blocked after 3-day grace via the Python agent's shared subscription_gate.py), churned-number release cron, billing notifications (trial_will_end, payment_failed), billing dashboard (plan card, UsageRingGauge, invoices, Stripe Customer Portal), pricing page (3 plans with monthly/annual/overage), all 5 billing DB tables with RLS policies. Phase 59: invoices.job_id attribution (lead_id removed — customer derivable via job.customer_id; ad-hoc invoices without a job remain possible per D-11). Use this skill whenever making changes to Stripe integration, checkout sessions, subscription handling, usage tracking, overage billing, billing notifications, billing dashboard, pricing page, or any payment-related API route. Also use when the user asks about how billing works, wants to modify subscription logic, or needs to debug payment/webhook issues.
---

# payment-architecture (moved to the vault)

The architecture reference that used to be in this file now lives in the Obsidian vault as small linked notes. This system is part of the legacy home-service app: deployed and unchanged, not the current product focus.

1. Read the index: `vault/Systems/Billing/Billing.md`. It lists every note with a one-line description.
2. Open only the notes the task needs (same folder).
3. Notes with an empty `verified:` field were migrated verbatim on 2026-11-23 and not re-checked: confirm specifics against the code.
4. After changing code in this system, update the matching vault note and set its `verified:` date. Do not add documentation back into this file.

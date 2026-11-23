---
type: system
system: Billing
status: legacy-app
description: "One Stripe Billing Meter (voco_calls, aggregation: Sum) shared across all 3 plans. Each plan has its own usage-based price linked to this meter. Covers: How It Works; Key Properties; Who Reports Overage: the Python Agent is the Sole Path; Meter-Failure Outbox + Retry Cron (migration 071, 2026-06-12)"
source: .claude/skills/payment-architecture/SKILL.md § 4. Overage Billing (Stripe Billing Meters)
migrated: 2026-11-23
verified:
tags: [voco/system/billing]
---

# Overage Billing (Stripe Billing Meters)

Part of [[Billing]]. Migrated verbatim from the `payment-architecture` skill; check `verified` before trusting details.

### How It Works

One Stripe Billing Meter (`voco_calls`, aggregation: Sum) shared across all 3 plans. Each plan has its own usage-based price linked to this meter.

```
Call completes → Python agent post-call pipeline
  → increment_calls_used RPC (Supabase)
  → Returns { success, calls_used, calls_limit, limit_exceeded }
  → If limit_exceeded:
      → stripe.billing.meterEvents.create({
          event_name: 'voco_calls',
          payload: { value: '1', stripe_customer_id: cus_xxx }
        })
  → Stripe tallies against metered subscription item
  → Charged automatically on next invoice
```

### Key Properties

- **New Billing Meters API**: Uses `stripe.billing.meterEvents.create()` (NOT the deprecated `usage_records` endpoint)
- **Customer-based routing**: Meter events use `stripe_customer_id` + `event_name` — no subscription item ID needed
- **Fire-and-forget with durable fallback**: Meter events processed within ~30s, don't block call pipeline; the post itself is capped at 3s in the Python agent and failures land in the `stripe_meter_failures` outbox (see below) instead of being dropped
- **Calls never blocked**: Over-quota calls add charges to next invoice, never rejected
- **Trial handling**: Stripe accepts meter events during trial but bills at $0 until trial ends
- **Stripe SDK version**: Requires `stripe@^17.0.0` or later (API version `2025-06-30.basil`)

### Who Reports Overage: the Python Agent is the Sole Path

Overage reporting happens **only** in the Python LiveKit agent's post-call pipeline (`livekit-agent/src/post_call.py`, a separate Railway-deployed repo — see `voice-call-architecture` skill). The Next.js side never reports meter events; it only *creates the overage subscription item* once, at onboarding (`handleCheckoutCompleted` / `verify-checkout` `fulfillSubscription`, via `stripe.subscriptionItems.create` with idempotency key `add_overage_{subscription_id}`).

**Prod-readiness 2026-06 fix (Python side)**: the agent previously reported overage via `stripe.billing.subscription_items.create_usage_record(...)` — an endpoint **removed in Basil** (`2025-03-31.basil`). On Basil it silently failed, so overage was never billed. It now reports through the Billing Meters API:
```python
stripe.billing.meter_events.create(
    event_name="voco_calls",
    payload={"value": "1", "stripe_customer_id": <cus_id>},
    identifier=f"overage_{call_id}",   # idempotency — dedupes retries
)
```
Routing is by `stripe_customer_id` (no subscription-item id needed), and the per-event `identifier=overage_{call_id}` makes Stripe-side reporting idempotent on top of the DB-side `usage_events` PK dedup.

### Meter-Failure Outbox + Retry Cron (migration 071, 2026-06-12)

A failed meter post used to be permanently unbilled revenue: `increment_calls_used` had already consumed the `call_id` (usage_events PK), so re-running the pipeline skipped the meter branch — there was no retry path. Now:

- **Agent side**: on meter-post failure (capped at 3s via `asyncio.wait_for`), the Python agent upserts a row into `stripe_meter_failures` (upsert on `call_id` — see table in §9). **LK-B2 (2026-06-21):** this meter post now runs in post_call **§7.5 — AFTER owner notifications**, not §4, so a slow Stripe call can never starve the owner missed-job alert inside the 8s post-call budget. §4 keeps only the fast `increment_calls_used` + the customer lookup.
- **Cron side**: `/api/cron/retry-meter-events` (every 6h, `vercel.json`) drains up to 25 rows per run, re-posting with the SAME `identifier=overage_{call_id}` — Stripe dedupes meter events by identifier, so a retry can never double-bill even if the original post landed before its response was lost. Rows are **deleted on success**; on failure `attempts`/`last_attempt_at`/`failure_reason` are updated, and crossing 10 attempts fires a one-time `Sentry.captureMessage` (the row is kept for manual review and skipped thereafter).

> **Related (LK-B2):** the owner missed-job ALERT now has its own twin of this exact pattern — table `owner_notification_failures` (migration **076**) + cron `/api/cron/retry-owner-notifications` (every 5 min). It is a NOTIFICATION outbox, not a billing one, so it lives primarily in the `voice-call-architecture` skill; documented here only because it deliberately mirrors `stripe_meter_failures`. Key difference: delivery is **at-least-once** (Twilio/Resend have no server-side dedupe like Stripe's meter identifier), so a retry can produce a rare duplicate alert — acceptable vs a missed job.

---

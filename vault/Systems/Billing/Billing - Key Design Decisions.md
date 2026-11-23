---
type: system
system: Billing
status: legacy-app
description: "Two line items per subscription: Every subscription has a flat-rate price + metered overage price. The Checkout Session only includes the flat-rate item — th…"
source: .claude/skills/payment-architecture/SKILL.md § 11. Key Design Decisions
migrated: 2026-11-23
verified:
tags: [voco/system/billing]
---

# Key Design Decisions

Part of [[Billing]]. Migrated verbatim from the `payment-architecture` skill; check `verified` before trusting details.

- **Two line items per subscription**: Every subscription has a flat-rate price + metered overage price. The Checkout Session only includes the flat-rate item — the metered overage item is added post-checkout by the webhook handler (and verify-checkout fallback) using a Stripe idempotency key (`add_overage_{subscription_id}`) to prevent duplicate items from concurrent processing. Annual subscriptions must be created in **flexible billing mode** (`subscription_data.billing_mode = { type: 'flexible' }`, both checkout routes) or the monthly-interval overage attach is rejected. Attach failures are now reported via `Sentry.captureMessage` (no longer silent).

- **Billing Meters (not legacy usage_records)**: The old `POST /v1/subscription_items/{id}/usage_records` endpoint (`subscription_items.create_usage_record` in the SDK) was removed in Stripe API version `2025-03-31.basil`. The new `stripe.billing.meterEvents.create()` (JS) / `stripe.billing.meter_events.create()` (Python) uses customer_id + event_name, not subscription item ID. Prod-readiness 2026-06 caught that the Python agent was still calling the removed endpoint — it failed silently on Basil, so overage went unbilled until the Python path was migrated to the Meters API.

- **Atomic webhook idempotency via processing claim (migrations 064 + 068, hardened 2026-06-12)**: The webhook treats neither "row inserted" nor "row exists" as "event handled." A fresh insert claims the event (`processing_started_at`); duplicates must win a conditional claim UPDATE (`processed=false` AND claim NULL/stale >10min) before re-running, so a mid-flight first delivery can never be run concurrently (the 064-era fall-through allowed double Twilio number purchases). A duplicate that FAILS to claim checks `processed`: true → 200, false → 500 so Stripe keeps retrying (the old unconditional 200 permanently lost events whose first delivery died un-gracefully). Handler failure releases the claim so the retry re-claims immediately; `processed=true` is flipped only on success. See Idempotency (D-09).

- **API version pinned to Basil**: `src/lib/stripe.js` pins `apiVersion: '2025-06-30.basil'` (bumped from `2025-03-31.basil` in 2026-06-12 to enable flexible billing mode) so SDK upgrades can't silently shift field shapes. Basil moved `current_period_start/_end` onto the subscription item and `invoice.subscription` under `invoice.parent.subscription_details` — the webhook + verify-checkout read both with `?? <pre-Basil location>` fallbacks. Note: `ui_mode: 'embedded'` is the valid embedded-checkout enum on every Basil release; `'embedded_page'` is dahlia-only and rejected under this pin.

- **One meter, three prices**: All three plans share the `voco_calls` Billing Meter. Stripe resolves the per-unit rate from whichever overage price is on the customer's subscription.

- **`overage_stripe_item_id` stored but not required for reporting**: The column exists for reference/auditing. The Billing Meters API routes via customer_id, not subscription item ID.

- **History table pattern for subscriptions (068 reorder)**: All of the tenant's current rows are unmarked FIRST (by tenant_id), then the new row is inserted with `is_current=true` — the order and the unmark scope are both dictated by the `idx_subscriptions_one_current` partial unique index and the cancel→re-subscribe duplicate-current bug. The brief zero-current window is safe: the gate fails open and readers use `order + limit 1`.

- **One `is_current` row per tenant, DB-enforced (migration 068)**: `idx_subscriptions_one_current` (partial UNIQUE on `tenant_id WHERE is_current`) makes duplicate current rows impossible; the webhook throws on a 23505 so Stripe retries and the sync converges.

- **Double-subscription guard on both checkout routes (409)**: Neither checkout-session route will create a session while the tenant has a live (`active`/`trialing`/`past_due`) current subscription — the billing route's 409 directs users to the Stripe Billing Portal for plan changes.

- **Out-of-order protection via `event.created`**: Webhook events can arrive out of order. The event envelope's `event.created` is compared (`Date.parse`) against the tenant's current row's `stripe_updated_at` — older events are skipped. (The old `subscription.updated`-based read was dead code; that field doesn't exist on the Subscription object.)

- **`calls_used` carried forward only within the same subscription**: On sync, `calls_used` is copied from the prior row only when its `stripe_subscription_id` matches (plan changes keep the id). A replacement subscription (new id after cancel→re-subscribe) starts a fresh cycle at 0.

- **`calls_used` resets on `invoice.paid` with `billing_reason: 'subscription_cycle'`**: Only fires on billing cycle renewal (not first invoice or metered invoices). The handler throws when the reset matches 0 rows (racing the unmark→insert window) so Stripe retries instead of silently losing the reset.

- **Subscription gate fails open**: If the subscription query fails, calls are allowed through. Revenue > correctness for edge cases.

- **Over-quota calls never blocked**: The subscription gate does NOT check usage — overage billing handles over-quota calls automatically.

- **past_due gets 3-day grace period, then calls are BLOCKED (2026-06-12)**: During the grace, calls continue and BillingWarningBanner shows a countdown (anchored to `current_period_end + 3 days`, not `stripe_updated_at`), with SMS + email sent with portal URL. After the grace expires, the Python agent's shared `subscription_gate.py` stops answering the tenant's calls and the banner switches to the red non-dismissible "AI receptionist is paused" variant. Uses `current_period_end` because it's stable during `past_due` — `stripe_updated_at` advances on every subscription update event, which would incorrectly extend the grace window.

- **Meter failures go to a durable outbox (migration 071)**: A failed Stripe meter post writes `stripe_meter_failures` (upsert on `call_id`) instead of being dropped; `/api/cron/retry-meter-events` re-posts with the idempotent `overage_{call_id}` identifier every 6h, deletes on success, and Sentry-alerts after 10 attempts.

- **Churned tenants' numbers are released after 30 days**: `/api/cron/release-churned-numbers` (daily 04:00) frees numbers of tenants whose current subscription has been `canceled` >30 days — SG back to `phone_inventory`, US/CA released at Twilio; `tenants.phone_number` cleared. Reactivating within 30 days keeps the number.

- **Notification failures never crash webhook handlers**: `Promise.allSettled` for email + SMS, errors logged but not thrown. Prevents Stripe retry loops caused by notification service outages.

- **`billing_notifications` UNIQUE constraint (tenant_id, notification_type)**: Prevents duplicate notifications even under concurrent webhook deliveries. Application code uses upsert with `ignoreDuplicates` as belt-and-suspenders.

- **`billing_notifications` cleared on subscription cancellation**: When `handleSubscriptionEvent` processes a `canceled` status, it fire-and-forget deletes all `billing_notifications` rows for that tenant. This ensures future re-subscriptions get fresh notification tracking (e.g., a new trial_will_end notification if the business model ever offers trials on reactivation).

- **Authenticated users can only READ subscriptions**: No INSERT/UPDATE policies for authenticated role. All writes via service_role (webhook handlers). Intentional write-protection.

- **Onboarding checkout has trial; upgrade checkout does not**: New users get 14-day trial with CC required. Reactivating/upgrading users pay immediately.

- **Upgrade checkout reuses existing Stripe customer**: Looks up `stripe_customer_id` from existing subscription to maintain invoice/payment history.

- **Billing portal return URL is allowlisted**: Only `/dashboard` and `/dashboard/more/billing` are accepted. Prevents open redirect via query param.

---

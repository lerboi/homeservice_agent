---
type: system
system: Billing
status: legacy-app
description: "End-to-end flow and main components of Billing."
source: .claude/skills/payment-architecture/SKILL.md § Architecture Overview
migrated: 2026-11-23
verified:
tags: [voco/system/billing]
---

# Architecture Overview

Part of [[Billing]]. Migrated verbatim from the `payment-architecture` skill; check `verified` before trusting details.

| Layer | Files | Purpose |
|-------|-------|---------|
| **Pricing Page** | `src/app/(public)/pricing/pricingData.js`, `PricingTiers.jsx` | Plan selection, pricing display, annual toggle |
| **Onboarding Checkout** | `src/app/api/onboarding/checkout-session/route.js`, `src/app/onboarding/checkout/page.js` | Embedded Stripe Checkout with 14-day trial |
| **Upgrade Checkout** | `src/app/api/billing/checkout-session/route.js` | Hosted Stripe Checkout, no trial, reuses Stripe customer |
| **Webhook Handler** | `src/app/api/stripe/webhook/route.js` | 9 event types, idempotency, history table pattern |
| **Usage Tracking** | `supabase/migrations/013_usage_events.sql` (RPC) + Python agent `src/post_call.py` | Per-call counting + Stripe Billing Meter overage reporting |
| **Subscription Gate** | `src/lib/subscription-gate.js` (JS reference) + livekit-agent `src/lib/subscription_gate.py` (live enforcement) | Blocks calls for canceled/paused/incomplete tenants; Python gate also blocks past_due after the 3-day grace |
| **Billing Crons** | `src/app/api/cron/retry-meter-events/route.js`, `src/app/api/cron/release-churned-numbers/route.js` | Drain stripe_meter_failures outbox (every 6h); release churned tenants' numbers after 30 days (daily 04:00) |
| **Billing Dashboard** | `src/app/dashboard/more/billing/page.js`, `UsageRingGauge.js` | Plan info, usage meter, invoices, portal link |
| **Billing API** | `src/app/api/billing/data/route.js`, `invoices/route.js`, `portal/route.js` | Subscription data (with billing_interval), invoice list, Stripe Customer Portal redirect |
| **Banners** | `BillingWarningBanner.js`, `TrialCountdownBanner.js` | Dashboard warnings for past_due and trial countdown |
| **Notifications** | `src/emails/PaymentFailedEmail.jsx`, `TrialReminderEmail.jsx` | Email templates for billing events |
| **Stripe SDK** | `src/lib/stripe.js` | Lazy-init Stripe singleton via Proxy |
| **DB Schema** | Migrations 010, 013, 016, 017, 020, 021, 037, 064, 068, 071 | 5 billing tables + RPC + RLS (064 adds `stripe_webhook_events.processed`; 068 adds `processing_started_at` + `idx_subscriptions_one_current`; 071 adds the `stripe_meter_failures` outbox) |
| **Stripe SDK config** | `src/lib/stripe.js` | `apiVersion` pinned to `2025-06-30.basil` (Basil — required for Billing Meters + period-field moves; this release adds flexible billing mode, needed for the annual+monthly-overage mix) |

```
Pricing Page (/pricing)
  → User selects plan + interval (monthly/annual)
  → CTA links to /onboarding?plan={id}&interval={billing}
       ↓
  Auth → Onboarding Wizard (plan stored in sessionStorage)
       ↓
  Step 5: Embedded Stripe Checkout
  → POST /api/onboarding/checkout-session
  → Creates session with 1 line item: flat-rate plan price
  → 14-day trial, CC required
  → Metered overage item added post-checkout by webhook (idempotency key protected)
       ↓
  Stripe fires checkout.session.completed webhook
  → Sets onboarding_complete = true
  → Provisions phone number (country-aware)
  → Creates subscription row via handleSubscriptionEvent()
       ↓
  Dashboard — billing cycle begins
  → Each call: Python agent calls increment_calls_used RPC (post_call §4)
  → If limit_exceeded: meter post DEFERRED to post_call §7.5 — runs AFTER owner
      notifications (LK-B2, 2026-06-21) so billing never starves the owner alert
      in the 8s post-call budget; still capped at 3s
  → If meter post fails: outbox row in stripe_meter_failures (migration 071)
      → /api/cron/retry-meter-events re-posts every 6h (same identifier — dedupe)
  → Overage charged automatically on next invoice
       ↓
  Lifecycle events:
  → invoice.paid (subscription_cycle) → resets calls_used to 0
  → customer.subscription.trial_will_end → email + SMS notification
  → invoice.payment_failed → email + SMS with portal URL
  → customer.subscription.updated/deleted/paused/resumed → sync subscription row
  → canceled >30 days → /api/cron/release-churned-numbers frees the phone number
```

---

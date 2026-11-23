---
type: system
system: Billing
status: legacy-app
description: "Which files implement Billing and what each one is responsible for."
source: .claude/skills/payment-architecture/SKILL.md § File Map
migrated: 2026-11-23
verified:
tags: [voco/system/billing]
---

# File Map

Part of [[Billing]]. Migrated verbatim from the `payment-architecture` skill; check `verified` before trusting details.

| File | Role |
|------|------|
| `src/app/(public)/pricing/pricingData.js` | PRICING_TIERS data, COMPARISON_FEATURES, getAnnualPrice() |
| `src/app/(public)/pricing/PricingTiers.jsx` | Plan cards with monthly/annual toggle, CTA to onboarding |
| `src/app/(public)/pricing/FAQSection.jsx` | FAQ accordion on pricing page |
| `src/app/api/onboarding/checkout-session/route.js` | POST: create Stripe Checkout Session (onboarding, 14-day trial, embedded) |
| `src/app/api/onboarding/verify-checkout/route.js` | GET: polls subscription status after checkout for verification |
| `src/app/onboarding/checkout/page.js` | Step 5: Embedded Stripe Checkout, webhook verification, success celebration |
| `src/app/api/billing/checkout-session/route.js` | POST: create Stripe Checkout Session (upgrade, no trial, reuses customer) |
| `src/app/api/billing/data/route.js` | GET: subscription data with computed billing_interval for billing dashboard |
| `src/app/api/billing/invoices/route.js` | GET: 5 most recent invoices via Stripe API |
| `src/app/api/billing/portal/route.js` | GET: generates Stripe Customer Portal session, 303 redirect |
| `src/app/api/stripe/webhook/route.js` | POST: Stripe webhook handler — 9 event types |
| `src/lib/stripe.js` | Stripe SDK lazy singleton via Proxy pattern; pins `apiVersion: '2025-06-30.basil'` (enables flexible billing mode) |
| `src/lib/subscription-gate.js` | checkSubscriptionGate() — JS reference gate (canceled/paused/incomplete); live call enforcement is the Python agent's shared `subscription_gate.py` (livekit-agent repo), which also blocks past_due post-grace |
| `src/app/api/cron/retry-meter-events/route.js` | Cron (every 6h): drains `stripe_meter_failures` outbox — re-posts meter events with `identifier=overage_{call_id}`, deletes on success, Sentry alert at 10 attempts |
| `src/app/api/cron/release-churned-numbers/route.js` | Cron (daily 04:00): releases phone numbers of tenants whose current subscription is canceled >30 days (SG → phone_inventory, US/CA → Twilio release) |
| `src/app/dashboard/more/billing/page.js` | Billing page: plan card, usage ring, details, invoices |
| `src/components/dashboard/UsageRingGauge.js` | SVG donut ring gauge for call usage visualization |
| `src/app/dashboard/BillingWarningBanner.js` | Amber banner for past_due with 3-day grace countdown |
| `src/app/dashboard/TrialCountdownBanner.js` | Trial countdown banner (blue >3d, amber <=3d) |
| `src/emails/PaymentFailedEmail.jsx` | React Email template for payment failure |
| `src/emails/TrialReminderEmail.jsx` | React Email template for trial reminders |
| `supabase/migrations/010_billing_schema.sql` | subscriptions + stripe_webhook_events tables |
| `supabase/migrations/013_usage_events.sql` | usage_events table + increment_calls_used RPC |
| `supabase/migrations/016_billing_notifications.sql` | billing_notifications table |
| `supabase/migrations/017_overage_billing.sql` | overage_stripe_item_id column on subscriptions |
| `supabase/migrations/020_billing_notifications_unique.sql` | UNIQUE constraint on billing_notifications |
| `supabase/migrations/021_fix_subscriptions_rls.sql` | Fix subscriptions RLS policy role restriction |
| `supabase/migrations/037_fix_overage_off_by_one.sql` | Fix `>=` to `>` in increment_calls_used RPC (off-by-one overage bug) |
| `supabase/migrations/064_webhook_event_status.sql` | Adds `processed boolean NOT NULL DEFAULT false` to `stripe_webhook_events` — gates atomic-idempotency re-run (prod-readiness 2026-06) |
| `supabase/migrations/068_billing_and_security_hardening.sql` | Billing sections: dedupe duplicate `is_current` rows per tenant + partial unique index `idx_subscriptions_one_current ON subscriptions(tenant_id) WHERE is_current`; adds `stripe_webhook_events.processing_started_at` (atomic processing claim) |
| `supabase/migrations/071_meter_event_outbox.sql` | `stripe_meter_failures` outbox table (service-role only) + extends `activity_event_type` enum with `integration_fetch`/`integration_fetch_fanout` |

---

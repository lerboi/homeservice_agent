---
type: system-index
system: Billing
status: legacy-app
repo: homeservice_agent
description: Complete architectural reference for the payment, billing, and subscription system — Stripe Checkout Sessions (onboarding + upgrade, both with a 409 double-subscription guard and flexible billing mode for annual intervals), webhook handler …
source_skills: [payment-architecture]
migrated: 2026-11-23
verified:
tags: [voco/system/billing]
---

# Billing

Up: [[Home]] · [[Systems]]

> **Start with:** [[Billing - Plans and limits at a glance (verified)]] (checked against code 2026-11-23).

> **How to use:** read this index, then open only the notes the task needs. After changing code in this system, update the matching note and set its `verified:` date.

**Status (2026-11-23):** legacy app for checkout, the billing dashboard and the pricing page; but usage counting, overage metering and the subscription gate run on every production call. Plan ids `starter|growth|scale`, prices, call limits and overage rates are wired to Stripe and to enforcement; the rebrand changes none of it. Public pricing becomes "talk to us".

## Notes (from `payment-architecture`)

| Note | Lines | Status | What is in it |
|---|---|---|---|
| [[Billing - Architecture Overview]] | 54 | legacy-app | End-to-end flow and main components of Billing. |
| [[Billing - File Map]] | 36 | legacy-app | Which files implement Billing and what each one is responsible for. |
| [[Billing - Pricing Plans]] | 31 | legacy-app | Pricing Plans. Covers: Stripe Price IDs (12 total) |
| [[Billing - Checkout Session Creation]] | 42 | legacy-app | Two routes create Stripe Checkout Sessions — one for onboarding (new users) and one for upgrade/reactivation (existing users). Covers: Onboarding Checkout (`POST /api/onboarding/checkout-session`); Upgrade Checkout (`POST /api/billing/checkout-session`); Embedded Checkout Flow (Onboarding Step 5) |
| [[Billing - Stripe Webhook Handler]] | 149 | legacy-app | Stripe Webhook Handler. Covers: Event Types Handled; Idempotency (D-09) — atomic "processing claim" pattern (migrations 064 + 068); Out-of-Order Protection (D-10); Basil Field Moves (introduced in `2025-03-31.basil`, still apply under the current `2025-06-30.basil` pin); History Table Pattern (D-13, reordered by migration 068); handleCheckoutCompleted Failure Semantics; Price-to-Plan Mapping; Status Mapping |
| [[Billing - Overage Billing (Stripe Billing Meters)]] | 51 | legacy-app | One Stripe Billing Meter (voco_calls, aggregation: Sum) shared across all 3 plans. Each plan has its own usage-based price linked to this meter. Covers: How It Works; Key Properties; Who Reports Overage: the Python Agent is the Sole Path; Meter-Failure Outbox + Retry Cron (migration 071, 2026-06-12) |
| [[Billing - Usage Tracking]] | 21 | legacy-app | Idempotency: INSERT into usage_events (call_id PK) with ON CONFLICT DO NOTHING Covers: `increment_calls_used` RPC (Migration 013, fixed in 037); `handleInvoicePaid` — Usage Reset |
| [[Billing - Subscription Enforcement Gate]] | 35 | legacy-app | Subscription Enforcement Gate. Covers: Live Enforcement: Python `subscription_gate.py` (2026-06-12); Middleware Subscription Check; Churned Number Release (`/api/cron/release-churned-numbers`, 2026-06-12) |
| [[Billing - Billing Dashboard]] | 31 | legacy-app | Billing Dashboard. Covers: Billing Page (`/dashboard/more/billing`); UsageRingGauge Component; Billing API Routes; Dashboard Banners |
| [[Billing - Billing Notifications]] | 25 | legacy-app | Fires on customer.subscription.trial_will_end (3 days before trial end) Covers: `handleTrialWillEnd` (Webhook); `handleInvoicePaymentFailed` (Webhook); Email Templates |
| [[Billing - Database Tables]] | 85 | legacy-app | Indexes: (tenant_id, is_current), (stripe_subscription_id), idx_subscriptions_one_current — partial UNIQUE on (tenant_id) WHERE is_current (migration 068): a… Covers: `subscriptions` (Migration 010 + 017 + 068); `stripe_webhook_events` (Migration 010 + 064 + 068); `usage_events` (Migration 013); `billing_notifications` (Migration 016 + 020); `stripe_meter_failures` (Migration 071, 2026-06-12) |
| [[Billing - Environment Variables]] | 20 | legacy-app | Environment variables Billing reads, and where they are set. |
| [[Billing - Key Design Decisions]] | 50 | legacy-app | Two line items per subscription: Every subscription has a flat-rate price + metered overage price. The Checkout Session only includes the flat-rate item — th… |
| [[Billing - Scope and change history]] | 32 | record | The former payment-architecture skill's scope statement, preamble and running 'last updated' change history. Read only when you need to know when or why something changed. |

## Short sections

### Cross-Domain References

- **Onboarding wizard checkout flow**: See `onboarding-flow` skill for how the checkout step fits into the 5-step wizard, plan param capture from pricing page, and `useWizardSession` session management.
- **Phone provisioning post-checkout**: See `onboarding-flow` skill for country-aware provisioning in the `handleCheckoutCompleted` webhook handler.
- **Auth + Supabase clients**: See `auth-database-multitenancy` skill for `createSupabaseServer()` vs service role patterns, and why the webhook handler uses service role for all writes.
- **Voice call post-call pipeline (sole overage-reporting path)**: See `voice-call-architecture` skill for how the Python agent (`livekit-agent/src/post_call.py`, separate Railway repo) calls `increment_calls_used` and reports Stripe meter events via `stripe.billing.meter_events.create` (`event_name='voco_calls'`, `identifier=overage_{call_id}`). The Next.js side only creates the overage subscription item at onboarding; it never reports usage.
- **Dashboard billing page**: See `dashboard-crm-system` skill for how the billing page fits into the More menu structure and the BillingWarningBanner/TrialCountdownBanner in the dashboard layout.
- **Phase 59 invoice attribution (Voco internal invoices — NOT Stripe invoices)**: The Voco `invoices` table (migrations 029 + Phase 59) had `lead_id` replaced by `job_id` (NULLABLE). Customer is now derivable via `invoices.job_id → jobs.customer_id`. Ad-hoc invoices without a job remain valid (D-11 — NOT NULL enforcement deferred). The Customer detail page's Invoices tab (Phase 59 Plan 07) queries `invoices JOIN jobs ON jobs.id = invoices.job_id WHERE jobs.customer_id = :id`, gated by `features_enabled.invoicing`. Full schema in `auth-database-multitenancy` skill.

---


### Important: Keeping This Document Updated

When making changes to any file listed in the File Map above, update the relevant sections of this skill document to reflect the new behavior. Key areas to keep current:

- Pricing Plans — if plans, prices, or limits change
- Checkout Session Creation — if checkout flow or params change
- Webhook Handler — if new event types are added or handling logic changes
- Database Tables — if schema changes or new billing-related migrations are added
- Environment Variables — if new Stripe-related env vars are added

# Feature Landscape

**Domain:** SaaS subscription billing and usage enforcement for AI voice receptionist platform
**Milestone:** v3.0 — Stripe subscription billing, per-call usage metering, plan limit enforcement
**Researched:** 2026-03-26
**Confidence:** HIGH (Stripe official docs, verified patterns) / MEDIUM (UX conventions, competitor billing patterns)

---

## Scope

This file covers ONLY the new features for milestone v3.0: turning a free platform into a revenue-generating SaaS by adding Stripe subscription billing, per-call usage tracking, plan limit enforcement, and a billing management dashboard.

The existing platform (voice receptionist, triage, booking, calendar sync, lead CRM, notifications, onboarding wizard, marketing site) is treated as a stable dependency. "Existing" means already built in v1.0–v2.0.

Pricing tiers already defined in the UI (Starter $99/40 calls, Growth $249/120 calls, Scale $599/400 calls, Enterprise custom/unlimited) are taken as given — this research covers the billing mechanics, not tier design.

---

## Table Stakes

Features users expect. Missing these = the billing system feels incomplete, broken, or untrustworthy.

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| 14-day free trial, no credit card required | Industry standard for B2B SaaS — plumbers and HVAC owners won't enter card details before experiencing the product; credit-card-required trials cut conversion dramatically | LOW | Stripe Checkout with `payment_method_collection: 'if_required'` + `trial_period_days: 14` |
| Hard paywall when trial expires | If the product still works after trial ends, there is no conversion pressure; trial-expired tenants must hit a blocking upgrade prompt on every dashboard page | MEDIUM | `customer.subscription.deleted` webhook → `subscription_status` flag in `tenants` table → middleware gate |
| Stripe Checkout for plan selection | Users expect to enter payment info on a Stripe-hosted page (trusted, PCI compliant) rather than a custom form; custom card input forms are a trust red flag for SME owners | LOW | Stripe Checkout Session API, `mode: 'subscription'` |
| Per-call usage tracking | Usage-metered plans are only meaningful if every call is counted accurately; undercounting = revenue loss, overcounting = support tickets | MEDIUM | Call completion webhook (Retell) → increment `usage_calls` counter in DB, scoped per tenant per billing period |
| Usage meter visible in dashboard | Owners need to see "32 of 40 calls used" before they hit the limit — surprise paywalls generate churn; usage visibility is the most common billing dashboard feature requested | LOW | `usage_calls` + `plan_call_limit` from `subscriptions` table; display in existing dashboard |
| Plan limit enforcement (hard stop at limit) | When call quota is exhausted, the AI must not answer additional calls — if it does, the owner gets free service while Stripe charges nothing | MEDIUM | Pre-call quota check in Retell webhook → reject/redirect call if `usage_calls >= plan_call_limit` |
| Upgrade/downgrade via Stripe Customer Portal | Owners need self-serve plan changes; building a custom plan-change UI from scratch is unnecessary when Stripe Customer Portal handles it; owners also expect this from every SaaS product they use | LOW | Stripe Customer Portal configuration (`portal_configuration` API), exposed from billing dashboard page |
| Cancellation via Stripe Customer Portal | Making cancellation hard does not prevent churn — it generates negative reviews; owners must be able to cancel without contacting support | LOW | Stripe Customer Portal handles cancellation with optional reason survey and retention offer |
| Invoice history and PDF download | Finance-conscious SME owners need to download invoices for their accountant; this is the #1 billing support ticket driver when absent | LOW | Stripe Customer Portal invoice section (built-in) OR Stripe API `invoices.list` rendered in dashboard |
| Payment method update | Card expiry is the leading cause of involuntary churn (failed payments = 9% of annual billings, 20–40% of total churn); owners must be able to update their card | LOW | Stripe Customer Portal payment method section (built-in) |
| Failed payment grace period and retry | Stripe Smart Retries recovers 35–50% of failed payments; without retries, every failed payment is instant churn | LOW | Stripe Smart Retries (configure in Stripe dashboard); `invoice.payment_failed` webhook → notify owner |
| Trial countdown and upgrade prompt in dashboard | Owners who do not see their trial expiring will not convert; a countdown banner with "X days left" and a visible upgrade button is required for any no-CC trial | MEDIUM | `trial_end` from Stripe subscription → compute days remaining → conditional banner in dashboard layout |
| Post-trial paywall (access gate) | After trial expires with no payment method, the dashboard and AI service must be gated; trial accounts that convert to cancelled status must land on an upgrade page, not their normal dashboard | MEDIUM | Middleware reads `subscription_status` from DB (synced via webhooks); gate on `trialing`, `active`, `past_due` statuses |

---

## Differentiators

Features that are not strictly required but add competitive or product value beyond a bare-bones billing implementation.

| Feature | Value Proposition | Complexity | Depends On |
|---------|-------------------|------------|------------|
| Overage billing (per-call beyond plan limit) | Instead of hard-stopping at 40/120/400 calls, charge $X per additional call; reduces friction for high-volume periods (busy season, emergency surge) and turns limit exhaustion into revenue rather than churn | HIGH | Stripe metered billing add-on price OR custom overage calculation at billing cycle end; requires DB tracking of overage calls separately |
| Trial-end email series (days 3, 7, 12) | Triggered by `customer.subscription.trial_will_end` (Stripe sends 3 days before end); custom email at day 7 and day 12 are not Stripe-native and require a cron job; email series increases trial conversion 2–3x | MEDIUM | Cron jobs firing at trial day 7 and 12; Resend email templates; `trial_end` stored in DB |
| Pause instead of cancel on missed payment | When a payment method is missing at trial end, pausing the subscription (vs cancelling) lets the owner add a card and resume without losing their data or re-onboarding; reduces involuntary churn | LOW | Stripe `trial_settings.end_behavior.missing_payment_method: 'pause'` instead of `'cancel'`; handle `customer.subscription.paused` webhook |
| In-dashboard plan comparison on upgrade prompt | When the trial countdown banner is clicked, show a plan comparison table (Starter vs Growth vs Scale) rather than redirecting directly to Checkout; owners who understand the tier difference convert at higher rates | LOW | Static plan table in UI (already exists on marketing pricing page); reuse or adapt |
| Real-time usage alert at 80% of limit | Notify owner via SMS/email when they hit 80% of their call quota (e.g., 32/40 calls); gives them time to upgrade before hitting the wall rather than discovering the limit mid-call | MEDIUM | Threshold check in call completion handler; `usage_alert_sent` flag in `subscriptions` table to prevent repeat alerts; Twilio SMS + Resend email |
| Subscription reactivation flow | After cancellation, allow owners to reactivate their subscription from the dashboard without going through full onboarding again; reduces re-acquisition cost | LOW | Stripe `subscriptions.create` with existing `customer_id`; OR Stripe Customer Portal reactivation (if configured) |
| MRR and revenue display in admin view | For the product owner (not the tenant), a simple admin page showing total active subscriptions, MRR, and trial conversion rate; not needed for launch but useful for product decisions | HIGH | Admin-only dashboard page; requires separate admin auth gate; aggregate queries on `subscriptions` table |

---

## Anti-Features

Features that are commonly considered, sound reasonable, but cause more harm than good in this context.

| Anti-Feature | Why Requested | Why Problematic | What to Do Instead |
|--------------|---------------|-----------------|-------------------|
| Custom card input form (no Stripe Checkout) | "We want full UI control over the payment experience" | Building a custom payment form means handling raw card data, which triggers PCI DSS compliance scope; Stripe Checkout is pre-built, trusted, and converts better for SME owners who recognize Stripe's UI | Use Stripe Checkout Session for all payment collection; redirect back to dashboard on success |
| Soft limit with no enforcement (just a warning) | "We don't want to interrupt the AI service, just warn the owner" | Without a hard limit, the product can be exploited indefinitely; tenants who discover there's no enforcement will not upgrade; limits that don't limit are marketing theater | Hard stop at plan limit; overage billing (differentiator) is the right escape valve, not removing the limit |
| Building a custom invoice PDF generator | "We want invoices to match our brand" | Stripe already generates legally compliant invoices and stores them on the customer account; building a custom PDF generator adds development time with negligible user value | Use Stripe Customer Portal invoice history (built-in) or `invoice.invoice_pdf` URL from Stripe API |
| Prorate immediately on downgrade (charge for less) | "Customers should pay less immediately when they downgrade" | Immediate proration creates a confusing mid-cycle credit, triggers an immediate partial invoice, and adds accounting complexity; owners expect subscription changes to take effect at the next billing cycle | Schedule downgrades at end of billing period (`schedule_at_period_end: true`); upgrades can be immediate with proration (owners expect to pay more immediately) |
| Building a custom dunning email system | "We need to control the failed payment email copy" | Stripe's built-in Smart Retry + email system recovers 35–50% of failed payments with zero engineering; building a custom dunning system duplicates effort and is unlikely to outperform Stripe's ML-based retry timing | Use Stripe Smart Retries + configure Stripe's built-in payment failure emails; only add custom logic if Stripe's defaults prove insufficient |
| Enterprise plan with custom billing logic | "We should handle enterprise customers manually" | Enterprise billing requires manual invoicing, custom contracts, and sales negotiation; building custom Enterprise billing mechanics in v3.0 adds scope for one hypothetical customer | Ship Enterprise tier as "contact us" CTA with no automated billing; handle manually via Stripe dashboard direct invoice until there is an actual enterprise customer |
| Billing for inbound calls to AI that didn't connect | "Count every Retell webhook event" | Retell fires webhooks for calls that never connected (ring-no-answer, voicemail redirects, early hangups); counting these as "calls used" will generate support tickets from owners who feel charged for non-service | Only increment usage counter on `call_ended` webhook with `call_status: 'ended'` and a minimum duration threshold (e.g., >10 seconds); exclude failed/short calls |
| Mid-cycle usage reset on plan upgrade | "If they upgrade mid-cycle, reset their call count" | Resetting usage on upgrade means a tenant who used 38/40 calls can upgrade to Growth and immediately get 120 fresh calls; this exploits the upgrade mechanic as a usage reset | Do NOT reset usage on upgrade; usage resets only on billing cycle renewal; upgraded plan limit applies to remaining calls in current period |

---

## Feature Dependencies

```
Stripe Products & Prices (Starter, Growth, Scale)
    |-- required before --> Stripe Checkout Session
    |-- required before --> Stripe Customer Portal plan switching

14-Day Free Trial (Checkout Session with trial_period_days)
    |-- creates --> Stripe Customer (customer_id)
    |-- creates --> Stripe Subscription (subscription_id, status: 'trialing')
    |-- stored in --> subscriptions table (tenant_id, stripe_customer_id, stripe_subscription_id, status, trial_end, plan_id, call_limit)
    |-- enables --> Trial countdown banner (dashboard)
    |-- triggers (day 11) --> customer.subscription.trial_will_end webhook (Stripe fires 3 days before end)

Stripe Webhook Handler (/api/webhooks/stripe)
    |-- consumes --> customer.subscription.created
    |-- consumes --> customer.subscription.updated (status changes: trialing→active, active→past_due, etc.)
    |-- consumes --> customer.subscription.deleted (trial expired, cancelled)
    |-- consumes --> customer.subscription.trial_will_end (3 days before trial end)
    |-- consumes --> invoice.payment_succeeded (reset/confirm billing cycle)
    |-- consumes --> invoice.payment_failed (notify owner, trigger grace period)
    |-- updates --> subscriptions table (status, current_period_start, current_period_end)

Per-Call Usage Tracking
    |-- triggered by --> Retell call_ended webhook (existing)
    |-- requires --> tenant resolution from call metadata (existing)
    |-- increments --> usage_calls in subscriptions or usage_periods table
    |-- feeds --> Usage meter UI component
    |-- feeds --> 80% threshold alert (differentiator)
    |-- feeds --> Hard limit enforcement check

Hard Limit Enforcement
    |-- requires --> Per-call usage tracking (usage_calls current value)
    |-- requires --> plan_call_limit in subscriptions table
    |-- check fires --> On Retell call_started webhook (before call is accepted)
    |-- on limit reached --> Reject call OR play "service unavailable" message to caller

Subscription Status Gate (Middleware)
    |-- reads --> subscription_status from subscriptions table (synced by webhook handler)
    |-- gates --> All dashboard routes (trialing/active/past_due = allow; cancelled/paused = block)
    |-- gates --> AI call acceptance (active/trialing only)
    |-- redirects --> /billing/upgrade on blocked access

Billing Dashboard Page (/dashboard/billing)
    |-- reads --> subscriptions table (plan, status, usage, trial_end, current_period_end)
    |-- renders --> Current plan card + usage meter
    |-- renders --> Trial countdown banner (when status = trialing)
    |-- links to --> Stripe Customer Portal (manage plan, invoices, payment method, cancel)
    |-- links to --> Stripe Checkout (upgrade from trial)

Stripe Customer Portal
    |-- requires --> stripe_customer_id in subscriptions table
    |-- provides --> Plan upgrade/downgrade
    |-- provides --> Cancellation with reason survey
    |-- provides --> Invoice history + PDF download
    |-- provides --> Payment method update
    |-- fires webhooks back --> Stripe Webhook Handler on any subscription change
```

### Dependency Notes

- **Stripe Products and Prices must be created first.** Everything else references the Price IDs. These are created once in the Stripe dashboard or via API during setup; Price IDs are stored in environment variables.
- **The `subscriptions` table is the billing source of truth.** Webhooks keep it in sync with Stripe. The application must never query Stripe API in the hot path (call acceptance, page load); it reads from its own DB.
- **Usage tracking attaches to the existing Retell call webhook.** No new webhook infrastructure is needed; the existing Retell webhook handler gains a usage-increment step.
- **Hard limit enforcement must fire before Retell connects the call.** If the check happens after the call starts, the owner is already billed by Retell for the minute. Enforcement must be in the `call_started` webhook or equivalent pre-call hook.
- **Stripe Customer Portal eliminates the need for custom plan-change UI.** The portal handles upgrade, downgrade, cancellation, invoice history, and payment method update. The only custom UI needed is the portal redirect button in the billing dashboard.
- **Trial end behavior must be configured before launch.** `trial_settings.end_behavior.missing_payment_method: 'pause'` (vs `cancel`) is a key product decision that affects churn. Pausing is recommended (differentiator).

---

## MVP Definition

### Launch With (v3.0)

- [ ] **Stripe products and prices created** (Starter, Growth, Scale; Price IDs in env vars) — Required before any billing flows work
- [ ] **14-day free trial via Stripe Checkout (no CC required)** — Auto-starts after onboarding completion; `payment_method_collection: 'if_required'`
- [ ] **`subscriptions` database table** (tenant_id, stripe_customer_id, stripe_subscription_id, status, plan_id, call_limit, usage_calls, current_period_start, current_period_end, trial_end) — Billing source of truth
- [ ] **Stripe webhook handler** syncing subscription status changes to DB — Required for all enforcement to work
- [ ] **Per-call usage increment** on `call_ended` webhook (minimum duration filter: >10 seconds) — Drives usage meter and limit enforcement
- [ ] **Hard limit enforcement** on pre-call hook: reject call if `usage_calls >= call_limit` — Core monetization gate
- [ ] **Subscription status middleware gate** — Block dashboard + AI service for `cancelled`/`paused` status; redirect to `/billing/upgrade`
- [ ] **Trial countdown banner in dashboard** — Show "X days left in trial" when `status = trialing`; include upgrade CTA button
- [ ] **Billing dashboard page (`/dashboard/billing`)** — Current plan, usage meter (X of Y calls), trial/renewal date, link to Stripe Customer Portal
- [ ] **Stripe Customer Portal integration** — Plan changes, cancellation, invoice history, payment method update; link from billing dashboard
- [ ] **Failed payment notification** — On `invoice.payment_failed` webhook, send SMS + email to owner with payment update link
- [ ] **Post-trial paywall page (`/billing/upgrade`)** — Landing page for expired/cancelled tenants with plan selection and Stripe Checkout link

### Add After Validation (v3.x)

- [ ] **80% usage alert** (SMS + email when `usage_calls >= 0.8 * call_limit`) — High value but not blocking for launch
- [ ] **Trial email series (day 7 and day 12 reminders)** — Stripe fires `trial_will_end` at day 11; custom day 7 needs a cron job
- [ ] **Pause on trial end** (instead of cancel) — Set `end_behavior.missing_payment_method: 'pause'`; reduces involuntary churn; add after base flow is validated
- [ ] **Overage billing** (per-call charges beyond plan limit) — Requires Stripe metered billing configuration; high revenue upside but high complexity; do not ship until base billing is stable

### Future Consideration (v4+)

- [ ] **Enterprise manual billing** — Custom contracts, manual invoicing; do not automate until first enterprise customer signs
- [ ] **Admin MRR dashboard** — Total ARR, trial conversion rate, churn metrics; needed for product decisions but not for launch
- [ ] **Annual billing option** (discount for annual prepay) — Common upsell lever; add when monthly billing is stable
- [ ] **Coupon/promo codes for early adopters** — Stripe supports this in Checkout; add when sales/marketing motion requires it

---

## Feature Prioritization Matrix

| Feature | Revenue Impact | Implementation Cost | Priority |
|---------|---------------|---------------------|----------|
| Stripe products + prices | BLOCKER | LOW | P0 |
| `subscriptions` table | BLOCKER | LOW | P0 |
| Stripe Checkout (trial signup) | HIGH | LOW | P1 |
| Stripe webhook handler | HIGH | MEDIUM | P1 |
| Per-call usage increment | HIGH | LOW | P1 |
| Hard limit enforcement | HIGH | MEDIUM | P1 |
| Subscription status middleware | HIGH | MEDIUM | P1 |
| Trial countdown banner | MEDIUM | LOW | P1 |
| Billing dashboard page | MEDIUM | LOW | P1 |
| Stripe Customer Portal link | MEDIUM | LOW | P1 |
| Failed payment notification | MEDIUM | LOW | P1 |
| Post-trial paywall page | MEDIUM | LOW | P1 |
| 80% usage alert | MEDIUM | LOW | P2 |
| Trial email day 7 + 12 | MEDIUM | LOW | P2 |
| Pause on trial end | MEDIUM | LOW | P2 |
| Overage billing | HIGH (deferred) | HIGH | P3 |
| Admin MRR dashboard | LOW | HIGH | P4 |

**Priority key:**
- P0: Blocking — nothing works without this
- P1: Must have for v3.0 launch
- P2: Should have, add after P1 is stable
- P3: Significant revenue upside but significant complexity; defer
- P4: Operational/product insight; not user-facing

---

## Billing Lifecycle State Machine

```
[Tenant completes onboarding]
    |
    v
[14-day trial starts]
    |-- status: trialing
    |-- no payment method required
    |-- usage counts accumulate
    |-- AI service: active
    |-- dashboard: active (with countdown banner)
    |
    v (day 11)
[Stripe fires: customer.subscription.trial_will_end]
    |-- Trigger: in-app countdown banner update
    |-- Trigger (optional): email reminder
    |
    v (day 14)
    |
    |--[Tenant adds CC before expiry]----> [Subscription activates]
    |                                          |-- status: active
    |                                          |-- billing cycle starts
    |                                          |-- usage resets
    |                                          |-- AI service: active
    |
    |--[No CC added]----> [Subscription pauses] (recommended)
                              |-- status: paused
                              |-- AI service: BLOCKED
                              |-- dashboard: BLOCKED → /billing/upgrade
                              |
                              v [Tenant adds CC]
                              [Subscription resumes]
                                  |-- status: active

[Active subscription]
    |
    |--[Monthly renewal]----> [invoice.payment_succeeded]
    |                              |-- usage_calls reset to 0
    |                              |-- current_period updated
    |
    |--[Payment fails]----> [invoice.payment_failed]
    |                           |-- SMS + email to owner
    |                           |-- Stripe Smart Retries (up to 8 over 28 days)
    |                           |-- status: past_due (still active during grace)
    |                           |
    |                           v [retries exhausted]
    |                           [status: cancelled]
    |                               |-- AI service: BLOCKED
    |
    |--[Plan upgrade]----> [Immediate proration, new call_limit applies]
    |
    |--[Plan downgrade]---> [Scheduled end-of-period, current limit until cycle end]
    |
    |--[Cancellation via portal]----> [Access until period_end, then BLOCKED]
    |
    |--[Quota reached]----> [Hard stop: calls rejected until cycle resets or upgrade]
```

---

## Expected Stripe Webhook Events to Handle

| Event | When It Fires | Action Required |
|-------|---------------|-----------------|
| `checkout.session.completed` | Tenant completes Checkout | Create/update `subscriptions` row with `stripe_customer_id` and `stripe_subscription_id` |
| `customer.subscription.created` | After Checkout completes | Set `status: trialing`, store `trial_end`, `current_period_start/end`, `plan_id`, `call_limit` |
| `customer.subscription.trial_will_end` | 3 days before trial ends | Update UI flag in DB; optionally trigger reminder email |
| `customer.subscription.updated` | Status change, plan change | Sync `status`, `plan_id`, `call_limit`, `current_period_start/end` to DB |
| `customer.subscription.deleted` | Trial cancelled (no CC) or manual cancel | Set `status: cancelled`; block access |
| `customer.subscription.paused` | Trial end with no CC (if pause configured) | Set `status: paused`; block access |
| `customer.subscription.resumed` | Owner adds CC and resumes paused sub | Set `status: active`; unblock access |
| `invoice.payment_succeeded` | Monthly renewal charges successfully | Reset `usage_calls` to 0; update `current_period_start/end` |
| `invoice.payment_failed` | Card declined on renewal | Send SMS + email to owner; Stripe handles retries |

---

## Competitor Billing Feature Benchmarks

Reference: How similar B2B SaaS tools (especially SME-focused) handle billing.

| Feature | Typical B2B SaaS | This Product (v3.0) |
|---------|-----------------|---------------------|
| Trial | 14-day, CC required | 14-day, NO CC required |
| Trial conversion prompt | Email only | In-dashboard countdown banner + email |
| Plan limit enforcement | Soft warning | Hard stop + redirect |
| Overage | Not common at SME tier | Deferred to v3.x |
| Self-serve plan change | Stripe Portal or custom | Stripe Customer Portal |
| Invoice access | Email or portal | Stripe Customer Portal |
| Failed payment recovery | Stripe retries only | Stripe retries + SMS/email to owner |
| Cancellation | Portal or contact support | Stripe Customer Portal (self-serve) |

The no-CC trial is deliberately more generous than most B2B SaaS (which require a card). This is appropriate for the SME plumber/HVAC market where trust barriers are high and owners are skeptical of software subscriptions. The tradeoff is lower intent signal at signup — addressed by the in-app countdown banner and mandatory paywall at expiry.

---

## Sources

- [Stripe Billing — Recurring Payments & Subscription Solutions](https://stripe.com/billing) — HIGH confidence (official)
- [Stripe: Use trial periods on subscriptions](https://docs.stripe.com/billing/subscriptions/trials) — HIGH confidence (official docs)
- [Stripe: Configure free trials (Checkout)](https://docs.stripe.com/payments/checkout/free-trials) — HIGH confidence (official docs)
- [Stripe: Upgrade and downgrade subscriptions](https://docs.stripe.com/billing/subscriptions/upgrade-downgrade) — HIGH confidence (official docs)
- [Stripe: Prorations](https://docs.stripe.com/billing/subscriptions/prorations) — HIGH confidence (official docs)
- [Stripe: Configure the customer portal](https://docs.stripe.com/customer-management/configure-portal) — HIGH confidence (official docs)
- [Stripe: Scheduled downgrades in customer portal (2024-10-28)](https://docs.stripe.com/changelog/acacia/2024-10-28/customer-portal-schedule-downgrades) — HIGH confidence (official changelog)
- [Stripe: Automate payment retries (Smart Retries)](https://docs.stripe.com/billing/revenue-recovery/smart-retries) — HIGH confidence (official docs)
- [Stripe: Using webhooks with subscriptions](https://docs.stripe.com/billing/subscriptions/webhooks) — HIGH confidence (official docs)
- [Stripe: Build a subscriptions solution for AI startup (usage-based)](https://docs.stripe.com/get-started/use-cases/usage-based-billing) — HIGH confidence (official docs)
- [Failed Payment Recovery 2025: Stripe Smart Retries & Dunning](https://www.quantledger.app/blog/how-to-recover-failed-payments-stripe) — MEDIUM confidence (verified against official docs)
- [SaaS Stripe Integration: Billing Made Simple 2026](https://designrevision.com/blog/saas-stripe-integration) — MEDIUM confidence (industry guide)
- [Kinde: Dunning Strategies for SaaS](https://www.kinde.com/learn/billing/churn/dunning-strategies-for-saas-email-flows-and-retry-logic/) — MEDIUM confidence (industry guide)
- [10 Best SaaS Billing Platforms 2026 (Outseta)](https://www.outseta.com/posts/best-saas-billing-platforms) — MEDIUM confidence (survey, competitor analysis)

---

*Feature research for: HomeService AI Agent — v3.0 Subscription Billing & Usage Enforcement*
*Researched: 2026-03-26*

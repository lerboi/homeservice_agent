# Research Summary: v3.0 Subscription Billing & Usage Enforcement

**Project:** HomeService AI Agent
**Milestone:** v3.0 — Stripe subscription billing, per-call usage metering, plan limit enforcement
**Synthesized:** 2026-03-26
**Research Files:** STACK.md · FEATURES.md · ARCHITECTURE.md · PITFALLS.md

---

## Executive Summary

The v3.0 milestone converts the HomeService AI Agent from a free platform into a monetized SaaS product. The core mechanic is straightforward: tenants start a 14-day free trial (no credit card required) when they complete onboarding, receive a hard paywall when the trial expires or their call quota is exhausted, and self-serve their billing via Stripe Customer Portal. The entire integration is additive — it wires into four defined seams of the existing architecture without restructuring any existing component. No new infrastructure services are required; all billing logic runs in Next.js API routes and Supabase.

The recommended approach is Stripe-first with Supabase as the enforcement cache. Stripe owns the subscription lifecycle and invoicing; the local `subscriptions` table mirrors Stripe state via webhooks and is the only data source consulted on the hot path (inbound call handling, dashboard page loads). This design keeps AI call pickup latency well under Retell's 1-second requirement while maintaining billing accuracy. Stripe Customer Portal handles all self-serve subscription management (plan changes, cancellation, invoices, payment method update), eliminating the need for any custom billing management UI.

The highest-risk aspects of this integration are webhook idempotency (Stripe and Retell both deliver events more than once), enforcement gate latency (calling the Stripe API synchronously on the call path will break call pickup), and trial expiry leakage (failing to listen for `customer.subscription.deleted` after a no-CC trial allows indefinite free access). All three risks have clear, well-documented mitigations that must be built in Phase 1, before any enforcement logic is layered on top.

---

## Key Findings

### From STACK.md

| Technology | Rationale |
|------------|-----------|
| `stripe` ^17.7.0 (server-side) | Latest stable non-preview SDK line. All Stripe API calls run server-side only via Server Actions and route handlers. Never expose the secret key to the client. |
| `@stripe/stripe-js` ^5.x (client-side) | Required for Stripe Checkout redirect. Import via `@stripe/stripe-js/pure` to defer CDN load until the checkout page renders. No SSR conflict with React 19. |
| Stripe Billing Meters API v2 | The only supported path for usage-based overage billing since the legacy usage records API was removed in Stripe API version `2025-03-31.basil`. Required only if overage billing is added in a future phase — not needed for flat-rate enforcement in v3.0. |
| Supabase JS client (existing) | Billing tables use the same data access pattern as the rest of the project. No ORM to be added for billing. |

**Critical implementation detail:** The App Router webhook handler must use `request.text()` — not `request.json()` — to get the raw body for Stripe signature verification. Using the parsed body silently breaks signature verification and allows unsigned payloads through.

**Environment variables required:** `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, one Price ID per plan, and `STRIPE_METER_ID` (reserved for future overage billing).

### From FEATURES.md

**P0 — Blocking prerequisites (nothing else works without these):**
- Stripe Products and Prices created for all three plans (Price IDs stored in env vars)
- `subscriptions` database table as the billing source of truth per tenant

**P1 — Must-ship for v3.0 launch:**
- 14-day free trial via Stripe Checkout, no credit card required (`payment_method_collection: 'if_required'`)
- Stripe webhook handler syncing all subscription lifecycle events to local DB
- Per-call usage increment on `call_ended` webhook (with minimum 10-second duration filter; exclude test calls)
- Hard limit enforcement: reject call if `calls_used >= calls_limit`
- Subscription status middleware gate: block dashboard and AI service for `cancelled`/`paused` status
- Trial countdown banner in dashboard ("X days left" with upgrade CTA)
- Billing dashboard page at `/dashboard/more/billing` (plan, usage meter, renewal date, portal link)
- Stripe Customer Portal integration (plan changes, cancellation, invoices, payment method)
- Failed payment notification (SMS + email to owner on `invoice.payment_failed`)
- Post-trial paywall page (`/billing/upgrade`) for expired and cancelled tenants

**P2 — Add after v3.0 is stable:**
- 80% usage alert (SMS + email when `calls_used >= 0.8 * calls_limit`; `usage_alert_sent` flag to prevent repeat)
- Trial email series at day 7 and day 12 (Stripe only fires `trial_will_end` at day 11; custom cron needed)
- Pause on trial end instead of cancel (reduces involuntary churn; adds `paused` state to enforcement)

**P3 — Defer (high complexity, high revenue upside):**
- Overage billing per-call beyond plan limit (requires Stripe Billing Meters v2 + metered price configuration)

**Explicitly deferred to v4+:** Admin MRR dashboard, annual billing, coupon/promo codes, Enterprise automated billing.

**Anti-features to avoid:**
- Custom card input form — use Stripe Checkout for PCI compliance and conversion
- Soft limit with no enforcement — hard stop is required; soft warnings have no conversion pressure
- Custom invoice PDF generator — Stripe Customer Portal handles this built-in
- Immediate proration on downgrade — schedule at period end; upgrades prorate immediately
- Billing for calls under 10 seconds or with failed call status

### From ARCHITECTURE.md

**Integration philosophy:** Additive wiring, not structural change. Four defined seams into the existing codebase:

1. **`/api/stripe/webhook` (new route handler)** — Syncs all Stripe subscription lifecycle events into the `subscriptions` table. Uses `request.text()` for raw body, upserts on `stripe_subscription_id`, includes idempotency key table (`stripe_webhook_events`).

2. **`subscriptions` table (new Supabase table)** — One row per tenant. Key columns: `stripe_customer_id`, `stripe_subscription_id`, `status`, `plan_id`, `calls_limit`, `calls_used`, `trial_ends_at`, `current_period_start`, `current_period_end`, `cancel_at_period_end`. Indexed on `tenant_id` for the enforcement hot path. RLS: tenant can SELECT own row; INSERT/UPDATE only via service role (webhook handlers).

3. **`handleInbound()` modification** — Adds subscription check to the parallel Supabase queries already running in the inbound Retell webhook handler. Single indexed query running in parallel with 4 existing queries — zero net latency increase. Gate logic: allow if `(active || trialing) && calls_used < calls_limit`; block with `booking_enabled: 'false'` and graceful caller message otherwise. `past_due` tenants get a 3-day grace window before blocking.

4. **`processCallEnded()` modification** — Adds atomic increment via Postgres RPC (`increment_calls_used`) and `usage_events` insert after call completes. `call_id` is the idempotency key. Test calls are excluded.

**Trial auto-start:** `/api/onboarding/complete` is modified to synchronously create a Stripe customer and 14-day trial subscription, and immediately write the local `subscriptions` row on onboarding completion. Does not wait for the `customer.subscription.created` webhook — the webhook handler upserts idempotently when it arrives.

**Billing dashboard:** New page at `/dashboard/more/billing` under the existing More hub. Reads from `subscriptions` table; links to Stripe Customer Portal and Stripe Checkout via Server Actions (`createCheckoutSession`, `createPortalSession`).

### From PITFALLS.md

**Critical pitfalls (cause data loss, free-access leakage, or broken enforcement):**

| # | Pitfall | Prevention Summary |
|---|---------|-------------------|
| 1 | Webhook idempotency not enforced — double-counting subscriptions and usage | `stripe_webhook_events` table with UNIQUE on `event_id`; `usage_events.call_id` UNIQUE with `ON CONFLICT DO NOTHING`; wire usage increment to `call_analyzed` (fires exactly once per call) |
| 2 | Enforcement gate calls Stripe API synchronously — breaks Retell 1-second call pickup | Never call Stripe API on the inbound call path; read only from local `subscriptions` table (single indexed query, 5–20ms); accept up to 30-second staleness on enforcement status |
| 3 | Trial expiry without payment method grants indefinite free access | Listen for ALL subscription events including `customer.subscription.deleted` and `customer.subscription.paused`; map Stripe status to local status on every event; test with Stripe Test Clocks |
| 4 | Race condition between concurrent calls corrupts usage counter | Atomic `UPDATE ... SET calls_used = calls_used + 1` (Postgres RPC); advisory lock or `SELECT FOR UPDATE` only when `calls_used >= plan_limit - 2` (near-limit zone) |
| 9 | Out-of-order Stripe event delivery corrupts local subscription state | Add `stripe_updated_at` version column; only apply event if its timestamp is newer than stored value; fetch from Stripe API directly if a dependency row is missing |

**Moderate pitfalls (incorrect behavior, not data loss):**
- Enforcement wired to `call_started` instead of the inbound webhook (Pitfall 10) — the call is already live by `call_started`; enforce at the inbound handler only
- Usage counter not initialized at onboarding (Pitfall 11) — creates a window of undefined enforcement; fix by creating the subscription row synchronously during onboarding
- Billing cycle reset via cron instead of `invoice.paid` webhook (Pitfall 8) — cron drifts from actual Stripe billing cycle; always reset in response to `invoice.paid` where `billing_reason = 'subscription_cycle'`
- `past_due` treated as immediately suspended (Pitfall 6) — causes involuntary churn; implement 7-day grace period with escalating dunning notifications before full suspension

---

## Implications for Roadmap

The research points clearly to a 4-phase build structure, ordered by dependency and risk.

### Suggested Phase Structure

---

**Phase 1: Billing Foundation**

*Rationale:* Everything downstream depends on correct event processing and a reliable local subscription table. Idempotency, RLS policies, and out-of-order event protection must be built here — they cannot be retrofitted after production data is written without risking corruption or free-access leakage.

Deliverables:
- Stripe account setup: products, prices, Customer Portal configuration
- `subscriptions` and `usage_events` database tables with correct RLS (SELECT only for authenticated users; INSERT/UPDATE only via service role)
- `stripe_webhook_events` idempotency table (UNIQUE on `event_id`)
- `/api/stripe/webhook` route handler with signature verification, idempotency check, and `stripe_updated_at` version protection
- All subscription lifecycle events mapped to local status (including `deleted` and `paused`)
- `/api/onboarding/complete` modified to synchronously create Stripe customer + trial subscription + local row

Features from FEATURES.md: Stripe Products and Prices (P0), `subscriptions` table (P0), Stripe webhook handler (P1), Trial auto-start (P1)
Pitfalls addressed: #1 (idempotency), #3 (trial expiry leakage), #7 (RLS), #9 (out-of-order events), #11 (onboarding gap)
Research flag: Standard Stripe patterns with official documentation. No additional research phase needed.

---

**Phase 2: Usage Tracking**

*Rationale:* Usage data must be reliable before the enforcement gate can be layered on top. The atomic increment pattern and correct metering point (`call_analyzed` vs `call_ended`) must be established before Phase 3 builds enforcement on top of this counter.

Deliverables:
- `increment_calls_used` Postgres RPC function for atomic counter increment
- `processCallEnded()` modified to call the RPC and insert a `usage_events` row
- `call_id` idempotency key on `usage_events` (ON CONFLICT DO NOTHING)
- Test call exclusion (existing `isTestCall` check gates the increment)
- `calls_used` reset triggered by `invoice.paid` webhook (not a cron job)
- `billing_period_start` and `billing_period_end` stored on each usage row

Features from FEATURES.md: Per-call usage increment (P1)
Pitfalls addressed: #1 (Retell webhook idempotency), #4 (race condition on concurrent calls), #8 (billing cycle reset)
Research flag: Standard Postgres atomic increment patterns. No additional research phase needed.

---

**Phase 3: Subscription Lifecycle Management**

*Rationale:* Trial expiry handling and failed payment dunning are the highest-churn-risk areas. The grace period for `past_due` and correct downgrade scheduling must be designed here — patching them after launch requires careful production state migrations.

Deliverables:
- Trial countdown banner in dashboard (reads `trial_ends_at`, shows days remaining with upgrade CTA)
- Post-trial paywall page (`/billing/upgrade`) for expired and cancelled tenants
- Subscription status middleware gate (blocks dashboard and AI service for `cancelled`/`paused`; redirects to `/billing/upgrade`)
- `past_due` grace period (7 days; `past_due_grace_end` computed from webhook delivery timestamp)
- Failed payment notification (SMS + email on `invoice.payment_failed` with payment update link)
- Stripe Customer Portal integration (link from billing dashboard; handles all self-serve plan management)
- Upgrade proration policy (`proration_behavior: 'always_invoice'` for upgrades, `'none'` with end-of-period scheduling for downgrades)

Features from FEATURES.md: Hard paywall (P1), Subscription status middleware (P1), Trial countdown banner (P1), Customer Portal (P1), Failed payment notification (P1), Post-trial paywall (P1)
Pitfalls addressed: #5 (proration confusion), #6 (dunning grace period and involuntary churn)
Research flag: Dunning email copy, subject lines, and escalation schedule are not defined in research. Flag for content review during Phase 3 planning. Consider `/gsd:research-phase` for email sequence design.

---

**Phase 4: Enforcement Gate and Billing Dashboard**

*Rationale:* The enforcement gate is the final monetization lock. It must be implemented after usage tracking (Phase 2) is reliable and subscription lifecycle (Phase 3) is stable. The billing dashboard surfaces all billing state to the tenant and closes the conversion loop.

Deliverables:
- `handleInbound()` modified with subscription check (added to parallel Supabase queries; zero net latency)
- Block logic: expired subscription plays graceful caller message; quota exhausted plays graceful caller message
- Billing dashboard page at `/dashboard/more/billing` (plan card, usage meter, renewal date, portal link)
- Stripe Checkout flow (plan selection → Checkout Session → success redirect)
- Usage meter UI component (optionally real-time via Supabase Realtime)
- Trial-to-paid conversion path (Checkout reachable from trial countdown banner and billing page)

Features from FEATURES.md: Hard limit enforcement (P1), Billing dashboard (P1), Stripe Checkout (P1), Usage meter (table stakes)
Pitfalls addressed: #2 (enforcement latency — reads only from local DB), #10 (enforcement wired to correct webhook)
Research flag: Standard patterns with clear architecture guidance. No additional research phase needed.

---

**Phase 5 (v3.x): Post-Launch Enhancements**

Ship only after v3.0 is live, converting, and stable:
- 80% usage alert (SMS + email; `usage_alert_sent` flag prevents duplicate alerts)
- Trial email series at day 7 and day 12 (cron jobs; Resend templates)
- Pause on trial end instead of cancel (reduces involuntary churn; adds `paused` state to enforcement gate)

---

### Dependency Order

```
Phase 1: Billing Foundation
    — Phase 2: Usage Tracking
        — Phase 3: Lifecycle Management
            — Phase 4: Enforcement Gate + Dashboard
                — Phase 5: Post-Launch Enhancements
```

Phases 3 and 4 can be partially parallelized: the billing dashboard read path (rendering plan info, linking to portal) does not depend on the enforcement gate. However, enforcement gate must be the last gate opened to avoid inadvertently blocking legitimate tenants during development testing.

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| Stack | HIGH | All decisions backed by official Stripe docs and npm registry. Version recommendations are specific with documented rationale. The App Router `request.text()` pattern is verified against multiple community sources and confirmed against official docs. |
| Features | HIGH | Stripe documentation is authoritative for all lifecycle event mechanics. UX conventions (trial countdown banner, usage meter design) are standard B2B SaaS patterns but lack a single citable source — treat as MEDIUM for specific UI decisions. |
| Architecture | HIGH | Research includes actual codebase file paths and function names (`handleInbound`, `processCallEnded`, `call-processor.js`), meaning integration points are verified against real code, not assumed. The additive approach is low-risk. |
| Pitfalls | HIGH | All critical pitfalls include specific Stripe API behavior, Retell webhook timing details, and Postgres concurrency implications. Mitigations are concrete and phase-mapped. |

**Overall: HIGH**

### Gaps to Address During Planning

1. **Plan pricing and call limits conflict:** STACK.md references the existing marketing site pricing (Starter $99/40 calls, Growth $249/120 calls, Scale $599/400 calls) while ARCHITECTURE.md defines different limits (Starter 100, Growth 300, Pro 1000 at different price points). The actual Stripe Products, call limits, and Price IDs must be confirmed against the current live pricing page before Phase 1 begins.

2. **`call_ended` vs `call_analyzed` for usage increment:** ARCHITECTURE.md recommends `call_ended` for faster dashboard updates; PITFALLS.md recommends `call_analyzed` because it fires exactly once. Recommended resolution: use `call_ended` with `call_id` idempotency (faster feedback, retries handled). Document this decision explicitly in Phase 2 plan.

3. **Retell enforcement response format:** The exact dynamic variables payload that causes Retell to play a graceful "service unavailable" message (rather than silence) needs validation against the current Retell API contract. Confirm that `booking_enabled: 'false'` + `paywall_reason` fields are consumed by the LLM system prompt.

4. **Dunning email copy and schedule:** PITFALLS.md specifies Day 1/3/5/7 escalation for failed payments; FEATURES.md specifies Day 7/12 trial reminders. Exact Resend template copy, subject lines, and escalation timing are not defined. Flag for content review during Phase 3 planning.

---

## Sources (Aggregated)

**HIGH confidence — official documentation:**
- Stripe Billing Meters Usage-Based Implementation Guide: https://docs.stripe.com/billing/subscriptions/usage-based/implementation-guide
- Stripe Subscription Trials: https://docs.stripe.com/billing/subscriptions/trials
- Stripe Checkout Free Trials: https://docs.stripe.com/payments/checkout/free-trials
- Stripe Upgrade and Downgrade Subscriptions: https://docs.stripe.com/billing/subscriptions/upgrade-downgrade
- Stripe Prorations: https://docs.stripe.com/billing/subscriptions/prorations
- Stripe Webhooks with Subscriptions: https://docs.stripe.com/billing/subscriptions/webhooks
- Stripe Customer Portal: https://docs.stripe.com/customer-management/integrate-customer-portal
- Stripe Smart Retries: https://docs.stripe.com/billing/revenue-recovery/smart-retries
- Stripe Node.js SDK Releases: https://github.com/stripe/stripe-node/releases
- stripe npm package: https://www.npmjs.com/package/stripe

**MEDIUM confidence — community guides verified against official docs:**
- Stripe Checkout and Webhook in Next.js 15 (2025): https://medium.com/@gragson.john/stripe-checkout-and-webhook-in-a-next-js-15-2025-925d7529855e
- Stripe + Next.js Complete Guide 2025: https://www.pedroalonso.net/blog/stripe-nextjs-complete-guide-2025/
- Stripe Subscription Lifecycle in Next.js 2026: https://dev.to/thekarlesi/stripe-subscription-lifecycle-in-nextjs-the-complete-developer-guide-2026-4l9d

---

*Research synthesized from: STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md*
*Synthesis date: 2026-03-26*
*Ready for roadmap: yes*

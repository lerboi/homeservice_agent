# Technology Stack

**Project:** HomeService AI Agent — v3.0 Subscription Billing & Usage Enforcement
**Researched:** 2026-03-26
**Confidence:** HIGH (Stripe SDK verified via npm; webhook/meter patterns verified via official Stripe docs)

---

## Scope

This document covers ONLY the stack additions needed for v3.0 billing. The existing validated stack is unchanged:

- Next.js 16 / React 19 (App Router, Server Components, Server Actions)
- Supabase (Auth, Postgres, RLS, Realtime)
- shadcn/ui + Tailwind v4
- Resend (email)
- Sentry (error monitoring)

New capabilities required:

1. **Stripe subscription management** — Checkout Sessions, subscription lifecycle, Customer Portal
2. **Stripe billing meters** — per-call usage metering and overage billing
3. **Webhook handling** — subscription lifecycle events in Next.js App Router
4. **14-day free trial** — trial management, countdown UI, trial expiration enforcement
5. **Billing dashboard** — current plan, usage meter, invoice history, upgrade/downgrade UI
6. **Database schema** — subscriptions, usage_events, plan limits tables

---

## Recommended Stack — New Additions

### Core Libraries

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `stripe` | ^17.7.0 | Server-side Stripe API client | Latest major stable version (v17.x). Use server-side only — never expose secret key to client. Handles Checkout Sessions, subscription CRUD, Customer Portal sessions, billing meter events, invoice retrieval. |
| `@stripe/stripe-js` | ^5.x | Client-side Stripe.js loader | Required for Stripe Checkout redirect and Stripe Elements if needed. Loaded lazily from Stripe's CDN for PCI compliance. Use `loadStripe()` from `@stripe/stripe-js/pure` to defer load until checkout page renders. |

**Note on stripe version:** npm shows 20.4.1 as very latest (March 2026), but that ships with Stripe API version `2026-02-25.preview` — a preview API. Use `^17.7.0` (the latest non-preview-pinned stable line) unless you want to opt into the 2026 preview API. The difference: preview APIs may have breaking changes before they graduate. For a new billing integration, stability matters more than cutting-edge. Verify with `npm show stripe versions` before installing and pick the latest non-preview release. If the team confirms v20.x is acceptable, use `^20.4.1` — the client code is identical, only the API version pin changes.

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Stripe CLI | Local webhook forwarding during development | `stripe listen --forward-to localhost:3000/api/webhooks/stripe` — provides a `STRIPE_WEBHOOK_SECRET` for local testing. Not a npm dependency; install system-wide via `brew install stripe/stripe-cli/stripe` or download from Stripe. |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Payment | Stripe | Paddle, Lemon Squeezy | Stripe has the deepest Next.js + Supabase ecosystem, best usage-based billing tooling (Billing Meters API), and is what home service SME owners expect. Paddle/LS are good for global tax handling but that's not the current constraint. |
| Client-side Checkout | `@stripe/stripe-js` lazy load | Embed Stripe Elements in-page | Checkout redirect (hosted by Stripe) is faster to implement, PCI-compliant by default, and handles 3DS/SCA automatically. Build custom Elements later if conversion data shows need. |
| Usage tracking | Stripe Billing Meters (v2 API) | Track usage in Supabase only, sync to Stripe | Stripe Meters are now the only supported usage-based billing path (legacy usage records API removed in Stripe version 2025-03-31.basil). Track in both Supabase (for real-time plan enforcement) AND send meter events to Stripe (for billing). |
| Subscription DB | Raw Supabase tables (`subscriptions`, `usage_events`) | Prisma ORM | The project uses Supabase JS client directly everywhere. Introducing Prisma for one feature would fracture the data access pattern. Raw Supabase queries are sufficient; the schema is simple. |
| Trial enforcement | Stripe trial fields + Supabase `trial_ends_at` | Third-party billing library (e.g., `@lemonsqueezy/lemonsqueezy.js`) | Stripe's native `trial_period_days` parameter handles the trial on the billing side. Mirror `trial_ends_at` to Supabase for fast enforcement checks without hitting the Stripe API on every request. |

---

## Integration Architecture

### What Goes Where

```
Client (Browser)
  └─ @stripe/stripe-js        — loadStripe(), Checkout redirect, portal redirect

Server (Next.js App Router)
  ├─ Server Actions            — createCheckoutSession(), createPortalSession(),
  │                              cancelSubscription() — never expose Stripe secret to client
  ├─ /api/webhooks/stripe      — route handler, raw body via request.text(),
  │                              stripe.webhooks.constructEvent() verification
  └─ stripe (server SDK)       — all Stripe API calls

Supabase (Postgres)
  ├─ subscriptions table       — stripe_customer_id, stripe_subscription_id,
  │                              status, plan, trial_ends_at, current_period_end
  ├─ usage_events table        — tenant_id, call_id, timestamp (local tracking)
  └─ RLS policies              — tenants see only their own billing data

Stripe (External)
  ├─ Billing Meters            — aggregate call events for metered overage billing
  ├─ Customer Portal (hosted)  — upgrade/downgrade/cancel UI, no custom UI needed
  └─ Webhooks → /api/webhooks/stripe
```

### Webhook Handler Pattern (Next.js App Router)

The critical implementation detail: App Router `Request` is a Web API object. Use `request.text()` — NOT `request.json()` or `request.body()` — to get the raw body for Stripe signature verification. `request.body()` is parsed and will cause signature verification to fail.

```typescript
// app/api/webhooks/stripe/route.ts
import { headers } from 'next/headers';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: Request) {
  const body = await request.text();           // raw body — required for sig verification
  const headersList = await headers();
  const sig = headersList.get('stripe-signature')!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    return Response.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Handle events...
  return Response.json({ received: true });
}
```

Disable Next.js body parsing is NOT needed in App Router (it doesn't auto-parse route handlers — unlike Pages Router API routes). No `export const config = { api: { bodyParser: false } }` required.

### Stripe Billing Meters — Per-Call Usage

Stripe deprecated legacy usage records in API version 2025-03-31.basil. The current path is Billing Meters:

1. Create a meter once in Stripe Dashboard or via API: `event_name: "ai_call"`, `default_aggregation.formula: "sum"`
2. On each call completion (in the Retell webhook handler, after `call_ended`): send a meter event
3. The meter event increments the usage counter for the billing period
4. Metered price on the subscription charges overages at end of period

```typescript
// In Retell webhook handler, after a call ends:
await stripe.billing.meterEvents.create({
  event_name: 'ai_call',
  payload: {
    stripe_customer_id: tenant.stripe_customer_id,
    value: '1',
  },
});
```

For plan limit enforcement (hard paywall before overage): check usage against the plan limit in Supabase's `usage_events` table first. Only bill overages for paid tiers; block free-tier users when they hit the plan cap.

### Trial Management

Stripe handles billing-side trial: `trial_period_days: 14` on `stripe.subscriptions.create()`. No credit card required for trial start (Stripe supports `payment_behavior: 'default_incomplete'`).

Mirror trial state to Supabase for enforcement without hitting Stripe API on every request:

```typescript
// subscriptions table
trial_ends_at: timestamptz   // set from Stripe webhook: subscription.trial_end
status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused'
```

Webhook events to handle:
- `customer.subscription.trial_will_end` — fires 3 days before trial ends: send upgrade prompt email via Resend
- `customer.subscription.updated` — mirror status changes to Supabase
- `customer.subscription.deleted` — revoke access, update status to `canceled`
- `invoice.paid` — activate subscription, reset usage counter for new period
- `invoice.payment_failed` — update status to `past_due`, notify via Resend
- `invoice.payment_action_required` — prompt customer for 3DS authentication

### Stripe Customer Portal

Zero custom UI for subscription management. Create a portal session server-side and redirect:

```typescript
// Server Action: createPortalSession()
const session = await stripe.billingPortal.sessions.create({
  customer: tenant.stripe_customer_id,
  return_url: `${process.env.NEXT_PUBLIC_URL}/dashboard/billing`,
});
redirect(session.url);
```

Configure in Stripe Dashboard: allowed plans for upgrade/downgrade, cancellation policy, invoice history visibility. This handles all subscription changes — the app just listens to the resulting webhooks and syncs state to Supabase.

---

## Installation

```bash
# Server-side Stripe SDK — add to dependencies
npm install stripe

# Client-side Stripe.js — add to dependencies (lazy load on checkout page only)
npm install @stripe/stripe-js

# Stripe CLI — system-wide, not npm
# macOS: brew install stripe/stripe-cli/stripe
# Windows: https://docs.stripe.com/stripe-cli#install
# Linux: https://docs.stripe.com/stripe-cli#install
```

### Environment Variables to Add

```bash
# .env.local
STRIPE_SECRET_KEY=sk_test_...              # Server-side only, never expose to client
STRIPE_PUBLISHABLE_KEY=pk_test_...         # Safe for client-side use
STRIPE_WEBHOOK_SECRET=whsec_...            # From Stripe CLI (dev) or Stripe Dashboard (prod)
STRIPE_PRICE_ID_STARTER=price_...         # Stripe Price ID for Starter plan
STRIPE_PRICE_ID_GROWTH=price_...          # Stripe Price ID for Growth plan
STRIPE_PRICE_ID_PRO=price_...             # Stripe Price ID for Pro plan
STRIPE_METER_ID=mtr_...                   # Billing meter ID for ai_call events
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_... # Exposed to client for loadStripe()
```

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@stripe/react-stripe-js` | Only needed for Stripe Elements (embedded payment form). Checkout redirect covers all needs for plan subscription and doesn't require in-page Elements. | `@stripe/stripe-js` `loadStripe()` + redirect to Stripe Checkout |
| Custom invoice rendering | Building a custom invoice PDF/HTML renderer is weeks of work. Stripe already generates hosted invoice pages with PDF download. | Link to `invoice.hosted_invoice_url` from Stripe webhook data |
| Webhook queue (BullMQ/pg-boss) | At current scale (single tenant, <100 calls/day), webhook events arrive in-order and process in milliseconds. A queue adds Redis infrastructure for no user-facing benefit. | Direct Supabase update in webhook handler. If the project scales to 1,000+ tenants, revisit pg-boss. |
| `stripe-webhook-middleware` / third-party webhook packages | These add abstraction over `stripe.webhooks.constructEvent()` that Next.js App Router doesn't need. The raw pattern with `request.text()` is 15 lines and well-documented. | Direct `stripe.webhooks.constructEvent()` call |
| Prisma / Drizzle ORM | The project uses Supabase JS client everywhere. Adding an ORM for billing tables fragments the data access layer. | Supabase JS client with typed queries for billing tables |
| `next-stripe` or `use-shopping-cart` | These are opinionated wrappers built for e-commerce, not SaaS subscriptions. They add abstraction without reducing code for a subscription billing model. | Direct Stripe SDK + Server Actions |

---

## Database Schema (Supabase)

No new npm packages needed for schema. These are Supabase SQL migrations.

```sql
-- subscriptions: one row per tenant
CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stripe_customer_id text UNIQUE NOT NULL,
  stripe_subscription_id text UNIQUE,
  status text NOT NULL DEFAULT 'trialing',  -- trialing|active|past_due|canceled|paused
  plan text NOT NULL DEFAULT 'trial',       -- trial|starter|growth|pro
  plan_call_limit integer NOT NULL DEFAULT 50,  -- calls included in plan
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- usage_events: one row per completed call (for real-time enforcement)
CREATE TABLE usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  call_id text NOT NULL,
  billing_period_start timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: tenants see only their own data
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
```

---

## Version Compatibility

| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| `stripe` | ^17.7.0 | Node.js 18+, Next.js 16 | Server-side only. Works with App Router Server Actions and route handlers. |
| `@stripe/stripe-js` | ^5.x | React 19, Next.js 16 | Client-side. Import via `@stripe/stripe-js/pure` to defer load. No SSR conflict. |
| Stripe Billing Meters | API 2024-09-30.acacia+ | stripe ^17.x | Meters API requires acacia or newer. v17.x ships with a recent non-preview API version. Confirm with `stripe.apiVersion` after install. |

---

## Sources

- [stripe npm package — v20.4.1 latest](https://www.npmjs.com/package/stripe) — HIGH confidence (npm registry)
- [Stripe Node.js SDK releases](https://github.com/stripe/stripe-node/releases) — HIGH confidence (official GitHub)
- [Stripe Billing Meters — Usage-Based Implementation Guide](https://docs.stripe.com/billing/subscriptions/usage-based/implementation-guide) — HIGH confidence (official Stripe docs)
- [Migrate to Billing Meters — Legacy Records Deprecated](https://docs.stripe.com/billing/subscriptions/usage-based-legacy/migration-guide) — HIGH confidence (official Stripe docs)
- [Stripe Billing Meters API v2 — Meter Event Streams](https://docs.stripe.com/changelog/acacia/2024-09-30/usage-based-billing-v2-meter-events-api) — HIGH confidence (official Stripe changelog)
- [Stripe Subscription Trials Documentation](https://docs.stripe.com/billing/subscriptions/trials) — HIGH confidence (official Stripe docs)
- [Stripe Webhooks — Subscription Lifecycle Events](https://docs.stripe.com/billing/subscriptions/webhooks) — HIGH confidence (official Stripe docs)
- [Stripe Customer Portal Integration](https://docs.stripe.com/customer-management/integrate-customer-portal) — HIGH confidence (official Stripe docs)
- [Next.js App Router Stripe Webhook — raw body via request.text()](https://medium.com/@gragson.john/stripe-checkout-and-webhook-in-a-next-js-15-2025-925d7529855e) — MEDIUM confidence (community article, verified pattern against official docs)
- [Stripe + Next.js 15 Complete Guide 2025](https://www.pedroalonso.net/blog/stripe-nextjs-complete-guide-2025/) — MEDIUM confidence (community guide)
- [Stripe Subscription Lifecycle in Next.js 2026](https://dev.to/thekarlesi/stripe-subscription-lifecycle-in-nextjs-the-complete-developer-guide-2026-4l9d) — MEDIUM confidence (community article, current patterns confirmed)
- [Vercel Next.js Subscription Payments reference repo](https://github.com/vercel/nextjs-subscription-payments) — MEDIUM confidence (Vercel maintained, may not reflect latest App Router patterns)

---

*Stack research for: v3.0 Subscription Billing & Usage Enforcement*
*Researched: 2026-03-26*

---
type: system
system: Billing
status: legacy-app
description: "Environment variables Billing reads, and where they are set."
source: .claude/skills/payment-architecture/SKILL.md § 10. Environment Variables
migrated: 2026-11-23
verified:
tags: [voco/system/billing]
---

# Environment Variables

Part of [[Billing]]. Migrated verbatim from the `payment-architecture` skill; check `verified` before trusting details.

| Variable | Purpose |
|----------|---------|
| `STRIPE_SECRET_KEY` | Stripe SDK initialization (server-side only) |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Client-side Stripe.js (EmbeddedCheckout) |
| `STRIPE_PRICE_STARTER` | Starter monthly price ID |
| `STRIPE_PRICE_GROWTH` | Growth monthly price ID |
| `STRIPE_PRICE_SCALE` | Scale monthly price ID |
| `STRIPE_PRICE_STARTER_ANNUAL` | Starter annual price ID |
| `STRIPE_PRICE_GROWTH_ANNUAL` | Growth annual price ID |
| `STRIPE_PRICE_SCALE_ANNUAL` | Scale annual price ID |
| `STRIPE_PRICE_STARTER_OVERAGE` | Starter metered overage price ID |
| `STRIPE_PRICE_GROWTH_OVERAGE` | Growth metered overage price ID |
| `STRIPE_PRICE_SCALE_OVERAGE` | Scale metered overage price ID |
| `NEXT_PUBLIC_APP_URL` | Base URL for checkout success/cancel redirects |
| `RESEND_API_KEY` | Resend email service for billing notifications |
| `TWILIO_FROM_NUMBER` | SMS sender for billing notifications |

---

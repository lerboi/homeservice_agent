---
type: system
system: Auth and Database
status: current
description: "Environment variables Auth and Database reads, and where they are set."
source: .claude/skills/auth-database-multitenancy/SKILL.md § 7. Environment Variables
migrated: 2026-11-23
verified:
tags: [voco/system/auth-and-database]
---

# Environment Variables

Part of [[Auth and Database]]. Migrated verbatim from the `auth-database-multitenancy` skill; check `verified` before trusting details.

| Variable | Client(s) | Purpose |
|----------|-----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | All three clients | Supabase project URL (public, safe in browser) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | supabase-server.js, supabase-browser.js, middleware.js | Client auth + RLS-scoped access |
| `SUPABASE_SERVICE_ROLE_KEY` | supabase.js (service role) only | Full DB access, bypasses RLS — SERVER ONLY, never expose to browser |
| `STRIPE_SECRET_KEY` | stripe.js (server-side) | Stripe API secret key — SERVER ONLY |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Client components | Stripe publishable key (safe in browser) |
| `STRIPE_WEBHOOK_SECRET` | Webhook API route | Stripe webhook signature verification |
| `STRIPE_PRICE_STARTER` | Server-side | Stripe Price ID for Starter plan ($99/mo) |
| `STRIPE_PRICE_GROWTH` | Server-side | Stripe Price ID for Growth plan ($249/mo) |
| `STRIPE_PRICE_SCALE` | Server-side | Stripe Price ID for Scale plan ($599/mo) |

---

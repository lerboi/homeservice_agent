---
type: system
system: Billing
status: legacy-app
description: "Billing Dashboard. Covers: Billing Page (`/dashboard/more/billing`); UsageRingGauge Component; Billing API Routes; Dashboard Banners"
source: .claude/skills/payment-architecture/SKILL.md § 7. Billing Dashboard
migrated: 2026-11-23
verified:
tags: [voco/system/billing]
---

# Billing Dashboard

Part of [[Billing]]. Migrated verbatim from the `payment-architecture` skill; check `verified` before trusting details.

### Billing Page (`/dashboard/more/billing`)

**File**: `src/app/dashboard/more/billing/page.js`

4 sections:
1. **Plan card**: Plan name (from PRICING_TIERS), price, status badge, cancel-at-period-end warning
2. **Usage meter**: `UsageRingGauge` SVG donut — orange arc for normal usage, amber arc for overage
3. **Billing details**: Renewal date (or trial end date), "Manage Subscription" button (→ Stripe portal)
4. **Recent invoices**: Table of 5 invoices with date, amount, status badge, external link

### UsageRingGauge Component

**File**: `src/components/dashboard/UsageRingGauge.js`

Props: `callsUsed`, `callsLimit`, `overageRate`. Normal fill: brand orange arc. Overage: amber arc (capped at 50% additional visual). Animated with CSS transition (respects `prefers-reduced-motion`).

### Billing API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/billing/invoices` | GET | 5 most recent invoices via `stripe.invoices.list({ customer })` |
| `/api/billing/portal` | GET | Creates Stripe Customer Portal session, 303 redirect. Allowed return URLs: `/dashboard`, `/dashboard/more/billing` |

### Dashboard Banners

**BillingWarningBanner** (`src/app/dashboard/BillingWarningBanner.js`): Amber banner for `past_due` subscriptions during the 3-day grace countdown. Once grace expires it switches to a **RED suspended variant** — "Payment failed — **your AI receptionist is paused** and is no longer answering calls" (the Python gate has stopped answering this tenant's calls). Links to `/api/billing/portal`. **Not dismissible** (2026-06-12 — it also used to hide entirely post-grace, expecting a middleware redirect that never existed, leaving past-grace tenants with NO warning).

**TrialCountdownBanner** (`src/app/dashboard/TrialCountdownBanner.js`): Blue (>3 days) or amber (<=3 days) trial countdown. **Not dismissible** (2026-06-12).

---

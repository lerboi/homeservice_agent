---
type: system
system: Billing
status: current
description: "Verified summary of the plan ids, per-plan call limits, what happens when a tenant goes over (metered overage, never a block), and what does block calls (subscription status). Start here for any plan, limit or enforcement question."
verified: 2026-11-23
tags: [voco/system/billing]
---

# Plans and limits at a glance (verified)

Part of [[Billing]]. Checked against code on 2026-11-23. Where another Billing note disagrees with this one, this one is right.

## Plans

| Plan id | Monthly call limit | Stripe price env vars |
|---|---|---|
| `starter` | 40 | `STRIPE_PRICE_STARTER`, `_ANNUAL`, `_OVERAGE` |
| `growth` | 120 | `STRIPE_PRICE_GROWTH`, `_ANNUAL`, `_OVERAGE` |
| `scale` | 400 | `STRIPE_PRICE_SCALE`, `_ANNUAL`, `_OVERAGE` |

- Source: `PLAN_MAP` in `src/lib/stripe-plans.js:14`. It maps a Stripe price id to `{ plan_id, calls_limit }`; the webhook writes those onto the `subscriptions` row.
- **Annual plans use the same monthly limit** (40 / 120 / 400), not the ×12 figure. The comment above `PLAN_MAP` records that 480 / 1,440 / 4,800 was a bug. Notes in this folder that still give annual limits of 480 / 1,440 / 4,800 are out of date.
- That is nine price ids: three monthly, three annual, three overage.
- Display data for the plans (names, prices, feature lists) lives in `src/app/(public)/pricing/pricingData.js` and is also rendered by onboarding checkout and the dashboard upgrade screen. The plan `id` values there must match the ones above.

## Going over the limit does not block calls

1. After each real call of billable length, the agent calls the `increment_calls_used` RPC (`livekit-agent/src/post_call.py:235`).
2. The RPC returns `calls_used`, `calls_limit` and `limit_exceeded`.
3. If `limit_exceeded`, the agent looks up the tenant's Stripe customer and, after owner notifications have gone out, posts a `voco_calls` Billing Meter event (`post_call.py:562`). The overage is charged on the next invoice at the plan's overage price.
4. Test calls skip all of this (`is_test_call`).

The Python agent is the only reporter of meter events.

## What does block calls

`is_subscription_blocked(status, current_period_end)` in `livekit-agent/src/lib/subscription_gate.py:29`:

- `canceled`, `paused`, `incomplete` → blocked.
- `past_due` → blocked once more than 3 days have passed since `current_period_end`.
- Everything else, including `trialing` and `active` over quota → allowed.

## Why this matters after the rebrand

The public pricing page becomes "talk to us" ([[Positioning]]), but this path still runs on every production call, and the plan ids are still used by checkout, the webhook and the dashboard. Do not rename plan ids or change limits as part of a copy change.

## Related
[[Billing - Pricing Plans]] · [[Billing - Usage Tracking]] · [[Billing - Overage Billing (Stripe Billing Meters)]] · [[Billing - Subscription Enforcement Gate]] · [[Billing - Stripe Webhook Handler]]

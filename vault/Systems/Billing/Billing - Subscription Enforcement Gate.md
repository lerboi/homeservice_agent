---
type: system
system: Billing
status: legacy-app
description: "Subscription Enforcement Gate. Covers: Live Enforcement: Python `subscription_gate.py` (2026-06-12); Middleware Subscription Check; Churned Number Release (`/api/cron/release-churned-numbers`, 2026-06-12)"
source: .claude/skills/payment-architecture/SKILL.md § 6. Subscription Enforcement Gate
migrated: 2026-11-23
verified:
tags: [voco/system/billing]
---

# Subscription Enforcement Gate

Part of [[Billing]]. Migrated verbatim from the `payment-architecture` skill; check `verified` before trusting details.

**File**: `src/lib/subscription-gate.js`

```js
export const BLOCKED_STATUSES = ['canceled', 'paused', 'incomplete'];
export async function checkSubscriptionGate(supabase, tenantId)
  → { blocked: boolean, reason?: string }
```

- **Blocks**: canceled, paused, incomplete
- **Allows**: trialing, active, past_due (3-day grace period)
- **Over-quota**: NEVER blocked (overage billing handles it)
- **Error resilience**: Query error or unexpected error → fail open (allow call)
- **No subscription row**: Allow (pre-subscription state)

### Live Enforcement: Python `subscription_gate.py` (2026-06-12)

The JS module above is a reference implementation — the **live call-blocking path** is the shared livekit-agent module `src/lib/subscription_gate.py` (separate Railway repo): `is_subscription_blocked(status, current_period_end)`. It blocks canceled/paused/incomplete always, and **past_due once the 3-day grace (anchored to `current_period_end`) expires** — previously past-grace past_due tenants kept receiving answered calls forever. Used by both `agent.py` (whose subscription select now includes `current_period_end`) and `twilio_routes.py` (whose tenants query now filters the subscriptions embed with `.eq("subscriptions.is_current", True)` — it previously read an arbitrary history row). See `voice-call-architecture` skill.

### Middleware Subscription Check

**File**: `src/proxy.js`

Dashboard access is deliberately **not** gated on subscription status — the dead status query that used to run on every dashboard request (logging but never blocking) was removed in 2026-06-12; `proxy.js` now just documents the decision in a comment. User-facing warning is `BillingWarningBanner`; call-side enforcement is the Python gate above.

### Churned Number Release (`/api/cron/release-churned-numbers`, 2026-06-12)

Daily at 04:00 (`vercel.json`). Tenants whose **current** subscription row is `canceled` for more than 30 days and who still hold a phone number get the number released (batch of 10/run). The 30-day retention window means a tenant who reactivates keeps their number — re-subscribing replaces the `is_current` row with an active one, dropping them out of the query. Per country:

- **SG**: number returned to `phone_inventory` (status `available`, `assigned_tenant_id` cleared) — platform-owned, never released at Twilio
- **US/CA (other)**: looked up at Twilio by E.164 and released (releasing also detaches it from the Elastic SIP trunk)

Either way `tenants.phone_number` is cleared so the LiveKit webhook stops resolving calls to the churned tenant. Before this cron, numbers were never released on churn — canceled US/CA tenants cost Twilio rent forever and canceled SG tenants permanently consumed finite `phone_inventory` rows.

---

---
type: system
system: Billing
status: legacy-app
description: "Idempotency: INSERT into usage_events (call_id PK) with ON CONFLICT DO NOTHING Covers: `increment_calls_used` RPC (Migration 013, fixed in 037); `handleInvoicePaid` — Usage Reset"
source: .claude/skills/payment-architecture/SKILL.md § 5. Usage Tracking
migrated: 2026-11-23
verified:
tags: [voco/system/billing]
---

# Usage Tracking

Part of [[Billing]]. Migrated verbatim from the `payment-architecture` skill; check `verified` before trusting details.

### `increment_calls_used` RPC (Migration 013, fixed in 037)

```sql
CREATE FUNCTION increment_calls_used(p_tenant_id uuid, p_call_id text)
RETURNS TABLE(success boolean, calls_used int, calls_limit int, limit_exceeded boolean)
```

- **Idempotency**: INSERT into `usage_events` (call_id PK) with ON CONFLICT DO NOTHING
- **Atomic increment**: UPDATE subscriptions SET calls_used = calls_used + 1
- **Duplicate call**: Returns current state without incrementing (FOUND = false)
- **No subscription**: Returns (false, 0, 0, false)
- **`limit_exceeded` uses `>` (strictly greater than)**: Returns true only when `calls_used > calls_limit`. Migration 037 fixed an off-by-one where `>=` caused the last included call to be reported as overage.

### `handleInvoicePaid` — Usage Reset

Resets `calls_used = 0` on `invoice.paid` with `billing_reason: 'subscription_cycle'`. Only fires on billing cycle renewal (not first invoice).

**Throws when the reset matches 0 rows (2026-06-12)**: renewals fire `invoice.paid` and `customer.subscription.updated` near-simultaneously, so the reset can race the history pattern's unmark→insert window when there is momentarily no `is_current` row. A 0-row UPDATE is not a PostgREST error — previously the event was marked processed and the reset silently lost, carrying a full prior cycle's usage into the new cycle (spurious overage). Throwing returns 500 so Stripe retries after the subscription event lands.

---

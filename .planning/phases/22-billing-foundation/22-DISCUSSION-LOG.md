# Phase 22: Billing Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-26
**Phase:** 22-billing-foundation
**Areas discussed:** Trial Activation Flow, Webhook Event Handling, Subscription State Mapping

---

## Trial Activation Flow

### CC Timing

| Option | Description | Selected |
|--------|-------------|----------|
| After test call, before complete | User does test call (aha moment), then Stripe Checkout for CC + plan, then onboarding completes | ✓ |
| New step before test call | CC as wizard Step 4, then test call as Step 5 | |
| After onboarding, first dashboard visit | Onboarding untouched, billing prompt on first dashboard visit | |

**User's choice:** After test call, before complete
**Notes:** Most conversion-optimized — user already experienced the product

### Plan Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Plan selection before Checkout | Show plan cards after test call, user picks one | ✓ |
| Everyone starts on Growth | Skip selection, default to most popular | |
| Everyone starts on Starter | Default to cheapest | |

**User's choice:** Plan selection before Checkout

### Return URL

| Option | Description | Selected |
|--------|-------------|----------|
| Dashboard (auto-completes) | Checkout success triggers completion, lands on dashboard | |
| Celebration screen then dashboard | Return to celebration page, then auto-redirect | ✓ |

**User's choice:** Celebration screen then dashboard

---

## Webhook Event Handling

### Unknown Events

| Option | Description | Selected |
|--------|-------------|----------|
| Log and return 200 | Accept silently, log for debugging | ✓ |
| Return 400 | Reject, Stripe retries | |
| You decide | Claude picks best approach | |

**User's choice:** Log and return 200

### Sync vs Async

| Option | Description | Selected |
|--------|-------------|----------|
| Synchronous (simpler) | Process inline before returning 200 | ✓ |
| after() async (like Retell) | Return 200 immediately, process async | |
| You decide | Claude picks based on patterns | |

**User's choice:** Synchronous (simpler)

---

## Subscription State Mapping

### Legacy Users

| Option | Description | Selected |
|--------|-------------|----------|
| Grandfather them | No subscription = unrestricted | |
| Auto-create trial | Backfill migration creates trials | |
| Block until subscribe | No subscription = blocked | |

**User's choice:** Other — "those are manual users I created. that won't happen on deployment, don't worry"
**Notes:** No legacy user handling needed. All existing users are test accounts.

### Plan ID Storage

| Option | Description | Selected |
|--------|-------------|----------|
| Both (Recommended) | stripe_price_id + local plan_id enum | ✓ |
| Stripe Price ID only | Single source, requires mapping function | |
| Local plan_id only | Simpler queries, loses Stripe reference | |

**User's choice:** Both (Recommended)

### Subscription History

| Option | Description | Selected |
|--------|-------------|----------|
| One row per tenant | Upsert pattern, no history | |
| History table + active view | Every event creates a row, view/flag for active | ✓ |

**User's choice:** History table + active view

---

## Claude's Discretion

- Exact column naming and index design for tables
- View vs is_current boolean for active subscription
- Stripe Checkout Session config details
- Migration file naming

## Deferred Ideas

None

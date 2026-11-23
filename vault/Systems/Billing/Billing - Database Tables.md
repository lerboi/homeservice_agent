---
type: system
system: Billing
status: legacy-app
description: "Indexes: (tenant_id, is_current), (stripe_subscription_id), idx_subscriptions_one_current — partial UNIQUE on (tenant_id) WHERE is_current (migration 068): a… Covers: `subscriptions` (Migration 010 + 017 + 068); `stripe_webhook_events` (Migration 010 + 064 + 068); `usage_events` (Migration 013); `bi"
source: .claude/skills/payment-architecture/SKILL.md § 9. Database Tables
migrated: 2026-11-23
verified:
tags: [voco/system/billing]
---

# Database Tables

Part of [[Billing]]. Migrated verbatim from the `payment-architecture` skill; check `verified` before trusting details.

### `subscriptions` (Migration 010 + 017 + 068)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | gen_random_uuid() |
| `tenant_id` | uuid FK | → tenants CASCADE |
| `stripe_customer_id` | text | NOT NULL |
| `stripe_subscription_id` | text | NOT NULL |
| `stripe_price_id` | text | nullable |
| `plan_id` | text | CHECK starter/growth/scale |
| `status` | text | CHECK trialing/active/past_due/canceled/paused/incomplete |
| `calls_limit` | int | NOT NULL |
| `calls_used` | int | NOT NULL DEFAULT 0 |
| `trial_ends_at` | timestamptz | nullable |
| `current_period_start` | timestamptz | nullable |
| `current_period_end` | timestamptz | nullable |
| `cancel_at_period_end` | boolean | NOT NULL DEFAULT false |
| `stripe_updated_at` | timestamptz | For out-of-order webhook protection |
| `is_current` | boolean | NOT NULL DEFAULT true |
| `overage_stripe_item_id` | text | nullable — Stripe metered subscription item ID |
| `created_at` | timestamptz | NOT NULL DEFAULT now() |

**Indexes**: `(tenant_id, is_current)`, `(stripe_subscription_id)`, **`idx_subscriptions_one_current` — partial UNIQUE on `(tenant_id) WHERE is_current` (migration 068)**: at most ONE current row per tenant, enforcing what migration 038's header (DB-2) promised but never shipped. 068 first dedupes pre-existing duplicate current rows (keeps the most recently created, tiebreak on id).

**RLS**: SELECT-own for all roles (via tenants.owner_id — fixed in migration 021 to remove TO authenticated restriction), service_role ALL

### `stripe_webhook_events` (Migration 010 + 064 + 068)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `event_id` | text UNIQUE | Idempotency key |
| `event_type` | text | NOT NULL |
| `processed_at` | timestamptz | DEFAULT now() |
| `processed` | boolean | NOT NULL DEFAULT false — added by migration 064. Gates atomic idempotency: set to `true` only AFTER the handler succeeds. No backfill — existing rows stay `false` but are never retried. |
| `processing_started_at` | timestamptz | nullable — added by migration 068. Atomic processing claim: set on fresh insert; a duplicate delivery may only re-run after claiming via conditional UPDATE (`processed=false` AND claim NULL/stale >10min); reset to NULL on handler failure so the retry can re-claim immediately (see Idempotency D-09). |

**RLS**: Service role only (no authenticated access)

### `usage_events` (Migration 013)

| Column | Type | Notes |
|--------|------|-------|
| `call_id` | text PK | Idempotency key — prevents double-counting |
| `tenant_id` | uuid FK | → tenants CASCADE |
| `created_at` | timestamptz | DEFAULT now() |

**RLS**: Service role only

### `billing_notifications` (Migration 016 + 020)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `tenant_id` | uuid FK | → tenants CASCADE |
| `notification_type` | text | NOT NULL |
| `sent_at` | timestamptz | DEFAULT now() |
| `metadata` | jsonb | nullable |
| `created_at` | timestamptz | DEFAULT now() |

**Constraint**: UNIQUE (tenant_id, notification_type) — added in migration 020

**RLS**: Service role only

### `stripe_meter_failures` (Migration 071, 2026-06-12)

Durable outbox for failed Stripe Billing Meter overage posts (written by the Python agent, drained by `/api/cron/retry-meter-events`).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | gen_random_uuid() |
| `tenant_id` | uuid FK | → tenants CASCADE |
| `call_id` | text | NOT NULL UNIQUE — outbox idempotency; agent upserts on it |
| `stripe_customer_id` | text | NOT NULL — routing for the meter re-post |
| `failure_reason` | text | nullable — last error message (truncated to 500 chars) |
| `attempts` | int | NOT NULL DEFAULT 0 — Sentry alert when it crosses 10 |
| `last_attempt_at` | timestamptz | nullable |
| `created_at` | timestamptz | NOT NULL DEFAULT now() |

**Index**: `idx_meter_failures_created` on `(created_at)`

**RLS**: Enabled with no policies + REVOKE ALL from anon/authenticated — service role only

---

---
type: system
system: Auth and Database
status: current
description: "Four additive, forward-fix-only migrations landed on branch fix/prod-readiness-2026-06; migration 068 followed as the 2026-06 audit's billing/security harden… Covers: Rate-limited routes added 2026-06-10 (on the 065 infrastructure); `rate_limit_hits` table + `increment_rate_limit` RPC (Migration 065"
source: ".claude/skills/auth-database-multitenancy/SKILL.md § Prod-Readiness 2026-06: Migrations (063 / 064 / 065 / 066 / 068)"
migrated: 2026-11-23
verified:
tags: [voco/system/auth-and-database]
---

# Prod-Readiness 2026-06 Migrations (063 064 065 066 068)

Part of [[Auth and Database]]. Migrated verbatim from the `auth-database-multitenancy` skill; check `verified` before trusting details.

Four additive, forward-fix-only migrations landed on branch `fix/prod-readiness-2026-06`; migration 068 followed as the 2026-06 audit's billing/security hardening pass. Full file-map entries above; the new table + RPC are detailed here in the same style as the Phase 59 RPC section.

| Migration | Purpose |
|-----------|---------|
| `063_estimates_customer_id.sql` | ADD `estimates.customer_id` nullable FK → customers ON DELETE SET NULL + `idx_estimates_tenant_customer (tenant_id, customer_id)`. Re-links estimates after 061 dropped `leads`. No backfill. |
| `064_webhook_event_status.sql` | ADD `stripe_webhook_events.processed boolean NOT NULL DEFAULT false`. Atomic webhook idempotency — completion gated on `processed=true`. No backfill. |
| `065_rate_limit.sql` | CREATE `rate_limit_hits` table + `idx_rate_limit_hits_window_start` + service-role-only RLS + `increment_rate_limit` SECURITY DEFINER RPC. Durable fixed-window rate limiting. |
| `066_calls_call_sid_unique.sql` | De-dupe call_sid rows → `DROP INDEX idx_calls_call_sid` (045) → `ADD CONSTRAINT calls_call_sid_unique UNIQUE (call_sid)`. One row per Twilio CallSid. |
| `068_billing_and_security_hardening.sql` | (1) Dedupe duplicate `is_current` subscription rows per tenant; (2) partial UNIQUE `idx_subscriptions_one_current ON subscriptions(tenant_id) WHERE is_current`; (3) `oauth_refresh_locks` ENABLE RLS (no policies) + REVOKE EXECUTE on both lock RPCs from PUBLIC/anon/authenticated; (4) hot-path indexes: `idx_activity_log_customer` (partial), `idx_invoices_job_id`, `idx_appointments_external_event_id` (partial), `idx_calendar_blocks_external_event_id` (partial); (5) ADD `stripe_webhook_events.processing_started_at timestamptz` — atomic webhook processing claim. See `payment-architecture` skill for the webhook claim flow + unmark-before-insert ordering it requires. |

### Rate-limited routes added 2026-06-10 (on the 065 infrastructure)

- **`/api/contact`** — per-IP `checkRateLimit({ bucket: 'contact-ip', key: <x-forwarded-for first hop / x-real-ip / 'unknown'>, limit: 5, windowSeconds: 3600 })` before any work; 429 on exceed; fails open on limiter outage.
- **`/api/onboarding/sms-verify`** — per-user `checkRateLimit({ bucket: 'sms-verify-user', key: user.id, limit: 5, windowSeconds: 3600 })` (anti SMS-pumping), then validates/normalizes the phone via `normalizeE164` (`src/lib/phone/normalize.js`) — invalid numbers get 400 before `signInWithOtp` is ever called.

### `rate_limit_hits` table + `increment_rate_limit` RPC (Migration 065)

Replaces the in-memory per-instance `Map` rate limiters in `/api/public-chat` and `/api/demo-voice` with a shared, Supabase-backed fixed-window counter that survives serverless cold starts and works across multiple Vercel instances.

**`rate_limit_hits` columns**:
| Column | Type | Notes |
|--------|------|-------|
| `bucket` | text | NOT NULL — limiter namespace (e.g. `public-chat`, `demo-voice`) |
| `key` | text | NOT NULL — caller identity within the bucket (e.g. IP) |
| `window_start` | timestamptz | NOT NULL — `now()` floored to the window size |
| `count` | integer | NOT NULL DEFAULT 0 — incremented atomically by the RPC |

PK: `(bucket, key, window_start)`. Index: `idx_rate_limit_hits_window_start` on `(window_start)` — powers the cleanup cron's range delete. **NOT tenant-scoped** (no `tenant_id`) — this is platform-level abuse protection on public endpoints, not tenant data.

**RLS**: enabled. Single policy `service_role_all_rate_limit_hits` — `FOR ALL USING (auth.role() = 'service_role')`. No anon/authenticated policy → all non-service-role access is blocked. The Next.js routes call the RPC via the service-role client (`src/lib/supabase.js`).

**`increment_rate_limit(p_bucket text, p_key text, p_window_start timestamptz) RETURNS integer` RPC** (SECURITY DEFINER):
```sql
INSERT INTO rate_limit_hits (bucket, key, window_start, count)
VALUES (p_bucket, p_key, p_window_start, 1)
ON CONFLICT (bucket, key, window_start)
DO UPDATE SET count = rate_limit_hits.count + 1
RETURNING count;
```
- Atomic upsert-and-increment — returns the new count for the current window in one round-trip.
- Lockdown follows `027_lock_rpc_functions.sql`: `REVOKE EXECUTE ... FROM public; GRANT EXECUTE ... TO service_role`.
- **Cleanup**: a daily cron `/api/cron/cleanup-rate-limits` prunes rows older than the retention window via the `window_start` index. Rows are disposable.

---

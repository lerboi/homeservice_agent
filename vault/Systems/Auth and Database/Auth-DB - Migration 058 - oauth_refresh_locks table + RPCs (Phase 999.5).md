---
type: system
system: Auth and Database
status: current
description: "Shipped: 2026-04-19"
source: ".claude/skills/auth-database-multitenancy/SKILL.md § Migration 058 — `oauth_refresh_locks` table + RPCs (Phase 999.5)"
migrated: 2026-11-23
verified:
tags: [voco/system/auth-and-database]
---

# Migration 058 - oauth_refresh_locks table + RPCs (Phase 999.5)

Part of [[Auth and Database]]. Migrated verbatim from the `auth-database-multitenancy` skill; check `verified` before trusting details.

**Shipped:** 2026-04-19

Fixes the OAuth concurrent-refresh race documented in backlog Phase 999.5. Without this, a burst of webhooks (or webhook + voice call + cron-poll) entering the 5-min `accounting_credentials.expiry_date` window together could fire two `adapter.refreshToken()` calls — Jobber rotates the refresh_token on every refresh, so the second call either 401s (strict mode) or orphans the first caller's rotated token (permissive, last-write-wins).

**Table: `oauth_refresh_locks`** — short-lived lease table, not tenant-scoped.

| Column | Type | Notes |
|---|---|---|
| `tenant_id` | UUID NOT NULL | Part of composite PK |
| `provider` | TEXT NOT NULL | Part of composite PK; `xero` or `jobber` |
| `holder_id` | UUID NOT NULL | Random UUID minted per acquire call; used for safe release |
| `acquired_at` | TIMESTAMPTZ NOT NULL DEFAULT now() | Debug visibility |
| `expires_at` | TIMESTAMPTZ NOT NULL | TTL backstop against crashed holders |

PRIMARY KEY `(tenant_id, provider)` — exactly one active lease per (tenant, provider) pair.

**RLS:** Enabled by migration 068 with **no policies** — service_role bypasses RLS, so the only legitimate caller (`refreshTokenIfNeeded` in `src/lib/integrations/adapter.js`, service-role client) is unaffected, while anon/authenticated are fully blocked. (Migration 058 originally shipped with RLS off.) 068 also REVOKEs EXECUTE on both RPCs below from PUBLIC/anon/authenticated and GRANTs to service_role — Postgres's default grants had left them executable by any role. Migration 069 additionally pins `search_path = public, pg_temp` on both lock RPCs (advisor-flagged).

**RPC: `try_acquire_oauth_refresh_lock(p_tenant_id uuid, p_provider text, p_ttl_ms int DEFAULT 30000) → UUID`**

Atomically acquires a fresh lock (or steals an expired one via `ON CONFLICT DO UPDATE WHERE expires_at < now()`). Serializes contending callers via `pg_advisory_xact_lock` keyed on `hashtext('oauth-refresh-<provider>-<tenant_id>')` so the conditional UPDATE can't interleave and lose updates.

Returns the new `holder_id` UUID if this caller won the slot; returns NULL if another caller currently holds a non-expired lock.

**RPC: `release_oauth_refresh_lock(p_tenant_id uuid, p_provider text, p_holder_id uuid) → VOID`**

Deletes the lock row only if `holder_id` matches — stale releases (TTL already expired and another caller took over) are no-ops rather than accidentally freeing someone else's slot.

**Contract in `adapter.js`:**
1. Winner (got `holder_id`) proceeds with `adapter.refreshToken()` → DB update → `release_oauth_refresh_lock` in a `finally` block.
2. Loser (got NULL) polls `accounting_credentials` for up to 3s (at 200ms intervals). If the winner persists fresh tokens within that window, loser returns them. Otherwise throws — caller falls back to cached data / broad revalidation (webhook silent-ignore, context fetch path).
3. Refreshes that complete successfully now clear `error_state` in the update payload so the Reconnect banner doesn't persist after a healthy recovery (Phase 999.5 Issue 1 fix).

**Tests:** `tests/integrations/refresh-lock.test.js` validates: 5 concurrent callers → exactly one wire refresh; error_state cleared on success; release RPC always fires (including on wire-refresh failure).

---

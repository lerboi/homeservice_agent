---
type: system
system: Auth and Database
status: current
description: "Adds accounting_credentials.error_state TEXT NULL: Covers: Migration 053 — `supabase/migrations/053_xero_error_state.sql`; Python service-role write-back pattern (cross-repo); `expiry_date` column semantics"
source: ".claude/skills/auth-database-multitenancy/SKILL.md § Phase 55: Migration 053 + accounting_credentials.error_state + Python write-back"
migrated: 2026-11-23
verified:
tags: [voco/system/auth-and-database]
---

# Phase 55 Migration 053 + accounting_credentials.error_state + Python write-back

Part of [[Auth and Database]]. Migrated verbatim from the `auth-database-multitenancy` skill; check `verified` before trusting details.

### Migration 053 — `supabase/migrations/053_xero_error_state.sql`

Adds `accounting_credentials.error_state TEXT NULL`:

- **NULL** = healthy connection
- **`'token_refresh_failed'`** = refresh failed; dashboard renders Reconnect banner + sends Resend email
- **Cleared by**: successful OAuth re-callback (heal), successful token refresh (heal), row deletion (Disconnect)

Partial index `idx_accounting_credentials_error_state ON (tenant_id, provider) WHERE error_state IS NOT NULL` keeps the table cheap for the healthy-row common case; only degraded rows are indexed.

### Python service-role write-back pattern (cross-repo)

The livekit-agent Python repo (separate at `C:/Users/leheh/.Projects/livekit-agent/`) performs Xero refreshes in `src/integrations/xero.py`. When refreshing succeeds, the NEW token set MUST be persisted back to `accounting_credentials` so the Next.js side sees the rotated refresh_token on its next read:

```python
admin.table("accounting_credentials").update({
    "access_token": new_access,      # all three together — prevents race
    "refresh_token": new_refresh,
    "expiry_date": new_expiry_iso,
    "error_state": None,             # heal on success
}).eq("id", cred_id).execute()
```

Critical pitfall (documented in Phase 55 RESEARCH as Pitfall 5): If Python refreshes and does NOT persist back, Next.js later refreshes with the old (rotated) refresh_token and Xero returns 400 → stale-token race → connection breaks. Same pattern will apply to Phase 56 Jobber read-side.

On refresh failure, Python writes `error_state='token_refresh_failed'`. Email/banner surfacing lives in Next.js (dashboard read path + `notifyXeroRefreshFailure` helper) — Python NEVER sends email from the call path, since a per-call email would spam across calls.

### `expiry_date` column semantics

`accounting_credentials.expiry_date` is **BIGINT** (epoch milliseconds — written by Next.js as `Date.now() + expires_in * 1000`). The Python parser in livekit-agent/src/integrations/xero.py handles both BIGINT and ISO 8601 string shapes, so either runtime can write or read safely.

---

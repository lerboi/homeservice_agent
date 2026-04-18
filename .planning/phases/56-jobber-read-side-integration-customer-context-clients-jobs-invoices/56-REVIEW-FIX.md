---
phase: 56-jobber-read-side-integration-customer-context-clients-jobs-invoices
fixed_at: 2026-04-19T00:00:00Z
review_path: .planning/phases/56-jobber-read-side-integration-customer-context-clients-jobs-invoices/56-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 56: Code Review Fix Report

**Fixed at:** 2026-04-19
**Source review:** 56-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (Critical: 0, Warning: 3)
- Fixed: 3
- Skipped: 0

## Fixed Issues

### WR-01: Silent auth break when persisting rotated refresh_token fails

**Files modified:** `src/lib/integrations/adapter.js`
**Commit:** 95619b2
**Applied fix:** In `refreshTokenIfNeeded`, the Supabase update error path previously logged and returned the un-persisted rotated tokens. Changed to throw a `Token rotation persistence failed` Error after logging. Callers (`fetchJobberCustomerByPhone`, webhook handler) already wrap this in try/catch and fall back to `{ client: null }` / broad revalidation, so the current access_token survives its remaining TTL while the DB's old refresh_token stays consistent with Jobber's server-side state.

### WR-02: OAuth callback leaves tokens persisted but integration non-functional when probe fails

**Files modified:** `src/app/api/integrations/[provider]/callback/route.js`
**Commit:** d63118a
**Applied fix:** When `probeJobberAccountId` returns null, the callback now deletes the just-upserted `accounting_credentials` row (filtered by `tenant_id` + `provider='jobber'`) before redirecting with `?error=account_probe_failed&provider=jobber`. This prevents the UI from showing a "connected" state while webhooks silently no-op due to `external_account_id = NULL`. Rollback failures are logged but do not mask the user-facing error.

### WR-03: Webhook lookup by external_account_id ambiguous if two tenants connect the same Jobber account

**Files modified:** `supabase/migrations/056_external_account_id_global_unique.sql` (new), `src/app/api/integrations/[provider]/callback/route.js`
**Commit:** 1ba3234
**Applied fix:** Added migration 056 with a partial unique index `idx_accounting_credentials_provider_external_unique ON accounting_credentials (provider, external_account_id) WHERE external_account_id IS NOT NULL`. This enforces at the DB layer that a given provider-side account (Jobber accountId or Xero orgId) can belong to at most one Voco tenant. The OAuth callback's Jobber account-id write-back UPDATE now captures the error, detects Postgres unique-violation (code 23505 or message match), rolls back the just-upserted row, and redirects with `?error=account_already_connected&provider=jobber`. Non-unique update errors fall through to `account_probe_failed`.

---

_Fixed: 2026-04-19_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

---
type: system
system: Auth and Database
status: current
description: "Shipped: 2026-04-18"
source: ".claude/skills/auth-database-multitenancy/SKILL.md § Migration 054 — `external_account_id` column (Phase 56)"
migrated: 2026-11-23
verified:
tags: [voco/system/auth-and-database]
---

# Migration 054 - external_account_id column (Phase 56)

Part of [[Auth and Database]]. Migrated verbatim from the `auth-database-multitenancy` skill; check `verified` before trusting details.

**Shipped:** 2026-04-18

- **Column:** `accounting_credentials.external_account_id TEXT NULL`
- **Purpose:** Provider-agnostic identifier for the connected external account. Xero calls this an "orgId"; Jobber calls it an "accountId". P54 shipped `xero_tenant_id TEXT` for Xero; this migration decouples the column name from the provider so webhook lookups in both providers read the same column.
- **Backfill:** `UPDATE accounting_credentials SET external_account_id = xero_tenant_id WHERE provider = 'xero' AND xero_tenant_id IS NOT NULL AND external_account_id IS NULL;` — idempotent (WHERE clause guards rerun).
- **Unique index:** `idx_accounting_credentials_tenant_provider_external_unique` — partial unique on `(tenant_id, provider, external_account_id) WHERE external_account_id IS NOT NULL`. Prevents the same external account from being registered under the same Voco tenant twice without blocking disconnected (null) rows.
- **RLS:** No change — migration is purely additive and reuses the existing table-level RLS (service-role bypasses; tenant-scoped SELECT policies from migration 052 continue to apply).

**Deprecated but retained:** `xero_tenant_id TEXT` column is kept for backward compatibility with any P55 Xero code paths that still read it. A future Phase 58 (CHECKLIST / telemetry) cleanup migration will drop `xero_tenant_id` once all consumers migrate to `external_account_id`. Until then, treat `xero_tenant_id` as "last writer for Xero rows" and `external_account_id` as "canonical for both providers."

**Usage in Phase 56:**
- `/api/webhooks/jobber/route.js` reads `external_account_id` to resolve Jobber's webhook `accountId` → Voco `tenant_id` via `.eq('provider','jobber').eq('external_account_id', accountId)`.
- OAuth callback at `/api/integrations/jobber/callback/route.js` writes `external_account_id = <Jobber accountId from token response or post-token GraphQL probe>`.

**Pitfall (Phase 56 research Pitfall 8):** Do NOT repurpose `xero_tenant_id` for Jobber — it's named for Xero's domain and confuses future contributors. Always use `external_account_id` for new provider writes.

---

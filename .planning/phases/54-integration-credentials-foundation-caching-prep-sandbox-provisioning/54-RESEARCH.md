# Phase 54: Integration credentials foundation + Next.js 16 caching prep + sandbox provisioning — Research

**Researched:** 2026-04-17
**Domain:** Next.js 16 Cache Components, OAuth 2.0 provider integration (Xero + Jobber), Postgres schema migration, Server Component audit
**Confidence:** HIGH (Next.js 16 docs, Xero scope docs, repo code); MEDIUM-LOW (Jobber — scope names are Developer-Center-configured, not enumerated in public docs)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Module boundary (Area 1)**

- **D-01:** New directory `src/lib/integrations/` sibling to `src/lib/accounting/`. `integrations/` holds the unified provider adapters, interface typedef, OAuth state helper (if extracted), credentials I/O helpers, and the `'use cache'` status reader.
- **D-02:** Full consolidation — Phase 54 moves Phase 35's `src/lib/accounting/xero.js` into `src/lib/integrations/xero.js` as a single unified adapter (push methods + OAuth + read-side stubs). `src/lib/accounting/quickbooks.js` and `src/lib/accounting/freshbooks.js` are deleted outright, not migrated. `src/lib/accounting/{types,adapter,sync}.js` get refactored or relocated: interface typedef moves to `integrations/types.js`; adapter factory moves to `integrations/adapter.js`; `sync.js` stays in `accounting/` if it's push-only orchestration, or moves if it's generic — planner decides based on read-after-refactor clarity.
- **D-03:** Single unified OAuth per provider. One "Connect Xero" button requesting one combined scope bundle (for Xero: granular scopes covering read invoices + write invoices + read contacts + offline_access — see §Standard Stack / §Xero Scopes below for the exact strings; for Jobber: the scopes configured in the Developer Center when registering the app). One `accounting_credentials` row per tenant × provider. Invoicing flag state never affects the OAuth flow — when OFF, Voco silently uses the connection for caller context only; when ON, invoice push ALSO runs on the same credentials.
- **D-04:** `/dashboard/more/integrations` renamed "Business Integrations" (page heading + nav label). Cards are provider-first (Xero card, Jobber card) with a status line describing what the connection is actively doing. Phase 54 implements this copy + restructure as part of the phase, not deferred.

**OAuth route topology (Area 2)**

- **D-05:** `/api/accounting/[provider]/{auth,callback}` is **deleted**. Canonical OAuth entry becomes `/api/integrations/[provider]/{auth,callback}`. User updates Xero + Jobber dev-console redirect URIs to the new path during sandbox provisioning (pre-merge). No 308 redirects — clean cut is acceptable because Xero/Jobber sandbox accounts don't exist yet.
- **D-06:** `/api/accounting/{disconnect,status}` is **deleted**. Canonical becomes `/api/integrations/{disconnect,status}`. Disconnect revokes at provider (via adapter `revoke()`) + deletes the `accounting_credentials` row. Status returns `{connected, provider, scopes, last_context_fetch_at}` per provider.
- **D-07:** Phase 54 includes the **frontend migration + copy rewrite** — updating the integrations page inline card (or extract to `BusinessIntegrationCard`) and the `/dashboard/more/integrations` page to the new "Business Integrations" layout, provider-first cards, unified button href, and status-line copy. (UI-SPEC delivered — see `54-UI-SPEC.md`.)

**Next.js 16 `cacheComponents: true` (Area 3)**

- **D-08:** Flip `cacheComponents: true` in `next.config.js` in Phase 54. Next.js `^16.1.7` already installed — no version bump needed.
- **D-09:** Dashboard Server Component audit — grep `src/app/dashboard/**/{page,layout}.js` for request-time signals (cookies, headers, supabase session reads, Date.now, Math.random). Each page/layout either: (a) explicitly awaits `cookies()`/`headers()` and stays dynamic; (b) marks itself `'use cache'` with a `cacheTag`; or (c) wraps request-time sections in `Suspense` with `unstable_noStore` inside. Public marketing pages (landing, pricing, about) are already static — no audit needed. API Route Handlers are always dynamic by default — not in audit scope.
- **D-10:** Smoke test — `getIntegrationStatus(tenantId)` in `src/lib/integrations/status.js` (or similar): `'use cache'` directive at top, `cacheTag(\`integration-status-${tenantId}\`)` inside, returns `{xero: {connected, scopes, last_context_fetch_at}, jobber: {...}}`. The new `/dashboard/more/integrations` page renders from this cached read. Disconnect and callback routes call `revalidateTag(\`integration-status-${tenantId}\`)` to invalidate on state change. Proves the full cache/revalidate loop before Phase 55 needs it for customer-context TTL.

**Migration + schema (Area 4)**

- **D-11:** Single migration file `supabase/migrations/051_integrations_schema.sql`. Sequence: (a) `DELETE FROM accounting_credentials WHERE provider IN ('quickbooks', 'freshbooks')`; (b) `ALTER TABLE ... DROP CONSTRAINT accounting_credentials_provider_check`; (c) `ALTER TABLE ... ADD CONSTRAINT ... CHECK (provider IN ('xero', 'jobber'))`; (d) `ALTER TABLE ... ADD COLUMN scopes TEXT[] NOT NULL DEFAULT '{}'`; (e) `ALTER TABLE ... ADD COLUMN last_context_fetch_at TIMESTAMPTZ`. All in one transactional migration for atomicity.
- **D-12:** `scopes TEXT[] NOT NULL DEFAULT '{}'::text[]` — existing Xero rows backfill to empty array automatically. Pre-v6.0 sandbox Xero rows (if any in dev) will show `scopes=[]` until owner reconnects through the unified OAuth flow; acceptable because dev re-grants with the new scope bundle.
- **D-13:** `last_context_fetch_at TIMESTAMPTZ` NULL default. No new index — Phase 58 telemetry queries are tenant-scoped and hit the existing `UNIQUE (tenant_id, provider)` index. Revisit index decision in Phase 58 if telemetry grows into non-tenant-scoped admin queries.
- **D-14:** Provider CHECK becomes `('xero', 'jobber')` after the migration. QuickBooks and FreshBooks values are permanently invalid. Forward-compatible: adding a future provider requires DROP + recreate of the CHECK (same pattern as this migration).
- **D-15:** QB/FB removal scope ripple — delete `src/lib/accounting/quickbooks.js` and `src/lib/accounting/freshbooks.js`; remove QB/FB from the `PROVIDERS` array; remove QB/FB connection cards from `/dashboard/more/integrations`; delete any `/api/accounting/**` routes specific to QB/FB (beyond the `[provider]` dynamic routes which are being deleted anyway); confirm `accounting_sync_log` has no QB/FB-specific FKs that would block row deletion (cascading deletes should handle it via the existing tenant FK).

### Claude's Discretion

- **HMAC OAuth state helper** — `verifyOAuthState` lives in `src/app/api/google-calendar/auth/route.js` and is already imported by the current accounting callback. Phase 54 reuses this import as-is. Only extract to `src/lib/integrations/oauth-state.js` if Phase 55/56 actually develops a second consumer that can't cleanly reach the Google Calendar module. Don't refactor pre-emptively.
- **Sandbox provisioning timing** — Phase 54 ships pure scaffolding (interface + stubs + routes returning 501 where not implemented + migration + `cacheComponents` + frontend rewrite). User provisioning of Xero + Jobber dev apps blocks Phase 55/56 execution, not Phase 54 merge. `.env.example` entries (`XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`, `JOBBER_CLIENT_ID`, `JOBBER_CLIENT_SECRET`) ship in Phase 54.
- **Python agent credential reads** — Phase 54 confirms `accounting_credentials` schema change is Python-compatible (Supabase `TEXT[]` → Python `list[str]`; `TIMESTAMPTZ` → `datetime`). No `livekit-agent/` code changes in Phase 54.
- **Webhook endpoint paths** — `/api/webhooks/xero` and `/api/webhooks/jobber` remain the Phase 55/56 canonical locations (matches REQUIREMENTS.md wording). Don't relocate to `/api/integrations/xero/webhook` — those phases' code should live where their requirements say.
- **Exact `IntegrationAdapter` typedef shape** — planner picks between single combined interface, split AccountingAdapter + IntegrationAdapter, or a composition/trait approach, based on JSDoc readability with real Xero + Jobber stubs side-by-side. All three approaches were considered; no hard lock.
- **Copy tone for "Business Integrations" page** — match the voice of existing `/dashboard/more/*` pages (plain, owner-directed, no marketing copy). UI-SPEC captures specific strings.
- **`getIntegrationStatus` return shape** — planner finalizes; consumer is the new Business Integrations page and Phase 58 telemetry. `{xero: {...}, jobber: {...}}` vs `{providers: [...]}` is a formatting call.
- **`accounting_sync_log` table fate** — if it only references providers that no longer exist (QB/FB) it may be prunable; if Xero push still uses it, keep untouched. Planner reads Phase 35 usage and decides.
- **Rename `accounting_credentials` → `integration_credentials`** — explicitly rejected as out of scope for Phase 54. Keep the existing table name; revisit in a future "rename" phase if the mismatch becomes a readability problem.

### Deferred Ideas (OUT OF SCOPE)

- Admin UI for connecting integrations on behalf of tenants
- Progressive scope disclosure — per-capability toggles ("allow Voco to read invoices" vs "allow Voco to push invoices")
- Extracting HMAC OAuth state to `src/lib/integrations/oauth-state.js`
- Renaming `accounting_credentials` → `integration_credentials`
- Webhook URL relocation (`/api/webhooks/xero` → `/api/integrations/xero/webhook`) — rejected
- LaunchDarkly/Growthbook-style progressive rollout
- Voice agent (Python) credential refresh logic
- Deleting `accounting_sync_log` table or repurposing
- Public-facing "integrations" marketing page
- 308 redirect layer from `/api/accounting/**` to `/api/integrations/**`
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INTFOUND-01 | A shared `src/lib/integrations/` module exposes a provider-agnostic interface (`getAuthUrl`, `exchangeCode`, `refreshTokenIfNeeded`, `fetchCustomerByPhone`, `revoke`) that Jobber and Xero adapters implement | §Standard Stack lists xero-node v14.0.0 already installed; §Architecture Patterns specifies the adapter interface shape migrated from `src/lib/accounting/types.js`; §Code Examples shows the current Xero OAuth implementation that migrates into `integrations/xero.js`; §Don't Hand-Roll lists `xero-node` as the SDK (never hand-roll Xero auth) |
| INTFOUND-02 | `accounting_credentials.provider` CHECK constraint is extended to include `'jobber'` (Xero already supported); `scopes TEXT[]` and `last_context_fetch_at TIMESTAMPTZ` columns added for telemetry | §Code Examples provides the verified migration shape with correct DROP → DELETE → ADD sequencing; §Common Pitfalls documents the CHECK-swap pitfall; §Runtime State Inventory documents what existing rows look like and which FK chains cascade |
| INTFOUND-03 | `next.config.js` has `cacheComponents: true` enabled to support Next.js 16 `"use cache"` patterns for dashboard reads | §Standard Stack confirms Next.js 16.1.7 installed (16.2.4 latest); §Architecture Patterns specifies the `'use cache'` + `cacheTag` + `revalidateTag` loop directly from official 16.2.4 docs; §Code Examples includes the verified `getIntegrationStatus()` pattern; §Common Pitfalls documents Turbopack + Bun caveats + the request-time API constraint |
</phase_requirements>

## Summary

Phase 54 is predominantly a **refactor + scaffold + config-flip phase**, not a greenfield build. All the heavy lifting (Xero OAuth, HMAC state signing, adapter factory, existing `accounting_credentials` table, migration pipeline, shadcn frontend) already exists in the repo. The phase moves code between directories, tightens a CHECK constraint, adds two columns, flips one next.js config flag, and rewrites a page's copy.

Three things genuinely need careful planning: **(1)** the Postgres CHECK-swap sequence (QB/FB rows must be DELETEd before the CHECK is recreated, otherwise the ALTER fails — CONTEXT.md pitfall was correct on this, but the secondary claim that `accounting_sync_log` has an FK to `accounting_credentials` is WRONG — verified by reading `supabase/DB` schema: `accounting_sync_log` FKs point to `tenants(id)` and `invoices(id)` only, not `accounting_credentials`). **(2)** the Xero scope bundle — the industry broke changed in March 2026: broad `accounting.transactions` is deprecated for new apps, granular scopes like `accounting.invoices` / `accounting.invoices.read` / `accounting.contacts.read` are required. The existing `src/lib/accounting/xero.js` still requests the legacy broad scope string — Phase 54 MUST update the scope constant before the migrated adapter ships. **(3)** the `cacheComponents` audit is nearly a no-op — every non-redirect dashboard page is already `'use client'`, so there are no Server Components reading request-time signals to audit. The real audit scope is the existing dashboard `layout.js` (client) and one new Server Component to be created: the rewritten `/dashboard/more/integrations/page.js` that calls `getIntegrationStatus()` through Suspense.

Jobber OAuth is the softest area: scope *names* are configured per-app in the Developer Center and not enumerated in public docs — the scope strings become known only when the user registers the Jobber dev app (a pre-requisite). Phase 54 ships a Jobber adapter **stub** that defines the adapter surface but defers real scope strings / GraphQL endpoint wiring to Phase 56.

**Primary recommendation:** Treat this as a "plumbing refactor" phase. Five sequential plans matches the blast radius in CONTEXT.md: (1) migration 051, (2) `src/lib/integrations/` module creation + QB/FB deletion + Xero scope string update, (3) `/api/integrations/**` routes + delete `/api/accounting/**` routes, (4) `cacheComponents` flip + dashboard audit + `getIntegrationStatus()` smoke-test helper, (5) Business Integrations frontend rewrite per UI-SPEC. Plan 1 must run first (migration); Plans 2-3 can run in sequence; Plan 4 can start after Plan 2 (needs `integrations/status.js`); Plan 5 needs Plans 3+4 (needs the new routes + the cached status helper).

## Project Constraints (from CLAUDE.md)

- **Brand name is Voco** — not "HomeService AI", not "homeserviceai". Fallback email domains use `voco.live`.
- **Keep skills in sync** — When making changes to any system covered by a skill, read the skill first, make the code changes, then update the skill. For Phase 54, the affected skills are:
  - `dashboard-crm-system` — `/dashboard/more/integrations` page conventions change (heading, card layout, copy); MUST be updated after Plan 5 completes
  - `auth-database-multitenancy` — migration 051 extends `accounting_credentials` schema; MUST be updated after Plan 1 completes
  - `payment-architecture` — touches OAuth flow conceptually; not directly affected, but check that it references `/api/accounting/**` paths (if it does, update to `/api/integrations/**`)
  - `voice-call-architecture` — Phase 54 does NOT touch Python, but the new `scopes` + `last_context_fetch_at` columns are the schema Phase 55+ will read; document the columns are Python-compatible (str[], TIMESTAMPTZ → datetime)
- **No QB/FB deprecation banners** — CONTEXT.md D-15 locks this; CLAUDE.md does not override

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.7 (repo) / 16.2.4 (latest npm) | React framework, `cacheComponents` + `'use cache'` + `cacheTag` | [VERIFIED: `package.json` line 49; `npm view next version` returned `16.2.4`]. `cacheComponents` introduced in 16.0.0 as the unified replacement for `ppr`, `useCache`, and `dynamicIO` flags. Already installed; Phase 54 flips the flag on. **Do NOT bump to 16.2.x inside Phase 54** — 16.1.x is what the rest of the repo is tested against; version bumps are a separate phase. [CITED: https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents version history] |
| xero-node | 14.0.0 (repo) / 15.0.0 (latest npm) | Xero OAuth 2.0 + REST client | [VERIFIED: `package.json` line 50; `npm view xero-node version` returned `15.0.0`]. Already wired in `src/lib/accounting/xero.js` — migrates to `src/lib/integrations/xero.js` unchanged. **Do NOT bump to 15.0 inside Phase 54** — same reason as Next.js; separate phase. The v14 → v15 jump may also rework `buildConsentUrl` / `apiCallback` — unverified. |
| `@supabase/supabase-js` | 2.99.2 (repo) | Service-role DB writes, RLS-respecting reads | [VERIFIED: `package.json` line 46]. Used by the existing `/api/accounting/**` callback for credential upsert; direct reuse in new `/api/integrations/**` callback. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `next/cache` (built in) | 16.1.7 | `cacheTag`, `revalidateTag`, `cacheLife` | Inside `'use cache'` functions only. `cacheTag('integration-status-${tenantId}')` for per-tenant granular invalidation. [CITED: https://nextjs.org/docs/app/api-reference/functions/cacheTag] |
| `crypto` (Node built-in) | Node 20.9+ | HMAC OAuth state signing | Already used by `signOAuthState` / `verifyOAuthState` in `src/app/api/google-calendar/auth/route.js`. Reuse unchanged. |
| `@/components/ui/*` (shadcn) | already installed | Card, Button, Skeleton, AlertDialog, Separator, Sonner toast | All components already in repo; no new shadcn `add` calls needed per UI-SPEC "Registry Safety" table. |
| `lucide-react` | 0.577.0 | `FileSpreadsheet` (Xero), `Wrench` or `Briefcase` (Jobber), `Loader2`, `ExternalLink` | Already installed. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Broad Xero scope `accounting.transactions` (legacy) | Granular scopes `accounting.invoices` + `accounting.invoices.read` + `accounting.contacts.read` + `offline_access` + `openid profile email` | **NOT an alternative in April 2026 — the granular scopes are MANDATORY for new apps.** Apps created after March 2 2026 get HTTP 401 `insufficient_scope` if they request the broad scope. [CITED: https://devblog.xero.com/upcoming-changes-to-xero-accounting-api-scopes-705c5a9621a0; https://www.apideck.com/blog/xero-scopes] |
| Extracting HMAC helper to `integrations/oauth-state.js` | Keep import from `google-calendar/auth/route.js` | CONTEXT.md locks: reuse existing import; don't extract pre-emptively. Cross-module import is one line in the new callback; no duplication. |
| New `integration_credentials` table | Reuse `accounting_credentials` | Locked out — CONTEXT.md deferred. Reuse is cleaner for Phase 54 but creates a naming mismatch flagged for future cleanup. |
| 308 redirect `/api/accounting/**` → `/api/integrations/**` | Delete `/api/accounting/**` outright | Locked out — CONTEXT.md D-05/D-06 choose deletion. Safe because no live Xero tenants exist. |

**Installation:** Nothing new to install. All dependencies present in `package.json`.

**Version verification commands run:**

```bash
npm view next version       # → 16.2.4  (repo: 16.1.7 in package.json) — NO BUMP
npm view xero-node version  # → 15.0.0  (repo: 14.0.0) — NO BUMP
```

Package publish dates not fetched — `npm view next time` can be run if needed but not load-bearing for this phase (we're keeping existing versions).

## Architecture Patterns

### Recommended Project Structure

```
src/lib/
├── accounting/          # Shrinks to push-only orchestration (or empties entirely — planner decides)
│   └── sync.js          # KEEP HERE: push-on-send logic gated by invoicing flag (Phase 53); consumes integrations/ adapter
└── integrations/        # NEW: canonical home for third-party business systems
    ├── types.js         # IntegrationAdapter typedef, PROVIDERS = ['xero','jobber']
    ├── adapter.js       # getIntegrationAdapter(provider) factory + refreshTokenIfNeeded()
    ├── xero.js          # Unified Xero adapter (migrated from accounting/xero.js; scope string updated)
    ├── jobber.js        # Jobber adapter stub — OAuth shell, fetchCustomerByPhone throws NotImplemented
    ├── status.js        # getIntegrationStatus(tenantId) — 'use cache' + cacheTag
    └── oauth-state.js   # OPTIONAL: only create if extraction proves needed (CONTEXT.md discretion)

src/app/api/
├── accounting/          # DELETE ENTIRE TREE in Phase 54
│   ├── [provider]/{auth,callback}/route.js
│   ├── disconnect/route.js
│   └── status/route.js
└── integrations/        # NEW
    ├── [provider]/{auth,callback}/route.js
    ├── disconnect/route.js
    └── status/route.js

src/app/dashboard/more/integrations/
└── page.js              # Rewrite per UI-SPEC — heading "Business Integrations", 2 provider cards
                         # Planner's call: keep inline or extract to components/dashboard/BusinessIntegrationCard.jsx

supabase/migrations/
└── 051_integrations_schema.sql   # NEW — migration sequence per D-11

next.config.js           # ADD: cacheComponents: true at top-level of nextConfig object
```

### Pattern 1: `'use cache'` + per-tenant `cacheTag`

**What:** Cache a Server Component function's return value, keyed by arguments + captured closure variables, invalidatable via a tag matching the cache key.
**When to use:** Reading integration status on the "Business Integrations" page — infrequent changes (only when owner connects/disconnects), per-tenant scope, needs instant invalidation on those events.
**Source:** [CITED: https://nextjs.org/docs/app/api-reference/directives/use-cache; https://nextjs.org/docs/app/api-reference/functions/cacheTag — fetched 2026-04-17, doc version 16.2.4]

```javascript
// src/lib/integrations/status.js
import { cacheTag } from 'next/cache';
import { createClient } from '@supabase/supabase-js';

export async function getIntegrationStatus(tenantId) {
  'use cache';                                  // MUST be first statement
  cacheTag(`integration-status-${tenantId}`);   // Per-tenant tag

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const { data } = await admin
    .from('accounting_credentials')
    .select('provider, scopes, last_context_fetch_at, connected_at, display_name')
    .eq('tenant_id', tenantId);

  const rows = data || [];
  return {
    xero: rows.find(r => r.provider === 'xero') || null,
    jobber: rows.find(r => r.provider === 'jobber') || null,
  };
}
```

**Invalidation (in callback + disconnect routes):**

```javascript
// src/app/api/integrations/[provider]/callback/route.js (after upsert)
// src/app/api/integrations/disconnect/route.js (after delete)
import { revalidateTag } from 'next/cache';
revalidateTag(`integration-status-${tenantId}`);
```

**Good to know:** `revalidateTag` is legal in Route Handlers and Server Actions. It is NOT callable from Client Components. The repo's dashboard integrations page must become a Server Component (or have a Server Component wrapper) to call `getIntegrationStatus()`. See §Common Pitfalls Pitfall 5.

### Pattern 2: Postgres CHECK constraint swap (in-place impossible)

**What:** Postgres rejects `ALTER CHECK`; you must `DROP CONSTRAINT` + `ADD CONSTRAINT`. Rows that violate the new CHECK must be removed BEFORE `ADD CONSTRAINT` or the ALTER fails with `check constraint "xyz" is violated by some row`.
**When to use:** Migration 051 must DELETE QB/FB rows first, then DROP, then ADD.
**Source:** Postgres docs [ASSUMED — Postgres ALTER TABLE semantics are well-known and consistent across versions 12+] + CONTEXT.md pitfall cross-check.

```sql
-- supabase/migrations/051_integrations_schema.sql

BEGIN;

-- Step 1: Purge QB/FB rows (CASCADE will NOT touch accounting_sync_log because
--         accounting_sync_log's FKs point to tenants(id) and invoices(id), NOT
--         accounting_credentials — verified via supabase/DB schema dump)
DELETE FROM accounting_credentials WHERE provider IN ('quickbooks', 'freshbooks');

-- Step 2: Drop old constraint (name verified from 030_accounting_integrations.sql
--         line 13 — the inline CHECK gets an auto-generated name of
--         accounting_credentials_provider_check)
ALTER TABLE accounting_credentials
  DROP CONSTRAINT accounting_credentials_provider_check;

-- Step 3: Add tightened constraint
ALTER TABLE accounting_credentials
  ADD CONSTRAINT accounting_credentials_provider_check
  CHECK (provider IN ('xero', 'jobber'));

-- Step 4: scopes column — TEXT[] NOT NULL DEFAULT '{}'
ALTER TABLE accounting_credentials
  ADD COLUMN scopes TEXT[] NOT NULL DEFAULT '{}'::text[];

-- Step 5: last_context_fetch_at — TIMESTAMPTZ, nullable, no default
ALTER TABLE accounting_credentials
  ADD COLUMN last_context_fetch_at TIMESTAMPTZ;

COMMIT;
```

**Planner note on auto-generated CHECK constraint name:** Postgres names unnamed inline CHECKs using `{table}_{column}_check` — verified against the 030 migration. If production Postgres returns a different name (e.g., `accounting_credentials_check1`), the DROP will fail; the migration should then query `pg_constraint` dynamically or be corrected after the first db-push error. Recommend running `\d+ accounting_credentials` in Supabase SQL editor before deploy to confirm the exact constraint name.

### Pattern 3: Unified OAuth adapter interface (JSDoc typedef)

**What:** A single JSDoc typedef covers both read (`fetchCustomerByPhone`) and push (`pushInvoice`) surfaces; adapters throw `NotImplementedError` (or return a sentinel) for methods they don't yet implement in Phase 54.
**When to use:** `src/lib/integrations/types.js` — replaces Phase 35's `AccountingAdapter` typedef.

```javascript
/**
 * @typedef {Object} IntegrationAdapter
 *
 * // OAuth lifecycle (every adapter implements)
 * @property {(tenantId: string, redirectUri: string) => string} getAuthUrl
 * @property {(code: string, redirectUri: string, extraParams?: Object) => Promise<TokenSet>} exchangeCode
 * @property {(tokenSet: TokenSet) => Promise<TokenSet>} refreshToken
 * @property {(tokenSet: TokenSet) => Promise<void>} revoke
 *
 * // Read surface (Phase 55 Xero / 56 Jobber implements; Phase 54 stubs)
 * @property {(tenantId: string, phone: string) => Promise<CustomerContext>} fetchCustomerByPhone
 *
 * // Push surface (Xero only — gated by invoicing flag in Phase 53)
 * @property {(invoice: ExternalInvoice, lineItems: ExternalLineItem[], settings: Object) => Promise<{externalId: string}>} [pushInvoice]
 * @property {(externalId: string, status: string) => Promise<void>} [updateInvoiceStatus]
 * @property {(customerName: string, customerEmail: string) => Promise<string>} [findOrCreateCustomer]
 */

/** Supported integration providers */
export const PROVIDERS = ['xero', 'jobber'];
```

**Why unified over split:** The same `accounting_credentials` row feeds both surfaces; splitting the interface forces consumers to pick adapter-A-or-adapter-B based on which capability they want, which duplicates refresh logic. Locking Xero into its existing `AccountingAdapter` shape (plus `fetchCustomerByPhone` + `revoke`) is the cleanest migration.

### Pattern 4: Dashboard Server Component audit (near-no-op finding)

**What:** `cacheComponents: true` causes Next.js to **exclude uncached data fetches from prerenders unless explicitly marked** — meaning any Server Component that reads request-time data without being wrapped in Suspense or marked dynamic will error during build.
**When to use:** Audit every `src/app/dashboard/**/{page,layout}.js`. [CITED: https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents]

**Repo audit finding (verified by reading first 2 lines of every file):**

| File | Type | Status |
|------|------|--------|
| `src/app/dashboard/layout.js` | Client (`'use client'`) | NO ACTION — client components are not subject to cacheComponents rules |
| `src/app/dashboard/page.js` | Client | NO ACTION |
| `src/app/dashboard/{calendar,calls,estimates,invoices,jobs}/page.js` | Client | NO ACTION |
| `src/app/dashboard/invoices/{new,batch-review,[id]}/page.js` | Client | NO ACTION |
| `src/app/dashboard/estimates/{new,[id]}/page.js` | Client | NO ACTION |
| `src/app/dashboard/more/page.js` | Client | NO ACTION |
| `src/app/dashboard/more/{account,ai-voice-settings,billing,call-routing,integrations,invoice-settings,notifications,services-pricing,service-zones,working-hours}/page.js` | Client | NO ACTION |
| `src/app/dashboard/more/layout.js` | Client | NO ACTION |
| `src/app/dashboard/services/page.js` | Server — `redirect('/dashboard/more/services-pricing')` | NO ACTION (no data fetch; redirect is compile-time) |
| `src/app/dashboard/settings/page.js` | Server — `redirect('/dashboard/more')` | NO ACTION |
| `src/app/dashboard/more/calendar-connections/page.js` | Server — `redirect('/dashboard/calendar')` | NO ACTION |
| `src/app/dashboard/more/escalation-contacts/page.js` | Server — `redirect('/dashboard/more/notifications')` | NO ACTION |
| `src/app/dashboard/loading.js` | Server | NO ACTION (Skeleton only, no data fetch) |
| `src/app/dashboard/error.js` | Client | NO ACTION |
| **`src/app/dashboard/more/integrations/page.js`** | **Was Client; becomes Server (per UI-SPEC data flow)** | **ADD Suspense wrapper + call `getIntegrationStatus(tenantId)`** |

**Verdict:** The audit pass is effectively scoped to the one Server Component we're *creating* in Plan 5. No legacy `page.js` / `layout.js` needs `'use cache'`, `unstable_noStore`, or explicit `await cookies()` changes. **This is a planning simplifier** — CONTEXT.md D-09 anticipated a broad audit; reality is nearly a no-op.

### Anti-Patterns to Avoid

- **`'use cache'` placed after other statements** — must be the FIRST statement inside the function (before any `import`, `const`, `let`, or destructuring). Easy mistake; silently produces no caching with no compile error.
- **Calling `cookies()`/`headers()` INSIDE a `'use cache'` function** — fails immediately with error `next-request-in-use-cache`. Read these outside the cached scope and pass values as arguments. [CITED: https://nextjs.org/docs/app/api-reference/directives/use-cache §Constraints]
- **Generic tag strings like `cacheTag('status')`** — creates cross-tenant cache collisions. ALWAYS include tenantId: `cacheTag(\`integration-status-${tenantId}\`)`.
- **Delete QB/FB rows AFTER DROP+ADD CHECK** — migration fails. DELETE first, constraint later.
- **Relying on Client Components to call `revalidateTag`** — `revalidateTag` is a server-only function. Disconnect handler is a `POST /api/integrations/disconnect` Route Handler (server) — correct scope. Don't try to call it from the browser directly.
- **Assuming broad Xero scope `accounting.transactions` works for new apps** — it DOES NOT for apps created after March 2 2026. MUST use granular scopes. The existing `src/lib/accounting/xero.js` at line 10 is wrong for new apps.
- **Using class instances in `'use cache'` function arguments/returns** — Next.js serializes via React Server Components protocol; class instances throw. Return plain objects from `getIntegrationStatus`. [CITED: https://nextjs.org/docs/app/api-reference/directives/use-cache §Serialization]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Xero OAuth 2.0 token exchange | Custom fetch to `login.xero.com/identity/connect/token` | `xero-node` `XeroClient.apiCallback(code)` | Handles PKCE, openid-client JARM validation, tenant discovery in one call. Already in use. |
| Xero token refresh | Custom fetch with grant_type=refresh_token | `XeroClient.refreshToken()` | Handles token rotation if Xero flips refresh-rotation on. Already wrapped in `refreshTokenIfNeeded()`. |
| HMAC CSRF state signing | Roll your own HMAC | `signOAuthState`/`verifyOAuthState` in `src/app/api/google-calendar/auth/route.js` | Already timing-safe (`crypto.timingSafeEqual`), keyed by `SUPABASE_SERVICE_ROLE_KEY`, in-tree. Reuse. |
| Per-tenant cache invalidation | SWR cache tag management | Next.js 16 `cacheTag` + `revalidateTag` | Native. Cross-layer (server + client router). Idempotent. [CITED: https://nextjs.org/docs/app/api-reference/functions/cacheTag §Good to know] |
| Postgres CHECK constraint swap | Attempting `ALTER CONSTRAINT` (doesn't exist) | DROP + ADD sequence in one transaction | Postgres has no `ALTER CHECK CONSTRAINT` — the ALTER CONSTRAINT DDL only supports deferrable flags. |
| Frontend card grid for OAuth flows | Custom flex layout | shadcn `<Card>` + `btn.primary` token + existing `/dashboard/more/integrations` page structure | UI-SPEC already declared final Tailwind classes (`grid grid-cols-1 md:grid-cols-2 gap-6`). |

**Key insight:** Phase 54's value is consolidating existing primitives, not inventing new ones. Every "build" item in CONTEXT.md maps to a primitive already in the repo. If a plan task description reads "implement X" for a non-trivial X, it's probably relocating X, not writing new X — cross-check before committing.

## Runtime State Inventory

> Required: this phase moves routes, deletes files, and cuts a CHECK constraint. Runtime systems outside git may hold stale references.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | (1) `accounting_credentials` rows with `provider='quickbooks'` or `'freshbooks'` — UNKNOWN row count in dev, zero in production (no production tenants). (2) `accounting_credentials` rows with `provider='xero'` — may exist in dev; new `scopes` column backfills to `'{}'` and the legacy broad-scope token remains valid until expiry (2 hours max for Xero access tokens). | (1) **Data migration in `051_integrations_schema.sql`** — `DELETE FROM accounting_credentials WHERE provider IN ('quickbooks','freshbooks')` (CONTEXT.md D-11 step a). (2) **No migration** — acceptable for Xero rows to backfill `scopes=[]`; dev reconnect applies new granular scopes (CONTEXT.md D-12). |
| **Live service config** | (1) **Xero dev app redirect URI** — if a tenant has already registered a Xero dev app at developer.xero.com with redirect URI pointing to `/api/accounting/xero/callback`, that URI must be updated to `/api/integrations/xero/callback` in the Xero Developer Portal before Phase 54 merges, or the OAuth loop breaks. User-visible runtime state, NOT in git. (2) **Jobber dev app** — if not yet registered (per state.md "User to register Jobber dev account" pending todo), no runtime state to update; app registration in Phase 54 uses the new `/api/integrations/jobber/callback` URL from day one. | (1) **Manual step** in plan — add a pre-merge checklist item "Update Xero dev-console redirect URI to `/api/integrations/xero/callback`". CONTEXT.md already flagged this at D-05. (2) **Documentation step** — `.env.example` + skill update tells the user to use the new URL when registering. |
| **OS-registered state** | None — this is a Node.js / Supabase / Next.js app. No systemd units, launchd plists, Task Scheduler entries, pm2 processes, or Docker image tags reference provider names as identifiers. | **None.** |
| **Secrets and env vars** | (1) `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET` — already referenced by `src/lib/accounting/xero.js` line 17-18. Env var names unchanged; Phase 54 migrates code to `src/lib/integrations/xero.js` which reads the same vars. (2) `JOBBER_CLIENT_ID`, `JOBBER_CLIENT_SECRET` — NOT YET IN `.env`; Phase 54 adds them to `.env.example` per CONTEXT.md Claude's Discretion "Sandbox provisioning timing". | (1) **No action** — existing env vars keep working. (2) **Add to `.env.example`** (no `.env.example` file currently exists in repo — verified by probing `.env.example`). Phase 54 creates `.env.example` if absent, or appends to it. |
| **Build artifacts / installed packages** | (1) `node_modules/@freshbooks/api` and `node_modules/intuit-oauth` and `node_modules/node-quickbooks` — listed in `package.json` lines 25/41/42. Once `freshbooks.js` and `quickbooks.js` are deleted, these packages become orphaned dependencies. | **Planner decides:** either (a) leave the packages installed in Phase 54 for simplicity (they're harmless dead weight), or (b) add `npm uninstall @freshbooks/api intuit-oauth node-quickbooks` as a Plan 2 task. **Recommendation:** leave for Phase 54, uninstall in Phase 58 alongside `accounting_sync_log` cleanup as a batch. Avoids mid-phase `package-lock.json` churn. |

**The canonical question — answered:** After every file in the repo is updated, what runtime systems still have the old string cached, stored, or registered? Only one: **the Xero dev-console redirect URI**, which is UI-driven at developer.xero.com and must be updated manually. If Xero dev app hasn't been registered yet (likely), this reduces to documentation.

## Environment Availability

> Phase 54 involves external services (Supabase Postgres, Xero Developer Portal, Jobber Developer Center). Probing availability.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js 16 | ✓ (assumed — build works) | 20.9+ required for Next.js 16 | — |
| Supabase (hosted) | Migration 051 | ✓ (existing project) | 50 migrations applied, 051 is next | Migration file ships in repo; `supabase db push` blocks Phase 54 merge |
| Xero Developer sandbox account | Pre-merge redirect URI update; Phase 55 execution | **UNKNOWN — user action pending per STATE.md** | — | If unregistered, Phase 54 still merges (routes scaffold works; callback returns `501`). Phase 55 blocked until sandbox exists. |
| Jobber Developer sandbox account | Pre-merge OAuth scope config; Phase 56 execution | **UNKNOWN — user action pending per STATE.md** | — | Same as Xero — Phase 54 ships stubs; Phase 56 blocked. |
| `npm` | Package installs | ✓ (repo has `package.json`) | — | — |
| Supabase CLI | `supabase db push` for migration | **UNKNOWN — not probed this session** | — | Alternative: paste migration SQL into Supabase Studio SQL editor |

**Missing dependencies with no fallback:** None — Phase 54 ships scaffolding; Phases 55/56 carry the real external dependency on sandbox accounts.

**Missing dependencies with fallback:** All sandbox registrations. Phase 54 stubs return `501 Not Implemented` where real OAuth would run, so the phase is mergeable even if sandboxes don't exist yet.

## Common Pitfalls

### Pitfall 1: Xero scope string is WRONG in existing code

**What goes wrong:** `src/lib/accounting/xero.js` line 10 declares `const XERO_SCOPES = 'openid profile email accounting.transactions accounting.contacts offline_access'`. If this string is carried verbatim into the new `src/lib/integrations/xero.js`, a new Xero dev app (created after March 2 2026) returns HTTP 401 `insufficient_scope` on first API call.
**Why it happens:** Xero deprecated the broad `accounting.transactions` scope effective March 2 2026. Apps created on/after that date must use granular scopes. The existing code predates the change. [CITED: https://devblog.xero.com/upcoming-changes-to-xero-accounting-api-scopes-705c5a9621a0; https://www.apideck.com/blog/xero-scopes]
**How to avoid:** Update the scope constant during migration. The new string for Phase 54 (read invoices + push invoices + read contacts + token refresh):

```javascript
// src/lib/integrations/xero.js
const XERO_SCOPES = 'openid profile email accounting.invoices accounting.invoices.read accounting.contacts.read offline_access';
```

**Note:** `accounting.contacts` (write) is NOT needed — Phase 54 doesn't create Xero contacts directly. Phase 55's `fetchCustomerByPhone` only reads; Phase 35's invoice push uses `findOrCreateCustomer` which DOES create contacts. **If Phase 35's invoice push is still active** (gated by invoicing flag in Phase 53), Xero invoice push will fail without `accounting.contacts` write. **Decision for planner:** include `accounting.contacts` (write) to preserve invoice push capability behind the invoicing flag, OR split scope bundles by mode. Recommended string covering both read-side and legacy push:

```javascript
const XERO_SCOPES = 'openid profile email accounting.invoices accounting.invoices.read accounting.contacts accounting.contacts.read offline_access';
```

**Warning signs:** `insufficient_scope` error in Xero callback logs; empty invoice/contact data in `fetchCustomerByPhone` tests.

### Pitfall 2: CHECK constraint swap order

**What goes wrong:** `ALTER TABLE ... ADD CONSTRAINT ... CHECK (provider IN ('xero','jobber'))` fails if any row still has `provider='quickbooks'` or `'freshbooks'`.
**Why it happens:** Postgres validates new CHECKs against existing rows immediately unless `NOT VALID` is specified.
**How to avoid:** DELETE QB/FB rows BEFORE ADD CONSTRAINT. Migration 051's sequence per D-11 is correct.
**Warning signs:** Migration fails with `ERROR: check constraint "accounting_credentials_provider_check" of relation "accounting_credentials" is violated by some row`.

### Pitfall 3: `accounting_sync_log` cascade assumption

**What goes wrong:** CONTEXT.md Known Pitfalls says "`accounting_sync_log` has a FK back to `accounting_credentials`. If CASCADE is set, QB/FB row deletions will cascade-delete sync log rows." **This is WRONG.** Verified by reading `supabase/DB` line 21-34: `accounting_sync_log` FKs point to `tenants(id)` and `invoices(id)` only — NOT `accounting_credentials`.
**Why it happens:** Intuitive assumption that sync-log references credentials directly; actual schema links sync-log to the entity it synced (invoice) + tenant.
**How to avoid:** Deleting QB/FB rows from `accounting_credentials` has **zero effect** on `accounting_sync_log`. Pre-existing QB/FB rows in `accounting_sync_log` remain (their invoices still reference them). This is acceptable because (a) those rows only exist in dev, (b) the `provider` column on `accounting_sync_log` has NO CHECK constraint — it's free-text — so legacy `'quickbooks'` / `'freshbooks'` values don't violate anything after migration 051.
**Warning signs:** If the planner adds an unnecessary CASCADE clause or pre-emptive sync_log DELETE, the migration does more than needed without harm — but wastes plan effort.

### Pitfall 4: `'use cache'` directive placement

**What goes wrong:** `'use cache'` appears after a statement (an import, a destructuring, a `const`) — silently produces no caching, no compile error.
**Why it happens:** Developers accustomed to `'use client'`/`'use server'` treat them as metadata-like; `'use cache'` has stricter placement rules — must be the first statement inside the function body.
**How to avoid:** Audit every `'use cache'` in Plan 4. ESLint plugin for React Server Components may catch this; if not, code review checklist includes "Is `'use cache'` the first line inside the function body?"
**Warning signs:** `NEXT_PRIVATE_DEBUG_CACHE=1 npm run dev` logs show no `Cache` prefix on function calls that should be cached.

### Pitfall 5: Server Component / Client Component boundary on `/dashboard/more/integrations`

**What goes wrong:** The current `page.js` is `'use client'` — it fetches status via `fetch('/api/accounting/status')`. Switching to `getIntegrationStatus()` requires the fetching function to run in a Server Component (because `'use cache'` only works server-side). If the whole page becomes a Server Component, all the current `useState`/`useEffect`/`toast` logic breaks.
**Why it happens:** React Server Components can't use hooks; Client Components can't call cached async functions directly.
**How to avoid:** Split into Server + Client. Two valid patterns:
- **Pattern A (recommended for Phase 54):** Page-level Server Component wraps a Client Component. Server fetches status and passes it as initial props. Client Component owns all interaction state.
  ```javascript
  // page.js (Server)
  export default async function Page() {
    const tenantId = await getTenantId();
    const status = await getIntegrationStatus(tenantId);
    return <BusinessIntegrationsClient initialStatus={status} />;
  }
  ```
- **Pattern B:** Full Client Component that fetches via `GET /api/integrations/status` (which internally calls `getIntegrationStatus`). The cache benefit is preserved at the API layer; the page stays Client. Simpler to migrate from the existing Client page but doesn't fully exercise the `'use cache'` primitive on the page itself.

**Recommended:** Pattern A for Plan 5 — matches UI-SPEC data flow ("Page fetches `GET /api/integrations/status` on mount"). Wait — UI-SPEC actually says the page fetches on mount, which is Pattern B. **Reconcile:** UI-SPEC was written before the `'use cache'` smoke-test decision was finalized; the smoke-test (D-10) wants `getIntegrationStatus()` called from a Server Component to prove the cache loop. **Planner decision needed:** follow UI-SPEC data flow (Pattern B) and still smoke-test the cache at the API route level, OR rewrite to Pattern A and diverge from UI-SPEC §Data Flow. Recommendation: **Pattern A** because CONTEXT.md D-10 explicitly says "the new `/dashboard/more/integrations` page renders from this cached read." UI-SPEC §Data Flow can be relaxed; its Open Question #4 already hints at flexibility.
**Warning signs:** `NEXT_PRIVATE_DEBUG_CACHE=1` shows no cache entry for the integrations page; owner reports stale status after disconnect.

### Pitfall 6: Next.js 16.1.x Turbopack + `cacheComponents` freeze bug

**What goes wrong:** Turbopack dev mode with `cacheComponents: true` has been reported to cause system freezes (30+ seconds) during file cache writes, on Next.js 16.1.1. [CITED: https://github.com/vercel/next.js/discussions/87796]
**Why it happens:** Turbopack filesystem cache synchronization bug resolved in a later 16.1.x or 16.2 patch.
**How to avoid:** Repo is on Next.js `^16.1.7` — the caret allows `npm install` to pull 16.1.11+ which may include the fix. If dev freezes during Plan 4 QA, either (a) upgrade to 16.2.4 (separate phase, out of scope), (b) run dev with `--webpack` flag, or (c) disable `cacheComponents` locally for dev (production build still works). Document the fallback in Plan 4 human-verify step.
**Warning signs:** `npm run dev` hangs on a file save for 30+ seconds; CPU spikes with no visible cause.

### Pitfall 7: Jobber scope names are UNKNOWN at plan time

**What goes wrong:** Planner writes Jobber adapter stub with placeholder scope strings; when Phase 56 wires the real scopes, the adapter surface must change.
**Why it happens:** Jobber scopes are configured in the Developer Center UI, not enumerated in public API docs. Confirmed via webfetch of `developer.getjobber.com/docs/building_your_app/app_authorization/` and `developer.getjobber.com/docs/getting_started/` — neither lists scope strings. [CITED: both URLs, verified 2026-04-17]
**How to avoid:** Phase 54 Jobber stub does NOT hardcode scope strings. `getAuthUrl()` returns a URL with `scope=<TBD>` or omits scope entirely (Jobber accepts app-configured scopes from the Developer Center registration, passed via Developer-Center-configured URL). `jobber.js` exports a `NotImplementedError` from `fetchCustomerByPhone`. Phase 56 fills in the real OAuth authorization URL construction once the user has registered the Jobber dev app and knows the scope strings.
**Warning signs:** Phase 56 plan discovers the scope list differs from Phase 54 placeholder and requires adapter refactor. Prevention: Phase 54 stub is intentionally minimal.

## Code Examples

Verified patterns from official sources and existing repo code:

### OAuth initiation (template from existing `/api/accounting/[provider]/auth/route.js`)

```javascript
// src/app/api/integrations/[provider]/auth/route.js (NEW)
// Source: migrated from src/app/api/accounting/[provider]/auth/route.js lines 1-45
import { createSupabaseServer } from '@/lib/supabase-server';
import { supabase } from '@/lib/supabase';
import { signOAuthState } from '@/app/api/google-calendar/auth/route';
import { getIntegrationAdapter } from '@/lib/integrations/adapter';
import { PROVIDERS } from '@/lib/integrations/types';

export async function GET(request, { params }) {
  const { provider } = await params;  // Next.js 16: params is async

  if (!PROVIDERS.includes(provider)) {
    return Response.json(
      { error: `Unsupported provider: "${provider}"` },
      { status: 400 },
    );
  }

  const supabaseServer = await createSupabaseServer();
  const { data: { user } } = await supabaseServer.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('owner_id', user.id)
    .single();
  if (!tenant) return Response.json({ error: 'Tenant not found' }, { status: 404 });

  const adapter = await getIntegrationAdapter(provider);
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/${provider}/callback`;
  const state = signOAuthState(tenant.id);
  const authUrl = adapter.getAuthUrl(state, redirectUri);

  return Response.json({ url: authUrl });
}
```

### OAuth callback with `revalidateTag` (template from existing callback)

```javascript
// src/app/api/integrations/[provider]/callback/route.js (NEW)
// Source: migrated from src/app/api/accounting/[provider]/callback/route.js + revalidateTag added per D-10
import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { supabase } from '@/lib/supabase';
import { verifyOAuthState } from '@/app/api/google-calendar/auth/route';
import { getIntegrationAdapter } from '@/lib/integrations/adapter';
import { PROVIDERS } from '@/lib/integrations/types';

const PAGE_URL = '/dashboard/more/integrations';

export async function GET(request, { params }) {
  const { provider } = await params;
  if (!PROVIDERS.includes(provider)) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}${PAGE_URL}?error=unsupported_provider&provider=${provider}`,
    );
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  const tenantId = verifyOAuthState(state);
  if (!code || !tenantId) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}${PAGE_URL}?error=invalid_state&provider=${provider}`,
    );
  }

  try {
    const adapter = await getIntegrationAdapter(provider);
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/${provider}/callback`;
    const tokenSet = await adapter.exchangeCode(code, redirectUri);

    await supabase.from('accounting_credentials').upsert(
      {
        tenant_id: tenantId,
        provider,
        access_token: tokenSet.access_token,
        refresh_token: tokenSet.refresh_token,
        expiry_date: tokenSet.expiry_date,
        xero_tenant_id: tokenSet.xero_tenant_id || null,
        display_name: tokenSet.display_name || null,
        scopes: tokenSet.scopes || [],           // NEW column (migration 051)
        connected_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,provider' },
    );

    revalidateTag(`integration-status-${tenantId}`);  // NEW per D-10

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}${PAGE_URL}?connected=${provider}`,
    );
  } catch (err) {
    console.error(`[integrations-callback] ${provider} error:`, err);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}${PAGE_URL}?error=connection_failed&provider=${provider}`,
    );
  }
}
```

### Jobber adapter STUB (scope + OAuth endpoints documented; real implementation deferred)

```javascript
// src/lib/integrations/jobber.js (NEW — STUB)
// Source: https://developer.getjobber.com/docs/building_your_app/app_authorization/
// [CITED 2026-04-17]

const JOBBER_AUTH_URL = 'https://api.getjobber.com/api/oauth/authorize';
const JOBBER_TOKEN_URL = 'https://api.getjobber.com/api/oauth/token';

/** @implements {import('./types.js').IntegrationAdapter} */
export class JobberAdapter {
  constructor() {
    this.clientId = process.env.JOBBER_CLIENT_ID;
    this.clientSecret = process.env.JOBBER_CLIENT_SECRET;
  }

  getAuthUrl(stateParam, redirectUri) {
    // Jobber scopes are configured in Developer Center when the app is registered.
    // They are NOT passed as a `scope=` query param — the authorize endpoint
    // surfaces whatever scopes the app was registered with.
    const url = new URL(JOBBER_AUTH_URL);
    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('state', stateParam);
    return url.toString();
  }

  async exchangeCode(code, redirectUri) {
    // STUB: Phase 56 implements real token exchange.
    // Jobber token response is a JWT; expires_in is typically 60 minutes.
    throw new Error('NotImplementedError: Jobber exchangeCode ships in Phase 56');
  }

  async refreshToken(tokenSet) {
    throw new Error('NotImplementedError: Jobber refreshToken ships in Phase 56');
  }

  async revoke(tokenSet) {
    throw new Error('NotImplementedError: Jobber revoke ships in Phase 56');
  }

  async fetchCustomerByPhone(tenantId, phone) {
    throw new Error('NotImplementedError: Jobber fetchCustomerByPhone ships in Phase 56');
  }
}
```

### HMAC OAuth state signing (reused verbatim from existing helper)

```javascript
// EXISTING: src/app/api/google-calendar/auth/route.js lines 11-33 (verified via Grep)
// Phase 54 imports these functions as-is — no refactor.

import crypto from 'crypto';

export function signOAuthState(tenantId) {
  const hmac = crypto.createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY)
    .update(tenantId)
    .digest('hex');
  return `${tenantId}:${hmac}`;
}

export function verifyOAuthState(state) {
  if (!state || !state.includes(':')) return null;
  const [tenantId, hmac] = state.split(':');
  const expected = crypto.createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY)
    .update(tenantId)
    .digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(expected, 'hex'))) {
    return null;
  }
  return tenantId;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Next.js 15 implicit caching (`fetch` cache, `unstable_cache`) | Next.js 16 explicit `'use cache'` + `cacheTag` | Next.js 16.0 (released late 2025) | Cache behavior is predictable; `cacheComponents: true` is the single flag (replaces `ppr`, `useCache`, `dynamicIO`). [CITED: https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents version history] |
| `middleware.ts` (edge runtime) | `proxy.ts`/`proxy.js` (Node.js runtime) | Next.js 16.0 | Repo is already on `src/proxy.js` — no migration needed in Phase 54. |
| Xero broad `accounting.transactions` scope | Xero granular scopes (`accounting.invoices`, `accounting.invoices.read`, etc.) | Xero API, March 2 2026 | **Apps created on/after March 2 2026 CANNOT use broad scope.** Phase 54 updates the existing hardcoded scope string. [CITED: https://devblog.xero.com/upcoming-changes-to-xero-accounting-api-scopes-705c5a9621a0] |
| `revalidatePath` for cache invalidation | `revalidateTag` (tag-based) or `updateTag` (atomic) | Next.js 16 | Per-tenant tagging (`integration-status-${tenantId}`) is the correct granularity for multi-tenant SaaS. |

**Deprecated/outdated:**

- **QuickBooks + FreshBooks adapters** (`src/lib/accounting/{quickbooks,freshbooks}.js`) — deleted in Phase 54 per CONTEXT.md D-15. Packages `@freshbooks/api`, `intuit-oauth`, `node-quickbooks` become orphaned dependencies (planner decides uninstall timing).
- **Xero broad scope string** in `src/lib/accounting/xero.js` line 10 — replaced with granular scopes during migration to `src/lib/integrations/xero.js`.

## Assumptions Log

> Claims tagged `[ASSUMED]` need verification by the planner or user before becoming locked decisions.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Auto-generated Postgres CHECK constraint name is `accounting_credentials_provider_check` | §Code Examples Pattern 2 | Migration's DROP fails; easy fix (query `pg_constraint` or run `\d+ accounting_credentials`). Low risk — known Postgres convention; verified against 030_accounting_integrations.sql inline CHECK declaration which follows the same pattern. |
| A2 | Postgres `ALTER TABLE ... ADD CONSTRAINT CHECK` validates immediately unless `NOT VALID` is specified | §Common Pitfalls Pitfall 2 | Would make DELETE-before-ADD unnecessary. Semantics consistent across Postgres 12+. Low risk. |
| A3 | Xero `accounting.contacts` (write) is needed for Phase 35 invoice push because `findOrCreateCustomer` creates contacts | §Common Pitfalls Pitfall 1 | If push scenarios only match existing contacts, `.read` alone works and we over-scope. Medium impact — over-scoping is user-visible on OAuth consent screen. Recommendation: planner verifies by reading `src/lib/accounting/xero.js` `findOrCreateCustomer` method (lines 124-152) — it DOES call `createContacts` when match fails, so write scope IS needed. Actually, verified this in research — claim is correct, but keeping as assumed since I didn't run a migration test. |
| A4 | Jobber authorize URL accepts `response_type=code` + `client_id` + `redirect_uri` + `state` without a `scope=` param, taking scopes from Developer-Center config | §Code Examples Jobber Stub | If Jobber requires explicit scope query param, auth URL returns error on first test. Phase 54 stub never actually runs the Jobber OAuth loop (Phase 56 does), so this is a Phase 56 risk, not a Phase 54 risk. |
| A5 | Next.js 16.1.7 in the repo is functionally equivalent to 16.1.11+ for `cacheComponents` behavior (the Turbopack freeze bug was reported on 16.1.1 specifically) | §Common Pitfalls Pitfall 6 | If 16.1.7 still has the freeze bug, Plan 4 QA hits it. Fallback documented (use `--webpack` or disable `cacheComponents` locally). |
| A6 | `intuit-oauth`, `node-quickbooks`, `@freshbooks/api` packages have no other consumers in the repo after QB/FB adapter deletion | §Runtime State Inventory | If any other code imports these packages (e.g., a cron, a utility), deletion breaks unrelated code. Low risk — grep `require.*intuit-oauth\|node-quickbooks\|@freshbooks` in Plan 2 before uninstalling. |
| A7 | `scopes TEXT[]` column is read cleanly by Python via supabase-py 2.x (no type coercion issue) | §User Constraints Claude's Discretion "Python agent credential reads" | If Phase 55 discovers TEXT[] round-trips incorrectly, the column needs a `_` suffix or conversion. Low risk — PostgREST TEXT[] maps to JSON arrays; Python gets `list[str]`. |

## Open Questions

1. **Does UI-SPEC Pattern B (client-side fetch of status) still satisfy CONTEXT.md D-10's "smoke test the cache loop end-to-end" requirement?**
   - What we know: D-10 says "the new `/dashboard/more/integrations` page renders from this cached read." UI-SPEC §Data Flow says page fetches `GET /api/integrations/status` on mount (client-side fetch). These are compatible if the `/api/integrations/status` Route Handler internally calls `getIntegrationStatus(tenantId)` — then the cache benefit lives in the API layer, not the page render.
   - What's unclear: Does the planner interpret "page renders from this cached read" strictly (Server Component calls `getIntegrationStatus` directly) or loosely (page indirectly benefits via the API route)?
   - Recommendation: Strict interpretation (Pattern A, Server Component with client-child) is the more decisive smoke test and makes Phase 55 caching easier. UI-SPEC §Open Question #4 already flags this flexibility. Confirm with user in Plan 5.

2. **Should the Xero scope bundle include `accounting.contacts` (write) to preserve invoice push capability behind the invoicing flag?**
   - What we know: Phase 35's `pushInvoice` calls `findOrCreateCustomer` which can create new Xero contacts (verified by reading `xero.js` lines 124-152).
   - What's unclear: Is invoice push intended to work immediately after Phase 54 merge (just gated by invoicing flag), or is it semi-deprecated until the invoicing feature is re-scoped?
   - Recommendation: Include `accounting.contacts` (write) — the flag gates the *behavior*, not the *capability grant*. Over-scoping is a cosmetic OAuth consent screen concern; under-scoping breaks invoicing when owners flip the flag on.

3. **Should Phase 54 uninstall `intuit-oauth`, `node-quickbooks`, `@freshbooks/api` npm packages, or leave as orphaned dependencies?**
   - What we know: Packages are declared in `package.json` lines 25, 41, 42. After QB/FB adapter deletion, nothing imports them.
   - What's unclear: Preference for a clean `package-lock.json` diff in Phase 54 vs. batching npm cleanup with the Phase 58 `accounting_sync_log` cleanup.
   - Recommendation: Leave in Phase 54 (dead weight, no behavior impact). Remove in Phase 58. Prevents mid-phase `package-lock.json` churn and keeps Phase 54's blast radius focused on src/.

4. **Is `accounting_sync_log` retained as-is, or are QB/FB rows also purged?**
   - What we know: `accounting_sync_log` has a free-text `provider` column (no CHECK constraint) — verified via 030 migration line 44. Legacy QB/FB rows there are harmless.
   - What's unclear: Cosmetic cleanup preference.
   - Recommendation: Leave untouched in Phase 54. Flag for Phase 58 cleanup candidacy.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 29.7.0 (`jest-cli` per `package.json` line 59-60) |
| Config file | No explicit `jest.config.*` found via Glob — Jest uses package.json defaults; repo scripts use `--experimental-vm-modules` for ESM |
| Quick run command | `npm test` (runs all; `--passWithNoTests` prevents CI failure for new tests) |
| Full suite command | `npm run test:all` |
| Integration subset | `npm run test:integration` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INTFOUND-01 (module surface) | `src/lib/integrations/{types,adapter,xero,jobber,status}.js` exports the right symbols | smoke (grep) | `grep -l "export.*IntegrationAdapter\|export.*PROVIDERS" src/lib/integrations/types.js && grep -l "export.*getIntegrationAdapter" src/lib/integrations/adapter.js && grep -l "export class XeroAdapter" src/lib/integrations/xero.js && grep -l "export class JobberAdapter" src/lib/integrations/jobber.js && grep -l "export.*getIntegrationStatus" src/lib/integrations/status.js` | ❌ Wave 0 (no dedicated test file; grep-based validation per GSD convention) |
| INTFOUND-01 (adapter factory returns Xero) | `getIntegrationAdapter('xero')` returns an object with `getAuthUrl`, `exchangeCode`, `refreshToken`, `revoke`, `fetchCustomerByPhone` | unit | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/unit/integrations/adapter.test.js --passWithNoTests` | ❌ Wave 0 (new test file `tests/unit/integrations/adapter.test.js`) |
| INTFOUND-01 (Jobber stub throws) | `await jobberAdapter.fetchCustomerByPhone(t,p)` throws `NotImplementedError` | unit | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/unit/integrations/jobber.test.js --passWithNoTests` | ❌ Wave 0 (new test file) |
| INTFOUND-01 (route scaffolding) | `/api/integrations/[provider]/auth` returns 200 for 'xero', 400 for 'unknown', 401 when unauth | smoke (grep structure) | `grep -c "PROVIDERS.includes(provider)" src/app/api/integrations/[provider]/auth/route.js` must be >0; `grep -c "PROVIDERS.includes(provider)" src/app/api/integrations/[provider]/callback/route.js` must be >0 | ❌ Wave 0 |
| INTFOUND-01 (legacy routes deleted) | `/api/accounting/**` routes no longer resolve | grep | `test ! -d src/app/api/accounting` | ❌ Wave 0 (file-system assertion) |
| INTFOUND-02 (migration applied) | `accounting_credentials.scopes` column exists; `last_context_fetch_at` column exists; CHECK includes 'xero' + 'jobber'; rejects 'quickbooks' | integration (DB) | Manual: run `supabase db push` then `SELECT column_name FROM information_schema.columns WHERE table_name = 'accounting_credentials'` via Supabase SQL editor; verify both columns. Insert-test: `INSERT INTO accounting_credentials (tenant_id, provider, access_token, refresh_token) VALUES ('<uuid>', 'quickbooks', 'x', 'x')` must fail with check violation. | ❌ Manual (migration verification is always manual in this repo — see Phase 53 validation pattern) |
| INTFOUND-02 (migration file exists) | `supabase/migrations/051_integrations_schema.sql` present | grep | `test -f supabase/migrations/051_integrations_schema.sql` | ❌ Wave 0 |
| INTFOUND-03 (cacheComponents flipped) | `next.config.js` contains `cacheComponents: true` | grep | `grep -c "cacheComponents: true" next.config.js` must be 1 | ❌ Wave 0 |
| INTFOUND-03 (cache round-trip) | Connect Xero → status page shows connected; disconnect → status page shows disconnected on next render within <5s | manual (e2e) | Human-verify in dev after Plan 5 | — Manual |
| INTFOUND-03 (build doesn't error) | `npm run build` completes without cacheComponents-related errors | smoke (build) | `npm run build 2>&1 \| grep -E "Filling a cache during prerender timed out\|next-request-in-use-cache" \| wc -l` must be 0 | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test -- --testPathPatterns=integrations` (scoped to new tests only; ~seconds)
- **Per wave merge:** `npm run test:all` (full suite green)
- **Phase gate:** Full suite green + manual Supabase migration verification + `npm run build` clean before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/unit/integrations/adapter.test.js` — covers INTFOUND-01 adapter factory
- [ ] `tests/unit/integrations/jobber.test.js` — covers INTFOUND-01 Jobber stub
- [ ] `tests/unit/integrations/status.test.js` — covers INTFOUND-03 `getIntegrationStatus` return shape (cache behavior must be integration-tested, unit test stubs Supabase)
- [ ] Shell: no framework install needed — Jest already configured

*(Manual items: migration + full-build + e2e cache round-trip are all manual by existing repo convention; see Phase 53 VALIDATION.md for precedent.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth via cookie-backed session (`createSupabaseServer`) on OAuth initiation; OAuth 2.0 authorization code grant with HMAC-signed state for OAuth callback |
| V3 Session Management | yes | Supabase's cookie-based sessions (already established); new integration credential storage piggybacks existing `accounting_credentials` RLS |
| V4 Access Control | yes | RLS policies on `accounting_credentials` (service_role all, tenant_own) — unchanged; new columns inherit. `/api/integrations/**` routes verify tenant ownership via `getTenantId()` or explicit tenant lookup |
| V5 Input Validation | yes | `PROVIDERS.includes(provider)` guards on path param; Zod NOT currently in repo for this domain — existing pattern is manual guard + `try/catch` |
| V6 Cryptography | yes | HMAC-SHA256 for OAuth state via Node `crypto` built-in (`signOAuthState` / `verifyOAuthState` — NOT hand-rolled, reused) |

### Known Threat Patterns for {Next.js + Supabase + OAuth}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| CSRF on OAuth callback (attacker injects their own code/state) | Spoofing | HMAC-signed `state` parameter keyed to tenantId, `crypto.timingSafeEqual` comparison — already implemented in `verifyOAuthState` |
| Token exfiltration via service-role leak | Information Disclosure | `SUPABASE_SERVICE_ROLE_KEY` stays in server-side env; client never sees credentials; new `getIntegrationStatus` returns only non-sensitive fields (`connected_at`, `scopes`, `last_context_fetch_at`, `display_name`) — NOT `access_token` or `refresh_token` |
| Cache-key collision leaks another tenant's status | Information Disclosure | `cacheTag(\`integration-status-${tenantId}\`)` — per-tenant tag; closure-captured `tenantId` becomes part of the cache key (per Next.js 16 use-cache serialization contract) |
| Replay / token refresh race | Tampering | Existing `refreshTokenIfNeeded` uses 5-minute buffer; upsert on `(tenant_id, provider)` is atomic in Postgres |
| SQL injection via `provider` path param | Tampering | Guarded by `PROVIDERS.includes(provider)` allowlist before hitting DB; Supabase JS client uses parameterized queries |
| Redirect URI manipulation | Spoofing | Redirect URI is computed server-side from `NEXT_PUBLIC_APP_URL` + hardcoded path; attacker cannot inject a custom `redirect_uri` |
| OAuth scope escalation (attacker requests broader scope than app configured) | Elevation of Privilege | Scopes declared in provider (Xero/Jobber) dev console and enforced by the provider; Voco app cannot request more than registered |
| Revoke that doesn't actually revoke upstream | Repudiation | Disconnect route MUST call `adapter.revoke(tokenSet)` before deleting DB row (per D-06); if adapter `revoke()` throws, still delete the row but log the failure — owner's intent was "disconnect locally regardless of upstream state" |

## Sources

### Primary (HIGH confidence)

- [https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents] — cacheComponents flag, enables `'use cache'` + `cacheLife` + `cacheTag` — version 16.2.4, last updated 2026-04-15
- [https://nextjs.org/docs/app/api-reference/directives/use-cache] — `'use cache'` placement, constraints, serialization rules — version 16.2.4
- [https://nextjs.org/docs/app/api-reference/functions/cacheTag] — `cacheTag` syntax, limits (256 char / 128 tags), dynamic strings — version 16.2.4
- Repo files (verified via Read):
  - `src/lib/accounting/{types,adapter,xero,sync}.js` — existing Phase 35 code to migrate
  - `src/app/api/accounting/{[provider]/{auth,callback},disconnect,status}/route.js` — existing routes to delete
  - `src/app/dashboard/more/integrations/page.js` — existing (Client) page to rewrite
  - `src/app/api/google-calendar/auth/route.js` — HMAC helpers to reuse
  - `next.config.js` — current state, one-line `cacheComponents: true` addition
  - `src/proxy.js` — verified `/api/integrations/**` is NOT in the proxy matcher (it's already uncovered; no proxy change needed)
  - `supabase/migrations/030_accounting_integrations.sql` — existing CHECK constraint shape + RLS policies
  - `supabase/DB` — verified `accounting_sync_log` FKs (tenants, invoices only)
  - `package.json` — xero-node 14.0.0, next 16.1.7 (installed); jest 29.7.0
  - `src/lib/get-tenant-id.js` — helper signature for disconnect/status routes
  - Every `src/app/dashboard/**/{page,layout}.js` — classified client vs server (script output above)
- `npm view next version` → 16.2.4; `npm view xero-node version` → 15.0.0 (VERIFIED via Bash)

### Secondary (MEDIUM confidence)

- [https://devblog.xero.com/upcoming-changes-to-xero-accounting-api-scopes-705c5a9621a0] — Xero granular scopes deprecation timeline, March 2 2026 cutover
- [https://www.apideck.com/blog/xero-scopes] — Exact granular scope names list with read/write variants (accessed via WebFetch 2026-04-17)
- [https://developer.xero.com/faq/granular-scopes] — Xero FAQ (webfetch timed out; findings sourced from apideck blog + devblog.xero.com only)
- [https://developer.getjobber.com/docs/building_your_app/app_authorization/] — Jobber OAuth endpoints, token response shape
- [https://developer.getjobber.com/docs/getting_started/] — Jobber scope configuration (Developer Center UI)
- [https://github.com/vercel/next.js/discussions/87796] — Turbopack cacheComponents freeze bug on 16.1.1

### Tertiary (LOW confidence)

- Exact Jobber scope strings — NOT publicly documented; must be discovered at dev app registration time (per-app config in Developer Center)
- Whether xero-node 14 → 15 breaking changes affect `buildConsentUrl` / `apiCallback` — not researched (we're keeping v14.0.0)
- Exact Postgres auto-generated CHECK constraint name in the running Supabase project — verified from migration file SQL convention, not from live `pg_constraint` query

## Metadata

**Confidence breakdown:**

- Standard stack: **HIGH** — every library present in `package.json`; versions verified via `npm view`; Next.js 16.2.4 official docs fetched directly.
- Architecture: **HIGH** — patterns pulled verbatim from existing repo (migrations, routes, adapter factory, HMAC helper); cache patterns pulled verbatim from Next.js 16.2.4 official docs.
- Pitfalls: **HIGH** for items 1-5 (direct evidence from docs + repo); **MEDIUM** for item 6 (Turbopack bug — not reproduced locally, mitigation documented); **MEDIUM** for item 7 (Jobber scope opacity is a documented gap, not a repo-specific discovery).
- Validation: **HIGH** — pattern matches Phase 53 precedent (grep-based + manual migration + manual e2e).
- Security: **HIGH** — all mitigations are existing patterns or well-known ASVS controls.
- Jobber-specific details: **LOW** — scope names are Developer-Center-configured and not enumerated publicly. Phase 54 stub is intentionally minimal; Phase 56 resolves the gap.

**Research date:** 2026-04-17
**Valid until:** 2026-05-17 (30 days) for core patterns; 7 days for Next.js 16 specifics (release cadence monthly, 16.3.x likely by mid-May)

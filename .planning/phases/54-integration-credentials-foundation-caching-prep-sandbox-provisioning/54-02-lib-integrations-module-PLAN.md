---
phase: 54-integration-credentials-foundation-caching-prep-sandbox-provisioning
plan: 02
type: execute
wave: 2
depends_on:
  - 54-01
files_modified:
  - src/lib/integrations/types.js
  - src/lib/integrations/adapter.js
  - src/lib/integrations/xero.js
  - src/lib/integrations/jobber.js
  - src/lib/integrations/status.js
  - src/lib/accounting/sync.js
  - src/lib/accounting/types.js
  - src/lib/accounting/adapter.js
  - src/lib/accounting/xero.js
  - src/lib/accounting/quickbooks.js
  - src/lib/accounting/freshbooks.js
  - .env.example
autonomous: true
requirements:
  - INTFOUND-01
  - INTFOUND-03

must_haves:
  truths:
    - "`src/lib/integrations/` directory exists with types, adapter, xero, jobber, and status modules"
    - "`getIntegrationAdapter('xero')` returns a XeroAdapter instance that implements `getAuthUrl`, `exchangeCode`, `refreshToken`, `revoke`, and `fetchCustomerByPhone`"
    - "`getIntegrationAdapter('jobber')` returns a JobberAdapter stub that exposes the same surface; `fetchCustomerByPhone` throws `NotImplementedError`"
    - "Xero scope constant uses the granular, post-March-2-2026 string (no deprecated `accounting.transactions`)"
    - "`getIntegrationStatus(tenantId)` is defined in `src/lib/integrations/status.js`, starts with `'use cache'` as the first statement, calls `cacheTag(\`integration-status-${tenantId}\`)`, and returns `{ xero: {...}|null, jobber: {...}|null }`"
    - "`src/lib/accounting/{quickbooks,freshbooks,types,adapter,xero}.js` are deleted; `src/lib/accounting/sync.js` is retained"
    - "`.env.example` lists `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`, `JOBBER_CLIENT_ID`, `JOBBER_CLIENT_SECRET`"
  artifacts:
    - path: "src/lib/integrations/types.js"
      provides: "IntegrationAdapter typedef + PROVIDERS=['xero','jobber']"
      contains: "export const PROVIDERS"
    - path: "src/lib/integrations/adapter.js"
      provides: "getIntegrationAdapter(provider) factory + refreshTokenIfNeeded()"
      exports: ["getIntegrationAdapter", "refreshTokenIfNeeded"]
    - path: "src/lib/integrations/xero.js"
      provides: "Unified XeroAdapter — OAuth + read-side stubs + push methods migrated from accounting/xero.js"
      exports: ["XeroAdapter"]
    - path: "src/lib/integrations/jobber.js"
      provides: "JobberAdapter stub — OAuth shell per researcher §Code Examples, fetchCustomerByPhone throws NotImplementedError"
      exports: ["JobberAdapter"]
    - path: "src/lib/integrations/status.js"
      provides: "getIntegrationStatus(tenantId) with 'use cache' + cacheTag"
      exports: ["getIntegrationStatus"]
  key_links:
    - from: "src/lib/integrations/adapter.js"
      to: "src/lib/integrations/{xero,jobber}.js"
      via: "dynamic import in factory switch"
      pattern: "await import\\('./(xero|jobber)\\.js'\\)"
    - from: "src/lib/integrations/status.js"
      to: "accounting_credentials table"
      via: "service-role Supabase client select"
      pattern: "from\\('accounting_credentials'\\)"
    - from: "src/lib/integrations/status.js"
      to: "next/cache cacheTag"
      via: "import + call with tenant-scoped tag"
      pattern: "cacheTag\\(`integration-status-\\$\\{tenantId\\}`\\)"
---

<objective>
Build the `src/lib/integrations/` module that INTFOUND-01 requires. This plan lands five new files, deletes five old files, updates the Xero scope string to the granular post-March-2-2026 bundle (per researcher finding #1), and ships env-var scaffolding for Jobber (per researcher discretion item "Sandbox provisioning timing").

Purpose: Downstream plans in this phase (Plan 03 routes, Plan 04 cacheComponents audit, Plan 05 frontend) and downstream phases (55 Xero, 56 Jobber) all import from `src/lib/integrations/`. This plan establishes the canonical surface that those consumers depend on. Interface-first ordering: types.js first (defines contract), then adapters, then factory, then status helper.

Output:
- Full `src/lib/integrations/` module, 5 files
- QuickBooks + FreshBooks adapters deleted (per D-02, D-15)
- Xero scope constant uses granular strings: `openid profile email accounting.invoices accounting.invoices.read accounting.contacts accounting.contacts.read offline_access` (researcher finding #1 + Q2 recommendation — write contacts scope retained to preserve invoice-push capability behind the invoicing flag)
- `.env.example` documents Jobber env vars (no current `.env.example` verified; create or append)
- `src/lib/accounting/sync.js` kept (it's invoice-push orchestration, stays in accounting/ per D-02 "sync.js stays in accounting/ if push-only orchestration")

**Researcher findings resolved in this plan:**
- **Finding #1 (Xero scope):** `XERO_SCOPES` constant in new `src/lib/integrations/xero.js` uses granular strings; legacy `accounting.transactions` REMOVED.
- **Finding #4 (Jobber scope opacity):** `JobberAdapter` is a deliberately minimal stub — OAuth URL constructed without hardcoded scope string (Jobber Developer Center passes scopes from app registration); `exchangeCode`/`refreshToken`/`revoke`/`fetchCustomerByPhone` throw `NotImplementedError('…ships in Phase 56')`.

**Out of scope (do NOT do in this plan):**
- Do NOT extract `signOAuthState`/`verifyOAuthState` to `src/lib/integrations/oauth-state.js` — CONTEXT.md discretion block says "only if Phase 55/56 develops a second consumer". Plan 03 routes import these from `src/app/api/google-calendar/auth/route.js` directly.
- Do NOT uninstall `intuit-oauth`, `node-quickbooks`, `@freshbooks/api` npm packages. Researcher Q3 recommends deferring to Phase 58 to avoid mid-phase `package-lock.json` churn.
- Do NOT touch Python `livekit-agent/` — schema compatibility is a documentation-only concern for Phase 54 (researcher A7 confirms TEXT[] → Python list[str] works).
- Do NOT build API routes yet — Plan 03 owns `/api/integrations/**` scaffolding.
</objective>

<execution_context>
@.claude/get-shit-done/workflows/execute-plan.md
@.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/54-integration-credentials-foundation-caching-prep-sandbox-provisioning/54-CONTEXT.md
@.planning/phases/54-integration-credentials-foundation-caching-prep-sandbox-provisioning/54-RESEARCH.md
@src/lib/accounting/types.js
@src/lib/accounting/adapter.js
@src/lib/accounting/xero.js
@src/lib/accounting/sync.js
@src/app/api/google-calendar/auth/route.js

<interfaces>
<!-- Existing AccountingAdapter typedef, to be replaced by IntegrationAdapter. Extracted from src/lib/accounting/types.js -->

```javascript
// Existing (src/lib/accounting/types.js line 42-49)
/**
 * @typedef {Object} AccountingAdapter
 * @property {(invoice, lineItems, settings) => Promise<{externalId: string}>} pushInvoice
 * @property {(externalId, status) => Promise<void>} updateInvoiceStatus
 * @property {(tenantId, redirectUri) => string} getAuthUrl
 * @property {(code, redirectUri, extraParams?) => Promise<TokenSet>} exchangeCode
 * @property {(tokenSet) => Promise<TokenSet>} refreshToken
 * @property {(customerName, customerEmail) => Promise<string>} findOrCreateCustomer
 */
export const PROVIDERS = ['quickbooks', 'xero', 'freshbooks'];

// Existing (src/lib/accounting/adapter.js line 20-39)
export async function getAccountingAdapter(provider) { /* ... */ }
export async function refreshTokenIfNeeded(supabase, credentials) { /* 5-min buffer refresh + upsert */ }
```

HMAC helpers used by Plan 03 (NOT modified in this plan, just referenced):

```javascript
// src/app/api/google-calendar/auth/route.js lines 11-33
export function signOAuthState(tenantId)   // HMAC-SHA256, keyed by SUPABASE_SERVICE_ROLE_KEY
export function verifyOAuthState(state)    // timing-safe; returns tenantId or null
```

Existing XeroAdapter class with the bug (legacy scope on line 10):

```javascript
// src/lib/accounting/xero.js line 10 — THE BUG PER RESEARCHER FINDING #1
const XERO_SCOPES = 'openid profile email accounting.transactions accounting.contacts offline_access';
//                                        ^^^^^^^^^^^^^^^^^^^^^^ deprecated after 2026-03-02
```

`src/lib/accounting/sync.js` — currently imports `getAccountingAdapter` from `./adapter.js`. Because this plan deletes `./adapter.js`, `sync.js` MUST be updated to import from the new path (`@/lib/integrations/adapter`) OR be staged to stay in accounting/ with an adjusted import.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create integrations types.js (contract) + adapter.js (factory) + status.js (cached reader)</name>
  <files>src/lib/integrations/types.js, src/lib/integrations/adapter.js, src/lib/integrations/status.js, tests/unit/integrations/adapter.test.js, tests/unit/integrations/status.test.js</files>
  <behavior>
    - Test 1: `import { PROVIDERS } from 'src/lib/integrations/types'` returns exactly `['xero', 'jobber']` (no quickbooks, no freshbooks)
    - Test 2: `getIntegrationAdapter('xero')` returns an object with functions `getAuthUrl`, `exchangeCode`, `refreshToken`, `revoke`, `fetchCustomerByPhone`
    - Test 3: `getIntegrationAdapter('jobber')` returns an object with the same five functions
    - Test 4: `getIntegrationAdapter('quickbooks')` throws `Error` whose message includes `Unsupported` and `quickbooks`
    - Test 5: `getIntegrationStatus` is a named export from `src/lib/integrations/status.js`; calling it with a mocked Supabase client returns an object shaped `{ xero: <row-or-null>, jobber: <row-or-null> }`
    - Test 6: `getIntegrationStatus` source file contains the literal string `'use cache'` as the FIRST statement inside the function body (validated via AST or regex `/^[\s\S]*?export async function getIntegrationStatus\([^)]*\)\s*\{\s*['"]use cache['"]/m`)
  </behavior>
  <read_first>
    - src/lib/accounting/types.js (existing AccountingAdapter typedef — basis for new IntegrationAdapter)
    - src/lib/accounting/adapter.js (existing factory + refreshTokenIfNeeded — migration template)
    - .planning/phases/54-integration-credentials-foundation-caching-prep-sandbox-provisioning/54-RESEARCH.md §Pattern 1 (exact `'use cache'` + `cacheTag` template)
    - .planning/phases/54-integration-credentials-foundation-caching-prep-sandbox-provisioning/54-RESEARCH.md §Pattern 3 (unified IntegrationAdapter typedef)
  </read_first>
  <action>
**Step 1.** Create `src/lib/integrations/types.js`:

```javascript
/**
 * Integration adapter interface and shared type definitions.
 * Every provider (xero, jobber) implements this shape.
 *
 * @module integrations/types
 */

/**
 * @typedef {Object} TokenSet
 * @property {string} access_token
 * @property {string} refresh_token
 * @property {number} [expiry_date] - Unix timestamp in milliseconds
 * @property {string[]} [scopes] - Granular OAuth scopes granted
 * @property {string} [xero_tenant_id] - Xero organization ID (Xero only)
 * @property {string} [display_name] - Company name from provider
 */

/**
 * @typedef {Object} ExternalInvoice
 * @property {string} customerName
 * @property {string} customerEmail
 * @property {Array<ExternalLineItem>} lineItems
 * @property {string} invoiceNumber
 * @property {string} issuedDate
 * @property {string} dueDate
 * @property {number} taxRate
 */

/**
 * @typedef {Object} ExternalLineItem
 * @property {string} description
 * @property {number} quantity
 * @property {number} unitPrice
 * @property {boolean} taxable
 */

/**
 * @typedef {Object} CustomerContext
 * @property {Object|null} contact
 * @property {number} [outstandingBalance]
 * @property {Array<Object>} [lastInvoices]
 * @property {Array<Object>} [recentJobs]
 * @property {string|null} [lastPaymentDate]
 * @property {string|null} [lastVisitDate]
 */

/**
 * Unified integration adapter contract.
 *
 * OAuth lifecycle is mandatory for every adapter.
 * Read surface (fetchCustomerByPhone) is mandatory but may throw NotImplementedError
 * during the phase where the provider is still being wired (Phase 54 Jobber stub).
 * Push surface (pushInvoice / updateInvoiceStatus / findOrCreateCustomer) is optional —
 * only Xero implements it (Phase 35 legacy, gated by invoicing flag from Phase 53).
 *
 * @typedef {Object} IntegrationAdapter
 *
 * // OAuth lifecycle (mandatory)
 * @property {(stateParam: string, redirectUri: string) => string} getAuthUrl
 * @property {(code: string, redirectUri: string, extraParams?: Object) => Promise<TokenSet>} exchangeCode
 * @property {(tokenSet: TokenSet) => Promise<TokenSet>} refreshToken
 * @property {(tokenSet: TokenSet) => Promise<void>} revoke
 *
 * // Read surface (mandatory signature; may throw NotImplementedError)
 * @property {(tenantId: string, phone: string) => Promise<CustomerContext>} fetchCustomerByPhone
 *
 * // Push surface (optional — Xero only)
 * @property {(invoice: ExternalInvoice, lineItems: ExternalLineItem[], settings: Object) => Promise<{externalId: string}>} [pushInvoice]
 * @property {(externalId: string, status: string) => Promise<void>} [updateInvoiceStatus]
 * @property {(customerName: string, customerEmail: string) => Promise<string>} [findOrCreateCustomer]
 */

/** Supported integration providers — matches migration 051's CHECK constraint. */
export const PROVIDERS = ['xero', 'jobber'];
```

**Step 2.** Create `src/lib/integrations/adapter.js`:

```javascript
/**
 * Integration adapter factory and shared token management.
 *
 * @module integrations/adapter
 */

import { PROVIDERS } from './types.js';

/**
 * Returns an instantiated adapter for the given provider.
 *
 * @param {string} provider - One of 'xero', 'jobber'
 * @returns {Promise<import('./types.js').IntegrationAdapter>}
 * @throws {Error} If provider is not supported
 */
export async function getIntegrationAdapter(provider) {
  if (!PROVIDERS.includes(provider)) {
    throw new Error(
      `Unsupported integration provider: "${provider}". Must be one of: ${PROVIDERS.join(', ')}`,
    );
  }

  switch (provider) {
    case 'xero': {
      const { XeroAdapter } = await import('./xero.js');
      return new XeroAdapter();
    }
    case 'jobber': {
      const { JobberAdapter } = await import('./jobber.js');
      return new JobberAdapter();
    }
  }
}

/**
 * Refresh expired tokens and persist. Same 5-minute buffer as Phase 35.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase - Service-role client
 * @param {Object} credentials - Row from accounting_credentials
 * @returns {Promise<Object>} Updated credentials
 */
export async function refreshTokenIfNeeded(supabase, credentials) {
  const FIVE_MINUTES_MS = 5 * 60 * 1000;
  const now = Date.now();

  if (!credentials.expiry_date || credentials.expiry_date > now + FIVE_MINUTES_MS) {
    return credentials;
  }

  const adapter = await getIntegrationAdapter(credentials.provider);
  const newTokenSet = await adapter.refreshToken({
    access_token: credentials.access_token,
    refresh_token: credentials.refresh_token,
    expiry_date: credentials.expiry_date,
    xero_tenant_id: credentials.xero_tenant_id,
  });

  const { error } = await supabase
    .from('accounting_credentials')
    .update({
      access_token: newTokenSet.access_token,
      refresh_token: newTokenSet.refresh_token,
      expiry_date: newTokenSet.expiry_date,
    })
    .eq('id', credentials.id);

  if (error) {
    console.error('[integrations] Failed to persist refreshed tokens:', error.message);
  }

  return {
    ...credentials,
    access_token: newTokenSet.access_token,
    refresh_token: newTokenSet.refresh_token,
    expiry_date: newTokenSet.expiry_date,
  };
}
```

**Step 3.** Create `src/lib/integrations/status.js` — per D-10 and RESEARCH §Pattern 1 exactly:

```javascript
/**
 * Cached per-tenant integration status reader.
 *
 * Uses Next.js 16 `'use cache'` with a per-tenant cacheTag so that
 * disconnect + callback routes can invalidate instantly via revalidateTag.
 *
 * IMPORTANT: `'use cache'` MUST be the FIRST statement inside the function body.
 * Placing it after any other statement silently disables caching with no compile error.
 *
 * @module integrations/status
 */

import { cacheTag } from 'next/cache';
import { createClient } from '@supabase/supabase-js';

/**
 * @param {string} tenantId
 * @returns {Promise<{
 *   xero: { provider: string, scopes: string[], last_context_fetch_at: string|null, connected_at: string, display_name: string|null }|null,
 *   jobber: { provider: string, scopes: string[], last_context_fetch_at: string|null, connected_at: string, display_name: string|null }|null
 * }>}
 */
export async function getIntegrationStatus(tenantId) {
  'use cache';
  cacheTag(`integration-status-${tenantId}`);

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const { data, error } = await admin
    .from('accounting_credentials')
    .select('provider, scopes, last_context_fetch_at, connected_at, display_name')
    .eq('tenant_id', tenantId);

  if (error) {
    console.error('[integrations-status] fetch failed:', error.message);
    return { xero: null, jobber: null };
  }

  const rows = data || [];
  return {
    xero: rows.find((r) => r.provider === 'xero') || null,
    jobber: rows.find((r) => r.provider === 'jobber') || null,
  };
}
```

**Step 4.** Create `tests/unit/integrations/adapter.test.js` (Jest ESM per repo convention):

```javascript
import { describe, it, expect } from '@jest/globals';
import { PROVIDERS } from '@/lib/integrations/types';
import { getIntegrationAdapter } from '@/lib/integrations/adapter';

describe('integrations adapter factory', () => {
  it('PROVIDERS is exactly xero + jobber', () => {
    expect(PROVIDERS).toEqual(['xero', 'jobber']);
  });

  it("returns an adapter with OAuth + read surface for 'xero'", async () => {
    const a = await getIntegrationAdapter('xero');
    for (const fn of ['getAuthUrl', 'exchangeCode', 'refreshToken', 'revoke', 'fetchCustomerByPhone']) {
      expect(typeof a[fn]).toBe('function');
    }
  });

  it("returns an adapter with OAuth + read surface for 'jobber'", async () => {
    const a = await getIntegrationAdapter('jobber');
    for (const fn of ['getAuthUrl', 'exchangeCode', 'refreshToken', 'revoke', 'fetchCustomerByPhone']) {
      expect(typeof a[fn]).toBe('function');
    }
  });

  it("throws on 'quickbooks'", async () => {
    await expect(getIntegrationAdapter('quickbooks')).rejects.toThrow(/Unsupported.*quickbooks/);
  });
});
```

**Step 5.** Create `tests/unit/integrations/status.test.js`:

```javascript
import { readFileSync } from 'node:fs';
import { describe, it, expect } from '@jest/globals';

describe('integrations/status.js — cache directive placement', () => {
  it("has 'use cache' as the FIRST statement in getIntegrationStatus body", () => {
    const src = readFileSync('src/lib/integrations/status.js', 'utf8');
    // Match: export async function getIntegrationStatus(...) { <whitespace> 'use cache'
    const re = /export\s+async\s+function\s+getIntegrationStatus\s*\([^)]*\)\s*\{\s*['"]use cache['"]/m;
    expect(re.test(src)).toBe(true);
  });

  it("calls cacheTag with integration-status-<tenantId> pattern", () => {
    const src = readFileSync('src/lib/integrations/status.js', 'utf8');
    expect(src).toMatch(/cacheTag\(`integration-status-\$\{tenantId\}`\)/);
  });
});
```

Run tests. Expect all tests to fail initially (files don't exist yet). Then create the files above to make them pass.
  </action>
  <verify>
    <automated>npm test -- --testPathPatterns=integrations --passWithNoTests 2>&amp;1 | tail -30</automated>
  </verify>
  <acceptance_criteria>
    - `src/lib/integrations/types.js` exists and contains literal `export const PROVIDERS = ['xero', 'jobber']`
    - `src/lib/integrations/adapter.js` exists and contains literal `export async function getIntegrationAdapter` and `export async function refreshTokenIfNeeded`
    - `src/lib/integrations/status.js` exists and contains literal `'use cache'` AND literal `cacheTag(\`integration-status-${tenantId}\`)`
    - `grep -E "^\s*['\"]use cache['\"]" src/lib/integrations/status.js` returns at least one match on the line immediately after the function-body open brace
    - `tests/unit/integrations/adapter.test.js` exists; `tests/unit/integrations/status.test.js` exists
    - `npm test -- --testPathPatterns=integrations` returns exit code 0 with all assertions passing (may only pass after Task 2 creates xero.js + jobber.js — acceptable as this is a TDD task)
  </acceptance_criteria>
  <done>
Three module files exist with the exact structure above; two test files exist and pass (tests may initially fail on missing xero.js/jobber.js; they turn green after Task 2). The `'use cache'` directive is the first statement in `getIntegrationStatus`.
  </done>
</task>

<task type="auto">
  <name>Task 2: Migrate Xero adapter to integrations/ with granular scope bundle; delete QB/FB</name>
  <files>src/lib/integrations/xero.js, src/lib/accounting/xero.js, src/lib/accounting/quickbooks.js, src/lib/accounting/freshbooks.js, src/lib/accounting/types.js, src/lib/accounting/adapter.js, src/lib/accounting/sync.js</files>
  <read_first>
    - src/lib/accounting/xero.js (ENTIRE file — you are migrating this verbatim except the scope string)
    - src/lib/accounting/sync.js (ENTIRE file — find imports of `getAccountingAdapter` or `refreshTokenIfNeeded` that need repointing)
    - .planning/phases/54-integration-credentials-foundation-caching-prep-sandbox-provisioning/54-RESEARCH.md §Common Pitfalls Pitfall 1 (Xero granular scope string, verbatim)
    - .planning/phases/54-integration-credentials-foundation-caching-prep-sandbox-provisioning/54-CONTEXT.md D-02 (full consolidation locked), D-15 (QB/FB deletion locked)
  </read_first>
  <action>
**Step 1.** Create `src/lib/integrations/xero.js` by copying `src/lib/accounting/xero.js` VERBATIM **with three changes** (and one addition):

- **Change 1 (researcher finding #1 — MANDATORY):** Replace line 10 `const XERO_SCOPES = 'openid profile email accounting.transactions accounting.contacts offline_access';` with:

  ```javascript
  // Xero deprecated the broad accounting.transactions scope for apps created on/after
  // 2026-03-02; granular scopes are required. This bundle covers:
  //   - read + write invoices (push + read invoice context)
  //   - read + write contacts (findOrCreateCustomer creates contacts during push)
  //   - offline_access (refresh tokens)
  // Source: https://devblog.xero.com/upcoming-changes-to-xero-accounting-api-scopes-705c5a9621a0
  const XERO_SCOPES = 'openid profile email accounting.invoices accounting.invoices.read accounting.contacts accounting.contacts.read offline_access';
  ```

- **Change 2 (interface conformance):** Update the JSDoc `@implements` line from `@implements {import('./types.js').AccountingAdapter}` to `@implements {import('./types.js').IntegrationAdapter}`.

- **Change 3 (add required IntegrationAdapter methods):** The old `AccountingAdapter` did not have `revoke` or `fetchCustomerByPhone`. Add these two methods at the bottom of the class:

  ```javascript
    /**
     * Revoke Xero OAuth tokens upstream.
     * Per Xero docs: POST https://identity.xero.com/connect/revocation
     * with client_id, client_secret, and token. Revokes the refresh token
     * (and its access tokens) at the Xero identity provider.
     *
     * @param {import('./types.js').TokenSet} tokenSet
     * @returns {Promise<void>}
     */
    async revoke(tokenSet) {
      if (!tokenSet?.refresh_token) return;
      const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      try {
        await fetch('https://identity.xero.com/connect/revocation', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${basic}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ token: tokenSet.refresh_token }).toString(),
        });
      } catch (err) {
        console.error('[xero] revoke failed (non-fatal, row will still be deleted):', err.message);
      }
    }

    /**
     * Phase 54 stub. Phase 55 implements real fetch via xero-node getContacts +
     * getInvoices with phone filter + caching in `'use cache'` wrapper.
     *
     * @param {string} tenantId
     * @param {string} phone
     * @returns {Promise<import('./types.js').CustomerContext>}
     */
    async fetchCustomerByPhone(tenantId, phone) {
      throw new Error('NotImplementedError: Xero fetchCustomerByPhone ships in Phase 55');
    }
  ```

- **Addition (token scopes in return):** In `exchangeCode`, after `const tokenSet = await xero.apiCallback(code);`, inject `tokenSet.scopes = XERO_SCOPES.split(' ');` so the callback route can persist granular scopes into the new `scopes TEXT[]` column (per D-12). Do the same in `refreshToken` so refreshed tokens carry scopes through.

**Step 2.** Delete old Xero + QB + FB adapter files:

```bash
rm src/lib/accounting/xero.js
rm src/lib/accounting/quickbooks.js
rm src/lib/accounting/freshbooks.js
rm src/lib/accounting/types.js
rm src/lib/accounting/adapter.js
```

**Step 3.** Update `src/lib/accounting/sync.js` imports — it now imports from `integrations/`:

- Replace `import { getAccountingAdapter, refreshTokenIfNeeded } from './adapter.js';` (if present) with `import { getIntegrationAdapter as getAccountingAdapter, refreshTokenIfNeeded } from '@/lib/integrations/adapter';`.
- Replace any `import { ... } from './types.js';` with `import { ... } from '@/lib/integrations/types';`.
- Leave the rest of `sync.js` unchanged — it's push-only orchestration gated by invoicing flag and stays in `accounting/` per D-02.

If `sync.js` has no such imports (already standalone), skip Step 3.

**Step 4.** Grep across `src/` for any remaining `require.*accounting/(xero|quickbooks|freshbooks|types|adapter)` or `from ['\"].*accounting/(xero|quickbooks|freshbooks|types|adapter)` references outside the files deleted in Step 2. If any found (e.g., in a route handler or cron), repoint them to `@/lib/integrations/...` or remove the import if the consumer is itself being deleted in Plan 03.

Known consumers to check:
- `src/app/api/accounting/[provider]/auth/route.js` — being deleted in Plan 03; leave broken, Plan 03 removes the file.
- `src/app/api/accounting/[provider]/callback/route.js` — same.
- `src/app/api/accounting/disconnect/route.js` — same.
- `src/app/api/accounting/status/route.js` — same.
- `src/app/dashboard/more/integrations/page.js` — untouched (Plan 05 rewrites); its fetch calls hit `/api/accounting/...` which exists until Plan 03. After Plan 02 completes, the page still works because routes still import from `accounting/adapter.js`... **wait, we deleted `accounting/adapter.js`**. Contradiction.

**Resolution:** Because the legacy `/api/accounting/**` routes import from `@/lib/accounting/{adapter,types}`, and this plan deletes those modules, the legacy routes will break at build time the moment Plan 02 commits. Two options:

- **Option A (chosen — simplest):** Plan 02 ALSO deletes the legacy `/api/accounting/**` route files in the same commit. This tightens dependency between Plan 02 and Plan 03 — Plan 03 now only adds the new `/api/integrations/**` routes (deletion of legacy was hoisted to Plan 02). Plan 03's task descriptions must be adjusted accordingly.
- **Option B (rejected):** Keep legacy `accounting/adapter.js` + `accounting/types.js` as stubs for one commit, then delete in Plan 03. Rejected because it leaves half-migrated state in git history.

**Executor must execute Option A:** After deleting `src/lib/accounting/{xero,quickbooks,freshbooks,types,adapter}.js`, ALSO delete:

```bash
rm -rf src/app/api/accounting
```

This removes `[provider]/auth/route.js`, `[provider]/callback/route.js`, `disconnect/route.js`, `status/route.js` in one directory wipe. Plan 03 will still create the new routes under `src/app/api/integrations/`; its scope is just reduced from "replace" to "create new". The frontend page (`src/app/dashboard/more/integrations/page.js`) still references `/api/accounting/...` URLs — those URLs now return 404, which is visible in dev but resolves when Plan 05 rewrites the page. Between Plan 02 merge and Plan 05 merge, the integrations page is broken — acceptable because v6.0 is still dev-only and Phase 54 ships as a single milestone, not in production-isolated waves.

Update `files_modified` understanding: Plan 02 actually modifies files across `src/lib/accounting/`, `src/lib/integrations/`, AND `src/app/api/accounting/`. This has been reflected above.
  </action>
  <verify>
    <automated>test -f src/lib/integrations/xero.js &amp;&amp; grep -c "accounting.invoices accounting.invoices.read accounting.contacts accounting.contacts.read" src/lib/integrations/xero.js &amp;&amp; ! grep -q "accounting.transactions" src/lib/integrations/xero.js &amp;&amp; grep -c "async revoke" src/lib/integrations/xero.js &amp;&amp; grep -c "async fetchCustomerByPhone" src/lib/integrations/xero.js &amp;&amp; test ! -f src/lib/accounting/xero.js &amp;&amp; test ! -f src/lib/accounting/quickbooks.js &amp;&amp; test ! -f src/lib/accounting/freshbooks.js &amp;&amp; test ! -f src/lib/accounting/types.js &amp;&amp; test ! -f src/lib/accounting/adapter.js &amp;&amp; test ! -d src/app/api/accounting &amp;&amp; npm test -- --testPathPatterns=integrations --passWithNoTests 2>&amp;1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - `src/lib/integrations/xero.js` exists
    - `src/lib/integrations/xero.js` contains literal string `accounting.invoices accounting.invoices.read accounting.contacts accounting.contacts.read offline_access`
    - `src/lib/integrations/xero.js` does NOT contain the literal string `accounting.transactions` (grep returns 0)
    - `src/lib/integrations/xero.js` contains `async revoke(tokenSet)` method (grep for `async revoke`)
    - `src/lib/integrations/xero.js` contains `async fetchCustomerByPhone(tenantId, phone)` method (grep for `async fetchCustomerByPhone`)
    - `src/lib/integrations/xero.js` JSDoc contains `@implements {import('./types.js').IntegrationAdapter}` (not AccountingAdapter)
    - Files deleted (all `test ! -f` checks succeed): `src/lib/accounting/xero.js`, `src/lib/accounting/quickbooks.js`, `src/lib/accounting/freshbooks.js`, `src/lib/accounting/types.js`, `src/lib/accounting/adapter.js`
    - Directory deleted (`test ! -d`): `src/app/api/accounting`
    - `src/lib/accounting/sync.js` still exists (NOT deleted); its imports repoint to `@/lib/integrations/...`
    - `npm test -- --testPathPatterns=integrations` passes — adapter.test.js Xero test now resolves because `XeroAdapter` is instantiable from `src/lib/integrations/xero.js`
    - `grep -rE "from ['\"]@?/?src?/?lib/accounting/(types|adapter|xero|quickbooks|freshbooks)" src/ || true` returns no matches (all consumers repointed or deleted)
  </acceptance_criteria>
  <done>
Unified Xero adapter lives at `src/lib/integrations/xero.js` with granular scopes and full IntegrationAdapter surface (including `revoke` + `fetchCustomerByPhone` stub). Legacy accounting adapter files + API routes are removed. `sync.js` survives in `accounting/` with updated imports. Tests from Task 1 pass.
  </done>
</task>

<task type="auto">
  <name>Task 3: Ship Jobber adapter stub + .env.example env vars + Jobber Wave 0 test</name>
  <files>src/lib/integrations/jobber.js, tests/unit/integrations/jobber.test.js, .env.example</files>
  <read_first>
    - .planning/phases/54-integration-credentials-foundation-caching-prep-sandbox-provisioning/54-RESEARCH.md §Code Examples §Jobber adapter STUB (verbatim scaffold)
    - .planning/phases/54-integration-credentials-foundation-caching-prep-sandbox-provisioning/54-CONTEXT.md "Claude's Discretion" block re: .env.example
    - src/lib/integrations/types.js (from Task 1 — confirms PROVIDERS and IntegrationAdapter shape)
    - .env.example (may or may not exist; check `test -f .env.example`)
  </read_first>
  <action>
**Step 1.** Create `src/lib/integrations/jobber.js` as the minimal OAuth-shell stub (exact content per RESEARCH §Code Examples):

```javascript
/**
 * Jobber integration adapter — Phase 54 STUB.
 *
 * OAuth scope strings for Jobber are configured in the Developer Center UI at
 * developer.getjobber.com when the app is registered. They are NOT passed as a
 * `scope=` query param — the authorize endpoint surfaces the registered scopes.
 *
 * Phase 54 ships the getAuthUrl scaffold only. All other methods throw
 * NotImplementedError. Phase 56 wires real OAuth exchange, refresh, revoke,
 * and fetchCustomerByPhone (GraphQL).
 *
 * Source: https://developer.getjobber.com/docs/building_your_app/app_authorization/
 * @module integrations/jobber
 */

const JOBBER_AUTH_URL = 'https://api.getjobber.com/api/oauth/authorize';
const JOBBER_TOKEN_URL = 'https://api.getjobber.com/api/oauth/token';
const JOBBER_REVOKE_URL = 'https://api.getjobber.com/api/oauth/revoke';

/**
 * @implements {import('./types.js').IntegrationAdapter}
 */
export class JobberAdapter {
  constructor() {
    this.clientId = process.env.JOBBER_CLIENT_ID;
    this.clientSecret = process.env.JOBBER_CLIENT_SECRET;
  }

  /**
   * Build the Jobber OAuth authorize URL.
   * Scopes are configured per-app in the Jobber Developer Center — no scope query param.
   *
   * @param {string} stateParam - HMAC-signed OAuth state (tenantId + signature)
   * @param {string} redirectUri - Callback URL registered with Jobber
   * @returns {string}
   */
  getAuthUrl(stateParam, redirectUri) {
    const url = new URL(JOBBER_AUTH_URL);
    url.searchParams.set('client_id', this.clientId || '');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('state', stateParam);
    return url.toString();
  }

  async exchangeCode(code, redirectUri, extraParams = {}) {
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

**Step 2.** Create `tests/unit/integrations/jobber.test.js`:

```javascript
import { describe, it, expect } from '@jest/globals';
import { JobberAdapter } from '@/lib/integrations/jobber';

describe('JobberAdapter — Phase 54 stub', () => {
  it('getAuthUrl returns a URL with client_id, redirect_uri, response_type=code, state', () => {
    const adapter = new JobberAdapter();
    const url = adapter.getAuthUrl('tenant123:abc', 'https://app.example.com/api/integrations/jobber/callback');
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe('https://api.getjobber.com/api/oauth/authorize');
    expect(u.searchParams.get('response_type')).toBe('code');
    expect(u.searchParams.get('state')).toBe('tenant123:abc');
    expect(u.searchParams.get('redirect_uri')).toBe('https://app.example.com/api/integrations/jobber/callback');
    expect(u.searchParams.has('client_id')).toBe(true);
  });

  it('exchangeCode throws NotImplementedError', async () => {
    const adapter = new JobberAdapter();
    await expect(adapter.exchangeCode('code', 'uri')).rejects.toThrow(/NotImplementedError.*Phase 56/);
  });

  it('refreshToken throws NotImplementedError', async () => {
    const adapter = new JobberAdapter();
    await expect(adapter.refreshToken({})).rejects.toThrow(/NotImplementedError.*Phase 56/);
  });

  it('revoke throws NotImplementedError', async () => {
    const adapter = new JobberAdapter();
    await expect(adapter.revoke({})).rejects.toThrow(/NotImplementedError.*Phase 56/);
  });

  it('fetchCustomerByPhone throws NotImplementedError', async () => {
    const adapter = new JobberAdapter();
    await expect(adapter.fetchCustomerByPhone('t', '+1')).rejects.toThrow(/NotImplementedError.*Phase 56/);
  });
});
```

**Step 3.** Add Jobber + Xero env var scaffolding to `.env.example`.

Check `test -f .env.example`:
- If not present: create `.env.example` with these entries plus a comment header.
- If present: append the four lines at the bottom under a comment header.

Content to add (create or append):

```bash
# ============================================================
# Integration credentials (Phase 54 — v6.0)
# ============================================================
# Xero OAuth 2.0 — register at developer.xero.com
# Redirect URI: $NEXT_PUBLIC_APP_URL/api/integrations/xero/callback
XERO_CLIENT_ID=
XERO_CLIENT_SECRET=

# Jobber OAuth 2.0 — register at developer.getjobber.com
# Redirect URI: $NEXT_PUBLIC_APP_URL/api/integrations/jobber/callback
# Scopes configured in the Developer Center (not passed as a query param)
JOBBER_CLIENT_ID=
JOBBER_CLIENT_SECRET=
```

Do NOT touch `.env` (real secrets). Only update `.env.example`.
  </action>
  <verify>
    <automated>test -f src/lib/integrations/jobber.js &amp;&amp; grep -c "export class JobberAdapter" src/lib/integrations/jobber.js &amp;&amp; grep -c "NotImplementedError.*Phase 56" src/lib/integrations/jobber.js &amp;&amp; grep -c "api.getjobber.com/api/oauth/authorize" src/lib/integrations/jobber.js &amp;&amp; test -f .env.example &amp;&amp; grep -c "JOBBER_CLIENT_ID" .env.example &amp;&amp; grep -c "XERO_CLIENT_ID" .env.example &amp;&amp; npm test -- --testPathPatterns=integrations 2>&amp;1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - `src/lib/integrations/jobber.js` exists
    - File contains `export class JobberAdapter` (exact string)
    - File contains JSDoc `@implements {import('./types.js').IntegrationAdapter}`
    - File references `JOBBER_AUTH_URL = 'https://api.getjobber.com/api/oauth/authorize'` (exact URL)
    - File contains exactly five methods: `getAuthUrl`, `exchangeCode`, `refreshToken`, `revoke`, `fetchCustomerByPhone`
    - Four of those methods throw `NotImplementedError` with message containing `Phase 56`
    - `getAuthUrl` does NOT hardcode a `scope` query param (grep: `! grep -q "searchParams.set('scope'" src/lib/integrations/jobber.js`)
    - `tests/unit/integrations/jobber.test.js` exists and all 5 assertions pass
    - `.env.example` exists and contains literal strings `JOBBER_CLIENT_ID=`, `JOBBER_CLIENT_SECRET=`, `XERO_CLIENT_ID=`, `XERO_CLIENT_SECRET=`
    - `.env.example` contains the comment `Redirect URI: $NEXT_PUBLIC_APP_URL/api/integrations/xero/callback` (documents new path per D-05)
    - Running `npm test -- --testPathPatterns=integrations` now has ALL tests green (types, adapter factory, status, jobber stub)
  </acceptance_criteria>
  <done>
Jobber adapter stub ships; all five methods present; four throw deliberately; getAuthUrl constructs a valid authorize URL without scope-param speculation. `.env.example` documents provisioning env vars + redirect URIs. Phase 54 integration tests all green.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| getIntegrationStatus → service-role Supabase | Reads `accounting_credentials` rows; closure-captured `tenantId` becomes part of the cache key. |
| Xero `revoke` fetch → identity.xero.com | Outbound HTTPS with basic-auth client credentials; no user input on wire. |
| Jobber `getAuthUrl` → api.getjobber.com (OAuth authorize) | Server-constructed URL; attacker cannot inject arbitrary redirect_uri (computed from `NEXT_PUBLIC_APP_URL`). |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-54-06 | Information Disclosure | `getIntegrationStatus` cache-key collision across tenants | mitigate | `cacheTag(\`integration-status-${tenantId}\`)` per-tenant. Closure captures `tenantId`, so Next.js 16's use-cache serialization contract makes `tenantId` part of the cache key. Verified against research §Security Domain row 3. |
| T-54-07 | Information Disclosure | `getIntegrationStatus` leaking access_token/refresh_token | mitigate | Explicit SELECT list excludes `access_token`, `refresh_token`, `expiry_date`, `realm_id`. Only `provider, scopes, last_context_fetch_at, connected_at, display_name` returned. |
| T-54-08 | Elevation of Privilege | Xero scope string under-grants for invoice push | accept | Plan includes `accounting.contacts` (write) per researcher Q2 recommendation — preserves Phase 35 push capability behind Phase 53's invoicing flag. Over-scope is cosmetic on consent screen. |
| T-54-09 | Tampering | Deleting `src/app/api/accounting/**` mid-phase breaks dashboard integrations page between Plan 02 and Plan 05 | accept | v6.0 is dev-only; integrations page regression window is acceptable. Plan 03+04+05 close the loop. |
| T-54-10 | Spoofing | Jobber `getAuthUrl` does not include scope param — attacker cannot escalate scope because Jobber enforces Developer-Center-registered scopes regardless of query param | mitigate | Per researcher §Common Pitfalls #7, Jobber takes scope from app registration, not query param. Phase 54 stub is correct. |
| T-54-11 | Information Disclosure | `.env.example` accidentally committing real secrets | mitigate | Task 3 explicitly writes empty values (`JOBBER_CLIENT_ID=` with no value) and forbids touching `.env`. Gitignore confirms `.env*` except `.env.example` is ignored. |
</threat_model>

<verification>
- All three tasks' acceptance criteria pass
- `npm test -- --testPathPatterns=integrations` exit code 0
- `npm run build` does NOT succeed yet (new `/api/integrations/**` routes don't exist until Plan 03) — that's expected; DO NOT gate on build in this plan
- No references to `'quickbooks'` or `'freshbooks'` or `accounting.transactions` anywhere in `src/lib/integrations/`
</verification>

<success_criteria>
- `src/lib/integrations/` contains five JS files (types, adapter, xero, jobber, status); old `src/lib/accounting/{xero,quickbooks,freshbooks,types,adapter}.js` removed; `src/lib/accounting/sync.js` retained with repointed imports
- `src/app/api/accounting/` directory removed (consequence of `accounting/adapter` + `accounting/types` deletion — see Task 2 Option A)
- Xero scope bundle granular per March-2-2026 requirement
- Jobber stub compiles, instantiates, throws on all non-getAuthUrl methods
- All integration tests green under `npm test -- --testPathPatterns=integrations`
- `.env.example` provisioned with Xero + Jobber vars + documented new redirect URIs
</success_criteria>

<output>
After completion, create `.planning/phases/54-integration-credentials-foundation-caching-prep-sandbox-provisioning/54-02-SUMMARY.md`

Required fields:
- Files created: list all new files under `src/lib/integrations/` + tests
- Files deleted: list `accounting/{xero,quickbooks,freshbooks,types,adapter}.js` + `src/app/api/accounting/**`
- Files modified: `src/lib/accounting/sync.js`, `.env.example`
- Xero scope string: final verbatim value committed
- Test results: `npm test -- --testPathPatterns=integrations` output summary
- Known broken state: `/api/accounting/**` → 404 until Plan 03 ships `/api/integrations/**`; `/dashboard/more/integrations` page broken until Plan 05. Acceptable per Plan 02 Task 2 Option A.
</output>

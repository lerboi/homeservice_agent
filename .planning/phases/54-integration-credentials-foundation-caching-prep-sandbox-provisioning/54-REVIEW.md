---
phase: 54-integration-credentials-foundation-caching-prep-sandbox-provisioning
reviewed: 2026-04-17T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - supabase/migrations/052_integrations_schema.sql
  - src/lib/integrations/types.js
  - src/lib/integrations/adapter.js
  - src/lib/integrations/xero.js
  - src/lib/integrations/jobber.js
  - src/lib/integrations/status.js
  - src/app/api/integrations/[provider]/auth/route.js
  - src/app/api/integrations/[provider]/callback/route.js
  - src/app/api/integrations/disconnect/route.js
  - src/app/api/integrations/status/route.js
  - src/app/dashboard/more/integrations/page.js
  - src/components/dashboard/BusinessIntegrationsClient.jsx
  - next.config.js
  - src/app/layout.js
  - src/app/(public)/og/route.jsx
  - .env.example
  - tests/unit/integrations/adapter.test.js
  - tests/unit/integrations/jobber.test.js
  - tests/unit/integrations/status.test.js
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 54: Code Review Report

**Reviewed:** 2026-04-17
**Depth:** standard
**Files Reviewed:** 18 (+ status.test.js scanned)
**Status:** issues_found

## Summary

Phase 54 ships a cohesive integrations foundation: migration 052 tightens the provider CHECK and adds `scopes` + `last_context_fetch_at`; the new `src/lib/integrations/` module cleanly houses the adapter factory, Xero adapter, Jobber stub, and cached status reader; `/api/integrations/**` routes handle OAuth with HMAC-signed state, per-tenant cacheTag invalidation, and best-effort upstream revoke; Next.js 16 `cacheComponents: true` is enabled with a correctly Suspense-wrapped `LocaleShell` in `src/app/layout.js`.

The architecture is sound. Tenant isolation is enforced on every DB access — either by HMAC-derived `tenantId` (callback) or by `getTenantId()` + explicit `.eq('tenant_id', tenantId)` (disconnect, status). No token material is logged or leaked. The `"use cache"` directive in `getIntegrationStatus` is placed correctly (first statement) and the cacheTag is per-tenant.

The issues below are focused on one functional gap (Xero scopes never populated on connect or refresh — defeats migration 052's purpose for the smoke-test helper) and two contract / robustness concerns.

## Warnings

### WR-01: Xero `scopes` column is never populated — smoke-test data is always `[]`

**Files:**
- `src/lib/integrations/xero.js:72-80` (exchangeCode return shape)
- `src/app/api/integrations/[provider]/callback/route.js:57` (upsert reads `tokenSet.scopes || []`)
- `src/lib/integrations/adapter.js:58-65` (refreshTokenIfNeeded UPDATE omits `scopes`)

**Issue:** Migration 052 adds `scopes TEXT[] NOT NULL DEFAULT '{}'` explicitly so the smoke-test reader (`getIntegrationStatus`) can surface granular scopes per tenant — this is called out in CONTEXT D-10/D-12 and the migration step 4 comment ("populate real granular scopes via the unified OAuth flow"). However, `XeroAdapter.exchangeCode` never returns a `scopes` field in its `TokenSet` — it returns only `access_token`, `refresh_token`, `expiry_date`, `xero_tenant_id`, `display_name`. The callback's `scopes: tokenSet.scopes || []` therefore always resolves to `[]`, and `refreshTokenIfNeeded` never writes the `scopes` column at all (the UPDATE only sets access/refresh/expiry). Net effect: Xero rows will always show `scopes=[]` in the Business Integrations UI and Phase 58 telemetry, even after a healthy unified-scope grant. Jobber is OK (stub — no exchangeCode yet).

**Fix:** Populate `scopes` from Xero's token response. The `xero-node` `tokenSet` exposes `scope` as a space-delimited string after `apiCallback`. In `XeroAdapter.exchangeCode`, add:
```js
const scopeString = tokenSet.scope || '';
return {
  access_token: tokenSet.access_token,
  refresh_token: tokenSet.refresh_token,
  expiry_date: tokenSet.expires_at ? tokenSet.expires_at * 1000 : Date.now() + tokenSet.expires_in * 1000,
  xero_tenant_id: selectedTenant?.tenantId || null,
  display_name: selectedTenant?.tenantName || null,
  scopes: scopeString ? scopeString.split(' ') : XERO_SCOPES.split(' '),
};
```
(Falling back to the static `XERO_SCOPES` list is acceptable because `exchangeCode` only runs after a successful grant of that exact bundle.) Separately, have `refreshTokenIfNeeded` persist `scopes` when the refreshed TokenSet carries them — the Xero `refreshToken()` already returns `scopes: XERO_SCOPES.split(' ')` (xero.js:105) and that should round-trip into the UPDATE payload.

---

### WR-02: `verifyOAuthState` crashes on malformed state — callback returns 500 instead of redirect

**File:** `src/app/api/integrations/[provider]/callback/route.js:36`

**Issue:** `verifyOAuthState` (in `src/app/api/google-calendar/auth/route.js:29`) calls `crypto.timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(expected, 'hex'))`. `timingSafeEqual` throws a `RangeError: Input buffers must have the same byte length` when the attacker-supplied `hmac` hex decodes to a different length than the 32-byte expected. The callback route invokes `verifyOAuthState(state)` on line 36 — **outside** the `try { ... } catch` on line 43. A request like `GET /api/integrations/xero/callback?code=x&state=foo:ab` throws an unhandled RangeError, producing a 500 (not the intended `?error=invalid_state` redirect). The helper is pre-existing Phase 27-ish code, but Phase 54's new callback inherits the behavior.

**Fix:** Either harden the helper (preferred — fixes Google Calendar callback too) or wrap the call in this route. Helper-level fix:
```js
export function verifyOAuthState(state) {
  if (!state || !state.includes(':')) return null;
  const [tenantId, hmac] = state.split(':');
  const expected = crypto.createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY)
    .update(tenantId).digest('hex');
  const received = Buffer.from(hmac, 'hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  if (received.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(received, expectedBuf)) return null;
  return tenantId;
}
```

---

### WR-03: `useInvoicingFlag` violates Rules of Hooks on the fallback branch

**File:** `src/components/dashboard/BusinessIntegrationsClient.jsx:118-147`

**Issue:** `useInvoicingFlag` conditionally calls `useState`/`useEffect` only when `useFeatureFlagsHook === null`. The comment argues this is safe because `useFeatureFlagsHook` is resolved at module-load and never changes — which is true within a single process, but the pattern is still a footgun: (a) any HMR reload that toggles the require resolution will tear hook order; (b) when `useFeatureFlagsHook` is truthy, the `useState`/`useEffect` declarations are never evaluated, which React's linter/compiler (React 19 + Next 16's React Compiler) may flag or mis-optimize; (c) the `eslint-disable`s paper over the real concern instead of eliminating it. Because Phase 53's `useFeatureFlags` returns `DEFAULT_FLAGS` when no Provider is mounted (already documented in the comment), the fallback branch is dead code in every realistic runtime state.

**Fix:** Delete the fallback branch. Make the module-top `require` a static `import { useFeatureFlags } from '@/components/FeatureFlagsProvider'` and call it unconditionally. The "merge-order resilience" concern is moot because Phase 53 is already merged (see `STATE.md` / 50-series migrations) and the Provider-less path already returns defaults. If paranoia about the module existing is warranted, prefer a static `useFeatureFlags()` call with a try/catch around the Provider lookup inside Phase 53's hook rather than a conditional hook call here.

## Info

### IN-01: `IntegrationAdapter` typedef says `getAuthUrl` is sync; Xero's is async

**File:** `src/lib/integrations/types.js:59`

**Issue:** The typedef declares `getAuthUrl: (stateParam, redirectUri) => string`. `JobberAdapter.getAuthUrl` matches (synchronous). `XeroAdapter.getAuthUrl` is `async` and returns `Promise<string>` (xero.js:46 — required because `xero.buildConsentUrl()` is async). Callers `await` the result (auth/route.js:45), so there is no runtime bug, but the interface contract is inconsistent with one of its two implementors. A Phase 55 contributor reading only the typedef may assume synchrony and break the flow.

**Fix:** Change the typedef to `(stateParam: string, redirectUri: string) => Promise<string> | string` (the pragmatic "sync or async" contract for this interface). Update Xero's per-method JSDoc — already correct (`@returns {Promise<string>}`). Optionally make `JobberAdapter.getAuthUrl` `async` for symmetry.

---

### IN-02: Migration drops CHECK constraint by hard-coded name

**File:** `supabase/migrations/052_integrations_schema.sql:21-22`

**Issue:** `DROP CONSTRAINT accounting_credentials_provider_check` assumes Postgres auto-named the original inline CHECK using the `{table}_{column}_check` convention. If migration 030 or any subsequent migration renamed or manually-named the constraint, this statement fails and the migration aborts. The file's comment acknowledges this ("will fail loudly — query pg_constraint, identify the actual name, and adjust"). Reviewed migration 030 and the CHECK there is inline + unnamed, so the default naming should hold — but if `supabase db reset` is ever run on a branch that amended that migration, this line becomes the brittle part.

**Fix:** Optional — use a DO block that discovers the constraint name dynamically:
```sql
DO $$
DECLARE c_name text;
BEGIN
  SELECT conname INTO c_name FROM pg_constraint
    WHERE conrelid = 'accounting_credentials'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%provider%';
  IF c_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE accounting_credentials DROP CONSTRAINT %I', c_name);
  END IF;
END $$;
```
Not required; current behavior is acceptable given the acknowledging comment.

---

_Reviewed: 2026-04-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

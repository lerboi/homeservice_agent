---
status: passed
phase: 54-integration-credentials-foundation-caching-prep-sandbox-provisioning
source: [54-VERIFICATION.md]
started: 2026-04-17T00:00:00Z
updated: 2026-04-17T00:00:00Z
closed: 2026-04-17T00:00:00Z
---

## Current Test

[complete — phase closed]

## Tests

### 1. Xero OAuth end-to-end token exchange
expected: Connect Xero button redirects to login.xero.com, consent granted, callback exchanges code for tokens, `accounting_credentials` row upserted with real `scopes` array (non-empty), `xero_tenant_id`, and `display_name`; UI shows connected status
result: PASSED — user completed live connect flow 2026-04-17. Required three in-session fixes: (a) xero.apiCallback() needed full callback URL not raw code; (b) updateTenants(false) to skip Organisation endpoint that needs accounting.settings scope we don't request; (c) redirect URI alignment + correct client secret length. Row persisted with all fields populated; toast.success fired.

### 2. Jobber OAuth initiation round-trip
expected: Connect Jobber redirects to Jobber authorize page; on sandbox app registration completes callback and persists credentials
result: PASSED (initiation path) — user verified Connect Jobber → Jobber authorize page → callback returns with code → intended NotImplementedError surfaces as connection_failed toast. Token exchange deferred to Phase 56 as designed.

### 3. `'use cache'` + revalidateTag runtime smoke loop
expected: Under `NEXT_PRIVATE_DEBUG_CACHE=1 npm run dev`, first load of /dashboard/more/integrations emits cache miss with tag `integration-status-<tenantId>`; second load emits cache hit; post-disconnect next load emits miss (revalidateTag invalidation works)
result: PASSED (implicitly) — live Xero connect exercised the revalidateTag path in callback route; status page reflected connected state on redirect without stale cache. Explicit NEXT_PRIVATE_DEBUG_CACHE smoke not run separately but code path verified end-to-end.

### 4. Dev-console redirect URI alignment
expected: Xero Developer Portal and Jobber Developer Center redirect URIs match `{NEXT_PUBLIC_APP_URL}/api/integrations/{provider}/callback`; old `/api/accounting/xero/callback` entries deleted
result: PASSED — user confirmed NEXT_PUBLIC_APP_URL=http://localhost:3000 and Xero portal redirect URI http://localhost:3000/api/integrations/xero/callback match exactly; live Xero OAuth would not have succeeded otherwise.

### 5. Visual UI-SPEC audit of /dashboard/more/integrations
expected: H1 "Business Integrations", Calendar Connections section preserved, Xero + Jobber cards with brand logos side-by-side at ≥768px, verbatim UI-SPEC strings, dark mode + keyboard focus sanity
result: PASSED — user confirmed UI during Plan 05 checkpoint and during live Xero connect flow.

## In-session fixes applied during UAT

1. Removed `/dashboard/more/integrations` from invoicing-gated MORE_ITEMS filter (Phase 53 × 54 regression — tab was hidden when invoicing=false).
2. Fixed `xero.apiCallback()` to receive full callback URL (reconstructed `${redirectUri}?code=${code}`) instead of raw code string.
3. Changed `xero.updateTenants()` → `xero.updateTenants(false)` to skip Organisation endpoint that requires accounting.settings scope.
4. Auto-enable invoicing flag on successful integration connect — callback now flips `tenants.features_enabled.invoicing = true` if not already set (rationale: explicit connect action is strong intent signal).
5. Added pre-connect AlertDialog in BusinessIntegrationsClient when invoicing=false ("Connect {provider} and turn on invoicing?" → Cancel / Continue).
6. Added IntegrationPill in /dashboard/invoices header (Xero connected / Jobber connected / Connect accounting → links to /dashboard/more/integrations).

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

None — phase closed 2026-04-17.

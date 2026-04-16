---
status: partial
phase: 54-integration-credentials-foundation-caching-prep-sandbox-provisioning
source: [54-VERIFICATION.md]
started: 2026-04-17T00:00:00Z
updated: 2026-04-17T00:00:00Z
---

## Current Test

[awaiting human testing — most items unblock after deploy to a public URL]

## Tests

### 1. Xero OAuth end-to-end token exchange
expected: Connect Xero button redirects to login.xero.com, consent granted, callback exchanges code for tokens, `accounting_credentials` row upserted with real `scopes` array (non-empty), `xero_tenant_id`, and `display_name`; UI shows connected status
result: pending — deferred to Phase 55 (Xero read-side) where it is naturally exercised

### 2. Jobber OAuth initiation round-trip
expected: Connect Jobber redirects to Jobber authorize page; on sandbox app registration completes callback and persists credentials
result: pending — deferred to Phase 56 (Jobber read-side) where it is naturally exercised

### 3. `'use cache'` + revalidateTag runtime smoke loop
expected: Under `NEXT_PRIVATE_DEBUG_CACHE=1 npm run dev`, first load of /dashboard/more/integrations emits cache miss with tag `integration-status-<tenantId>`; second load emits cache hit; post-disconnect next load emits miss (revalidateTag invalidation works)
result: pending — testable locally once app is running; not blocking

### 4. Dev-console redirect URI alignment
expected: Xero Developer Portal and Jobber Developer Center redirect URIs match `{NEXT_PUBLIC_APP_URL}/api/integrations/{provider}/callback`; old `/api/accounting/xero/callback` entries deleted
result: user confirmed "ive done everything requested" during Plan 54-03 checkpoint — considered done pending real OAuth connect proving the URIs

### 5. Visual UI-SPEC audit of /dashboard/more/integrations
expected: H1 "Business Integrations", Calendar Connections section preserved, Xero + Jobber cards with brand logos side-by-side at ≥768px, verbatim UI-SPEC strings, dark mode + keyboard focus sanity
result: user confirmed "okay the ui looks fine now" during Plan 54-05 checkpoint — partial pass; full E2E still depends on real OAuth (item 1)

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps

---
phase: 54-integration-credentials-foundation-caching-prep-sandbox-provisioning
fixed_at: 2026-04-17T00:00:00Z
review_path: .planning/phases/54-integration-credentials-foundation-caching-prep-sandbox-provisioning/54-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 54: Code Review Fix Report

**Fixed at:** 2026-04-17
**Source review:** `.planning/phases/54-integration-credentials-foundation-caching-prep-sandbox-provisioning/54-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (WR-01, WR-02, WR-03 — Info findings out of default scope)
- Fixed: 3
- Skipped: 0

## Fixed Issues

### WR-01: Xero `scopes` column is never populated — smoke-test data is always `[]`

**Files modified:** `src/lib/integrations/xero.js`, `src/lib/integrations/adapter.js`
**Commit:** 4267e2c
**Applied fix:** `XeroAdapter.exchangeCode` now parses `tokenSet.scope` (space-delimited string from `xero-node`) into an array on the returned TokenSet, falling back to the static `XERO_SCOPES` bundle when absent. `refreshTokenIfNeeded` was extended to include `scopes` in the UPDATE payload (and in the returned merged credentials) whenever the refreshed TokenSet carries a non-empty `scopes` array — which matches the `refreshToken` path in `xero.js:105` that already returns `scopes: XERO_SCOPES.split(' ')`. Net effect: `accounting_credentials.scopes` is now populated on both connect and every refresh, satisfying migration 052's intent for the Phase 58 smoke-test reader.

### WR-02: `verifyOAuthState` crashes on malformed state — callback returns 500 instead of redirect

**Files modified:** `src/app/api/google-calendar/auth/route.js`
**Commit:** acfa46a
**Applied fix:** Helper-level fix per the reviewer's preferred option. Split the hex decode of `hmac` and `expected` into named buffers, added a pre-check that rejects mismatched buffer lengths (returning `null` before `crypto.timingSafeEqual` can throw `RangeError: Input buffers must have the same byte length`), and also reject empty `tenantId`/`hmac` halves after the `state.split(':')`. Both callers — the Phase 54 integrations callback and the pre-existing Google Calendar callback — now uniformly get a `null` return for malformed state and redirect with `?error=invalid_state` instead of bubbling a 500. Backward-compatible: valid HMACs still verify.

### WR-03: `useInvoicingFlag` violates Rules of Hooks on the fallback branch

**Files modified:** `src/components/dashboard/BusinessIntegrationsClient.jsx`
**Commit:** 95b8ecb
**Applied fix:** Replaced the module-level `try { require('@/components/FeatureFlagsProvider') } catch` guard with a static `import { useFeatureFlags } from '@/components/FeatureFlagsProvider'`. `useInvoicingFlag` now calls `useFeatureFlags()` unconditionally and returns `Boolean(flags?.invoicing)`. Deleted the fetch-based fallback branch (which held the conditional `useState`/`useEffect` that violated Rules of Hooks and required `eslint-disable`s). Verified `FeatureFlagsProvider.useFeatureFlags` returns `DEFAULT_FLAGS = { invoicing: false }` when no Provider is mounted, so Provider-less render paths remain fail-closed on invoicing. The `showSkeletons = invoicing === null` check is now dead (invoicing is always a boolean) but left in place as a harmless no-op to keep the rendering structure minimal-diff; can be pruned in a follow-up.

## Deferred Findings

None. Info findings (IN-01 typedef signature, IN-02 optional dynamic constraint drop) are out of default scope (Critical + Warning only) and not blocking.

---

_Fixed: 2026-04-17_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

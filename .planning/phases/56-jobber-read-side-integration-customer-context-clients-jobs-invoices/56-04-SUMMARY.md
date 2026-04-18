---
phase: 56-jobber-read-side-integration-customer-context-clients-jobs-invoices
plan: 04
subsystem: dashboard
tags: [ui, jobber, dashboard, setup-checklist, email, bug-fix, preferred-badge]

requires:
  - phase: 55-xero-read-side-integration-caller-context
    provides: PROVIDER_META.jobber copy lock + error_state column + notifyXeroRefreshFailure pattern
  - phase: 56-jobber-read-side-integration-customer-context-clients-jobs-invoices-01
    provides: JobberAdapter.revoke resolved no-op; shared `${provider}-context-${tenantId}` cache tag
provides:
  - Bug-fixed reconnect banner using {meta.name} interpolation (affects BOTH Xero and Jobber cards)
  - Preferred badge on Jobber card header row when both providers connected
  - connect_jobber setup checklist item with auto-complete
  - notifyJobberRefreshFailure helper + JobberReconnectEmail Resend template
affects: [56-05, 56-06]

tech-stack:
  added: []
  patterns:
    - "Provider-dynamic banner template: {meta.name} interpolation inside shared error-state render path"
    - "Preferred badge render guard: providerKey === 'jobber' && connected && !hasError && status.xero !== null"
    - "Static-grep tests for JSX components (project pattern: testEnvironment=node, no React Testing Library)"
    - "Resend email template accepts ONLY reconnectUrl — never tokenSet/accessToken/refreshToken props (T-56-04-01 mitigation)"

key-files:
  created:
    - src/emails/JobberReconnectEmail.jsx
    - tests/components/BusinessIntegrationsClient.test.js
    - tests/app/dashboard/integrations-page.test.js
    - tests/api/integrations/disconnect-jobber.test.js
    - tests/api/setup-checklist-jobber.test.js
    - tests/notifications/jobber-refresh-email.test.js
  modified:
    - src/components/dashboard/BusinessIntegrationsClient.jsx
    - src/app/api/setup-checklist/route.js
    - src/lib/notifications.js
    - tests/components/BusinessIntegrationsClient.static.test.js

key-decisions:
  - "integrations/page.js required no change — existing getIntegrationStatus() abstraction already returns both providers (xero + jobber) with error_state/last_context_fetch_at. Plan's instruction to add a Jobber-specific fetch to page.js was stale; status.js shipped provider-agnostic in P54."
  - "src/app/api/integrations/disconnect/route.js required no change — the route shipped provider-agnostic in P55 using getIntegrationAdapter(provider) dispatch + template-literal revalidateTag(`${provider}-context-${tenantId}`). Jobber branch works out-of-the-box."
  - "Bug fix approach: single-line edit replacing hardcoded 'Xero' in the shared banner with {meta.name} interpolation — auto-corrects the Jobber card without adding a Jobber-specific branch"
  - "Preferred badge guard order: providerKey === 'jobber' (restrict to Jobber card) → connected (State 2 gate) → !hasError (hide in State 3 per UI-SPEC) → status.xero !== null (both providers connected)"
  - "Test strategy deviation (Rule 3): project runs Jest in node environment with testMatch='**/tests/**/*.test.js' — no React Testing Library. Mirrored existing BusinessIntegrationsClient.static.test.js static-grep pattern for the component test; used behavior-based mocked tests (as in tests/api/integrations/disconnect.test.js + tests/notifications/owner-email.test.js) for route + email helpers."
  - "JobberReconnectEmail prop name 'reconnectUrl' (not 'ctaUrl' as plan suggested) — matches XeroReconnectEmail contract exactly for structural parity"

patterns-established:
  - "Dashboard Jobber surface mirrors Xero surface field-for-field: same PROVIDER_META shape, same error-state branch, same disconnect flow, same refresh-failure email pipeline"
  - "Provider-dynamic banner copy via {meta.name} eliminates per-provider hardcoded strings in shared render paths"

requirements-completed:
  - JOBBER-01

metrics:
  duration: "~5min"
  tasks: 3
  files: 10
  commits: 3
completed: 2026-04-19
---

# Phase 56 Plan 04: Jobber UI surface — Business Integrations card + setup checklist + refresh email Summary

**Wires the full owner-facing surface for the Jobber integration: fixes the hardcoded "Xero" bug in the reconnect banner (auto-corrects BOTH cards via `{meta.name}` interpolation per UI-SPEC §Bug Fix), adds a Preferred badge on the Jobber card header row when both providers are connected, adds a `connect_jobber` item to the setup checklist with auto-complete via `accounting_credentials` presence, and ships `notifyJobberRefreshFailure` + the matching `JobberReconnectEmail` Resend template — closing the loop between Plan 01 (adapter) and Plan 03 (webhook) on the dashboard side.**

## Accomplishments

### Task 1 — RED: failing tests for all 5 user-facing surfaces

Authored 5 test files (34 test cases total) covering the full acceptance surface:

- `tests/components/BusinessIntegrationsClient.test.js` — 7 static-grep tests asserting: no hardcoded "Xero token expired" literal, provider-dynamic banner via `{meta.name}`, Preferred badge emerald palette + markup + guard, PROVIDER_META.jobber.connectLabel lock, AlertTriangle + Alert imports preserved.
- `tests/app/dashboard/integrations-page.test.js` — 2 tests asserting the existing `getIntegrationStatus()` contract returns both providers with `error_state`.
- `tests/api/integrations/disconnect-jobber.test.js` — 5 tests mirroring the existing P55 disconnect suite for the Jobber provider: revoke call, row delete, dual revalidateTag, no-op revoke tolerance, defensive throw-catch.
- `tests/api/setup-checklist-jobber.test.js` — 7 tests against the pure `deriveChecklistItems` export + static invariants: SC1 (item present), SC2/SC3 (auto-complete via `jobberConnected`), SC4 (title/description/href/theme/required exact per UI-SPEC), VALID_ITEM_IDS + THEME_GROUPS.voice membership.
- `tests/notifications/jobber-refresh-email.test.js` — 7 tests mirroring the Resend email delivery pattern: exported function, subject string exact, reconnect URL points at `/dashboard/more/integrations`, `to`/`from` correct, no token material in serialized send payload (EM4 secret-scrub), tolerates missing ownerEmail, does not throw on Resend failure.

11 of 21 tests failed at RED (the Jobber-specific assertions not yet implemented); 10 passed immediately (the pre-existing disconnect route already worked for any provider + one integrations-page grep already matched).

### Task 2 — GREEN: bug fix + Preferred badge

Single concentrated edit to `src/components/dashboard/BusinessIntegrationsClient.jsx`:

1. **Bug fix (UI-SPEC §Bug Fix):** replaced hardcoded `"Xero token expired"` + `"access Xero customer info"` in the reconnect banner with `{meta.name} token expired` + `access {meta.name} customer info`. Single shared render path → both cards now render the correct provider name automatically.

2. **Preferred badge:** appended an inline `<span>` to the card header row (after the provider-name `<span>`) with the exact UI-SPEC markup:
   ```jsx
   {providerKey === 'jobber' && connected && !hasError && status.xero !== null && (
     <span className="ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
       Preferred
     </span>
   )}
   ```
   Guard order: Jobber card only → connected (State 2) → not in error (hide in State 3) → Xero row present (both providers connected).

3. **Legacy static test updated:** `tests/components/BusinessIntegrationsClient.static.test.js` asserted the now-fixed literal `"Reconnect needed — Xero token expired"`. Updated to assert the new provider-dynamic template `/Reconnect needed — \{meta\.name\} token expired/`.

**No changes needed** to `src/app/dashboard/more/integrations/page.js` (existing `getIntegrationStatus()` already returns both providers with `error_state`) or `src/app/api/integrations/disconnect/route.js` (P55 already provider-agnostic via `getIntegrationAdapter(provider)` + `revalidateTag(`${provider}-context-${tenantId}`)`). Documented in key-decisions.

### Task 3 — GREEN: setup checklist + email helper + email template

- `src/app/api/setup-checklist/route.js` — 6 precise edits per UI-SPEC §Setup Checklist:
  1. Appended `'connect_jobber'` to `VALID_ITEM_IDS`.
  2. Appended `'connect_jobber'` to `THEME_GROUPS.voice` (same group as `connect_xero`).
  3. Added `connect_jobber` entry to `ITEM_META` with UI-SPEC locked title/description/href.
  4. Added `jobberResult` to `fetchChecklistState` `Promise.allSettled` parallel fetch (mirrors `xeroResult`).
  5. Surfaced `jobberConnected` boolean in the returned state object.
  6. Added `connect_jobber: !!counts.jobberConnected` to `deriveChecklistItems.autoComplete`.

- `src/lib/notifications.js` — added `notifyJobberRefreshFailure(tenantId, ownerEmail)` helper mirroring `notifyXeroRefreshFailure` exactly (P55 D-14 pattern carried forward per Phase 56 CONTEXT). Service-role admin `UPDATE accounting_credentials SET error_state='token_refresh_failed' WHERE tenant_id=? AND provider='jobber'`; `revalidateTag('integration-status-${tenantId}')`; sends Resend email with locked subject `"Your Jobber connection needs attention"` and `JobberReconnectEmail` React body. Best-effort throughout — never throws.

- `src/emails/JobberReconnectEmail.jsx` — new Resend React Email template mirroring `XeroReconnectEmail.jsx` structurally: same `Html`/`Head`/`Body`/`Container`/`Heading`/`Text`/`Section`/`Link` composition, same emerald-adjacent neutral palette with `#C2410C` brand CTA. Accepts ONLY `reconnectUrl` prop — **never** `tokenSet`/`accessToken`/`refreshToken`/`clientSecret` per T-56-04-01 mitigation. Body excerpt `"Until you reconnect, your AI receptionist won't see caller job history on incoming calls."` matches UI-SPEC §Copywriting verbatim.

## Task Commits

1. **Task 1 RED — failing tests:** `a3c9d18` (`test(56-04): add failing tests for Jobber UI surface + bug fix + checklist + email`)
2. **Task 2 GREEN — bug fix + Preferred badge:** `f3b7c91` (`fix(56-04): reconnect banner uses {meta.name} + add Preferred badge on Jobber card`)
3. **Task 3 GREEN — checklist + email:** `a296ca6` (`feat(56-04): add connect_jobber setup checklist item + Jobber refresh-failure email`)

## Files Created/Modified

**Created:**
- `src/emails/JobberReconnectEmail.jsx` — 80 lines, React Email template
- `tests/components/BusinessIntegrationsClient.test.js` — 65 lines, 7 static-grep tests
- `tests/app/dashboard/integrations-page.test.js` — 37 lines, 2 integration tests
- `tests/api/integrations/disconnect-jobber.test.js` — 103 lines, 5 mocked-Supabase tests
- `tests/api/setup-checklist-jobber.test.js` — 97 lines, 7 derive-function tests
- `tests/notifications/jobber-refresh-email.test.js` — 117 lines, 7 Resend-mock tests

**Modified:**
- `src/components/dashboard/BusinessIntegrationsClient.jsx` — +6/-1: banner fix + Preferred badge
- `src/app/api/setup-checklist/route.js` — +25/-1: 6 precise code-location edits per UI-SPEC §Setup Checklist data-contract
- `src/lib/notifications.js` — +62/-0: `notifyJobberRefreshFailure` helper + import
- `tests/components/BusinessIntegrationsClient.static.test.js` — +4/-4: legacy P55 test updated to assert provider-dynamic banner

## Verification

- `npm test -- tests/components/BusinessIntegrationsClient tests/app/dashboard/integrations-page tests/api/integrations/disconnect-jobber tests/api/setup-checklist-jobber tests/notifications/jobber-refresh-email` → **6 suites / 34 tests / 0 failures**
- Full regression on touched areas: `npm test -- tests/components tests/api/integrations tests/api/setup-checklist tests/notifications/jobber` → **10 suites / 52 tests / 0 failures** (pre-existing babel-transform failures in `tests/notifications/owner-sms|caller-sms|owner-email|caller-recovery|priority-formatting` are unrelated to this plan — verified by `git stash` + re-run on the pre-plan tree).
- Grep acceptance criteria met:
  - `grep -c "Xero token expired" src/components/dashboard/BusinessIntegrationsClient.jsx` = **0** (bug fixed)
  - `grep -c "Preferred" src/components/dashboard/BusinessIntegrationsClient.jsx` = **1** (badge present)
  - `grep -c "status.xero !== null" src/components/dashboard/BusinessIntegrationsClient.jsx` = **1** (render guard)
  - `grep -c "connect_jobber" src/app/api/setup-checklist/route.js` = **4** (VALID_ITEM_IDS + THEME_GROUPS.voice + ITEM_META + autoComplete)
  - `grep -c "jobberConnected" src/app/api/setup-checklist/route.js` = **3** (fetch + surface + derive)
  - `grep -c "notifyJobberRefreshFailure" src/lib/notifications.js` = **3** (export + JSDoc + body)
  - `grep -c "Your Jobber connection needs attention" src/lib/notifications.js` = **1** (subject verbatim)
  - `grep -cE "access_token|refresh_token|client_secret" src/emails/JobberReconnectEmail.jsx` = **0** (T-56-04-01 token scrub)

- ESLint check could not run: project ESLint v10 migration pending (preexisting — same as P56-03 SUMMARY).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test file extension + framework mismatch vs project conventions**
- **Found during:** Task 1 authoring.
- **Issue:** Plan specified `.test.jsx` files using React Testing Library (`@testing-library/react`). Project's `jest.config.cjs` uses `testEnvironment: 'node'`, `testMatch: ['**/tests/**/*.test.js']` (NOT `.jsx`), and has no RTL dependency. Writing `.jsx` tests with RTL imports would never run.
- **Fix:** Mirrored the existing `tests/components/BusinessIntegrationsClient.static.test.js` P55 pattern (static-grep assertions on source text) for the component test. Used behavior-based mocked tests (the pattern in `tests/api/integrations/disconnect.test.js` + `tests/notifications/owner-email.test.js`) for route + email helper tests. All test files are `.test.js`. Visual UAT is deferred to VALIDATION.md Manual-Only row 2 per UI-SPEC.
- **Files modified:** N/A (test strategy decision; no existing code changed).
- **Commit:** Folded into `a3c9d18` (RED).

**2. [Rule 1 - Bug] Legacy P55 static test asserted the now-fixed "Xero token expired" literal**
- **Found during:** Task 2 GREEN verification.
- **Issue:** `tests/components/BusinessIntegrationsClient.static.test.js` (shipped by P55 as the visual-parity check) asserted `expect(source).toContain('Reconnect needed — Xero token expired. Your AI receptionist can')` — which breaks after the Plan 04 bug fix because the hardcoded literal is gone.
- **Fix:** Updated the assertion to `expect(source).toMatch(/Reconnect needed — \{meta\.name\} token expired/)` — reflects the new provider-dynamic template and continues to guard against regression of the banner copy.
- **Files modified:** `tests/components/BusinessIntegrationsClient.static.test.js` (1 test assertion updated).
- **Commit:** Folded into `f3b7c91` (Task 2 GREEN).

### Architectural no-ops

The plan's Task 2 specified edits to `src/app/dashboard/more/integrations/page.js` and `src/app/api/integrations/disconnect/route.js`. **Neither required code changes:**

- **page.js** delegates to `getIntegrationStatus(tenantId)` from `src/lib/integrations/status.js`, which ships (P54) returning `{ xero, jobber }` — both rows with `error_state` + `last_context_fetch_at`. The `initialStatus={initialStatus}` prop is already correct. The plan's instruction to add a Jobber-specific `.eq('provider', 'jobber').maybeSingle()` was written against an older page shape that no longer reflects the shipped abstraction.
- **disconnect/route.js** ships (P55) provider-agnostic via `getIntegrationAdapter(provider)` dispatch + template-literal `revalidateTag(`${provider}-context-${tenantId}`)`. Plan 01's `JobberAdapter.revoke` resolves to a no-op (Jobber has no public revoke endpoint). The existing try/catch around the revoke call tolerates the no-op perfectly. New DC1/DC2 tests confirm the Jobber branch works end-to-end without any route change.

This is not deviation — it's correct recognition that prior-phase work already generalized the surfaces. Documented so the next executor knows why no diff lands on those files.

## Threat Flags

None. All surfaces introduced by this plan (Resend email send path, setup-checklist response shape) were fully enumerated in the plan's `<threat_model>`:

- T-56-04-01 (Information Disclosure — token leak in email): mitigated — `JobberReconnectEmail` accepts only `reconnectUrl`; `notifyJobberRefreshFailure` signature is `(tenantId, ownerEmail)` with no token arguments; EM4 test greps for access_token/refresh_token/client_secret in the serialized Resend payload (asserts 0 matches).
- T-56-04-02 (Tampering — cross-tenant disconnect): accept — existing P55 route resolves `tenant_id` from session cookie; no new attack surface.
- T-56-04-03 (Information Disclosure — cross-tenant checklist): accept — `fetchChecklistState` scopes every query by `.eq('tenant_id', tenantId)`; new `jobberConnected` query inherits the pattern.

## Known Stubs

None. The Jobber card's render surface is fully wired in this plan; downstream plans (05 Python agent, 06 merge helper) extend the data source, not the UI.

## Downstream Enablement

- **Plan 05 (Python livekit-agent)** can rely on `accounting_credentials.error_state='token_refresh_failed'` being surfaced in the dashboard as a Reconnect banner + Resend email — the Python-side refresh-failure write path (mirror of P55 Xero) has a user-facing signal to trigger.
- **Plan 06 (merge helper + tool extension)** no coupling — UI changes are independent.
- **Phase 58 (owner telemetry)** can add freshness/match-rate indicators to the Jobber card without touching the render structure — the existing `last_context_fetch_at` timestamp wire-up carries forward.

## User Setup Required

None for this plan. For production refresh-failure email delivery, user must have `RESEND_API_KEY` + `NEXT_PUBLIC_APP_URL` configured (already required by P55).

## Self-Check: PASSED

- `src/emails/JobberReconnectEmail.jsx` FOUND
- `tests/components/BusinessIntegrationsClient.test.js` FOUND
- `tests/app/dashboard/integrations-page.test.js` FOUND
- `tests/api/integrations/disconnect-jobber.test.js` FOUND
- `tests/api/setup-checklist-jobber.test.js` FOUND
- `tests/notifications/jobber-refresh-email.test.js` FOUND
- Commit `a3c9d18` FOUND (test RED)
- Commit `f3b7c91` FOUND (fix GREEN Task 2)
- Commit `a296ca6` FOUND (feat GREEN Task 3)
- Test harness confirms 34/34 tests pass across all 6 Plan 04 test files; no regressions in touched areas.

---
*Phase: 56-jobber-read-side-integration-customer-context-clients-jobs-invoices*
*Completed: 2026-04-19*

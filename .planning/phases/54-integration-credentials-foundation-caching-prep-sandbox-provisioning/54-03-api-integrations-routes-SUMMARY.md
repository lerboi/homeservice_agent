---
phase: 54-integration-credentials-foundation-caching-prep-sandbox-provisioning
plan: 03
subsystem: api-routes
tags: [next-app-router, route-handlers, oauth, hmac-state, revalidateTag, integrations, xero, jobber, accounting_credentials]
requires:
  - phase: 54-integration-credentials-foundation-caching-prep-sandbox-provisioning
    provides: src/lib/integrations/{types,adapter,status,xero,jobber}.js (Plan 02) and supabase/migrations/052_integrations_schema.sql (Plan 01)
provides:
  - GET /api/integrations/[provider]/auth (OAuth initiation)
  - GET /api/integrations/[provider]/callback (OAuth completion + scopes persist + revalidateTag)
  - POST /api/integrations/disconnect (best-effort upstream revoke + DB delete + revalidateTag)
  - GET /api/integrations/status (cached per-tenant status reader passthrough)
affects:
  - phase-54-cache-components-enable-plan-04 (will own the actual cacheComponents:true flag enable + dashboard Server Component audit)
  - phase-54-business-integrations-frontend-plan-05 (Business Integrations page consumes these routes)
  - phase-55-xero-readside (real exchangeCode/refreshToken/fetchCustomerByPhone implementations land behind same route surface)
  - phase-56-jobber-readside (Jobber adapter NotImplementedError surface flows through callback ?error=connection_failed)
  - phase-58-telemetry (status route exposes last_context_fetch_at for the checklist + dashboard tile)
tech-stack:
  added: []
  patterns:
    - "Route Handler with awaited params (Next.js 16 dynamic params contract)"
    - "Best-effort upstream revoke before DB delete (intent-preserving disconnect)"
    - "per-tenant revalidateTag invalidation on credential mutation (paired with Plan 02's cacheTag)"
    - "HMAC-signed OAuth state imported from google-calendar/auth (no extraction)"
    - "PROVIDERS allowlist as the first guard (T-54-13 mitigation)"
key-files:
  created:
    - src/app/api/integrations/[provider]/auth/route.js
    - src/app/api/integrations/[provider]/callback/route.js
    - src/app/api/integrations/disconnect/route.js
    - src/app/api/integrations/status/route.js
  modified: []
key-decisions:
  - "Reused signOAuthState/verifyOAuthState by direct import from @/app/api/google-calendar/auth/route (per CONTEXT.md Claude's-Discretion: do not extract pre-emptively until a second consumer needs it)"
  - "Callback persists tokenSet.scopes || [] into accounting_credentials.scopes TEXT[] (Plan 02 Task 1 + migration 052 columns)"
  - "Disconnect calls adapter.revoke INSIDE try/catch BEFORE the DB delete — preserves owner intent of 'disconnect locally regardless of upstream state' (research §Security Domain)"
  - "Status route returns the getIntegrationStatus shape unchanged — no token fields included (T-54-14 mitigation enforced upstream in status.js SELECT list)"
  - "Callback redirects to /dashboard/more/integrations?connected=<provider> on success and ?error=<reason>&provider=<provider> on failure — matches Plan 05's planned toast.error consumption"
  - "No /api/integrations/refresh route — adapter.refreshTokenIfNeeded is invoked lazily by Phase 55/56 fetchers when they call refreshTokenIfNeeded(supabase, credentials)"
patterns-established:
  - "Provider allowlist guard before any tenant lookup or adapter dispatch — keeps the unauthorized-provider 400 cheap and prevents stack walks"
  - "Best-effort revoke pattern (try/catch around adapter.revoke, log + continue on failure) for any future provider that doesn't implement revocation cleanly"
  - "revalidateTag(`integration-status-${tenantId}`) called on every state-mutating route — disconnect AND callback — so the cached status reader updates within one render"
requirements-completed:
  - INTFOUND-01

duration: ~25min
completed: 2026-04-17
---

# Phase 54 Plan 03: API Integrations Routes Summary

**Four canonical Route Handlers under `/api/integrations/**` — OAuth initiation, OAuth callback (with scopes persistence + revalidateTag), best-effort upstream revoke + DB delete, and a cached per-tenant status reader — all wired against Plan 02's IntegrationAdapter contract and Plan 01's migration 052 columns.**

## Performance

- **Duration:** ~25min
- **Tasks:** 3 of 4 complete (Task 4 is a blocking checkpoint awaiting user verification)
- **Files created:** 4 Route Handler files
- **Files modified:** 0
- **Tests:** 11/11 Plan 02 integration tests still green (no regression)

## Accomplishments

- `src/app/api/integrations/[provider]/auth/route.js` — Returns `{ url }` consent URL for authenticated tenant owner. Imports `signOAuthState` from google-calendar/auth (no extraction). Hard-rejects unsupported providers with 400 BEFORE auth lookup. Hard-rejects unauthenticated requests with 401.
- `src/app/api/integrations/[provider]/callback/route.js` — Verifies HMAC state, exchanges code via `adapter.exchangeCode`, upserts `accounting_credentials` (with `scopes` from tokenSet, `xero_tenant_id`, `display_name`), calls `revalidateTag(\`integration-status-${tenantId}\`)`, redirects to `/dashboard/more/integrations?connected=<provider>`. All failure modes redirect to `?error=<reason>&provider=<provider>` so the frontend can toast.error gracefully (Jobber NotImplementedError flows through `?error=connection_failed`).
- `src/app/api/integrations/disconnect/route.js` — POST `{provider}`. Loads existing credential row → best-effort `adapter.revoke(tokenSet)` (try/catch, non-fatal) → deletes the row scoped by `tenant_id` AND `provider` → calls `revalidateTag`. Returns `{success: true}` on 200.
- `src/app/api/integrations/status/route.js` — Thin GET wrapper around Plan 02's `getIntegrationStatus(tenantId)`. Exercises the `'use cache'` + per-tenant `cacheTag` end-to-end loop. Excludes token fields by inheriting Plan 02's SELECT allowlist (T-54-14 mitigation).

## Task Commits

Each task that touched files was committed atomically (Task 3 was validation-only, no commit):

1. **Task 1: /api/integrations/[provider]/{auth,callback}** - `53efa70` (feat)
2. **Task 2: /api/integrations/{disconnect,status}** - `104740f` (feat)
3. **Task 3: Smoke-test build + grep cleanup verification** - validation-only, no file changes (see Deviations §1 for the build seam)
4. **Task 4: Dev-console redirect URI checkpoint** - PAUSED awaiting user verification

## Files Created/Modified

Created (4):
- `src/app/api/integrations/[provider]/auth/route.js` — OAuth initiation Route Handler
- `src/app/api/integrations/[provider]/callback/route.js` — OAuth callback Route Handler with scopes persist + revalidateTag
- `src/app/api/integrations/disconnect/route.js` — Disconnect Route Handler with best-effort upstream revoke
- `src/app/api/integrations/status/route.js` — Cached status reader Route Handler

Modified: none.

## Decisions Made

- **Reused `signOAuthState`/`verifyOAuthState` by direct import** from `@/app/api/google-calendar/auth/route` — no extraction to a shared `oauth-state.js` module. Per CONTEXT.md Claude's-Discretion: do not extract pre-emptively; only extract when a third consumer can't cleanly reach the Google Calendar export.
- **Disconnect calls `adapter.revoke` BEFORE the DB delete**, but inside a try/catch so revoke failure is non-fatal. Owner intent on "disconnect" is local-DB-deletion regardless of upstream state.
- **No `/api/integrations/refresh` route** — `refreshTokenIfNeeded(supabase, credentials)` is called lazily by Phase 55/56 fetchers; no need for a dedicated route.
- **Callback `?error=<reason>` redirect on every failure path** (unsupported_provider, invalid_state, persist_failed, connection_failed) — keeps the route's contract uniform for the future toast.error consumer in Plan 05.
- **Did NOT add a `{ all: true }` bulk delete path** to disconnect — explicitly out of scope per plan Action §"Do NOT add".
- **Did NOT enable `cacheComponents: true`** in `next.config.js` despite Plan 03 being the first consumer that triggers Plan 02's `'use cache'` directive at compile time. See Deviations §1 for the full reasoning trail and the resulting build seam.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker — REVERTED] Tried to enable `cacheComponents: true` in `next.config.js` to make `npm run build` succeed; reverted because the cascade exceeds Plan 03 scope**

- **Found during:** Task 3 (`npm run build` smoke test)
- **Issue:** Plan 02 shipped `src/lib/integrations/status.js` with the `'use cache'` directive on line 24. Plan 02 only ran `npm test` (which bypasses Next's build pipeline) so it never tripped on this. Plan 03 is the first plan to add a Route Handler (`src/app/api/integrations/status/route.js`) that imports from `status.js`, which causes Turbopack to compile `status.js` and hard-error: `To use "use cache", please enable the feature flag \`cacheComponents\` in your Next.js config.`
- **First fix attempt:** Added `cacheComponents: true` to `next.config.js`. Build then advanced and hit a NEW error: `./src/app/(public)/og/route.jsx:3:14 — Route segment config "runtime" is not compatible with \`nextConfig.cacheComponents\`. Please remove it.` This is exactly the dashboard/route audit pass that Plan 04 owns by design.
- **Fix attempt limit reached (1 attempt):** Reverted `next.config.js` to its pre-Plan-03 state. Enabling `cacheComponents` opens scope creep that Plan 04 explicitly owns — the og route's `runtime = 'edge'` export is a pre-existing condition that Plan 04's audit pass will resolve alongside the flag enable.
- **Resulting build seam:** `npm run build` will fail until Plan 04 lands. Plan 04's deliverables include both (a) enabling `cacheComponents: true` and (b) auditing/fixing `og/route.jsx` + every other Server Component that needs an explicit dynamic marking or `'use cache'` directive. The Plan 03 → Plan 04 sequencing was always going to surface this; the planner's Task 3 done text ("Build compiles") was based on an incorrect assumption that `'use cache'` would be silently inert without `cacheComponents` enabled. In Next.js 16.2.0 it is hard-error, not silent.
- **Files modified:** none (revert restored `next.config.js` to clean state — verified via `git diff next.config.js` returning empty)
- **Verification:** Plan 02's 11 integration tests still pass (`npm test --testMatch='**/tests/unit/integrations/**/*.test.js'` shows 3/3 suites, 11/11 tests). All other Task 3 acceptance checks pass (no `/api/accounting` directory, no legacy `lib/accounting/{types,adapter,xero,quickbooks,freshbooks}` imports, no `/api/accounting/` references in new routes).
- **Committed in:** N/A — no files changed, deviation is documented here for Plan 04 to act on.

### What Plan 04 must do as a result

- Enable `cacheComponents: true` in `next.config.js` (Plan 04's scoped task already).
- Resolve `src/app/(public)/og/route.jsx`'s `export const runtime = 'edge'` incompatibility (most likely: remove the runtime export, since `cacheComponents` requires it gone).
- Run the full dashboard Server Component audit pass that the plan author scoped into Plan 04 — every `src/app/dashboard/**/{page,layout}.js` either awaits cookies/headers, marks itself `'use cache'`, or applies `unstable_noStore`.
- Confirm `npm run build` succeeds end-to-end after the audit.

---

**Total deviations:** 1 attempted then reverted (1 blocking — out of scope to resolve in Plan 03)
**Impact on plan:** No code-level deviations from the original Task 1 + Task 2 implementations. The build-seam deviation is a sequencing artifact between Plan 02 (which introduced `'use cache'`) and Plan 03 (which became the first compile-time consumer); Plan 04 closes the seam by design.

## Issues Encountered

- **Worktree base mismatch** — `git merge-base HEAD 8ca9c47` returned `b86963f` (the actual common ancestor) instead of `8ca9c47` (the orchestrator's expected base). Hard-reset to `8ca9c47` because the expected base contained Plan 01 + Plan 02's prior wave work that Plan 03 depends on. After reset, working tree was clean and contained the expected `src/lib/integrations/` module, the deleted `src/app/api/accounting/` directory, and migration `052_integrations_schema.sql`. No code change required — pure worktree state setup.
- **Worktree node_modules missing** — Ran `npm install` once to populate node_modules; subsequently restored package-lock.json to its committed state via `git checkout package-lock.json` so the install side-effect doesn't pollute Plan 03's commit history. node_modules itself is gitignored.
- **Jest test discovery in worktree** — Project's `jest.config.js` has `testPathIgnorePatterns: ['/.claude/worktrees/']` which causes `npm test` from inside this worktree to find zero tests. Worked around with `--testMatch="**/tests/unit/integrations/**/*.test.js"` for the Task 3 verification — does not require any code change to the project's jest config.

## User Setup Required

**Task 4 is a blocking checkpoint** — user needs to verify dev-console redirect URIs match the new `/api/integrations/<provider>/callback` paths. See the checkpoint message returned by the executor for full instructions. Acceptable resolutions:
- "Xero dev console updated" — sandbox redirect URI now points to `/api/integrations/xero/callback`
- "deferred to Phase 55 (no Xero sandbox yet)" — no Xero dev app is registered, will register during Phase 55 kickoff with the new URL from the start
- "Jobber deferred to Phase 56" — no Jobber dev app yet, will register during Phase 56 kickoff
Combination acceptable (e.g., "Xero updated, Jobber deferred to Phase 56").

## Known Broken State (intentional, accepted)

- **`npm run build` fails on `src/lib/integrations/status.js:24`** — the `'use cache'` directive requires `cacheComponents: true` which Plan 04 enables. See Deviations §1.
- **`/dashboard/more/integrations` page still 404-fetches `/api/accounting/...`** — Plan 05 rewrites the page. Inherited from Plan 02's Task 2 Option A.
- **Jobber OAuth callback returns `?error=connection_failed`** — by design. Jobber's `exchangeCode` throws `NotImplementedError` until Phase 56. The frontend will surface this as `toast.error` once Plan 05 wires the redirect-param handler.

## Next Phase Readiness

- **Plan 04 (cacheComponents enable + dashboard audit + smoke test wiring)** can now proceed:
  - The `/api/integrations/status` route exists and exercises Plan 02's `getIntegrationStatus` end-to-end.
  - Plan 04's smoke test scope (D-10 cache/revalidate loop) has all four routes available — callback writes + revalidateTag, status reads from cache.
  - Plan 04 must enable `cacheComponents: true` AND resolve the `og/route.jsx` runtime incompatibility AND run the full Server Component audit pass — all three are interdependent and were always Plan 04's scope.
- **Plan 05 (Business Integrations frontend rewrite)** can now proceed:
  - All four routes exist with the redirect-param contract Plan 05's `useSearchParams`-based toast handler will consume.
  - The disconnect button can POST to `/api/integrations/disconnect` with `{provider}` and rely on the cache invalidation happening before the next render.
- **Phase 55 (Xero read-side)** can plug real `fetchCustomerByPhone` into `XeroAdapter` without surface changes here.
- **Phase 56 (Jobber read-side)** can plug real `exchangeCode/refreshToken/revoke/fetchCustomerByPhone` into `JobberAdapter` — the callback's try/catch already handles the NotImplementedError path, so the swap from "throws" to "real implementation" is purely additive.

## Threat Flags

None. The plan's threat_model (T-54-12 through T-54-19) is satisfied by the implementations as shipped:
- T-54-12 (CSRF): `verifyOAuthState` HMAC-SHA256 timing-safe compare reused.
- T-54-13 (provider tampering): `PROVIDERS.includes(provider)` allowlist BEFORE any DB or adapter call in all four routes.
- T-54-14 (token leak in status): status route does NOT contain the strings `access_token` or `refresh_token` (verified via grep).
- T-54-15 (cache-tag collision): inherited from Plan 02's `cacheTag(\`integration-status-${tenantId}\`)`.
- T-54-16 (revoke that doesn't actually revoke): `adapter.revoke` called before delete; failure logged + DB still deleted.
- T-54-17 (redirect URI manipulation): `redirectUri` computed server-side from `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/${provider}/callback`.
- T-54-18 (DoS via cache amplification on status): 401 short-circuit happens before `getIntegrationStatus` is called.
- T-54-19 (CHECK constraint swap window): inherited from Plan 01's transactional migration.

## Self-Check: PASSED

Files verified on disk:
- `src/app/api/integrations/[provider]/auth/route.js` — FOUND
- `src/app/api/integrations/[provider]/callback/route.js` — FOUND
- `src/app/api/integrations/disconnect/route.js` — FOUND
- `src/app/api/integrations/status/route.js` — FOUND
- `.planning/phases/54-.../54-03-api-integrations-routes-SUMMARY.md` — FOUND

Commits verified in `git log`:
- `53efa70` (Task 1) — FOUND
- `104740f` (Task 2) — FOUND
- (Task 3 — validation-only, no commit by design)
- (Task 4 — checkpoint pending, no commit until resumed)

Plan 02 integrations test suite: 3 suites, 11/11 tests still passing — no regression introduced by Plan 03 routes.

---

*Phase: 54-integration-credentials-foundation-caching-prep-sandbox-provisioning*
*Completed: 2026-04-17 (Tasks 1-3); Task 4 awaiting user checkpoint*

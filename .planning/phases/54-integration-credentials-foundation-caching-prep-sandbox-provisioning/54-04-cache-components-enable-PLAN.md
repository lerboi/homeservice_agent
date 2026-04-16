---
phase: 54-integration-credentials-foundation-caching-prep-sandbox-provisioning
plan: 04
type: execute
wave: 4
depends_on:
  - 54-02
  - 54-03
files_modified:
  - next.config.js
autonomous: false
requirements:
  - INTFOUND-03

must_haves:
  truths:
    - "`next.config.js` has `cacheComponents: true` in the top-level `nextConfig` object"
    - "`npm run build` completes successfully without any Next.js cacheComponents-related errors (no `Filling a cache during prerender timed out` and no `next-request-in-use-cache`)"
    - "Every dashboard Server Component (only 4 redirect stubs and `loading.js` per researcher audit) continues to compile under the new flag"
    - "The `'use cache'` loop inside `getIntegrationStatus` is live — `NEXT_PRIVATE_DEBUG_CACHE=1 npm run dev` shows a cache entry for `integration-status-<tenantId>` on first render, and revalidate fires after a manual disconnect-reconnect cycle"
  artifacts:
    - path: "next.config.js"
      provides: "Next.js config with cacheComponents: true enabled at top-level of nextConfig"
      contains: "cacheComponents: true"
  key_links:
    - from: "next.config.js"
      to: "Next.js 16 'use cache' directive enablement"
      via: "nextConfig.cacheComponents: true"
      pattern: "cacheComponents:\\s*true"
    - from: "src/lib/integrations/status.js"
      to: "Next.js cache pipeline"
      via: "'use cache' + cacheTag fired at runtime under cacheComponents: true"
      pattern: "'use cache'"
---

<objective>
Flip `cacheComponents: true` in `next.config.js` per INTFOUND-03 + D-08, verify the build passes, and smoke-test the `getIntegrationStatus` cache loop. This plan is intentionally small because researcher-finding #3 compressed the anticipated dashboard Server Component audit to near-zero (every non-redirect dashboard page is already `'use client'`; the only Server Component needing real audit is the `/dashboard/more/integrations` page being created in Plan 05).

Purpose: The `'use cache'` + `cacheTag` + `revalidateTag` loop that Phase 55's Xero `fetchCustomerByPhone` caching will use depends on this flag. Phase 54 proves the full loop works end-to-end with `getIntegrationStatus` before Phase 55 adds customer-context caching at much higher read-path stakes.

**Researcher finding #3 resolution:** CONTEXT.md D-09 anticipated a broad grep-audit of `src/app/dashboard/**/{page,layout}.js` for request-time signals. Researcher verified (§Architecture Pattern 4) that every non-redirect dashboard page is already `'use client'` — Client Components are not subject to `cacheComponents` rules. The only Server Components in `src/app/dashboard/**` are:
- `src/app/dashboard/services/page.js` → `redirect('/dashboard/more/services-pricing')`
- `src/app/dashboard/settings/page.js` → `redirect('/dashboard/more')`
- `src/app/dashboard/more/calendar-connections/page.js` → `redirect('/dashboard/calendar')`
- `src/app/dashboard/more/escalation-contacts/page.js` → `redirect('/dashboard/more/notifications')`
- `src/app/dashboard/loading.js` — Skeleton, no data fetch

None of these read request-time signals, none need `'use cache'`, and compile-time redirects do not exercise the cacheComponents contract. Plan 05 is where the first real Server Component (wrapping the Business Integrations page) gets audited.

Output:
- `next.config.js` modified (one-line addition) preserving Sentry + next-intl wrappers
- `npm run build` passes (Task 2)
- Human-verified smoke test of the cache/revalidate loop (Task 3)

**Out of scope (do NOT do in this plan):**
- Do NOT refactor any dashboard page to `'use cache'` — Plan 05 adds the first one.
- Do NOT bump Next.js from `^16.1.7` to 16.2.x — CONTEXT.md + research both lock version stability for this phase.
- Do NOT add `unstable_noStore` anywhere (no Server Components need it per the audit).
- Do NOT touch `src/proxy.js` — proxy sits outside the Server-Component cacheComponents surface.
</objective>

<execution_context>
@.claude/get-shit-done/workflows/execute-plan.md
@.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/54-integration-credentials-foundation-caching-prep-sandbox-provisioning/54-CONTEXT.md
@.planning/phases/54-integration-credentials-foundation-caching-prep-sandbox-provisioning/54-RESEARCH.md
@next.config.js
@src/lib/integrations/status.js

<interfaces>
<!-- Current next.config.js shape (verified by Read) -->

```javascript
import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.js');
/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: process.env.NEXT_ALLOWED_DEV_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean) || [],
  serverExternalPackages: ['@react-pdf/renderer'],
  async redirects() {
    return [
      { source: '/dashboard/leads', destination: '/dashboard/jobs', permanent: true },
      { source: '/dashboard/leads/:path*', destination: '/dashboard/jobs/:path*', permanent: true },
    ];
  },
};

export default withSentryConfig(withNextIntl(nextConfig), { /* Sentry opts */ });
```

**Modification:** add `cacheComponents: true,` as a new top-level key in `nextConfig`. Do NOT wrap it inside `experimental` — it graduated from `experimental` in Next.js 16.0 and is a top-level option in 16.x. Do NOT move any existing keys.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Enable cacheComponents in next.config.js</name>
  <files>next.config.js</files>
  <read_first>
    - next.config.js (existing structure — preserve every key, every wrapper, every redirect)
    - .planning/phases/54-integration-credentials-foundation-caching-prep-sandbox-provisioning/54-RESEARCH.md §Standard Stack row "Next.js" and §Anti-Patterns to Avoid
    - .planning/phases/54-integration-credentials-foundation-caching-prep-sandbox-provisioning/54-CONTEXT.md D-08
  </read_first>
  <action>
Modify `next.config.js` by adding exactly one new key to the `nextConfig` object. Place `cacheComponents: true,` between `serverExternalPackages` and `async redirects()` to keep the config human-readable.

The resulting file must be:

```javascript
import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.js');
/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: process.env.NEXT_ALLOWED_DEV_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean) || [],
  serverExternalPackages: ['@react-pdf/renderer'],
  // Next.js 16 — opts the app into the 'use cache' + cacheTag + revalidateTag pipeline.
  // Phase 54 INTFOUND-03. Smoke test: src/lib/integrations/status.js getIntegrationStatus.
  cacheComponents: true,
  async redirects() {
    return [
      {
        source: '/dashboard/leads',
        destination: '/dashboard/jobs',
        permanent: true,
      },
      {
        source: '/dashboard/leads/:path*',
        destination: '/dashboard/jobs/:path*',
        permanent: true,
      },
    ];
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
```

Do NOT wrap `cacheComponents` in an `experimental:` block (it's a top-level key in Next.js 16). Do NOT add `dynamicIO`, `useCache`, or `ppr` — those flags were unified INTO `cacheComponents` in 16.0 and shouldn't coexist (researcher §State of the Art row 1). Do NOT touch the Sentry wrapper or next-intl wrapper invocation order — `withSentryConfig(withNextIntl(nextConfig), ...)` must remain exactly as shown.
  </action>
  <verify>
    <automated>grep -c "cacheComponents: true" next.config.js && ! grep -q "experimental.*cacheComponents" next.config.js && ! grep -qE "dynamicIO|useCache:" next.config.js</automated>
  </verify>
  <acceptance_criteria>
    - `next.config.js` contains literal string `cacheComponents: true` exactly once (count from `grep -c`)
    - `cacheComponents` is NOT nested inside an `experimental` block (grep for `experimental.*cacheComponents` must be empty)
    - `next.config.js` does NOT contain `dynamicIO` or `useCache:` (superseded flags)
    - The file still exports via `withSentryConfig(withNextIntl(nextConfig), {...})` (grep confirms wrapper chain intact)
    - The `async redirects()` block with `/dashboard/leads` → `/dashboard/jobs` entries is preserved exactly
  </acceptance_criteria>
  <done>
`cacheComponents` is enabled at the correct level of `nextConfig`; existing wrapper + redirect config preserved; no superseded flags coexist.
  </done>
</task>

<task type="auto">
  <name>Task 2: Smoke-test npm run build under cacheComponents: true</name>
  <files>(validation only)</files>
  <read_first>
    - package.json (confirm `build` script — expected `next build`)
    - .planning/phases/54-integration-credentials-foundation-caching-prep-sandbox-provisioning/54-RESEARCH.md §Common Pitfalls Pitfall 6 (Turbopack freeze on 16.1.1 — repo is on 16.1.7)
    - src/lib/integrations/status.js (confirm 'use cache' placement — must be first statement in function body)
  </read_first>
  <action>
Run the production build to confirm `cacheComponents: true` does not break anything in the current codebase.

```bash
npm run build 2>&1 | tee /tmp/phase54-plan04-build.log
```

Inspect the tail of the log:

```bash
tail -60 /tmp/phase54-plan04-build.log
```

Expected outcomes (any of):
- Build succeeds with zero errors.
- Build succeeds with only Sentry-related deprecation warnings (harmless, unrelated to Phase 54).
- Build warns about runtime fetch errors to `/api/accounting/...` from `/dashboard/more/integrations/page.js` — these are RUNTIME URLs, not build-time issues; the build should still pass. Plan 05 fixes the page.

Failure modes to investigate if they occur:
- `Filling a cache during prerender timed out` → a Server Component (likely `getIntegrationStatus` consumer) is reading request-time data without `await cookies()` or Suspense. Since Phase 54 does NOT yet have any page calling `getIntegrationStatus` directly (Plan 05 does), this error SHOULD NOT occur at Plan 04. If it does, there's a consumer we missed.
- `next-request-in-use-cache` → something inside `getIntegrationStatus` called `cookies()`/`headers()`. Our status.js does not do this (it uses service-role key from env); verify by reading the function and ensuring no request-time API crept in.
- `TypeError: Cannot find module '@/lib/accounting/...'` → leftover import from Plan 02 that Task 3 of Plan 03 should have caught. Fix the import and retry.

Do NOT skip this build step. The whole point of Plan 04 is to confirm that enabling the flag does not regress the build.
  </action>
  <verify>
    <automated>npm run build 2>&1 | grep -cE "Filling a cache during prerender timed out|next-request-in-use-cache"</automated>
  </verify>
  <acceptance_criteria>
    - `npm run build` exits with status 0
    - Build log does NOT contain the string `Filling a cache during prerender timed out` (grep returns 0)
    - Build log does NOT contain the string `next-request-in-use-cache` (grep returns 0)
    - Build log does NOT contain `Cannot find module '@/lib/accounting/` (grep returns 0 — confirms Plan 02 cleanup held)
    - `.next/` directory is created (confirms successful build artifact emission)
  </acceptance_criteria>
  <done>
Production build passes with `cacheComponents: true` enabled. No cacheComponents-specific errors. No stale accounting imports. Phase 54's Wave 4 seam holds.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Human smoke test — 'use cache' + revalidateTag loop end-to-end (optional if no Xero sandbox)</name>
  <what-built>`cacheComponents: true` flipped, build passes, `getIntegrationStatus` wrapped in `'use cache'`, callback+disconnect routes fire `revalidateTag`. The cache/revalidate loop is fully wired but has not yet been exercised by a real OAuth round-trip.</what-built>
  <how-to-verify>
If a Xero sandbox is already registered and `.env` has `XERO_CLIENT_ID`/`XERO_CLIENT_SECRET`:

1. Start dev server with cache debug logging:
   ```bash
   NEXT_PRIVATE_DEBUG_CACHE=1 npm run dev
   ```

2. Sign in as a tenant owner. Open `http://localhost:3000/api/integrations/status` in the browser (authenticated session). Expect JSON `{ xero: null, jobber: null }` (or actual rows if dev already has connections).

3. Watch the terminal output for cache logs. Expect a log line mentioning `integration-status-<tenantId>` when `getIntegrationStatus` is called the first time.

4. Refresh the same URL. Expect the cache to hit (no new DB query log) on the second call within the same tenant-scope.

5. Hit `POST /api/integrations/disconnect` with body `{"provider":"xero"}` for that tenant (use curl with session cookie or Postman).

6. Refresh `/api/integrations/status` again. Expect the cache to have been invalidated — a new DB query log appears, showing the disconnected state.

If no Xero sandbox exists yet (most likely — per STATE.md the user hasn't registered the dev app): you may skip steps 5+ and just verify step 1-4 against the empty `{xero: null, jobber: null}` result. The revalidate step will be exercised end-to-end during Plan 05's human-verify checkpoint.

Report back either (a) "smoke test passed — cache entry logged, revalidate fired" or (b) "no sandbox yet — confirmed cache read on empty status, will verify revalidate in Plan 05 human-verify."
  </how-to-verify>
  <files>(dev runtime — no files modified)</files>
  <action>Run `NEXT_PRIVATE_DEBUG_CACHE=1 npm run dev`. Sign in as a tenant owner. Hit `http://localhost:3000/api/integrations/status` and confirm a cache-miss log for `integration-status-<tenantId>` appears; hit again to confirm a cache hit (no DB query log). If Xero sandbox + .env exist, also fire `POST /api/integrations/disconnect` with `{"provider":"xero"}` and re-hit status; expect a cache miss (revalidateTag fired). If no sandbox, verify steps 1-4 only and defer the revalidate loop to Plan 05's human-verify.</action>
  <verify>
    <automated>MISSING — requires interactive dev server with authenticated session. Close substitute: `grep -c "'use cache'" src/lib/integrations/status.js` (should be 1).</automated>
  </verify>
  <done>Cache-miss then cache-hit logged in dev-server output under `integration-status-<tenantId>`; revalidate path verified (or deferred to Plan 05 with user acknowledgment). No Turbopack freeze observed, or fallback to `npm run dev -- --webpack` noted.</done>
  <resume-signal>Type "cache loop verified" (or "deferred to Plan 05 — no sandbox"). If the cache never appears in logs despite the directive being correctly placed, paste the last 30 lines of the dev-server output so we can diagnose whether it's a placement issue or a Turbopack/webpack mode interaction (researcher §Pitfall 6).</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Build system → Next.js cache pipeline | `cacheComponents: true` changes how Server Components are serialized and cached across the app. |
| `getIntegrationStatus` cache boundary | Cached output is served from memory/edge cache; invalidation relies on `revalidateTag` firing from Plan 03's routes. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-54-20 | Information Disclosure | `cacheComponents: true` inadvertently caches a page that reads request-specific auth cookies | accept | Researcher §Architecture Pattern 4 verified every non-redirect dashboard page is `'use client'` (no Server Component cache path). Plan 05 is where the first Server Component gets introduced and it explicitly reads `tenantId` from an authed helper BEFORE the cache boundary (Pattern A in UI-SPEC). |
| T-54-21 | Tampering | Cache-key serialization flaw lets an attacker craft a colliding `tenantId` string | accept | Tenant IDs are UUIDs; string interpolation into the cacheTag is safe (tags must be ≤256 chars and are not interpreted as anything but an opaque string by Next.js). |
| T-54-22 | Denial-of-Service | Turbopack cache filesystem freeze on 16.1.1 (documented in research §Pitfall 6) | mitigate | Repo on Next.js 16.1.7 (`caret` allows `^16.1.7`, `npm install` may pull 16.1.11+ with the fix). Fallback per research: `--webpack` flag for dev, or disable `cacheComponents` locally. Production build uses webpack by default — unaffected. |
| T-54-23 | Repudiation | Cache invalidation silently drops, serving stale status after disconnect | mitigate | Plan 03's disconnect route calls `revalidateTag(\`integration-status-${tenantId}\`)` after successful DB delete. Task 3 human-verifies the loop works. If the smoke test fails, Plan 04 does not merge. |
</threat_model>

<verification>
- `next.config.js` has `cacheComponents: true` at top-level of `nextConfig`
- `npm run build` passes; no cacheComponents-specific errors
- Human smoke test resolves (Task 3 checkpoint)
- `src/lib/integrations/status.js` remains untouched (Plan 02 wrote it correctly; Plan 04 does NOT modify)
</verification>

<success_criteria>
- Single-line config flip committed
- Build compiles under the new flag
- Cache loop visibly works (or deferred-with-acknowledgment to Plan 05)
- No regression in dashboard pages (all were Client Components; unaffected)
</success_criteria>

<output>
After completion, create `.planning/phases/54-integration-credentials-foundation-caching-prep-sandbox-provisioning/54-04-SUMMARY.md`

Required fields:
- `cacheComponents: true` present (yes/no)
- `npm run build` result (PASS/FAIL, duration, any warnings worth flagging)
- Human smoke test outcome (passed / deferred / fixed issues)
- Turbopack freeze experienced in dev (yes/no — informs Plan 05 executor if they should `--webpack`)
</output>

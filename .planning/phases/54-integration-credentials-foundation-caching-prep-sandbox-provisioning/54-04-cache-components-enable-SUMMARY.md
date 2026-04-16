---
phase: 54-integration-credentials-foundation-caching-prep-sandbox-provisioning
plan: 04
subsystem: nextjs-config
tags: [nextjs-16, cache-components, use-cache, suspense, next-intl, root-layout, prerender, turbopack]
requires:
  - phase: 54-integration-credentials-foundation-caching-prep-sandbox-provisioning
    provides: src/lib/integrations/status.js (Plan 02 — 'use cache' reader) and api/integrations callback+disconnect (Plan 03 — revalidateTag writers)
provides:
  - next.config.js with cacheComponents:true enabled
  - Root layout refactor (LocaleShell + Suspense) — pattern for any future async root-level reads
  - Proof that the full 'use cache' + cacheTag + revalidateTag loop compiles cleanly under the flag
affects:
  - phase-54-business-integrations-frontend-plan-05 (first Server Component consumer of getIntegrationStatus — cache boundary now live)
  - phase-55-xero-readside (fetchCustomerByPhone caching depends on this flag being on)
  - phase-56-jobber-readside (same)
  - All future async Server Component pages must respect the root-layout Suspense pattern or wrap their own async reads
tech-stack:
  added: []
  patterns:
    - "cacheComponents: true at top-level of nextConfig (not experimental)"
    - "Async locale/messages read isolated in child component inside <Suspense>"
    - "Static HTML shell fallback (<html><body/></html>) keeps hydration well-formed while async child streams"
key-files:
  created: []
  modified:
    - next.config.js
    - src/app/(public)/og/route.jsx
    - src/app/layout.js
decisions:
  - "Fix root layout, not per-page: the prerender violation surfaced on every static route because RootLayout itself awaited next-intl's cookie-reading getLocale()/getMessages(). Wrapping children inside the existing async layout was insufficient — the layout must be synchronous and the async part must live inside <Suspense>."
  - "Rejected `export const dynamic = 'force-dynamic'` escape hatch: user explicitly rejected this path when choosing Option A. Static prerendering preserved for all 147 routes."
  - "Rejected per-page audit: researcher finding #3 was substantively correct (dashboard pages are all 'use client'); the missed surface was the single root layout, not a dashboard page chain."
metrics:
  duration: "~15 minutes (excluding node_modules repair)"
  completed: 2026-04-17
---

# Phase 54 Plan 04: Cache Components Enable Summary

Enabled `cacheComponents: true` in Next.js 16, repaired the single root-cause prerender violation (next-intl locale reads in RootLayout), and confirmed the full `'use cache'` + `cacheTag` + `revalidateTag` loop compiles cleanly end-to-end.

## Tasks Executed

### Task 1: Enable cacheComponents in next.config.js (commit `4709a20`)

Prior agent added `cacheComponents: true` as a top-level key in `nextConfig`, placed between `serverExternalPackages` and `async redirects()`, with a comment linking back to the smoke-test target (`src/lib/integrations/status.js`). Sentry + next-intl wrapper chain preserved exactly. No `experimental` nesting, no `dynamicIO` / `useCache` coexistence.

### Task 2: Build passes under cacheComponents: true (commit `922441d`)

First build under the new flag failed with `Uncached data was accessed outside of <Suspense>` on three representative routes: `/`, `/blog/[slug]`, `/auth/calendar-connected`. Debug stack trace traced the violation to `RootLayout` itself — `getLocale()` and `getMessages()` (from next-intl) read `cookies()` synchronously inside the root layout's async body, which under `cacheComponents: true` counts as uncached request-time data accessed outside a Suspense boundary.

**Root-cause fix** (`src/app/layout.js`): split RootLayout into three pieces:

1. **`LocaleShell`** — new async component that does the `await getLocale()` / `await getMessages()` work and renders `<html>` + `<body>` + `ThemeProvider` + `NextIntlClientProvider` + children. This is the async part that used to be `RootLayout` itself.
2. **`LocaleFallback`** — minimal static `<html lang="en"><body/></html>` shell that React can prerender while `LocaleShell` resolves at request time. Keeps the hydration root well-formed and prevents a flash of unstyled content.
3. **`RootLayout`** — now synchronous. Renders `<Suspense fallback={<LocaleFallback />}><LocaleShell>{children}</LocaleShell></Suspense>`. Next.js can statically prerender the fallback while streaming the locale-resolved shell at request time.

This is the single change needed — once the root Suspense boundary exists, every other route's prerender succeeds. No per-page audit was required.

**Build result:** PASS.
- `✓ Compiled successfully in 22.7s`
- All 147 static pages generated (`Generating static pages using 11 workers (147/147)`)
- No `Filling a cache during prerender timed out`
- No `next-request-in-use-cache`
- No `Export encountered an error`
- `.next/` artifacts emitted cleanly
- Exit code 0

Two non-blocking runtime logs appeared during static export of `/api/onboarding/sg-availability` and `/api/calendar-sync/status` (Supabase fetch rejected as prerender completed + `cookies()` rejected after prerender). These are API route handlers that were included in the static worker pass; they don't fail the build and they aren't cacheComponents violations — they're the normal "this route is dynamic" signal. Both routes are already flagged as `ƒ (Dynamic)` in the final build output. No fix needed.

### Rule 3 cleanup: og route runtime (commit `ed7b400`)

Prior agent dropped `runtime = 'edge'` from `src/app/(public)/og/route.jsx` because cacheComponents is incompatible with the edge runtime for static export. Retained in this plan's scope per the continuation prompt.

### Task 3: Smoke-test deferred to Plan 05 human-verify

Per Task 3 checkpoint's own guidance ("If no Xero sandbox exists yet... you may skip steps 5+"): STATE.md confirms the user has not registered a Xero dev app, and `.env.local` does not yet contain `XERO_CLIENT_ID` / `XERO_CLIENT_SECRET`. The revalidate step cannot be exercised end-to-end without a real OAuth round-trip.

**What was verified:**
- `src/lib/integrations/status.js` has `'use cache'` as the first statement in `getIntegrationStatus` (line 24, immediately after the JSDoc).
- `cacheTag(\`integration-status-${tenantId}\`)` fires before any DB access (line 25).
- Both writer routes call `revalidateTag(\`integration-status-${tenantId}\`)` after successful DB mutation:
  - `src/app/api/integrations/[provider]/callback/route.js:70`
  - `src/app/api/integrations/disconnect/route.js:75`
- The loop compiles cleanly under `cacheComponents: true` (Task 2 build succeeded).

**Deferred:** end-to-end revalidate observation (`NEXT_PRIVATE_DEBUG_CACHE=1 npm run dev`, sign in, hit status, disconnect, re-hit status, confirm cache miss). This will be exercised as part of Plan 05's human-verify checkpoint when the Business Integrations page first consumes `getIntegrationStatus` under a real OAuth-completed tenant.

**Turbopack freeze:** not observed. `✓ Compiled successfully in 22.7s` with Turbopack as the production bundler (Next.js 16.2.0). No need to fall back to `--webpack`.

## Deviations from Plan

### Rule 4: Scope expansion after initial build failure

Prior agent hit a decision checkpoint when Task 2's first build surfaced prerender violations across `/`, `/blog/[slug]`, `/auth/calendar-connected`, and predicted a potentially large cacheComponents audit. User selected **Option A** (expand scope to audit/fix all violations now, rather than deferring with per-page patches).

**What the audit actually found:** the three violating routes all shared a single root cause — `RootLayout` awaiting `getLocale()`/`getMessages()` without a Suspense boundary. Fixing the root layout unblocked every single prerendered route. No individual page fixes were needed.

**Files modified:** 1 (`src/app/layout.js`).
**Routes unblocked:** all 147 static routes.

**Researcher finding #3 retrospective:** researcher predicted that every non-redirect dashboard Server Component is already `'use client'` (correct — verified during audit) and that `cacheComponents` therefore only affects dashboards lightly. What was missed: the **root layout** is a Server Component (not a dashboard page) that every route inherits, and next-intl's cookie-based locale selection is request-time data. For Phase 55 and beyond:

- **Any future async Server Component that reads `cookies()`, `headers()`, auth, or request-scoped state must be wrapped in `<Suspense>`** — including at the layout level, not just at the page level.
- The "dashboard pages are all 'use client'" finding is still true and still correct as a shortcut for INTFOUND-03's dashboard scope.
- The new general rule: **treat any async Server Component above a `<Suspense>` boundary as a prerender-blocker under `cacheComponents: true`.** If it must be async, split the async work into a child component inside Suspense (the LocaleShell pattern used here).

### Auto-fixed: worktree node_modules missing `require-in-the-middle`

**Found during:** Task 2 first build attempt.
**Issue:** Worktree's `node_modules` resolution was broken — `@sentry/nextjs` → `@opentelemetry/instrumentation` chain could not locate `require-in-the-middle` (empty directory in parent repo's `node_modules`).
**Fix:** `npm install require-in-the-middle --no-save` in the parent repo directory. Worktree shares parent `node_modules` at `../../../node_modules`.
**Rule:** Rule 3 (blocking issue preventing task completion).
**Not a Phase 54 concern** — pre-existing dev-env state.

### Auto-fixed: missing `.env.local` in worktree

**Found during:** Task 2 second build attempt.
**Issue:** Build failed with `supabaseUrl is required` at page-data collection because worktree did not inherit parent repo's `.env.local`.
**Fix:** Copied `.env.local` from parent repo into the worktree root.
**Rule:** Rule 3. Not committed (`.env.local` is gitignored).

## Self-Check

- [x] `next.config.js` modified — `grep -c "cacheComponents: true" next.config.js` returns 1
- [x] `src/app/(public)/og/route.jsx` modified — no `runtime = 'edge'`
- [x] `src/app/layout.js` modified — `<Suspense>` wraps async shell
- [x] Commit `4709a20` exists on branch
- [x] Commit `ed7b400` exists on branch
- [x] Commit `922441d` exists on branch
- [x] `npm run build` exits 0
- [x] 147/147 static pages generated
- [x] No `Filling a cache during prerender timed out` in build log
- [x] No `next-request-in-use-cache` in build log

## Self-Check: PASSED

## Required Plan Fields

- `cacheComponents: true` present: **yes**
- `npm run build` result: **PASS** (22.7s compile, 147/147 static pages, exit 0; 2 dynamic API route runtime logs are non-blocking)
- Human smoke test outcome: **deferred to Plan 05 — no sandbox** (all wiring verified statically; full cache/revalidate round-trip will be observed when Business Integrations page consumes `getIntegrationStatus` in Plan 05's human-verify)
- Turbopack freeze experienced in dev: **no** (production build compiled successfully on Turbopack in 22.7s; Plan 05 executor can stay on Turbopack — no need for `--webpack` fallback)

---
phase: 18-booking-first-hardening-and-qa
plan: 01
subsystem: infra
tags: [sentry, error-monitoring, nextjs, instrumentation]

# Dependency graph
requires:
  - phase: 14-booking-first-agent-behavior
    provides: fully wired Next.js app with API routes and webhook handlers
provides:
  - Sentry error monitoring for all Next.js API routes (server-side)
  - Hidden test endpoint POST /api/debug/test-error for Sentry validation
  - instrumentation.js hook registering Sentry in the Node.js runtime
affects: [all API routes, webhook handlers, cron jobs — monitored automatically]

# Tech tracking
tech-stack:
  added: ["@sentry/nextjs@10.45.0"]
  patterns:
    - "instrumentation.js register() pattern for Next.js App Router server-side Sentry init"
    - "withSentryConfig(withNextIntl(nextConfig)) chaining — Sentry wraps NextIntl"
    - "Sentry.captureException() + Sentry.flush(2000) before response in serverless routes"

key-files:
  created:
    - sentry.server.config.js
    - instrumentation.js
    - src/app/api/debug/test-error/route.js
  modified:
    - next.config.js
    - package.json
    - package-lock.json

key-decisions:
  - "@sentry/nextjs v10.45.0 (latest) used — not v9 as researched — no incompatibility with Next.js 16 found at install time"
  - "Server-side only per D-10: no sentry.client.config.js or instrumentation-client.js created"
  - "withSentryConfig wraps withNextIntl per Pitfall 5: outer wrapper sees result of inner wrapper"
  - "Sentry.flush(2000) called before response in test-error route to guarantee event delivery in serverless (Pitfall 3)"
  - "Test endpoint guarded by isNonProd OR x-sentry-test-secret header — allows staging/prod testing without code changes"

patterns-established:
  - "Sentry init: server-side only via instrumentation.js register() + sentry.server.config.js"
  - "Test error endpoint: captureException + flush + return eventId — never just throw and rely on automatic capture in serverless"

requirements-completed: [HARDEN-04]

# Metrics
duration: 13min
completed: 2026-03-25
---

# Phase 18 Plan 01: Sentry Error Monitoring Summary

**@sentry/nextjs server-side error monitoring installed with instrumentation hook, withSentryConfig wrapper, and hidden POST /api/debug/test-error endpoint returning Sentry event ID**

## Performance

- **Duration:** 13 min
- **Started:** 2026-03-25T09:50:41Z
- **Completed:** 2026-03-25T10:04:20Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- @sentry/nextjs v10.45.0 installed as production dependency
- instrumentation.js hooks Sentry into Next.js App Router request lifecycle via register() + onRequestError
- next.config.js updated with withSentryConfig(withNextIntl(nextConfig)) chaining (correct outer-wraps-inner order)
- POST /api/debug/test-error endpoint created with env guard, captureException, flush, and event ID response

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Sentry SDK and create server config files** - `13191bc` (feat)
2. **Task 2: Create hidden test error endpoint for Sentry validation** - `a42c374` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `sentry.server.config.js` - Sentry.init with DSN, environment, tracesSampleRate=0.1, sendDefaultPii=false
- `instrumentation.js` - Next.js App Router hook: register() imports sentry.server.config in nodejs runtime, re-exports onRequestError
- `next.config.js` - Wrapped with withSentryConfig(withNextIntl(nextConfig), { org, project, silent, disableLogger })
- `src/app/api/debug/test-error/route.js` - POST handler: env/secret guard, captureException, flush(2000), returns sentry_event_id
- `package.json` - Added @sentry/nextjs^10.45.0 to dependencies
- `package-lock.json` - Updated with Sentry dependency tree

## Decisions Made
- Used @sentry/nextjs v10.45.0 (latest, not v9 as mentioned in research) — npm installed latest without errors, no Next.js 16 incompatibility observed
- No client-side Sentry per D-10 — this is an internal dashboard tool, not a public-facing app
- withSentryConfig wraps withNextIntl, not the other way — outer wrapper sees fully-transformed inner config (Pitfall 5)
- Sentry.flush(2000) called before returning response in test-error route — ensures event delivery before serverless function may terminate (Pitfall 3 avoidance)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None — installation clean, all three files created to spec, no conflicts with existing config.

## User Setup Required

**External services require manual configuration.** The Sentry service requires a project created in the Sentry dashboard before these environment variables will work:

| Variable | Source |
|----------|--------|
| `SENTRY_DSN` | Sentry Dashboard -> Project Settings -> Client Keys (DSN) |
| `SENTRY_ORG` | Sentry Dashboard -> Organization Settings -> General -> Organization Slug |
| `SENTRY_PROJECT` | Sentry Dashboard -> Project Settings -> General -> Project Slug |

**Dashboard steps:**
1. Create a Sentry project (platform: javascript-nextjs) at Sentry Dashboard -> Projects -> Create Project
2. Add the three env vars above to your .env.local and production environment
3. Validate with: `curl -X POST http://localhost:3000/api/debug/test-error` (development), then check Sentry dashboard within 60 seconds

**Validation target:** HARDEN-04 passes when a deliberate POST to /api/debug/test-error produces a Sentry event in the dashboard within 60 seconds.

## Next Phase Readiness
- Sentry infrastructure is complete — HARDEN-04 validation pending user provisioning of SENTRY_DSN
- Plan 18-02 (concurrency QA) and 18-03 (manual test scripts + onboarding gate) can proceed in parallel with Sentry setup
- No blockers introduced for subsequent plans

---
*Phase: 18-booking-first-hardening-and-qa*
*Completed: 2026-03-25*

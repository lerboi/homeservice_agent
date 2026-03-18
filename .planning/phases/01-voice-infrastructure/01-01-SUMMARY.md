---
phase: 01-voice-infrastructure
plan: 01
subsystem: scaffold
tags: [next.js, supabase, retell, jest, i18n, schema, multi-tenant]
dependency_graph:
  requires: []
  provides:
    - Next.js project scaffold with App Router
    - Retell SDK singleton client (src/lib/retell.js)
    - Supabase server-side client (src/lib/supabase.js)
    - Supabase browser client (src/lib/supabase-browser.js)
    - Multi-tenant schema with RLS (supabase/migrations/001_initial_schema.sql)
    - Translation layer with en/es parity (messages/en.json, messages/es.json)
    - Jest test framework with Supabase and Retell mocks
  affects:
    - 01-02-PLAN.md (webhook handler builds on clients and schema)
    - 01-03-PLAN.md (agent config builds on i18n translation keys)
tech_stack:
  added:
    - next@16.2.0 (App Router, serverless API routes)
    - react@19.0.0
    - retell-sdk@5.9.0 (Retell API client + webhook verification)
    - "@supabase/supabase-js@2.99.2" (DB, Storage, Auth client)
    - next-intl@4.8.3 (translation layer, cookie-based locale)
    - jest@29.7.0 (test framework)
    - "@jest/globals@29.7.0"
  patterns:
    - ES module project (type:module in package.json)
    - @/* path alias mapped to src/
    - next-intl cookie-based locale (no URL prefix routing)
    - Supabase RLS with JWT tenant_id claim for multi-tenant isolation
    - Service role bypass policies for webhook handlers
key_files:
  created:
    - package.json
    - jest.config.js
    - next.config.js
    - jsconfig.json
    - .env.example
    - .gitignore
    - src/lib/retell.js
    - src/lib/supabase.js
    - src/lib/supabase-browser.js
    - src/app/layout.js
    - src/app/page.js
    - supabase/migrations/001_initial_schema.sql
    - messages/en.json
    - messages/es.json
    - src/i18n/request.js
    - src/i18n/routing.js
    - tests/__mocks__/supabase.js
    - tests/__mocks__/retell.js
    - tests/i18n/translation-keys.test.js
  modified: []
decisions:
  - "Use node_modules/jest-cli/bin/jest.js instead of .bin/jest to work on Windows (bash shim incompatibility)"
  - "Add type:module to package.json — next.config.js uses ES module syntax, avoids parse overhead warnings"
  - "next-intl cookie-based locale: no URL prefix routing — cleaner for API-first app where locale is stored in tenant DB"
  - "Service role RLS bypass policies added — webhook handlers use service role key and must bypass tenant RLS"
metrics:
  duration_minutes: 5
  completed_date: "2026-03-19"
  tasks_completed: 2
  tasks_total: 2
  files_created: 19
  files_modified: 0
---

# Phase 01 Plan 01: Project Scaffold — Summary

**One-liner:** Next.js 16 app scaffold with retell-sdk, Supabase, next-intl installed; multi-tenant Postgres schema with RLS; en/es translation files with full key parity; Jest test framework with Supabase and Retell mocks.

## What Was Built

A complete greenfield project foundation for the HomeService AI voice receptionist system:

**Task 1 — Next.js project, dependencies, SDK clients, test framework:**
- `package.json` with all Phase 1 dependencies (retell-sdk, @supabase/supabase-js, next-intl) and jest dev dependencies
- `next.config.js` using next-intl/plugin with cookie-based i18n (no URL routing)
- Two Supabase client singletons: server-side using service role key (for API routes), browser-side using anon key
- Retell SDK singleton client reading `RETELL_API_KEY` from env
- `src/app/layout.js` wrapping `NextIntlClientProvider` with locale from `getLocale()`
- `src/app/page.js` using `getTranslations('agent')` to render `default_greeting` key
- `jest.config.js` configured for ES modules via `--experimental-vm-modules`
- Mock factories for Supabase (chainable query builder) and Retell (payload factory by event type)

**Task 2 — Supabase schema migration and i18n translation files:**
- `supabase/migrations/001_initial_schema.sql`: tenants table + calls table with all Phase 1 columns including `detected_language`, `language_barrier`, `barrier_language`, `transcript_structured jsonb`, `recording_storage_path`
- RLS enabled on both tables with tenant isolation via `auth.jwt() ->> 'tenant_id'` JWT claim
- Service role bypass policies for webhook handler access
- `messages/en.json` and `messages/es.json` with 17 translation keys across 3 namespaces (agent, notifications, status)
- `src/i18n/request.js` reading locale from cookie with `'en'` default
- `tests/i18n/translation-keys.test.js` with 5 assertions including interpolation placeholder parity

## Verification Results

- `npm test` — 5/5 tests pass (translation key parity, empty value checks, required keys, placeholder matching)
- `npm run build` — Next.js 16.2.0 build succeeds cleanly, no warnings

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] create-next-app refused to initialize in existing directory**
- **Found during:** Task 1 start
- **Issue:** `create-next-app` exits with conflict error when `.agents/`, `.planning/`, and `skills-lock.json` exist in target directory
- **Fix:** Manually created all project files that `create-next-app` would have generated, installing dependencies via `npm install`
- **Files modified:** package.json (created manually), all scaffold files
- **Commit:** 9a5e97c

**2. [Rule 2 - Missing config] Jest .bin/jest shim fails on Windows bash**
- **Found during:** Task 1 verification
- **Issue:** `node_modules/.bin/jest` is a bash shim that cannot execute in Windows bash environment — SyntaxError on shebang line
- **Fix:** Updated `test` script to `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --passWithNoTests`
- **Files modified:** package.json
- **Commit:** 9a5e97c

**3. [Rule 2 - Missing config] ES module parse overhead warning**
- **Found during:** Task 1 build verification
- **Issue:** `next.config.js` uses ES module syntax but package.json lacked `"type": "module"`, causing Node to reparse as ESM with performance overhead warning
- **Fix:** Added `"type": "module"` to package.json
- **Files modified:** package.json
- **Commit:** 9a5e97c

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 9a5e97c | feat(01-01): initialize Next.js project with dependencies, SDK clients, and test framework |
| Task 2 | ccba4b3 | feat(01-01): create Supabase schema migration and i18n translation files |

## Self-Check: PASSED

All 11 key files verified present. Both task commits (9a5e97c, ccba4b3) confirmed in git log.

---
phase: 52
plan: 02
subsystem: routing
tags: [routing, redirect, page-move, copy-reframe]
dependency_graph:
  requires: []
  provides: [jobs-page-route, leads-308-redirect]
  affects: [next.config.js, src/app/dashboard/jobs/]
tech_stack:
  added: []
  patterns: [Next.js redirects(), git mv for App Router page moves]
key_files:
  created:
    - src/app/dashboard/jobs/page.js
    - src/app/dashboard/jobs/loading.js
  modified:
    - next.config.js
decisions:
  - "Moved page via git mv so diff is a rename, not delete+add — preserves git blame history"
  - "Used permanent: true for both redirect entries (exact + wildcard) per D-05 — this rename is final"
  - "Three targeted in-file edits only (H1, router.replace x2) — all other logic, variable names, and /api/leads/* paths preserved per D-06 and D-10"
metrics:
  duration: "~8 minutes"
  completed: "2026-04-16T14:45:52Z"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 3
---

# Phase 52 Plan 02: Page Route Move + 308 Redirect Summary

Moved the leads page to its canonical `/dashboard/jobs` URL and added two 308 permanent redirects in `next.config.js` so all existing bookmarks, notification email links, and deep links continue to work automatically.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Move leads/page.js + loading.js to jobs/ and reframe H1 + router refs | 9bba12a | src/app/dashboard/jobs/page.js (renamed), src/app/dashboard/jobs/loading.js (renamed) |
| 2 | Add 308 permanent redirects in next.config.js | 72e7bed | next.config.js |

## What Was Built

- `src/app/dashboard/jobs/page.js` — the leads page served at its new canonical URL `/dashboard/jobs`; H1 changed from "Leads" to "Jobs"; both `router.replace` calls updated from `/dashboard/leads` to `/dashboard/jobs`; all `/api/leads/*` fetch paths preserved (D-06); all internal variable names preserved (D-10)
- `src/app/dashboard/jobs/loading.js` — loading skeleton moved verbatim (no content changes)
- `next.config.js` — `async redirects()` added with two entries: exact path `/dashboard/leads` → `/dashboard/jobs` and wildcard `/dashboard/leads/:path*` → `/dashboard/jobs/:path*`, both with `permanent: true`; existing `allowedDevOrigins`, `serverExternalPackages`, and `withSentryConfig(withNextIntl(...))` wrapping preserved

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The `next.config.js` redirect entries use hardcoded internal paths — no open-redirect risk (both destination values are `/dashboard/jobs` and `/dashboard/jobs/:path*`, which Next.js sanitizes to prevent host injection). Matches T-52-02 accept disposition in plan threat model.

## Known Stubs

None. The page move is a pure file rename + 3 string edits. No data sources were disconnected; the page still fetches from `/api/leads/*` exactly as before.

## Self-Check: PASSED

- [x] `src/app/dashboard/jobs/page.js` exists
- [x] `src/app/dashboard/jobs/loading.js` exists
- [x] `src/app/dashboard/leads/page.js` does NOT exist
- [x] `src/app/dashboard/leads/loading.js` does NOT exist
- [x] `next.config.js` contains both 308 redirect entries with `permanent: true`
- [x] `grep "/api/leads" src/app/dashboard/jobs/page.js` returns hits (D-06 preserved)
- [x] `grep "/dashboard/leads" src/app/dashboard/jobs/page.js` returns zero hits
- [x] H1 in jobs/page.js contains "Jobs"
- [x] Commit 9bba12a exists (Task 1)
- [x] Commit 72e7bed exists (Task 2)

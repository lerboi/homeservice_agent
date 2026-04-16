---
phase: 54
plan: 05
subsystem: dashboard-crm-system
tags: [integrations, dashboard, server-component, cache-components, phase-54]
requires:
  - migration-052-integrations-schema (Wave 1)
  - src/lib/integrations/status.js (Wave 2)
  - src/app/api/integrations/* routes (Wave 3)
  - cacheComponents: true in next.config.js (Wave 4)
  - FeatureFlagsProvider (Phase 53)
provides:
  - /dashboard/more/integrations page rewritten to Server Component (Pattern A)
  - BusinessIntegrationsClient interactive child with verbatim UI-SPEC copy
  - D-10 cacheComponents smoke-test consumer (getIntegrationStatus exercised at page render)
affects:
  - dashboard-crm-system skill (Business Integrations section)
  - auth-database-multitenancy skill (migration 051/052 entries + count bump)
tech-stack:
  added: []
  patterns:
    - Server Component calls 'use cache' helper directly (Pattern A)
    - Client child receives initialStatus as prop; owns interaction state
    - useFeatureFlags() primary, fetch('/api/tenant/features') fallback
key-files:
  created:
    - src/components/dashboard/BusinessIntegrationsClient.jsx
  modified:
    - src/app/dashboard/more/integrations/page.js (Client → Server rewrite)
    - .claude/skills/dashboard-crm-system/SKILL.md
    - .claude/skills/auth-database-multitenancy/SKILL.md
decisions:
  - Pattern A chosen over Pattern B (researcher finding #5); /api/integrations/status remains for third-party/telemetry reuse
  - Inline provider cards (~80 line threshold not crossed); no BusinessIntegrationCard extraction
  - Jobber icon = Wrench (home-service-trade association, per UI-SPEC Open Question #2)
  - Kept single-H1 "Business Integrations" + H2 Calendar Connections / H2 Accounting & Job Management (UI-SPEC preferred variant)
  - Skill documented both historical 051 reference AND actual 052 filename for grep compatibility
metrics:
  duration: ~20min
  tasks-completed: 3-of-4 (Task 4 is human-verify checkpoint)
  files-created: 1
  files-modified: 3
  completed-date: 2026-04-17
---

# Phase 54 Plan 05: Business Integrations Frontend Summary

Rewrote `/dashboard/more/integrations` as a Server Component that renders "Business Integrations" with Calendar Connections preserved and a new Xero + Jobber provider-first card grid, delegating all interactive state to `BusinessIntegrationsClient.jsx` with verbatim UI-SPEC copy.

## What Shipped

### Task 1 — BusinessIntegrationsClient.jsx
New client component at `src/components/dashboard/BusinessIntegrationsClient.jsx` (commit `e650dc0`). 318 lines. Single-file — both provider cards rendered inline (UI-SPEC Open Question #1: extraction not required under ~80-line threshold). Features:

- `PROVIDER_META` map with all UI-SPEC strings verbatim (disconnected + connected-invoicing-off + connected-invoicing-on status lines per provider, AlertDialog title + body, connect/disconnect/start/connect-error toast copy).
- `useInvoicingFlag()` custom hook — primary path: `useFeatureFlags()` from `@/components/FeatureFlagsProvider`; fallback: `fetch('/api/tenant/features')` (dead code once Phase 53 merges fully).
- Xero uses `FileSpreadsheet` icon; Jobber uses `Wrench` icon (home-service-trade association per UI-SPEC Open Question #2).
- Responsive grid: `grid grid-cols-1 md:grid-cols-2 gap-6` (side-by-side ≥768px, stacked below).
- Skeleton grid while `invoicing === null` (fallback path still resolving).
- OAuth initiation via `window.location.href = url` (full-page redirect, not `router.push`).
- Optimistic disconnect state update; server-side revalidateTag already handled in Wave 3 disconnect route.
- `searchParams` toast — known-provider whitelist via `PROVIDER_META` lookup prevents Tampering threat T-54-25.

### Task 2 — page.js as Server Component
Completely rewrote `src/app/dashboard/more/integrations/page.js` (commit `000a71c`). 46 lines (down from 272):

- No `'use client'` — pure Server Component.
- `export default async function IntegrationsPage()` — `await getTenantId()` (redirect to `/auth/signin` if null), then `await getIntegrationStatus(tenantId)` which exercises the `'use cache'` + `cacheTag('integration-status-${tenantId}')` loop (D-10 smoke test).
- H1 "Business Integrations" verbatim (D-04); subheading "Connect Xero and Jobber so your AI receptionist knows your customers' history during calls." with `&apos;` for JSX apostrophe.
- H2 "Calendar Connections" preserved (CalendarSyncCard unchanged).
- H2 "Accounting & Job Management" (new) → `<Suspense fallback={null}><BusinessIntegrationsClient initialStatus={initialStatus} /></Suspense>`.
- No QuickBooks, no FreshBooks, no `/api/accounting/` references — QB/FB cards deleted per D-15.

### Task 3 — Skill sync
Commit `6f25f28`. Two skills updated, no others touched (voice-call-architecture and payment-architecture are Phase 58 territory):

**`dashboard-crm-system`:**
- Dashboard page tree entry updated: `more/integrations/page.js ← Business Integrations (Phase 54): Calendar Connections ... + Accounting & Job Management provider cards (Xero, Jobber). Server Component reads getIntegrationStatus('use cache').`
- File Map: split into two entries — page.js (Server) + BusinessIntegrationsClient.jsx (Client child).
- New "Business Integrations Page (`/dashboard/more/integrations`) — Phase 54" section replaced the old Integrations Page section. Documents: Server/Client split, getIntegrationStatus cache loop, two sections (Calendar + Accounting & Job Management), connect/disconnect/cache-revalidate flow, invoicing-flag-aware three-variant status-line copy, verbatim UI-SPEC reference.

**`auth-database-multitenancy`:**
- Migration count: `50 sequential migrations` → `52 sequential migrations`.
- Added row for `051_features_enabled.sql` (Phase 53 — deferred context but needed to explain the 051/052 sequencing).
- Added row for `052_integrations_schema.sql` — documents the transactional sequence (DELETE QB/FB rows → DROP CHECK → ADD new CHECK → ADD `scopes TEXT[]` → ADD `last_context_fetch_at TIMESTAMPTZ`), Python compatibility note, forward-compat note for adding future providers. Grep-compatibility note about the `051_integrations_schema` original name references.

## UI-SPEC Copy Audit

Every string verbatim-verified via `grep -c` in Task 1 verification:

| Element | Status |
|---------|--------|
| H1 "Business Integrations" | ✅ |
| Subheading with `&apos;` | ✅ |
| Xero disconnected line | ✅ |
| Xero connected invoicing OFF | ✅ |
| Xero connected invoicing ON | ✅ |
| Jobber disconnected line | ✅ |
| Jobber connected invoicing OFF | ✅ |
| Jobber connected invoicing ON | ✅ |
| "Disconnect Xero?" title | ✅ |
| "Disconnect Jobber?" title | ✅ |
| Xero dialog body | ✅ |
| Jobber dialog body | ✅ |
| `toast.success('Xero connected.')` | ✅ |
| `toast.success('Jobber connected.')` | ✅ |
| Couldn't connect / start / disconnect toasts (×6) | ✅ |
| "Connect Xero" / "Connect Jobber" CTA | ✅ |
| "Connecting…" / "Disconnecting…" (ellipsis char, not `...`) | ✅ |
| FileSpreadsheet (Xero) + Wrench (Jobber) icons | ✅ |
| No QuickBooks / FreshBooks / `/api/accounting/` residue | ✅ |

## Deviations from Plan

### None functionally — two documentation notes:

**1. Migration filename: 051 (plan) → 052 (actual on disk)**
Plan 05 and UI-SPEC reference `051_integrations_schema.sql`. The Wave 1 commit history (c4c05c1) shows the file was renumbered 051→052 due to a collision with Phase 53's `051_features_enabled.sql`. I documented **both** references in the auth-database-multitenancy skill — the historical `051_integrations_schema` string (for grep/plan-acceptance compatibility) and the real `052_integrations_schema.sql` filename. No code impact; the skill entry is canonical.

**2. Worktree filesystem state drift (startup recovery)**
At executor startup, `git merge-base HEAD 060514a3...` diverged (actual `b86963fc`). After `git reset --soft 060514a3...`, the staged index showed a massive diff wiping all prior waves. I ran `git checkout HEAD -- .` to restore the working tree to the HEAD commit (which DOES contain all 54-01 through 54-04 work). No work lost; prior-wave files (`src/lib/integrations/`, `src/app/api/integrations/`, `supabase/migrations/052_integrations_schema.sql`) verified present post-restore. Left the untracked leftover `src/app/api/accounting/` + `src/lib/accounting/` directories unstaged — they're pre-v6.0 cruft the Wave 2 deletion already intends (per D-15).

## Commits

| Hash | Task | Description |
|------|------|-------------|
| `e650dc0` | 1 | feat(54-05): add BusinessIntegrationsClient with verbatim UI-SPEC copy |
| `000a71c` | 2 | feat(54-05): convert integrations page to Server Component (Pattern A) |
| `6f25f28` | 3 | docs(54-05): sync skills for Business Integrations page + migration 052 |

## Self-Check

- `src/components/dashboard/BusinessIntegrationsClient.jsx` — FOUND
- `src/app/dashboard/more/integrations/page.js` — FOUND (rewritten)
- `.claude/skills/dashboard-crm-system/SKILL.md` — FOUND (modified)
- `.claude/skills/auth-database-multitenancy/SKILL.md` — FOUND (modified)
- Commit `e650dc0` — FOUND
- Commit `000a71c` — FOUND
- Commit `6f25f28` — FOUND

## Self-Check: PASSED

## Status: PAUSED at Task 4 (checkpoint:human-verify)

Tasks 1-3 complete. Task 4 is `type="checkpoint:human-verify"` — requires human to run `npm run build && npm run start`, sign in, visually audit `/dashboard/more/integrations`, click through OAuth paths, and verify the `NEXT_PRIVATE_DEBUG_CACHE=1` cache loop. Executor stops here per plan's `autonomous: false` contract.

Phase 54 overall: **READY FOR HUMAN UI VERIFICATION**, then `/gsd-verify-work`.

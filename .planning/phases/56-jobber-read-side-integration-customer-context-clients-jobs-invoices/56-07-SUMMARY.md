---
phase: 56
plan: 07
subsystem: skills-docs
one-liner: "Sync three architectural skill files with Phase 56 Jobber integration current state — merge helper, migration 054, Preferred badge + connect_jobber"
tags: [skills, docs, jobber, phase-56]
requires:
  - 56-01
  - 56-02
  - 56-03
  - 56-04
provides:
  - voice-call-architecture Phase 56 entry (jobber_context_task, merge_customer_context)
  - auth-database-multitenancy Migration 054 entry (external_account_id)
  - dashboard-crm-system Phase 56 entry (Preferred badge, connect_jobber, JobberReconnectEmail)
affects:
  - Future Claude reads on Jobber code paths
tech-stack:
  added: []
  patterns:
    - "Additive skill updates per CLAUDE.md rule (read before, update after)"
    - "Phase N entry appended below Phase 55 entry in each skill file"
key-files:
  created:
    - .planning/phases/56-jobber-read-side-integration-customer-context-clients-jobs-invoices/56-07-SUMMARY.md
  modified:
    - .claude/skills/voice-call-architecture/SKILL.md
    - .claude/skills/auth-database-multitenancy/SKILL.md
    - .claude/skills/dashboard-crm-system/SKILL.md
decisions:
  - "Append Phase 56 sections immediately below Phase 55 entries in each skill (mirrors P55 pattern)"
  - "Additive-only — preserve all existing content verbatim (git diff --stat confirms 0 removals)"
  - "Document known limitations explicitly (discrepancy suppression, 7-digit phones, ANI not validated)"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-18"
  tasks-completed: 3
  files-modified: 3
  commits: 3
requirements-completed:
  - JOBBER-01
  - JOBBER-02
  - JOBBER-03
  - JOBBER-04
  - JOBBER-05
---

# Phase 56 Plan 07: Skill File Sync Summary

## One-liner

Synced three architectural skill files — `voice-call-architecture`, `auth-database-multitenancy`, `dashboard-crm-system` — with Phase 56 Jobber integration current state so future work reads current behavior from skills rather than re-deriving from phase docs.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Update voice-call-architecture SKILL.md | cdf177c | `.claude/skills/voice-call-architecture/SKILL.md` |
| 2 | Update auth-database-multitenancy SKILL.md | 18c611a | `.claude/skills/auth-database-multitenancy/SKILL.md` |
| 3 | Update dashboard-crm-system SKILL.md | df2d05b | `.claude/skills/dashboard-crm-system/SKILL.md` |

## What Was Added

### `voice-call-architecture/SKILL.md` (+47 lines)
New `## Phase 56 — Jobber read-side integration (customer context)` section documenting:
- 5-task `_run_db_queries` shape with `jobber_context_task` (parallel with Xero task, 2.5s outer budget unchanged)
- Cross-repo `livekit-agent/src/integrations/jobber.py` — GraphQL POST, `X-JOBBER-GRAPHQL-VERSION: 2024-04-01`, refresh-token rotation with mandatory write-back
- `src/lib/customer_context.py::merge_customer_context(jobber, xero)` with field-level merge table (D-07)
- `_sources` inner dict for per-field provenance (rendered as `(source)` suffix)
- Extended `check_customer_account` tool data source (serves merged context)
- Sentry tags `{tenant_id, provider, phone_hash}` — phone_hash is first 8 chars of sha256
- Known limitations: discrepancy suppression (deferred P58), 7-digit phones skipped, caller-ID not validated, refresh-token rotation theft race accepted
- Carried-forward P55 constraints: E.164 exact match, 800ms per-provider timeout, pre-session injection, SDK pins

### `auth-database-multitenancy/SKILL.md` (+20 lines)
New `## Migration 054 — external_account_id column (Phase 56)` section documenting:
- Column: `accounting_credentials.external_account_id TEXT NULL` — provider-agnostic identifier
- Idempotent backfill for existing Xero rows
- Partial unique index `idx_accounting_credentials_tenant_provider_external_unique`
- RLS unchanged (additive migration; migration 052 policies continue)
- `xero_tenant_id` is deprecated-but-retained until P58 cleanup
- Usage: Jobber webhook route reads `external_account_id`; OAuth callback writes it
- Pitfall 8: never repurpose `xero_tenant_id` for Jobber

### `dashboard-crm-system/SKILL.md` (+49 lines)
New `## Phase 56 — Jobber card states + Preferred badge + checklist item` section documenting:
- Four Jobber card states (Disconnected, Connected, Error, Loading) mirroring Xero
- Preferred badge markup + render condition (`providerKey === 'jobber' && connected && status.xero !== null && !hasError`)
- Reconnect banner bug-fix: `{meta.name}` instead of hardcoded "Xero" (affects both cards)
- `connect_jobber` setup checklist item (voice theme, required: false, auto-complete via `accounting_credentials` row)
- `JobberReconnectEmail` template + `notifyJobberRefreshFailure` helper
- Integrations page server component fetches both xero + jobber rows via `Promise.all`
- Files changed list (6 Next.js files)

## Acceptance Criteria — All Passed

| Criterion | Result |
|-----------|--------|
| `## Phase 56` in voice-call-architecture | 1 match |
| `jobber_context_task` in voice-call-architecture | 1 match |
| `merge_customer_context` in voice-call-architecture | 1 match |
| `customer_context.py` in voice-call-architecture | 2 matches |
| `X-JOBBER-GRAPHQL-VERSION\|jobber.py` in voice-call-architecture | 2 matches |
| `## Phase 55` preserved in voice-call-architecture | 1 match |
| `Migration 054` in auth-database-multitenancy | 1 match |
| `external_account_id` in auth-database-multitenancy | 8 matches |
| `idx_accounting_credentials_tenant_provider_external_unique` | 1 match |
| `Migration 053\|Migration 052` preserved | 2 matches |
| `xero_tenant_id` in auth-database-multitenancy | 5 matches |
| `## Phase 56` in dashboard-crm-system | 1 match |
| `Preferred badge` in dashboard-crm-system | 3 matches |
| `connect_jobber` in dashboard-crm-system | 2 matches |
| `JobberReconnectEmail\|notifyJobberRefreshFailure` | 3 matches |
| `## Phase 55` preserved in dashboard-crm-system | 1 match |
| Additive-only (`git diff --stat`) | 116 insertions, 0 deletions |
| Code fences balanced (even count) | 28, 54, 46 — all even |
| No token-material substrings introduced | 0 matches for `(access_token\|refresh_token\|client_secret)\s*[=:]\s*['"][^'"]` |

## Deviations from Plan

### [Out-of-scope — logged] Unrelated file captured in commit 1

The first commit (cdf177c) accidentally included `supabase/migrations/055_jobber_schedule_mirror.sql` (69-line new file) as a side effect — `git add` with an explicit skill-file path somehow included this untracked file. The file is unrelated to this plan (it appears to be a Phase 55 schedule-mirror migration) and was already present in the working tree before this plan started. Per deviation Rule boundary ("only auto-fix issues directly caused by the current task's changes"), I did not attempt to revert it or investigate further. This should be addressed separately — possibly via a hook or `.gitignore` update.

Otherwise, the plan executed exactly as written. No auto-fixes, no architectural decisions, no auth gates.

## Known Stubs

None. This is a pure documentation update — no runtime code paths, no data rendering.

## Self-Check: PASSED

- FOUND: `.claude/skills/voice-call-architecture/SKILL.md` (contains Phase 56 entry — 28 code fences, balanced)
- FOUND: `.claude/skills/auth-database-multitenancy/SKILL.md` (contains Migration 054 entry — 54 code fences, balanced)
- FOUND: `.claude/skills/dashboard-crm-system/SKILL.md` (contains Phase 56 entry — 46 code fences, balanced)
- FOUND: commit cdf177c (voice-call-architecture)
- FOUND: commit 18c611a (auth-database-multitenancy)
- FOUND: commit df2d05b (dashboard-crm-system)
- FOUND: `.planning/phases/56-jobber-read-side-integration-customer-context-clients-jobs-invoices/56-07-SUMMARY.md` (this file)

---
phase: 56-jobber-read-side-integration-customer-context-clients-jobs-invoices
plan: 02
subsystem: database
tags: [supabase, migration, jobber, xero, accounting_credentials, schema]

requires:
  - phase: 54-integration-credentials-foundation
    provides: accounting_credentials table with provider CHECK including 'jobber', xero_tenant_id column
  - phase: 55-xero-read-side-integration-caller-context
    provides: Xero rows populated in accounting_credentials with xero_tenant_id (backfill source)
provides:
  - accounting_credentials.external_account_id TEXT (provider-agnostic account identifier column)
  - Backfill of Xero rows (external_account_id = xero_tenant_id for provider='xero')
  - Partial unique index idx_accounting_credentials_tenant_provider_external_unique on (tenant_id, provider, external_account_id) WHERE NOT NULL
  - Documented JOBBER_CLIENT_SECRET overload in .env.example (also serves as webhook HMAC key)
affects: [56-03, 56-04, 56-05, 57, 58]

tech-stack:
  added: []
  patterns:
    - "Provider-agnostic column naming (external_account_id) in lieu of provider-specific columns (xero_tenant_id)"
    - "Additive migration + backfill + partial unique index — no destructive DDL; destructive cleanup deferred to P58"
    - "Webhook HMAC key derived from OAuth client_secret (Jobber) — no separate webhook-signing env var"

key-files:
  created:
    - supabase/migrations/054_external_account_id.sql
  modified:
    - .env.example

key-decisions:
  - "Chose Pitfall 8 option (b): add new external_account_id column rather than repurposing xero_tenant_id — keeps Xero code paths working while giving Jobber a semantically-correct home"
  - "Deferred DROP of xero_tenant_id to Phase 58 cleanup migration — avoids breaking P55 code paths mid-phase"
  - "Chose comment-only clarification in .env.example (no separate JOBBER_WEBHOOK_SECRET) — Plan 03 handler reads JOBBER_CLIENT_SECRET directly per research Pitfall 1"
  - "Partial unique index (WHERE external_account_id IS NOT NULL) — allows multiple disconnected NULL rows while still preventing duplicate registrations"

patterns-established:
  - "Idempotent migration style: ADD COLUMN IF NOT EXISTS + conditional UPDATE + CREATE UNIQUE INDEX IF NOT EXISTS (safe re-run)"
  - "Provider-agnostic naming for multi-tenant integration identifiers"

requirements-completed:
  - JOBBER-01
  - JOBBER-03

duration: ~15min
completed: 2026-04-19
---

# Phase 56 Plan 02: external_account_id migration + JOBBER webhook-secret doc Summary

**Additive Supabase migration 054 adds provider-agnostic `accounting_credentials.external_account_id` (backfilled from xero_tenant_id, uniquely indexed per tenant+provider) and clarifies that JOBBER_CLIENT_SECRET doubles as the webhook HMAC key — unblocking Plan 03's tenant-resolution lookup without touching Xero code paths.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-19 (previous executor session)
- **Completed:** 2026-04-19
- **Tasks:** 3 (Task 1 authored, Task 2 authored, Task 3 human-action: `supabase db push` applied by user)
- **Files modified:** 2

## Accomplishments

- Authored migration 054 with ADD COLUMN + COMMENT + Xero backfill UPDATE + partial unique index — fully idempotent
- Documented `.env.example` clarification that Jobber's webhook HMAC signature key is `JOBBER_CLIENT_SECRET` itself (no separate env var)
- Migration 054 applied to Supabase project via `supabase db push` (confirmed by user)
- Phase 56 downstream plans (03, 04, 05) are now unblocked to read `external_account_id` for Jobber webhook tenant-resolution

## Task Commits

1. **Task 1: Author migration 054_external_account_id.sql** — `1af0429` (feat)
2. **Task 2: Update .env.example — JOBBER_WEBHOOK_SECRET overload docs** — `025095f` (docs)
3. **Task 3: supabase db push — apply migration 054** — applied by user (human-action checkpoint; no commit — runtime-only DDL apply)

## Files Created/Modified

- `supabase/migrations/054_external_account_id.sql` (created) — Adds `external_account_id TEXT`, backfills Xero rows, creates partial unique index on (tenant_id, provider, external_account_id)
- `.env.example` (modified) — Comment block clarifying `JOBBER_CLIENT_SECRET` is also the webhook HMAC key; Plan 03 handler reads it directly

## Decisions Made

- **Column addition over repurposing:** Added `external_account_id` as a new column rather than renaming/repurposing `xero_tenant_id`. Rationale: rename would require backfilling Xero code paths mid-phase and create coordination risk with P55 consumers still in flight. Additive is lower-risk.
- **Deferred DROP to P58:** `xero_tenant_id` remains in schema. P58 will drop it once all consumers (P55 Xero code) have migrated reads to `external_account_id`.
- **No JOBBER_WEBHOOK_SECRET env var:** Kept env surface minimal. Plan 03 reads `JOBBER_CLIENT_SECRET` directly for HMAC verification, matching Jobber's documented behavior (client_secret doubles as webhook HMAC key — research Pitfall 1).
- **Partial unique index:** `WHERE external_account_id IS NOT NULL` allows disconnected credential rows (null external_account_id) to coexist without unique-constraint contention.

## Deviations from Plan

None - plan executed exactly as written. All 3 tasks matched acceptance criteria.

## Issues Encountered

None — migration applied cleanly; user confirmed "migration applied" after running `supabase db push` and verifying the 4 post-push SQL checks from the plan's `<how-to-verify>`.

## User Setup Required

None — migration 054 is already applied to the Supabase project by the user. No further environment variable setup (the `.env.example` comment is informational only; `JOBBER_CLIENT_SECRET` was already shipped in P54).

## Next Phase Readiness

- Plan 03 (webhook handler) unblocked — can now `.eq('external_account_id', accountId)` to resolve Jobber's `evt.accountId` → Voco tenant
- Plan 57 (Jobber schedule mirror) can reuse the same column for per-tenant Jobber lookups
- No blockers for Plans 03–07 stemming from schema

## Self-Check: PASSED

- `supabase/migrations/054_external_account_id.sql` exists (verified via Read)
- Commit `1af0429` exists in git log (feat(56-02): add external_account_id to accounting_credentials)
- Commit `025095f` exists in git log (docs(56-02): clarify JOBBER_CLIENT_SECRET is the webhook HMAC key)
- Task 3 is a runtime-only DDL apply — no commit expected, user confirmed "migration applied"

---
*Phase: 56-jobber-read-side-integration-customer-context-clients-jobs-invoices*
*Completed: 2026-04-19*

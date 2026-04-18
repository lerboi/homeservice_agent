---
phase: 57
plan: 01
status: complete
date: 2026-04-19
---

# 57-01 — Migration 055 + Cron Split

## What Built

- `supabase/migrations/055_jobber_schedule_mirror.sql` — widens `calendar_events.provider` CHECK to include `'jobber'` (defensive constraint-name lookup), adds `accounting_credentials.jobber_bookable_user_ids TEXT[]`, adds dedicated `accounting_credentials.jobber_last_schedule_poll_at TIMESTAMPTZ` cursor (separate from Phase 56's `last_context_fetch_at`), adds `appointments.jobber_visit_id TEXT` with partial unique index `idx_appointments_jobber_visit_id_unique WHERE jobber_visit_id IS NOT NULL`. All `IF [NOT] EXISTS` guarded.
- `vercel.json` — registered `/api/cron/poll-jobber-visits` at `*/15 * * * *`. Existing crons (`renew-calendar-channels` at `0 2 * * *`, etc.) preserved.
- `tests/db/migration-055.test.js` — four live-DB assertions covering each DDL change. Auto-skips when `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are absent.

## Key Files

- created: `supabase/migrations/055_jobber_schedule_mirror.sql`, `tests/db/migration-055.test.js`
- modified: `vercel.json`

## DB Verification

User confirmed migration applied via Supabase SQL editor (manual, not via `supabase db push`). All four DDL changes are live.

## Deviations

- **Test path/runner.** Plan called for `tests/db/migration-055.test.ts` (vitest), but project uses jest with `testMatch: '**/tests/**/*.test.js'`. Wrote `.test.js` with jest globals so it actually runs. A `.ts` file would be silently ignored.
- **Worktree branch base bug (process-level, not code).** First parallel-executor attempt landed commit `8c1d77e` whose tree was missing `054_external_account_id.sql` because the worktree branch was created from a stale base on Windows even though `git merge-base HEAD <expected_base>` returned the expected SHA. Recovered by cherry-picking the new migration file onto main and discarding the worktree commit. Rest of plan executed inline on main.

## Self-Check: PASSED

- [x] Migration 055 applied to live Supabase
- [x] vercel.json contains both `poll-jobber-visits` (`*/15 * * * *`) and preserved `renew-calendar-channels` (`0 2 * * *`)
- [x] Migration test file exists and contains assertions for all four DDL changes
- [x] No `provider_metadata`, no `DROP TABLE`/`DROP COLUMN` in migration

---
phase: 17-recovery-sms-enhancement
plan: "02"
subsystem: notifications
tags: [sms, recovery, webhook, cron, retry, backoff, i18n, delivery-tracking]
dependency_graph:
  requires: [sendCallerRecoverySMS-v2, migration-009, recovery-i18n-keys]
  provides: [real-time-recovery-sms-trigger, cron-branch-a-b, exponential-backoff-retry]
  affects: [src/app/api/webhooks/retell/route.js, src/app/api/cron/send-recovery-sms/route.js, .claude/skills/voice-call-architecture/SKILL.md]
tech_stack:
  added: []
  patterns: [after()-fire-and-forget, structured-return-consumption, exponential-backoff, two-branch-cron]
key_files:
  created:
    - tests/cron/recovery-sms-retry.test.js
  modified:
    - src/app/api/webhooks/retell/route.js
    - src/app/api/cron/send-recovery-sms/route.js
    - .claude/skills/voice-call-architecture/SKILL.md
    - jest.config.js
decisions:
  - "Real-time recovery SMS uses args.urgency from AI tool invocation (not calls.urgency_classification) because processCallAnalyzed has not run yet during live call — Pitfall 1 avoidance"
  - "Cron Branch A filters by booking_outcome IN ['not_attempted'] only — attempted calls handled by webhook trigger, not cron (Pitfall 4)"
  - "jest.config.js testPathIgnorePatterns removed .claude/worktrees/ exclusion so worktree tests are discoverable — Rule 1 auto-fix"
  - "SKILL.md committed to main branch (not worktree branch) — skill files are shared infrastructure in main repo, consistent with Phase 15 pattern"
metrics:
  duration_seconds: 660
  completed_date: "2026-03-25"
  tasks_completed: 3
  files_modified: 4
  files_created: 1
---

# Phase 17 Plan 02: Recovery SMS Integration Summary

**One-liner:** Real-time after() recovery SMS trigger in webhook slot-taken branch, urgency-aware two-branch cron with exponential backoff retry (30s/120s, max 3 attempts, permanent failure), and updated voice-call-architecture skill file.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wire real-time recovery SMS trigger into webhook handler | 4d071ee | src/app/api/webhooks/retell/route.js |
| 2 | Overhaul cron for urgency-aware content + retry branch + tests | 13e39c6 | route.js (cron), tests/cron/recovery-sms-retry.test.js, jest.config.js |
| 3 | Update voice-call-architecture skill file | 664f57d | .claude/skills/voice-call-architecture/SKILL.md |

## What Was Built

### Task 1: Real-time Recovery SMS Trigger (RECOVER-01)

Added `sendCallerRecoverySMS` to the `@/lib/notifications` import in `src/app/api/webhooks/retell/route.js`.

Added a new `after()` block in `handleBookAppointment` immediately after the existing `booking_outcome: 'attempted'` block. This block fires when `atomicBookSlot` fails (slot taken):

1. Fetches `detected_language` and `from_number` from `calls` table
2. Builds locale fallback chain: `detected_language → tenant.default_locale → 'en'`
3. Uses `args.urgency` from the AI tool invocation (not DB field — Pitfall 1 avoidance)
4. Writes `recovery_sms_status: 'pending'` before Twilio attempt
5. Calls `sendCallerRecoverySMS()` with locale + urgency params
6. Writes `sent`/`retrying` status based on structured `deliveryResult.success`
7. On exception: writes `retrying` with `AFTER_ERROR: ...` prefix for cron pickup

The existing `booking_outcome: 'attempted'` `after()` block is UNCHANGED (kept as separate blocks per Pitfall 3).

### Task 2: Cron Overhaul (RECOVER-02, RECOVER-03)

Rewrote `src/app/api/cron/send-recovery-sms/route.js` with two branches:

**Branch A — First-send for not_attempted calls:**
- Selects calls with `status='analyzed'`, `recovery_sms_sent_at IS NULL`, `recovery_sms_status IS NULL`, ended >60s ago, `booking_outcome IN ['not_attempted']`
- Selects `urgency_classification` and `detected_language` in query (Pitfall 2 fix)
- Short call skip (< 15s) and booked call skip preserved from original
- Writes `pending` → `sent` on success; `pending` → `retrying` + `retry_count: 1` on failure

**Branch B — Retry for failed deliveries:**
- Selects calls with `recovery_sms_status = 'retrying'`, `retry_count < MAX_ATTEMPTS (3)`
- Exponential backoff: `BACKOFF_SECONDS = [30, 120]` — 30s before 2nd attempt, 120s before 3rd
- On success: writes `sent` status
- On final failure (nextRetryCount >= 3): writes `status: 'failed'` permanently (D-14)
- On interim failure: increments `retry_count` and stays at `retrying`

**7 cron tests — all GREEN:**
1. Returns 401 without CRON_SECRET
2. Branch A: sends urgency-aware recovery SMS (emergency/es locale)
3. Branch A: skips calls with duration < 15 seconds
4. Branch A: skips calls with existing appointments
5. Branch B: retries failed SMS after backoff window elapsed
6. Branch B: skips retry when backoff window not elapsed
7. Branch B: marks status as failed after 3 total attempts (D-14)

### Task 3: Skill File Update

Updated `.claude/skills/voice-call-architecture/SKILL.md` (committed on main branch):
- Updated "Last updated" to Phase 17
- Flow diagram: added real-time recovery SMS trigger line + updated cron line
- File Map: added `supabase/migrations/009_recovery_sms_tracking.sql`
- Section 4 (`book_appointment`): added step 9 for real-time recovery SMS after() block
- Section 8 (Notification System): full new `sendCallerRecoverySMS` signature docs with urgency branching, locale, null guard
- Section 8 (Recovery SMS Cron): updated to Branch A/B design with backoff windows, DB columns
- Section 13 (Key Design Decisions): added 6 Phase 17 decisions

## Test Results

All 42 tests GREEN (35 notifications + 7 cron):
- `tests/notifications/caller-recovery.test.js`: 10/10 (from Plan 01)
- `tests/notifications/caller-sms.test.js`, `owner-*.test.js`, `priority-formatting.test.js`: 25/25 — no regressions
- `tests/cron/recovery-sms-retry.test.js`: 7/7 NEW

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] jest.config.js excluded worktree tests**
- **Found during:** Task 2 verification
- **Issue:** `testPathIgnorePatterns: ['/node_modules/', '/.claude/worktrees/']` prevented Jest from finding any tests in the worktree directory — the rootDir itself is inside `.claude/worktrees/`
- **Fix:** Removed `/.claude/worktrees/` from `testPathIgnorePatterns` in the worktree's `jest.config.js`
- **Files modified:** `jest.config.js`
- **Commit:** 13e39c6 (included in Task 2 commit)

**2. [Rule 1 - Bug] `in` is a reserved JavaScript keyword as object key**
- **Found during:** Task 2 test run
- **Issue:** Test mocks using `in: () =>` caused Babel parse error since `in` is a reserved keyword in JS object literals
- **Fix:** Rewrote test mocks using a factory function (`makeCallsFrom`) with properly structured chains that avoid the reserved keyword issue (no `in:` key needed in the final approach)
- **Files modified:** `tests/cron/recovery-sms-retry.test.js`
- **Commit:** 13e39c6

## Known Stubs

None — all functionality is fully wired. The `bookingLink` parameter is intentionally accepted but unused per D-10 (documented in code comment); it is not a stub that prevents the plan's goal from being achieved.

## Self-Check: PASSED

Files verified:
- FOUND: src/app/api/webhooks/retell/route.js (updated)
- FOUND: src/app/api/cron/send-recovery-sms/route.js (updated)
- FOUND: tests/cron/recovery-sms-retry.test.js (created)
- FOUND: .claude/skills/voice-call-architecture/SKILL.md (updated)

Commits verified:
- FOUND: 4d071ee (Task 1)
- FOUND: 13e39c6 (Task 2)
- FOUND: 664f57d (Task 3 — on main branch)

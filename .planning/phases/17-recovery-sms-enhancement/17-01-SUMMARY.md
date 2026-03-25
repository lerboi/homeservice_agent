---
phase: 17-recovery-sms-enhancement
plan: "01"
subsystem: notifications
tags: [sms, i18n, recovery, twilio, schema-migration]
dependency_graph:
  requires: []
  provides: [sendCallerRecoverySMS-v2, migration-009, recovery-i18n-keys]
  affects: [src/lib/notifications.js, supabase/migrations, messages/en.json, messages/es.json]
tech_stack:
  added: []
  patterns: [urgency-aware-i18n, structured-return-value, tdd-red-green]
key_files:
  created:
    - supabase/migrations/009_recovery_sms_tracking.sql
  modified:
    - src/lib/notifications.js
    - messages/en.json
    - messages/es.json
    - tests/notifications/caller-recovery.test.js
decisions:
  - "sendCallerRecoverySMS returns structured { success, sid, error } — downstream Plan 02 webhook trigger depends on this to write recovery_sms_status to DB"
  - "Emergency urgency uses recovery_sms_attempted_emergency template (empathetic urgency); routine uses recovery_sms_attempted_routine (warm standard)"
  - "bookingLink accepted but unused in SMS body per D-10 — placeholder for future booking page integration"
  - "ownerPhone parameter removed per D-09 — no callback number in recovery SMS"
  - "null guard on 'to' returns { success: false, error: { code: 'NO_PHONE' } } — enables caller to detect missing phone before Twilio call"
metrics:
  duration_seconds: 154
  completed_date: "2026-03-25"
  tasks_completed: 2
  files_modified: 4
  files_created: 1
---

# Phase 17 Plan 01: Recovery SMS Foundation Summary

**One-liner:** Urgency-aware i18n sendCallerRecoverySMS with structured { success, sid, error } return, schema migration 009 with 4 tracking columns, and full 10-test GREEN suite.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Schema migration + i18n keys + test scaffold | 5cd9387 | 009_recovery_sms_tracking.sql, en.json, es.json, caller-recovery.test.js |
| 2 | Overhaul sendCallerRecoverySMS | 234b19f | src/lib/notifications.js |

## What Was Built

### Migration 009 (`supabase/migrations/009_recovery_sms_tracking.sql`)
Four new columns on the `calls` table for SMS delivery tracking:
- `recovery_sms_status` — CHECK constraint: pending/sent/failed/retrying
- `recovery_sms_retry_count INTEGER NOT NULL DEFAULT 0`
- `recovery_sms_last_error TEXT`
- `recovery_sms_last_attempt_at TIMESTAMPTZ`

Partial index `idx_calls_recovery_sms_retry` on `(tenant_id, recovery_sms_status, recovery_sms_last_attempt_at) WHERE recovery_sms_status = 'retrying'` for efficient cron retry queries.

### Overhauled `sendCallerRecoverySMS` (`src/lib/notifications.js`)
Replaced fire-and-forget function with:
- **Structured return:** `{ success: boolean, sid?: string, error?: { code, message } }`
- **Urgency branching:** `urgency === 'emergency'` selects empathetic-urgency template; all other values select standard warm template
- **i18n:** `locale === 'es'` selects Spanish templates via existing `interpolate()` + JSON import pattern
- **Null guard:** `to` missing returns `{ success: false, error: { code: 'NO_PHONE', message: '...' } }` without calling Twilio
- **bookingLink placeholder:** Parameter accepted, not used in SMS body (D-10 — future booking page)
- **ownerPhone removed:** Per D-09, no callback number in recovery SMS

### i18n Keys Added
Both `messages/en.json` and `messages/es.json` have two new notification keys under `"notifications"`:
- `recovery_sms_attempted_routine` — standard warm body
- `recovery_sms_attempted_emergency` — empathetic urgency body

## Test Results

All 10 tests GREEN in `tests/notifications/caller-recovery.test.js`:
1. Sends to caller's number with new signature (locale, urgency)
2. Returns { success: true, sid } on successful delivery
3. Returns { success: false, error } when Twilio fails (not throws)
4. Returns { success: false, error: { code: "NO_PHONE" } } when to is null
5. Routine urgency produces body containing "sorry we couldn't get your appointment booked"
6. Emergency urgency produces body containing "your situation is time-sensitive"
7. Spanish locale produces Spanish body for routine
8. Spanish locale produces Spanish body for emergency
9. Uses "there" as fallback greeting when callerName is null
10. bookingLink parameter is accepted but not included in SMS body

Full notification suite: 39/39 tests pass — no regressions.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all functionality is fully wired. The `bookingLink` parameter is intentionally accepted but unused per D-10 (documented in code comment); it is not a stub that prevents the plan's goal from being achieved.

## Self-Check: PASSED

Files verified:
- FOUND: supabase/migrations/009_recovery_sms_tracking.sql
- FOUND: src/lib/notifications.js (updated)
- FOUND: messages/en.json (updated)
- FOUND: messages/es.json (updated)
- FOUND: tests/notifications/caller-recovery.test.js (updated)

Commits verified:
- FOUND: 5cd9387 (Task 1)
- FOUND: 234b19f (Task 2)

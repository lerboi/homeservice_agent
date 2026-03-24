---
phase: 15-call-processor-and-triage-reclassification
plan: "01"
subsystem: notifications, schema, i18n, testing
tags: [schema-migration, twilio, i18n, tdd, wave-0]
dependency_graph:
  requires: []
  provides:
    - supabase/migrations/008_call_outcomes.sql
    - src/lib/notifications.js#sendCallerSMS
    - messages/en.json#notifications.booking_confirmation
    - messages/es.json#notifications.booking_confirmation
    - tests/notifications/caller-sms.test.js
    - tests/call-processor/booking-outcome.test.js
  affects:
    - src/lib/call-processor.js (Plan 02 will modify)
tech_stack:
  added: []
  patterns:
    - "Direct JSON import with { type: 'json' } for i18n (no next-intl runtime)"
    - "inline interpolate() helper — reduce pattern over Object.entries"
    - "jest.unstable_mockModule ESM pattern for Twilio/Resend isolation"
    - "Wave 0 RED test scaffolding — behavioral contract for Plan 02"
key_files:
  created:
    - supabase/migrations/008_call_outcomes.sql
    - tests/notifications/caller-sms.test.js
    - tests/call-processor/booking-outcome.test.js
  modified:
    - src/lib/notifications.js
    - messages/en.json
    - messages/es.json
decisions:
  - "[Phase 15-01]: sendCallerSMS uses locale === 'es' check, falls back to en for all unknown locales — matches existing project locale pattern"
  - "[Phase 15-01]: interpolate() defined as module-private function (not exported) — only sendCallerSMS consumes it"
  - "[Phase 15-01]: booking-outcome.test.js 2 of 7 tests pass GREEN immediately because current code already satisfies those constraints (guard behaviors) — expected and correct"
metrics:
  duration: "4 minutes"
  completed_date: "2026-03-24"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 3
---

# Phase 15 Plan 01: Schema Foundation + sendCallerSMS + Wave 0 Test Scaffolds Summary

Schema migration, booking confirmation SMS function with i18n, and Wave 0 RED test scaffolds for the call processor.

## What Was Built

**Migration (008_call_outcomes.sql):** Adds three columns to the `calls` table:
- `booking_outcome` with CHECK constraint: `booked | attempted | declined | not_attempted`
- `exception_reason` with CHECK constraint: `clarification_limit | caller_requested`
- `notification_priority` with CHECK constraint: `high | standard`

Plus two indexes: `idx_calls_booking_outcome` and `idx_calls_notification_priority` on `(tenant_id, column)`.

**sendCallerSMS function:** Exported from `src/lib/notifications.js`. Sends booking confirmation SMS to caller in their detected language (en/es). Uses direct JSON import of translation files plus inline `interpolate()` helper. Fire-and-forget pattern — errors logged but never thrown. Null guard on `to` prevents Twilio calls when no phone number.

**i18n keys:** `notifications.booking_confirmation` added to both `messages/en.json` and `messages/es.json` with matching 4-placeholder structure (`{business_name}`, `{date}`, `{time}`, `{address}`). i18n parity test confirms placeholder symmetry.

**Test scaffolds:**
- `tests/notifications/caller-sms.test.js` — 6 GREEN tests covering en/es body interpolation, error resilience, null guard, and return value
- `tests/call-processor/booking-outcome.test.js` — 7 tests (5 RED, 2 GREEN) defining behavioral contract for Plan 02

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Schema migration + i18n keys + sendCallerSMS | 5b1cefb | 008_call_outcomes.sql, notifications.js, en.json, es.json |
| 2 | Wave 0 test scaffolds | 82c5e60 | caller-sms.test.js, booking-outcome.test.js |

## Verification Results

- `tests/notifications/caller-sms.test.js` — 6/6 GREEN
- `tests/i18n/translation-keys.test.js` — 5/5 GREEN (including placeholder parity for new booking_confirmation key)
- `tests/call-processor/booking-outcome.test.js` — 5/7 RED (expected — Plan 02 makes them GREEN), 2/7 GREEN (guard behaviors already satisfied)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed mock chain for chained .eq() calls in booking-outcome tests**
- **Found during:** Task 2
- **Issue:** The supabase mock's `.select().eq()` chain returned an object that didn't support a second `.eq()` call, causing TypeError in tests for appointments query that uses `.eq('tenant_id', x).eq('retell_call_id', y)`
- **Fix:** Replaced flat mock chain with `makeSelectChain()` factory that sets `leaf.eq = jest.fn().mockReturnValue(leaf)` for arbitrary `.eq()` chaining depth
- **Files modified:** `tests/call-processor/booking-outcome.test.js`
- **Commit:** 82c5e60 (included in Task 2 commit)

## Known Stubs

None — all artifacts are fully implemented. The sendCallerSMS function sends real Twilio SMS. The migration file is ready for `supabase db push`. The RED tests in booking-outcome.test.js are intentional scaffolds, not stubs.

## Self-Check: PASSED

- supabase/migrations/008_call_outcomes.sql: FOUND
- src/lib/notifications.js (contains sendCallerSMS): FOUND
- messages/en.json (contains booking_confirmation): FOUND
- messages/es.json (contains booking_confirmation): FOUND
- tests/notifications/caller-sms.test.js: FOUND
- tests/call-processor/booking-outcome.test.js: FOUND
- Commit 5b1cefb: FOUND
- Commit 82c5e60: FOUND

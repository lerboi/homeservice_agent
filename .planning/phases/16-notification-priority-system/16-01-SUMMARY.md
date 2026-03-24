---
phase: 16
plan: "01"
subsystem: notifications
tags: [sms, email, urgency, priority, formatting]
dependency_graph:
  requires: []
  provides: [NOTIF-P01, NOTIF-P02]
  affects: [notifications, email-template]
tech_stack:
  added: []
  patterns: [urgency-aware branching, conditional inline style override]
key_files:
  created:
    - tests/notifications/priority-formatting.test.js
  modified:
    - src/lib/notifications.js
    - src/emails/NewLeadEmail.jsx
    - tests/notifications/owner-sms.test.js
    - tests/notifications/owner-email.test.js
decisions:
  - "Emergency detection is strict equality urgency === 'emergency' — only lowercase string triggers EMERGENCY path; high_ticket and undefined fall to routine"
  - "Header background overridden via inline spread { ...headerStyle, backgroundColor: ... } to avoid mutating shared style constant"
  - "emergencyBadgeStyle added as named constant alongside other style constants for discoverability"
metrics:
  duration_seconds: 173
  completed_date: "2026-03-25"
  tasks_completed: 3
  files_modified: 5
---

# Phase 16 Plan 01: Notification Priority System Summary

**One-liner:** Urgency-aware SMS/email formatting with EMERGENCY prefix and red-header email treatment for `urgency=emergency` bookings, tested with 13 priority-split assertions.

## What Was Implemented

### Task 1 — Priority-tiered sendOwnerSMS and sendOwnerEmail

`src/lib/notifications.js` updated with urgency-aware branching in both owner alert functions:

- `sendOwnerSMS`: Emergency path produces `EMERGENCY: {businessName} — {name} needs urgent {job} at {addr}. Call NOW: ...`; routine path uses `{businessName}: New booking — {name}, {job} at {addr}. Callback: ...`
- `sendOwnerEmail`: Emergency subject becomes `EMERGENCY: New booking — {callerName}`; routine subject becomes `New booking — {callerName}`. Subject derivation extracts `urgency_classification || urgency` from the lead object.

Both functions resolve `isEmergency = urgency === 'emergency'` — only the exact string triggers the emergency path. `sendOwnerNotifications` and `sendCallerRecoverySMS` were not touched.

Existing tests in `owner-sms.test.js` and `owner-email.test.js` were updated: the `toContain('emergency')` assertions were replaced with `toMatch(/^EMERGENCY:/)` to reflect the new uppercase prefix format.

### Task 2 — Emergency visual treatment in NewLeadEmail

`src/emails/NewLeadEmail.jsx` updated:

- `isEmergency` derived from `urgency === 'emergency'`
- Header Section uses inline style spread: `{ ...headerStyle, backgroundColor: isEmergency ? '#DC2626' : '#0F172A' }` — base `headerStyle` object unchanged
- Conditional `EMERGENCY BOOKING` badge rendered inside header when `isEmergency`
- Heading updated to `{isEmergency ? 'EMERGENCY booking' : 'New booking'} — {callerName}`
- `emergencyBadgeStyle` constant added adjacent to `brandStyle`

### Task 3 — Priority formatting tests

`tests/notifications/priority-formatting.test.js` created with 13 test cases covering:

- NOTIF-P01: Emergency SMS starts with `EMERGENCY:`, contains `Call NOW`, contains caller/job/address data
- NOTIF-P01: Emergency email subject starts with `EMERGENCY:`, contains caller name
- NOTIF-P02: Routine SMS does not start with `EMERGENCY:`, does not contain `Call NOW`
- NOTIF-P02: Routine email subject does not start with `EMERGENCY:`, contains "New booking"
- Edge cases: `high_ticket` urgency produces no EMERGENCY prefix (SMS + email)
- Edge case: `undefined` urgency produces no EMERGENCY prefix (SMS)
- Consistency: same `emergency` urgency always produces EMERGENCY prefix regardless of other fields

## Test Results

All 29 notification tests pass GREEN:

```
Test Suites: 4 passed, 4 total
Tests:       29 passed, 29 total
```

Suites: `owner-sms.test.js` (5), `owner-email.test.js` (5), `caller-recovery.test.js` (6), `priority-formatting.test.js` (13)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed breaking assertion in owner-email.test.js**

- **Found during:** Task 1
- **Issue:** `owner-email.test.js` line 71 also had `expect(subject).toContain('emergency')` which would fail after the email subject changed to uppercase `EMERGENCY:`. The plan explicitly mentioned fixing `owner-sms.test.js` but not `owner-email.test.js`.
- **Fix:** Updated assertion to `toMatch(/^EMERGENCY:/)` and updated test description to match the new format, consistent with the `owner-sms.test.js` fix.
- **Files modified:** tests/notifications/owner-email.test.js
- **Commit:** 0d84537

## Known Stubs

None — all changes produce real output. No data is hardcoded or mocked in production paths.

## Self-Check: PASSED

- src/lib/notifications.js: FOUND, contains `EMERGENCY:` string
- src/emails/NewLeadEmail.jsx: FOUND, contains `EMERGENCY BOOKING`, `#DC2626`, `emergencyBadgeStyle`
- tests/notifications/priority-formatting.test.js: FOUND, 13 tests
- Commit 0d84537: FOUND

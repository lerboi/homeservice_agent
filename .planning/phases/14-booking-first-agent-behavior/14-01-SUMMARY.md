---
phase: 14-booking-first-agent-behavior
plan: 01
subsystem: agent-testing
tags: [tdd, prompt, testing, whisper-message, capture-lead]
dependency_graph:
  requires: []
  provides:
    - tests/agent/prompt-snapshot.test.js (baseline snapshot for regression detection)
    - tests/agent/prompt.test.js (17 booking-first RED assertions defining Plan 02 contract)
    - tests/agent/whisper-message.test.js (9 GREEN tests for buildWhisperMessage)
    - tests/agent/capture-lead-handler.test.js (3 GREEN tests for capture_lead contract)
    - src/lib/whisper-message.js (buildWhisperMessage utility)
  affects:
    - Plan 02 (prompt rewrite must make booking-first assertions GREEN)
    - Plan 03 (end_call/capture_lead tool handlers)
tech_stack:
  added: []
  patterns:
    - Jest ESM snapshot testing (node --experimental-vm-modules)
    - jest.unstable_mockModule for ESM module mocking
    - RED/GREEN TDD safety net before production code rewrite
key_files:
  created:
    - tests/agent/prompt-snapshot.test.js
    - tests/agent/__snapshots__/prompt-snapshot.test.js.snap
    - tests/agent/prompt.test.js
    - tests/agent/whisper-message.test.js
    - tests/agent/capture-lead-handler.test.js
    - src/lib/whisper-message.js
  modified: []
decisions:
  - Snapshot tests use node --experimental-vm-modules (package.json type:module + jest ESM requirement)
  - buildWhisperMessage placed in src/lib/ (not Railway repo) — it is consumed by the main app's transfer handler
  - Booking-first prompt.test.js assertions are deliberately failing RED — Plan 02 makes them GREEN
  - capture-lead-handler.test.js tests the createOrMergeLead contract, not the route handler directly (not easily importable)
metrics:
  duration: ~10 minutes
  completed: "2026-03-25"
  tasks_completed: 2
  tasks_total: 2
  files_created: 6
  files_modified: 0
---

# Phase 14 Plan 01: Booking-First Test Safety Net Summary

**One-liner:** TDD safety net for booking-first rewrite — snapshot baseline of current escalation-first prompt, 17 RED booking-first assertions defining the Plan 02 contract, and GREEN unit tests for whisper message builder and capture_lead handler.

## What Was Built

### Task 1: Prompt Snapshot Baseline + Booking-First RED Assertions

**`tests/agent/prompt-snapshot.test.js`** — 4 snapshot tests capturing the current escalation-first prompt as a regression baseline. These tests run GREEN now and will catch any unintended regression when Plan 02 rewrites the prompt. The `.snap` file is committed as the baseline.

**`tests/agent/prompt.test.js`** — 17 assertions defining the complete booking-first behavior contract for Plan 02. These assertions intentionally FAIL against the current prompt (expected RED state). Plan 02's prompt rewrite must make them all GREEN.

Assertions cover (per requirements BOOK-01/02/03/05):
- `BOOKING-FIRST PROTOCOL` section exists (BOOK-01)
- `TRIAGE-AWARE BEHAVIOR` section does NOT exist (old escalation-first section removed)
- Emergency/routine tone split does NOT exist (D-11 unified tone)
- Info-then-pivot instruction for info-only callers (BOOK-02, D-01)
- Quote-to-site-visit reframe (BOOK-02, D-02)
- `DECLINE HANDLING` section (BOOK-03, D-03/04)
- Soft re-offer on first decline (D-03)
- `capture_lead` invocation after second decline (D-04)
- `CLARIFICATION LIMIT` section (D-06)
- 3-attempt clarification instruction (D-06)
- Instant transfer on explicit request (D-07)
- `URGENCY DETECTION` section for slot priority (D-12)
- 6 preserved behaviors: address read-back, LANGUAGE INSTRUCTIONS, recording disclosure, 9-minute wrap-up, LANGUAGE_BARRIER tag

### Task 2: Whisper Message Builder + capture_lead Handler Test

**`src/lib/whisper-message.js`** — Thin utility implementing the D-08 whisper template format: `"[Name] calling about [job type]. [Emergency/Routine]. [1-line summary]."` All parameters are optional with graceful fallbacks.

**`tests/agent/whisper-message.test.js`** — 9 GREEN unit tests covering: emergency label, routine label, high_ticket treated as routine, missing callerName fallback, missing jobType fallback, missing urgency fallback, missing summary (no trailing space), empty object, no arguments.

**`tests/agent/capture-lead-handler.test.js`** — 3 GREEN tests validating the `createOrMergeLead` contract for mid-call capture_lead invocations: field schema mapping, 15-second duration filter compliance (Pitfall 3), and return shape.

## Test Results

| File | Tests | Result |
|------|-------|--------|
| prompt-snapshot.test.js | 4 | GREEN (baseline captured) |
| prompt.test.js | 17 | 11 RED / 6 GREEN (RED = expected before Plan 02) |
| whisper-message.test.js | 9 | GREEN |
| capture-lead-handler.test.js | 3 | GREEN |

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Hash | Message |
|------|---------|
| 7e97f08 | test(14-01): add prompt snapshot baseline and booking-first RED assertions |
| b5bbc3a | feat(14-01): add whisper message builder and capture_lead handler test |

## Known Stubs

None — `buildWhisperMessage` is fully implemented. All test files use mocks, not stubs.

## Self-Check: PASSED

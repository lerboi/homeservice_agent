---
phase: 18
plan: "03"
subsystem: voice-call-architecture
tags: [test-call, auto-cancel, manual-testing, e2e, onboarding, skill-update]
dependency_graph:
  requires: [onboarding test-call route, call-processor processCallEnded, messages/en.json, messages/es.json]
  provides: [test_call auto-cancel logic, English E2E test script, Spanish E2E test script, onboarding gate test script]
  affects: [onboarding wizard test call flow, dashboard calendar cleanliness, voice-call-architecture skill]
tech_stack:
  added: []
  patterns: [test_call dynamic variable flag, post-call auto-cancel with lead reset]
key_files:
  created:
    - tests/manual/e2e-english-booking.md
    - tests/manual/e2e-spanish-booking.md
    - tests/manual/onboarding-gate-revalidation.md
  modified:
    - src/app/api/onboarding/test-call/route.js
    - src/lib/call-processor.js
    - .claude/skills/voice-call-architecture/SKILL.md
decisions:
  - "Auto-cancel fires in processCallEnded (call_ended event) not processCallAnalyzed — calendar clears immediately after test call, not minutes later"
  - "Dual test_call check: metadata?.test_call OR metadata?.retell_llm_dynamic_variables?.test_call — handles both Retell payload echo paths"
  - "Lead reset: status='new' + appointment_id=null — prevents dashboard showing 'booked' lead with no active appointment (Pitfall 6)"
metrics:
  duration: "~20 minutes"
  completed_date: "2026-03-25"
  tasks_completed: 2
  files_changed: 6
---

# Phase 18 Plan 03: Test Call Auto-Cancel and Manual E2E Test Scripts Summary

**One-liner:** Onboarding test calls now auto-cancel their bookings post-call via test_call flag detection in processCallEnded, with three manual QA scripts covering English, Spanish, and timed onboarding flows.

---

## What Was Built

### Task 1: Test Call Flag and Auto-Cancel Logic

**`src/app/api/onboarding/test-call/route.js`** — Added `test_call: 'true'` to `retell_llm_dynamic_variables` in the `createPhoneCall` invocation. This flag travels with the call through Retell's infrastructure and is available in the `call_ended` event payload's metadata.

**`src/lib/call-processor.js` — `processCallEnded`** — Added auto-cancel logic after the existing call upsert. The handler checks `metadata?.test_call === 'true'` OR `metadata?.retell_llm_dynamic_variables?.test_call === 'true'` (dual path to handle Retell's payload echo behavior). When detected with a valid tenantId:
1. Queries `appointments` for a row matching this `retell_call_id` and `tenant_id`
2. If found: sets `appointments.status = 'cancelled'`
3. Resets associated `leads.status = 'new'` and nullifies `leads.appointment_id`

This ensures the owner experiences the full booking-first flow during onboarding without the test appointment polluting their real calendar.

### Task 2: Manual E2E Test Scripts and Skill Update

**`tests/manual/e2e-english-booking.md`** — 8-step English baseline booking script covering: AI answers in English, booking-first slot offer, mandatory address read-back, caller receives English SMS (`Your appointment with {business_name} is confirmed for {date} at {time} at {address}.`), owner notification, and dashboard verification. 6 checkpoint PASS/FAIL table with overall verdict.

**`tests/manual/e2e-spanish-booking.md`** — 8-step Spanish multi-language script. Tests language auto-detection from first utterance, full conversation in Spanish, address read-back in Spanish, Spanish SMS confirmation matching `messages/es.json` template (`Su cita con {business_name} esta confirmada para el {date} a las {time} en {address}.`), owner notification in English, and dashboard verification.

**`tests/manual/onboarding-gate-revalidation.md`** — 10-step timed onboarding wizard script with explicit timer start/stop instructions and a hard < 5-minute gate. Covers all 4 wizard steps, verifies AI uses booking-first behavior during test call (D-07), verifies test booking is auto-cancelled after call ends (D-08), and records total elapsed time.

**`.claude/skills/voice-call-architecture/SKILL.md`** — Updated per CLAUDE.md directive:
- Added `src/app/api/onboarding/test-call/route.js` to File Map
- Expanded `processCallEnded` section with auto-cancel logic documentation
- Added test call auto-cancel to Key Design Decisions

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Known Stubs

None — all code is wired to real behavior. The manual test scripts are intentionally non-automated per D-01 (manual test script approach locked decision).

---

## Self-Check

### Files Exist Check
- `src/app/api/onboarding/test-call/route.js` — modified (pre-existing file)
- `src/lib/call-processor.js` — modified (pre-existing file)
- `tests/manual/e2e-english-booking.md` — created
- `tests/manual/e2e-spanish-booking.md` — created
- `tests/manual/onboarding-gate-revalidation.md` — created
- `.claude/skills/voice-call-architecture/SKILL.md` — modified

### Commits Exist Check
- Task 1: `bff7283` — feat(18-03): add test_call flag to test-call route and auto-cancel in call-processor
- Task 2: `2bea5fb` — feat(18-03): create manual E2E test scripts and update voice-call-architecture skill

## Self-Check: PASSED

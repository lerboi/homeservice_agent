---
phase: 03
slug: scheduling-and-calendar-sync
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.7.0 |
| **Config file** | `jest.config.js` (exists from Phase 1) |
| **Quick run command** | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --testPathPattern=scheduling --passWithNoTests` |
| **Full suite command** | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --passWithNoTests` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --testPathPattern=scheduling --passWithNoTests`
- **After every plan wave:** Run `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --passWithNoTests`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | SCHED-01 | unit | `jest --testPathPattern=slot-calculator` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | SCHED-07, SCHED-08 | unit | `jest --testPathPattern=slot-calculator` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | SCHED-04, SCHED-05 | integration | `jest --testPathPattern=booking-concurrency` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 1 | VOICE-03, VOICE-04 | unit | `jest --testPathPattern=book-appointment-handler` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 2 | SCHED-06 | unit | `jest --testPathPattern=call-processor` | ❌ W0 | ⬜ pending |
| 03-04-01 | 04 | 2 | SCHED-02, SCHED-09 | unit | `jest --testPathPattern=google-calendar-push` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/scheduling/__tests__/slot-calculator.test.js` — stubs for SCHED-01, SCHED-07, SCHED-08
- [ ] `src/lib/scheduling/__tests__/booking.test.js` — stubs for SCHED-04, SCHED-05
- [ ] `src/lib/scheduling/__tests__/google-calendar-push.test.js` — stubs for SCHED-02, SCHED-09
- [ ] `src/lib/scheduling/__tests__/book-appointment-handler.test.js` — stubs for SCHED-05, VOICE-03, VOICE-04

*Existing test infrastructure from Phase 1-2 covers framework setup. Wave 0 adds scheduling-specific test files only.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Google OAuth popup completes | SCHED-02 | Requires live browser + Google consent screen | 1. Click "Connect Google Calendar" 2. Complete OAuth flow 3. Verify connected state shows |
| Calendar event appears within 60s | SCHED-02 | Requires live Google Calendar + push notification delivery | 1. Create event in Google Calendar 2. Wait up to 60s 3. Verify event appears in platform calendar view |
| SCHED-03 (Outlook) | SCHED-03 | Deferred to Phase 5 | N/A — architecture supports future provider addition |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

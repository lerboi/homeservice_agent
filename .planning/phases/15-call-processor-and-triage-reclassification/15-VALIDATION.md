---
phase: 15
slug: call-processor-and-triage-reclassification
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.7.0 (ESM mode) |
| **Config file** | jest.config.js |
| **Quick run command** | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/notifications/caller-sms.test.js tests/call-processor/ -x` |
| **Full suite command** | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --passWithNoTests` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/notifications/caller-sms.test.js tests/call-processor/ tests/i18n/ -x`
- **After every plan wave:** Run `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --passWithNoTests`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | BOOK-04 | unit | `jest tests/notifications/caller-sms.test.js` | ❌ W0 | ⬜ pending |
| 15-01-02 | 01 | 1 | BOOK-04 | unit | `jest tests/notifications/caller-sms.test.js` | ❌ W0 | ⬜ pending |
| 15-01-03 | 01 | 1 | BOOK-04 | unit | `jest tests/notifications/caller-sms.test.js` | ❌ W0 | ⬜ pending |
| 15-02-01 | 02 | 1 | TRIAGE-R01 | unit | `jest tests/call-processor/booking-outcome.test.js` | ❌ W0 | ⬜ pending |
| 15-02-02 | 02 | 1 | TRIAGE-R02 | unit | `jest tests/call-processor/booking-outcome.test.js` | ❌ W0 | ⬜ pending |
| 15-02-03 | 02 | 1 | D-02 | unit | `jest tests/call-processor/booking-outcome.test.js` | ❌ W0 | ⬜ pending |
| 15-02-04 | 02 | 1 | D-02 | unit | `jest tests/call-processor/booking-outcome.test.js` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/notifications/caller-sms.test.js` — stubs for BOOK-04, D-07 (sendCallerSMS unit tests)
- [ ] `tests/call-processor/booking-outcome.test.js` — stubs for TRIAGE-R01, TRIAGE-R02, D-02 (booking_outcome writes, notification_priority mapping)

*Existing `tests/notifications/owner-sms.test.js` and `tests/i18n/translation-keys.test.js` already cover adjacent behaviors and serve as templates.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SMS delivered within 60s | BOOK-04 SC-3 | Requires live Twilio delivery | Make test booking via Retell, verify SMS receipt on phone within 60s |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

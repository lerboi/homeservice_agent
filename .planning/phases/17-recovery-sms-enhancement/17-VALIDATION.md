---
phase: 17
slug: recovery-sms-enhancement
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (ESM via node --experimental-vm-modules) |
| **Config file** | jest.config.js |
| **Quick run command** | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --testPathPattern=tests/notifications` |
| **Full suite command** | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --testPathPattern="tests/notifications\|tests/cron"` |
| **Estimated runtime** | ~8 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --testPathPattern=tests/notifications`
- **After every plan wave:** Run `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --testPathPattern="tests/notifications|tests/cron"`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 17-01-01 | 01 | 0 | RECOVER-01 | unit | `jest --testPathPattern=tests/notifications/recovery-sms` | ❌ W0 | ⬜ pending |
| 17-01-02 | 01 | 1 | RECOVER-01 | unit | `jest --testPathPattern=tests/notifications/recovery-sms` | ❌ W0 | ⬜ pending |
| 17-01-03 | 01 | 1 | RECOVER-02 | unit | `jest --testPathPattern=tests/notifications/recovery-sms` | ❌ W0 | ⬜ pending |
| 17-01-04 | 01 | 2 | RECOVER-03 | unit | `jest --testPathPattern=tests/cron/recovery-retry` | ❌ W0 | ⬜ pending |
| 17-01-05 | 01 | 2 | RECOVER-03 | integration | `jest --testPathPattern=tests/cron/recovery-retry` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/notifications/recovery-sms.test.js` — stubs for RECOVER-01, RECOVER-02 (urgency-aware content, multi-language)
- [ ] `tests/cron/recovery-retry.test.js` — stubs for RECOVER-03 (delivery failure logging, exponential backoff retry)
- [ ] Update existing `tests/notifications/caller-recovery.test.js` — content assertions will break per D-09

*Existing test infrastructure (jest, Twilio/Supabase mocks) covers framework requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SMS delivery within 60s of booking failure | RECOVER-01 | Requires live Retell call + Twilio delivery | 1. Trigger test call 2. Force slot-taken 3. Verify SMS received on phone within 60s |
| Twilio delivery status callback | RECOVER-03 | Requires live Twilio webhook | 1. Send SMS to invalid number 2. Verify status callback updates DB 3. Verify retry fires |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

---
phase: 18
slug: booking-first-hardening-and-qa
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (ESM via node --experimental-vm-modules) |
| **Config file** | jest.config.js |
| **Quick run command** | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --testPathPattern=tests/integration` |
| **Full suite command** | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js` |
| **Estimated runtime** | ~15 seconds (unit), ~30 seconds (integration with real Supabase) |

---

## Sampling Rate

- **After every task commit:** Run quick command for modified test area
- **After every plan wave:** Run full suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 01 | 1 | HARDEN-04 | unit | `grep -c "Sentry.init" sentry.server.config.js` | ❌ W0 | ⬜ pending |
| 18-01-02 | 01 | 1 | HARDEN-04 | unit | `grep -c "test-error" src/app/api/debug/test-error/route.js` | ❌ W0 | ⬜ pending |
| 18-02-01 | 02 | 1 | HARDEN-02 | integration | `jest --testPathPattern=tests/integration/booking-contention` | ❌ W0 | ⬜ pending |
| 18-03-01 | 03 | 2 | HARDEN-03 | unit | `grep -c "test_call" src/app/api/onboarding/test-call/route.js` | ✅ | ⬜ pending |
| 18-03-02 | 03 | 2 | HARDEN-01 | manual | E2E test script review | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/integration/booking-contention.test.js` — stub for HARDEN-02 concurrency test
- [ ] Sentry SDK installed (`@sentry/nextjs` in package.json)

*Existing test infrastructure (jest, mocks) covers framework requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Spanish E2E call flow | HARDEN-01 | Requires live Retell call + real phone | Follow E2E test script: trigger Spanish call, verify booking + SMS + notification |
| English E2E call flow | HARDEN-01 | Requires live Retell call + real phone | Follow E2E test script: trigger English call, verify same flow |
| Onboarding wizard timing | HARDEN-03 | Requires real user interaction | Create new account, complete wizard, verify < 5 min |
| Sentry alert within 60s | HARDEN-04 | Requires Sentry dashboard access | Hit /api/debug/test-error, verify alert in Sentry |
| Test call auto-cancel | HARDEN-03 | Requires live test call | Trigger test call, let AI book, verify booking auto-cancelled |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

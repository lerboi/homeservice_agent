---
phase: 7
slug: unified-signup-and-onboarding-wizard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.7 with `--experimental-vm-modules` |
| **Config file** | package.json `test` script (no standalone jest.config.js) |
| **Quick run command** | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/onboarding/ --passWithNoTests` |
| **Full suite command** | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --passWithNoTests` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/onboarding/ --passWithNoTests`
- **After every plan wave:** Run `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --passWithNoTests`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 0 | WIZARD-02 | unit | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/onboarding/trade-template.test.js -x` | ❌ W0 | ⬜ pending |
| 07-01-02 | 01 | 0 | WIZARD-04 | unit | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/onboarding/auth-step.test.js -x` | ❌ W0 | ⬜ pending |
| 07-01-03 | 01 | 0 | WIZARD-05 | unit | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/onboarding/session-persistence.test.js -x` | ❌ W0 | ⬜ pending |
| 07-01-04 | 01 | 0 | WIZARD-06 | unit | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/onboarding/test-call-status.test.js -x` | ❌ W0 | ⬜ pending |
| 07-01-05 | 01 | 0 | WIZARD-07 | unit | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/onboarding/middleware.test.js -x` | ❌ W0 | ⬜ pending |
| 07-XX-XX | XX | 1+ | WIZARD-01 | smoke | n/a — routing verified by build | manual-only | ⬜ pending |
| 07-XX-XX | XX | 1+ | WIZARD-03 | unit | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/onboarding/wizard-layout.test.js -x` | ❌ deprioritized | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/onboarding/trade-template.test.js` — stubs for WIZARD-02 (trade template shape validation, service pre-population)
- [ ] `tests/onboarding/auth-step.test.js` — stubs for WIZARD-04 (OTP flow: signInWithOtp called with correct email)
- [ ] `tests/onboarding/session-persistence.test.js` — stubs for WIZARD-05 (useWizardSession hook: read/write/clear lifecycle)
- [ ] `tests/onboarding/test-call-status.test.js` — stubs for WIZARD-06 (GET route: returns complete when onboarding_complete=true)
- [ ] `tests/onboarding/middleware.test.js` — stubs for WIZARD-07 (middleware redirect logic)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CTA routes to `/onboarding` | WIZARD-01 | Routing verified by Next.js build + page existence | Navigate to landing page, click any CTA, verify URL is `/onboarding` |
| Progress bar shows step N of 5 | WIZARD-03 | Pure pathname mapping — low-value test | Navigate through each step, visually verify progress bar updates |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

---
phase: 2
slug: onboarding-and-triage
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.7.0 |
| **Config file** | `jest.config.js` |
| **Quick run command** | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --passWithNoTests` |
| **Full suite command** | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --passWithNoTests` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --passWithNoTests`
- **After every plan wave:** Run `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --passWithNoTests`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | ONBOARD-01 | unit | `jest tests/agent/prompt.test.js` | Partial (extend) | ⬜ pending |
| 02-01-02 | 01 | 1 | ONBOARD-01 | unit | `jest tests/agent/retell-config.test.js` | Partial (extend) | ⬜ pending |
| 02-02-01 | 02 | 1 | ONBOARD-02 | integration | `jest tests/onboarding/services.test.js` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | ONBOARD-06 | unit | `jest tests/onboarding/test-call.test.js` | ❌ W0 | ⬜ pending |
| 02-04-01 | 04 | 1 | TRIAGE-01 | unit | `jest tests/triage/layer1.test.js` | ❌ W0 | ⬜ pending |
| 02-04-02 | 04 | 1 | TRIAGE-02 | unit (mock) | `jest tests/triage/classifier.test.js` | ❌ W0 | ⬜ pending |
| 02-04-03 | 04 | 1 | TRIAGE-03 | unit (mock) | `jest tests/triage/classifier.test.js` | ❌ W0 | ⬜ pending |
| 02-05-01 | 05 | 2 | TRIAGE-04 | unit (mock) | `jest tests/webhooks/call-analyzed.test.js` | Partial (extend) | ⬜ pending |
| 02-06-01 | 06 | 1 | VOICE-02 | unit | `jest tests/webhooks/retell-inbound.test.js` | ✅ exists | ⬜ pending |
| 02-06-02 | 06 | 1 | VOICE-07 | unit | `jest tests/webhooks/retell-inbound.test.js` | Partial (extend) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/triage/layer1.test.js` — stubs for TRIAGE-01 keyword classification
- [ ] `tests/triage/classifier.test.js` — stubs for TRIAGE-02, TRIAGE-03 pipeline
- [ ] `tests/onboarding/test-call.test.js` — stubs for ONBOARD-06 test call
- [ ] `tests/onboarding/services.test.js` — stubs for ONBOARD-02 service CRUD
- [ ] `tests/__mocks__/openai.js` — mock for Layer 2 LLM calls

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Google OAuth sign-in flow | ONBOARD-01 | Requires real Google OAuth redirect | 1. Open /onboarding, 2. Click "Sign in with Google", 3. Verify redirect and JWT contains tenant_id |
| Retell outbound test call | ONBOARD-06 | Requires live Retell API and phone | 1. Complete onboarding sprint, 2. Click "Test your AI", 3. Verify phone rings with correct greeting |
| Tone preset voice difference | VOICE-07 | Audio perception test | 1. Set tone to Professional, make test call, 2. Change to Friendly, make test call, 3. Verify audible difference in pace/style |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

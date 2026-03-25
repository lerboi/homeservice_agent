---
phase: 22
slug: billing-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-26
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (existing project configuration) |
| **Config file** | `jest.config.js` |
| **Quick run command** | `npm test -- --testPathPattern=tests/billing` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --testPathPattern=tests/billing`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 22-01-01 | 01 | 0 | BILL-02 | unit | `npm test -- --testPathPattern=billing-schema` | ❌ W0 | ⬜ pending |
| 22-01-02 | 01 | 0 | BILL-03 | unit | `npm test -- --testPathPattern=billing-schema` | ❌ W0 | ⬜ pending |
| 22-02-01 | 02 | 1 | BILL-04 | unit | `npm test -- --testPathPattern=stripe-webhook` | ❌ W0 | ⬜ pending |
| 22-02-02 | 02 | 1 | BILL-05 | unit | `npm test -- --testPathPattern=stripe-webhook` | ❌ W0 | ⬜ pending |
| 22-03-01 | 03 | 2 | BILL-06 | unit | `npm test -- --testPathPattern=trial-activation` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/billing/stripe-webhook.test.js` — stubs for BILL-04, BILL-05 (webhook handler tests)
- [ ] `tests/billing/billing-schema.test.js` — stubs for BILL-02, BILL-03 (subscription table, usage events, webhook events)
- [ ] `tests/billing/trial-activation.test.js` — stubs for BILL-06 (onboarding trial creation)

*Existing jest infrastructure covers framework setup. Only test files are new.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Stripe Checkout redirect flow | BILL-06 | Requires browser interaction with Stripe hosted page | 1. Complete onboarding test call 2. Select plan 3. Verify Stripe Checkout loads 4. Complete with test card 5. Verify redirect to celebration |
| Stripe dashboard product/price creation | BILL-01 | Stripe dashboard configuration, not code | Verify 3 products and 3 prices exist in Stripe test mode with correct amounts |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

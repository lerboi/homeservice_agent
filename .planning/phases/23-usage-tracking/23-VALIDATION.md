---
phase: 23
slug: usage-tracking
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-26
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest (unit tests) + inline node -e checks (file content verification) |
| **Config file** | jest.config.js (project root) |
| **Quick run command** | `npm test -- tests/billing/usage-tracking.test.js` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run the task's inline `<automated>` verify command from the PLAN.md
- **After every plan wave:** Run all verify commands from completed plans
- **Before `/gsd:verify-work`:** All automated verify commands green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 23-01-T1 | 01 | 1 | USAGE-01, USAGE-02 | file-check + parse-check | `node -e "..."` (inline content + syntax verify) | ⬜ pending |
| 23-01-T2 | 01 | 1 | USAGE-01 | unit-test | `npm test -- tests/billing/usage-tracking.test.js` | ⬜ pending |
| 23-01-T3 | 01 | 1 | (skill sync) | file-check | `node -e "..."` (inline content verify) | ⬜ pending |

*Tests are created inline in Task 1 (TDD RED phase) and made GREEN in Task 2. No separate Wave 0 needed.*

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. Tests are created inline via TDD:
- Task 1 creates `tests/billing/usage-tracking.test.js` (RED — tests fail because integration code not yet written)
- Task 2 adds production code to `call-processor.js` (GREEN — tests pass)

No separate Wave 0 plan is needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Concurrent calls produce exact count | USAGE-01 SC-4 | Requires live Supabase with concurrent connections; SQL atomicity (`calls_used = calls_used + 1`) guarantees correctness but cannot be verified in Jest | Fire 2+ simultaneous RPC calls against test DB, verify calls_used increments correctly |
| Billing cycle reset timing | USAGE-03 | Requires Stripe webhook delivery | Trigger invoice.paid webhook with billing_reason=subscription_cycle, verify calls_used=0 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify commands
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Tests created inline via TDD (Task 1 RED, Task 2 GREEN) — no Wave 0 gaps
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved

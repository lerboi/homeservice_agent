---
phase: 22
slug: billing-foundation
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-26
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Inline node -e checks (no test framework in project) |
| **Config file** | N/A — file presence and content checks via node -e |
| **Quick run command** | Per-task `<automated>` verify commands in each PLAN.md |
| **Full suite command** | Run all per-task verify commands sequentially |
| **Estimated runtime** | ~5 seconds (file reads only) |

---

## Sampling Rate

- **After every task commit:** Run the task's inline `<automated>` verify command from the PLAN.md
- **After every plan wave:** Run all verify commands from completed plans
- **Before `/gsd:verify-work`:** All automated verify commands green + human checkpoint (Plan 04 Task 3)
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 22-01-T1 | 01 | 1 | BILL-01 | file-check | `node -e "require('stripe')..."` (inline in plan) | ⬜ pending |
| 22-01-T2 | 01 | 1 | BILL-02, BILL-03 | file-check | `node -e "readFileSync('...010_billing_schema.sql'...)..."` (inline in plan) | ⬜ pending |
| 22-02-T1 | 02 | 2 | BILL-04, BILL-05 | file-check | `node -e "readFileSync('...webhook/route.js'...)..."` (inline in plan) | ⬜ pending |
| 22-03-T1 | 03 | 2 | BILL-06 | file-check | `node -e "readFileSync('...checkout-session/route.js'...)..."` (inline in plan) | ⬜ pending |
| 22-03-T2 | 03 | 2 | BILL-06 | file-check | `node -e "readFileSync('...layout.js'...)..."` (inline in plan) | ⬜ pending |
| 22-04-T1 | 04 | 3 | BILL-06 | file-check | `node -e "readFileSync('...plan/page.js'...)..."` (inline in plan) | ⬜ pending |
| 22-04-T2 | 04 | 3 | BILL-06 | file-check | `node -e "readFileSync('...checkout-success/page.js'...)..."` (inline in plan) | ⬜ pending |
| 22-04-T3 | 04 | 3 | ALL | checkpoint | Human E2E verification (blocking) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

No separate Wave 0 needed — this project has no automated test framework. All verification uses inline `node -e` file-content checks embedded in each plan's `<automated>` verify blocks. These checks validate file presence and key content strings (e.g., table names, function signatures, required imports).

*Full E2E validation is manual via the human checkpoint in Plan 04 Task 3 (Stripe test mode).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Stripe Checkout redirect flow | BILL-06 | Requires browser interaction with Stripe hosted page | 1. Complete onboarding test call 2. Select plan 3. Verify Stripe Checkout loads 4. Complete with test card 5. Verify redirect to celebration |
| Stripe dashboard product/price creation | BILL-01 | Stripe dashboard configuration, not code | Verify 3 products and 3 prices exist in Stripe test mode with correct amounts |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or checkpoint gates
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] No separate Wave 0 needed (inline checks are self-contained)
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved

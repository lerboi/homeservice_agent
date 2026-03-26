---
phase: 23
slug: usage-tracking
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-26
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Inline node -e checks + optional integration tests |
| **Config file** | N/A — file presence and content checks via node -e |
| **Quick run command** | Per-task `<automated>` verify commands in each PLAN.md |
| **Full suite command** | Run all per-task verify commands sequentially |
| **Estimated runtime** | ~5 seconds (file reads only) |

---

## Sampling Rate

- **After every task commit:** Run the task's inline `<automated>` verify command from the PLAN.md
- **After every plan wave:** Run all verify commands from completed plans
- **Before `/gsd:verify-work`:** All automated verify commands green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 23-01-T1 | 01 | 1 | USAGE-01, USAGE-02 | file-check | `node -e "..."` (inline in plan) | ❌ W0 | ⬜ pending |
| 23-02-T1 | 02 | 2 | USAGE-01 | file-check | `node -e "..."` (inline in plan) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Migration file `012_usage_events.sql` — usage_events table with UNIQUE on call_id
- [ ] RPC function `increment_calls_used` — atomic idempotent increment
- [ ] Integration in `processCallEnded()` — duration filter + test call exclusion + RPC call

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Concurrent calls produce exact count | USAGE-01 SC-4 | Requires live Supabase with concurrent connections | Fire 2+ simultaneous RPC calls against test DB, verify calls_used increments correctly |
| Billing cycle reset timing | USAGE-03 | Requires Stripe webhook delivery | Trigger invoice.paid webhook with billing_reason=subscription_cycle, verify calls_used=0 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

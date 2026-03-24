---
phase: 12
slug: dashboard-configurable-triage-and-call-escalation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x / vitest (existing) |
| **Config file** | `jest.config.js` / `vitest.config.js` |
| **Quick run command** | `npm test -- --testPathPattern="triage\|escalation\|services"` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --testPathPattern="triage|escalation|services"`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| *To be filled by planner* | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/api/escalation-contacts.test.js` — CRUD + ordering tests for escalation_contacts API
- [ ] `__tests__/api/services-reorder.test.js` — drag-to-reorder sort_order persistence
- [ ] `__tests__/lib/call-processor-triage.test.js` — urgency-based escalation routing in processCallAnalyzed
- [ ] Migration 006 test — escalation_contacts table + sort_order column on services

*Existing infrastructure covers test runner and fixtures.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag-to-reorder visual feedback | UI-SPEC D-03 | @dnd-kit drag overlay requires visual inspection | Drag a service row, verify ghost overlay follows cursor, drop reorders list |
| Escalation chain SMS/email delivery | D-04/D-05 | Requires real Twilio/SendGrid or sandbox | Trigger test call → verify SMS/email received by chain contacts |
| Agent prompt urgency classification | D-07 | Requires live call or Retell simulator | Make test call with emergency keywords → verify correct escalation path |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

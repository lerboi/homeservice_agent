---
phase: 24
slug: subscription-lifecycle-and-notifications
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-27
---

# Phase 24 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (ESM via --experimental-vm-modules) |
| **Config file** | jest.config.js |
| **Quick run command** | `npm test -- tests/billing/ --passWithNoTests` |
| **Full suite command** | `npm test -- tests/billing/ tests/middleware/ --passWithNoTests` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- tests/billing/ --passWithNoTests`
- **After every plan wave:** Run `npm test -- tests/billing/ tests/middleware/ --passWithNoTests`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 24-01-01 | 01 | 1 | BILLNOTIF-01 | unit | `npm test -- tests/billing/payment-failed-notifications.test.js` | ❌ W0 | ⬜ pending |
| 24-01-02 | 01 | 1 | ENFORCE-03 | unit | `npm test -- tests/billing/grace-period.test.js` | ❌ W0 | ⬜ pending |
| 24-02-01 | 02 | 1 | BILLNOTIF-02 | unit | `npm test -- tests/billing/trial-reminders.test.js` | ❌ W0 | ⬜ pending |
| 24-02-02 | 02 | 1 | BILLNOTIF-03 | unit | `npm test -- tests/billing/trial-will-end.test.js` | ❌ W0 | ⬜ pending |
| 24-03-01 | 03 | 2 | ENFORCE-04 | unit | `npm test -- tests/middleware/subscription-gate.test.js` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/billing/payment-failed-notifications.test.js` — stubs for BILLNOTIF-01
- [ ] `tests/billing/grace-period.test.js` — stubs for ENFORCE-03
- [ ] `tests/billing/trial-reminders.test.js` — stubs for BILLNOTIF-02
- [ ] `tests/billing/trial-will-end.test.js` — stubs for BILLNOTIF-03
- [ ] `tests/middleware/subscription-gate.test.js` — stubs for ENFORCE-04

*Existing test infrastructure (jest, ESM) covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Past-due banner visible in dashboard | ENFORCE-03 | Browser UI rendering | Navigate to dashboard as past_due tenant, verify amber banner with countdown |
| Trial reminder emails render correctly | BILLNOTIF-02 | Email HTML rendering | Trigger day-7 cron, check Resend dashboard for rendered email |
| Middleware redirect to /billing/upgrade | ENFORCE-04 | Full HTTP redirect chain | Navigate to /dashboard as cancelled tenant, verify 302 to /billing/upgrade |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

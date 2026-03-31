---
phase: 33
slug: invoice-core
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-01
---

# Phase 33 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.7.0 |
| **Config file** | `jest.config.js` (root) |
| **Quick run command** | `npm test -- --testPathPattern=invoices` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --testPathPattern=invoice --passWithNoTests`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 33-01-01 | 01 | 0 | INV-01 | unit | `npm test -- --testPathPattern=invoice-calculations` | ❌ W0 | ⬜ pending |
| 33-01-02 | 01 | 0 | INV-02 | unit | `npm test -- --testPathPattern=invoice-calculations` | ❌ W0 | ⬜ pending |
| 33-01-03 | 01 | 0 | INV-03 | unit | `npm test -- --testPathPattern=invoice-number` | ❌ W0 | ⬜ pending |
| 33-01-04 | 01 | 0 | INV-04 | unit | `npm test -- --testPathPattern=invoice-sync` | ❌ W0 | ⬜ pending |
| 33-01-05 | 01 | 0 | INV-05 | unit | `npm test -- --testPathPattern=invoice-overdue` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/invoice-calculations.test.js` — stubs for INV-01, INV-02 (pure functions: line total, tax calculation)
- [ ] `tests/unit/invoice-number.test.js` — stubs for INV-03 (invoice number formatting)
- [ ] `tests/unit/invoice-sync.test.js` — stubs for INV-04 (bidirectional sync guard)

*Existing test infrastructure (Jest 29.7.0) covers framework requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PDF renders correctly with business logo and line items | D-05, D-12 | Visual verification needed | Generate test PDF, open in viewer, check layout/branding |
| Email arrives with PDF attachment, white-labeled | D-09, D-10 | End-to-end email delivery | Send test invoice email, verify in inbox |
| SMS arrives from business phone number | D-11 | Twilio delivery verification | Send test SMS, verify content and sender |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

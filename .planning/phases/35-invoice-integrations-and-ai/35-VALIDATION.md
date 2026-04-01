---
phase: 35
slug: invoice-integrations-and-ai
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-01
---

# Phase 35 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x |
| **Config file** | jest.config.js |
| **Quick run command** | `npx jest --testPathPattern=invoice` |
| **Full suite command** | `npx jest` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --testPathPattern=invoice`
- **After every plan wave:** Run `npx jest`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | D-01 to D-05 | integration | `npx jest --testPathPattern=accounting` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-06 to D-09 | unit | `npx jest --testPathPattern=ai-describe` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-10 to D-11 | integration | `npx jest --testPathPattern=batch-invoice` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/accounting-adapter.test.js` — stubs for adapter interface and platform mapping
- [ ] `tests/unit/ai-describe.test.js` — stubs for transcript-to-description generation
- [ ] `tests/unit/batch-invoice.test.js` — stubs for batch creation and send logic

*Existing invoice calculation and sync tests remain as-is.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| OAuth redirect flow (QBO/Xero/FreshBooks) | D-04 | Requires browser OAuth consent | Click Connect > complete OAuth > verify credentials saved |
| AI description quality | D-07 | Subjective trade-specific language quality | Generate descriptions from sample transcript > review for professional tone |
| Batch send all UX | D-11 | Visual review of batch flow | Select 3+ leads > Create Invoices > review drafts > Send All > verify all delivered |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

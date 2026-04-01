---
phase: 34
slug: estimates-reminders-recurring
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-01
---

# Phase 34 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (existing) |
| **Config file** | jest.config.js |
| **Quick run command** | `npx jest --testPathPattern="estimates\|payment\|reminder\|recurring" --bail` |
| **Full suite command** | `npx jest` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --testPathPattern="estimates\|payment\|reminder\|recurring" --bail`
- **After every plan wave:** Run `npx jest`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| To be populated after planning | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing infrastructure covers all phase requirements. No new test framework or fixtures needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Estimate PDF renders tiered columns correctly | D-02 | Visual layout verification | Open estimate PDF, verify 3 columns show if tiers exist |
| Reminder email/SMS tone escalation | D-13 | Content quality judgment | Trigger each reminder stage, verify tone progression |
| Recurring invoice draft generation | D-17 | Cron timing + review flow | Set up recurring schedule, verify draft appears on schedule |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

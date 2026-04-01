---
phase: 34
slug: estimates-reminders-recurring
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-01
revised: 2026-04-01
---

# Phase 34 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (existing) |
| **Config file** | jest.worktree.config.js |
| **Quick run command** | `npx jest --config jest.worktree.config.js --testPathPattern="estimates\|payment\|late-fee\|recurring" --bail` |
| **Full suite command** | `npx jest --config jest.worktree.config.js` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --config jest.worktree.config.js --testPathPattern="estimates\|payment\|late-fee\|recurring" --bail`
- **After every plan wave:** Run `npx jest --config jest.worktree.config.js`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Wave 0 Test Files

Created by Plan 34-00 (Wave 0):

| Test File | Covers | Production Module | Created By |
|-----------|--------|-------------------|------------|
| `tests/unit/estimate-calculations.test.js` | D-01, D-02, D-07 | `src/lib/estimate-number.js` | 34-00 Task 1 |
| `tests/unit/payment-log.test.js` | D-08, D-09 | `src/lib/payment-calculations.js` | 34-00 Task 1 |
| `tests/unit/late-fee.test.js` | D-14 | `src/lib/late-fee-calculations.js` | 34-00 Task 2 |
| `tests/unit/recurring-schedule.test.js` | D-16, D-17 | `src/lib/recurring-calculations.js` | 34-00 Task 2 |

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 34-00 T1 | 34-00 | 0 | D-01,D-02,D-07,D-08,D-09 | scaffold | `npx jest --config jest.worktree.config.js --testPathPattern="estimate-calculations\|payment-log" --bail` | creates | ⬜ pending |
| 34-00 T2 | 34-00 | 0 | D-14,D-16,D-17 | scaffold | `npx jest --config jest.worktree.config.js --testPathPattern="late-fee\|recurring-schedule" --bail` | creates | ⬜ pending |
| 34-01 T1 | 34-01 | 1 | D-01,D-02,D-04,D-07 | grep | `grep -c "CREATE TABLE" supabase/migrations/030_estimates_schema.sql` | creates | ⬜ pending |
| 34-01 T2 | 34-01 | 1 | D-08,D-09,D-14,D-16 | unit+grep | `npx jest --config jest.worktree.config.js --testPathPattern="estimate-calculations" --bail` | creates | ⬜ pending |
| 34-02 T1 | 34-02 | 2 | D-01,D-02,D-07 | grep | `grep -c "export async function" src/app/api/estimates/route.js` | creates | ⬜ pending |
| 34-02 T2 | 34-02 | 2 | D-04 | grep | `grep "ESTIMATE_STATUS_CONFIG" src/components/dashboard/EstimateStatusBadge.jsx` | creates | ⬜ pending |
| 34-02 T3 | 34-02 | 2 | D-06 | grep | `grep "No estimates yet" src/app/dashboard/estimates/page.js` | creates | ⬜ pending |
| 34-03 T1 | 34-03 | 2 | D-08,D-09 | unit | `npx jest --config jest.worktree.config.js --testPathPattern="payment-log" --bail` | creates | ⬜ pending |
| 34-03 T2 | 34-03 | 2 | D-09,D-10 | grep | `grep "partially_paid" src/components/dashboard/InvoiceStatusBadge.jsx` | modifies | ⬜ pending |
| 34-04 T1 | 34-04 | 3 | D-01,D-02 | grep | `grep "TierEditor\|Add Tier" src/app/dashboard/estimates/new/page.js` | creates | ⬜ pending |
| 34-04 T2 | 34-04 | 3 | D-03 | grep | `grep "EstimatePDF\|generateEstimatePDF" src/lib/estimate-pdf.jsx` | creates | ⬜ pending |
| 34-05 T1 | 34-05 | 4 | D-03,D-05 | grep | `grep -c "export async function" src/app/api/estimates/[id]/send/route.js` | creates | ⬜ pending |
| 34-05 T2 | 34-05 | 4 | D-04,D-06 | grep | `grep "Convert to Invoice" src/app/dashboard/estimates/[id]/page.js` | creates | ⬜ pending |
| 34-06 T1 | 34-06 | 3 | D-14 | unit | `npx jest --config jest.worktree.config.js --testPathPattern="late-fee" --bail` | creates | ⬜ pending |
| 34-06 T2 | 34-06 | 3 | D-12,D-15 | grep | `grep "Send payment reminders" src/components/dashboard/ReminderToggle.jsx` | creates | ⬜ pending |
| 34-07 T1 | 34-07 | 4 | D-16,D-17 | unit | `npx jest --config jest.worktree.config.js --testPathPattern="recurring-schedule" --bail` | creates | ⬜ pending |
| 34-07 T2 | 34-07 | 4 | D-18 | grep | `grep "RecurringBadge\|Make Recurring" src/app/dashboard/invoices/[id]/page.js` | creates/modifies | ⬜ pending |

*Status: ⬜ pending / ✅ green / ❌ red / ⚠️ flaky*

---

## Wave 0 Requirements

- Plan 34-00 creates 4 test scaffold files (RED state — production code does not exist yet)
- Plan 34-01 turns estimate-calculations tests GREEN (creates `src/lib/estimate-number.js`)
- Plan 34-03 turns payment-log tests GREEN (creates `src/lib/payment-calculations.js`)
- Plan 34-06 turns late-fee tests GREEN (creates `src/lib/late-fee-calculations.js`)
- Plan 34-07 turns recurring-schedule tests GREEN (creates `src/lib/recurring-calculations.js`)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Estimate PDF renders tiered columns correctly | D-02 | Visual layout verification | Open estimate PDF, verify 3 columns show if tiers exist |
| Reminder email/SMS tone escalation | D-13 | Content quality judgment | Trigger each reminder stage, verify tone progression |
| Recurring invoice draft generation | D-17 | Cron timing + review flow | Set up recurring schedule, verify draft appears on schedule |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

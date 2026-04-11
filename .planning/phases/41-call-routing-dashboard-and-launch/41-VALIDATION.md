---
phase: 41
slug: call-routing-dashboard-and-launch
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-11
---

# Phase 41 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest (node environment) |
| **Config file** | `jest.config.js` |
| **Quick run command** | `npx jest tests/api/call-routing.test.js --no-coverage` |
| **Full suite command** | `npx jest --no-coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest tests/api/call-routing.test.js --no-coverage`
- **After every plan wave:** Run `npx jest --no-coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 41-01-01 | 01 | 0 | ROUTE-14, ROUTE-15, ROUTE-17 | stub | structural check (file existence + pattern match) | Created in this task (W0) | ⬜ pending |
| 41-01-02 | 01 | 1 | ROUTE-14 | unit | `npx jest tests/api/call-routing.test.js --no-coverage` | ✅ (from 41-01-01) | ⬜ pending |
| 41-01-03 | 01 | 1 | ROUTE-15 | structural | `npx jest tests/api/calls-routing.test.js --no-coverage` | ✅ (from 41-01-01) | ⬜ pending |
| 41-02-01 | 02 | 1 | ROUTE-13 | structural | pattern match on page.js | N/A | ⬜ pending |
| 41-03-01 | 03 | 2 | ROUTE-16 | unit | `npx jest tests/unit/routing-style.test.js --no-coverage` | Created in 41-03-03 | ⬜ pending |
| 41-03-02 | 03 | 2 | ROUTE-17, ROUTE-18 | structural | pattern match on 3 files | N/A | ⬜ pending |
| 41-03-03 | 03 | 2 | ROUTE-16 | unit | `npx jest tests/unit/routing-style.test.js --no-coverage` | Created in this task | ⬜ pending |
| 41-04-01 | 04 | 3 | ROUTE-13 | manual | — | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

All Wave 0 test stubs are created in **Plan 01, Task 1** (first task executed):

- [x] `tests/api/call-routing.test.js` — stubs for ROUTE-14 (GET + PUT validation) and ROUTE-15 (usage null guard) — **Plan 01 Task 1**
- [x] `tests/api/calls-routing.test.js` — verifies calls API includes routing columns and does not filter owner-pickup calls (ROUTE-17) — **Plan 01 Task 1**
- [ ] `tests/unit/routing-style.test.js` — trivial map coverage for ROUTE-16 — **Plan 03 Task 3** (Wave 2, after calls page is modified)
- [ ] Slider component install: `npx shadcn add slider` — required before implementation — **Plan 02 Task 0**
- [ ] Add `call routing` test case to existing `tests/agent/setup-checklist.test.js` — covers ROUTE-18 — **Plan 03 Task 2** (integrated into setup checklist changes)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Schedule editor renders with correct initial state | ROUTE-13 | Visual UI rendering | Open `/dashboard/more/call-routing`, verify day list shows Mon-Sun with toggles and time pickers |
| Owner-pickup call card displays correctly | ROUTE-17 | Visual layout verification | Create owner-pickup call in DB, verify calls page shows "You answered" badge with no transcript/recording sections |
| Usage meter color transitions | ROUTE-15 | Visual CSS transitions | Set usage to 60%, 80%, 95% of cap and verify green/amber/red |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references — test stubs created in Plan 01 Task 1 BEFORE implementation
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

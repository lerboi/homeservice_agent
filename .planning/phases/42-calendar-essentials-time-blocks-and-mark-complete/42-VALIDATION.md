---
phase: 42
slug: calendar-essentials-time-blocks-and-mark-complete
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 42 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x / pytest 7.x (cross-repo) |
| **Config file** | `jest.config.js` (Next.js) / `pytest.ini` (Python agent) |
| **Quick run command** | `npm test -- --testPathPattern="calendar-blocks\|appointments"` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --testPathPattern="calendar-blocks\|appointments"`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 42-01-01 | 01 | 1 | calendar_blocks table | migration | `supabase db reset --dry-run` | ❌ W0 | ⬜ pending |
| 42-01-02 | 01 | 1 | completed_at column | migration | `supabase db reset --dry-run` | ❌ W0 | ⬜ pending |
| 42-02-01 | 02 | 1 | CRUD API routes | integration | `npm test -- --testPathPattern="calendar-blocks"` | ❌ W0 | ⬜ pending |
| 42-02-02 | 02 | 1 | Mark complete PATCH | integration | `npm test -- --testPathPattern="appointments"` | ❌ W0 | ⬜ pending |
| 42-03-01 | 03 | 2 | Time block rendering | visual | Manual — browser check | N/A | ⬜ pending |
| 42-03-02 | 03 | 2 | Completed appointment style | visual | Manual — browser check | N/A | ⬜ pending |
| 42-04-01 | 04 | 2 | Slot calc integration | unit | `npm test -- --testPathPattern="slot-calculator"` | ❌ W0 | ⬜ pending |
| 42-05-01 | 05 | 3 | Python agent integration | unit | `cd livekit-agent && pytest tests/ -k "availability"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/api/calendar-blocks.test.js` — stubs for CRUD operations
- [ ] `tests/api/appointments-complete.test.js` — stubs for mark-complete PATCH + undo
- [ ] `tests/lib/slot-calculator-blocks.test.js` — stubs for time block exclusion in slot calc

*Existing jest infrastructure covers framework needs. No new framework install required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Time block hatched CSS pattern | D-04 | Visual rendering | Create time block, verify diagonal stripe pattern on calendar grid |
| Completed appointment opacity + checkmark | D-09 | Visual rendering | Mark appointment complete, verify 40% opacity + checkmark badge |
| Show completed toggle | D-10 | UI interaction | Toggle off, verify completed appointments disappear; toggle on, verify they reappear |
| Toast + undo flow | D-07 | UI interaction + timing | Mark complete, verify toast appears with undo button, click undo within 5s, verify revert |
| Time block Sheet create/edit/delete | D-01/D-03 | UI interaction | Create block via Sheet, edit by clicking block, delete with undo toast |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

---
phase: 20
slug: dashboard-ux-overhaul
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x |
| **Config file** | jest.config.js |
| **Quick run command** | `npm test -- --passWithNoTests` |
| **Full suite command** | `npm run test:all` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --passWithNoTests`
- **After every plan wave:** Run `npm run test:all`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 20-01-01 | 01 | 1 | SC-01 | manual | Visual: checklist shows required/recommended badges | N/A | ⬜ pending |
| 20-01-02 | 01 | 1 | SC-02 | manual | Visual: expandable items with action buttons | N/A | ⬜ pending |
| 20-02-01 | 02 | 1 | UX-01 | manual | Visual: multi-card layout, quick actions, adaptive home | N/A | ⬜ pending |
| 20-03-01 | 03 | 2 | TOUR-01 | manual | Joyride tour launches and completes all steps | N/A | ⬜ pending |
| 20-04-01 | 04 | 2 | MOB-01 | manual | Bottom tab bar visible on mobile, 44px touch targets | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. This is a UI/UX-only phase — validation is primarily manual visual inspection and interaction testing.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Required vs optional checklist distinction | SC-01 | Visual differentiation | View dashboard home as new user, verify orange "Required" badges on business profile/services/test call items and gray "Recommended" badges on calendar/hours items |
| Joyride tour completes all steps | TOUR-01 | Interactive UI flow | Click "Start Tour", verify tour covers home, leads, calendar, services, settings tabs |
| Mobile bottom tab bar | MOB-01 | Device-specific layout | Resize browser to <1024px, verify bottom tab bar appears with 5 nav items |
| No regressions on existing pages | REG-01 | Full feature coverage | Navigate to leads, analytics, calendar, services, settings — verify all features work |
| Performance on low-end mobile | PERF-01 | Device-specific | Test on throttled connection/CPU in DevTools, verify no lag |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

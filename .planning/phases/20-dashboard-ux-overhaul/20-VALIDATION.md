---
phase: 20
slug: dashboard-ux-overhaul
status: draft
nyquist_compliant: true
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

Each plan task has an inline `<automated>` verify script (node -e file checks). These are Nyquist-compliant automated verifications — they check file existence, required content patterns, and absence of removed patterns without requiring a test framework.

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 20-01-01 | 01 | 1 | SETUP-05 | inline-node | `node -e` checks: BottomTabBar import, pb-[72px], BREADCRUMB_LABELS, data-tour, card wrapper removed, lg:hidden gear icon | N/A | pending |
| 20-01-02 | 01 | 1 | SETUP-05 | inline-node | `node -e` checks: BottomTabBar h-[56px], min-h-[48px], lg:hidden, /dashboard/more; Sidebar no mobileOpen, no /dashboard/services | N/A | pending |
| 20-01-03 | 01 | 1 | SETUP-05 | inline-node | `node -e` checks: card.base and design-tokens import and data-tour on leads, analytics, calendar pages | N/A | pending |
| 20-02-01 | 02 | 1 | SETUP-01 | inline-node | `node -e` checks: MORE_ITEMS, /dashboard/more/services-pricing, ai-voice-settings, card.base, data-tour in page and layout | N/A | pending |
| 20-02-02 | 02 | 1 | SETUP-01, SETUP-03 | inline-node | `node -e` checks: all 7 sub-page files exist with card import, services-pricing no WorkingHoursEditor, ai-voice-settings has SettingsAISection + phoneNumber | N/A | pending |
| 20-02-03 | 02 | 1 | SETUP-01 | inline-node | `node -e` checks: API no /dashboard/settings# hrefs, has /dashboard/more/* hrefs; services and settings pages are redirects | N/A | pending |
| 20-03-01 | 03 | 2 | SETUP-02, SETUP-04 | inline-node | `node -e` checks: ITEM_TYPE, ITEM_DESCRIPTION, conic-gradient, required grouping in SetupChecklist; AnimatePresence, expanded, Required/Recommended badges in ChecklistItem | N/A | pending |
| 20-03-02 | 03 | 2 | SETUP-01, SETUP-04 | inline-node | `node -e` checks: isSetupComplete, card.base, AI Receptionist, Action Required, Next Appointment, This Week, slice(0,5), no WelcomeBanner, data-tour, REQUIRED_IDS | N/A | pending |
| 20-04-01 | 04 | 3 | SETUP-05 | inline-node | `node -e` checks: react-joyride in package.json, DashboardTour has #C2410C, disableAnimation, Got it, gsd_has_seen_tour; layout has DashboardTour + tourRunning; page has start-dashboard-tour | N/A | pending |
| 20-04-02 | 04 | 3 | — | checkpoint | Human verification of full dashboard UX overhaul (15 steps) | N/A | pending |
| 20-04-03 | 04 | 3 | — | inline-node | `node -e` checks: SKILL.md has BottomTabBar, DashboardTour, /dashboard/more, services-pricing, setup/active mode, no hamburger | N/A | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. This is a UI/UX-only phase — no new test scaffolds needed. Each task includes inline `node -e` file-content verification scripts that serve as automated checks.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Required vs optional checklist distinction | SETUP-02 | Visual differentiation | View dashboard home as new user, verify orange "Required" badges on business profile/services/test call items and gray "Recommended" badges on calendar/hours items |
| Joyride tour completes all steps | SETUP-05 | Interactive UI flow | Click "Start Tour", verify tour covers home, leads, calendar, analytics, more tabs |
| Mobile bottom tab bar | SETUP-05 | Device-specific layout | Resize browser to <1024px, verify bottom tab bar appears with 5 nav items |
| No regressions on existing pages | REG-01 | Full feature coverage | Navigate to leads, analytics, calendar — verify all features work; navigate to /dashboard/services and /dashboard/settings — verify redirects work |
| Performance on low-end mobile | PERF-01 | Device-specific | Test on throttled connection/CPU in DevTools, verify no lag |
| Test call button accessible | SETUP-03 | Interactive verification | Navigate to /dashboard/more/ai-voice-settings, verify SettingsAISection renders with test call button |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify (inline node -e scripts)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none — existing infra sufficient)
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

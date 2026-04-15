---
phase: 49
slug: dark-mode-foundation-and-token-migration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-15
---

# Phase 49 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (node env only — no jsdom / RTL) |
| **Config file** | `jest.config.js` |
| **Quick run command** | `npx jest --selectProjects unit --bail` |
| **Full suite command** | `npx jest` |
| **Estimated runtime** | ~45 seconds |

Because jsdom/RTL is not installed, visual behaviors rely on:
- Pure-function tests for any helpers introduced (theme resolver, token lookups)
- Grep-assertion tests (no hardcoded hex drift in migrated files)
- Build-time checks (`npm run build` succeeds with no hydration warnings logged)
- Manual screenshot checklist for dark-mode readability across surfaces

---

## Sampling Rate

- **After every task commit:** Run `npx jest --selectProjects unit --bail`
- **After every plan wave:** Run `npx jest` + `npm run build` + grep-drift assertion
- **Before `/gsd-verify-work`:** Full suite must be green, manual dark-mode screenshot checklist complete
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 49-XX-XX | TBD | TBD | DARK-XX / POLISH-08 | — | N/A | grep / unit / build | `{command}` | ❌ W0 | ⬜ pending |

*Populated by planner when plans are drafted.*

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/dark-mode-hex-audit.test.js` — grep asserts migrated dashboard files contain no disallowed hardcoded hex (AnalyticsCharts.jsx + CalendarView.js excluded — Phase 50 scope)
- [ ] `tests/unit/dark-mode-infra.test.js` — asserts `globals.css` uses fixed `@custom-variant dark (&:where(.dark, .dark *))` selector, ThemeProvider wired without `disableTransitionOnChange`, 150ms body transition present, `suppressHydrationWarning` on `<html>` only
- [ ] `tests/unit/dark-mode-toggle-logic.test.js` — pure function tests for any theme resolver helpers
- [ ] Manual screenshot checklist file: `.planning/phases/49-dark-mode-foundation-and-token-migration/49-DARK-MODE-CHECKLIST.md` — rows for each surface (sidebar, top bar, content bg, bottom tab bar, impersonation banner, trial banner, LeadFlyout, AppointmentFlyout, QuickBookSheet, ChatbotSheet, status badges, urgency pills, LeadStatusPills)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| No flash of light mode on hard reload | DARK-01 | Requires real browser render; jest node env cannot render SSR hydration | Hard reload `/dashboard` 5x in dark mode; record any white flash |
| 150ms body fade on theme toggle | DARK-09 | Requires live CSS transition timing | Toggle theme; verify bg transitions over ~150ms with no jank |
| No hydration warning in console | DARK-01 | Requires React devtools / browser console | Open devtools, toggle theme, reload; console must be empty of hydration warnings |
| Status pill categorical readability | DARK-04 | Contrast + categorical meaning preservation cannot be asserted by grep | Compare pill colors across urgency/status categories against WCAG AA contrast in dark mode |
| LocalStorage persistence across sessions | DARK-08 | Cross-session browser behavior | Toggle to dark, close browser, reopen next day — still dark |
| Every flyout/modal readable in dark | DARK-03, DARK-06, DARK-07 | Visual readability + no hardcoded white bg | Open each flyout/sheet in dark mode; confirm text legible, no white backgrounds |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (grep-drift, custom-variant, screenshot checklist)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter after planner populates the verification map

**Approval:** pending

---
phase: 8
slug: outlook-calendar-sync
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x / vitest |
| **Config file** | jest.config.js or vitest.config.js |
| **Quick run command** | `npm test -- --testPathPattern=outlook` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --testPathPattern=outlook`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | OUTLOOK-01 | integration | `npm test -- --testPathPattern=outlook-calendar` | ❌ W0 | ⬜ pending |
| 08-01-02 | 01 | 1 | OUTLOOK-01 | unit | `npm test -- --testPathPattern=outlook-calendar` | ❌ W0 | ⬜ pending |
| 08-02-01 | 02 | 1 | OUTLOOK-02 | integration | `npm test -- --testPathPattern=outlook-sync` | ❌ W0 | ⬜ pending |
| 08-03-01 | 03 | 2 | OUTLOOK-03 | unit | `npm test -- --testPathPattern=renew-outlook` | ❌ W0 | ⬜ pending |
| 08-04-01 | 04 | 2 | OUTLOOK-04 | integration | `npm test -- --testPathPattern=disconnect` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/outlook-calendar.test.js` — stubs for OUTLOOK-01, OUTLOOK-02
- [ ] `__tests__/outlook-sync.test.js` — stubs for OUTLOOK-02 delta sync
- [ ] `__tests__/renew-outlook-subscriptions.test.js` — stubs for OUTLOOK-03
- [ ] `__tests__/calendar-disconnect.test.js` — stubs for OUTLOOK-04 disconnect flow

*Existing test infrastructure (jest/vitest) assumed available from prior phases.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Microsoft OAuth consent flow end-to-end | OUTLOOK-01 | Requires real Azure AD tenant and browser interaction | 1. Click "Connect Outlook" 2. Complete Microsoft login 3. Grant consent 4. Verify redirect back with connected status |
| Outlook webhook delivery in production | OUTLOOK-02 | Microsoft Graph sends real HTTP notifications to public endpoint | 1. Create event in Outlook 2. Verify webhook fires within 60s 3. Check calendar_events table for new row |
| Subscription auto-renewal over 7-day window | OUTLOOK-03 | Requires waiting for near-expiry or time manipulation | 1. Connect Outlook 2. Check subscription expiry in DB 3. Wait for cron or manually trigger renewal 4. Verify new expiry date |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

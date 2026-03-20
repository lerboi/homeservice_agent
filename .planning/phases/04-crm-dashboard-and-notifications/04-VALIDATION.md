---
phase: 4
slug: crm-dashboard-and-notifications
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts or "none — Wave 0 installs" |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | CRM-01 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | CRM-02 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | CRM-03 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 04-01-04 | 01 | 1 | CRM-04 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 04-01-05 | 01 | 1 | CRM-05 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 1 | TRIAGE-06 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 2 | NOTIF-01 | integration | `npx vitest run` | ❌ W0 | ⬜ pending |
| 04-03-02 | 03 | 2 | NOTIF-02 | integration | `npx vitest run` | ❌ W0 | ⬜ pending |
| 04-03-03 | 03 | 2 | NOTIF-03 | integration | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/leads.test.js` — stubs for CRM-01 through CRM-05
- [ ] `__tests__/notifications.test.js` — stubs for NOTIF-01 through NOTIF-03
- [ ] `__tests__/triage.test.js` — stubs for TRIAGE-06
- [ ] vitest config — if no framework detected

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SMS delivery within 60s | NOTIF-01 | Requires real Twilio send | Trigger booking, verify SMS arrives on phone within 60s |
| Email delivery within 60s | NOTIF-02 | Requires real Resend send | Trigger booking, verify email arrives in inbox within 60s |
| Caller recovery SMS | NOTIF-03 | Requires real Twilio + timing | Simulate hang-up, verify SMS sent within 60s |
| Call recording playback | CRM-02 | Requires Retell audio URL | Open lead detail, click play on recording |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

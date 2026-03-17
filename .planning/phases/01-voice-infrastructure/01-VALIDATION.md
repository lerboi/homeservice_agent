---
phase: 1
slug: voice-infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x / vitest |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm run test:all` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm run test:all`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | VOICE-01 | integration | `npm test -- --grep "webhook"` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | VOICE-08 | integration | `npm test -- --grep "recording"` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 1 | VOICE-09 | integration | `npm test -- --grep "transcript"` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 1 | VOICE-05 | unit | `npm test -- --grep "language"` | ❌ W0 | ⬜ pending |
| 1-02-02 | 02 | 1 | VOICE-06 | unit | `npm test -- --grep "code-switch"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test framework installed (jest or vitest)
- [ ] Test config created
- [ ] Stub test files for webhook, recording, transcript, language detection, code-switching
- [ ] Shared fixtures for Retell webhook payloads and Supabase mocks

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sub-1s call answer | VOICE-01 | Requires live Retell call | Place test call, measure ring-to-answer latency |
| Spanish voice response | VOICE-05 | Requires live STT/TTS | Speak Spanish on test call, verify response language |
| Code-switching handling | VOICE-06 | Requires live conversation | Mix English/Spanish mid-call, verify AI maintains context |
| Recording playback | VOICE-08 | Requires Retell recording pipeline | End test call, verify recording URL is playable |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

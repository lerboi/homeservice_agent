---
phase: 14
slug: booking-first-agent-behavior
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest (ESM mode via `"type": "module"` in package.json) |
| **Config file** | `jest.config.js` (root) — `testMatch: ['**/tests/**/*.test.js']` |
| **Quick run command** | `node node_modules/jest-cli/bin/jest.js tests/agent/ --no-coverage` |
| **Full suite command** | `node node_modules/jest-cli/bin/jest.js --no-coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node node_modules/jest-cli/bin/jest.js tests/agent/ --no-coverage`
- **After every plan wave:** Run `node node_modules/jest-cli/bin/jest.js --no-coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 0 | BOOK-01/03/05 | unit | `node node_modules/jest-cli/bin/jest.js tests/agent/prompt.test.js --no-coverage` | ✅ (extend) | ⬜ pending |
| 14-01-02 | 01 | 0 | BOOK-03 | unit | `node node_modules/jest-cli/bin/jest.js tests/agent/capture-lead-handler.test.js --no-coverage` | ❌ W0 | ⬜ pending |
| 14-01-03 | 01 | 0 | BOOK-05 | unit | `node node_modules/jest-cli/bin/jest.js tests/agent/whisper-message.test.js --no-coverage` | ❌ W0 | ⬜ pending |
| 14-XX-XX | XX | 1 | BOOK-01 | unit | `node node_modules/jest-cli/bin/jest.js tests/agent/prompt.test.js --no-coverage` | ✅ (extend) | ⬜ pending |
| 14-XX-XX | XX | 1 | BOOK-02 | unit | `node node_modules/jest-cli/bin/jest.js tests/agent/prompt.test.js --no-coverage` | ✅ (extend) | ⬜ pending |
| 14-XX-XX | XX | 1 | BOOK-05 | unit | `node node_modules/jest-cli/bin/jest.js tests/agent/whisper-message.test.js --no-coverage` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/agent/capture-lead-handler.test.js` — stubs for BOOK-03 mid-call lead creation via `capture_lead`
- [ ] `tests/agent/whisper-message.test.js` — stubs for BOOK-05 whisper message builder + transfer handler
- [ ] Extend `tests/agent/prompt.test.js` — new assertions for booking-first behavior (BOOK-01), info-only path (BOOK-02), exception-only transfer triggers (BOOK-03)

*Existing test infrastructure covers framework — no new installs needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Emergency caller booked into same-day slot while on the line | BOOK-01 | Requires live Retell call with real-time slot booking | Place test call saying "my pipe burst", verify AI books same-day slot |
| Caller saying "let me talk to a person" is instantly transferred | BOOK-05 | Requires live Retell call with transfer confirmation | Place test call, say transfer phrase, verify immediate transfer with whisper |
| Info-only caller gets answer then soft booking pivot | BOOK-02 | Requires conversational AI behavior verification | Place test call asking pricing, verify AI answers then offers appointment |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

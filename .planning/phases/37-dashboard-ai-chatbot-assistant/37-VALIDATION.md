---
phase: 37
slug: dashboard-ai-chatbot-assistant
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-04
---

# Phase 37 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.7.0 |
| **Config file** | `jest.config.js` (root) |
| **Quick run command** | `npm test -- --testPathPattern=chatbot --passWithNoTests` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --testPathPattern=chatbot --passWithNoTests`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

---

## Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CHAT-01 | `getRelevantKnowledge` returns route-matched doc | unit | `npm test -- --testPathPattern=chatbot-knowledge` | Wave 0 |
| CHAT-02 | `getRelevantKnowledge` returns keyword-matched doc | unit | `npm test -- --testPathPattern=chatbot-knowledge` | Wave 0 |
| CHAT-03 | `getRelevantKnowledge` returns empty string when no match | unit | `npm test -- --testPathPattern=chatbot-knowledge` | Wave 0 |
| CHAT-04 | `parseMessageContent` extracts nav links from LLM response | unit | `npm test -- --testPathPattern=chat-message-parse` | Wave 0 |
| CHAT-05 | `/api/chat` returns 401 without auth | manual smoke | `curl -X POST /api/chat` | Wave 0 |
| CHAT-06 | Chat open state persists across open/close (React state) | manual | UI test in browser | N/A — manual only |

---

## Wave 0 Gaps

- [ ] `tests/unit/chatbot-knowledge.test.js` — covers CHAT-01, CHAT-02, CHAT-03
- [ ] `tests/unit/chat-message-parse.test.js` — covers CHAT-04

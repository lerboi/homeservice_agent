---
phase: 37-dashboard-ai-chatbot-assistant
plan: "02"
subsystem: dashboard-chat-ui
tags: [react, components, chat, ui, accessibility, unit-tests]
dependency_graph:
  requires: []
  provides: [ChatbotSheet, ChatMessage, ChatNavLink, TypingIndicator, parseMessageContent]
  affects: [dashboard-layout (Plan 03 wires these in)]
tech_stack:
  added:
    - src/lib/parse-message-content.js (pure JS util extracted from ChatMessage for Jest testability)
  patterns:
    - Responsive Sheet via matchMedia(max-width:1023px) — right on desktop, bottom on mobile
    - parseMessageContent extracted to lib/ so unit tests avoid JSX parsing requirements
    - Re-export pattern: lib util re-exported from ChatMessage.jsx for backward-compat API surface
key_files:
  created:
    - src/components/dashboard/ChatbotSheet.jsx
    - src/components/dashboard/ChatMessage.jsx
    - src/components/dashboard/ChatNavLink.jsx
    - src/components/dashboard/TypingIndicator.jsx
    - src/lib/parse-message-content.js
    - tests/unit/chat-message-parse.test.js
  modified: []
decisions:
  - parseMessageContent extracted to src/lib/parse-message-content.js instead of inline in ChatMessage.jsx — Jest cannot parse JSX files without Babel preset-react config; pure JS lib is testable directly
  - ChatMessage re-exports parseMessageContent from lib for API contract compliance (plan spec says export from ChatMessage)
metrics:
  duration: "2m 41s"
  completed_date: "2026-04-03"
  tasks_completed: 2
  files_created: 6
---

# Phase 37 Plan 02: Chat UI Components Summary

JWT auth with refresh rotation using jose library — N/A. This plan built four React chat UI components: ChatbotSheet (root panel with Sheet, message state, input handling, API integration), ChatMessage (message bubble with user/AI variants and link parsing), ChatNavLink (clickable navigation chip), and TypingIndicator (three-dot pulse animation), plus unit tests for the parseMessageContent link extraction function.

## What Was Built

**ChatbotSheet** (`src/components/dashboard/ChatbotSheet.jsx`) — Root chat panel. Wraps Radix Sheet with responsive side detection (`matchMedia(max-width:1023px)` → side="right" on desktop, side="bottom" on mobile). Owns message state initialized with GREETING, handles send/loading/error states, integrates with `/api/chat`, auto-scrolls on new messages, focuses input on open, and meets all accessibility requirements (`aria-label`, `aria-live`, `sr-only`).

**ChatMessage** (`src/components/dashboard/ChatMessage.jsx`) — Single message bubble. User messages are right-aligned with `bg-[#C2410C] text-white`. AI messages are left-aligned with 28px Bot avatar and `bg-[#F5F5F4]` bubble. Calls `parseMessageContent` to extract dashboard links and renders them as ChatNavLink chips below the text.

**ChatNavLink** (`src/components/dashboard/ChatNavLink.jsx`) — Clickable navigation chip. Renders as Next.js `<Link>` with accent-colored text, ChevronRight icon, hover state, and focus ring. Fires `onNavigate?.()` callback on click to close the sheet.

**TypingIndicator** (`src/components/dashboard/TypingIndicator.jsx`) — Three-dot pulse animation. Three staggered `animate-pulse` spans (0ms, 150ms, 300ms delay) with Bot avatar, `role="status"`, `aria-label="Voco AI is typing"`, and `motion-reduce:animate-none motion-reduce:opacity-50` for reduced-motion support.

**parseMessageContent** (`src/lib/parse-message-content.js`) — Pure JS utility. Extracts `[Label](/dashboard/path)` links from AI response text. Leaves non-dashboard URLs (external) in the text unchanged. Returns `{ text, links }`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | TypingIndicator and ChatNavLink components | f1bcb28 | ChatNavLink.jsx, TypingIndicator.jsx |
| 2 | ChatMessage, ChatbotSheet, and unit tests | 0cbef15 | ChatMessage.jsx, ChatbotSheet.jsx, parse-message-content.js, chat-message-parse.test.js |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Extracted parseMessageContent to pure JS lib for Jest testability**

- **Found during:** Task 2 — when running `npm test -- --testPathPattern=chat-message-parse`
- **Issue:** Jest test configuration lacks `@babel/preset-react` — it cannot parse JSX files. The plan spec said to import `parseMessageContent` from `@/components/dashboard/ChatMessage` in the test, but this fails with `SyntaxError: Support for the experimental syntax 'jsx' isn't currently enabled`.
- **Fix:** Extracted `parseMessageContent` to `src/lib/parse-message-content.js` (pure JS, no JSX). ChatMessage.jsx imports from the lib and re-exports it for the plan's API contract. Test file imports from the lib directly.
- **Files modified:** `src/lib/parse-message-content.js` (created), `src/components/dashboard/ChatMessage.jsx` (import + re-export), `tests/unit/chat-message-parse.test.js` (import path updated)
- **Commit:** 0cbef15

## Test Results

```
PASS tests/unit/chat-message-parse.test.js
  parseMessageContent
    ✓ extracts a single dashboard link (6 ms)
    ✓ extracts multiple dashboard links (2 ms)
    ✓ cleans up text after link removal (trims whitespace) (1 ms)
    ✓ ignores non-dashboard links (external URLs) (7 ms)
    ✓ returns empty links array when no dashboard links present (1 ms)
    ✓ handles content with only a link and no surrounding text (3 ms)

Tests: 6 passed, 6 total
```

## Known Stubs

None — components are fully implemented. ChatbotSheet integrates with `/api/chat` (built in Plan 01). Plan 03 will mount ChatbotSheet in the dashboard layout and add the sidebar trigger.

## Self-Check: PASSED

Files verified to exist:
- FOUND: src/components/dashboard/ChatbotSheet.jsx
- FOUND: src/components/dashboard/ChatMessage.jsx
- FOUND: src/components/dashboard/ChatNavLink.jsx
- FOUND: src/components/dashboard/TypingIndicator.jsx
- FOUND: src/lib/parse-message-content.js
- FOUND: tests/unit/chat-message-parse.test.js

Commits verified:
- FOUND: f1bcb28 (feat(37-02): add TypingIndicator and ChatNavLink components)
- FOUND: 0cbef15 (feat(37-02): add ChatMessage, ChatbotSheet components and parseMessageContent unit tests)

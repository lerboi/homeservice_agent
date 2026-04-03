---
phase: 37-dashboard-ai-chatbot-assistant
plan: 03
subsystem: ui
tags: [react, nextjs, chatbot, dashboard, window-events]

# Dependency graph
requires:
  - phase: 37-01
    provides: RAG knowledge base and /api/chat Groq route
  - phase: 37-02
    provides: ChatbotSheet, ChatMessage, ChatNavLink, TypingIndicator components
provides:
  - ChatbotSheet mounted at dashboard layout level with always-on rendering
  - open-voco-chat window event wired from layout listener to open chatbot
  - Desktop trigger: "Ask Voco AI" button in DashboardSidebar between Separator and Logout
  - Mobile trigger: "Ask Voco AI" item at top of More page (lg:hidden)
  - dashboard-crm-system SKILL.md updated with chatbot architecture documentation
affects: [dashboard, sidebar, more-page, chatbot]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Window event bus pattern: dispatchers in child components fire custom events; layout.js holds single listener and state — no prop drilling"
    - "Always-mounted sheet: ChatbotSheet never conditionally rendered; open prop controls visibility to preserve message history"

key-files:
  created: []
  modified:
    - src/app/dashboard/layout.js
    - src/components/dashboard/DashboardSidebar.jsx
    - src/app/dashboard/more/page.js
    - .claude/skills/dashboard-crm-system/SKILL.md

key-decisions:
  - "ChatbotSheet mounted unconditionally at layout level (not inside {chatOpen && ...}) to preserve React state and message history across open/close cycles"
  - "Window event pattern (open-voco-chat) mirrors existing start-dashboard-tour pattern — consistent cross-component communication without prop drilling"

patterns-established:
  - "Window event bus: child components dispatch events, layout.js holds state — extends the DashboardTour pattern"
  - "Always-mounted modal pattern: open prop controls Sheet visibility, component stays in DOM"

requirements-completed: [CHAT-05]

# Metrics
duration: 15min
completed: 2026-04-04
---

# Phase 37 Plan 03: Dashboard AI Chatbot Integration Summary

**ChatbotSheet wired into dashboard layout with sidebar (desktop) and More page (mobile) triggers using window event bus pattern matching the existing DashboardTour architecture**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-04T00:00:00Z
- **Completed:** 2026-04-04T00:15:00Z
- **Tasks:** 2 of 3 (Task 3 is checkpoint:human-verify — paused for user verification)
- **Files modified:** 4

## Accomplishments
- ChatbotSheet imported and mounted always-on in dashboard layout with chatOpen state and open-voco-chat event listener
- DashboardSidebar gains "Ask Voco AI" button between Separator and Logout with MessageSquare icon and matching inactive NavLink styling
- More page gains "Ask Voco AI" as first item (lg:hidden, mobile-only) with accent orange icon background, min-h-[48px] touch target, and descriptive subtitle
- dashboard-crm-system SKILL.md updated with complete AI Chatbot Assistant section covering components, API route, knowledge base, and trigger patterns
- `npm run build` completes without errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Mount ChatbotSheet in layout and add sidebar trigger** - `d7db141` (feat)
2. **Task 2: Add mobile trigger to More page and update dashboard-crm-system SKILL.md** - `52b20a1` (feat)
3. **Task 3: Verify chatbot end-to-end** - checkpoint:human-verify (paused)

## Files Created/Modified
- `src/app/dashboard/layout.js` - Added ChatbotSheet import, chatOpen state, open-voco-chat event listener, and always-mounted ChatbotSheet render
- `src/components/dashboard/DashboardSidebar.jsx` - Added MessageSquare import and "Ask Voco AI" trigger button between Separator and Logout
- `src/app/dashboard/more/page.js` - Added MessageSquare import and "Ask Voco AI" mobile trigger card above QUICK_ACCESS section
- `.claude/skills/dashboard-crm-system/SKILL.md` - Added AI Chatbot Assistant section with component docs, API route, knowledge base, and trigger patterns

## Decisions Made
- ChatbotSheet is never conditionally rendered (no `{chatOpen && <ChatbotSheet>}`) — always mounted so React state (message history) persists across open/close cycles within a session
- Window event pattern (`open-voco-chat`) mirrors the existing `start-dashboard-tour` pattern — consistent architecture, zero prop drilling through page components

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

**GROQ_API_KEY required for chat completions.** Add to environment:

```
GROQ_API_KEY=<your key>
```

Source: Groq Console (console.groq.com) → API Keys → Create API Key

## Checkpoint: Human Verification Required

**Task 3 paused at checkpoint:human-verify**

What was built across Plans 01-03:
- Backend: RAG knowledge base (10 markdown docs) + `/api/chat` Groq route (Plan 01)
- Frontend: ChatbotSheet, ChatMessage, ChatNavLink, TypingIndicator components (Plan 02)
- Integration: Layout mounting + sidebar + More page triggers (Plan 03, this plan)

Verification steps:
1. Open `http://localhost:3000/dashboard` on desktop
2. Verify "Ask Voco AI" button in sidebar between separator and Log Out (MessageSquare icon)
3. Click it — right-side sheet slides in with "Voco AI" header, "Help & Navigation" badge, greeting message, input field, and orange Send button
4. Type "How do I create an invoice?" + Enter — typing indicator appears, AI responds with navigation chip
5. Click navigation chip — sheet closes and navigates to target page
6. Click "Ask Voco AI" again — previous messages still present (session persistence)
7. Press Esc or click overlay — sheet closes
8. Resize to mobile (< 1024px), go to More page
9. Verify "Ask Voco AI" appears above Invoices/Estimates with accent orange icon
10. Tap it — bottom sheet slides up from bottom (85vh, rounded top corners)

## Next Phase Readiness
- Full chatbot system is live: backend + frontend + triggers all wired
- Requires GROQ_API_KEY in environment to actually call the AI
- Human verification (Task 3) is the final gate before Phase 37 is complete

---
*Phase: 37-dashboard-ai-chatbot-assistant*
*Completed: 2026-04-04*

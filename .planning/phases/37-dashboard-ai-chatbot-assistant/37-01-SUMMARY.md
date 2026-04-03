---
phase: 37-dashboard-ai-chatbot-assistant
plan: 01
subsystem: api
tags: [groq, llm, rag, knowledge-base, markdown, next-js, api-route]

# Dependency graph
requires: []
provides:
  - "getRelevantKnowledge function — keyword+route RAG retrieval from static markdown docs"
  - "POST /api/chat route — tenant auth, RAG knowledge injection, Groq Llama chat completion"
  - "10 markdown knowledge docs covering all dashboard areas"
  - "Unit tests for RAG retrieval (6 tests, all passing)"
affects:
  - "37-02 (chat UI components — ChatbotSheet calls this API route)"
  - "dashboard-crm-system skill (new API route and knowledge dir)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Keyword+route RAG: route doc as priority, keyword match adds 1 additional doc (max 2 total)"
    - "KEYWORD_DOC_MAP ordered so more-specific terms (billing) appear before overlapping substrings (bill)"
    - "Groq OpenAI-compatible client singleton via getGroqClient() — same pattern as layer2-llm.js"
    - "GROQ_API_KEY null check returns 503 before any auth check — fast fail for misconfiguration"

key-files:
  created:
    - "src/lib/chatbot-knowledge/index.js — getRelevantKnowledge with ROUTE_DOC_MAP and KEYWORD_DOC_MAP"
    - "src/lib/chatbot-knowledge/getting-started.md"
    - "src/lib/chatbot-knowledge/leads.md"
    - "src/lib/chatbot-knowledge/calls.md"
    - "src/lib/chatbot-knowledge/calendar.md"
    - "src/lib/chatbot-knowledge/invoices.md"
    - "src/lib/chatbot-knowledge/estimates.md"
    - "src/lib/chatbot-knowledge/analytics.md"
    - "src/lib/chatbot-knowledge/billing.md"
    - "src/lib/chatbot-knowledge/settings.md"
    - "src/lib/chatbot-knowledge/integrations.md"
    - "src/app/api/chat/route.js — POST handler with auth, RAG, Groq"
    - "tests/unit/chatbot-knowledge.test.js — 6 unit tests for getRelevantKnowledge"
  modified: []

key-decisions:
  - "KEYWORD_DOC_MAP places billing before invoices so 'billing' string matches billing.md, not invoices.md's 'bill' keyword"
  - "No edge runtime export — Node.js runtime required for readFileSync in getRelevantKnowledge"
  - "GROQ_API_KEY check placed before auth check (503 > 401) — misconfiguration is a server error, not user error"
  - "history.slice(-10) caps context window cost at 10 turns per Groq call"

patterns-established:
  - "RAG retrieval: route match provides 1 doc, keyword match adds at most 1 more (max 2 docs total)"
  - "Knowledge doc structure: # Area, ## What this section does, ## Key features, ## How to navigate here, ## Common tasks, ## Related sections"

requirements-completed: [CHAT-01, CHAT-02, CHAT-03]

# Metrics
duration: 5min
completed: 2026-04-03
---

# Phase 37 Plan 01: Chatbot Knowledge Base and API Route Summary

**Static markdown knowledge base (10 docs) with keyword+route RAG retrieval and POST /api/chat Groq integration backing the Voco AI dashboard assistant**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-03T19:06:25Z
- **Completed:** 2026-04-03T19:10:48Z
- **Tasks:** 2 of 2
- **Files modified:** 13 created

## Accomplishments
- 10 markdown knowledge docs created in `src/lib/chatbot-knowledge/` covering all dashboard areas (getting-started, leads, calls, calendar, invoices, estimates, analytics, billing, settings, integrations)
- `getRelevantKnowledge(message, currentRoute)` RAG function with ROUTE_DOC_MAP (14 entries) and KEYWORD_DOC_MAP (9 groups), returning max 2 docs
- `POST /api/chat` route with tenant auth guard, GROQ_API_KEY null check (503), empty message validation (400), RAG injection, Groq Llama 4 Scout call, history capped at 10
- All 6 unit tests pass (route match, keyword match, fallback, dual-doc, cap at 2, unknown route fallback)

## Task Commits

1. **Task 1: Knowledge base markdown docs, RAG retrieval function, and unit tests** - `e47197a` (feat)
2. **Task 2: POST /api/chat route with Groq integration** - `9ce6651` (feat)

## Files Created/Modified
- `src/lib/chatbot-knowledge/index.js` — getRelevantKnowledge with ROUTE_DOC_MAP and KEYWORD_DOC_MAP
- `src/lib/chatbot-knowledge/getting-started.md` — Dashboard overview and setup checklist
- `src/lib/chatbot-knowledge/leads.md` — Lead lifecycle, Kanban, flyout, filtering
- `src/lib/chatbot-knowledge/calls.md` — Call log, transcripts, recordings, triage labels
- `src/lib/chatbot-knowledge/calendar.md` — Appointments, calendar sync, working hours
- `src/lib/chatbot-knowledge/invoices.md` — Create/send/track invoices, PDF, payment status
- `src/lib/chatbot-knowledge/estimates.md` — Good/better/best tiers, convert to invoice
- `src/lib/chatbot-knowledge/analytics.md` — Revenue charts, conversion funnel, pipeline
- `src/lib/chatbot-knowledge/billing.md` — Plan details, usage meter, upgrade, Stripe portal
- `src/lib/chatbot-knowledge/settings.md` — Services, working hours, zones, notifications, AI voice
- `src/lib/chatbot-knowledge/integrations.md` — QuickBooks/Xero sync, calendar connections
- `src/app/api/chat/route.js` — POST handler: auth, RAG, Groq Llama 4 Scout
- `tests/unit/chatbot-knowledge.test.js` — 6 unit tests for getRelevantKnowledge

## Decisions Made
- **KEYWORD_DOC_MAP ordering:** billing entry placed before invoices to prevent `'billing'` substring from matching the invoices group's `'bill'` keyword. Discovered during TDD RED→GREEN phase.
- **No edge runtime export:** Node.js runtime is required because `getRelevantKnowledge` uses `readFileSync` from `fs`. Adding `export const runtime = 'edge'` would break the fs import.
- **503 before 401:** GROQ_API_KEY null check is placed before the auth check — a misconfigured server is a 503 server error, not a 401 user error.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] KEYWORD_DOC_MAP reordered to fix 'billing' keyword collision**
- **Found during:** Task 1 (TDD GREEN phase — Test 4 failing)
- **Issue:** Message "tell me about billing" was matching invoices.md because the `'bill'` keyword in the invoices group is a substring of `'billing'`. The billing entry appeared after invoices in the original map.
- **Fix:** Moved billing entry before invoices in KEYWORD_DOC_MAP so `'billing'` hits the billing group first.
- **Files modified:** `src/lib/chatbot-knowledge/index.js`
- **Verification:** All 6 tests pass after fix, including Test 4 (dual-doc with billing keyword)
- **Committed in:** e47197a (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Required for correct RAG behavior — billing-related questions would have returned invoices docs instead of billing docs without this fix.

## Issues Encountered
None beyond the keyword ordering bug which was caught by the TDD test suite and fixed immediately.

## User Setup Required
None — no new external services. `GROQ_API_KEY` is already used by `layer2-llm.js` and must already be set. No new env vars required.

## Next Phase Readiness
- Plan 02 (chat UI components) can now call `POST /api/chat` with `{ message, currentRoute, history }`
- API returns `{ reply: string }` — simple contract for the ChatbotSheet component to consume
- All 6 RAG unit tests are green as a regression baseline

---
*Phase: 37-dashboard-ai-chatbot-assistant*
*Completed: 2026-04-03*

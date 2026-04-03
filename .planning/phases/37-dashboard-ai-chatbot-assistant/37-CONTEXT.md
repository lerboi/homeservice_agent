# Phase 37: Dashboard AI Chatbot Assistant - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Phase Boundary

An AI-powered chatbot assistant embedded in the dashboard that answers business owner questions about platform features and usage. Powered by Groq (Llama) with a static markdown knowledge base. Can answer questions and provide navigation links — does NOT perform actions (create/edit/delete). Session-only history (React state).

</domain>

<decisions>
## Implementation Decisions

### Trigger & Placement
- **D-01:** Desktop — "Ask Voco AI" button pinned at the bottom of the dark sidebar, between the nav items separator and the Log Out button. Small chat icon + label, same styling as existing sidebar links.
- **D-02:** Mobile — "Ask Voco AI" as the first item in the More page (above Invoices/Estimates quick access section). Tapping opens the chat. No floating button, no extra tab — zero interference with daily tasks.

### Chat Window Style
- **D-03:** Desktop — Right-side Sheet panel (same `Sheet` component pattern as LeadFlyout, `side="right"`). Dashboard content stays visible (dimmed overlay). User can glance at their data while chatting.
- **D-04:** Mobile — Bottom sheet (85vh) with rounded top corners (`side="bottom"`, `max-h-[85vh]`, `rounded-t-2xl`). User can swipe down to dismiss. Quick-help feel, not a full page takeover.

### LLM & RAG Backend
- **D-05:** LLM — Groq API with Llama model. Already have `GROQ_API_KEY` and the `openai` package (AsyncOpenAI compatible client) used in the Python triage agent. For the Next.js API route, use the `openai` npm package pointing at Groq's base URL.
- **D-06:** RAG — Static markdown knowledge docs stored in `src/lib/chatbot-knowledge/`. One file per dashboard area (leads.md, calendar.md, invoices.md, etc.). At runtime: keyword-match the user's question to relevant doc files, inject matched sections into the system prompt. No vector DB, no embeddings.
- **D-07:** Page context — Pass the user's current route (e.g. `/dashboard/invoices`) to the API. The chatbot prioritizes knowledge about the current page, making answers contextually relevant ("How do I filter?" answers differently on Leads vs Calls).

### Conversation Scope
- **D-08:** Capabilities — Answer questions + provide navigation links. The chatbot explains features, guides workflows, and offers clickable "Go to [Page]" links. Does NOT perform dashboard actions (create invoice, book appointment, change settings). Action capability deferred to future phase.
- **D-09:** History — Session-only via React state. Messages persist while the dashboard tab is open. Closing/refreshing clears history. No database storage for chat messages.

### Claude's Discretion
- Chat UI component design (message bubbles, typing indicator, input styling)
- System prompt engineering and knowledge doc structure
- Keyword matching algorithm for RAG retrieval
- Greeting message and personality/tone
- Error handling for Groq API failures (fallback message)
- Navigation link formatting in responses

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### UI Patterns
- `src/components/ui/sheet.jsx` — Sheet component (supports side="right" and side="bottom")
- `src/components/dashboard/DashboardSidebar.jsx` — Sidebar nav where desktop trigger goes (below nav items, above logout)
- `src/components/dashboard/CommandPalette.jsx` — Existing overlay pattern with keyboard trigger and search UX
- `src/app/dashboard/more/page.js` — More page where mobile trigger goes (QUICK_ACCESS array at top)
- `src/app/dashboard/layout.js` — Dashboard layout where Sheet and state would mount

### Backend Patterns
- `src/lib/get-tenant-id.js` — Auth pattern for API routes
- `src/app/api/search/route.js` — Example of a simple API route with tenant auth that queries multiple tables

### Design System
- `src/lib/design-tokens.js` — Brand colors, card styles, button styles

### Existing Groq Usage (Python agent — reference for API pattern)
- `livekit-agent/src/lib/triage/layer2_llm.py` — Uses AsyncOpenAI client pointing at Groq base URL

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Sheet` component — already supports `side="right"` and `side="bottom"`, used throughout dashboard
- `Input` component — for chat input field
- `Button` component — for send button and navigation links
- `Skeleton` component — for loading states
- Design tokens (`card`, `btn`, `colors`) — for consistent styling
- `openai` npm package (v6.32.0) — already installed, can point at Groq API base URL

### Established Patterns
- Sidebar items: `NavLink` component with icon + label, styled with `text-white/60` inactive / `text-white` active
- More page quick access: `QUICK_ACCESS` array with `{ href, label, description, icon }` objects, `lg:hidden` for mobile-only
- Sheet usage: LeadFlyout, AppointmentFlyout, CommandPalette all mount at layout level
- API routes: `getTenantId()` for auth, `Response.json()` for responses

### Integration Points
- `DashboardSidebar.jsx` — Add chat trigger button between separator and logout
- `more/page.js` — Add "Ask Voco AI" to QUICK_ACCESS array (or as a separate prominent item above it)
- `dashboard/layout.js` — Mount the chat Sheet component and manage open/close state
- New API route: `src/app/api/chat/route.js` — POST handler that receives message + current route, queries knowledge base, calls Groq, returns response
- New knowledge dir: `src/lib/chatbot-knowledge/` — markdown files per dashboard area

</code_context>

<specifics>
## Specific Ideas

- The chatbot is called "Voco AI" — consistent with the brand
- Navigation links in responses should be actual clickable elements (not just text), implemented as in-message buttons
- The chat should feel lightweight and helpful, like asking a knowledgeable colleague — not a corporate support bot
- On mobile, the 85vh bottom sheet should feel like a native messaging app

</specifics>

<deferred>
## Deferred Ideas

- **Action capabilities** — Chatbot performing dashboard actions (create invoice, book appointment, change settings). Deferred to future phase pending user demand signal.
- **Persistent chat history** — Storing conversations in Supabase across sessions. Not needed for a help chatbot.
- **Cmd+K integration** — Extending CommandPalette with an "Ask AI" mode. Could be explored later as an alternative trigger.
- **Vector DB / pgvector RAG** — If the knowledge base grows beyond ~30 docs or users ask semantically ambiguous questions, upgrade to embedding-based retrieval.

</deferred>

---

*Phase: 37-dashboard-ai-chatbot-assistant*
*Context gathered: 2026-04-04*

# Phase 37: Dashboard AI Chatbot Assistant - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-04
**Phase:** 37-dashboard-ai-chatbot-assistant
**Areas discussed:** Trigger & Placement, Chat Window Style, LLM & RAG Backend, Conversation Scope

---

## Trigger & Placement

### Desktop Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar bottom icon | Chat icon pinned at bottom of dark sidebar, above logout | ✓ |
| Floating circle (bottom-right) | Classic FAB in content area corner | |
| Cmd+K integration | Extend existing CommandPalette with AI mode | |

**User's choice:** Sidebar bottom icon
**Notes:** Non-obstructive, always visible, consistent with Intercom/Zendesk placement patterns

### Mobile Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Inside More tab | First item in More page, opens chat overlay | ✓ |
| Header bar icon | Help icon in top-right of mobile content area | |
| 6th bottom tab | Add AI tab to bottom bar | |

**User's choice:** Inside More tab
**Notes:** User explicitly stated no floating fixed button on mobile — would hinder actual dashboard tasks

---

## Chat Window Style

### Desktop Window

| Option | Description | Selected |
|--------|-------------|----------|
| Right-side Sheet panel | Slides in from right, content dimmed behind | ✓ |
| Popover chat bubble | Smaller popup from sidebar button | |
| Full-screen overlay | Takes over entire content area | |

**User's choice:** Right-side Sheet panel
**Notes:** Same pattern as LeadFlyout — user can reference dashboard data while chatting

### Mobile Window

| Option | Description | Selected |
|--------|-------------|----------|
| Full-screen page | Opens as new page with back button | |
| Bottom sheet (85vh) | Slides up covering 85% of screen | ✓ |

**User's choice:** Bottom sheet (85vh)
**Notes:** Quick-help feel, easy dismiss by swiping down

---

## LLM & RAG Backend

### LLM Choice

| Option | Description | Selected |
|--------|-------------|----------|
| Claude API (Haiku) | Anthropic ecosystem, excellent instruction following | |
| OpenAI API (GPT-4o-mini) | Cheap, fast, openai package already installed | |
| Groq (Llama) | Ultra-fast, already have API key from triage | ✓ |

**User's choice:** Groq (Llama)
**Notes:** Already have GROQ_API_KEY and client pattern from triage system

### RAG Storage

| Option | Description | Selected |
|--------|-------------|----------|
| Static markdown docs | Write docs per feature area, keyword match at runtime | ✓ |
| Supabase pgvector | Vector embeddings for semantic search | |
| Hardcoded system prompt | All knowledge in one prompt | |

**User's choice:** Static markdown docs
**Notes:** User asked about pgvector vs skill files. Advised that for a bounded domain (~20-30 docs covering known dashboard features), keyword matching on markdown files is simpler, cheaper, and equally accurate. pgvector deferred as upgrade path if domain grows.

### Page Context

| Option | Description | Selected |
|--------|-------------|----------|
| Page-aware | Pass current route to tailor answers | ✓ |
| General only | No page context, generic answers | |

**User's choice:** Page-aware
**Notes:** Enables contextual answers — "How do I filter?" responds differently on Invoices vs Leads

---

## Conversation Scope

### Capabilities

| Option | Description | Selected |
|--------|-------------|----------|
| Answer only | Purely informational, no actions | |
| Answer + navigate | Answers + clickable navigation links | ✓ |
| Answer + navigate + actions | Full assistant that can perform dashboard actions | |

**User's choice:** Answer + navigate
**Notes:** User initially asked if actions would provide better UX. Discussed risks: confirmation UX complexity, scope explosion, accuracy/trust risk, maintenance burden. Agreed that navigate covers 90% of value with 20% of complexity. Actions deferred to future phase.

### Chat History

| Option | Description | Selected |
|--------|-------------|----------|
| No history | Fresh start every time chat opens | |
| Session history | Persists in React state while tab is open | ✓ |
| Persistent history | Saved to Supabase across sessions | |

**User's choice:** Session history (React state)
**Notes:** Messages persist while dashboard tab is open. Closing/refreshing clears. No DB storage needed.

---

## Claude's Discretion

- Chat UI component design (message bubbles, typing indicator, input styling)
- System prompt engineering and knowledge doc structure
- Keyword matching algorithm for RAG retrieval
- Greeting message and personality/tone
- Error handling for Groq API failures

## Deferred Ideas

- **Action capabilities** — Performing dashboard actions from chat (future phase)
- **Persistent chat history** — DB storage for conversations across sessions
- **Cmd+K AI mode** — Extending CommandPalette with chatbot integration
- **pgvector RAG** — Upgrade path if knowledge base grows beyond ~30 docs

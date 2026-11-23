---
type: system
system: Dashboard and CRM
status: legacy-app
description: "Chatbot - ChatbotSheet. Covers: RAG knowledge"
source: .claude/skills/dashboard-crm-system/SKILL.md § 15. Chatbot — ChatbotSheet
migrated: 2026-11-23
verified:
tags: [voco/system/dashboard-and-crm]
---

# Chatbot - ChatbotSheet

Part of [[Dashboard and CRM]]. Migrated verbatim from the `dashboard-crm-system` skill; check `verified` before trusting details.

**File**: `src/components/dashboard/ChatbotSheet.jsx`

Sheet wrapper. Mounted in layout under `ChatProvider` for cross-route
persistence. Opened via `open-voco-chat` window event.

- **Responsive**: right Sheet on desktop, bottom Sheet on mobile.
- **`ChatMessage`**: user/AI variants. `parseMessageContent()` extracts
  links; `ChatNavLink` renders Next.js Link chips with onNavigate
  callback.
- **`TypingIndicator`**: three-dot pulse, `role="status"`, reduced-motion
  support.
- **API**: `POST /api/chat` — auth via `getTenantId()`, RAG retrieval,
  Groq Llama 4 Scout completion.

### RAG knowledge

**File**: `src/lib/chatbot-knowledge/index.js`

- `ROUTE_DOC_MAP` (14 routes) — matches pathname.
- `KEYWORD_DOC_MAP` (9 keyword groups) — keyword search in user
  message.
- Returns up to 2 matched docs.
- Phase 52 reframed 8 markdown docs: `/dashboard/jobs` URLs + "Jobs"
  noun throughout.

---

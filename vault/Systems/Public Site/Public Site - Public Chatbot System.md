---
type: system
system: Public Site
status: pending-rebuild
description: "A public-facing AI chatbot available on all public pages, allowing visitors to ask questions about Voco before signing up. Covers: PublicChatButton (`src/components/landing/PublicChatButton.jsx`); PublicChatPanel (`src/components/landing/PublicChatPanel.jsx`); Public Chat API (`src/app/api/public-ch"
source: .claude/skills/public-site-i18n/SKILL.md § 10. Public Chatbot System
migrated: 2026-11-23
verified:
tags: [voco/system/public-site]
---

# Public Chatbot System

Part of [[Public Site]]. Migrated verbatim from the `public-site-i18n` skill; check `verified` before trusting details.

A public-facing AI chatbot available on all public pages, allowing visitors to ask questions about Voco before signing up.

### PublicChatButton (`src/components/landing/PublicChatButton.jsx`)

`'use client'`. Floating action button (FAB) fixed to the bottom-right corner of all public pages. Mounted via direct import in `src/app/(public)/layout.js`.

**FAB**: 64px round button (`h-16 w-16`), `bg-[#C2410C]` (brand orange), Headset icon (Lucide). Toggles to X icon when chat is open. Mount animation: `scale-0 opacity-0` → `scale-100 opacity-100` via 100ms delayed `setTimeout` + CSS `transition-all duration-300`.

**Speech bubble**: "Ask Voco AI" tooltip positioned above the FAB. Appears after 800ms delay. Dismissible via small X button. Auto-dismissed when chat opens. Never reappears after manual dismissal (`bubbleDismissed` state). White card with stone border, downward caret triangle pointing to the FAB.

**Keyboard**: Escape key closes the chat panel when open.

### PublicChatPanel (`src/components/landing/PublicChatPanel.jsx`)

`'use client'`. Props: `onClose: () => void`.

**Position**: Fixed bottom-right (`bottom-28 right-4 lg:right-6`), `z-50`, `w-[calc(100vw-2rem)] sm:w-[380px]`, `max-h-[min(500px,calc(100vh-6rem))]`. Slide-up entry animation via `scale-95 translate-y-2` → `scale-100 translate-y-0` with `origin-bottom-right`.

**Header**: `MessageSquare` icon + "Voco AI" label + "Product Questions" Badge. Close X button.

**Message list**: Scrollable area with `aria-live="polite"`. Auto-scrolls to bottom on new messages. User messages: right-aligned, `bg-[#C2410C]` orange with white text. AI messages: left-aligned, `bg-[#F5F5F4]` with Bot icon avatar.

**Greeting message**: Hardcoded initial AI message: "Hi! I'm Voco AI. Ask me anything about pricing, features, or how Voco works for your business. What would you like to know?"

**Input**: shadcn/ui `Input` + `Button` (Send icon), `maxLength={500}`. Enter key sends. Disabled while loading.

**Component reuse from dashboard**: Imports `TypingIndicator` and `ChatNavLink` from `src/components/dashboard/`. `TypingIndicator` shows animated dots while waiting for AI response. `ChatNavLink` renders navigation link chips extracted from AI messages — clicking a link calls `onClose()` (closes the panel) then navigates.

**Link parsing**: Uses `parseMessageContent()` from `src/lib/parse-message-content.js` with a custom `PUBLIC_LINK_REGEX` pattern: `/\[([^\]]+)\]\((\/(?!dashboard)[^)]+)\)/g`. This matches markdown links to any public route (explicitly excludes `/dashboard/*` paths). The `parseMessageContent` function accepts an optional `linkPattern` parameter — the dashboard chatbot uses the default (dashboard links only), while the public chatbot passes this public-route regex.

**Conversation context**: Sends last 10 messages as `history` array to the API. Also sends `currentRoute` (via `usePathname()`) so the API can provide route-contextual knowledge.

### Public Chat API (`src/app/api/public-chat/route.js`)

`POST /api/public-chat` — unauthenticated endpoint (no auth middleware required).

**Request body**: `{ message: string, currentRoute?: string, history?: Array<{ role: 'user'|'assistant', content: string }> }`

**Response**: `{ reply: string }` on success, `{ error: string }` on failure.

**Rate limiting** (in-memory, per-instance):
- **Per-IP cooldown**: 5 seconds between requests (module-level `Map`, stale entries cleaned after 30s)
- **Global daily cap**: 1000 requests/day per server instance (resets at midnight UTC)
- IP extracted from `x-forwarded-for` (first entry) or `x-real-ip` header

**Groq client**: Lazy singleton using `openai` npm package pointed at `https://api.groq.com/openai/v1`. Model: `meta-llama/llama-4-scout-17b-16e-instruct`. `max_tokens: 400`, `temperature: 0.4`.

**System prompt** includes:
- **Language detection rule**: Detect user's first message language, respond only in that language for the entire conversation. No mixing.
- **Topic restriction**: Only answers questions about Voco. Politely declines unrelated topics (general knowledge, coding, math, etc.) and redirects to Voco topics.
- **Persona**: Friendly, concise (2-4 sentences), references specific pricing ($99/$249/$599), mentions 14-day free trial.
- **Navigation links**: Instructed to use `[Page Name](/path)` markdown format for page suggestions.
- **Knowledge injection**: RAG-retrieved content appended to system prompt.
- **Current route**: Visitor's current page path included for contextual responses.

**Error handling**: Groq API errors return `{ reply: 'Something went wrong...' }` (200 status, graceful degradation). Missing `GROQ_API_KEY` returns 503.

### Knowledge Base RAG (`src/lib/public-chatbot-knowledge/`)

Server-only module. 6 markdown knowledge documents + `index.js` retrieval logic.

**Knowledge docs**:
| File | Content |
|------|---------|
| `overview.md` | Voco product overview — what it is, who it's for |
| `pricing.md` | Pricing plans, tiers, overage rates |
| `features.md` | Feature descriptions and capabilities |
| `how-it-works.md` | Setup process, how the AI receptionist works |
| `faq.md` | Frequently asked questions |
| `contact.md` | Contact info, sales, support |

**Retrieval logic** (`getPublicKnowledge(message, currentRoute)`):
1. **Route map**: Maps current page to a priority doc (e.g., `/pricing` → `pricing.md`, `/` → `overview.md`, `/contact` → `contact.md`). Unknown routes fall back to `overview.md`.
2. **Keyword map**: Scans message for keyword groups (checked in order, first match wins). Adds up to 1 additional doc that differs from the route doc. Keyword groups: pricing terms, feature terms, setup terms, FAQ terms, contact terms.
3. **Output**: Reads matched docs via `readFileSync`, returns at most 2 docs joined with `---` separator.

### `parseMessageContent` (`src/lib/parse-message-content.js`)

Shared utility for both dashboard and public chatbots. Extracts markdown-format navigation links from AI message text.

```js
export function parseMessageContent(content, linkPattern) {
  const linkRegex = linkPattern || /\[([^\]]+)\]\((\/dashboard[^)]+)\)/g;
  // ...extracts links, returns { text, links }
}
```

**Default behavior** (no `linkPattern`): Extracts only `/dashboard/*` links — used by the dashboard chatbot.

**Public chatbot override**: Passes `PUBLIC_LINK_REGEX` which matches any non-dashboard route: `/\[([^\]]+)\]\((\/(?!dashboard)[^)]+)\)/g`.

---

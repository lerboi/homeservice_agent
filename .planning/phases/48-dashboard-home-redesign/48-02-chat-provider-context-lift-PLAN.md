---
phase: 48
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/dashboard/ChatProvider.jsx
  - src/components/dashboard/ChatbotSheet.jsx
  - src/app/dashboard/layout.js
  - tests/unit/chat-provider.test.js
autonomous: true
requirements: [HOME-05]
tags: [dashboard, chat, context, react]
user_setup: []

must_haves:
  truths:
    - "A React Context ChatProvider wraps the dashboard layout and exposes {messages, isLoading, sendMessage, currentRoute} via useChatContext()"
    - "ChatbotSheet renders messages from useChatContext() — zero local useState for messages/isLoading/history"
    - "currentRoute from layout's usePathname() is passed into ChatProvider and forwarded on every POST /api/chat"
    - "A user message sent by any consumer (sheet OR future panel) appears in all other consumers of the same context in the same session"
  artifacts:
    - path: "src/components/dashboard/ChatProvider.jsx"
      provides: "ChatProvider + useChatContext hook"
      exports: ["ChatProvider", "useChatContext"]
    - path: "src/components/dashboard/ChatbotSheet.jsx"
      provides: "Sheet UI consuming useChatContext() — refactored to stateless-for-history"
      contains: "useChatContext"
    - path: "src/app/dashboard/layout.js"
      provides: "DashboardLayoutInner wrapped in <ChatProvider currentRoute={pathname}>"
      contains: "<ChatProvider"
  key_links:
    - from: "src/app/dashboard/layout.js"
      to: "src/components/dashboard/ChatProvider.jsx"
      via: "<ChatProvider currentRoute={pathname}>{children}</ChatProvider>"
      pattern: "ChatProvider.*currentRoute"
    - from: "src/components/dashboard/ChatbotSheet.jsx"
      to: "useChatContext"
      via: "const { messages, isLoading, sendMessage } = useChatContext()"
      pattern: "useChatContext\\(\\)"
---

<objective>
Lift chat state from ChatbotSheet's local useState into a React Context (`ChatProvider`) at the dashboard layout level. This is prerequisite plumbing for HOME-05 — Plan 05 adds `ChatPanel.jsx` on the home page as the second consumer.

Purpose: HOME-05 requires shared message history across the home-page chat panel and the always-mounted `ChatbotSheet`. CONTEXT.md D-10 locks React Context as the mechanism (no Zustand, no event bus). Doing the lift in Wave 1 means Plan 05 can consume it cleanly.
Output:
 - New `ChatProvider.jsx` + `useChatContext` hook
 - `ChatbotSheet.jsx` refactored to consume context (visuals unchanged)
 - `layout.js` wraps children in `<ChatProvider currentRoute={pathname}>`
 - `chat-provider.test.js` (GREEN)
</objective>

<execution_context>
@/Users/leroyngzz/Projects/homeservice_agent/.claude/get-shit-done/workflows/execute-plan.md
@/Users/leroyngzz/Projects/homeservice_agent/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/48-dashboard-home-redesign/48-CONTEXT.md
@.planning/phases/48-dashboard-home-redesign/48-RESEARCH.md
@.planning/phases/48-dashboard-home-redesign/48-UI-SPEC.md
@.claude/skills/voice-call-architecture/SKILL.md
@.claude/skills/dashboard-crm-system/SKILL.md
@src/components/dashboard/ChatbotSheet.jsx
@src/app/dashboard/layout.js
@src/app/api/chat/route.js
@src/components/dashboard/ChatMessage.jsx
@src/components/dashboard/TypingIndicator.jsx

<interfaces>
<!-- CONTRACT — downstream plans (Plan 05 ChatPanel) implement against this exactly -->

```js
// src/components/dashboard/ChatProvider.jsx
'use client';
import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

// Shape (consumed by Plan 05 ChatPanel.jsx + Plan 02 ChatbotSheet refactor)
export interface ChatContextValue {
  messages: { id: string|number; role: 'ai'|'user'; content: string; error?: boolean }[];
  isLoading: boolean;
  currentRoute: string;
  sendMessage: (input: string) => Promise<void>;
  retryMessage: (messageId: string|number) => Promise<void>; // for future error recovery; may stub for now
  clearChat: () => void; // resets to [GREETING]
}

export function ChatProvider({ children, currentRoute }: { children: ReactNode; currentRoute: string }): JSX.Element;
export function useChatContext(): ChatContextValue;  // throws if called outside provider
```

Greeting constant (lifted verbatim from current ChatbotSheet.jsx):
```js
const GREETING = {
  id: 'greeting',
  role: 'ai',
  content: "Hi, I'm Voco AI. I can help you navigate the dashboard...",
};
```

POST /api/chat body contract (UNCHANGED from today's ChatbotSheet):
```json
{ "message": "...", "currentRoute": "/dashboard", "history": [{"role":"user|assistant", "content":"..."}] }
```
history = last 10 messages before send, mapped `ai`→`assistant`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create ChatProvider + useChatContext (lift state verbatim from ChatbotSheet)</name>
  <files>src/components/dashboard/ChatProvider.jsx, tests/unit/chat-provider.test.js</files>
  <read_first>
    src/components/dashboard/ChatbotSheet.jsx (CURRENT state — lines 12-90 are the send logic to lift; note the GREETING constant, handleSend function, history mapping, /api/chat POST),
    src/app/api/chat/route.js (backend contract — do NOT change this),
    tests/unit/chat-provider.test.js (RED stub from Plan 01 Task 1),
    .planning/phases/48-dashboard-home-redesign/48-RESEARCH.md (Pattern 1, Pitfall 1, Pitfall 2, Code Examples "ChatProvider Context"),
    .claude/skills/voice-call-architecture/SKILL.md (ChatbotSheet integration notes)
  </read_first>
  <behavior>
    - `useChatContext()` throws `'useChatContext must be used within ChatProvider'` when called outside provider.
    - Initial `messages` = `[GREETING]`.
    - `sendMessage(input)` appends `{id: Date.now(), role:'user', content: input}` immediately (optimistic), sets `isLoading:true`, POSTs `{message:input, currentRoute, history}` to `/api/chat`, on success appends AI reply `{id: ..., role:'ai', content: json.reply}`, on error appends `{..., error:true, content:'Message didn't send. Check your connection and try again.'}` and keeps the user's input recoverable via `retryMessage`. On finally sets `isLoading:false`.
    - `history` array sent to /api/chat is the last 10 messages BEFORE the new user message is appended, mapped `ai`→`assistant`. This matches the current ChatbotSheet behavior exactly (lines 49–62).
    - `clearChat()` resets messages to `[GREETING]` and isLoading to false.
    - `currentRoute` lives in provider state (initialized from the `currentRoute` prop); a `useEffect` syncs it when the prop changes (so Next.js route changes update context without remount).
    - Tests to turn GREEN (already written RED in Plan 01 Task 1):
      - "useChatContext exposes {messages, isLoading, sendMessage}"
      - "messages sent via one consumer visible to another consumer (shared state)" — render two components in the same provider, send from one, assert both see the updated array
      - "currentRoute from context is forwarded to POST /api/chat body" — `jest.spyOn(global, 'fetch')` and assert body.currentRoute
  </behavior>
  <action>
    Create `src/components/dashboard/ChatProvider.jsx`:
    ```jsx
    'use client';
    import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

    const GREETING = { id: 'greeting', role: 'ai', content: "Hi, I'm Voco AI. I can help you navigate the dashboard..." };
    const ChatContext = createContext(null);

    export function ChatProvider({ children, currentRoute: currentRouteProp }) {
      const [messages, setMessages] = useState([GREETING]);
      const [isLoading, setIsLoading] = useState(false);
      const [currentRoute, setCurrentRoute] = useState(currentRouteProp || '/dashboard');
      const messagesRef = useRef(messages);
      useEffect(() => { messagesRef.current = messages; }, [messages]);
      useEffect(() => { if (currentRouteProp) setCurrentRoute(currentRouteProp); }, [currentRouteProp]);

      const sendMessage = useCallback(async (input) => {
        const trimmed = (input ?? '').trim();
        if (!trimmed) return;
        const userMsg = { id: Date.now(), role: 'user', content: trimmed };
        const history = messagesRef.current.slice(-10).map(m => ({
          role: m.role === 'ai' ? 'assistant' : 'user',
          content: m.content,
        }));
        setMessages(prev => [...prev, userMsg]);
        setIsLoading(true);
        try {
          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: trimmed, currentRoute, history }),
          });
          if (!res.ok) throw new Error(`chat ${res.status}`);
          const { reply } = await res.json();
          setMessages(prev => [...prev, { id: Date.now() + 1, role: 'ai', content: reply }]);
        } catch (e) {
          setMessages(prev => [...prev, { id: Date.now() + 2, role: 'ai', error: true, content: "Message didn't send. Check your connection and try again." }]);
        } finally {
          setIsLoading(false);
        }
      }, [currentRoute]);

      const clearChat = useCallback(() => { setMessages([GREETING]); setIsLoading(false); }, []);
      const retryMessage = useCallback(async () => { /* Phase 48 scope: sendMessage handles single-attempt; explicit retry is UI-owned — no-op stub */ }, []);

      return (
        <ChatContext.Provider value={{ messages, isLoading, currentRoute, sendMessage, retryMessage, clearChat }}>
          {children}
        </ChatContext.Provider>
      );
    }

    export function useChatContext() {
      const ctx = useContext(ChatContext);
      if (!ctx) throw new Error('useChatContext must be used within ChatProvider');
      return ctx;
    }
    ```
    Now replace the RED stubs in `tests/unit/chat-provider.test.js` with the three GREEN tests described above. Use `@testing-library/react`'s `renderHook` + provider wrapper pattern. Stub `global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ reply: 'AI reply' }) })`.
  </action>
  <verify>
    <automated>npx jest tests/unit/chat-provider.test.js --no-coverage</automated>
  </verify>
  <done>
    ChatProvider file created with exact interface. All 3 chat-provider tests GREEN.
  </done>
  <acceptance_criteria>
    `test -f src/components/dashboard/ChatProvider.jsx` exits 0.
    `grep -q "export function ChatProvider" src/components/dashboard/ChatProvider.jsx` exits 0.
    `grep -q "export function useChatContext" src/components/dashboard/ChatProvider.jsx` exits 0.
    `grep -q "history.*slice(-10)" src/components/dashboard/ChatProvider.jsx` exits 0.
    `grep -q "/api/chat" src/components/dashboard/ChatProvider.jsx` exits 0.
    `npx jest tests/unit/chat-provider.test.js --no-coverage` exits 0.
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: Refactor ChatbotSheet + wrap dashboard layout in ChatProvider</name>
  <files>src/components/dashboard/ChatbotSheet.jsx, src/app/dashboard/layout.js</files>
  <read_first>
    src/components/dashboard/ChatbotSheet.jsx (CURRENT — MUST keep visual parity: Sheet component, message list, TypingIndicator, ChatMessage, input bar, send button, scroll-to-bottom ref),
    src/app/dashboard/layout.js (CURRENT — note line ~89 where ChatbotSheet is mounted, usePathname import),
    src/components/dashboard/ChatProvider.jsx (created in Task 1),
    .planning/phases/48-dashboard-home-redesign/48-RESEARCH.md (Pitfall 1 — currentRoute threading; Pitfall 2 — double mounting),
    .planning/phases/48-dashboard-home-redesign/48-UI-SPEC.md (ChatbotSheet visual unchanged)
  </read_first>
  <action>
    1. Refactor `ChatbotSheet.jsx`:
       - Import `useChatContext` from `./ChatProvider`.
       - Remove local `useState` for `messages`, `isLoading`, and the GREETING constant (these now live in context).
       - Keep local `useState` for `input` (ephemeral text field value — NOT history).
       - Replace `handleSend` body with: `await sendMessage(input); setInput('');` (pulling sendMessage from context).
       - Remove the `currentRoute` prop from the component signature — consume from context instead. The send call inside context already forwards it.
       - Props after refactor: `{ open, onOpenChange }` only. The ChatbotSheet trigger (sidebar button, More page) still passes these.
       - Scroll-to-bottom logic stays in the sheet (it's presentation concern): `useEffect([messages], () => messagesEndRef.current?.scrollIntoView(...))`.
       - Visual output unchanged — same Sheet, same ChatMessage bubbles, same TypingIndicator, same input bar. Spot-check by running `git diff` on the JSX tree: wrapping elements, className strings unchanged.
    2. Wire `ChatProvider` in `src/app/dashboard/layout.js`:
       - Import `ChatProvider` from `@/components/dashboard/ChatProvider`.
       - Inside `DashboardLayoutInner`, wrap everything currently under the TooltipProvider (or equivalent root of the authed tree) with `<ChatProvider currentRoute={pathname}>...</ChatProvider>`.
       - Keep `<ChatbotSheet open={chatOpen} onOpenChange={setChatOpen} />` INSIDE the provider.
       - REMOVE the `currentRoute={pathname}` prop from `<ChatbotSheet />` — context now owns it.
       - Do not change sidebar / top-bar / BottomTabBar positioning.
    3. Grep-verify no stale `currentRoute` prop flows and no leftover local messages state:
       `grep -n "useState" src/components/dashboard/ChatbotSheet.jsx` should show at most one hook (the `input` field).
  </action>
  <verify>
    <automated>npx jest tests/unit/chat-provider.test.js --no-coverage &amp;&amp; grep -q "useChatContext" src/components/dashboard/ChatbotSheet.jsx &amp;&amp; if grep -q "const \[messages," src/components/dashboard/ChatbotSheet.jsx; then exit 1; fi &amp;&amp; grep -q "<ChatProvider currentRoute={pathname}" src/app/dashboard/layout.js</automated>
  </verify>
  <done>
    ChatbotSheet consumes useChatContext(), no local messages state. Layout wraps children in ChatProvider with currentRoute. Sheet visuals unchanged (TypingIndicator, ChatMessage, Sheet all render the same).
  </done>
  <acceptance_criteria>
    `grep -q "useChatContext" src/components/dashboard/ChatbotSheet.jsx` exits 0.
    `grep -c "const \[messages," src/components/dashboard/ChatbotSheet.jsx` returns 0.
    `grep -c "const \[isLoading," src/components/dashboard/ChatbotSheet.jsx` returns 0.
    `grep -q "ChatProvider" src/app/dashboard/layout.js` exits 0.
    `grep -q "currentRoute={pathname}" src/app/dashboard/layout.js` exits 0.
    `grep -c "currentRoute={pathname}" src/components/dashboard/ChatbotSheet.jsx` returns 0 (prop removed — context owns it).
    `npx jest tests/unit/chat-provider.test.js --no-coverage` still GREEN.
    `npx next build` succeeds with no hydration warnings (if build command available); otherwise `npx next lint src/app/dashboard/layout.js src/components/dashboard/ChatbotSheet.jsx src/components/dashboard/ChatProvider.jsx` exits 0.
  </acceptance_criteria>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Client component → /api/chat | User-typed text crosses into the POST body. Existing API route validates + applies RAG; no change to contract. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-48-07 | Cross-Site Scripting (Tampering) | Chat message rendering via existing `ChatMessage.jsx` | mitigate | ChatMessage.jsx (Phase 37) already sanitizes markdown / uses ChatNavLink parsing — no raw `dangerouslySetInnerHTML`. Plan 02 does NOT touch ChatMessage; inherits existing sanitization (ASVS V5.3.3). |
| T-48-08 | Information Disclosure | Chat context retained across routes | accept | Messages are ephemeral and tenant-scoped (the current dashboard session user); cross-tenant exposure impossible since provider lives inside authed dashboard layout. D-11 explicitly defers cross-refresh persistence. |
| T-48-09 | Tampering | ChatProvider exposed globally in layout | mitigate | Provider is rendered inside `/dashboard/layout.js` (authed route); unauthenticated users never mount it. ASVS V4.1.1. |
</threat_model>

<verification>
- `useChatContext` hook exists + throws outside provider.
- Layout wraps authed dashboard tree in `<ChatProvider currentRoute={pathname}>`.
- ChatbotSheet has zero local messages/isLoading state — only `input` field remains local.
- `tests/unit/chat-provider.test.js` GREEN.
- Manual smoke: open dashboard, click the chat trigger, send a message, close+reopen sheet → message history intact.
</verification>

<success_criteria>
- [ ] ChatProvider.jsx created; useChatContext consumable anywhere inside `/dashboard/*`.
- [ ] ChatbotSheet.jsx refactored; visual parity confirmed by reviewer or snapshot.
- [ ] layout.js wraps children in ChatProvider with currentRoute prop.
- [ ] chat-provider.test.js GREEN (all 3 RED tests from Plan 01 now pass).
- [ ] No regression: `npx jest tests/unit/` overall suite no worse than before (other RED tests unchanged).
</success_criteria>

<output>
After completion, create `.planning/phases/48-dashboard-home-redesign/48-02-SUMMARY.md` documenting: exact ChatContext value shape, the GREETING constant, the `currentRoute` threading pattern, file line counts before/after.
</output>

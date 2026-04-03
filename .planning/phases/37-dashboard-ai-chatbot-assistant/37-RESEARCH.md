# Phase 37: Dashboard AI Chatbot Assistant - Research

**Researched:** 2026-04-03
**Domain:** Next.js AI chat UI + Groq LLM + keyword-match RAG + shadcn/ui Sheet
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Desktop trigger — "Ask Voco AI" button pinned at the bottom of the dark sidebar, between the nav separator and the Log Out button. Same styling as existing sidebar links.
- **D-02:** Mobile trigger — "Ask Voco AI" as the first item in the More page (above QUICK_ACCESS). Tapping opens the chat. No floating button, no extra tab.
- **D-03:** Desktop chat window — Right-side Sheet panel (`side="right"`). Dashboard content stays visible (dimmed overlay).
- **D-04:** Mobile chat window — Bottom Sheet (`side="bottom"`, `max-h-[85vh]`, `rounded-t-2xl`). Swipe down to dismiss.
- **D-05:** LLM — Groq API with Llama model. Use `openai` npm package (already installed at v6.32.0) pointing at Groq's base URL (`https://api.groq.com/openai/v1`).
- **D-06:** RAG — Static markdown knowledge docs in `src/lib/chatbot-knowledge/`. One file per dashboard area. Runtime keyword-match to find relevant docs, inject into system prompt. No vector DB, no embeddings.
- **D-07:** Page context — Pass current route (e.g. `/dashboard/invoices`) to the API route. Chatbot prioritizes knowledge for that area.
- **D-08:** Capabilities — Answer + navigate (provide clickable "Go to [Page]" links). Does NOT perform actions (create/edit/delete). Action capability deferred.
- **D-09:** History — Session-only via React state. Closing/refreshing clears history. No Supabase storage.

### Claude's Discretion

- Chat UI component design (message bubbles, typing indicator, input styling)
- System prompt engineering and knowledge doc structure
- Keyword matching algorithm for RAG retrieval
- Greeting message and personality/tone
- Error handling for Groq API failures (fallback message)
- Navigation link formatting in responses

### Deferred Ideas (OUT OF SCOPE)

- **Action capabilities** — Chatbot performing dashboard actions (create invoice, book appointment, change settings). Deferred to future phase.
- **Persistent chat history** — Storing conversations in Supabase. Not needed.
- **Cmd+K integration** — Extending CommandPalette with an "Ask AI" mode.
- **Vector DB / pgvector RAG** — If knowledge base grows beyond ~30 docs.
</user_constraints>

---

## Summary

Phase 37 adds a "Voco AI" help chatbot to the dashboard. The implementation has three distinct layers: (1) a React UI using existing `Sheet` + `Input` + `Button` shadcn components, mounted at `dashboard/layout.js`; (2) a Next.js API route at `/api/chat/route.js` that does keyword-based RAG retrieval from static markdown files and calls Groq's LLM API; (3) a set of markdown knowledge documents in `src/lib/chatbot-knowledge/` covering each dashboard area.

All infrastructure is already in place. The `openai` npm package (v6.32.0) is installed and the `GROQ_API_KEY` environment variable is already used by `src/lib/triage/layer2-llm.js`. The current Groq model in use is `meta-llama/llama-4-scout-17b-16e-instruct`. The `Sheet` component (shadcn, `side="right"` / `side="bottom"`) is used throughout the dashboard. No new npm packages need to be installed.

The main implementation risks are: (1) state threading — the chat open/close state and current-page context must be lifted to `dashboard/layout.js` and passed down to the sidebar trigger; (2) Sheet `side="bottom"` with `max-h-[85vh] rounded-t-2xl` overrides require careful className merging since the default shadcn `SheetContent` applies `h-auto` for bottom-side; (3) the keyword-matching RAG strategy works well for a small docs set but needs a clear fallback when no docs match.

**Primary recommendation:** Implement state at `dashboard/layout.js`, mount `<ChatbotSheet>` there (like `<CommandPalette>`), pass an `onOpen` callback to `DashboardSidebar` and `more/page.js`. The API route follows the same `getTenantId()` guard pattern as `search/route.js`.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `openai` | 6.32.0 (installed) | Groq API client (OpenAI-compatible) | Already in package.json, established pattern in layer2-llm.js |
| Groq model: `meta-llama/llama-4-scout-17b-16e-instruct` | — | Chat completions | Currently used by triage layer; fast, low cost |
| `Sheet` (shadcn/radix) | installed | Chat panel container | Established flyout pattern — LeadFlyout, AppointmentFlyout use same component |
| `usePathname` (next/navigation) | built-in | Pass current route as page context | Already used in `DashboardSidebar` and `layout.js` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | installed | `MessageSquare`, `Send`, `Bot`, `ChevronRight` icons | Already used throughout dashboard |
| `Skeleton` (shadcn) | installed | Loading state for AI response slot | Already used in dashboard |
| `Badge` (shadcn) | installed | "Help" label in sheet header | Already used in codebase |
| `Separator` (shadcn) | installed | Between sheet header and message list | Already used in DashboardSidebar |
| Node.js `fs` (via import) | built-in | Read markdown files in API route | Server-side only — Next.js API routes run on Node |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `openai` npm → Groq | `groq-sdk` npm | Groq has its own SDK but `openai` is already installed and the pattern already established |
| Static markdown RAG | pgvector embeddings | pgvector is more powerful but overkill for ~10 docs; adds infra complexity |
| Keyword match in API route | Client-side RAG | Server-side keeps API key server-only; client-side would expose docs unnecessarily |

**Installation:** No new packages required. `openai` v6.32.0 is already installed.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   ├── api/chat/route.js              ← NEW: POST handler — receives message + route, queries KB, calls Groq
│   └── dashboard/
│       └── layout.js                  ← MODIFIED: mount ChatbotSheet, manage open state, pass callback to sidebar
├── components/
│   └── dashboard/
│       ├── ChatbotSheet.jsx           ← NEW: root chat panel (Sheet + message state)
│       ├── ChatMessage.jsx            ← NEW: single message bubble (variant: user | ai)
│       ├── ChatNavLink.jsx            ← NEW: clickable navigation chip inside AI message
│       ├── TypingIndicator.jsx        ← NEW: three-dot pulse animation
│       └── DashboardSidebar.jsx       ← MODIFIED: add chatbot trigger button + accept onOpenChat prop
└── lib/
    └── chatbot-knowledge/             ← NEW: markdown docs per dashboard area
        ├── index.js                   ← NEW: RAG retrieval function (keyword match)
        ├── leads.md
        ├── calendar.md
        ├── calls.md
        ├── invoices.md
        ├── estimates.md
        ├── analytics.md
        ├── settings.md
        ├── billing.md
        └── getting-started.md
```

### Pattern 1: State Lifting + Callback Prop (Chat open state)

**What:** `ChatbotSheet` open state and `openChat()` function live in `DashboardLayoutInner`. Passed down to `DashboardSidebar` (desktop trigger) and referenced in `more/page.js` via `window` event or context.

**When to use:** When a layout-level overlay needs triggers from multiple child components at different depths.

**Recommended approach — window event (matches existing DashboardTour pattern):**

```javascript
// In DashboardLayoutInner (layout.js) — same pattern as DashboardTour 'start-dashboard-tour' event
useEffect(() => {
  function handleOpenChat() { setChatOpen(true); }
  window.addEventListener('open-voco-chat', handleOpenChat);
  return () => window.removeEventListener('open-voco-chat', handleOpenChat);
}, []);

// In DashboardSidebar — trigger button fires event
function handleOpenChat() {
  window.dispatchEvent(new Event('open-voco-chat'));
}

// In more/page.js — same pattern for mobile trigger
function handleOpenChat() {
  window.dispatchEvent(new Event('open-voco-chat'));
}
```

**Alternative — prop drilling via DashboardSidebar:** Pass `onOpenChat` prop from layout to `<DashboardSidebar onOpenChat={...} />`. This is simpler for the sidebar but doesn't work for `more/page.js` (it's a page component, not a layout child with prop access). The window event approach is cleaner for both.

**Note:** The existing DashboardTour already uses this exact `window.addEventListener('start-dashboard-tour', ...)` pattern — confirmed in `layout.js` line 27-31.

### Pattern 2: Next.js API Route — Groq Chat Completion

**What:** `POST /api/chat` receives `{ message, currentRoute }`, reads matching knowledge docs from filesystem, builds system prompt, calls Groq.

**Example — follows established layer2-llm.js pattern:**

```javascript
// src/app/api/chat/route.js
import { getTenantId } from '@/lib/get-tenant-id';
import OpenAI from 'openai';
import { getRelevantKnowledge } from '@/lib/chatbot-knowledge/index.js';

let _client = null;
function getGroqClient() {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }
  return _client;
}

export async function POST(request) {
  const tenantId = await getTenantId();
  if (!tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { message, currentRoute, history = [] } = await request.json();

  if (!message || message.trim().length === 0) {
    return Response.json({ error: 'Message required' }, { status: 400 });
  }

  const knowledge = await getRelevantKnowledge(message, currentRoute);

  const systemPrompt = `You are Voco AI, a helpful assistant for the Voco dashboard...
${knowledge ? `\n\nRelevant documentation:\n${knowledge}` : ''}`;

  const response = await getGroqClient().chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10), // last 10 turns for context
      { role: 'user', content: message },
    ],
    max_tokens: 500,
    temperature: 0.3,
  });

  return Response.json({
    reply: response.choices[0].message.content,
  });
}
```

### Pattern 3: Keyword-Match RAG

**What:** At request time, score each knowledge doc by keyword overlap with the user's message + current route. Return top 1-2 doc contents as context strings.

```javascript
// src/lib/chatbot-knowledge/index.js
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Route → doc file mapping (priority: current page)
const ROUTE_DOC_MAP = {
  '/dashboard/leads': 'leads.md',
  '/dashboard/calendar': 'calendar.md',
  '/dashboard/calls': 'calls.md',
  '/dashboard/invoices': 'invoices.md',
  '/dashboard/estimates': 'estimates.md',
  '/dashboard/more/analytics': 'analytics.md',
  '/dashboard/more/billing': 'billing.md',
  '/dashboard/more/services-pricing': 'settings.md',
  '/dashboard/more/working-hours': 'settings.md',
  '/dashboard/more/ai-voice-settings': 'settings.md',
  '/dashboard': 'getting-started.md',
};

// Keyword → doc file mapping
const KEYWORD_DOC_MAP = [
  { keywords: ['lead', 'leads', 'crm', 'customer', 'caller', 'kanban'], doc: 'leads.md' },
  { keywords: ['calendar', 'appointment', 'booking', 'schedule', 'slot'], doc: 'calendar.md' },
  { keywords: ['call', 'calls', 'transcript', 'recording', 'voicemail'], doc: 'calls.md' },
  { keywords: ['invoice', 'invoices', 'payment', 'bill', 'pdf', 'send invoice'], doc: 'invoices.md' },
  { keywords: ['estimate', 'estimates', 'quote'], doc: 'estimates.md' },
  { keywords: ['analytics', 'revenue', 'chart', 'stats', 'report'], doc: 'analytics.md' },
  { keywords: ['billing', 'subscription', 'plan', 'upgrade', 'usage', 'trial'], doc: 'billing.md' },
  { keywords: ['setting', 'settings', 'service', 'working hours', 'zone', 'notification', 'ai voice'], doc: 'settings.md' },
];

export async function getRelevantKnowledge(message, currentRoute) {
  const docs = new Set();
  const msgLower = message.toLowerCase();

  // 1. Current route gets priority
  const routeDoc = ROUTE_DOC_MAP[currentRoute] || ROUTE_DOC_MAP['/dashboard'];
  if (routeDoc) docs.add(routeDoc);

  // 2. Keyword match — add up to 1 additional doc
  for (const { keywords, doc } of KEYWORD_DOC_MAP) {
    if (keywords.some(k => msgLower.includes(k)) && doc !== routeDoc) {
      docs.add(doc);
      break; // one additional doc max
    }
  }

  // 3. Read and concatenate matched docs (cap at 2)
  const sections = [];
  for (const docFile of Array.from(docs).slice(0, 2)) {
    try {
      const content = readFileSync(join(__dirname, docFile), 'utf-8');
      sections.push(content);
    } catch {
      // silently skip missing docs
    }
  }

  return sections.join('\n\n---\n\n');
}
```

### Pattern 4: ChatbotSheet Component State

**What:** `ChatbotSheet` owns message array state. `open` prop controlled by parent (layout.js). Messages persist while open; layout must NOT unmount ChatbotSheet when closed — just pass `open={false}`.

```javascript
// Correct: sheet stays mounted, open prop controls visibility
// ✓ Messages persist across open/close within session
<ChatbotSheet open={chatOpen} onOpenChange={setChatOpen} currentRoute={pathname} />

// Wrong: conditional render destroys message state
// ✗ {chatOpen && <ChatbotSheet />}
```

### Pattern 5: Navigation Link Response Format

**What:** The LLM response uses a simple convention for navigation links that the client parses and renders as `ChatNavLink` chips.

**System prompt instruction to LLM:**

```
When you want to suggest navigation, include links using this exact format:
[Go to Leads](/dashboard/leads)
[Go to Calendar](/dashboard/calendar)

Place navigation links on their own line at the end of your response.
```

**Client-side parsing:**

```javascript
function parseMessageContent(content) {
  const linkRegex = /\[([^\]]+)\]\((\/dashboard[^)]+)\)/g;
  const links = [];
  let match;
  while ((match = linkRegex.exec(content)) !== null) {
    links.push({ label: match[1], href: match[2] });
  }
  const text = content.replace(linkRegex, '').trim();
  return { text, links };
}
```

### Anti-Patterns to Avoid

- **Conditional rendering `{chatOpen && <ChatbotSheet>}`:** Destroys React state on close. Use `open` prop with always-mounted component.
- **Sending full chat history to Groq:** Cap history at last 10 messages — Groq context window is generous but prompt cost should stay low.
- **Reading markdown files on every request without any caching:** Use Node module-level caching (the `readFileSync` result can be cached in a Map on first load) or just read on demand — for a small docs set it's fast enough.
- **`fs` in client-side code:** The `chatbot-knowledge/index.js` is a server-only module. Never import it from a client component.
- **Streaming responses for this use case:** Non-streaming (`Response.json`) is simpler and perfectly adequate for a help chatbot. Streaming adds complexity with no UX gain given typical response size.
- **Exposing GROQ_API_KEY client-side:** Route must be a server-side Next.js API route. Never use `NEXT_PUBLIC_GROQ_API_KEY`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Chat panel container | Custom dialog/drawer | shadcn `Sheet` with `side="right"/"bottom"` | Already in codebase, Radix handles focus trap, ESC, animation, overlay, a11y |
| Loading skeleton | Custom CSS animation | shadcn `Skeleton` | Already used in dashboard |
| Three-dot typing animation | Complex keyframe CSS | Tailwind `animate-pulse` with staggered delays | Works perfectly, zero new CSS |
| Send on Enter | Custom key handler library | `onKeyDown` with `e.key === 'Enter'` | Two lines of code |
| Auto-scroll to bottom | Scroll library | `useEffect` + `scrollIntoView({ behavior: 'smooth' })` | Standard React pattern |
| Toast error feedback | Custom toast | `sonner` (`toast.error(...)`) | Already installed and configured in dashboard layout |

**Key insight:** Every UI primitive needed already exists in the codebase. The complexity in this phase is the system prompt and knowledge doc quality, not the UI components.

---

## Common Pitfalls

### Pitfall 1: Sheet `side="bottom"` height override

**What goes wrong:** The shadcn `SheetContent` component applies `h-auto` for `side="bottom"` (line 53 of `sheet.jsx`). Adding `max-h-[85vh]` via `className` merges correctly via `cn()`, but `rounded-t-2xl` also needs to override the default `SheetContent` which has no border-radius.

**Why it happens:** The `SheetContent` component renders `<SheetPrimitive.Content>` with `className={cn(...side-specific-classes..., className)}`. The className prop always wins in Tailwind merge order, so `max-h-[85vh] rounded-t-2xl` passed as `className` will apply.

**How to avoid:**
```jsx
// Correct
<SheetContent side="bottom" className="max-h-[85vh] rounded-t-2xl p-0">
```

**Warning signs:** Sheet doesn't show rounded corners or fills full height on mobile.

### Pitfall 2: DashboardSidebar doesn't accept `onOpenChat` prop currently

**What goes wrong:** `DashboardSidebar` currently takes only `businessName` prop (confirmed in source). Adding the chat trigger requires either passing a callback prop or using the window event pattern.

**Why it happens:** The sidebar is mounted from `layout.js` as `<DashboardSidebar />` with no props (line 46 of current layout.js — `businessName` is fetched but not currently being passed). The window event approach avoids prop changes to the sidebar signature.

**How to avoid:** Use the established window event pattern from `DashboardTour` — fire `window.dispatchEvent(new Event('open-voco-chat'))` from both sidebar and more/page.js. Layout subscribes once.

**Warning signs:** Chat doesn't open from mobile More page trigger even though sidebar works.

### Pitfall 3: `fs` module not available in Edge runtime

**What goes wrong:** If `src/app/api/chat/route.js` runs on Edge runtime, `import { readFileSync } from 'fs'` will throw.

**Why it happens:** Next.js API routes default to Node.js runtime. But adding `export const runtime = 'edge'` would break `fs`. The default is fine — don't add edge runtime to this route.

**How to avoid:** Do not add `export const runtime = 'edge'` to the chat route. Node.js runtime is the correct choice here.

**Warning signs:** Build error "Module not found: Can't resolve 'fs'" or runtime error in production.

### Pitfall 4: `GROQ_API_KEY` not configured in production

**What goes wrong:** The API key is marked optional in `.env.example` (commented out). If not set in Railway/Vercel env, the chat route will fail silently or throw.

**Why it happens:** GROQ_API_KEY was only required for AI triage (layer2-llm.js), which is optional. The chatbot makes it required for a user-facing feature.

**How to avoid:** Add null-check in API route:
```javascript
if (!process.env.GROQ_API_KEY) {
  return Response.json({ error: 'AI not configured' }, { status: 503 });
}
```
Also: update `.env.example` to un-comment `GROQ_API_KEY` and mark it as required for chatbot.

**Warning signs:** Chat returns 500 in production but works locally.

### Pitfall 5: History array growing unbounded in long sessions

**What goes wrong:** React state accumulates every message. Sending full history to Groq on each turn increases latency and token cost.

**Why it happens:** No trimming logic on the history slice sent to the API.

**How to avoid:** Slice last 10 messages when building the API request body:
```javascript
const history = messages.slice(-10).map(m => ({
  role: m.role,
  content: m.content,
}));
```

**Warning signs:** Groq response time increases noticeably after 20+ messages.

### Pitfall 6: more/page.js is a 'use client' component but has no access to layout state

**What goes wrong:** `more/page.js` is a client component that renders independently. It doesn't receive layout state as props.

**Why it happens:** Next.js App Router: layout and pages are separate component trees. Layout passes children — it doesn't inject arbitrary props into page components.

**How to avoid:** The window event approach (`window.dispatchEvent(new Event('open-voco-chat'))`) is the correct pattern here. Alternatively, a React Context in layout.js could work, but window events match the existing DashboardTour pattern.

---

## Code Examples

Verified patterns from existing codebase:

### Groq Client (from src/lib/triage/layer2-llm.js)
```javascript
import OpenAI from 'openai';

let _client = null;
function getClient() {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }
  return _client;
}
// Model in use: 'meta-llama/llama-4-scout-17b-16e-instruct'
```

### API Route Auth Guard (from src/app/api/search/route.js)
```javascript
import { getTenantId } from '@/lib/get-tenant-id';

export async function POST(request) {
  const tenantId = await getTenantId();
  if (!tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ...
}
```

### Sheet Usage (from src/components/ui/sheet.jsx)
```jsx
// side="right" — desktop (SheetContent default is sm:max-w-sm for right side)
<Sheet open={open} onOpenChange={setOpen}>
  <SheetContent side="right" className="w-[400px] sm:max-w-[400px]">
    <SheetHeader>
      <SheetTitle>Voco AI</SheetTitle>
    </SheetHeader>
    {/* content */}
  </SheetContent>
</Sheet>

// side="bottom" — mobile
<Sheet open={open} onOpenChange={setOpen}>
  <SheetContent side="bottom" className="max-h-[85vh] rounded-t-2xl">
    {/* content */}
  </SheetContent>
</Sheet>
```

### Window Event Pattern (from src/app/dashboard/layout.js)
```javascript
// Existing DashboardTour pattern — established in layout.js lines 27-31
useEffect(() => {
  function handleStartTour() { setTourRunning(true); }
  window.addEventListener('start-dashboard-tour', handleStartTour);
  return () => window.removeEventListener('start-dashboard-tour', handleStartTour);
}, []);
```

### Sidebar Button Styling (from src/components/dashboard/DashboardSidebar.jsx)
```jsx
// Exact styling of the existing logout button — chatbot trigger should match
<button
  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
    transition-colors text-white/60 hover:bg-white/[0.04] hover:text-white/80
    border-l-2 border-transparent ml-0 pl-[10px] w-full"
>
  <LogOut className="h-4 w-4 shrink-0" />
  Log Out
</button>
```

### More Page Item Pattern (from src/app/dashboard/more/page.js)
```jsx
// QUICK_ACCESS item pattern — chatbot trigger should follow this structure
<Link
  href={item.href}
  className="flex items-center gap-4 px-5 py-4 hover:bg-stone-50
    transition-colors min-h-[48px]"
>
  <div className="flex items-center justify-center h-10 w-10 rounded-lg
    bg-[#C2410C]/[0.08] shrink-0">
    <Icon className="h-5 w-5 text-[#C2410C]" />
  </div>
  <div className="flex-1 min-w-0">
    <p className="text-sm font-medium text-[#0F172A]">{item.label}</p>
    <p className="text-xs text-[#475569] truncate">{item.description}</p>
  </div>
  <ChevronRight className="h-4 w-4 text-stone-400 shrink-0" />
</Link>
```

---

## Knowledge Document Structure

Each `src/lib/chatbot-knowledge/*.md` file should follow this structure for optimal RAG injection:

```markdown
# [Area Name] — Voco Dashboard

## What this section does
[2-3 sentence overview]

## Key features
- [Feature 1 + how to use it]
- [Feature 2 + how to use it]

## How to navigate here
Go to [Page Name](/dashboard/path)

## Common tasks
### How do I [task 1]?
[Step-by-step answer]

### How do I [task 2]?
[Step-by-step answer]

## Related sections
- [Related area](/dashboard/related-path)
```

**Recommended knowledge docs (10 files):**

| File | Route context | Covers |
|------|---------------|--------|
| `getting-started.md` | `/dashboard` | Dashboard overview, home page cards, setup checklist |
| `leads.md` | `/dashboard/leads` | Lead lifecycle, statuses, Kanban, lead flyout, filtering |
| `calls.md` | `/dashboard/calls` | Call log, transcripts, recordings, triage labels |
| `calendar.md` | `/dashboard/calendar` | Appointments, booking, calendar sync, working hours |
| `invoices.md` | `/dashboard/invoices` | Create/send/track invoices, line items, PDF, payment status |
| `estimates.md` | `/dashboard/estimates` | Create estimates, convert to invoice |
| `analytics.md` | `/dashboard/more/analytics` | Revenue charts, funnel, pipeline |
| `billing.md` | `/dashboard/more/billing` | Plans, usage, trial, upgrade, Stripe portal |
| `settings.md` | `/dashboard/more/*` | Services, working hours, zones, notifications, AI voice settings |
| `integrations.md` | `/dashboard/more/integrations` | QuickBooks/Xero sync, calendar connections |

---

## System Prompt Engineering

The system prompt is the most important discretionary decision in this phase. Recommended structure:

```
You are Voco AI, an expert assistant for the Voco dashboard — a platform that helps home service contractors (plumbers, HVAC, electricians, handymen) manage calls, leads, bookings, and invoices.

Your role is to help business owners understand and use the dashboard. You:
- Answer questions about features and how they work
- Explain dashboard sections and their purpose
- Provide navigation links when the user needs to go somewhere
- Give short, practical answers (2-4 sentences unless a step-by-step is needed)

You do NOT:
- Create, edit, or delete any data
- Access the user's specific data or account information
- Make promises about features that don't exist

The user is currently on: {currentRoute}

When you want to suggest navigation, use this format exactly:
[Go to Page Name](/dashboard/path)

Place navigation links on their own line after your answer.

{knowledgeContext}
```

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `openai` npm | Groq API client | ✓ | 6.32.0 (installed) | — |
| `GROQ_API_KEY` env var | Chat completions | Assumed set (used by triage layer) | — | Return 503 with helpful error message |
| Node.js `fs` module | Reading markdown docs | ✓ | Node.js runtime (default for API routes) | — |
| shadcn `Sheet` | Chat panel | ✓ | Installed | — |
| shadcn `Badge` | Sheet header label | ✓ | Installed | — |
| `lucide-react` icons | MessageSquare, Send, Bot, ChevronRight | ✓ | 0.577.0 (installed) | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:**
- `GROQ_API_KEY` in production: API route should handle missing key gracefully (503 response with user-friendly error message in chat).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7.0 |
| Config file | `jest.config.js` (root) |
| Quick run command | `npm test -- --testPathPattern=chatbot` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CHAT-01 | `getRelevantKnowledge` returns route-matched doc | unit | `npm test -- --testPathPattern=chatbot-knowledge` | ❌ Wave 0 |
| CHAT-02 | `getRelevantKnowledge` returns keyword-matched doc | unit | `npm test -- --testPathPattern=chatbot-knowledge` | ❌ Wave 0 |
| CHAT-03 | `getRelevantKnowledge` returns empty string when no match | unit | `npm test -- --testPathPattern=chatbot-knowledge` | ❌ Wave 0 |
| CHAT-04 | `parseMessageContent` extracts nav links from LLM response | unit | `npm test -- --testPathPattern=ChatMessage` | ❌ Wave 0 |
| CHAT-05 | `/api/chat` returns 401 without auth | manual smoke | `curl -X POST /api/chat` | ❌ Wave 0 |
| CHAT-06 | Chat open state persists across open/close (React state) | manual | UI test in browser | N/A — manual only |

### Sampling Rate
- **Per task commit:** `npm test -- --testPathPattern=chatbot --passWithNoTests`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/chatbot-knowledge.test.js` — covers CHAT-01, CHAT-02, CHAT-03
- [ ] `tests/unit/chat-message-parse.test.js` — covers CHAT-04

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on This Phase |
|-----------|---------------------|
| Brand name is Voco | Chatbot is "Voco AI", not "AI Assistant" or "HomeService AI" |
| Keep skills in sync | After implementing, update `dashboard-crm-system` SKILL.md to document ChatbotSheet, API route, knowledge dir |
| Tech stack: Next.js App Router, Supabase Auth + RLS | API route uses `getTenantId()` — standard auth pattern |
| Tech stack: openai npm package (v6.32.0) | Use this for Groq, not a separate SDK |
| Design system: shadcn/ui, Tailwind, design-tokens.js | Use `card`, `btn`, `colors` tokens; match existing component styles |
| `@react-pdf/renderer` in `serverExternalPackages` | No action needed for chatbot; note this pattern if any chatbot library needed server-side bundle exclusion |
| Fallback email domains: `getvoco.ai` | Not relevant to this phase |

---

## Open Questions

1. **Should `DashboardSidebar` receive `businessName` prop?**
   - What we know: `DashboardSidebar` has a `businessName` prop in its function signature but `layout.js` doesn't currently pass it (the data fetch for businessName was removed or deferred)
   - What's unclear: Whether the sidebar shows the business name at the bottom; current source doesn't show it being passed
   - Recommendation: Don't change this — chatbot trigger doesn't need businessName; use window event for open state

2. **Groq model stability**
   - What we know: `meta-llama/llama-4-scout-17b-16e-instruct` is what the triage layer currently uses
   - What's unclear: Whether Groq has deprecated any models since training cutoff
   - Recommendation: Use the same model as layer2-llm.js to keep consistency; if the model isn't available, fallback to `llama3-8b-8192` which is a stable Groq model

3. **Knowledge doc content completeness**
   - What we know: The SKILL.md files contain comprehensive architecture knowledge but are too long for LLM context injection
   - What's unclear: How much detail each knowledge doc needs for the chatbot to answer typical "how do I" questions
   - Recommendation: Keep each doc under 500 words; focus on user-facing workflows, not implementation details

---

## Sources

### Primary (HIGH confidence)
- Direct source inspection: `src/lib/triage/layer2-llm.js` — Groq OpenAI-compatible client pattern confirmed
- Direct source inspection: `src/app/dashboard/layout.js` — window event pattern confirmed (DashboardTour)
- Direct source inspection: `src/components/ui/sheet.jsx` — Sheet API confirmed (side prop, className override)
- Direct source inspection: `src/components/dashboard/DashboardSidebar.jsx` — exact button styling confirmed
- Direct source inspection: `src/app/dashboard/more/page.js` — QUICK_ACCESS item structure confirmed
- Direct source inspection: `package.json` — openai 6.32.0 confirmed installed; no groq-sdk present
- Direct source inspection: `next.config.js` — Node.js runtime is default (no edge runtime configured)
- Direct source inspection: `.env.example` — GROQ_API_KEY is optional/commented, needs attention

### Secondary (MEDIUM confidence)
- `npm view openai version` → 6.33.0 is latest (installed is 6.32.0 — one patch behind, no action needed)

### Tertiary (LOW confidence)
- Groq model `meta-llama/llama-4-scout-17b-16e-instruct` — confirmed in codebase but Groq model availability can change; fallback to `llama3-8b-8192` if needed

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages confirmed installed via package.json inspection
- Architecture patterns: HIGH — all patterns traced to existing codebase (DashboardTour, sheet.jsx, layer2-llm.js, search/route.js)
- Pitfalls: HIGH — all pitfalls derived from direct source reading (SheetContent class structure, DashboardSidebar prop signature, layout architecture)
- Knowledge doc structure: MEDIUM — structure is recommended, content quality depends on writing effort

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (stable stack — openai SDK, shadcn, Groq model names are the only moving parts)

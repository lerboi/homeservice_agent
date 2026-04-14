# Phase 48: Dashboard Home Redesign — Research

**Researched:** 2026-04-14
**Domain:** Next.js App Router dashboard page, React Context state lifting, Supabase data fetching, shadcn/ui component composition
**Confidence:** HIGH — all findings verified directly against codebase

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Refactor `src/components/dashboard/SetupChecklist.jsx` in place — do not replace with a new component. Preserve the conic-gradient progress ring, dismissal API (`PATCH /api/setup-checklist`), and `SetupCompleteBar` celebration modal.
- **D-02:** Checklist items grouped by theme — **profile / voice / calendar / billing** — each with accordion section and mini-progress indicator. Each item carries a required/recommended badge. Replaces current required-vs-recommended top-level split.
- **D-03:** Each item exposes three actions: **Dismiss** (hides row), **Mark done** (manual override), **Jump to page** (deep-link with hash anchor).
- **D-04:** Completion computed **server-side** in `/api/setup-checklist` by inspecting real state — `tenants.business_name`, `tenants.phone_number`, `calendar_credentials` row presence, `subscriptions.status = 'active'`, etc.
- **D-05:** Home page refetches checklist on **mount + window focus** (`visibilitychange`/`focus`). No polling, no Realtime.
- **D-06:** **Bento grid** on desktop (`md+`): `Today's Appointments` hero tile (left), `Calls`, `Hot/New Leads`, `Usage Meter` medium tiles (right). Col-span split: `col-span-8` main + `col-span-4` chat sidebar at `lg+`.
- **D-07:** Inline missed-calls alert → merged into Calls card. `RecentActivityFeed` kept as secondary section. Invoices card dropped. Today's schedule inline list subsumed into hero tile. Greeting + status kept above hub.
- **D-08:** Chat panel in **right-hand sidebar on lg+**, stacks below bento hub on mobile/tablet. Visually integrated, not floating.
- **D-09:** Panel looks like a permanent part of the dashboard.
- **D-10:** Lift chat state into **`ChatProvider` React Context** wrapping dashboard layout at `src/app/dashboard/layout.js`. Both home-page panel and `ChatbotSheet` consume via `useChatContext()`. No Zustand. Refactor existing `useState` in `ChatbotSheet`.
- **D-11:** Chat messages **ephemeral** — reset on page refresh. No Supabase `chat_messages` table, no localStorage.
- **D-12:** New `GET /api/usage` route reading from `subscriptions` (`calls_used`, `calls_limit`, `current_period_end`) and `usage_events` (count this cycle). Returns: `{ callsUsed, callsIncluded, cycleDaysLeft, overageDollars }`.
- **D-13:** Usage card is a **horizontal progress bar** with threshold colors: copper 0–74%, amber 75–99%, red ≥100%. Caption: `{cycleDaysLeft} days left • ${overageDollars} over` (overage shown only when > $0).
- **D-14:** **Quick-link tile grid** — 3–4 tiles, each routes to settings page. Header: "Where do I…" framing.
- **D-15:** Tile content is planner's discretion.
- **D-16:** Mobile stack order (375px): Setup Checklist → Today's Appointments → Calls → Hot/New Leads → Usage → Help → RecentActivityFeed → AI Chat Panel. Single column, same content as desktop.
- **D-17:** No condensed mobile variants. No horizontal scroll at 375px.

### Claude's Discretion

- Exact copy for Help card header and tile labels
- Exact copy for empty states
- Chat panel visual polish (must match existing `ChatbotSheet` aesthetic)
- Hero tile visual treatment (timeline vs list vs summary-plus-next)
- Animation choices — use existing design-tokens + tailwind, no new animation libraries
- Accordion behavior: one group open at a time vs all independently collapsible

### Deferred Ideas (OUT OF SCOPE)

- Cross-refresh chat persistence (localStorage or Supabase `chat_messages`)
- Command palette (Cmd+K)
- Supabase Realtime for checklist auto-detection
- Projected end-of-cycle usage
- Collapsible cards / condensed mobile variants
- Dynamic quick-link surface based on setup state

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HOME-01 | Setup checklist with progress indicator, items grouped by theme (profile, voice, calendar, billing), dismiss/mark-done/jump-to-page actions | SetupChecklist.jsx refactor; ChecklistItem.jsx extension; PATCH API extension for `mark_done` |
| HOME-02 | Daily-ops hub with today's appointments, recent calls (last 24h), hot/new leads, usage meter | Bento grid using `card.base`/`card.hover` tokens; new `/api/usage` route; existing `/api/appointments`, `/api/calls`, `/api/dashboard/stats` |
| HOME-03 | Setup checklist auto-detects completion without user action | Server-side `deriveChecklistItems()` already partially does this; extend with `tenants.phone_number`, `subscriptions.status` checks; add window-focus refetch |
| HOME-04 | Integrated AI chat panel on home page | New `ChatPanel.jsx` consuming `useChatContext()`; right sidebar lg+, stacked below on mobile |
| HOME-05 | Chat surface shares history with `ChatbotSheet` | New `ChatProvider` React Context at layout.js; both surfaces consume `useChatContext()` |
| HOME-06 | Help & Discoverability section with quick-links | New `HelpDiscoverabilityCard.jsx`; static tile grid; routes to settings pages with hash anchors |
| HOME-07 | Fully responsive at 375px, no horizontal scroll | Standard Tailwind `md:`/`lg:` breakpoints; `w-full` on all cards; mobile stack order per D-16 |

</phase_requirements>

---

## Summary

The dashboard home page (`src/app/dashboard/page.js`, 559 lines) is currently an adaptive component with two modes: setup mode (checklist hero) and active mode (command center). Active mode renders greeting, missed-calls alert, conditional setup checklist, today's schedule, new leads + invoice grid, and recent activity feed. The Invoices card, standalone missed-calls alert, and the setup/active mode split are all removed in Phase 48. The new structure is always-on regardless of setup completion.

The chat state lift is straightforward: `ChatbotSheet` has 175 lines with local `useState([GREETING])` for messages. This moves into a new `ChatProvider` context at `layout.js` (line 89 is where `ChatbotSheet` is currently mounted). Both `ChatbotSheet` and the new `ChatPanel` will consume the same context, preserving the always-mounted pattern. The `currentRoute` prop currently passed to `ChatbotSheet` from layout's `usePathname()` must be carried through context or passed separately to the chat API call.

The usage meter requires a new `GET /api/usage` route. The data is available in the `subscriptions` table (`calls_used`, `calls_limit`, `current_period_end`) and the overage rate in `PRICING_TIERS` from `pricingData.js`. The `overageDollars` calculation is `max(0, callsUsed - callsLimit) * overageRate` using plan-specific rates (Starter: $2.48, Growth: $2.08, Scale: $1.50). The billing page already does this calculation in-page from `PRICING_TIERS`; the new `/api/usage` route consolidates it server-side.

**Primary recommendation:** Build in waves — Wave 0 (test scaffold + new route stubs), Wave 1 (ChatProvider + context lift), Wave 2 (SetupChecklist refactor), Wave 3 (DailyOpsHub + new tiles), Wave 4 (ChatPanel + HelpDiscoverabilityCard + page.js wiring), Wave 5 (mobile verification + skill sync).

---

## Standard Stack

### Core (all verified in codebase)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React Context API | (built-in) | Chat state sharing across ChatPanel and ChatbotSheet | D-10 locks this; no new deps |
| shadcn/ui | initialized (new-york) | Card, Button, Badge, Accordion, Progress, Skeleton, Sheet | Already installed per UI-SPEC |
| lucide-react | ^0.577.0 | Icons per UI-SPEC convention | Project standard |
| Tailwind CSS | (configured) | Layout, spacing, responsive breakpoints | Project standard |
| SWR (`useSWRFetch` hook) | (in use) | Data fetching with `revalidateOnFocus: true` for checklist window-focus refetch | Already used by billing page; `revalidateOnFocus` built in |
| `date-fns` | (in use) | `formatDistanceToNow` for relative times | Already imported in `page.js` |

[VERIFIED: codebase]

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `framer-motion` | (in use) | Entrance animations, reduced-motion support | SetupChecklist already uses it; card entrances |
| `sonner` | (in use) | Toast for dismiss/undo notification | Already in layout.js `<Toaster />` |
| `@/lib/design-tokens` | local | `card.base`, `card.hover`, `btn.primary`, etc. | All new cards MUST compose from these |

[VERIFIED: codebase]

**Installation:** No new packages required. All dependencies are present.

---

## Architecture Patterns

### Recommended Project Structure (new files)

```
src/
├── app/dashboard/
│   ├── page.js                        ← Rewrite (559 lines → new structure)
│   ├── layout.js                      ← Extend: wrap in ChatProvider, move ChatbotSheet inside
│   └── api/usage/
│       └── route.js                   ← New: GET /api/usage
├── components/dashboard/
│   ├── SetupChecklist.jsx             ← Refactor in-place (269 lines)
│   ├── ChecklistItem.jsx              ← Extend with dismiss + mark-done actions
│   ├── DailyOpsHub.jsx                ← New bento grid container
│   ├── TodayAppointmentsTile.jsx      ← New hero tile
│   ├── CallsTile.jsx                  ← New medium tile (absorbs missed-calls alert)
│   ├── HotLeadsTile.jsx               ← New medium tile
│   ├── UsageTile.jsx                  ← New medium tile
│   ├── HelpDiscoverabilityCard.jsx    ← New tile grid card
│   ├── ChatPanel.jsx                  ← New inline panel (right sidebar lg+)
│   └── ChatProvider.jsx               ← New React Context + useChatContext hook
```

[VERIFIED: CONTEXT.md canonical_refs + codebase file inspection]

### Pattern 1: React Context for Shared Chat State

**What:** `ChatProvider` wraps `DashboardLayout` children and exposes `{ messages, isLoading, sendMessage, currentRoute }`. Both `ChatbotSheet` and `ChatPanel` call `useChatContext()`.

**When to use:** Required by D-10; enables in-session history sharing without new dependencies.

**Key implementation notes:**
- Current `ChatbotSheet` receives `currentRoute` prop from layout's `usePathname()`. After lift, context can expose `currentRoute` directly (layout already has it via `usePathname()`).
- `GREETING` constant in `ChatbotSheet` becomes the context's initial `messages` value.
- `handleSend` logic (lines 49–90 of ChatbotSheet.jsx) moves into context provider.
- Context must pass `history` (last 10 messages) to `POST /api/chat` exactly as today.

```javascript
// Source: src/components/dashboard/ChatbotSheet.jsx lines 49-62 (current pattern to lift)
const history = messages.slice(-10).map((m) => ({
  role: m.role === 'ai' ? 'assistant' : 'user',
  content: m.content,
}));
// POST /api/chat with { message, currentRoute, history }
```

[VERIFIED: codebase]

### Pattern 2: Window-Focus Refetch via `useSWRFetch`

**What:** `useSWRFetch` already has `revalidateOnFocus: true`. Using it for checklist (and optionally the hub tiles) automatically implements D-05 without manual `visibilitychange` listeners.

**When to use:** All new API calls from the home page that need window-focus refresh (checklist at minimum; hub tiles optional per judgment call on stale tolerance).

```javascript
// Source: src/hooks/useSWRFetch.js (current hook)
export function useSWRFetch(url, options = {}) {
  return useSWR(url, fetcher, {
    revalidateOnFocus: true,   // implements D-05 for free
    revalidateOnReconnect: true,
    dedupingInterval: 5000,
    ...options,
  });
}
```

[VERIFIED: codebase]

### Pattern 3: Bento Grid Layout

**What:** CSS Grid with named column spans. Main content `lg:col-span-8`, chat sidebar `lg:col-span-4`. Inside main content: hero tile `md:col-span-2`, medium tiles `md:col-span-1`.

**Implementation note:** Dashboard layout already uses `max-w-6xl mx-auto` with `px-4 lg:px-8`. The bento grid lives inside this wrapper. At `lg+`, a two-column outer grid (`grid-cols-12` or `grid-cols-3`) splits main content from chat. At `md`, chat drops to full-width below. At `< md`, single column stack.

```jsx
// Desktop: 12-col outer grid
// lg: col-span-8 (main) + col-span-4 (chat)
// Bento inside main: grid-cols-2 on md+, grid-cols-1 on mobile
// Hero tile: md:col-span-2 (full width of bento)
// Medium tiles: md:col-span-1
```

[VERIFIED: UI-SPEC layout contract + design decision D-06]

### Pattern 4: Server-Side Checklist Completion Detection

**What:** `deriveChecklistItems()` in `/api/setup-checklist/route.js` already inspects real DB state. Current implementation checks 7 items via 4 parallel Supabase queries. Phase 48 adds new theme groupings and two new completion signals.

**New signals to add:**
- `tenants.business_name` non-null → profile item complete
- `tenants.phone_number` non-null → voice item complete (phone provisioned)
- `subscriptions.status IN ('trialing', 'active', 'past_due')` → billing item complete

**Current item-to-theme mapping (to be reorganized):**

| Current Item ID | Current Type | New Theme |
|----------------|--------------|-----------|
| `configure_services` | required | voice |
| `make_test_call` | required | voice |
| `configure_hours` | required | voice |
| `connect_calendar` | recommended | calendar |
| `configure_zones` | recommended | calendar |
| `setup_escalation` | recommended | profile |
| `configure_notifications` | recommended | voice |
| `configure_call_routing` | recommended | voice |

**New items to add (derived from current CONTEXT.md D-02):**
- `setup_profile` (profile theme) — complete when `tenants.business_name` is set
- `setup_billing` (billing theme) — complete when subscription row exists with active/trialing status

[VERIFIED: codebase — src/app/api/setup-checklist/route.js + 010_billing_schema.sql]

### Pattern 5: Usage Meter Data Computation

**What:** `GET /api/usage` reads `subscriptions` for `calls_used`, `calls_limit`, `current_period_end`, `plan_id`. Overage rate is looked up from `PRICING_TIERS` (in `pricingData.js`). Returns computed payload.

**Overage rates (from pricingData.js):**
- Starter: $2.48/call
- Growth: $2.08/call
- Scale: $1.50/call

**Computation:**
```javascript
const overageCalls = Math.max(0, callsUsed - callsIncluded);
const overageDollars = overageCalls * overageRate;
const cycleDaysLeft = Math.ceil((new Date(current_period_end) - new Date()) / 86400000);
```

**Existing precedent:** `src/app/api/billing/data/route.js` already reads subscriptions via `createSupabaseServer()` with `is_current = true` filter. New `/api/usage` should follow the same auth pattern (`createSupabaseServer()` for user auth, then service-role Supabase for the subscription query).

[VERIFIED: codebase — 010_billing_schema.sql, billing/page.js, pricingData.js]

### Pattern 6: PATCH API Extension for mark_done

**What:** Current `PATCH /api/setup-checklist` only accepts `{ dismissed: true }`. Must extend to handle `{ item_id: string, mark_done: true }` and `{ item_id: string, dismiss: true }` per D-03.

**Storage:** No existing `mark_done` column on any table. Options:
1. Add JSONB column `checklist_overrides` to `tenants` — stores `{ [item_id]: { dismissed?: bool, mark_done?: bool } }`
2. Use existing `setup_checklist_dismissed` boolean (only covers whole-checklist dismiss) — insufficient for per-item

**Required:** A migration adding `checklist_overrides JSONB DEFAULT '{}'::jsonb` to `tenants` (or similar). The `deriveChecklistItems()` function must then apply manual overrides on top of auto-detected state.

**Undo flow:** Dismiss produces a toast with `Undo` link that fires `PATCH /api/setup-checklist` with `{ item_id, dismiss: false }`.

[VERIFIED: codebase + CONTEXT.md D-03]

### Anti-Patterns to Avoid

- **Replacing `SetupChecklist.jsx`:** D-01 locks refactor-in-place. Do not create a new file.
- **Using `useState` for checklist data in `ChatbotSheet`:** After context lift, `ChatbotSheet` must only read from `useChatContext()`, no local state for messages.
- **Direct Supabase client query for subscriptions:** Use `createSupabaseServer()` (server-side auth pattern) in the new `/api/usage` route, not browser Supabase client.
- **Adding `dark:` variants:** Phase 49 owns dark mode. No `dark:` classes in any Phase 48 component.
- **`useTheme()`:** Not to be wired in this phase per UI-SPEC scope note.
- **Raw `bg-white rounded-2xl` inline:** All cards must compose from `card.base` per UI-SPEC composition rule.
- **More than one accent-colored button per card:** 10% color budget rule from UI-SPEC.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Window-focus refetch | Manual `visibilitychange` listener | `useSWRFetch` (`revalidateOnFocus: true`) | Already implemented in `useSWRFetch.js` |
| Progress bar | Custom SVG or div | shadcn `Progress` component | Already installed; `aria-valuenow/min/max` handled |
| Accordion sections | Custom expand/collapse | shadcn `Accordion` (Radix) | ARIA handled; used by UI-SPEC |
| Toast with undo | Custom notification | `sonner` (already in layout) | `Toaster` already mounted at layout level |
| Message scroll | Custom scroll-to-bottom | `useRef + scrollIntoView` | Exact pattern in current `ChatbotSheet.jsx` lines 39–41 |
| Skeleton loading | Custom shimmer | shadcn `Skeleton` | Already used throughout dashboard |
| Typing indicator | Custom pulse | `TypingIndicator.jsx` | Already exists at `src/components/dashboard/TypingIndicator.jsx` |
| Chat message bubble | Custom bubble | `ChatMessage.jsx` | Already exists with correct nav-link parsing |

**Key insight:** The chat infrastructure (message bubbles, typing indicator, nav links, API route) is fully built. Phase 48 only needs to lift state into context and add a new inline panel that consumes the same context.

---

## Runtime State Inventory

Phase 48 is not a rename/refactor/migration phase. No runtime state inventory required.

**Scope note:** The checklist `mark_done` and per-item `dismiss` overrides do require a new DB column (`checklist_overrides JSONB` on `tenants`). This is a schema addition, not a data migration — existing rows default to `'{}'::jsonb`, no data backfill needed.

---

## Common Pitfalls

### Pitfall 1: `currentRoute` Lost After Context Lift

**What goes wrong:** `ChatbotSheet` currently receives `currentRoute={pathname}` prop from layout (line 89). After lifting state into context, if `currentRoute` is not threaded into the send function, the `/api/chat` call sends `currentRoute: undefined`, degrading RAG quality.

**Why it happens:** Context provider in `ChatProvider.jsx` is separate from `DashboardLayoutInner` where `usePathname()` lives.

**How to avoid:** Either (a) expose `currentRoute` as a context value that gets updated from layout's `usePathname()`, or (b) pass `currentRoute` as a prop to `ChatProvider`. Option (a) is cleaner.

**Warning signs:** AI responses stop referencing current page context; RAG returns generic answers.

### Pitfall 2: Double Mounting of `ChatbotSheet`

**What goes wrong:** `ChatbotSheet` currently mounts at layout level (line 89 of layout.js). `ChatPanel` mounts on the home page. If both subscribe to the same send events independently, messages could duplicate.

**Why it happens:** Context correctly prevents this if both consume `useChatContext()` — they read from the same `messages` array. But if `ChatbotSheet` is not fully migrated to context (still has any local `useState`), messages will diverge.

**How to avoid:** Remove ALL local `useState` from `ChatbotSheet` for `messages`, `isLoading`, and `input` after context lift. Only `input` field value can remain local (it's ephemeral input state, not history).

**Warning signs:** Opening `ChatbotSheet` after chatting in `ChatPanel` shows empty history.

### Pitfall 3: `mark_done` Without DB Column

**What goes wrong:** D-03 requires per-item dismiss and mark-done. Current PATCH API only updates `setup_checklist_dismissed` (whole-checklist boolean). No per-item override storage exists.

**Why it happens:** The original checklist design only supported whole-checklist dismiss.

**How to avoid:** Wave 0 must include a migration adding `checklist_overrides JSONB DEFAULT '{}'::jsonb NOT NULL` to `tenants`. The `deriveChecklistItems()` function applies overrides after auto-detection: if `overrides[item_id]?.mark_done === true`, force `complete: true`; if `overrides[item_id]?.dismissed === true`, exclude item from list.

**Warning signs:** Mark-done state is lost on next checklist fetch.

### Pitfall 4: Overage Rate Not Available Server-Side

**What goes wrong:** `PRICING_TIERS` lives in `src/app/(public)/pricing/pricingData.js` — a client module. The new `GET /api/usage` route runs server-side and must compute `overageDollars`.

**Why it happens:** `pricingData.js` imports work in both client and server contexts (no `'use client'` directive) — the file is safe to import in a route handler. Verify no browser-only APIs are used.

**How to avoid:** Import `PRICING_TIERS` directly from `pricingData.js` in the route handler. If import fails (edge runtime, etc.), inline the rate lookup as a plain object constant.

**Warning signs:** Build error: "cannot import client-side module in server component."

### Pitfall 5: Bento Hero Tile Width on Tablet (md 768–1023px)

**What goes wrong:** UI-SPEC says hero tile spans both bento columns (`md:col-span-2`). On tablet, chat drops below. But the bento inner grid is `grid-cols-2` on `md+` — at 768px, the hero tile is two of those two columns (full-width within bento), which is correct. However if the outer layout also goes two-column at `md` (12-col), bento and chat would share the row at md.

**Why it happens:** UI-SPEC layout says chat drops below on `md` 768–1023px — meaning the outer layout must stay single-column at `md`, only splitting at `lg+`. Misreading the breakpoints causes chat to appear alongside bento at 768px.

**How to avoid:** Outer content+chat split uses `lg:` breakpoint exclusively. `md:` is only used for the inner bento grid (2 tiles per row). Verify at 768px: chat is below, bento is 2-column tiles.

### Pitfall 6: `useSWRFetch` Dedupe Interval Swallows Quick Navigation

**What goes wrong:** `dedupingInterval: 5000` means navigating away and back within 5 seconds returns cached data. This is fine for hub cards but could mean a checklist item just completed elsewhere doesn't show as complete for up to 5 seconds after returning.

**Why it happens:** SWR deduplication is a feature but creates a perception gap.

**How to avoid:** This is acceptable per D-05 ("on window focus" rather than instant). Document as expected behavior. If owners complain, the mitigation is calling `mutate()` on the SWR key after saving in settings pages — but that is out of scope for Phase 48.

### Pitfall 7: Phase 52 "Jobs" vs "Leads" Copy Conflict

**What goes wrong:** UI-SPEC CTA table specifies: `Hot/New Leads card → "Open Jobs"` (matches Phase 52 rename) with fallback `"View all leads"` if Phase 52 ships after Phase 48.

**Why it happens:** Phase 52 (Leads → Jobs rename) is not yet shipped. If Phase 48 ships first, `"Open Jobs"` routes to `/dashboard/leads` which still says "Leads" — visible inconsistency.

**How to avoid:** Use `"View all leads"` as the label in Phase 48. Update to `"Open Jobs"` when Phase 52 ships. Document this in the plan's Wave 5 skill-sync note.

---

## Code Examples

### ChatProvider Context (new file)

```javascript
// Source: based on ChatbotSheet.jsx lines 12-90 pattern, lifted to context
// File: src/components/dashboard/ChatProvider.jsx
'use client';
import { createContext, useContext, useState, useCallback } from 'react';

const GREETING = {
  id: 'greeting',
  role: 'ai',
  content: "Hi, I'm Voco AI. I can help you navigate the dashboard...",
};

const ChatContext = createContext(null);

export function ChatProvider({ children, currentRoute }) {
  const [messages, setMessages] = useState([GREETING]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(async (input) => {
    // lifted from ChatbotSheet handleSend — lines 49-90
    const userMessage = { id: Date.now(), role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    const history = messages.slice(-10).map((m) => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.content,
    }));
    // ... fetch /api/chat, append AI reply, setIsLoading(false)
  }, [messages, currentRoute]);

  return (
    <ChatContext.Provider value={{ messages, isLoading, sendMessage }}>
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

[VERIFIED: based on ChatbotSheet.jsx lines 12-90]

### layout.js ChatProvider Wrapping Pattern

```javascript
// Source: src/app/dashboard/layout.js (current structure, lines 20-93)
// After Phase 48: wrap DashboardLayoutInner with ChatProvider
function DashboardLayoutInner({ children }) {
  const pathname = usePathname();
  // ... existing state ...
  return (
    <ChatProvider currentRoute={pathname}>
      <TooltipProvider delayDuration={300}>
        {/* ... existing layout content ... */}
        <ChatbotSheet open={chatOpen} onOpenChange={setChatOpen} />
        {/* Note: remove currentRoute prop — context provides it */}
      </TooltipProvider>
    </ChatProvider>
  );
}
```

[VERIFIED: src/app/dashboard/layout.js lines 43-93]

### Usage Meter Data Route Pattern

```javascript
// Source: based on /api/billing/data/route.js auth pattern
// File: src/app/api/usage/route.js
import { createSupabaseServer } from '@/lib/supabase-server';
import { PRICING_TIERS } from '@/app/(public)/pricing/pricingData';

export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // Get tenantId, then fetch subscription
  const { data: tenant } = await supabase.from('tenants').select('id').eq('owner_id', user.id).maybeSingle();
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('calls_used, calls_limit, current_period_end, plan_id')
    .eq('tenant_id', tenant.id).eq('is_current', true).maybeSingle();

  const planTier = PRICING_TIERS.find((t) => t.id === sub?.plan_id);
  const callsUsed = sub?.calls_used ?? 0;
  const callsIncluded = sub?.calls_limit ?? 0;
  const cycleDaysLeft = sub?.current_period_end
    ? Math.max(0, Math.ceil((new Date(sub.current_period_end) - new Date()) / 86400000))
    : 0;
  const overageCalls = Math.max(0, callsUsed - callsIncluded);
  const overageDollars = overageCalls * (planTier?.overageRate ?? 0);

  return Response.json({ callsUsed, callsIncluded, cycleDaysLeft, overageDollars });
}
```

[VERIFIED: /api/billing/data/route.js auth pattern + billing/page.js overage calc + pricingData.js rates]

### Checklist Theme Grouping Schema

```javascript
// New THEME_GROUPS constant to replace current ITEM_TYPE in SetupChecklist.jsx
const THEME_GROUPS = {
  profile: {
    label: 'Profile',
    items: ['setup_profile'],         // new item: business_name
  },
  voice: {
    label: 'Voice',
    items: ['configure_services', 'make_test_call', 'configure_hours',
            'configure_notifications', 'configure_call_routing'],
  },
  calendar: {
    label: 'Calendar',
    items: ['connect_calendar', 'configure_zones', 'setup_escalation'],
  },
  billing: {
    label: 'Billing',
    items: ['setup_billing'],          // new item: active/trialing subscription
  },
};
```

[VERIFIED: CONTEXT.md D-02 + current SetupChecklist.jsx ITEM_TYPE]

### Bento Grid Container Skeleton

```jsx
// Source: UI-SPEC layout contract + card.base token
// File: src/components/dashboard/DailyOpsHub.jsx
import { card } from '@/lib/design-tokens';

export default function DailyOpsHub({ appointments, calls, leads, usage }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
      {/* Hero tile — spans full width on md+ */}
      <div className="md:col-span-2">
        <TodayAppointmentsTile appointments={appointments} />
      </div>
      {/* Medium tiles */}
      <CallsTile calls={calls} />
      <HotLeadsTile leads={leads} />
      {/* Usage — full width of bento (below 2 medium tiles) */}
      <div className="md:col-span-2">
        <UsageTile usage={usage} />
      </div>
    </div>
  );
}
```

[VERIFIED: UI-SPEC layout contract, D-06]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Setup mode vs active mode split | Always-on command center | Phase 48 | Removes conditional render logic; checklist always shows until all items complete or dismissed |
| `useState` in `ChatbotSheet` | Context-owned state in `ChatProvider` | Phase 48 | Enables `ChatPanel` to share history; preserves always-mounted pattern |
| Required/recommended top-level split | Theme-grouped accordion (profile/voice/calendar/billing) | Phase 48 | Matches owner mental model; required/recommended becomes a badge, not a grouping |
| Inline missed-calls alert (standalone) | Merged into Calls card (flagged rows at top) | Phase 48 | Reduces visual noise; one surface per data type |
| Invoices card on home page | Removed; invoices at `/dashboard/billing` only | Phase 48 | Home page focuses on daily ops, not billing |

**Deprecated/outdated:**
- `setupMode` conditional (`page.js` line 196): removed — checklist renders in all states until dismissed
- `REQUIRED_IDS` / `RECOMMENDED_IDS` arrays in `page.js`: removed — completion logic moves entirely to API
- Standalone missed-calls alert block (page.js lines 287–354): replaced by Calls card with flagged rows

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `pricingData.js` is importable in a Node.js route handler with no browser-only APIs | Code Examples / Pitfall 4 | Build error; must inline rate lookup as fallback |
| A2 | Theme grouping of checklist items (voice/calendar/profile/billing) — mapping of existing items to new themes | Architecture Patterns Pattern 4 | Planner must verify against product intent; wrong grouping is cosmetic but owner-visible |
| A3 | `subscriptions.status IN ('trialing', 'active', 'past_due')` is the correct signal for billing checklist item | Architecture Patterns Pattern 4 | If incorrect signal, billing item shows incomplete when owner has active billing |

---

## Open Questions (RESOLVED)

1. **`checklist_overrides` migration scope** — RESOLVED: JSONB column on `tenants` (`checklist_overrides JSONB DEFAULT '{}'::jsonb`) per existing `notification_preferences` JSONB pattern.
   - What we know: No per-item dismiss/mark_done column exists on `tenants`; `setup_checklist_dismissed` is whole-checklist only
   - What's unclear: Whether to use a JSONB column on `tenants` or a separate `checklist_overrides` table
   - Recommendation: JSONB on `tenants` (`checklist_overrides JSONB DEFAULT '{}'::jsonb`) is simplest; follows existing `notification_preferences` JSONB pattern on `tenants`

2. **`setup_profile` and `setup_billing` new items — are they real checklist IDs or UI-only?** — RESOLVED: Real checklist item IDs with server-side completion signals (`tenants.business_name` for profile, `subscriptions.status` for billing); they can be dismissed/marked like others.
   - What we know: D-02 says four themes (profile, voice, calendar, billing); current items don't include a profile or billing item
   - What's unclear: Whether new items need DB IDs (for dismiss/mark_done storage) or are theme headers only
   - Recommendation: Add as real checklist item IDs (`setup_profile`, `setup_billing`) with completion detection — they can be dismissed/marked like others; headers without items would look empty on new installs

3. **Chat panel height on desktop sidebar** — RESOLVED: `sticky top-6` to match the existing `py-6` content wrapper in the dashboard layout.
   - What we know: UI-SPEC says `sticky top-{layout-header-height}`; layout has no explicit sticky top bar (no top bar in current dashboard)
   - What's unclear: What the sticky offset should be — `top-0` or `top-6` (padding offset)
   - Recommendation: `sticky top-6` (matches `py-6` in layout content wrapper); planner adjusts based on visual verification

---

## Environment Availability

Step 2.6: SKIPPED — Phase 48 is a frontend/API refactor with no new external dependencies. All required tools (Node.js, npm, Supabase client) are part of the existing project setup. No new CLI tools, services, or runtimes introduced.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest (node environment) |
| Config file | `jest.config.js` |
| Quick run command | `npx jest --testPathPattern="tests/unit" --no-coverage` |
| Full suite command | `npx jest --testPathIgnorePatterns="integration" --no-coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HOME-01 | SetupChecklist renders themed groups (profile/voice/calendar/billing) | unit | `npx jest tests/unit/setup-checklist.test.js -x` | ❌ Wave 0 |
| HOME-01 | Each theme group shows correct items and required/recommended badges | unit | `npx jest tests/unit/setup-checklist.test.js -x` | ❌ Wave 0 |
| HOME-01 | Dismiss fires PATCH with correct body; undo reverses | unit | `npx jest tests/unit/setup-checklist.test.js -x` | ❌ Wave 0 |
| HOME-01 | mark_done fires PATCH; optimistic UI reverts on error | unit | `npx jest tests/unit/setup-checklist.test.js -x` | ❌ Wave 0 |
| HOME-02 | `/api/usage` returns `{ callsUsed, callsIncluded, cycleDaysLeft, overageDollars }` | unit | `npx jest tests/unit/usage-api.test.js -x` | ❌ Wave 0 |
| HOME-02 | Usage overage calculation: 0 when under cap, correct $ above cap | unit | `npx jest tests/unit/usage-api.test.js -x` | ❌ Wave 0 |
| HOME-02 | Usage bar color thresholds: copper < 75%, amber 75–99%, red ≥ 100% | unit | `npx jest tests/unit/usage-tile.test.js -x` | ❌ Wave 0 |
| HOME-03 | `deriveChecklistItems` returns `complete: true` for configured items | unit | `npx jest tests/unit/setup-checklist-derive.test.js -x` | ❌ Wave 0 |
| HOME-03 | `checklist_overrides` mark_done overrides auto-detection | unit | `npx jest tests/unit/setup-checklist-derive.test.js -x` | ❌ Wave 0 |
| HOME-04 | `ChatPanel` renders message list and sends messages via context | unit | `npx jest tests/unit/chat-panel.test.js -x` | ❌ Wave 0 |
| HOME-05 | Messages sent in `ChatPanel` appear in `ChatbotSheet` (same context) | unit | `npx jest tests/unit/chat-provider.test.js -x` | ❌ Wave 0 |
| HOME-05 | `currentRoute` is passed correctly to /api/chat from context | unit | `npx jest tests/unit/chat-provider.test.js -x` | ❌ Wave 0 |
| HOME-06 | Help tiles render 3–4 entries with correct hrefs | unit | `npx jest tests/unit/help-discoverability.test.js -x` | ❌ Wave 0 |
| HOME-07 | Home page renders without horizontal overflow at 375px | manual | Browser DevTools — 375px viewport | manual only |

### Sampling Rate

- **Per task commit:** `npx jest --testPathPattern="tests/unit" --no-coverage`
- **Per wave merge:** `npx jest --testPathIgnorePatterns="integration" --no-coverage`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/unit/setup-checklist.test.js` — covers HOME-01 (render + actions)
- [ ] `tests/unit/setup-checklist-derive.test.js` — covers HOME-03 (`deriveChecklistItems` pure function)
- [ ] `tests/unit/usage-api.test.js` — covers HOME-02 (`/api/usage` computation)
- [ ] `tests/unit/usage-tile.test.js` — covers HOME-02 (threshold color logic)
- [ ] `tests/unit/chat-provider.test.js` — covers HOME-05 (context sharing, currentRoute)
- [ ] `tests/unit/chat-panel.test.js` — covers HOME-04 (panel render + send)
- [ ] `tests/unit/help-discoverability.test.js` — covers HOME-06 (tile hrefs)

**Note:** Existing `tests/unit/chat-message-parse.test.js` and `tests/unit/chatbot-knowledge.test.js` already cover the chat infrastructure that Phase 48 reuses.

---

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (all new routes) | `createSupabaseServer()` + `getTenantId()` on every API route |
| V3 Session Management | no | Handled by Supabase Auth |
| V4 Access Control | yes | `getTenantId()` ensures all queries are tenant-scoped |
| V5 Input Validation | yes | PATCH `/api/setup-checklist` must validate `item_id` against known IDs, `mark_done`/`dismiss` are booleans |
| V6 Cryptography | no | No new crypto operations |

**No new threat patterns introduced.** All new API routes follow the existing `getTenantId()` + service-role Supabase read pattern. The PATCH extension must reject unknown `item_id` values to prevent arbitrary tenant-state manipulation.

---

## Sources

### Primary (HIGH confidence — verified in codebase)

- `src/app/dashboard/page.js` — full current implementation (559 lines)
- `src/app/dashboard/layout.js` — ChatbotSheet mounting point, always-mounted pattern
- `src/components/dashboard/ChatbotSheet.jsx` — message state, send logic to be lifted
- `src/components/dashboard/SetupChecklist.jsx` — refactor target; progress ring, accordion, dismiss
- `src/components/dashboard/ChecklistItem.jsx` — per-item expand/link pattern
- `src/components/dashboard/SetupCompleteBar.jsx` — celebration modal to preserve
- `src/components/dashboard/RecentActivityFeed.jsx` — kept unchanged
- `src/app/api/setup-checklist/route.js` — server-side `deriveChecklistItems()` to extend
- `src/app/api/dashboard/stats/route.js` — hot leads source (new leads count + preview)
- `src/app/api/appointments/route.js` — today's appointments source
- `src/app/api/calls/route.js` — calls last 24h source
- `src/app/api/chat/route.js` — chat backend (no changes)
- `src/app/api/billing/data/route.js` — auth pattern for `/api/usage`
- `src/lib/design-tokens.js` — all token definitions
- `src/hooks/useSWRFetch.js` — `revalidateOnFocus: true` pattern
- `supabase/migrations/010_billing_schema.sql` — `subscriptions` table schema
- `src/app/(public)/pricing/pricingData.js` — overage rates per plan
- `.planning/phases/48-dashboard-home-redesign/48-CONTEXT.md` — all locked decisions
- `.planning/phases/48-dashboard-home-redesign/48-UI-SPEC.md` — design contract

### Secondary (MEDIUM confidence)

- `src/app/dashboard/more/billing/page.js` — existing overage calculation pattern (in-page); confirms `overageRate * overageCalls` formula

### Tertiary (LOW confidence)

- None — all claims in this research are verified against the codebase.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified as installed and in use
- Architecture patterns: HIGH — all patterns derived directly from codebase inspection
- Pitfalls: HIGH — all pitfalls derive from direct code analysis, not conjecture
- Data sources: HIGH — all API routes and DB tables verified
- Assumptions log: 3 items, all LOW-RISK

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (stable stack; no fast-moving external dependencies)

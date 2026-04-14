# Phase 48: Dashboard Home Redesign — Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase transforms `src/app/dashboard/page.js` (currently 559 lines — greeting, conditional setup checklist, recent activity feed, inline missed calls alert, today's schedule list, 2-col new-leads + invoices grid) into a daily-use command center.

**In scope:** 7 requirements — HOME-01 (themed setup checklist), HOME-02 (daily-ops cards), HOME-03 (checklist auto-detection), HOME-04 (integrated AI chat panel), HOME-05 (shared chat history across surfaces), HOME-06 (Help & Discoverability quick-links), HOME-07 (375px responsive).

**Out of scope for this phase:**
- Cross-device chat persistence (Supabase-backed `chat_messages` table) — deferred to future phase; HOME-05 scope is in-session sharing only
- Billing overhaul / new pricing tiers — usage meter reads existing `subscriptions` + `usage_events`; no billing logic changes
- Dashboard-wide dark mode — Phase 49 owns the theme pass; Phase 48 uses existing tokens as-is
- Dedicated `/help` page or command palette — quick-link tile grid only

</domain>

<decisions>
## Implementation Decisions

### Setup Checklist (HOME-01, HOME-03)

- **D-01:** Refactor `src/components/dashboard/SetupChecklist.jsx` in place — do not replace with a new component. Preserve the conic-gradient progress ring, dismissal API (`PATCH /api/setup-checklist`), and `SetupCompleteBar` celebration modal. Extend existing structure with new grouping, jump-to-page actions, and server-side auto-detection.
- **D-02:** Items are grouped by theme — **profile / voice / calendar / billing** — each with its own accordion section and mini-progress indicator. Each item additionally carries a required/recommended badge so owners see both mental models at once ("voice setup" AND "urgency"). Replaces the current required-vs-recommended top-level split.
- **D-03:** Each checklist item exposes three actions: **Dismiss** (hides row, persisted via existing API), **Mark done** (manual override), **Jump to page** (deep-link to the settings page that completes the item, with hash anchor when the target page has multiple sections).

### Auto-Detection (HOME-03)

- **D-04:** Completion is computed **server-side** in `/api/setup-checklist` by inspecting real state — `tenants.business_name`, `tenants.phone_number`, `calendar_credentials` row presence, `subscriptions.status = 'active'`, etc. This is the source of truth. If an owner disconnects their calendar, the checklist reflects it on next fetch. Existing `PATCH /api/setup-checklist` still accepts `dismissed: true` and manual `mark_done` overrides, but base completion is always state-driven.
- **D-05:** Home page refetches checklist state on **mount + on window focus** — no polling, no Realtime subscriptions. Owner completes phone setup on `/dashboard/settings/phone`, switches back to the dashboard tab, checklist refetches automatically. Uses standard `visibilitychange` / `focus` listeners.

### Daily-Ops Hub Layout (HOME-02)

- **D-06:** **Bento grid** layout on desktop (md+ breakpoint): `Today's Appointments` is a large hero tile on the left, with `Calls (last 24h)`, `Hot/New Leads`, and `Usage Meter` as medium tiles stacked on the right. Gives visual hierarchy — appointments feel like the most important daily surface, the other three are at-a-glance side context.
- **D-07:** **Existing element fate:**
  - Inline missed-calls alert → **merged into the Calls card** (flagged rows at top: "3 missed • not attempted"); the standalone alert block is removed
  - `RecentActivityFeed` component → **kept** as a secondary section below the bento hub (tertiary context, not hero)
  - Invoices card → **dropped** from the home page; invoices belong on `/dashboard/billing`
  - Today's schedule inline list → **subsumed into the Today's Appointments hero tile**
  - Greeting + status indicator → **kept** above the hub

### Chat Panel Placement (HOME-04)

- **D-08:** AI chat panel sits in a **right-hand sidebar on wide screens** (lg+), alongside the bento hub in the main content area. On mobile/tablet it **stacks below the bento hub and Help section**. Owner reads morning glance first, has the chat as a helpful copilot rather than a hero demand.
- **D-09:** Panel is visually integrated into the page — not a floating pop-up. Looks like a permanent part of the dashboard, feels like a helper that's always there.

### Chat History Sharing (HOME-05)

- **D-10:** Lift chat state into a **React Context (`ChatProvider`) wrapping the dashboard layout** at `src/app/dashboard/layout.js`. Both the home-page panel and the always-mounted `ChatbotSheet` consume the same context via `useChatContext()`. No new dependencies (no Zustand, no event bus). Refactors the current `useState` inside `ChatbotSheet` into context-owned state.
- **D-11:** Chat messages are **ephemeral** — reset on page refresh. Matches current behavior. No Supabase `chat_messages` table, no localStorage persistence. Keeps scope focused on in-session sharing. Cross-refresh persistence is deferred as a future enhancement.

### Usage Meter (HOME-02)

- **D-12:** Build a new `GET /api/usage` route reading from `subscriptions` (plan cap, cycle start/end dates) and `usage_events` (call count this cycle). Returns: `{ callsUsed, callsIncluded, cycleDaysLeft, overageDollars }`. No new tables — both source tables already exist.
- **D-13:** Usage card visual is a **horizontal progress bar** showing `{callsUsed} / {callsIncluded}` with a % fill. Bar color shifts: neutral below 75%, amber 75–100%, red above 100%. Below the bar: `{cycleDaysLeft} days left • ${overageDollars} over` (overage line shown only when > $0).

### Help & Discoverability (HOME-06)

- **D-14:** **Quick-link tile grid** card format — 3 to 4 tiles, each a button that routes to the right settings page with a hash anchor where needed. Header copy: "Where do I…" or similar short prompt. No FAQ accordion, no command palette, no chat-panel prompt chips.
- **D-15:** **Tile content is planner's discretion** during planning. Guidance: choose high-intent owner tasks that are *not* already surfaced by the setup checklist (checklist handles onboarding, Help handles ongoing ops). Strong candidates: *Add a service*, *Change AI voice*, *Invite teammate*, *View invoices*, *Set escalation contacts*, *Connect calendar*. Planner picks 3–4 of these based on deep-link availability and value.

### Mobile 375px (HOME-07)

- **D-16:** **Mobile stack order** (from top to bottom): Setup Checklist → Today's Appointments → Calls → Hot/New Leads → Usage → Help & Discoverability → RecentActivityFeed → AI Chat Panel. Matches morning-ritual flow ("what am I missing?" → "what's today?" → "who called?" → "any hot leads?" → "how's my plan?" → "where do I find X?" → "recent context" → "ask Voco"). Chat at the bottom keeps the short morning scan above the fold.
- **D-17:** **No condensed mobile variants** — same content as desktop, just full-width single column. Cards stack cleanly at 375px with no horizontal scroll. Simpler to build and test; trades a bit of scroll length for content parity.

### Claude's Discretion

- Exact copy for Help card header and tile labels (per D-14, D-15)
- Exact copy for empty states (no appointments today, no calls in 24h, no hot leads, checklist complete)
- Chat panel visual polish — input styling, bubble design — must feel consistent with existing `ChatbotSheet` aesthetic once lifted into shared context
- Hero tile of "Today's Appointments" visual treatment — timeline vs list vs summary-plus-next — planner chooses based on available slots count patterns
- Exact micro-copy thresholds for usage meter color shifts (currently 75% / 100%)
- Animation choices for card entrances / progress ring updates — use existing design-tokens + tailwind, no new animation libraries

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Dashboard skill (architectural reference)
- `.claude/skills/dashboard-crm-system/SKILL.md` — Dashboard pages, setup checklist, design tokens, guided tour, Supabase Realtime patterns
- `.claude/skills/auth-database-multitenancy/SKILL.md` — Supabase clients, `getTenantId` pattern, all migrations (`tenants`, `calendar_credentials`, `subscriptions`, etc.)
- `.claude/skills/payment-architecture/SKILL.md` — `subscriptions`, `usage_events`, `increment_calls_used` RPC (source of truth for usage meter)

### Project-level
- `.planning/REQUIREMENTS.md` §"Dashboard Home" (HOME-01 through HOME-07)
- `.planning/ROADMAP.md` — Phase 48 entry (success criteria)
- `.planning/PROJECT.md` — v5.0 milestone goals

### Code files (current state)
- `src/app/dashboard/page.js` — dashboard home (559 lines, the page being redesigned)
- `src/app/dashboard/layout.js` — dashboard layout (ChatbotSheet mounted here)
- `src/components/dashboard/SetupChecklist.jsx` — component to refactor (D-01)
- `src/components/dashboard/ChatbotSheet.jsx` — chat sheet, state to be lifted into context (D-10)
- `src/components/dashboard/BottomTabBar.jsx` — mobile nav reference
- `src/components/dashboard/RecentActivityFeed.jsx` — component kept as tertiary (D-07)
- `src/app/api/setup-checklist/route.js` — to extend with server-side state inspection (D-04)
- `src/app/api/dashboard/stats/route.js` — existing hot leads source
- `src/app/api/appointments/route.js` — today's appointments source
- `src/app/api/calls/route.js` — calls + missed-calls source (`booking_outcome=not_attempted`)
- `src/app/api/chat/route.js` — chat backend (no changes expected)
- `src/lib/design-tokens.js` — `card.base`, `card.hover`, `heading`, `body`, `focus`, `btn`
- `supabase/migrations/` — `subscriptions` + `usage_events` table definitions for usage meter

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **SetupChecklist.jsx** — 269 lines, has progress ring, accordion groups, dismiss API, `SetupCompleteBar` modal. Refactor target (D-01).
- **ChatbotSheet.jsx** — 175 lines, mounted at dashboard layout level (line 89), always-persistent across routes. Local `useState` for messages array (last 10 sent to `/api/chat`). Context lift target (D-10).
- **design-tokens.js** — `card.base`, `card.hover`, `glass`, `gridTexture`, `heading`, `body`, `focus`, `selected`, `btn`. All new home cards should compose from these, not raw classes.
- **shadcn components present** — `Card`, `Button`, `Input`, `Badge`, `Sheet`, `Skeleton`, `Accordion`, `Dialog`, `Alert`, `Progress`, `Tooltip`, `Popover`, `Textarea`. `Progress` is available for the usage bar (D-13).
- **BottomTabBar** (`lg:hidden`) — existing mobile nav; home page doesn't need to re-implement mobile navigation, just content stacking (D-16).
- **DashboardTour** — triggered by `start-dashboard-tour` custom event, `gsd_has_seen_tour` localStorage key. Tour should cover new surfaces during the phase.

### Established Patterns
- **Always-mounted chat pattern** — `ChatbotSheet` lives in `dashboard/layout.js` (line 89) so it persists across route changes. Lifting chat state into context preserves this pattern without violating it (D-10).
- **Stats aggregation via `/api/dashboard/stats`** — existing pattern for consolidating multiple counts/previews into one endpoint. Consider extending or paralleling for the bento hub data needs.
- **API-driven checklist dismissal** — `PATCH /api/setup-checklist` already takes `dismissed: true`. Extend to also handle per-item `mark_done` overrides (D-04).
- **localStorage caching fallback** — existing `voco_today_appts` key caches appointments for offline glance. Apply same pattern to other hub cards where reasonable.
- **No explicit 375px breakpoint** — dashboard uses standard Tailwind `sm: md: lg:`. Phase 48 must verify at 375px even though no new breakpoint config is required.

### Integration Points
- **Dashboard layout** (`src/app/dashboard/layout.js`) — wrap children in `<ChatProvider>`, move `<ChatbotSheet />` inside provider. Home page consumes the same context.
- **Setup checklist API** — extend server-side logic to inspect state of `tenants`, `calendar_credentials`, `subscriptions`. Return same shape so existing consumers don't break.
- **New usage endpoint** — `GET /api/usage` should follow existing API route patterns (tenant auth via `getTenantId`, supabase service-role client for reads).
- **Activity log query** — Calls card reads from `activity_log` for last-24h entries (existing query pattern on current home page).

</code_context>

<specifics>
## Specific Ideas

- Usage meter surface matches the "Vercel bandwidth" / "YouTube storage" mental model — bar + fraction + time remaining + overage callout
- Bento grid with hero tile pattern — similar to Linear's dashboard overview, Vercel project overview
- Chat panel as an integrated sidebar (not floating pop-up) — feels like Notion's AI sidebar or Linear's issue sidebar
- "Where do I…" framing for Help tiles — owner language, not feature language

</specifics>

<deferred>
## Deferred Ideas

- **Cross-refresh chat persistence** (localStorage or Supabase-backed `chat_messages` table) — Phase 48 keeps messages ephemeral (D-11); persistence is a future enhancement
- **Command palette (Cmd+K)** — considered for Help & Discoverability, deferred; quick-link tiles chosen (D-14). Could ship later as a separate phase if owner demand surfaces
- **Supabase Realtime subscriptions for checklist auto-detection** — considered; window-focus refetch chosen (D-05) as simpler approach. Realtime could ship later if same-tab immediacy becomes a pain point
- **Projected end-of-cycle usage** (linear projection) — considered for usage meter; current cycle + overage chosen (D-12). Projection could be added later once patterns are clearer
- **Collapsible cards / condensed mobile variants** — rejected (D-17); could revisit if 375px scroll length becomes a complaint
- **Dynamic quick-link surface based on setup state** — rejected as redundant with checklist (D-15)

</deferred>

---

*Phase: 48-dashboard-home-redesign*
*Context gathered: 2026-04-14*

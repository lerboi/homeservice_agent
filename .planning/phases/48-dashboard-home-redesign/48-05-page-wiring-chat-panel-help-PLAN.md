---
phase: 48
plan: 05
type: execute
wave: 3
depends_on: [48-02, 48-03, 48-04]
files_modified:
  - src/components/dashboard/ChatPanel.jsx
  - src/components/dashboard/HelpDiscoverabilityCard.jsx
  - src/app/dashboard/page.js
  - tests/unit/chat-panel.test.js
  - tests/unit/help-discoverability.test.js
  - .planning/phases/48-dashboard-home-redesign/48-VALIDATION.md
autonomous: false
requirements: [HOME-04, HOME-05, HOME-06, HOME-07]
tags: [dashboard, ui, page, chat, help, responsive]
user_setup: []

must_haves:
  truths:
    - "ChatPanel.jsx renders messages from useChatContext() and sends via sendMessage — zero local messages state"
    - "HelpDiscoverabilityCard renders 3-4 tiles each routing to a concrete /dashboard route with verb+noun label"
    - "Dashboard home page.js uses the new structure: Greeting → SetupChecklist → two-column lg grid (DailyOpsHub main + ChatPanel sidebar) → HelpDiscoverabilityCard → RecentActivityFeed"
    - "At lg: ChatPanel is sticky sidebar (col-span-4); at md: ChatPanel drops below main; at mobile (<md): everything stacks in D-16 order"
    - "Inline missed-calls alert block (old page.js lines 287-354) and Invoices card are REMOVED from page.js"
    - "No horizontal scroll at 375px — all cards w-full, no fixed widths"
    - "A message sent in ChatPanel appears in ChatbotSheet (and vice versa) — same useChatContext state"
  artifacts:
    - path: "src/components/dashboard/ChatPanel.jsx"
      provides: "Inline chat panel consuming useChatContext; right-sidebar on lg+, below content on md and mobile"
      contains: "useChatContext"
    - path: "src/components/dashboard/HelpDiscoverabilityCard.jsx"
      provides: "3-4 quick-link tiles with deep links to settings pages"
      contains: "Where do I"
    - path: "src/app/dashboard/page.js"
      provides: "Dashboard home page with the new structure"
      contains: "DailyOpsHub"
  key_links:
    - from: "src/components/dashboard/ChatPanel.jsx"
      to: "src/components/dashboard/ChatProvider.jsx"
      via: "const { messages, isLoading, sendMessage } = useChatContext()"
      pattern: "useChatContext\\(\\)"
    - from: "src/app/dashboard/page.js"
      to: "src/components/dashboard/DailyOpsHub.jsx"
      via: "<DailyOpsHub />"
      pattern: "<DailyOpsHub"
    - from: "src/app/dashboard/page.js"
      to: "src/components/dashboard/ChatPanel.jsx"
      via: "<ChatPanel /> inside lg:col-span-4 sticky container"
      pattern: "<ChatPanel"
    - from: "src/components/dashboard/HelpDiscoverabilityCard.jsx"
      to: "Next.js Link href → /dashboard/services, /dashboard/ai-voice-settings, /dashboard/more/billing, /dashboard/escalation-contacts (planner choice of 3-4)"
      via: "<Link href={tile.href}>"
      pattern: "Link.*href=\"/dashboard"
---

<objective>
Final wiring plan: build the inline `ChatPanel`, the `HelpDiscoverabilityCard`, and rewrite `src/app/dashboard/page.js` to the new structure. Close Wave 0 (all 7 tests GREEN). Verify 375px responsive with a human-verify checkpoint.

Purpose: Plans 02–04 delivered the foundation (context, refactored checklist, bento tiles). This plan assembles them into the actual dashboard home the owner sees, and adds the last two missing surfaces (ChatPanel HOME-04/05, HelpDiscoverabilityCard HOME-06). The responsive pass (HOME-07) is a checkpoint because 375px verification is visual.
Output:
 - `ChatPanel.jsx` (consumes useChatContext)
 - `HelpDiscoverabilityCard.jsx` with chosen 4 tiles
 - Rewritten `page.js` (deletes setupMode/active mode conditional, inline missed-calls alert, Invoices card)
 - All 7 Wave-0 tests GREEN
 - Mobile responsive checkpoint
</objective>

<execution_context>
@/Users/leroyngzz/Projects/homeservice_agent/.claude/get-shit-done/workflows/execute-plan.md
@/Users/leroyngzz/Projects/homeservice_agent/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/48-dashboard-home-redesign/48-CONTEXT.md
@.planning/phases/48-dashboard-home-redesign/48-RESEARCH.md
@.planning/phases/48-dashboard-home-redesign/48-UI-SPEC.md
@.planning/phases/48-dashboard-home-redesign/48-02-SUMMARY.md
@.planning/phases/48-dashboard-home-redesign/48-03-SUMMARY.md
@.planning/phases/48-dashboard-home-redesign/48-04-SUMMARY.md
@.claude/skills/dashboard-crm-system/SKILL.md
@src/app/dashboard/page.js
@src/app/dashboard/layout.js
@src/components/dashboard/ChatProvider.jsx
@src/components/dashboard/ChatbotSheet.jsx
@src/components/dashboard/SetupChecklist.jsx
@src/components/dashboard/DailyOpsHub.jsx
@src/components/dashboard/TodayAppointmentsTile.jsx
@src/components/dashboard/CallsTile.jsx
@src/components/dashboard/HotLeadsTile.jsx
@src/components/dashboard/UsageTile.jsx
@src/components/dashboard/RecentActivityFeed.jsx
@src/components/dashboard/ChatMessage.jsx
@src/components/dashboard/TypingIndicator.jsx
@src/lib/design-tokens.js

<interfaces>
<!-- ChatPanel contract — same context as Plan 02 ChatProvider -->
```js
// src/components/dashboard/ChatPanel.jsx
'use client';
import { useChatContext } from './ChatProvider';
// renders message list + input bar; consumes {messages, isLoading, sendMessage, currentRoute}
```

<!-- Help tiles — planner's choice of 4 per D-15. Selected per high-intent ongoing ops tasks not in checklist -->
```js
const HELP_TILES = [
  { icon: Wrench,       label: 'Add a service',       href: '/dashboard/services' },
  { icon: Mic,          label: 'Change AI voice',     href: '/dashboard/ai-voice-settings' },
  { icon: Phone,        label: 'Set escalation contacts', href: '/dashboard/escalation-contacts' },
  { icon: Receipt,      label: 'View invoices',       href: '/dashboard/more/billing' },
];
```
These are 4 high-intent owner tasks NOT redundant with the setup checklist (profile/voice/calendar/billing config). "Where do I…" framing per D-14.

<!-- Outer page.js grid (per UI-SPEC Layout Contract Desktop) -->
```jsx
<div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
  <div className="lg:col-span-8 space-y-8">  {/* main column */}
    <DailyOpsHub />
    <HelpDiscoverabilityCard />
    <RecentActivityFeed />
  </div>
  <aside className="lg:col-span-4">  {/* chat sidebar */}
    <div className="lg:sticky lg:top-6">
      <ChatPanel />
    </div>
  </aside>
</div>
```
SetupChecklist and Greeting sit ABOVE this grid (full width).

<!-- Mobile stack order per D-16 -->
At <md: single column, order: Greeting → SetupChecklist → TodayAppts → Calls → HotLeads → Usage → Help → RecentActivity → ChatPanel.

SetupChecklist and Greeting sit ABOVE this responsive grid (full width — they are NOT inside the 12-col grid). Within the grid, use Tailwind `order-*` utilities so ChatPanel moves between the main column (lg+) and the bottom (mobile) without component duplication:

```jsx
<div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
  <div className="order-1 lg:col-span-8 lg:order-1 space-y-4 lg:space-y-8">
    <DailyOpsHub />
  </div>
  <aside className="order-3 lg:col-span-4 lg:order-2 lg:row-span-2">
    <div className="lg:sticky lg:top-6"><ChatPanel /></div>
  </aside>
  <div className="order-2 lg:col-span-8 lg:order-3 space-y-4 lg:space-y-8">
    <HelpDiscoverabilityCard />
    <RecentActivityFeed />
  </div>
</div>
```

At mobile: DailyOpsHub (order-1), Help+Activity (order-2), ChatPanel (order-3) — matches D-16 bottom section.
At lg: main column stays on the left (DailyOpsHub top, Help+Activity below); ChatPanel sticky sidebar on the right spans both rows.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: ChatPanel.jsx + HelpDiscoverabilityCard.jsx (GREEN their tests)</name>
  <files>src/components/dashboard/ChatPanel.jsx, src/components/dashboard/HelpDiscoverabilityCard.jsx, tests/unit/chat-panel.test.js, tests/unit/help-discoverability.test.js</files>
  <read_first>
    src/components/dashboard/ChatProvider.jsx (context shape),
    src/components/dashboard/ChatbotSheet.jsx (visual reference — match bubble styling + input bar),
    src/components/dashboard/ChatMessage.jsx,
    src/components/dashboard/TypingIndicator.jsx,
    src/lib/design-tokens.js,
    tests/unit/chat-panel.test.js (RED tests from Plan 01),
    tests/unit/help-discoverability.test.js (RED tests from Plan 01),
    .planning/phases/48-dashboard-home-redesign/48-UI-SPEC.md (Chat panel, Help & Discoverability Copywriting table, Component Inventory)
  </read_first>
  <behavior>
    **ChatPanel.jsx:**
    - `'use client'`
    - Consumes `useChatContext()` — `{messages, isLoading, sendMessage}`.
    - Local state: `input` (ephemeral text field only — matches ChatbotSheet refactor in Plan 02).
    - Renders Card (card.base + card.hover tokens) with:
      - Header: "Ask Voco" title (heading style) + subtitle "Ask anything about your dashboard…" when empty.
      - Message log: `role="log" aria-live="polite"` — maps messages through existing `<ChatMessage>` component. Same bubble visual as ChatbotSheet.
      - `<TypingIndicator />` when `isLoading`.
      - When `messages.length === 1` (greeting only): show two clickable starter prompt chips per UI-SPEC Empty state: `"How do I change my AI voice?"` and `"Where do I find invoices?"` — clicking a chip fires `sendMessage(chipText)` then clears state.
      - Input bar at bottom: shadcn `Textarea` or `Input` (match ChatbotSheet) + send button.
      - Send button: lucide `Send` icon + `btn.primary` token — one accent button per card.
      - Scroll-to-bottom ref on new messages (same pattern as ChatbotSheet lines 39-41).
    - Height: on lg+ the parent gives it sticky+tall; panel uses `h-full max-h-[calc(100vh-4rem)] flex flex-col` so message log scrolls within the panel, not the page. On mobile it uses `h-auto` with natural content height (and scroll handled by window).
    - No local messages useState. Must use `useChatContext()` exclusively for history.

    **HelpDiscoverabilityCard.jsx:**
    - Card container (card.base).
    - Header: eyebrow caption "Where do I…" (`font-normal text-xs tracking-wide uppercase text-stone-500`).
    - Tile grid: `grid grid-cols-2 md:grid-cols-4 gap-3`.
    - 4 tiles (HELP_TILES interface). Each tile:
      ```jsx
      <Link href={tile.href} className={`${card.base} ${card.hover} flex flex-col items-start gap-2 p-4 min-h-[88px] focus.ring`}>
        <tile.icon className="h-5 w-5 text-stone-600" />
        <span className="font-normal text-sm text-[#0F172A] leading-normal">{tile.label}</span>
      </Link>
      ```
      - On hover: the arrow icon may tint to copper per UI-SPEC (optional — `group-hover:text-[#C2410C]` on a small arrow icon).
    - Labels exactly: "Add a service", "Change AI voice", "Set escalation contacts", "View invoices".
    - No CTA button — the tiles ARE the CTAs.

    **Tests (replace RED):**
    - chat-panel.test.js: "renders messages from useChatContext" (render ChatPanel inside a ChatProvider with canned messages, assert text present), "submitting input calls sendMessage from context" (spy via custom test provider that injects a mock sendMessage).
    - help-discoverability.test.js: "renders 3 to 4 tiles each with a Link whose href starts with /dashboard" (query `a[href^="/dashboard"]` count 3-4), "tile labels match verb+noun sentence case" (regex `^[A-Z][a-z]+( [a-z]+)+$` applied to each label).
  </behavior>
  <action>
    Create both files per behavior. Replace RED stubs in the two test files. When writing ChatPanel tests, use a thin test helper `renderWithChatProvider({ initialMessages, sendMessage })` that wraps children in a minimal provider — OR mock the module: `jest.mock('@/components/dashboard/ChatProvider', () => ({ useChatContext: () => ({ messages: [...], isLoading: false, sendMessage: mockSend }) }))`.
  </action>
  <verify>
    <automated>npx jest tests/unit/chat-panel.test.js tests/unit/help-discoverability.test.js --no-coverage</automated>
  </verify>
  <done>
    ChatPanel consumes context with zero local messages state; HelpDiscoverabilityCard has 4 tiles with correct hrefs and labels; both test files GREEN.
  </done>
  <acceptance_criteria>
    `test -f src/components/dashboard/ChatPanel.jsx` exits 0.
    `test -f src/components/dashboard/HelpDiscoverabilityCard.jsx` exits 0.
    `grep -q "useChatContext" src/components/dashboard/ChatPanel.jsx` exits 0.
    `grep -c "const \[messages," src/components/dashboard/ChatPanel.jsx` returns 0.
    `grep -q "role=\"log\"" src/components/dashboard/ChatPanel.jsx` exits 0.
    `grep -q "aria-live=\"polite\"" src/components/dashboard/ChatPanel.jsx` exits 0.
    `grep -q "Ask Voco" src/components/dashboard/ChatPanel.jsx` exits 0.
    `grep -q "Where do I" src/components/dashboard/HelpDiscoverabilityCard.jsx` exits 0.
    `grep -cE "Add a service|Change AI voice|Set escalation contacts|View invoices" src/components/dashboard/HelpDiscoverabilityCard.jsx` returns >= 4.
    `grep -c "href=\"/dashboard" src/components/dashboard/HelpDiscoverabilityCard.jsx` returns >= 4.
    `grep -c "font-medium" src/components/dashboard/HelpDiscoverabilityCard.jsx | grep -q "^0$"` exits 0 (W7: two-weight rule — no font-medium in this file; Badge/Button defaults must be overridden to font-normal).
    `npx jest tests/unit/chat-panel.test.js tests/unit/help-discoverability.test.js --no-coverage` exits 0.
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: Rewrite src/app/dashboard/page.js to the new structure</name>
  <files>src/app/dashboard/page.js</files>
  <read_first>
    src/app/dashboard/page.js (CURRENT 559 lines — know what you're deleting: setupMode conditional, inline missed-calls alert lines ~287-354, Invoices card, today's schedule inline list, REQUIRED_IDS/RECOMMENDED_IDS arrays),
    src/components/dashboard/SetupChecklist.jsx (Plan 03 refactor — drop-in replacement),
    src/components/dashboard/DailyOpsHub.jsx,
    src/components/dashboard/ChatPanel.jsx,
    src/components/dashboard/HelpDiscoverabilityCard.jsx,
    src/components/dashboard/RecentActivityFeed.jsx,
    .planning/phases/48-dashboard-home-redesign/48-UI-SPEC.md (Layout Contract diagrams),
    .planning/phases/48-dashboard-home-redesign/48-CONTEXT.md (D-07 — dropped Invoices card, merged missed-calls, kept RecentActivityFeed, kept Greeting)
  </read_first>
  <action>
    Rewrite `src/app/dashboard/page.js`. Target structure:

    ```jsx
    'use client';
    import { useEffect, useState } from 'react';
    import { format } from 'date-fns';
    import DashboardSidebar from '@/components/dashboard/DashboardSidebar'; // if existing wrapper
    import SetupChecklist from '@/components/dashboard/SetupChecklist';
    import DailyOpsHub from '@/components/dashboard/DailyOpsHub';
    import ChatPanel from '@/components/dashboard/ChatPanel';
    import HelpDiscoverabilityCard from '@/components/dashboard/HelpDiscoverabilityCard';
    import RecentActivityFeed from '@/components/dashboard/RecentActivityFeed';
    import { heading, body } from '@/lib/design-tokens';

    export default function DashboardHomePage() {
      // keep greeting name fetch (existing)
      const [ownerName, setOwnerName] = useState('');
      // ... existing fetch of current user / tenant name ...

      const greeting = getGreeting(); // existing helper or inline: morning/afternoon/evening by hour

      return (
        <div className="space-y-8">
          {/* Greeting */}
          <div>
            <h1 className="font-semibold text-2xl text-[#0F172A] leading-tight">
              Good {greeting}{ownerName ? `, ${ownerName}` : ''}
            </h1>
            {/* optional status indicator preserved from current page.js */}
          </div>

          {/* Setup Checklist full width */}
          <SetupChecklist />

          {/* Main hub + chat sidebar responsive grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
            <div className="order-1 lg:col-span-8 lg:order-1 space-y-4 lg:space-y-8">
              <DailyOpsHub />
            </div>
            <aside className="order-3 lg:col-span-4 lg:order-2 lg:row-span-2">
              <div className="lg:sticky lg:top-6">
                <ChatPanel />
              </div>
            </aside>
            <div className="order-2 lg:col-span-8 lg:order-3 space-y-4 lg:space-y-8">
              <HelpDiscoverabilityCard />
              <RecentActivityFeed />
            </div>
          </div>
        </div>
      );
    }
    ```

    **DELETE from current page.js:**
    - `setupMode` conditional render (line ~196).
    - `REQUIRED_IDS` / `RECOMMENDED_IDS` arrays (completion logic lives server-side now per Plan 01).
    - Inline missed-calls alert block (lines ~287-354) — absorbed into CallsTile.
    - Today's schedule inline list — subsumed into TodayAppointmentsTile.
    - Invoices card render — dropped (D-07).
    - Any 2-col `grid md:grid-cols-2` for new-leads + invoices — replaced by DailyOpsHub.

    **KEEP from current page.js:**
    - Greeting + status indicator header (D-07 says keep above hub).
    - Any owner-name fetch.
    - `getGreeting` helper if present.

    The page drops from 559 → ~60-100 lines. This is correct — responsibility moved into child components.

    Do NOT import `ChatbotSheet` in page.js — it's still mounted by layout.js (Plan 02). Both surfaces read the same context.

    No `dark:` variants. No `useTheme()`. Use `heading`/`body` tokens.
  </action>
  <verify>
    <automated>grep -q "DailyOpsHub" src/app/dashboard/page.js &amp;&amp; grep -q "ChatPanel" src/app/dashboard/page.js &amp;&amp; grep -q "HelpDiscoverabilityCard" src/app/dashboard/page.js &amp;&amp; grep -q "SetupChecklist" src/app/dashboard/page.js &amp;&amp; grep -q "RecentActivityFeed" src/app/dashboard/page.js &amp;&amp; ! grep -q "Invoices" src/app/dashboard/page.js &amp;&amp; ! grep -q "REQUIRED_IDS" src/app/dashboard/page.js &amp;&amp; ! grep -q "setupMode" src/app/dashboard/page.js</automated>
  </verify>
  <done>
    page.js uses the new structure; old conditional + inline alert + Invoices card removed; file line count dropped significantly; imports point to the new components.
  </done>
  <acceptance_criteria>
    `grep -q "<DailyOpsHub" src/app/dashboard/page.js` exits 0.
    `grep -q "<ChatPanel" src/app/dashboard/page.js` exits 0.
    `grep -q "<HelpDiscoverabilityCard" src/app/dashboard/page.js` exits 0.
    `grep -q "<SetupChecklist" src/app/dashboard/page.js` exits 0.
    `grep -q "<RecentActivityFeed" src/app/dashboard/page.js` exits 0.
    `grep -cE "Invoices|InvoiceCard|INVOICE_" src/app/dashboard/page.js` returns 0.
    `grep -cE "REQUIRED_IDS|RECOMMENDED_IDS|setupMode" src/app/dashboard/page.js` returns 0.
    `grep -q "lg:grid-cols-12" src/app/dashboard/page.js` exits 0.
    `grep -q "lg:col-span-8" src/app/dashboard/page.js` exits 0.
    `grep -q "lg:col-span-4" src/app/dashboard/page.js` exits 0.
    `grep -q "lg:sticky" src/app/dashboard/page.js` exits 0.
    `wc -l src/app/dashboard/page.js | awk '{print $1}'` returns a number less than 200 (was 559).
    `npx jest --testPathPattern="tests/unit/(setup-checklist|usage|chat-provider|chat-panel|help-discoverability)" --no-coverage` exits 0 (ALL 7 wave-0 tests GREEN).
  </acceptance_criteria>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: [CHECKPOINT] 375px mobile responsive + chat-sharing smoke test + VALIDATION sign-off</name>
  <files>.planning/phases/48-dashboard-home-redesign/48-VALIDATION.md</files>
  <read_first>
    .planning/phases/48-dashboard-home-redesign/48-VALIDATION.md,
    .planning/phases/48-dashboard-home-redesign/48-UI-SPEC.md (Layout Contract — Mobile, Accessibility Contract, Interaction States)
  </read_first>
  <what-built>
    - New dashboard home page with DailyOpsHub, ChatPanel, HelpDiscoverabilityCard, refactored SetupChecklist, kept RecentActivityFeed.
    - Lifted chat state via ChatProvider so ChatbotSheet and ChatPanel share history.
    - All 7 Wave-0 automated tests GREEN.
    - Remaining verification is visual/interactive (HOME-07) and behavioral (HOME-05 cross-surface chat sharing).
  </what-built>
  <how-to-verify>
    Run `npm run dev` and open `http://localhost:3000/dashboard` authenticated as a test owner.

    **1. Desktop layout (≥1024px) — HOME-02, HOME-04**
    - See Greeting at top.
    - See SetupChecklist full width below.
    - See DailyOpsHub occupying left 2/3 with hero TodayAppointmentsTile spanning both bento cols, CallsTile + HotLeadsTile side-by-side below, UsageTile spanning both cols.
    - See ChatPanel as sticky right sidebar, persisting as you scroll.
    - See HelpDiscoverabilityCard below DailyOpsHub in the left column with 4 tiles.
    - See RecentActivityFeed below that.
    - Confirm NO standalone missed-calls alert, NO Invoices card.

    **2. Tablet layout (768-1023px)**
    - ChatPanel drops below main content (no sidebar).
    - Bento still 2-column for CallsTile + HotLeadsTile.

    **3. Mobile 375px — HOME-07**
    - Open Chrome DevTools → Device Toolbar → 375x667.
    - Scroll order top-to-bottom should be: Greeting → SetupChecklist → TodayAppointments → Calls → HotLeads → Usage → Help → RecentActivity → ChatPanel.
    - No horizontal scrollbar anywhere. No card overflows viewport.
    - Touch targets: tap any Dismiss / Mark done / Jump to page button — confirm it's easy to hit (>=44px).

    **4. HOME-05 chat-sharing smoke test**
    - Type "test 1" in ChatPanel on home page → send. See AI reply.
    - Click the sidebar chat trigger to open ChatbotSheet. Confirm "test 1" and the AI reply are visible.
    - Type "test 2" in ChatbotSheet. Close sheet. Check ChatPanel on home — see "test 2" in history.
    - Navigate to `/dashboard/leads`. Open ChatbotSheet. History intact.
    - Return to `/dashboard`. ChatPanel history intact.

    **5. HOME-03 auto-detection smoke**
    - Note which checklist items are currently complete.
    - In another tab go to `/dashboard/settings` and change business name (or any other tracked field).
    - Switch back to dashboard tab. Within 1-2 seconds (window-focus event), checklist refetches and reflects new state.

    **6. Accessibility quick check**
    - Tab through the page — all interactive elements reachable, focus ring visible (copper).
    - Verify `prefers-reduced-motion` — in DevTools Rendering → Emulate CSS prefers-reduced-motion: reduce — card entrances should be instant.

    **7. Update 48-VALIDATION.md**
    - Check all 7 boxes under Validation Sign-Off.
    - Set `nyquist_compliant: true` in frontmatter.
    - Fill in the Per-Task Verification Map table with final status for each task across Plans 01-05.
    - Sign off "Approval: approved (date)".
  </how-to-verify>
  <action>
    Run through the 7 verification steps. If ANY step fails, document the failure and return to the responsible plan for fix. On full PASS, update 48-VALIDATION.md with sign-off and set `nyquist_compliant: true`.
  </action>
  <verify>
    <automated>grep -q "nyquist_compliant: true" .planning/phases/48-dashboard-home-redesign/48-VALIDATION.md &amp;&amp; grep -q "Approval: approved" .planning/phases/48-dashboard-home-redesign/48-VALIDATION.md</automated>
  </verify>
  <done>
    All 7 verification steps pass. 48-VALIDATION.md signed off. `nyquist_compliant: true`.
  </done>
  <acceptance_criteria>
    Human confirms all 7 checkpoint steps pass.
    `grep -q "nyquist_compliant: true" .planning/phases/48-dashboard-home-redesign/48-VALIDATION.md` exits 0.
    `grep -q "approved" .planning/phases/48-dashboard-home-redesign/48-VALIDATION.md` exits 0.
  </acceptance_criteria>
  <resume-signal>Type "approved" when all 7 checkpoint steps pass. If any step fails, paste the step number + issue.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| ChatPanel input → ChatProvider.sendMessage → /api/chat | User-typed text flows through context into existing API route; no new surface introduced. |
| HelpDiscoverabilityCard tile click → /dashboard/* route | Plain Next.js navigation; no data crosses. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-48-16 | Cross-Site Scripting | ChatPanel rendering AI reply markdown via existing ChatMessage | mitigate | Reuses ChatMessage.jsx sanitization (Phase 37) — no dangerouslySetInnerHTML, nav link parsing whitelisted via ChatNavLink. ASVS V5.3.3. Inherited, not new. |
| T-48-17 | Information Disclosure | ChatPanel persists messages in React state for session | accept | Same scope as ChatbotSheet (ephemeral, tenant-scoped); D-11 defers cross-refresh. No new risk. |
| T-48-18 | Tampering | HelpDiscoverabilityCard hrefs are static constants | accept | Hardcoded route strings in source; no user-controllable href construction. |
| T-48-19 | Denial of Service | Sticky ChatPanel adds DOM weight on scroll | accept | Same mount cost as the always-mounted ChatbotSheet; sticky positioning uses `position: sticky` (no JS listeners). |
</threat_model>

<verification>
- All 7 Wave-0 tests GREEN.
- page.js rewrite complete, old patterns removed.
- Human-verify checkpoint passed for desktop / tablet / 375px / chat-sharing / auto-detection / a11y.
- 48-VALIDATION.md signed off.
</verification>

<success_criteria>
- [ ] ChatPanel.jsx renders via useChatContext, no local messages state.
- [ ] HelpDiscoverabilityCard renders 4 tiles with /dashboard hrefs.
- [ ] page.js rewritten to new structure, Invoices card + setupMode + REQUIRED_IDS removed.
- [ ] All 7 Wave-0 tests GREEN.
- [ ] 375px no horizontal scroll verified.
- [ ] Chat history shared across ChatPanel and ChatbotSheet verified.
- [ ] 48-VALIDATION.md has `nyquist_compliant: true` and approval.
</success_criteria>

<output>
After completion, create `.planning/phases/48-dashboard-home-redesign/48-05-SUMMARY.md` documenting: final page.js line count, HELP_TILES chosen, mobile stack order verified, any UI-SPEC deviations + rationale. Also add cross-milestone note that Phase 52 (Jobs rename) will need to update the "View all leads" CTA to "Open Jobs" in HotLeadsTile.jsx when it ships.
</output>

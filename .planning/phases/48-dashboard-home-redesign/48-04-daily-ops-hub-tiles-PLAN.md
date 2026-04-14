---
phase: 48
plan: 04
type: execute
wave: 2
depends_on: [48-01]
files_modified:
  - src/components/dashboard/DailyOpsHub.jsx
  - src/components/dashboard/TodayAppointmentsTile.jsx
  - src/components/dashboard/CallsTile.jsx
  - src/components/dashboard/HotLeadsTile.jsx
  - src/components/dashboard/UsageTile.jsx
  - tests/unit/usage-tile.test.js
autonomous: true
requirements: [HOME-02]
tags: [dashboard, ui, bento, tiles, usage]
user_setup: []

must_haves:
  truths:
    - "DailyOpsHub renders a bento grid: hero (Today's Appointments) + 2 mediums (Calls + Hot/New Leads) + full-width UsageTile below"
    - "Bento uses grid-cols-1 on mobile, md:grid-cols-2 on desktop with md:gap-6; hero + usage span md:col-span-2"
    - "TodayAppointmentsTile fetches /api/appointments and shows today's slots or empty state 'Nothing booked today.'"
    - "CallsTile fetches /api/calls last-24h and shows a flagged Missed count at top plus recent-call rows"
    - "HotLeadsTile fetches /api/dashboard/stats hot/new leads and shows count + preview"
    - "UsageTile fetches /api/usage and shows progress bar with threshold colors: copper <75%, amber 75-99%, red >=100%"
    - "Each tile has card.base + card.hover token classes, skeleton loading state, and empty+error states from UI-SPEC"
  artifacts:
    - path: "src/components/dashboard/DailyOpsHub.jsx"
      provides: "Bento grid container composing 4 tiles"
      contains: "md:col-span-2"
    - path: "src/components/dashboard/TodayAppointmentsTile.jsx"
      provides: "Hero tile with today's schedule or empty state"
      contains: "CalendarDays"
    - path: "src/components/dashboard/CallsTile.jsx"
      provides: "Calls (last 24h) with Missed flagged rows"
      contains: "Missed"
    - path: "src/components/dashboard/HotLeadsTile.jsx"
      provides: "Hot/New Leads preview"
      contains: "View all leads"
    - path: "src/components/dashboard/UsageTile.jsx"
      provides: "Progress bar + tabular-nums fraction + threshold colors"
      contains: "tabular-nums"
  key_links:
    - from: "UsageTile.jsx"
      to: "/api/usage"
      via: "useSWRFetch('/api/usage')"
      pattern: "useSWRFetch.*'/api/usage'"
    - from: "TodayAppointmentsTile.jsx"
      to: "/api/appointments"
      via: "useSWRFetch('/api/appointments?range=today')"
      pattern: "useSWRFetch.*appointments"
    - from: "CallsTile.jsx"
      to: "/api/calls"
      via: "useSWRFetch('/api/calls?since=24h')"
      pattern: "useSWRFetch.*calls"
    - from: "HotLeadsTile.jsx"
      to: "/api/dashboard/stats"
      via: "useSWRFetch('/api/dashboard/stats')"
      pattern: "useSWRFetch.*dashboard/stats"
---

<objective>
Build the Daily-Ops Hub bento grid (HOME-02): hero Today's Appointments tile + medium Calls + Hot/New Leads tiles + full-width Usage meter tile. Follows UI-SPEC Layout Contract and D-06 / D-07.

Purpose: Owners glance at the dashboard every morning. These four tiles are the at-a-glance command surface. Independent of the checklist and chat work (Plans 02, 03), this plan can run in parallel as long as Plan 01 ships `/api/usage`.
Output:
 - `DailyOpsHub.jsx` grid container
 - 4 tile components composed from `card.base`/`card.hover` tokens
 - `UsageTile` with threshold color logic (GREEN tests)
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
@.planning/phases/48-dashboard-home-redesign/48-01-SUMMARY.md
@.claude/skills/dashboard-crm-system/SKILL.md
@.claude/skills/payment-architecture/SKILL.md
@.claude/skills/scheduling-calendar-system/SKILL.md
@src/lib/design-tokens.js
@src/hooks/useSWRFetch.js
@src/components/ui/card.jsx
@src/components/ui/badge.jsx
@src/components/ui/progress.jsx
@src/components/ui/skeleton.jsx
@src/app/api/appointments/route.js
@src/app/api/calls/route.js
@src/app/api/dashboard/stats/route.js
@src/app/api/usage/route.js
@src/app/dashboard/page.js

<interfaces>
<!-- API shapes the tiles consume -->

GET /api/appointments?range=today → {
  appointments: Array<{ id, customer_name, start_time, service_type, address }>
}

GET /api/calls?since=24h → {
  calls: Array<{ id, caller_name, caller_number, started_at, booking_outcome, missed }>
}
(booking_outcome='not_attempted' marks missed rows per RESEARCH + existing page.js pattern)

GET /api/dashboard/stats → {
  hotLeads: { count: number, preview: Array<{ id, customer_name, urgency, created_at }> },
  newLeadsToday: number,
  ...other fields existing
}

GET /api/usage → { callsUsed, callsIncluded, cycleDaysLeft, overageDollars }

<!-- Token composition rule (UI-SPEC) -->
All tiles: use `{card.base} {card.hover}` from '@/lib/design-tokens' — no raw `bg-white rounded-2xl`.
Card title: `font-semibold text-base text-[#0F172A] leading-[1.4]`.
Body: `font-normal text-sm text-[#475569] leading-normal`.
Tabular numerics: `tabular-nums`.
Meta rows: `font-normal text-xs text-stone-500 leading-[1.4]`.

<!-- Hero tile routes -->
Today's Appointments CTA → `/dashboard/appointments`, label: "View full schedule"
Calls CTA → `/dashboard/calls`, label: "View all calls"
Hot/New Leads CTA → `/dashboard/leads`, label: "View all leads" (NOT "Open Jobs" — per RESEARCH Pitfall 7, fallback label until Phase 52 ships)
Usage CTA → `/dashboard/more/billing`, label: "Manage plan"
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: UsageTile — progress bar with threshold colors (GREEN usage-tile tests)</name>
  <files>src/components/dashboard/UsageTile.jsx, tests/unit/usage-tile.test.js</files>
  <read_first>
    src/app/api/usage/route.js (Plan 01 output — consume this shape),
    src/components/ui/progress.jsx (shadcn Progress primitive),
    src/lib/design-tokens.js,
    tests/unit/usage-tile.test.js (RED tests from Plan 01 Task 1),
    .planning/phases/48-dashboard-home-redesign/48-UI-SPEC.md (Color → Usage thresholds table, Typography → Display for usage fraction, Copywriting → Usage empty state, Error states)
  </read_first>
  <behavior>
    - Fetches `/api/usage` via `useSWRFetch`.
    - Computes `percent = callsIncluded > 0 ? (callsUsed / callsIncluded) * 100 : 0`.
    - Picks fill color + caption tone by threshold:
      - percent < 75:  fillClass = 'bg-[#C2410C]',   toneClass = 'text-stone-600'
      - 75 <= percent < 100: fillClass = 'bg-amber-600', toneClass = 'text-amber-700'
      - percent >= 100: fillClass = 'bg-red-700', toneClass = 'text-red-700'
    - Renders:
      - Title: "Usage" (card title styling)
      - Display line: `{callsUsed} / {callsIncluded}` with `font-semibold text-2xl text-[#0F172A] leading-tight tabular-nums`
      - Progress bar: shadcn `Progress` with `value={Math.min(percent, 100)}` + indicator color override via `className` on the inner bar (or custom styled div if Progress doesn't support indicator color override — fallback to a div with `style={{ width: `${Math.min(percent, 100)}%` }}` + fillClass).
      - Caption: `{cycleDaysLeft} days left` (tone class). If `overageDollars > 0`, append ` • ${overageDollars.toFixed(2)} over` (red-700 for percent >= 100 per spec).
      - aria-* on bar: `role="progressbar" aria-valuenow={callsUsed} aria-valuemin={0} aria-valuemax={callsIncluded} aria-label="Calls used this cycle"`.
      - Empty state (callsIncluded === 0): render `0 of 0 calls used` display + `Your cycle started {date}. {daysLeft} days left.` — only when API returns `callsIncluded === 0`; when API returns 404 (no subscription) show error state instead.
      - Error state (fetch 5xx): soft alert "Usage data is temporarily unavailable. Your plan is still active. Refresh to retry." — do NOT unmount the card; keep structure, replace fraction+bar with alert.
      - Loading: shadcn `Skeleton` placeholders for the display line + bar.
      - Primary CTA button: `<Link href="/dashboard/more/billing" ...>Manage plan</Link>` — single accent button per card (10% budget rule).
    - All thresholds MUST be derivable statically for tests (export a helper if needed):
      ```js
      export function usageThresholdClass(percent) {
        if (percent >= 100) return { fill: 'bg-red-700', tone: 'text-red-700' };
        if (percent >= 75)  return { fill: 'bg-amber-600', tone: 'text-amber-700' };
        return { fill: 'bg-[#C2410C]', tone: 'text-stone-600' };
      }
      ```
    - Tests (replace RED stubs):
      - `usageThresholdClass(50).fill === 'bg-[#C2410C]'`
      - `usageThresholdClass(80).fill === 'bg-amber-600'`
      - `usageThresholdClass(100).fill === 'bg-red-700'`
      - `usageThresholdClass(150).fill === 'bg-red-700'`
  </behavior>
  <action>
    Create `src/components/dashboard/UsageTile.jsx` using the behavior above. Export `usageThresholdClass` as a named export for testability. Replace the RED tests in `tests/unit/usage-tile.test.js` with GREEN assertions against `usageThresholdClass`. Do not create integration tests against `/api/usage` — that's Plan 01's test surface.
  </action>
  <verify>
    <automated>npx jest tests/unit/usage-tile.test.js --no-coverage</automated>
  </verify>
  <done>
    UsageTile renders, thresholds computed correctly, helper exported + tested, empty/error/loading states present.
  </done>
  <acceptance_criteria>
    `test -f src/components/dashboard/UsageTile.jsx` exits 0.
    `grep -q "export function usageThresholdClass" src/components/dashboard/UsageTile.jsx` exits 0.
    `grep -q "bg-\[#C2410C\]" src/components/dashboard/UsageTile.jsx` exits 0.
    `grep -q "bg-amber-600" src/components/dashboard/UsageTile.jsx` exits 0.
    `grep -q "bg-red-700" src/components/dashboard/UsageTile.jsx` exits 0.
    `grep -q "tabular-nums" src/components/dashboard/UsageTile.jsx` exits 0.
    `grep -q "role=\"progressbar\"" src/components/dashboard/UsageTile.jsx` exits 0.
    `grep -q "Manage plan" src/components/dashboard/UsageTile.jsx` exits 0.
    `npx jest tests/unit/usage-tile.test.js --no-coverage` exits 0.
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2a: Today's Appointments hero tile</name>
  <files>src/components/dashboard/TodayAppointmentsTile.jsx</files>
  <read_first>
    src/app/api/appointments/route.js (today query pattern),
    src/app/dashboard/page.js (CURRENT page — copy existing today's-schedule shape handling; lines 196-559),
    src/lib/design-tokens.js (card.base, card.hover, heading, body, focus, btn),
    src/components/ui/card.jsx,
    src/components/ui/skeleton.jsx,
    .planning/phases/48-dashboard-home-redesign/48-UI-SPEC.md (Copywriting CTAs, Empty States per card, Error States, Typography application)
  </read_first>
  <action>
    **TodayAppointmentsTile.jsx** (hero — spans md:col-span-2):
    - `useSWRFetch('/api/appointments?range=today', { revalidateOnFocus: true })`.
    - Header: lucide `CalendarDays` h-6 w-6 + card title "Today's appointments".
    - Body: list up to 5 appointments with time (12-hour `2:30 PM` — use existing `date-fns` formatter from page.js), customer name, service type, address (truncate). Use `tabular-nums` on time column.
    - Hero visual treatment per planner discretion (D-0 discretion): pick SUMMARY-PLUS-NEXT — show a Display-sized ("font-semibold text-2xl") next appointment time at top, then list below. This reads best in the morning.
    - Empty state: Heading `"Nothing booked today."` / Body `"When Voco books an appointment, it will show up here. You'll also get a notification."`
    - Error state per UI-SPEC.
    - Loading: 3 `Skeleton` rows.
    - CTA: `<Link href="/dashboard/appointments">View full schedule</Link>` using `btn.primary` tokens — single accent button.
    - Also absorbs the existing "Today's schedule inline list" per D-07 — the current page.js inline list MUST be removed by Plan 05.

    **Composition:** Uses `card.base` + `card.hover` tokens. Typography follows UI-SPEC Component Tokens block. No `dark:` variants. No `useTheme()`. No raw `bg-white rounded-2xl`.
  </action>
  <verify>
    <automated>test -f src/components/dashboard/TodayAppointmentsTile.jsx &amp;&amp; grep -q "View full schedule" src/components/dashboard/TodayAppointmentsTile.jsx &amp;&amp; grep -q "Nothing booked today" src/components/dashboard/TodayAppointmentsTile.jsx &amp;&amp; grep -q "useSWRFetch" src/components/dashboard/TodayAppointmentsTile.jsx</automated>
  </verify>
  <done>
    Hero tile renders with correct empty/error/loading states, CTA, and token composition.
  </done>
  <acceptance_criteria>
    `test -f src/components/dashboard/TodayAppointmentsTile.jsx` exits 0.
    `grep -q "useSWRFetch" src/components/dashboard/TodayAppointmentsTile.jsx` exits 0.
    `grep -q "Nothing booked today" src/components/dashboard/TodayAppointmentsTile.jsx` exits 0.
    `grep -q "View full schedule" src/components/dashboard/TodayAppointmentsTile.jsx` exits 0.
    `grep -q "card.base\|card\\.base\|CardBase\|from.*design-tokens" src/components/dashboard/TodayAppointmentsTile.jsx` exits 0.
    `grep -c "dark:" src/components/dashboard/TodayAppointmentsTile.jsx` returns 0.
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2b: Calls + Hot/New Leads medium tiles</name>
  <files>src/components/dashboard/CallsTile.jsx, src/components/dashboard/HotLeadsTile.jsx</files>
  <read_first>
    src/app/api/calls/route.js (last-24h + booking_outcome field),
    src/app/api/dashboard/stats/route.js (hot leads preview shape),
    src/app/dashboard/page.js (CURRENT page — copy existing missed-calls alert + hot leads preview handling; lines 287-354 for missed-calls, stats shape elsewhere),
    src/lib/design-tokens.js,
    src/components/ui/card.jsx,
    src/components/ui/badge.jsx,
    src/components/ui/skeleton.jsx,
    .planning/phases/48-dashboard-home-redesign/48-UI-SPEC.md (Copywriting CTAs, Empty States, Error States, two-weight typography rule for badges)
  </read_first>
  <action>
    **CallsTile.jsx** (medium):
    - `useSWRFetch('/api/calls?since=24h')`.
    - Header: lucide `Phone` h-5 w-5 + card title "Calls (last 24h)".
    - Absorbs inline missed-calls alert per D-07: at top, if any calls have `booking_outcome === 'not_attempted'`, render flagged row section with:
      - `<Badge className="bg-red-50 text-red-700 border border-red-200 font-normal text-xs tracking-wide uppercase">Missed</Badge>` + meta `{count} • not attempted` in `text-stone-500 text-xs`.
      - Two-weight rule: the shadcn `Badge` default is `font-medium` — you MUST override to `font-normal` per UI-SPEC Typography. Do NOT leave `font-medium` anywhere in this file.
      - The standalone alert block (page.js lines 287-354) must be removed by Plan 05.
    - Below: up to 4 recent call rows: caller name / number, relative time (`formatDistanceToNow`), booking outcome pill.
    - Empty state per UI-SPEC table.
    - CTA: `<Link href="/dashboard/calls">View all calls</Link>`.
    - Single accent button budget.

    **HotLeadsTile.jsx** (medium):
    - `useSWRFetch('/api/dashboard/stats')` → use `hotLeads.count` + `hotLeads.preview` (existing shape from page.js).
    - Header: lucide `Flame` h-5 w-5 + card title "Hot / new leads".
    - Body: display count in Display typography (`text-2xl font-semibold tabular-nums`), list up to 3 preview leads below with urgency badge + time.
    - Empty state: "No new leads right now." / "New inquiries from calls and forms land here first. Check back after your next call."
    - Error state per UI-SPEC.
    - CTA: `<Link href="/dashboard/leads">View all leads</Link>` — intentionally NOT "Open Jobs" until Phase 52 ships (RESEARCH Pitfall 7).

    **Composition:** Both tiles use `card.base` + `card.hover` tokens. Typography follows UI-SPEC Component Tokens block. No `dark:` variants. No `useTheme()`. No raw `bg-white rounded-2xl`.
  </action>
  <verify>
    <automated>test -f src/components/dashboard/CallsTile.jsx &amp;&amp; test -f src/components/dashboard/HotLeadsTile.jsx &amp;&amp; grep -q "View all calls" src/components/dashboard/CallsTile.jsx &amp;&amp; grep -q "View all leads" src/components/dashboard/HotLeadsTile.jsx &amp;&amp; grep -q "Missed" src/components/dashboard/CallsTile.jsx &amp;&amp; grep -q "No new leads right now" src/components/dashboard/HotLeadsTile.jsx</automated>
  </verify>
  <done>
    Both medium tiles render with correct empty/error/loading states, CTAs, token composition. Missed-calls flagged rows appear in CallsTile. Badge uses font-normal (two-weight rule).
  </done>
  <acceptance_criteria>
    `test -f src/components/dashboard/CallsTile.jsx` exits 0.
    `test -f src/components/dashboard/HotLeadsTile.jsx` exits 0.
    `grep -q "card.base\|card\\.base\|CardBase\|from.*design-tokens" src/components/dashboard/CallsTile.jsx` exits 0.
    `grep -q "not_attempted\|Missed" src/components/dashboard/CallsTile.jsx` exits 0.
    `grep -q "No new leads right now" src/components/dashboard/HotLeadsTile.jsx` exits 0.
    `grep -q "font-normal" src/components/dashboard/CallsTile.jsx` exits 0 (W7: two-weight rule for Missed badge).
    `grep -c "font-medium" src/components/dashboard/CallsTile.jsx | grep -q "^0$"` exits 0 (W7: no font-medium anywhere — Badge default overridden).
    `grep -c "dark:" src/components/dashboard/CallsTile.jsx src/components/dashboard/HotLeadsTile.jsx` returns 0.
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: DailyOpsHub bento container composing all 4 tiles</name>
  <files>src/components/dashboard/DailyOpsHub.jsx</files>
  <read_first>
    src/components/dashboard/TodayAppointmentsTile.jsx,
    src/components/dashboard/CallsTile.jsx,
    src/components/dashboard/HotLeadsTile.jsx,
    src/components/dashboard/UsageTile.jsx,
    .planning/phases/48-dashboard-home-redesign/48-UI-SPEC.md (Layout Contract — Desktop + Tablet + Mobile),
    .planning/phases/48-dashboard-home-redesign/48-RESEARCH.md (Pattern 3 Bento Grid, Pitfall 5 Bento hero width on tablet, Code Examples "Bento Grid Container Skeleton")
  </read_first>
  <action>
    Create `src/components/dashboard/DailyOpsHub.jsx` as a `'use client'` component:
    ```jsx
    'use client';
    import TodayAppointmentsTile from './TodayAppointmentsTile';
    import CallsTile from './CallsTile';
    import HotLeadsTile from './HotLeadsTile';
    import UsageTile from './UsageTile';

    export default function DailyOpsHub() {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div className="md:col-span-2">
            <TodayAppointmentsTile />
          </div>
          <CallsTile />
          <HotLeadsTile />
          <div className="md:col-span-2">
            <UsageTile />
          </div>
        </div>
      );
    }
    ```
    No props — each tile owns its own data fetching via `useSWRFetch`. This keeps the hub a pure layout concern.

    Do NOT set a responsive `lg:` column here — the lg:col-span-8 / col-span-4 outer split (main content vs chat sidebar) lives in page.js (Plan 05), not in DailyOpsHub. Pitfall 5 of RESEARCH confirms `md:` is ONLY for the inner bento, `lg:` is for outer content/chat split.
  </action>
  <verify>
    <automated>test -f src/components/dashboard/DailyOpsHub.jsx &amp;&amp; grep -q "md:grid-cols-2" src/components/dashboard/DailyOpsHub.jsx &amp;&amp; grep -q "md:col-span-2" src/components/dashboard/DailyOpsHub.jsx &amp;&amp; grep -c "TodayAppointmentsTile\|CallsTile\|HotLeadsTile\|UsageTile" src/components/dashboard/DailyOpsHub.jsx | tr -d '[:space:]' | grep -qE "^[4-9]$|^[1-9][0-9]+$"</automated>
  </verify>
  <done>
    DailyOpsHub renders a CSS grid with hero tile spanning both columns at md+, medium tiles on second row, UsageTile spanning both columns on third row.
  </done>
  <acceptance_criteria>
    `grep -q "grid-cols-1 md:grid-cols-2" src/components/dashboard/DailyOpsHub.jsx` exits 0.
    `grep -c "md:col-span-2" src/components/dashboard/DailyOpsHub.jsx` returns >= 2.
    `grep -c "lg:" src/components/dashboard/DailyOpsHub.jsx` returns 0 (outer lg split lives in page.js, not here).
    `grep -q "TodayAppointmentsTile" src/components/dashboard/DailyOpsHub.jsx` exits 0.
    `grep -q "UsageTile" src/components/dashboard/DailyOpsHub.jsx` exits 0.
  </acceptance_criteria>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → existing GET endpoints (/api/appointments, /api/calls, /api/dashboard/stats, /api/usage) | Read-only tenant-scoped queries. /api/usage is new (Plan 01); others are already tenant-scoped via getTenantId(). |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-48-13 | Information Disclosure | Tiles display caller names, addresses, lead urgency | accept | All data already tenant-scoped at the API layer (existing pattern). Phase 48 introduces no new data exposure — just reorganizes display. |
| T-48-14 | Cross-Site Scripting | Rendering caller_name / customer_name / address from API | mitigate | React escapes text children by default; no `dangerouslySetInnerHTML` used in any tile. ASVS V5.3.3. |
| T-48-15 | Denial of Service | Aggregate tile fetches on home mount (4 parallel) | accept | All 4 endpoints are fast + already used by current page.js. SWR dedupe (5s) prevents thrash. No new load pattern introduced. |
</threat_model>

<verification>
- `DailyOpsHub.jsx` CSS grid matches UI-SPEC Layout Contract desktop ASCII diagram for the main column.
- UsageTile threshold colors verified via `usageThresholdClass` unit tests.
- Missed-calls flagged rows appear at the top of CallsTile when `booking_outcome === 'not_attempted'`.
- All tiles compose from `card.base`/`card.hover` tokens (no raw `bg-white rounded-2xl`).
- No `dark:` variants anywhere in these files.
- `tests/unit/usage-tile.test.js` GREEN.
</verification>

<success_criteria>
- [ ] DailyOpsHub bento renders correctly at md+ and stacks at mobile.
- [ ] TodayAppointmentsTile, CallsTile, HotLeadsTile, UsageTile each compose from `card.base`/`card.hover`.
- [ ] UsageTile threshold helper exported and unit-tested.
- [ ] Missed-calls row appears in CallsTile (absorbing standalone alert per D-07).
- [ ] Hot/New Leads tile CTA reads "View all leads" (Phase 52 fallback per RESEARCH Pitfall 7).
</success_criteria>

<output>
After completion, create `.planning/phases/48-dashboard-home-redesign/48-04-SUMMARY.md` documenting: tile API endpoints consumed, threshold color math, token composition audit ("all tiles use card.base = yes"), discrepancies with UI-SPEC (if any).
</output>

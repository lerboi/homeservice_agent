---
phase: 48
plan: 03
type: execute
wave: 2
depends_on: [48-01]
files_modified:
  - src/components/dashboard/SetupChecklist.jsx
  - src/components/dashboard/ChecklistItem.jsx
  - tests/unit/setup-checklist.test.js
autonomous: true
requirements: [HOME-01, HOME-03]
tags: [dashboard, checklist, setup, ui]
user_setup: []

must_haves:
  truths:
    - "SetupChecklist renders 4 theme accordions in order: profile, voice, calendar, billing"
    - "Each theme accordion shows a mini-progress indicator (e.g. '2 of 3 complete') and a check glyph when fully complete"
    - "Each checklist item row exposes three buttons: Dismiss, Mark done, Jump to page — all with aria-labels and min-h-[44px] touch targets"
    - "Dismiss triggers a sonner toast with an Undo link that reverse-PATCHes {item_id, dismiss:false}"
    - "Mark done fires PATCH with {item_id, mark_done:true} and optimistically updates the row; on 4xx/5xx reverts and toasts error"
    - "Checklist data refetches on window focus via useSWRFetch's revalidateOnFocus (no manual listener)"
    - "Existing conic-gradient progress ring and SetupCompleteBar celebration are preserved verbatim"
    - "Required/Recommended badges appear per item with correct token colors (copper-soft vs stone)"
  artifacts:
    - path: "src/components/dashboard/SetupChecklist.jsx"
      provides: "Themed checklist with progress ring, theme accordions, window-focus refetch, Undo toast"
      contains: "THEME_GROUPS"
    - path: "src/components/dashboard/ChecklistItem.jsx"
      provides: "Row with Dismiss / Mark done / Jump to page actions"
      contains: "aria-label"
  key_links:
    - from: "src/components/dashboard/SetupChecklist.jsx"
      to: "/api/setup-checklist"
      via: "useSWRFetch('/api/setup-checklist', { revalidateOnFocus: true })"
      pattern: "useSWRFetch.*setup-checklist"
    - from: "src/components/dashboard/ChecklistItem.jsx"
      to: "PATCH /api/setup-checklist"
      via: "fetch('/api/setup-checklist', { method:'PATCH', body: JSON.stringify({item_id, mark_done|dismiss}) })"
      pattern: "PATCH.*setup-checklist|method:\\s*['\\\"]PATCH"
---

<objective>
Refactor `SetupChecklist.jsx` in place (D-01: do not replace) to deliver HOME-01 + HOME-03: theme-grouped accordion, dismiss/mark-done/jump-to-page per item, window-focus auto-detection refetch.

Purpose: The existing component has a progress ring, dismiss API, and `SetupCompleteBar` that owners already know. Refactoring in place preserves muscle memory and data continuity. Plan 01 already extended the API with themed items and per-item overrides — this plan makes the UI match.
Output:
 - Refactored `SetupChecklist.jsx` with shadcn `Accordion` theme groups
 - Extended `ChecklistItem.jsx` with 3 action buttons (Dismiss / Mark done / Jump to page)
 - Window-focus refetch via `useSWRFetch`
 - All 3 RED tests in `setup-checklist.test.js` turn GREEN
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
@src/components/dashboard/SetupChecklist.jsx
@src/components/dashboard/ChecklistItem.jsx
@src/components/dashboard/SetupCompleteBar.jsx
@src/lib/design-tokens.js
@src/hooks/useSWRFetch.js
@src/components/ui/accordion.jsx
@src/components/ui/badge.jsx
@src/components/ui/button.jsx
@src/app/api/setup-checklist/route.js

<interfaces>
<!-- Imports from Plan 01 -->
import { VALID_ITEM_IDS, THEME_GROUPS } from '@/app/api/setup-checklist/route';

<!-- Shape returned by GET /api/setup-checklist (see Plan 01 interfaces) -->
// items: Array<{ id, theme, required, complete, dismissed, mark_done_override, title, description, href }>
// progress: { total, complete, percent }

<!-- Labels for theme groups -->
const THEME_LABELS = {
  profile:  'Profile',
  voice:    'Voice',
  calendar: 'Calendar',
  billing:  'Billing',
};
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend ChecklistItem with Dismiss / Mark done / Jump to page actions</name>
  <files>src/components/dashboard/ChecklistItem.jsx</files>
  <read_first>
    src/components/dashboard/ChecklistItem.jsx (CURRENT implementation),
    src/lib/design-tokens.js (card.base, card.hover, focus.ring, btn.primary),
    src/components/ui/button.jsx,
    .planning/phases/48-dashboard-home-redesign/48-UI-SPEC.md (Interaction States, Copywriting Contract — Dismiss/Undo, Destructive Actions table),
    .planning/phases/48-dashboard-home-redesign/48-RESEARCH.md (Pattern 6 — PATCH API)
  </read_first>
  <behavior>
    - Row receives `item` object (see interfaces) and two callbacks `{onMarkDone, onDismiss}` (parent-owned optimistic update).
    - Three action buttons rendered:
      1. `Jump to page` — always present except when `item.complete === true`. Label follows UI-SPEC: `Finish setup` when not started, `Continue` when partially done (when `mark_done_override === false && complete === false` treat as "not started" for copy). `Open settings` for recommended-only rows. Navigates via Next.js `<Link href={item.href}>`.
      2. `Mark done` — visible when `complete:false`. Icon `CheckCircle2` + label (aria-label `"Mark {item.title} as done"`). When `complete:true AND mark_done_override:true`, label becomes `Unmark done` (clears override).
      3. `Dismiss` — icon-only `X` button with `aria-label="Dismiss {item.title}"`. Not shown for items with `required:true` (required items cannot be dismissed — per product sensibility; if UI-SPEC contradicts, default to showing for all).
    - All three buttons: `min-h-[44px]` (accessibility floor per UI-SPEC spacing exceptions).
    - Icons: lucide-react, `h-4 w-4`, stroke width default (1.5).
    - Primary action button uses `btn.primary` token (one accent button budget).
    - Mark done is optimistic: calls `onMarkDone(item.id, nextValue)` which parent applies to local state, then fires PATCH. On error parent toasts and reverts (handled in Task 2).
    - Dismiss calls `onDismiss(item.id)` → parent fires toast with Undo.
  </behavior>
  <action>
    Implement `ChecklistItem.jsx`. Must compose from `card.base` + `card.hover` if the row uses a card surface; otherwise use the existing list-row pattern in the CURRENT file. Preserve existing expand/collapse if present — just add the 3 buttons below the description.

    Required badge styling (per UI-SPEC Color section):
    ```jsx
    {item.required ? (
      <Badge className="bg-[#C2410C]/10 text-[#C2410C] border border-[#C2410C]/20 font-normal text-xs tracking-wide uppercase leading-[1.4]">Required</Badge>
    ) : (
      <Badge className="bg-stone-100 text-stone-600 border border-stone-200 font-normal text-xs tracking-wide uppercase leading-[1.4]">Recommended</Badge>
    )}
    ```
    Override shadcn Badge default `font-medium` to `font-normal` (two-weight rule per UI-SPEC typography).

    Copy: exact CTA labels from UI-SPEC table:
    - Primary (jump): `Finish setup` when `complete:false && !mark_done_override`, `Continue` when "partially done" (use `item.partial` if available, else same as Finish setup), `Open settings` when `item.required === false`.
    - Mark done icon button: label `"Mark done"` / when already mark-done-overridden: `"Unmark done"`.
    - Dismiss: icon-only `X` with aria-label.
  </action>
  <verify>
    <automated>grep -q "aria-label" src/components/dashboard/ChecklistItem.jsx &amp;&amp; grep -q "min-h-\[44px\]" src/components/dashboard/ChecklistItem.jsx &amp;&amp; grep -q "onMarkDone" src/components/dashboard/ChecklistItem.jsx &amp;&amp; grep -q "onDismiss" src/components/dashboard/ChecklistItem.jsx</automated>
  </verify>
  <done>
    Row shows Required/Recommended badge, primary jump CTA, Mark done button, Dismiss icon button (hidden for required items). Touch targets ≥ 44px.
  </done>
  <acceptance_criteria>
    `grep -q "Required" src/components/dashboard/ChecklistItem.jsx` exits 0.
    `grep -q "Recommended" src/components/dashboard/ChecklistItem.jsx` exits 0.
    `grep -q "bg-\[#C2410C\]/10" src/components/dashboard/ChecklistItem.jsx` exits 0.
    `grep -q "font-normal text-xs tracking-wide uppercase" src/components/dashboard/ChecklistItem.jsx` exits 0.
    `grep -c "min-h-\[44px\]" src/components/dashboard/ChecklistItem.jsx` returns >= 1.
    `grep -q "Mark done\|Unmark done" src/components/dashboard/ChecklistItem.jsx` exits 0.
    `grep -q "Dismiss\|aria-label=\".*Dismiss" src/components/dashboard/ChecklistItem.jsx` exits 0.
  </acceptance_criteria>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Refactor SetupChecklist — theme accordions + window-focus refetch + Undo toast</name>
  <files>src/components/dashboard/SetupChecklist.jsx, tests/unit/setup-checklist.test.js</files>
  <read_first>
    src/components/dashboard/SetupChecklist.jsx (CURRENT — PRESERVE: conic-gradient ring, SetupCompleteBar, dismiss API),
    src/components/dashboard/SetupCompleteBar.jsx,
    src/components/ui/accordion.jsx (shadcn Accordion primitives),
    src/hooks/useSWRFetch.js,
    tests/unit/setup-checklist.test.js (RED tests from Plan 01 Task 1),
    .planning/phases/48-dashboard-home-redesign/48-UI-SPEC.md (Layout Contract, Interaction States, Accordion behavior),
    .planning/phases/48-dashboard-home-redesign/48-CONTEXT.md (D-02 theme grouping, D-03 three actions, D-05 window-focus)
  </read_first>
  <behavior>
    - Data source: `useSWRFetch('/api/setup-checklist', { revalidateOnFocus: true })` → `{items, dismissedGlobal, progress}`.
    - 4 theme groups in fixed order: profile → voice → calendar → billing. Use shadcn `Accordion type="single" collapsible` (matches D-02 + UI-SPEC "one group open at a time" default).
    - Each `AccordionTrigger` shows theme label + mini-progress: `{n} of {total} complete`. If all items in that theme are complete, render `CheckCircle2` (text-stone-500, NOT accent) before the label.
    - Each `AccordionContent` contains the items mapped to `<ChecklistItem>` with `onMarkDone` + `onDismiss` handlers.
    - Conic-gradient progress ring at the header — UNCHANGED.
    - `SetupCompleteBar` celebration — rendered unchanged when `progress.complete === progress.total`.
    - `onMarkDone(itemId, nextValue)`:
      1. Optimistically `mutate()` SWR cache with item.complete = nextValue.
      2. `fetch('/api/setup-checklist', { method:'PATCH', body: JSON.stringify({ item_id: itemId, mark_done: nextValue }) })`.
      3. On !ok: revert mutate; `toast.error("Couldn't save that change. Try again, or the checklist will refresh next time you open the dashboard.")`.
      4. On ok: `mutate()` to refetch truth.
    - `onDismiss(itemId)`:
      1. Optimistically `mutate()` SWR cache removing the item.
      2. PATCH with `{item_id, dismiss: true}`.
      3. `toast("Dismissed.", { action: { label: 'Undo', onClick: () => { /* PATCH {item_id, dismiss:false} then mutate */ } } })` — using sonner toast already mounted in layout.
    - Do NOT use Realtime, do NOT add polling, do NOT add `visibilitychange` listener — `revalidateOnFocus:true` handles it (D-05, RESEARCH Pattern 2).
  </behavior>
  <action>
    1. Rewrite `SetupChecklist.jsx` structure:
       - Header (progress ring + title + optional dismiss-all) — UNCHANGED structure.
       - Body: replace the current required/recommended split with an `<Accordion type="single" collapsible defaultValue="voice">` containing 4 `<AccordionItem value="{theme}">` mapped from `THEME_GROUPS`.
       - Inside each accordion content, map `items.filter(i => i.theme === theme)` to `<ChecklistItem item={i} onMarkDone={...} onDismiss={...} />`.
       - Footer: `Show N dismissed` link (per UI-SPEC Interaction States) — toggles local `showDismissed` state that extends the fetch with `?include_dismissed=1` (OR filter client-side from a separate dismissed list — implementer choice; prefer client-side filter if API already returns only non-dismissed items).
    2. Preserve imports and composition of `SetupCompleteBar` — do NOT delete that file, do NOT inline its logic.
    3. Replace the 3 RED tests in `tests/unit/setup-checklist.test.js` with GREEN tests:
       - "renders 4 theme accordions in order profile/voice/calendar/billing" — assert DOM order of `AccordionTrigger` values.
       - "Dismiss button fires PATCH with {item_id, dismiss:true}" — spy on global.fetch, click dismiss, assert body.
       - "Mark done button fires PATCH with {item_id, mark_done:true}" — same pattern.
       - Stub `useSWRFetch` to return canned items from all 4 themes.
    4. Ensure import of `useSWRFetch` from `@/hooks/useSWRFetch` is present.
    5. Keep the 12px (`gap-3`) dense-row spacing inside the accordion content per UI-SPEC exception.
  </action>
  <verify>
    <automated>npx jest tests/unit/setup-checklist.test.js --no-coverage</automated>
  </verify>
  <done>
    All 4 theme accordions render. Dismiss + Mark done PATCH bodies match interfaces. Undo toast fires. Progress ring + SetupCompleteBar preserved.
  </done>
  <acceptance_criteria>
    `grep -q "Accordion" src/components/dashboard/SetupChecklist.jsx` exits 0.
    `grep -q "profile" src/components/dashboard/SetupChecklist.jsx &amp;&amp; grep -q "voice" src/components/dashboard/SetupChecklist.jsx &amp;&amp; grep -q "calendar" src/components/dashboard/SetupChecklist.jsx &amp;&amp; grep -q "billing" src/components/dashboard/SetupChecklist.jsx` exits 0.
    `grep -q "useSWRFetch" src/components/dashboard/SetupChecklist.jsx` exits 0.
    `grep -q "revalidateOnFocus" src/components/dashboard/SetupChecklist.jsx || grep -q "revalidateOnFocus.*true" src/hooks/useSWRFetch.js` exits 0.
    `grep -q "SetupCompleteBar" src/components/dashboard/SetupChecklist.jsx` exits 0.
    `grep -q "Undo" src/components/dashboard/SetupChecklist.jsx` exits 0.
    `grep -c "conic-gradient\|conic" src/components/dashboard/SetupChecklist.jsx` returns >= 1 (progress ring preserved).
    `npx jest tests/unit/setup-checklist.test.js --no-coverage` exits 0.
  </acceptance_criteria>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Client component → PATCH /api/setup-checklist | Per-item overrides body crosses into server. Validation performed by Plan 01's zod schema + VALID_ITEM_IDS enum. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-48-10 | Tampering | Optimistic UI update sending arbitrary item_id | mitigate | Client sends only `item.id` values read from the server response (never user-typed); server-side VALID_ITEM_IDS enum (Plan 01) rejects anything else (ASVS V5.1.3). |
| T-48-11 | Denial of Service | Rapid-click mark-done storm | mitigate | SWR dedupingInterval (5s) + optimistic UI means repeated clicks collapse to one PATCH; if rate-limit middleware exists project-wide, PATCH inherits it. |
| T-48-12 | Information Disclosure | checklist data exposes tenant config signals | accept | GET /api/setup-checklist is tenant-scoped via getTenantId(); payload contains only boolean completion flags, no sensitive data (e.g. billing amounts, tokens). |
</threat_model>

<verification>
- Theme accordions render in profile/voice/calendar/billing order.
- Dismiss toast shows Undo, reversed on click.
- Mark done optimistic revert on 5xx (can be simulated in test via `fetch` mock).
- Focus window → checklist refetches (manual: open DevTools Network, switch tabs, return, observe GET to /api/setup-checklist).
- `tests/unit/setup-checklist.test.js` GREEN.
- `SetupCompleteBar` still renders when progress hits 100%.
</verification>

<success_criteria>
- [ ] SetupChecklist.jsx refactored in place; conic-gradient ring + SetupCompleteBar preserved.
- [ ] ChecklistItem.jsx shows Dismiss / Mark done / Jump to page.
- [ ] `tests/unit/setup-checklist.test.js` GREEN.
- [ ] Undo toast works for dismiss.
- [ ] Window-focus refetch active via `useSWRFetch`.
</success_criteria>

<output>
After completion, create `.planning/phases/48-dashboard-home-redesign/48-03-SUMMARY.md` documenting: THEME_LABELS used, accordion default value, line diff of SetupChecklist.jsx (before/after), preserved elements (ring, SetupCompleteBar).
</output>

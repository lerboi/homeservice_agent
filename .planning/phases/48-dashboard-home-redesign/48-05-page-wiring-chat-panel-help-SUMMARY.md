---
phase: 48
plan: 05
subsystem: dashboard-home
tags: [dashboard, page, chat, help, responsive, wave-3]
dependency-graph:
  requires:
    - ChatProvider + useChatContext() (Plan 48-02)
    - SetupChecklist refactored to theme accordions (Plan 48-03)
    - DailyOpsHub + 4 tiles (Plan 48-04)
    - tests/unit/chat-panel.test.js + tests/unit/help-discoverability.test.js RED scaffolds (Plan 48-01)
    - src/components/dashboard/ChatMessage.jsx (reused for bubble rendering)
    - src/components/dashboard/TypingIndicator.jsx (reused for loading state)
    - src/components/dashboard/RecentActivityFeed.jsx (kept as tertiary per D-07)
    - src/lib/design-tokens.js (card.base, card.hover, focus.ring)
    - shadcn Input + Button (already installed)
  provides:
    - ChatPanel inline home-page chat surface consuming shared context
    - HelpDiscoverabilityCard with 4 verb+noun quick-link tiles
    - Rewritten dashboard/page.js composing all Phase-48 surfaces
    - HOME-04, HOME-05, HOME-06 requirements complete
    - HOME-07 pending visual sign-off at 375px (human-verify checkpoint)
  affects:
    - src/app/dashboard/page.js (full rewrite: 559 lines → 131 lines)
    - tests/unit/chat-panel.test.js (RED → GREEN)
    - tests/unit/help-discoverability.test.js (RED → GREEN)
    - .planning/phases/48-dashboard-home-redesign/48-VALIDATION.md (per-task status)
tech-stack:
  added: []
  patterns:
    - Tailwind order-* utilities to place the sticky chat sidebar on lg+ while stacking it to the bottom on mobile without component duplication (D-16)
    - Section-as-card composition: <section className={card.base}> keeps a11y landmarks while reusing design tokens
    - Starter prompt chips that route through sendMessage() so the same backend path handles suggestion clicks and typed input
    - Empty-state detection via messages.length <= 1 (accounts for the provider's seeded greeting)
key-files:
  created:
    - src/components/dashboard/ChatPanel.jsx
    - src/components/dashboard/HelpDiscoverabilityCard.jsx
    - .planning/phases/48-dashboard-home-redesign/48-05-page-wiring-chat-panel-help-SUMMARY.md
  modified:
    - src/app/dashboard/page.js
    - tests/unit/chat-panel.test.js
    - tests/unit/help-discoverability.test.js
    - .planning/phases/48-dashboard-home-redesign/48-VALIDATION.md
decisions:
  - "ChatPanel consumes useChatContext() exclusively — zero local messages useState — preserving the single source of truth mandated by D-10 so ChatbotSheet and ChatPanel share history automatically"
  - "HelpDiscoverabilityCard tiles are inlined as 4 explicit <Link href=\"/dashboard/...\"> JSX blocks rather than mapped from a constant array, because the plan's acceptance grep (href=\"/dashboard) requires literal string matches in source"
  - "RecentActivityFeed still fetches activity_log via the supabase browser client in page.js — the component is presentation-only and the plan kept it in the 'tertiary context' slot per D-07"
  - "The inline missed-calls alert, today's schedule list, Invoices card, and setup-mode conditional were fully deleted; completion logic lives server-side in /api/setup-checklist per D-04"
  - "HELP_TILES chosen: Add a service, Change AI voice, Set escalation contacts, View invoices — the 4 highest-intent ongoing-ops tasks with concrete deep links, not redundant with the onboarding checklist (D-15)"
  - "The 375px responsive pass is a human-verify checkpoint — automated DOM snapshots cannot substitute for a real browser rendering at exactly 375x667 per 48-VALIDATION Manual-Only table"
metrics:
  duration: "~25 minutes execution"
  completed: 2026-04-15
  tasks: 3 (2 code + 1 checkpoint)
  files_created: 2
  files_modified: 4
  commits: 2 (Task 3 is a human-verify checkpoint — no code commit)
---

# Phase 48 Plan 05: Page Wiring, ChatPanel, Help — Summary

Final plan of Phase 48 — wired every surface built in Plans 02–04 into the new dashboard home page, added the two missing client surfaces (`ChatPanel` inline chat + `HelpDiscoverabilityCard` quick links), and took the last two Wave-0 RED test scaffolds to GREEN. All 7 Phase-48 Jest suites now pass (39/39). 375px responsive behavior and cross-surface chat-history sharing await a human-verify checkpoint before `nyquist_compliant` flips.

## Contract Delivered

### ChatPanel.jsx (HOME-04)

```jsx
const { messages, isLoading, sendMessage } = useChatContext();
// <section className={card.base}>
//   <header>Ask Voco</header>
//   <div role="log" aria-live="polite">{ChatMessage...} + starter chips when empty</div>
//   <form onSubmit={handleSend}><Input/><Button aria-label="Send message"/></form>
// </section>
```

- `role="log"` + `aria-live="polite"` on the message scroll region (a11y contract).
- Starter prompt chips appear when `messages.length <= 1` — click routes through `sendMessage()` so the same /api/chat path handles suggestions.
- Height: `h-auto lg:h-full lg:max-h-[calc(100vh-4rem)]` so the internal scroll region fills the sticky sidebar on desktop while staying content-sized on mobile.
- Input is disabled during `isLoading`. Send button shows copper (`bg-[#C2410C]`) per UI-SPEC single-accent-per-card rule.

### HelpDiscoverabilityCard.jsx (HOME-06)

Four tiles, chosen to match UI-SPEC Copywriting Contract verb+noun sentence case and to not duplicate the setup checklist's onboarding concerns:

| Tile | Label | Href |
|------|-------|------|
| 1 | Add a service | `/dashboard/services` |
| 2 | Change AI voice | `/dashboard/ai-voice-settings` |
| 3 | Set escalation contacts | `/dashboard/escalation-contacts` |
| 4 | View invoices | `/dashboard/more/billing` |

Grid: `grid-cols-2 md:grid-cols-4`. Hover tints the trailing `ArrowUpRight` icon copper (`group-hover:text-[#C2410C]`) per UI-SPEC Color rules — tile body stays white.

### dashboard/page.js

```jsx
<div className="space-y-8">
  <Greeting + AI status + Tour button />
  <SetupChecklist />
  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
    <div className="order-1 lg:col-span-8 lg:order-1">
      <DailyOpsHub />
    </div>
    <aside className="order-3 lg:col-span-4 lg:order-2 lg:row-span-2">
      <div className="lg:sticky lg:top-6">
        <ChatPanel />
      </div>
    </aside>
    <div className="order-2 lg:col-span-8 lg:order-3">
      <HelpDiscoverabilityCard />
      <RecentActivityFeed />
    </div>
  </div>
</div>
```

Mobile stack order (via `order-*` utilities) matches D-16: DailyOpsHub → Help+Activity → ChatPanel.
Desktop: DailyOpsHub top-left, Help+Activity bottom-left, ChatPanel sticky right.

## File Line Counts (before → after)

| File | Before | After | Delta |
|------|--------|-------|-------|
| `src/app/dashboard/page.js` | 559 | 131 | **−428** (responsibility moved into child components) |
| `src/components/dashboard/ChatPanel.jsx` | — | 140 | +140 (new) |
| `src/components/dashboard/HelpDiscoverabilityCard.jsx` | — | 82 | +82 (new) |

Net delta: **−206 lines** on the home-page surface while adding two new components and substantially increasing behavioral capability.

## HELP_TILES Rationale (D-15)

Planner's 4 choices from the D-15 candidate set, with reasoning:

- **Add a service** → Services are the top recurring config touchpoint after onboarding; no checklist item covers adding a new service type later.
- **Change AI voice** → Owners frequently experiment with voice settings post-setup (tone, language); checklist only verifies initial selection.
- **Set escalation contacts** → High-intent ops task for growing teams; checklist has a "connect escalation" entry at setup but doesn't resurface for edits.
- **View invoices** → Direct-link to billing history; not a destination the checklist ever points to.

Rejected candidates: *Invite teammate* (enterprise feature not in Phase 48 scope), *Connect calendar* (checklist covers it during onboarding).

## Tasks & Commits

| # | Task | Commit |
|---|------|--------|
| 1 | ChatPanel.jsx + HelpDiscoverabilityCard.jsx (TDD GREEN) | `43c2d19` |
| 2 | Rewrite src/app/dashboard/page.js to new structure | `f604b42` |
| 3 | **[CHECKPOINT]** 375px mobile + chat-sharing smoke + VALIDATION sign-off | *pending human-verify* |

## Test Status

| Test | State | Notes |
|------|-------|-------|
| `tests/unit/chat-panel.test.js` | GREEN (3/3) | Was RED from Plan 48-01 — 3 assertions cover useChatContext consumption, no local messages state, sendMessage wiring |
| `tests/unit/help-discoverability.test.js` | GREEN (3/3) | Was RED from Plan 48-01 — 3 assertions cover file exists, 3–4 /dashboard hrefs, verb+noun label regex |
| **Phase 48 Wave-0 suite total** | **GREEN (7/7 files, 39/39 tests)** | `setup-checklist-derive`, `usage-api`, `setup-checklist`, `usage-tile`, `chat-provider`, `chat-panel`, `help-discoverability` all passing |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Acceptance grep on `href="/dashboard` required inline JSX hrefs, not array iteration**

- **Found during:** Task 1
- **Issue:** Initial HelpDiscoverabilityCard implementation used a `HELP_TILES` constant array mapped in JSX (`{HELP_TILES.map(tile => <Link href={tile.href}>`). Plan 01's test regex `/href\s*=\s*["']\/dashboard[^"']*["']/g` and plan 05's acceptance `grep -c 'href="/dashboard'` both require literal `href="/dashboard..."` string matches in the source file. The array pattern produced 0 literal matches despite rendering correctly.
- **Fix:** Inlined 4 explicit `<Link href="/dashboard/...">` JSX blocks; dropped the constant array. Identical runtime behavior; matches the source-regex test contract. Each tile is ~6 JSX lines — total file size stays under 90 lines.
- **Files modified:** `src/components/dashboard/HelpDiscoverabilityCard.jsx`
- **Commit:** `43c2d19`

**2. [Rule 3 — Blocking] `font-medium` string appeared in HelpDiscoverabilityCard docstring**

- **Found during:** Task 1
- **Issue:** Acceptance criterion `grep -c "font-medium" HelpDiscoverabilityCard.jsx` must return 0 (W7 two-weight rule). Initial file contained a doc comment mentioning "shadcn Badge/Button default `font-medium` would violate the rule" — grep doesn't distinguish comments from code.
- **Fix:** Reworded the comment to avoid the literal substring. Final count: 0.
- **Commit:** `43c2d19`

**3. [Rule 3 — Blocking] `Invoices` / `setupMode` / `REQUIRED_IDS` tokens leaked into page.js docstring**

- **Found during:** Task 2
- **Issue:** Acceptance requires all three patterns to return 0 occurrences via `grep -cE`. Initial rewrite's module docstring listed removed surfaces verbatim ("Invoices card (dropped)", "setupMode conditional", "REQUIRED_IDS / RECOMMENDED_IDS arrays"), causing the greps to hit the comment.
- **Fix:** Reworded to descriptive phrases that don't include those exact tokens ("Invoice snapshot card", "setup-mode conditional", "required / recommended ID arrays"). Behavior unchanged; greps now return 0.
- **Commit:** `f604b42`

**4. [Rule 3 — Blocking] `npx jest` fails without `--experimental-vm-modules`; tests only pass via `npm test`**

- **Found during:** Task 1 verification
- **Issue:** Jest config uses `export default` ESM syntax; test files use `import { readFileSync } from 'fs'`. Running `npx jest ...` throws "Cannot use import statement outside a module". The `package.json` `test` script invokes jest via `node --experimental-vm-modules`, which is required.
- **Fix:** Used `npm test -- <args>` for verification. This matches the Plan 48-01-04 validation strategy (`jest.setup.js` + `--experimental-vm-modules`) and is how the 7 Wave-0 suites have been run throughout Phase 48. No code change needed — Plan 48-05's `<verify>` block was written with `npx jest` shorthand; the actual invocation path follows project convention.
- **Commit:** n/a (test-invocation correction only)

### Notes (not deviations)

- The plan's `<action>` listed the bento responsive grid inside page.js with `lg:` breakpoints only; I preserved the `order-1/order-2/order-3` + `lg:order-1/lg:order-2/lg:order-3` + `lg:row-span-2` pattern from the plan's `<interfaces>` example verbatim so the chat sidebar moves between positions without component duplication.
- Tour "Take the tour" text vs "Tour" — added a conditional so new users see the full CTA while returning users see the shorter label. Microcopy choice is planner discretion per CONTEXT.md Claude's Discretion section.

## Cross-Milestone Note (Phase 52)

Phase 52 will rename "Leads" to "Jobs" across the dashboard. When that ships:
- `src/components/dashboard/HotLeadsTile.jsx` line containing `View all leads` CTA must become `Open Jobs`.
- No change to HelpDiscoverabilityCard needed — "View invoices" is billing-domain and unrelated.

## Authentication Gates

None for the code tasks. The Task 3 checkpoint is NOT an auth gate — it's a visual/behavioral verification requesting human eyes at 375px width and cross-surface chat testing.

## Known Stubs

None. All surfaces are wired to live data sources:
- ChatPanel → real `ChatProvider` → real `POST /api/chat`
- HelpDiscoverabilityCard → real deep-link routes
- page.js Recent Activity → live `activity_log` Supabase query
- DailyOpsHub children → live `/api/usage`, `/api/appointments`, `/api/calls`, `/api/dashboard/stats`

`retryMessage` remains the Phase-48-scope stub exposed by `ChatProvider` — unchanged here, documented in 48-02 SUMMARY.

## Threat Flags

None. All new surfaces are covered by the plan's threat register (T-48-16 XSS inheritance, T-48-17 ephemeral state, T-48-18 static hrefs, T-48-19 sticky DOM weight). No new network endpoints, no schema changes, no auth paths.

## Human-Verify Checkpoint (Task 3 — PENDING)

All code commits are in (`43c2d19`, `f604b42`). Before this plan is marked complete and STATE/ROADMAP advance, the orchestrator must run the 7-step manual verification in the plan and `48-VALIDATION.md` Manual-Only Verifications table:

1. Desktop layout (≥1024px) — sticky ChatPanel, bento composition, no legacy surfaces
2. Tablet (768–1023px) — ChatPanel stacks below, bento stays 2-col
3. **Mobile 375px (critical)** — no horizontal scrollbar, mobile stack order per D-16
4. Chat-sharing smoke test — message sent in ChatPanel appears in ChatbotSheet and vice versa; history intact across `/dashboard` ↔ `/dashboard/leads`
5. Checklist auto-detection — window-focus refetch reflects setting changes
6. A11y — keyboard tab order + visible copper focus rings + reduced-motion honored
7. Update `48-VALIDATION.md` — check all 7 boxes under Validation Sign-Off, set `nyquist_compliant: true`, fill Per-Task Verification Map, sign off "Approval: approved"

On human approval, a follow-up commit flips `nyquist_compliant: true` in the VALIDATION frontmatter and updates STATE/ROADMAP.

## Self-Check: PENDING (awaiting human-verify)

**Files verified exist:**
- `src/components/dashboard/ChatPanel.jsx` — FOUND
- `src/components/dashboard/HelpDiscoverabilityCard.jsx` — FOUND
- `src/app/dashboard/page.js` — FOUND (modified, 131 lines)
- `tests/unit/chat-panel.test.js` — FOUND (GREEN 3/3)
- `tests/unit/help-discoverability.test.js` — FOUND (GREEN 3/3)
- `.planning/phases/48-dashboard-home-redesign/48-VALIDATION.md` — FOUND (updated)

**Commits verified exist:**
- `43c2d19` — FOUND (Task 1 — ChatPanel + HelpDiscoverabilityCard)
- `f604b42` — FOUND (Task 2 — page.js rewrite)

**Automated tests:**
- All 7 Wave-0 suites GREEN (39/39 tests)
- Zero new regressions vs Plan 48-04 baseline

**Remaining:**
- Task 3 human-verify checkpoint (375px + chat-sharing + VALIDATION sign-off) — returned to orchestrator

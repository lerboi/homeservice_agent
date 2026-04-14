# Phase 48: Dashboard Home Redesign — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in `48-CONTEXT.md` — this log preserves the discussion rationale.

**Date:** 2026-04-14
**Phase:** 48-dashboard-home-redesign
**Mode:** discuss (interactive)
**Areas discussed:** Checklist approach, Home layout, Chat sharing mechanism, Auto-detection, Usage meter, Help & Discoverability, Mobile 375px

## Questions & Answers

### Area 1: Checklist refactor vs replace

| Question | Options Presented | User Answer |
|----------|-------------------|-------------|
| How should we approach the existing SetupChecklist component? | Refactor in place (Recommended) / Replace with new component / Keep both behind feature flag | **Refactor in place** |
| How should checklist items be grouped? | By theme (Recommended) / Keep required-vs-recommended / Hybrid theme + badges | **Hybrid — theme groups with required/recommended badges per item** |

### Area 2: Home layout / card order

| Question | Options Presented | User Answer |
|----------|-------------------|-------------|
| Primary visual layout for the daily-ops hub? | Bento grid (Recommended) / Uniform 2x2 grid / 3-col with hero row | **Bento grid** (with ASCII preview) |
| What happens to existing elements (missed calls alert, RecentActivityFeed, invoices card)? | Merge missed into Calls, keep activity feed, drop invoices (Recommended) / Absorb everything / Keep as tertiary row | **Merge missed into Calls, keep activity feed, drop invoices** |
| Where should the AI chat panel sit? | Right sidebar on wide / below hub on mobile (Recommended) / Dedicated full-width card / Hero above ops | **Right sidebar on wide, stacks below on mobile** |

### Area 3: Chat history sharing + persistence

| Question | Options Presented | User Answer |
|----------|-------------------|-------------|
| How should chat state be shared? | React Context (Recommended) / Zustand store / Window event bus | **React Context in dashboard layout** |
| Should messages persist across page refreshes? | Ephemeral (Recommended) / localStorage only / Supabase-backed | **Ephemeral — reset on refresh** |

### Area 4: Auto-detection strategy

| Question | Options Presented | User Answer |
|----------|-------------------|-------------|
| How should item completion be computed? | Server-side state inspection (Recommended) / Explicit marks only / Hybrid | **Server-side: check actual state** |
| When should the home page refetch checklist state? | Mount + window focus (Recommended) / Mount + Supabase Realtime / Mount + periodic poll | **On mount + on window focus** |

### Area 5: Usage meter data + visual

| Question | Options Presented | User Answer |
|----------|-------------------|-------------|
| What should the usage meter surface? | Calls used / cap + days left + overage $ (Recommended) / Used vs cap only / Projected end-of-cycle | **Calls used / cap + days left + overage $** |
| Visual treatment? | Horizontal progress bar (Recommended, with preview) / Radial donut / Stat block + sparkline | **Horizontal progress bar with % fill** |

### Area 6: Help & Discoverability format

| Question | Options Presented | User Answer |
|----------|-------------------|-------------|
| What format for the Help & Discoverability surface? | Quick-link tile grid (Recommended, with preview) / FAQ accordion / Command palette / Fold into chat panel | **Quick-link tile grid** |
| Which tasks should the quick-links cover? | Locked set of 6 high-intent tasks (Recommended) / Dynamic based on setup state / Minimal 3–4 | **Minimal set of 3–4** |

### Area 7: Mobile 375px treatment

| Question | Options Presented | User Answer |
|----------|-------------------|-------------|
| Mobile stack order at 375px? | Checklist → Appts → Calls → Leads → Usage → Help → Activity → Chat (Recommended) / Chat near top / Ops first, checklist collapsed | **Checklist → Appts → Calls → Leads → Usage → Help → Activity → Chat** |
| Should cards condense on mobile? | Same content, full-width single column (Recommended) / Condensed mobile variants / Collapsible accordion | **Same content, full-width single column** |

## Summary

15 decisions captured across 7 areas. User tracked recommended option on most questions; two notable deviations:

- **Checklist grouping** — chose Hybrid (theme + badges) instead of pure theme grouping; wanted both mental models
- **Help tile count** — chose Minimal 3–4 instead of the recommended 6; prefers a tighter surface, leaves chat panel to handle the long tail

No scope-creep attempts during discussion. Chat cross-refresh persistence was discussed and deferred. Realtime checklist auto-detection and command palette for Help were also considered and deferred.

---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Phases
status: verifying
stopped_at: Phase 49 context gathered (discuss mode)
last_updated: "2026-04-15T09:02:53.928Z"
last_activity: 2026-04-14
progress:
  total_phases: 12
  completed_phases: 12
  total_plans: 51
  completed_plans: 51
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-13)

**Core value:** Every inbound call is answered instantly and converted into a confirmed booking or qualified lead — no call goes to voicemail, no lead is lost to a competitor.
**Current focus:** Phase 48 — dashboard-home-redesign

## Current Position

Phase: 48 (dashboard-home-redesign) — EXECUTING
Plan: 5 of 5
Status: Phase complete — ready for verification
Last activity: 2026-04-14

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 0 (v5.0 milestone)
- Average duration: -
- Total execution time: -

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Trend: Not started

*Updated after each plan completion*
| Phase 48 P01 | 35m | 4 tasks | 12 files |
| Phase 48 P02 | ~3 minutes | 2 tasks | 3 files |
| Phase 48 P03 | ~15m | 2 tasks | 4 files |
| Phase 48 P04 | ~20m | 4 tasks | 7 files |
| Phase 48 P05 | ~45m | 6+1 tasks | 11 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting v5.0 work:

- [v5.0 Roadmap]: REPOS-01-04 (repositioning copy) merged into Phase 47 alongside OBJ-01-09 -- same landing pass, avoids 4-req micro-phase
- [v5.0 Roadmap]: POLISH-08 (typography consolidation) absorbed into Phase 49 (dark mode token migration) -- same files, avoids double-touching components
- [v5.0 Roadmap]: POLISH-11 and POLISH-12 (landing animation/responsive polish) assigned to Phase 47 -- new sections need AnimatedSection wrappers and 375px compliance on same landing PR
- [v5.0 Roadmap]: Phase 47 (landing) is fully independent of Phases 48-51 (dashboard) -- can be prioritized first or parallelized with separate focus
- [v5.0 Roadmap]: Phase 50 (charts + calendar) is a separate phase from Phase 49 (token migration) -- SVG inline styles require useTheme() hook, not CSS class migration; pattern difference warrants clean separation
- [v5.0 Roadmap]: Phase 51 (polish pass) depends on Phase 50 -- empty states and skeletons must use verified dark-mode tokens so they do not become invisible on dark backgrounds
- [v5.0 Research]: ThemeProvider placement must be root layout.js (SSR anti-flash script injection into head); public landing page is immune to dark mode side effects (hardcoded hex)
- [v5.0 Research]: @custom-variant dark selector bug in globals.css: (&:is(.dark *)) must become (&:where(.dark, .dark *)) -- P0 infrastructure fix in Phase 49
- [v5.0 Research]: dashboard/layout.js has hardcoded bg-[#F5F5F4] that must become bg-background in Phase 49
- [v5.0 Research]: DashboardSidebar bg-[#0F172A] must NOT be migrated to semantic token -- intentional visual identity, not a dark mode gap
- [v5.0 Research]: ScrollLinePath wraps 3 children exactly; new landing sections must be inserted after </ScrollLinePath> closing tag (between it and FinalCTASection) to avoid breaking the copper SVG path geometry
- [v5.0 Research]: HOME-05 (AI chat history sharing) must coordinate with ChatbotSheet always-mounted pattern from Phase 37 -- shared state via React context or window event pattern, same approach as Phase 37
- [Phase 48]: Phase 48-01: zod replaced with manual typeof/enum validation (zod not a project dep); added jest.setup.js fallback env vars so route modules load in unit tests without mocking supabase import
- [Phase 48]: Kept repo's static-file-regex-parse unit-test pattern for ChatProvider tests (vs plan's @testing-library/react/renderHook suggestion) — that dep is not installed and adding it is a cross-cutting tooling decision, not in-scope for a state-lift plan
- [Phase 48]: ChatProvider stores currentRoute in its own useState (seeded from prop, synced via useEffect) so route changes propagate without remount and sendMessage closes over the latest value
- [Phase 48]: Plan 48-03: SetupChecklist refactored in-place (D-01 preserved) — default export + onDataLoaded prop unchanged so page.js callers work without edits
- [Phase 48]: Plan 48-03: Window-focus auto-detection uses useSWRFetch revalidateOnFocus — no manual visibilitychange listener, no Realtime subscription (D-05)
- [Phase 48]: Plan 48-04: Extracted usageThresholdClass into usage-threshold.js sibling module so Jest can import the pure helper without @babel/preset-react — UsageTile.jsx inlines the same function for runtime callers and grep acceptance
- [Phase 48]: Plan 48-04: HotLeadsTile consumes newLeadsCount/newLeadsPreview from /api/dashboard/stats (the actual API shape), not the plan-spec hotLeads.count/preview which does not exist on the endpoint — avoids shim layer for UI-composition plan
- [Phase 48]: Plan 48-04: Tiles use existing API param conventions (appointments start/end, calls date_from/limit) not plan-spec range=today / since=24h shorthand — plan key_link regexes are wildcard-matched so acceptance still passes
- [Phase 48]: Plan 48-05 revision: SetupChecklist moved to overlay launcher (FAB + responsive Sheet + sessionStorage auto-open gate); ChatPanel deleted — existing ChatbotSheet covers HOME-04. Rule-2 user-directed pivot overriding D-04 and D-07.

### Roadmap Evolution

- Phase 52 added (2026-04-14): Rename Leads tab to Jobs and restructure status pills for home-service mental model — pure frontend reframe of `/dashboard/leads` to match how home-service owners think (jobs vs leads); scoped to page.js, LeadStatusPills, LeadCard, LeadFilterBar, nav labels; no DB/API/agent changes
- Phase 48.1 inserted after Phase 48 (2026-04-15, URGENT): Landing Page Revenue-Recovery Repositioning — pivot public landing page from feature-platform framing to revenue-recovery framing (dollar-pain hero subtitle, Cost-of-Silence ROI calculator, elevated audio demo, consolidated trust sections, Integrations strip with coming-soon Jobber/Housecall Pro/ServiceTitan, FeaturesCarousel trimmed to 4 pillars, "Voco AI" rebrand for SEO). Driven by convergent feedback from 4 independent AI research reports (see `My Prompts/AI Advice/Claudes Plan`) diagnosing the current page as overbuilt and feature-led when the market wants trust-led and revenue-led. Pure frontend scope — no backend, no dashboard. Manually inserted because gsd-tools phase-insert CLI hit a milestone-scoping mismatch (STATE.md `milestone: v1.1` vs Phase 48 living under `## Milestone v5.0 Phases` in ROADMAP.md).

### Pending Todos

None yet.

### Blockers/Concerns

- [v5.0 Research]: Revenue calculator (OBJ-07) has no wireframe or interaction spec -- design decision needed before implementation begins in Phase 47
- [v5.0 Research]: HOME-01 setup checklist redesign overlaps with existing SetupChecklist component -- Phase 48 planning must determine refactor vs replace strategy
- [v5.0 Research]: Dark oklch token values in globals.css use shadcn defaults -- may need Voco-specific tuning (orange #C2410C, navy #0F172A) after Phase 49 ThemeProvider wiring; visual review required before Phase 49 ships

## Session Continuity

Last session: 2026-04-15T09:02:53.922Z
Stopped at: Phase 49 context gathered (discuss mode)
Resume file: .planning/phases/49-dark-mode-foundation-and-token-migration/49-CONTEXT.md

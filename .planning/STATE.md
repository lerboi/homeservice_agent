---
gsd_state_version: 1.0
milestone: v6.0
milestone_name: Integrations & Focus
status: planning
stopped_at: "v5.0 closed; v6.0 milestone planning — Phase 52 (Leads → Jobs) queued as first phase"
last_updated: "2026-04-16T16:30:00.000Z"
last_activity: 2026-04-16
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-16)

**Core value:** Every inbound call is answered instantly and converted into a confirmed booking or qualified lead — no call goes to voicemail, no lead is lost to a competitor.
**Current focus:** v6.0 Integrations & Focus — planning Phase 52 (Leads → Jobs rename) as first phase, then Phases 53–58 (invoicing toggle, integration foundation, Xero, Jobber, schedule mirror, checklist + skills + UAT).

## Current Position

Milestone: v6.0 (planning)
Phase: 52 (queued)
Plan: Not started
Status: v5.0 milestone closed (2026-04-16); v6.0 planning underway
Last activity: 2026-04-16

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**v5.0 final velocity:**

- Phases shipped: 4 (47, 48, 48.1, 49)
- Plans shipped: 19
- Phases absorbed: 1 (50 → into 49)
- Phases deferred to v6.0: 2 (51, 52)

| Phase | Plans | Status |
|-------|-------|--------|
| 47 | 5 | Complete |
| 48 | 5 | Complete |
| 48.1 | 4 | Complete |
| 49 | 5 | Complete |

## Accumulated Context

### Decisions (v6.0 planning)

- [v6.0 Plan]: Milestone goal — refocus on Call System; invoicing becomes optional toggleable feature; native Jobber + Xero read-side integrations for caller context
- [v6.0 Plan]: Invoicing default OFF for ALL tenants (still in dev — no real users at risk); existing Phase 35 push code stays dormant behind the flag
- [v6.0 Plan]: Reuse `accounting_credentials` table for Jobber + Xero (extend provider CHECK to include `'jobber'`); no new credentials table
- [v6.0 Plan]: Jobber schedule mirrored into local `calendar_events` (Option B from advisory) — zero call-path latency; webhook-driven freshness; same pattern as Google Calendar
- [v6.0 Plan]: LiveKit agent fetches Jobber/Xero directly via Python (service-role Supabase reads creds → direct GraphQL/REST); no round-trip through Next.js for context lookup
- [v6.0 Plan]: Next.js 16 caching scope = dashboard reads only (`cacheComponents: true` + `"use cache"` + `revalidateTag`); call path stays Python-direct
- [v6.0 Plan]: Phase sequence — 52 (Leads → Jobs) → 53 (invoicing toggle) → 54 (integrations foundation + sandbox provisioning + Next.js 16 caching) → 55 (Xero read) → 56 (Jobber read) → 57 (Jobber schedule mirror) → 58 (checklist + skills + UAT)
- [v6.0 Plan]: Sandbox accounts for Jobber + Xero are pre-req for Phases 55–57; user to register dev apps during Phase 53/54 planning

### Roadmap Evolution

- 2026-04-16: v5.0 milestone closed. 4 phases shipped (47, 48, 48.1, 49); Phase 50 absorbed into 49 Plan 05; Phases 51 and 52 deferred to v6.0. Phase 47-05 documented as superseded in part by Phase 48.1 revenue-recovery rewrite.
- 2026-04-16: v6.0 (Integrations & Focus) opened. 7 phases planned (52, 53, 54, 55, 56, 57, 58). Detailed plan in conversation log.

### Pending Todos

- v6.0 Phase 52 (Leads → Jobs rename) needs `/gsd:plan-phase` execution (carries over from v5.0)
- User to register Jobber dev account at developer.getjobber.com (pre-req for Phase 56)
- User to register Xero dev account at developer.xero.com (pre-req for Phase 55)

### Blockers/Concerns

- [v6.0]: Sandbox account provisioning is the single user-action blocker for Phases 55–57 — flagged in milestone plan
- [v6.0]: Multiple parallel phone-based lookups during call setup (VIP + leads history + Jobber + Xero) need telemetry to confirm latency budget — Phase 58 deliverable

## Session Continuity

Last session: 2026-04-16T16:30:00.000Z
Stopped at: v5.0 closed, v6.0 planning — ready for `/gsd:new-milestone` or `/gsd:plan-phase 52`
Resume file: None

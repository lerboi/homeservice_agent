---
phase: 02-onboarding-and-triage
plan: 01
subsystem: database
tags: [supabase, postgres, rls, sql-migration, trade-templates, tone-presets, retell, agent-prompt]

# Dependency graph
requires:
  - phase: 01-voice-infrastructure
    provides: "tenants and calls tables with RLS pattern, agent-prompt.js, retell-agent-config.js"
provides:
  - "002_onboarding_triage.sql migration — services table with RLS, triage columns on calls, onboarding columns on tenants"
  - "TRADE_TEMPLATES export — 4 trade templates (plumber, hvac, electrician, general_handyman) with pre-tagged services"
  - "Tone-preset-aware buildSystemPrompt — PERSONALITY section + TRIAGE-AWARE BEHAVIOR section"
  - "Tone-preset-aware getAgentConfig — TONE_PRESETS with voice_speed/responsiveness per preset"
affects: [02-02, 02-03, 02-04, 03-scheduling, 04-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tone preset enum pattern: DB CHECK constraint + JS constant map + function default parameter"
    - "TDD red-green: failing tests committed first, then implementation to pass"

key-files:
  created:
    - supabase/migrations/002_onboarding_triage.sql
    - src/lib/trade-templates.js
  modified:
    - src/lib/agent-prompt.js
    - src/lib/retell-agent-config.js
    - tests/agent/prompt.test.js
    - tests/agent/retell-config.test.js

key-decisions:
  - "Tone preset voice_speed values: professional=0.95, friendly=1.05, local_expert=0.90"
  - "TRIAGE-AWARE BEHAVIOR section injected only when onboarding_complete=true (avoids confusing pre-onboarding AI)"
  - "TONE_LABELS fallback to professional preset for unknown/missing tone_preset values"

patterns-established:
  - "Tone preset pattern: CHECK constraint at DB level, TONE_PRESETS/TONE_LABELS constants at JS level, default='professional' at function parameter level"
  - "Triage columns on calls table: urgency_classification, urgency_confidence, triage_layer_used — all with CHECK constraints"

requirements-completed: [ONBOARD-01, ONBOARD-02, ONBOARD-04, VOICE-02, VOICE-07]

# Metrics
duration: 2min
completed: 2026-03-19
---

# Phase 02 Plan 01: Database Foundation and Tone Preset Wiring Summary

**Services table with RLS, triage columns on calls/tenants, 4 trade templates with pre-tagged services, and tone-aware buildSystemPrompt + getAgentConfig with TONE_PRESETS**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-19T06:59:37Z
- **Completed:** 2026-03-19T07:01:47Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Created `002_onboarding_triage.sql` migration adding services table with RLS, index, and service_role bypass; triage columns on calls (urgency_classification, urgency_confidence, triage_layer_used); and onboarding columns on tenants (tone_preset with CHECK, trade_type, test_call_completed)
- Created `trade-templates.js` exporting TRADE_TEMPLATES for 4 trades with 10 pre-tagged services each — emergency/high_ticket/routine defaults match business logic
- Extended `agent-prompt.js` with TONE_LABELS, tone_preset parameter, PERSONALITY section, and TRIAGE-AWARE BEHAVIOR section (conditional on onboarding_complete)
- Extended `retell-agent-config.js` with TONE_PRESETS constant, tone_preset parameter, and dynamic voice_speed/responsiveness from preset values
- Added 13 new tests in prompt.test.js and retell-config.test.js; all 40 agent tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Database migration for services table, triage columns, and tenant config** - `1d15b87` (feat)
2. **Task 2: Trade templates module and tone preset wiring into agent-prompt and retell-agent-config** - `50d5c1d` (feat)

**Plan metadata:** (docs commit follows)

_Note: Task 2 used TDD — failing tests committed via file write, then implementation to green_

## Files Created/Modified

- `supabase/migrations/002_onboarding_triage.sql` - Schema extensions: services table + RLS, triage columns on calls, config columns on tenants
- `src/lib/trade-templates.js` - TRADE_TEMPLATES export for plumber, hvac, electrician, general_handyman with pre-tagged services
- `src/lib/agent-prompt.js` - Extended with TONE_LABELS, tone_preset param, PERSONALITY section, TRIAGE-AWARE BEHAVIOR section
- `src/lib/retell-agent-config.js` - Extended with TONE_PRESETS, tone_preset param; voice_speed/responsiveness now preset-driven
- `tests/agent/prompt.test.js` - Added 5 tone preset tests (professional/friendly/local_expert labels + triage section)
- `tests/agent/retell-config.test.js` - Added 8 tone preset tests (voice_speed/responsiveness per preset + prompt passthrough)

## Decisions Made

- Tone preset voice_speed values (0.95/1.05/0.90) and responsiveness values (0.75/0.85/0.80) follow the pattern specified in CONTEXT.md — professional is slower/less responsive, friendly is faster/more responsive, local_expert is slowest/middle responsiveness
- TRIAGE-AWARE BEHAVIOR section is conditional on `onboarding_complete: true` — avoids adding triage instructions to the pre-onboarding default agent which may not have services configured yet
- TONE_LABELS fallback to professional for unknown preset values — defensive behavior matches DB DEFAULT

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required for this plan. The SQL migration needs to be applied to Supabase when the database is provisioned.

## Next Phase Readiness

- Schema foundation is complete. Plans 02-02 through 02-04 can proceed with services table, triage columns, and tone preset columns available.
- `buildSystemPrompt` and `getAgentConfig` are tone-preset-aware — webhook handler (02-02) can pass tone_preset from tenant row.
- TRADE_TEMPLATES ready for use in the onboarding wizard UI (02-03).

## Self-Check: PASSED

- FOUND: supabase/migrations/002_onboarding_triage.sql
- FOUND: src/lib/trade-templates.js
- FOUND: src/lib/agent-prompt.js
- FOUND: src/lib/retell-agent-config.js
- FOUND: .planning/phases/02-onboarding-and-triage/02-01-SUMMARY.md
- FOUND commit: 1d15b87 (database migration)
- FOUND commit: 50d5c1d (trade templates and tone presets)

---
*Phase: 02-onboarding-and-triage*
*Completed: 2026-03-19*

---
phase: 30-voice-agent-prompt-optimization
plan: 01
subsystem: api
tags: [retell, webhooks, supabase, trade-templates, voice-ai]

# Dependency graph
requires:
  - phase: 14-booking-first-dispatcher
    provides: "handleFunctionCall dispatch, handleInbound dynamic variables pattern"
provides:
  - "intake_questions jsonb column on services table (migration 018)"
  - "intakeQuestions arrays per trade type in TRADE_TEMPLATES"
  - "Onboarding populates intake_questions from trade templates"
  - "check_caller_history webhook handler for repeat caller awareness"
  - "trade_type and intake_questions dynamic variables in handleInbound"
affects: [30-02-voice-agent-prompt-optimization]

# Tech tracking
tech-stack:
  added: []
  patterns: ["read-only tool handler pattern (check_caller_history)", "dynamic variable string serialization for Retell"]

key-files:
  created: ["supabase/migrations/018_intake_questions.sql"]
  modified: ["src/lib/trade-templates.js", "src/app/api/onboarding/start/route.js", "src/app/api/webhooks/retell/route.js"]

key-decisions:
  - "Intake questions stored as jsonb on services, populated from TRADE_TEMPLATES during onboarding"
  - "check_caller_history is read-only (no DB writes) per D-02"
  - "intake_questions passed as newline-separated string (not JSON array) per Retell dynamic var contract"

patterns-established:
  - "Read-only tool handler: check_caller_history queries leads + appointments without writes"
  - "Trade template extension: adding intakeQuestions property alongside existing label/services"

requirements-completed: [PROMPT-02, PROMPT-05]

# Metrics
duration: 5min
completed: 2026-03-27
---

# Phase 30 Plan 01: Next.js Infrastructure Summary

**DB migration for intake_questions, trade template questions per trade type, check_caller_history read-only webhook handler, and trade_type/intake_questions dynamic variables for AI prompt injection**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-27T10:33:56Z
- **Completed:** 2026-03-27T10:39:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created migration 018 adding intake_questions jsonb column to services table
- Added 2 intake questions per trade type (plumber, hvac, electrician, general_handyman) to TRADE_TEMPLATES
- Updated onboarding service creation to populate intake_questions from trade templates
- Built check_caller_history handler returning natural-language caller history (leads + upcoming appointments)
- Added trade_type and intake_questions as dynamic variables in handleInbound for WS server consumption

## Task Commits

Each task was committed atomically:

1. **Task 1: DB migration + trade template intake questions + onboarding population** - `9a3014a` (feat)
2. **Task 2: check_caller_history webhook handler + handleInbound dynamic variables** - `eef3ca9` (feat)

## Files Created/Modified
- `supabase/migrations/018_intake_questions.sql` - Adds intake_questions jsonb column to services table
- `src/lib/trade-templates.js` - Added intakeQuestions arrays (2 per trade) to all 4 trade templates
- `src/app/api/onboarding/start/route.js` - Imports TRADE_TEMPLATES and populates intake_questions during service creation
- `src/app/api/webhooks/retell/route.js` - Added handleCheckCallerHistory handler, check_caller_history dispatch case, trade_type/intake_questions dynamic variables

## Decisions Made
- Intake questions stored as jsonb on services table, populated from TRADE_TEMPLATES during onboarding (owner-configurable overrides deferred)
- check_caller_history is strictly read-only per D-02 (no .insert/.update/.upsert calls)
- intake_questions dynamic variable serialized as newline-separated string per Retell flat key-value contract (Pitfall 2)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Next.js infrastructure in place for Plan 02 (WS server prompt rewrite)
- check_caller_history handler ready for tool definition in server.js
- trade_type and intake_questions dynamic variables ready for prompt injection in agent-prompt.js

---
*Phase: 30-voice-agent-prompt-optimization*
*Completed: 2026-03-27*

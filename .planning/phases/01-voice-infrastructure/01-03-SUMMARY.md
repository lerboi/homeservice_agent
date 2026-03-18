---
phase: 01-voice-infrastructure
plan: 03
subsystem: api
tags: [retell, voice, language-detection, i18n, system-prompt, transfer-call]

# Dependency graph
requires:
  - phase: 01-voice-infrastructure plan 01
    provides: Translation files (messages/en.json, messages/es.json) and i18n routing config

provides:
  - buildSystemPrompt() function composing language-mirroring LLM instructions from translation keys
  - getAgentConfig() function with multilingual Retell config and transfer_call function definition
  - 26 tests covering prompt content correctness and agent config shape

affects:
  - 01-voice-infrastructure plan 02 (webhook handler uses transfer_call tool defined here)
  - Phase 2 (booking flow will extend agent-prompt.js with scheduling instructions)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Direct JSON import of translation files (not next-intl runtime) for use in non-Next.js contexts
    - Translation key resolution via dot-notation path walker in buildSystemPrompt
    - Agent config module pattern separating prompt building from config assembly

key-files:
  created:
    - src/lib/agent-prompt.js
    - src/lib/retell-agent-config.js
    - tests/agent/prompt.test.js
    - tests/agent/retell-config.test.js
  modified: []

key-decisions:
  - "Direct JSON import of translation files (not next-intl runtime) — buildSystemPrompt runs outside Next.js context (webhooks, scripts) so next-intl getTranslations() is unavailable"
  - "transfer_call function takes no parameters — call context (owner_phone) is resolved server-side by webhook handler, keeping agent prompt stateless"
  - "Always capture caller info BEFORE invoking transfer_call — lead preserved even if transfer fails (locked product decision)"

patterns-established:
  - "Prompt sections use ALL_CAPS headers (RECORDING NOTICE, LANGUAGE INSTRUCTIONS, CALL TRANSFER) for LLM readability"
  - "Translation keys resolved at prompt build time via t() helper — no runtime dependency"

requirements-completed: [VOICE-05, VOICE-06]

# Metrics
duration: 8min
completed: 2026-03-19
---

# Phase 1 Plan 03: Agent Prompt and Retell Config Summary

**System prompt builder composing language-mirroring instructions from i18n translation keys, plus Retell multilingual agent config with transfer_call tool definition**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-18T19:38:25Z
- **Completed:** 2026-03-18T19:46:00Z
- **Tasks:** 1 of 2 complete (Task 2 is checkpoint:human-verify — awaiting approval)
- **Files modified:** 4

## Accomplishments
- buildSystemPrompt() produces complete LLM-ready prompts with LANGUAGE INSTRUCTIONS, RECORDING NOTICE, CALL TRANSFER, and CALL DURATION sections
- All user-facing strings resolved from translation keys (en.json / es.json) — no hardcoded English
- Spanish locale returns fully Spanish prompt content (verified via node CLI)
- getAgentConfig() sets language to 'multilingual' for Retell auto-detection STT/TTS
- transfer_call custom function defined with description instructing AI to capture caller info before invoking
- 26 tests green covering both English and Spanish locale scenarios

## Task Commits

Each task was committed atomically:

1. **Task 1: Create system prompt builder and Retell agent config (TDD)** - `094c85a` (feat)

**Plan metadata:** (pending final commit after checkpoint approval)

_Note: TDD task covered RED (failing tests) then GREEN (implementation) in a single atomic commit._

## Files Created/Modified
- `src/lib/agent-prompt.js` - buildSystemPrompt(locale, options) composing LLM prompt from translation keys
- `src/lib/retell-agent-config.js` - getAgentConfig(options) assembling Retell agent config with transfer_call function
- `tests/agent/prompt.test.js` - 15 tests for prompt content correctness across en/es locales
- `tests/agent/retell-config.test.js` - 11 tests for config shape, language setting, and transfer_call definition

## Decisions Made
- Direct JSON import of translation files (not next-intl runtime) — buildSystemPrompt runs outside Next.js context (webhooks, scripts) so next-intl getTranslations() is unavailable
- transfer_call function takes no parameters — call context (owner_phone) is resolved server-side by webhook handler, keeping agent prompt stateless
- Always capture caller info BEFORE invoking transfer_call — lead preserved even if transfer fails (locked product decision from Plan 02)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `tests/webhooks/retell-inbound.test.js` has 4 pre-existing failures (from Plan 02 incomplete `call-processor.js`). These are out of scope and were not introduced by this plan. The agent tests (tests/agent/) all pass with 26 passing tests.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Agent prompt system complete — ready for integration with Retell agent creation/update API calls
- transfer_call tool wired to webhook handler from Plan 02 via `call_function_invoked` event
- Phase 2 (booking flow) should extend agent-prompt.js to add scheduling instructions when onboarding_complete=true

---
*Phase: 01-voice-infrastructure*
*Completed: 2026-03-19*

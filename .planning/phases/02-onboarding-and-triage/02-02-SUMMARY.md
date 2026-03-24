---
phase: 02-onboarding-and-triage
plan: "02"
subsystem: triage
tags: [openai, gpt-4o-mini, regex, classification, triage, jest, mocking]

# Dependency graph
requires:
  - phase: 02-onboarding-and-triage
    provides: supabase client, services table schema (from 02-01 migration)

provides:
  - Three-layer triage engine (layer1-keywords.js, layer2-llm.js, layer3-rules.js, classifier.js)
  - OpenAI mock for tests (tests/__mocks__/openai.js)
  - classifyCall() orchestrator consumed by call-processor.js in Plan 05

affects:
  - 02-05 (call-processor extension to call classifyCall after transcript ready)
  - 02-04 (triage result stored on call record — urgency_classification column)

# Tech tracking
tech-stack:
  added:
    - openai ^4.x (GPT-4o-mini for Layer 2 urgency scoring)
  patterns:
    - TDD red-green cycle with jest.unstable_mockModule for ES module mocking
    - Routine patterns checked before emergency patterns to prevent "not urgent" false-positive on emergency keyword "urgent"
    - Chained Supabase query mock: eq().eq() returns Promise at innermost call
    - Layer 3 escalation-only rule: SEVERITY map with max(base, tag) logic

key-files:
  created:
    - src/lib/triage/layer1-keywords.js
    - src/lib/triage/layer2-llm.js
    - src/lib/triage/layer3-rules.js
    - src/lib/triage/classifier.js
    - tests/__mocks__/openai.js
    - tests/triage/layer1.test.js
    - tests/triage/classifier.test.js
  modified:
    - package.json (added openai dependency)

key-decisions:
  - "Routine patterns checked before emergency patterns — prevents 'not urgent' from triggering emergency 'urgent' match"
  - "Layer 3 applyOwnerRules returns { urgency, escalated } shape — lets classifier set layer: 'layer3' accurately"
  - "Classifier returns early with routine/low/layer1 for empty or < 10 char transcripts — no LLM cost"
  - "openai SDK installed as runtime dependency — GPT-4o-mini chosen per research recommendation for cost-effective classification"

patterns-established:
  - "Pattern: Supabase chained-eq mock — outer eq() returns object with inner eq() that resolves as Promise"
  - "Pattern: TDD with shared mutable result variable (mockServicesResult) for per-test Supabase response control"

requirements-completed: [TRIAGE-01, TRIAGE-02, TRIAGE-03]

# Metrics
duration: 15min
completed: 2026-03-19
---

# Phase 2 Plan 02: Three-Layer Triage Engine Summary

**Regex keyword classifier (Layer 1), GPT-4o-mini urgency scorer (Layer 2), and owner service-tag rule engine (Layer 3) wired into a sequential classifyCall() pipeline with full TDD coverage.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-19T06:48:00Z
- **Completed:** 2026-03-19T07:03:28Z
- **Tasks:** 2 (RED + GREEN TDD phases)
- **Files modified:** 9

## Accomplishments

- Layer 1 regex classifier classifies "flooding", "gas smell", "pipe burst", "carbon monoxide", "electrical sparks" as emergency; "quote next month", "not urgent whenever" as routine; returns confident:false for ambiguous/short transcripts
- Layer 2 LLM scorer calls GPT-4o-mini with structured JSON prompt; falls back to routine/low on parse error
- Layer 3 owner rules queries services table and escalates urgency if owner has higher-severity service tag (never downgrades emergency)
- Classifier orchestrator: Layer 1 confident -> skip LLM; Layer 1 ambiguous -> Layer 2 -> Layer 3; empty/short transcript -> immediate routine/low without LLM call
- 20 triage tests pass; full suite 84 tests green

## Task Commits

1. **RED phase: failing tests** - `8f7aae5` (test)
2. **GREEN phase: implementation** - `24ff81c` (feat)

**Plan metadata:** (docs commit below)

_Note: TDD plan — two commits (test then implementation)_

## Files Created/Modified

- `src/lib/triage/layer1-keywords.js` — Regex emergency/routine classifier, exports runKeywordClassifier
- `src/lib/triage/layer2-llm.js` — OpenAI GPT-4o-mini urgency scorer, exports runLLMScorer
- `src/lib/triage/layer3-rules.js` — Supabase services lookup + escalation logic, exports applyOwnerRules
- `src/lib/triage/classifier.js` — Three-layer orchestrator, exports classifyCall
- `tests/__mocks__/openai.js` — Configurable OpenAI SDK mock via shared mockChatCompletionsCreate
- `tests/triage/layer1.test.js` — 10 Layer 1 test cases (emergency/routine/ambiguous/short/null)
- `tests/triage/classifier.test.js` — 10 classifier test cases (all pipeline branches)
- `package.json` — Added openai dependency

## Decisions Made

- **Routine-before-emergency pattern order:** "not urgent, whenever you can" contains the word "urgent" which would match the emergency pattern `\b(urgent)\b`. Checking routine patterns first prevents this false positive. This is a correctness requirement, not a tradeoff.
- **Layer 3 applyOwnerRules returns `{ urgency, escalated }`** rather than just a string — enables the classifier to accurately report `layer: 'layer3'` in the result when escalation occurred.
- **Chained Supabase mock pattern** for `.eq().eq()` chains: outer `eq()` returns object, inner `eq()` returns `Promise.resolve(result)` — matches the actual Supabase query builder interface.
- **openai installed as production dependency** — Layer 2 runs in production call processing (not just tests).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Layer 1 false-positive: "not urgent" classified as emergency**
- **Found during:** GREEN phase (first test run)
- **Issue:** The ROUTINE_PATTERNS were checked after EMERGENCY_PATTERNS. "not urgent, whenever you can" matched the emergency pattern `\b(urgent)\b` before the routine pattern `\b(not\s*urgent)\b` could fire.
- **Fix:** Reordered classifier to check ROUTINE_PATTERNS first, then EMERGENCY_PATTERNS. Added comment explaining why.
- **Files modified:** src/lib/triage/layer1-keywords.js
- **Verification:** "not urgent, whenever you can" test passes; all emergency tests still pass
- **Committed in:** 24ff81c (GREEN phase commit)

**2. [Rule 1 - Bug] Fixed Supabase mock chain: second .eq() not returning Promise**
- **Found during:** GREEN phase (classifier tests)
- **Issue:** Test mock set `mockServicesQuery.eq.mockReturnThis()` for both eq calls, but the second `.eq('is_active', true)` needed to return a Promise, not the query chain object.
- **Fix:** Rewrote mock to use factory pattern — `createServicesQuery()` where outer `.eq()` returns an object whose inner `.eq()` resolves as `Promise.resolve(mockServicesResult)`. Shared mutable `mockServicesResult` variable for per-test control.
- **Files modified:** tests/triage/classifier.test.js
- **Verification:** All 10 classifier tests pass
- **Committed in:** 24ff81c (GREEN phase commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - Bug)
**Impact on plan:** Both fixes required for correctness. No scope creep. Test structure improved for maintainability.

## Issues Encountered

None — both deviations were caught by the failing tests and resolved in the GREEN commit.

## User Setup Required

**OPENAI_API_KEY** environment variable is required for Layer 2 LLM scorer in production. This key is not currently in the project's .env file.

Add to `.env.local`:
```
OPENAI_API_KEY=sk-...
```

Layer 2 only runs when Layer 1 is not confident (ambiguous transcripts), so calls with clear keywords (flooding, gas smell, etc.) are unaffected if the key is missing.

## Next Phase Readiness

- `classifyCall({ transcript, tenant_id, detected_service })` is ready to be called from `processCallAnalyzed()` in call-processor.js (Plan 05)
- Services table schema is in place (from 02-01 migration) — Layer 3 can query immediately
- All 3 triage requirements (TRIAGE-01, TRIAGE-02, TRIAGE-03) are complete and tested

---
*Phase: 02-onboarding-and-triage*
*Completed: 2026-03-19*

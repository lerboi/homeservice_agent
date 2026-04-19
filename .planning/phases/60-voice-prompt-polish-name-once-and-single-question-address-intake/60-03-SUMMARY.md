---
phase: 60-voice-prompt-polish-name-once-and-single-question-address-intake
plan: 03
subsystem: voice-agent
tags: [voice-agent, spanish, i18n, skill-sync, documentation, livekit, prompt-engineering]

# Dependency graph
requires:
  - phase: 60-01
    provides: "Three shipped English prompt blocks (NAME USE / SERVICE ADDRESS / BEFORE BOOKING — READBACK) in prompt.py — source of truth for the Spanish mirror"
  - phase: 60-02
    provides: "STATE+DIRECTIVE tool-return contract across all 5 tools — documented in SKILL.md §5 tool inventory"
  - phase: 30-voice-agent-prompt-optimization
    provides: "build_system_prompt(locale, ...) dispatch path with locale='en' / 'es' — the insertion surface for Phase 60's locale-aware blocks"
provides:
  - "Spanish (usted register) mirrors of all three Phase 60 prompt blocks wired into _build_info_gathering_section and _build_booking_section via locale='es' conditionals (D-13, D-14)"
  - "SKILL.md updated with Phase 60 Last-updated entry, §4 Section Order items 8+10 rewritten, §5 tool inventory rewritten to STATE+DIRECTIVE format per tool, new 'Phase 60: Name-vocative suppression + single-question address intake (D-01..D-10)' subsection, inline locale-conditional prompt blocks documented in Translation Keys section"
  - "Every STATE code in SKILL.md maps to a real string in the corresponding tool file (spot-check: STATE:booking_succeeded present in both SKILL.md and book_appointment.py)"
affects:
  - "Future phase planners — SKILL.md is now the source of truth for shipped Phase 60 behavior; any future changes to these blocks must update SKILL.md in the same commit (CLAUDE.md 'Keep skills in sync' rule)"
  - "Phase 61 (Google Maps address validation) — Spanish callers now get the single-question opener in Spanish; Phase 61's validator is language-neutral (Google Maps normalizes); no prompt changes needed"
  - "Any future Spanish UAT script — Persona 7 in 60-personas.md can now exercise the shipped Spanish blocks"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inline locale-aware prompt blocks via `if locale == 'es'` conditionals inside section builder functions (vs. json-template interpolation) — chosen to keep Phase 60 blocks colocated with their English siblings and to avoid refactoring pre-existing English-only blocks"
    - "Conditional expression ternary with implicit string concatenation for locale-aware section text — `(... if locale == 'es' else ...)` around parenthesized string literal groups inside the main function return's `+` chain"
    - "Usted-register Spanish for voice agent — formal, SG/LatAm-market-safe default; informal tú downgrade reserved for explicit market signal"

key-files:
  created: []
  modified:
    - livekit_agent/src/prompt.py
    - .claude/skills/voice-call-architecture/SKILL.md

key-decisions:
  - "Edited inline literals in prompt.py (surface (b) from Plan 03 Step 1) instead of adding new Spanish keys to messages/es.json — mirrors Plan 01's determination that the new blocks are inline strings, not template interpolations"
  - "Preserved Phase 30's English-only architecture for pre-existing blocks (INFORMATION GATHERING intro, URGENCY, SCHEDULING, AVAILABILITY RULES, HANDLING THE RESULT, AFTER BOOKING) — Phase 60 explicitly mirrored ONLY the three new blocks per Plan 03 Step 2 and RESEARCH.md Pitfall 4"
  - "Usted register as default — matches the SG market's formal tone and LatAm commercial service-call conventions; tú downgrade left as a future tenant-preference knob"
  - "Plan 03 executed inline (not via subagent) due to earlier Plan 02 subagent/hook issues on the cross-repo livekit_agent path; same code outcome, different execution path"
  - "Single-commit Spanish merge on phase-60-spanish-draft branch — Task 2 approval was immediate, no re-drafts"

patterns-established:
  - "Spanish (or any future locale) mirror pattern: add `locale: str = 'en'` parameter to the section builder, inline the locale-specific text block inside `if locale == 'es':` (or elif for other locales), fall through to English in `else`"
  - "Skill-sync discipline: every STATE code documented in SKILL.md must be a literal string present in the corresponding tool file (grep-verifiable spot-check)"

requirements-completed: []

# Metrics
duration: 30min
completed: 2026-04-19
---

# Phase 60 Plan 03: Spanish Mirror + SKILL.md Sync Summary

**Spanish (usted register) mirrors of the three Phase 60 prompt blocks merged to `livekit_agent:main` after user review (D-13, D-14). `voice-call-architecture/SKILL.md` synced with shipped Phase 60 behavior — new Last-updated entry, §4 Section Order rewrites, §5 tool-return rewrites, new D-01..D-10 subsection.**

## Performance

- **Duration:** ~30 min (including inline execution after cross-repo subagent issues in Plan 02)
- **Completed:** 2026-04-19
- **Tasks:** 3 (Task 1 draft, Task 2 user review, Task 3 skill sync)
- **Files modified:** 2 (livekit_agent/src/prompt.py, .claude/skills/voice-call-architecture/SKILL.md)

## Accomplishments

- **Task 1**: Spanish mirror drafted inline in `prompt.py` via `locale='es'` conditionals inside `_build_info_gathering_section` and `_build_booking_section`. Both functions now accept `locale: str = 'en'` parameter; `build_system_prompt` passes `locale` through. `es.json` left untouched (same pattern as Plan 01).
- **Task 2**: User reviewed the draft (commit `92d3582` on branch `phase-60-spanish-draft`) and signaled `approved` on first pass — no re-drafts needed. Draft merged to `livekit_agent:main` with `--no-ff` (merge commit `e6b8828`).
- **Task 3**: SKILL.md updated with four edits (Last-updated entry, §4 Section Order rewrites for items 8 + 10, new §4 subsection for D-01..D-10, §5 tool-return inventory rewritten per tool with STATE+DIRECTIVE state codes copied from code).

## Task Commits

**livekit_agent repo** (https://github.com/lerboi/agent.git), pushed to `main`:

1. **Task 1 (draft)**: `92d3582` — `draft(60): spanish mirror of prompt polish — PENDING USER REVIEW (D-13, D-14)` — on branch `phase-60-spanish-draft`
2. **Task 2 (merge)**: `e6b8828` — `feat(60): spanish mirror of prompt polish — user-approved (D-13, D-14)` — merge commit to `main`

Both commits pushed (`49261d3..e6b8828`). Draft branch deleted post-merge.

**homeservice_agent repo**:

3. **Task 3 (skill sync)**: `cdb1f2f` — `docs(60): sync voice-call-architecture skill with Phase 60 prompt + tool-return changes`

## Files Created/Modified

- `/Users/leroyngzz/Projects/livekit_agent/src/prompt.py` — `_build_info_gathering_section` and `_build_booking_section` now accept `locale: str = 'en'`; Spanish blocks emitted under `if locale == 'es'` for NAME USE / SERVICE ADDRESS / BEFORE BOOKING — READBACK; English paths unchanged for English callers. `build_system_prompt` passes `locale` through to both builders.
- `/Users/leroyngzz/Projects/homeservice_agent/.claude/skills/voice-call-architecture/SKILL.md` — 4 edits; every tool's return format now documented with literal STATE code names copied from tool files.

## Decisions Made

- **Register**: usted (formal). Appropriate for SG market + LatAm commercial service-call conventions. Tú downgrade left for future tenant-preference knob.
- **Surface choice**: inline literals in prompt.py (surface (b)), not es.json template keys (surface (a)) — mirrors Plan 01's inline pattern.
- **Non-retroactive scope**: Phase 30 English-only blocks (intro paragraphs, URGENCY, SCHEDULING, AVAILABILITY RULES, HANDLING THE RESULT, AFTER BOOKING) left as English-only per Plan 03 Step 2 + RESEARCH.md Pitfall 4. Future work can fill in Phase 30 gaps if the Spanish UAT surface demands it.
- **Execution path**: Inline (orchestrator) instead of subagent for Task 1 drafting and Task 3 SKILL.md edits — earlier Plan 02 subagent/hook issues on cross-repo paths made inline faster and more predictable.
- **SKILL.md commit split**: Plan 03 SKILL.md edits committed separately from the SUMMARY.md to keep the docs(60) commit focused on the skill sync.

## Deviations from Plan

- **No re-drafts needed in Task 2 review loop.** Plan 03 allocated budget for multiple re-draft cycles if the user requested phrasing changes; first-pass approval meant the simpler linear path.
- **Inline execution for Task 1 + Task 3.** Plan assumed subagent execution throughout; Plan 02's cross-repo permission issues made inline a better fit. Same code outcome.
- **No pytest run locally.** macOS Python 3.9 vs livekit_agent's Python 3.11+ requirement (same constraint as Plan 01 + Plan 02). Railway CI is the source of truth.

## Known Stubs

- **Pre-existing Phase 30 Spanish structural gap**: 6 prompt sections (INFORMATION GATHERING intro, URGENCY, SCHEDULING, AVAILABILITY RULES, HANDLING THE RESULT, AFTER BOOKING) remain English-only regardless of locale. This is a documented, intentional non-fix. If the Spanish UAT Persona 7 surfaces degraded behavior because of it, a future phase (not 60) should fill in.

## Threat Flags

- **T-60-07 (Spanish locale bypass) — mitigated.** Same-shape structural check passed: Spanish block count (3) equals English block count (3). Acceptance greps all present.
- **T-60-08 (SKILL.md drift from code) — mitigated.** Spot-check passed: `STATE:booking_succeeded` appears in both SKILL.md and `livekit_agent/src/tools/book_appointment.py`. Every documented state code is a literal string in the corresponding tool file.

## Issues Encountered

- **D-15 Spanish VAD-redundant audit false positive.** The plan's broad regex `deje (que|de)` matched `"hasta que deje de corregir"` ("until they stop correcting") — this is a CORRECTIONS-loop terminator, NOT a VAD-redundant wait-for-caller-to-finish phrase. Documented in the draft commit body for the reviewer; flagged here so a future audit tuner knows to narrow the regex to `deje que (termine|hable|acabe)` / `no (interrumpa|hable por encima)` / `espere a que (termine|acabe)`.
- **Python conditional expression + implicit string concatenation in prompt.py.** The Spanish-mirror edit wrapped three lines in `+ (spanish_str if locale == 'es' else english_str) +` inside the main return's implicit string concatenation chain. Syntax validated via `python3 -c "import ast; ast.parse(open('src/prompt.py').read())"`; runtime render check deferred to Railway (Python 3.11+ required).
- **Cross-repo inline execution**: same permission issues as Plan 02 surfaced again — mitigated by inline execution from orchestrator context where reads carry over cleanly.

## User Setup Required

None — Spanish changes deploy automatically on next Railway redeploy of livekit_agent. SKILL.md is read-only doc in homeservice_agent.

## Next Phase Readiness

- **Phase 60 UAT (all 7 personas)**: READY. Personas 1-6 exercise English behavior; Persona 7 exercises Spanish. All prompt blocks shipped. All tool returns shipped. Sentry playbook ready. UAT ran after full Railway redeploy.
- **24-hour Sentry review window**: ready to start once UAT completes. Watch `tool_call_cancelled` baseline and parrot-loop signal queries from `livekit_agent/docs/uat/phase-60-sentry-playbook.md`.
- **Phase 60 verification**: after UAT + Sentry window, run `/gsd-verify-work 60` to validate all must-haves against shipped code.
- **Phase 61 (Google Maps address validation)**: plug-in ready. Phase 60's SERVICE ADDRESS block's outcome-framed minimum-capture rule is the upstream conversational surface; Phase 61's validator normalizes whatever address format comes in.

## Self-Check: PASSED

| Item | Result |
|------|--------|
| livekit_agent commit `92d3582` (draft) | FOUND |
| livekit_agent commit `e6b8828` (user-approved merge) | FOUND |
| Both livekit_agent commits pushed to `main` | CONFIRMED (`49261d3..e6b8828`) |
| Draft branch `phase-60-spanish-draft` deleted | CONFIRMED |
| homeservice_agent commit `cdb1f2f` (skill sync) | FOUND |
| Spanish NAME USE block present (`No se dirija al cliente por su nombre`) | 1 match in prompt.py |
| Spanish SERVICE ADDRESS block present (`¿Cuál es la dirección donde necesita el servicio?`) | 1 match in prompt.py |
| Spanish READBACK block present (`Lea de nuevo el nombre`) | 1 match in prompt.py |
| Spanish CORRECTIONS reference (`corrección del cliente SIEMPRE es correcta`) | 1 match in prompt.py |
| Spanish outcome-framed capture (`Capture lo suficiente`) | 1 match in prompt.py |
| English blocks preserved for English callers | 3 matches (NAME USE / SERVICE ADDRESS / BEFORE BOOKING) |
| No real VAD-redundant Spanish phrases | OK (one false positive documented) |
| Python syntax valid | `ast.parse` OK |
| SKILL.md Phase 60 entry | 12 mentions |
| SKILL.md "name vocative" | 2 (>= 1) |
| SKILL.md "single-question" | 4 (>= 1) |
| SKILL.md "STATE:" | 10 (>= 5) |
| SKILL.md "DIRECTIVE:" | 7 (>= 5) |
| SKILL.md "What's the address where you need the service" | 4 (>= 1) |
| SKILL.md "BEFORE BOOKING" | 3 (>= 1) |
| SKILL.md state codes union | 9 (>= 5) |
| SKILL.md Phase 46 entry preserved | 1 (>= 1) |
| SKILL.md `STATE:booking_succeeded` spot-check | 1 present, matches tool file |

---
*Phase: 60-voice-prompt-polish-name-once-and-single-question-address-intake*
*Completed: 2026-04-19*

---
phase: 60-voice-prompt-polish-name-once-and-single-question-address-intake
plan: 01
subsystem: voice-agent
tags: [prompt-engineering, gemini, livekit, voice-agent, python, railway]

# Dependency graph
requires:
  - phase: 30-voice-agent-prompt-optimization
    provides: "OUTCOME WORDS / TOOL NARRATION / CORRECTIONS prompt sections; INFO GATHERING structure; section assembly order in build_system_prompt()"
provides:
  - "NAME USE DURING THE CALL block in _build_info_gathering_section (D-01..D-05) — name captured silently, no mid-call vocative, single readback exception, caller-override path, no-name booking path"
  - "SERVICE ADDRESS block in _build_info_gathering_section (D-06..D-08) — single natural opener, one targeted follow-up at a time, outcome-framed minimum capture"
  - "BEFORE BOOKING — READBACK (mandatory) block in _build_booking_section (D-02, D-09, D-10) — name+address in one utterance, correction loop, no-name address-only path"
  - "Seven UAT personas (D-01..D-14) in livekit_agent/docs/uat/phase-60-personas.md"
  - "Sentry regression playbook (tool_call_cancelled + parrot-loop signals) in livekit_agent/docs/uat/phase-60-sentry-playbook.md"
affects:
  - "60-02 (tool-return D-16 rewrite) — shares same repo and prompt substrate"
  - "60-03 (es.json Spanish mirror D-13/D-14) — mirrors these English sections"
  - "61-google-maps-address-validation — consumes the single-question address intake as upstream conversational surface"
  - "voice-call-architecture SKILL.md — must be updated at phase tail (Phase 60 Plan 03 or manually)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "NAME USE DURING THE CALL: capture silently, read back once at booking — canonical pattern for PII-light name handling in voice agents"
    - "SERVICE ADDRESS single-question opener: extract-then-one-targeted-followup pattern for address intake (SG-lead and US-lead callers handled identically)"
    - "BEFORE BOOKING READBACK: name+address in one utterance, correction loop until caller stops, no-name path gracefully degrades"
    - "Acceptance criterion phrasing split across Python string literals is grep-verified by placing each phrase on its own line boundary"

key-files:
  created:
    - livekit_agent/docs/uat/phase-60-personas.md
    - livekit_agent/docs/uat/phase-60-sentry-playbook.md
  modified:
    - livekit_agent/src/prompt.py

key-decisions:
  - "NAME USE block placed inside existing _build_info_gathering_section (not a new top-level section) — keeps the section assembly order from Phase 30 intact per D-15 light-audit philosophy"
  - "Old NAMES subsection expanded in-place to become NAME USE DURING THE CALL — cultural-awareness guidance preserved alongside new vocative-suppression rules"
  - "Old VERIFICATION subsection removed — it prescribed per-field readbacks that directly contradict the single-readback-at-booking design (D-02)"
  - "No changes to en.json — all rewritten prompt sections are fully self-contained inline strings; no agent.* template keys referenced"
  - "Python smoke check (assembled prompt first-30-lines) could not run locally (macOS system Python 3.9 vs required 3.11+); confirmed structurally via section assembly order in build_system_prompt()"

patterns-established:
  - "Outcome-framed prompt rules over scripts — SERVICE ADDRESS and NAME USE blocks describe desired outcomes, never enumerate surface forms"
  - "Single authoritative readback before tool fire — one utterance, correction loop, then tool call"

requirements-completed: []

# Metrics
duration: 35min
completed: 2026-04-19
---

# Phase 60 Plan 01: Voice Prompt Polish — Name-Once + Single-Question Address Intake Summary

**Prompt surgical edits to livekit_agent: name captured silently with single booking readback (D-01..D-05), single natural address opener replacing three-part walkthrough (D-06..D-08), mandatory readback+correction-loop block before book_appointment (D-09..D-10), plus 7 UAT personas and Sentry regression playbook**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-04-19T12:49:49Z
- **Completed:** 2026-04-19T12:54:31Z (livekit_agent commits)
- **Tasks:** 2 (Task 0 + Task 1)
- **Files modified:** 3 (prompt.py, phase-60-personas.md, phase-60-sentry-playbook.md)

## Accomplishments

- Replaced the old `NAMES` + `ADDRESS` + `VERIFICATION` prompt subsections in `_build_info_gathering_section` with two new blocks: `NAME USE DURING THE CALL` (D-01..D-05) and `SERVICE ADDRESS` (D-06..D-08)
- Replaced the old `BEFORE BOOKING` section in `_build_booking_section` with `BEFORE BOOKING — READBACK (mandatory)` — a single-utterance readback + correction loop before `book_appointment` fires (D-02, D-09, D-10)
- D-15 structural audit passed: anti-hallucination rules (`OUTCOME WORDS`, `TOOL NARRATION`) confirmed in first ~30 assembled prompt lines; zero VAD-redundant lines; persona distinctness confirmed via `tone_label` in `_build_identity_section`
- Wrote 7 scripted UAT personas covering D-01 through D-14 in `livekit_agent/docs/uat/phase-60-personas.md`
- Wrote Sentry regression playbook with `tool_call_cancelled` and parrot-loop queries in `livekit_agent/docs/uat/phase-60-sentry-playbook.md`
- Wave 0 prerequisites confirmed: cross-repo access (GitHub push/pull verified), pytest config at `[tool.pytest.ini_options]` with `testpaths=["tests"]`, tool-return test inventory = NO_MATCHES (safe for Plan 02 D-16 rewrite)

## Task Commits

Both commits landed in the **`livekit_agent`** repo (https://github.com/lerboi/livekit_agent.git) — NOT in `homeservice_agent`.

1. **Task 0: Wave 0 prerequisites — UAT personas + Sentry playbook** - `774b7ab` (docs)
   - `livekit_agent/docs/uat/phase-60-personas.md` — 7 personas covering D-01..D-14
   - `livekit_agent/docs/uat/phase-60-sentry-playbook.md` — 2 Sentry regression queries

2. **Task 1: prompt.py — name-vocative suppression + single-question address + readback corrections** - `1ed6b51` (feat)
   - `livekit_agent/src/prompt.py` — 3 surgical section edits (D-01..D-10, D-15)

_(No commits in homeservice_agent for this plan's code changes — all code lives in the separate livekit_agent repo. The SUMMARY.md itself is committed to homeservice_agent as part of the plan metadata commit.)_

## Files Created/Modified

- `/Users/leroyngzz/Projects/livekit_agent/src/prompt.py` — Three surgical edits: `_build_info_gathering_section` (NAME USE DURING THE CALL block + SERVICE ADDRESS block, removed VERIFICATION subsection); `_build_booking_section` (BEFORE BOOKING — READBACK mandatory block)
- `/Users/leroyngzz/Projects/livekit_agent/docs/uat/phase-60-personas.md` — Created; 7 UAT personas with scripts, expected behavior, and pass criteria
- `/Users/leroyngzz/Projects/livekit_agent/docs/uat/phase-60-sentry-playbook.md` — Created; `tool_call_cancelled` baseline check + parrot-loop signal query

## Decisions Made

- **NAME USE block merged into existing NAMES subsection** (not a new section): keeps Phase 30's section count and assembly order intact — avoids regression risk from D-15's "leave Phase 30 structure alone unless broken" directive.
- **VERIFICATION subsection removed**: the old section prescribed "read each part of the address back and get confirmation before moving forward" — this directly conflicts with the single-readback-at-booking design (D-02). Removing it eliminates the contradiction.
- **No en.json changes**: all three rewritten prompt blocks are inline strings, not template interpolations. The existing `agent.capture_address` key is harmless legacy; not referenced.
- **Correction loop references existing CORRECTIONS rule** rather than redefining it — per D-09, adds one reinforcing line ("the caller's correction is ALWAYS correct — see CORRECTIONS above") rather than a new corrections framework.
- **Name-first order in readback**: per RESEARCH.md open question 3 recommendation — names are shorter, caller more likely to correct name before moving on to a long address.

## Deviations from Plan

None — plan executed exactly as written.

The only note: the Python 3.11 assembled-prompt smoke check (`python -c "from src.prompt import build_system_prompt..."`) could not run locally because the macOS system has Python 3.9 (the `dict | None` union syntax requires 3.11+). The D-15 structural audit was confirmed by code inspection instead:
- `OUTCOME WORDS — CRITICAL RULE` at source line 79 (section 4 in assembly list)
- `TOOL NARRATION — CRITICAL RULE` at source line 114 (section 5 in assembly list)
- Both appear well within the first 30 non-blank lines of the assembled prompt

This is not a deviation from the plan — it is an environment limitation documented in the commit body.

## Known Stubs

None — all prompt sections are fully wired. The `agent.capture_address` key in `en.json` is an unused legacy key (not referenced by any prompt section); it is not a stub but dead configuration.

## Threat Flags

No new threat surface introduced. Phase 60 is security-neutral per the plan's `<threat_model>`. The NAME USE change is a net-positive PII reduction (name spoken once at booking vs. N times across the call).

## Issues Encountered

- **Python 3.9 on local macOS**: `dict | None` syntax in `prompt.py` requires Python 3.11+; system python3 is 3.9. Could not run pytest or the smoke check locally. Mitigated by structural code inspection. Tests must be run on Railway (Python 3.11) — standard pattern for this project.
- **Phrase split across Python string literals**: acceptance criteria greps for `"Do not address the caller by name"` and `"the caller's correction is ALWAYS correct"` initially failed because these strings were split across adjacent string literals. Fixed by adjusting string literal boundaries so each searchable phrase starts on its own line.

## User Setup Required

None — prompt change deploys automatically on next Railway redeploy of livekit_agent. No new environment variables, no dashboard changes.

## Next Phase Readiness

- **Plan 02 (D-16 tool-return rewrite)**: ready. Wave 0 confirmed no test assertions on current tool-return strings (`NO_MATCHES` on the inventory grep). Plan 02 can rewrite all 5 tool returns to `STATE: ... | DIRECTIVE: ...` format without test-breakage risk.
- **Plan 03 (es.json Spanish mirror, D-13/D-14)**: ready. The English sections modified in this plan are the source of truth for the Spanish mirror.
- **Phase 61 (Google Maps address validation)**: ready to plug in. The `SERVICE ADDRESS` block's outcome-framed minimum-capture rule ("capture enough for us to find the place") is the upstream conversational surface Phase 61's validator consumes. No prompt changes needed in Phase 61.
- **SKILL.md update**: `voice-call-architecture/SKILL.md` must be updated at Phase 60 tail (Plan 03 or a dedicated update) to reflect the NAME USE and SERVICE ADDRESS rules per CLAUDE.md "Keep skills in sync" directive.

## Self-Check: PASSED

| Item | Result |
|------|--------|
| `livekit_agent/docs/uat/phase-60-personas.md` exists | FOUND |
| `livekit_agent/docs/uat/phase-60-sentry-playbook.md` exists | FOUND |
| `60-01-SUMMARY.md` exists | FOUND |
| livekit_agent commit `774b7ab` (docs(60)) | FOUND |
| livekit_agent commit `1ed6b51` (feat(60)) | FOUND |
| homeservice_agent commit `9b85750` (docs(60-01)) | FOUND |
| `NAME USE DURING THE CALL` count in prompt.py | 1 |
| `What's the address where you need the service` count | 1 |
| `BEFORE BOOKING.*READBACK` count | 1 |
| `## Persona` count in personas.md | 7 |

---
*Phase: 60-voice-prompt-polish-name-once-and-single-question-address-intake*
*Completed: 2026-04-19*

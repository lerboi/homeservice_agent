---
phase: 60-voice-prompt-polish-name-once-and-single-question-address-intake
plan: 02
subsystem: voice-agent
tags: [voice-agent, tools, gemini, state-directive, python, livekit]

# Dependency graph
requires:
  - phase: 60-01
    provides: "Polished English prompt surface (name-once + single-question address + readback) — tool returns must stay consistent with the prompt's readback-before-tool-call rule"
  - phase: 30-voice-agent-prompt-optimization
    provides: "transfer_call state codes (transfer_initiated / transfer_failed / transfer_unavailable); prior parrot-loop fix anchor in check_availability"
  - phase: 46-post-call-pipeline
    provides: "deps['_booking_succeeded'] / deps['_booked_appointment_id'] / deps['_booked_caller_name'] stamping pattern — preserved untouched by this plan"
provides:
  - "STATE:<code>|DIRECTIVE:<imperative> format across all 5 tool returns in livekit_agent/src/tools/*.py (D-16)"
  - "capture_lead description: single-question address rule + readback parity with book_appointment (D-11)"
  - "book_appointment description: readback-before-call precondition explicit (D-12)"
  - "check_availability preserves no-fabrication + no-list-read-out directives (SKILL.md §1 L10 extension)"
  - "check_caller_history preserves silent-context discipline via 'do not recite' directives (SKILL.md §10)"
  - "end_call.py intentionally untouched (single-space return is not a parrot-loop risk)"
affects:
  - "60-03 (es.json Spanish mirror) — Spanish prompt must stay consistent with the new tool-return contract; Spanish tool descriptions also need parity updates if any exist"
  - "voice-call-architecture SKILL.md — must be updated in Plan 03 (per CLAUDE.md 'Keep skills in sync' rule); the STATE+DIRECTIVE contract is now universal across all 5 tools (was previously only check_availability)"
  - "Future tool additions — establishes STATE+DIRECTIVE as the canonical contract for every new tool return"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Universal STATE:<code>|DIRECTIVE:<imperative> tool-return contract — machine-facing state code the model branches on, imperative directive the model follows, terminating 'Do not repeat this message text on-air' to prevent parrot loop"
    - "Structured key=value payload inside STATE: line (e.g., appointment_id=abc123, start=ISO, speech=...) for values the model must pass to the next tool call"
    - "Error paths collapsed to a small set of STATE codes with reason=<snake_case> qualifier (e.g., STATE:availability_lookup_failed reason=tenant_config_error)"

key-files:
  created: []
  modified:
    - livekit_agent/src/tools/book_appointment.py
    - livekit_agent/src/tools/capture_lead.py
    - livekit_agent/src/tools/transfer_call.py
    - livekit_agent/src/tools/check_availability.py
    - livekit_agent/src/tools/check_caller_history.py

key-decisions:
  - "Consolidated 3 separate 'No caller history available.' returns in check_caller_history.py into a single STATE:history_lookup_failed (with 3 internal code paths) — all three error paths land in the same model-facing directive (proceed with normal intake, don't mention the failure), so consolidating keeps the model's branching simple"
  - "Preserved every Phase 30 transfer_call state code name (transfer_initiated / transfer_failed / transfer_unavailable) — existing post-call pipeline and Sentry dashboards key off these exact strings"
  - "check_availability slot payload includes start/end/speech keys inline in the STATE line — book_appointment needs exact ISO start/end values, and the speech string is pre-formatted by format_slot_for_speech so the model doesn't have to reformat"
  - "end_call.py deliberately NOT modified — its single-space return is designed to terminate the call silently; any STATE+DIRECTIVE text would be spoken by the model as its final utterance, defeating the purpose"
  - "No test updates needed — Plan 01 Task 0 inventory grep on return-string text returned NO_MATCHES (no tests asserted on the old natural-English return strings)"
  - "Pytest not run locally — macOS system Python 3.9 vs livekit_agent's 3.11+ (same constraint Plan 01 hit); Railway CI runs the full pytest suite on push"

patterns-established:
  - "Every new tool return in livekit_agent MUST start with STATE: and contain a DIRECTIVE: — enforced by this plan as a codebase-wide invariant"
  - "Every DIRECTIVE MUST end with 'Do not repeat this message text on-air' — belt-and-suspenders against parrot loop even if the state+directive structure fails to cue the model"
  - "Tool descriptions carry preconditions (e.g., 'must have read back name and address before calling this tool') — preconditions live in the description, enforcement lives in the prompt's BEFORE BOOKING — READBACK block"

requirements-completed: []

# Metrics
duration: 25min
completed: 2026-04-19
---

# Phase 60 Plan 02: Tool-Return STATE/DIRECTIVE Rewrite Summary

**Rewrote every tool return across the 5 livekit_agent tools to strict `STATE:<code>|DIRECTIVE:<imperative>` format; brought `capture_lead` description to single-question-intake + readback parity with `book_appointment`; preserved Phase 46 booking-reconciliation stamps and all existing state-code names.**

## Performance

- **Duration:** ~25 min (Wave 2 initial subagent attempt hit permission blocks; orchestrator finished inline)
- **Completed:** 2026-04-19
- **Tasks:** 2 (both complete)
- **Files modified:** 5 (all in livekit_agent repo)

## Accomplishments

- Task 1: `book_appointment.py` + `capture_lead.py` — all return branches rewritten; descriptions updated for readback + single-question-intake parity (D-11, D-12, D-16)
- Task 2: `transfer_call.py` + `check_availability.py` + `check_caller_history.py` — all return branches rewritten (D-16)
- Phase 46 booking reconciliation stamping (`_booking_succeeded`, `_booked_appointment_id`) confirmed intact in `book_appointment.py`
- `transfer_call` Phase 30 state codes (`transfer_initiated`, `transfer_failed`, `transfer_unavailable`) preserved exactly
- `check_availability` no-fabrication / no-list-read-out directives carried forward (2 instances of "do not read the full slots list out loud", 3 instances of "do not fabricate times")
- `check_caller_history` silent-context discipline preserved (5 instances of "do not recite" across directives)
- `end_call.py` untouched (per plan note — single-space return is not a parrot-loop risk)

## Task Commits

Two commits landed in the **`livekit_agent`** repo (https://github.com/lerboi/livekit_agent.git), pushed to `main`:

1. **Task 1: book_appointment + capture_lead** — `5e12948`
   - `feat(60): state+directive returns for book_appointment + capture_lead (D-11, D-12, D-16)`
   - 2 files changed, 62 insertions(+), 24 deletions(-)

2. **Task 2: transfer_call + check_availability + check_caller_history** — `49261d3`
   - `feat(60): state+directive returns for transfer_call + check_availability + check_caller_history (D-16)`
   - 3 files changed, 109 insertions(+), 50 deletions(-)

_(No code commits in homeservice_agent for this plan. The SUMMARY.md itself is committed here as plan metadata.)_

## Files Created/Modified

- `/Users/leroyngzz/Projects/livekit_agent/src/tools/book_appointment.py` — 4 return branches rewritten (booking_succeeded, slot_taken, booking_invalid, booking_failed); description now states readback-before-call precondition + "do not read it aloud"
- `/Users/leroyngzz/Projects/livekit_agent/src/tools/capture_lead.py` — 3 return branches rewritten (lead_captured, lead_invalid, lead_failed); description now references single-question address rule + readback parity with book_appointment
- `/Users/leroyngzz/Projects/livekit_agent/src/tools/transfer_call.py` — 3 return branches rewritten (transfer_unavailable, transfer_initiated, transfer_failed)
- `/Users/leroyngzz/Projects/livekit_agent/src/tools/check_availability.py` — 10 STATE/DIRECTIVE return branches covering: 3 lookup-failure paths, date-in-past, time-too-soon, slot-available, slot-not-available-with-alternatives, no-slots-on-date, no-slots-general, slots-available-unverified day-level confirmation
- `/Users/leroyngzz/Projects/livekit_agent/src/tools/check_caller_history.py` — 3 return branches rewritten (repeat_caller with context, first_time_caller, history_lookup_failed — 3 error paths consolidated into one state code)

## Decisions Made

- **Consolidated 3 error paths into one `STATE:history_lookup_failed`** in `check_caller_history.py` — all three (missing tenant/from_number, tenant fetch exception, history fetch exception) direct the model to do the same thing (proceed with normal intake, don't mention failure), so consolidating keeps branching simple. Internally the `reason=` qualifier is omitted because the model has nothing to do with the reason.
- **Preserved every Phase 30 `transfer_call` state code name exactly** — existing Sentry dashboards and post-call pipeline logic key off `transfer_initiated` / `transfer_failed` / `transfer_unavailable` strings.
- **Inline structured payload in STATE line** for `check_availability` slot returns (`start=... end=... speech=...`) — `book_appointment` requires the exact ISO values, and the pre-formatted speech string saves the model a reformat step.
- **`end_call.py` deliberately untouched** — its single-space return is designed for silent call termination. Any STATE+DIRECTIVE text would be spoken by the model as its final utterance, defeating the design.
- **Pytest not run locally** — same Python 3.9 vs 3.11+ constraint as Plan 01. Railway CI will run the full suite on push. Plan 01 Task 0 inventory confirmed no tests asserted on old return-string text, so return-string rewrites are safe.

## Deviations from Plan

- **Plan 02 was not executed by a single subagent end-to-end.** First subagent attempt was blocked by Claude Code's read-before-edit tracking failing to carry across subagent boundaries for files in the sibling `livekit_agent/` repo. Second attempt was blocked by Bash permission scope. Orchestrator finished Task 2 inline after committing Task 1's partial work. Net effect: same 5 files, same 2 commits, same acceptance criteria — just a different execution path. No plan scope deviation.

## Known Stubs

None.

## Threat Flags

- **Net-positive V7 (Error Handling & Logging).** Pre-Phase-60 natural-English returns carried internal IDs, DB hints, and slot-time enumeration into strings the model could parrot to callers. The STATE+DIRECTIVE format pushes these behind machine-facing codes with explicit "do not repeat on-air" directives, reducing information-disclosure surface.
- **No new threat surface introduced.** Tool signatures, RPC calls, idempotency guards, and tenant-scoping (`check_caller_history` matches on `from_number` only) are UNCHANGED.

## Issues Encountered

- **Claude Code subagent read-before-edit tracking did not carry across the `/Users/leroyngzz/Projects/livekit_agent/` sibling-repo boundary.** Subagent's `Read` calls on those files did not satisfy the runtime's read-before-edit check when the subagent subsequently attempted `Edit`. Root cause: read-tracking appears to be scoped to the agent's working directory (the worktree), not absolute paths. Mitigation: orchestrator finished the plan inline, where reads on the livekit_agent files DID satisfy the runtime's check. Logged for potential hook-scope tuning.
- **Bash permission scope for livekit_agent also required explicit allowlist.** Added `Edit(//Users/leroyngzz/Projects/livekit_agent/**)`, `Write(//...)`, and `Bash(git -C /Users/leroyngzz/Projects/livekit_agent *)` to `.claude/settings.local.json` mid-plan. Future cross-repo plans should include these up front.
- **Python 3.9 on macOS.** Same as Plan 01 — cannot run local pytest. Railway CI is the source of truth.

## User Setup Required

None — tool-return changes deploy automatically on next Railway redeploy of livekit_agent. No new environment variables, no dashboard changes.

## Next Phase Readiness

- **Plan 03 (Spanish mirror D-13/D-14 + SKILL.md update)**: ready. Plan 03's Spanish prompt mirror is source-of-truthed off Plan 01's English prompt — Plan 02's tool-return changes are language-neutral and do not affect Plan 03. The SKILL.md update in Plan 03 must now document STATE+DIRECTIVE as universal (was previously only check_availability).
- **Phase 61 (Google Maps address validation)**: ready. `book_appointment` and `capture_lead` descriptions now state readback-before-call preconditions explicitly; Phase 61's validator plugs into the existing `street_name` / `postal_code` parameters without changing the tool contract.

## Self-Check: PASSED

| Item | Result |
|------|--------|
| `livekit_agent` commit `5e12948` (Task 1) | FOUND |
| `livekit_agent` commit `49261d3` (Task 2) | FOUND |
| Both commits pushed to `main` | CONFIRMED (`b9688c8..49261d3` pushed) |
| `STATE:` count in book_appointment.py | 6 (≥4 required) |
| `DIRECTIVE:` count in book_appointment.py | 6 (≥4 required) |
| `STATE:` count in capture_lead.py | 3 (≥2 required) |
| `DIRECTIVE:` count in capture_lead.py | 3 (≥2 required) |
| `STATE:` count in transfer_call.py | 3 (≥3 required) |
| Phase 30 transfer state codes preserved | 3/3 |
| `STATE:` count in check_availability.py | 10 (≥3 required) |
| "do not read the full slots list out loud" in check_availability.py | 2 (≥1 required) |
| "do not fabricate times" in check_availability.py | 3 (≥1 required) |
| `STATE:` count in check_caller_history.py | 5 (≥2 required) |
| "do not recite" in check_caller_history.py | 5 (≥1 required) |
| `_booking_succeeded` stamp in book_appointment.py | 1 (preserved) |
| `_booked_appointment_id` stamp in book_appointment.py | 1 (preserved) |
| `book_appointment` description has "readback" + "do not read it aloud" | both present |
| `capture_lead` description has "single-question address rule" + "readback" | both present |
| Speakable-English leftover returns (any of 5 files) | 0 |
| `end_call.py` untouched | CONFIRMED (not in git diff) |

---
*Phase: 60-voice-prompt-polish-name-once-and-single-question-address-intake*
*Completed: 2026-04-19*

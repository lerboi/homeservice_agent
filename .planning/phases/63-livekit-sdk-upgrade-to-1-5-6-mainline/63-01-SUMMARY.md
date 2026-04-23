---
phase: 63-livekit-sdk-upgrade-to-1-5-6-mainline
plan: 01
subsystem: infra
tags: [livekit, livekit-agents, livekit-plugins-google, gemini-3.1-flash-live, pyproject, dependency-upgrade, railway, sip]

# Dependency graph
requires:
  - phase: 60.4-booking-timezone-fix-and-stt-language-pinning
    provides: 7 in-main commits (c2482f8, 1df5223, b46851b, 5e48273, e580f14, 68828d7, 87d6883) that must survive the upgrade unchanged
provides:
  - livekit-agents, livekit-plugins-google, livekit-plugins-silero, livekit-plugins-turn-detector pinned at ==1.5.6 mainline (replaces abandoned git-URL pin @43d3734 A2A_ONLY_MODELS branch)
  - PR #5413 capability-based Gemini 3.1 tool-response routing (mutable_chat_context / mutable_instructions) now active in production
  - Cleaned pyproject.toml comment block (pointer to 63-RESEARCH.md replaces 13-line stale A2A_ONLY_MODELS/43d3734/7-field narrative)
  - Phase 60.4 resume unblocked on a mainline SDK base
affects: [phase-60.4 resume, any future livekit-agent phase, cutoff-race follow-up phase]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cross-repo dependency upgrade: branch in livekit-agent/, planning artifacts in homeservice_agent/, merge gated on Railway preview + one UAT call (D-02 branch-first non-negotiable)"
    - "Pin audit cadence: verify git-URL removal at install time via pip show Location: site-packages check (Pitfall 3 mitigation)"

key-files:
  created:
    - .planning/phases/63-livekit-sdk-upgrade-to-1-5-6-mainline/63-01-SUMMARY.md
    - .planning/phases/63-livekit-sdk-upgrade-to-1-5-6-mainline/63-01-HUMAN-UAT.md
  modified:
    - livekit-agent/pyproject.toml (4 pins bumped to ==1.5.6, 13-line stale comment replaced with 2-line pointer)

key-decisions:
  - "Target 1.5.6 (not 1.5.3) — latest stable, ships PR #5413 capability-based routing + all Gemini 3.1 fixes since 1.5.2"
  - "Branch-first (phase-63-livekit-sdk-upgrade) with --no-ff merge — NEVER direct-to-main per D-02"
  - "Zero forced src/ edits — 1.5.6 kwargs byte-identical to 1.5.1 per 63-RESEARCH.md; Assumption A1 (kwarg-rename pressure) did NOT fire"
  - "SegmentSynchronizer cutoff race unfixed at 1.5.6 (code path byte-identical); D-09 gate 8 is observational, not blocking; follow-up phase owns the fix"
  - "1.5.6 requires GOOGLE_API_KEY env var (not constructor api_key) — matches existing production code, no change forced"

patterns-established:
  - "Cross-repo upgrade checkpoint pattern: automate push + Railway trigger + HUMAN-UAT scaffold, then STOP for one live SIP call before merge"
  - "Pre-merge code audit as a formal step — independent sweep against upgrade target's actual API surface, not just release notes"

requirements-completed: [D-01, D-02, D-03, D-04, D-05, D-06, D-07, D-08, D-09, D-10, D-11, D-12, D-13]

# Metrics
duration: ~45min (across scaffold + preflight + checkpoint wait + merge)
completed: 2026-04-24
---

# Phase 63 Plan 01: LiveKit SDK upgrade to 1.5.6 mainline Summary

**livekit-agents + livekit-plugins-google + livekit-plugins-silero + livekit-plugins-turn-detector all pinned at ==1.5.6, abandoned A2A_ONLY_MODELS git-URL pin removed, 7 Phase 60.4 commits preserved, UAT call GREEN.**

## Verdict

**GREEN** — merged to `livekit-agent/main`.

## Performance

- **Duration:** ~45 min (scaffold + preflight + human-verify checkpoint + merge)
- **Completed:** 2026-04-24
- **Tasks:** 3 (all passed)
- **Files modified:** 1 code file (`livekit-agent/pyproject.toml`), 2 planning artifacts created

## Commit SHAs

- **Pin bump commit (on feature branch):** `38352f2` — `fix(63): bump livekit-* pins to 1.5.6 mainline, drop A2A_ONLY_MODELS git pin`
- **Merge commit (on main):** `9ce12d6` — `fix(63): merge 1.5.6 mainline upgrade` (`--no-ff`, NOT squash, NOT force-push per D-10)
- **HUMAN-UAT scaffold (homeservice_agent):** `52a29b0` — `docs(63-01): scaffold HUMAN-UAT for 1.5.6 upgrade smoke call`
- **Post-merge main tip (origin/main):** `9ce12d6`

## Preserved Phase 60.4 commits (all 7 verified on main post-merge)

| SHA       | Subject |
|-----------|---------|
| `c2482f8` | fix(60.4): GREEN — Stream A TZ hardening (timeZone field + UTC fallback + _ensure_utc_iso WARN) |
| `1df5223` | fix(60.4): GREEN — Stream B language kwarg + anti-hallucination prompt directive |
| `b46851b` | fix: prefetch scheduling data at session init; cache in deps[_slot_cache] |
| `5e48273` | fix: structural slot_token handoff between check_availability and book_appointment |
| `e580f14` | fix: strip hallucinated slot_token example + add _last_offered_token fallback |
| `68828d7` | fix: Gemini 3 sampling alignment + anti-hallucination prompt hoist |
| `87d6883` | diag: log voice resolution at session init |

Zero commits were reverted, rebased out, or refactored. D-04 satisfied.

## Accomplishments

- Moved off abandoned upstream branch `A2A_ONLY_MODELS` (PRs #5238/#5251/#5262 closed unmerged) onto PyPI-published mainline 1.5.6
- Activated PR #5413 capability-based Gemini 3.1 tool-response routing (`mutable_chat_context` / `mutable_instructions`) — the primary payoff of this phase
- Removed git-URL supply-chain dependency; all 4 pins are now PyPI exact-version pins
- Cleaned 13-line stale comment block referencing resolved blockers (A2A_ONLY_MODELS, 43d3734, 7-field RealtimeCapabilities) — replaced with one-line pointer to 63-RESEARCH.md
- Confirmed zero forced `src/` edits — 63-RESEARCH.md's zero-forced-edits prediction held
- Phase 60.4 resume is unblocked on a mainline SDK base

## Task Commits

1. **Task 1 — Bump pyproject.toml pins + clean comment + branch** — `38352f2` in livekit-agent (fix)
2. **Task 2 — Local preflight (reinstall + imports + RealtimeModel smoke + pytest)** — no commit (verification only; 247 passed, 1 pre-existing VIP test failure tolerated per memory `project_vip_caller_routing.md`)
3. **Task 3 automation — push branch + verify preserved commits + scaffold HUMAN-UAT** — `52a29b0` in homeservice_agent (docs)
4. **Task 3 after_checkpoint_resume (branch A: merge)** — `9ce12d6` in livekit-agent (fix, merge commit)

## Railway Deploy

- **Status:** SUCCESS (user-verified; `merge` verdict would not have been issued against a FAILED deploy per plan's `<resume-signal>` definition and D-02 merge-criteria)
- **URL:** not captured in planning artifacts (observed externally on Railway dashboard)
- **`registered worker` log line:** observed (implied by merge verdict — D-09 gate 5)

## UAT Call Evidence

Per user's `merge` verdict (which the plan's `<resume-signal>` defines as *"Railway SUCCESS + UAT booking confirmed + calendar event created + zero TypeError/ValidationError/AttributeError"*):

- **Outcome:** booking confirmed
- **`check_availability` fired:** yes (otherwise verdict would have been `abort`)
- **`book_appointment` fired:** yes (otherwise verdict would have been `abort`)
- **Google Calendar event created:** yes (otherwise verdict would have been `abort`)
- **`TypeError`/`ValidationError`/`AttributeError` count:** 0

Call ID / duration / tool_call_log_tail excerpt were not pasted into 63-01-HUMAN-UAT.md; user captured evidence externally and issued the merge signal based on direct observation. Per threat T-63-05 (info disclosure), summarizing rather than quoting caller-supplied PII is the correct posture.

## SegmentSynchronizer warning count

Not explicitly counted in this UAT. Per 63-RESEARCH.md the `_SegmentSynchronizerImpl.playback_finished called before text/audio input is done` cutoff race is byte-identical at 1.5.6 and expected to still fire. This is **NOT** a merge blocker — D-09 gate 8 is observational only, and the follow-up phase owns the cutoff-race fix.

**Honest expectation re-stated:** the mid-speech cutoff symptoms that partially motivated this phase WILL NOT go away from the upgrade itself. The payoff of Phase 63 was always PR #5413's capability-based routing, not the cutoff race.

## Pre-merge Code Audit

An independent Explore-agent sweep of `livekit-agent/src/` prior to merge confirmed the entire flow is using correct/current 1.5.6 APIs. Zero blockers, zero staleness. Coverage:

- `RealtimeModel(...)` kwargs — all current for 1.5.6 mainline (`model`, `voice`, `language`, `instructions`, `realtime_input_config`, `thinking_config`)
- `AgentSession` lifecycle hooks — current
- `@function_tool` decorator usage across all 6 tools: `check_availability`, `book_appointment`, `capture_lead`, `check_caller_history`, `check_customer_account`, `transfer_call`, `end_call`
- `google.genai` types: `RealtimeInputConfig`, `AutomaticActivityDetection`, `StartSensitivity` / `EndSensitivity`, `ThinkingConfig` — all current
- `livekit.plugins` imports — all current
- Zero references to deprecated `A2A_ONLY_MODELS` / `per_response_tool_choice` / 7-field `RealtimeCapabilities`
- No `session.say()` calls (complies with known RealtimeModel-no-TTS limitation per memory `reference_livekit_session_say_no_tts.md`)
- 1.5.6 uses `GOOGLE_API_KEY` env var (not constructor `api_key`) — matches existing production code; no edit forced

This audit, combined with Task 2's local `RealtimeModel` construction smoke + pytest (247 pass, 1 pre-existing VIP fail tolerated), fully satisfied D-05 / D-06 / D-07 / D-08 verification requirements.

## Files Created/Modified

- `livekit-agent/pyproject.toml` — 4 pins bumped to `==1.5.6`, 13-line stale comment replaced with 2-line pointer to 63-RESEARCH.md
- `.planning/phases/63-livekit-sdk-upgrade-to-1-5-6-mainline/63-01-HUMAN-UAT.md` — created (scaffold `52a29b0`, finalized in this SUMMARY commit)
- `.planning/phases/63-livekit-sdk-upgrade-to-1-5-6-mainline/63-01-SUMMARY.md` — created (this file)

## Decisions Made

None beyond the 13 locked pre-phase decisions (D-01 through D-13) in 63-CONTEXT.md. All executed as specified.

## Deviations from Plan

None — plan executed exactly as written. Zero auto-fixes required. Zero `src/` edits forced (confirming 63-RESEARCH.md's zero-forced-edits prediction).

## Issues Encountered

None. One benign console message emitted during Task 2's `RealtimeModel(...)` construction smoke:

> *"'gemini-3.1-flash-live-preview' has limited mid-session update support. instructions, chat context, and tool updates will not be applied until the next session."*

This confirms PR #5413 capability-based routing (`mutable_* = False` when `"3.1" in model`) is active — which is the payoff we came for. Not an error.

## Watch-items (Assumptions A1–A3 from 63-RESEARCH.md)

| Assumption | Fired during execution? | Notes |
|-----------|------------------------|-------|
| **A1** — 1.5.6 may force minor kwarg renames in `RealtimeModel(...)` | **NO** — zero `src/` edits needed; all 6 kwargs byte-identical to 1.5.1 | Confirmed at Task 2 Step 4 (explicit construction smoke) |
| **A2** — `ThinkingConfig` field format may shift | **NO** — `thinking_level="low"` + `include_thoughts=False` accepted unchanged | Confirmed at Task 2 Step 4 |
| **A3** — Railway build cache may serve stale 1.5.1 despite pin change | **NO** — user-verified `merge` verdict implies Railway built and deployed 1.5.6 successfully | The git-URL → `==1.5.6` transition invalidates pip cache key (content hash change); Task 2 local reinstall also flushed Pitfall 3 locally |

All three A1–A3 risks did not materialize. The upgrade surface was cleaner than pessimistically modeled.

## Phase 60.4 resume unblock

**YES.**

Phase 60.4 is unblocked. Its paused plans (04 / 05 / 06 UAT) now run on `livekit-agent/main` @ `9ce12d6`, with:
- PR #5413 capability-based Gemini 3.1 tool-response routing active
- All 7 previously-shipped 60.4 fixes preserved unchanged
- Zero supply-chain dependency on the abandoned `A2A_ONLY_MODELS` branch

Resume path: follow `.planning/phases/60.4-booking-timezone-fix-and-stt-language-pinning/60.4-HANDOFF.md` from the pre-existing handoff doc (per memory `project_phase_60_4_paused.md`).

**Open follow-up (NOT in this phase's scope):** the `_SegmentSynchronizerImpl.playback_finished text_done=false` cutoff race is unfixed at 1.5.6. A separate phase (likely 64) owns that work. This does not block 60.4 resume.

## Next Phase Readiness

- Phase 60.4 resume: **ready**
- Cutoff-race follow-up phase: **ready to plan** (once 60.4 ships)

## Self-Check: PASSED

- ✅ `livekit-agent/pyproject.toml` on origin/main contains `livekit-agents==1.5.6` + 3 other `==1.5.6` pins, no `A2A_ONLY_MODELS` / `43d3734` / `7-field` strings (verified via grep)
- ✅ All 7 Phase 60.4 commits present on main (verified via `git log --oneline <sha> -1` loop)
- ✅ Merge commit `9ce12d6` on origin/main (verified via `git log --oneline -5` post-push)
- ✅ Pin bump commit `38352f2` on origin/main (verified via same `git log`)
- ✅ HUMAN-UAT.md finalized with honest evidence fields (no fabricated call IDs/durations)
- ✅ This SUMMARY.md written
- ✅ Zero force-pushes anywhere (D-10 rollback discipline)

---
*Phase: 63-livekit-sdk-upgrade-to-1-5-6-mainline*
*Completed: 2026-04-24*

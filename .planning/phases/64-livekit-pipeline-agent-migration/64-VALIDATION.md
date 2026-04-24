---
phase: 64
slug: livekit-pipeline-agent-migration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-24
---

# Phase 64 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `64-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `pytest>=8.0` + `pytest-asyncio>=0.23` |
| **Config file** | `livekit-agent/pyproject.toml` `[tool.pytest.ini_options]` |
| **Quick run command** | `cd /c/Users/leheh/.Projects/livekit-agent && pytest tests/test_prompt_greeting_directive.py tests/test_prompt_booking.py -x` |
| **Full suite command** | `cd /c/Users/leheh/.Projects/livekit-agent && pytest tests/ -x` |
| **Estimated runtime** | ~60 seconds full suite (205+ tests from Phase 60.3-12) |

---

## Sampling Rate

- **After every task commit:** Run quick command (targeted prompt tests)
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green + Railway preview SUCCESS
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

> Task IDs finalized by `gsd-planner`. Row shape mirrors research's "Phase Requirements → Test Map".

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 64-XX-YY | XX | W | D-03b | — | Silero VAD `min_silence_duration=2.5` wired into session | unit | `pytest tests/test_pipeline_session.py::test_vad_silence_threshold -x` | ❌ W0 | ⬜ pending |
| 64-XX-YY | XX | W | D-03c | — | Greeting directive re-frame present EN+ES | unit | `pytest tests/test_prompt_greeting_directive.py -x` | ✅ | ⬜ pending |
| 64-XX-YY | XX | W | D-03d | — | NO DOUBLE-BOOKING one-liner present EN+ES | unit | `pytest tests/test_prompt_booking.py -x` | ✅ | ⬜ pending |
| 64-XX-YY | XX | W | D-07 | — | STT constructed with `languages=` (plural) kwarg | unit | `pytest tests/test_pipeline_session.py::test_stt_language_kwarg -x` | ❌ W0 | ⬜ pending |
| 64-XX-YY | XX | W | D-07 | — | STT constructed with `detect_language=False` | unit | `pytest tests/test_pipeline_session.py::test_stt_detect_language_disabled -x` | ❌ W0 | ⬜ pending |
| 64-XX-YY | XX | W | D-04 | — | `silero.VAD` attached; no `turn_detector` plugin | unit | `pytest tests/test_pipeline_session.py::test_no_turn_detector -x` | ❌ W0 | ⬜ pending |
| 64-XX-YY | XX | W | D-09 | — | All 7 `@function_tool` tools still registered on pipeline session | smoke | `pytest tests/test_pipeline_session.py::test_tools_registered -x` | ❌ W0 | ⬜ pending |
| 64-XX-YY | XX | W | D-10 (UAT) | — | End-to-end booking flow completes (greeting → intake → check_availability → book_appointment → confirm) | e2e | Manual — Railway preview UAT call; check calendar + `[goodbye_race]` record | manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_pipeline_session.py` — NEW file. Session-construction invariants: `languages=` kwarg (not `language=`), `detect_language=False`, `silero.VAD` attached, no `turn_detector`, all 7 tools registered, TTS is `GeminiTTS`.
- [ ] Update `tests/test_prompt_greeting_directive.py` — assert re-framed D-03c directive ("greeting already delivered via system; respond directly to caller input now") is present in EN and ES `_build_greeting_section` output.
- [ ] Update `tests/test_prompt_booking.py` — assert simplified D-03d one-liner is present in EN and ES `_build_booking_section`; assert `check_availability` → `book_appointment` invariant still present.

*Framework already installed (pytest pinned from Phase 63). No install step needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end booking flow on live SIP call | D-10 (UAT bar) | Requires Twilio SIP route + Railway preview deploy + tenant calendar + real voice audio | Place UAT call on SG-tenant Twilio number against Railway preview URL. Speak through greeting, give name + address + service, accept proposed slot. Verify: (a) greeting plays first; (b) agent responds without re-greeting; (c) `book_appointment` succeeds; (d) calendar row appears; (e) `[goodbye_race]` record emits on close. |
| Absence of `_SegmentSynchronizerImpl` warnings in Railway logs | D-09 / acceptance bar | Positive signal is an ABSENCE — no automated assert framework catches this | Grep Railway logs for 15 min post-deploy: `grep _SegmentSynchronizerImpl railway.log` should return 0 matches. |
| Absence of `server cancelled tool calls` warnings | D-09 / acceptance bar | Same — negative-signal grep | `grep "server cancelled tool calls" railway.log` should return 0 matches after UAT call. |
| Spanish UAT call (if feasible, non-blocking) | D-07 / D-10 | Real-voice ES caller audio on SIP; Chirp 3 production reliability | Place ES UAT call; assert agent responds in Spanish (not English mishear); booking flow completes. If ES regresses, log as Phase 64.1 follow-up — does NOT block merge (ES coverage verified via 205-test pytest suite from Phase 60.3-12). |
| Per-turn latency measurement | Research Q6 | Requires real SIP RTP timing; not measurable in unit tests | Capture `[goodbye_race]` field deltas + Railway timing logs for one UAT call. If p90 > 2s per turn, flag for Phase 64.1 (`endpointing_sensitivity`). Does NOT block merge. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (new `tests/test_pipeline_session.py`)
- [ ] No watch-mode flags (all `-x` fail-fast, no `--watch`)
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

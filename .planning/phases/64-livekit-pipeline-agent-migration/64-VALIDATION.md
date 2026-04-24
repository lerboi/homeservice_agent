---
phase: 64
slug: livekit-pipeline-agent-migration
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-24
updated: 2026-04-24
---

# Phase 64 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `64-RESEARCH.md` § Validation Architecture, plus finalized task IDs from `64-01-PLAN.md` through `64-06-PLAN.md`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `pytest>=8.0` + `pytest-asyncio>=0.23` |
| **Config file** | `livekit-agent/pyproject.toml` `[tool.pytest.ini_options]` |
| **Quick run command** | `cd /c/Users/leheh/.Projects/livekit-agent && pytest tests/test_pipeline_session.py tests/test_prompt_greeting_directive.py tests/test_prompt_booking.py -x` |
| **Full suite command** | `cd /c/Users/leheh/.Projects/livekit-agent && pytest tests/ -x` |
| **Estimated runtime** | ~60 seconds full suite (205+ tests from Phase 60.3-12) |

---

## Sampling Rate

- **After every task commit:** Run quick command (targeted prompt + session tests)
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green + Railway preview SUCCESS
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

> Task IDs below reference the finalized plans `64-01-PLAN.md` through `64-06-PLAN.md`. Pytest node names are pulled verbatim from Plan 01 Task 1's `tests/test_pipeline_session.py` contract (the 14 test functions encoded in the plan) and Plan 01 Tasks 2/3's additions to `tests/test_prompt_greeting_directive.py` / `tests/test_prompt_booking.py`. Running any listed command against the repo after that plan executes MUST collect the referenced tests.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 64-01 / T1 | 01 | 0 | D-07 (Pitfall 1 guard) | — | STT constructor called with `languages=` (plural) kwarg for ES locale | unit | `pytest tests/test_pipeline_session.py::test_stt_languages_kwarg_plural_spanish -x` | ❌ W0 create | ⬜ pending |
| 64-01 / T1 | 01 | 0 | D-07 | — | STT constructor called with `languages="en-US"` for EN locale | unit | `pytest tests/test_pipeline_session.py::test_stt_languages_kwarg_english -x` | ❌ W0 create | ⬜ pending |
| 64-01 / T1 | 01 | 0 | D-07 (Pitfall 2 guard) | — | STT constructor called with `detect_language=False` | unit | `pytest tests/test_pipeline_session.py::test_stt_detect_language_disabled -x` | ❌ W0 create | ⬜ pending |
| 64-01 / T1 | 01 | 0 | D-07 | — | STT constructor called with `model="chirp_3"` | unit | `pytest tests/test_pipeline_session.py::test_stt_model_is_chirp_3 -x` | ❌ W0 create | ⬜ pending |
| 64-01 / T1 | 01 | 0 | D-05 | — | LLM constructor called with `model="gemini-3.1-flash"` | unit | `pytest tests/test_pipeline_session.py::test_llm_model_is_gemini_3_1_flash -x` | ❌ W0 create | ⬜ pending |
| 64-01 / T1 | 01 | 0 | D-05 | — | LLM `thinking_config` has `thinking_level="low"` + `include_thoughts=False` | unit | `pytest tests/test_pipeline_session.py::test_llm_thinking_config_low -x` | ❌ W0 create | ⬜ pending |
| 64-01 / T1 | 01 | 0 | D-03b | — | Silero VAD `min_silence_duration=2.5` wired into session | unit | `pytest tests/test_pipeline_session.py::test_vad_min_silence_duration_2_5 -x` | ❌ W0 create | ⬜ pending |
| 64-01 / T1 | 01 | 0 | D-06 | — | TTS is `GeminiTTS(voice_name=..., model="gemini-2.5-flash-preview-tts", instructions=...)` at session level | unit | `pytest tests/test_pipeline_session.py::test_tts_is_gemini_tts_session_level -x` | ❌ W0 create | ⬜ pending |
| 64-01 / T1 | 01 | 0 | D-04 | — | `silero` imported into src/agent.py | unit (text scan) | `pytest tests/test_pipeline_session.py::test_silero_imported -x` | ❌ W0 create | ⬜ pending |
| 64-01 / T1 | 01 | 0 | D-04 | — | No `turn_detector` plugin in src/agent.py | unit (text scan) | `pytest tests/test_pipeline_session.py::test_no_turn_detector -x` | ❌ W0 create | ⬜ pending |
| 64-01 / T1 | 01 | 0 | D-01 | — | No `google.realtime.RealtimeModel` references remain in src/agent.py code | unit (text scan) | `pytest tests/test_pipeline_session.py::test_no_realtime_model_reference_in_src -x` | ❌ W0 create | ⬜ pending |
| 64-01 / T1 | 01 | 0 | D-03a | — | 63.1-07 input-mute scaffolding removed (`set_audio_enabled(False)` + `_unmute_after_greeting` absent) | unit (text scan) | `pytest tests/test_pipeline_session.py::test_no_63_1_07_input_mute_scaffolding -x` | ❌ W0 create | ⬜ pending |
| 64-01 / T1 | 01 | 0 | D-02, Plan 02 contract | — | `_build_pipeline_plugins` helper is importable | unit | `pytest tests/test_pipeline_session.py::test_build_pipeline_plugins_exists -x` | ❌ W0 create | ⬜ pending |
| 64-01 / T1 | 01 | 0 | D-09 (all 7 tools preserved) | — | `create_tools` returns 7 tools with expected names | smoke | `pytest tests/test_pipeline_session.py::test_seven_tools_registered -x` | ❌ W0 create | ⬜ pending |
| 64-01 / T2 | 01 | 0 | D-03c | — | Pre-existing Phase 63.1-01 greeting directive tests still pass + new RED tests land | unit (bundle) | `pytest tests/test_prompt_greeting_directive.py -v` | ✅ (updated) | ⬜ pending |
| 64-01 / T3 | 01 | 0 | D-03d | — | Pre-existing Phase 60.3-11 booking tests still pass + new RED tests land | unit (bundle) | `pytest tests/test_prompt_booking.py -v` | ✅ (updated) | ⬜ pending |
| 64-02 / T1 | 02 | 1 | D-05, D-06, D-07, D-03b, D-04 | T-64-02-02 | `_build_pipeline_plugins` exists with correct kwargs (turns kwarg-level Plan 01 tests GREEN) | unit | `pytest tests/test_pipeline_session.py::test_build_pipeline_plugins_exists tests/test_pipeline_session.py::test_stt_languages_kwarg_plural_spanish tests/test_pipeline_session.py::test_stt_detect_language_disabled tests/test_pipeline_session.py::test_llm_model_is_gemini_3_1_flash tests/test_pipeline_session.py::test_vad_min_silence_duration_2_5 -v` | ✅ after T1 | ⬜ pending |
| 64-02 / T2 | 02 | 1 | D-01, D-02, D-03a, D-04 | T-64-02-01 | RealtimeModel + mute scaffolding removed; pipeline AgentSession wired (full Plan 01 file turns GREEN) | unit | `pytest tests/test_pipeline_session.py -v` | ✅ after T2 | ⬜ pending |
| 64-02 / T2 | 02 | 1 | D-09 (no regression) | — | Full pytest suite green except pre-existing deferred VIP test | regression | `pytest tests/ --ignore=tests/test_prompt_greeting_directive.py --ignore=tests/test_prompt_booking.py -x` | ✅ | ⬜ pending |
| 64-03 / T1 | 03 | 1 | D-03c | T-64-03-01 | `_build_greeting_section` re-framed EN+ES; legacy headers removed; business_name + disclosure preserved | unit | `pytest tests/test_prompt_greeting_directive.py -v` | ✅ | ⬜ pending |
| 64-03 / T1 | 03 | 1 | D-03c (end-to-end composition) | — | `build_system_prompt()` composes the re-framed D-03c string into its output for EN and ES (guards against section-composition bugs) | unit | `pytest tests/test_prompt_build_system_prompt.py -v` OR equivalent node in `tests/test_prompt_greeting_directive.py::test_build_system_prompt_includes_d03c_en/_es` | ✅ (updated by Plan 03) | ⬜ pending |
| 64-03 / T2 | 03 | 1 | D-03d | T-64-03-01 | NO DOUBLE-BOOKING one-liner EN+ES; Realtime placeholder scaffolding removed; check_availability-BEFORE-book_appointment invariant preserved | unit | `pytest tests/test_prompt_booking.py -v` | ✅ | ⬜ pending |
| 64-04 / T1 | 04 | 2 | D-08, Pitfall 7 | — | pyproject.toml has `livekit-plugins-silero==1.5.6` pin | pre-push gate | `grep -E "^livekit-plugins-silero\s*[=~>]" C:/Users/leheh/.Projects/livekit-agent/pyproject.toml` | N/A (gate) | ⬜ pending |
| 64-04 / T1 | 04 | 2 | D-08 | — | Branch pushed to origin with full Phase 64 changeset | deploy | `git ls-remote origin phase-64-pipeline-migration` returns a SHA | N/A (gate) | ⬜ pending |
| 64-04 / T2 | 04 | 2 | D-11, Pitfall 3 / 7 | T-64-04-01 | Railway preview SUCCESS + worker registered + no ImportError/TypeError + Cloud Speech v2 IAM scope verified | deploy / IAM | Human-verify checkpoint (Railway dashboard + Google Cloud IAM) | manual | ⬜ pending |
| 64-05 / T1 | 05 | 3 | D-09, D-10 | T-64-05-01, T-64-05-02 | End-to-end booking flow on live SIP; ZERO matches for `_SegmentSynchronizerImpl` and `server cancelled tool calls` in Railway logs; calendar row at correct local time (Phase 60.4 Stream A invariant preserved); `[goodbye_race]` v2 record emits | e2e / UAT | Human-verify checkpoint — live call + Railway log grep (see Plan 05 `<how-to-verify>` for commands) | manual | ⬜ pending |
| 64-06 / T1 | 06 | 4 | — (pre-merge gate) | — | Full pytest suite green on branch head | regression | `pytest tests/` | ✅ | ⬜ pending |
| 64-06 / T2 | 06 | 4 | D-01, D-11 | — | `--no-ff` merge commit on livekit-agent/main | deploy | `git log main --oneline -1` shows "Merge branch 'phase-64-pipeline-migration'" | N/A (gate) | ⬜ pending |
| 64-06 / T3 | 06 | 4 | D-11 | T-64-06-01 | Railway production redeploy SUCCESS at merge SHA | deploy | Human-verify checkpoint (Railway dashboard) | manual | ⬜ pending |
| 64-06 / T4 | 06 | 4 | D-09 doc sync | — | voice-call-architecture SKILL.md rewritten (pipeline SOT) | docs gate | `grep -c "google.STT(chirp_3" .claude/skills/voice-call-architecture/SKILL.md` returns ≥ 1 | ✅ | ⬜ pending |
| 64-06 / T5 | 06 | 4 | — (phase close) | — | 64-SUMMARY.md + STATE.md [v6.0 P64] entry + ROADMAP.md Phase 64 marked 6/6 | docs gate | `grep -c "\[v6.0 P64\]" .planning/STATE.md` returns ≥ 1 | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] **Create** `tests/test_pipeline_session.py` (Plan 01 Task 1) with the 14 test functions enumerated in the per-task map above. File MUST be RED on commit (session-construction assertions fail against the still-Realtime agent.py).
- [ ] **Update** `tests/test_prompt_greeting_directive.py` (Plan 01 Task 2) — add D-03c re-frame assertions EN+ES + legacy-header negative assertions. Pre-existing Phase 63.1-01 tests remain untouched.
- [ ] **Update** `tests/test_prompt_booking.py` (Plan 01 Task 3) — add D-03d one-liner assertions EN+ES + Realtime-placeholder negative assertions + check_availability-BEFORE-book_appointment preservation. Pre-existing Phase 60.3-11 tests untouched.

*Framework already installed (pytest pinned from Phase 63). No install step needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end booking flow on live SIP call | D-10 (UAT bar) | Requires Twilio SIP route + Railway preview deploy + tenant calendar + real voice audio | Place UAT call on SG-tenant Twilio number against Railway preview URL. Speak through greeting, give name + address + service, accept proposed slot. Verify: (a) greeting plays first; (b) agent responds without re-greeting; (c) `book_appointment` succeeds; (d) calendar row appears; (e) `[goodbye_race]` record emits on close. |
| Absence of `_SegmentSynchronizerImpl` warnings in Railway logs | D-09 / acceptance bar | Positive signal is an ABSENCE — no automated assert framework catches this | Use Railway log search: `railway logs --service <service-id> --since 15m \| grep -c _SegmentSynchronizerImpl` (or Railway Dashboard → Logs search) should return 0 matches. |
| Absence of `server cancelled tool calls` warnings | D-09 / acceptance bar | Same — negative-signal grep | `railway logs --service <service-id> --since 15m \| grep -c "server cancelled tool calls"` should return 0 matches after UAT call. |
| Spanish UAT call (if feasible, non-blocking) | D-07 / D-10 | Real-voice ES caller audio on SIP; Chirp 3 production reliability | Place ES UAT call; assert agent responds in Spanish (not English mishear); booking flow completes. If ES regresses, log as Phase 64.1 follow-up — does NOT block merge (ES coverage verified via 205-test pytest suite from Phase 60.3-12). |
| Per-turn latency measurement | Research Q6 (RESOLVED — non-blocking per D-10) | Requires real SIP RTP timing; not measurable in unit tests | Capture `[goodbye_race]` field deltas + Railway timing logs for one UAT call. If p90 > 2s per turn, flag for Phase 64.1 (`endpointing_sensitivity`). Does NOT block merge. |
| Cloud Speech v2 IAM scope on Railway service account | D-08, T-64-04-01 | Google Cloud Console is the authoritative source; not scriptable from agent repo | Google Cloud Console → IAM & Admin → find the service account tied to `GOOGLE_APPLICATION_CREDENTIALS` → confirm role includes `roles/speech.client` (or broader). Record in 64-04-SUMMARY.md. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (every task in 64-01 through 64-06 maps to a `pytest` node OR a human-verify checkpoint OR a `grep` / `git ls-remote` gate)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (Plan 02 Task 1 verifies kwarg-level Plan 01 tests; Plan 02 Task 2 verifies full Plan 01 file; Plan 03 Task 1 verifies greeting tests; Plan 03 Task 2 verifies booking tests; Plan 04 gates on grep + ls-remote; Plan 06 gates on full pytest + grep)
- [x] Wave 0 covers all MISSING references (new `tests/test_pipeline_session.py` + updates to two existing test files — all three tracked in the Wave 0 Requirements block above)
- [x] No watch-mode flags (all `-x` fail-fast, no `--watch`)
- [x] Feedback latency < 60s (quick command runs 3 targeted test files; full suite ~60s per RESEARCH § Validation Architecture)
- [x] `nyquist_compliant: true` set in frontmatter (above)

**Approval:** ready for execution (auto-approved after B3 task-ID realignment 2026-04-24).

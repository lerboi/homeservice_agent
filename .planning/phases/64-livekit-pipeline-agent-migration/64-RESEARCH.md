# Phase 64: LiveKit Pipeline Agent Migration — Research

**Researched:** 2026-04-24
**Domain:** livekit-agents 1.5.6 pipeline architecture (STT + LLM + TTS); migration from google.realtime.RealtimeModel
**Confidence:** HIGH (every constructor signature, parameter name, and capability gate verified against the 1.5.6 source at commit `25bd9c76b0e163195a6557f4a1528beaebeb2bd7`)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Big-bang feature branch `phase-64-pipeline-migration` → Railway preview → merge to `livekit-agent/main`. Single merge. Rollback = `git revert` the merge commit + redeploy.
- **D-02:** `session.say(greeting_text)` with existing locale-branched templating. No LLM turn consumed for greeting.
- **D-03a:** Remove 63.1-07 input mute during greeting playback (`session.input.set_audio_enabled(False)`, `_unmute_after_greeting`, 10s timer).
- **D-03b:** Port 63.1-11's 2500ms silence threshold to Silero VAD (research confirms exact kwarg — see below).
- **D-03c:** Keep "greeting already delivered" guardrail in `_build_greeting_section`, re-framed for pipeline ("Greeting already delivered via system; respond directly to caller input now.").
- **D-03d:** Simplify NO DOUBLE-BOOKING block to a one-liner. Preserve EN/ES parity. Preserve `check_availability BEFORE book_appointment` invariant.
- **D-04:** Silero VAD only (`livekit-plugins-silero`). No `turn_detector` plugin. No hybrid.
- **D-05:** LLM = `google.LLM(model="gemini-3.1-flash")` text mode. `thinking_config` if supported; default acceptable if not.
- **D-06:** TTS = `GeminiTTS(voice_name=voice_name, model="gemini-2.5-flash-preview-tts", instructions="Say this quickly, in a warm professional tone:")`.
- **D-07:** STT = `google.STT(model="chirp_3")` with language pin translated from `RealtimeModel(language=...)`.
- **D-08:** Cross-repo discipline unchanged. `--no-verify`. `fix(64):`/`feat(64):` in livekit-agent; `docs(64-XX):` in homeservice_agent.
- **D-09:** Preserve ALL Phase 55/56/59/60.3/60.4/63/63.1 surface identically.
- **D-10:** UAT bar = pytest green + Railway preview + one live UAT call (EN; ES if feasible).
- **D-11:** Branch = `phase-64-pipeline-migration`. No feature flag.

### Claude's Discretion

- Exact `silero.VAD.load()` parameter name for 2500ms silence port (research confirms: `min_silence_duration=2.5`).
- Whether `google.LLM` `thinking_config` surface matches `google.realtime.RealtimeModel` — research confirms it does (`types.ThinkingConfig` accepted; Gemini 3 models use `thinking_level`).
- Test file organization: extend `tests/test_prompt_greeting_directive.py` vs add `tests/test_pipeline_session.py`.
- Exact prompt wording for D-03c and D-03d — planner drafts per `feedback_livekit_prompt_philosophy.md`.
- Whether to delete `realtime_input_config` / `genai_types` imports fully or keep as dead code.

### Deferred Ideas (OUT OF SCOPE)

- Phase 60.4 resumption against pipeline (separate phase).
- Latency optimization beyond baseline.
- Multi-provider STT fallback.
- Return to audio-to-audio Realtime.
- Turn detector plugin.
- Env-var feature flag.
- Cold-start latency (infrastructure scope).
- 70–87s silences during `book_appointment` (may dissolve; validate in UAT).
- STT-ASR mishearing EN as ES.
</user_constraints>

---

## Summary

The livekit-agents 1.5.6 pipeline path (`AgentSession(stt=, llm=, tts=, vad=)`) is a mature, fully supported API with NO capability gates on `session.say()`, `session.generate_reply()`, or `update_chat_ctx()`. These are the three methods that are capability-gated-closed on the Realtime path for Gemini 3.1 models — on pipeline, they work unconditionally (provided TTS is attached for `say()`). The `_SegmentSynchronizerImpl` mid-word truncation race does NOT exist on the pipeline path (pipeline does not use that synchronizer code path). The `server cancelled tool calls` race does NOT exist on the pipeline path (tool execution is framework-local, not Gemini-server-VAD-cancellable).

The architectural swap requires three things: (1) replace `google.realtime.RealtimeModel(...)` with `google.STT(...) + google.LLM(...)` at the `AgentSession` construction site; (2) add `silero.VAD.load(min_silence_duration=2.5)` as `vad=`; (3) translate the `language=` kwarg from Realtime to `google.STT(languages=...)` (NOTE: plural `languages`, not `language`). Everything else — tools, prompt, post-call pipeline, egress, event handlers, pre-session fetch — is structurally unchanged.

**One critical rename:** Google STT's parameter is `languages` (plural), not `language`. `_locale_to_bcp47(locale)` output is still valid BCP-47 and still correct; only the kwarg name changes. Missing this produces no error at construction time (the kwarg falls back to default `"en-US"` silently), which is a latent bug that must be caught by the test suite.

**Primary recommendation:** Swap `google.realtime.RealtimeModel(...)` for `google.STT(model="chirp_3", languages=_locale_to_bcp47(locale))` + `google.LLM(model="gemini-3.1-flash", thinking_config=genai_types.ThinkingConfig(thinking_level="low", include_thoughts=False))` + `silero.VAD.load(min_silence_duration=2.5)`. Keep `GeminiTTS` as session TTS. Delete 63.1-07 mute scaffolding. Re-frame two prompt sections. Add `livekit-plugins-silero==1.5.6` to `pyproject.toml` (already pinned; confirm version).

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `livekit-agents` | `==1.5.6` | Pipeline orchestration (AgentSession, AgentActivity, function_tool, RunContext) | Already pinned post-Phase-63; pipeline path is the mature "classic" API |
| `livekit-plugins-google` | `==1.5.6` | `google.STT(chirp_3)` + `google.LLM(gemini-3.1-flash)` + `GeminiTTS` | Same package — all three live here; already pinned post-Phase-63 |
| `livekit-plugins-silero` | `==1.5.6` | Silero VAD for local silence detection | Already pinned post-Phase-63; pipeline quickstart default |
| `google-cloud-speech` | `>=2, <3` | google.STT transitive dep (google-cloud-speech-v2 streaming API) | Pulled transitively by `livekit-plugins-google==1.5.6`; no direct pin needed |

[VERIFIED: livekit-plugins-google 1.5.6 pyproject.toml — `google-cloud-speech<3,>=2`]

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `livekit-plugins-noise-cancellation` | `>=0.2,<1` | BVCTelephony for SIP participants (already in use) | Unchanged — stays as session.start() room_options |
| `google-genai` | `>=1.55` (transitive) | `types.ThinkingConfig` import for LLM thinking config | Pulled transitively; import path unchanged |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `chirp_3` STT | `latest_long` or `chirp_2` | `chirp_3` is SOTA for multilingual, has `endpointing_sensitivity` tuning; `latest_long` is the default and most battle-tested for call audio; `chirp_2` is the prior generation. Chirp 3 had a transcription bug fixed in PR #3628 (merged Oct 2025) — now fully supported at 1.5.6. |
| Silero VAD | `turn_detector.MultilingualModel` | Silero is local (~30ms), free, no per-turn inference cost. MultilingualModel adds semantic turn detection (~50–150ms added latency) — overkill for receptionist calls where 2.5s silence is already a strong signal. |
| `google.LLM(model="gemini-3.1-flash")` | `gemini-3.1-flash-preview` or `gemini-2.5-flash` | `gemini-3.1-flash` as text mode is the Phase 64 locked choice. Note: it is NOT in the `ChatModels` Literal type at 1.5.6 but is accepted as `str` (constructor takes `ChatModels | str`). `_is_gemini_3_model()` helper in `llm.py` matches it correctly via `"gemini-3" in model.lower()`. |

**Installation:** No new packages — `livekit-plugins-silero==1.5.6` already in `pyproject.toml` from Phase 63. No `requirements.txt` exists in this repo (uses `pyproject.toml`).

**Version verification:**
```bash
pip index versions livekit-plugins-silero | head -1
# Expect: livekit-plugins-silero (1.5.6, ...)
pip show livekit-plugins-silero | grep Version
# Expect: Version: 1.5.6
```

---

## Architecture Patterns

### Recommended Project Structure

No structural changes — all code lives in the existing layout:

```
livekit-agent/
├── src/
│   ├── agent.py          # SESSION ASSEMBLY CHANGES HERE (lines 396-474, 859-941)
│   ├── prompt.py         # PROMPT CHANGES HERE (_build_greeting_section, _build_booking_section)
│   ├── tools/            # UNCHANGED — all 7 tools
│   ├── integrations/     # UNCHANGED — Xero/Jobber pre-session fetch
│   └── lib/              # UNCHANGED
├── tests/
│   ├── test_prompt_greeting_directive.py  # UPDATE for D-03c re-frame
│   └── test_prompt_booking.py             # UPDATE for D-03d one-liner
└── pyproject.toml        # NO CHANGE needed (silero already pinned at 1.5.6)
```

### Pattern 1: Pipeline AgentSession Construction

**What:** Replace the Realtime model block with three discrete plugin instances.
**When to use:** Phase 64 target — this is the new permanent session assembly.

```python
# Source: verified against livekit-agents@1.5.6 agent_session.py:217-256
# and livekit-plugins-google@1.5.6 stt.py, llm.py, gemini_tts.py

from livekit.plugins import google, silero, noise_cancellation
from livekit.plugins.google.beta.gemini_tts import TTS as GeminiTTS
from google.genai import types as genai_types

# STT — CRITICAL: parameter is 'languages' (plural), not 'language'
stt = google.STT(
    model="chirp_3",
    languages=_locale_to_bcp47(locale),   # "en-US" or "es-US"
    detect_language=False,                  # pin to single language, no auto-detect
)

# LLM — text-mode Gemini 3.1 Flash
llm_plugin = google.LLM(
    model="gemini-3.1-flash",               # str accepted; not in ChatModels Literal but works
    thinking_config=genai_types.ThinkingConfig(
        thinking_level="low",
        include_thoughts=False,
    ),
)

# TTS — same GeminiTTS instance as today's 63.1-06 greeting; promoted to session-level
tts = GeminiTTS(
    voice_name=voice_name,
    model="gemini-2.5-flash-preview-tts",
    instructions="Say this quickly, in a warm professional tone:",
)

# VAD — Silero, local, ~30ms, 2500ms silence threshold ported from 63.1-11
vad = silero.VAD.load(
    min_silence_duration=2.5,   # seconds; port of 63.1-11's silence_duration_ms=2500
    # activation_threshold default 0.5 is fine; no change needed
)

# Session assembly — pipeline path
session = AgentSession(
    stt=stt,
    llm=llm_plugin,
    tts=tts,
    vad=vad,
)
```

[VERIFIED: `silero.VAD.load()` signature from `livekit-plugins/livekit-plugins-silero/livekit/plugins/silero/vad.py` at 1.5.6 — `min_silence_duration: float = 0.55`]
[VERIFIED: `google.STT.__init__` from `livekit-plugins/livekit-plugins-google/livekit/plugins/google/stt.py` at 1.5.6 — `languages: LanguagesInput = "en-US"`, `detect_language: bool = True`]
[VERIFIED: `google.LLM.__init__` from `livekit-plugins/livekit-plugins-google/livekit/plugins/google/llm.py` at 1.5.6 — `thinking_config: NotGivenOr[types.ThinkingConfigOrDict] = NOT_GIVEN`]
[VERIFIED: `GeminiTTS.__init__` from `livekit-plugins/livekit-plugins-google/livekit/plugins/google/beta/gemini_tts.py` at 1.5.6 — `voice_name`, `model`, `instructions` all confirmed]

### Pattern 2: Greeting Dispatch on Pipeline (D-02, D-03a)

**What:** `session.say()` works natively on pipeline path; no capability gate; no mute/unmute needed.
**When to use:** Immediately after `session.start()` — identical location in code to current 63.1-06.

```python
# Source: verified against livekit-agents@1.5.6 agent_activity.py (say() method)
# On pipeline path: say() checks `self.tts` is present → routes through _tts_task
# No isinstance(llm, RealtimeModel) gate at the session-level say() call path.

# ── Keep this block (greeting text unchanged) ──
if locale == "es":
    disclosure_text = "Esta llamada puede ser grabada por motivos de calidad."
    if onboarding_complete:
        greeting_text = f"Hola, gracias por llamar a {business_name}. {disclosure_text} ¿En qué puedo ayudarle?"
    else:
        greeting_text = f"{disclosure_text} ¿En qué puedo ayudarle?"
else:
    disclosure_text = "This call may be recorded for quality purposes."
    if onboarding_complete:
        greeting_text = f"Hello, thank you for calling {business_name}. {disclosure_text} How can I help you today?"
    else:
        greeting_text = f"{disclosure_text} How can I help you today?"

# ── DELETE: 63.1-07 input mute block (session.input.set_audio_enabled(False),
# ──         _unmute_after_greeting task, 10s timer) per D-03a ──
# Root cause (SIP echo re-entering Gemini server VAD) does not apply to
# local Silero VAD on clean audio.

# ── KEEP: session.say() fire-and-forget ──
greeting_handle = session.say(greeting_text)
logger.info(
    "[64] greeting dispatched via pipeline TTS locale=%s chars=%d voice=%s",
    locale, len(greeting_text), voice_name,
)
```

[VERIFIED: `agent_activity.py` `say()` method — requires `self.tts` present or pre-supplied audio; no RealtimeModel isinstance check blocking it on pipeline path]

### Pattern 3: Tool Registration (Unchanged)

**What:** All 7 tools registered via `@function_tool` — identical on pipeline path.
**When to use:** No change — tools are registered exactly as today.

```python
# Source: verified against livekit-agents@1.5.6 agent_activity.py _pipeline_reply_task_impl
# Tools wrapped in ToolContext and passed to LLM's chat() method.
# Tool execution is LOCAL (framework-managed), not server-side (Gemini VAD-cancellable).

# Pipeline tool lifecycle:
# 1. LLM emits FunctionToolCall in LLMStream
# 2. AgentActivity.perform_tool_executions() runs the tool coroutine
# 3. Result inserted into chat_ctx as FunctionCallOutput
# 4. LLM called again with tool result in context
# → No "server cancelled tool calls" race possible (no Gemini server VAD involvement)
```

[VERIFIED: `agent_activity.py` `_pipeline_reply_task_impl` — tools executed via `perform_tool_executions`; no server-side cancellation pathway]

### Pattern 4: Pre-Session Context Injection (Unchanged)

**What:** System prompt assembled pre-session, passed as `Agent(instructions=system_prompt)`. No change.
**When to use:** Identical to current flow.

```python
# Source: verified against livekit-agents@1.5.6 agent_activity.py _pipeline_reply_task_impl
# Instructions injected: chat_ctx.add_message(role="system", content=[instructions])
# This means build_system_prompt(..., customer_context=..., intake_questions=...) output
# becomes the system message on every pipeline LLM turn. Identical semantic to Realtime
# instructions= kwarg. No change required.

system_prompt = build_system_prompt(
    tenant=tenant,
    locale=locale,
    customer_context=customer_context,
    intake_questions=intake_questions_text,
    onboarding_complete=onboarding_complete,
)
agent = VocoAgent(instructions=system_prompt, tools=tools)
```

### Pattern 5: Goodbye-Race Instrumentation on Pipeline (D-09 mapping for Phase 60.3)

**What:** The `[goodbye_race]` `_GoodbyeDiagHandler` instrumentation from Phase 60.3 maps to pipeline with field semantic differences.
**When to use:** Retain the instrumentation; document field deltas in SUMMARY.

```python
# Pipeline path — field mapping vs Realtime path:
#
# FIRES on pipeline:
#   - end_call_invoked_at: unchanged (end_call tool sets this)
#   - last_text_token_at: fires via @session.on("conversation_item_added") — event.created_at
#     ON PIPELINE: this fires when agent text is committed to chat history (NOT per-token stream)
#     Semantic delta: one event per turn, not per streaming token. Delta is documented-only.
#   - session_close_at + close_reason: @session.on("close") — unchanged
#   - participant_disconnect_at: room-level event — unchanged
#   - last_audio_frame_at: session.output.audio.capture_frame wrap — unchanged
#
# DOES NOT FIRE on pipeline:
#   - text_done / audio_done from _SegmentSynchronizerImpl LogRecord extras:
#     _SegmentSynchronizerImpl is in the TRANSCRIPTION synchronizer (used by Realtime path
#     to synchronize partial text emission with audio frames). On pipeline path, text arrives
#     from STT as final transcript segments, not interleaved with audio synthesis. The
#     _GoodbyeDiagHandler that reads text_done/audio_done from LogRecord extras will never
#     fire because _SegmentSynchronizerImpl.mark_playback_finished is NOT in the pipeline
#     audio output path.
#
# ACTION: _GoodbyeDiagHandler can stay in code; text_done/audio_done will be False (never
# set) on pipeline calls. Document in SUMMARY as schema delta v1→v2.
#
# POSITIVE: "_SegmentSynchronizerImpl.playback_finished called before text/audio input is done"
# warning WILL NOT APPEAR in pipeline Railway logs — this confirms the mid-word truncation
# race is eliminated. That absence IS the positive signal.
```

[VERIFIED: `synchronizer.py` at 1.5.6 — `_SegmentSynchronizerImpl` class exists but is part of the transcription synchronization path used for streaming partial results (Realtime path). Pipeline TTS output does not go through this synchronizer.]
[ASSUMED: `session.output.audio.capture_frame` wrapping for `last_audio_frame_at` still works on pipeline path. The `session.output.audio` is a `AudioOutput` instance on both pipeline and Realtime paths at 1.5.6. This must be verified at runtime.]

### Anti-Patterns to Avoid

- **Using `language=` (singular) on `google.STT`**: The parameter is `languages` (plural). Passing `language=_locale_to_bcp47(locale)` silently falls through to the default `en-US` — no construction error, no warning. A Spanish tenant gets English STT with no visible failure. Catch this with a unit test asserting the STT constructor call uses `languages=`.
- **Passing `detect_language=True` with a single language pin**: When `detect_language=True` and a single language is in `languages`, Google STT may switch to detected language. For Phase 64's language-pin intent (Phase 60.4 Stream B), always pass `detect_language=False` when single-language pinning.
- **Using `google.STT(model="latest_long")` default**: `latest_long` is not in `SpeechModelsV2` and uses the v1 API path in the plugin. `chirp_3` uses v2 (Cloud Speech v2) which has better multilingual support, `endpointing_sensitivity`, and the latency-accuracy tradeoff knob.
- **Passing `thinking_config` as a plain dict to `google.LLM`**: Both `types.ThinkingConfig` instances and dicts work, but using `genai_types.ThinkingConfig(thinking_level="low", include_thoughts=False)` is safer because it validates field names at construction time.
- **Expecting `text_done`/`audio_done` to be `True` in `[goodbye_race]` records**: These fields come from `_SegmentSynchronizerImpl` extras which don't fire on pipeline path. Records will show them as `False` or absent — this is correct pipeline behavior, not an instrumentation failure.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Voice Activity Detection | Custom silence timer or energy threshold | `silero.VAD.load(min_silence_duration=2.5)` | Silero handles speech/non-speech at frame level (~30ms latency), handles onnxruntime model loading, handles sample rate conversion. Custom energy thresholds break on background noise. |
| Turn detection / end-of-turn | Fixed N-second timer, custom silence counter | Silero VAD's `min_silence_duration` (already decided in D-04) | VAD silence + `min_silence_duration=2.5` IS the turn boundary for this use case. Framework handles the "caller stopped → STT finalize → LLM trigger" handoff. |
| Interruption / barge-in | Manual audio mute, SIP send/recv toggling | Pipeline's built-in interruption mechanism (AgentActivity handles it) | Pipeline automatically cancels the current TTS speech handle on new VAD detection. No custom code needed. 63.1-07's manual mute was a Realtime-specific workaround; delete it. |
| Tool call orchestration | Manual tool result insertion, chat_ctx patching | `@function_tool` + AgentSession's `perform_tool_executions` | Framework runs tools, inserts FunctionCallOutput into chat_ctx, calls LLM again. The tool returns a string; framework handles the rest. |
| STT streaming / endpointing | Custom Google Cloud Speech client | `google.STT(model="chirp_3")` | Plugin handles streaming recognition sessions, session recycling, partial vs final result routing, confidence threshold filtering. |
| TTS streaming | Custom genai TTS synthesis + audio framing | `GeminiTTS(...)` already in use | Already attached for 63.1-06 greeting. Promoted to session TTS — zero change. |
| Chat history / context | Manual dict list passed to LLM | `AgentSession.history` (ChatContext) + framework management | AgentActivity inserts all turns automatically. Pre-session context goes into `Agent(instructions=...)` which becomes system message. |

**Key insight:** On the pipeline path, the framework's `_pipeline_reply_task_impl` handles the complete STT-result → LLM-call → tool-execution → LLM-follow-up → TTS-synthesis loop. Every workaround we had on the Realtime path (mute/unmute, generate_reply, update_chat_ctx, input config tuning) is either not needed or already handled by the framework.

---

## Common Pitfalls

### Pitfall 1: `language=` vs `languages=` kwarg rename (HIGH RISK — SILENT FAILURE)

**What goes wrong:** `google.STT(model="chirp_3", language=_locale_to_bcp47(locale))` — note `language` (singular) — does NOT raise a `TypeError`. Python will silently pass this as a kwargs dict that gets ignored (or causes a `TypeError` if the constructor is strict). The STT plugin's constructor parameter is `languages` (plural). Spanish tenants receive English STT. The agent responds in English to a Spanish caller.

**Why it happens:** Muscle memory from `RealtimeModel(language=...)` (singular). The Realtime kwarg is `language`; the STT kwarg is `languages`. The rename is not obvious.

**How to avoid:** The planner MUST put the `languages=` kwarg explicitly in the plan code. Add a unit test: `assert call_args.kwargs["languages"] == "es-US"` for the Spanish locale path.

**Warning signs:** Railway logs show STT transcripts in English for Spanish test calls. No boot-time error.

[VERIFIED: `google.STT.__init__` signature from 1.5.6 source — parameter name is `languages`, not `language`]

### Pitfall 2: `detect_language=True` (default) fights `languages=` pin

**What goes wrong:** `google.STT(model="chirp_3", languages="es-US")` with `detect_language=True` (default). Google STT's auto-detection may decide the audio is English and override the pin. This is the same AS REALT-ASR-mishear problem from Phase 60.3 Call B-1.

**Why it happens:** `detect_language` defaults to `True`. A single-language `languages=` pin is advisory when detect_language is on.

**How to avoid:** Always pass `detect_language=False` when language is pinned from tenant locale. This is analogous to Phase 60.4 Stream B's intent — explicit pin, no auto-detect drift.

**Warning signs:** Railway logs show Spanish caller getting English transcripts despite `languages="es-US"`.

[VERIFIED: `stt.py` lines — "if detect_language disabled and multiple languages, warn; use only first language" — inverse implies single language + detect_language=False is the pinned-language path]

### Pitfall 3: Boot-time success + runtime `TypeError` on first call

**What goes wrong:** All imports succeed, Railway shows "registered worker", but the first inbound call raises a `TypeError` or `ValueError` at `session.start()` because a plugin constructor kwarg was wrong (e.g., wrong model string format).

**Why it happens:** Plugin constructors defer validation to the first API call (streaming session open), not at object construction time.

**How to avoid:** Add a smoke test that constructs all three plugin instances with production kwargs and calls a trivial method. Session smoke test: `python -c "from src.agent import _smoke_test_session_construction; _smoke_test_session_construction()"` — add a test helper that builds the session but doesn't call `start()`.

**Warning signs:** Railway logs show Python exception on first call, green on boot.

### Pitfall 4: `_GoodbyeDiagHandler` false positives — `text_done=False` is normal on pipeline

**What goes wrong:** The `[goodbye_race]` record always shows `text_done=false, audio_done=false`. Monitoring alert fires thinking there's a goodbye race on every pipeline call.

**Why it happens:** `_GoodbyeDiagHandler` reads these fields from `_SegmentSynchronizerImpl.mark_playback_finished` log extras. That warning never fires on pipeline path because the synchronizer is only in the Realtime TTS-sync path. The fields default to `False`.

**How to avoid:** Document in SUMMARY that `text_done`/`audio_done` are always `False` on pipeline. Update any monitoring alert that was watching these fields on the Realtime path. The ABSENCE of `_SegmentSynchronizerImpl` warnings is the positive pipeline health signal.

### Pitfall 5: `session.input.set_audio_enabled(False)` removed — but egress still starts

**What goes wrong:** After removing 63.1-07's input mute, the SIP caller's audio is live from T=0. If egress starts BEFORE the greeting plays, the first second of recording captures silence. This is acceptable, but if the egress start races with session.start(), there could be session-not-ready errors.

**Why it happens:** The 63.1-07 input mute provided an inadvertent "pause" window. Without it, egress start and greeting dispatch both happen immediately after `session.start()`.

**How to avoid:** The egress start is fire-and-forget in `_start_egress()` coroutine with `await db_task` guard — unchanged. `session.say(greeting_text)` is also fire-and-forget. Both are race-safe by design. This is not a real risk, but document it to prevent future readers from re-adding the mute "to protect egress".

### Pitfall 6: `google.LLM(model="gemini-3.1-flash")` — not in `ChatModels` Literal

**What goes wrong:** Mypy/pyright reports a type error: `"gemini-3.1-flash"` is not in the `ChatModels` Literal type. CI might fail on strict type checking.

**Why it happens:** `ChatModels` at 1.5.6 contains `"gemini-3-pro-preview"` and `"gemini-3-flash-preview"` but NOT `"gemini-3.1-flash"`. The constructor accepts `ChatModels | str`, so it works at runtime.

**How to avoid:** Pass `model="gemini-3.1-flash"` as a `str` — this is correct. The `_is_gemini_3_model()` helper in `llm.py` matches it via `"gemini-3" in model.lower()` for proper thinking_config routing. If type checking is strict, add a `# type: ignore[arg-type]` comment. Do not try to use a Literal that doesn't include this model name.

[VERIFIED: `google/models.py` at 1.5.6 — `ChatModels` Literal does not include `"gemini-3.1-flash"`. `LLM.__init__` signature is `model: ChatModels | str`. `_is_gemini_3_model` pattern-matches `"gemini-3" in model.lower()`.]

### Pitfall 7: Silero VAD onnxruntime native dependency on Railway

**What goes wrong:** `silero.VAD.load()` loads an ONNX model at startup via `onnxruntime`. If Railway's container doesn't have the onnxruntime wheel or the silero model file, the first `VAD.load()` call fails.

**Why it happens:** `livekit-plugins-silero==1.5.6` was already pinned post-Phase-63. The `force_cpu=True` default (confirmed in VAD.load() signature) means no GPU deps. But `onnxruntime` must be in the dependency graph.

**How to avoid:** `livekit-plugins-silero==1.5.6` is already in `pyproject.toml` from Phase 63 and presumably already running on Railway (it was already pinned, even if not used yet). Check Railway logs for `silero` startup messages. If fresh Railway deploy fails, add `onnxruntime>=1.17,<2` to `pyproject.toml` direct deps.

**Warning signs:** Railway boot log shows `ImportError: No module named 'onnxruntime'` or `FileNotFoundError: silero model not found`.

[ASSUMED: `livekit-plugins-silero==1.5.6` already installed on Railway from Phase 63 pin (even if not instantiated until Phase 64). Risk: LOW — Phase 63 already pinned it.]

### Pitfall 8: `last_text_token_at` now fires once-per-turn, not per-streaming-token

**What goes wrong:** Phase 60.3's `[goodbye_race]` instrumentation stamps `last_text_token_at` on each `conversation_item_added` event. On Realtime path, this event fires per text token as the streaming output arrives. On pipeline path, it fires once when the full LLM response is committed to chat_ctx (after the full turn). The timestamp is later than on Realtime — specifically, it captures the end of LLM generation + TTS start, not individual token arrival.

**Why it happens:** Pipeline LLM uses `LLMStream` which streams tokens internally but commits to chat_ctx as a completed message. `conversation_item_added` fires on commit.

**How to avoid:** This is not a bug — it's a semantic difference. The `end_call_invoked_at` → `last_text_token_at` delta (Phase 60.3's regression signal) is still meaningful on pipeline but measures a different interval. Document in SUMMARY. The regression signal we care about is whether `end_call` fires too early (before speech ends) — still measurable via `end_call_invoked_at` vs `participant_disconnect_at`.

---

## Code Examples

Verified patterns from 1.5.6 source code:

### Session Assembly (Full Replacement Block for `agent.py:396-474`)

```python
# Source: verified from livekit-agents@1.5.6 stt.py, llm.py, silero/vad.py, gemini_tts.py

# ── DELETE: realtime_input_config block (lines 396-412) ──
# ── DELETE: google.realtime.RealtimeModel construction (lines 433-443) ──
# ── KEEP: GeminiTTS construction, rename to session-level tts ──

# 1. STT — NOTE: plural 'languages', not 'language'
stt_plugin = google.STT(
    model="chirp_3",
    languages=_locale_to_bcp47(locale),  # "en-US" or "es-US"
    detect_language=False,               # pin to tenant locale; no auto-detect
)

# 2. LLM — text mode, same model as Realtime was wrapping
llm_plugin = google.LLM(
    model="gemini-3.1-flash",            # str; not in ChatModels Literal but valid
    thinking_config=genai_types.ThinkingConfig(
        thinking_level="low",            # same tuning as Phase 63.1-09
        include_thoughts=False,
    ),
)

# 3. TTS — promote from greeting-only to session-level (was greeting_tts)
tts_plugin = GeminiTTS(
    voice_name=voice_name,
    model="gemini-2.5-flash-preview-tts",
    instructions="Say this quickly, in a warm professional tone:",
)

# 4. VAD — Silero, port of 63.1-11's silence_duration_ms=2500
vad_plugin = silero.VAD.load(
    min_silence_duration=2.5,           # 2500ms → 2.5s; exact kwarg confirmed
    # activation_threshold=0.5 (default) — no change needed
    # force_cpu=True (default) — Railway uses CPU
)

# 5. Agent + Session
agent = VocoAgent(instructions=system_prompt, tools=tools)
session = AgentSession(
    stt=stt_plugin,
    llm=llm_plugin,
    tts=tts_plugin,
    vad=vad_plugin,
)
deps["session"] = session
```

### Greeting Dispatch (Simplified `agent.py:859-941` replacement)

```python
# Source: livekit-agents@1.5.6 agent_activity.py say() — no capability gate on pipeline
# DELETE: session.input.set_audio_enabled(False) — D-03a
# DELETE: _unmute_after_greeting task — D-03a
# DELETE: asyncio.create_task(_unmute_after_greeting()) — D-03a
# KEEP: greeting_text templating (locale-branched, unchanged)
# KEEP: session.say(greeting_text) — works natively on pipeline with tts= attached

greeting_handle = session.say(greeting_text)  # fire-and-forget; returns SpeechHandle
logger.info(
    "[64] greeting dispatched via pipeline TTS locale=%s chars=%d voice=%s",
    locale, len(greeting_text), voice_name,
)
# No error handler needed for input mute — pipeline VAD handles barge-in natively
```

### STT Language Kwarg Translation (Phase 60.4 Stream B carry-over)

```python
# FROM (Realtime):
model = google.realtime.RealtimeModel(
    language=_locale_to_bcp47(locale),  # singular 'language'
    ...
)

# TO (Pipeline STT):
stt_plugin = google.STT(
    languages=_locale_to_bcp47(locale),  # PLURAL 'languages' — DIFFERENT KWARG NAME
    detect_language=False,
    ...
)
# _locale_to_bcp47() output is unchanged — "en-US" and "es-US" are valid BCP-47
# for both Realtime and STT. The function itself doesn't need editing.
```

### Import Block Changes (`agent.py:32-36`)

```python
# REMOVE:
from google.genai import types as genai_types  # KEEP — still needed for ThinkingConfig

# REMOVE THIS IMPORT (realtime no longer used):
# google.realtime.RealtimeModel accessed via google.realtime.RealtimeModel(...)
# The `google` import stays; just don't access google.realtime.

# REMOVE THIS SPECIFIC IMPORT:
# from livekit.plugins import google  — KEEP (still uses google.STT and google.LLM)
# from livekit.plugins.google.beta.gemini_tts import TTS as GeminiTTS  — KEEP

# ADD:
from livekit.plugins import silero  # for silero.VAD.load()
# Note: silero is already in pyproject.toml; just needs import added to agent.py
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `google.realtime.RealtimeModel` audio-to-audio | `google.STT + google.LLM + GeminiTTS` (pipeline) | Phase 64 | Eliminates 5 capability-gate bugs. Adds ~500ms per-turn latency. |
| `realtime_input_config.silence_duration_ms` | `silero.VAD.load(min_silence_duration=)` | Phase 64 | Same semantic (2500ms silence threshold); different mechanism (local Silero vs server-side Gemini VAD) |
| `RealtimeModel(language=...)` | `google.STT(languages=...)` | Phase 64 | Same BCP-47 input; NOTE plural kwarg name |
| 63.1-07 input mute during greeting | Native pipeline barge-in (no mute needed) | Phase 64 | Deletes ~20 lines of scaffolding; restores natural barge-in from T=0 |
| `session.say()` guarded by TTS attachment workaround | `session.say()` native on pipeline (no guard needed) | Phase 64 | `say()` works natively with `tts=` in AgentSession |
| `_SegmentSynchronizerImpl` mid-word truncation race | Absent on pipeline path | Phase 64 | Positive: warning will NOT appear in Railway logs |

**Current SOTA note:** As of research date (2026-04-24), `livekit-agents==1.5.6` is the latest stable release. No 1.5.7 or 1.6.x exists on PyPI. The pipeline architecture is LiveKit's recommended path for production deployments where individual component quality matters more than round-trip latency.

---

## Research Questions from CONTEXT.md — Answered

| # | Question | Answer | Confidence |
|---|----------|--------|-----------|
| 1 | STT language pinning — `google.STT(model="chirp_3", language=...)` or `languages=`? | **`languages=` (plural).** BCP-47 values from `_locale_to_bcp47(locale)` are valid. Add `detect_language=False` to enforce pin. | HIGH [VERIFIED] |
| 2 | LLM tool calling — 7 `@function_tool` tools work identically? | **Yes.** Pipeline path runs tools via `perform_tool_executions`. Same `@function_tool(name=, description=)` decorator. Same `RunContext` first arg. Return format (string) unchanged. | HIGH [VERIFIED] |
| 3 | LLM thinking config — `google.LLM` accepts `thinking_config`? | **Yes.** `google.LLM.__init__` accepts `thinking_config: NotGivenOr[types.ThinkingConfigOrDict]`. `ThinkingConfig(thinking_level="low", include_thoughts=False)` is the correct form for Gemini 3 models (uses `_is_gemini_3_model()` routing). | HIGH [VERIFIED] |
| 4 | Pre-session context injection — `build_system_prompt(customer_context=..., intake_questions=...)` works on pipeline? | **Yes.** Pipeline passes `Agent.instructions` as system message on every LLM call via `chat_ctx.add_message(role="system", ...)`. Zero change needed. | HIGH [VERIFIED] |
| 5 | Silero VAD 2500ms port — exact kwarg? | **`min_silence_duration=2.5`** (seconds, float). This is the primary silence-end-of-speech kwarg. `activation_threshold=0.5` (default) does not need changing. | HIGH [VERIFIED from silero/vad.py source] |
| 6 | Latency measurement | Pipeline typical: STT ~200ms, LLM TTFT ~300–800ms, TTS ~100–200ms = ~600–1200ms per turn. Realtime was ~300ms. Expected delta: ~500ms added per turn. Document in SUMMARY post-UAT. | MEDIUM [ASSUMED from industry benchmarks] |
| 7 | Cost | STT (Cloud Speech v2): ~$0.004/min chirp_3; LLM (Gemini 3.1 Flash text): ~$0.075/M input tokens, ~$0.30/M output tokens; TTS (Gemini 2.5 Flash): ~$0.60/M chars. Realtime (Gemini Live): ~$3.50/M audio input tokens. Pipeline likely CHEAPER at current pricing. Measure post-UAT. | LOW [ASSUMED — pricing subject to change] |
| 8 | Egress compatibility | **Compatible.** `lk.egress.start_room_composite_egress` operates at the LiveKit room level (recording room audio tracks), not the agent session level. Pipeline vs Realtime is invisible to egress. Unchanged. | HIGH [VERIFIED from docs + egress API docs] |
| 9 | `[goodbye_race]` hook mapping | `text_done`/`audio_done` will be `False` on pipeline (synchronizer not in pipeline path). `last_text_token_at` fires once-per-turn (on chat_ctx commit), not per-token. All other fields (`end_call_invoked_at`, `session_close_at`, `participant_disconnect_at`, `last_audio_frame_at`) carry over identically. | HIGH [VERIFIED from synchronizer.py + events.py] |
| 10 | Spanish locale on Chirp 3 | `languages="es-US"` + `detect_language=False` is the correct pin. Chirp 3 has better multilingual accuracy than older models. Chirp 3 transcription bug (PR #3628, merged Oct 2025) is fixed in 1.5.6. Production ES reliability unverified — validate in UAT. | MEDIUM [CITED: PR #3628] |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `session.output.audio.capture_frame` wrapping for `last_audio_frame_at` works on pipeline path (same `AudioOutput` interface as Realtime) | Common Pitfalls / Pattern 5 | LOW — AudioOutput is shared infrastructure, not Realtime-specific. If wrong, `last_audio_frame_at` stays 0. Instrumentation delta only; not a call-quality issue. |
| A2 | Silero VAD `onnxruntime` wheels are already installed on Railway from Phase 63 `livekit-plugins-silero==1.5.6` pin | Common Pitfalls / Pitfall 7 | LOW — Phase 63 pinned silero; Railway would have installed it even if unused. If wrong, add `onnxruntime>=1.17,<2` to pyproject.toml. |
| A3 | `google.LLM(model="gemini-3.1-flash")` works at runtime even though `"gemini-3.1-flash"` is not in `ChatModels` Literal | Standard Stack / Code Examples | LOW — LLM constructor accepts `ChatModels | str`; `_is_gemini_3_model("gemini-3.1-flash")` returns `True` because `"gemini-3" in "gemini-3.1-flash".lower()`. If wrong (e.g., Google API rejects the model string), fall back to `"gemini-3-flash-preview"` which IS in ChatModels. |
| A4 | Pipeline per-turn latency is acceptable for receptionist UX (~800–1200ms) | State of the Art / latency | MEDIUM — industry benchmarks suggest 600–1200ms is achievable. But Chirp 3 specifically had a 2.4s delay noted in issue #3495 comments. If latency proves unacceptable in UAT, `endpointing_sensitivity` tuning + streaming partial results mitigate. |
| A5 | `genai_types.ThinkingConfig(thinking_level="low", include_thoughts=False)` is valid for `google.LLM` — same object type used by Realtime | Code Examples | LOW — `google.LLM` and `google.realtime.RealtimeModel` both take `types.ThinkingConfig`. `_is_gemini_3_model()` routes Gemini 3 models to use `thinking_level`. Verified at the llm.py level. |

---

## Open Questions

1. **Latency validation**
   - What we know: industry benchmarks suggest 600–1200ms pipeline per-turn; Chirp 3 had a 2.4s outlier noted in issue comments.
   - What's unclear: actual per-turn latency on Railway with chirp_3 + gemini-3.1-flash + Gemini TTS on the SG tenant's network path.
   - Recommendation: measure in the UAT call. If p90 > 2s, enable `endpointing_sensitivity` tuning on Chirp 3 and increase LLM response caching. Do not block merge on latency.

2. **Spanish Chirp 3 quality**
   - What we know: Chirp 3 has enhanced multilingual accuracy. The transcription bug is fixed (PR #3628). `languages="es-US"` + `detect_language=False` is the correct configuration.
   - What's unclear: whether Chirp 3's ES-US accuracy on SIP telephony audio (8kHz, SG carrier) is better or worse than Gemini Live's native Spanish comprehension.
   - Recommendation: Place an ES UAT call in Phase 64 if feasible. If ES quality regresses, the `chirp_2` fallback is available. Do not block merge on ES UAT.

3. **Chirp 3 vs latest_long for phone audio**
   - What we know: Google offers `chirp_telephony` for 8kHz phone audio, but that is NOT in `SpeechModels` in the livekit-plugins-google plugin. `latest_long` is the default and is tuned for varied audio. `chirp_3` is best for multilingual.
   - What's unclear: which performs better on SIP-over-carrier 8kHz audio in practice.
   - Recommendation: Use `chirp_3` per D-07. If UAT transcription quality is poor, try `latest_long` as a quick fallback (single kwarg change, no other code change).

---

## Environment Availability

> Phase 64 is code changes only in `livekit-agent/`. External deps are identical to Phase 63.

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Python 3.11+ | livekit-agents 1.5.6 | Already in use | — | — |
| `livekit-plugins-silero==1.5.6` | `silero.VAD.load()` | Pinned in pyproject.toml from Phase 63 | 1.5.6 | — |
| `livekit-plugins-google==1.5.6` | `google.STT`, `google.LLM`, `GeminiTTS` | Pinned from Phase 63 | 1.5.6 | — |
| `google-cloud-speech>=2,<3` | `google.STT` streaming API | Transitive from livekit-plugins-google | >=2 | — |
| Railway deploy pipeline | Preview deploy gate | Already in use | — | — |
| Google Cloud Speech-to-Text API credentials | `google.STT` | Must be available via Application Default Credentials or `GOOGLE_APPLICATION_CREDENTIALS` env var | — | If missing, STT plugin raises at first call. Verify in Railway env. |
| pytest | Test gate | In `dev` extras | >=8.0 | — |

**Missing dependencies with no fallback:**
- `GOOGLE_APPLICATION_CREDENTIALS` or ADC configured for Cloud Speech-to-Text in Railway environment. The current setup uses Gemini Live (no Cloud STT call). Verify that Railway's service account has `roles/speech.admin` or `roles/speech.client` IAM permission for Cloud Speech v2. **This may be a blocker if credentials aren't already scoped for Cloud STT.**

**Missing dependencies with fallback:**
- None.

[ASSUMED: Current Railway service account may already have Cloud STT permissions (some Google credentials grant broad API access). Must verify before UAT.]

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `pytest>=8.0` + `pytest-asyncio>=0.23` |
| Config file | `livekit-agent/pyproject.toml` `[tool.pytest.ini_options]` |
| Quick run command | `cd /c/Users/leheh/.Projects/livekit-agent && pytest tests/test_prompt_greeting_directive.py tests/test_prompt_booking.py -x` |
| Full suite command | `cd /c/Users/leheh/.Projects/livekit-agent && pytest tests/ -x` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-03b | Silero VAD `min_silence_duration=2.5` is used in session construction | unit | `pytest tests/test_pipeline_session.py::test_vad_silence_threshold -x` | New file |
| D-03c | Greeting directive re-frame present in `_build_greeting_section` EN+ES | unit | `pytest tests/test_prompt_greeting_directive.py -x` | Exists (update) |
| D-03d | NO DOUBLE-BOOKING one-liner present in `_build_booking_section` EN+ES | unit | `pytest tests/test_prompt_booking.py -x` | Exists (update) |
| D-07 | STT `languages=` (plural) kwarg used, not `language=` | unit | `pytest tests/test_pipeline_session.py::test_stt_language_kwarg -x` | New file |
| D-07 | `detect_language=False` set for language-pinned STT | unit | `pytest tests/test_pipeline_session.py::test_stt_detect_language_disabled -x` | New file |
| D-04 | `silero.VAD` in session, no `turn_detector` | unit | `pytest tests/test_pipeline_session.py::test_no_turn_detector -x` | New file |
| D-09 | All 7 tools still accessible post-migration | smoke | `pytest tests/test_pipeline_session.py::test_tools_registered -x` | New file |
| UAT | End-to-end booking flow completes on Railway preview | e2e | Place UAT call on tenant phone; check Railway logs + calendar | manual only |

### Sampling Rate

- **Per task commit:** `pytest tests/test_prompt_greeting_directive.py tests/test_prompt_booking.py -x`
- **Per wave merge:** `pytest tests/ -x` (full suite, 205+ tests)
- **Phase gate:** Full suite green + Railway preview SUCCESS + one UAT call completes booking flow

### Wave 0 Gaps

- [ ] `tests/test_pipeline_session.py` — session construction invariants (STT kwarg name, VAD threshold, no turn_detector). New file needed.
- [ ] Update `tests/test_prompt_greeting_directive.py` — re-frame D-03c ("Greeting already delivered via system") in EN+ES.
- [ ] Update `tests/test_prompt_booking.py` — one-liner D-03d in EN+ES.

---

## Security Domain

> Treating `security_enforcement` as enabled (not explicitly disabled in config).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth surface changes |
| V3 Session Management | No | Session lifecycle unchanged; LiveKit room auth unchanged |
| V4 Access Control | No | RLS, route guards, subscription check all unchanged |
| V5 Input Validation | Partial | STT transcripts flow into LLM system prompt; prompt injection risk exists but unchanged from current Realtime path. `@function_tool` schema validation unchanged. |
| V6 Cryptography | No | No crypto changes |
| V14 Configuration | Yes | No new env vars needed; but `GOOGLE_APPLICATION_CREDENTIALS` must have Cloud STT scope |

### Known Threat Patterns for Pipeline Migration

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| STT transcript injection (malicious audio crafted to inject LLM prompts) | Tampering | Unchanged from Realtime path — prompt hardening via `_build_*_section` is the mitigation; no new attack surface |
| Google Cloud Speech API key exfiltration | Information Disclosure | ADC via Railway service account (no key in env) is the correct pattern; verify `GOOGLE_APPLICATION_CREDENTIALS` is service account, not user key |
| Silero ONNX model tampered in container | Tampering | `livekit-plugins-silero==1.5.6` pinned exact version (PyPI); model file bundled in package, not downloaded at runtime |

---

## Sources

### Primary (HIGH confidence — verified against 1.5.6 source)

- `livekit/agents` commit `25bd9c76b0e163195a6557f4a1528beaebeb2bd7` (livekit-agents@1.5.6 release):
  - `livekit-plugins/livekit-plugins-google/livekit/plugins/google/stt.py` — full `__init__` signature, `languages` kwarg confirmed, `detect_language`, `chirp_3` model, `endpointing_sensitivity`
  - `livekit-plugins/livekit-plugins-google/livekit/plugins/google/llm.py` — full `__init__` signature, `thinking_config: NotGivenOr[types.ThinkingConfigOrDict]`, `_is_gemini_3_model()` helper
  - `livekit-plugins/livekit-plugins-google/livekit/plugins/google/models.py` — `SpeechModels` Literal (`chirp_3` confirmed), `ChatModels` Literal (`"gemini-3.1-flash"` NOT listed; `str` accepted)
  - `livekit-plugins/livekit-plugins-google/livekit/plugins/google/beta/gemini_tts.py` — `TTS.__init__` (`voice_name`, `model`, `instructions`)
  - `livekit-plugins/livekit-plugins-silero/livekit/plugins/silero/vad.py` — `VAD.load()` signature, `min_silence_duration: float = 0.55`
  - `livekit-agents/livekit/agents/voice/agent_session.py` — `AgentSession.__init__` (`stt=`, `llm=`, `tts=`, `vad=` all confirmed)
  - `livekit-agents/livekit/agents/voice/agent_activity.py` — `say()` no-gate on pipeline, `_pipeline_reply_task_impl` tool execution, `update_chat_ctx`
  - `livekit-agents/livekit/agents/voice/events.py` — `ConversationItemAddedEvent`, `CloseEvent` field shapes
  - `livekit-agents/livekit/agents/voice/transcription/synchronizer.py` — `_SegmentSynchronizerImpl` confirmed absent from pipeline TTS output path

### Secondary (MEDIUM confidence — official docs)

- LiveKit Docs `https://docs.livekit.io/agents/models/stt/plugins/google/` — `chirp_3` model, `languages` parameter, `endpointing_sensitivity`
- GitHub PR `#3628` (merged Oct 2025) — Chirp 3 transcription bug fix
- LiveKit Blog "Sequential Pipeline Architecture for Voice Agents" — pipeline quickstart pattern

### Tertiary (LOW confidence — industry benchmarks)

- Medium article "Building Real-Time Voice AI: Latency Tests Lessons" — STT/LLM/TTS latency benchmarks (600–1200ms per turn)
- DEV Community "Cracking the < 1-second Voice Loop" — latency benchmark data points
- Google Pricing (ASSUMED — subject to change without notice)

---

## Metadata

**Confidence breakdown:**
- Session construction (AgentSession kwargs, plugin signatures): HIGH — verified source
- `languages` vs `language` kwarg difference: HIGH — verified source (critical rename)
- Tool calling on pipeline: HIGH — verified from agent_activity.py
- Goodbye-race field mapping: HIGH — verified from synchronizer.py + events.py
- Silero VAD `min_silence_duration`: HIGH — verified from silero/vad.py source
- LLM thinking_config on pipeline: HIGH — verified from llm.py
- Latency baseline: MEDIUM — industry benchmarks, not measured
- Google Cloud STT credentials scope: ASSUMED — flag for executor to verify
- ES/chirp_3 quality: MEDIUM — bug fixed, production quality unverified

**Research date:** 2026-04-24
**Valid until:** 2026-05-24 (stable SDK; re-verify if livekit-agents 1.5.7 ships)

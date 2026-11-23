---
type: reference
date: 2026-04-20
status: historical
description: "In livekit-agents 1.5.1 + plugin @43d3734, context.session.say(...) silently fails with \"trying to generate speech from text without a TTS model\" when AgentSession is wired as AgentSession(llm=RealtimeModel) with no TTS attached. Don't use session.say() for programmatic filler audio on Gemini Live sessions."
source: "Claude memory note reference_livekit_session_say_no_tts.md"
migrated: 2026-11-23
tags: [voco/reference]
---

# LiveKit gotcha - session.say needs TTS on RealtimeModel sessions
In the `livekit-agent` sibling repo (`C:/Users/leheh/.Projects/livekit-agent`), the session is wired as `AgentSession(llm=google.realtime.RealtimeModel(...))` with no TTS. In livekit-agents 1.5.1, `context.session.say(phrase, allow_interruptions=False)` inside a function_tool raises `"trying to generate speech from text without a TTS model"` on every invocation — the `try/except` in the tool swallows it, the caller hears silence.

Phase 60.2 Fix H tried this approach; it was reverted in sibling-repo commit `cbe1bb9` after the live UAT surfaced the failure. See `.planning/phases/60.2-voice-tool-call-filler-race-and-vad-tuning/60.2-05-SUMMARY.md` and `60.2-HUMAN-UAT.md` for the full root-cause trace.

If you need programmatic audio (filler phrases, notifications, etc.) on this session shape in this pinned stack, you must either:
1. **Attach a TTS to the AgentSession** — accepts a voice mismatch with Gemini's native voice for short programmatic phrases. Unattractive because the filler voice differs from the conversational voice.
2. **Publish a separate audio track** — play pre-recorded filler clips through a dedicated LiveKit AudioSource/AudioTrack. Bypasses the model pipeline entirely.
3. **Rely on the prompt** — tell Gemini to speak its own filler before tool calls. This is what `_build_tool_narration_section()` in `src/prompt.py` does today. The risk is Gemini interleaves the filler with the function call and server-VAD cancels it mid-word. Phase 60.2 Fix G (raising server-VAD `silence_duration_ms` from 1000 → 1500 ms in `src/agent.py`) mitigates this race.

Do NOT re-land `session.say()` without acknowledging this — the `tests/test_prompt.py` in the sibling repo is specifically designed to catch a re-introduction of the "runtime plays filler" prompt claim.

Also: `allow_interruptions=False` is silently downgraded to `NOT_GIVEN` by livekit-agents 1.5.1 when the LLM is a RealtimeModel with server-side turn detection (`agent_activity.py:905-914`). Don't rely on that kwarg for un-interruption guarantees — you need the VAD thresholds in `realtime_input_config` instead.

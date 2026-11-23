---
type: reference
date: 2026-04-24
status: historical
description: "On livekit-plugins-google ==1.5.6, session.generate_reply() is silently ignored when the RealtimeModel uses 'gemini-3.1-flash-live-preview'; plugin logs \"generate_reply is not compatible\" warning"
source: "Claude memory note reference_livekit_generate_reply_gemini31.md"
migrated: 2026-11-23
tags: [voco/reference]
---

# LiveKit gotcha - generate_reply dropped on Gemini 3.1
On **livekit-plugins-google 1.5.6** (mainline, 2026-04-22), `session.generate_reply(instructions=...)` is silently dropped when `RealtimeModel(model='gemini-3.1-flash-live-preview', ...)` is used. The plugin emits:

- WARN: `'gemini-3.1-flash-live-preview' has limited mid-session update support. instructions, chat context, and tool updates will not be applied until the next session.`
- WARN: `generate_reply is not compatible with 'gemini-3.1-flash-live-preview' and will be ignored.`
- ERROR: `failed to generate a reply: generate_reply is not compatible with 'gemini-3.1-flash-live-preview'`

**Observed impact (UAT call `call-_+65XXXXXXXX_XwbNh8W3js2h` on 2026-04-23 post-Phase-63 merge):**
- Opening greeting at `livekit-agent/src/agent.py:755` (`session.generate_reply(instructions="Greet the caller now.")`) silently fails → agent is silent on connect, only responds after caller speaks first
- Mid-call intake questions injection at `src/agent.py:712` silently fails → tenant-configured extra questions never reach the model

**Why Phase 63's preflight missed it:** Explicit `RealtimeModel(...)` construction smoke (Task 2 Step 4) only exercises `__init__` validation. `generate_reply` compatibility is a session-runtime check, not a construction check.

**Why:** This was NOT caught by pre-merge audit because the audit only verified API surface existence, not per-model compatibility matrices. Model-specific routing was introduced in PR #5413 (the "capability-based Gemini 3.1 tool-response routing" payoff that motivated Phase 63).

**How to apply:** On any future Gemini-3.x-Flash-Live work, do NOT rely on `session.generate_reply()` for greeting, intake injection, or mid-session context updates. The sanctioned 1.5.6+ patterns are:
- Rely on `RealtimeModel(instructions=...)` at construction for system prompt (honored at session start)
- For proactive opening turn: either let Gemini's server VAD fire naturally on SIP connect, OR push a synthetic user turn via `session.input.transcription` (verify before using)
- For mid-session dynamic context: re-construct the session, or thread context through tool responses instead
- `session.say()` still fails on RealtimeModel without TTS (per `reference_livekit_session_say_no_tts.md`)

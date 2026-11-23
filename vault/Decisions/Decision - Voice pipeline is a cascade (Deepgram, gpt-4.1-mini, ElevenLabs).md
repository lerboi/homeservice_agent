---
type: decision
date: 2026-06-09
status: current
description: "The agent uses a cascaded speech-to-text → LLM → text-to-speech pipeline instead of a speech-to-speech realtime model. History of how it got there."
tags: [voco/decision]
---

# Decision - Voice pipeline is a cascade (Deepgram, gpt-4.1-mini, ElevenLabs)

## Context
The agent started on Gemini Live (speech to speech). A server-side cancellation cascade caused dropped tool results and silences that prompt changes could not fix. A move to OpenAI gpt-realtime-2 was planned, then replaced by a cascaded pipeline.

## Decision
Deepgram nova-3 (multilingual) for speech to text, OpenAI gpt-4.1-mini for reasoning and tool calls, ElevenLabs flash v2.5 for speech, on LiveKit Agents (1.8.0 since 2026-09-09) with the audio turn detector.

## Consequences
- Notes marked `historical` under [[Voice Agent]] describe the Gemini and realtime eras and are kept for their reasoning only.
- `CLAUDE.md` used to say "Gemini 3.1 Flash Live"; that was stale and was corrected in the vault migration.
- Voice quality depends on a valid ElevenLabs secret key; an invalid key silently falls back to OpenAI TTS.

## Sources
[[2026-05-06 Phase 61 Gemini cancellation cascade failure mode]], [[2026-06-05 OpenAI gpt-realtime-2 migration plan]], [[2026-06-09 Cascade pipeline migration (Deepgram + gpt-4.1-mini + ElevenLabs)]], [[2026-09-09 Call-experience items 1, 2, 3, 5 shipped]], [[Decision - Stay on gpt-4.1-mini (no Cerebras or Groq)]].

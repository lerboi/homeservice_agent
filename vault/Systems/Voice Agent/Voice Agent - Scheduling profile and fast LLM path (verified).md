---
type: system
system: Voice Agent
status: current
description: "What the deployed agent runs since 2026-11-23: the short scheduling prompt, the five-tool surface, Groq Qwen first with gpt-4.1-mini fallback, the tuned end-of-turn settings, and the env switches that revert each one. Read this before any other Voice Agent note."
verified: 2026-11-23
tags: [voco/system/voice-agent]
---

# Scheduling profile and fast LLM path (verified)

Part of [[Voice Agent]]. Shipped in `livekit-agent` commit `c1b048e`. Where older notes in this folder describe the home-service receptionist (address intake, urgency triage, transfer, lead capture, a 6,400-token prompt), they describe the `home_service` profile, which is still in the code but is no longer the default.

## What runs by default

| Piece | Default | Where | Revert with |
|---|---|---|---|
| Agent profile | `scheduling` | `AGENT_PROFILE` in `src/agent.py` | `VOCO_AGENT_PROFILE=home_service` |
| Prompt | `build_scheduling_prompt()` in `src/prompt.py`, about 720 tokens, plus the working-hours section and the "Today is" line | `_render_prompt` in `src/agent.py` | profile switch |
| Tools | `check_slot`, `check_day`, `next_available_days`, `book_appointment`, `end_call` | `create_tools` in `src/tools/__init__.py` | profile switch |
| LLM | Groq `qwen/qwen3.8-27b`, then OpenAI `gpt-4.1-mini` through `llm.FallbackAdapter` (4 s attempt timeout) | LLM block in `src/agent.py` | `VOCO_LLM_PROVIDER=openai`; model via `VOCO_GROQ_MODEL` |
| End of speech | Silero `min_silence_duration` 0.3 s (SDK default 0.55) | `VAD_MIN_SILENCE_S` | `VOCO_VAD_MIN_SILENCE_S=0.55` |
| Early speech synthesis | `preemptive_tts` on | `turn_handling` | `VOCO_PREEMPTIVE_TTS=false` |
| Worker name | `voco-voice-agent` | `WorkerOptions` | `VOCO_AGENT_NAME` (dev workers only) |

Groq is used only with the scheduling profile: with the long home-service prompt it showed no speed advantage. It needs `GROQ_API_KEY` in the Railway service; without it the agent logs `LLM: openai …` and runs on gpt-4.1-mini alone.

## Booking in the scheduling profile
`book_appointment` uses `_BOOK_APPOINTMENT_SCHEDULING_SCHEMA` (`src/tools/book_appointment.py`): `slot_token`, `caller_name`, optional `reason`. There is no address: validation is skipped, `service_address` is stored as "Not applicable", and the reason is written to `appointments.notes`. The success return is `BOOKED: confirm the day and time […]`. Everything after that is unchanged: [[Scheduling - Booking to calendar on agent calls (verified path)]].

## How to tell what a call used
Every call logs one line at start: `[agent] LLM: groq qwen/qwen3.8-27b (reasoning=off) -> fallback openai gpt-4.1-mini`, or `[agent] LLM: openai …`. Each LLM request logs `llm_metrics … provider=groq|openai ttft=…`. A turn served by `provider=openai` while Groq is configured is a fallback; the adapter logs `switching to next LLM` with the reason.

## Why these choices
Measurements, the model bake-off and the rejected option (Groq `gpt-oss-120b`: erratic first token, and it booked before the caller confirmed) are in [[2026-11-23 Pipeline health check before the demo]]. This supersedes [[Decision - Stay on gpt-4.1-mini (no Cerebras or Groq)]] for the scheduling profile only.

## Known gaps
- No automated tests cover the scheduling prompt, the scheduling tool schema or the provider selection yet.
- The confirm-then-book rule is enforced by the prompt, not by code. Qwen followed it in every scripted call so far; a code-level gate does not exist.
- The agent sometimes speaks its own filler ("Okay, booking that in for you") although the prompt tells it not to.
- Measuring: `python vault/_meta/tools/baseline_call.py <tenant_id> <tenant_phone>`.

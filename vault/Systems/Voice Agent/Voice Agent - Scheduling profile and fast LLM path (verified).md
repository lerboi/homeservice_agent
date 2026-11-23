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

## Safeguards added on the `demo-studio` branch (2026-11-23, not yet deployed)

| Safeguard | What it does | Where | Switch |
|---|---|---|---|
| Booking-claim guard | On turns between an offer and a booking, holds back the first 90 characters of the reply. If they state the booking is done and there is no tool call, the reply is dropped unspoken and the turn is re-run with `book_appointment` forced. At most twice per call. | `src/lib/booking_claim_guard.py`, `VocoAgent.llm_node` in `src/agent.py` | `VOCO_BOOKING_CLAIM_GUARD=false` |
| Confirm-then-book gate | Refuses, once per slot, a booking for a time first offered after the caller's last turn, and tells the model to read it back and ask. | `src/tools/book_appointment.py` (search for `Confirm-then-book gate`) | `VOCO_CONFIRM_GATE=false` |

Why the guard exists: on a scripted call Qwen answered "yes, please book it" with "You're booked for tomorrow at twelve noon" and never called the tool. See [[2026-11-23 Demo Studio build]]. The gate only catches look-up-and-book in the same turn; it cannot tell whether a "yes" was really a yes.

Scheduling bookings now write a calendar event titled `<caller>: <reason>` with the body "Booked by the Voco voice agent" (`src/lib/calendar_text.py`), for real calls as well as demos.

## Tests
`tests/test_scheduling_profile.py` (prompt invariants, the five tools, the booking schema, provider selection and fallback wiring, env switches), `tests/test_booking_claim_guard.py`, and the gate tests in `tests/test_demo_studio.py`. The provider block sits inside the entrypoint, so its wiring is checked against the source text rather than by running it.

## Known gaps
- The agent sometimes speaks its own filler ("Alright, locking that in now") although the prompt tells it not to.
- The guard reads English. A false confirmation in another language passes.
- The greeting starts about 2 s after dispatch.
- Measuring: `python vault/_meta/tools/baseline_call.py <tenant_id> <tenant_phone>`.

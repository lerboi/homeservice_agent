---
type: log
date: 2026-11-23
status: record
description: "Scripted test call against the deployed agent found it cannot hold a conversation: the OpenAI key is rejected (401). Also: ElevenLabs is on the free plan so the production voices cannot be used, the voco tenant has no phone number, and the regions are spread across three continents."
verified: 2026-11-23
tags: [voco/log]
---

# 2026-11-23 Pipeline health check before the demo

## What was done
A scripted, sandboxed browser-style call was placed against the deployed Railway worker (`vault/_meta/tools/baseline_call.py`: creates a `test-web-` room, publishes synthesized caller audio, measures the gap to the agent's first audio). Room `test-web-24141cd0-…-1795441622312`, 13:47 UTC. Railway logs were read for the same window, and the local API keys were tested for validity (status codes only).

## Findings

1. **The agent is down for every call.** OpenAI returns `401 invalid_api_key` for the key on Railway (ends `KS0A`); the same key is in the Next app's `.env.local` and is also rejected. The agent greets, the first LLM request fails, it says "Sorry, the line's breaking up on my end. Someone from the team will call you right back", and the call ends after 12 seconds. The prompt-cache warm-up and triage layer 2 fail the same way. This probably also explains the 31-second production call on 2026-10-21.
2. **ElevenLabs is on the free plan.** The API answers `paid_plan_required: Free users cannot use library voices via the API`. The three production voices (Alexandra, Eryn, Cassidy) are library voices and are not in the account, so the agent logs an error and substitutes the premade voice Sarah on every call. The key itself is a valid `sk_` secret without the `user_read` permission.
3. **The `voco` tenant cannot take calls.** Its `phone_number` is an empty string. The only tenant with a real number is "Make It AI" (`24141cd0…`), which is owned by the owner's login, is the admin account, and has a (stale) Google connection. The demo should use that tenant.
4. **Regions.** Railway worker: europe-west4 (Netherlands). LiveKit: the worker registers in "Germany 2" and media ran through Frankfurt. Supabase: Tokyo. The pre-call database queries took 1.41 s.
5. **Timings seen before the failure.** Job received → agent speaking: about 2.8 s. ElevenLabs time to first byte: 0.58 s on the greeting (cold), 0.09 s on the next utterance (warm). Turn detector: LiveKit audio model v1, dynamic endpointing 0.30 to 1.20 s, adaptive interruptions, preemptive generation on.
6. **Reconnect bug.** `src/app/api/google-calendar/callback/route.js:48` sets `is_primary` from "no rows exist yet", so reconnecting an already-connected Google calendar flips it to non-primary. The agent still finds it (it falls back to any credential), but disconnect-then-connect avoids the problem until it is fixed.
7. The agent repo's local `.env` still holds the old ElevenLabs key ID (not an `sk_` secret) and has no `OPENAI_API_KEY`; a local worker cannot run from it.

## Open items
- Owner: new OpenAI API key on Railway, Vercel and `.env.local`.
- Owner: ElevenLabs paid plan, then add the three voices to "My Voices".
- Then rerun `baseline_call.py` for real per-turn latency before choosing any provider change.
- Fix the `is_primary` reconnect behaviour as part of [[Plan 3 - Demo Studio]].

## Follow-up the same day: keys fixed, first real baseline

The owner replaced the OpenAI key (Railway redeployed) and moved ElevenLabs to a paid plan. The scripted call then completed four turns (room `test-web-24141cd0-...-1795442736562`, 14:05 UTC).

**Voice-to-voice gap (end of caller audio to first agent audio, measured at the client):** 1.65 s, 1.74 s, 2.10 s, 1.70 s. Dispatch to first greeting audio: 2.23 s.

**Where the time goes (Railway `turn_metrics` / `llm_metrics` for the same call):**

| Stage | Measured | Share |
|---|---|---|
| End-of-turn decision (`eot_delay`) | 0.58 s on every turn | about 35% |
| LLM time to first token (gpt-4.1-mini, about 6,450 prompt tokens, about 6,270 cached) | 0.86 to 1.04 s | about 58% |
| TTS time to first byte (ElevenLabs Flash v2.5, warm) | 0.10 s | about 6% |
| Network and playout to the client | about 0.1 s | |

Transcription delay was 0.29 to 0.39 s and sits inside the end-of-turn window.

**LLM bake-off** (`vault/_meta/tools/llm_ttft_bench.py`, 6 runs per cell after a warm-up, streamed, with four tool schemas, measured from the owner's machine, so it ranks models and is not a production number). Median seconds to first token:

| Model | Short prompt (about 300 tokens) plain / tool turn | Long prompt (about 6,000 tokens) plain / tool turn | Tool choice |
|---|---|---|---|
| gpt-4.1-mini (current) | 0.66 / 0.77 | 0.64 / 0.76 | correct |
| gpt-5.4-nano | 0.58 / 0.66 | 0.62 / 0.70 | correct |
| gpt-5.4-mini | 0.76 / 0.72 | 0.67 / 0.70 | correct |
| gpt-5.6-luna | 0.92 / 1.03 | 0.78 / 0.84 | correct |
| gpt-6-luna | 0.77 / 0.85 | 1.02 / 1.08 | called a tool on the plain turn (long prompt) |
| Groq openai/gpt-oss-120b | 0.22 / 0.29 | 1.25 / 0.74 (very uneven, 0.22 to 4.31) | correct |
| Groq openai/gpt-oss-20b | 0.22 / 0.23 | 0.53 / 0.27 | called a tool on the plain turn (short prompt) |
| Groq qwen/qwen3.8-27b | 0.21 / 0.22 | 0.63 / 0.81 | correct |

Reading: no OpenAI model is meaningfully faster than gpt-4.1-mini. Groq-hosted models are about three times faster, but only with a short prompt; with a 6,000-token prompt the advantage disappears or becomes erratic. One tool-choice check per cell is not evidence of tool reliability.

**Still wrong:** the three production voices are usable through the API now (HTTP 200) but are not saved in the account's "My Voices", so the agent's availability check still substitutes Sarah.

## Fast path built and measured (same day, branch `feat/scheduling-profile-fast-llm` in livekit-agent, uncommitted, not deployed)

Owner's decision: demo and production use the same, fastest configuration; phone calls are set aside. Changes, each reversible by env var:

- `VOCO_AGENT_PROFILE=scheduling` (default): `build_scheduling_prompt()` in `src/prompt.py` (about 720 tokens) and five tools (check_slot, check_day, next_available_days, book_appointment, end_call). `book_appointment` takes slot_token, caller_name, reason; no address validation; the reason is saved to `appointments.notes`. `home_service` restores the old agent.
- `VOCO_LLM_PROVIDER=groq` (default): Groq `qwen/qwen3.8-27b` first, gpt-4.1-mini as the FallbackAdapter second leg (4 s attempt timeout). Needs `GROQ_API_KEY` on Railway.
- `VOCO_VAD_MIN_SILENCE_S=0.3` (SDK default 0.55), `VOCO_PREEMPTIVE_TTS=true`, `VOCO_AGENT_NAME` (lets a dev worker register under another name so it never takes production dispatches).

Scripted six-turn booking call against a LOCAL dev worker (owner's machine, so not directly comparable with the Railway baseline):

| Configuration | Voice-to-voice gap per turn | LLM first token | Behaviour |
|---|---|---|---|
| Baseline on Railway (gpt-4.1-mini, 6.4k prompt) | 1.65 / 1.74 / 2.10 / 1.70 s | 0.86 to 1.04 s | asked for an address before anything else |
| Groq gpt-oss-120b | 0.98 / 3.34 / 6.78 / 2.69 / 1.27 s | 0.27 s to 2.6 s, one 4 s timeout | **booked before the caller said yes**; no goodbye |
| Groq qwen3.8-27b | 1.84 / 1.07 / 1.46 / 1.03 / 1.43 / 1.06 s | 0.32 to 0.39 s on plain turns | correct: offered times, read back, waited for yes, booked, said goodbye |

gpt-oss-120b is a reasoning model: its first token is fast when it does not think and slow when it does, and it combined the readback and the booking in one response. qwen3.8-27b was steady and followed the confirm-then-book rule. In the qwen run the first turn (1.84 s) was served by the OpenAI fallback: the prompt-cache warm-up request has no user message, Groq/Qwen rejects that with a 400, and the FallbackAdapter then marked Groq unavailable. Fixed by warming each LLM leg directly (the Groq warm gets a throwaway user turn). Two further scripted calls after the fix: 12 turns, gaps 1.00 to 1.77 s (median about 1.2 s), zero fallbacks, both calls offered times, read back, waited for yes, booked and said goodbye. Groq first token 0.30 to 0.65 s on most requests, with occasional 0.8 to 1.5 s. End-of-turn delay fell from 0.58 s to about 0.45 to 0.49 s.

One call per configuration is not enough to call qwen reliable. Tests: 663 passed, the same one pre-existing failure; no new tests were written for the new code yet.

## Deployed (agent commit `c1b048e`, 14:50 UTC)

Owner approved the push; `GROQ_API_KEY` was already on Railway and the three voices were added to "My Voices". Two scripted calls against the deployed worker: gaps 0.98 / 1.50 / 1.01 / 1.05 / 2.88 s and 1.17 / 1.32 / 1.44 / 1.09 / 2.14 s (the last figure in each is the turn that books). Logs confirm `LLM: groq qwen/qwen3.8-27b -> fallback openai gpt-4.1-mini`, no fallback switches, voice `kdmDKE6EkgrWrrykO9Qt` (Alexandra) with no substitution, `book_appointment` success with the reason saved, `end_call`, and the sandbox auto-cancel. Current description of the deployed setup: [[Voice Agent - Scheduling profile and fast LLM path (verified)]].

Related: [[Now]], [[Demo Studio]], [[Run a browser test call]].

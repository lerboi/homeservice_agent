---
type: log
date: 2026-09-01
status: record
description: "2026-09-01 decision NOT to move the voice LLM to Cerebras/Groq (open-weight-only, reasoning-model TTFT worse) + prompt caching COMMITTED+PUSHED to livekit-agent main (b33c1d6) + skill sync on main repo (1aa6d0e); the two live bugs it found (Groq triage model deprecated, stale slot_token books wrong day) were FIXED + PUSHED 2026-09-04 (livekit-agent a490a0f / b22d8c7)"
source: "Claude memory note project_2026_09_01_llm_provider_decision_and_prompt_caching.md"
migrated: 2026-11-23
tags: [voco/log]
---

# 2026-09-01 LLM provider decision and prompt caching
**Decision (2026-09-01): keep OpenAI gpt-4.1-mini as the voice LLM; do not switch to Cerebras or Groq.**
User asked whether fast-inference providers were "all upside." Verified live: Cerebras serves only `gemma-4-31b` + `gpt-oss-120b`; Groq production LLMs are only `llama-3.1-8b-instant`, `llama-3.3-70b-versatile`, `gpt-oss-120b/20b`. Switching provider = switching model family. `gpt-oss-120b` is a reasoning model, so time-to-first-*answer*-token is WORSE than gpt-4.1-mini (Cerebras ~1.7s, Groq ~4.9s vs 0.87s at 10k input — ArtificialAnalysis via research pass). `with_groq` does not exist in pinned livekit-plugins-openai 1.5.7; `with_cerebras()` defaults to an unserved model and lacks `max_completion_tokens`. All 7 adversarial lenses returned not-a-pure-win. If lower LLM latency is still wanted later: `gpt-5.6-luna` with explicit `reasoning_effort="none"` (verified real, $0.20/$1.20 per 1M, supports `none`; plugin auto-default list does NOT include it). Cerebras is acceptable only as the SECOND leg of an `llm.FallbackAdapter`, never primary.

**Biggest latency lever ranked:** (1) `VOCO_MAX_ENDPOINTING_DELAY_S` 2.0 → 1.2 on Railway (not yet done — user's call); (2) prompt caching (DONE, pushed b33c1d6); (3) `preemptive_tts=True` via `turn_handling=TurnHandlingOptions` (not done).

**Prompt caching implemented 2026-09-01, COMMITTED + PUSHED — livekit-agent main `b33c1d6`, main-repo skill sync `1aa6d0e` (Railway deploys agent from main)** (`src/prompt.py`, `src/agent.py`, new `tests/test_prompt_cache_prefix.py` + `tests/test_llm_cache_warm.py`; skill updated). Per-caller prompt sections moved to just before FINAL recap; `prompt_cache_key=f"voco-agent:{tenant_id}"`; `@llm.on("metrics_collected")` logs ttft/cached_tokens; `_warm_prompt_cache()` background request during greeting (`VOCO_LLM_CACHE_WARM`, default on). `prompt_cache_retention="24h"` is NOT available for gpt-4.1-mini — that is why the warm request exists. Suite 535 passed / same pre-existing VIP failure. **Live verification pending**: Railway logs should show `[agent] llm_metrics … cached_tokens≈0` on the warm line and ≈prompt size on turn 1.

**Two live bugs found — BOTH FIXED 2026-09-04 in the working tree (P1.1 + P1.2 of the Phase 0+1 pass, pushed as a490a0f + b22d8c7; see [[2026-09-04 Call-experience Phase 0 and 1 executed]]). Original findings:**
1. Post-call triage layer 2 (`src/lib/triage/layer2_llm.py:44`) pins Groq `meta-llama/llama-4-scout-17b-16e-instruct` — Groq deprecated 2026-06-17, shut down 2026-07-17; blanket `except` returns `routine/low`, and `GROQ_API_KEY` is not in boot preflight. Emergency urgency likely silently downgraded since mid-July. Fix (revised 2026-09-04): move layer 2 to OpenAI `gpt-4.1-nano` via the existing OPENAI_API_KEY (Groq's non-reasoning Llama models were all shut down 2026-08-16; gpt-oss are reasoning models that would truncate at max_tokens=100), split the except.
2. Stale `_last_offered_token`: written only by `check_slot`, cleared only by `check_slot` alternatives branch + `book_appointment` success; `check_day` never clears it. `book_appointment.py:350-388` recovery can book the PREVIOUS day's slot while the agent confirms the new day aloud. Fix: `deps.pop("_last_offered_token", None)` in `check_day`, and make recovery return `STATE:booking_invalid` instead of silently booking.
3. Minor: `src/app/(public)/privacy/page.js:79` still says calls are answered by "Google's Gemini model" (false since June).

**Why:** the provider question keeps resurfacing as "fast = free win"; this records the verified reasons it is not, and the actually-ranked levers.
**How to apply:** when latency comes up, point at endpointing/caching/preemptive_tts first; do not propose Groq/Cerebras as primary. When triage or booking correctness comes up, surface bugs 1-2 first. Related: [[2026-08-19 Voice latency and reliability pass]], [[2026-06-18 LiveKit agent deep read - reliability risks]].

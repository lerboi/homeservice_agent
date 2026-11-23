---
type: reference
date: 2026-09-02
status: current
description: "2026-09-02 four-phase plan to make the Voco voice agent faster / stop dead air / sound natural, published as an artifact; ranked levers (Flux EOT, Tokyo→US Supabase, prompt de-interrogation, address-loop cap) + 71-invariant functionality guarantee"
source: "Claude memory note reference_2026_09_02_call_experience_plan.md"
migrated: 2026-11-23
tags: [voco/reference]
---

# Call-experience four-phase plan (2026-09-02)
**Artifact:** https://claude.ai/code/artifact/c6154045-8065-4935-b14e-555a9eb15689 ("Voco Call Experience Plan", v1 2026-09-02). Prompt caching shipped 2026-09-01 (see [[2026-09-01 LLM provider decision and prompt caching]]); **Phase 0 + Phase 1 implemented and PUSHED 2026-09-04 (livekit-agent d901df5..0c7715b)** — status, deviations and the not-done list in [[2026-09-04 Call-experience Phase 0 and 1 executed]]. Phases 2-4 not started.

**Baseline (measured from Supabase, real calls):** 71/141 all-time calls = caller hang-up with no booking attempt; 4/8 cascade-era calls hung up inside the address step; 76% of agent turns are questions; ~20 words/agent turn; 17-22 agent turns per successful booking; 14/21 address validations `unconfirmed`; "Let me just check that address real quick." 7× in 4 calls.

**Five root causes:** (A) 2025 turn-taking — Silero + deprecated text `MultilingualModel` + 0.4-2.0s endpointing; (B) Supabase in Tokyo (`ap-northeast-1`) while worker + vendors are US → ~130ms/query, 4-5 sequential pre-greeting, 5-6 per booking, + fresh TLS per forked job process (httpx keepalive_expiry 5s); (C) prompt teaches interrogation — ~95 rules, literal filler in tool descriptions, two SCHEDULING contradictions, "confirm receipt" acknowledgements; (D) address loop has no code cap (prose only) → blocks booking; (E) no LLM fallback/timeout (~32s worst stall), no audio masking, interruption on defaults.

**Ranked plan:** P0 measure (ChatMessage.metrics, keep turn timestamps, confirm regions). P1 this week: code-cap address loop, SG postal-first via OneMap (free, verified), endpointing max 1.2, rotating filler bank + strip literals from tool descriptions, acknowledge+act, fix SCHEDULING contradictions, shorter tiered greeting (owner decides disclosure), Supabase keepalive+prewarm, num_idle_processes=2, repin Groq triage model, clear stale slot token in check_day. P2: Deepgram Flux multi via `deepgram.STTv2(model="flux-general-multi")` + `turn_detection="stt"` (already in installed 1.5.7), preemptive_tts via TurnHandlingOptions, adaptive interruption, BackgroundAudioPlayer thinking sound, greet-then-update_instructions, cached greeting audio, llm.FallbackAdapter + timeouts, single webhook RPC, speech-formatted tool times. P3: align Twilio/LiveKit/Railway on US-East (never move worker to SG), migrate Supabase to worker region, 2 replicas + committed dispatch rule, ringback, SDK bump to 1.7.x last. P4: reorder intake (issue → name/phone via caller ID → postal → offer times → street after slot), emergency branch, ~4.8k-token consolidated prompt, repair-without-script, close-with-SMS, SMS address-correction fallback.

**Best-in-class verdicts (research pass):** turn-taking BEHIND; TTS AT PAR (Flash v2.5 is the mainstream choice); LLM AT PAR on model, BEHIND on masking; cascade-over-S2S RIGHT CALL (best S2S = 60% multi-step tool pass rate; Gemini Live sync-only tools); conversation design BEHIND.

**Guarantee:** prompt audit inventoried 71 invariants in 12 groups with test pins; every rewrite maps to them; all runtime changes env-flagged; prompt changes must pass the suite unmodified + 20 EN/20 ES sandbox calls.

**Execution handoff for Phase 0 + 1 (verified against code + installed SDK 2026-09-02):** `C:/Users/leheh/.Projects/livekit-agent/docs/PLAN-2026-09-02-phase0-phase1.md` — read it first when asked to execute; it lists pinned test literals per task, the OneMap request shape, and the decisions (triage layer 2 moves OFF Groq to OpenAI gpt-4.1-nano — Groq shut down llama-3.3-70b + llama-3.1-8b on 2026-08-16 and only serves reasoning models now; do NOT touch book_appointment recovery; greeting strings unpinned).

**How to apply:** when the user asks to start improving the agent, execute phases in order from the artifact; don't re-derive the diagnosis. The dead-air root-cause subagent failed on rate limit — its gaps were closed manually (tools all use to_thread; interruption only `allow_interruptions=True`; Deepgram v1 defaults endpointing_ms=25, numerals=False).

---
type: log
date: 2026-09-08
status: record
description: "2026-09-08/09 research on SOTA cascaded voice agents + gap analysis of the livekit-agent pipeline; reports at [[Research - Natural-sounding cascaded voice agents (2026-09)]] and [[Research - Voice pipeline gap analysis (2026-09)]]; recommendations delivered, NO code changed yet"
source: "Claude memory note project_2026_09_08_voice_naturalness_research.md"
migrated: 2026-11-23
tags: [voco/log]
---

# 2026-09-08 Voice naturalness research and gap analysis (summary)
On 2026-09-08/09 the user asked for pure online research (explicitly "no need to refer to my code yet") on how people build the most natural-sounding cascaded voice agents. Full sourced report saved at [[Research - Natural-sounding cascaded voice agents (2026-09)]] (sections: reference stacks, STT, EOT/interruptions, LLM+prompting, TTS, orchestration, S2S-vs-cascade, cost).

Headline findings (all from 2026 sources):
- Turn-taking is the #1 naturalness lever. LiveKit Turn Detector v1 (audio-native, Jun 2026, free on LiveKit Cloud) leads eot-bench (4.5% false cutoffs @600 ms). The text `MultilingualModel` turn detector is deprecated, removal in SDK 2.0. LiveKit adaptive interruption mode + Deepgram backchannel token rule is the consensus barge-in setup.
- STT: AssemblyAI Universal-3.5 Pro Realtime is #1 on Pipecat stt-benchmark and Coval; Soniox v5 is the cheap near-equal; Deepgram Flux is fastest single-vendor EOT path but 1.5–2x the WER of leaders; Nova-3 fastest finals but no EOT.
- TTS leaders changed Aug–Sep 2026: Cartesia Sonic-3.6 #1 on Artificial Analysis, Inworld Realtime TTS-2 #2 (fastest measured, 164 ms P50 Coval), ElevenLabs Eleven v3 Conversational #8 (best WER, 385 ms, Text-to-Dialogue WS only, PVCs degrade). ElevenLabs Flash v2.5 is now mid-table (Vapi Humanness 68, rank 15/21) and does not normalize numbers by default.
- LLM: GPT-4.1/4.1-mini still the measured production default but AA marks 4.1-mini deprecated; OpenAI names gpt-5.6-luna (nano tier, reasoning.effort none, $0.20/$1.20) as successor. Haiku 4.5 and Gemini 3.5 Flash-Lite are alternatives. Never run reasoning at medium+ for voice. Gemini 3.8 Flash dropped `minimal`.
- Cascade remains the standard for business phone agents (S2S trails on multi-turn tool use: 86.7% vs 94.9% Daily.co).
- Independent latency numbers are 2–4x vendor claims; no public benchmark covers 8 kHz PSTN audio.

**Why:** the user is deciding how to make the Voco receptionist sound more natural; this is the evidence base for any future stack change.

**How to apply:** when the user asks to act on this, read the report first, then map to the current stack (Deepgram nova-3 + text MultilingualModel + gpt-4.1-mini + Flash v2.5 per [[2026-06-09 Cascade pipeline migration (Deepgram + gpt-4.1-mini + ElevenLabs)]] and [[2026-09-05 Voice quality fix (ElevenLabs key, conversational voices)]]). Highest-leverage first steps per the research: audio-native turn detector, TTS A/B (Sonic-3.6 / v3 Conversational / TTS-2), LLM migration eval to gpt-5.6-luna. See also [[feedback_livekit_prompt_philosophy]] and [[Call-experience four-phase plan (2026-09-02)]].

**2026-09-09 gap analysis ([[Research - Voice pipeline gap analysis (2026-09)]]):** verified from code: livekit-agents pinned 1.5.7 (latest 1.8.0); text `MultilingualModel` turn detector (deprecated) at 0.4/1.2 s endpointing; prompt ≈6.5k tokens + ≈1.7k tool tokens; fillers are prompt-owned before EVERY tool (2 LLM round-trips + ~2 s speech even for 50 ms cached slot math); keyterms off; no background audio; interruption mode unset. Recommended order: (1) SDK 1.8.x + `inference.TurnDetector()` v1 + adaptive interruption min_words 2; (2) code-gated fillers (>600 ms tools only) + `BackgroundAudioPlayer` typing sound; (3) greet-first/update_instructions + tenant cache; (4) A/B Cartesia sonic-3.6 vs Flash v2.5 via test-console voice picker, AssemblyAI U3.5 Pro vs nova-3, gpt-5.6-luna eval; (5) prompt rewrite to ~4k keeping OUTCOME WORDS / STATE+DIRECTIVE / CORRECTIONS / CALLER AUTHORITY verbatim; (6) region colocation. Open verifications: LiveKit Inference cost for Railway-hosted worker; plugin param names; goodbye-race diag before dropping the two-turn end_call rule. Railway MCP was NOT available in that session and `railway` CLI is unlinked (no live turn_metrics baseline pulled).

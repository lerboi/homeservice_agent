# Natural-Sounding Cascaded Voice Agents (STT → LLM → TTS): State of the Art, September 2026

Research date: 2026-09-08 / 09. Compiled from three parallel web-research passes (STT + turn-taking, TTS, LLM + prompting) plus targeted follow-ups on pipeline orchestration, speech-to-speech vs cascade, and cost. Labels: **[2026]** verified from a 2026-dated source or live page; **[2025]** older, may be stale; **[vendor]** vendor-authored claim; **[inference]** synthesis, not directly sourced.

This document is purely online research. It does not reference the Voco codebase.

---

## 1. Executive summary

1. **Cascade is still the production standard for business phone agents.** Every 2026 architecture write-up (Coval Jan 28, FutureAGI, Deepgram, AssemblyAI, Gradium, Inworld) says cascaded pipelines dominate enterprise deployments because of debuggability, tool-calling reliability, compliance, and provider flexibility. Speech-to-speech wins on raw time-to-first-audio and prosody but still trails on multi-turn tool use (Daily.co benchmark: GPT Realtime 86.7% vs GPT-4.1 94.9%). **[2026]**
2. **The naturalness frontier is now decided at three points, in this order: turn-taking, TTS model, and how the LLM writes.** Model choice for STT and LLM matters mostly for latency and accuracy, not for "sounding human."
3. **Turn detection has moved from silence timers to audio-native models.** LiveKit Turn Detector v1 (Jun 2026) is the clear leader on the only public end-of-turn benchmark (4.5% false cutoffs at 600 ms). Deepgram Flux is the best single-vendor STT+EOT path. Plain VAD needs ~1 s of silence to be safe, which alone makes an agent feel robotic. **[2026]**
4. **TTS leaders changed in Aug–Sep 2026.** Cartesia Sonic-3.6 (#1 on both Artificial Analysis boards), Inworld Realtime TTS-2 (#2, fastest measured), and ElevenLabs Eleven v3 Conversational (#8, best intelligibility) are the current top tier for real-time agents. ElevenLabs Flash v2.5 is now mid-table on naturalness (Vapi Humanness 68/100, rank 15 of 21). **[2026]**
5. **LLM: GPT-4.1 / 4.1-mini remain the measured production default, but are on a deprecation path.** OpenAI names `gpt-5.6-luna` (nano tier, `reasoning.effort: none`, $0.20/$1.20) as the successor. Claude Haiku 4.5 and Gemini 3.5 Flash-Lite are the alternatives. Never run a reasoning model at medium+ effort for voice. **[2026]**
6. **The biggest non-model levers:** make the LLM write speech (one clause, fillers as words, punctuation for pacing, numbers as words), stream to a WebSocket TTS at clause boundaries with an explicit flush, preemptive generation on partial transcripts, never let a tool call produce silence, adaptive interruption handling that ignores backchannels, and stable cacheable prompt prefixes. **[2026]**
7. **Independent latency numbers are 2–4x higher than vendor claims.** Plan budgets on Coval / Vapi Humanness / Pipecat / eot-bench numbers, and measure P95 on your own 8 kHz call recordings. No public benchmark covers 8 kHz telephony audio yet. **[2026]**

---

## 2. Recommended reference stacks (September 2026)

| Layer | Best naturalness | Balanced (recommended) | Lowest latency / cost |
|---|---|---|---|
| STT | AssemblyAI Universal-3.5 Pro Realtime | AssemblyAI U3.5 Pro Realtime, or Deepgram Flux multilingual if you want one-vendor EOT | Soniox stt-rt-v5 (~$0.002/min) |
| Turn detection | LiveKit Turn Detector v1 (audio model) | LiveKit Turn Detector v1 on LiveKit Cloud; Deepgram Flux EOT if self-hosting | Soniox native EOT or Flux EOT |
| Interruptions | LiveKit adaptive mode + min_words 2 + backchannel token rule | same | same |
| LLM | GPT-4.1 → gpt-5.6-luna (effort none) after eval; Claude Haiku 4.5 as fallback | GPT-4.1-mini → gpt-5.6-luna | Gemini 3.5 Flash-Lite (thinking minimal) or gpt-oss-120b on Cerebras/Baseten |
| TTS | Cartesia Sonic-3.6 (pinned snapshot) | Eleven v3 Conversational with Flash v2.5 fallback, or Sonic-3.6 | Inworld TTS-2 Flash |
| Framework | LiveKit Agents 1.6+ or Pipecat 1.x | LiveKit Agents | LiveKit / Pipecat |
| Noise | Krisp BVC telephony (LiveKit built-in) | same | RNNoise |

Latency budget most 2026 sources converge on: **voice-to-voice under ~800 ms, hard ceiling 1.5 s** (Retell: "above 1.5 seconds callers start to hang up"). Component targets: STT final 100–300 ms after end of speech, EOT 300–500 ms, LLM TTFT 200–700 ms, TTS TTFA 100–300 ms. Industry P50 today is 1.4–1.7 s (Hamming, 10M+ minutes), so hitting 800 ms is a real differentiator. **[2026]**

---

## 3. Speech-to-text

### 3.1 Independent benchmark: Pipecat `stt-benchmark` (Daily, Feb 2026, updated through Aug 2026)

1,000 real human-to-agent utterances, 16 kHz, time-to-final-transcript after end of speech, semantic WER judged by an LLM. Deepgram Flux excluded (its EOT cannot be disabled).

| Model | Semantic WER | TTFS median | TTFS P95 | TTFS P99 |
|---|---|---|---|---|
| AssemblyAI universal-3-5-pro | **1.22%** | 282 ms | 354 ms | 393 ms |
| Speechmatics | **1.07%** | 495 ms | 676 ms | 736 ms |
| Soniox stt-rt-v5 | 1.27% | 260 ms | 305 ms | 313 ms |
| Cartesia ink-2 | 1.25% | 299 ms | 328 ms | **1584 ms** |
| Deepgram nova-3 | 1.62% | **247 ms** | **298 ms** | 326 ms |
| NVIDIA Nemotron 3.0 ASR (en, self-host) | 1.95% | **221 ms** | 238 ms | 252 ms |
| Google gemini-3.5-transcribe-live | 2.24% | 458 ms | 532 ms | 599 ms |
| OpenAI gpt-realtime-whisper | 2.73% | 740 ms | 878 ms | 1080 ms |
| OpenAI gpt-4o-transcribe | 3.06% | 637 ms | 965 ms | 1655 ms |
| ElevenLabs scribe_v2_realtime | 3.12% | 281 ms | 348 ms | 407 ms |
| Azure | 1.18% | 1016 ms | 1345 ms | 1791 ms |

Source: https://github.com/pipecat-ai/stt-benchmark, https://www.daily.co/blog/benchmarking-stt-for-voice-agents/ **[2026]**

Coval's continuously re-run STT benchmark (31 models, includes a phone-codec condition) had AssemblyAI U3.5 Pro at #1 with 3.40% WER in July 2026 (vendor-quoted snapshot). https://benchmarks.coval.ai/stt **[2026]**

### 3.2 Vendor notes

- **AssemblyAI Universal-3.5 Pro Realtime** (Jul 2026): #1 on both independent sets; ~$0.0075/min; 1,000-word keyterm list included; EN/ES/DE/FR/PT/IT code-switching; vendor entity error on phone numbers 3.55%. Its native end-of-turn is weak (49% false cutoffs at 300 ms on eot-bench), so use it as STT only with an external turn detector. **[2026]**
- **Deepgram Flux** (multilingual since Apr 29, 2026; 10 languages): STT with model-integrated EOT (`StartOfTurn`, `EagerEndOfTurn`, `TurnResumed`, `EndOfTurn`), `eot_threshold` default 0.7, ~260 ms EOT, native mulaw 8 kHz, keyterms updatable mid-stream. Eager EOT saves 100–250 ms but costs 50–70% more LLM calls. Pricing ~$0.0065–0.0078/min. Weak spot is accuracy: every 2026 comparison that includes Flux puts it at 1.5–2x the WER of the leaders (Cartesia: Flux 9.4% vs Ink-2 6.5% on production audio; AssemblyAI: Flux 8.87% vs U3.5 5.53%). **[2026]**
- **Deepgram Nova-3**: fastest finals on Pipecat, 1.62% semantic WER, no native EOT. **[2026]**
- **Soniox stt-rt-v5**: near-identical accuracy/latency to AssemblyAI, 60+ languages auto-detected, best STT-native EOT after LiveKit (5.5% false cutoffs at 600 ms), ~$0.002/min, LiveKit plugin. Small ecosystem; bake off on your own audio. **[2026]**
- **OpenAI gpt-live-transcribe** (Jul 28, 2026, $0.017/min): no word timestamps or confidence scores; earlier OpenAI transcribe models were 600–740 ms TTFS on Pipecat. Not recommended for phone agents. **[2026]**
- **Google Gemini 3.5 Transcribe live** (Aug 26, 2026): accurate (2.24%) but 458 ms, token billing including silence, and a 10-minute live session cap. **[2026]**
- **Cartesia Ink-2** (Jul 2026): English only, good median but 1.58 s P99 tail. **[2026]**
- **ElevenLabs Scribe v2 Realtime**: 3.12% semantic WER, VAD-only endpointing. **[2026]**
- **Speechmatics Ursa 2**: most accurate, but ~500 ms median TTFS. **[2026]**

### 3.3 Phone-audio practice

- Pass mulaw 8 kHz straight to the STT (Deepgram/Twilio docs); Flux prefers 16 kHz and 80 ms chunks. **[2026]**
- All independent benchmarks are 16 kHz. Expect 2–3x WER degradation on PSTN (one low-confidence data point: Nova-3 4.2% clean → 14.8% Indian PSTN). Record and test your own calls. **[2026]/[inference]**
- Keyterm prompting everywhere: Deepgram (≤100 terms), AssemblyAI (≤1,000 words), OpenAI `keywords`, Gemini custom vocabulary. **[2026]**
- Noise: Krisp BVC (background voice cancellation) claims −46% WER on average, −70% with background speech; LiveKit ships a Krisp telephony BVC variant. Denoise before both STT and the turn model. **[2026 vendor]**
- Prefer STT with per-word timestamps (needed for adaptive interruption and "did they keep talking" logic). **[2026]**

---

## 4. Turn detection (end of turn) and interruptions

### 4.1 LiveKit `eot-bench` leaderboard (English, Jun 17, 2026)

| Model | False cutoffs @300 ms | @600 ms | Latency @5% budget | @10% budget |
|---|---|---|---|---|
| **LiveKit Turn Detector v1** (Cloud) | **9.9%** | **4.5%** | **543 ms** | **295 ms** |
| Soniox native EOT | – | 5.5% | 647 ms | 512 ms |
| Deepgram Flux | 12.9% | 9.9% | 1151 ms | 548 ms |
| LiveKit v1-mini (open weights, CPU) | 27.8% | 12.1% | 1070 ms | 698 ms |
| Pipecat Smart Turn v3.2 | 35.2% | 14.8% | 1051 ms | 739 ms |
| AssemblyAI native EOT | 49.4% | 14.6% | 1049 ms | 713 ms |
| Cartesia Ink 2 | – | – | 1056 ms | 911 ms |
| OpenAI GPT Realtime 2 | – | – | 1143 ms | 824 ms |
| VAD baseline | 55.6% | 21.7% | 1600 ms | 1000 ms |

Source: https://github.com/livekit/eot-bench, https://livekit.com/blog/solving-end-of-turn-detection **[2026]** (LiveKit-run; harness and data are open.)

Reading: a plain silence timer needs ~1 s to keep false cutoffs at 10%. Audio-native models buy 300–500 ms at equal false-cutoff rate. STT-native EOT from AssemblyAI and Cartesia is not good enough alone. **[inference]**

### 4.2 Approaches

- **LiveKit Turn Detector v1 / v1-mini** (Jun 2026): dual-branch audio+semantic model, no transcript needed, 14 languages. v1 runs on LiveKit Inference (free on LiveKit Cloud, now default); v1-mini is open weights bundled in Agents Python ≥1.6.1. **The text-based `MultilingualModel` (Qwen2.5-0.5B) is deprecated and slated for removal in SDK v2.0.** Recommended config: `endpointing = {mode: "dynamic", min_delay: 0.3, max_delay: 2.5}`, Silero VAD `min_silence_duration ≥ 0.25`. https://docs.livekit.io/agents/build/turns/turn-detector/ **[2026]**
- **Deepgram Flux**: `eot_threshold` 0.7, `eot_timeout_ms` ~1500–2000 (default 5000 is a fallback), optional `eager_eot_threshold` 0.5–0.6. LiveKit: `deepgram.STTv2(model="flux-general-multi")` with `turn_detection="stt"`, `endpointing.min_delay=0`. **[2026]**
- **Pipecat Smart Turn v3.x**: 8M params, CPU 12 ms, 23 languages, BSD-2; now clearly behind hosted models. **[2025/2026]**
- **Krisp VIVA 2.0** (May 2026): Turn Prediction v3 + Interruption Prediction classifier (separates floor-taking from "yes/mhm"); Pipecat has a strategy for it. Not on eot-bench. **[2026]**
- **OpenAI semantic VAD** (`eagerness` low/medium/high/auto): the Realtime stack scores worst on eot-bench. **[2026]**
- **Speechmatics**: recommends 0.5–0.8 s silence trigger; LiveKit plugin modes FIXED / ADAPTIVE / SMART_TURN. **[2026]**
- LiveKit's own warning: "A silence timeout set to 800 ms adds nearly a full second to every single response." **[2026]**

### 4.3 Interruption (barge-in) vs backchannel

- **LiveKit adaptive interruption handling** (Mar 19, 2026): audio-only model run while the agent speaks; 86% precision / 100% recall at 500 ms overlap; rejects 51% of VAD false positives; median 216 ms of audio to trigger. Default `interruption.mode="adaptive"` on LiveKit Cloud. Knobs: `min_duration`, `min_words`, `false_interruption_timeout`, `resume_false_interruption` (default true, agent resumes if the "interruption" was nothing), `backchannel_boundary`. https://livekit.com/blog/adaptive-interruption-handling **[2026]**
- **Pipecat ≥1.0** (Apr 2026): `UserTurnStrategies` with `MinWords`, `VAD`, `Transcription`, `External`, and a Krisp interruption-prediction strategy. **[2026]**
- **Deepgram's token rule**: enable `filler_words`; affirmative token alone (`mhmm, uh-huh, yeah, okay`) = keep talking; any negative token (`uh-uh, nuh-uh, mm-mm, no`) = yield; affirmative + continued speech = yield. Energy VAD fired on 45–52% of backchannels; listeners backchannel ~7x more than they interrupt. https://deepgram.com/learn/backchannels-vs-interruptions-voice-agents **[2026]**
- Twilio ConversationRelay added `ignoreBackchannel` (May 2026). **[2026]**
- Consensus stack: audio classifier first, `min_words ≈ 2` and `min_duration ≈ 0.3–0.5 s` as fallbacks, `resume_false_interruption=true`, negative-token override so "no, no" always wins. Hamming's runbook: review the top-20 interrupted calls after every release. **[2026]/[inference]**

---

## 5. LLM layer

### 5.1 Current model landscape (verify names; many 2026 articles cite models that do not exist)

- OpenAI: GPT-6 Astra (Sep 3, 2026 preview; rejects `reasoning.effort: none`, not a voice model); GPT-5.6 family (Jul 9, 2026): **Luna** (nano tier, $0.20 in / $1.20 out, supports `none`, named replacement for gpt-4.1-nano which shuts down Oct 23, 2026), Terra, Sol; GPT-5.5 (Apr 2026); GPT-5.4 mini/nano; gpt-realtime-2.1 / -2.1-mini (S2S); gpt-4.1 / 4.1-mini still live but Artificial Analysis marks 4.1-mini deprecated. **[2026]**
- Anthropic: Claude Haiku 4.5 ($1/$5) is still the only small Claude; Sonnet 5 (Jun 30, 2026); Fable 5.1 (Sep 1, 2026). Haiku 4.5 prompt-cache minimum is 4,096 tokens. **[2026]**
- Google: Gemini 3.5 Flash-Lite ($0.30/$2.50, `thinking_level: minimal`), 3.7 Flash (Aug 13), **3.8 Flash (Sep 2) dropped `minimal` thinking — avoid for voice**. **[2026]**
- Open weights on fast inference: gpt-oss-120b, Llama 4, Qwen 3.x, Nemotron 3 via Cerebras / Groq / Baseten / Fireworks; only route to sub-300 ms TTFT. **[2026]**

### 5.2 Voice-specific benchmarks

- **Daily.co / Pipecat `aiwf_medium_context`** (Feb 2, 2026): 30-turn simulated voice session with 6 tools. "Most voice agents in production today use GPT-4.1 or Gemini 2.5 Flash." GPT-4.1 94.9%, Gemini 2.5 Flash ≈95%, GPT Realtime (S2S) 86.7%. Models that score 100% are too slow for voice. Top penalised failure: re-asking for info already given. Target voice-to-voice <1,500 ms ⇒ ~700 ms LLM TTFT budget. https://www.daily.co/blog/benchmarking-llms-for-voice-agent-use-cases/ **[2026]**
- **MarkTechPost TTFT-first benchmark** (Aug 30, 2026, 10k-token prompt): Baseten gpt-oss-120b 0.23 s; Cerebras gpt-oss-120b 0.49 s / 1,697 tok/s; OpenAI GPT-5.6 Luna 0.74 s; Claude Haiku 4.5 0.84 s; Gemini 3.7 Flash 0.84 s. Argues for **time-to-first-sentence** over TTFT because TTS needs a clause. **[2026]**
- **Retell** (Aug 25, 2026; 100M+ monthly calls): "GPT 4.1 is the right LLM for most production voice AI agents in 2026"; 4.1-mini "indistinguishable on short, structured calls"; GPT-5 mini "similar latency to 4.1 with slightly better reasoning"; Haiku 4.5 "noticeably weaker on long conversations"; nano/lite tiers "can drop function calling reliability." Measured turn latencies: GPT-4.1 720 ms, GPT-5 mini 800 ms, GPT-5 nano 700 ms. Target <800 ms; "above 1.5 seconds, callers start to hang up." https://www.retellai.com/blog/best-llm-for-voice-ai-agents **[2026 vendor]**
- **Regal.ai** (May 29, 2026, home-services scenarios): Gemini 3.5 Flash beat every GPT model on adherence/quality but ~1 s slower. **[2026 vendor]**
- **Hamming** (Jan 2026, 10M+ minutes): industry P50 1.4–1.7 s voice-to-voice; LLM inference ~70% of latency; component targets STT 100–200 ms, LLM 200–400 ms, TTS 100–250 ms. **[2026]**
- **Coval** (May 2026): "most voice AI failures in production are tool-call failures rather than language failures." **[2026]**
- Reasoning caveat: Artificial Analysis lists reasoning variants separately; GPT-5.6 Luna (max) shows 152.9 s TTFT, Sonnet 5 (max) 188.9 s. Always run `reasoning.effort: none` / `thinking_level: minimal` / non-reasoning mode. **[2026]**

### 5.3 Bottom line on LLM choice

1. **GPT-4.1 / 4.1-mini today, tested migration to `gpt-5.6-luna` (or gpt-5.5-mini) at `reasoning.effort: none` on the Responses API.** Known gotcha: Chat Completions rejects function tools with `reasoning_effort` on some 5.6 models; use `none` or move to Responses. **[2026]**
2. **Claude Haiku 4.5** as quality fallback: 0.6–0.8 s TTFT, top-tier tool calling; weaker on long calls per Retell; caching only ≥4,096 tokens. **[2026]**
3. **Gemini 3.5 Flash-Lite (minimal) or 2.5 Flash** for cost; skip 3.8 Flash. gpt-oss-120b on Baseten/Cerebras if sub-300 ms TTFT matters more than tool reliability. **[2026]**

### 5.4 Prompting for natural spoken output (convergent guidance)

Sources: OpenAI Realtime prompting guide and voice-agent metaprompt, Vapi prompting guide, Retell prompt guide, ElevenLabs Agents prompting guide, LiveKit "prompting voice agents to sound more realistic" (Feb 26, 2026), NVIDIA voice-agent best practices, Bland. **[2026]**

- **Sectioned prompt**: Role/Objective, Personality & Tone (identity, demeanor, formality, enthusiasm, emotion, filler frequency, pacing), Language, Response guidelines, Tools, Unclear audio, Escalation, Examples. Start minimal, add rules only for behaviors that fail in evals. Repeat the 1–2 critical rules.
- **Length**: "1–2 short sentences per turn", "ask for only the next missing value", never lists or markdown. Output tokens scale latency ~linearly (OpenAI latency guide), so cap `max_tokens` ~150–200.
- **Speech-safe formatting**: numbers, prices, dates, times as words; phone numbers digit-grouped or digit-by-digit with periods for readback; emails spelled; expected formats in tool parameter descriptions. Choose one normalizer (LLM vs TTS vendor) and stick to it.
- **Fillers: the guides disagree.** OpenAI: preambles only before slow tools, avoid "Hmm... let me think". Vapi/LiveKit: 2–4 disfluencies per turn written as words ("Yeah, um <break time='300ms'/> so, I can do that"). For a business receptionist, the OpenAI/Retell register (few fillers, brisk "Got it", "Sure") is the safer default; never use fillers on high-stakes turns (an emergency caller hearing "Ummm, let me see..." is the canonical anti-example). **[inference]**
- **Confirm smart**: read back only high-precision or high-consequence data (address, appointment time, phone), batch-confirm at the end, never re-ask for information already given.
- **Few-shot dialogues**: 3 examples (happy path, edge case, error recovery) plus "vary your responses"; show the register rather than describing it; short positive style principle instead of long "never say" lists.
- **Unclear audio / silence / escalation**: don't guess from unclear audio; 2 tool failures or 3 no-input events → transfer; on silence wait 10–15 s then check once; fixed identity lock; don't apologise when interrupted, address it immediately.
- **Energy matching**: crisp callers → shorter turns; chatty callers → one or two turns of banter then back to task.
- Contractions, sentence starts with "And/But/So", calm baseline emotion, stronger emotions sparingly, no rapid emotion switching.

### 5.5 LLM-side latency techniques

| Technique | Payoff | Notes |
|---|---|---|
| Reasoning off | ~0.7 s vs 8–200 s TTFT | `none` / `minimal` / non-reasoning variant |
| Stable cacheable prefix | 200–400 ms TTFT, ~90% input cost | static instructions first, per-call context last; `prompt_cache_key`; verify `cached_tokens`; Haiku needs ≥4,096 tokens |
| Preemptive generation on partial transcripts | 150–350 ms | LiveKit `preemptive_generation` default on; discarded if tools/context change in `on_user_turn_completed` |
| Stream to TTS at first clause | time-to-first-sentence | strip markdown; prompt for a short first clause |
| Hard length rule + low max_tokens | linear in output tokens | 1–2 sentences, one question |
| Never let a tool call produce silence | seconds | one-sentence preamble for slow tools; LiveKit async tools `ctx.update()` + `ctx.with_filler()`; Vapi tool-level `request-start` messages; prefetch likely lookups at ≥0.85 intent confidence; DB lookups add 800–1,200 ms regardless of platform |
| Colocation / region pinning | 60–150 ms | LiveKit rates it above model choice |

---

## 6. Text-to-speech

### 6.1 Independent rankings (fetched 2026-09-08)

**Artificial Analysis Speech Arena, Provider-Voice Elo** (blind pairwise, English): 1 Cartesia Sonic 3.6 (1282, $49/1M chars, Aug 2026) · 2 Inworld Realtime TTS-2 (1252, $20.8) · 3 Alibaba Qwen-Audio-3.0-TTS-Plus (1241) · 4 Speechify Simba 3.2 (1240, $10) · 5 VUI Luna TTS (1228) · 6 Inworld TTS-2 Flash (1222, $10.4) · 7 Breeze TTS 2 (top open weights, 1215) · 8 ElevenLabs v3 Conversational (1210, $50) · 9 Gemini 3.1 Flash TTS (1208) · 11 Cartesia Sonic 3.5 (1193) · 14 Eleven v3 (1175) · 15/17 MiniMax Speech 2.8 HD/Turbo · 24 Azure HD 2.5. Flash v2.5, Aura-2, Rime, Hume, OpenAI TTS not in the top 25. https://artificialanalysis.ai/text-to-speech/leaderboard/provider-voice **[2026]**

**Vapi Humanness Index** (same cloned voice on every model, human = 100, latency incl. network): Simba 3.2 97 (428 ms) · Eleven v3 97 (758 ms) · Grok TTS 93 (460 ms) · MiniMax Speech 2.8 93 (325 ms) · Fish S2.1 Pro 86 (**141 ms**) · Inworld TTS-1.5-max 78 (337 ms) · ElevenLabs Flash v2 76 (226 ms) · **ElevenLabs Flash v2.5 68 (197 ms)** · Cartesia Sonic 2 67 (159 ms) · Cartesia Sonic 3 66 (166 ms) · Smallest Lightning v3.1 44. Does not yet include Sonic 3.5/3.6, TTS-2, v3 Conversational. https://humannessindex.vapi.ai/ **[2026]**

**Coval daily TTS latency benchmark** (30 agent-style prompts, WebSocket, TTFA after connection setup; 30-day window to 2026-09-08): Inworld TTS-2 Flash 113 ms · Inworld TTS-2 164 ms P50 / 315 ms P99 (WER 4.6%) · Rime Mist v3 257 ms · Cartesia Sonic 3.5 273 ms · Deepgram Aura-2 317 ms · Fish S2.1 Pro 360 ms · Eleven v3 Conversational 385 ms (WER 4.3%, best). May 2026 snapshot: Cartesia Sonic-3 188 ms · ElevenLabs Turbo v2.5 264 ms · **Flash v2.5 288 ms** · Multilingual v2 1,232 ms · OpenAI TTS-1-HD 2,295 ms. https://benchmarks.coval.ai **[2026]**

Vendor TTFB claims (25–90 ms) are 2–4x lower than independent end-to-end measurements. **[2026]**

### 6.2 Top-tier models for real-time agents

- **Cartesia Sonic-3.6** (GA Aug 27, 2026, snapshot `sonic-3.6-2026-08-27`): #1 on both AA boards; 44 languages; native mulaw 8 kHz; inline `[laughter]`, emotion/speed/volume as guidance ("only when consistent with the transcript"); locale-aware number/date formatting; IPA dictionaries; plans make effective cost ~$5–37/1M chars. Vendor claims 92% preference over Eleven v3 and <90 ms; independent numbers for predecessors 166–273 ms. Older Sonic 3 scored only 66 on Vapi Humanness, so blind A/B on your own scripts before committing. **[2026]**
- **Inworld Realtime TTS-2 / TTS-2 Flash** (Sep 2, 2026, research preview): #2/#6 on AA; fastest measured quality-tier (164 / 113 ms P50); inline natural-language delivery instructions `[calm, reassuring]`, `[laugh] [breathe] [sigh]`; zero-shot cloning; native PCMU/PCMA 8 kHz; $25 → $12.50/1M by plan. One week old; treat as fallback / shadow-traffic candidate. **[2026]**
- **ElevenLabs Eleven v3 Conversational** (Aug 2026): AA #8; best measured intelligibility (4.3% WER) but slowest of the realtime tier (385 ms P50); **only via the Text-to-Dialogue WebSocket**, one voice per connection, ~40-char / 8-word server buffer before first audio (send fuller clauses + `flush: true`), `new_turn: true` resets prosody, 20 s inactivity → `keep_alive`; audio tags `[laughs] [whispers] [sighs] [slow] [excited]` affect ~4–5 words; **Professional Voice Clones lose character on v3 Conversational** (use library/designed voices); no SSML `<break>` on the v3 family. **[2026]**
- **ElevenLabs Flash v2.5**: still documented for real-time agents (~75 ms model latency, `ulaw_8000`), $50/1M after the May 7, 2026 price cut, but mid-table on naturalness (Humanness 68) and 197–288 ms measured. **Numbers are not normalized by default** on Flash v2.5. `<break time="1.5s"/>` up to 3 s; phoneme tags; `.PLS` dictionaries. Turbo v2.5 is deprecated. **[2026]**
- **Deepgram Flux TTS** (GA Aug 12, 2026): conversation-native Mamba model with call-long memory, streams audio on first token, vendor TTFB ~80 ms, vendor WER 2.2% overall / 3.4% alphanumerics ("half of ElevenLabs"), no tags, English only, $45/1M, free through Sep 12, 2026. No independent numbers yet. Watch if addresses / phone numbers are your dominant failure mode. **[2026 vendor]**
- **Rime Coda** (May 2026): LLM-backbone conversational US English, built-in normalization, `spell()`, native filler handling (fillers written as words are read naturally). No independent naturalness score yet. **[2026]**
- Also: Speechify Simba 3.2 (Humanness 97 but 428 ms, HTTP only), MiniMax Speech 2.8 (93, 325 ms, $60–100/1M), xAI Grok TTS (93 / 87 streaming), Fish S2.1 Pro (86, 141 ms, free tier), Hume Octave 2 (acting instructions not yet available), Gemini 3.1 Flash TTS (no text-input streaming, preview), OpenAI gpt-4o-mini-tts (HTTP only, slow). PlayHT is dead (closed Dec 31, 2025). **[2026]**

### 6.3 Techniques that make TTS sound human

1. **Make the LLM write speech, not prose** (LiveKit Feb 26, 2026; Rime Aug 17, 2026): "be conversational" does not work, show examples; fillers written as words at utterance starts or before rare words, 5–10% disfluency rate in humans, never stacked, none on high-stakes turns; ellipses for hesitation; calm baseline emotion (`<emotion value="peaceful"/>` reads more realistic than excited); one sentence per turn.
2. **Normalize before synthesis**: expand "Dr.", "St.", times, dates, prices; digit-group phone numbers; Vapi `formatPlan` does this by default; Pipecat `MarkdownTextFilter`; ElevenLabs suggests `inflect` / `number-to-words` preprocessing; Cartesia 3.6, Deepgram Flux, Rime `spell()` handle alphanumerics natively.
3. **Chunk at clause/sentence boundaries, flush at turn end.** Pipecat defaults to `SENTENCE` aggregation (~200–300 ms per sentence, natural) vs `TOKEN` (faster, prosody risk); ElevenLabs: committing audio too early "risks producing speech that sounds unnatural at phrase boundaries", tune `chunk_length_schedule` (default [120,160,250,290]) and send `flush: true` at end of turn; historical Pipecat bug where sentence fragments "played havoc with prosody". With today's WebSocket-native models (Sonic-3.6, TTS-2, v3 Conversational, Flux TTS) let the vendor buffer and stream tokens plus a flush; do your own sentence aggregation only for HTTP TTS. **[2026]/[inference]**
4. **Conversational voices, moderate stability.** ElevenLabs conversational voice design guide: stability 0.30–0.50 expressive / 0.60–0.85 consistent but monotone; similarity ~0.75; speed 0.9–1.1; third-party consensus for agents stability 0.45–0.65, style 0.20–0.40. Recommended library voices for agents: Alexandra, Archer, Jessica Anne Bogart, Stuart, Angela. On Cartesia leave speed/volume default and rely on punctuation. Tags sparingly (each affects ~4–5 words).
5. **Emit 8 kHz mulaw natively** to skip a transcoding hop; 8 kHz masks some fidelity differences between top models, so pacing, prosody, number handling and TTFA dominate perceived quality on a phone line. **[inference]**
6. **Operational**: pin model snapshots, measure P95 on your own scripts (Coval's harness is open source), run primary + fallback (95/5 split), regression-test after silent vendor updates.

---

## 7. Pipeline-level orchestration techniques (framework features)

- **Preemptive generation** (LiveKit, default on): start the LLM on the partial transcript before EOT fires; finalize tools/context before EOT so the speculative reply is not discarded. Optional `preemptive_tts`. **[2026]**
- **Async tools with fillers** (LiveKit, Jul 7, 2026): `ctx.update()` returns control immediately with a synthetic tool result; `ctx.with_filler()` rotates lines ("Still pulling up your order, hang on") with delay/interval/max_steps; blocking version measured at "fourteen seconds of silence" vs async "acknowledges in under a second". `session.say()` bypasses the LLM for deterministic lines. **[2026]**
- **Background audio** (LiveKit `BackgroundAudioPlayer`): looped ambient sound (`OFFICE_AMBIENCE`) plus thinking sounds (`KEYBOARD_TYPING`, `KEYBOARD_TYPING2`) that play only while the agent is in the "thinking" state (LLM / tool call); per-clip volume and probability, fade in/out. Documented purpose is realism; in practice it also masks dead air during tool calls. https://docs.livekit.io/agents/multimodality/audio/background-audio/ **[2026]**
- **Sentence aggregation and text filters** (Pipecat `SentenceAggregator`, `MarkdownTextFilter`, custom transformers; Vapi `chunkPlan` and `formatPlan`). **[2026]**
- **Turn-taking and interruption** (Section 4): audio-native EOT, adaptive interruption, `resume_false_interruption`, backchannel boundary, `ttfs_p99_latency` in Pipecat so the aggregator waits just long enough for the STT's own P99 final. **[2026]**
- **Noise cancellation** (LiveKit built-in Krisp incl. telephony BVC; Pipecat Krisp VIVA). **[2026]**
- **Metrics**: LiveKit and Pipecat expose per-turn stage timings (EOU delay, LLM TTFT, TTS TTFB); Hamming/Coval/Vapi use voice-to-voice P50/P90/P95, interruption rate, backchannel false positives, task completion. **[2026]**
- **Telephony**: pass PCMU 8 kHz through both directions; Twilio ConversationRelay now supports Flux and `ignoreBackchannel`; platform p95 turn latencies measured on the same GPT-4o by roiscale (Aug 2026): Vapi 380 ms, Retell 420 ms, self-hosted Pipecat 610 ms. **[2026]**

---

## 8. Speech-to-speech vs cascade, September 2026

- Cascade dominates enterprise production: "Every serious production voice agent today runs cascaded or direct-API"; native duplex S2S is "a 2027 bet" (FutureAGI). Coval (Jan 28, 2026): cascade wins on control (text intermediaries for filtering/compliance/business logic), debuggability, per-layer fallbacks, tooling maturity; S2S wins on prosody, emotional continuity and interruption naturalness, with 200–300 ms response vs ~2,000 ms for badly built cascades. Hybrid: run both, route per call. **[2026]**
- Measured gap on multi-turn tool use: GPT Realtime 86.7% vs GPT-4.1 94.9% (Daily.co). S2S models scoring well on task success now exist (Grok Voice Think Fast 2.0: 0.70 s TTFA, 94.7% task success; gpt-realtime-2.1 with caching). OpenAI now steers voice builders toward gpt-realtime-2.1; cost ≈ $0.05–0.09/min. **[2026]**
- Hybrid options worth watching: audio-in / text-out models (gpt-realtime with external TTS; Gemini Live text output) to keep voice choice and TTS control while gaining audio-native understanding. **[inference]**

---

## 9. Cost per minute (2026)

- Inworld worked model (Jul 8, 2026; 50/50 talk split, ~400 TTS chars/min, 2,340 in / 100 out tokens per turn with 1.8x history): cheapest cascade ~$0.007/min (Inworld STT + Gemma 4 26B + TTS-2); gpt-realtime-2.1 ≈ $0.091/min. "Text-to-speech dominates every cascaded stack, 70–73% of raw component cost." **[2026 vendor]**
- Aggregated 2026 ranges: STT $0.004–0.024/min, LLM $0.003–0.08/min, TTS $0.02–0.10/min, telephony $0.008–0.014/min, platform fee $0.05–0.14/min (Vapi $0.05, Retell $0.055, Synthflow $0.09; LiveKit Cloud / Pipecat Cloud ~$0.01 orchestration + pass-through). All-in $0.12–0.25/min for most managed deployments. Hidden costs: silence billing, discarded TTS audio on interruptions (poor turn-taking regenerates 10–30% extra characters). **[2026]**
- Retell: GPT-4.1 ≈ $0.025/min LLM vs GPT-5.4 ≈ $0.06 at 5k min/month. **[2026 vendor]**
- Typical self-hosted cascade in this research: STT $0.002–0.0075 + LLM $0.005–0.025 + TTS $0.005–0.02 (Cartesia/Inworld plans) to $0.02–0.03 (ElevenLabs Flash at $50/1M) + telephony ≈ $0.02–0.08/min before hosting. **[inference]**

---

## 10. Conflicts, caveats, stale items

- GPT-5.x TTFT numbers vary 3x between sources because of reasoning settings (Softcery ~1.1 s vs BenchLM 3.6 s for 5.4 nano). Trust numbers only when the reasoning mode is stated.
- Fish S2.1 Pro: 141 ms (Vapi) vs 360 ms (Coval): different regions/protocols. Test yourself.
- Smallest.ai Lightning V3.1: AA Elo 1190 vs Vapi Humanness 44: largest arena-vs-same-voice disagreement.
- Deepgram Flux "Nova-3-level accuracy" and "65% fewer premature interruptions" are Oct 2025 launch claims not supported by 2026 independent data.
- ElevenLabs prompting guide still names GPT-4o / Gemini 2.5 Flash Lite / Sonnet 4 as LLM picks: stale.
- Twilio latency guide (Nov 2025), Modal/Pipecat open-model bot (Nov 2025), Smart Turn v3.1 numbers (Dec 2025): 2025 sources.
- No public benchmark measures STT, EOT or TTS on real 8 kHz PSTN audio. Every recommendation above should be re-validated on recorded receptionist calls.

---

## 11. Key sources

STT / EOT: https://github.com/pipecat-ai/stt-benchmark · https://www.daily.co/blog/benchmarking-stt-for-voice-agents/ · https://github.com/livekit/eot-bench · https://livekit.com/blog/solving-end-of-turn-detection · https://docs.livekit.io/agents/build/turns/turn-detector/ · https://livekit.com/blog/turn-detection-and-interruption-handling · https://livekit.com/blog/adaptive-interruption-handling · https://developers.deepgram.com/docs/flux/quickstart · https://developers.deepgram.com/docs/flux/voice-agent-eager-eot · https://deepgram.com/learn/backchannels-vs-interruptions-voice-agents · https://www.assemblyai.com/blog/universal-3-5-pro-realtime-human-parity-zone · https://www.coval.ai/blog/best-speech-to-text-providers-in-2026-independent-benchmarks-and-how-to-choose/ · https://soniox.com/blog/soniox-v5-real-time · https://www.cartesia.ai/blog/ink-2 · https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-5-transcribe/ · https://hamming.ai/resources/voice-agent-interruption-handling-runbook · https://docs.pipecat.ai/api-reference/server/utilities/turn-management/user-turn-strategies

LLM / prompting: https://www.daily.co/blog/benchmarking-llms-for-voice-agent-use-cases/ · https://www.marktechpost.com/2026/08/30/lowest-latency-inference-apis-for-voice-and-realtime-agents-a-time-to-first-token-ttft-first-benchmark/ · https://www.retellai.com/blog/best-llm-for-voice-ai-agents · https://softcery.com/lab/ai-voice-agents-choosing-the-right-llm · https://www.regal.ai/blog/how-gemini-3-5-flash-performs-for-voice-ai-agents · https://hamming.ai/resources/voice-agent-evaluation-metrics-guide · https://developers.openai.com/api/docs/guides/reasoning · https://developers.openai.com/api/docs/guides/realtime-models-prompting · https://developers.openai.com/api/docs/guides/prompt-caching · https://developers.openai.com/api/docs/models/gpt-5.6-luna · https://developers.openai.com/api/docs/deprecations · https://platform.claude.com/docs/en/build-with-claude/prompt-caching · https://ai.google.dev/gemini-api/docs/changelog · https://docs.vapi.ai/prompting-guide · https://docs.retellai.com/build/prompt-engineering-guide · https://elevenlabs.io/docs/eleven-agents/best-practices/prompting-guide · https://livekit.com/blog/prompting-voice-agents-to-sound-more-realistic · https://livekit.com/blog/async-tools-voice-agents · https://docs.livekit.io/agents/build/sessions · https://github.com/NVIDIA/voice-agent-examples/blob/main/docs/BEST_PRACTICES.md · https://futureagi.com/blog/how-to-optimize-voice-agent-latency-2026/

TTS: https://artificialanalysis.ai/text-to-speech/leaderboard/provider-voice · https://humannessindex.vapi.ai/ · https://benchmarks.coval.ai · https://www.coval.ai/blog/best-text-to-speech-providers-in-2026-how-to-choose-(and-why-vendor-benchmarks-lie)/ · https://www.cartesia.ai/blog/sonic-3.6 · https://docs.cartesia.ai/build-with-cartesia/models/tts · https://elevenlabs.io/docs/overview/models · https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/realtime-tdd · https://elevenlabs.io/docs/eleven-agents/customization/voice/expressive-mode · https://elevenlabs.io/docs/eleven-agents/customization/voice/best-practices/conversational-voice-design · https://elevenlabs.io/docs/eleven-api/concepts/audio-streaming · https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices · https://docs.inworld.ai/realtime/connect/websocket · https://deepgram.com/learn/introducing-flux-tts-conversation-native-text-to-speech-for-real-time-voice-agents · https://docs.rime.ai/docs/models · https://www.rime.ai/resources/how-to-add-natural-filler-words-to-tts · https://docs.pipecat.ai/pipecat/learn/text-to-speech · https://docs.vapi.ai/assistants/voice-formatting-plan

Orchestration / S2S / cost: https://docs.livekit.io/agents/multimodality/audio/background-audio/ · https://www.coval.ai/blog/speech-to-speech-vs-cascaded-voice-ai-which-architecture-should-you-deploy/ · https://futureagi.com/blog/cascaded-voice-ai-vs-speech-to-speech-2026/ · https://deepgram.com/learn/speech-to-speech-vs-cascade-voice-agent-architecture · https://inworld.ai/resources/voice-agent-cost-per-minute-2026 · https://www.retellai.com/blog/ai-voice-agent-pricing-full-cost-breakdown-platform-comparison-roi-analysis · https://roiscale.ai/sites/roiscale/articles/89233950-d237-4024-be85-4556f8eb0d20/i-benchmarked-the-2026-voice-agent-stack-vapi-vs-retell-vs-pipecat-vs-roll-your · https://www.twilio.com/en-us/changelog/conversation-relay-now-supports-deepgram-flux---new-features

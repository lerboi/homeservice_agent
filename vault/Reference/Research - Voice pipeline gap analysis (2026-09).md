---
type: reference
date: 2026-09-09
status: current
description: "Gap analysis of the livekit-agent pipeline against the September 2026 research; recommendations."
source: "My Prompts/Voice-Pipeline-Gap-Analysis-2026-09.md"
migrated: 2026-11-23
tags: [voco/reference]
---

# Voco Voice Agent: Current Pipeline vs. Industry Best (September 2026)

Analysis date: 2026-09-09. Scope: the `livekit-agent` repo (Railway worker, `src/agent.py` @ 166c3ad) compared against the research in `Voice-Naturalness-Research-2026-09.md`. No code changed. Railway MCP tools were not available in this session and the Railway CLI is not linked, so no live call metrics were pulled; per-turn latency numbers below are estimates from code + published benchmarks, and the `turn_metrics` log lines already emitted by the agent are the way to confirm them.

---

## 1. What is built today (verified from code)

**Call path.** Twilio SIP → LiveKit Cloud room (dispatch rule) → Railway worker (`livekit-agents==1.5.7`, all plugins pinned 1.5.7, 2 idle prewarmed processes). Entry: connect → wait for SIP participant → Supabase tenant lookup (Tokyo) → one parallel gather (caller history + intake questions + optional Jobber/Xero context, 2.5 s budget) → build system prompt → `session.start()` → deterministic `session.say()` greeting with caller input muted until playout → normal turns.

**Pipeline components.**

| Layer | Current | Notes from code |
|---|---|---|
| STT | Deepgram `nova-3`, `language="multi"` | Keyterm prompting exists but is **off** (`VOCO_STT_KEYTERMS=false`) over an unverified keyterm+multi concern |
| VAD | Silero (prewarmed) | defaults |
| Turn detection | `MultilingualModel()` text turn detector, `min_endpointing_delay=0.4`, `max_endpointing_delay=1.2` | runs in the local inference executor on Railway CPU; needs the STT final before it can decide |
| Interruptions | `allow_interruptions=True`, session defaults (`min_duration` 0.5 s, `min_words` 0, `resume_false_interruption` True, `false_interruption_timeout` 2.0) | `interruption.mode` not set (SDK auto-detects; adaptive only if the runtime supports it) |
| Preemptive generation | on | good |
| LLM | `gpt-4.1-mini`, `parallel_tool_calls=False`, `max_completion_tokens=500`, per-tenant `prompt_cache_key`, greeting-time cache-warm request | temperature default (1.0) |
| TTS | ElevenLabs `eleven_flash_v2_5`, stability 0.45 / similarity 0.75 / speed 1.08, conversational voices (Alexandra / Eryn / Cassidy), FallbackAdapter → OpenAI `gpt-4o-mini-tts` alloy, key preflight | plugin default `auto_mode` (one sentence per flush), `apply_text_normalization="auto"` |
| Noise | Krisp BVC (telephony variant for SIP) | good |
| Background audio | none | |
| Prompt | ~6.5 k tokens (29 k chars) + ~1.7 k tokens of tool descriptions ≈ 8–9 k token preamble every turn | 18 sections; cache-aware layout; per-caller blocks last |
| Tools | 9 in-process: transfer_call, capture_lead, validate_address, check_caller_history, end_call, (+ check_slot, check_day, next_available_days, book_appointment when onboarded) | STATE+DIRECTIVE returns; slot cache prefetched at call start |
| Filler strategy | **Prompt-driven**: "Never emit a tool call without speaking first" for every tool, ~600 tokens of filler rules + examples | LLM emits filler text + tool call in one response; then a second LLM round-trip after the tool returns |
| Goodbye | prompt rule: speak goodbye, then a separate silent turn calling `end_call`; code also awaits `wait_for_playout()` | two mechanisms for the same race |
| Recovery | no-input "are you still there?" ×2, error recovery speech, duration watchdog (9/10 min), subscription gate, egress recording, post-call pipeline (transcript, triage, lead, notifications) | solid; not latency-relevant |

**Core functionality that must survive any change:** the info-gathering contract (issue, name, service address; phone from caller ID), early address validation with the code-level loop cap and caller-authority rule, availability via `check_slot` / `check_day` / `next_available_days` with `slot_token` handoff, `book_appointment` + readback, `capture_lead` fallback, transfer, silent urgency triage, EN/ES, test-call sandbox, recording, post-call pipeline and owner notifications.

---

## 2. Estimated per-turn latency today and where it goes

Voice-to-voice for a plain (no-tool) turn, from the caller's last word to first agent audio:

| Stage | Estimate | Basis |
|---|---|---|
| STT final after end of speech | 250–300 ms | Pipecat stt-benchmark nova-3 median 247 ms, P95 298 ms |
| Endpointing wait + text turn detector | 400 ms min + 50–160 ms model, up to 1.2 s max when the text model hesitates | code constants; LiveKit docs on the text model |
| LLM TTFT (gpt-4.1-mini, ~9 k cached prefix) | 500–850 ms | Artificial Analysis 0.85 s @10 k tokens; Retell 720 ms turn latency |
| TTS TTFA (Flash v2.5) | 200–290 ms | Vapi 197 ms, Coval 288 ms (independent) |
| Network / SIP / playout | 100–200 ms | |
| **Total** | **~1.4–2.0 s typical, 2.5 s+ on hesitant turns** | matches the 1.4 s median dead air seen 2026-09-05 |

Tool turns add a second LLM round-trip plus the ~2 s spoken filler, so a `check_slot` answer lands ~3 s+ after the caller names a time, even though the slot math itself is ~50 ms from the prefetched cache.

Industry target (Retell, Hamming, LiveKit): **under ~800 ms**, hard ceiling 1.5 s. The gap is roughly 0.6–1.2 s per turn, and it is spread across turn detection (~300–500 ms recoverable), the filler-before-every-tool pattern (~1.5–2 s recoverable on tool turns), and the LLM prefix (~100–300 ms).

---

## 3. Gap table: component by component

| Component | Current | Industry best (Sept 2026) | Verdict |
|---|---|---|---|
| Turn detection | Text `MultilingualModel` (deprecated, removal in SDK 2.0), 0.4/1.2 s endpointing | **LiveKit Turn Detector v1** (audio-native, EN+ES among 14 langs), #1 on eot-bench (4.5 % false cutoffs @600 ms, ~300 ms latency at 10 % budget), free on LiveKit Cloud, needs `livekit-agents ≥1.6.1` | **Biggest single gap.** The SDK is 3 minor versions behind (1.5.7 vs 1.8.0) and the current detector is end-of-life |
| Interruption / backchannel | VAD-style with `min_words=0`; "mm-hmm" can stop the agent | Adaptive interruption model (86 % precision / 100 % recall) + `min_words≈2` + affirmative-token rule | Set `interruption.mode="adaptive"` explicitly after the upgrade; add `min_words=2` |
| STT | nova-3 multi, keyterms off | **AssemblyAI Universal-3.5 Pro Realtime**: #1 on Pipecat (1.22 % semantic WER vs nova-3 1.62 %) and Coval; 282 ms median; native EN/ES code-switching; 1,000-word keyterms included; 3.6 % phone-number entity error | Accuracy upgrade at equal latency; directly targets the address / name mis-hearing class (Canberra→Kenberg). At minimum, turn nova-3 keyterms on (multilingual keyterm prompting is now a documented Deepgram feature) |
| LLM | gpt-4.1-mini (AA marks it deprecated; 4.1-nano shuts down 2026-10-23) | gpt-4.1 family still the measured production default; named successor **gpt-5.6-luna** (nano tier, `reasoning.effort: none`, $0.20/$1.20, 0.59–0.74 s TTFT @10 k) | Keep 4.1-mini now; eval luna on the replay suite before the deprecation wave. Haiku 4.5 is the fallback candidate |
| TTS | Flash v2.5 (Vapi Humanness 68/100, rank 15/21; 200–290 ms measured) | **Cartesia Sonic-3.6** #1 on both Artificial Analysis boards, native 8 kHz μ-law, pinned snapshots, ~$5–37/1M effective; Inworld TTS-2 #2 and fastest measured (164 ms); Eleven v3 Conversational #8 (385 ms, Text-to-Dialogue WS only, PVCs degrade) | Naturalness upgrade, latency-neutral. `livekit-plugins-cartesia` 1.8.0 lists `cartesia/sonic-3.6`; the ElevenLabs plugin's v3-conversational support is unverified |
| Filler / tool latency masking | LLM must speak a filler before **every** tool call | OpenAI: preamble only before slow tools; Vapi: tool-level `request-start` messages rather than LLM-generated; LiveKit: async tools with delayed rotating fillers + `BackgroundAudioPlayer` thinking sounds | Move fillers to code, gate them on actual tool latency, add thinking audio |
| Prompt | ~8–9 k tokens; heavy "never say X" lists; two mechanisms for goodbye; "Never do two things in one turn" contradicts "speak filler and call the tool in the same turn" | 2026 guides: start minimal, sectioned, 3 few-shot dialogues, short positive style principle instead of banned-phrase lists, length rule, speech-safe formatting; enforcement in code where possible | Shrink to ~4 k tokens; keep OUTCOME WORDS, STATE+DIRECTIVE, CORRECTIONS, CALLER AUTHORITY verbatim |
| Pre-greeting path | tenant lookup → 2.5 s-budget gather → prompt → `session.start()` → greeting; all sequential before first audio | Start media/TTS connections in parallel with data fetches; greet first, update instructions after (`Agent.update_instructions` exists in 1.5.7) | ~0.5–1 s faster first audio |
| Background audio | none | `BackgroundAudioPlayer` with `KEYBOARD_TYPING` thinking sound during tool calls, optional faint `OFFICE_AMBIENCE` | Cheap realism + masks tool latency |
| Regions | Supabase Tokyo; Railway/LiveKit regions unrecorded | Colocate worker, media, and DB in one US region; LiveKit rates colocation above model choice | Phase 3 of the existing plan; ~130 ms × 5–6 sequential queries per booking |
| Noise cancellation | Krisp BVC telephony | same | Already best practice |
| Preemptive generation, prompt caching, slot prefetch, keep-alive Supabase, pinned worker pool, ElevenLabs key preflight | present | present | Already best practice; keep |

---

## 4. Recommended changes, in priority order

Each item names one committed choice. Impact figures are estimates from the research, to be confirmed with the existing `turn_metrics` logs.

### Tier 1: turn-taking and latency plumbing (largest effect, lowest model risk)

1. **Upgrade `livekit-agents` and every plugin from 1.5.7 to 1.8.x** (pin all to the same line). Prerequisite for everything below; the current text turn detector is deprecated for removal. Run the 634-test suite; the SDK constructor kwargs used in `agent.py` (`min_endpointing_delay`, `preemptive_generation`, `turn_detection`) should be migrated to the `turn_handling={...}` dict form.
2. **Switch turn detection to `inference.TurnDetector()` (v1)** with `turn_handling.endpointing = {"mode": "dynamic", "min_delay": 0.3, "max_delay": 2.5}` and Silero `min_silence_duration ≥ 0.25`. Expected: 300–500 ms less dead air per turn and fewer cut-offs on addresses and numbers (the case the 1.2 s max was trimmed for). Verify first that LiveKit Inference is available at no cost for a Railway-hosted worker on the Cloud project (docs say free "for agents deployed to LiveKit Cloud"; local/self-hosted get a monthly allowance then fall back to `v1-mini`). If it is not free, this is the argument for moving the worker to LiveKit Cloud agent hosting (also removes the Railway↔LiveKit hop).
3. **Set interruption handling explicitly:** `interruption = {"mode": "adaptive", "min_words": 2, "min_duration": 0.4, "resume_false_interruption": True, "false_interruption_timeout": 2.0}`. Stops "mm-hmm" / "yeah" from cutting the agent off while keeping emergency barge-in.
4. **Move fillers from the prompt into code, gated on latency.** Keep the LLM free to answer directly. In each tool handler, start a timer; if the tool has not returned in ~600 ms, speak one rotating, locale-correct filler via `session.say()` (or the SDK's async-tool filler API once on 1.8). `check_slot` / `check_day` / `next_available_days` (warm cache, ~50 ms) then answer immediately instead of after a 2 s filler; `validate_address`, `book_appointment`, `transfer_call` still get cover. Delete the TOOL NARRATION section (~600 tokens) and the "filler is a promise" rule, which exists only because the LLM owned the filler. Expected: 1.5–2 s faster on availability turns.
5. **Add `BackgroundAudioPlayer`** with `KEYBOARD_TYPING` as the thinking sound (volume ~0.5) and, after listening tests, faint `OFFICE_AMBIENCE` (~0.3). Plays only while the agent is in the thinking state, so tool gaps read as "she's typing" rather than dead air.
6. **Greet earlier.** Reorder the entrypoint: after the SIP participant joins, build a minimal agent, start the session (this prewarms STT/LLM/TTS sockets) and fire the deterministic greeting immediately; run the tenant/caller-history/intake fetches in parallel and call `agent.update_instructions()` with the full prompt before unmuting the caller (the greeting gives ~3 s of cover; the 2.5 s budget already fits). Move the cache-warm request to after the instructions are final. Also cache the tenant row + services in-process with a short TTL keyed by `to_number`, so repeat calls skip two Tokyo round-trips. Expected: first audio 0.5–1 s sooner.
7. **Turn on Deepgram keyterms now** (business name + service names; multilingual keyterm prompting is documented) as a zero-cost accuracy gain while the STT decision below is evaluated.

### Tier 2: model swaps, each behind an A/B on real call scripts

8. **TTS → Cartesia `sonic-3.6`** (pinned snapshot `sonic-3.6-2026-08-27`, 8 kHz μ-law output, default speed/volume, emotion left off) as the primary, with ElevenLabs Flash v2.5 kept in the FallbackAdapter. Audition three Cartesia conversational voices against Alexandra through the admin test console's voice picker (extend the picker to accept a provider prefix). Decision rule: blind preference on 10 recorded receptionist turns plus P95 TTFA on the same scripts. Sonic-3.6 also carries locale-aware number/date formatting and IPA dictionaries (street and business names). If Cartesia loses the blind test, the fallback candidate is Inworld `inworld-tts-2` (fastest measured, native μ-law), not Eleven v3 Conversational (slowest of the tier, plugin support unverified, one voice per connection).
9. **STT → AssemblyAI Universal-3.5 Pro Realtime** with the 1,000-word keyterm list (business + services + common street names), LiveKit v1 for end-of-turn (not AssemblyAI's own), and Deepgram nova-3 retained as the FallbackAdapter leg. Decision rule: word/entity error on 20 recorded 8 kHz calls with addresses and names, plus `transcription_delay` from `turn_metrics`. Expected: fewer address correction loops, same latency.
10. **LLM → evaluate `gpt-5.6-luna` at `reasoning_effort="none"`** on the replay/tool suite (booking, slot_token handoff, address loop cap, corrections). The plugin already exposes `reasoning_effort`. Switch only if tool-call reliability matches 4.1-mini; the win is cost (~half) and a modest TTFT gain, and it removes the deprecation risk. Set `temperature=0.7` on whichever model ships (more consistent tool arguments than the default 1.0 while keeping opener variety).

### Tier 3: prompt rewrite (after Tier 1, because several sections exist only to compensate for pipeline behavior)

11. **Target ~4 k tokens.** Keep verbatim: OUTCOME WORDS, the STATE+DIRECTIVE handling rules, HANDLING CORRECTIONS + HEARING THROUGH THE PHONE, CALLER AUTHORITY, NO DOUBLE-BOOKING, name-once, spoken-numbers rules, LANGUAGE anti-hallucination. Cut or move: TOOL NARRATION (code-owned fillers), ENDING THE CALL two-turn rule (code already awaits playout; verify the goodbye-race diagnostic shows `text_done && audio_done` on the cascade, then let the model say goodbye and call `end_call` in the same turn, removing one LLM round-trip and the awkward pause), ECHO AWARENESS (BVC + input-mute handle it), CALL DURATION BOUNDS prose (watchdog enforces it), the repeated "one question per turn" statements (state once in style, once in FINAL).
12. **Replace banned-phrase lists with short positive principles plus three example dialogues** (happy path, address correction, decline → lead). The 2026 guides note long "never say X" lists prime the banned phrases on small models. Keep the two safety-critical lists (outcome words, address-validation phrases) but as one compact block each.
13. **Resolve the contradiction** between "Never do two things in one turn" and any same-turn speech + tool call, and re-anchor the register examples on the chosen TTS (Cartesia reads punctuation pauses; no `<break>` tags).
14. **Confirmation discipline stays as is** (address once via validate_address, name + time readback once before booking, no re-read after) since it matches the 2026 guidance exactly.

### Tier 4: infrastructure (Phase 3 of the existing plan)

15. Record Railway and LiveKit regions (`registered worker` log line), then colocate: worker and Supabase in one US region (or move the worker to LiveKit Cloud agent hosting). Removes ~130 ms per sequential Supabase query on tool turns and the pre-greeting path.

---

## 5. Target stack after the changes

| Layer | Target |
|---|---|
| Framework | livekit-agents 1.8.x, worker on Railway US (or LiveKit Cloud hosting) |
| STT | AssemblyAI Universal-3.5 Pro Realtime + keyterms; Deepgram nova-3 fallback |
| Turn detection | LiveKit Turn Detector v1 (audio), dynamic endpointing 0.3 / 2.5 s |
| Interruptions | adaptive mode, min_words 2, resume on false interruption |
| LLM | gpt-4.1-mini today → gpt-5.6-luna (effort none) after eval; temperature 0.7; prompt cache warm kept |
| TTS | Cartesia Sonic-3.6 (pinned) primary; ElevenLabs Flash v2.5 fallback |
| Latency masking | code-gated fillers (>600 ms tools only) + keyboard thinking sound |
| Prompt | ~4 k tokens, example-led, safety blocks verbatim |
| Expected voice-to-voice | ~0.8–1.1 s typical (from ~1.4–2.0 s); tool turns ~1.5 s (from ~3 s) |

---

## 6. Verification plan

- Before any change: pull 20 recent calls' `turn_metrics` lines (`eot_delay`, `transcription_delay`, `llm_ttft`, `tts_ttfb`) and `llm_metrics` (`cached_tokens`) from Railway to baseline P50/P95. Requires `railway link` on the agent project.
- Each tier lands behind the existing env-flag pattern (`VOCO_*`) so a bad tune is a redeploy-free rollback.
- Tier 1 acceptance: P50 voice-to-voice under 1.1 s on scripted test-console calls; no increase in `agent_false_interruption` or caller cut-offs on a 10-address script.
- Tier 2 acceptance: blind preference test for TTS; entity-error comparison for STT; full replay suite green for LLM.
- Tier 3 acceptance: all prompt tests updated and green; the five FINAL non-negotiables demonstrably preserved on the UAT scripts (fabricated availability, double booking, cut-off goodbye, two questions per turn, interrogation).

## 7. Open items to verify before implementing

1. LiveKit Inference turn-detector availability and pricing for a Railway-hosted worker on the Cloud project.
2. Cartesia and AssemblyAI plugin parameter names in 1.8.x (`extra_kwargs` for Cartesia speed/emotion; AssemblyAI model id `universal-3-5-pro` and keyterm argument).
3. Whether the ElevenLabs plugin accepts `eleven_v3_conversational` (only relevant if Cartesia loses the A/B).
4. Goodbye-race diagnostics on the cascade (`text_done`/`audio_done`) before removing the two-turn goodbye rule.
5. Railway service region and LiveKit worker region (INFRA-REGIONS.md blanks).

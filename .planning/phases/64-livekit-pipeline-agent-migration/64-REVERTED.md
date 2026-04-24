---
phase: 64
status: reverted
reverted_at: 2026-04-25
livekit_agent_revert_commit: d4a1ee1
livekit_agent_restored_to: 61a2e6e
homeservice_agent_docs_commit: 0e45692
---

# Phase 64 — REVERTED

> **Before reading the plan artifacts below, note this phase was aborted mid-execution.** Plans 01, 02, 03 landed in production. Plan 04 Task 1 pushed the branch + merged PR #2 into `livekit-agent/main`. UAT on main (Plan 04 Task 2) exposed regressions that were worse than the Phase 63.1 issues this phase was meant to solve, and the user pulled the plug before Plan 05 (UAT) or Plan 06 (phase close) ran.

## Final state

| Repo | Action | SHA |
|---|---|---|
| `livekit-agent/main` | File-level revert to `61a2e6e` (last Phase 63.1 state) | `d4a1ee1` |
| `livekit-agent` feature branch | `phase-64-pipeline-migration` deleted from origin | — |
| `homeservice_agent/main` | ROADMAP/STATE marked reverted with post-mortem | `0e45692` |

All Phase 64 commit history on `livekit-agent/main` is preserved above the revert commit for the record. All plan SUMMARY files in this directory remain as historical context.

## Why the swap failed (UAT post-mortem)

Phase 64 migrated the voice agent from `google.realtime.RealtimeModel(gemini-3.1-flash-live-preview)` (audio-to-audio) to a classical pipeline: `google.STT(chirp_3) + google.LLM(gemini-3-flash-preview) + GeminiTTS + silero.VAD`. Pre-phase estimate was ~500ms added per-turn latency in exchange for avoiding 5 upstream Realtime-path bugs (`_SegmentSynchronizerImpl` truncation, `generate_reply` capability-gate, tool-call cancellation on VAD).

Live UAT on the phone revealed the ~500ms estimate was wrong by an order of magnitude:

| Issue | Severity | Root cause |
|---|---|---|
| **End-of-turn latency ~7s** (vs target ~500ms added) | **Critical — caused caller hang-ups** | GeminiTTS first-byte ~1.3s + LLM thinking ~4s + VAD commit ~1.6s. GeminiTTS is not optimized for voice-agent first-byte latency; it's a general-purpose TTS. |
| **Self-echo triggered Silero VAD false-interrupts mid-greeting** | **Critical — greeting cut off after ~3.5s of ~8s** | SIP audio return path leaked TTS output back into the input stream. `BVCTelephony()` noise cancellation filtered most of it but not enough; brief echo pulses activated Silero VAD. `agent_false_interruption` events fired consistently. |
| **D-05 model name `gemini-3.1-flash` returned 404** | High — blocked responses entirely | Phase 64 D-05 locked the wrong identifier. Correct name is `gemini-3-flash-preview`. Fix applied mid-UAT in commit `b2254e3`. |
| **D-03b VAD `min_silence_duration=2.5s` mis-port** | High — added 2s to every turn | Phase 63.1-11's `silence_duration_ms=2500` was a Realtime **server-VAD** parameter, not a Silero parameter. Porting literally to local Silero VAD produced excessive endpointing delay. Reduced to `0.55s` (LiveKit default) mid-UAT in commit `81f06b4`. |
| **D-07 STT `location=global` rejected by Chirp 3** | High — first error in first live call | Chirp 3 is only served from `us` / `eu` multi-region endpoints, not `global` or any single-region. Fix applied in commit `f2330fb`. |

## What the revert does NOT solve

Reverting restores Phase 63.1's known issues, which were the original motivation for Phase 64:

1. `session.generate_reply()` silently dropped on `livekit-agents==1.5.6` + `gemini-3.1-flash-live-preview` (see memory `reference_livekit_generate_reply_gemini31.md`)
2. Phase 63.1-07 input-mute-during-greeting workaround (input audio disabled while greeting plays)
3. `_SegmentSynchronizerImpl` mid-word truncation race (upstream #4486/#5096, closed)
4. Tool-call cancellation on caller VAD (upstream #4441)

Accepting these back because, per live UAT, pipeline's latency + echo profile was more user-hostile than Realtime's known bugs for real callers.

## What would make another pipeline attempt viable

Not scoped, but for future reference — the pipeline approach could be revived if:

1. **Sub-500ms first-byte TTS** — e.g. Cartesia, Deepgram Aura, or ElevenLabs Flash. GeminiTTS first-byte (~1.3s) was the single biggest latency contributor after VAD tuning.
2. **Stronger echo canceller** — the LiveKit BVCTelephony default failed on this SIP topology. A SIP-gateway-level AEC (on the Twilio side) or a different noise-cancellation plugin tuning pass would be needed.
3. **Measure before committing** — next attempt should prove sub-3s end-to-end latency on a preview deploy *before* merging to main.

## Not planned as Phase 64.1

The revert is deliberately terminal. No Phase 64.1 planned. If a pipeline attempt is revisited later, it should be a new major phase (e.g. Phase 65+) with the viability gates above as explicit UAT bars.

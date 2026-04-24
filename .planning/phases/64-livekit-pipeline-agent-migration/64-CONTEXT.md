---
phase: 64
phase_name: livekit-pipeline-agent-migration
phase_type: structural-refactor
depends_on: [63.1]
blocks: [60.4-resumption-path]
status: seeded
created: 2026-04-24
---

# Phase 64 — LiveKit Pipeline Agent Migration (Seed)

## One-Line Goal

Swap the LiveKit voice agent from Gemini 3.1 Flash Live audio-to-audio Realtime architecture to a classical STT+LLM+TTS pipeline-agent stack — preserving ALL existing behavior, prompts, tools, tenant logic, integrations, and Phase 59/60/63 functionality. Pure architectural refactor, zero feature change.

## Architectural Change

### FROM (current, post-Phase-63.1)

```python
model = google.realtime.RealtimeModel(
    model="gemini-3.1-flash-live-preview",
    voice=voice_name,  # Zephyr / Kore / ...
    language=_locale_to_bcp47(locale),
    instructions=system_prompt,
    realtime_input_config=realtime_input_config,
    thinking_config=genai_types.ThinkingConfig(thinking_level="low", ...),
)
greeting_tts = GeminiTTS(voice_name=voice_name, model="gemini-2.5-flash-preview-tts", ...)
session = AgentSession(llm=model, tts=greeting_tts)
# + 63.1-06 TTS greeting workaround + 63.1-07 input mute during greeting +
#   63.1-11 VAD silence_duration_ms=2500 workaround + prompt's
#   "greeting already played — do not repeat" block
```

### TO (Phase 64 target)

```python
session = AgentSession(
    stt=google.STT(model="chirp_3", language="en-US", ...),
    llm=google.LLM(model="gemini-3.1-flash", ...),
    tts=GeminiTTS(voice="Zephyr", model="gemini-2.5-flash-preview-tts", ...),
    vad=silero.VAD(...),   # (research: confirm silero vs server VAD for pipeline)
)
# session.say(greeting_text) — works natively via TTS pipeline, no workaround
# session.generate_reply() — works natively, no capability gate
```

## Motivation (Why Now)

Phase 63.1 (Plans 01-11) shipped 11 iterative fixes targeting agent-speaks-first reliability on the Realtime path. All confirmed five distinct upstream SDK bugs that compound into unreliable call flow:

| # | Bug | Source | Upstream status |
|---|---|---|---|
| 1 | `_SegmentSynchronizerImpl.playback_finished called before text/audio input is done` — mid-word truncation | livekit-agents 1.5.6 Realtime pipeline | #4486 / #5096 OPEN, UNFIXED at 1.5.6 |
| 2 | `generate_reply is not compatible with 'gemini-3.1-flash-live-preview'` | `realtime_api.py:707` capability gate | Google plugin, `mutable_chat_context=False` for "3.1" models, no workaround |
| 3 | `session.say()` blocked by `RealtimeCapabilities.supports_say=False` | Google plugin | Same root cause as #2 |
| 4 | `update_chat_ctx` / `update_instructions` blocked mid-session | `mutable_chat_context=False`, `mutable_instructions=False` | Same root cause |
| 5 | `server cancelled tool calls` races when caller speaks during tool execution | Gemini server VAD | #4441 PARTIAL mitigation upstream; caller noise still fires false interrupts |

LiveKit maintainer David Zhao has closed PRs #5251 and #5262 (attempts to route around the capability gates) pending DeepMind guidance. Issue #5234 ("Gemini 3.1 support") is still open with no ETA. Local workarounds (Phase 63.1) stabilized individual call behaviors but could not deliver reliable end-to-end booking flow.

The pipeline architecture (STT + LLM + TTS as discrete plugins) uses LiveKit's mature plugin APIs — no capability gates, standard interrupt/VAD semantics, per-component failure modes. Tradeoff: ~500ms added per-turn latency (audio-to-audio ~300ms → pipeline ~800-1200ms) in exchange for **definitively reliable behavior** backed by mature SDK surfaces.

## What MUST NOT Change (Preserve Exactly)

- **LLM**: Gemini 3.1 Flash (text mode: `gemini-3.1-flash` instead of `gemini-3.1-flash-live-preview`) — same reasoning quality
- **Voice**: Zephyr (same Gemini TTS voice set; same `voice_name=voice_name` mapping logic)
- **All 7 in-process tools**: `check_availability`, `book_appointment`, `capture_lead`, `check_caller_history`, `check_customer_account`, `transfer_call`, `end_call`. Tool signatures, STATE/DIRECTIVE return formats, and all slot_token/slot_cache behavior must stay identical.
- **Prompt**: `build_system_prompt` + every `_build_*_section` builder (identity, working_hours, greeting, language, customer_account, intake_questions, decline_handling, transfer, call_duration, corrections, info_gathering, outcome_words, voice_behavior, tool_narration, booking, repeat_caller) — locale parity across all sections preserved.
- **Phase 55/56 Xero/Jobber pre-session context fetch**: `fetch_customer_context(...)` call at L234 of agent.py continues to run pre-`session.start()` and thread results through `build_system_prompt(customer_context=...)`.
- **Phase 59 record_outcome RPC**: `run_post_call_pipeline` → `record_call_outcome()` unchanged.
- **Phase 59 customer/job model**: `customer_calls` / `job_calls` junctions, activity_log integration_fetch / integration_fetch_fanout events.
- **Phase 60.3 [goodbye_race] instrumentation**: schema v1 remains byte-identical where possible; some fields (`text_done`, `audio_done`, `playback_finished_at`) may have different semantics on the pipeline path — investigate during research.
- **Phase 60.4 Stream A tenant_timezone plumbing**: `events.insert(..., timeZone=tenant_timezone)` in book_appointment + `_ensure_utc_iso` fallback + 3 hardening sites all preserved.
- **Phase 60.4 Stream B language pinning**: translated from `RealtimeModel(language=...)` to the equivalent STT plugin `language=...` kwarg.
- **Phase 63 SDK 1.5.6 upgrade**: livekit-agents==1.5.6 + livekit-plugins-google==1.5.6 pins remain.
- **Phase 63.1 tenant intake_questions pre-session hoist**: intake_questions fetched pre-`session.start()` and passed via `build_system_prompt(intake_questions=...)` — works identically on pipeline.
- **Post-call pipeline**: transcript, recording path, language detection, triage, owner notifications, booking reconciliation, recovery SMS cron, usage tracking — all firing off `session.on("close")`.
- **Tenant lookup**: `_normalize_phone` → tenant row fetch → subscription gate → VIP check.

## What CHANGES (Phase 64 scope)

- `src/agent.py` entrypoint: remove `google.realtime.RealtimeModel` + `realtime_input_config` + `GeminiTTS` attached to session. Add `google.STT`, `google.LLM`, pipeline `AgentSession` kwargs + `silero.VAD` (or alternative — research).
- Greeting delivery: remove Phase 63.1-06 TTS-plugin workaround + Phase 63.1-07 input mute + Phase 63.1-11 silence_duration_ms override. Use `session.say(greeting_text)` or `session.generate_reply(instructions="Greet the caller with...")` — these work natively on pipeline.
- `src/prompt.py` `_build_greeting_section`: revert Phase 63.1-06's "GREETING ALREADY PLAYED — DO NOT REPEAT" block back to a normal greeting directive. The pipeline flow naturally has the assistant speak first via `session.say()` or `generate_reply()`, no double-greeting risk.
- `src/prompt.py` `_build_booking_section`'s NO DOUBLE-BOOKING block: evaluate if still needed (pipeline tool-call lifecycle is tracked by the framework, not by the capability-gated google plugin). Can stay as defense-in-depth or be simplified.
- Tests under `tests/test_prompt_greeting_directive.py`: rewrite for new greeting directive.
- VAD config: translate Phase 60.2 LOW sensitivity + Phase 63.1-11 2500ms silence from `RealtimeInputConfig` to pipeline VAD equivalent (silero VAD parameters or whatever the new stack uses).

## Research Questions (for /gsd:research-phase 64)

1. **STT language pinning** — does `livekit-plugins-google.STT(model="chirp_3", language=...)` accept the same BCP-47 code set we use via `_locale_to_bcp47(locale)`? Any locale differences?
2. **LLM tool calling** — does `google.LLM(gemini-3.1-flash)` register the 7 tools the same way `@function_tool` works on RealtimeModel? Return format same? Error handling same?
3. **Pre-session context injection** — any pipeline-agent reason `build_system_prompt(customer_context=...)` wouldn't plug in the same? (Should be fine — system_prompt becomes the LLM's system message, same code path semantically.)
4. **VAD semantics** — Phase 60.2 + 63.1-11 barge-in tuning was server-side Gemini VAD via `realtime_input_config`. Pipeline uses local VAD (silero or livekit's turn_detector). How does barge-in work, and can we still dampen false-trigger on brief caller acks?
5. **Latency** — real measurement on Railway preview: STT stream → LLM → TTS stream end-to-end per turn. Acceptable for receptionist UX?
6. **Cost** — STT + LLM + TTS billed separately vs single Gemini Live bill. Per-minute cost comparison at expected call volume (Phase 44 figure ~X calls/month).
7. **Egress / recording** — does `lk.egress.start_room_composite_egress` still work the same way on pipeline? Same file path, same S3 upload?
8. **[goodbye_race] instrumentation** — Phase 60.3 Plan 01 instrumented 6 public-API hooks. Which ones carry over to pipeline? `_SegmentSynchronizerImpl` warnings won't fire (not in this path) but `last_text_token_at`, `last_audio_frame_at`, `playback_finished_at` may map to different event hooks.
9. **Spanish locale on Chirp 3** — is multi-language STT auto-detection reliable, or should we pin language per-tenant like Phase 60.4 did?
10. **Tool cancellation behavior** — when caller speaks during an in-flight pipeline tool call, what's the default behavior? Is there a config equivalent to `activity_handling=NO_INTERRUPTION` that works correctly (unlike the Realtime NO_INTERRUPTION which stalled tool responses in Phase 63.1-08)?

## Acceptance Bar (Must-Have Truths)

- `session.generate_reply()` works (was blocked; pipeline has no capability gate)
- `session.say()` works for arbitrary text (was blocked; pipeline TTS is the same TTS as greeting)
- Mid-word truncation from `_SegmentSynchronizerImpl` race does NOT appear in Railway logs (that pipeline is not used on pipeline agents)
- `server cancelled tool calls` does NOT fire on brief caller acknowledgments during tool execution
- End-to-end booking flow (greeting → info-gathering → check_availability → book_appointment → confirmation) completes successfully AND the agent verbalizes each step on EVERY live test call — no stalls, no retry loops
- All 7 tools continue to function; their Python code and return contracts are unchanged
- Greeting UX: caller hears branded greeting first, agent responds to caller input without re-greeting (Phase 63.1 UX preserved)
- Phase 60.3 [goodbye_race] records continue to emit on every call close (fields may differ; schema changes documented in SUMMARY)
- Phase 60.4 Stream A booking timezone correctness preserved (SG 3PM books at 3PM local, not 11PM)
- Post-call pipeline fires and writes transcript/recording/triage/language detection/notifications as before
- Latency per turn measured and documented — if >2s, address in follow-up phase or revisit design
- Cost delta measured and documented

## Constraints

- **NO feature changes in this phase** — pure architectural swap. If UX regressions surface during UAT, they go to a follow-up phase.
- All Phase 60.4 + Phase 63 + Phase 63.1 commits on livekit-agent/main remain in the history.
- The homeservice_agent side (Supabase RPCs, activity_log event types, call row lifecycle, billing, webhook routing) is NOT TOUCHED.
- Phase 60.3 [goodbye_race] instrumentation schema v1 remains byte-identical where the pipeline emits the same fields; any schema deviations documented as breaking changes in SUMMARY.

## Out of Scope (Follow-Up Phases)

- Phase 60.4 resumption against new pipeline — separate phase decision.
- Latency optimization beyond baseline (streaming TTS tuning, speculative LLM decode, etc.) — only if UAT shows baseline latency is too slow.
- Multi-provider fallback (e.g., Deepgram STT fallback if Chirp 3 fails) — separate reliability phase.
- Return to audio-to-audio once upstream SDK bugs are fixed — revisit when livekit-agents 1.5.7+ ships with confirmed Gemini 3.1 fix.

## Next Steps

1. Run `/gsd:discuss-phase 64` to surface assumptions and decisions before planning.
2. Run `/gsd:research-phase 64` for the research questions above.
3. Run `/gsd:plan-phase 64` to break down into the ~7 expected plans.

## References

- Phase 63.1 CONTEXT + RESEARCH: `.planning/phases/63.1-gemini-3-generate-reply-regression-fix/63.1-CONTEXT.md` + `63.1-RESEARCH.md`
- Phase 63.1 SUMMARY: `.planning/phases/63.1-gemini-3-generate-reply-regression-fix/63.1-SUMMARY.md`
- Phase 60.3 goodbye-race instrumentation: `.planning/phases/60.3-voice-agent-goodbye-cutoff-and-prompt-audit/`
- Phase 60.4 timezone + STT: `.planning/phases/60.4-booking-timezone-fix-and-stt-language-pinning/60.4-HANDOFF.md`
- LiveKit Gemini plugin docs: https://docs.livekit.io/agents/models/realtime/plugins/gemini/
- Upstream issue #5234 (Gemini 3.1 support): https://github.com/livekit/agents/issues/5234
- Closed PRs #5251 / #5262 (attempted workarounds)
- Community thread #708: https://community.livekit.io/t/generate-reply-times-out-on-first-dialogue-with-gemini-3-1-flash-live-preview/708

---
phase: 64
phase_name: livekit-pipeline-agent-migration
phase_type: structural-refactor
depends_on: [63.1]
blocks: [60.4-resumption-path]
status: ready-for-planning
created: 2026-04-24
discussed: 2026-04-24
---

# Phase 64 — LiveKit Pipeline Agent Migration — Context

**Gathered:** 2026-04-24
**Status:** Ready for research + planning

<domain>
## Phase Boundary

Swap `livekit-agent`'s session assembly from **Gemini 3.1 Flash Live Realtime audio-to-audio** (`google.realtime.RealtimeModel`) to a **classical STT + LLM + TTS pipeline** (`AgentSession(stt=, llm=, tts=, vad=)`). Pure structural refactor — preserve ALL existing behavior, prompts, tools, tenant logic, integrations, and every Phase 55/56/59/60.3/60.4/63/63.1 feature. **Zero feature change.**

**In scope:** `livekit-agent/src/agent.py` session assembly, greeting dispatch, VAD tuning translation, prompt revert/simplification for the narrow blocks that exist only to defend against Realtime-specific bugs.

**Out of scope:** Phase 60.4 resumption against the new pipeline (separate phase decision), latency optimization beyond baseline, multi-provider STT fallback, return-to-Realtime once upstream SDK bugs are fixed, any homeservice_agent Next.js side (webhooks, RPCs, activity_log schema, billing, dashboard).
</domain>

## Architectural Change

### FROM (current, post-Phase-63.1)

```python
model = google.realtime.RealtimeModel(
    model="gemini-3.1-flash-live-preview",
    voice=voice_name,                    # Zephyr / Kore / ...
    language=_locale_to_bcp47(locale),
    instructions=system_prompt,
    realtime_input_config=realtime_input_config,  # 63.1-11: silence_duration_ms=2500
    thinking_config=genai_types.ThinkingConfig(thinking_level="low", ...),
)
greeting_tts = GeminiTTS(voice_name=voice_name, model="gemini-2.5-flash-preview-tts", ...)
session = AgentSession(llm=model, tts=greeting_tts)
# + 63.1-06 TTS greeting workaround + 63.1-07 input mute during greeting
```

### TO (Phase 64 target)

```python
session = AgentSession(
    stt=google.STT(model="chirp_3", language=_locale_to_bcp47(locale), ...),
    llm=google.LLM(model="gemini-3.1-flash", ...),
    tts=GeminiTTS(voice_name=voice_name, model="gemini-2.5-flash-preview-tts", ...),
    vad=silero.VAD.load(min_silence_duration=2.5, ...),   # research confirms exact kwarg
)
# session.say(greeting_text) — native pipeline TTS, no 63.1-07 workaround
```

## Motivation (Why Now)

Phase 63.1 (Plans 01–11) shipped 11 iterative fixes targeting agent-speaks-first reliability on the Realtime path. All confirmed **five distinct upstream SDK bugs** that compound into unreliable call flow:

| # | Bug | Source | Upstream status |
|---|---|---|---|
| 1 | `_SegmentSynchronizerImpl.playback_finished called before text/audio input is done` — mid-word truncation | livekit-agents 1.5.6 Realtime pipeline | #4486 / #5096 OPEN, UNFIXED at 1.5.6 |
| 2 | `generate_reply is not compatible with 'gemini-3.1-flash-live-preview'` | `realtime_api.py:707` capability gate | Google plugin, `mutable_chat_context=False` for "3.1" models |
| 3 | `session.say()` blocked by `RealtimeCapabilities.supports_say=False` | Google plugin | Same root cause as #2 |
| 4 | `update_chat_ctx` / `update_instructions` blocked mid-session | `mutable_chat_context=False`, `mutable_instructions=False` | Same root cause |
| 5 | `server cancelled tool calls` races when caller speaks during tool execution | Gemini server VAD | #4441 PARTIAL mitigation; caller noise still fires false interrupts |

LiveKit maintainer David Zhao closed PRs #5251 and #5262 (attempts to route around capability gates) pending DeepMind guidance. Issue #5234 ("Gemini 3.1 support") is open with no ETA. Phase 63.1's local workarounds stabilized individual call behaviors but could not deliver reliable end-to-end booking flow.

The **pipeline architecture** (STT + LLM + TTS as discrete plugins) uses LiveKit's mature plugin APIs — no capability gates, standard interrupt/VAD semantics, per-component failure modes. Tradeoff: ~500ms added per-turn latency (audio-to-audio ~300ms → pipeline ~800–1200ms) in exchange for **definitively reliable behavior** backed by mature SDK surfaces.

<decisions>
## Implementation Decisions

### Rollout (Q1)
- **D-01: Big-bang feature branch `phase-64-pipeline-migration` → Railway preview → merge to `livekit-agent/main`.** Single merge commit swaps the stack. Rollback = `git revert` the merge commit + redeploy (~1–2 min Railway turnaround). No env-var flag, no parallel workers. Rationale: pipeline is the intended end state, dual-code-paths invite drift, and Phase 63/63.1 already validated this rollout shape.

### Greeting delivery (Q2)
- **D-02: `session.say(greeting_text)` with existing locale-branched templating.** Pass the templated greeting string (business_name + recording disclosure + "How can I help?") through the pipeline TTS. Deterministic brand wording, byte-identical to today's 63.1-06 greeting text; Zephyr voice via `GeminiTTS(model="gemini-2.5-flash-preview-tts")` identical to conversation turns. **No LLM turn consumed for greeting.**

### Phase 63.1 workaround unwind (Q3) — four sub-decisions

- **D-03a: Remove 63.1-07 input mute during greeting playback.** Root cause (SIP echo re-entering Gemini server VAD) does not apply to local Silero VAD on clean audio. Deletes `session.input.set_audio_enabled(False)` / `_unmute_after_greeting` task / 10s safety timer. Restores caller barge-in from T=0 and simplifies greeting dispatch.

- **D-03b: Port 63.1-11's 2500ms silence threshold to Silero VAD.** Translate `realtime_input_config.silence_duration_ms=2500` to the Silero-equivalent kwarg (likely `min_silence_duration=2.5` or `activation_threshold` tuning — **research must confirm the exact parameter name on `livekit-plugins-silero`**). Same intent: require deliberate caller speech (>2.5s continuous), not acks/breaths, before firing barge-in or turn boundary.

- **D-03c: Keep the "greeting already delivered" guardrail in `_build_greeting_section`, re-framed for pipeline.** Because `session.say()` inserts the greeting as assistant turn 1 in chat history, without the guardrail the model's first reply to caller input might re-start with "Hello, thanks for calling…". Re-frame 63.1-06's "GREETING ALREADY PLAYED — DO NOT REPEAT" block as "Greeting already delivered via system; respond directly to caller input now." Preserve EN + ES locale parity.

- **D-03d: Simplify the NO DOUBLE-BOOKING block in `_build_booking_section` to a one-liner.** Pipeline tool lifecycle is tracked by the framework (not capability-gated), so the original tool-call-race risk is gone. Replace the full block with a concise "Only call `book_appointment` once per confirmed slot" reminder. Preserve EN + ES locale parity. The existing "check_availability BEFORE book_appointment" invariant (already present in both locales post-60.3) remains the primary guardrail.

### VAD backend (Q4)
- **D-04: Silero VAD only (`livekit-plugins-silero`).** Local, fast (~30ms), free, the LiveKit pipeline quickstart default. The 2500ms threshold from D-03b lands here. No `turn_detector` plugin, no hybrid — semantic turn detection is overkill for a receptionist call where a 2.5s silence gap is already a strong signal, and adds per-turn model inference cost.

### Supporting decisions (Claude-filled defaults — downstream agents can treat as locked)

- **D-05: LLM carries forward as `google.LLM(model="gemini-3.1-flash")` (text mode).** Same reasoning quality as 3.1 Flash Live. `thinking_config` translates to whatever `google.LLM` supports (research confirms); if not supported on `google.LLM`, default thinking config is acceptable — we lose the "low" tuning but gain reliability. Temperature stays at model default (no override — Gemini 3 guidance from Phase 63.1-9).

- **D-06: TTS carries forward as `GeminiTTS(voice_name=voice_name, model="gemini-2.5-flash-preview-tts", instructions="Say this quickly, in a warm professional tone:")`.** Same plugin already attached for 63.1-06 greeting; promoted to session-level TTS. Zephyr / Kore / Puck voice set matches 1:1 with Gemini Live voice set — no audible switch for existing tenants.

- **D-07: STT = `google.STT(model="chirp_3")` with `language=_locale_to_bcp47(locale)`.** Phase 60.4 Stream B's language-pin intent translates 1:1 from Realtime `language=` kwarg to pipeline STT `language=` kwarg. Spanish on Chirp 3 reliability is a research question (Q9 in Research Questions below).

- **D-08: Cross-repo discipline unchanged.** All code changes ship in `C:/Users/leheh/.Projects/livekit-agent/`. Planning artifacts in `homeservice_agent/.planning/phases/64-.../`. `--no-verify` convention on both repos. Commit prefix `fix(64):` / `feat(64):` in livekit-agent, `docs(64-XX):` in homeservice_agent. Merge with `--no-ff` preserves per-plan commit history on main.

- **D-09: Preserve ALL Phase 55/56/59/60.3/60.4/63/63.1 surface (see "What MUST NOT Change" below).** Every integration, every tool, every prompt section builder, every pre-session fetch, every post-call pipeline hook — identical behavior.

- **D-10: UAT bar = same as Phase 63.1 (tests green + Railway preview + one live UAT call, both EN and ES if feasible).** Structural scope means more blast radius, but the rollback story (D-01) is clean. If the UAT call passes the acceptance bar below, merge. If not, iterate on the feature branch before merge, not on main.

- **D-11: Branch name:** `phase-64-pipeline-migration`. **Feature flag: none** (per D-01). **Rollback: `git revert <merge-sha>` + Railway redeploy.**

### Claude's Discretion

- Exact `silero.VAD.load()` parameter name for the 2500ms silence port — research confirms, planner selects.
- Whether `google.LLM` `thinking_config` surface matches `google.realtime.RealtimeModel`'s — research confirms; default is acceptable if divergent.
- Test file organization: extend `tests/test_prompt_greeting_directive.py` for the re-framed greeting guardrail vs. add a new `tests/test_pipeline_session.py` for session-assembly invariants — planner decides.
- Exact prompt wording for the re-framed "greeting already delivered" guardrail (D-03c) — planner drafts per `feedback_livekit_prompt_philosophy.md` (outcome-based, non-directive, EN+ES parity, USTED register in Spanish).
- Exact prompt wording for the simplified NO DOUBLE-BOOKING one-liner (D-03d) — same philosophy constraint.
- Whether to delete `realtime_input_config` / `_locale_to_bcp47` / `genai_types` imports fully, or keep as dead code for a follow-up cleanup — planner decides. Minor.

### Folded Todos

None — no matching pending todos for Phase 64 scope.
</decisions>

## What MUST NOT Change (Preserve Exactly)

- **LLM model**: `gemini-3.1-flash` (text mode, same reasoning as 3.1 Flash Live)
- **Voice**: Zephyr (same `voice_name=voice_name` tenant mapping; same Gemini TTS voice set)
- **All 7 in-process tools**: `check_availability`, `book_appointment`, `capture_lead`, `check_caller_history`, `check_customer_account`, `transfer_call`, `end_call`. Tool signatures, STATE/DIRECTIVE return formats, `slot_token`/`slot_cache` behavior — identical.
- **Prompt**: `build_system_prompt` + every `_build_*_section` builder (identity, working_hours, greeting, language, customer_account, intake_questions, decline_handling, transfer, call_duration, corrections, info_gathering, outcome_words, voice_behavior, tool_narration, booking, repeat_caller) — locale parity preserved across all sections. Only D-03c (greeting guardrail re-frame) and D-03d (booking one-liner) change prompt surface in Phase 64.
- **Phase 55/56 Xero/Jobber pre-session context fetch**: `fetch_customer_context(...)` at `src/agent.py:~234` continues pre-`session.start()` and threads results through `build_system_prompt(customer_context=...)`.
- **Phase 59 record_outcome RPC**: `run_post_call_pipeline` → `record_call_outcome()` unchanged.
- **Phase 59 customer/job model**: `customer_calls` / `job_calls` junctions, `activity_log` `integration_fetch` / `integration_fetch_fanout` events unchanged.
- **Phase 60.3 `[goodbye_race]` instrumentation**: schema v1 remains byte-identical where possible; some fields (`text_done`, `audio_done`, `playback_finished_at`) may have different semantics on the pipeline path — research maps the event hooks, planner documents schema deltas in SUMMARY.
- **Phase 60.4 Stream A tenant_timezone plumbing**: `events.insert(..., timeZone=tenant_timezone)` in `book_appointment` + `_ensure_utc_iso` fallback + 3 hardening sites all preserved.
- **Phase 60.4 Stream B language pinning**: translated from `RealtimeModel(language=...)` to `google.STT(language=...)` — same semantic, different kwarg path.
- **Phase 63 SDK 1.5.6 pins**: `livekit-agents==1.5.6` + `livekit-plugins-google==1.5.6` remain. Add `livekit-plugins-silero` pin (version via research).
- **Phase 63.1 intake_questions pre-session hoist**: fetched pre-`session.start()` and passed via `build_system_prompt(intake_questions=...)` — works identically on pipeline (system prompt becomes LLM's system message on the first turn).
- **Post-call pipeline**: transcript, recording path, language detection, triage, owner notifications, booking reconciliation, recovery SMS cron, usage tracking — all firing off `session.on("close")`.
- **Tenant lookup**: `_normalize_phone` → tenant row fetch → subscription gate → VIP check.
- **Egress**: `lk.egress.start_room_composite_egress` invocation and S3 upload path unchanged (research confirms pipeline compatibility).

## What CHANGES (Phase 64 scope)

1. **`src/agent.py` session assembly** — remove `google.realtime.RealtimeModel` + `realtime_input_config` + `GeminiTTS` attached as `tts=` kwarg. Add `google.STT`, `google.LLM`, `silero.VAD`, and wire them as pipeline `AgentSession` kwargs.
2. **Greeting dispatch** — preserve `session.say(greeting_text)` (already works on pipeline without capability gate). Delete 63.1-07 `session.input.set_audio_enabled(False)` / `_unmute_after_greeting` task / 10s timer (D-03a).
3. **VAD tuning** — translate `realtime_input_config.silence_duration_ms=2500` to Silero VAD equivalent (D-03b).
4. **`src/prompt.py` `_build_greeting_section`** — re-frame 63.1-06's block as "greeting already delivered, respond to caller input now" in both EN + ES (D-03c).
5. **`src/prompt.py` `_build_booking_section`** — simplify NO DOUBLE-BOOKING block to a one-liner in both EN + ES (D-03d). Preserve EN "check_availability BEFORE book_appointment" invariant.
6. **Tests** — `tests/test_prompt_greeting_directive.py` updates for re-framed guardrail; `tests/test_prompt_booking.py` updates for simplified one-liner. Session-assembly invariants may get a new test file (Claude's discretion).
7. **`requirements.txt`** — add `livekit-plugins-silero` pin.

## Research Questions (for `/gsd:research-phase 64`)

1. **STT language pinning** — does `livekit-plugins-google.STT(model="chirp_3", language=...)` accept the same BCP-47 set `_locale_to_bcp47(locale)` produces? Locale differences?
2. **LLM tool calling** — does `google.LLM(gemini-3.1-flash)` register the 7 `@function_tool` tools identically to Realtime? Return-format and error-handling parity?
3. **LLM thinking config** — does `google.LLM` accept `thinking_config`? If not, what's the default, and is the quality delta acceptable?
4. **Pre-session context injection** — any pipeline-agent reason `build_system_prompt(customer_context=..., intake_questions=...)` wouldn't plug in identically? (Should be fine — system_prompt becomes LLM system message.)
5. **Silero VAD parameter port** — exact kwarg for 2500ms silence threshold (`min_silence_duration=2.5`? `activation_threshold`? both?). Barge-in behavior on brief caller acks — does Silero dampen like the ported threshold expects?
6. **Latency measurement on Railway preview** — real STT stream → LLM → TTS stream end-to-end per turn. Acceptable for receptionist UX? Baseline vs. Realtime.
7. **Cost** — STT + LLM + TTS billed separately vs. single Gemini Live bill. Per-minute cost comparison at expected call volume.
8. **Egress compatibility** — does `lk.egress.start_room_composite_egress` work the same way on pipeline? Same file path, same S3 upload?
9. **`[goodbye_race]` instrumentation hook mapping** — Phase 60.3 Plan 01 instrumented 6 public-API hooks on Realtime. Which carry over to pipeline? `_SegmentSynchronizerImpl` warnings won't fire (not in this path); `last_text_token_at` / `last_audio_frame_at` / `playback_finished_at` may map to different event hooks.
10. **Spanish locale on Chirp 3** — multi-language STT auto-detection reliability vs. per-tenant language pin (Phase 60.4 Stream B pattern preserved).

<canonical_refs>
## Canonical References

**Downstream agents (researcher, planner, executor) MUST read these before acting.**

### Phase 63.1 immediate predecessor (shaped most of D-03)
- `.planning/phases/63.1-gemini-3-generate-reply-regression-fix/63.1-CONTEXT.md` — full context
- `.planning/phases/63.1-gemini-3-generate-reply-regression-fix/63.1-SUMMARY.md` — D-09 SHA list, merge commit `bc4befd`
- `.planning/phases/63.1-gemini-3-generate-reply-regression-fix/63.1-RESEARCH.md` — 1.5.6 API surface notes if present

### Phase 63 SDK upgrade
- `.planning/phases/63-livekit-sdk-upgrade-to-1-5-6-mainline/63-CONTEXT.md` — D-01..D-13 from 1.5.6 upgrade
- `.planning/phases/63-livekit-sdk-upgrade-to-1-5-6-mainline/63-RESEARCH.md` — upgrade surface audit
- `.planning/phases/63-livekit-sdk-upgrade-to-1-5-6-mainline/63-01-SUMMARY.md` — shipped merge commit `9ce12d6`

### Phase 60.3 goodbye-race instrumentation (must carry over)
- `.planning/phases/60.3-voice-agent-goodbye-cutoff-and-prompt-audit/60.3-SUMMARY.md`
- `.planning/phases/60.3-voice-agent-goodbye-cutoff-and-prompt-audit/60.3-STREAM-A-ANALYSIS.md`

### Phase 60.4 booking-timezone + STT language pinning (must carry over + unblocks on 64 ship)
- `.planning/phases/60.4-booking-timezone-fix-and-stt-language-pinning/60.4-HANDOFF.md` — 7 in-main commit SHAs preserved; resumption path blocked on Phase 64 merge

### Live code targets (exact file/region landmarks)
- `C:/Users/leheh/.Projects/livekit-agent/src/agent.py:33` — `AgentSession` import
- `C:/Users/leheh/.Projects/livekit-agent/src/agent.py:35` — `GeminiTTS` import (carries over, promoted)
- `C:/Users/leheh/.Projects/livekit-agent/src/agent.py:396-412` — `realtime_input_config` block (DELETE, replace with Silero VAD params)
- `C:/Users/leheh/.Projects/livekit-agent/src/agent.py:433-443` — `google.realtime.RealtimeModel` construction (REPLACE with `google.STT` + `google.LLM`)
- `C:/Users/leheh/.Projects/livekit-agent/src/agent.py:460-473` — `greeting_tts = GeminiTTS(...)` (REUSE as session-level TTS)
- `C:/Users/leheh/.Projects/livekit-agent/src/agent.py:474` — `AgentSession(llm=model, tts=greeting_tts)` (REPLACE with `AgentSession(stt=, llm=, tts=, vad=)`)
- `C:/Users/leheh/.Projects/livekit-agent/src/agent.py:859-941` — `session.say(greeting_text)` block + 63.1-07 input mute + 10s unmute task (REMOVE 63.1-07 mute per D-03a; KEEP session.say() per D-02)
- `C:/Users/leheh/.Projects/livekit-agent/src/prompt.py` — `_build_greeting_section` (D-03c re-frame), `_build_booking_section` (D-03d simplify)
- `C:/Users/leheh/.Projects/livekit-agent/requirements.txt` — add `livekit-plugins-silero` pin

### Upstream SDK issues (pipeline motivation — evidence)
- livekit/agents#5234 — Gemini 3.1 support (open, no ETA)
- livekit/agents#5251, #5262 — closed workaround PRs (pending DeepMind guidance)
- livekit/agents#4486, #5096 — `_SegmentSynchronizerImpl` truncation race (open)
- livekit/agents#4441 — `server cancelled tool calls` (partial)

### LiveKit docs (pipeline patterns)
- https://docs.livekit.io/agents/models/stt/plugins/google/ — Chirp 3 STT params
- https://docs.livekit.io/agents/models/llm/plugins/google/ — Gemini LLM text mode
- https://docs.livekit.io/agents/models/tts/plugins/google/ — Gemini TTS (same plugin already in use)
- https://docs.livekit.io/agents/models/vad/plugins/silero/ — Silero VAD params

### Memory flags (non-negotiable constraints)
- `feedback_livekit_prompt_philosophy.md` — outcome-based, non-directive, SDK-matched, EN+ES parity, USTED register
- `feedback_deep_verify_before_fix.md` — trace writers/readers + impact matrix before proposing a fix
- `reference_retell_ws_server.md` — livekit-agent repo location + Railway deploy target
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`GeminiTTS(voice_name=voice_name, model="gemini-2.5-flash-preview-tts", instructions=...)`** at `src/agent.py:460-473` — already attached as session TTS for 63.1-06 greeting. Promotes directly to session-level `tts=` kwarg on the new pipeline `AgentSession`. Zero behavior change.
- **`session.say(greeting_text)` call at `src/agent.py:904`** — works natively on pipeline (capability gate removed). Keep as-is per D-02.
- **`build_system_prompt(..., intake_questions=..., customer_context=..., locale=...)`** at `src/prompt.py` — pre-session assembly works identically on pipeline; `instructions=system_prompt` becomes the LLM's system message on turn 1.
- **`_run_db_queries` background task pattern** at `src/agent.py` — Phase 63.1-02 refactored to named-tuple unpacking; tenant / customer_context / intake_questions fetch fires pre-`session.start()`. Pattern unchanged for pipeline.
- **`_locale_to_bcp47(locale)`** helper — reusable as `google.STT(language=...)` arg (Phase 60.4 Stream B translation target).
- **`[goodbye_race]` `_GoodbyeDiagHandler` + `_flush_goodbye_diag`** (Phase 60.3 Plan 01) — instrumentation pattern carries over; individual field semantics may remap (research Q9).
- **Phase 60.2/63.1 tool-call cancellation prompt guardrails** in `_build_tool_narration_section` — pipeline lifecycle is framework-tracked (not capability-gated), so the 60.2 Pitfall 6 invariants remain the defensive prose even though the underlying Realtime race is gone.

### Established Patterns
- **Locale-branched prompt builders** — every `_build_*_section` has an `if locale == "es":` branch (Phase 60.3 Plans 05–12). Any D-03c / D-03d prompt edits MUST ship EN + ES parity, USTED register in Spanish. No English-only additions.
- **Pre-session fetch → `build_system_prompt(kwarg=...)` → prompt-level directive** — generalizable pattern Phase 63.1 established. Intake, customer_context, business_name, onboarding_complete all follow this shape. Pipeline preserves it.
- **Feature branch → Railway preview → merge** — Phase 63 and Phase 63.1 both used this shape. `--no-ff` merge preserves per-plan commit history on `livekit-agent/main`.
- **Cross-repo discipline** — `fix(X):` / `feat(X):` in `livekit-agent`, `docs(X-YY):` in `homeservice_agent/.planning/`. `--no-verify` convention on both.

### Integration Points
- **`session.start(...)` call site** at `src/agent.py:~722-735` — pipeline swap happens immediately above; `session.on("close")` post-call pipeline hook below is unchanged.
- **Egress start** at `src/agent.py:~943` — `lk.egress.start_room_composite_egress` invocation; research Q8 confirms pipeline compatibility.
- **Subscription gate + VIP check** — run pre-`session.start()`, unchanged.
- **Tenant-timezone plumbing** (Phase 60.4 Stream A) — lives in `src/tools/book_appointment.py`, not the session assembly. Zero impact from pipeline swap.
</code_context>

<specifics>
## Specific Ideas

### Why session.say() over generate_reply() for greeting
On pipeline, `generate_reply(instructions="Greet caller with...")` works without the Realtime capability gate — but the greeting wording would vary per call, making brand-invariant tests ("greeting contains business_name AND recording disclosure") brittle. `session.say(greeting_text)` preserves the exact branded templating we already ship today (63.1-06 baseline), Zephyr voice via the same TTS plugin. No LLM turn consumed. Deterministic.

### Why Silero over turn_detector
Turn_detector's semantic turn detection is smarter on trailing "um..." pauses but adds per-turn inference (~50–150ms) on top of an already ~500ms-heavier pipeline. For a receptionist call, 2.5s silence is already a strong enough signal; the extra smartness doesn't justify the latency or cost. If UAT later shows real-world pause patterns where Silero cuts off callers mid-thought, revisit in a Phase 64.1 follow-up.

### Why big-bang rollout over flag
A feature flag means two code paths live in `agent.py` for the duration of the phase (and likely beyond — flags rarely get cleaned up). Pipeline is the intended end state; there's no hedging value. Revert-the-merge is a clean, tested Phase 63/63.1 rollback shape. Railway redeploy ~1–2 min; acceptable blast-radius window for a structural swap validated on preview first.

### Greeting prompt guardrail re-framing (D-03c)
Phase 63.1-06's block reads: "GREETING ALREADY PLAYED — DO NOT REPEAT." On pipeline this is still true (session.say() speaks it first, model sees it in chat history) but the framing changes from "workaround" to "architectural fact." Re-framed prose: "Your FIRST turn is ALREADY complete — the system delivered the branded greeting. On your next turn, respond directly to what the caller said. Do not re-greet." EN + ES parity, USTED register.

### NO DOUBLE-BOOKING one-liner (D-03d)
Current block is ~8 lines. Proposed one-liner: "Only call `book_appointment` once per confirmed slot — if it returns success, the booking is final; do not re-invoke." EN + ES parity, USTED register. Keeps the semantic guardrail without duplicating the `check_availability BEFORE book_appointment` invariant already in the section.

### Testing bar
Matches Phase 63.1 (D-10). Full livekit-agent pytest green + Railway preview reports SUCCESS + "registered worker" + one live UAT call where: (a) greeting plays first, (b) agent responds to caller input without re-greeting, (c) end-to-end booking flow completes if tenant has availability, (d) `[goodbye_race]` record emits on call close with non-null fields where pipeline supports them. EN UAT mandatory; ES UAT if feasible (not blocking merge — ES coverage verified via 205-test pytest suite from Phase 60.3-12).
</specifics>

<deferred>
## Deferred Ideas

- **Phase 60.4 resumption against pipeline** — HANDOFF doc unblocks once Phase 64 ships; separate decision on whether to resume 60.4 Plans 04/05/06 on pipeline or archive them in favor of pipeline-native equivalents.
- **Latency optimization beyond baseline** — streaming TTS tuning, speculative LLM decode, STT stream chunking. Only if UAT latency measurement (research Q6) shows baseline is too slow; then Phase 64.1 follow-up.
- **Multi-provider STT fallback** (Deepgram / Azure / OpenAI) — separate reliability phase if Chirp 3 fails in production.
- **Return to audio-to-audio Realtime** once upstream SDK bugs (`_SegmentSynchronizerImpl` race, `mutable_chat_context=True` for 3.1 models, `server cancelled tool calls` hardening) are fixed — revisit when livekit-agents 1.5.7+ ships with confirmed Gemini 3.1 fix. Pipeline is the long-lived choice until then.
- **Turn detector plugin** — revisit if Silero VAD misbehaves on real caller pause patterns during UAT (Phase 64.1 candidate).
- **Env-var feature flag** — rejected for Phase 64, but the pattern is available if a future structural refactor has a less-clean rollback story.
- **Cold-start latency** (Phase 60.3 Call B-1 finding: 10+s silence on SIP connect) — infrastructure scope, not prompt/agent. Separate hardening phase.
- **70–87s silences during `book_appointment` tool execution** (Phase 60.3 Call B-1 finding) — prompt-refinement candidate; the pipeline swap may dissolve this (no more `server cancelled tool calls` races), but if it persists under pipeline UAT, separate follow-up.
- **STT-ASR mishearing EN as ES** (Phase 60.3 Call B-1 `¿Sabes?` transcript artifacts) — Chirp 3 may behave differently; validate in research Q10, follow-up phase if needed.

### Reviewed Todos (not folded)
None — no pending todos matched Phase 64 scope.
</deferred>

## Acceptance Bar (Must-Have Truths)

- `session.say()` works natively (no capability gate; pipeline TTS = same TTS plugin as today's greeting)
- `session.generate_reply()` works natively if ever invoked (no capability gate) — not used in normal flow per D-02, but available for emergency prompts
- `_SegmentSynchronizerImpl` mid-word truncation warnings do NOT appear in Railway logs (pipeline does not use that synchronizer path)
- `server cancelled tool calls` warnings do NOT fire on brief caller acknowledgments during tool execution (pipeline tool lifecycle is framework-tracked, not Gemini-server-VAD-cancellable)
- End-to-end booking flow (greeting → info-gathering → `check_availability` → `book_appointment` → confirmation) completes on every UAT call; agent verbalizes each step; no stalls, no retry loops
- All 7 tools function with Python code + return contracts unchanged
- Greeting UX: caller hears branded greeting first; agent responds to caller input on next turn without re-greeting
- Phase 60.3 `[goodbye_race]` records emit on every call close (field schema deltas documented in SUMMARY)
- Phase 60.4 Stream A booking timezone correctness preserved (SG 3PM books at 3PM local)
- Post-call pipeline fires and writes transcript / recording / triage / language detection / notifications as before
- Latency per turn measured and documented; if >2s worst-case, flag for Phase 64.1 but don't block merge
- Cost delta vs. Realtime measured and documented; not a merge gate

## Constraints

- **NO feature changes** — pure architectural swap. UX regressions surfaced during UAT → Phase 64.1 follow-up, not scope creep into 64.
- **All Phase 60.4 + Phase 63 + Phase 63.1 commits remain in `livekit-agent/main` history.** Feature branch `phase-64-pipeline-migration` cuts from current main HEAD (post-Phase-63.1 merge `bc4befd`).
- **homeservice_agent side is NOT TOUCHED.** Supabase RPCs, activity_log event types, call-row lifecycle, billing, webhook routing — zero change.
- **Phase 60.3 `[goodbye_race]` schema v1 remains byte-identical where pipeline emits the same fields.** Field mapping deltas documented in `64-SUMMARY.md`.
- `--no-verify` convention on both repos (D-08).

## Next Steps

1. `/gsd:research-phase 64` — answer Research Questions 1–10 above (STT locale set, LLM tool surface, Silero parameter port, egress compat, `[goodbye_race]` hook mapping, latency baseline, cost measurement, Chirp 3 ES reliability)
2. `/gsd:plan-phase 64` — break down into expected ~6–8 plans (session assembly swap + VAD port + greeting unwind + prompt re-frame + prompt simplify + test updates + requirements pin + Railway UAT)
3. Merge `phase-64-pipeline-migration` → `livekit-agent/main`; Phase 60.4 HANDOFF becomes resumable

---

*Phase: 64-livekit-pipeline-agent-migration*
*Context gathered: 2026-04-24*

---
type: system
system: Voice Agent
status: current
description: "Agent connects — await ctx.connect() joins the LiveKit room. Covers: Connection lifecycle; Call-duration watchdog (2026-06-10); Webhook server boot (Phase 39) + boot preflight (2026-06-12); Critical pin set — livekit-agents + sibling plugins"
source: .claude/skills/voice-call-architecture/SKILL.md § 1. Agent Service (LiveKit + Phase 66 cascade pipeline)
migrated: 2026-11-23
verified:
tags: [voco/system/voice-agent]
---

# Agent Service (LiveKit + Phase 66 cascade pipeline)

Part of [[Voice Agent]]. Migrated verbatim from the `voice-call-architecture` skill; check `verified` before trusting details.

### Connection lifecycle

1. Agent connects — `await ctx.connect()` joins the LiveKit room.
2. Wait for SIP participant — `ctx.wait_for_participant()` with 30s timeout.
3. Extract phone numbers from SIP attributes (`sip.trunkPhoneNumber`,
   `sip.phoneNumber`).
4. Call ID = `ctx.room.name` (`call-{uuid}`).
5. Test-call detection — room metadata `{test_call: true}` set by test-call route.
6. Phone normalization — `_normalize_phone()` strips `sip:`/`tel:` prefixes,
   `@domain` suffixes, ensures `+` E.164 prefix.
7. Tenant lookup — query `tenants` by `phone_number = to_number`.
8. **Pre-session customer context fetch** — `fetch_customer_context_with_fanout_telemetry`
   wraps `fetch_merged_customer_context_bounded(tenant_id, from_number)`.
   See `integrations-jobber-xero/references/python-agent-injection.md` for
   the Xero+Jobber 2.5s-bounded `asyncio.gather`. Phase 58 wrapper emits
   `integration_fetch_fanout` to `activity_log` (fire-and-forget via
   `asyncio.create_task`). The term `pre-session` refers to this phase —
   it happens before `session.start()`.
9. `build_system_prompt(locale, ..., customer_context=..., working_hours=...,
   tenant_timezone=...)`.
10. `create_tools(deps)` — returns the in-process tools with a shared
    `deps` dict (mutable — filled in as the call progresses). `deps`
    now also carries `"country"` (tenant ISO country code) — read by
    `book_appointment.py`/`capture_lead.py` as the address-validation
    `region_code` (prod-readiness 2026-06 fix; previously absent, so
    non-US tenants always validated against region "US").
11. **Phase 66 cascade construction** (`src/agent.py` ~L510-551):
    - `stt = deepgram.STT(model="nova-3", language="multi")` — preserves EN+ES
      code-switching; deliberately isolated to one line so the STT is
      one-line-swappable (AssemblyAI Universal-3 Pro / Deepgram Flux-multi are
      the UAT A/B candidates).
    - `turn_detection = MultilingualModel()` — semantic end-of-turn detection
      (more robust to brief SIP echo than raw Silero endpointing); model files
      pre-downloaded in the Dockerfile.
    - `llm = openai.LLM(model=LLM_MODEL, parallel_tool_calls=False,
      max_completion_tokens=500, prompt_cache_key=f"voco-agent:{tenant_id}")`
      — `LLM_MODEL = "gpt-4.1-mini"` (non-reasoning, low TTFT, strong tool
      calling). **2026-09-01 prompt caching:** `prompt_cache_key` (from
      `_prompt_cache_key(tenant_id)`; omitted when there is no tenant row)
      routes a tenant's requests to the machine holding its cached prefix
      (routing hint only — the hit still needs the byte-identical prefix
      that §4's cache-aware layout guarantees). An
      `@llm.on("metrics_collected")` handler — the LLM-object event; the
      AgentSession one is deprecated in 1.5.7 — logs
      `[agent] llm_metrics call= ttft= prompt_tokens= cached_tokens=
      completion_tokens= cancelled=` per request, the only place cache hits
      are visible. Right after `session.start()` the entrypoint fires
      `_warm_prompt_cache(llm, agent.chat_ctx.copy(), agent.tools,
      timeout_s=LLM_CACHE_WARM_TIMEOUT_S)` via `create_background_task`
      (`VOCO_LLM_CACHE_WARM`, default on): one completion with the session's
      exact instructions + tool schemas (`agent.chat_ctx` already holds the
      system instructions message; `agent.tools` is the list the activity
      sends), first chunk read then stream closed, `max_retry=0`, never
      raises — so OpenAI writes the ~9k-token prefix while the greeting
      plays and turn 1 reads it from cache. Why: OpenAI auto-caches
      ≥1024-token prefixes, so turns 2..n already hit, but gpt-4.1-mini has
      only in_memory retention (~5-10 min; no 24h tier) and most tenants
      don't get back-to-back calls, so turn 1 was a cold prefill. Expect
      `cached_tokens≈0` on the warm line and ≈prompt size on turn 1 — a 0
      on turn 1 means the warm didn't land before the caller spoke;
      `parallel_tool_calls=False` keeps the booking flow strictly
      sequential (never fires `check_slot` + `book_appointment` in one turn —
      the slot_token contract assumes one tool call resolves before the next).
      `max_completion_tokens=500` (2026-06-10) is a RUNAWAY BACKSTOP only —
      conciseness is enforced by the prompt; 500 tokens never truncates a
      legitimate turn (even the booking readback), it just caps pathological
      generation loops before minutes of runaway TTS. Verified against the
      installed livekit-plugins-openai 1.5.7 `LLM.__init__` signature.
    - `tts = _build_tts(voice_id, eleven_key_ok=ctx.proc.userdata.get("eleven_key_ok"))`
      (2026-09-04; was inline) — `elevenlabs.TTS(model=ELEVENLABS_TTS_MODEL, voice_id=voice_id)` —
      `"eleven_flash_v2_5"` (~75ms first byte; the sub-500ms TTS that makes the
      cascade viable where Phase 64's GeminiTTS ~1.3s did not). `voice_id` from
      `_resolve_voice` over `ELEVENLABS_VOICE_MAP` (labels
      professional/friendly/local_expert; main-repo migration 070).
      **LK-B1 (2026-06-21):** ElevenLabs is now wrapped in
      `tts.FallbackAdapter([elevenlabs.TTS(...), openai.TTS(model=OPENAI_TTS_MODEL,
      voice=OPENAI_TTS_VOICE)])` so a single ElevenLabs outage fails over to OpenAI
      TTS mid-call instead of dead-airing. The adapter construction is itself
      try/except-wrapped → degrades to ElevenLabs-only (never worse than before).
      `VOCO_OPENAI_TTS_MODEL` (default `gpt-4o-mini-tts`) / `VOCO_OPENAI_TTS_VOICE`
      (default `alloy`) env-override the fallback leg.
    - `vad` — Silero, defaults for barge-in. Do NOT port the
      realtime model's 2.5s silence value (Phase 64 did and added ~2s/turn).
      **2026-08-19:** loaded ONCE per worker process in `prewarm(proc)`
      (`WorkerOptions(prewarm_fnc=prewarm)`) and read from
      `ctx.proc.userdata["vad"]`; a per-call `silero.VAD.load()` remains only
      as the logged fallback when prewarm didn't run. **2026-09-04 P1.10:**
      `prewarm()` also calls `warm_supabase_connection()` (one
      `tenants.select("id").limit(1)`) so every idle job process already
      holds an open keep-alive TLS session to Supabase (Tokyo) before a
      call lands — log line `[agent] prewarm: supabase connection warmed`;
      `VOCO_SUPABASE_PREWARM=false` skips it. **P1.11:**
      `WorkerOptions(num_idle_processes=NUM_IDLE_PROCESSES)` pins the warm
      pool to `VOCO_NUM_IDLE_PROCESSES` (default 2; SDK default was
      `min(ceil(cpu), 4)`) — watch Railway logs for "no warmed process
      available for job" to raise it.
    - `VocoAgent(instructions=system_prompt, tools=tools)` +
      `AgentSession(stt=stt, llm=llm, tts=tts, vad=vad,
      turn_detection=turn_detection, allow_interruptions=True)`; register
      event handlers BEFORE `session.start()`.
12. `_run_db_queries` background tasks: subscription check + intake
    questions + calls row insert, as `asyncio.create_task()`. The
    subscription select now includes `current_period_end` alongside `status`
    (2026-06-12 — feeds the past_due grace check in the shared gate).
13. `await session.start(agent=agent, room=ctx.room, room_options=...)` —
    runs in parallel with DB queries.
14. Greeting (Phase 66): **deterministic** via
    `session.say(greeting_text, allow_interruptions=False)` right after
    `session.start()` — the cascade has a TTS, so `say()` works again. The text
    is fixed, byte-identical per locale from `src/messages/{en,es}.json`:
    `agent.greeting_onboarding` (with `{business_name}`) when
    `onboarding_complete`, else `agent.greeting_default`. **2026-09-04
    P1.9:** cut from 22 words to one clause — EN "Thanks for calling
    {business_name}. Calls are recorded — how can I help?" / "Hi, thanks for
    calling. Calls are recorded — how can I help?" (ES equivalents with
    diacritics) — because the whole greeting plays with caller input muted;
    the recording clause stays (US two-party states, SG PDPA). No test pins
    the wording beyond `tests/test_messages_greeting.py` (≤14 words,
    "recorded" present, `recording_disclosure` key retained). No LLM turn consumed,
    no per-call wording drift. `_build_greeting_section` in `prompt.py` tells
    the model the greeting was already delivered so it does not re-greet on
    turn 1. (The Phase 65 `generate_reply` greeting is historical.)
    - **Non-interruptible**: caller input is muted via
      `session.input.set_audio_enabled(False)` before the `say()` and unmuted
      once `SpeechHandle.wait_for_playout()` returns (10s
      `GREETING_UNMUTE_TIMEOUT_S` safety cap, force-unmute on timeout; if the
      `say()` dispatch failed, `greeting_handle` is None and input unmutes
      immediately). Unlike the realtime model (where it was ignored), the
      cascade AgentSession HONORS `allow_interruptions=False` on `say()` — it
      is a second echo defense behind the input mute (BVCTelephony is layer 1;
      the Phase-64 revert showed SIP self-echo can trip the VAD and cut the
      opening line in half). Barge-in resumes the moment the greeting finishes.
    - **LK-B1 no-input net (2026-06-21):** after the greeting unmutes
      (`_greeting_done` latch — so it NEVER fires during the muted greeting),
      `@session.on("user_state_changed")` "away" triggers `_no_input_sequence`,
      which speaks `agent.no_input_prompt` ("are you still there?") up to
      `VOCO_NO_INPUT_MAX_STRIKES` (2) times (waiting `VOCO_NO_INPUT_RESPONSE_WINDOW_S`
      =8s for a reply each), then ends the call via `agent.no_input_goodbye` +
      `_delayed_disconnect` — catches one-way-audio / dead-STT silence (which raise
      NO error) so the caller isn't stuck until the 10-min watchdog.
14b. **LK-B1 session error recovery (2026-06-21):** `@session.on("error")` still
    logs + Sentry-captures, but now also calls `_begin_recovery` on an
    UNRECOVERABLE error or after `VOCO_ERROR_RECOVERY_THRESHOLD` (3) errors →
    speaks `agent.recovery_error` (since 2026-09-04 P1.9: "Sorry — the line's
    breaking up on my end. Someone from the team will call you right back at
    this number." — the old text promised "let me take your details", which
    this path never does: it speaks the line and hangs up) then drives the SAME
    `_delayed_disconnect` graceful-capture teardown so the post-call pipeline still
    creates the lead + owner alert. Fully fail-open: `_recovery_started` idempotency
    latch, skips when `call_end_reason` is already agent_ended/transferred/max_duration,
    and `_speak_and_end` is try/except-wrapped (falls back to bare `ctx.shutdown()`)
    so a recovery can never throw or make the call worse. New strings
    `agent.recovery_error` / `no_input_prompt` / `no_input_goodbye` in en+es.
15. DB queries complete:
    - Subscription blocked → disconnect. Blocking is decided by the shared
      `is_subscription_blocked(status, current_period_end)`
      (`src/lib/subscription_gate.py`, 2026-06-12): canceled/paused/incomplete
      always; **past_due once the 3-day grace after `current_period_end` has
      elapsed** (fail-open on missing/unparseable period end).
    - Intake questions → injected into the system prompt pre-session
      (no longer via `generate_reply`).
    - Call record → `deps["call_uuid"]` updated.
16. Egress recording starts after DB task completes.
17. Session close → `_on_close_async` stops egress + runs
    `run_post_call_pipeline()`.
18. `entrypoint()` awaits a `close_complete` asyncio.Event so the LiveKit
    worker keeps the process alive through the post-call pipeline.

### Call-duration watchdog (2026-06-10)

The prompt's "wrap up at 9 / hard max 10 minutes" is prose, not enforcement —
`_call_duration_watchdog()` in `agent.py` (an `asyncio.create_task` started
right after the greeting-unmute task) is the server-side cap. Sleeps are
computed relative to `start_timestamp` so session-start latency doesn't extend
the cap. Both thresholds are env-overridable:

- **`VOCO_WRAP_UP_CALL_SECONDS` (default 540)** — appends a system-message
  wrap-up nudge via `agent.update_chat_ctx(nudge_ctx)` ("TIME LIMIT: ... Begin
  wrapping up now ..."). The LLM sees it on its next turn — cheap and
  non-disruptive (no forced speech mid-conversation).
- **`VOCO_MAX_CALL_SECONDS` (default 600)** — sets
  `call_end_reason[0] = 'max_duration'` (recorded as the call's
  `disconnection_reason` by post_call) BEFORE teardown, speaks a localized
  goodbye via `session.say(_msg(locale, "agent.max_duration_goodbye"),
  allow_interruptions=False)` with a 20s `wait_for_playout()` cap, then reuses
  end_call's `_delayed_disconnect(deps)` path (imported from
  `src/tools/end_call.py`): remove SIP participant → `ctx.shutdown()` → the
  post-call pipeline still runs.

The watchdog task is cancelled as the FIRST statement of `_on_close_async` on
normal close, so the max-duration goodbye/disconnect can never fire
mid-teardown.

### Webhook server boot (Phase 39) + boot preflight (2026-06-12)

`__main__` in `src/agent.py` runs a **boot preflight** (audit S4): it
raises `RuntimeError` and refuses to start when any of `OPENAI_API_KEY`,
`DEEPGRAM_API_KEY`, `ELEVEN_API_KEY` is missing. The STT/LLM/TTS plugins are
constructed PER CALL inside `entrypoint()`, so a missing key previously failed
at call time — every inbound call connected and died silently with no audio
while the liveness healthcheck stayed green. Failing the deploy visibly is the
fix.

**The preflight + `start_webhook_server()` are gated to the `start`/`dev`
subcommands** (`2026-06-26`): `__main__` reads `sys.argv[1]` and only enforces
the key check / starts the webhook for the worker-running modes. This is
load-bearing for the Docker build. The `Dockerfile` pre-downloads the
turn-detector + VAD models via `RUN python -m src.agent download-files` at
**build time, before any secrets exist**. That command also executes `__main__`;
before the gate, the preflight raised (no keys at build), `cli.run_app()` never
ran, so `download-files` never dispatched — and a stray `|| true` swallowed the
failure, shipping an image with **no turn-detector model files**. Every call
then crashed at `MultilingualModel()` (`agent.py` ~L625) with
`Could not find file "languages.json"`. `download-files` only fetches the
public `livekit/turn-detector` HF model (no keys needed) into
`/root/.cache/huggingface`, which bakes into the image layer (same path at
runtime; no `HF_HOME` override, no volume mount). The `|| true` was also removed
so a genuine download failure now fails the build loudly.

For the worker modes, before `cli.run_app()`, `__main__` calls
`start_webhook_server()` — spawns a daemon thread running uvicorn on port
8080. Serves `/health`, `/health/db`, and `/twilio/*`.

### Critical pin set — livekit-agents + sibling plugins

**Current pins (Phase 66):** everything livekit-* stays on the `1.5.7` line;
`livekit-plugins-openai` now provides the **LLM** (`openai.LLM`), not a
realtime model, and the cascade adds the Deepgram + ElevenLabs plugins:

```
livekit-agents==1.5.7
livekit-plugins-openai==1.5.7
livekit-plugins-deepgram==1.5.7
livekit-plugins-elevenlabs==1.5.7
livekit-plugins-silero==1.5.7
livekit-plugins-turn-detector==1.5.7
livekit-plugins-noise-cancellation>=0.2,<1
```

> (stale — superseded by the Phase 66 cascade, see agent.py; the RealtimeModel
> notes below are gpt-realtime-2 history.)
> **Verified against the installed `livekit-plugins-openai==1.5.7`
> (migration §17.1):**
> - **Model id `"gpt-realtime-2"` is NOT in the plugin's `RealtimeModels`
>   literal** (which knows `gpt-realtime` / `gpt-realtime-1.5` /
>   `gpt-realtime-2025-08-28`). The constructor accepts any `str`, so it
>   builds fine but is **verified only at the live OpenAI handshake (first
>   call)** — isolated as the single constant `OPENAI_REALTIME_MODEL` at the
>   top of `agent.py`. **← #1 UAT risk; change there if it 404s.**
> - **No `reasoning` kwarg** in the 1.5.7 constructor (would be silently
>   swallowed by `**kwargs`); omitted — gpt-realtime-2 defaults to `low`
>   effort, the desired low-latency setting.
> - **`input_audio_transcription` must be a typed
>   `openai.types.realtime.AudioTranscription`**, NOT a dict (the plugin's
>   `to_audio_transcription` only converts typed objects). Set to
>   `AudioTranscription(model="gpt-4o-mini-transcribe")` — caller-side
>   transcription feeds post-call triage + lead extraction.
> - **`TurnDetection` is NOT exported** from `livekit.plugins.openai.realtime`;
>   use `SemanticVad` from
>   `openai.types.realtime.realtime_audio_input_turn_detection` directly.
>   `semantic_vad`/`medium` is the plugin default. ServerVad fallback: swap to
>   `ServerVad(threshold=..., silence_duration_ms=...)`.
> - The Gemini-only config (`session_resumption`, `thinking_config`, the
>   `realtime_input_config` VAD, the `language=` STT pin) was removed.

**Do not bump carelessly.** Pin-version drift across `livekit-agents` and the
plugins has historically caused `RealtimeModel.__init__` signature mismatches
(see the Gemini-era 1.5.1→1.5.2 `RealtimeCapabilities` break, preserved in
`references/phase-history.md`). The rationale is duplicated in
`pyproject.toml` comments.

---

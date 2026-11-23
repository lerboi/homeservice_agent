---
type: system
system: Voice Agent
status: current
description: "Tools - transfer_call, end_call, goodbye cut-off (Phase 60.2-60.3). Covers: transfer_call — SIP REFER; end_call — Graceful Termination; Phase 60.2 — Fix H reverted (accepted limitation); Phase 60.3 — Goodbye cut-off diagnosis + prompt audit"
source: .claude/skills/voice-call-architecture/SKILL.md § 5. Tools (10 in-process)
migrated: 2026-11-23
verified:
tags: [voco/system/voice-agent]
---

# Tools (10 in-process) (part 3 of 4)

Part of [[Voice Agent]]. Migrated verbatim from the `voice-call-architecture` skill; check `verified` before trusting details.

### transfer_call — SIP REFER

Parameters: `caller_name`, `job_type`, `urgency`, `summary`, `reason`.
Writes `exception_reason` to calls row. Performs SIP REFER via
`LiveKitAPI().sip.transfer_sip_participant()` to `sip:{ownerPhone}@pstn.twilio.com`.

STATE codes preserved (Phase 30 names): `transfer_initiated`,
`transfer_failed reason=sip_error`, `transfer_unavailable` — now
wrapped in canonical `STATE|DIRECTIVE` envelope.

**Failed-transfer revert (2026-06-10):** the handler snapshots the prior
`deps["call_end_reason"][0]` before optimistically setting `"transferred"`;
on REFER failure it restores the prior reason AND nulls the calls row's
`exception_reason` (best-effort, non-fatal on revert error). The call
continues after a failed REFER — leaving "transferred"/exception_reason in
place poisoned the `disconnection_reason` recorded by the post-call pipeline.

### end_call — Graceful Termination

Returns a `STATE:call_ending | DIRECTIVE:...` envelope that tells the model
not to start a new turn after its current sentence completes.

Schedules a detached `_delayed_disconnect` task that:
1. Awaits `session.current_speech.wait_for_playout()` (livekit-agents 1.5.1
   native API) — blocks until the in-flight audio stream has fully drained
   through the SIP output. Capped at 20s as a hung-generation safety belt.
2. Removes the SIP participant via `LiveKitAPI().room.remove_participant()`.
3. Calls `ctx.shutdown()` which cascades into session close + post-call
   pipeline.

**Why not a fixed `asyncio.sleep(12)` (the legacy approach)?** A fixed
timer cut off long farewells when speech exceeded the budget and fired
too early on short ones. Worse, when the model called `end_call` mid-farewell,
the old return string `"[Call disconnected — do not produce any further
speech.]"` caused Gemini to abort its own in-flight audio, producing the
"speech cuts off halfway" symptom. The new return lets the current
sentence complete; the playout wait ensures the SIP buffer drains before
the participant is removed.

**Session handle plumbing:** `agent.py` sets `deps["session"] = session`
immediately after `AgentSession(...)` is constructed so the tool's
disconnect task can access `session.current_speech`.

### Phase 60.2 — Fix H reverted (accepted limitation)

Plan 03 implemented deterministic runtime filler in 4 scoped tools via
`context.session.say()`. Plan 05 UAT (2026-04-20, 226s call) revealed
`session.say()` raises `RuntimeError: trying to generate speech from
text without a TTS model` on `AgentSession(llm=RealtimeModel)` in
livekit-agents 1.5.1 — the session has no TTS because the realtime model
emits audio directly. Fix H reverted (commit `cbe1bb9` in livekit-agent repo).
**(stale — superseded by the Phase 66 cascade, see agent.py:** the cascade
session HAS a TTS, so `session.say()` works again and is used for the
deterministic greeting and the max-duration goodbye. The "no `session.say()`"
constraint applied only to `AgentSession(llm=RealtimeModel)`.) Pre-tool
preambles remain prompt-driven prose (`_build_tool_narration_section` in
`prompt.py`).

### Phase 60.3 — Goodbye cut-off diagnosis + prompt audit

**Stream A — Goodbye cut-off fix (Branch P, prompt-only):**

- **Plan 01 — Diagnostic instrumentation** (livekit-agent commit
  `c4f0570`). Added a per-call `[goodbye_race]` JSON logger.info line +
  Sentry breadcrumb emitted on every session close, via 6 public-API
  hooks in `src/agent.py` + `src/tools/end_call.py`: `end_call_invoked_at`,
  `last_text_token_at`, `last_audio_frame_at`, `playback_finished_at`
  (with `text_done` + `audio_done` flags sourced from the framework
  warning's `LogRecord extra=` fields — no private-symbol access),
  `participant_disconnect_at` + `disconnect_reason`, `session_close_at`
  + `close_reason`. Record also carries `transcript_tail` (last 3 turns,
  ≤500 chars, E.164-redacted via `_PHONE_REDACT_RE`) and
  `tool_call_log_tail`. Schema v1. `_flush_goodbye_diag` is the FIRST
  statement in `_on_close_async` so the record survives Fix I's 8s
  post-call pipeline timeout. `caller_phone_sha256` (SHA-256 first-16-hex)
  is used for operational grouping; raw E.164 numbers are NEVER logged.
- **Plan 02 — UAT #1 + analysis** (evidence in
  `.planning/phases/60.3-.../60.3-HUMAN-UAT.md` §"Stream A — UAT #1" +
  `60.3-STREAM-A-ANALYSIS.md`). Owner-placed call
  `call-_+65XXXXXXXX_KwsBVWBZkKps` reproduced mid-word truncation
  (`"Alright, I'll get all"` [cut]); payload showed `text_done=false,
  audio_done=true` (textbook upstream #5096 signature) AND
  `end_call_invoked_at` -11ms before `last_text_token_at` (directional
  Branch P signal). 3× mid-call `_SegmentSynchronizerImpl` warnings
  (+152s/+202s/+222s) proved the pipeline race is systemic, not
  goodbye-isolated. Ambiguous evidence → **Branch P** selected
  (prompt-only, fully revertable); Branch G deferred per
  evidence-driven discipline.
- **Plan 03 — Branch P fix + UAT #2** (livekit-agent commit `ebaa556`).
  `_build_call_duration_section` promoted to `ENDING THE CALL — CRITICAL
  RULE:` block with WRONG/RIGHT inline failure-mode example (`"Thank
  you for calling Voco — have a' *click*` vs speak-→-silence-→-separate-
  turn-end_call); section reordered to position 5 of `build_system_prompt`
  (top-attention band, after `_build_outcome_words_section` before
  `_build_tool_narration_section`). 5 new TDD tests in
  `tests/test_prompt.py`. UAT #2 (`call-_+65XXXXXXXX_B8XEm2FgLTGZ`, 62s)
  verdict **PARTIAL**: primary #5096-race goal achieved
  (`_SegmentSynchronizerImpl` warning absent, transcript ended on a
  complete sentence), but surfaced a decline-case farewell-content gap
  (model said only `"I understand."` and invoked end_call without any
  farewell phrase). Tracked as a Stream B candidate (see Plan 05 in the
  audit below).
- **Upstream reference:** livekit/agents#5096 (authoritative
  Gemini-Realtime + EndCallTool bug). **#4486 is a DIFFERENT race class
  — do not conflate.**
- **Instrumentation sample-rate dial-back (D-A-03):** currently
  every-call. Dial-back to race-detected-only (only emit when the
  synchronizer warning fires with `text_done=false`) is explicitly
  NOT recommended yet — the cumulative Stream B UAT (below) surfaced
  a new "never-ends-call" regression that benefits from full-sample
  coverage; re-evaluate inside Phase 60.4.

**Stream B — Prompt audit + locale parity (Plans 04-12):**

- **Plan 04 — Prompt audit doc** (homeservice_agent commit `6653675`).
  `60.3-PROMPT-AUDIT.md` scored all 16 `_build_*_section` builders
  across 7 dimensions (anti-hallucination, realtime-model phrasing,
  section ordering, STATE+DIRECTIVE, VAD-redundant, token economy,
  locale parity). Finding: **D7 locale parity ✗ on 13 of 15 active
  sections** — the dominant cross-cutting gap, responsible for the
  Plans 05-12 patch series.
- **Plans 05-12 — Per-section patches** (one atomic livekit-agent
  commit per plan, shipped Railway-live):
  - P05 `_build_call_duration_section` (RED `144cbf9`, GREEN `9f27a7a`)
    — EN CRITICAL RULE preserved verbatim, ES `"TERMINAR LA LLAMADA —
    REGLA CRÍTICA"` mirror added with USTED register + INCORRECTO /
    CORRECTO parallel example. Establishes the inline-branch pattern.
  - P06 `_build_tool_narration_section` (RED `1e0da25`, GREEN `c2bd059`)
    — ES filler-phrase examples per tool; 60.2 Pitfall-6 inverted
    assertions preserved (tool names `check_availability`,
    `book_appointment`, `capture_lead`, `transfer_call` NOT translated
    — code identifiers, enforced at the test layer).
  - P07 `_build_voice_behavior_section` (RED `2e035a4`, GREEN `2d24bbb`)
    — ES `"ESTILO DE VOZ Y CONVERSACIÓN"` (energy-matching, readback
    slowdown, one-focused-thing, acknowledge-before-advance). EN
    preserved (D5 VAD-redundant pacing is load-bearing for realtime
    boundary coaching, not redundant with Fix G VAD).
  - P08 `_build_corrections_section` (RED `fcf81d1`, GREEN `9336955`)
    — ES `"MANEJO DE CORRECCIONES — REGLA CRÍTICA"` (5 numbered rules;
    Spanish address example `"Calle Principal 123"` → `"Avenida Roble
    456"`). D2 negation-reframe deferred — corrections section IS the
    anti-hallucination spine for caller-supplied facts.
  - P09 `_build_outcome_words_section` (RED `10adac7`, GREEN `2ffffa1`)
    — ES `"PALABRAS DE RESULTADO — REGLA CRÍTICA"` with reserved-word
    enumeration (disponible / confirmado / reservado / specific time
    ↔ tool pre-condition). **Highest D1 anti-hallucination stakes in
    the entire prompt.** Top-attention-zone coverage complete in both
    locales.
  - P10 `_build_info_gathering_section` (RED `7f47488`, GREEN `b2b1027`)
    — outer-frame ES parity + D6 compression (dropped redundant
    language-switch reminder) + Rule-2 additions (PHONE NUMBER /
    NÚMERO DE TELÉFONO digit-by-digit readback block; `postal_label`
    wired into both address blocks). Invariant-lock plan pattern
    established via 10 inverted-substring assertions.
  - P11 `_build_booking_section` (RED `bd65986`, GREEN `af2653e`)
    — closed the 85% ES parity gap (previously only the READBACK block
    was localized). ES `RESERVA / PROGRAMACIÓN / REGLAS DE
    DISPONIBILIDAD / MANEJO DEL RESULTADO / ANTES DE RESERVAR — LECTURA
    DE CONFIRMACIÓN / DESPUÉS DE RESERVAR` mirrors EN 1:1. D1
    anti-hallucination invariants codified at test layer (two-step
    availability contract, mandatory readback, no "confirmed"/"booked"
    until `book_appointment` returns success).
  - P12 `_build_identity` + `_build_working_hours` + `_build_greeting`
    + `_build_language` + `_build_customer_account` + `_build_intake_questions`
    + `_build_decline_handling` + `_build_transfer` (RED `8535cb2`,
    GREEN `ffab7c0`) — 8 remaining builders batch-locale-branched with
    USTED register. Full assembled EN/ES length delta 10.2% (within
    30% drift guard).

**D-B-03 closure — "full 16 sections × 2 locales":**

The mandate is satisfied, with documented exceptions:

- `_build_repeat_caller_section` returns `""` unconditionally — no
  content, no parity work (intentional no-op).
- `_build_working_hours_section` internal dict KEYS (`"monday"` etc.)
  stay English for tenant-config lookup compatibility; caller-facing
  prose (day labels, "closed", lunch notes) IS translated.
- Tool names (`check_availability`, `book_appointment`, `capture_lead`,
  `end_call`, `transfer_call`) are code identifiers and never
  translated — enforced as a test assertion in `test_prompt_tool_narration.py`.
- `TONE_LABELS` dict values (`"measured and formal"` etc.) are not
  translated — embedded in identity_section prose; low-impact.
- `customer_context` STATE block from `format_customer_context_state`
  remains English (structured data; Jobber/Xero field-name cross-runtime
  Python ↔ TS consistency per Phase 55/56).

`grep 'if locale == "es":' src/prompt.py` count at phase close: **15**
(booking counted once post-Plan-11 top-level promotion). Test count at
phase close: **205 passed, 1 deselected** on livekit-agent pytest
(baseline 101 from 60.2; +104 new tests across 8 new files
`test_prompt_call_duration.py`, `test_prompt_tool_narration.py`,
`test_prompt_voice_behavior.py`, `test_prompt_corrections.py`,
`test_prompt_outcome_words.py`, `test_prompt_info_gathering.py`,
`test_prompt_booking.py`, `test_prompt_tail_sections.py`, plus
existing `test_prompt.py` extensions — 60.2 Plan 05 inverted
assertions preserved).

**Cumulative UAT (Plan 13) — VERDICT: PARTIAL, new regression surfaced:**

Live call `call-_+65XXXXXXXX_wZcRQ5JBcMq3` (386s, booked appointment
`d46bab5e-fe58-4a99-90ea-4a9704453a1c` for 2026-04-30 14:00). Full
goodbye phrase completed — Stream A Branch P primary goal **ACHIEVED**
(`"Thank you for calling make it ai. Have a great day. Goodbye."` with
no mid-word truncation). But the Branch P CRITICAL RULE's "THEN in a
separate turn with no additional speech, call end_call" over-corrected
— the model waited **16.177 seconds** between `last_text_token_at` and
`end_call_invoked_at`, and the caller (who said "Hello." into the
post-goodbye silence) manually hung up. Tracked as the anchor
follow-up for Phase 60.4; see `60.3-SUMMARY.md` §Follow-ups.

**Spanish locale branches remain unverified in production.** Call B-2
(Spanish language-detection path) was not placed during the cumulative
UAT. Plans 05-12 ES code has shipped to Railway but only symmetry
(structural parity with EN) is proven; live Gemini Realtime behavior
against Spanish prose will be verified in Phase 60.4.

**Plans 60.3-01 through 60.3-13 full documentation** — see
`.planning/phases/60.3-voice-agent-goodbye-cutoff-and-prompt-audit/`
(context, research, audit, analysis, HUMAN-UAT, phase rollup).

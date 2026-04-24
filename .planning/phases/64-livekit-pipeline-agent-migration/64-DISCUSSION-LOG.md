# Phase 64: LiveKit Pipeline Agent Migration — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `64-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-04-24
**Phase:** 64-livekit-pipeline-agent-migration
**Areas discussed:** Migration rollout strategy, Greeting delivery method, Phase 63.1 workaround unwind scope (4 sub-decisions), VAD backend choice

---

## Seeding state

Phase 64 already had a seed `64-CONTEXT.md` written 2026-04-24 at roadmap-add time.
The seed documented architectural FROM/TO, "What MUST NOT Change", "What Changes",
10 research questions, and the acceptance bar. The discussion captured the four
implementation decisions the seed left open and enriched the file with decisions,
canonical refs, and code context.

---

## Area 1 — Migration rollout strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Big-bang branch + merge | Feature branch `phase-64-pipeline-migration`, Railway preview before merge (same as Phase 63/63.1). Rollback = git-revert merge commit + redeploy. Simplest, no dual-code-path cost. | ✓ |
| Env-var feature flag (AGENT_MODE=pipeline\|realtime) | Both code paths kept side-by-side; env var selects at worker boot. Zero-risk rollback (flip + redeploy). Cost: dual-maintained code path, invites drift. | |
| Parallel worker profiles | Two worker processes; pipeline worker and realtime worker, routed via room metadata. Highest complexity — overkill for a structural swap intended to keep. | |

**User's choice:** Big-bang branch + merge
**Notes:** Selected recommended option; rationale matches Phase 63/63.1 precedent.

---

## Area 2 — Greeting delivery method

| Option | Description | Selected |
|--------|-------------|----------|
| `session.say(greeting_text)` — exact text | Templated greeting (business_name + recording disclosure + "How can I help?") through pipeline TTS. Deterministic brand wording. Same plugin as today's 63.1-06 TTS. No LLM turn consumed. | ✓ |
| `session.generate_reply(instructions="Greet caller...")` | LLM generates greeting. More natural variation but brand wording drifts between calls. Testing invariants become brittle. Costs one LLM turn per call. | |
| Hybrid: say() for disclosure, generate_reply() for follow-up | session.say() for disclosure then generate_reply() for question. Adds complexity for minimal payoff. | |

**User's choice:** `session.say(greeting_text)` — exact text
**Notes:** Preserves 63.1-06 text templating verbatim; deterministic.

---

## Area 3 — Phase 63.1 workaround unwind scope

### 3a — 63.1-07 input mute during greeting playback

| Option | Description | Selected |
|--------|-------------|----------|
| Remove | Pipeline VAD runs locally on clean audio; 63.1-07 root cause (SIP echo on server VAD) doesn't apply. Restores caller barge-in from T=0. | ✓ |
| Keep as belt-and-suspenders | Retain input mute + 10s unmute timeout. Costs caller interrupt during greeting; extra code to maintain. | |
| Remove, with re-add-if-UAT-fails escape hatch | Remove in main plan; re-add in follow-up if UAT shows echo-triggered false barge-in. | |

**User's choice:** Remove
**Notes:** Recommended option; local Silero VAD on clean audio eliminates the 63.1-07 root cause.

### 3b — 63.1-11 silence_duration_ms=2500 translation

| Option | Description | Selected |
|--------|-------------|----------|
| Translate to pipeline VAD min_silence_ms=2500 | Port conservative threshold to Silero. Specific kwarg name via research. | ✓ |
| Start with pipeline VAD default, tune only on false-triggers | Silero defaults may behave differently on clean local audio. Tune only if UAT shows false barge-ins. | |
| Skip — let VAD-backend discussion decide | Defer pending #4 decision. | |

**User's choice:** Translate to pipeline VAD min_silence_ms=2500
**Notes:** Preserves Phase 63.1-11 intent; exact Silero kwarg deferred to research.

### 3c — Prompt 'GREETING ALREADY PLAYED — DO NOT REPEAT' block

| Option | Description | Selected |
|--------|-------------|----------|
| Keep | session.say() inserts greeting as assistant turn 1 in chat history; without guardrail, model's first response may re-greet. Re-frame as "greeting already delivered, respond to caller input now." | ✓ |
| Revert to pre-63.1 normal greeting directive | Original assumed model-generated greetings. Risks double-greeting. | |
| Delete both 63.1 block AND pre-63.1 greeting directive entirely | Smallest surface but loses defense if model starts with "Hello again..." | |

**User's choice:** Keep (re-framed)
**Notes:** Recommended; preserves defense against model re-greeting with architectural-fact framing rather than workaround framing.

### 3d — Prompt 'NO DOUBLE-BOOKING' block

| Option | Description | Selected |
|--------|-------------|----------|
| Keep as defense-in-depth | Original tool-call-race risk gone, but prompt also defends against LLM multi-attempt confusion. Cheap safety net. | |
| Simplify to one-liner | Replace full block with concise "Only call book_appointment once per confirmed slot" reminder. Reduces prompt length, keeps semantic guard. | ✓ |
| Remove entirely | Trust pipeline tool lifecycle + existing `check_availability BEFORE book_appointment` invariant. | |

**User's choice:** Simplify to one-liner
**Notes:** Balances prompt-length reduction against keeping a lightweight guard; EN + ES parity required.

---

## Area 4 — VAD/turn-detection backend

| Option | Description | Selected |
|--------|-------------|----------|
| Silero VAD only | Local, ~30ms, free, LiveKit pipeline default. `livekit-plugins-silero`. 2500ms port from 63.1-11 lands here naturally. Simple, predictable. | ✓ |
| livekit turn_detector plugin | Semantic turn detection. Smarter on trailing "um..." pauses. Adds per-turn model inference (+50-150ms). Higher cost. | |
| Silero + turn_detector hybrid | Silero for cheap silence gating, turn_detector as semantic arbiter. Most sophisticated but adds both plugins' lifecycles. | |

**User's choice:** Silero VAD only
**Notes:** 2.5s silence already strong signal for receptionist calls; turn_detector's smartness doesn't justify the added latency/cost. Revisit in 64.1 if UAT shows Silero cuts off callers mid-thought.

---

## Claude's Discretion (captured in CONTEXT.md)

- Exact `silero.VAD.load()` parameter name for 2500ms port (research confirms)
- `google.LLM` `thinking_config` surface match vs default (research confirms)
- Test file organization (extend `tests/test_prompt_greeting_directive.py` vs new `tests/test_pipeline_session.py`)
- Exact wording for re-framed "greeting already delivered" guardrail (D-03c) — EN + ES, USTED register
- Exact wording for simplified NO DOUBLE-BOOKING one-liner (D-03d) — EN + ES, USTED register
- Whether to delete `realtime_input_config` / `_locale_to_bcp47` dead imports fully or defer to follow-up cleanup

## Deferred Ideas

Listed in full in CONTEXT.md `<deferred>` section — Phase 60.4 resumption against pipeline, latency optimization, multi-provider STT fallback, return-to-audio-to-audio revisit, turn_detector plugin revisit, env-var flag pattern for future refactors, cold-start latency infrastructure work, 70–87s tool-execution silences, STT-ASR EN-as-ES mishearing.

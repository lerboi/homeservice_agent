---
type: system
system: Voice Agent
status: historical
description: "gpt-realtime-2 uses OpenAI server-side turn detection. The agent constructs Covers: Turn detection — SemanticVad (Phase 65); Voice resolution (Phase 44 AI Voice Selection); Non-blocking I/O pattern"
source: .claude/skills/voice-call-architecture/SKILL.md § 3. OpenAI Realtime Session
migrated: 2026-11-23
verified:
tags: [voco/system/voice-agent]
---

# OpenAI Realtime Session

Part of [[Voice Agent]]. Migrated verbatim from the `voice-call-architecture` skill; check `verified` before trusting details.

> ⚠️ **(stale — superseded by the Phase 66 cascade, see agent.py.)** The whole
> section (RealtimeModel construction, SemanticVad turn detection, OpenAI voice
> resolution / `VOICE_MAP` / migration-067 CHECK) describes the Phase 65
> gpt-realtime-2 code. The live construction is the cascade in §1 step 11;
> voices are now ElevenLabs voice_ids resolved from LABELS
> (professional/friendly/local_expert) via `ELEVENLABS_VOICE_MAP` (main-repo
> migration 070 stores labels, clears stale OpenAI values — the "migration 068"
> the agent comments originally referenced was never the label migration (068 is
> billing hardening); 070 realized it. Every voice_id must
> exist in the ElevenLabs account's "My Voices"). Retained as historical record.

```python
from openai.types.realtime import AudioTranscription
from openai.types.realtime.realtime_audio_input_turn_detection import SemanticVad

OPENAI_REALTIME_MODEL = "gpt-realtime-2"  # isolated constant — see §1 UAT risk

model = openai.realtime.RealtimeModel(
    model=OPENAI_REALTIME_MODEL,
    voice=voice_name,
    turn_detection=SemanticVad(
        type="semantic_vad",
        eagerness="medium",
        create_response=True,
        interrupt_response=True,
    ),
    input_audio_transcription=AudioTranscription(
        model="gpt-4o-mini-transcribe",
    ),
)

agent = VocoAgent(instructions=system_prompt, tools=tools)
session = AgentSession(llm=model)  # no tts= — the realtime model emits audio itself
```

### Turn detection — SemanticVad (Phase 65)

gpt-realtime-2 uses OpenAI server-side turn detection. The agent constructs
`SemanticVad(eagerness="medium", create_response=True, interrupt_response=True)`
— the plugin default and the recommended starting point for this SIP topology.
Semantic VAD decides end-of-turn from the *content* of the caller's speech
rather than a fixed silence timer.

- `create_response=True` — the model responds automatically at end-of-turn.
- `interrupt_response=True` — caller speech can barge in (keep this on;
  callers must be able to interrupt for emergencies).

If live UAT shows over- or under-eager turn-taking, switch to
`ServerVad(threshold=..., prefix_padding_ms=..., silence_duration_ms=...)`
(the fixed-timer fallback). See `docs/OPENAI-REALTIME-2-MIGRATION.md` §7.5.

> **Why the Gemini VAD-tuning history is gone:** the old
> `START_SENSITIVITY_LOW` / `silence_duration_ms=1500` config and the
> `server cancelled tool calls` / `_SegmentSynchronizerImpl` cancellation
> cascade it fought were specific to Gemini 3.1's server-side VAD + blocking
> function calling. gpt-realtime-2 has native async function calling — an
> in-flight tool call is NOT cancelled when the caller speaks — so that
> failure class is gone at the source. The historical tuning is preserved in
> `references/phase-history.md`.

### Voice resolution (Phase 44 AI Voice Selection)

```python
ai_voice = tenant.get("ai_voice") if tenant else None
# Validate against the OpenAI voice set; an unsupported value (e.g. a stale
# Gemini voice like "Zephyr") errors the whole session at the OpenAI handshake.
voice_name = _resolve_voice(ai_voice, tone_preset)  # invalid -> VOICE_MAP[tone]
```

`_resolve_voice()` + the `OPENAI_VOICES` allowlist (agent commit `35238f7`)
guard against stale/drifted `ai_voice`. Incident 2026-06: tenant "Make It AI"
held the Gemini voice "Zephyr" — gpt-realtime-2 rejected it (`invalid_value`),
erroring the session on every call, because **migration 067 (NULL ai_voice +
OpenAI CHECK) had not been applied to prod**. Fix = apply 067 + redeploy.

`VOICE_MAP` (Phase 65 — OpenAI gpt-realtime voices; was Zephyr/Aoede/Achird under Gemini):
| tone_preset | Voice | Character |
|-------------|-------|-----------|
| `professional` | marin | Clear and professional |
| `friendly` | cedar | Warm and friendly |
| `local_expert` | alloy | Relaxed and neutral |

10 voices available in dashboard AI Voice Settings: alloy, ash, ballad,
coral, echo, sage, shimmer, verse, marin, cedar. `tenants.ai_voice` has a
CHECK constraint (migration 067) enforcing only these values or NULL.

> **Superseded (2026-06-12):** migration **070** replaced 067's OpenAI-name
> CHECK with the 3 stable labels (`professional`, `friendly`, `local_expert`);
> the dashboard `VALID_VOICES` allowlist + voice picker now use the 3 labels,
> and the agent resolves them via `ELEVENLABS_VOICE_MAP` (invalid/NULL → tone
> default). The 10-voice OpenAI picker above is historical.

### Non-blocking I/O pattern

All synchronous Supabase / Twilio / Resend / Stripe calls wrapped in
`asyncio.to_thread()`. Parallel queries use `asyncio.gather()`.

---

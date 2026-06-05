# Migration: Gemini 3.1 Flash Live → OpenAI gpt‑realtime‑2

**Status:** ✅ **Executed up to the UAT gate** (2026-06-05). Code complete + unit-verified
on branches `phase-65-openai-realtime-2` (agent repo) and the active main-repo branch;
**NOT yet deployed or merged.** Remaining: set `OPENAI_API_KEY` on Railway → preview deploy
→ one real UAT call (§13) → merge. See **§17 — Execution record** for exactly what changed,
the §14 resolutions, deviations found against the installed plugin, and two deploy hazards.
**Original author of plan:** Claude (research + codebase audit, 2026-06-05).
**How to use this doc:** This is a self-contained execution handoff. A fresh assistant
context should (1) read this doc top to bottom, (2) re-read the actual source files it
points to (do NOT trust line numbers blindly — they may drift; use them as a starting
point and confirm), (3) confirm the "Open verification items" against the *installed*
plugin, then (4) execute the "Step-by-step execution plan" and stop at the UAT gate.

> ⚠️ **Do not skip the UAT gate.** A near-identical migration (Phase 64) was reverted
> because on-paper estimates were wrong by 10× on this exact SIP topology. The rule from
> that post-mortem is law here: **prove it on a preview deploy with one real phone call
> before merging to main.**

---

## 0. The two repos (read this first)

| Repo | Path | Role | Deploys to |
|---|---|---|---|
| **Agent** (`lerboi/livekit_agent`) | `C:\Users\leheh\.Projects\livekit-agent\` | Python LiveKit voice agent + FastAPI webhook. **This is where ~95% of the migration happens.** | Railway |
| **Main** (`homeservice_agent`) | `C:\Users\leheh\.Projects\homeservice_agent\` | Next.js dashboard, API routes, Supabase migrations, this doc | Vercel |

The agent is a **separate git repo**, not a submodule. Changes there are pushed to GitHub
→ Railway auto-deploys. The main repo holds the DB migrations and the dashboard voice picker.

**Deployed state at time of writing:** the live Railway container predates several fix
commits, and the most recent build **failed** (transient pip timeout — see §11). The
migration cannot reach production until the build is fixed.

---

## 1. Decisions (locked by the user)

1. **Model:** `gpt-realtime-2` (speech-to-speech, GA, native async function calling).
2. **Voices:** **clear every tenant's `ai_voice` to NULL**; the effective default becomes
   the tone-based fallback, and the **professional** voice is the standard. (Most tenants
   are `tone_preset="professional"`, so they get the professional OpenAI voice.)
3. **Greeting:** **native** — use `session.generate_reply(...)` to open the call. Remove the
   Gemini-era separate-TTS greeting hack entirely. (Wording will vary slightly per call;
   the user accepted this.)

---

## 2. Why we are doing this (root cause — keep for context)

The system's job is a phone receptionist that **reliably books appointments without
hallucinating**. Live Railway logs (`docs/Logs`, call `AJ_AfqPbCYPNEep`) proved the
current model cannot do this:

- Gemini **3.1 Flash Live function calling is synchronous/blocking ONLY** (confirmed on
  Google's model page). When a tool call is in flight and the caller speaks, the server VAD
  **cancels the generation and discards the pending function call**, then the model
  regenerates from a context where the tool result is gone → it **fabricates**. In the logs
  the model invented slot tokens (`bcb98e09-…`, `1234abcd`, the literal `[SLOT_TOKEN]`),
  called `book_appointment` before `check_slot`, and got `STATE:booking_invalid` every time;
  the caller hung up after 5 minutes. `server_tool_cancellations=2`, `orphaned_server_content=1`.
- 3.1 also gates off `generate_reply()`, `update_chat_ctx()`, `update_instructions()` →
  forcing the separate-TTS greeting hack AND making the Phase 61.3 cascade-recovery
  (`update_chat_ctx` replay) a **silent no-op** (the live log shows
  `'gemini-3.1-flash-live-preview' has limited mid-session update support…`).

**Why gpt‑realtime‑2 fixes it:** it has **native async (NON_BLOCKING) function calling** —
"long-running function calls will no longer disrupt the flow of a session" — so caller
speech no longer cancels/discards pending tool calls. The whole cancellation-cascade class
of hallucination is removed at the source. It also supports `generate_reply`/`update_chat_ctx`
natively, so the greeting hack and the dead replay code go away.

**Why NOT the cascade pipeline (STT→LLM→TTS):** that was **Phase 64**, and it was
**reverted** (`.planning/phases/64-livekit-pipeline-agent-migration/64-REVERTED.md`).
On this SIP topology it produced ~7s end-of-turn latency (GeminiTTS first-byte) and Silero
client-VAD self-echo false-interrupts. gpt‑realtime‑2 is **audio-to-audio like today's
setup** (server-side VAD, single stream), so those two failure modes **do not apply** —
this is a far lower-risk change than the one already reverted.

---

## 3. Verified OpenAI Realtime plugin API (from plugin source)

`livekit.plugins.openai.realtime.RealtimeModel.__init__` (confirmed signature):

```python
RealtimeModel(
    *,
    model: str = "gpt-realtime",          # accepts ANY string (no whitelist) → "gpt-realtime-2" is valid
    voice: str = "alloy",
    modalities = NOT_GIVEN,               # default ["text","audio"]
    tool_choice = NOT_GIVEN,
    base_url = NOT_GIVEN,
    input_audio_transcription = NOT_GIVEN,    # <-- MUST set, or no caller transcripts (see §7.2)
    input_audio_noise_reduction = NOT_GIVEN,
    turn_detection = NOT_GIVEN,           # TurnDetection(type="server_vad"|"semantic_vad", ...)
    speed = NOT_GIVEN,
    truncation = NOT_GIVEN,
    reasoning = NOT_GIVEN,                # <-- gpt-realtime-2 reasoning effort goes here
    api_key = None,                       # uses OPENAI_API_KEY env if None
    max_session_duration = NOT_GIVEN,
    temperature = NOT_GIVEN,              # deprecated/unused in v1
    ...
)
```

- **No `instructions` kwarg.** Instructions come from `Agent(instructions=...)` — the code
  already passes `system_prompt` to `VocaAgent(instructions=system_prompt)`, so just drop
  the model-level `instructions=`.
- **Methods confirmed present:** `generate_reply(instructions=…, tool_choice=…, tools=…)`,
  `update_chat_ctx(chat_ctx)`, `interrupt()`.
- **Turn detection** (`TurnDetection`):
  - `type="server_vad"`: `threshold`, `prefix_padding_ms`, `silence_duration_ms`,
    `create_response`, `interrupt_response`.
  - `type="semantic_vad"`: `eagerness` ("low"|"medium"|"high"|"auto"), `create_response`,
    `interrupt_response`.
- **Function/tool calling is framework-level** (`@function_tool` + `Agent(tools=…)`), exactly
  as today — **model-agnostic. The tools themselves need no logic changes.**

---

## 4. Target model construction (intent, not final code)

Replace the Gemini `RealtimeModel(...)` block in `agent.py` with approximately:

```python
from livekit.plugins import openai, noise_cancellation
from livekit.plugins.openai.realtime import TurnDetection   # confirm exact import path

model = openai.realtime.RealtimeModel(
    model="gpt-realtime-2",
    voice=voice_name,                      # from VOICE_MAP (OpenAI voices) — see §6
    turn_detection=TurnDetection(
        type="semantic_vad",               # START HERE; fallback server_vad (see §7.5)
        eagerness="medium",
        create_response=True,
        interrupt_response=True,
    ),
    input_audio_transcription={"model": "gpt-4o-mini-transcribe"},  # confirm shape (§14)
    reasoning=...,                         # set effort "low" for latency (confirm shape, §14)
)
agent = VocaAgent(instructions=system_prompt, tools=tools)
session = AgentSession(llm=model)          # NO tts= (realtime emits audio itself)
```

Removed vs. today: `realtime_input_config` (Gemini VAD), `thinking_config`,
`session_resumption`, `language=`, the model-level `instructions=`, the `GeminiTTS`
`greeting_tts` object and `tts=` on the session.

---

## 5. Change inventory — AGENT repo (`C:\Users\leheh\.Projects\livekit-agent\`)

### 5.1 `src/agent.py` (the heavy file)
- **Imports:** `from livekit.plugins import google, noise_cancellation` → `openai, noise_cancellation`;
  delete `from google.genai import types as genai_types`; delete
  `from livekit.plugins.google.beta.gemini_tts import TTS as GeminiTTS`.
- **`VOICE_MAP`** (~line 50): replace Gemini voices with OpenAI voices (§6). Change the
  fallback default in `voice_name = ai_voice if ai_voice else VOICE_MAP.get(tone_preset, "Kore")`
  (~line 476) from `"Kore"` to the professional OpenAI voice.
- **`realtime_input_config` block** (~lines 496–512): delete.
- **Model construction** (~lines 533–554): replace with §4 target. Delete `thinking_config`,
  `session_resumption`, `language=`, `instructions=`.
- **GeminiTTS greeting object** (~lines 571–585): delete.
- **`AgentSession(llm=model, tts=greeting_tts)`** (~line 585): → `AgentSession(llm=model)`.
- **Native greeting:** after `await session.start(...)` (~line 952), replace the entire
  greeting-via-TTS + input-mute block (~lines 971–1053, the `session.input.set_audio_enabled(False)`,
  `session.say(greeting_text)`, `_unmute_after_greeting`) with a single
  `session.generate_reply(instructions=<localized opening instruction with business_name +
  recording disclosure + "ask how you can help">)`. Keep it locale-aware (en/es) using the
  existing greeting text templating as the *instruction* content.
- **`_ServerCancelHandler`** (~lines 116–148) + its install/remove (~lines 419–421, 193–194):
  it watches `livekit.plugins.google.realtime` log strings — **Gemini-specific, remove it**
  (or repoint to OpenAI interruption logs if you want telemetry; not required).
- **`_GoodbyeDiagHandler`** + `last_audio_frame_at` wrapper + `[goodbye_race]` flush:
  **KEEP** — framework-level diagnostics, still useful.
- **`_LOCALE_TO_BCP47` / `_locale_to_bcp47`** (~lines 65–74) + the `[60.4 Stream B]` log:
  the Gemini `language=` kwarg is gone. Either drop, or repoint into
  `input_audio_transcription` language. Low priority.
- **Transcript collection** `@session.on("conversation_item_added")` (~line 591): KEEP, but
  it only captures caller text if `input_audio_transcription` is set (§7.2).

### 5.2 Tools — remove the Gemini cascade workarounds
The `mute_input_during_tool` pattern and the 61.2/61.3 cascade-recovery are **Gemini-specific
and counterproductive on OpenAI** (muting the caller during a tool call defeats async
function calling, whose entire point is that the caller can keep talking while the tool runs).
- Remove the `mute_input_during_tool(deps)` call from: `book_appointment.py`, `check_slot.py`,
  `check_day.py`, `next_available_days.py`, `capture_lead.py`, `check_caller_history.py`,
  `check_customer_account.py`.
- In `src/tools/_availability_lib.py`: the `mute_input_during_tool` function,
  `_attempt_tool_result_replay`, and the `function_tools_executed`/`agent_state_changed`
  listeners become dead. Remove or neutralize. Keep `register_slot_token`, `format_*`,
  `fetch_scheduling_data`, `calc_slots_for_dates`, etc. (those are core booking logic).
- `deps["_last_tool_state"]` writes can stay (harmless) or be removed with the replay.
- **KEEP** all actual tool logic, the `slot_token` registry, `book_appointment`'s
  token-resolution + idempotency + urgency normalization. None of that is model-specific.
- **KEEP** `_build_tool_narration_section` in the prompt — the OpenAI "silence problem during
  tool calls" is solved by exactly this preamble narration. It transfers directly.

### 5.3 `src/prompt.py`
- Rewrite `_build_greeting_section` (~lines 554–618): the "GREETING ALREADY PLAYED — DO NOT
  REPEAT" framing is an artifact of the TTS hack. With native `generate_reply`, the model
  speaks first normally — instruct it to open with a warm branded greeting + recording
  disclosure + "how can I help". Keep en/es branches.
- Everything else in `prompt.py` stays (identity, corrections, outcome-words, booking,
  address-validation, etc. are model-agnostic anti-hallucination guidance and still valuable).
- Optional: the booking section's `[TOKEN_FROM_LAST_TOOL_RESULT]`/placeholder warnings can stay.

### 5.4 `pyproject.toml`
- Add `livekit-plugins-openai==<match agents version>` (currently `livekit-agents==1.5.7`, so
  pin `1.5.7` unless you also bump agents — see §14).
- Remove `livekit-plugins-google==1.5.7` (nothing else imports it after migration —
  Calendar/Maps use `google-auth`/`google-api-python-client`/REST which are **separate** and
  STAY). Confirm with a grep for `livekit.plugins.google` before removing.
- `livekit-plugins-silero` / `livekit-plugins-turn-detector`: not needed for server-side VAD;
  safe to leave or remove. Leaving them is lower-risk.
- `openai>=2.0,<3` already present — keep.

### 5.5 Dockerfile (build reliability — see §11)
- Line 9: `RUN pip install --no-cache-dir .` → `RUN pip install --no-cache-dir --retries 5 --timeout 120 .`

---

## 6. Change inventory — MAIN repo (voice migration, cross-repo)

The AI voice picker is wired into the DB + dashboard with **Gemini** voice names. This MUST
be migrated or the `CHECK` constraint rejects any future selection.

### 6.1 New Supabase migration (`supabase/migrations/0NN_ai_voice_openai.sql`)
> Confirm the next sequential number by listing `supabase/migrations/` (last known was 066).

It must:
1. Drop the old CHECK constraint from migration `044_ai_voice_column.sql` (allowed:
   `'Aoede','Erinome','Sulafat','Zephyr','Achird','Charon'`).
2. **`UPDATE tenants SET ai_voice = NULL;`** (per decision — clear everyone to NULL).
3. Add a new CHECK allowing NULL or the OpenAI voice set (confirm exact set in §14):
   e.g. `'alloy','ash','ballad','coral','echo','sage','shimmer','verse','marin','cedar'`.

### 6.2 Voice mapping (`agent.py` `VOICE_MAP`)
Proposed (confirm voice names against OpenAI's current realtime voice list, §14):
| tone_preset | OpenAI voice | rationale |
|---|---|---|
| `professional` (default/standard) | `marin` | clear, professional (one of the two newest gpt-realtime voices) |
| `friendly` | `cedar` | warm |
| `local_expert` | `alloy` | relaxed/neutral |

Default fallback (when `tone_preset` unknown) → `marin` (professional).

### 6.3 Dashboard voice picker
- Find the AI Voice Settings UI + its valid-voice list. Known references:
  `tests/unit/ai-voice-settings.test.js` (has `VALID_VOICES` with Gemini names). Grep the
  dashboard (`src/`) for `Aoede`/`Zephyr`/`ai_voice`/`VALID_VOICES` to find the component and
  any onboarding voice step. Update the list to the OpenAI voices and update the test.
- **Not call-blocking:** since all tenants are cleared to NULL → tone fallback, calls work
  even before the picker UI is updated. But ship it for completeness.
- Covered by skills `dashboard-crm-system` (settings) and `auth-database-multitenancy`
  (migration 044) — read those before editing.

---

## 7. BREAK RISKS — must be handled or it breaks

1. **Voice DB CHECK constraint** (§6.1). Without the migration, any non-null `ai_voice` (Gemini
   value) is invalid for OpenAI and the picker can't save. Clearing to NULL + new constraint fixes it.
2. **`input_audio_transcription` MUST be set** (§4). Gemini transcribed caller audio natively;
   OpenAI Realtime does **not** unless configured. Without it, `transcript_turns` loses the
   caller side → **post-call triage, lead extraction, and call records degrade.** This is a
   silent data-quality break, easy to miss because the call still "works".
3. **Remove `mute_input_during_tool`** (§5.2). If left in, it mutes the caller during tool
   execution and **defeats async function calling** — the thing we're migrating for.
4. **`tests/test_no_generate_reply_in_src.py`** forbids `generate_reply` in `src/`. We now USE
   it. **Delete this test** or it fails the suite.
5. **`OPENAI_API_KEY`** must be a real OpenAI key on Railway (§10). The existing `openai` dep is
   only used for Groq-via-base_url triage; the realtime model needs a genuine OpenAI key.
6. **Build is currently broken** (§11). Fix the Dockerfile pip flags or nothing ships.
7. **Tests that assert Gemini workarounds will fail** (§9) — delete/update them.

---

## 8. What stays UNCHANGED (do not touch)

- All tool *logic*; `book_appointment_atomic` RPC; `src/lib/slot_calculator.py`; `src/utils.py`.
- The entire **post-call pipeline** (`post_call.py`), **triage** (`src/lib/triage/*`, uses Groq),
  **Xero/Jobber/Maps integrations** (`src/integrations/*`), **notifications**, **egress/recording**.
- The **FastAPI webhook service** (`src/webhook/*`) and Twilio→LiveKit **SIP routing**.
- `noise_cancellation.BVCTelephony()` (framework-level; keep).
- The **entire Next.js app** except the voice picker + the new migration.
- The separate Jobber/Xero OAuth bug (dead refresh tokens) and the build failure are
  **independent issues** tracked elsewhere; this migration neither fixes nor depends on them,
  except that the build must succeed to deploy (§11).

---

## 9. Tests to update/delete (agent repo `tests/`)

Run the full suite after changes and expect these to need work:
- `test_no_generate_reply_in_src.py` → **delete** (we now use `generate_reply`).
- `test_tool_mute_invariants.py` → delete/rewrite (mute removed).
- `test_cascade_recovery_invariants.py`, `test_cascade_recovery_residual_audio.py` →
  delete/rewrite (replay removed).
- `test_prompt_greeting_directive.py` → update (greeting section rewritten).
- `test_agent_stt_language.py` → update/delete (Gemini `language=` kwarg removed).
- `test_goodbye_diag.py` → keep if `_GoodbyeDiagHandler` kept; update if you removed fields.
- Prompt tests not touching greeting/mute should still pass.
- Note: there is a known pre-existing failing baseline (documented in
  `.planning/phases/63.2*/deferred-items.md`) — distinguish pre-existing failures from
  migration-induced ones by checking against the baseline.

---

## 10. Environment variables (Railway — agent service)

- **Add:** `OPENAI_API_KEY` = a real OpenAI key with Realtime access.
- **No longer needed for the agent LLM:** `GOOGLE_API_KEY` (Gemini). (Safe to leave; unused.)
- **Keep:** `GROQ_API_KEY` (triage), `GOOGLE_MAPS_API_KEY` (address validation),
  Google Calendar OAuth vars, Supabase, Twilio, Resend, Stripe, LiveKit, Sentry, `SUPABASE_S3_*`.

---

## 11. Deployment / build fix (prerequisite)

The last Railway build **failed** on a transient pip read-timeout pulling `livekit-1.1.7`
from PyPI (`docs/Logs` shows the prior call ran on an older container). Harden `Dockerfile`
(§5.5) so a slow chunk doesn't kill the build. Without a green build, none of this deploys.
Adding `livekit-plugins-openai` also means a fresh dependency resolve — make sure the build
succeeds on the preview deploy first.

---

## 12. Step-by-step execution plan (ordered)

> Work on a feature branch in the **agent** repo (e.g. `phase-65-openai-realtime-2`) and a
> branch in the **main** repo for the migration + dashboard.

**Agent repo:**
1. Add `livekit-plugins-openai` to `pyproject.toml`, remove `livekit-plugins-google`; harden Dockerfile.
2. Rewrite the model construction in `agent.py` (§4/§5.1): imports, VOICE_MAP, model, session, remove Gemini config.
3. Implement native greeting via `generate_reply`; remove TTS greeting + input-mute blocks.
4. Add `input_audio_transcription`; verify transcript collection still populates caller turns.
5. Remove `mute_input_during_tool` calls + dead cascade-recovery code (§5.2).
6. Remove `_ServerCancelHandler`; keep `_GoodbyeDiagHandler`.
7. Rewrite `_build_greeting_section` in `prompt.py` (§5.3).
8. Update/delete the affected tests (§9). Run `pytest`; get to green (minus known baseline).
9. Local boot smoke test: `python -m src.agent start` imports + constructs the model without error.

**Main repo:**
10. Create the `ai_voice` migration (§6.1): drop old CHECK, `SET ai_voice=NULL`, add OpenAI CHECK.
11. Update VOICE_MAP names to match the migration's allowed set (already in agent repo step 2 — keep in sync).
12. Update dashboard voice picker + `ai-voice-settings.test.js` (§6.3).

**Deploy + gate:**
13. Apply the migration to Supabase. Set `OPENAI_API_KEY` on Railway.
14. Push agent branch → **preview deploy** (do NOT merge to main yet).
15. **UAT gate (§13).**

---

## 13. UAT gate + rollback

**UAT (the Phase-64 lesson — mandatory before merge):** place one real phone call to a test
tenant on the preview deploy and verify:
- Greeting plays (model speaks first), natural, branded.
- `check_slot`/`check_day` → correct availability spoken (no inversion).
- A full booking completes: `check_slot` → `book_appointment` succeeds, SMS/calendar fire.
- No fabricated tokens; no 5-minute apology loop.
- End-to-end turn latency feels < ~1.5s; no greeting cut-off / self-echo interrupts.
- Post-call: transcript has BOTH sides, triage + lead/job created.
- Check `[goodbye_race]` log: no cascade counters (or near-zero).

**Rollback:** the migration is isolated to the agent branch + one DB migration + dashboard.
If UAT fails, do not merge the agent branch (Railway keeps the prior image). The DB migration
is forward-only — write it so clearing `ai_voice` to NULL is harmless under the old agent too
(NULL → tone fallback works on Gemini as well), so it's safe even if you delay the agent cutover.

---

## 14. OPEN VERIFICATION ITEMS (confirm against the installed plugin before/while coding)

These could not be 100% pinned from docs alone — confirm by reading the installed
`livekit-plugins-openai` source (after `pip install`) or the OpenAI SDK types:
1. **Exact `gpt-realtime-2` model id string** (could be a dated snapshot). The plugin accepts
   any string, so a wrong id fails at first call, not import — test on preview.
2. **`reasoning` param shape** — how the plugin wants reasoning effort ("low") passed
   (`RealtimeReasoning(...)`, a dict, or an enum). Set effort **low** for latency.
3. **`input_audio_transcription` shape** — dict vs typed object; pick a transcription model
   (`gpt-4o-mini-transcribe` or `whisper-1`) and confirm caller turns populate.
4. **`TurnDetection` import path** and whether `semantic_vad` is exposed; confirm the exact
   field names.
5. **`livekit-plugins-openai` version** compatible with `livekit-agents==1.5.7` (match the
   line; or bump the whole stack to latest 1.5.x — currently 1.5.17 — as a separate, tested step).
6. **OpenAI realtime voice list** for gpt-realtime-2 (confirm `marin`/`cedar` available) →
   feed into the migration CHECK + VOICE_MAP.

---

## 15. Reference facts (so you don't re-research)

- **Pricing (gpt‑realtime‑2):** $32/1M audio input tokens (cached $0.40), $64/1M audio output;
  text $4/$24 per 1M. Effective **~$0.15–0.45/min** uncached, **~$0.05–0.10/min** with prompt
  caching + trimmed tool outputs. Turn ON prompt caching. (Twilio SIP ~$0.013/min is separate.)
- **Async function calling is native** on gpt‑realtime — "developers do not need to update
  their code"; the model keeps talking while tools run. Keep the preamble/tool-narration
  prompt section to cover the brief "silence during tool" gap.
- **Reasoning effort** levels minimal/low/medium/high/xhigh, default low; higher adds 0.8–2s —
  keep **low** for phone latency.
- **Phase 64 revert lessons** (`.planning/phases/64-livekit-pipeline-agent-migration/64-REVERTED.md`):
  pipeline died on TTS first-byte latency + Silero self-echo. Those are pipeline-specific and
  **do not apply** to this audio-to-audio swap — but the discipline ("measure on preview before
  merge") absolutely does.
- **Key skills to read before editing:** `voice-call-architecture` (agent), `dashboard-crm-system`
  (voice picker), `auth-database-multitenancy` (migration 044 + how to add a migration).
- **Sources:** OpenAI Realtime (introducing gpt-realtime), OpenAI API pricing, LiveKit OpenAI
  realtime plugin docs, Gemini 3.1 model page (sync-only confirmation), Gemini Live tools/async
  function calling docs.

---

## 17. Execution record (what was actually done — 2026-06-05)

Implemented against the **installed** `livekit-plugins-openai==1.5.7` (pinned to match
`livekit-agents==1.5.7`), read from source to confirm the real API before writing code.

### 17.1 §14 open-verification items — resolved
1. **Model id** — used `"gpt-realtime-2"` as locked (decision #1), but it is **NOT** in the
   plugin's `RealtimeModels` literal (which knows `gpt-realtime` / `gpt-realtime-1.5` /
   `gpt-realtime-2025-08-28`). The constructor accepts any `str`, so it builds fine but is
   **verified only at the live OpenAI handshake (first call)**. Isolated as a single constant
   `OPENAI_REALTIME_MODEL` at the top of `agent.py`. **← #1 UAT risk; change there if it 404s.**
2. **`reasoning` param** — does **NOT** exist in the 1.5.7 constructor (would be silently
   swallowed by `**kwargs`). Omitted. gpt-realtime-2 defaults to `low` effort, which is the
   desired low-latency setting anyway.
3. **`input_audio_transcription`** — must be a **typed** `openai.types.realtime.AudioTranscription`
   object, **not a dict** (the plugin's `to_audio_transcription` only converts typed objects;
   a dict would pass through unconverted). Set to `AudioTranscription(model="gpt-4o-mini-transcribe")`.
   (Aside: the plugin default is already that model, so `user_transcription` capability is on
   either way — but we set it explicitly.)
4. **`TurnDetection`** — **NOT exported** from `livekit.plugins.openai.realtime` (the doc's
   suggested import would fail). Used `SemanticVad` from
   `openai.types.realtime.realtime_audio_input_turn_detection` directly. `semantic_vad`/`medium`
   is supported and is also the plugin's default. server_vad fallback = swap to `ServerVad(...)`.
5. **Plugin version** — `livekit-plugins-openai==1.5.7` installs cleanly alongside
   `livekit-agents==1.5.7`. Confirmed.
6. **Voices** — `marin` is the plugin's `DEFAULT_VOICE` (confirmed valid for realtime). VOICE_MAP
   = professional→`marin`, friendly→`cedar`, local_expert→`alloy`. DB CHECK + dashboard allow
   the 10-voice realtime set: alloy, ash, ballad, coral, echo, sage, shimmer, verse, marin, cedar.

Also dropped: `_locale_to_bcp47` / the Gemini `language=` STT pin (no language kwarg used;
gpt-4o-mini-transcribe auto-detects — repointing transcription `language` was "low priority"
in §5.1 and was skipped).

### 17.2 Files changed
- **Agent repo** (`phase-65-openai-realtime-2`): `pyproject.toml` (swap google→openai plugin,
  pin 1.5.7), `Dockerfile` (pip `--retries 5 --timeout 120`), `src/agent.py` (imports, VOICE_MAP,
  `OPENAI_REALTIME_MODEL`, model+session construction, native `generate_reply` greeting, removed
  `_ServerCancelHandler` + `_LOCALE_TO_BCP47` + Gemini VAD/thinking/resumption config + TTS
  greeting/mute), `src/prompt.py` (`_build_greeting_section` rewritten to a "greet-first / greet-once"
  OPENING directive), the 7 tools (removed `mute_input_during_tool` import+call), `_availability_lib.py`
  (excised `mute_input_during_tool` / `_attempt_tool_result_replay` / `_TOOL_MUTE_FALLBACK_S`),
  tests (deleted `test_no_generate_reply_in_src`, `test_agent_stt_language`, `test_tool_mute_invariants`,
  `test_cascade_recovery_invariants`, `test_cascade_recovery_residual_audio`; rewrote
  `test_prompt_greeting_directive`).
- **Main repo**: `supabase/migrations/067_ai_voice_openai.sql` (drop old CHECK, NULL all ai_voice,
  add OpenAI CHECK), `src/lib/ai-voice-validation.js` (VALID_VOICES), `VoicePickerSection.jsx`
  (VOICES list), `ai-voice-settings/page.js` (display VOICE_MAP + fallback), `tests/unit/ai-voice-settings.test.js`,
  and the two chatbot-knowledge voice blurbs (`chatbot-knowledge/settings.md`,
  `public-chatbot-knowledge/features.md`).

### 17.3 Verification
- Agent: `python -m py_compile` clean across all edited files; package imports + `build_system_prompt`
  (en/es) exercised OK; model constructs with `gpt-realtime-2` + SemanticVad + AudioTranscription
  (`user_transcription=True`, `generate_reply` present).
- Agent pytest: **312 passed**. The 9 failures + 2 collection errors are a **pre-existing baseline**
  (verified by running the same tests on a clean `main` worktree — identical results; none are in
  files this migration touched). The rewritten greeting test passes.
- Main repo: `ai-voice-settings.test.js` — **25 passed**.
- **NOT done (cannot be):** the §13 UAT gate (one real phone call on a preview deploy). This is the
  mandatory merge gate.

### 17.4 ⚠️ Two deploy hazards to handle before/at cutover
1. **Voice-picker vs. agent ordering.** After migration 067, the dashboard picker offers OpenAI
   voice names. If the **main-repo picker is deployed to production while the Railway agent is still
   Gemini**, a tenant who picks e.g. `marin` writes a non-Gemini voice that the live Gemini
   `RealtimeModel(voice="marin")` will reject on their calls. The migration itself (NULL clear +
   CHECK swap) is safe under both agents, but **deploy/merge the agent OpenAI cutover first (after
   UAT), then the main-repo picker change** — or hold the picker until the agent is live. (NULL →
   tone fallback is safe on both; only an *active OpenAI-voice selection* is the hazard.)
2. **Voice-preview audio assets.** `public/audio/voices/` contains only the 6 Gemini samples
   (aoede/zephyr/…mp3). The picker plays `/audio/voices/{name}.mp3`, so preview-play **404s for the
   new voices** until `marin.mp3`/`cedar.mp3`/`alloy.mp3`/… are added. Not call-blocking (select +
   save work); deferred asset task.

### 17.5 Env + notes
- **Railway:** add `OPENAI_API_KEY` (real key with Realtime access) on the agent service before
  preview deploy (§10).
- The `voice-call-architecture` skill's "monorepo mirror at `livekit-agent/`" note is **stale** —
  no such mirror exists in the main repo today, so the sibling repo
  (`C:\Users\leheh\.Projects\livekit-agent\`) is authoritative for the agent.
- Nothing here is committed yet — branches hold the working changes; commit/merge per your flow
  after UAT.

---

## 16. One-paragraph summary (for the impatient)

Swap the agent's brain from Gemini 3.1 Flash Live to OpenAI **gpt‑realtime‑2** — an
audio-to-audio → audio-to-audio change, not the reverted Phase-64 pipeline. In `agent.py`:
swap the plugin + `RealtimeModel` constructor, add `input_audio_transcription`, do the
greeting via native `generate_reply`, and delete the Gemini-only cascade workarounds
(`mute_input_during_tool`, the `update_chat_ctx` replay, `_ServerCancelHandler`, the TTS
greeting). Rewrite the greeting prompt section. Add `livekit-plugins-openai`, drop
`livekit-plugins-google`, harden the Dockerfile pip step. In the main repo: a Supabase
migration that clears `tenants.ai_voice` to NULL and swaps the CHECK constraint to OpenAI
voices, update VOICE_MAP (professional=`marin` default) and the dashboard picker. Set
`OPENAI_API_KEY`. Then **preview-deploy + one real UAT call** before merging. Tools, booking
RPC, post-call, triage, integrations, webhook, SIP, and the rest of the app are untouched.
```

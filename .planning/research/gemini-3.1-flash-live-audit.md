---
generated: 2026-04-25
livekit_agents_version: 1.5.6
livekit_plugins_google_version: 1.5.6
model: gemini-3.1-flash-live-preview
audit_scope: tool calling + overall realtime session usage
livekit_agent_head_sha: d4a1ee1010693fff089e3845c5f6152f815c9525
---

# Gemini 3.1 Flash Live — Codebase Audit

## Executive summary

- ✅ **Tool contract surface is structurally correct.** All 7 tools declare via `@function_tool(name=, description=)` with typed parameters, return plain strings (STATE+DIRECTIVE), and never raise past the tool boundary. Gemini Live's documented function-declaration shape (`name` + inferred `parameters` + `description`) and `FunctionResponse.response` shape are compatible with this pattern. Gemini 3.1 Flash Live requires **synchronous** function calling (no `behavior: NON_BLOCKING`), which matches how the tools are wired (no `scheduling` hints are passed or expected).
- ⚠ **The agent is running with an exceeded end-of-turn threshold (2500ms) to defend against a known upstream bug (#4441).** This is a real fix for the Vertex-AI-flavored VAD cancellation bug, but #4441 is officially scoped to Vertex and the codebase hits Google AI Studio (no `vertexai=True` kwarg). The 2.5s threshold delays every caller-end-of-turn by ~1s beyond the LiveKit default (1.6s from the Phase 64 post-mortem). The underlying "tool call cancelled when caller says 'mhm'" problem is real on AI Studio too, so the mitigation is load-bearing — but it's not elegant.
- ⚠ **The 63.1-07 input-mute workaround around `session.say()` is still the cleanest path available.** Google has not exposed a "hold the floor" / "greeting mode" primitive for gemini-3.1-flash-live-preview. `proactive_audio` and `enable_affective_dialog` — the 2.5-era primitives closest to this need — are explicitly **not supported** on 3.1. The Phase 63.1-07 mute-then-unmute pattern is effectively the sanctioned workaround until Google ships a primitive.
- ⚠ **The prompt's "filler-then-tool-call in the same turn" contract is at direct tension with Gemini 3.1's synchronous function calling.** Gemini 3.1 Flash Live will not keep speaking while a tool runs (async not supported per Google's own docs). The ~3-second filler phrase partially hides this, but a tool that runs longer than the filler leaves an audible silence. Current slot-cache prefetch narrows `check_availability` to ~50ms, which is the right structural mitigation; other tools (book_appointment with its mid-turn Supabase lookup) are still at risk of cancellation when the caller says "mhm" mid-flight.
- ❌ **There is one genuine semantic bug in tool schema design: `check_availability(date: str = "", time: str = "", ...)`.** Gemini Live reads this as three always-optional strings. The giant LLM-facing description compensates, but multi-hundred-character descriptions are the wrong place to enforce structure. Other tools have similar shapes (e.g., `book_appointment(slot_token: str = "", slot_start: str = "", slot_end: str = "", ...)`) that rely on prose-level invariants rather than schema-level ones. This is a category of failure the Phase 63.1-08/09/10 iterations repeatedly battled.

## Per-tool analysis

| Tool | Declaration | Execution | Error path | Notes |
|---|---|---|---|---|
| `check_availability` | ⚠ | ✅ | ✅ | `src/tools/check_availability.py:107-128`. Declaration technically valid but leans entirely on prose for invariants (forbid certain outcome words, require tool re-invocation on every new time). All params default to empty strings — loose schema. Impl catches all exceptions and returns STATE-formatted fallback (:157-172). |
| `book_appointment` | ⚠ | ✅ | ✅ | `src/tools/book_appointment.py:184-221`. 8 params, all optional (defaults to empty/"routine"). `slot_token` is the correct authoritative id; `slot_start`/`slot_end` exist only as a legacy fallback path. Tool description correctly enumerates `urgency` allowed values (`emergency`/`urgent`/`routine`) + `_normalize_urgency` provides defense-in-depth (:28-50). Idempotency guard (:322-334) is correct. Returns STATE string on every exception path. |
| `capture_lead` | ✅ | ✅ | ✅ | `src/tools/capture_lead.py:17-30`. Canonical — `caller_name` required, others optional. Description states preconditions clearly. Every failure path returns a STATE+DIRECTIVE string. |
| `check_caller_history` | ✅ | ✅ | ✅ | `src/tools/check_caller_history.py:18-25`. Zero-param tool. Description is minimal (one sentence). Every DB failure soft-fails to `history_lookup_failed` STATE with instructions to proceed silently. Correct pattern for a read-only context tool. |
| `check_customer_account` | ✅ | ✅ | ✅ | `src/tools/check_customer_account.py:103-114`. Zero-param. Pre-fetched in `agent.py:256-268` before session start — tool is a pure server-side re-serve of `deps["customer_context"]`. Zero latency. Cleanest tool in the codebase. |
| `transfer_call` | ✅ | ⚠ | ✅ | `src/tools/transfer_call.py:18-27`. Declaration clean. Execution invokes LiveKit SIP REFER; success return is STATE-formatted correctly, but see note below about `call_end_reason` mutation timing. Error path returns STATE+DIRECTIVE. |
| `end_call` | ✅ | ✅ | ✅ | `src/tools/end_call.py:70-80`. Zero-param. Uses `SpeechHandle.wait_for_playout()` (livekit-agents 1.5.1 API) instead of fixed sleep — correct. 20s safety cap. Handles "participant already left" (:50-53) gracefully. |

### Deep dive: `check_availability`

**Declaration issue — schema laxity** (`src/tools/check_availability.py:130-135`):

```python
async def check_availability(
    context: RunContext,
    date: str = "",
    time: str = "",
    urgency: str = "routine",
) -> str:
```

Gemini's synchronous tool-call contract produces this schema:

```json
{"name": "check_availability",
 "parameters": {"type": "object",
   "properties": {
     "date": {"type": "string"},
     "time": {"type": "string"},
     "urgency": {"type": "string"}},
   "required": []}}
```

Google's Live API function-calling docs ([live-api/tools](https://ai.google.dev/gemini-api/docs/live-api/tools)) note: *"Function calling executes sequentially by default, meaning execution pauses until the results of each function call are available."* The model has wide discretion on argument construction; all 3 args being free-form strings with empty defaults is maximally permissive. The 600+ character description (108-128) does the actual invariant enforcement — "pass date in YYYY-MM-DD format", "pass time in HH:MM 24-hour format", "always include both date AND time when the caller has named a specific hour". These are contract-level constraints being enforced in natural language, which is exactly the shape of problem Phase 63.1-08/09/10 kept hitting with the slot_token drift.

The hand-rolled ISO-time parser `_parse_requested_time` (:75-103) is evidence the team already anticipated this — it has to accept `"14:00"`, `"2:00 PM"`, `"2pm"`, `"2 pm"`, `"14"`. That's the cost of schema laxity: the burden shifts to the tool's input parser.

**Execution is sound.** Slot-cache prefetch (:230-259) is the right structural mitigation for the sync-only-tool-calling reality — cutting live DB round-trips to zero on the hot path keeps the tool under the filler phrase's run time.

**STATE contract is exceptional.** Every return path uses the same `STATE:x | DIRECTIVE:y` shape; the `speech=` field in the single-slot branch (:405-417) is the right design (caller hears the speech verbatim rather than reconstructed). The `slot_token` indirection (:42-54, :395-402) is a clean fix for the Gemini-drift problem documented in the Phase-fix comment (:31-45).

### Deep dive: `book_appointment`

**Declaration issue — 5 mutually-constrained optional strings** (`src/tools/book_appointment.py:211-221`):

```python
async def book_appointment(
    context: RunContext,
    slot_token: str = "",
    slot_start: str = "",
    slot_end: str = "",
    street_name: str = "",
    postal_code: str = "",
    caller_name: str = "",
    unit_number: str = "",
    urgency: str = "routine",
) -> str:
```

8 params, one logically required (`slot_token` OR `slot_start+slot_end`), but the schema expresses none of that. The 750+ character description enumerates precondition chains: "CRITICAL PRECONDITION: before calling this tool, you must have read back the caller's name..." — a precondition that Gemini has no mechanical way to verify and will violate under pressure.

**Mitigation is strong.** The server-side defensive layers (`_slot_tokens` registry, `_last_offered_token` fallback at :243-259, `_ensure_utc_iso` coercion at :53-80, idempotency guard at :322-334, `_normalize_urgency` at :44-50) compensate — but each one is scar tissue from a prior failure mode. The audit at this layer isn't "is this broken?" (it isn't) — it's "is this a sustainable shape of complexity?" It is, but the incremental fragility cost is real.

**Fire-and-forget side effects are correct** (:574-604). Calendar push and SMS confirmation are `asyncio.create_task` rather than awaited, which is the right decision for sync-only tool calling — blocking on SMS would extend the tool's run time past the filler phrase and trigger the cancellation cascade.

### Deep dive: `transfer_call` — call_end_reason mutation timing

**Minor concern** (`src/tools/transfer_call.py:69`):

```python
deps["call_end_reason"][0] = "transferred"

try:
    lk = api.LiveKitAPI()
    await lk.sip.transfer_sip_participant(...)
```

The `call_end_reason` is mutated **before** the SIP REFER succeeds. If the REFER fails (network error, tenant's owner phone unreachable, etc.), the error path returns a STATE string **but** `call_end_reason` is already `"transferred"`. Post-call pipeline will record a transferred call that in reality fell back to the agent. Low severity because the error path also returns STATE indicating fallback, but the audit-trail row will be wrong. Trivial fix: move the mutation into the success branch.

## Session / runtime pattern analysis

### Q1. RealtimeModel kwargs — which are honored on gemini-3.1-flash-live-preview?

**Construction** (`src/agent.py:433-443`):

```python
model = google.realtime.RealtimeModel(
    model="gemini-3.1-flash-live-preview",
    voice=voice_name,
    language=_locale_to_bcp47(locale),
    instructions=system_prompt,
    realtime_input_config=realtime_input_config,
    thinking_config=genai_types.ThinkingConfig(
        thinking_level="low",
        include_thoughts=False,
    ),
)
```

Verified against [LiveKit Gemini plugin docs](https://docs.livekit.io/agents/models/realtime/plugins/gemini/) and [Google's gemini-3.1-flash-live-preview page](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-live-preview):

| Kwarg | Honored on 3.1? | Evidence |
|---|---|---|
| `model` | ✅ | Canonical identifier. |
| `voice` | ✅ | Honored at session start. |
| `language` | ✅ (best-effort) | BCP-47 hint. LiveKit community thread confirms the param is recognized but output can still drift (`reference_livekit_generate_reply_gemini31.md` precedent applies to transcript language too). Code correctly treats as defense-in-depth. |
| `instructions` | ✅ at construction, ❌ mid-session | Honored at session open. `update_instructions()` is **explicitly incompatible** on 3.1 per plugin docs: *"generate_reply(), update_instructions(), and update_chat_ctx() are not compatible with 3.1 models. The plugin logs a warning and the call is ignored."* The code correctly does NOT call `update_instructions` — instead, it hoists `intake_questions` into the initial system prompt at `agent.py:276-305`. ✅ |
| `realtime_input_config` | ✅ | Passed to session `setup`. Server-VAD sensitivity + silence duration are documented knobs. |
| `thinking_config` with `thinking_level="low"` | ✅ | 3.1-specific API; replaces 2.5-era `thinkingBudget`. Plugin docs confirm `thinking_level` is the correct name. `include_thoughts=False` correct for voice latency. |

**Not passed, would be ignored if passed:**
- `enable_affective_dialog` — silently ignored (plugin warning).
- `proactivity` (proactive audio) — silently ignored (plugin warning).
- `temperature` — deliberately deleted per Google's 3.1 guidance (noted in code comment at :420-425). Correct.

✅ **All kwargs currently passed are supported on gemini-3.1-flash-live-preview.**

### Q2. generate_reply / say / update_chat_ctx — capability-gate status

Verified via [LiveKit Gemini plugin docs](https://docs.livekit.io/agents/models/realtime/plugins/gemini/):

> *"generate_reply(), update_instructions(), and update_chat_ctx() are not compatible with 3.1 models. The plugin logs a warning and the call is ignored."*

**Compliance check:**

| Method | Gated on 3.1? | Codebase usage | Verdict |
|---|---|---|---|
| `session.generate_reply()` | ❌ ignored | Not called. | ✅ |
| `session.update_chat_ctx()` | ❌ ignored | Not called. | ✅ |
| `session.update_instructions()` | ❌ ignored | Not called. | ✅ |
| `session.say(text)` | ✅ works **with TTS attached** | Called once at `agent.py:904` for the opening greeting, with `GeminiTTS` attached at session construction (:460-474) | ✅ — correct 1.5.6 pattern |
| `session.input.set_audio_enabled(bool)` | ✅ works on realtime | Mute/unmute around greeting at :903, :929, :939 | ✅ |

**The `session.say() with attached TTS` pattern is sanctioned.** Per [LiveKit agent speech docs](https://docs.livekit.io/agents/build/speech/): *"If you're using a realtime model, you need to add a TTS plugin to your session or use the generate_reply() method instead."* Since generate_reply is gated on 3.1, the only path to a deterministic opening greeting is the `say()+TTS` path this code uses.

### Q3. 63.1-07 input-mute-during-greeting — has Google shipped a replacement primitive?

**No.** Confirmed via 3 sources:

1. Google's [gemini-3.1-flash-live-preview model page](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-live-preview): proactive audio is in the "Not supported" list. No "greeting mode" primitive exists.
2. Google's [Live guide](https://ai.google.dev/gemini-api/docs/live-guide): barge-in control via `automaticActivityDetection.disabled=true` with client VAD is documented, but that shifts VAD to the client — it doesn't add a "hold the floor" primitive.
3. LiveKit plugin docs: no greeting-mode knob surfaced. Plugin's `RealtimeCapabilities` does not expose one.

**Conclusion:** The Phase 63.1-07 `session.input.set_audio_enabled(False)` → play greeting → `set_audio_enabled(True)` pattern is the cleanest workaround available in April 2026. It should stay in place. If Google ships `activityHandling`/proactive-audio equivalents for 3.1, the workaround can retire — but there's no telemetry suggesting that's imminent (3.1 has been GA for ~6 weeks per the blog post).

**Hardening suggestion (optional):** The current 10s force-unmute timeout (:919) is fine for normal greetings. If a tenant has a much longer greeting (e.g., multi-sentence disclosure), the cap should scale to `min(len(greeting) * 0.08, 15.0)` to avoid premature unmute. Not urgent.

### Q4. Server VAD vs client VAD — double-endpointing check

**No double-handling.** The code relies entirely on Gemini's server-side VAD via `realtime_input_config.automatic_activity_detection` (`agent.py:396-412`). No client-side VAD (Silero) is constructed on the Realtime path. Silero appears in `pyproject.toml` as `livekit-plugins-silero==1.5.6` but is not imported or instantiated in `agent.py` — it's a dormant dependency from Phase 64's reverted pipeline attempt.

Per Google's Live guide: automatic VAD is on by default, disabled only via `realtimeInputConfig.automaticActivityDetection.disabled=true`. The code never sets `disabled=true`, and never calls `activityStart`/`activityEnd` manually. ✅

**Minor cleanup opportunity:** Remove `livekit-plugins-silero` from `pyproject.toml`. It's dead weight from the reverted phase. Not load-bearing.

### Q5. Tool-call cancellation on caller VAD (#4441) — handling

**Status on upstream:** Open, no fix landed as of 2026-04-25. Officially scoped to Vertex AI but the real-world symptom (`server cancelled tool calls` + mid-word truncation) has been observed on AI Studio endpoints too — the code comment at `agent.py:405-409` documents this happening in live UAT.

**Current mitigation in the codebase:**

1. **`silence_duration_ms=2500`** (`agent.py:410`) — raises the server VAD end-of-turn threshold to require >2.5s of caller speech before firing an interrupt. Comment at :403-410 explains the reasoning. This is the tuning-side mitigation.
2. **Slot-cache prefetch in `_run_db_queries`** (`agent.py:728-763`) shrinks `check_availability` from ~500ms → ~50ms. The shorter the tool runs, the smaller the window for the caller's "mhm" to fire.
3. **`_on_close_async` shutdown callback** (`agent.py:685`) — the post-call pipeline runs as a JobContext shutdown callback, guaranteeing writes complete before worker teardown. Good, though orthogonal to tool-call cancellation.
4. **Tool-level idempotency guards** — `book_appointment._last_booked_slot_response` cache (:322-334, :399-410) handles the case where Gemini re-invokes a tool it thinks got cancelled. This is the corruption-recovery layer.

**What's missing:** No handling of **mid-execution** tool-call cancellation. If Gemini cancels `book_appointment` after `atomic_book_slot` has committed the row but before `book_appointment` returns its STATE string, the appointment exists in the DB but Gemini thinks it needs to retry. The idempotency guard at :322-334 catches the retry on the same slot; `book_appointment._last_booked_slot_key` survives re-invocation. ✅

**Residual risk:** If Gemini cancels `book_appointment` mid-flight and the caller then picks a *different* slot, the first slot is booked in the DB but the caller thinks nothing happened. The agent eventually books the new slot. The first booking becomes orphan data. No current code path detects or reconciles this. Severity: **medium** — occurs rarely, but when it does, the caller is confused and the owner sees a ghost appointment.

## Findings

### Finding 1 — Schema laxity across tools with mutually-constrained params
- **severity:** medium
- **evidence:**
  - Google's [function-calling docs](https://ai.google.dev/gemini-api/docs/function-calling) permit rich JSON Schema (`required`, `enum`, `pattern`).
  - Code: `src/tools/book_appointment.py:211-221` — 8 optional params, one logically required, no `required` list, no `enum` on `urgency` despite `_URGENCY_ALIASES` having to normalize Gemini's freeform output.
  - Code: `src/tools/check_availability.py:130-135` — 3 optional strings, invariants enforced in prose.
- **recommended action:** Use `@function_tool` with `raw_schema=` on the two high-risk tools (`book_appointment`, `check_availability`) to pass an explicit JSON Schema including:
  - `urgency: {"type": "string", "enum": ["emergency", "urgent", "routine"]}` on `book_appointment`
  - `date: {"type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}$"}` on both tools
  - `time: {"type": "string", "pattern": "^([01]?\\d|2[0-3]):[0-5]\\d$"}` on `check_availability`
  - `required: ["slot_token"]` on `book_appointment` (making fallback to `slot_start`/`slot_end` impossible from Gemini's side; keep `_ensure_utc_iso` as safety net)
  - This lets Gemini's schema layer reject bad args at serialization time rather than the Python parser recovering.
- **estimated scope:** small (one commit, 2 files)

### Finding 2 — Orphan-booking risk on mid-tool cancellation
- **severity:** medium
- **evidence:**
  - Upstream bug [#4441](https://github.com/livekit/agents/issues/4441) confirms tool calls can be cancelled on spurious VAD events.
  - Code: `src/tools/book_appointment.py:367-381` — `atomic_book_slot()` commits to DB before function returns. If cancellation fires between commit and return, caller is unaware, Gemini is unaware.
  - No reconciliation path when caller then books a different slot.
- **recommended action:** In `post_call.run_post_call_pipeline`, audit `deps["_tool_call_log"]` vs DB appointments table. If a `book_appointment` log entry has `success=True` but no corresponding SMS/confirmation was spoken (check transcript), cancel the stray appointment server-side. Requires a new idempotent `cancel_orphan_appointment` RPC. **Note:** verify this risk exists in current production traces first — may be theoretical.
- **estimated scope:** medium (one plan — one RPC + post-call logic + UAT test)

### Finding 3 — `transfer_call` sets `call_end_reason` before SIP REFER succeeds
- **severity:** low
- **evidence:**
  - Code: `src/tools/transfer_call.py:69-96` — `deps["call_end_reason"][0] = "transferred"` at :69, SIP REFER at :72-81, error path at :89-96.
- **recommended action:** Move the mutation inside the success branch after `await lk.sip.transfer_sip_participant(...)` succeeds. On failure branch, leave `call_end_reason` as-is (will remain default `"caller_hangup"`).
- **estimated scope:** small (one commit, one file, 3-line diff)

### Finding 4 — Dead dependency `livekit-plugins-silero` in pyproject.toml
- **severity:** low
- **evidence:**
  - `pyproject.toml:13` pins `livekit-plugins-silero==1.5.6`.
  - No import in `src/agent.py` or elsewhere after Phase 64 revert (HEAD `d4a1ee1`).
- **recommended action:** Remove the pin. Keeps install size / attack surface smaller.
- **estimated scope:** small (one commit)

### Finding 5 — 10-second greeting-unmute timeout may be tight for long Spanish greetings
- **severity:** low
- **evidence:**
  - `src/agent.py:919` — `timeout=10.0`.
  - Spanish greeting at :871-878 is longer (~120 chars vs ~114 for EN). GeminiTTS synthesis time can exceed 10s for longer text per internal UAT note referenced in :912-918.
- **recommended action:** Scale timeout to `max(10.0, len(greeting_text) * 0.09)` — ~11s for the Spanish long-path greeting, ~10s for EN. Not urgent; the force-unmute safety cap still prevents permanent mute, and the caller just hears a brief overlap if it fires.
- **estimated scope:** small (one commit, one line)

### Finding 6 — No handling of `thought_signature` on 3.1 (adjacent risk)
- **severity:** medium (monitoring only)
- **evidence:**
  - Open LiveKit issue [livekit/agents-js#920](https://github.com/livekit/agents-js/issues/920) reports "Gemini 3 Flash function calling fails — missing thought_signature support" in the JS plugin. Python plugin may have parallel issue.
  - Not currently triggered by this codebase — `thinking_level="low"` + `include_thoughts=False` means the code isn't asking Gemini to emit thought_signatures.
- **recommended action:** Monitor. If a future change raises `thinking_level` to `medium`/`high` or enables `include_thoughts=True`, verify the Python plugin handles `thought_signature` correctly before shipping. Log a TODO against `agent.py:439-442`.
- **estimated scope:** tiny (one comment)

### Finding 7 — Prompt contract assumes non-blocking tool behavior that 3.1 doesn't support
- **severity:** low (structural)
- **evidence:**
  - `src/prompt.py:330-355` — TOOL NARRATION section commits the agent to "speak a natural filler phrase long enough to bridge the tool's run time... AIM FOR ~3 SECONDS of speech."
  - Google's [live-api/tools](https://ai.google.dev/gemini-api/docs/live-api/tools) docs: *"Asynchronous function calling is not yet supported in Gemini 3.1 Flash Live. The model will not start responding until you've sent the tool response."*
  - This means Gemini is **not actually speaking while the tool runs** — the filler finishes, then there is silence until the tool returns, then Gemini speaks the result. The prompt treats filler as a latency mask but 3.1 doesn't stream-during-tool.
- **recommended action:** The prompt is actually fine — it's asking Gemini to *pre-speak* a filler before invoking the tool, not to speak during the tool. The wording "bridge the tool's run time" is slightly misleading but the intent matches 3.1's sync-only reality. **No code change needed; if the prompt is ever refactored, clarify that the filler is pre-tool, not during-tool.**
- **estimated scope:** zero (document only if prompt is touched)

### Finding 8 — Implicit Vertex-vs-AI-Studio ambiguity
- **severity:** low
- **evidence:**
  - `agent.py:433-443` does not pass `vertexai=True`, so the code uses Google AI Studio endpoints (default).
  - Comment at `agent.py:405-409` cites `#4441` as motivation for the 2.5s VAD tuning. #4441 is officially Vertex-scoped.
  - Live UAT (per the comment) reproduced the symptom on the AI Studio endpoint anyway.
- **recommended action:** Add a code comment at :405 noting "#4441 is Vertex-scoped upstream but symptom is reproducible on AI Studio endpoints with `gemini-3.1-flash-live-preview`; see UAT log call-_+6587528516_*." Documentation only — the 2.5s tuning is load-bearing and should stay.
- **estimated scope:** tiny (one comment)

## Sources

### Google authoritative documentation
- https://ai.google.dev/gemini-api/docs/live — Live API overview (fetched 2026-04-25)
- https://ai.google.dev/gemini-api/docs/live-guide — session lifecycle, VAD modes, send_client_content vs send_realtime_input (fetched 2026-04-25)
- https://ai.google.dev/gemini-api/docs/live-api/tools — function calling on Live, sync-only on 3.1 (fetched 2026-04-25)
- https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-live-preview — canonical model identifier, feature support matrix (fetched 2026-04-25)
- https://ai.google.dev/gemini-api/docs/function-calling — general function calling (fetched 2026-04-25)

### LiveKit documentation
- https://docs.livekit.io/agents/models/realtime/plugins/gemini/ — verified `generate_reply`/`update_instructions`/`update_chat_ctx` gated on 3.1 (fetched 2026-04-25)
- https://docs.livekit.io/agents/build/speech/ — `session.say()` requires attached TTS on RealtimeModel (fetched 2026-04-25)
- https://docs.livekit.io/reference/python/v1/livekit/plugins/google/beta/realtime/realtime_api.html — RealtimeModel API reference
- https://docs.livekit.io/agents/logic-structure/tools/ — `@function_tool` decorator, schema inference, `raw_schema` param (fetched 2026-04-25)

### LiveKit GitHub issues (open as of 2026-04-25)
- https://github.com/livekit/agents/issues/4441 — Vertex AI spurious VAD → tool cancellation (open, 2026-01-04, no fix landed)
- https://github.com/livekit/agents/issues/5150 — Agent handoff parallel tools bug (open, 2026-03-18)
- https://github.com/livekit/agents/issues/5234 — gemini-3.1-flash-live-preview plugin support (closed, added via de89c8e)
- https://github.com/livekit/agents/issues/5408 — external VAD + `generate_reply` conflict (open, 2026-04-10, Gemini 2.5-scoped)
- https://github.com/livekit/agents/issues/4545 — 1008 errors on gemini native audio (open, 2026-01-17)
- https://github.com/livekit/agents-js/issues/920 — thought_signature support missing (monitoring)

### Codebase files audited (HEAD `d4a1ee1`)
- `C:/Users/leheh/.Projects/livekit-agent/pyproject.toml`
- `C:/Users/leheh/.Projects/livekit-agent/src/agent.py` (1006 lines)
- `C:/Users/leheh/.Projects/livekit-agent/src/prompt.py` (1280 lines — targeted reads)
- `C:/Users/leheh/.Projects/livekit-agent/src/tools/__init__.py`
- `C:/Users/leheh/.Projects/livekit-agent/src/tools/check_availability.py` (532 lines)
- `C:/Users/leheh/.Projects/livekit-agent/src/tools/book_appointment.py` (609 lines)
- `C:/Users/leheh/.Projects/livekit-agent/src/tools/capture_lead.py` (119 lines)
- `C:/Users/leheh/.Projects/livekit-agent/src/tools/check_caller_history.py` (190 lines)
- `C:/Users/leheh/.Projects/livekit-agent/src/tools/check_customer_account.py` (126 lines)
- `C:/Users/leheh/.Projects/livekit-agent/src/tools/transfer_call.py` (99 lines)
- `C:/Users/leheh/.Projects/livekit-agent/src/tools/end_call.py` (111 lines)

### Project context
- `C:/Users/leheh/.Projects/homeservice_agent/.planning/PROJECT.md`
- `C:/Users/leheh/.Projects/homeservice_agent/.planning/phases/64-livekit-pipeline-agent-migration/64-REVERTED.md`
- `C:/Users/leheh/.claude/projects/C--Users-leheh--Projects-homeservice-agent/memory/reference_livekit_generate_reply_gemini31.md`

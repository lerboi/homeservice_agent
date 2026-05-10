# A-codebase.md — Deployed Code State as of 2026-05-08

*Source of truth for planning fixes against call AJ_y3YJBQ7HakJd. No proposed fixes — current-state description only.*

---

## Subsystem 1 — Availability + Booking Flow

### Tool inventory

There are three availability-checking tools and one booking tool. All live in `src/tools/`. All share helpers from `src/tools/_availability_lib.py`.

**check_slot** (`src/tools/check_slot.py`)

Verifies whether a specific (date, time) pair is bookable. Uses `raw_schema` so Gemini's serializer enforces `required: [date, time]` and the HH:MM / YYYY-MM-DD patterns before invocation. The `urgency` field has a schema-level `enum: ["emergency", "urgent", "routine"]` but is not required; defaults to `"routine"`.

STATE values it can emit (all also written to `deps["_last_tool_state"]`):

- `STATE:lookup_failed | DIRECTIVE:apologize briefly; offer capture_lead; do not retry.` — exception path
- `STATE:lookup_failed reason=no_tenant | DIRECTIVE:apologize briefly; offer capture_lead.`
- `STATE:missing_args | DIRECTIVE:ask the caller for a specific date and time.`
- `STATE:lookup_failed reason=tenant | DIRECTIVE:apologize briefly; offer capture_lead.`
- `STATE:past_date requested={date} today={today_local} | DIRECTIVE:ask for today or later; do not fabricate times.`
- `STATE:bad_time_format | DIRECTIVE:ask the caller to restate the time (e.g. '2 PM' or '14:00').`
- `STATE:too_soon requested={speech} min_notice=1h | DIRECTIVE:tell the caller that time is too soon (one hour minimum); ask for later today or another day.`
- `STATE:lookup_failed reason=scheduling_data | DIRECTIVE:apologize briefly; offer capture_lead.`
- `STATE:slot_ok token={token} speech={speech} | DIRECTIVE:offer the time, ask to book. Pass this token to book_appointment.`
- `STATE:day_empty requested={requested_speech} date_label={date_label} business_name={biz} | DIRECTIVE:tell the caller nothing is open that day; offer another day or capture_lead.`
- `STATE:slot_taken requested={requested_speech} alts={N} | ALTS: 1.{sp} token={tok}; 2.{sp} token={tok}; 3.{sp} token={tok} | DIRECTIVE:offer one or two alternatives; ask which they want; pass that alt's token to book_appointment.`

Slot token minting: on `slot_ok`, calls `register_slot_token(deps, matched["start"], matched["end"])` and also writes `deps["_last_offered_token"] = token`. On `slot_taken`, calls `register_slot_token` for each of up to 3 alternatives and pops `deps["_last_offered_token"]` — clearing the single-slot fallback because the caller must choose.

The tool description (line 40-44 of `check_slot.py`) reads: `"Speak a short filler phrase first ('Let me pull that up real quick'), then invoke in the same turn. This tool's return is a state+directive string — do not read it aloud."`

**check_day** (`src/tools/check_day.py`)

Yes/no whether a specific day has any bookable slots. Never returns specific times by design.

STATE values:

- `STATE:lookup_failed | DIRECTIVE:apologize briefly; offer capture_lead; do not retry.`
- `STATE:lookup_failed reason=no_tenant | DIRECTIVE:apologize briefly; offer capture_lead.`
- `STATE:missing_args | DIRECTIVE:ask the caller for a specific date.`
- `STATE:lookup_failed reason=tenant | DIRECTIVE:apologize briefly; offer capture_lead.`
- `STATE:past_date requested={date} | DIRECTIVE:ask for today or later; do not fabricate times.`
- `STATE:lookup_failed reason=scheduling_data | DIRECTIVE:apologize briefly; offer capture_lead.`
- `STATE:day_has_slots date_label={date_label} count={N} | DIRECTIVE:confirm the day is open; ask for a concrete hour; do not mention times.`
- `STATE:day_empty date_label={date_label} business_name={biz} | DIRECTIVE:tell the caller nothing is open that day; offer another day or capture_lead.`

check_day does NOT mint slot tokens — it confirms/denies only. The caller must subsequently name a specific time, which triggers check_slot.

**next_available_days** (`src/tools/next_available_days.py`)

Checks the next 3 calendar dates (today + 2). Takes no arguments.

STATE values:

- `STATE:lookup_failed | DIRECTIVE:apologize briefly; offer capture_lead; do not retry.`
- `STATE:lookup_failed reason=no_tenant | DIRECTIVE:apologize briefly; offer capture_lead.`
- `STATE:lookup_failed reason=tenant | DIRECTIVE:apologize briefly; offer capture_lead.`
- `STATE:lookup_failed reason=scheduling_data | DIRECTIVE:apologize briefly; offer capture_lead.`
- `STATE:has_near_availability | DIRECTIVE:tell the caller we have openings soon; ask them to name a specific day; do not mention times.`
- `STATE:no_near_availability business_name={biz} | DIRECTIVE:tell the caller the next few days look full; offer capture_lead so they can call back.`

Also mutes input during tool execution via `mute_input_during_tool(deps)`.

### Slot token registry (`src/tools/_availability_lib.py` lines 325-335)

`register_slot_token(deps, slot_start_utc, slot_end_utc)` mints an 8-hex-char opaque token `"slot_xxxxxxxx"` and stores it in `deps["_slot_tokens"][token] = {"slot_start_utc": ..., "slot_end_utc": ..., "created_at": time.time()}`.

`SLOT_TOKEN_TTL_S = 600.0` (10 minutes). `SLOT_CACHE_TTL_S = 30.0`.

`deps["_last_offered_token"]` is set by check_slot on the `slot_ok` path, cleared by check_slot on the `slot_taken` alternatives path.

### book_appointment (`src/tools/book_appointment.py`)

Token resolution chain (lines 315-357):

1. `slot_token` is read from `raw_arguments["slot_token"]`. `slot_start` and `slot_end` are initialized as empty strings — they are no longer Gemini-facing parameters; the `raw_schema` does not expose them. The comment at lines 253-258 says this is "dead code for one release cycle" but syntactically retained.
2. If `slot_token` is not in `deps["_slot_tokens"]`, look for `deps["_last_offered_token"]` as fallback (lines 321-329). This fallback only fires on the unambiguous single-slot path since `check_slot` clears `_last_offered_token` when alternatives are present.
3. If `slot_token` is empty, also try `_last_offered_token` (lines 330-337).
4. If a valid token is found and not expired (TTL check against `600.0` at line 340), extract `_authoritative_start` and `_authoritative_end` from the registry and overwrite `slot_start`/`slot_end` unconditionally (lines 355-356). Logs if Gemini-supplied values differed.
5. If the token is expired or invalid, logs a warning: `"slot_token=%r invalid or expired; falling back to gemini-supplied slot_start/slot_end (may be misaligned)"` (lines 358-363).

The fallback-to-gemini path (lines 380-390) — the exact code:
```python
if not _token_resolved:
    try:
        slot_start = _ensure_utc_iso(slot_start)
        slot_end = _ensure_utc_iso(slot_end)
    except ValueError:
        return (
            "STATE:booking_invalid reason=malformed_slot_iso"
            " | DIRECTIVE:apologize briefly; call check_slot again for the"
            " same date and time to get a fresh slot, then call book_appointment"
            " with the slot_token returned in the STATE line."
        )
```

Since `slot_start` and `slot_end` are initialized as empty strings and the schema no longer exposes them, if token resolution fails entirely, `slot_start` is `""`, which falls through to the guard at lines 365-371:
```python
if not slot_start or not slot_end:
    return (
        "STATE:booking_invalid reason=missing_slot_fields"
        " | DIRECTIVE:apologize briefly; call check_slot again for the"
        " time the caller wants, then call book_appointment with the slot_token"
        " returned in the STATE line."
    )
```

After successful booking, `deps.pop("_slot_cache", None)` invalidates the slot cache (line 624) and `deps.pop("_last_offered_token", None)` clears it (line 625).

Success STATE strings from book_appointment (lines 597-615 — the verdict-driven returns are not `STATE:` prefixed — they use `BOOKED [verdict=...]` format):

- `"BOOKED [verdict=validated]: relay normalized address [{formatted_address}] and time [{slot_speech}] as confirmed; ask if anything else is needed"`
- `"BOOKED [verdict=validated_with_corrections]: relay normalized address [{formatted_address}] as the final form, explicitly invite caller confirmation before closing; if caller corrects, accept correction and re-read full address"`
- `"BOOKED [verdict=unvalidated]: relay address as caller spoke it; do NOT claim \"validated\", \"confirmed against records\", or \"looked up your address\""`

Failure returns from book_appointment:

- `"STATE:booking_invalid reason=missing_slot_fields | DIRECTIVE:..."`
- `"STATE:booking_invalid reason=malformed_slot_iso | DIRECTIVE:..."`
- `"STATE:booking_failed reason=no_tenant_id | DIRECTIVE:..."`
- `"STATE:booking_failed reason=rpc_error | DIRECTIVE:..."`
- `"STATE:slot_taken next_available={next_slot_text} | DIRECTIVE:..."`

### Prompt sections governing availability + booking

**OUTCOME WORDS — CRITICAL RULE** (`src/prompt.py` lines 317-348, `_build_outcome_words_section`):

> "Reserved words and what licenses each: 'available' or 'not available' tied to a specific time → check_slot must have just returned that exact time as available or not. 'confirmed', 'booked', 'your appointment is...', 'all set for...', 'see you tomorrow/at...', or any specific appointment time read back as a settled fact → book_appointment must have just returned a successful booking for that exact time. Any specific clock time or date offered as bookable → must come from a tool result you just received, never from your own suggestion or memory."
>
> "Failure mode to avoid: Caller: 'How about 3pm?' You: 'Let me check on 3pm for you.' [no tool call] 'Yes, 3pm tomorrow is available. Shall I book that?' — WRONG."

**UNMISTAKABLE INVARIANT** in `_build_identity_section` (line 60-64):

> "You may never speak a specific clock time, date, or the words 'available', 'not available', 'booked', 'confirmed', or 'all set' unless a tool returned that exact fact in this turn. Fabricating any of these is the single worst thing you can do on this call."

**AVAILABILITY RULES** in `_build_booking_section` (lines 1199-1229):

> "- All rules in OUTCOME WORDS apply here. You may not speak 'available', 'not available', or quote any specific time as bookable without a fresh check_slot result for that exact date and time in this turn.
> - There are three availability tools — pick the one that matches the caller's input:
>   • Caller names a specific date AND time → speak filler, call check_slot(date, time) in the same turn.
>   • Caller names a date but NO time → speak filler, call check_day(date). Then ask the caller to name a specific hour before anything is bookable.
>   • Caller is vague — 'whenever', 'anytime', 'no preference' → speak filler, call next_available_days(). Then ask them to name a day.
> - Every new date or time the caller mentions requires a fresh check_slot call. Never rely on earlier results; availability changes during a call.
> - Never read out or list available slot times to the caller — even if they ask 'what's available?' or 'do you have any slots?'. The caller names a time, and you verify it with check_slot."

**BEFORE BOOKING — READBACK** in `_build_booking_section` (lines 1241-1258):

> "Read back the caller's name (if captured) and the full service address (street, city, state/country, {postal_label}) in one utterance. This is the single authoritative verification moment for both name and address... Call book_appointment only after the caller acknowledges the readback (silence or an explicit 'yes' / 'that's right' counts). You also need a specific slot the caller has chosen (with start/end times from the availability results). Per OUTCOME WORDS: do not speak 'booked', 'confirmed', or any specific appointment time as a settled fact until book_appointment has returned successfully in this turn."

**NO DOUBLE-BOOKING** in `_build_booking_section` (lines 1265-1274):

> "Once book_appointment has returned `success: true` in this call, the appointment is committed. DO NOT call book_appointment again for the same slot under any circumstance. DO NOT retry if the caller briefly says anything... DO NOT invent, guess, or substitute placeholder values like `[TOKEN_FROM_LAST_TOOL_RESULT]`, `REPLACE_WITH_ACTUAL_TOKEN`, or date/time strings as the slot_token argument — only the exact slot_token string previously returned by check_slot is valid. If you no longer have a valid slot_token in context, DO NOT retry: verbally confirm the booking to the caller using the date/time you already read back, and move on."

**TOOL NARRATION** in `_build_tool_narration_section` (lines 427-463): Requires speaking a ~3-second filler phrase before every tool call. Rule 6 explicitly prohibits naming specific times in fillers: "Your filler must NEVER name a specific date, time, or slot. 'Let me check on 4 PM for you' is FORBIDDEN — the committed specificity primes you to fabricate '4 PM is available' as the natural continuation."

### What the prompt does NOT do

The prompt does not tell Gemini how to interpret `BOOKED [verdict=...]` return strings from book_appointment in structured form. The return strings are prose-shaped directives, not STATE-prefixed. The `_build_address_validation_section` tells Gemini what `verdict=validated` and `verdict=unvalidated` tokens mean post-booking but does not cross-reference the exact `BOOKED [...]` format from the tool return.

The prompt has no explicit instruction about what to do when book_appointment returns `STATE:booking_invalid reason=missing_slot_fields` — the DIRECTIVE inside the STATE string is the only guidance. There is no prompt-level rule that says "if book_appointment returns booking_invalid, call check_slot again before retrying."

---

## Subsystem 2 — Tool-Mute + Cascade-Recovery

### mute_input_during_tool (`src/tools/_availability_lib.py` lines 56-204)

Called at entry by all four availability/booking tools: `check_slot` (line 80), `check_day` (line 61), `next_available_days` (line 50), and by inspection of `capture_lead.py` (which also imports it per the grep). The `end_call`, `transfer_call`, and `check_customer_account` tools do NOT call `mute_input_during_tool`.

`_TOOL_MUTE_FALLBACK_S = 25.0` — defined at line 53. The comment at lines 48-52 reads verbatim:

> "Phase 61.2 Fix B: fallback raised 15→25s. The booking-section name+address readback can run 10-14s; on a server-cancelled tool call, the recovery generation may extend beyond that. 15s left no margin and the safety unmute fired mid-recovery (call AJ_vV4DM5AG9t7W). 25s is the new ceiling."

**Mute lifecycle state machine:**

1. Entry: `session.input.set_audio_enabled(False)`. Stamps `mute_set_at_ms = int(time.time() * 1000)`. Increments `deps["_tool_mute_id"]` (stale-unmute guard). Registers two event listeners on `session` and spawns `asyncio.create_task(_unmute_logic())`.

2. `_on_state_change(event)` listener (registered on `"agent_state_changed"`):
   - If `new_state == "speaking"` and `old_state != "speaking"`: sets `saw_fresh_speaking[0] = True`. This is the start of the post-tool response. The fix comment at lines 117-120 notes this was extended to catch `thinking → speaking` transitions (previously only matched `listening → speaking`, missing the thinking path — call AJ_bFP3MLdqnKqT showed 25s mute on every tool call because of this gap).
   - If `old_state == "speaking"` and `new_state == "listening"` and `saw_fresh_speaking[0]` is True: sets `unmute_event`.

3. `_on_tools_executed(event)` listener (registered on `"function_tools_executed"`):
   - Resets `saw_fresh_speaking[0] = False`. Comment (Phase 61.2 Fix B, lines 134-138): "a fresh tool execution during the mute window means we are inside a recovery generation step (Gemini retried after a server cancel). Reset the listener so the unmute waits for the NEW generation's clean speak/listen cycle."
   - Also captures `deps["_last_tool_call_id"]` and `deps["_last_tool_name"]` from `event.function_calls[-1]` (lines 148-155, Phase 61.3 D-05, used by replay).

4. `_unmute_logic()` async task:
   - `asyncio.wait_for(unmute_event.wait(), timeout=25.0)`.
   - On clean completion: `unmute_reason = "agent finished speaking"`.
   - On `TimeoutError`: `unmute_reason = f"fallback timeout 25.0s"`. Calls `_attempt_tool_result_replay(deps, session, mute_set_at_ms, saw_fresh_speaking[0])` before cleanup.
   - Removes both listeners (best-effort via `session.off()` or `session.remove_listener()`).
   - If `deps["_tool_mute_id"] == mute_id` (not superseded): calls `session.input.set_audio_enabled(True)`. Else logs skip.

### _attempt_tool_result_replay (`src/tools/_availability_lib.py` lines 207-307)

Called exclusively from the `TimeoutError` branch of `_unmute_logic`. Never called on the clean-completion path.

**Stall confirmation logic (lines 240-254, Phase 61.3-amend):**

```python
GRACE_MS = 250
last_frame_ms = diag[0].get("last_audio_frame_at") if diag else None
audio_quiescent = (
    last_frame_ms is None or last_frame_ms <= mute_set_at_ms + GRACE_MS
)
stall_confirmed = (not saw_fresh_speaking) and audio_quiescent
if not stall_confirmed:
    return
```

Two signals must both indicate quiescence:
- `saw_fresh_speaking` must be False (no `*→speaking` transition after mute)
- `last_audio_frame_at` must not have advanced more than 250ms past `mute_set_at_ms` (grace window for filler-audio residue)

The 250ms grace was added in Phase 61.3-amend after call AJ_b8ACLgXZ4XZA (2026-05-07) showed residual frames from a "let me check" filler stamping `last_audio_frame_at` ~15ms after `mute_set_at_ms`, causing a false-negative stall detection and silently skipping recovery. The fix made `saw_fresh_speaking` the primary gate — `stall_confirmed` is False if EITHER signal indicates Gemini spoke.

**Prerequisites for replay (lines 257-262):**

```python
state_str = deps.get("_last_tool_state")
call_id = deps.get("_last_tool_call_id")
tool_name = deps.get("_last_tool_name")
if not (state_str and call_id and tool_name):
    return
```

All three must be populated. `_last_tool_state` is written by every tool on every return (success or error). `_last_tool_call_id` and `_last_tool_name` are written by `_on_tools_executed` from `event.function_calls[-1]`.

**Replay mechanism (lines 270-293):**

Accesses `session._activity.realtime_llm_session`. Constructs a `livekit.agents.llm.FunctionCallOutput(call_id=call_id, name=tool_name, output=state_str, is_error=False)`. Calls `rt_session.update_chat_ctx(chat_ctx_with_synthetic_output)`. The comment notes this path is unconditional at `realtime_api.py:637-638` despite `mutable_chat_context=False`.

Failure handling: logs warning, increments `diag[0]["stalled_generation_replay_failed"]`. Does not re-raise — always returns normally.

### Early stall detection

There is no early stall detection shorter than the 25s fallback. The only mechanism is the event-based unmute path (clean completion when Gemini transitions `speaking → listening`). There is no intermediate timeout at e.g. 10s. The 25s is a hard ceiling with no adaptive shortening.

### Diag record schema

Initialized in `src/agent.py` at lines 397-406:

```python
diag_record = [{
    "schema_version": 1,
    "call_id": call_id,
    "tenant_id": tenant_id,
    "caller_phone_sha256": ...,
    "started_at_ms": int(time.time() * 1000),
}]
```

Fields written during the call (various sources):

- `last_audio_frame_at` — written by the `_timed_capture_frame` wrapper on `session.output.audio.capture_frame` (agent.py lines 947-951, installed AFTER `session.start()`). Value is `int(time.time() * 1000)` on every audio output frame.
- `last_text_token_at` — written in `on_conversation_item` for agent turns (agent.py line 589).
- `playback_finished_at`, `text_done`, `audio_done` — written by `_GoodbyeDiagHandler` (agent.py lines 97-103) from `_SegmentSynchronizerImpl.playback_finished` log warnings.
- `server_tool_cancellations` — incremented by `_ServerCancelHandler` on `"server cancelled tool calls"` log warnings (agent.py lines 138-142).
- `orphaned_server_content` — incremented by `_ServerCancelHandler` on `"received server content but no active generation"` warnings (agent.py lines 143-146).
- `session_close_at`, `close_reason` — written in `session.on("close")` handler (agent.py lines 596-598).
- `participant_disconnect_at`, `disconnect_reason` — written in `ctx.room.on("participant_disconnected")` handler (agent.py lines 607-613).
- `stalled_generation_recoveries` — incremented by `_attempt_tool_result_replay` (line 268).
- `stalled_generation_replay_failed` — incremented by `_attempt_tool_result_replay` on replay error (line 305).

The `_diag_record` list is `deps["_diag_record"]` in tool context AND `diag_record` in the entrypoint closure — same list object (single-element list pattern for closure mutation).

### AgentSession event listeners registered in agent.py

All registered between lines 575-681:

- `"conversation_item_added"` — transcript capture + `last_text_token_at`
- `"close"` — `session_close_at` + `close_reason`
- `"error"` — Sentry capture
- `"agent_state_changed"` — `[63.1-DIAG]` log line
- `"user_state_changed"` — `[63.1-DIAG]` log line
- `"function_tools_executed"` — `[63.1-DIAG]` log line with tool name, args, output preview
- `"speech_created"` — `[63.1-DIAG]` log line with `user_initiated` and `source`
- `"agent_false_interruption"` — `[63.1-DIAG]` warning log

Additionally, `mute_input_during_tool` registers `"agent_state_changed"` and `"function_tools_executed"` transiently per tool call (removed on unmute or timeout).

---

## Subsystem 3 — Address Validation

### validate_address + validate_address_bounded (`src/integrations/google_maps.py`)

**API key behavior (lines 276-283):**

```python
api_key = os.environ.get("GOOGLE_MAPS_API_KEY")
if not api_key:
    logger.info("[phase61] GOOGLE_MAPS_API_KEY missing — verdict=skipped")
    return _voco_result(verdict="skipped", latency_ms=0, raw_status=None)
```

If `GOOGLE_MAPS_API_KEY` is absent from the environment, the function returns immediately with `verdict="skipped"` and zero latency. No exception, no Sentry capture. The outer bounded wrapper's Sentry gate only fires on `verdict="error"`, and the telemetry insert at lines 543-573 does fire but costs `cost_micro_cents=0` for skipped.

**Six verdict states:**

- `"confirmed"` — Google `ACCEPT`
- `"confirmed_with_changes"` — Google `CONFIRM` or `CONFIRM_ADD_SUBPREMISES`
- `"unconfirmed"` — Google `FIX` or unknown/missing `possibleNextAction`
- `"unsupported_region"` — HTTP 400 with `INVALID_ARGUMENT`/`regionCode`/`Invalid region` in body
- `"error"` — timeout, network failure, non-200 non-400 status, JSON parse failure, empty address
- `"skipped"` — `GOOGLE_MAPS_API_KEY` missing from environment

**How `"skipped"` flows into book_appointment (lines 300-615 of `book_appointment.py`):**

`validation_verdict = validation_result.get("verdict", "error")` — so `"skipped"` is a valid string for `validation_verdict`.

`service_address` overwrite at lines 301-304: `if validation_verdict in ("confirmed", "confirmed_with_changes") and formatted_address_value: service_address = formatted_address_value`. For `"skipped"`, this condition is False, so `service_address` retains the agent-joined `street_name + unit_number + postal_code` string.

The return string at lines 609-615 covers the `"skipped"` case under the `else` branch:

```python
else:
    # unconfirmed | error | skipped | unsupported_region
    return_msg = (
        "BOOKED [verdict=unvalidated]: relay address as caller spoke it; "
        "do NOT claim \"validated\", \"confirmed against records\", or "
        "\"looked up your address\""
    )
```

So `"skipped"` is treated identically to `"unconfirmed"` and `"error"` from the booking-return perspective — the booking proceeds, but the address is relayed as-is with the unvalidated directive.

`atomic_book_slot` is called regardless of verdict (lines 446-466). The `address_validation_verdict=validation_verdict` field is passed through to the DB, so rows where the key was missing will show `address_validation_verdict = "skipped"` in the `appointments` table.

**Telemetry table (`gmaps_validate_events`):**

Per the bounded wrapper (lines 527-573), the table receives:

```python
payload = {
    "tenant_id": tenant_id,
    "call_id": call_id,
    "verdict": verdict,
    "latency_ms": result.get("latency_ms"),
    "cost_micro_cents": cost,  # 0 for "skipped" or "error"
    "region_code": region_code,
}
```

For `"skipped"` rows: `latency_ms = 0`, `cost_micro_cents = 0`. The insert is attempted BUT only when `supabase` is provided AND `tenant_id` is not None. Per WR-01 (Phase 61.1, lines 533-542), if `tenant_id` is None the insert is skipped with a warning log rather than allowing a NOT NULL constraint violation.

**capture_lead.py** also calls `validate_address_bounded` (line 88 of `capture_lead.py`), using the same pattern — confirms the validator is invoked on both the booking and lead-capture paths.

**Sentry behavior:** Sentry `capture_exception` fires only on `verdict="error"` (lines 507-525). The `"skipped"` verdict does NOT trigger Sentry. This means a production environment with a missing `GOOGLE_MAPS_API_KEY` produces no Sentry alerts and only a `logger.info` line per call — it is silent except for `gmaps_validate_events` row accumulation.

**Railway env configuration:** No `railway.toml` exists in the repo. The `.env.example` (repo root) does NOT include `GOOGLE_MAPS_API_KEY` as a documented variable. Railway environment variables must therefore be set manually via the Railway dashboard or CLI; they have no documentation anchor in the repo that would surface a missing key during provisioning.

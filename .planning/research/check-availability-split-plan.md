---
generated: 2026-04-25
status: DRAFT — pending review, not yet approved for execution
scope: refactor `check_availability` into 3 narrow tools + prompt rewrites
target_repo: C:/Users/leheh/.Projects/livekit-agent (sibling repo, deployed to Railway)
blast_radius: Gemini 3.1 Flash Live function-calling path only; no schema/DB changes
rollback: single-commit revert of the livekit-agent PR
---

# Three-Tool Split for `check_availability` — Draft Plan

## Why this is not a new phase

The [Gemini 3.1 Flash Live audit](gemini-3.1-flash-live-audit.md) recommended this as a **small/medium work item inside v6.0, not Phase 65**. The runtime contract with Gemini Live doesn't change; we're cutting payload size and splitting one over-loaded declaration into three narrow ones. Same deployment, same model, same SDK. Reversible in one commit.

## Problem restated

Current `check_availability` (`livekit-agent/src/tools/check_availability.py:107-531`) does three semantically distinct things behind one declaration:

| Mode | Trigger | Current return size | What it does |
|---|---|---|---|
| Verify specific slot | `date` + `time` | ~700 chars + embedded alternatives block | Confirm one time is bookable, mint `slot_token` |
| Confirm day-level | `date` only | ~670 chars | Yes/no the day has any slots |
| Browse | neither | ~670 chars | Yes/no across next 3 days |

Symptoms per live UAT:
- Filler plays → ~1-2s audible gap → stilted response. Gemini is ingesting the 600-char STATE/DIRECTIVE return before it can generate TTS.
- Tool description is ~850 chars. Parsed every turn the model considers a tool call.
- Invariants like "require concrete hour" are enforced in prose, not schema → repeatedly violated (Phase 63.1-08/09/10/11 were all patches on this same surface).

## Target design

Three tools, each narrow-purpose, each with a **raw JSON schema** (`raw_schema=` on `@function_tool` — per audit Finding 1). Returns drop from 600+ chars to ≤150 chars.

### Tool 1 — `check_slot(date, time)`

**Purpose:** verify one specific time. Required params. Always returns a `slot_token` on success or alternatives on failure.

**Declaration (raw_schema):**
```python
raw_schema = {
    "name": "check_slot",
    "description": "Verify whether a specific date and time is bookable. Call this every time the caller names a concrete hour. Speak a short filler phrase first, then invoke in the same turn.",
    "parameters": {
        "type": "object",
        "properties": {
            "date": {
                "type": "string",
                "pattern": r"^\d{4}-\d{2}-\d{2}$",
                "description": "Target date as YYYY-MM-DD in the business's local timezone."
            },
            "time": {
                "type": "string",
                "pattern": r"^([01]?\d|2[0-3]):[0-5]\d$",
                "description": "Target time as HH:MM 24-hour, in the business's local timezone."
            },
            "urgency": {
                "type": "string",
                "enum": ["emergency", "urgent", "routine"],
                "description": "Inferred urgency from the conversation. Default 'routine'."
            },
        },
        "required": ["date", "time"],
    },
}
```

**Return shapes (≤150 chars each):**
- Success: `STATE:slot_ok token={t} speech={s} | DIRECTIVE:offer it, ask to book.`
- Not available with alternatives: `STATE:slot_taken alts=3 | ALTS: 1.{s1} token={t1}; 2.{s2} token={t2}; 3.{s3} token={t3} | DIRECTIVE:offer one or two; ask which.`
- Day is empty: `STATE:day_empty date={d} | DIRECTIVE:ask about another day or offer capture_lead.`
- Too soon: `STATE:too_soon min_notice=1h | DIRECTIVE:ask for a later time.`
- Past date: `STATE:past_date | DIRECTIVE:ask for today or later.`
- Error: `STATE:lookup_failed | DIRECTIVE:apologize briefly, offer capture_lead; do not retry.`

Rationale for trimming: Gemini Live ingests the whole return before starting audio generation. Every extra 100 chars pushes first-audio-frame further out. The caps-lock "DO NOT construct ISO" / "off-by-8-hours bookings" warnings don't belong in a runtime return — they belong in the `book_appointment` schema (where `raw_schema` can make `slot_token` **required**, so constructing ISOs becomes impossible from Gemini's side). See §"book_appointment adjustments" below.

### Tool 2 — `check_day(date)`

**Purpose:** yes/no the day has availability. Required `date`. Never returns times.

**Declaration:**
```python
raw_schema = {
    "name": "check_day",
    "description": "Check whether a specific day has any appointment slots available. Use when the caller names a date but not a time yet. Returns yes/no only — never specific times. Speak a short filler phrase first, then invoke in the same turn.",
    "parameters": {
        "type": "object",
        "properties": {
            "date": {"type": "string", "pattern": r"^\d{4}-\d{2}-\d{2}$"},
        },
        "required": ["date"],
    },
}
```

**Returns:**
- `STATE:day_has_slots date_label={d} | DIRECTIVE:confirm the day is open; ask for a concrete hour.`
- `STATE:day_empty date_label={d} | DIRECTIVE:ask about another day or offer capture_lead.`
- `STATE:past_date | DIRECTIVE:ask for today or later.`
- `STATE:lookup_failed | DIRECTIVE:apologize briefly, offer capture_lead.`

### Tool 3 — `next_available_days()`

**Purpose:** when the caller won't name a date ("whenever you have time"), confirm the business has availability soon and prompt them to name a date. No params.

**Declaration:**
```python
raw_schema = {
    "name": "next_available_days",
    "description": "Check whether the business has any availability in the next 3 days. Use only when the caller is vague about when ('whenever works', 'anytime'). Returns yes/no — never specific times or dates. Speak a short filler phrase first, then invoke in the same turn.",
    "parameters": {"type": "object", "properties": {}},
}
```

**Returns:**
- `STATE:has_near_availability | DIRECTIVE:confirm we have openings soon; ask the caller to name a specific day.`
- `STATE:no_near_availability | DIRECTIVE:tell them the next few days look full; offer capture_lead.`
- `STATE:lookup_failed | DIRECTIVE:apologize briefly, offer capture_lead.`

## Shared infrastructure → `src/tools/_availability_lib.py`

Extract these unchanged from current `check_availability.py` into a shared module all three tools import:

| Extracted | Current location | Notes |
|---|---|---|
| `_SLOT_CACHE_TTL_S = 30.0` | check_availability.py:237 | Unchanged |
| `_SLOT_TOKEN_TTL_S = 600.0` | check_availability.py:39 | Unchanged |
| `_register_slot_token(deps, start, end)` | check_availability.py:42-54 | Unchanged — `check_slot` is the only caller |
| `_parse_requested_time(time, date, tz)` | check_availability.py:75-103 | Unchanged; only `check_slot` uses it |
| `_format_date_label(date, tz)` | check_availability.py:66-72 | Unchanged |
| `_ordinal(n)` | check_availability.py:57-63 | Unchanged |
| `fetch_scheduling_data(deps)` | **new** | Consolidates the parallel Supabase fetch block (check_availability.py:260-297) + 30s cache check (:237-257). All three tools call this; cache + invalidation logic lives in one place. |
| `calc_slots_for_dates(tenant, dates, sched)` | **new** | Thin wrapper around `calculate_available_slots` for a list of `YYYY-MM-DD` strings. All three tools need this. |

`deps["_slot_cache"]` / `deps["_slot_tokens"]` / `deps["_last_offered_token"]` keys stay — consumed by `book_appointment.py:244-285` unchanged.

## Tool registration (`src/tools/__init__.py`)

```python
# BEFORE
if deps.get("onboarding_complete"):
    tools.append(create_check_availability_tool(deps))
    tools.append(create_book_appointment_tool(deps))

# AFTER
if deps.get("onboarding_complete"):
    tools.append(create_check_slot_tool(deps))
    tools.append(create_check_day_tool(deps))
    tools.append(create_next_available_days_tool(deps))
    tools.append(create_book_appointment_tool(deps))
```

Delete `create_check_availability_tool` and `src/tools/check_availability.py` entirely once the three new tools pass local smoke tests. **Do not keep an alias tool** — that defeats the purpose (Gemini would still see the old description and re-learn the ambiguity).

## `book_appointment` adjustments

The current `book_appointment` description (`book_appointment.py:186-209`) is ~900 chars, much of it defensive warnings about slot_token. Two changes cut it in half and move correctness into schema:

1. **Make `slot_token` required via `raw_schema`.** Remove `slot_start`, `slot_end` from the declared params entirely. Keep `_ensure_utc_iso` as the unused safety net for one release cycle, then delete in the next.
   ```python
   "required": ["slot_token", "street_name", "postal_code", "caller_name"],
   ```
2. **Enum `urgency`** per audit Finding 1:
   ```python
   "urgency": {"type": "string", "enum": ["emergency", "urgent", "routine"]},
   ```

Description collapses to ~250 chars:
```
Book an appointment after the caller has acknowledged the name+address readback. Pass slot_token from the most recent check_slot result verbatim. Speak a short filler phrase first, then invoke in the same turn.
```

All the "DO NOT construct slot_start" warnings disappear from prose because the schema no longer accepts them. This is the structural fix the audit called out.

## Prompt changes (`src/prompt.py`)

Three sections need rewrites. All three have `es` (Spanish) branches that must mirror the `en` changes per [60.3 Plan 12 locale-parity rule](https://…). Locations from `grep -n` output:

### 1. `AVAILABILITY RULES` block (prompt.py:1008-1034)

Current: 25 lines, references `check_availability` 8 times, spends 6 lines on "NO TIME-CONFIRMATION QUESTIONS BEFORE CHECKING" and "ask caller to name an hour before checking."

Rewritten (draft):
```
AVAILABILITY RULES (non-negotiable):
- You must not speak 'available', 'not available', or any specific time as
  bookable without a fresh check_slot result for that exact date+time this turn.
- Caller names a specific date and time → speak filler, call check_slot(date, time)
  in the same turn. Do NOT ask 'just to confirm you mean X?' first.
- Caller names a date but no time → call check_day(date) to confirm the day
  is open, then ask them to name a specific hour.
- Caller is vague ('whenever', 'anytime') → call next_available_days(), then ask
  them to name a day.
- Every new date or time requires a fresh tool call. Never rely on earlier results.
- Never read out or list slot times. The caller names the time, you verify it.
- If the caller asks about a different time than one you just verified, call
  check_slot again with the new time.
```

Why shorter: three tools' names now encode the branches that prose had to carry. "Never pick a time on the caller's behalf" is enforced schematically — `check_slot`'s schema makes `time` required, so Gemini structurally cannot call it without one.

### 2. `HANDLING THE RESULT` block (prompt.py:1036-1044)

Light edit — references `check_slot` instead of `check_availability`. Alternatives-handling stays the same; return shape from `check_slot` preserves the 3-alternatives model.

### 3. `BEFORE BOOKING — READBACK` and `NO DOUBLE-BOOKING` blocks (prompt.py:1046-1079)

- `check_availability` → `check_slot` throughout.
- `slot_token` paragraph (prompt.py:1074-1079) stays as-is (still a real risk even with raw_schema — Gemini could pass a stale token from earlier in the call).

### 4. Filler-phrase examples (prompt.py:312-315 ES, 358-363 EN)

Current examples reference `check_availability` and `book_appointment`. Update to:
- `check_slot` → "Let me pull that up real quick."
- `check_day` → "Let me see what that day looks like."
- `next_available_days` → "Let me see what's coming up."

Short fillers matter because **Gemini 3.1 Flash Live blocks speech while a tool runs** (audit §Session / runtime analysis). Filler length ≈ tool latency = minimum silence. Slot-cache makes all three tools ~50ms, so short fillers (~1.5s) suffice.

### 5. `AI_INSTRUCTIONS_ANTI_FABRICATION` section (prompt.py:180-232)

Update the two concrete examples (EN `:242-262`, ES `:207-231`) that cite `check_availability` by name. Same mechanical rename + split: the "you did not call check_availability" example now says "you did not call check_slot."

## Gemini 3.1 Flash Live compatibility verification

Per the [Gemini Live function-calling docs](https://ai.google.dev/gemini-api/docs/live-api/tools) and the audit:

| Concern | Addressed by |
|---|---|
| Function declaration shape | `raw_schema=` passes JSON Schema directly to the Live API without LiveKit's inference layer — matches what the docs call the "FunctionDeclaration" shape verbatim. |
| Tool response shape | Plain string returns from each tool become `functionResponse.response.output` — same as today, no change. |
| Synchronous tool execution | Live 3.1 only supports sync tool calls. All three tools complete in ~50ms (cache hit) to ~500ms (cache miss) — inside the typical filler-phrase window. |
| Server VAD cancellation on caller utterance | Shorter tools = smaller cancellation window. Cache-hit path already 10× faster than the original live-fetch path. |
| Enum / pattern / required enforcement | `raw_schema` is the only way to pass these through to Gemini; Python signature inference drops them. |
| `async` tools | Not used — Live 3.1 does not support async function calls per the Live-tools page. We're sync-only. |
| Tool-call truncation on caller VAD (upstream #4441) | Still a hazard. Book-specific mitigations (idempotency guard, `_last_offered_token` fallback) stay unchanged. |
| `mutable_chat_context=False` | Irrelevant — we register tools at session start, never mid-session. |

## Test plan (smoke, pre-deploy)

Manual Railway staging test with one tenant's phone number, 6 flows:

1. **Happy path — specific time:** "Is Tuesday 2pm free?" → filler → `check_slot(2026-04-28, 14:00)` → offered → "yes book it" → readback → `book_appointment(slot_token=…)` → confirmed.
2. **Slot taken → alternatives:** Book a slot outside the call, then call and ask for that exact time → `check_slot` returns `slot_taken alts=3` → agent offers 2 alternatives → caller picks one → booked.
3. **Day only:** "Do you have anything Thursday?" → filler → `check_day(2026-04-30)` → day_has_slots → agent asks for concrete hour → caller says "3pm" → `check_slot(...)` → booked.
4. **Vague:** "Whenever you can" → filler → `next_available_days()` → has_near_availability → agent asks "what day works for you?" → caller picks day → `check_day` → `check_slot` → booked.
5. **Past date:** "Can you come yesterday?" → `check_slot` returns `past_date` → agent asks for today or later. No tool loop.
6. **Schema rejection:** Force Gemini to try passing `urgency="high"` by constructing a scenario → Gemini Live's serializer should reject pre-send (no tool invocation). Verify via `[63.1-DIAG]` logs that no `function_tools_executed` event fires. If it does fire, `_URGENCY_ALIASES` still catches it — double-layer defense.

## Execution checklist (for when you approve)

Order matters — each step is independently revertable.

- [ ] **Step 1** — Create `src/tools/_availability_lib.py` with the extracted helpers. No behavior change. Run existing UAT to confirm green.
- [ ] **Step 2** — Add `src/tools/check_slot.py` with `raw_schema`. Register in `__init__.py` **alongside** `check_availability` (keep both live during smoke). Manually flip prompt to mention `check_slot` for one tenant; verify via Railway logs the new tool invokes.
- [ ] **Step 3** — Add `check_day.py` + `next_available_days.py`, register both.
- [ ] **Step 4** — Rewrite the three prompt sections (EN + ES). Verify ES parity via diff.
- [ ] **Step 5** — Remove `check_availability.py` + its registration. At this point there is no going back without revert.
- [ ] **Step 6** — Update `book_appointment.py` schema: `raw_schema` with required `slot_token`, enum `urgency`, drop `slot_start`/`slot_end` from declaration (keep as unused `= ""` defaults one release cycle for safety, then delete).
- [ ] **Step 7** — Run 6-flow smoke test on Railway staging. Capture 1 transcript per flow for review.
- [ ] **Step 8** — Ship. Monitor Sentry + Railway logs for 48h. Watch for: `[63.1-DIAG] function_tools_executed` entries showing old tool name (bug), truncated `STATE:` returns (unexpected Gemini behavior), rise in `agent_false_interruption` count (VAD tuning regression).

## Estimated scope

- **Time:** 1.5-2 days (1 day code, half-day prompt rewrite, half-day smoke + deploy).
- **Files touched:** `src/tools/__init__.py`, `src/tools/_availability_lib.py` (new), `src/tools/check_slot.py` (new), `src/tools/check_day.py` (new), `src/tools/next_available_days.py` (new), `src/tools/check_availability.py` (deleted), `src/tools/book_appointment.py` (schema tighten), `src/prompt.py` (5 blocks rewrite, EN + ES).
- **Does NOT touch:** `src/agent.py` (session wiring), `src/lib/slot_calculator.py`, `src/lib/booking.py`, any DB migrations, Supabase RLS, any dashboard code.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Gemini picks wrong tool (calls `check_day` when caller said "2pm Tuesday") | Each tool's description leads with the trigger condition ("when the caller names a concrete hour" vs "when the caller names a date but not a time"). Prompt's AVAILABILITY RULES block spells out the mapping. If misrouting is observed in UAT, tighten descriptions — cheap iteration. |
| Caller re-prompt loops between `check_day` and `check_slot` | The prompt's "ask for a concrete hour" directive after `check_day` must be clear. UAT flow 3 covers this. |
| ES prompt parity drift | Diff EN and ES side-by-side before commit. The 60.3 Plan 12 parity discipline is already the project's norm. |
| `raw_schema` breaks on livekit-agents 1.5.6 | `@function_tool(raw_schema=…)` is supported since 1.5.x per the [LiveKit tool docs](https://docs.livekit.io/agents/logic-structure/tools/). Verify locally before step 2 ships. |
| Orphan-booking risk (audit Finding 2) remains | Out of scope for this plan — that's the separate "small plan" the audit recommended. Don't conflate. |

## What this plan deliberately does NOT do

- Does not fix upstream livekit/agents #4441 (tool-call VAD cancellation) — not fixable from our side.
- Does not add the post-call orphan-appointment audit (audit Finding 2) — separate work.
- Does not change VAD tuning (`silence_duration_ms = 2500`) — current setting is the right mitigation for brief-acknowledgment cancels.
- Does not change the greeting-unmute workaround (63.1-07) — unrelated.
- Does not change `book_appointment`'s runtime logic — only the declaration. All the token-recovery / idempotency / recovery-SMS behavior stays verbatim.

## Decision requested

Approve / reject / amend? If approved, I'll execute the 8-step checklist and report back per-step. If you want the `book_appointment` schema-tighten deferred (step 6), that's a clean split — the `check_availability` → three-tool work stands alone.

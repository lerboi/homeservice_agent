---
type: system
system: Voice Agent
status: current
description: "Tools - check_caller_history, check_slot, check_day, next_available_days. Covers: check_caller_history — Silent Context; check_slot / check_day / next_available_days — Slot Query (split from check_availability); All-day busy expansion (2026-06-10); check_availability — Slot Query (HISTORICAL — repla"
source: .claude/skills/voice-call-architecture/SKILL.md § 5. Tools (10 in-process)
migrated: 2026-11-23
verified:
tags: [voco/system/voice-agent]
---

# Tools (10 in-process) (part 1 of 4)

Part of [[Voice Agent]]. Migrated verbatim from the `voice-call-architecture` skill; check `verified` before trusting details.

Registry: `src/tools/__init__.py`. All tools run in-process with direct
Supabase access. Factories return `@function_tool`-decorated callables
with `deps` captured via closure.

**Always available:** `transfer_call`, `capture_lead`, `validate_address`,
`check_caller_history`, `check_customer_account`, `end_call`.
(`validate_address` is always-on — 2026-06-10 — because `capture_lead`
needs addresses too and is itself always registered.)
**Onboarding-complete gated:** `check_slot`, `check_day`,
`next_available_days`, `book_appointment`.

> **Note (prod-readiness 2026-06):** the former monolithic
> `check_availability` tool has been **split into three** availability
> tools — `check_slot` (specific date+time), `check_day` (open slots for a
> day), `next_available_days` (next N days with any availability). Each
> registers a `slot_token` in a per-call registry (`deps["_slot_tokens"]`,
> via `register_slot_token`) and returns it in its STATE line. Booking no
> longer passes raw ISO `slot_start`/`slot_end`; instead Gemini passes the
> opaque `slot_token` to `book_appointment`, which resolves it to the
> authoritative UTC start/end on `deps`. This eliminated the Gemini-drift
> timezone bug where the model reconstructed naive ISO strings from the
> caller's wall-clock speech (8h-off bookings). Sections referring to
> `check_availability` below are retained as historical context.

### check_caller_history — Silent Context

Parallel query: leads (3 most recent) + appointments (3 upcoming).
Phase 60 STATE codes:
- `STATE:repeat_caller prior_appointments=N prior_leads=N` + CONTEXT
  block — directive: use silently, never recite.
- `STATE:first_time_caller` — proceed with normal intake.
- `STATE:history_lookup_failed` (3 error paths) — proceed silently.

### check_slot / check_day / next_available_days — Slot Query (split from check_availability)

**Current state (prod-readiness 2026-06):** the single `check_availability`
tool was split into three:
- **`check_slot`** (`src/tools/check_slot.py`) — verify one (date, time).
  raw_schema enforces `required:[date,time]` + HH:MM / YYYY-MM-DD patterns.
  On hit, registers a `slot_token` and returns `STATE:slot_ok token=… speech=…`;
  also stashes `deps["_last_offered_token"]` as defense-in-depth for booking.
  On miss, returns `STATE:slot_taken … | ALTS: …token=…` with up to 3 nearby
  alternatives (each carrying its own token). **2026-06-12 (P1):** the
  `too_soon` branch now runs AFTER the schedule fetch and returns
  `earliest_today=<speech> token=…` (or, when today is done,
  `nothing_left_today=true next_open=<speech> token=…` from
  `_find_next_opening()` scanning the next 2 days); `day_empty` likewise
  carries `next_open=… token=…` when a later day has slots — every rejection
  ships with a tool-licensed alternative.
- **`check_day`** (`src/tools/check_day.py`) — **2026-06-12 (P1):** no longer
  yes/no; returns up to 3 representative windows spread across the day
  (`STATE:day_has_slots date_label=… count=N | OPTIONS: 1.<speech> token=…; …`
  via `pick_spread()`), each token registered in the shared registry so a
  caller-picked option books directly without a second check_slot.
- **`next_available_days`** (`src/tools/next_available_days.py`) —
  **2026-06-12 (P1):** returns the actual open-day labels
  (`STATE:has_near_availability days=Thursday, July 6th (5 open); …`)
  instead of yes/no; the agent offers the days, then check_day supplies
  times for the chosen day.
- All three import shared helpers from `src/tools/_availability_lib.py`
  (`calc_slots_for_dates`, `register_slot_token`, `parse_hhmm_to_utc`,
  `tenant_today`, …). (Phase 65: the Gemini-era `mute_input_during_tool`
  call + `deps["_last_tool_state"]` cascade-recovery replay were **removed** —
  gpt-realtime-2's async function calling makes them unnecessary.)
- **Same-day minimum-notice floor (2026-08-19):** `calc_slots_for_dates`
  drops TODAY's slots starting inside `MIN_NOTICE_TODAY_S` (3600s) — the slot
  calculator only skips slots that already STARTED, so check_day /
  next_available_days (and check_slot's match/ALTS paths) could previously
  offer + token-register a slot starting minutes from now, which
  book_appointment then booked with less notice than check_slot's own
  `too_soon` rule permits. Future days are unaffected; `book_appointment`'s
  slot-taken recompute and `post_call._calculate_suggested_slots` call
  `calculate_available_slots` directly and are untouched. Tests:
  `tests/test_availability_min_notice.py`. (2026-08-20: the third direct
  caller, `utils.calculate_initial_slots`, was DELETED as dead code — zero
  callers repo-wide; a Node-era `handleInbound` leftover.)

`slot_token` registry: `register_slot_token(deps, start, end)` stores
`{slot_start_utc, slot_end_utc, created_at}` under an opaque key in
`deps["_slot_tokens"]` (10-min TTL). `book_appointment` resolves the token
to authoritative UTC times — this is what replaced raw ISO slot passing.

### All-day busy expansion (2026-06-10)

All-day mirror rows on `calendar_events` / `calendar_blocks` store pure dates
as UTC-midnight timestamps (e.g. Google's exclusive end.date `2026-06-11`
lands as `2026-06-11T00:00:00Z`). Compared literally they blocked the wrong
local hours (08:00 → 08:00-next-day for an Asia/Singapore tenant).

- `src/lib/slot_calculator.py` — new `_all_day_busy_bounds(start, end,
  tenant_timezone)`: derives the covered calendar days from the UTC date
  components (the pure-date encoding — NOT the local conversion, which would
  shift the day for negative-offset tenants) and expands to
  **[00:00 local of first day, 00:00 local of day-after-last-day)**. The
  exclusive end is stepped back 1µs so a provider-style next-day-midnight end
  doesn't over-block an extra day; degenerate end ≤ start still blocks the
  start day. Same semantics as the JS twin in the main repo.
  `calculate_available_slots` applies it to any external block with
  `is_all_day=true`.
- **All calendar fetch sites now select `is_all_day`:**
  `_availability_lib.fetch_scheduling_data` (events + blocks),
  `book_appointment.py` slot-taken recalculation (events), the `agent.py`
  prefetch (events + blocks), and `post_call._calculate_suggested_slots`
  (events). (`utils.calculate_initial_slots` was a fifth site until its
  2026-08-20 dead-code deletion.)
- Tests: `tests/test_slot_calculator_all_day.py` (new).

---

### check_availability — Slot Query (HISTORICAL — replaced by the split above)

Parameters: `date` (YYYY-MM-DD), `time` (HH:MM 24h), `urgency`.

- Past-date validation rejects dates before today in tenant timezone.
- 1-hour minimum buffer for today.
- Fetches tenant config + 4 scheduling tables in parallel.
- Calculates slots via `calculate_available_slots()` with `max_slots=50`.
- Specific time check returns "Yes, X is available" with start/end for
  booking, or no + up to 3 closest alternatives.
- General check (date only or neither) returns confirmation ONLY — no
  specific times, no earliest/latest anchors, no slot count.
- 10 STATE codes (Phase 60): `availability_lookup_failed` (3 variants),
  `date_in_past`, `requested_time_too_soon`, `slot_available` (carries
  `start=ISO end=ISO speech=<pre-formatted>`), `slot_not_available`
  (with alternatives), `no_slots_available` (2 variants),
  `slots_available_unverified`.
- Directives reinforce "do not read the full slots list out loud" and
  "do not fabricate times."

---
type: system
system: Voice Agent
status: current
description: "Tools - validate_address, book_appointment, capture_lead, check_customer_account. Covers: validate_address — Early Mid-Call Address Validation (2026-06-10); book_appointment — Atomic Booking; capture_lead — Lead Capture; check_customer_account — Re-serve Customer Context"
source: .claude/skills/voice-call-architecture/SKILL.md § 5. Tools (10 in-process)
migrated: 2026-11-23
verified:
tags: [voco/system/voice-agent]
---

# Tools (10 in-process) (part 2 of 4)

Part of [[Voice Agent]]. Migrated verbatim from the `voice-call-architecture` skill; check `verified` before trusting details.

### validate_address — Early Mid-Call Address Validation (2026-06-10)

`src/tools/validate_address.py`, factory-over-deps, raw_schema. Params:
`street` (required), `unit`, `postal_code`, `city`. Called the MOMENT the
caller finishes giving their address (after a one-sentence filler) — no
longer deferred to the booking/lead commit. Internally calls
`validate_address_with_region_fallback` (google_maps.py), which orchestrates
the unchanged Phase 61 `validate_address_bounded` (1.5s timeout, never
raises, `gmaps_validate_events` telemetry per attempt, Sentry on
`verdict=error` only) and is itself wrapped in a belt-and-braces try/except
(returns `address_noted` if the wrapper somehow raises).

**Caller-region fallback (2026-06-11):** `derive_caller_region`
(`src/lib/phone.py`, `phonenumbers.region_code_for_number`, never raises,
None for anonymous/unparseable caller-ID) sets `deps["caller_region"]` at
session setup — it correctly splits +1 into US vs CA by area code.
`validate_address_with_region_fallback(…, primary_region=tenant country,
caller_region=…)` contract: attempt 1 uses the tenant's country (unless that
region is unsupported while caller_region IS supported — then caller_region
goes first); attempt 2 fires ONLY when attempt 1 returns
`unconfirmed`/`unsupported_region` AND caller_region is truthy, differs from
the region attempt 1 used, and is in SUPPORTED_REGION_CODES (US/CA/SG). The
better verdict wins (confirmed > confirmed_with_changes > unconfirmed >
unsupported_region/skipped/error); ties go to attempt 1. Worst case adds one
extra 1.5s-bounded call on the rare unconfirmed path. Both attempts write
their own telemetry rows. All three validation sites use this wrapper
(validate_address tool + the book_appointment/capture_lead cache-miss
fallbacks); the winning result is what gets cached.

Returns (STATE+DIRECTIVE, never spoken verbatim):
- `confirmed` → `STATE:address_ok speech={formatted} | DIRECTIVE:confirm
  the address back in ONE short sentence and continue…`
- `confirmed` + caller gave NO postal but the result has one (2026-06-12 P2)
  → `STATE:address_ok_confirm_postal speech={formatted} postal={postal} |
  DIRECTIVE:…ask whether the postal code is right as a QUESTION, digit by
  digit — never state it as a fact…` (incident call 31559053: a
  Google-inferred postal was asserted, then defended against the caller)
- `confirmed_with_changes` → `STATE:address_corrected speech={formatted} |
  DIRECTIVE:read the corrected address once, ask briefly if that's right…`
  (at most one correction loop, then re-call validate_address)
- `unconfirmed` → `STATE:address_unclear missing={hint} | DIRECTIVE:ask ONE
  targeted follow-up… After one retry, proceed with what the caller said.`
  **2026-09-04 P1.3 — cap enforced in code:** the tool counts attempts in
  `deps["_validate_attempts"]` (per `_norm(street)` key + `__total__`). The
  2nd `unconfirmed` for the same street (`UNCONFIRMED_RETRY_CAP=2`) OR the
  3rd unconfirmed in the call regardless of street
  (`UNCONFIRMED_TOTAL_CAP=3` — STT drifting "Burr/Kenboro/Canberra Drive"
  must not reset the clock) returns `STATE:address_noted speech={as_given}
  | DIRECTIVE:read it back once in the caller's words and continue with the
  next intake step. Do not ask about the address again this call. Never
  mention validation.` The first attempt is byte-identical to before; the
  prompt bullet now reads "ask for just the piece named in `missing=` as a
  plain question … The tool switches to `STATE:address_noted` when it is
  time to stop — never ask about the same piece twice." Rationale: the
  prose "after one retry" rule lost to last-instruction-wins — the 2026-08-17
  Canberra Drive call re-asked the block number 4× in 66 s and the caller
  hung up. Tests in `tests/test_validate_address_tool.py`.
- `skipped`/`unsupported_region`/`error` → `STATE:address_noted
  speech={as caller said it} | DIRECTIVE:read it back once and continue.
  Never mention validation.` (never blocks, never exposes internals)

**Singapore postal-first via OneMap (2026-09-04 P1.4):** before the Google
call, when `deps["country"] == "SG"`, the postal code is exactly six digits
after stripping spaces/hyphens (`onemap.is_sg_postal`), and
`VOCO_SG_ONEMAP` is not `false`, the tool awaits
`onemap.lookup_postal(postal)` (`src/integrations/onemap.py`: SLA OneMap
`/api/common/elastic/search?searchVal=…&returnGeom=Y&getAddrDetails=Y`,
no auth, per-call `httpx.AsyncClient`, 1.5 s, never raises, rejects a first
result whose `POSTAL` differs). On a hit `_onemap_result()` builds a dict in
the exact `google_maps._voco_result` shape — `formatted_address = "Block
{BLK_NO} {Road Name}[, {Building}]"` (title-cased; Building omitted when
`"NIL"`), `address_components` = `{street_number: BLK_NO, route: road,
subpremise: unit, locality: "Singapore", postal_code, country: "Singapore",
country_code: "SG"}`, lat/lng from OneMap, `place_id: None` — and the
verdict is `confirmed` when the caller's spoken street contains the block
number or fuzzy-matches the road name (`difflib` ratio ≥ 0.8 over the
alphabetic words, common abbreviations Rd/Ave/Dr/Blk/Jln/Lor expanded), else
`confirmed_with_changes` (the Canberra/Kenboro case → the existing
`address_corrected` readback-once branch). Everything downstream —
`_validated_address` cache, `get_cached_validation` reuse by
book_appointment/capture_lead, the service-area gate (reads
`address_components.postal_code`/`.locality`), the STATE builders — runs
unchanged on that dict. No hit / error / flag off / non-SG / non-6-digit →
today's Google path exactly as before (asserted by the patched Google mock
in `tests/test_validate_address_onemap.py`). No `gmaps_validate_events`
row is written for OneMap hits (that table is Google-specific); the log
line is `[validate_address] onemap hit postal= blk= road= building=
verdict=`. Why: an SG postal code identifies one building and STT
transcribes digits reliably while proper-noun street names are what it
mangles — both 2026-08 hang-ups would have resolved on the first attempt.

**Country guard (2026-06-12 P2):** `_apply_country_guard` inside
`validate_address_with_region_fallback` downgrades any confirmed*
result whose `address_components.country_code` contradicts the trusted
region (caller-ID region when in SUPPORTED_REGION_CODES, else tenant
country) to `unconfirmed` with all Google-derived fields stripped —
applied to BOTH attempts, before the retry decision, so a wrong-country
attempt-1 confirmation triggers the caller-region retry (self-heals the
Utah-booking incident eef9f785 even with a misconfigured tenant.country).

Caches the full bounded result on `deps["_validated_address"] =
{"input": {street,unit,postal_code,city}, "result": <bounded dict>,
"ts": …}` and sets `deps["_last_tool_state"]`.

**Cache reuse:** `book_appointment` / `capture_lead` call
`get_cached_validation(deps, street, postal_code)` (exported from
`validate_address.py`) before their own validation. On a match
(casefold/strip street + postal compare; **unit differences tolerated**;
cached `verdict=error` never reused — transient failures get a fresh
attempt; **2026-06-12 P2: an empty cached postal also matches when the
requested postal equals the result's looked-up postal** — the
address_ok_confirm_postal flow where the caller confirmed the suggested
postal) they reuse the cached result with NO second Google call; on a
miss they validate live exactly as before (safety fallback — booking
never gates on validate_address having run). The reused
verdict/formatted_address/place_id/lat/lng flow into `atomic_book_slot` /
`record_outcome` identically to a live validation; the D-D3' overwrite
rule is unchanged. Tests: `tests/test_validate_address_tool.py`.

**Service-Area gate (M16 P1, 2026-06-20 — Capability A):** after caching
`deps["_validated_address"]`, `validate_address` runs the gate via
`classify_service_area(zones=…, postal_code=…, locality=…)`
(`src/lib/service_area.py`, pure — no DB/network). It classifies **only on a
solidly confirmed address** (`confirmed` / `confirmed_with_changes`) and
deliberately **SKIPS the `address_ok_confirm_postal` branch** (that postal is
an unconfirmed Google lookup, not caller-said — never gate on it). Inputs are
the Google-normalized `address_components.postal_code` + `.locality`, classified
against `zones = deps["_slot_cache"]["service_zones"]` (the `agent.py`
slot-cache prefetch SELECT was widened to add `cities` alongside the existing
zone fields). The result is stored on `deps["_service_area"]`.

`classify_service_area` unions `postal_codes[]` + `cities[]` across the tenant's
`service_zones` rows (normalized — case/punctuation-insensitive, CA/UK postal
spaces ignored) and is **biased HARD to false-ACCEPT**: it returns
`out_of_area` ONLY when there IS a coverage list AND a trusted postal/town
signal that does not match; an empty coverage list yields `unconfigured` (gate
off), and a missing/ambiguous signal yields `unknown` — both fall through to the
normal flow. `matched_on` records `postal` / `city` / `None`.

When the verdict is `out_of_area`, the gate **OVERRIDES the STATE+DIRECTIVE**
the tool would otherwise return, via the new helper
`_out_of_area_state(action, formatted, referral_note)` → a new token
`STATE:address_out_of_area action=<callback|decline_referral|trip_fee>`. The
owner action + referral note are read from `deps["tenant"]`
(`out_of_area_action` / `out_of_area_referral_note`, loaded via the existing
`select("*")`). A **prohibited-phrase guard** forbids the caller-facing wording
from ever saying "zone" / "service area" / "coverage" / "buffer" /
"travel time" — only "a bit outside the area we usually cover". The three modes:

- **callback** (default) — don't book; take a message + promise a call-back.
- **decline_referral** — don't book; politely decline + optional referral
  (the `out_of_area_referral_note`).
- **trip_fee** — book as normal, but mention a possible travel charge.

The gate **fails OPEN**: any exception falls through to the normal flow and it
never blocks the call. (Capability B — back-to-back travel feasibility — is
M16 P2 and not yet built.) Tests: `tests/test_service_area.py` + gate tests
added to `tests/test_validate_address_tool.py`.

### book_appointment — Atomic Booking

Parameters (current, prod-readiness 2026-06): `slot_token`, `street_name`,
`postal_code`, `caller_name`, `unit_number?`, `urgency` (default "routine").
The raw_schema **no longer exposes `slot_start`/`slot_end`** — those are
resolved server-side from `slot_token` against `deps["_slot_tokens"]`. (The
handler keeps empty `slot_start`/`slot_end` locals only so the legacy
`_ensure_utc_iso` fallback branch stays syntactically intact; that branch is
dead when a valid token resolves.)

- **Phase 65 — input-mute / cascade-recovery removed:** the Gemini-era
  `mute_input_during_tool(deps)` call and the `deps["_last_tool_state"]`
  replay plumbing (consumed by the now-deleted `_attempt_tool_result_replay`)
  were removed. They existed only to survive Gemini 3.1's server-VAD
  cancellation cascade; gpt-realtime-2's async function calling does not
  cancel in-flight tool calls when the caller speaks, so they are obsolete.
- **slot_token resolution:** if Gemini supplies an unknown/empty token,
  falls back to `deps["_last_offered_token"]` (single-slot path only; the
  alternatives branch clears it). Token entry older than 600s → treated as
  expired.
- Urgency normalization (backlog 999.1 fix): `_normalize_urgency()` maps
  freeform `"high"` → `"urgent"`, `"low"/"normal"` → `"routine"`,
  `"critical"/"asap"` → `"emergency"`. Unknown → `"routine"`.
- **Idempotency cache**: checks `deps["_last_booked_slot_key"]` against
  `f"{slot_start}|{slot_end}"` (resolved from the token). Cache hit →
  return cached response, no re-run.
- Calls `atomic_book_slot()` via Supabase RPC.
- On success:
  - `booking_outcome='booked'` written IMMEDIATELY (before side effects).
  - Calendar push + caller SMS fired as `asyncio.create_task()` (truly
    non-blocking — previously awaited, caused 1-4s silence + duplicate
    invocations).
  - Returns in ~300ms.
- On slot taken: checks idempotency cache first (late duplicate → return
  cached success, no spurious recovery SMS). Otherwise recalculates,
  writes `booking_outcome='attempted'` (conditional on NULL), fires
  recovery SMS as `create_task`.
- Phase 60 STATE codes: `booking_succeeded appointment_id=...`,
  `slot_taken`, `booking_invalid reason=<snake>`,
  `booking_failed reason=rpc_error`.
- Phase 46 booking-reconciliation stamping: `deps["_booking_succeeded"]`,
  `deps["_booked_appointment_id"]`, `deps["_booked_caller_name"]`
  persisted for post-call pipeline to reconcile race.

### capture_lead — Lead Capture

Parameters: `caller_name`, `phone`, `street_name`, `unit_number`,
`postal_code`, `job_type`, `notes`.

- Computes mid-call duration from `start_timestamp`.
- Calls `create_or_merge_lead()`, writes `booking_outcome='declined'`.
- **`notes` persisted (2026-06-10):** the `record_call_outcome` RPC
  (migration 062, 14-arg) has no notes-like parameter and `inquiries` has no
  notes column, so `notes` is folded into the job_type free-text passed to
  the RPC — `"{job_type} — {notes}"` (or just `notes` when job_type is
  empty). Previously the captured notes were silently dropped.
- **Explicit callback phone preferred (2026-06-10):** when the model passes a
  `phone` AND it parses to a plausible E.164 via `_normalize_free_form`
  (imported from `src/integrations/jobber.py`; phonenumbers with the tenant's
  country as default region — handles spoken/free-form shapes the SIP-attr
  normalizer does not), that number is used as `raw_phone` for
  `record_outcome` instead of caller-ID. On parse failure, falls back to
  caller-ID (`deps["from_number"]`) as before. Callers who said "reach me on
  my other number" were previously losing it.
- STATE codes: `lead_captured lead_id=...`, `lead_invalid`, `lead_failed`.
- Phase 60 D-11 parity: same single-question address + readback rules as
  book_appointment.
- **Idempotent on `lead_calls` insert.** Mid-call `capture_lead` and the
  post-call pipeline (step 9, `create_or_merge_lead()`) can both route to
  the same (lead_id, call_id) pair. The junction write is an upsert with
  `on_conflict=('lead_id','call_id')` + `ignore_duplicates=true` —
  matches the TS-side `src/lib/leads.js` pattern. A plain INSERT would
  raise `lead_calls_pkey` 23505 on the second call.
- **Service-area stamp (M16 P1, 2026-06-20).** `capture_lead` now captures
  the `record_outcome` return, re-runs `classify_service_area` from its OWN
  `validation_result` (confirmed* only, same `confirmed`/`confirmed_with_changes`
  rule as the validate_address gate), and refreshes `deps["_service_area"]`.
  When the verdict is `out_of_area` it stamps `inquiries.out_of_area = true`
  via a follow-up service-role UPDATE keyed by the returned `inquiry_id` — the
  hardened `record_call_outcome` RPC is intentionally NOT overloaded with an
  out-of-area parameter. Best-effort: a failure here never breaks lead capture.

### check_customer_account — Re-serve Customer Context

Re-serves `deps["customer_context"]` (populated pre-session from Xero +
Jobber). Never re-fetches. See
`integrations-jobber-xero/references/python-agent-injection.md` for full
coverage of the Xero/Jobber merge and STATE format.

Returns locked `STATE:no_xero_contact_for_phone` when customer_context
is None. Always available (not gated on onboarding_complete).

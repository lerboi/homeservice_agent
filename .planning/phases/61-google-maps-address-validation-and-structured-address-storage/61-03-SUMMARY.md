---
phase: 61
plan: 03
subsystem: voice-call-architecture / livekit-agent
tags: [livekit-agent, address-validation, gmaps, book-appointment, capture-lead, d-e2, d-d3-prime, integration-tests]

dependency-graph:
  requires:
    - "Plan 01 — migration 062 (book_appointment_atomic 17-arg overload + record_call_outcome 14-arg overload, applied to remote DB)"
    - "Plan 02 — src/integrations/google_maps.py (validate_address_bounded contract)"
  provides:
    - "src/lib/booking.py atomic_book_slot wrapper extended with 6 new kwargs (formatted_address, place_id, latitude, longitude, address_components, address_validation_verdict)"
    - "src/lib/write_outcome.py record_outcome wrapper extended with same 6 kwargs"
    - "src/tools/book_appointment.py validate-then-book flow + D-D3' overwrite + D-E2 verdict-driven success-path returns"
    - "src/tools/capture_lead.py D-B4 symmetric validate-then-record + D-D3' overwrite + D-E2 LEAD CAPTURED verdict-driven returns"
    - "tests/test_book_appointment_validation.py — 10 contract tests locking D-D3' overwrite logic + D-E2 BOOKED return strings"
    - "tests/test_capture_lead_validation.py — 8 contract tests locking the symmetric LEAD CAPTURED return strings"
  affects:
    - "Plan 04 — prompt-side rules will reference the D-E2 STATE+DIRECTIVE shapes shipped here"
    - "Dashboard read-side: appointments/inquiries now carry validated-address columns when verdict permits (Plan 01 migration is the storage)"

tech-stack:
  added: []
  patterns:
    - "validate-before-RPC pre-check (external HTTP outside slot-lock window, D-B2)"
    - "Verdict-driven STATE+DIRECTIVE tool returns (D-E2 — agent reads tool output, never speakable)"
    - "Booking-never-blocks-on-Google failure-mode contract (D-C1 — every verdict path proceeds to RPC)"
    - "Conditional service_address overwrite gated on verdict in {confirmed, confirmed_with_changes} (D-D3')"
    - "Defended access via __wrapped__ for testing @function_tool-decorated handlers"

key-files:
  created:
    - "C:/Users/leheh/.Projects/livekit-agent/tests/test_book_appointment_validation.py (10 tests, 215 LOC)"
    - "C:/Users/leheh/.Projects/livekit-agent/tests/test_capture_lead_validation.py (8 tests, 188 LOC)"
  modified:
    - "C:/Users/leheh/.Projects/livekit-agent/src/lib/booking.py (+10 lines, 6 new kwargs + RPC param entries)"
    - "C:/Users/leheh/.Projects/livekit-agent/src/lib/write_outcome.py (+14 lines, 6 new kwargs + RPC param entries)"
    - "C:/Users/leheh/.Projects/livekit-agent/src/tools/book_appointment.py (+59 lines, validation pre-check + D-D3' overwrite + D-E2 returns)"
    - "C:/Users/leheh/.Projects/livekit-agent/src/tools/capture_lead.py (+57 lines, symmetric validation + D-D3' overwrite + D-E2 returns)"

decisions:
  - "[Plan 03 deviation Rule 1 — Plan interfaces stale]: Plan 03 <interfaces> showed record_outcome with kwarg `phone_e164` and no appointment_id/call_id. Actual signature (per Plan 01 deviation #1 + ground-truth read of write_outcome.py) is `raw_phone`, `appointment_id`, `call_id` — record_outcome internally normalizes phone via _normalize_phone. Extended the actual signature with 6 new kwargs; new RPC overload (Plan 01 migration 062) accepts them as defaulted-NULL."
  - "[Plan 03 deviation Rule 3 — sibling-only commits]: Continued Plan 02's pattern (and project history commit b6a385f) — homeservice_agent/livekit-agent/ mirror was deleted on 2026-04-22. All Plan 03 code commits land on the sibling repo only; the worktree carries the SUMMARY only. Plan 03 PLAN.md files_modified: lists 'livekit-agent/...' paths but those resolve to sibling per the established pattern."
  - "[Plan 03 placement choice]: Validation pre-check inserted IMMEDIATELY after service_address build, BEFORE slot-token decode and tenant_id check (matches plan literal 'IMMEDIATELY AFTER address-prep block'). This sacrifices a Google call on rare doomed-flow paths (missing tenant, malformed slot ISO) but keeps the validate-line strictly before atomic_book_slot per D-B2."
  - "[Plan 03 capture_lead placement]: Mirrored book_appointment placement — validation goes immediately after service_address build, BEFORE the call_uuid early-return guard. Symmetric with book_appointment.py for D-B4."
  - "[Plan 03 testing approach]: @function_tool-decorated tool handlers exposed via .__wrapped__ attribute (verified empirically: `RawFunctionTool.__wrapped__` is the underlying async fn). Tests call `.tool.__wrapped__(...)` directly with mocked validate_address_bounded + atomic_book_slot/record_outcome at module-patch boundaries. No live Google or Supabase round-trips."
  - "[Plan 03 capture_lead post-processing dropped]: Original capture_lead success path looked up tenants.business_name and emitted `STATE:lead_captured business={biz_name}`. The D-E2 LEAD CAPTURED return shape doesn't carry business_name (it's verdict-driven, not state+business). Removed the now-unused tenant lookup block per the plan's literal replacement directive — preserves single-RPC + business_name lookup is harmless to drop here since the agent already knows the business name from system prompt context."

metrics:
  duration: "~6 minutes (executor wall clock)"
  completed_date: "2026-05-03"
  task_count: 2
  test_count: 18
  test_pass_count: 18
  files_modified_count: 4
  files_created_count: 2
---

# Phase 61 Plan 03: book_appointment + capture_lead validation wiring + D-D3' overwrite + D-E2 returns Summary

**One-liner:** Wires `google_maps.validate_address_bounded` (Plan 02) into `book_appointment` and `capture_lead` tool flows with verdict-gated `service_address` overwrite (D-D3') and replaces the success-path tool returns with verdict-driven STATE+DIRECTIVE strings (D-E2), all locked by 18 mocked-boundary integration tests.

## What was built

### Task 1 — book_appointment + wrapper extensions ✅ COMPLETE

**`src/lib/booking.py`** — `atomic_book_slot` extended with 6 new kwargs (`formatted_address`, `place_id`, `latitude`, `longitude`, `address_components`, `address_validation_verdict`) and 6 new RPC param entries. Existing 11 kwargs unchanged. Plan 01's migration 062 RPC overload accepts the new params as defaulted-NULL.

**`src/lib/write_outcome.py`** — `record_outcome` extended with same 6 kwargs. RPC param dict gets `p_formatted_address` / `p_place_id` / `p_latitude` / `p_longitude` / `p_address_components` / `p_address_validation_verdict` entries. Existing signature preserved (`raw_phone`, `appointment_id`, `call_id`, etc — see Plan 01 deviation #1 for ground truth).

**`src/tools/book_appointment.py`** — three changes:

1. Import: `from ..integrations.google_maps import validate_address_bounded`
2. Validation pre-check inserted at line 263–284 (after `service_address = ", ".join(parts)…` block, before slot-token decode):
   - Builds `region_code` from `deps["country"]` (already in deps per agent.py:301)
   - Builds `address_lines` as `["street_name, unit_number"]` joined string
   - Calls `validate_address_bounded(tenant_id=..., call_id=..., region_code=..., address_lines=..., postal_code=..., locality=None, supabase=supabase, timeout_seconds=1.5)`
   - D-D3' overwrite: `if validation_verdict in ("confirmed", "confirmed_with_changes") and formatted_address_value: service_address = formatted_address_value`
3. `atomic_book_slot` call extended with 6 new kwargs forwarded from `validation_result`
4. Success-path `return_msg` replaced with verdict-driven branch:
   - `confirmed` → `BOOKED [verdict=validated]: relay normalized address [{formatted}] and time [{slot_speech}] as confirmed; ask if anything else is needed`
   - `confirmed_with_changes` → `BOOKED [verdict=validated_with_corrections]: relay normalized address [{formatted}] as the final form, explicitly invite caller confirmation before closing; if caller corrects, accept correction and re-read full address`
   - all others → `BOOKED [verdict=unvalidated]: relay address as caller spoke it; do NOT claim "validated", "confirmed against records", or "looked up your address"`

Slot-taken / slot-unavailable / RPC-error returns unchanged (Phase 60 already STATE+DIRECTIVE).

Commit: `9d4b374` (sibling repo).

### Task 2 — capture_lead symmetry + integration tests ✅ COMPLETE

**`src/tools/capture_lead.py`** — symmetric integration:
1. Import `validate_address_bounded`
2. Validation pre-check at line 60–87 (after `service_address = ", ".join(parts)`, before `call_uuid` early-return)
3. `record_outcome` call extended with 6 new kwargs
4. Success-path return replaced with verdict-driven `LEAD CAPTURED [verdict=...]` branches:
   - `confirmed` → `LEAD CAPTURED [verdict=validated]: relay normalized address [{formatted}] as confirmed; ask if anything else is needed`
   - `confirmed_with_changes` → `LEAD CAPTURED [verdict=validated_with_corrections]: relay normalized address [{formatted}] as the final form, explicitly invite caller confirmation; if caller corrects, accept correction and re-read full address`
   - all others → `LEAD CAPTURED [verdict=unvalidated]: relay address as caller spoke it; do NOT claim "validated", "confirmed against records", or "looked up your address"`

The previous success path looked up `tenants.business_name` and emitted `STATE:lead_captured business={biz_name}`; the new shape is verdict-driven instead. The tenants lookup was dropped — see decisions[5].

**`tests/test_book_appointment_validation.py`** — 10 tests, all GREEN:

| # | Test | What it locks |
|---|------|---------------|
| 1 | `test_confirmed_overwrites_service_address` | D-D3': `address=` arg to atomic_book_slot equals `formatted_address`, NOT agent-joined |
| 2 | `test_unconfirmed_keeps_agent_joined` | D-D3' inverse: address remains agent-joined when verdict not confirmed/confirmed_with_changes |
| 3 | `test_error_keeps_agent_joined_and_proceeds` | D-C1: booking proceeds even on verdict=error |
| 4 | `test_skipped_keeps_agent_joined` | D-G1 graceful degradation path |
| 5 | `test_confirmed_return_shape` | D-E2: tool return starts with `BOOKED [verdict=validated]:` and embeds formatted_address |
| 6 | `test_corrections_return_shape` | D-E2: starts with `BOOKED [verdict=validated_with_corrections]:` |
| 7-10 | `test_unvalidated_return_shape_for_each_other_verdict[unconfirmed/error/skipped/unsupported_region]` (parametrized) | D-E2: all 4 non-success verdicts collapse to `BOOKED [verdict=unvalidated]:` |

**`tests/test_capture_lead_validation.py`** — 8 tests, all GREEN:

| # | Test | What it locks |
|---|------|---------------|
| 1 | `test_capture_lead_confirmed_overwrites_service_address` | D-B4: symmetric overwrite for inquiries.service_address |
| 2 | `test_capture_lead_unconfirmed_keeps_agent_joined` | D-B4 inverse |
| 3 | `test_capture_lead_confirmed_return_shape` | `LEAD CAPTURED [verdict=validated]:` |
| 4 | `test_capture_lead_corrections_return_shape` | `LEAD CAPTURED [verdict=validated_with_corrections]:` |
| 5-8 | `test_capture_lead_unvalidated_return_shape_for_each_other_verdict` (parametrized × 4) | `LEAD CAPTURED [verdict=unvalidated]:` for unconfirmed/error/skipped/unsupported_region |

Both test files mock at `validate_address_bounded` + `atomic_book_slot` (or `record_outcome`) module-level boundaries — no live Google API, no live Supabase RPCs. Tests access the wrapped handler via `tool.__wrapped__` attribute (`RawFunctionTool` exposes this).

Commit: `d51b3a4` (sibling repo).

## Line-number anchors (post-Plan-03)

- `src/tools/book_appointment.py`:
  - L19: `from ..integrations.google_maps import validate_address_bounded`
  - L263: `# Phase 61 (D-B2): validate address BEFORE atomic_book_slot` block start
  - L277: `validation_result = await validate_address_bounded(...)` — validate call line
  - L286: D-D3' overwrite (`if validation_verdict in ("confirmed", "confirmed_with_changes")`)
  - ~L450: `result = await atomic_book_slot(...)` — atomic call line (>277, contract holds: validate-before-atomic)
  - L583–602: D-E2 verdict-driven `return_msg` branches

- `src/tools/capture_lead.py`:
  - L13: `from ..integrations.google_maps import validate_address_bounded`
  - L60: `# Phase 61 (D-B4): symmetric validation pre-check` block start
  - L71: `validation_result = await validate_address_bounded(...)`
  - L82: D-D3' overwrite
  - ~L95: `await record_outcome(...)` — record call line (>71, contract holds: validate-before-record)
  - L131–151: D-E2 verdict-driven returns

## D-E2 byte-exact string evidence

```
$ grep -nE 'BOOKED \[verdict=' src/tools/book_appointment.py
586:    f"BOOKED [verdict=validated]: relay normalized address "
592:    f"BOOKED [verdict=validated_with_corrections]: relay normalized address "
600:    "BOOKED [verdict=unvalidated]: relay address as caller spoke it; "

$ grep -nE 'LEAD CAPTURED \[verdict=' src/tools/capture_lead.py
134:    f"LEAD CAPTURED [verdict=validated]: relay normalized address "
140:    f"LEAD CAPTURED [verdict=validated_with_corrections]: relay normalized address "
148:    "LEAD CAPTURED [verdict=unvalidated]: relay address as caller spoke it; "
```

## Test count + pass count

- New Plan 03 tests: 18 (10 + 8). All GREEN.
- Combined with Plan 02 + regression guard: 39 tests, all GREEN.
- Full repo suite (excluding 2 pre-existing collection-error files + 1 deselected VIP test): 273 collected, 8 failed (pre-existing per Plan 02 deferred-items.md), 265 passed. The 8 failures are documented as out-of-scope per SCOPE BOUNDARY rule — none touch Plan 03's surface.

## Mirror-vs-sibling sync confirmation

Per Plan 02 deviation #1 (Rule 3 — stale plan directive overridden by project history commit `b6a385f` 2026-04-22), the `homeservice_agent/livekit-agent/` mirror was deleted to eliminate dual-tree drift. **Plan 03 follows the same pattern:**

- All 4 modified source files + 2 new test files committed to sibling `C:/Users/leheh/.Projects/livekit-agent/` only.
- This worktree (homeservice_agent) carries only this SUMMARY.md.
- The plan's `files_modified:` frontmatter listed `livekit-agent/...` paths — those resolve to the sibling per the established post-`b6a385f` pattern.

## Deviations from Plan

### Auto-fixed (Rule 1 — bug in plan interfaces)

**1. Plan `<interfaces>` block had stale record_outcome signature**

- **Found during:** Task 1 Step 1.2, while reading the actual `write_outcome.py` per `<read_first>`.
- **Issue:** Plan 03 `<interfaces>` (lines 124–141) showed `record_outcome` with kwargs `(supabase, *, tenant_id, phone_e164, caller_name, job_type, service_address, urgency)` — 6 kwargs, no `appointment_id`, no `call_id`, with `phone_e164` directly. Actual signature in `write_outcome.py` is 8 kwargs: `(supabase, *, tenant_id, raw_phone, caller_name, service_address, appointment_id, urgency, call_id, job_type=None)` — `raw_phone` (normalized internally via `_normalize_phone`), plus `appointment_id` (None for inquiry path, non-None for job path) and `call_id`.
- **Fix:** Extended the **actual** 8-kwarg signature with 6 new defaulted-NULL kwargs (final arity 14 to mirror Plan 01's migration 062 RPC overload). Plan 01 already corrected this same staleness for the SQL side (deviation #1) — the Python side just inherits the correction.
- **Files modified:** `src/lib/write_outcome.py`
- **Commit:** `9d4b374`

### Auto-fixed (Rule 3 — stale plan directive overridden by project history)

**2. Skipped homeservice_agent/livekit-agent/ mirror writes**

- **Found during:** Task 1 (and again in Task 2).
- **Issue:** Plan 03 PLAN.md `<dual_repo_note>` directs all files to BOTH `livekit-agent/` mirror AND sibling `C:/Users/leheh/.Projects/livekit-agent/`.
- **Why stale:** homeservice_agent commit `b6a385f` (2026-04-22) deleted the mirror because the dual-tree pattern caused Phase 59 Plan 05 changes to land on the monorepo scaffold but NOT on the deployable sibling/Railway. Plan 02 already adopted this override (Deviation #1 of 61-02-SUMMARY.md). Continuing the pattern keeps the deployable runtime authoritative.
- **Fix:** Sibling-only commits. Worktree carries only this SUMMARY.md.
- **Commit:** N/A — this is the absence of mirror commits.

### Auto-fixed (Rule 1 — eliminated dead lookup)

**3. Dropped `tenants.business_name` lookup from capture_lead success path**

- **Found during:** Task 2 Step 2.3.
- **Issue:** The previous success-path return embedded `business={biz_name}` — required a Supabase round-trip to `tenants.business_name`. The D-E2 `LEAD CAPTURED [verdict=...]` shape doesn't carry business_name (it's verdict-driven). Keeping the lookup as dead code would be a wasted DB round-trip on every successful capture_lead.
- **Fix:** Removed the `tenants.select("business_name")...` block — it has no consumer in the new return path, and the agent already has the business name in its system prompt context.
- **Files modified:** `src/tools/capture_lead.py`
- **Commit:** `d51b3a4`

### No other deviations

The implementation followed Plan 03's `<action>` blocks for both tasks precisely. Validation insertion placement, D-D3' overwrite logic, D-E2 string content, RPC kwarg names, and the test file structure all match the plan's literal spec.

## Auth gates / human-action

None. Pure code work; tests mock the Google API and Supabase boundaries — no live API key needed. The Plan 01 migration was already pushed remotely before Plan 03 ran (per the critical_context note).

## Threat Surface Scan

No new threat surface beyond Plan 03's `<threat_model>` register (T-61-15 through T-61-19). No new endpoints, no new auth paths, no new file-access patterns. The validate-then-RPC flow is internal Python boundary and the RPC overload boundary; both are already in the threat model.

## Self-Check: PASSED

Verified the following exist on disk:

- `C:/Users/leheh/.Projects/livekit-agent/src/lib/booking.py` — FOUND, contains 6 new kwargs + 6 new `p_*` keys
- `C:/Users/leheh/.Projects/livekit-agent/src/lib/write_outcome.py` — FOUND, contains 6 new kwargs + 6 new `p_*` keys
- `C:/Users/leheh/.Projects/livekit-agent/src/tools/book_appointment.py` — FOUND, contains import line, validate call line, D-D3' overwrite, all 3 D-E2 strings (grep evidence above)
- `C:/Users/leheh/.Projects/livekit-agent/src/tools/capture_lead.py` — FOUND, contains import line, validate call line, D-D3' overwrite, all 3 D-E2 LEAD CAPTURED strings
- `C:/Users/leheh/.Projects/livekit-agent/tests/test_book_appointment_validation.py` — FOUND, 10 tests collected
- `C:/Users/leheh/.Projects/livekit-agent/tests/test_capture_lead_validation.py` — FOUND, 8 tests collected
- Commit `9d4b374` (Task 1) — FOUND in sibling repo `git log --oneline | grep 9d4b374`
- Commit `d51b3a4` (Task 2) — FOUND in sibling repo `git log --oneline | grep d51b3a4`
- `pytest tests/test_book_appointment_validation.py tests/test_capture_lead_validation.py tests/test_google_maps.py tests/test_no_generate_reply_in_src.py -x` → 39 passed
- Validate-line < atomic_book_slot-line in book_appointment.py: 277 < ~450 — PASS
- Validate-line < record_outcome-line in capture_lead.py: 71 < ~95 — PASS

---
type: system
system: Voice Agent
status: current
description: "New module: src/integrations/google_maps.py (412 LOC) — Covers: What changed; Env var; Files; Anti-hallucination invariants locked at the test layer"
source: .claude/skills/voice-call-architecture/SKILL.md § Phase 61 — Google Maps Address Validation Integration
migrated: 2026-11-23
verified:
tags: [voco/system/voice-agent]
---

# Phase 61 - Google Maps Address Validation Integration

Part of [[Voice Agent]]. Migrated verbatim from the `voice-call-architecture` skill; check `verified` before trusting details.

### What changed
- **New module:** `src/integrations/google_maps.py` (412 LOC) —
  `validate_address_bounded()` is the public entry point. Per-call
  `httpx.AsyncClient` (matching `xero.py` / `jobber.py` pattern, NOT a
  module-level singleton), 1.5s hard timeout (D-C1, dual-layer:
  socket-level `httpx.Timeout` + task-level `asyncio.wait_for`), never
  raises, always returns Voco-shaped dict with `verdict` key. Maps
  Google's `verdict.possibleNextAction` → Voco verdicts
  (`confirmed | confirmed_with_changes | unconfirmed | error | skipped | unsupported_region`)
  via `map_verdict`; maps `result.address.addressComponents` → 9-key
  Voco-normalized dict via `map_components` (D-D1).
- **Pre-check in `book_appointment.py`:** validate runs BEFORE
  `atomic_book_slot` (D-B2 — external HTTP outside slot-lock contention
  window). On `confirmed` / `confirmed_with_changes`, `service_address`
  is overwritten with Google's `formatted_address` (D-D3'). Booking
  never blocks on Google — every verdict path proceeds to the RPC.
  **`region_code` source (prod-readiness 2026-06 fix):** both
  `book_appointment.py` and `capture_lead.py` read
  `region_code = (deps.get("country") or "US").upper()`. `deps["country"]`
  is now populated in `agent.py` from `tenant.get("country", "US")`.
  Previously the `deps` literal omitted `"country"`, so EVERY non-US
  tenant validated against region "US" — a silent correctness bug fixed
  by adding the one `"country": country` key to the deps dict.
- **Pre-check in `capture_lead.py`:** symmetric validation pre-check
  (D-B4); same overwrite logic applied to inquiries via
  `record_outcome` 14-arg RPC overload.
- **Tool returns (D-E2):** Tool returns use TWO shapes — the success
  path uses a label form `BOOKED [verdict=...]: <directive>` /
  `LEAD CAPTURED [verdict=...]: <directive>` (battle-tested pre-Phase-61
  label convention extended with the verdict token), and the failure
  path uses the documented `STATE:... | DIRECTIVE:...` shape
  (e.g. `STATE:lead_capture_failed reason=db_error | DIRECTIVE:...`).
  Phase 61 (D-E2) extended the success label form with verdict tokens —
  `BOOKED [verdict=validated]:`, `BOOKED [verdict=validated_with_corrections]:`,
  `BOOKED [verdict=unvalidated]:` (and `LEAD CAPTURED` equivalents).
  The prompt CRITICAL RULE (`_build_address_validation_section`)
  matches via SUBSTRING on the verdict tokens, so both shapes work.
  Strings are NEVER spoken aloud; the agent reads them and decides how
  to phrase the readback.

  **Brittleness watch (WR-03 follow-up):** A future prompt revision
  that keys on the `STATE:` prefix or the `|` separator would silently
  drop the success paths. If you change how the prompt parses these
  returns, audit `book_appointment.py` and `capture_lead.py` success
  branches for symmetric updates.

  **Directives SHORTENED (2026-06-10 early-validation pass; fallback
  `validated` variants trimmed again 2026-06-12 P2):** each
  verdict has TWO variants keyed on whether the mid-call
  `validate_address` cache was reused (`used_cached_validation`). On the
  cached path the address was already confirmed mid-call, so the
  post-commit directive is ONE short sentence — day + time only, with an
  explicit "do not re-read it" for the address. **2026-06-12:** the
  fallback `validated` variants ALSO no longer re-read the address — the
  caller already heard it in the mandatory pre-booking readback (Call B
  40b13227 spoke one address ~5 times under the old directive); only
  `validated_with_corrections` still reads its corrected form (Google
  materially changed something the caller hasn't heard). Verdict tokens
  are unchanged (tests + the
  prompt rule key on them). Representative samples:
    - cached: `BOOKED [verdict=validated]: confirm day and time [...] in ONE short sentence; the address was already confirmed — do not re-read it; ask if anything else is needed`
    - fallback: `BOOKED [verdict=validated]: confirm day and time [...] in ONE short sentence; do not re-read the address — the caller already heard it in the readback; ask if anything else is needed`
    - fallback: `BOOKED [verdict=validated_with_corrections]: confirm day and time [...]; read corrected address [...] once and explicitly invite caller confirmation; ...`
    - `BOOKED [verdict=unvalidated]: confirm day and time [...] in ONE short sentence; relay address as caller spoke it only if it was never read back; do NOT claim "validated"...`
    - `LEAD CAPTURED` equivalents mirror the same cached/fallback split.
- **New CRITICAL RULE (D-E3):** `_build_address_validation_section(locale)`
  in `prompt.py` sits in the top-attention zone between
  `_build_corrections_section` and `_build_outcome_words_section` —
  alongside `outcome_words` / `corrections` / `call_duration`.
  Prohibits 6 verbatim phrases (`"validated"`, `"verified"`,
  `"confirmed against Google"`, `"found your address"`,
  `"looked up your address"`, `"matches our records"`) unless preceding
  tool return contained `verdict=validated` or
  `verdict=validated_with_corrections`. Spanish mirror present per
  Phase 60.3 D-B-03 locale-parity pattern (`VALIDACIÓN DE DIRECCIÓN —
  REGLA CRÍTICA`).

  **REWRITTEN 2026-06-10 for the early-validation flow:** the rule now
  teaches — caller finishes the address → ONE short filler → call
  `validate_address` in the same turn → speak the result ONCE in its
  final form per the four `STATE:address_*` branches → at most one
  correction loop → the address is never read aloud more than twice per
  call → booking does NOT re-read a validated address (the booking
  readback covers name + day/time; address included only if never
  validated mid-call — `_build_booking_section`'s BEFORE BOOKING —
  READBACK block was updated to match in both locales). Preserved
  invariants: 6 prohibited phrases, untranslated verdict tokens, section
  before tool_narration, NO silence license anywhere (Phase 61.1
  deadlock class), explicit caller-words readback license
  (the `address_noted` branch). Gating sentence now reads "After
  validate_address, book_appointment, or capture_lead returns…".

  **EXTENDED 2026-06-12 (findings.md P2):** the rule now also carries —
  (a) the `STATE:address_ok_confirm_postal` branch teaching (lookup-
  supplied postal asked as a QUESTION, digit by digit, never asserted;
  caller's answer wins); (b) a CALLER AUTHORITY block — the caller
  outranks the lookup, always: accept their correction immediately, never
  defend the old value or say where it came from, re-validate once with
  their pieces, and if validation still disagrees keep the caller's
  version as noted-not-validated (incident: call 31559053 defended a
  Google-inferred postal against the caller); (c) an unconditional
  never-speak list for internal-machinery phrases ("the address
  validation", "from the validation", "our system shows"). All prior
  invariants preserved; `tests/test_prompt_address_validation_rule.py`
  still green unmodified.
- **Tool descriptions rewritten (D-E1):** `book_appointment` +
  `capture_lead` descriptions encode the validation precondition as
  outcome-framed prompt-surface language. Gemini 3.1 Flash Live reads
  tool descriptions during function-call decisions — the description
  tells Gemini "consult the verdict in my return value before speaking"
  without prescribing exact wording.
- **Telemetry:** every validate writes one row to `gmaps_validate_events`
  (new sibling table — D-C2' overrides CONTEXT D-C2 because
  `usage_events` schema is call-billing-PK and cannot hold per-validate
  rows). Sentry only on `verdict='error'` (D-A3 + D-C3) — unsupported
  region and skipped paths never page.

### Env var
- `GOOGLE_MAPS_API_KEY` on Railway only (D-G1). Restricted to
  "Address Validation API" via Cloud Console API restrictions (NOT
  IP restrictions — D-G2; Railway egress IPs rotate). Module returns
  `verdict='skipped'` if env var missing — graceful degradation.

### Files
| File | Role |
|------|------|
| `src/integrations/google_maps.py` | API client + verdict mapper + components mapper (Plan 02) |
| `src/lib/booking.py` | `atomic_book_slot` wrapper extended with 6 new kwargs (Plan 03) |
| `src/lib/write_outcome.py` | `record_outcome` wrapper extended with 6 new kwargs (Plan 03) |
| `src/tools/book_appointment.py` | Validation pre-check + D-E1 description + D-E2 returns (Plans 03+04) |
| `src/tools/capture_lead.py` | Symmetric pre-check + D-E1 description + D-E2 returns (Plans 03+04) |
| `src/prompt.py` | `_build_address_validation_section` EN+ES (D-E3, Plan 04) |

### Anti-hallucination invariants locked at the test layer
- `tests/test_prompt_address_validation_rule.py` — EN+ES presence +
  position (before tool_narration) + 6 prohibited phrases + verdict
  tokens (Plan 04)
- `tests/test_tool_descriptions_validation_precondition.py` — D-E1
  outcome-framed wording in both tool specs (Plan 04)
- `tests/test_book_appointment_validation.py` — D-D3' overwrite + D-E2
  return shapes (10 tests, Plan 03)
- `tests/test_capture_lead_validation.py` — D-B4 symmetry (8 tests,
  Plan 03)
- `tests/test_google_maps.py` — verdict + components mappers, HTTP
  error paths, Sentry gate, telemetry shape (20 tests, Plan 02)
- `tests/test_no_generate_reply_in_src.py` — Phase 63.1 regression
  guard preserved

---

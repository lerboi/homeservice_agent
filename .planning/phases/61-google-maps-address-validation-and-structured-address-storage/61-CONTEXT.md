# Phase 61: Google Maps address validation + structured address storage — Context (seed)

**Seeded:** 2026-04-19 (pre-discuss)
**Status:** Awaiting `/gsd:discuss-phase 61`

This file is the seed context for Phase 61. It captures the user's intent, the current address-handling surface in both repos, the new integration's shape, and the open decisions that `/gsd:discuss-phase` must resolve. Decisions land in this same file (as `D-XX:` bullets) during discuss.

---

## Phase boundary

Add Google Maps Platform validation to the booking path so caller-spoken addresses are normalized in the background before they are stored. Produces:
- New integration module in `livekit_agent/src/integrations/` (and optionally a thin Next.js-side reader)
- New tool OR pre-check inside `book_appointment` (picked in discuss)
- DB migration adding normalized-address columns to `appointments` and `leads`
- Env vars + key-restriction guidance
- Observability (Sentry on validation failure, cost-control logging)

Out of scope: anything the validator does *not* need — no autocomplete, no static maps, no route/directions APIs. Travel-buffer improvements using the new lat/lng are a **future** phase (noted as secondary benefit, not delivered here).

---

## User intent (2026-04-19)

> "I want to improve the current address collection method to match the below:
> Voice-to-Data Intake — How it works: The AI asks, 'What's the address where you need the service?', then it gets the necessary minimum fields it needs to then validate it against Google Maps API in the background, and once it's confirmed and the successfully booked, add it directly to the CRM (and the connected Jobber)."

Two parts to this:
1. **Validate in background, then store structured data in the CRM** — Phase 61 (this phase).
2. **Push to connected Jobber** — Phase 62.

Phase 60 delivers the "AI asks one natural question" conversational framing. Phase 61 adds the technical validation layer behind it.

---

## Current state of address handling (confirmed via code read)

### In the LiveKit agent (Railway)
- `src/tools/book_appointment.py:179-190` takes three strings from the model: `street_name`, `postal_code`, `caller_name`, optional `unit_number` / `urgency`.
- Lines 188-190: joins `[street_name, unit_number, postal_code]` with `", "` into `service_address`.
- Passes `service_address`, `postal_code`, `street_name` to `atomic_book_slot()` via RPC `book_appointment_atomic`.
- **No validation, no geocoding, no place_id.** Whatever Gemini transcribed lands in the DB verbatim.
- `src/tools/capture_lead.py` has the same three-field intake pattern for the decline path.

### DB schema (migrations 003, 004, 026)
- `appointments` and `leads` both have: `service_address text` (NOT NULL on appointments), `postal_code text`, `street_name text`.
- Migration `026_address_fields.sql` added `postal_code` + `street_name` to both tables; `service_address` kept as the combined field for backward compatibility.
- `book_appointment_atomic` RPC signature already accepts `p_service_address`, `p_postal_code`, `p_street_name`.
- No lat/lng, no place_id, no structured-components column yet.
- `service_zones.postal_codes` (text[]) is the current travel-buffer-zone matcher — postal-code-based, geographically naive.

### In Next.js / dashboard
- Calendar flyout renders `service_address` as a single string.
- SMS templates interpolate `service_address` directly.
- Jobber read-side does not yet depend on structured address (Phase 56 reads from Jobber, not writes).

---

## Validation API selection — the core discuss question

Three GMP APIs are candidates; discuss must pick **one** as primary and optionally one as fallback.

| API | Pros | Cons |
|---|---|---|
| **Address Validation API** | Purpose-built for this use case; returns `formattedAddress`, `placeId`, `addressComponents`, USPS verdicts (US), confirmation level, has-unconfirmed-components flag | Limited country coverage (check SG support); not free-tier; paid per-request |
| **Places API (Place Details / Autocomplete)** | Broader country coverage; can produce `place_id` + `geometry.location`; can autocomplete | Not designed for validation; no verdict semantics; heavier payloads |
| **Geocoding API** | Works globally; cheaper | No structured validation verdicts; coarser normalization; worse for apartment/unit resolution |

**Operating hypothesis (to confirm in discuss):** Address Validation API as primary for US/CA, Geocoding API as fallback for SG if Address Validation has gaps. Do **not** use Autocomplete — this is a post-utterance validation, not an interactive search.

### Country coverage reality check needed in discuss
Voco tenants today are predominantly US/CA and SG (per Phase 27 / tenant.country). Discuss should confirm Address Validation API country support for SG; if unsupported, SG falls back to Geocoding or to the existing verbatim-store behavior (feature-flagged).

---

## New DB columns (proposal — confirm in discuss)

Migration adds to both `appointments` and `leads`:

| Column | Type | Notes |
|---|---|---|
| `formatted_address` | text NULLABLE | Google-normalized single-line address |
| `place_id` | text NULLABLE | Stable Google place identifier for dedup + later Places lookups |
| `latitude` | numeric(10,7) NULLABLE | For future travel-buffer improvements |
| `longitude` | numeric(10,7) NULLABLE | For future travel-buffer improvements |
| `address_components` | jsonb NULLABLE | Structured parts (street_number, route, locality, admin_area, postal_code, subpremise) for Jobber push in Phase 62 |
| `address_validation_verdict` | text NULLABLE | `confirmed` / `confirmed_with_changes` / `unconfirmed` / `skipped` / `error` — audit trail for owner review |

`service_address`, `postal_code`, `street_name` stay (backward compat with calendar flyout, SMS, Jobber read-side, existing queries). The structured columns are additive and nullable so existing rows are unaffected.

---

## Where validation fires — the second core discuss question

Three options:

### Option A — New `validate_address` tool called by the agent before `book_appointment`
- Agent gathers address fields, fires `validate_address`, receives structured result, reads back the normalized address to caller, then fires `book_appointment` with validated fields.
- Pros: explicit, observable in tool_call_log, caller hears the normalized version before booking, consistent with existing tool pattern.
- Cons: one more tool turn, one more filler phrase, slight added latency (~200-500ms for the API call).

### Option B — Pre-validation inside `book_appointment`
- Agent passes raw fields to `book_appointment` as today; tool validates first, fails fast on unconfirmable addresses, calls the booking RPC with validated fields.
- Pros: no prompt changes, no new tool filler.
- Cons: hides the step (caller doesn't hear the normalized version before commit); tool now has two reasons to fail (validation or slot lock) — harder to message back.

### Option C — Hybrid: pre-validation inside `book_appointment`, with the returned `formatted_address` read back in the success/slot_taken message
- Validate inside the tool, but shape the return string so the AI reads back the Google-normalized address to the caller as part of the confirmation.
- Pros: one tool turn, caller still hears the normalized version, observability preserved.
- Cons: the booking tool now has more responsibility; description string grows.

**Operating hypothesis:** Option A (new tool). Matches the clean separation of Phase 56's `check_customer_account`. Let discuss re-examine.

---

## Environment + cost controls

- New env var: `GOOGLE_MAPS_API_KEY` (both Railway + Vercel).
- Key restrictions: restrict by IP to Railway egress + Vercel serverless (both rotate — may need to use API restrictions by enabled-API instead).
- Cost: Address Validation API is billed per request. With ~N bookings/month per tenant, cost is predictable but not negligible. Log usage to stdout (Sentry context) for the first month.
- Rate limiting: discuss may add a simple in-memory token bucket per-tenant to prevent misfire loops.
- Failure mode: on API error or network timeout (>2s), book with unvalidated fields and set `address_validation_verdict='error'`; do **not** block the booking.

---

## Known open questions for discuss

- API choice: Address Validation API confirmed for all Voco tenant countries? If not, what's the fallback matrix?
- Tool placement: Option A (new tool) vs. Option B (inside book_appointment) vs. Option C (hybrid). Caller-UX implication: does the caller hear "45 Main Street, Apartment 4B, San Francisco CA 94103" read back before booking, or only after?
- If validation returns `confirmed_with_changes`, does the AI read back the corrected version and get caller confirmation, or auto-accept? (Proposal: read back and confirm, to respect caller agency.)
- If validation fails (API error, address unconfirmable), does the AI proceed with unvalidated fields + Sentry flag, or fall back to a longer three-part intake? (Proposal: proceed with unvalidated fields + dashboard warning badge + Sentry flag.)
- Which `address_components` shape gets stored — raw Google response subset, or a Voco-normalized JSON shape? (Phase 62's Jobber push needs specific keys; shape choice affects both.)
- Does SG postal code coverage in Address Validation meet Voco's needs, or should SG path use Geocoding API?
- Is there a privacy concern with sending caller-spoken addresses to Google? (Phase 56/57 already store addresses; this is additive.)
- Does the dashboard calendar flyout need a "validated address" pill, or is backend-only sufficient for this phase?

---

## Files expected to change

**Agent repo (livekit_agent, Railway):**
- `src/integrations/google_maps.py` — new client module (OAuth not needed; API key only)
- `src/tools/validate_address.py` OR edits to `src/tools/book_appointment.py` — validation integration
- `src/tools/__init__.py` — register new tool (if Option A)
- `src/tools/capture_lead.py` — mirror the validated-field plumbing if applicable (non-blocking)
- `src/lib/booking.py` / RPC signature — pass new fields through to DB
- `pyproject.toml` — add `googlemaps` SDK or `httpx` usage
- Tests: `tests/test_address_validation.py`

**Main repo (homeservice_agent, Vercel):**
- `supabase/migrations/NNN_address_validation.sql` — new columns
- `book_appointment_atomic` RPC update to accept + persist new columns
- `.env.example` + `.planning/intel/*` env list
- Possibly dashboard surface updates if the validated-address badge is in scope
- `.claude/skills/auth-database-multitenancy/SKILL.md` — new columns + migration entry
- `.claude/skills/voice-call-architecture/SKILL.md` — new tool / updated booking flow

---

## Validation approach (sketch)

- Unit tests for the GMaps client with recorded fixture responses (confirmed, confirmed_with_changes, unconfirmed, error).
- Integration test: end-to-end booking with a known-good address; assert all new columns populated; assert `verdict='confirmed'`.
- Live test call on Railway: cultural address, SG HDB address with block/unit, US apartment address — all produce correct normalized forms.
- Cost dashboard: verify GMP usage lands in the expected quota bucket.

---

## Related context

- Phase 60 (predecessor) — conversational framing that makes the single-question intake natural.
- Phase 62 (successor) — Jobber push that uses the structured address produced here.
- Phase 3 (existing) — travel-buffer / service zones; lat/lng stored here enables a future geographic-zone upgrade.
- Phase 56 (shipped) — Jobber read-side integration; Jobber Client records have structured address fields which is why Phase 62 benefits from Phase 61 running first.

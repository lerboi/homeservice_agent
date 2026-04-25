# Phase 61: Google Maps Address Validation + Structured Address Storage — Research

**Researched:** 2026-04-25
**Domain:** External REST integration (Google Maps Address Validation API) + Postgres migration + Python livekit-agent tool surface + Gemini 3.1 Flash Live tool-description / tool-return shape
**Confidence:** HIGH on existing-code surfaces and SDK pinning; MEDIUM on Address Validation response shape (Google docs are incomplete on the component structure for non-US cases); MEDIUM on Gemini tool-description char limit (no authoritative number found)

## Summary

This phase adds a single `httpx`-driven Google Maps Address Validation pre-check inside the existing `book_appointment` and `capture_lead` tools, persists Voco-normalized structured-address columns on `appointments` + `leads`, extends `book_appointment_atomic` RPC with new defaulted params, and rewrites tool descriptions + tool returns to enforce a new "validated" truth-class anti-hallucination rule. The Address Validation API endpoint is `POST https://addressvalidation.googleapis.com/v1:validateAddress?key={KEY}` with body `{address: {regionCode, addressLines[], postalCode, locality, ...}}`, and the canonical decision field is `result.verdict.possibleNextAction` (enum: `ACCEPT`, `CONFIRM`, `CONFIRM_ADD_SUBPREMISES`, `FIX`).

The migration number is `062` (latest is `061_drop_legacy_leads.sql`). Both `xero.py` and `jobber.py` are the canonical pattern reference: `httpx.AsyncClient` per-call (NOT module-level), explicit timeout, telemetry write via `asyncio.gather` after the http context, Sentry capture with `tags={tenant_id, phone_hash, phase, component}`, never-raises wrapper at the public entry point. The `usage_events` table is currently a 3-column idempotency table (`call_id PK, tenant_id, created_at`) and CANNOT hold the per-validate audit row D-C2 specifies — the planner must add a sibling table or extend `usage_events` (researcher recommends a new `gmaps_validate_events` table to keep the call-billing idempotency surface clean; flagged for discuss).

`book_appointment_atomic` last touched in migration `026_address_fields.sql` and locked-down in `027_lock_rpc_functions.sql`. Extending it requires a `DROP FUNCTION` overload-loop + `CREATE OR REPLACE FUNCTION` + a new `REVOKE/GRANT` for the new signature (Postgres treats different signatures as different functions; the existing GRANT on the 11-arg form silently does not cover the 17-arg form). Pattern verbatim from `026_address_fields.sql` lines 13-25.

**Primary recommendation:** Build `livekit_agent/src/integrations/google_maps.py` as a near-clone of `xero.py`'s structure (per-call `httpx.AsyncClient(timeout=1.5)`, never-raises `validate_address_bounded`, Sentry on exception only, `asyncio.gather`'d telemetry after the http context). Map `verdict.possibleNextAction` directly to Voco's 6-state enum: `ACCEPT → confirmed`, `CONFIRM → confirmed_with_changes`, `CONFIRM_ADD_SUBPREMISES → confirmed_with_changes` (collapse — Voco doesn't probe for unit), `FIX → unconfirmed`, missing/exception → `error`, region-not-supported → `unsupported_region`, no-key/timeout → `error` or `skipped` per code path. Extend `book_appointment_atomic` with 6 new defaulted params (matching D-F1). Migration is `062_phase61_address_validation.sql`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**API selection:**
- **D-A1:** Address Validation API only. Single API surface for all countries. No Geocoding or Places fallback. Returns `formattedAddress`, `placeId`, `addressComponents`, `geocode.location.{latitude,longitude}`, `verdict.{addressComplete,hasUnconfirmedComponents,hasInferredComponents,validationGranularity}`, USPS verdicts on US.
- **D-A2:** SG uses the same path as US/CA. No SG-specific branch. HDB block-unit quirks are absorbed by the verdict rules — they may surface more often as `confirmed_with_changes` or `unconfirmed`, which the agent handles by inviting caller confirmation.
- **D-A3:** Unsupported region degrades silently. `address_validation_verdict='unsupported_region'`, no Sentry alert. Learn about coverage gaps from `usage_events` aggregations.

**Tool placement + caller UX (Option C hybrid):**
- **D-B1:** Validation runs as a pre-check inside `book_appointment` and `capture_lead`. No new `validate_address` agent tool.
- **D-B2:** Validate first, then atomic slot-lock. External HTTP latency must not be held inside the slot-lock contention window.
- **D-B3:** Verdict-driven readback shape: `confirmed` → reads back as fact; `confirmed_with_changes` → reads back + invites confirmation; `unconfirmed`/`error`/`skipped`/`unsupported_region` → reads back caller's words, must NOT claim "validated".
- **D-B4:** `capture_lead` validates symmetrically.

**Verdicts, failure modes, cost controls:**
- **D-C1:** 1.5s `httpx` timeout, fail-soft. On timeout/network/quota error: log to Sentry, set `verdict='error'`, proceed to `atomic_book_slot()` with agent-joined fields. Booking never blocks on Google.
- **D-C2:** No rate limiter in Phase 61. Observability-only: every validation attempt writes one row to `usage_events` (`event_type='gmaps_validate'`, with verdict, latency_ms, cost_micro_cents) — mirroring Phase 53 pattern.
- **D-C3:** Sentry only on verdict ∈ {`error`}. `unsupported_region` does not page. Successful verdicts go to `usage_events` only.

**Storage shape + backward compat:**
- **D-D1:** Voco-normalized `address_components` JSON shape with named keys: `{street_number, route, subpremise, locality, admin_area_level_1, admin_area_level_2, postal_code, country, country_code}`. Mapper absorbs API changes. Raw Google response NOT stored.
- **D-D2:** Backend-only this phase. No dashboard surface.
- **D-D3:** `service_address` is overwritten with `formatted_address` on `confirmed` or `confirmed_with_changes`. On other verdicts: `service_address` stores the agent-joined string (existing behavior).

**Prompt + tool-surface constraints (Gemini 3.1 Flash Live + LiveKit 1.5.6):**
- **D-E1:** Tool descriptions encode the validation precondition.
- **D-E2:** Tool returns are state + directive, not speakable English. Per-verdict shapes:
  - `confirmed` → `BOOKED [verdict=validated]: relay normalized address [{formatted_address}] and time [{slot}] as confirmed; ask if anything else is needed`
  - `confirmed_with_changes` → `BOOKED [verdict=validated_with_corrections]: relay normalized address [{formatted_address}] as the final form, explicitly invite caller confirmation before closing; if caller corrects, accept correction and re-read full address`
  - `unconfirmed`/`error`/`skipped`/`unsupported_region` → `BOOKED [verdict=unvalidated]: relay address as caller spoke it; do NOT claim "validated", "confirmed against records", or "looked up your address"`
- **D-E3:** New CRITICAL RULE for the "validated" truth-class, hoisted near the top of the prompt. Co-located with the existing anti-hallucination block. Spanish mirror lands in the same pass.
- **D-E4:** Cross-reference current Gemini 3.1 Flash Live + LiveKit 1.5.6 docs.

**Database migration:**
- **D-F1:** Columns added to both `appointments` and `leads` (additive, all NULLABLE):
  | Column | Type |
  |---|---|
  | `formatted_address` | `text` |
  | `place_id` | `text` (indexed) |
  | `latitude` | `numeric(10,7)` |
  | `longitude` | `numeric(10,7)` |
  | `address_components` | `jsonb` |
  | `address_validation_verdict` | `text` (CHECK enum) |
- **D-F2:** `book_appointment_atomic` RPC signature extended; existing callers continue to work via NULL defaults.
- **D-F3:** `service_address`, `postal_code`, `street_name` stay for backward compat. No data migration for historical rows.

**Environment + ops:**
- **D-G1:** Single new env var `GOOGLE_MAPS_API_KEY`. Required on Railway only. Not on Vercel.
- **D-G2:** API key restriction by API enabled-list, not by IP.
- **D-G3:** Pre-requisite user actions: create GCP project, enable Address Validation API, create restricted key, fund billing, set Railway env var.

### Claude's Discretion
- Exact `httpx` retry policy (probably no retry inside the 1.5s budget — single attempt).
- Whether `google_maps.py` uses official `googlemaps` Python SDK or hand-rolled `httpx`. Lean toward `httpx` for consistency with `xero.py`/`jobber.py`.
- Exact wording of the new CRITICAL RULE (D-E3).
- Test fixture choices for `tests/test_address_validation.py`.
- Whether the migration is one file or split (lean toward one).

### Deferred Ideas (OUT OF SCOPE)
- Per-tenant rate limiting / hard cap.
- Dashboard "validated" pill / verdict badge / click-to-Google-Maps.
- Travel-buffer zone matching using `lat`/`lng`.
- `validate_address` standalone agent tool.
- Geocoding API or Places API integration.
- Storing raw Google `addressComponents` array alongside Voco-normalized shape.
- Privacy / DPA review of sending caller-spoken addresses to Google.
</user_constraints>

## Project Constraints (from CLAUDE.md)

- **Brand name is Voco** — code identifiers, log markers, and string literals must use "Voco". Fallback email domains use `voco.live`.
- **Skill update at phase tail (mandatory):** any change to systems covered by a skill requires reading the skill BEFORE the change and updating the skill AFTER. Phase 61 must update three skills:
  - `voice-call-architecture` (new validation step in `book_appointment` / `capture_lead`, new prompt rule D-E3, new tool-return shapes D-E2)
  - `auth-database-multitenancy` (new migration `062`, new columns on `appointments` + `leads`, updated RPC signature)
  - `integrations-jobber-xero` (note that the Voco-normalized `address_components` shape D-D1 is what Phase 62 Jobber push will read; cross-link)
- **Migration table count documented in CLAUDE.md is "58"** — this is stale (latest on disk is `061_drop_legacy_leads.sql`). Plan should update the CLAUDE.md migration count to "62" at phase tail.
- **Tech stack pin:** Twilio SIP + LiveKit + Gemini 3.1 Flash Live (Python agent on Railway). Phase 61 changes the LiveKit agent codebase (sibling repo at `C:/Users/leheh/.Projects/livekit-agent/`), not the Next.js codebase.

## Phase Requirements

This phase has no REQ-ID-mapped requirements (CLAUDE.md → REQUIREMENTS.md does not contain any AVAL-/GMAPS-/ADDR-prefixed requirement IDs). The decision contract is CONTEXT.md's `D-A1` through `D-G3` verbatim, captured in `## User Constraints` above.

## Standard Stack

### Core (already pinned in livekit-agent/pyproject.toml)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `livekit-agents` | `1.5.6` | Realtime agent framework | [VERIFIED: livekit-agent/pyproject.toml line 9] Phase 63 mainline pin; Gemini 3.1 routing via PR #5413 |
| `livekit-plugins-google` | `1.5.6` | Gemini Realtime model adapter | [VERIFIED: pyproject.toml line 10] Mainline 2026-04-22 release |
| `sentry-sdk` | `>=2.0,<3` | Error capture | [VERIFIED: pyproject.toml line 22] Already initialized in `agent.py` lines 24-30 |
| `httpx` | (transitive via livekit-agents/openai/supabase) | HTTP client | [VERIFIED: imported by `xero.py` line 34 and `jobber.py` line 33] Used at runtime; not pinned as direct dep but functionally available. Plan should add `httpx>=0.27,<1` to `[project] dependencies` for explicitness. [ASSUMED: transitive dep is stable across pinned ecosystem] |
| `phonenumbers` | `>=9.0,<10` | E.164 normalization | [VERIFIED: pyproject.toml line 26] Used by `jobber.py`; not needed by `google_maps.py` (no phone parsing) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none required) | — | Address Validation client | The `googlemaps` Python SDK (`pip install googlemaps`) DOES support the Address Validation API surface as of v4.10.0+ [CITED: pypi.org/project/googlemaps], BUT introduces a sync-only client (no asyncio support — would require `asyncio.to_thread` wrapping) and adds ~1.5MB of unrelated dependencies (numpy etc). **Researcher recommends hand-rolled `httpx`** to match `xero.py`/`jobber.py` exactly. CONTEXT D-Discretion already leans this way. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled httpx | `googlemaps` Python SDK | Sync-only API forces extra wrapping; bigger dep tree; worse pattern consistency. Reject. |
| Per-call `httpx.AsyncClient` | Module-level singleton client | Pattern in `xero.py`/`jobber.py` is per-call; reusing avoids connection-pool surprises in the LiveKit job lifecycle. Match the pattern. |
| New `gmaps_validate_events` table | Extend `usage_events` with new columns | `usage_events` is currently `(call_id PK, tenant_id, created_at)` — adding `event_type`, `verdict`, `latency_ms`, `cost_micro_cents` would break the `call_id PK` invariant (one validate-call ≠ one phone-call; multiple validates per call). **Researcher recommends new sibling table** named `gmaps_validate_events` with columns `(id uuid PK, tenant_id, call_id, verdict, latency_ms, cost_micro_cents, region_code, created_at)`. CONTEXT D-C2 says "writes one row to `usage_events`" — this is a CONTEXT misread of the existing schema; flag for planner to confirm with user. |

**Installation (planner adds to `livekit-agent/pyproject.toml`):**
```toml
"httpx>=0.27,<1",  # promote from optional dev dep to direct runtime dep
```

**Version verification:**
- `livekit-agents==1.5.6` [VERIFIED: pyproject.toml line 9, 2026-04-22 release per Phase 63 RESEARCH]
- `googlemaps` 5.x is the latest on PyPI [CITED: pypi.org/project/googlemaps] — moot since we're hand-rolling.

## Architecture Patterns

### Recommended Project Structure (delta against current livekit-agent layout)
```
livekit-agent/
├── src/
│   ├── integrations/
│   │   ├── xero.py         # existing — pattern reference
│   │   ├── jobber.py       # existing — pattern reference
│   │   └── google_maps.py  # NEW: Phase 61
│   ├── tools/
│   │   ├── book_appointment.py  # MODIFIED: validation pre-check
│   │   └── capture_lead.py      # MODIFIED: validation pre-check (symmetric)
│   ├── lib/
│   │   ├── booking.py           # MODIFIED: atomic_book_slot signature extended
│   │   └── write_outcome.py     # MODIFIED (probably): record_outcome accepts new fields for capture_lead
│   └── prompt.py               # MODIFIED: D-E3 anti-hallucination rule (EN+ES)
└── tests/
    ├── test_google_maps.py        # NEW: client + verdict + components mapper
    ├── test_book_appointment_validation.py  # NEW: per-verdict integration
    └── test_capture_lead_validation.py      # NEW: per-verdict integration

supabase/migrations/
└── 062_phase61_address_validation.sql   # NEW: columns + RPC extension + (sibling table for telemetry — see Open Questions)
```

### Pattern 1: External-API client module (canonical Voco shape)
**What:** A `livekit_agent/src/integrations/<provider>.py` exposes a public `fetch_*_bounded(...)` async function that NEVER raises and uses Sentry for error capture.
**When to use:** Every external HTTP integration on the LiveKit hot path.
**Skeleton (verbatim from `xero.py` adapted for Google Maps):**

```python
# Source: livekit-agent/src/integrations/xero.py lines 41-47, 374-379, 468-521
import asyncio
import hashlib
import logging
import os
import time
from datetime import datetime, timezone
from typing import Optional

import httpx
import sentry_sdk

logger = logging.getLogger(__name__)

GMAPS_VALIDATE_URL = "https://addressvalidation.googleapis.com/v1:validateAddress"
HTTP_TIMEOUT_SECONDS = 1.5  # D-C1: hard 1.5s ceiling
SUPPORTED_REGION_CODES = {"US", "CA", "SG"}  # D-A2 — observe via usage_events aggregation


async def validate_address(
    *,
    region_code: str,
    address_lines: list[str],
    postal_code: Optional[str] = None,
    locality: Optional[str] = None,
) -> dict:
    """Returns Voco-shaped verdict dict. Never raises.

    Shape (always populated):
      {
        "verdict": <one of: confirmed | confirmed_with_changes | unconfirmed |
                            error | skipped | unsupported_region>,
        "formatted_address": str | None,
        "place_id": str | None,
        "latitude": float | None,
        "longitude": float | None,
        "address_components": dict,    # Voco-normalized; see _map_components
        "latency_ms": int,
        "raw_status": int | None,      # for telemetry only — not stored on row
      }
    """
    # ... (planner fleshes out per shape below)


async def validate_address_bounded(
    tenant_id: str,
    call_id: str,
    *,
    region_code: str,
    address_lines: list[str],
    postal_code: Optional[str] = None,
    locality: Optional[str] = None,
    timeout_seconds: float = HTTP_TIMEOUT_SECONDS,
) -> dict:
    """Outer wrapper: bounded latency + Sentry on error verdict. Never raises.

    Mirrors fetch_xero_context_bounded (xero.py lines 468-521).
    Always returns a dict — caller can read result['verdict'] unconditionally.
    On asyncio.TimeoutError / unhandled exception: returns {'verdict': 'error', ...}.
    """
```

### Pattern 2: Verdict-mapping (D-A1 → Voco 6-state enum)
**What:** Translate Google's `result.verdict.possibleNextAction` enum to Voco's domain.
**When to use:** Inside `validate_address`'s response-handling branch.
**Mapping (researcher-pinned, MUST match planner's eventual code):**

```python
# Sources:
#   developers.google.com/maps/documentation/address-validation/build-validation-logic
#   developers.google.com/maps/documentation/address-validation/handle-api-responses
#
# Google's possibleNextAction enum (verified from build-validation-logic page):
#   ACCEPT                     → confirmed
#   CONFIRM                    → confirmed_with_changes
#   CONFIRM_ADD_SUBPREMISES    → confirmed_with_changes
#       (collapse — Voco D-B1 doesn't probe for unit numbers; SG HDB cases
#        commonly land here when subpremise is missing; agent reads back what
#        was found and invites confirmation per D-B3 confirmed_with_changes path)
#   FIX                        → unconfirmed
#   <missing or unknown>       → unconfirmed (defensive)
#
# Out-of-band states (HTTP-level):
#   400 with INVALID_ARGUMENT regionCode unsupported  → unsupported_region
#   401/403/404/429/5xx                               → error
#   asyncio.TimeoutError                              → error
#   GOOGLE_MAPS_API_KEY missing                       → skipped
def map_verdict(google_response: dict) -> str:
    verdict = google_response.get("result", {}).get("verdict", {})
    action = verdict.get("possibleNextAction", "FIX")
    return {
        "ACCEPT": "confirmed",
        "CONFIRM": "confirmed_with_changes",
        "CONFIRM_ADD_SUBPREMISES": "confirmed_with_changes",
        "FIX": "unconfirmed",
    }.get(action, "unconfirmed")
```

**Why this mapping (not the addressComplete + hasUnconfirmedComponents heuristic CONTEXT.md suggests):**
- `possibleNextAction` is Google's official decision field [VERIFIED: developers.google.com/maps/documentation/address-validation/build-validation-logic — quoted decision tree pseudocode]. It already encodes the right composition of `validationGranularity`, confirmation levels, USPS DPV, missing components, and inferred/replaced flags.
- Hand-rolling the heuristic from individual flag combinations (CONTEXT.md's suggested "addressComplete=true && hasUnconfirmedComponents=false → confirmed" rule) re-implements what Google already computed and risks drift across API versions.
- The plan should treat the heuristic CONTEXT.md sketches as a **fallback only** for responses missing `possibleNextAction` (defensive coding).

### Pattern 3: Voco-normalized address_components mapper (D-D1)
**What:** Convert Google's flat `result.address.addressComponents[]` array into Voco's named-key dict.
**When to use:** Inside `validate_address` after a successful response.

```python
# Source: API reference references Places service component types table
#   developers.google.com/places/web-service/supported_types#table2 [CITED]
#   Quoted Suite/subpremise example: blog.afi.io/blog/fix-bad-addresses (sample response)
#
# componentType strings Google returns (PINNED based on Places table 2 +
# Address Validation observed responses):
#   "street_number", "route", "subpremise",
#   "locality", "sublocality", "sublocality_level_1",
#   "administrative_area_level_1", "administrative_area_level_2",
#   "postal_code", "postal_code_suffix",
#   "country"
#
# Voco-normalized output shape (D-D1 verbatim):
def map_components(addr: dict) -> dict:
    """addr = google_response['result']['address'] (or {})."""
    components = {c["componentType"]: c["componentName"]["text"]
                  for c in addr.get("addressComponents", [])
                  if c.get("componentName", {}).get("text")}
    return {
        "street_number": components.get("street_number"),
        "route": components.get("route"),
        "subpremise": components.get("subpremise"),
        # locality may be absent on SG addresses — fall back to sublocality
        "locality": components.get("locality") or components.get("sublocality") or components.get("sublocality_level_1"),
        "admin_area_level_1": components.get("administrative_area_level_1"),
        "admin_area_level_2": components.get("administrative_area_level_2"),
        "postal_code": components.get("postal_code"),
        # country full name (e.g. "Singapore")
        "country": components.get("country"),
        # ISO short code (e.g. "SG") — pulled from postalAddress.regionCode,
        # NOT from addressComponents (Google doesn't expose short_name like the
        # Geocoding API does).
        "country_code": (addr.get("postalAddress") or {}).get("regionCode"),
    }
```

**SG HDB-specific note** [ASSUMED — based on Google's stated SG support + general subpremise behavior]:
- HDB addresses like "Block 123 Ang Mo Kio Avenue 6 #08-456, Singapore 560123" typically split as:
  - `street_number` = "123"
  - `route` = "Ang Mo Kio Avenue 6"
  - `subpremise` = "08-456" (or absent — Google may put unit in `formattedAddress` only)
  - `postal_code` = "560123"
  - `country` = "Singapore", `country_code` = "SG"
- D-A2 explicitly accepts variable SG coverage; the agent invites caller confirmation when `verdict ∈ {confirmed_with_changes, unconfirmed}`. The mapper does NOT need SG-specific branching.

### Pattern 4: book_appointment_atomic RPC extension (D-F2)
**What:** Add 6 new defaulted-NULL params to the RPC. Existing callers (current `atomic_book_slot` Python wrapper at `livekit-agent/src/lib/booking.py`) keep working; new caller passes the new fields.
**When to use:** Phase 61 migration `062`.

```sql
-- Source: supabase/migrations/026_address_fields.sql lines 13-25 (overload-loop drop)
-- Source: supabase/migrations/027_lock_rpc_functions.sql lines 14-15 (REVOKE/GRANT)
--
-- Postgres treats the 11-arg signature and the 17-arg signature as DIFFERENT
-- functions. The 026 DO-block-with-DROP-LOOP idiom is the safe way to evict
-- all overloads before recreating. After CREATE, REVOKE/GRANT must reference
-- the NEW signature (the old GRANT does not transfer to the new arg count).

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT oid::regprocedure AS func_sig
    FROM pg_proc
    WHERE proname = 'book_appointment_atomic'
      AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_sig;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION book_appointment_atomic(
  p_tenant_id      uuid,
  p_call_id        uuid,
  p_start_time     timestamptz,
  p_end_time       timestamptz,
  p_service_address text,
  p_caller_name    text,
  p_caller_phone   text,
  p_urgency        text,
  p_zone_id        uuid DEFAULT NULL,
  p_postal_code    text DEFAULT NULL,
  p_street_name    text DEFAULT NULL,
  -- Phase 61 NEW (all NULLABLE for backward compat — old callers omit):
  p_formatted_address           text         DEFAULT NULL,
  p_place_id                    text         DEFAULT NULL,
  p_latitude                    numeric(10,7) DEFAULT NULL,
  p_longitude                   numeric(10,7) DEFAULT NULL,
  p_address_components          jsonb        DEFAULT NULL,
  p_address_validation_verdict  text         DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
-- ... body inserts the new columns alongside the existing INSERT
$$;

-- Lock down the NEW signature (17 args):
REVOKE EXECUTE ON FUNCTION public.book_appointment_atomic(
  uuid, uuid, timestamptz, timestamptz, text, text, text, text, uuid, text, text,
  text, text, numeric, numeric, jsonb, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_appointment_atomic(
  uuid, uuid, timestamptz, timestamptz, text, text, text, text, uuid, text, text,
  text, text, numeric, numeric, jsonb, text
) TO service_role;
```

**Verified safe:** The Python wrapper `atomic_book_slot` at `livekit-agent/src/lib/booking.py` calls the RPC with 11 named params (`p_tenant_id` through `p_street_name`). After this migration, the same call still works because Postgres applies DEFAULT NULL to the 6 new params. The book_appointment.py code MUST be updated in this phase to pass the new params after a successful validation.

### Anti-Patterns to Avoid
- **Hand-rolling the verdict heuristic from raw flag combinations.** Use `verdict.possibleNextAction`. Google maintains the heuristic; we maintain the mapping table. CONTEXT.md's suggested "addressComplete && !hasUnconfirmedComponents" sketch is well-meaning but re-implements Google's logic; flag and replace.
- **Storing the raw Google response.** D-D1 explicitly forbids it. The Voco-normalized shape is the contract.
- **Adding a second tool turn for validate-then-book.** D-B1 explicitly forbids it; collides with Phase 60 D-02 single-readback.
- **Holding the validate call inside the slot-lock window.** D-B2 explicitly forbids it; latency risk + lock-contention risk.
- **Sentry-paging on `unsupported_region`.** D-A3 explicitly forbids it; observe via `usage_events` aggregations instead.
- **Calling `session.generate_reply()`** to nudge the model after a successful validation. Phase 63.1 SHA `bc4befd` removed both call sites because Gemini 3.1 Flash Live silently drops them ([VERIFIED: memory note `reference_livekit_generate_reply_gemini31.md`] + livekit-agent regression-guard test `tests/test_no_generate_reply_in_src.py`). Tool-return string IS the prompt-update mechanism — that is exactly the D-E2 design.
- **Per-call `usage_events` insert with `event_type='gmaps_validate'`.** The current schema is `(call_id PK, tenant_id, created_at)` — `event_type` does not exist as a column, and `call_id PK` enforces one row per phone-call (not per validate). Mis-fit. Plan a sibling table or fully refactor `usage_events` (latter is risky — touches Phase 23 billing surface). See Open Questions.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Address parsing | Custom regex over caller-spoken street/postal/locality | Address Validation API | Google handles 34 countries, USPS CASS for US, postal-format edge cases, autocorrect, format normalization. Hand-rolled = endless edge-case bugs. |
| Verdict heuristic | Combining `addressComplete` + `hasUnconfirmedComponents` + `validationGranularity` | `verdict.possibleNextAction` enum | Google computes this for you; their composition rule is more sophisticated than what we'd hand-craft and they update it. |
| ISO country code from string parse | Tokenizing "Singapore" → "SG" | `address.postalAddress.regionCode` from response | Google returns the canonical CLDR region code in `postalAddress.regionCode`; addressComponents only has the long-form name. |
| HTTP retry inside 1.5s | Exponential backoff loops | Single attempt, fail-soft to verdict='error' | D-C1 explicit; retries blow the latency budget and `book_appointment` proceeds without validation anyway. Booking is the user's actual goal. |
| Per-key API rate limiting | Token bucket in `google_maps.py` | Nothing (D-C2) | Phase 61 is observability-only; revisit after first month of `usage_events` data. Premature optimization. |
| Phone E.164 parsing | Regex | (not needed in `google_maps.py`) | This module doesn't touch phones. Keep `phonenumbers` out of the dep surface for this client. |

**Key insight:** The Address Validation API IS the architectural primitive. Every "but what if Google misses an SG HDB unit" hypothetical falls into the D-B3 `confirmed_with_changes` readback path — the agent reads back what Google found and invites caller confirmation. We do not build a fallback validator.

## Common Pitfalls

### Pitfall 1: `usage_events` schema mismatch with D-C2
**What goes wrong:** D-C2 says "writes one row to `usage_events` (`event_type='gmaps_validate'`, with verdict, latency_ms, cost_micro_cents)". Current schema (`013_usage_events.sql`) is `(call_id text PRIMARY KEY, tenant_id uuid, created_at timestamptz)` — no `event_type`, no `verdict`, no `latency_ms`, no `cost_micro_cents`. `call_id PK` means at most ONE row per phone-call, but a single phone-call may invoke `book_appointment` and/or `capture_lead` multiple times → multiple validates per call.
**Why it happens:** CONTEXT.md was drafted from the Phase 53 BILLING `usage_events` mental model without re-reading migration 013.
**How to avoid:** Plan a sibling table `gmaps_validate_events` (recommended) OR a major migration that pivots `usage_events` to `(id uuid PK, tenant_id, call_id, event_type, payload jsonb, created_at)` and migrates the existing PK to a UNIQUE index on `(call_id) WHERE event_type='call_billed'`. Researcher recommends the sibling table — it's strictly additive and doesn't touch the Phase 23/53 billing path.
**Warning signs:** Migration plan tries to `ALTER TABLE usage_events ADD COLUMN event_type` without addressing the PK collision.

### Pitfall 2: API key restriction by API enabled-list — wrong UI path
**What goes wrong:** GCP Console's API key UI has TWO restriction modes: "Application restrictions" (HTTP referrer / IP / Android / iOS) and "API restrictions" (allow-list of enabled APIs). D-G2 wants the second; users frequently set the first by mistake (IP-allowlist), which fails on Railway because Railway egress IPs rotate.
**Why it happens:** UI defaults to "Don't restrict" or to the more visible Application restrictions section.
**How to avoid:** D-G3 callout in PLAN must say "API restrictions → Restrict key → select 'Address Validation API' from the dropdown → Save". NOT "Application restrictions → IP addresses".
**Warning signs:** First validate call returns `403 PERMISSION_DENIED` with reason `IP_ADDRESS_BLOCKED` or similar.

### Pitfall 3: `addressComponents` componentType is the FLAT key (not nested under `componentName.componentType`)
**What goes wrong:** Mapper code accesses `c["componentName"]["componentType"]` instead of `c["componentType"]`. Logs show "all components are None".
**Why it happens:** Easy to confuse with Geocoding API's `address_components[].types[]` shape (which is an array under a sibling key).
**How to avoid:** Pinning the access pattern in test fixtures. Address Validation returns:
```json
{
  "componentName": {"text": "Mountain View", "languageCode": "en"},
  "componentType": "locality",
  "confirmationLevel": "CONFIRMED"
}
```
**Warning signs:** Voco-normalized dict has every key set to None despite a successful response.

### Pitfall 4: Country ISO code is in `postalAddress.regionCode`, NOT `addressComponents[country]`
**What goes wrong:** D-D1's `country_code` field is populated as None for every response because the mapper looks for a "short_name" or "iso" field on the country addressComponent.
**Why it happens:** Address Validation's `addressComponents` does not have the `short_name` / `long_name` distinction the Geocoding API has. The country LONG NAME ("United States", "Singapore") is in `addressComponents[componentType=country].componentName.text`. The ISO code is in a SEPARATE block: `result.address.postalAddress.regionCode` (the CLDR region code, e.g. "US", "SG").
**How to avoid:** Mapper reads `country_code` from `address.postalAddress.regionCode`, NOT from addressComponents. Fixture-tested.
**Warning signs:** `address_components.country_code IS NULL` for every row in `appointments` after Phase 61 ships.

### Pitfall 5: `service_address` overwrite (D-D3) silently drops caller-spoken context for `confirmed_with_changes`
**What goes wrong:** D-D3 says `service_address` is overwritten with `formatted_address` on `confirmed` AND `confirmed_with_changes`. For `confirmed_with_changes`, the readback INVITED caller confirmation — what if the caller said "no, change it back"? Phase 60 D-09/D-10 corrections protocol applies, but the corrections protocol updates the agent's model of the address, NOT the eventual DB write.
**Why it happens:** The D-E2 directive for `confirmed_with_changes` says "if caller corrects, accept correction and re-read full address" — but `book_appointment` has already been called by the time we got the verdict. The flow is: validate → return STATE → agent reads back → caller confirms-or-corrects → agent calls `book_appointment` → validate happens AGAIN inside book_appointment → success.
**How to avoid:** Document explicitly that **the validate-and-store happens inside the SAME book_appointment invocation that locks the slot**. The caller-confirmation step is between `check_slot` (which does NOT validate) and `book_appointment` (which DOES validate, then commits). If the caller corrects after the readback, the agent re-runs `check_slot` (no, that's already-bound) — actually re-runs nothing; the corrected address goes to `book_appointment` on the FIRST commit attempt. So the validate-then-store happens once, on the canonical address the caller agreed to.
**Warning signs:** UAT call where caller corrects an address mid-readback, but `appointments.formatted_address` shows the un-corrected Google version.

### Pitfall 6: SDK-level capability gate on `gemini-3.1-flash-live-preview`
**What goes wrong:** Calling `session.generate_reply()` after the validate-and-book to "wake the model up" silently does nothing on this model.
**Why it happens:** [VERIFIED: livekit-plugins-google 1.5.6 source — `realtime_api.py:289 mutable = "3.1" not in model`] Phase 63.1 SHA `bc4befd` documented this and removed both call sites.
**How to avoid:** Tool-return strings ARE the prompt-update mechanism. The D-E2 STATE+DIRECTIVE shape is the entire surface. Don't reach for `session.generate_reply` / `session.say` (the latter requires a TTS pipeline — already attached in `agent.py` line 460-473 specifically for the greeting only).
**Warning signs:** New regression-guard test `tests/test_no_generate_reply_in_src.py` fails after a Phase 61 commit.

### Pitfall 7: Address Validation 6000 QPM regional default
**What goes wrong:** Burst load (e.g. backfill script accidentally) trips the 6000 QPM quota; verdict='error' on every call until the next minute.
**Why it happens:** [CITED: developers.google.com/maps/documentation/address-validation/usage-and-billing] "maximum request limit of 6,000 queries per minute for the validation methods".
**How to avoid:** D-C2 explicitly says no rate limiter in Phase 61 — observability via `usage_events` (or sibling table). The 6000 QPM cap is way above any expected per-call load (one validate per book_appointment, max ~2 per phone-call). Document the cap so future capacity planning has the number.
**Warning signs:** Sudden cluster of `verdict='error'` rows correlated to a single tenant in a single minute.

### Pitfall 8: `httpx` not in pinned direct deps
**What goes wrong:** A future minor-version change to `livekit-agents` or `supabase` drops the transitive httpx dependency; Phase 61 module ImportErrors at startup.
**Why it happens:** `pyproject.toml` has httpx only under `[project.optional-dependencies] dev` (line 33). Production install (`pip install --no-cache-dir .` in Dockerfile) does NOT install dev deps. Currently httpx ships transitively via livekit-agents/supabase, but this is implicit.
**How to avoid:** Migration plan adds `"httpx>=0.27,<1"` to the main `[project] dependencies` block. Document the change in pyproject.toml diff alongside the python module.
**Warning signs:** Dockerfile build fine; runtime ImportError on first call.

## Code Examples

### Example 1: Address Validation API request (verbatim from docs)
```python
# Source: developers.google.com/maps/documentation/address-validation/requests-validate-address
# Endpoint: POST https://addressvalidation.googleapis.com/v1:validateAddress?key={KEY}
# Body example (verbatim):
{
  "address": {
    "regionCode": "US",
    "locality": "Mountain View",
    "addressLines": ["1600 Amphitheatre Pkwy"]
  }
}
# enableUspsCass: true is US/PR-only; Phase 61 can omit (not required for verdict).
```

### Example 2: Verdict response shape (pinned fields)
```jsonc
// Source: developers.google.com/maps/documentation/address-validation/understand-response
// Pinned fields Phase 61 reads:
{
  "result": {
    "verdict": {
      "inputGranularity": "PREMISE",            // PREMISE | SUB_PREMISE | OTHER (informational)
      "validationGranularity": "PREMISE",       // primary granularity signal
      "geocodeGranularity": "PREMISE",
      "addressComplete": true,                  // boolean
      "hasUnconfirmedComponents": false,        // optional boolean
      "hasInferredComponents": false,           // optional boolean
      "possibleNextAction": "ACCEPT"            // <-- CANONICAL DECISION FIELD
                                                //     ACCEPT | CONFIRM | CONFIRM_ADD_SUBPREMISES | FIX
    },
    "address": {
      "formattedAddress": "1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA",
      "postalAddress": {
        "regionCode": "US",                     // <-- ISO country code lives HERE
        "languageCode": "en",
        "postalCode": "94043",
        "administrativeArea": "CA",
        "locality": "Mountain View",
        "addressLines": ["1600 Amphitheatre Pkwy"]
      },
      "addressComponents": [
        {
          "componentName": {"text": "1600", "languageCode": "en"},
          "componentType": "street_number",
          "confirmationLevel": "CONFIRMED"
        },
        {
          "componentName": {"text": "Amphitheatre Parkway", "languageCode": "en"},
          "componentType": "route",
          "confirmationLevel": "CONFIRMED",
          "spellCorrected": true                // OPTIONAL flag
        },
        {
          "componentName": {"text": "Mountain View", "languageCode": "en"},
          "componentType": "locality",
          "confirmationLevel": "CONFIRMED"
        },
        {
          "componentName": {"text": "United States", "languageCode": "en"},
          "componentType": "country",            // long-form name only
          "confirmationLevel": "CONFIRMED"
        },
        {
          "componentName": {"text": "94043", "languageCode": "en"},
          "componentType": "postal_code",
          "confirmationLevel": "CONFIRMED"
        }
      ]
    },
    "geocode": {
      "placeId": "ChIJ2eUgeAK6j4ARbn5u_wAGqWA",
      "location": {
        "latitude": 37.422411,
        "longitude": -122.0840897
      }
    },
    "uspsData": { "/* US/PR only — Voco does not consume in Phase 61 */": "" }
  },
  "responseId": "..."
}
```

### Example 3: Sentry capture pattern (verbatim adapted from `xero.py`)
```python
# Source: livekit-agent/src/integrations/xero.py lines 500-515
import hashlib
import sentry_sdk

try:
    sentry_sdk.capture_exception(
        exc,
        tags={
            "tenant_id": tenant_id or "unknown",
            "call_id": call_id or "unknown",
            "phase": "61",
            "component": "google_maps_validate",
            # Region code is NOT PII — fine to tag
            "region_code": region_code or "unknown",
        },
    )
except Exception:
    pass  # telemetry must never crash the caller
```

### Example 4: Agent.py wiring (where `validate_address` deps land)
```python
# Source: livekit-agent/src/agent.py lines 215-235 (tenant lookup pattern)
# Phase 61 does NOT need a pre-session fetch (unlike Xero/Jobber).
# Validation runs INSIDE book_appointment / capture_lead — at tool-call time.
#
# What MUST be plumbed via deps:
#   deps["call_id"]      — already present
#   deps["tenant_id"]    — already present
#   deps["country"]      — already present (line 236) — used as region_code
#   GOOGLE_MAPS_API_KEY  — environment variable, read inside google_maps.py
#
# No agent.py changes required other than (optional) startup log:
if not os.environ.get("GOOGLE_MAPS_API_KEY"):
    logger.warning("[phase61] GOOGLE_MAPS_API_KEY not set — address validation will be skipped")
```

### Example 5: `book_appointment.py` integration sketch (D-B2: validate first, then atomic_book_slot)
```python
# Source: derived from livekit-agent/src/tools/book_appointment.py (existing flow at lines 248-413)
# Insert AFTER address normalization (line 256-259) and BEFORE atomic_book_slot (line 400)

from ..integrations.google_maps import validate_address_bounded

# Caller's region_code derived from tenant.country (US/CA/SG)
region_code = deps.get("country", "US")

validation = await validate_address_bounded(
    tenant_id=tenant_id,
    call_id=deps.get("call_id"),
    region_code=region_code,
    address_lines=[street_name + (f" {unit_number}" if unit_number else "")],
    postal_code=postal_code or None,
    locality=None,  # not captured by current single-question intake
)

# D-D3: overwrite service_address only on confirmed / confirmed_with_changes
if validation["verdict"] in ("confirmed", "confirmed_with_changes") and validation.get("formatted_address"):
    service_address = validation["formatted_address"]
# Else: keep agent-joined string (line 259 fallback)

# Pass through to atomic_book_slot — RPC accepts new args, all NULLABLE
result = await atomic_book_slot(
    supabase,
    tenant_id=tenant_id,
    call_id=deps.get("call_uuid") or None,
    start_time=slot_start,
    end_time=slot_end,
    address=service_address,
    caller_name=caller_name or "Caller",
    caller_phone=deps.get("from_number", ""),
    urgency=normalized_urgency,
    zone_id=None,
    postal_code=postal_code or None,
    street_name=street_name or None,
    # Phase 61 NEW:
    formatted_address=validation.get("formatted_address"),
    place_id=validation.get("place_id"),
    latitude=validation.get("latitude"),
    longitude=validation.get("longitude"),
    address_components=validation.get("address_components"),
    address_validation_verdict=validation["verdict"],
)

# D-E2: tool return string carries verdict + formatted_address for the readback
if result.get("success"):
    if validation["verdict"] == "confirmed":
        return (f"BOOKED [verdict=validated]: relay normalized address "
                f"[{validation['formatted_address']}] and time [{format_slot_for_speech(slot_start, tenant_timezone)}] "
                f"as confirmed; ask if anything else is needed")
    elif validation["verdict"] == "confirmed_with_changes":
        return (f"BOOKED [verdict=validated_with_corrections]: relay normalized address "
                f"[{validation['formatted_address']}] as the final form, explicitly invite caller "
                f"confirmation before closing; if caller corrects, accept correction and re-read full address")
    else:
        # unconfirmed / error / skipped / unsupported_region
        return ("BOOKED [verdict=unvalidated]: relay address as caller spoke it; "
                "do NOT claim 'validated', 'confirmed against records', or 'looked up your address'")
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Geocoding API for address validation | Address Validation API (dedicated) | 2023 GA [CITED: infoq.com/news/2023/01/google-address-validation-api] | Geocoding was always best-effort lookup; Validation API gives explicit verdict + USPS DPV |
| Hand-written verdict heuristic from raw flags | `verdict.possibleNextAction` enum | Doc-recommended path | Google maintains the heuristic across API versions; less drift |
| `googlemaps` Python SDK for everything | `httpx` direct calls | livekit-agent established this in Phase 55-56 | Tighter timeout control; smaller dep footprint; no sync→async bridge |
| `session.generate_reply()` to drive agent turns | Tool-return string is the prompt update | Phase 63.1 (livekit-agent SHA `bc4befd`) | gemini-3.1-flash-live-preview silently drops generate_reply; STATE+DIRECTIVE returns are the only working surface |

**Deprecated/outdated:**
- The 2023 `result.uspsData.dpvConfirmation` heuristic ("Y" or "N") is still valid for US addresses but is now wrapped under `verdict.possibleNextAction`. Don't read DPV directly.
- The CONTEXT.md-suggested `addressComplete && !hasUnconfirmedComponents && !hasInferredComponents` heuristic was the recommended approach circa 2023. Superseded by `possibleNextAction`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Per-call cost is ~$0.017 USD (CONTEXT D-G3 figure) — pricing is now SKU-based ("Address Validation Pro" / "Enterprise") with subscription bundling at $1,200/mo for 250k calls. The $0.017 figure is from a 2023-era pay-as-you-go calculation. | Standard Stack / Common Pitfalls | Cost telemetry in `gmaps_validate_events.cost_micro_cents` may show the wrong value; doesn't break behavior, but billing forecasts may be off by 2-3x. Confirm exact rate from billing console after first invoice. **ACCEPTED:** plan ships with assumed pricing; planner notes that observed costs from gmaps_validate_events.cost_micro_cents will reconcile in the first month of live data. |
| A2 | `httpx` ships transitively with the pinned `livekit-agents==1.5.6` + `supabase>=2.0` + `openai>=2.0` stack and will continue to. | Standard Stack — Pitfall 8 | Plan should defensively add `httpx>=0.27,<1` to direct deps anyway. |
| A3 | Singapore HDB addresses surface as `street_number=block + route=street + subpremise=unit` (or subpremise absent). Google docs do not show an SG HDB example. | Architecture Patterns — Pattern 3 | If the API returns HDB block under a different componentType (e.g. `premise` or just embedded in formattedAddress), the Voco-normalized `street_number` will be wrong. UAT must include an SG HDB call. |
| A4 | The `postalAddress.regionCode` field is reliably present on every successful response and is the canonical ISO country code source. Google reference docs imply it's always present in successful results but don't explicitly guarantee. | Architecture Patterns — Pattern 3, Pitfall 4 | If sometimes absent, `country_code` will be None on some rows. Mapper should fall back to a hardcoded map from `country` long-name to ISO code if missing — defensive, not first-line. |
| A5 | `verdict.possibleNextAction` is present on every response. Google docs describe it as the canonical decision field but do not document a "missing" case. | Architecture Patterns — Pattern 2 | Mapper defaults to `unconfirmed` on missing — safe-side fail-open, won't claim "validated" without grounds. |
| A6 | Tool-description max length on `livekit-agents 1.5.6 + gemini-3.1-flash-live-preview` is at-least 1024 characters (matches OpenAI's documented function-description limit; Google AI does not document a hard cap). Current tool descriptions in `book_appointment.py` are ~620 chars; `capture_lead.py` ~770 chars. Phase 61 additions per D-E1 add ~250 chars each → both stay well under 1024. | Pitfall 6 area | If Gemini truncates silently, validation precondition language gets dropped from the prompt surface. Mitigation: keep tool-description additions short and outcome-framed (D-E1 already does this); fixture-test final length. |
| A7 | The CONTEXT D-C2 spec ("writes one row to `usage_events` (`event_type='gmaps_validate'`...)") was drafted from a Phase 53 mental model and conflicts with the actual `usage_events` schema. | Pitfall 1 / Open Questions | Plan adds a sibling `gmaps_validate_events` table; user confirms during planning. If the user wants to refactor `usage_events` itself, that's a bigger phase. |
| A8 | The 6000 QPM quota is a per-project default and is not realistically reachable by Voco's call volume in 2026 (would require 6000 calls/minute). | Pitfall 7 | If hit, every validate returns 429 → verdict='error'. Plan should not waste effort on quota-management code. |

## Open Questions (RESOLVED 2026-04-25)

1. **`usage_events` vs new `gmaps_validate_events` table for D-C2 telemetry.**
   - What we know: Current `usage_events` schema is `(call_id text PRIMARY KEY, tenant_id uuid, created_at timestamptz)` — billing-idempotency-only, 1 row per call. CONTEXT D-C2 wants `event_type='gmaps_validate', verdict, latency_ms, cost_micro_cents` per validate (potentially N validates per call).
   - What's unclear: Did the user mean "the existing usage_events table" or "a usage_events-style telemetry table"?
   - Recommendation: Plan adds new `gmaps_validate_events` sibling table; planner re-confirms with user during /gsd-plan-phase. If user insists on `usage_events`, schema-pivot becomes a separate ~3-task plan within Phase 61.
   - **RESOLVED 2026-04-25:** see CONTEXT.md §Post-Research Resolutions — D-C2′ (new sibling table `gmaps_validate_events` chosen; usage_events left untouched).

2. **Should `book_appointment_atomic` be renamed to a v2 function?**
   - What we know: D-F2 says extend in place. Pattern from `026_address_fields.sql` already extended in place. 17-arg function signature is a code smell but not a bug.
   - What's unclear: At 17 args the function is approaching maintainability ceiling; any future address change adds more.
   - Recommendation: Keep extending in place per D-F2. Flag for /gsd-plan-phase if/when arg count exceeds ~20 — refactor to JSONB payload param.

3. **Does `capture_lead` need to extend `record_outcome` similarly?**
   - What we know: capture_lead.py calls `record_outcome` (not `atomic_book_slot`), which calls `record_call_outcome` RPC (Phase 59 D-10 path). That RPC writes to `inquiries` not `appointments`/`leads` directly post-Phase-59.
   - What's unclear: Phase 59 reshaped the leads model into Customers + Jobs + Inquiries. D-F1 says "appointments + leads" but `leads` was dropped in migration 061. The new equivalent is probably `inquiries` (or the customers+inquiries pair).
   - Recommendation: Researcher cannot verify the new lead-equivalent schema without reading 059 + 061 in depth (out of phase scope per the brief). **Planner MUST audit `inquiries` / `customers` / `jobs` table shapes during /gsd-plan-phase and confirm where the validated-address columns belong.** This is the highest-risk gap in this research.
   - **RESOLVED 2026-04-25:** see CONTEXT.md §Post-Research Resolutions — D-F1′ (validated-address columns land on `appointments` + `inquiries`; `customers` and `jobs` are NOT touched in Phase 61).

4. **Is `livekit-agent`'s `httpx` actually safe to rely on transitively?**
   - What we know: xero.py and jobber.py have been in production since Phase 55/56 (commits since 2026-04). No reported import failures.
   - What's unclear: Future SDK upgrades.
   - Recommendation: Plan adds explicit pin. Cheap insurance.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Google Cloud Project + Billing | Address Validation API | ✗ (user action D-G3) | — | None — phase blocks until user provisions |
| `GOOGLE_MAPS_API_KEY` env var on Railway | google_maps.py runtime | ✗ (user action D-G3 step 5) | — | Module returns `verdict='skipped'` if missing — graceful, but every validate is a no-op |
| Address Validation API enabled in GCP | Validate calls succeeding | ✗ (user action D-G3 step 2) | — | 403 PERMISSION_DENIED → verdict='error' |
| Existing Sentry DSN on Railway | D-C3 error capture | ✓ | Active per `agent.py` lines 26-30 | — |
| Existing Supabase service-role on Railway | RPC + telemetry table writes | ✓ | Active per all current integrations | — |
| `livekit-agent` repo write access at `C:/Users/leheh/.Projects/livekit-agent/` | Code changes ship here | ✓ | Sibling clone present | — |
| `httpx` Python lib | google_maps.py | ✓ (transitive) | (whatever ships with livekit-agents 1.5.6 + supabase + openai) | Add explicit pin per Pitfall 8 |

**Missing dependencies with no fallback:**
- GCP project + billing + API key + Railway env var — must complete D-G3 before code lands productively. Code can ship and silent-skip with `verdict='skipped'` in the meantime, but UAT cannot pass.

**Missing dependencies with fallback:**
- `GOOGLE_MAPS_API_KEY` missing → `verdict='skipped'` path (degraded but non-blocking).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `pytest` >= 8.0 + `pytest-asyncio` >= 0.23 |
| Config file | `livekit-agent/pyproject.toml` `[tool.pytest.ini_options]` (lines 40-43): `testpaths=["tests"]`, `asyncio_mode = "auto"` |
| Quick run command | `cd livekit-agent && pytest tests/test_google_maps.py tests/test_book_appointment_validation.py tests/test_capture_lead_validation.py -x` |
| Full suite command | `cd livekit-agent && pytest -x --deselect tests/webhook/test_routes.py::test_incoming_call_vip_lead` (deselect of pre-existing VIP failure consistent with Phase 60.3 pattern) |

### Phase Requirements → Test Map
| Decision ID | Behavior | Test Type | Automated Command | File Exists? |
|-------------|----------|-----------|-------------------|--------------|
| D-A1 verdict mapper | `ACCEPT → confirmed` | unit | `pytest tests/test_google_maps.py::test_map_verdict_accept_to_confirmed -x` | ❌ Wave 0 |
| D-A1 verdict mapper | `CONFIRM → confirmed_with_changes` | unit | `pytest tests/test_google_maps.py::test_map_verdict_confirm -x` | ❌ Wave 0 |
| D-A1 verdict mapper | `CONFIRM_ADD_SUBPREMISES → confirmed_with_changes` | unit | `pytest tests/test_google_maps.py::test_map_verdict_subpremise -x` | ❌ Wave 0 |
| D-A1 verdict mapper | `FIX → unconfirmed` | unit | `pytest tests/test_google_maps.py::test_map_verdict_fix -x` | ❌ Wave 0 |
| D-A1 verdict mapper | missing possibleNextAction → defensive `unconfirmed` | unit | `pytest tests/test_google_maps.py::test_map_verdict_missing_defaults_unconfirmed -x` | ❌ Wave 0 |
| D-A3 unsupported region | regionCode=DE → `unsupported_region` | unit (mocked 400) | `pytest tests/test_google_maps.py::test_unsupported_region -x` | ❌ Wave 0 |
| D-C1 timeout | 1.5s budget exceeded → `error` + Sentry | unit (mocked sleep) | `pytest tests/test_google_maps.py::test_timeout_returns_error_verdict -x` | ❌ Wave 0 |
| D-C1 fail-soft | Network error → `error` + Sentry | unit (mocked exc) | `pytest tests/test_google_maps.py::test_network_error_returns_error_verdict -x` | ❌ Wave 0 |
| D-C3 Sentry gate | `unsupported_region` does NOT call Sentry | unit | `pytest tests/test_google_maps.py::test_unsupported_region_no_sentry -x` | ❌ Wave 0 |
| D-D1 components mapper | US fixture → all named keys populated | unit | `pytest tests/test_google_maps.py::test_components_mapper_us -x` | ❌ Wave 0 |
| D-D1 components mapper | CA fixture → all named keys populated | unit | `pytest tests/test_google_maps.py::test_components_mapper_ca -x` | ❌ Wave 0 |
| D-D1 components mapper | SG HDB fixture → block/unit shape | unit | `pytest tests/test_google_maps.py::test_components_mapper_sg -x` | ❌ Wave 0 |
| D-D1 country_code | `country_code` from `postalAddress.regionCode` (Pitfall 4) | unit | `pytest tests/test_google_maps.py::test_country_code_from_region_code -x` | ❌ Wave 0 |
| D-D3 service_address overwrite | `confirmed` → `service_address = formatted_address` | integration | `pytest tests/test_book_appointment_validation.py::test_confirmed_overwrites_service_address -x` | ❌ Wave 0 |
| D-D3 service_address overwrite | `unconfirmed` → `service_address` keeps agent-joined string | integration | `pytest tests/test_book_appointment_validation.py::test_unconfirmed_keeps_agent_joined -x` | ❌ Wave 0 |
| D-E2 tool return | `confirmed` returns STATE+DIRECTIVE with `verdict=validated` token | integration | `pytest tests/test_book_appointment_validation.py::test_confirmed_return_shape -x` | ❌ Wave 0 |
| D-E2 tool return | `confirmed_with_changes` returns `verdict=validated_with_corrections` | integration | `pytest tests/test_book_appointment_validation.py::test_corrections_return_shape -x` | ❌ Wave 0 |
| D-E2 tool return | `unconfirmed`/`error`/`skipped`/`unsupported_region` returns `verdict=unvalidated` | integration | `pytest tests/test_book_appointment_validation.py::test_unvalidated_return_shape -x` | ❌ Wave 0 |
| D-B4 capture_lead symmetry | capture_lead validates and stores | integration | `pytest tests/test_capture_lead_validation.py::test_validate_and_store -x` | ❌ Wave 0 |
| D-F1 columns + CHECK | migration 062 applies; CHECK rejects `'invalid'` verdict | DB-test (migration runner) | (manual: `psql -f supabase/migrations/062_*.sql && psql -c "INSERT ... verdict='invalid'"` expects fail) | ❌ Wave 0 — manual gate, no automated runner |
| D-F2 RPC backward-compat | book_appointment_atomic still callable with 11 args | DB-test | (manual or `pytest tests/test_book_appointment_atomic_signature.py`) | ❌ Wave 0 |
| D-E3 prompt rule | EN+ES anti-hallucination "validated" rule present | unit (prompt assembly) | `pytest tests/test_prompt_address_validation_rule.py -x` | ❌ Wave 0 |
| Regression guard | No `session.generate_reply` reintroduced | unit | `pytest tests/test_no_generate_reply_in_src.py -x` | ✅ Already exists (Phase 63.1) |
| Manual UAT | Real call: SG-confirmed, US-confirmed-with-changes, fictional-unconfirmed, SG-HDB | manual | (live phone call) | manual-only |

### Sampling Rate
- **Per task commit:** `pytest tests/test_google_maps.py tests/test_book_appointment_validation.py tests/test_capture_lead_validation.py tests/test_prompt_address_validation_rule.py -x` (~5s)
- **Per wave merge:** `pytest -x --deselect tests/webhook/test_routes.py::test_incoming_call_vip_lead` (full suite ~30s on the existing 254-test baseline)
- **Phase gate:** Full suite green + UAT call sequence (4 calls) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/test_google_maps.py` — verdict mapper (5 tests), components mapper (4 tests), country_code (1), HTTP error paths (4), Sentry gate (1)
- [ ] `tests/test_book_appointment_validation.py` — D-D3 overwrite (2), D-E2 returns (3) — uses fixture loader for recorded Google responses
- [ ] `tests/test_capture_lead_validation.py` — D-B4 symmetry (3 tests, mirrors above)
- [ ] `tests/test_prompt_address_validation_rule.py` — D-E3 EN+ES presence + position (~6 tests)
- [ ] `tests/test_book_appointment_atomic_signature.py` — RPC backward-compat (mocked supabase.rpc with 11 vs 17 args)
- [ ] `tests/fixtures/gmaps_responses/` — recorded Google responses: `us_confirmed.json`, `us_confirm_with_corrections.json`, `us_fix_required.json`, `ca_confirmed.json`, `sg_hdb_confirmed.json`, `sg_hdb_subpremise_missing.json`, `unsupported_region_de.json`, `quota_exceeded_429.json`
- [ ] `livekit-agent/pyproject.toml` — add `httpx>=0.27,<1` to `[project] dependencies`

## Security Domain

> Researcher confirmed no `.planning/config.json` `security_enforcement: false` flag — security domain INCLUDED.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (low) | API key auth via query param. Standard for Google Maps APIs. |
| V3 Session Management | no | No user sessions; service-to-service. |
| V4 Access Control | yes | API key restricted to Address Validation API only (D-G2); RPC `book_appointment_atomic` GRANT to service_role only (existing 027 pattern, Phase 61 re-applies for new signature). |
| V5 Input Validation | yes | `regionCode` whitelist (US/CA/SG known, others → unsupported_region path). Numeric latitude/longitude bounded by `numeric(10,7)` column type. `address_validation_verdict` CHECK constraint enum. |
| V6 Cryptography | no (transport-only) | TLS to Google Maps endpoint via httpx default. No at-rest crypto needed for non-sensitive data. |

### Known Threat Patterns for httpx + GCP API + Postgres jsonb stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| API key leak in logs / Sentry | Information Disclosure | Never log full URL; never include API key in Sentry tags. (Pattern from `xero.py`/`jobber.py`: token material logged as TYPE only — see jobber.py line 192 comment "may contain response body".) |
| Caller-spoken address as injection vector | Tampering | Address fields are passed as JSON values to the Address Validation API (not interpolated into URL or shell); httpx-handled. JSONB column stores via parameterized RPC; no string interpolation. |
| `address_validation_verdict` enum bypass | Tampering | CHECK constraint at DB layer — final defense regardless of Python-layer mapper bugs. |
| `place_id` PII risk | Information Disclosure | Place IDs are public Google identifiers (no PII). Safe to index, log (tagged), and persist. |
| Quota exhaustion DOS by mistake | Denial of Service | 6000 QPM Google quota >> realistic Voco load. D-C2 explicit no-rate-limiter; observability via gmaps_validate_events. |
| Caller-supplied address sent to Google (consent) | Disclosure | Already considered + accepted in CONTEXT.md "Deferred Ideas" — Phase 56/57 already send caller PII to Jobber/Xero; no new privacy surface. |

## Sources

### Primary (HIGH confidence)
- `livekit-agent/src/integrations/xero.py` lines 41-521 — canonical pattern for external-API client (httpx, timeout, refresh, sentry, telemetry)
- `livekit-agent/src/integrations/jobber.py` lines 33-513 — second canonical pattern (httpx.Timeout granularity, never-raises wrapper, Sentry capture without PII)
- `livekit-agent/src/tools/book_appointment.py` lines 183-640 — current tool surface to be modified
- `livekit-agent/src/tools/capture_lead.py` lines 1-119 — symmetric tool surface for D-B4
- `livekit-agent/src/lib/booking.py` — `atomic_book_slot` Python wrapper (must change to pass new params)
- `livekit-agent/src/lib/customer_context.py` lines 121-180 — Sentry+timeout wrapper template
- `livekit-agent/src/agent.py` lines 24-30, 215-235, 410-475 — Sentry init, tenant lookup, RealtimeModel pin
- `livekit-agent/pyproject.toml` lines 1-44 — pinned dep set
- `livekit-agent/Dockerfile` — production install path (`pip install --no-cache-dir .` — no dev deps)
- `supabase/migrations/013_usage_events.sql` — current usage_events schema (constrains D-C2 implementation)
- `supabase/migrations/026_address_fields.sql` lines 11-82 — current `book_appointment_atomic` definition + drop-loop pattern
- `supabase/migrations/027_lock_rpc_functions.sql` lines 14-15 — REVOKE/GRANT signature must match exactly
- `developers.google.com/maps/documentation/address-validation/requests-validate-address` — endpoint, request body shape
- `developers.google.com/maps/documentation/address-validation/understand-response` — response field list
- `developers.google.com/maps/documentation/address-validation/build-validation-logic` — `verdict.possibleNextAction` decision tree (CANONICAL)
- `developers.google.com/maps/documentation/address-validation/coverage` — confirmed SG, US, CA all supported
- `developers.google.com/maps/documentation/address-validation/usage-and-billing` — 6000 QPM quota

### Secondary (MEDIUM confidence)
- `developers.google.com/maps/documentation/address-validation/fix-address-example` — partial response examples (full address.addressComponents not shown)
- `blog.afi.io/blog/fix-bad-addresses-with-the-google-address-validation-api` — observed subpremise field shapes ("Suite 1410", "Building D")
- WebSearch result on Gemini 3.1 Flash Live `send_realtime_input` confirming current API surface (vs `send_client_content` for initial-history-only)
- WebSearch on Address Validation pricing — $0.017/call cited from secondary sources only; Google's own pricing page redirects to a console-only detailed list

### Tertiary (LOW confidence — flagged ASSUMED in Assumptions Log)
- A1 cost figure: $0.017/call from 2023-era references; current SKU model ("Pro" / "Enterprise" / subscription bundles) may have changed the per-call rate.
- A3 SG HDB componentType shape: no Google-published example; inferred from general subpremise behavior.
- A6 tool-description char limit: no authoritative Gemini-Live-specific documentation found.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — pyproject.toml verified, xero.py/jobber.py read end-to-end
- Architecture patterns: HIGH for external-client shape (canonical reference in repo); MEDIUM for verdict mapping (Google docs canonical but underspecified for missing-field cases)
- DB migration: HIGH — exact 026/027 patterns to mirror, latest migration number confirmed (061)
- Pitfalls: HIGH on schema/DB pitfalls (verified against actual files); MEDIUM on Pitfall 7 quota (relayed from docs not stress-tested)
- Pricing/cost: LOW — Google's pricing page sends users to console; secondary sources cite $0.017 per call but the SKU pricing changed in 2025

**Research date:** 2026-04-25
**Valid until:** 2026-05-25 (30 days — Address Validation API is stable; livekit-agents 1.5.6 is the current pin)

## RESEARCH COMPLETE

**Phase:** 61 - google-maps-address-validation-and-structured-address-storage
**Confidence:** HIGH on existing-code surfaces and SDK pinning; MEDIUM on Google API edge cases (SG HDB shape, missing-field defaults) and pricing; LOW on tool-description char cap (no authoritative spec found)

### Key Findings
1. **`verdict.possibleNextAction` is Google's canonical decision field** — researcher recommends mapping it directly to Voco's 6-state enum (`ACCEPT→confirmed`, `CONFIRM/CONFIRM_ADD_SUBPREMISES→confirmed_with_changes`, `FIX→unconfirmed`) instead of the addressComplete+hasUnconfirmedComponents heuristic CONTEXT.md sketches. Google maintains the underlying composition; we maintain the mapping table.
2. **Migration number is `062`** — latest on disk is `061_drop_legacy_leads.sql`. The 6 new columns + extended RPC follow the verbatim `026_address_fields.sql` overload-loop pattern; new GRANT must reference the new 17-arg signature (Postgres treats different arities as different functions).
3. **`country_code` (D-D1) lives in `result.address.postalAddress.regionCode`, NOT in addressComponents** — Address Validation does not expose the Geocoding API's `short_name`/`long_name` distinction. The mapper reads `regionCode` for ISO; addressComponents only has the long-form name.
4. **`usage_events` (D-C2) schema mismatch** — current table is `(call_id PK, tenant_id, created_at)` for billing idempotency; CANNOT hold per-validate `event_type/verdict/latency_ms/cost_micro_cents` rows. Researcher recommends a sibling `gmaps_validate_events` table (Open Question 1 — needs user confirm during planning).
5. **`livekit-agent` repo is at `C:/Users/leheh/.Projects/livekit-agent/`** (sibling to homeservice_agent). Phase 61 code changes ship there; Supabase migration ships in homeservice_agent. Same dual-repo pattern as Phases 55/56.
6. **`session.generate_reply()` MUST NOT be reintroduced** — Phase 63.1 deleted both call sites because gemini-3.1-flash-live-preview silently drops them. The D-E2 tool-return STATE+DIRECTIVE shape IS the prompt-update mechanism. Existing regression-guard test `tests/test_no_generate_reply_in_src.py` will catch any reintroduction.
7. **Highest research-gap risk: Phase 59 reshaped the leads model** — the `leads` table referenced in D-F1 was dropped in migration `061_drop_legacy_leads.sql` and replaced by Customers + Jobs + Inquiries. Planner MUST audit which of these tables receive the new validated-address columns (Open Question 3).

### File Created
`.planning/phases/61-google-maps-address-validation-and-structured-address-storage/61-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | pyproject.toml read end-to-end; xero.py/jobber.py verified as canonical pattern |
| Architecture | HIGH (mapper) / MEDIUM (verdict edge cases) | possibleNextAction mapping is doc-canonical; missing-field defaults are inferred |
| DB Migration | HIGH | 026/027 patterns are verbatim reusable; migration number 062 verified |
| Pitfalls | HIGH (schema) / MEDIUM (quota / pricing) | usage_events mismatch verified; quota cited from docs not stress-tested |
| Validation tests | HIGH | pytest config and existing test pattern verified |

### Open Questions (planner must resolve) (RESOLVED 2026-04-25)
1. New `gmaps_validate_events` table vs schema-pivot of `usage_events` (Open Question 1)
2. Where do validated-address columns land for the `capture_lead` path post-Phase-59 (inquiries? customers? deprecated leads?) (Open Question 3 — HIGH risk)
3. Confirm pricing rate against current GCP billing console (A1)

### Ready for Planning
Research complete. Planner can now create PLAN.md files. Recommend planner first executes `/gsd-discuss-phase 61` to resolve Open Question 1 + 3 with the user before writing plans, OR call out both as the first two `Decisions Needed` items in PLAN 01.

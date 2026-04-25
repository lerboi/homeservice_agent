# Phase 61: Google Maps address validation + structured address storage — Context

**Gathered:** 2026-04-25
**Status:** Ready for planning
**Supersedes:** the 2026-04-19 seed (open questions now resolved as `D-XX:` decisions below).

<domain>
## Phase Boundary

Add Google Maps Platform Address Validation as a background pre-check inside the existing `book_appointment` and `capture_lead` tools, store the normalized result in new structured columns on `appointments` + `leads`, and let the agent read back the Google-normalized address as part of the Phase 60 single confirmation moment.

**Delivered:**
- New integration module `livekit_agent/src/integrations/google_maps.py` (API key auth, `httpx` client, 1.5s timeout).
- Pre-validation step inside `book_appointment` and `capture_lead` (no new agent tool).
- Voco-normalized `address_components` shape + named-key mapper.
- DB migration: nullable structured-address columns on `appointments` and `leads`; `book_appointment_atomic` RPC signature extended.
- Tool description rewrites + tool-return rewrites in the state+directive shape.
- New CRITICAL anti-hallucination rule for the "validated" truth-class, hoisted near the top of the prompt.
- Sentry signal on validation errors only; one `usage_events` row per validate call.

**Out of scope:**
- New `validate_address` agent tool (rejected — collides with Phase 60 D-02 single-readback).
- Geocoding API or Places API integration (single-API approach locked).
- Per-tenant rate limiting / hard cap (deferred — revisit after first month of live data).
- Dashboard "validated" pill / verdict badge / click-to-Google-Maps (deferred to a future UI phase).
- Travel-buffer zone matching upgrade using `lat`/`lng` (deferred — secondary benefit, future phase).
- Jobber write-side push (Phase 62).
- Autocomplete / static-maps / directions APIs.

</domain>

<decisions>
## Implementation Decisions

### API selection
- **D-A1:** **Address Validation API only.** Single API surface for all countries. No Geocoding or Places fallback. Returns `formattedAddress`, `placeId`, `addressComponents`, `geocode.location.{latitude,longitude}`, `verdict.{addressComplete,hasUnconfirmedComponents,hasInferredComponents,validationGranularity}`, USPS verdicts on US.
- **D-A2:** **SG uses the same path as US/CA.** No SG-specific branch. HDB block-unit quirks are absorbed by the verdict rules (D-B3, D-C1) — they may surface more often as `confirmed_with_changes` or `unconfirmed`, which the agent handles by inviting caller confirmation. Singapore is currently in Address Validation API regional support; we accept variable coverage and observe live data.
- **D-A3:** **Unsupported region degrades silently.** When the API returns a region-not-supported error (future-country onboarding), validation is skipped, `service_address` stores the agent-joined string as today, and `address_validation_verdict='unsupported_region'`. **No Sentry alert** — this is expected, not an error. We learn about coverage gaps from `usage_events` aggregations, not paging.

### Tool placement + caller UX (Option C hybrid)
- **D-B1:** **Validation runs as a pre-check inside `book_appointment` and `capture_lead`.** No new `validate_address` agent tool. Rationale: Phase 60 D-02 locked a *single* authoritative readback at booking; adding a second tool turn for an explicit validate-then-readback would split that moment in two. The hybrid keeps one tool turn while still surfacing the normalized address to the caller through the booking confirmation.
- **D-B2:** **Validate first, then atomic slot-lock.** Inside `book_appointment`: run `google_maps.validate_address()` first (`<=1.5s`). On any outcome (success or fail), call `atomic_book_slot()` with whatever fields are available. Rationale: external HTTP latency must not be held inside the slot-lock contention window.
- **D-B3:** **Verdict-driven readback shape.** Tool return string carries both the `formatted_address` and the verdict; the prompt rule maps verdict → readback behavior:
  - `confirmed` → agent reads back the normalized address as fact ("Tomorrow at 3 PM at \[normalized\], anything else?").
  - `confirmed_with_changes` → agent reads back the normalized form *and explicitly invites confirmation* ("I have it as \[normalized\] — is that right?"). Phase 60 D-09/D-10 corrections protocol applies if caller corrects.
  - `unconfirmed` / `error` / `skipped` / `unsupported_region` → agent reads back what the caller said. Agent **must not** claim "validated" or "confirmed against records" in these cases (D-E3).
- **D-B4:** **`capture_lead` validates symmetrically.** Same pre-check, same verdict-driven readback rule applied to its return string. Rationale: leads convert to bookings, and Phase 62 Jobber push pulls structured address from leads too — the structural gap of "validated bookings + unvalidated leads" creates avoidable downstream complexity.

### Verdicts, failure modes, cost controls
- **D-C1:** **1.5s `httpx` timeout, fail-soft.** On timeout / network error / quota error: log to Sentry (D-C3), set `address_validation_verdict='error'`, proceed to `atomic_book_slot()` with the agent-joined fields. Booking **never blocks** on Google. The 1.5s budget fits comfortably inside the Phase 60.2-tuned filler/VAD window.
- **D-C2:** **No rate limiter in Phase 61.** Observability-only: every validation attempt writes one row to `usage_events` (`event_type='gmaps_validate'`, with verdict, latency_ms, cost_micro_cents) — mirroring Phase 53's billing/usage pattern. Revisit hard caps / token buckets after the first month of live data; if a tenant misfires, the `usage_events` aggregation will surface it.
- **D-C3:** **Sentry only on verdict ∈ {`error`}.** `unsupported_region` does not page (D-A3). Successful verdicts (`confirmed`, `confirmed_with_changes`, `unconfirmed`, `skipped`) go to `usage_events` only — not Sentry. Keeps Sentry signal high; usage_events handles audit and billing.

### Storage shape + backward compat
- **D-D1:** **Voco-normalized `address_components` JSON shape with named keys.** `google_maps.py` exposes a mapper that converts Google's flat `addressComponents[]` array into:
  ```
  {
    "street_number": str | null,
    "route": str | null,
    "subpremise": str | null,
    "locality": str | null,
    "admin_area_level_1": str | null,
    "admin_area_level_2": str | null,
    "postal_code": str | null,
    "country": str | null,
    "country_code": str | null
  }
  ```
  Phase 62 Jobber push reads named keys directly — zero translation. Schema is stable across Google API surface changes (the mapper absorbs them). The raw Google response is **not** stored separately.
- **D-D2:** **Backend-only this phase. No dashboard surface.** Calendar flyout, SMS templates, and Jobber read-side render `service_address` text, which on success is the normalized form (D-D3). Owners get the benefit of normalized addresses everywhere they already render addresses, without any UI work in this phase. A "validated" pill / verdict badge can land in a follow-up phase if owner feedback warrants.
- **D-D3:** **`service_address` is overwritten with `formatted_address` on `confirmed` or `confirmed_with_changes`.** On other verdicts (`unconfirmed`, `error`, `skipped`, `unsupported_region`): `service_address` stores the agent-joined string (existing behavior). The Phase 60 D-02 readback already had the caller hear the normalized form for `confirmed_with_changes` (D-B3), so the SMS/calendar surfaces inheriting the normalized text is consistent — not a silent rewrite.

### Prompt + tool-surface constraints (Gemini 3.1 Flash Live + LiveKit 1.5.6)
- **D-E1:** **Tool descriptions encode the validation precondition.** Gemini 3.1 Flash Live reads tool descriptions during generation; they are part of the prompt surface. The descriptions for `book_appointment` and `capture_lead` must spell out the validation step as a hard precondition (not a usage hint), framed in outcome terms ("address fields will be validated against an external service before booking; the tool return will indicate whether the address was confirmed, corrected, or unverified — speak only what the return tells you").
- **D-E2:** **Tool returns are state + directive, not speakable English.** No return string may contain a sentence the model could parrot to the caller without invoking the tool. Concrete shape per verdict:
  - `confirmed` → `BOOKED [verdict=validated]: relay normalized address [{formatted_address}] and time [{slot}] as confirmed; ask if anything else is needed`
  - `confirmed_with_changes` → `BOOKED [verdict=validated_with_corrections]: relay normalized address [{formatted_address}] as the final form, explicitly invite caller confirmation before closing; if caller corrects, accept correction and re-read full address`
  - `unconfirmed` / `error` / `skipped` / `unsupported_region` → `BOOKED [verdict=unvalidated]: relay address as caller spoke it; do NOT claim "validated", "confirmed against records", or "looked up your address"`
  - Slot-taken / slot-unavailable returns are unchanged (Phase 60 already rewrote them).
- **D-E3:** **New CRITICAL RULE for the "validated" truth-class, hoisted near the top of the prompt.** Co-located with the existing anti-hallucination block (Phase 30 / Phase 60 D-15), not buried inside a tool section. The rule prohibits the model from saying any of: "validated", "verified", "confirmed against Google", "found your address", "looked up your address", "matches our records", or any equivalent claim, **unless the immediately preceding tool return contained `verdict=validated` or `verdict=validated_with_corrections`**. Outcome-framed; no enumerated phrasebook. Spanish mirror lands in the same pass (Phase 60 D-13 pattern).
- **D-E4:** **Cross-reference current Gemini 3.1 Flash Live + LiveKit 1.5.6 docs before commit.** Researcher confirms (a) `gemini-3.1-flash-live-preview` realtime API surface still uses `send_realtime_input` (NOT `send_client_content`), (b) tool-description max length and any structured-output constraints, (c) `livekit-agents` 1.5.6 `RealtimeModel(instructions=...)` API surface still drives prompt updates without `session.generate_reply()` (per memory `reference_livekit_generate_reply_gemini31.md`).

### Database migration
- **D-F1:** **Columns added to both `appointments` and `leads`** (additive, all NULLABLE):
  | Column | Type | Notes |
  |---|---|---|
  | `formatted_address` | `text` | Google-normalized single-line. |
  | `place_id` | `text` | Stable Google identifier. Indexed for future dedup queries. |
  | `latitude` | `numeric(10,7)` | For future travel-buffer upgrades. |
  | `longitude` | `numeric(10,7)` | For future travel-buffer upgrades. |
  | `address_components` | `jsonb` | Voco-normalized shape per D-D1. |
  | `address_validation_verdict` | `text` | One of: `confirmed`, `confirmed_with_changes`, `unconfirmed`, `error`, `skipped`, `unsupported_region`. CHECK constraint enforces enum. |
- **D-F2:** **`book_appointment_atomic` RPC signature extended** to accept the new fields. Existing callers (current agent code) continue to work — new params default NULL on Postgres side. Researcher pins the exact `CREATE OR REPLACE FUNCTION` shape vs. needing a new function name.
- **D-F3:** **`service_address`, `postal_code`, `street_name` stay** for backward compat (calendar flyout, SMS templates, Jobber read-side, existing queries). No data migration required for historical rows — they remain NULL in the new columns.

### Environment + ops
- **D-G1:** **Single new env var `GOOGLE_MAPS_API_KEY`.** Required on Railway (livekit_agent runtime) only. Not needed on Vercel for Phase 61 (no Next.js consumer).
- **D-G2:** **API key restriction by API enabled-list, not by IP.** Both Railway egress and Vercel serverless rotate IPs; IP restriction is brittle. Restrict the key to *Address Validation API only* via Cloud Console "API restrictions". Researcher documents the exact Cloud Console setup as a pre-requisite user action.
- **D-G3:** **Pre-requisite user actions** (callouts in PLAN, repeated in roadmap entry):
  1. Create / select a Google Cloud project.
  2. Enable Address Validation API.
  3. Create API key, restrict to "Address Validation API" only.
  4. Fund the billing account (per-call, ~$0.017 per validate, not free-tier).
  5. Set `GOOGLE_MAPS_API_KEY` in Railway env.

### Claude's Discretion
- Exact `httpx` retry policy (probably no retry inside the 1.5s budget — single attempt). Planner picks.
- Whether `google_maps.py` uses the official `googlemaps` Python SDK or hand-rolled `httpx` POST. Lean toward `httpx` for consistency with `livekit_agent/src/integrations/{xero,jobber}.py`. Researcher verifies.
- Exact wording of the new CRITICAL RULE (D-E3) — outcome-framed, follows Phase 60 prose style.
- Test fixture choices for `tests/test_address_validation.py` — recorded responses for each verdict + each country class.
- Whether the migration is one file or split (lean toward one — it's all one logical change).

### Folded Todos
None — no pending todos in `.planning/todos/` matched Phase 61 scope.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (researcher, planner, executor) MUST read these before acting.**

### Phase 60 substrate (Phase 61 plugs in behind it)
- `.planning/phases/60-voice-prompt-polish-name-once-and-single-question-address-intake/60-CONTEXT.md` — D-02 (single readback at booking), D-06/07/08 (single-question address intake), D-09/D-10 (corrections protocol), D-15 (anti-hallucination hoisting), D-16 (tool-return rewrite to state+directive shape).
- `.planning/phases/60-voice-prompt-polish-name-once-and-single-question-address-intake/60-VERIFICATION.md` — confirms which prompt sections actually shipped vs. drafted.

### Roadmap + project
- `.planning/ROADMAP.md` §394-407 — Phase 61 goal, scope, dependencies, pre-requisite user actions.
- `.planning/REQUIREMENTS.md` — verbatim user request for AI-validates-then-stores-then-pushes flow.
- `.planning/PROJECT.md` — Voco principles + non-negotiables.

### Existing code surface
- `livekit_agent/src/tools/book_appointment.py` §179-190 — current verbatim-store flow that this phase replaces.
- `livekit_agent/src/tools/capture_lead.py` — mirror surface; same intake pattern.
- `livekit_agent/src/integrations/xero.py`, `livekit_agent/src/integrations/jobber.py` — pattern reference for the new `google_maps.py` (httpx, env var, 1.5s timeout, error→Sentry shape).
- `supabase/migrations/003_*.sql`, `supabase/migrations/004_*.sql`, `supabase/migrations/026_address_fields.sql` — current `service_address` / `postal_code` / `street_name` shape on `appointments` and `leads`.
- Current `book_appointment_atomic` RPC definition in the most recent migration that touched it.

### Skills (must be updated at phase tail)
- `.claude/skills/voice-call-architecture/SKILL.md` — new validation step in `book_appointment` / `capture_lead`, new prompt rule (D-E3), new tool-return shapes (D-E2).
- `.claude/skills/auth-database-multitenancy/SKILL.md` — new migration entry, new columns on `appointments` + `leads`, updated RPC signature.
- `.claude/skills/integrations-jobber-xero/SKILL.md` — note that the Voco-normalized `address_components` shape (D-D1) is what Phase 62 Jobber push will read; cross-link.

### External docs (researcher pins exact URLs and version-locks them)
- Google Maps Platform Address Validation API — REST API reference, verdict enum, addressComponents shape, regional coverage list.
- Google Cloud Console — API key restriction by enabled-API-list (D-G2 setup).
- LiveKit `livekit-agents` 1.5.6 — `RealtimeModel(instructions=...)` API surface; tool description / function-declaration max length.
- Gemini 3.1 Flash Live preview — realtime API surface (`send_realtime_input` per pinned plugin), tool-call semantics, structured-output constraints.

### User-referenced principles (during discuss)
- `My Prompts/prompts` §43-56 — LiveKit/Gemini prompt-engineering principles the user pinned during discussion: outcome-oriented conversational guidance, directive truth-claim rules, tool-description-as-prompt-surface, tool-returns-as-state+directive (NOT speakable English), persona preservation, server-VAD trust. **D-E1/D-E2/D-E3 derive directly from this.** Memory note `feedback_livekit_prompt_philosophy.md` reinforces the same.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `livekit_agent/src/integrations/{xero,jobber}.py` — established pattern for an external-API client module: env-var auth, `httpx.AsyncClient` with timeout, structured logging, Sentry capture on error, no retry within in-call latency budget. `google_maps.py` follows the same shape.
- `book_appointment_atomic` RPC — already takes `p_service_address`, `p_postal_code`, `p_street_name`. Phase 61 extends the param list rather than introducing a new RPC.
- `usage_events` table + Phase 53 increment pattern — the audit/billing surface for per-call validation tracking (D-C2).
- Sentry context capture in `livekit_agent/src/tools/book_appointment.py` — pattern for D-C3 error reporting.

### Established Patterns
- **Tool-return shape (Phase 60 D-16):** state + directive, not speakable English. Phase 61's new returns (D-E2) extend this pattern; do not invent a separate convention.
- **Anti-hallucination CRITICAL RULE block (Phase 30 / Phase 60 D-15):** existing rule lives near the top of the prompt with explicit prohibited phrasings. D-E3 adds one more class to that block — same structural location, same outcome-framed style.
- **Single-question intake (Phase 60 D-06/07/08):** the conversational substrate. Phase 61's prompt changes do **not** add new intake questions — the agent already gets "enough to find the place" per D-08; validation runs on whatever it got.
- **Symmetry between `book_appointment` and `capture_lead` (Phase 60 D-11/D-12):** both tools mirror each other. D-B4 extends this symmetry to validation.

### Integration Points
- **In:** `book_appointment.py` and `capture_lead.py` are the only places that call `atomic_book_slot()` / `record_lead()` with address fields. Validation is a one-line pre-check at the top of each.
- **Out:** Phase 62 Jobber push reads the new structured columns (especially `address_components` D-D1) when it lands.
- **Out:** Phase 3 travel-buffer / `service_zones` matcher could later consume `latitude`/`longitude` for a geographic-zone upgrade (deferred, future phase).
- **Out:** Dashboard calendar flyout + SMS templates — no code change in this phase, but they auto-benefit from the normalized `service_address` on success (D-D3).

</code_context>

<specifics>
## Specific Ideas

- **"Validate first, then slot-lock"** (D-B2) is explicit user intent — keep external HTTP latency outside the contention window.
- **One usage_events row per validate call** (D-C2) explicitly mirrors Phase 53 — the user prefers a consistent telemetry surface over per-phase ad-hoc patterns.
- **Voco-normalized address_components shape** (D-D1) is designed for Phase 62. The user explicitly does **not** want raw Google response stored separately; the mapper absorbs API-shape changes. Phase 62 reads named keys.
- **Tool return "BOOKED \[verdict=validated\]: relay…" shape** (D-E2) is verbatim derived from `My Prompts/prompts` §43-56 and memory `feedback_livekit_prompt_philosophy.md` — state + directive, never speakable English.
- **API key restriction by enabled-API list, not IP** (D-G2) — explicit because Railway + Vercel both rotate egress IPs.
- **No rate limiter for Phase 61** (D-C2) — explicit user preference for "observe live data first, add caps if needed." Aligns with the broader Voco preference for "ship simple, add complexity when telemetry justifies it."

</specifics>

<deferred>
## Deferred Ideas

- **Per-tenant rate limiting / hard cap.** Revisit after one month of live `usage_events` data. If a tenant misfires (validation loop, runaway calls), implement a token bucket or hard monthly cap then. Not Phase 61.
- **Dashboard "validated" pill / verdict badge / click-to-Google-Maps link.** Owner-facing UI surface; nothing in Phase 61 touches Next.js besides the migration. A future UI phase can land this once owner feedback indicates demand.
- **Travel-buffer zone matching using `lat`/`lng`.** Phase 3's `service_zones.postal_codes`-based matcher is geographically naive. Storing `lat`/`lng` here is the structural enabler; the matcher upgrade is a future phase. Roadmap Phase 61 entry already calls this out as a "secondary benefit, not delivered here."
- **`validate_address` standalone agent tool.** Considered as Option A; rejected because it splits Phase 60 D-02's single readback into two moments. If a future use case needs validation outside `book_appointment`/`capture_lead` (e.g., a "verify my address" command), a tool can be added then.
- **Geocoding API or Places API integration.** Considered as fallback for SG; rejected (D-A2). If SG `unconfirmed` rate is unacceptable in live data, revisit.
- **Storing raw Google `addressComponents` array alongside the Voco-normalized shape.** Rejected (D-D1) — mapper absorbs API changes; raw response is not needed for any Phase 61 or Phase 62 use case.
- **Privacy / DPA review of sending caller-spoken addresses to Google.** Considered; deemed non-blocking — Phase 56/57 already involve sending caller-provided customer data to Jobber/Xero. No new PII surface introduced. If a tenant DPA requires region-locked validation, the unsupported-region path (D-A3) gives us a tenant-level opt-out hook.

### Reviewed Todos (not folded)
None — todo match returned no results.

</deferred>

---

*Phase: 61-google-maps-address-validation-and-structured-address-storage*
*Context gathered: 2026-04-25*
*Discuss-phase mode: standard interactive*

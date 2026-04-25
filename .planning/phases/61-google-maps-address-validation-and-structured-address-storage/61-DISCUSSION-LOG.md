# Phase 61: Google Maps address validation + structured address storage — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `61-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-04-25
**Phase:** 61-google-maps-address-validation-and-structured-address-storage
**Areas discussed:** API choice + SG fallback; Tool placement + caller UX; Verdicts + failure + cost controls; address_components shape + dashboard surface; Prompt + tool-surface constraints (folded mid-discuss from user-pinned principles)

---

## Gray-area selection

| Option | Description | Selected |
|--------|-------------|----------|
| API choice + SG fallback | Address Validation API as primary, Geocoding API as SG fallback, or single-API approach? Country coverage matrix. | ✓ |
| Tool placement + caller UX | Option A (new validate_address tool) vs Option B (hidden pre-check) vs Option C (hybrid). | ✓ |
| Verdicts + failure + cost controls | confirmed_with_changes UX; API error/timeout fallback; latency budget; rate limits. | ✓ |
| address_components shape + dashboard surface | Raw Google subset vs Voco-normalized JSON; backend-only vs validated pill. | ✓ |

**User selected:** all four areas.

---

## API choice + SG fallback

### Q1: Which Google Maps Platform API is the primary validator?

| Option | Description | Selected |
|--------|-------------|----------|
| Address Validation API only | Single API for all countries. Verdict semantics (confirmed/confirmed_with_changes/unconfirmed). ~$0.017/call. | ✓ |
| Address Validation primary + Geocoding fallback | Address Validation for US/CA. Geocoding for SG or on 'unconfirmed' retry. Two-API surface. | |
| Geocoding API only | Cheapest (~$0.005), works globally, but no verdict semantics, no apartment/unit resolution. | |

**User's choice:** Address Validation API only.

### Q2: What's the SG-specific behavior?

| Option | Description | Selected |
|--------|-------------|----------|
| Same path as US/CA | SG goes through Address Validation API like US/CA. HDB quirks absorbed by verdict-handling rules. | ✓ |
| SG uses Geocoding fallback | tenant.country='SG' → Address Validation first, Geocoding on 'unconfirmed'. Branching. | |
| SG bypasses validation entirely | tenant.country='SG' → store verbatim with verdict='skipped'. Defers SG win. | |

**User's choice:** Same path as US/CA.

### Q3: When Address Validation API returns 'region not supported', what's the behavior?

| Option | Description | Selected |
|--------|-------------|----------|
| Skip + verbatim store | verdict='unsupported_region', no Sentry alert (expected, not error). Clean degradation. | ✓ |
| Hard fail + Sentry | Treat as error, log to Sentry, store with verdict='error'. Noisier but proactive. | |
| Maintain a country allowlist | Hard-coded allowlist; skip API call if not in list. Manual maintenance burden. | |

**User's choice:** Skip + verbatim store.

---

## Tool placement + caller UX

### Q1: Where does validation fire and what does the caller hear?

| Option | Description | Selected |
|--------|-------------|----------|
| Option C — hybrid (validate inside book_appointment, normalized read in confirmation) | Pre-check inside tool; return string carries normalized address; agent reads back per Phase 60 D-02 single readback. One tool turn. | ✓ |
| Option A — new validate_address tool | Two tool turns; mirrors check_customer_account pattern but conflicts with Phase 60 D-02 single-readback. | |
| Option B — pre-validation hidden inside book_appointment | Validate but don't surface normalized address to caller. Worst for caller agency. | |

**User's choice:** Option C — hybrid.

### Q2: Order — validate before or after the slot lock?

| Option | Description | Selected |
|--------|-------------|----------|
| Validate first, then slot-lock | Validation (~200-500ms) before atomic_book_slot. External HTTP not held inside slot-lock contention window. | ✓ |
| Slot-lock first, validate after | Risk: lock held during external HTTP call. | |
| Run in parallel | Lowest total latency but tightly coupled failure modes. | |

**User's choice:** Validate first, then slot-lock.

### Q3: What does the agent read back to the caller?

| Option | Description | Selected |
|--------|-------------|----------|
| Verdict-driven shape | confirmed → speak as fact; confirmed_with_changes → invite confirmation; unconfirmed/error → speak what caller said. Anti-hallucination preserved. | ✓ |
| Always read normalized verbatim | Always speak formatted_address regardless of verdict. Simpler prompt. | |
| Always read what caller said | Don't surface normalized version. Loses caller-agency benefit; matches Option B intent. | |

**User's choice:** Verdict-driven shape.

### Q4: Does capture_lead also run validation?

| Option | Description | Selected |
|--------|-------------|----------|
| Both — same validation in capture_lead | Symmetry with book_appointment. Leads convert to bookings; Phase 62 reads from leads too. | ✓ |
| book_appointment only | Saves API spend on declines; creates structural gap. | |
| book_appointment now, capture_lead deferred | Reduces blast radius; two phases touching same surface. | |

**User's choice:** Both — same validation in capture_lead.

---

## Verdicts + failure + cost controls

### Q1: Latency budget for the validation HTTP call?

| Option | Description | Selected |
|--------|-------------|----------|
| 1.5s timeout → proceed with verdict='error' | httpx timeout=1.5s. On timeout: Sentry, verdict='error', booking still completes. Within Phase 60.2 filler-race budget. | ✓ |
| 3s timeout → proceed with verdict='error' | More generous, but risks regressing Phase 60.2 filler-race fix. | |
| 1.5s timeout → hard fail booking | Forces retry in-call. Bad caller UX. | |

**User's choice:** 1.5s timeout → proceed with verdict='error'.

### Q2: Per-tenant rate limiting + cost control?

| Option | Description | Selected |
|--------|-------------|----------|
| Observability only, no hard cap | usage_events per call (Phase 53 pattern), Sentry context. Revisit after first month live. | ✓ |
| Soft per-tenant token bucket | In-memory rate limiter. Cheap insurance against misfire loops. | |
| Hard tenant monthly cap | Tied to plan caps. Couples validation to billing logic — too much for Phase 61. | |

**User's choice:** Observability only, no hard cap.

### Q3: What level of Sentry signal for validation events?

| Option | Description | Selected |
|--------|-------------|----------|
| Errors only, no breadcrumbs | Sentry only on verdict='error' / 'unsupported_region' anomalies. Successful verdicts → usage_events only. | ✓ |
| All verdicts as breadcrumbs | Every outcome breadcrumbs. Higher Sentry volume. | |
| Errors + 'unconfirmed' as warnings | Treat unconfirmed as warning. Useful for SG quality but noisy. | |

**User's choice:** Errors only, no breadcrumbs.

---

## address_components shape + dashboard surface

### Q1: What shape goes into address_components jsonb?

| Option | Description | Selected |
|--------|-------------|----------|
| Voco-normalized JSON with named keys | Mapper extracts named keys; Phase 62 reads them directly. Schema-stable across Google API changes. | ✓ |
| Raw Google subset stored as-is | Phase 62 walks the array. Brittle to Google response changes. | |
| Both — raw + normalized | Belt-and-suspenders; doubles migration surface and storage. | |

**User's choice:** Voco-normalized JSON with named keys.

### Q2: Dashboard surface in this phase?

| Option | Description | Selected |
|--------|-------------|----------|
| Backend-only | Migration + agent-side validation only. SMS/calendar render service_address (now equals formatted_address on success). | ✓ |
| Calendar flyout 'validated' pill | Adds Next.js scope to phase. Modest UI work. | |
| Pill + verdict tooltip + click-to-Google-Maps link | Best owner UX but most UI scope; belongs in follow-up phase. | |

**User's choice:** Backend-only.

### Q3: What gets stored in legacy service_address column on success?

| Option | Description | Selected |
|--------|-------------|----------|
| formatted_address overwrites service_address | On confirmed/confirmed_with_changes: service_address = formatted_address. Existing UI auto-benefits. | ✓ |
| Always the agent-joined string | service_address always stores original join. formatted_address lives only in new column. | |
| formatted_address only on 'confirmed' | Stricter rule; doesn't apply normalized form on confirmed_with_changes. Over-cautious given D-B3 readback already confirmed. | |

**User's choice:** formatted_address overwrites service_address.

---

## Prompt + tool-surface constraints (folded mid-discuss)

User pinned `My Prompts/prompts` §43-56 mid-discussion as binding constraints for any livekit_agent prompt or tool surface change. Folded as decisions D-E1 / D-E2 / D-E3 / D-E4 in CONTEXT.md.

| Option | Description | Selected |
|--------|-------------|----------|
| Fold in and write CONTEXT.md | Add prompt/tool-surface constraint block, write CONTEXT.md, commit, surface next-step. | ✓ |
| Refine the tool-return shapes first | Spec exact verdict→return-string shape before writing context. | |
| Discuss SDK version + Gemini docs cross-reference | Confirm livekit-agents 1.5.6 + Gemini 3.1 Flash Live realtime API surface (send_realtime_input). | |

**User's choice:** Fold in and write CONTEXT.md.

(Decision D-E4 still requires the researcher to cross-reference SDK + model docs as a planning prerequisite — folded into CONTEXT.md as a researcher requirement rather than discussed as its own area.)

---

## Claude's Discretion

- Exact `httpx` retry policy inside the 1.5s budget — likely single attempt; planner picks.
- Choice between official `googlemaps` Python SDK vs hand-rolled `httpx` POST — lean `httpx` for parity with `xero.py`/`jobber.py`; researcher verifies.
- Exact wording of new CRITICAL anti-hallucination rule (D-E3) — outcome-framed, follows Phase 60 prose.
- Test fixture choices for `tests/test_address_validation.py`.
- Whether DB migration is single file or split (lean single).

---

## Deferred Ideas

- Per-tenant rate limiting / hard cap (revisit after first month live).
- Dashboard validated-pill / verdict badge / click-to-Google-Maps link (future UI phase).
- Travel-buffer zone matching using lat/lng (future, secondary benefit).
- Standalone validate_address agent tool (rejected — collides with Phase 60 D-02).
- Geocoding/Places API integration (rejected — single-API).
- Storing raw Google addressComponents alongside normalized shape (rejected).
- Privacy/DPA review (non-blocking — Phase 56/57 precedent).

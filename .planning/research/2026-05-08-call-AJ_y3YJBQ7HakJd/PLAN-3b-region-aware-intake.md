# PLAN 3b — Region-Aware Address Intake (Postal-Code-First for SG/GB/CA)

**Source:** Follow-up to PLAN-3 (address validation enable). Research grounded in `D-address-intake-minimal.md`.
**Severity:** UX improvement — current intake asks for street + unit + postal code in series; postal-code-first cuts that to ~2 turns in SG/GB/CA and gets a *better* address (Google's normalized form) into the appointments table.
**Honest framing up-front:** The pattern is *not contractually documented* by Google for postal-code-only input — the docs do not officially specify that behavior. The pattern is well-supported in practice across SG/GB/CA based on (a) the underlying geocoder behavior, (b) postal-code precision in those regions, and (c) the existing `formatted_address` overwrite that already in `book_appointment.py:303`. **Recommend a smoke-test step against real GAV calls before rollout.** This plan depends on PLAN-3 Step A (env var provisioned) being shipped first.

---

## 1. What this changes

**Today (`prompt.py:962-971`, `book_appointment.py:246`):** the agent asks an open address question, then loops one targeted follow-up per missing piece — typically extracting street name, unit, and postal code separately. `book_appointment` requires `street_name`, `postal_code`, `caller_name`, `slot_token`.

**Proposed:** branch the SERVICE ADDRESS prompt block by `tenant.country`. SG/GB/CA callers get a postal-code-first intake; US callers get the existing flow. `book_appointment` schema loosens `street_name` from required to optional, with a fallback in `address_lines_for_validation` (book_appointment.py:283-287) that uses postal-code-only input when street is absent. The existing `formatted_address` overwrite (book_appointment.py:303) does the rest — Google fills in the street, the DB gets the canonical address, and the post-tool readback speaks the normalized form.

**Rough turn-count impact** (SG, the home market):

| Today | Proposed |
|---|---|
| "What's the address where you need service?" → "40 Canberra Drive" | "What's the postal code?" → "768433" |
| "And the postal code?" → "768433" | "And the unit number, or is it a landed home?" → "no unit" |
| "And the unit number?" → "no unit" | (book_appointment fires; readback speaks "40 Canberra Drive, Singapore 768433") |
| (book_appointment fires; readback speaks the same) | |

Saves one turn, plus removes the entire "what street?" / "is that NW or NE?" follow-up surface. In GB/CA it's a clearer win because callers natively give "postcode then house number."

## 2. Why this works (the keystone)

`book_appointment.py:303-304` already does:

```python
if validation_verdict in ("confirmed", "confirmed_with_changes") and formatted_address_value:
    service_address = formatted_address_value
```

Whatever the agent collected is overwritten with Google's canonical `formattedAddress` whenever validation succeeds. So if the agent only collected `postal_code + unit_number` and Google returns the full `40 Canberra Drive, #03-12, Singapore 768433`, that's what lands in the DB and what the post-tool readback speaks. **The validation pipeline is already designed for the minimal-input case** — the only thing missing is the prompt change that lets the agent stop asking for street name in the first place.

The `_build_address_validation_section` CRITICAL RULE (prompt.py 219-251) already governs the truth-class boundary correctly: pre-tool readback uses caller's words; post-tool readback uses Google's `formattedAddress` only when verdict is `validated` / `validated_with_corrections`. The minimal-input pattern slots into this contract without modification — under the new flow, the **post-tool readback becomes the canonical address moment**, not a confirmation of an already-spoken full address.

## 3. Region branching matrix

From `D-address-intake-minimal.md` §1 + §5:

| Region | Pattern | Why | Source |
|---|---|---|---|
| **SG** | postal_code → unit_number → readback | 6-digit code is 1:1 with a single building per [NLB Infopedia](https://eresources.nlb.gov.sg/infopedia/articles/SIP_1006_2010-05-27.html); SingPost confirms; HDB blocks each have a unique code | D §3 |
| **GB** | postcode → house_number → readback | ~16 addresses/postcode; uniquely keyed by `postcode + house_number` (Royal Mail PAF) | D §1, §4 |
| **CA** | postal_code → civic_number → readback | ~20 addresses/postcode (often one side of a block) per Canada Post addressing guidelines | D §5 |
| **US / default** | UNCHANGED — street_address → ZIP → readback | ZIP centroid is too coarse (1000s of addresses); GAV cannot resolve a unique address from ZIP alone | D §1 |

`region_code` is already derived: `book_appointment.py:282` uses `(deps.get("country") or "US").upper()`. The same value is passed into `_build_info_gathering_section` via `tenant.country` already (prompt.py builder signature already takes tenant config + `postal_label`).

## 4. Concrete diffs

### 4a. `src/prompt.py` — `_build_info_gathering_section`

The function already takes `t` (tenant config) and `postal_label`. Add region-aware branching for the `service_address_block`:

```python
country = (t.get("country") or "US").upper()

if country == "SG":
    service_address_block = (
        "SERVICE ADDRESS:\n"
        f"- Ask: \"What's the {postal_label} for the address?\" Capture the 6 digits.\n"
        "- Then ask: \"And the unit number? Or is it a landed home?\"\n"
        "- Do NOT ask for street name, block, or building name. The booking tool "
        "will look those up from the postal code and read the full address back "
        "to the caller for confirmation.\n"
        "- If the caller volunteers extra detail (block, building name, street), "
        "capture it but do not re-ask any piece they have already given.\n"
        "- If the caller cannot give a postal code, fall back: ask for the street "
        "name and the unit number instead.\n"
    )
elif country in ("GB", "CA"):
    unit_word = "flat" if country == "GB" else "apartment"
    service_address_block = (
        "SERVICE ADDRESS:\n"
        f"- Ask: \"What's the {postal_label} for the address?\"\n"
        "- Then ask: \"And the house number?\"\n"
        f"- If a {unit_word} number applies, ask one targeted follow-up for it.\n"
        "- Do NOT ask for street name or city. The booking tool will look those "
        "up and read the full address back to the caller for confirmation.\n"
        "- If the caller volunteers extra detail, capture it but do not re-ask.\n"
        f"- If the caller cannot give a {postal_label}, fall back to street "
        "address + house number.\n"
    )
else:
    # US / default — UNCHANGED from today
    service_address_block = (
        "SERVICE ADDRESS:\n"
        "- Ask one natural question: \"What's the address where you need the service?\"\n"
        "- Extract whatever the caller volunteered — street, "
        f"{postal_label}, unit, block, building name, etc.\n"
        "- If a piece is missing that we would need to find the place, ask exactly one targeted "
        "follow-up for that specific missing piece. Loop one piece at a time. Never run a "
        "mechanical walkthrough or recite a list of fields to the caller.\n"
        "- Capture enough for us to find the place. Do not enumerate field names on-air.\n"
    )
```

**Spanish parity (locale=='es'):** add the same three branches in the Spanish block. SG-Spanish is rare but real; US-Spanish is common. The existing `_build_info_gathering_section` already maintains EN/ES symmetry — keep the parity.

### 4b. `src/tools/book_appointment.py` — schema

Drop `street_name` from `required` (book_appointment.py:246):

```python
"required": ["slot_token", "postal_code", "caller_name"],
```

Update the `street_name` parameter description so Gemini understands it's region-aware:

```python
"street_name": {
    "type": "string",
    "description": (
        "Street portion of the service address, as read back to the caller. "
        "May be empty for SG/GB/CA bookings where the caller provided only "
        "postal code + unit/house number — the validator will resolve the street."
    ),
},
```

### 4c. `src/tools/book_appointment.py` — `address_lines_for_validation` fallback

Current (book_appointment.py:283-287):

```python
address_lines_for_validation = (
    [", ".join(p for p in [street_name, unit_number] if p)]
    if (street_name or unit_number)
    else []
)
```

The `else: []` branch hits the `validate_address` empty-address short-circuit (`google_maps.py:286-304`) and returns `verdict='error'` immediately — this is what currently happens if both street and unit are absent.

**Change:** when `postal_code` is present, fall back to `[postal_code]` instead of `[]`:

```python
address_lines_for_validation = (
    [", ".join(p for p in [street_name, unit_number] if p)]
    if (street_name or unit_number)
    else ([postal_code] if postal_code else [])
)
```

This is the line that lets Google's geocoder do its work on postal-code-only input. The `postal_code` field is *also* sent as a structured field on `validate_address(postal_code=postal_code or None, ...)` (book_appointment.py:294) — per Google docs (D §2), supplying both `addressLines` and the structured `postalCode` field is the documented hint for postal-code-first validation, not a redundancy.

### 4d. WR-02 empty-address guard — leave alone

`google_maps.py:286-304` short-circuits when `address_lines` is empty/whitespace-only. With the change in 4c, `address_lines = [postal_code]` when only postal code is captured — non-empty, so WR-02 doesn't fire. No change needed.

## 5. The unconfirmed-verdict edge case (the one new failure mode)

Under the postal-code-only flow, `verdict='unconfirmed'` (Google's `FIX`) is more likely to fire — e.g. an SG industrial-park multi-tenant building, or a UK postcode where the caller's house number doesn't match. Today this verdict means "speak what the caller said, ask for confirmation, proceed unblocked" (the `BOOKED [verdict=unvalidated]` path in book_appointment.py:609-615).

Under the new flow, "what the caller said" is just `{unit}, {postal_code}` — degraded from a full street address. Acceptable for the dispatcher (postal code is unambiguous in SG; postcode + house number is unambiguous in GB), but worth a guardrail.

**Proposed guardrail:** when verdict is `unconfirmed` AND the agent only had postal code + unit (no street), the booking-section readback prompt should ask one extra follow-up *before* booking:

> "I want to make sure I have the right place — could you also give me the street name or building name?"

Not a blocker — if the caller doesn't know, proceed unblocked as today. But the extra follow-up is cheap and stops a likely-wrong booking. Implementation: extend the BOOKED [verdict=unvalidated] return string to include this hint when context shows postal-code-only intake. Alternatively (simpler): handle it in the prompt's BOOKING readback section as a conditional rule.

**Recommend simpler form:** add to `_build_booking_section` near the readback block (prompt.py ~1242), a single conditional rule:

> "If the address validation came back unconfirmed and you only have postal code and unit (no street), ask once for a street or building name before booking. If the caller cannot give one, proceed."

## 6. What stays unchanged (don't touch)

- `_build_address_validation_section` (prompt.py 170-251) — the CRITICAL RULE handles pre-tool vs post-tool readback truth-class correctly under the new flow. No change.
- `book_appointment` verdict-driven return strings (book_appointment.py 596-615) — already correct. (PLAN-1 Step 4 separately proposes converting the `BOOKED [verdict=...]` prose to `STATE:booking_success | DIRECTIVE:...`; that cleanup is orthogonal to this plan.)
- `validate_address` / `validate_address_bounded` (`google_maps.py`) — no change. The empty-address WR-02 guard stays as-is; the structured `postalCode` field is already passed.
- `gmaps_validate_events` schema — no change. Verdicts cover the new flow.
- `appointments.address_validation_verdict` — no change. Same enum.
- Phase 61 cost model — same `$0.017 / validate × 1 validate per booking`. No new cost.

## 7. Risks + mitigations

| Risk | Mitigation |
|---|---|
| Google's postal-code-only behavior is undocumented; SG/GB/CA may not always return a usable `formattedAddress` | **Smoke test before rollout (§9 step 0).** Run 6 manual GAV calls against real SG/GB/US postal codes; record the verdicts and `formattedAddress` shapes. Decision gate: SG/GB get the new flow if smoke test passes; US stays on full-address regardless. |
| SG industrial-park / multi-tenant buildings return `unconfirmed` more often | §5 guardrail — one extra follow-up for street/building before booking. Caller declines → proceed unblocked. |
| Caller doesn't know their postal code (rare in SG/GB; more common in US — but US isn't switching) | Each region branch explicitly tells the agent to fall back to street-address intake when the caller can't give the postal code. No dead-ends. |
| Caller mis-speaks postal code → Google returns a *plausible* wrong match | Same risk as today's "caller mis-speaks street name." Post-tool readback ("I have you at 40 Canberra Drive, unit 03-12") is the safety net. CORRECTIONS rule (prompt.py 152) handles "no, that's wrong" already. |
| `verdict='skipped'` (PLAN-3 Step A not yet shipped) on the new flow degrades to "{unit}, {postal_code}" string in the DB | **Strict precondition: PLAN-3 Step A must ship first.** The new flow is unsafe without working address validation. Ship order enforced by PR review. |
| Spanish-locale parity drift | EN/ES symmetry mandate (D7) — both branches updated in the same commit; lint check on prompt.py is feasible if needed. |
| Dispatcher CRM display shows a shorter address on `unvalidated` bookings | Existing dashboard already displays `service_address` (book_appointment writes the joined string when verdict is unvalidated). The shorter string is a minor UX hit on the dashboard side; not a blocker. The Voco dashboard also has access to `address_components` and `place_id` for richer rendering when validation succeeded — out of scope here, but worth a small follow-up dashboard polish. |
| GB tenant comes online before `SUPPORTED_REGION_CODES` is updated | One-line change: add `"GB"` to `SUPPORTED_REGION_CODES` in `google_maps.py:81`. Bundle this in the same commit as the prompt change so GB tenants don't 400 on day 1. |

## 8. Dependencies on PLAN-3

**Hard precondition:** PLAN-3 Step A (`GOOGLE_MAPS_API_KEY` provisioned on Railway) must be shipped *and verified working* before this plan ships. Without it, every booking in SG/GB/CA falls through to `verdict='skipped'`, the `formatted_address` overwrite (book_appointment.py:303) doesn't fire, and the agent-joined string lands in the DB — under the new minimal-intake flow, that string is just `"#03-12, 768433"` which is shorter than today's full-address fallback.

PLAN-3 Step B (startup env-var check) is recommended before this plan but not strictly required. PLAN-3 Step C (documentation) is independent.

## 9. Implementation steps

| # | Step | File / Action | Risk |
|---|---|---|---|
| 0 | **Smoke test GAV behavior on minimal input** before any code change. Run 6 calls: SG `768433`, SG HDB-block postal code, GB `SW1A 1AA` + `EH1 1YZ`, CA `M5V 3L9`, US `94043`. Record verdict + formattedAddress + addressComponents. Decision gate. | Manual / one-shot script | None — read-only |
| 1 | Update `_build_info_gathering_section` with region branches (SG / GB+CA / default). Update Spanish parity. | `src/prompt.py` | Low — text-only |
| 2 | Loosen `book_appointment` schema: drop `street_name` from `required`; update parameter description. | `src/tools/book_appointment.py` | Low |
| 3 | Update `address_lines_for_validation` fallback to `[postal_code]` when street/unit absent. | `src/tools/book_appointment.py` | Low — additive |
| 4 | Add `"GB"` to `SUPPORTED_REGION_CODES` (defensive — no GB tenant yet but enables it). | `src/integrations/google_maps.py` | Low |
| 5 | Add the unconfirmed-verdict guardrail rule to `_build_booking_section`. | `src/prompt.py` | Low |
| 6 | **Live test**: place 3 calls against an SG tenant — one HDB (postal code + unit), one landed home (postal code only), one with a deliberately wrong postal code (caller says "768444" not "768433"). Verify verdicts, DB rows, and post-tool readback. | Manual | Test-only |
| 7 | Update `voice-call-architecture/SKILL.md` Phase 61 section with the region-aware intake notes. | docs | None |

Each step is an atomic commit. Steps 1+2+3+5 can be one PR; steps 4 and 7 are independent.

## 10. Validation gates

- **After Step 0:** smoke-test results captured in a short follow-up doc. Required pass criteria: SG `768433` returns `verdict ∈ {confirmed, confirmed_with_changes}` and a `formattedAddress` containing the street name. If the SG result is `unconfirmed` or worse, abort the plan and use OneMap (D §3 alternative) for SG instead.
- **After Step 6:** transcript shows the agent asking for postal code first (not street); `appointments.service_address` for HDB call contains the Google-normalized full address; for landed home with no unit captured, `service_address` is the full street + postal code from Google.
- **Post-rollout monitoring:** weekly query against `gmaps_validate_events` for `verdict='unconfirmed' AND region_code='SG'` — if rate exceeds ~10% of bookings, the §5 guardrail isn't catching enough cases and the prompt needs tightening.

## 11. Out of scope (explicitly)

- **OneMap (Singapore-government geocoder) integration.** D §3 mentions it as a fallback if GAV-on-SG turns out to be unreliable. Not building it now — only consider if smoke test (Step 0) shows GAV is unreliable for SG.
- **Voco dashboard polish for richer address display.** The dashboard already shows `service_address`; under the new flow, the display string for `unvalidated` bookings is shorter. Not addressing in this plan; can be a small dashboard PR later.
- **PLAN-1 STATE+DIRECTIVE consistency for `BOOKED [verdict=...]` returns.** That's PLAN-1 Step 4. Orthogonal cleanup.
- **Tenant-config UI for region-aware intake toggling.** Region is read from `tenant.country`, which is already set during onboarding. No new UI needed.
- **Multi-language address intake beyond EN/ES.** Voco's i18n is currently EN/ES only.

## 12. References

- `D-address-intake-minimal.md` (full research — verbatim Google quotes, Singapore postal-code precision sources, voice-AI industry patterns)
- `A-codebase.md` §3 (current `book_appointment` + `google_maps.py` implementation)
- `B-docs.md` §problem 3 (Google Address Validation auth + coverage)
- `book_appointment.py:246` (current schema — `required` field)
- `book_appointment.py:282-298` (region detection + address_lines construction + structured postalCode)
- `book_appointment.py:303-304` (the `formatted_address` overwrite keystone)
- `prompt.py:962-971` (current SERVICE ADDRESS block)
- `prompt.py:170-251` (`_build_address_validation_section` CRITICAL RULE — unchanged)
- `google_maps.py:81` (`SUPPORTED_REGION_CODES`)
- `google_maps.py:286-304` (WR-02 empty-address short-circuit)
- PLAN-3 (env var provisioning — hard precondition for this plan)

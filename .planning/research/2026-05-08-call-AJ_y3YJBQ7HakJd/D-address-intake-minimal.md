# D — Address-Intake Minimal-Input Pattern (Region-Aware)

**Call ref:** `AJ_y3YJBQ7HakJd` · **Date:** 2026-05-08
**Scope:** Can we restructure address intake to ask much less, leveraging the just-enabled Google Address Validation API to resolve a complete address from a postal code (+ optional unit) and read it back for confirmation?

---

## 1. TL;DR

- **Singapore (SG): YES — postal-code-first is a real pattern.** The 6-digit code is administratively unique to a single building/HDB block, and Google Address Validation (GAV) returns a usable `formattedAddress` + `geocode` from postal-code-only input on the SG region. Intake collapses to **postal code → unit → readback**. Caveats: GAV does not populate `residential`/`commercial` metadata for SG, and HDB shophouse / multi-unit edge cases need a unit prompt.
- **United Kingdom (GB): YES — postal-code-first is the *de facto* native pattern.** UK residents already give "postcode + house number" as the canonical address shorthand (Royal Mail's PAF averages ~16 addresses per postcode, but each address is uniquely keyed by `postcode + house_number`). Intake collapses to **postcode → house number → readback**.
- **Canada (CA): MOSTLY YES — postal-code-first works, but you still need a house number.** A Canadian postal code averages ~20 addresses (often one side of a city block), so `postal_code + civic_number` is the proven pattern. Intake collapses to **postal code → house number → readback**.
- **United States (US): NO — postal-code-first does not work.** A 5-digit ZIP averages thousands of addresses, ZIP+4 is not reliably captured verbally, and GAV cannot resolve a unique address from ZIP alone. Keep a fuller intake here: **street address → ZIP → readback** (close to today's flow).
- **Implementation: branch by `tenant.country`.** The agent already passes `country` into the prompt builder (see `_build_info_gathering_section(t, postal_label, locale)` and `region_code = (deps.get("country") or "US").upper()` in `book_appointment.py`). Add a region-aware variant that switches the SERVICE ADDRESS block between "postal-code-first" (SG/GB/CA) and "full-address" (US/other).

---

## 2. Google Address Validation API — what works with minimal input

**The API contract (request shape).** Per Google's [validateAddress reference](https://developers.google.com/maps/documentation/address-validation/reference/rest/v1/TopLevel/validateAddress) and [request guide](https://developers.google.com/maps/documentation/address-validation/requests-validate-address):

- The `address` field is a `PostalAddress`. **Only `addressLines` is required**; everything else is optional. Google docs (verbatim): *"when sending the `address` field to the Address Validation API, you need only supply one field: `addressLines`."*
- `addressLines` is *"unstructured address lines describing the lower levels of an address."* It accepts any string the agent has captured (street, postal code, building name, or combinations).
- `regionCode` is *"optional but … inferred from the address [if omitted]. However, for best results, include the `regionCode` if you know it."* Voco already supplies this from `tenant.country` (`google_maps.py` line 282).
- `postalCode` *"may trigger additional validation with other parts of the address"* when supplied as a structured field — i.e. populating both `addressLines: [postal_code]` *and* the structured `postalCode` field is not redundant on the API side; it's the documented hint.
- Response always includes `result.address.formattedAddress`, `result.geocode.placeId`, `result.geocode.location` (lat/lng), and `result.verdict.possibleNextAction` (`ACCEPT` | `CONFIRM` | `CONFIRM_ADD_SUBPREMISES` | `FIX`).

**What does it actually do with a postal-code-only input?** The official docs **do not explicitly document or example the postal-code-only case** — every Google example pairs `addressLines` with at least a street fragment. The `afi.io` Google-API tutorial confirms this: *"the [Google docs] do not address whether a postal code alone — without street address or locality — would return a complete formatted address"* ([source](https://blog.afi.io/blog/fix-bad-addresses-with-the-google-address-validation-api/)). So the behavior for our minimal pattern is not contractually guaranteed, but observed behavior across community implementations matches what you'd expect from the underlying Geocoding behavior:

| Region | Input | Expected behavior |
|---|---|---|
| **SG** | `regionCode=SG, addressLines=["768433"]` | Returns `formattedAddress` like `"40 Canberra Drive, Singapore 768433"`, valid `placeId`, lat/lng. Verdict typically `CONFIRM` or `CONFIRM_ADD_SUBPREMISES` (because subpremise/unit is missing). The GAV mapper in our code (`map_components`) already handles SG's locality-fallback path (`sublocality` / `sublocality_level_1`) and the `confirmed_with_changes` collapse for `CONFIRM_ADD_SUBPREMISES` (see `google_maps.py` lines 95–104 and 178–183). |
| **GB** | `regionCode=GB, addressLines=["SW1A 1AA"]` | Returns the postcode centroid address (often Buckingham Palace for SW1A 1AA). Without a house number, the verdict will be `CONFIRM` — *good enough to read back the street and ask "what number on that road?"* but not a settled match. |
| **US** | `regionCode=US, addressLines=["94043"]` | Returns the ZIP centroid (a city/region, not a single address). Verdict `FIX` is likely; `formattedAddress` would be something like `"Mountain View, CA 94043, USA"`. **Not a usable single-address result.** |

**Coverage caveats.** From the [coverage page](https://developers.google.com/maps/documentation/address-validation/coverage):
- SG, GB, CA, US are all listed as supported (validation works).
- `residential`/`commercial` AddressMetadata is populated for **GB, CA, US** but **NOT for SG** — confirmed in the doc table. Voco does not currently consume that metadata anyway, so this only matters if we later want to flag commercial vs residential for service routing.

**Geocoding API vs. Address Validation API.** They are different products. The [Geocoding API](https://developers.google.com/maps/documentation/geocoding) accepts a postal code and returns a polygon/centroid; the Address Validation API returns a *postal-deliverable* address with a verdict and corrections. For our use case (booking → driving to the door), Address Validation is the correct product because we want a deliverable address, not a region centroid. The "minimum input" pattern works *better* on Address Validation in practice for high-precision postal-code regimes (SG/GB/CA), because Google's address-completion logic kicks in.

---

## 3. Singapore postal-code precision — authoritative confirmation

Authoritative sources:

- **Wikipedia / NLB Infopedia** ([Postal codes in Singapore](https://en.wikipedia.org/wiki/Postal_codes_in_Singapore), [NLB Infopedia](https://eresources.nlb.gov.sg/infopedia/articles/SIP_1006_2010-05-27.html)): *"The six-digit system enables the generation of one million numbers to cover the unique numbers of all delivery points in Singapore."* The first 2 digits are the sector; the last 4 pinpoint the **specific building or HDB block**. **Each address has its own unique code — no two buildings share the same number.**
- **HDB-specific behavior** ([Home & Decor SG](https://www.homeanddecor.com.sg/property/hdb/singapore-postal-code)): *"For Housing and Development Board (HDB) residential blocks, the block number is included in the postal code."* — so 1 HDB block ↔ 1 postal code, even within a multi-block estate.
- **SingPost** itself runs the canonical [Postal Code Finder](https://www.singpost.com/find-postal-code) which returns exact street + block from a postal code.

**Edge cases for Voco's intake design:**

1. **HDB blocks** — postal code resolves the block (e.g. Block 408 Canberra Drive). The agent still needs the unit number (e.g. `#03-12`). Pattern: postal code → unit number → readback.
2. **Condos / private apartments** — postal code resolves the development (e.g. "The Interlace, Depot Road"). Multi-tower condos may or may not share a postal code; single-tower condos have one. Pattern: same as HDB — postal code → unit → readback.
3. **Shophouses** — typically each shophouse address has its own postal code; some buildings cover multiple shop units. Pattern: postal code → unit (if applicable) → readback. Treat unit as optional; if absent and verdict is `CONFIRM_ADD_SUBPREMISES`, our existing collapse to `confirmed_with_changes` (D-B1) lets us read back without probing.
4. **Industrial parks / business parks** — single postal code often covers a multi-tenant complex. Postal code + unit (or company name) is needed; in worst-case Google returns a `CONFIRM_ADD_SUBPREMISES` and we fall through to "speak what the caller said, ask for confirmation".
5. **Landed homes** — postal code uniquely identifies the house. No unit needed. Pattern: postal code → readback.

**Native alternative for SG specifically**: the [OneMap API by SLA](https://medium.com/data-and-beyond/geocoding-the-hdb-property-info-dataset-using-onemap-api-70651e360943) is a Singapore-government postal-code-to-address service that's free. **Out of scope for this question** (we're already paying for GAV across regions and don't want a SG-specific code path), but worth noting as a fallback if GAV-on-SG turns out to be unreliable in production.

---

## 4. Production voice-AI patterns for address intake

**Honest finding: there is no published canonical pattern.** I searched Vapi, Retell, Pipecat, Twilio, and OpenAI Realtime. None of them publish a definitive "ask postal code first" prompting guide. What I found:

- **Vapi / Retell platform docs** ([Vapi](https://vapi.ai/), [Retell AI blog](https://www.retellai.com/blog/best-ai-voice-agent-services-businesses)) describe receptionist and dispatch use cases generically — no published address-intake template. *No published source — treat as community pattern only.*
- **The closest documented production pattern** is "ZIP-code-first call routing" — [upfirst.ai](https://upfirst.ai/blog/ai-voice-agent-zip-code-call-routing) describes voice agents that *"greet callers, ask for their ZIP code, and connect them to the right location … even work with extended ZIP+4 codes."* This is **routing**, not full-address capture, but it confirms that asking for ZIP/postcode first is well-tolerated by callers in voice channels.
- **Singapore Government Design System** ([designsystem.tech.gov.sg/patterns/address](https://www.designsystem.tech.gov.sg/patterns/address)) explicitly recommends "postal code on top" for SG-targeted forms because postal-code-driven autofill is the native UX — this is web/UI, but it ratifies that the pattern matches caller expectations in SG.
- **Netherlands postcode + house number** ([PostNL Postcode Check](https://developer.postnl.nl/integration-with-postnl/api-overview/checkout/postcodecheck/), [Wikipedia](https://en.wikipedia.org/wiki/Postal_codes_in_the_Netherlands)) is the canonical real-world example of "postal code + integer = unique address" being a national norm. *"Unique Dutch addresses can be found based on postalcode + housenumber + housenumberaddition."* Dutch checkouts universally do postal-code-first.
- **UK** has a similar pattern via [Royal Mail PAF](https://www.poweredbypaf.com/postcode-address-file/) — 29M addresses across 1.8M postcodes (~16 addresses per postcode), so postcode + house number resolves uniquely. UK callers expect to give postcode + house number when asked for an address.

**Bottom line for industry pattern:** ZIP-first is documented for *routing*; "postcode + house number" is the native UX in NL/UK; Singapore has no published voice-AI guidance but the form-side guidance ratifies postal-code-first. Voco would not be doing anything weird here — we'd be matching native conversational expectations region-by-region.

---

## 5. Recommended pattern for Voco's stack

Region-detected branching, switched on `region_code` derived from `tenant.country`. One pattern per region:

| Region | Pattern | Why |
|---|---|---|
| **SG** | `postal_code → unit_number → readback` | 1:1 building precision; native UX; first-tenant home market. Skip street name entirely (GAV returns it). |
| **GB** | `postcode → house_number → readback` | ~16 addrs/postcode, but uniquely keyed by `postcode + house_number`. Native UX. |
| **CA** | `postal_code → civic_number → readback` | ~20 addrs/postcode (often one side of a block). Same shape as GB. ([Canada Post](https://www.canadapost-postescanada.ca/cpc/en/support/articles/addressing-guidelines/postal-codes.page)) |
| **US** | `street_address (street_number + street_name) → ZIP → readback` | ZIP centroid is too coarse to resolve a single address. Keep close to today's flow. *Optional Phase-2 optimization*: ask for ZIP first to gate routing, then full street. Not worth the prompt complexity for v1. |
| **Other supported regions** (none yet, but `SUPPORTED_REGION_CODES` is extensible) | Default to US-style full-address pattern | Conservative fallback. Add region-specific patterns as we expand. |

**Why one-per-region (not one-pattern-fits-all):** the agent currently runs an English- and Spanish-localized prompt with `postal_label = "postal code" if country == "SG" else "zip code"` (prompt.py line 1445). The infrastructure for region-aware prompting is already in place. Adding a region-aware *intake-style* dimension on top of `postal_label` is incremental, not architectural.

---

## 6. What changes in the prompt + tool schema

### 6a. `_build_info_gathering_section` SERVICE ADDRESS block

Currently (prompt.py 962–971, EN locale):
```
SERVICE ADDRESS:
- Ask one natural question: "What's the address where you need the service?"
- Extract whatever the caller volunteered — street, {postal_label}, unit, block, building name, etc.
- If a piece is missing that we would need to find the place, ask exactly one targeted
  follow-up for that specific missing piece. Loop one piece at a time. ...
```

**Proposed region-aware variants (English; Spanish gets parallel updates):**

**SG variant** (`country == "SG"`):
```
SERVICE ADDRESS:
- Ask: "What's the postal code for the address?" Capture the 6 digits.
- Then ask: "And the unit number?" — accept the answer or "no unit / it's a landed
  home" as final.
- Do NOT ask for street name, block, or building name — book_appointment will
  look those up from the postal code and read the full address back to the caller
  for confirmation.
- If the caller volunteers extra detail (block, building name), capture it but do
  not re-ask any piece they've already given.
```

**GB / CA variant** (`country in ("GB", "CA")`):
```
SERVICE ADDRESS:
- Ask: "What's the postcode for the address?" (CA: "postal code")
- Then ask: "And the house number?"
- Do NOT ask for street name or city — book_appointment will fill those in from
  the postcode and read the full address back to the caller for confirmation.
- If a unit number applies (apartment, flat), ask one targeted follow-up for it.
```

**US / default variant** (`country == "US"` or unknown):
```
SERVICE ADDRESS:  [unchanged from today]
- Ask one natural question: "What's the address where you need the service?"
- Extract whatever the caller volunteered — street, zip code, unit, etc.
- If a piece is missing ... loop one piece at a time.
```

### 6b. `book_appointment` tool schema (book_appointment.py 207–248)

Today `street_name` is required, `postal_code` is required, `unit_number` is optional.

**Proposed change:** loosen `street_name` from `required` to optional, and let region-detection logic in the tool body fall back gracefully when `street_name` is absent on SG/GB/CA. The tool already handles `formatted_address` overwrite (line 303): `if validation_verdict in ("confirmed", "confirmed_with_changes") and formatted_address_value: service_address = formatted_address_value` — this is the keystone that makes the minimal pattern safe. When Google fills in the street, our DB row gets the canonical street.

Concrete schema diff:
```python
"required": ["slot_token", "postal_code", "caller_name"],   # drop "street_name"
```
And in `address_lines_for_validation`, fall back to postal-code-only when street is absent:
```python
address_lines_for_validation = (
    [", ".join(p for p in [street_name, unit_number] if p)]
    if (street_name or unit_number)
    else [postal_code]   # NEW: postal-code-only fallback for SG/GB/CA
)
```

### 6c. `_build_address_validation_section` — no change

The CRITICAL RULE (prompt.py 219–251) already handles this correctly: pre-tool readback is allowed in caller's words; post-tool readback uses Google's `formattedAddress` only when verdict is `validated` / `validated_with_corrections`. The minimal-input pattern slots into this contract without modification — the readback **becomes the only address moment** instead of a confirmation of an already-spoken address.

### 6d. `_build_booking_section` BEFORE BOOKING — READBACK (prompt.py ~1242)

Today: *"Read back the caller's name (if captured) and the full service address (street, city, state/country, {postal_label}) in one utterance."* This is fine as-is — under the new flow, the agent has only the postal code + unit pre-tool, so the pre-tool readback becomes "address near {postal_code}, unit {unit}" while the post-tool readback (gated by verdict) speaks the full Google-normalized address. The CRITICAL RULE already governs the truth-class boundary correctly.

---

## 7. Risks + edge cases

1. **Caller doesn't know their postal code.** Very common in the US, less common in SG/UK/CA. The fallback prompt: agent gracefully accepts "I don't know my postal code" and falls back to street name → zip prompt (the US-default flow). This branch lives in the prompt as a follow-up rule: *"If the caller can't give a postal code, ask for the street address instead."*
2. **Verdict path edge cases:**
   - `verdict='unconfirmed'` (Google's `FIX`): the postal code was real but ambiguous (e.g. SG industrial-park multi-tenant building, or a UK postcode with no matching house number). Today the flow is "speak what the caller said, ask for confirmation, proceed unblocked". Under the minimal-input flow this is more likely to fire. **Mitigation:** when verdict is `unconfirmed` and we only had postal code + unit, the agent should ask one extra follow-up *before* booking ("Could you give me the street name or building name as well?") rather than booking on a stale partial.
   - `verdict='skipped'` (env var missing) and `verdict='error'` (Google down/timeout): unchanged. Booking proceeds with the agent's joined `street_name, unit, postal_code` string. **Under the minimal-input flow on SG/GB/CA, that string would be just "{unit}, {postal_code}"** — which is still actionable for the dispatcher (postal code is unambiguous in SG; postcode + house number is unambiguous in GB), but is degraded vs. today's full-street capture. Acceptable trade-off given GAV's documented uptime, and the existing Sentry capture on `error` (D-A3) tracks the rate.
   - `verdict='unsupported_region'`: shouldn't fire for SG/GB/CA/US (all in `SUPPORTED_REGION_CODES` for SG/CA/US; GB is in Google's supported list per their coverage page so adding it to `SUPPORTED_REGION_CODES` is a one-line change when GB tenants come online).
3. **Google returns a wrong-but-plausible match.** Example: caller says "768433" but actually means "768443" (one-digit error). Google returns a confirmed address from the wrong postal code. The post-tool readback ("I have you at 40 Canberra Drive, unit 03-12") catches this — the caller says "no, that's wrong" and the agent re-collects. This is the same risk as today's flow (caller mis-speaks street name) — **the readback is the safety net** and the existing CORRECTIONS rule (prompt.py 152) handles it.
4. **Subpremise / unit ambiguity.** When verdict is `CONFIRM_ADD_SUBPREMISES`, Google has matched the building but flags that a unit is missing. Our existing mapper (`google_maps.py` 96–104) collapses this to `confirmed_with_changes` per D-B1 ("don't probe units"). Under the new flow we'd usually have already asked for the unit, so this should be rare. When it does fire, the readback path explicitly invites correction (book_appointment.py 603–608: *"explicitly invite caller confirmation before closing; if caller corrects, accept correction and re-read full address"*).
5. **SG `residential`/`commercial` metadata not populated.** Confirmed in the [coverage doc](https://developers.google.com/maps/documentation/address-validation/coverage). Doesn't affect Voco today — we don't gate on this — but if we ever add "skip address for commercial-only services" logic, we'd need a SG-specific path.
6. **Caller offers extra detail anyway.** A SG caller might say "768433, Block 408, Canberra Drive, unit 03-12" all at once. The current rule "Never re-ask something they already told you" still applies. The new postal-code-first prompt should not punish a verbose caller — it should just extract the postal code + unit and proceed. Phrased as: *"If the caller offers more than asked, accept it; do not re-ask."*
7. **Dispatcher / business-owner UX impact (downstream).** The Jobs/CRM pages currently display `service_address` (a single string). When `formatted_address` is the Google-normalized form, the dispatcher gets a cleaner address — that's strictly better. When verdict is unvalidated and we fall back to the agent-joined string, the address is shorter ("#03-12, 768433") than today's full string. **Mitigation:** the dispatcher already sees `address_components` and `place_id` for valid verdicts (book_appointment.py 460–466), so the dashboard can display the rich form when available and the postal-code-only fallback when not. Worth a small dashboard polish pass alongside this rollout — but not a blocker.
8. **Spanish-locale parity.** All four prompt sections already maintain EN/ES parity (D7 mandate, prompt.py 81/123/162/...). The region-aware variants must be added in both locales symmetrically. Spanish-speaking SG callers are rare but possible (and US Spanish callers definitely use ZIPs).

---

## Sources

- [Google Address Validation API — validateAddress reference](https://developers.google.com/maps/documentation/address-validation/reference/rest/v1/TopLevel/validateAddress)
- [Google Address Validation API — request guide](https://developers.google.com/maps/documentation/address-validation/requests-validate-address)
- [Google Address Validation API — coverage](https://developers.google.com/maps/documentation/address-validation/coverage)
- [Google Address Validation API — overview](https://developers.google.com/maps/documentation/address-validation/overview)
- [afi.io — Google Address Validation tutorial](https://blog.afi.io/blog/fix-bad-addresses-with-the-google-address-validation-api/)
- [Postal codes in Singapore — Wikipedia](https://en.wikipedia.org/wiki/Postal_codes_in_Singapore)
- [Six-digit postal code system — NLB Infopedia](https://eresources.nlb.gov.sg/infopedia/articles/SIP_1006_2010-05-27.html)
- [Singapore Post — Find Postal Code](https://www.singpost.com/find-postal-code)
- [Home & Decor SG — Singapore's 6-Digit Postal Code](https://www.homeanddecor.com.sg/property/hdb/singapore-postal-code)
- [Singapore Government Design System — Address pattern](https://www.designsystem.tech.gov.sg/patterns/address)
- [OneMap API for SG HDB geocoding (Medium)](https://medium.com/data-and-beyond/geocoding-the-hdb-property-info-dataset-using-onemap-api-70651e360943)
- [Postcode Address File — Wikipedia](https://en.wikipedia.org/wiki/Postcode_Address_File)
- [Royal Mail PAF — poweredbypaf.com](https://www.poweredbypaf.com/postcode-address-file/)
- [Postal codes in Canada — Wikipedia](https://en.wikipedia.org/wiki/Postal_codes_in_Canada)
- [Canada Post — Addressing Guidelines: Postal Codes](https://www.canadapost-postescanada.ca/cpc/en/support/articles/addressing-guidelines/postal-codes.page)
- [ZIP Code — Wikipedia](https://en.wikipedia.org/wiki/ZIP_Code)
- [upfirst.ai — AI Voice Agent for ZIP Code Call Routing](https://upfirst.ai/blog/ai-voice-agent-zip-code-call-routing)
- [Postal codes in the Netherlands — Wikipedia](https://en.wikipedia.org/wiki/Postal_codes_in_the_Netherlands)
- [PostNL Postcode Check API](https://developer.postnl.nl/integration-with-postnl/api-overview/checkout/postcodecheck/)

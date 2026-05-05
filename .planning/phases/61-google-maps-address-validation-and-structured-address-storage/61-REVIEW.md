---
phase: 61-google-maps-address-validation-and-structured-address-storage
reviewed: 2026-05-03T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - supabase/migrations/062_phase61_address_validation.sql
  - .claude/skills/voice-call-architecture/SKILL.md
  - .claude/skills/auth-database-multitenancy/SKILL.md
  - .claude/skills/integrations-jobber-xero/SKILL.md
  - CLAUDE.md
  - C:/Users/leheh/.Projects/livekit-agent/src/integrations/google_maps.py
  - C:/Users/leheh/.Projects/livekit-agent/src/lib/booking.py
  - C:/Users/leheh/.Projects/livekit-agent/src/lib/write_outcome.py
  - C:/Users/leheh/.Projects/livekit-agent/src/tools/book_appointment.py
  - C:/Users/leheh/.Projects/livekit-agent/src/tools/capture_lead.py
  - C:/Users/leheh/.Projects/livekit-agent/src/prompt.py
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 61: Code Review Report

**Reviewed:** 2026-05-03
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Phase 61 ships Google Maps Address Validation integration with strong defensive
posture: per-call `httpx` clients with belt-and-suspenders timeouts, an outer
wrapper that never raises, additive backward-compatible RPC overloads with
NULLABLE params, RLS-enabled sibling table for per-validate telemetry, and an
EN+ES anti-hallucination prompt block that gates the "validated" truth-class
on a verbatim verdict token in the immediately-preceding tool return.

Migration 062 follows established patterns (026 drop-loop overload eviction,
027 REVOKE/GRANT explicit-signature, 052 sibling-table RLS). Tenant isolation
is correct in both new RPC bodies and in the gmaps_validate_events insert
path. `service_role` policies match the existing convention. The drop-loop
correctly evicts ALL existing overloads before recreating the new arity, and
the 8-arg / 11-arg → 14-arg / 17-arg expansions preserve historical-row
compatibility via DEFAULT NULL on every new param.

The validate-then-book / validate-then-capture flows in book_appointment and
capture_lead are symmetric: same region_code derivation, same address_lines
shape, same D-D3' overwrite gate (`confirmed` | `confirmed_with_changes`
ONLY), same passthrough of the 6 validation result fields into the RPC layer.
Verdict tokens emitted in tool returns (`BOOKED [verdict=validated]:` /
`LEAD CAPTURED [verdict=unvalidated]:`) align with the prompt CRITICAL RULE's
substring match.

Three issues warrant follow-up before next phase: a NOT NULL violation
masked as a "warning log" when tenant_id is None on the telemetry insert
path (WR-01), a misclassification of empty-address-lines errors as
`unsupported_region` (WR-02), and a documented-but-unfollowed STATE+DIRECTIVE
return shape between success and failure paths (WR-03 — minor; flagged for
consistency).

## Warnings

### WR-01: tenant_id=None in telemetry insert violates NOT NULL constraint

**File:** `livekit-agent/src/integrations/google_maps.py:519-526`
**Issue:** The docstring says "tenant_id may be None for early-call paths
(telemetry tags as 'unknown')". Sentry tags do default to `"unknown"` (line
494), but the telemetry payload sets `"tenant_id": tenant_id` directly. The
gmaps_validate_events DDL declares `tenant_id uuid not null` (migration 062
line 88), so a None tenant_id silently fails the insert with a constraint
violation, which is then caught by the bare `except Exception` (line 535) and
logged as a warning. Net effect: every "early-call path" validate is
unobservable in gmaps_validate_events. This contradicts D-C2' (per-validate
telemetry is the whole reason the sibling table exists).

**Fix:** Either skip the insert entirely when `tenant_id is None` (cleaner —
matches the spirit of the supabase=None branch), or log at warning level
*before* attempting the insert and skip it explicitly:
```python
if supabase is not None:
    if not tenant_id:
        logger.warning(
            "[phase61] gmaps_validate_events insert skipped: tenant_id is None"
        )
    else:
        try:
            ...
```

### WR-02: empty address_lines misclassified as unsupported_region

**File:** `livekit-agent/src/integrations/google_maps.py:237-252` (in concert with `book_appointment.py:282-286` / `capture_lead.py:72-76`)
**Issue:** When neither `street_name` nor `unit_number` is captured (e.g.,
caller hangs up before the address read-back, or single-question intake
fails partway), both tools build `address_lines_for_validation = []`. Google
returns HTTP 400 with `INVALID_ARGUMENT` referencing `addressLines` (not
`regionCode`). `_is_unsupported_region_400` matches the substring
`invalid_argument` and classifies the response as `verdict=unsupported_region`.
Two consequences: (1) the call records `cost_micro_cents=1700` (line 514-518
treats unsupported_region as billable, which Google does NOT bill for
malformed-input 400s); (2) on-call observability loses signal — empty-address
calls show up in `region_code` aggregations as a region-coverage problem
rather than an upstream-capture problem.

**Fix:** Tighten the unsupported-region classifier to require BOTH the
`invalid_argument` marker AND a region-specific marker, or short-circuit
empty `address_lines` before the HTTP call:
```python
# In validate_address, before httpx.AsyncClient block:
if not address_lines or not any(line.strip() for line in address_lines):
    latency_ms = int((time.monotonic() - t0) * 1000)
    return _voco_result(verdict="error", latency_ms=latency_ms, raw_status=None)
```
The `error` verdict will trigger Sentry capture in the wrapper (D-A3),
which is the correct alert posture for "we never captured an address".

### WR-03: success-path tool returns are not STATE+DIRECTIVE-shaped

**File:** `livekit-agent/src/tools/book_appointment.py:594-614`, `livekit-agent/src/tools/capture_lead.py:138-158`
**Issue:** The skill `integrations-jobber-xero` says tool returns are
"STATE+DIRECTIVE-shaped and carry the verdict token verbatim" — but only the
failure paths use the `STATE:... | DIRECTIVE:...` shape. The new success-path
returns use a different shape: `BOOKED [verdict=validated]: <directive>` (no
`STATE:` prefix, no `|` separator, no `DIRECTIVE:` keyword). Functionally
this works because the prompt CRITICAL RULE only matches the substring
`verdict=validated` / `verdict=validated_with_corrections` / `verdict=unvalidated`,
but a future prompt revision that key off the `STATE:` prefix or the pipe
separator would silently drop these success paths. This is a brittleness
risk, not a present bug.

**Fix:** Either update the skill doc to reflect the actual two shapes (label
shape on success, STATE+DIRECTIVE on failure), or align success returns to
the STATE+DIRECTIVE shape:
```python
return_msg = (
    f"STATE:booking_succeeded verdict=validated address={formatted_address_for_return}"
    f" slot={slot_speech}"
    f" | DIRECTIVE:relay normalized address and time as confirmed; "
    f"ask if anything else is needed"
)
```
Recommend the doc update — the current returns are already in production
patterns (BOOKED/LEAD CAPTURED labels exist pre-Phase-61).

## Info

### IN-01: GOOGLE_MAPS_API_KEY transmitted as URL query parameter

**File:** `livekit-agent/src/integrations/google_maps.py:306`
**Issue:** `f"{GMAPS_VALIDATE_URL}?key={api_key}"` — Google's official docs
do recommend the `?key=` query-string form for the Address Validation API
(it does not accept `Authorization: Bearer` for this endpoint), so this is
not a deviation. However, query strings appear in proxy/CDN access logs,
NGINX logs, and any request-tracing middleware. Mitigation today: the URL is
constructed in-process and the request goes directly to googleapis.com.
Worth a note in the docstring, and a `.gitignore`-style audit that
GOOGLE_MAPS_API_KEY is restricted to specific HTTP referrers / IP ranges in
the GCP console.

**Fix:** Add a comment near the URL build noting the leakage surface:
```python
# api_key is transmitted as a URL query param per Google's API contract.
# Restrict the key in the GCP console to specific referrers/IPs to bound
# leakage if it ever appears in proxy/access logs.
```

### IN-02: numeric(10,7) for longitude is precision-tight

**File:** `supabase/migrations/062_phase61_address_validation.sql:38-40, 60-62`
**Issue:** `numeric(10,7)` allows 3 digits before the decimal and 7 after.
Longitude max absolute value is 180, which fits exactly (180.0000000 = 10
digits, but representations like `180.0000001` would overflow precision).
Google returns up to 7 decimal places (~1cm precision), so the choice is
intentional and matches D-D1, but the spec margin is zero. If Google's
response surface ever returns higher precision, the column will throw a
numeric overflow. Latitude (max 90) has 1 digit of headroom.

**Fix:** No change needed — Google's documented precision is 7 decimals.
Worth tracking as a watch-item in the SKILL doc if Google's precision
surface ever changes.

### IN-03: dead-code branch retained in book_appointment after raw_schema migration

**File:** `livekit-agent/src/tools/book_appointment.py:255-259, 364-389`
**Issue:** Comments at lines 255-259 acknowledge that `slot_start` /
`slot_end` are now empty strings because raw_schema dropped them from the
Gemini-facing surface, and that the `_ensure_utc_iso` fallback (lines
379-389) is "now dead code". The branch is retained intentionally for one
release cycle. This is documented and self-aware; flagging only so it does
not get forgotten next cycle.

**Fix:** Add a TODO with a phase target (e.g., `# TODO(phase 62): remove
dead slot_start/slot_end fallback`) so it surfaces in the next code-review.

### IN-04: prompt verdict token uses substring overlap by design

**File:** `livekit-agent/src/prompt.py:221-222, 232-233`
**Issue:** The CRITICAL RULE prohibits the listed phrases unless the tool
return contains `verdict=validated` OR `verdict=validated_with_corrections`.
Since `verdict=validated_with_corrections` contains `verdict=validated` as a
prefix, the model could in principle match the second clause via the first.
This is benign (both clauses license the same speech-readback rule) and
likely intentional — a stricter rule (full-token regex) would force the
model to scan twice. Worth confirming this is the intended design before
adding a stricter rule in any future revision.

**Fix:** No code change. If documenting, add to the SKILL block-level
note: "Token match is substring-form by design — `verdict=validated` is a
proper prefix of `verdict=validated_with_corrections`, both license the
normalized-readback path."

---

_Reviewed: 2026-05-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

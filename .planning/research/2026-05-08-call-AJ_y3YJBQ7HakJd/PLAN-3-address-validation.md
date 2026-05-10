# PLAN 3 — Address Validation Disabled in Production

**Source call:** AJ_y3YJBQ7HakJd — `[phase61] GOOGLE_MAPS_API_KEY missing — verdict=skipped` fired twice
**Severity:** silent — Phase 61 address validation has been a no-op in production since deploy. No Sentry alerts. Only `logger.info` lines and `gmaps_validate_events` rows with `verdict=skipped`.
**Honest framing up-front:** This is **not a code bug**. The implementation is correct (A-codebase §3). The bug is operational — the env var was never provisioned on Railway, and the implementation's silent-skip path made it impossible to discover without reading logs. The plan covers (a) provisioning, (b) fixing the silent-skip blind spot so this can never silently re-occur.

---

## 1. What was observed

Railway log of call AJ_y3YJBQ7HakJd:

```
08:42:14.156  [phase61] GOOGLE_MAPS_API_KEY missing — verdict=skipped
08:42:19.257  [phase61] GOOGLE_MAPS_API_KEY missing — verdict=skipped
```

Both fired during failed `book_appointment` attempts. Phase 61 ran end-to-end successfully (no exceptions); it just returned the no-op verdict.

Downstream effect (per A-codebase §3):

- `service_address` retains the agent-joined string (`street_name + unit_number + postal_code`) instead of Google's `formattedAddress`.
- `book_appointment` returns `BOOKED [verdict=unvalidated]`, telling the agent to relay the address as caller spoke it without claiming validation.
- `appointments.address_validation_verdict = "skipped"` is persisted on every booking (would be observable from the DB if anyone queried).
- One `gmaps_validate_events` row per attempt with `verdict='skipped', latency_ms=0, cost_micro_cents=0`.

**No Sentry alert. No startup warning. No dashboard surface.** Phase 61 is silently disabled; we found it only because the user noticed validation "feels no different."

## 2. Root cause

A-codebase §3 confirms the silent-skip behavior is intentional in `validate_address` (`google_maps.py:276-283`):

```python
api_key = os.environ.get("GOOGLE_MAPS_API_KEY")
if not api_key:
    logger.info("[phase61] GOOGLE_MAPS_API_KEY missing — verdict=skipped")
    return _voco_result(verdict="skipped", latency_ms=0, raw_status=None)
```

The original design choice (Phase 61) was **graceful degradation** — booking should never fail because validation is misconfigured. That's correct. But the **observability path was never wired up** for the configuration-failure case:

1. `.env.example` (repo root) does not list `GOOGLE_MAPS_API_KEY` (A-codebase §3 final paragraph).
2. There is no `railway.toml` or other declarative env config in the repo, so a fresh deploy has no manifest of required keys.
3. Sentry capture only fires on `verdict='error'`, not `verdict='skipped'` (`google_maps.py:507-525`).
4. No agent-startup check warns if expected integrations are missing.
5. The `gmaps_validate_events` table accumulates `skipped` rows but no alert/dashboard reads them.

The result: Phase 61 was deployed, the API key was never provisioned, and there was no observable sign of failure in the developer's normal workflow.

## 3. Documented best-practice for the fix

**B-docs §problem 3 confirms:**

- API key authentication is the only documented auth method for the Address Validation REST API ([developers.google.com/maps/documentation/address-validation/get-api-key](https://developers.google.com/maps/documentation/address-validation/get-api-key)).
- Singapore is on the supported coverage list (not preview-flagged).
- No service-account/OAuth path exists. There is nothing else to configure.

The implementation is already correct against the docs. The fix is **provisioning + observability**, not code logic.

## 4. The fix — three steps

### Step A — Provision the API key on Railway *(operational)*

1. Create or reuse a Google Cloud Platform project. Enable the **Address Validation API** ([console.cloud.google.com/google/maps-apis/api-list](https://console.cloud.google.com/google/maps-apis/api-list)).
2. Create a Maps Platform API key. Restrict it to:
   - **APIs**: Address Validation API only.
   - **IP**: Railway's egress IPs (or "any" temporarily if Railway IPs are dynamic — see open question 1).
3. Add the key to Railway service `livekit-agent` as `GOOGLE_MAPS_API_KEY=...`.
4. Redeploy (or `railway service restart`).
5. Place a test call. Confirm the next `gmaps_validate_events` row has `verdict ∈ {confirmed, confirmed_with_changes, unconfirmed}` and `cost_micro_cents=1700`.

This is the entirety of the user-visible fix. Steps B and C exist so this can never silently fail again.

### Step B — Make `verdict=skipped` Sentry-observable *(small code change, prevents recurrence)*

**Current (`google_maps.py:507-525`):** Sentry capture fires only on `verdict='error'`. `'skipped'` (env var missing) and `'unsupported_region'` are silent.

**Proposal:** add a *one-time per process* Sentry breadcrumb when `verdict='skipped'` is first observed. Not a capture (don't page on every call), but a startup-level signal.

Cleaner alternative: **agent startup-time check** in `src/agent.py` that verifies expected env vars and logs a warning + Sentry breadcrumb if any are missing. Pattern matches xero/jobber refresh checks already in place.

```python
# src/agent.py, near the top of entrypoint() before session start
EXPECTED_ENV_VARS = (
    "GOOGLE_MAPS_API_KEY",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "LIVEKIT_API_KEY",
    "LIVEKIT_API_SECRET",
    # ... existing ones
)
missing = [v for v in EXPECTED_ENV_VARS if not os.environ.get(v)]
if missing:
    logger.warning("[startup] missing env vars: %s — features may be disabled", missing)
    sentry_sdk.capture_message(
        f"livekit-agent startup: missing env vars {missing}",
        level="warning",
        tags={"phase": "startup_check"},
    )
```

**Why startup-time, not per-call:** per-call would alert-storm (every call without the key = a new Sentry event). Once at process start tells us the deploy is misconfigured without flooding.

**Limitation:** missed if the agent is already running when the key gets revoked. The per-call `verdict='skipped'` log line is still the late-discovery path. Acceptable trade-off.

### Step C — Document the env var so this can't recur on a fresh deploy *(documentation only)*

1. **Add to `.env.example`** in livekit-agent repo:
   ```
   # Google Maps Address Validation API key (Phase 61)
   # Get one at https://developers.google.com/maps/documentation/address-validation/get-api-key
   # Required for address validation; if missing, validation silently skips and
   # bookings proceed unvalidated. See gmaps_validate_events table for verdict=skipped rows.
   GOOGLE_MAPS_API_KEY=
   ```
2. **Add to deployment runbook / SKILL** — `voice-call-architecture/SKILL.md` already covers Phase 61. Add a single line under "Required env vars" cross-referenced from "Address validation."
3. **Optional: Railway env-var schema validation.** Railway supports `Variables` declared in `railway.json`. Adding a documented schema there would surface missing keys at deploy time. Optional because the startup check (Step B) catches the same thing.

## 5. What's already correct (don't change)

- The `verdict='skipped'` graceful-degradation behavior. Booking continuing on missing API key is the right design (per Phase 61 D-G1 in A-codebase §3 docstring).
- The `BOOKED [verdict=unvalidated]` directive — agent correctly relays caller-spoken address without false claims. (Note: this directive *does* benefit from the PLAN-1 cleanup but the validation logic is correct independently.)
- `gmaps_validate_events` telemetry — the table records `skipped` rows so we can post-hoc confirm what fraction of bookings had validation off. Already there, just unmonitored.
- Singapore coverage handling — confirmed supported by Google docs (B-docs §problem 3); no SG-specific code change needed.

## 6. Risks

| Risk | Mitigation |
|---|---|
| API key billing surprise on first heavy day | Cost is `$0.017 / validate × ~2 validates per call × N calls/day`. At 100 calls/day = ~$3.40/day. Set GCP budget alert at $50/month. |
| Restricted-IP key blocks calls from a different egress | Railway's egress IPs change over time. Recommend "no IP restriction" + "Address Validation API only" restriction during initial rollout; tighten later. |
| Quota exhaustion | Default quota is 6000 QPM (per Phase 61 RESEARCH § doc, far above expected load). Monitor `gmaps_validate_events.cost_micro_cents` weekly to detect anomalies. |
| Sentry alert-storm from startup capture if the key is rotated wrong | One alert per process restart, not per call. Capped impact. |

## 7. Implementation order

1. **Step A first.** Just set the key in Railway. Test call. Confirm verdict flips off `skipped`. Total time: ~10 minutes.
2. **Step C** — documentation update. ~5 minutes.
3. **Step B** — code change for startup check. Bundle with whatever other small changes happen in the next deploy. ~20 minutes.

No reason to bundle these. Ship Step A independently and immediately.

## 8. Validation

- **After Step A**: place test call. Query Supabase `select verdict, latency_ms, cost_micro_cents from gmaps_validate_events order by created_at desc limit 5`. Expect `verdict != 'skipped'` and non-zero `latency_ms` / `cost_micro_cents`.
- **After Step B**: deploy with deliberately missing key on a staging Railway service; confirm Sentry shows a single `livekit-agent startup: missing env vars [...]` warning.
- **After Step C**: a fresh `git clone + Railway provision` walkthrough should mention `GOOGLE_MAPS_API_KEY` in the env setup before the first call.

## 9. Open questions

1. **Railway egress IPs**: do we have a fixed egress IP we can pin the API key to? If yes, restrict on Day 1. If no (Railway is dynamic), defer IP restriction until we have a stable egress.
2. **Existing `gmaps_validate_events` backfill**: do we want a one-time SQL script to count `skipped` rows per tenant since Phase 61 deploy? Useful for quantifying the silent-failure window for the Phase 61 closeout. Optional.
3. **Step B scope**: the startup env-var check is generic — do we want to extend it to verify Twilio, LiveKit, Supabase keys at the same time? They'd all benefit from this. Recommend yes; ~5 lines of code adds them all.

## 10. References

- A-codebase.md §3 (current `google_maps.py` behavior, `verdict='skipped'` flow, `.env.example` audit)
- B-docs.md §problem 3 (API key is the only documented auth, Singapore is supported)
- Phase 61 design notes in `google_maps.py` docstring (D-A3 Sentry gate rationale, D-G1 graceful degradation)
- `voice-call-architecture/SKILL.md` (Phase 61 / 58 telemetry references)

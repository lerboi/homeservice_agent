---
type: system
system: Voice Agent
status: current
description: "Webhook Service (Phase 39 40). Covers: Endpoints; Signature verification; Schedule evaluator; Outbound cap; Priority (VIP) caller check (Phase 46); Database schema additions"
source: .claude/skills/voice-call-architecture/SKILL.md § 9. Webhook Service (Phase 39 / 40)
migrated: 2026-11-23
verified:
tags: [voco/system/voice-agent]
---

# Webhook Service (Phase 39 40)

Part of [[Voice Agent]]. Migrated verbatim from the `voice-call-architecture` skill; check `verified` before trusting details.

**Directory**: `livekit-agent/src/webhook/` — FastAPI daemon thread on
port 8080 in the same Railway container.

### Endpoints

| Path | Purpose |
|------|---------|
| `GET /health` | Liveness — `{status, uptime, version}` (Dockerfile HEALTHCHECK) |
| `GET /health/db` | 200 if `SELECT id FROM tenants LIMIT 1` ok, else 503 |
| `POST /twilio/incoming-call` | Routing composition → AI or owner-pickup TwiML. Inserts calls row for owner-pickup before TwiML response (Phase 40 D-22) |
| `POST /twilio/dial-status` | Writes `outbound_dial_duration_sec` + `routing_mode` (`owner_pickup` or `fallback_to_ai`) via `call_sid` |
| `POST /twilio/dial-fallback` | Returns AI SIP TwiML on owner no-answer (same greeting as direct AI) |
| `POST /twilio/incoming-sms` | Forwards message to `pickup_numbers` with `sms_forward=true`. Format: `[Voco] From {sender}: {body}`. MMS → `[Media attached]` note. Logs inbound + forwarded rows to `sms_messages` |

All `/twilio/*` signature-gated via router-level FastAPI dependency
(zero per-route boilerplate).

**LK-B3 — per-tenant SIP routing (2026-06-21, implemented; LIVE-UNVERIFIED):**
`_ai_sip_twiml(to_number=None)` templates the SIP URI's user-part with the DIALED
number (`sip:{to_number}@{host}`, host from `LIVEKIT_SIP_URI`) so the agent can
resolve the tenant from `sip.to`/`sip.trunkPhoneNumber` → `tenants.phone_number`.
Without it, the R2 webhook path (new numbers route via `/twilio/incoming-call`
with the trunk disassociated) dials a STATIC user-part → every new-tenant call
resolves to NO tenant → generic receptionist, no booking/capture/CRM/owner-alert.
The normalized dialed number is threaded into all 7 call sites (4 `incoming_call`
branches + `dial_status` fallback + `dial_fallback` + the `app.py` global-handler
fallback); fail-open to the static URI when the number is absent. **Must still be
confirmed with ONE real inbound PSTN call** (`Tenant: <id>`, not `NONE (Voco)`):
only a live call proves `LIVEKIT_SIP_URI`'s host accepts a Twilio `<Dial><Sip>`
INVITE and that LiveKit passes the user-part through. Until verified, the safe MVP
posture is `RAILWAY_WEBHOOK_URL` UNSET in Vercel → new numbers use the proven
legacy trunk path (agent resolves the tenant identically, no webhook hop).

**LK-B4 — front door never returns a non-TwiML 5xx (2026-06-21):** `app.py` adds
`@app.exception_handler(Exception)` that, for the voice paths (`/twilio/incoming-call`,
`/dial-status`, `/dial-fallback`), returns AI SIP TwiML on ANY unhandled error
(empty TwiML for `/incoming-sms`); other paths get a normal 500. It explicitly
re-raises `HTTPException`/`StarletteHTTPException` so the fail-CLOSED signature
401/403 is NEVER masked into a 200. This is the second line of defense behind the
per-step `try/except`es in `incoming_call` — Twilio would otherwise play "application
error, goodbye" and hang up on any uncaught error.

### Signature verification

`verify_twilio_signature` async FastAPI dep. URL reconstructed via
proxy headers:
```python
proto = request.headers.get("x-forwarded-proto", "https")
host = request.headers["host"]
url = f"{proto}://{host}{request.url.path}"
```
uvicorn started with `proxy_headers=True, forwarded_allow_ips='*'`.

The dep reads `await request.form()` ONCE and stashes on
`request.state.form_data`. Tests that override must replicate this
side effect (Plan 39-06 conftest pattern).

**Fail-closed hardening (2026-06-12 audit M9):**
- **Empty/missing `TWILIO_AUTH_TOKEN` → 503** ("Webhook validation
  unavailable"). `RequestValidator("")` computes HMACs with an EMPTY key, so a
  misconfigured deploy would otherwise accept forged signatures.
- **`ALLOW_UNSIGNED_WEBHOOKS=true` is IGNORED when `PYTHON_ENV` is
  `production` OR unset** (unset defaults to production, matching the Sentry
  init default) — one stray env var can no longer disable signature checks in
  prod. In non-production it still bypasses with a warning (and still stashes
  `request.state.form_data` so handlers behave uniformly).

### Schedule evaluator

`evaluate_schedule(schedule, tenant_timezone, now_utc) -> ScheduleDecision`

Pure function — no DB, no HTTP, no logging. JSONB shape:
`{enabled, days: {mon|...|sun: [{start:"HH:MM", end:"HH:MM"}]}}`.
Overnight ranges (`end < start`) via two-branch check. DST via
`zoneinfo.astimezone()`. Same-day lookup only — Phase 41 UI writes
overnight ranges under both day keys if cross-day matching needed.

**LK-B4 (2026-06-21):** `evaluate_schedule` RAISES on a corrupt/invalid
`tenant_timezone` (`ZoneInfo(...)` → `ZoneInfoNotFoundError`/`ValueError`) — it
does NOT swallow it, and the `'UTC'` call-site default only covers a MISSING key.
So the `incoming_call` call site now wraps it in `try/except` → defaults to
`ScheduleDecision(mode='ai', reason='schedule_error')`, matching every other
fail-open routing step. Tests: corrupt-tz/empty-tz `pytest.raises` in
`test_schedule.py`; route fail-open + global-handler tests in `test_routes.py`.

### Outbound cap

`check_outbound_cap(tenant_id, country) -> bool`.
Limits: US/CA 300000s (5000 min), SG 150000s (2500 min), unknown → US.
Query sums `calls.outbound_dial_duration_sec` where
`created_at >= date_trunc('month', now())` via `idx_calls_tenant_month`.

### Priority (VIP) caller check (Phase 46)

`_is_vip_caller(tenant, from_number)` — two sources:
1. `tenants.vip_numbers` JSONB (standalone, no DB hit).
2. `leads.is_vip=true` via sparse partial index
   `idx_leads_vip_lookup ON leads (tenant_id, from_number) WHERE is_vip = true`.

Match → `_insert_owner_pickup_call()` → parallel `<Dial>` TwiML to
`tenant.pickup_numbers`. **Skips `evaluate_schedule` AND
`check_outbound_cap`** — priority callers always ring regardless of
off-hours or cap breach. No pickup_numbers → fall through to AI
(safety net per D-03).

User-facing brand: "Priority Callers". DB columns keep `vip_*` names
(commit `72f6572` renamed UI only; migration 049 pre-rename). Preserve
this split.

### Database schema additions

- Migration **042** (Phase 39): `call_forwarding_schedule`,
  `pickup_numbers`, `dial_timeout_seconds` on tenants; `routing_mode`,
  `outbound_dial_duration_sec` on calls; `idx_calls_tenant_month`.
- Migration **045** (Phase 40): `sms_messages` table; `calls.call_sid`.
- Migration **049** (Phase 46): `tenants.vip_numbers` JSONB;
  `leads.is_vip` boolean; `idx_leads_vip_lookup` sparse partial index.

---

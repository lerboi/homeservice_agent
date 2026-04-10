# Phase 40: Call Routing Provisioning Cutover - Research

**Researched:** 2026-04-11
**Domain:** Twilio webhook routing, FastAPI handler composition, Supabase DB writes, provisioning update, SMS forwarding
**Confidence:** HIGH — all findings derived from direct code inspection of both repos

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Fail-open for all calls — blocked tenants, unknown numbers → AI TwiML. No busy signals at the webhook layer.
- **D-02:** Handler composition order: tenant lookup → subscription check (fail-open) → `evaluate_schedule` → `check_outbound_cap` (only if `owner_pickup`) → return TwiML.
- **D-03:** `owner_pickup` TwiML is `<Dial timeout="{dial_timeout_seconds}" callerId="{original_caller}" action="/twilio/dial-status"><Number>...</Number></Dial>` — parallel ring across up to 5 numbers; `callerId` = original caller number.
- **D-04:** `action` URL on `<Dial>` → `/twilio/dial-status`; `voice_fallback_url` on Twilio number → `/twilio/dial-fallback`.
- **D-05:** Dial-fallback fires the AI with the same greeting as any direct AI call. No fallback-aware behavior.
- **D-06:** Dial-fallback endpoint returns `<Dial><Sip>{LIVEKIT_SIP_URI}</Sip></Dial>` — identical to the direct AI path.
- **D-07:** Owner-pickup `calls` row: `tenant_id`, `from_number` (caller), `to_number` (Twilio number), `routing_mode='owner_pickup'`, `created_at`. No transcript/recording/triage/lead/notification.
- **D-08:** `increment_calls_used` does NOT fire for owner-pickup calls.
- **D-09:** Dial-status callback writes `outbound_dial_duration_sec` to the calls row.
- **D-10:** Post-call pipeline does not run for owner-pickup calls.
- **D-11:** Cap breach downgrades `owner_pickup` → AI; logged via `logger.warning`. No dedicated event table in Phase 40.
- **D-12:** Cap-breach: warning log only. No cap-breach event table.
- **D-13:** SMS forwarding format: `[Voco] From {original_sender}: {body}` to all `pickup_numbers` entries with `sms_forward=true`.
- **D-14:** MMS not forwarded — `[Media attached - view in Twilio console]` note appended. Text-only forwarding.
- **D-15:** SMS forwarding logs to `sms_messages` table. Schema: `id`, `tenant_id`, `from_number`, `to_number`, `body`, `direction ('inbound'|'forwarded')`, `created_at`. One row for inbound, one row per forwarded copy.
- **D-16:** SMS forwarding failures are non-fatal per recipient — log, continue.
- **D-17:** `provisionPhoneNumber` sets `voice_url`, `voice_fallback_url`, `sms_url`. SIP trunk association kept as rollback safety net.
- **D-18:** US/CA: set URLs at purchase time via `client.incomingPhoneNumbers.create({...})`. SG: update after assignment via `client.incomingPhoneNumbers(numberSid).update({...})`.
- **D-19:** `RAILWAY_WEBHOOK_URL` env var (main repo / Vercel) constructs all three URLs.
- **D-20:** No migration ceremony — directly update all existing tenant Twilio numbers to webhook routing.
- **D-21:** SIP trunk associations preserved as rollback safety net.
- **D-22:** Calls row inserted BEFORE returning TwiML to Twilio (ensures row exists before dial-status fires).
- **D-23:** AI-mode calls: no calls row from webhook — agent creates its own record as today.

### Claude's Discretion

- How the calls row is identified by the dial-status callback (by Twilio's `CallSid` passed through, or by `from_number + to_number + timestamp window`)
- Whether the existing-tenant update is a standalone Python script, Node.js script, or admin API endpoint
- Exact `sms_messages` table indexes
- Whether the subscription check in the webhook is a direct Supabase query or imports from a shared module
- Test organization for new Phase 40 tests (extend existing `tests/webhook/` or add new files)

### Deferred Ideas (OUT OF SCOPE)

- Fallback-aware AI greeting
- Cap-breach event table
- MMS forwarding
- Per-recipient SMS forwarding retry
- Dashboard UI, routing mode badges, usage meter (Phase 41)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ROUTE-07 | `/twilio/incoming-call` implements live routing: tenant lookup → subscription check (fail-open) → `evaluate_schedule` → `check_outbound_cap` → correct TwiML | Handler composition pattern in §Architecture Patterns |
| ROUTE-08 | Owner-pickup calls: inserts minimal `calls` row before returning TwiML; parallel `<Dial>` TwiML with up to 5 `<Number>` elements | TwiML builder pattern in §Code Examples; DB insert before TwiML return per D-22 |
| ROUTE-09 | `/twilio/dial-status` writes `outbound_dial_duration_sec` and `routing_mode` to calls row, sets `routing_mode='fallback_to_ai'` on no-answer | CallSid linking pattern in §Architecture Patterns |
| ROUTE-10 | `/twilio/dial-fallback` returns AI TwiML (reuses `_ai_sip_twiml()`) | Trivial — one-line change in §Code Examples |
| ROUTE-11 | `/twilio/incoming-sms` forwards to `pickup_numbers` with `sms_forward=true`, logs to `sms_messages` table | SMS forwarding pattern in §Architecture Patterns; migration 045 in §Standard Stack |
| ROUTE-12 | `provisionPhoneNumber` sets `voice_url`/`voice_fallback_url`/`sms_url`; existing-tenant cutover script/endpoint | Provisioning update pattern in §Architecture Patterns |
</phase_requirements>

---

## Summary

Phase 40 is an execution phase, not a design phase. All architectural decisions are locked in CONTEXT.md and the foundational code from Phase 39 is already in place. The work is four handler rewrites in `src/webhook/twilio_routes.py`, one provisioning update in `src/app/api/stripe/webhook/route.js`, one new Supabase migration, and an existing-tenant cutover operation.

The main technical judgment calls left to Claude are: (1) how to link the dial-status callback back to the calls row it needs to update (CallSid is the clean answer — Twilio passes the parent call's `CallSid` in both the `<Dial action>` callback and the original incoming-call form data); (2) the migration number for `sms_messages` (must be 045 — 043 is taken by `appointments_realtime`, 044 is claimed by Phase 42 calendar blocks); (3) test file organization for Phase 40 (extending `test_routes.py` is sufficient).

**Primary recommendation:** Implement as five discrete tasks: (1) incoming-call handler rewrite, (2) dial-status + dial-fallback handlers, (3) incoming-sms handler + migration 045, (4) provisioning update + `RAILWAY_WEBHOOK_URL` env var, (5) existing-tenant cutover script and tests.

---

## Standard Stack

### Core (already present — no new deps needed)

| Library | Version (pyproject.toml) | Purpose | Notes |
|---------|--------------------------|---------|-------|
| `twilio` | `>=9.0,<10` (9.10.4 installed) | Send forwarded SMS via `client.messages.create()`; `RequestValidator` for sig verification | Already in `pyproject.toml` |
| `fastapi` | `>=0.115,<1` | Webhook handler framework | Already present |
| `supabase` | `>=2.0,<3` | DB reads and writes (tenants, calls, sms_messages) | Already present |
| `python-multipart` | `>=0.0.9,<1` | Parse Twilio form bodies | Already present |
| `asyncio` (stdlib) | Python 3.13.3 | `asyncio.to_thread` for sync supabase-py calls | Built-in |

### Main Repo (no new deps needed)

| Library | Version | Purpose |
|---------|---------|---------|
| `twilio` (npm) | already imported | Update number config at provision time and for existing-tenant cutover |

**No new dependencies required in either repo for Phase 40.**

**Migration number:** `sms_messages` table uses `045_sms_messages.sql`.
- 043 = `appointments_realtime.sql` (already shipped)
- 044 = `calendar_blocks_and_completed_at.sql` (claimed by Phase 42, not yet shipped but the number is taken in planning)
- 045 = available for `sms_messages`

---

## Architecture Patterns

### Recommended Project Structure (changes only)

```
livekit-agent/
├── src/webhook/
│   └── twilio_routes.py          # MODIFIED: 4 handler bodies replaced
├── tests/webhook/
│   └── test_routes.py            # EXTENDED: Phase 40 tests added here
│   └── test_sms.py               # NEW: SMS forwarding tests (or added to test_routes.py)

homeservice_agent/
├── src/app/api/stripe/webhook/route.js  # MODIFIED: provisionPhoneNumber adds 3 URLs
├── supabase/migrations/
│   └── 045_sms_messages.sql      # NEW: sms_messages table
├── scripts/
│   └── cutover-existing-numbers.js  # NEW: existing-tenant cutover (standalone Node.js)
```

---

### Pattern 1: Incoming-Call Handler Composition (D-02)

The Phase 39 handler structure is already the correct skeleton. Phase 40 replaces the hardcoded `return _xml_response(_ai_sip_twiml())` at line 115 with live routing logic.

```python
# Source: inferred from 40-CONTEXT.md D-02, D-03, D-07, D-11, D-22
@router.post("/incoming-call")
async def incoming_call(request: Request) -> Response:
    form_data = request.state.form_data
    to_number = _normalize_phone(form_data.get("To", ""))
    from_number = _normalize_phone(form_data.get("From", ""))
    call_sid = form_data.get("CallSid", "")

    # Step 1: Tenant lookup (fail-open: no match → AI)
    tenant = None
    try:
        from src.supabase_client import get_supabase_admin
        def _query():
            return get_supabase_admin().table("tenants") \
                .select("id, call_forwarding_schedule, tenant_timezone, country, "
                        "pickup_numbers, dial_timeout_seconds, subscriptions(status)") \
                .eq("phone_number", to_number).limit(1).execute()
        resp = await asyncio.to_thread(_query)
        rows = resp.data or []
        if rows:
            tenant = rows[0]
    except Exception as e:
        logger.warning("[webhook] Tenant lookup failed (fail-open): %s", e)

    if not tenant:
        return _xml_response(_ai_sip_twiml())

    # Step 2: Subscription check (fail-open: error or blocked → AI)
    try:
        sub_rows = tenant.get("subscriptions") or []
        status = sub_rows[0]["status"] if sub_rows else None
        if status in BLOCKED_STATUSES:
            return _xml_response(_ai_sip_twiml())
    except Exception:
        pass  # fail-open

    # Step 3: Schedule evaluation
    from src.webhook.schedule import evaluate_schedule
    from datetime import datetime, timezone
    decision = evaluate_schedule(
        tenant["call_forwarding_schedule"],
        tenant.get("tenant_timezone", "UTC"),
        datetime.now(tz=timezone.utc),
    )

    # Step 4: Cap check (only for owner_pickup)
    if decision.mode == "owner_pickup":
        from src.webhook.caps import check_outbound_cap
        from src.webhook.schedule import ScheduleDecision
        under_cap = await check_outbound_cap(tenant["id"], tenant.get("country", "US"))
        if not under_cap:
            decision = ScheduleDecision(mode="ai", reason="soft_cap_hit")  # type: ignore

    if decision.mode == "owner_pickup":
        # Step 5a: Insert calls row BEFORE returning TwiML (D-22)
        pickup_numbers = [p["number"] for p in (tenant.get("pickup_numbers") or [])
                          if p.get("number")]
        if not pickup_numbers:
            return _xml_response(_ai_sip_twiml())  # no numbers configured → AI

        await _insert_owner_pickup_call(
            tenant_id=tenant["id"],
            call_sid=call_sid,
            from_number=from_number,
            to_number=to_number,
        )

        # Step 5b: Build parallel-ring TwiML (D-03)
        timeout = tenant.get("dial_timeout_seconds", 15)
        twiml = _owner_pickup_twiml(from_number, pickup_numbers, timeout)
        return _xml_response(twiml)
    else:
        return _xml_response(_ai_sip_twiml())
```

### Pattern 2: Owner-Pickup TwiML Builder (D-03)

```python
# Source: 40-CONTEXT.md D-03
def _owner_pickup_twiml(caller: str, pickup_numbers: list[str], timeout: int) -> str:
    base = os.environ.get("RAILWAY_WEBHOOK_URL", "")
    action_url = f"{base}/twilio/dial-status"
    number_elements = "".join(f"<Number>{n}</Number>" for n in pickup_numbers[:5])
    return (
        f'<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<Response><Dial timeout="{timeout}" callerId="{caller}" '
        f'action="{action_url}">{number_elements}</Dial></Response>'
    )
```

### Pattern 3: Dial-Status Callback — CallSid Linking (Claude's Discretion)

Twilio's `<Dial action>` callback POST includes:
- `CallSid` — the **original inbound call's** SID (same value as the inbound webhook's `CallSid`)
- `DialCallStatus` — `completed`, `no-answer`, `busy`, `failed`
- `DialCallDuration` — seconds the dialed leg was active (only present if `completed`)

**Recommendation:** Use `CallSid` as the link. When inserting the calls row in the incoming-call handler, store `call_sid` as a column on the `calls` row so dial-status can look it up by `call_sid = form_data["CallSid"]`. This is cleaner than a timestamp window query.

However, the current `calls` table schema from migration 042 does **not** have a `call_sid` column. Two options:

1. **Add `call_sid TEXT` column** in migration 045 alongside `sms_messages`. Clean but adds a migration dependency.
2. **Use `from_number + to_number + recent timestamp window`** — query `calls` where `from_number = X AND to_number = Y AND routing_mode = 'owner_pickup' AND created_at > now() - interval '5 minutes'` then take the most recent. Slightly fuzzy but avoids schema change.

**Recommended choice:** Add `call_sid TEXT` to the `calls` table in migration 045. The schema already has `routing_mode` added in 042, so adding `call_sid` in 045 is consistent. This enables exact matching and avoids false-positive updates in high-volume scenarios.

### Pattern 4: Dial-Status Handler

```python
# Source: 40-CONTEXT.md D-05, D-09
@router.post("/dial-status")
async def dial_status(request: Request) -> Response:
    form_data = request.state.form_data
    call_sid = form_data.get("CallSid", "")
    dial_status_val = form_data.get("DialCallStatus", "")
    duration_raw = form_data.get("DialCallDuration", "")
    duration_sec = int(duration_raw) if duration_raw.isdigit() else None

    # Determine final routing_mode
    if dial_status_val in ("no-answer", "busy", "failed"):
        final_mode = "fallback_to_ai"
    else:
        final_mode = "owner_pickup"

    # Update calls row (fail-safe: if lookup fails, no crash)
    try:
        from src.supabase_client import get_supabase_admin
        def _update():
            update_data = {"routing_mode": final_mode}
            if duration_sec is not None:
                update_data["outbound_dial_duration_sec"] = duration_sec
            return get_supabase_admin().table("calls") \
                .update(update_data) \
                .eq("call_sid", call_sid) \
                .execute()
        await asyncio.to_thread(_update)
    except Exception as e:
        logger.warning("[webhook] dial_status update failed: %s", e)

    return _xml_response(_empty_twiml())
```

### Pattern 5: Dial-Fallback Handler (D-06)

```python
@router.post("/dial-fallback")
async def dial_fallback(request: Request) -> Response:
    # Owner didn't answer — route to AI with identical greeting (D-05, D-06)
    return _xml_response(_ai_sip_twiml())
```

### Pattern 6: SMS Forwarding Handler (D-13 through D-16)

```python
# Source: 40-CONTEXT.md D-13, D-14, D-15, D-16
@router.post("/incoming-sms")
async def incoming_sms(request: Request) -> Response:
    form_data = request.state.form_data
    from_number = _normalize_phone(form_data.get("From", ""))
    to_number = _normalize_phone(form_data.get("To", ""))
    body = form_data.get("Body", "")
    num_media = int(form_data.get("NumMedia", "0") or "0")

    # Tenant lookup (fail-open: no match → acknowledge only)
    tenant = None
    try:
        from src.supabase_client import get_supabase_admin
        def _query():
            return get_supabase_admin().table("tenants") \
                .select("id, pickup_numbers") \
                .eq("phone_number", to_number).limit(1).execute()
        resp = await asyncio.to_thread(_query)
        rows = resp.data or []
        if rows:
            tenant = rows[0]
    except Exception as e:
        logger.warning("[webhook] SMS tenant lookup failed: %s", e)

    if not tenant:
        return _xml_response(_empty_twiml())

    tenant_id = tenant["id"]
    pickup_numbers = tenant.get("pickup_numbers") or []
    forward_targets = [p["number"] for p in pickup_numbers if p.get("sms_forward")]

    # Append MMS note if present (D-14)
    forward_body = body
    if num_media > 0:
        forward_body = f"{body}\n[Media attached - view in Twilio console]".strip()

    forward_text = f"[Voco] From {from_number}: {forward_body}"

    # Log inbound message
    await _log_sms(tenant_id, from_number, to_number, body, "inbound")

    # Forward to each sms_forward target (D-16: non-fatal per recipient)
    from twilio.rest import Client as TwilioClient
    twilio_client = TwilioClient(
        os.environ.get("TWILIO_ACCOUNT_SID"),
        os.environ.get("TWILIO_AUTH_TOKEN"),
    )
    for target in forward_targets:
        try:
            def _send(t=target):
                return twilio_client.messages.create(
                    body=forward_text,
                    from_=to_number,   # send from the tenant's Twilio number
                    to=t,
                )
            await asyncio.to_thread(_send)
            await _log_sms(tenant_id, to_number, target, forward_text, "forwarded")
        except Exception as e:
            logger.error("[webhook] SMS forward failed to %s: %s", target, e)

    return _xml_response(_empty_twiml())
```

**Note on SMS `from_` field:** Twilio requires the `from_` to be a Twilio-owned number. Using `to_number` (the tenant's Twilio number) as the sender is correct — the recipient sees the business's Twilio number as sender, with the original caller identified in the message body prefix.

### Pattern 7: Provisioning Update in `route.js` (D-17, D-18, D-19)

```javascript
// Source: 40-CONTEXT.md D-17, D-18, D-19
// In src/app/api/stripe/webhook/route.js — provisionPhoneNumber function

const webhookBase = process.env.RAILWAY_WEBHOOK_URL; // e.g. https://livekit-agent-production.up.railway.app
const voiceUrl = webhookBase ? `${webhookBase}/twilio/incoming-call` : undefined;
const voiceFallbackUrl = webhookBase ? `${webhookBase}/twilio/dial-fallback` : undefined;
const smsUrl = webhookBase ? `${webhookBase}/twilio/incoming-sms` : undefined;

// US/CA: set at purchase time
const purchasedNumber = await client.incomingPhoneNumbers.create({
  phoneNumberType: 'local',
  countryCode: country,
  ...(voiceUrl && { voiceUrl, voiceFallbackUrl, smsUrl }),
});

// SG: update after assignment (number already exists in Twilio)
const numbers = await client.incomingPhoneNumbers.list({ phoneNumber, limit: 1 });
if (numbers.length > 0 && voiceUrl) {
  await client.incomingPhoneNumbers(numbers[0].sid).update({
    voiceUrl, voiceFallbackUrl, smsUrl,
  });
}
```

### Pattern 8: Existing-Tenant Cutover (D-20, D-21)

**Recommendation:** Standalone Node.js script (`scripts/cutover-existing-numbers.js`). It runs once, is idempotent, and does not require a new API route.

```javascript
// scripts/cutover-existing-numbers.js
// Run: node scripts/cutover-existing-numbers.js
// Reads all tenants with phone_number IS NOT NULL, updates Twilio voice_url/sms_url.
// SIP trunk associations are preserved (not removed) — clearing voice_url restores SIP routing.

const { createClient } = require('@supabase/supabase-js');
const twilio = require('twilio');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const base = process.env.RAILWAY_WEBHOOK_URL;

async function main() {
  const { data: tenants } = await supabase.from('tenants')
    .select('id, phone_number').not('phone_number', 'is', null);
  
  for (const tenant of tenants) {
    const numbers = await client.incomingPhoneNumbers.list({ phoneNumber: tenant.phone_number, limit: 1 });
    if (!numbers.length) { console.warn('No Twilio number for', tenant.phone_number); continue; }
    await client.incomingPhoneNumbers(numbers[0].sid).update({
      voiceUrl: `${base}/twilio/incoming-call`,
      voiceFallbackUrl: `${base}/twilio/dial-fallback`,
      smsUrl: `${base}/twilio/incoming-sms`,
    });
    console.log('Updated', tenant.phone_number);
  }
}
main().catch(console.error);
```

### Anti-Patterns to Avoid

- **Inserting calls row AFTER returning TwiML:** If the row doesn't exist when dial-status fires (race condition), the duration writeback silently fails. Per D-22, always insert before returning TwiML.
- **Deleting SIP trunk association:** Violates D-21. Keep the trunk association intact as rollback safety.
- **Calling `increment_calls_used` for owner-pickup calls:** Violates D-08. Only AI calls count toward quota.
- **Running post-call pipeline for owner-pickup calls:** Violates D-10. `run_post_call_pipeline` must not be called.
- **Forwarding MMS media:** Violates D-14. Only forward text; append the `[Media attached]` note.
- **Using `from_` = non-Twilio number in `client.messages.create`:** Twilio will reject. Use `to_number` (the tenant's Twilio number) as sender.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Twilio signature validation | Custom HMAC-SHA1 | `twilio.request_validator.RequestValidator` (already in `security.py`) | Already implemented in Phase 39; edge cases around charset encoding |
| Phone normalization | Custom stripping logic | `_normalize_phone()` from `src/lib/phone.py` | Already extracted in Phase 39 specifically for this purpose |
| Schedule evaluation | Inline time comparison | `evaluate_schedule()` from `src/webhook/schedule.py` | Pure function with 17 tests, handles DST, overnight ranges |
| Outbound cap check | Inline SQL sum | `check_outbound_cap()` from `src/webhook/caps.py` | Async, tested, handles country limits and unknown-country fallback |
| Supabase singleton | New client constructor | `get_supabase_admin()` from `src/supabase_client.py` | Lazy-init singleton, same env vars, same process |
| TwiML string building | XML library or template | `_ai_sip_twiml()`, `_xml_response()` helpers already in `twilio_routes.py` | Simple string concat is correct here; no external XML lib needed |

---

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `calls` table rows — existing rows have `routing_mode = NULL` (legacy AI calls). New schema from 042 is already in place. | No data migration needed; NULL = legacy AI per Phase 39 D-19 |
| Stored data | `tenants.pickup_numbers = '[]'` for all existing tenants (default from 042 migration) | No migration needed; empty array → no owner-pickup targets |
| Stored data | `tenants.call_forwarding_schedule = '{"enabled":false,"days":{}}'` for all existing tenants | No migration needed; disabled schedule → always AI |
| Live service config | Twilio number voice_url/sms_url on existing tenant numbers — currently pointing at SIP trunk (NOT at webhook) | Run existing-tenant cutover script once after Phase 40 deploys |
| OS-registered state | None — no OS-level registration involved | None |
| Secrets/env vars | `RAILWAY_WEBHOOK_URL` — new env var needed in main repo (Vercel). Does NOT exist yet. | Add to Vercel env before deploying Phase 40 provisioning changes |
| Secrets/env vars | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` — needed in livekit-agent for SMS forwarding sends | Already present in Railway env for existing agent use |
| Build artifacts | None | None |

**Critical env var gap:** `RAILWAY_WEBHOOK_URL` must be set in Vercel before the provisioning update goes live. The cutover script also reads it from `process.env.RAILWAY_WEBHOOK_URL` and will fail if unset.

---

## Common Pitfalls

### Pitfall 1: Migration Number Conflict

**What goes wrong:** CONTEXT.md D-15 says "migration 043" for the `sms_messages` table, but `043_appointments_realtime.sql` already exists in the repo. Phase 42 has already claimed 044 for `calendar_blocks_and_completed_at.sql` in its planning artifacts.

**Why it happens:** Migration numbers are allocated at planning time; CONTEXT.md was written before checking the latest migration files.

**How to avoid:** Use `045_sms_messages.sql`. Verified: 043 exists (appointments_realtime), 044 is planned by Phase 42 (not yet shipped but reserved). 045 is the correct next number for Phase 40.

**Warning signs:** `supabase db push` fails with duplicate file name or out-of-order migration.

---

### Pitfall 2: CallSid Not in Calls Table — Dial-Status Can't Find the Row

**What goes wrong:** Dial-status callback fires with the original `CallSid` but the `calls` table has no `call_sid` column to match against. Without a link, the duration writeback silently fails.

**Why it happens:** Migration 042 added `routing_mode` and `outbound_dial_duration_sec` but no `call_sid` column. Twilio's parallel-ring `<Dial action>` callback posts the parent call's `CallSid` as the only reliable identifier.

**How to avoid:** Add `call_sid TEXT` to the `calls` table in migration 045. Insert it when creating the owner-pickup row in the incoming-call handler (`form_data.get("CallSid")`). The dial-status handler then does `.eq("call_sid", call_sid)` to find the row.

**Alternative (if migration 045 schema change is undesirable):** Query by `from_number + to_number + routing_mode='owner_pickup' + created_at > now() - 10 minutes` and take the most recent. This works in practice given low call volume but is fragile at scale.

---

### Pitfall 3: Subscription Query in Webhook — Table Join vs. Separate Query

**What goes wrong:** The tenant query currently selects only `id, call_forwarding_schedule, tenant_timezone, country`. Adding a join to `subscriptions` requires knowing that supabase-py uses a Postgres foreign key join syntax (`.select("..., subscriptions(status)")`), not a separate `.from_()` call.

**Why it happens:** supabase-py's `.select()` supports PostgREST-style related table fetching via `table_name(column)` syntax only when a foreign key relationship exists.

**How to avoid:** The `subscriptions` table has `tenant_id` FK to `tenants.id`. Use `.select("id, call_forwarding_schedule, tenant_timezone, country, pickup_numbers, dial_timeout_seconds, subscriptions(status)")`. The result will have `tenant["subscriptions"]` as a list of `{status: "..."}` dicts. Take `tenant["subscriptions"][0]["status"]` if the list is non-empty.

**Alternative:** Two queries — first fetch tenant, then fetch subscription by tenant_id. Simpler but adds one extra DB round-trip per call.

---

### Pitfall 4: SMS `from_` Must Be a Twilio-Owned Number

**What goes wrong:** Using the original caller's `From` number as the `from_` field in `client.messages.create()` causes Twilio to reject the request (error 21212 — invalid From number). Only Twilio-provisioned numbers can be used as sender.

**Why it happens:** Twilio's Messages API requires sender to be a number you own.

**How to avoid:** Use `to_number` (the tenant's Twilio number, which is the `To` field from the incoming SMS webhook) as the `from_` field. The original caller is identified in the message body prefix `[Voco] From {original_sender}: ...`.

---

### Pitfall 5: `RAILWAY_WEBHOOK_URL` Missing — Provisioning Sets No URLs

**What goes wrong:** If `RAILWAY_WEBHOOK_URL` is not set in the Vercel environment, `provisionPhoneNumber` silently purchases the number without setting `voice_url`. The number will be configured to fall back to SIP trunk routing (acceptable for rollback, but defeats the feature).

**Why it happens:** The code pattern with `...(voiceUrl && { voiceUrl, ... })` makes the URL assignment conditional on the env var being set.

**How to avoid:** Check for `RAILWAY_WEBHOOK_URL` at the top of the function and log a warning if unset. Optionally throw in non-production environments.

---

### Pitfall 6: `asyncio.to_thread` Pattern for ALL Supabase Calls

**What goes wrong:** Calling supabase-py's synchronous `.execute()` directly in an async FastAPI handler blocks the event loop, causing request processing delays under load.

**Why it happens:** supabase-py is a synchronous library; FastAPI runs on asyncio.

**How to avoid:** Wrap every `supabase.table(...).execute()` call in `await asyncio.to_thread(lambda: ...)`. This is the established pattern in Phase 39's `twilio_routes.py` and `caps.py`.

---

## Code Examples

### Tenant Query with Subscription Status

```python
# Source: 40-CONTEXT.md D-02 + supabase-py PostgREST join syntax
def _query():
    return get_supabase_admin().table("tenants") \
        .select(
            "id, call_forwarding_schedule, tenant_timezone, country, "
            "pickup_numbers, dial_timeout_seconds, subscriptions(status)"
        ) \
        .eq("phone_number", to_number) \
        .limit(1) \
        .execute()

resp = await asyncio.to_thread(_query)
rows = resp.data or []
tenant = rows[0] if rows else None
```

### Subscription Status Check (fail-open)

```python
# Source: 40-CONTEXT.md D-01; BLOCKED_STATUSES from src/agent.py:52
BLOCKED_STATUSES = ["canceled", "paused", "incomplete"]

sub_rows = (tenant.get("subscriptions") or [])
status = sub_rows[0]["status"] if sub_rows else None
if status in BLOCKED_STATUSES:
    return _xml_response(_ai_sip_twiml())
```

### Migration 045 sms_messages Table

```sql
-- supabase/migrations/045_sms_messages.sql
-- Phase 40: SMS forwarding audit log + call_sid column for owner-pickup calls

-- sms_messages table (D-15)
CREATE TABLE sms_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  from_number TEXT NOT NULL,
  to_number   TEXT NOT NULL,
  body        TEXT NOT NULL,
  direction   TEXT NOT NULL CHECK (direction IN ('inbound', 'forwarded')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes (Claude's Discretion): tenant+time for dashboard queries, direction for filtering
CREATE INDEX idx_sms_messages_tenant_created ON sms_messages (tenant_id, created_at);

-- RLS: SELECT for authenticated, INSERT only via service_role (webhook inserts)
ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_select_sms" ON sms_messages
  FOR SELECT USING (tenant_id = (SELECT id FROM tenants WHERE user_id = auth.uid()));

-- call_sid column on calls (for dial-status callback linking)
ALTER TABLE calls ADD COLUMN call_sid TEXT;
CREATE INDEX idx_calls_call_sid ON calls (call_sid) WHERE call_sid IS NOT NULL;
```

### `asyncio.to_thread` Insert Pattern

```python
# Source: established Phase 39 pattern in twilio_routes.py and caps.py
async def _insert_owner_pickup_call(tenant_id, call_sid, from_number, to_number):
    from src.supabase_client import get_supabase_admin
    def _insert():
        return get_supabase_admin().table("calls").insert({
            "tenant_id": tenant_id,
            "call_sid": call_sid,
            "from_number": from_number,
            "to_number": to_number,
            "routing_mode": "owner_pickup",
        }).execute()
    await asyncio.to_thread(_insert)
```

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest 8.x + pytest-asyncio 0.23+ |
| Config file | `livekit-agent/pyproject.toml` `[tool.pytest.ini_options]` |
| Quick run command | `cd C:/Users/leheh/.Projects/livekit-agent && python -m pytest tests/webhook/ -x -q` |
| Full suite command | `cd C:/Users/leheh/.Projects/livekit-agent && python -m pytest tests/webhook/ -q` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ROUTE-07 | AI TwiML returned when schedule disabled | unit | `pytest tests/webhook/test_routes.py::test_incoming_call_ai_mode -x` | ❌ Wave 0 |
| ROUTE-07 | owner_pickup TwiML when schedule active + under cap | unit | `pytest tests/webhook/test_routes.py::test_incoming_call_owner_pickup -x` | ❌ Wave 0 |
| ROUTE-07 | Fail-open: unknown tenant → AI TwiML | unit | `pytest tests/webhook/test_routes.py::test_incoming_call_unknown_tenant -x` | ❌ Wave 0 |
| ROUTE-07 | Fail-open: blocked subscription → AI TwiML | unit | `pytest tests/webhook/test_routes.py::test_incoming_call_blocked_tenant -x` | ❌ Wave 0 |
| ROUTE-07 | Cap breach downgrades owner_pickup → AI | unit | `pytest tests/webhook/test_routes.py::test_incoming_call_cap_breach -x` | ❌ Wave 0 |
| ROUTE-08 | Parallel ring TwiML has correct `<Number>` elements | unit | `pytest tests/webhook/test_routes.py::test_owner_pickup_twiml_structure -x` | ❌ Wave 0 |
| ROUTE-09 | dial_status writes duration + routing_mode | unit | `pytest tests/webhook/test_routes.py::test_dial_status_updates_calls_row -x` | ❌ Wave 0 |
| ROUTE-09 | no-answer sets routing_mode=fallback_to_ai | unit | `pytest tests/webhook/test_routes.py::test_dial_status_no_answer -x` | ❌ Wave 0 |
| ROUTE-10 | dial_fallback returns AI TwiML | unit | `pytest tests/webhook/test_routes.py::test_dial_fallback_returns_ai_twiml -x` | ❌ Wave 0 |
| ROUTE-11 | SMS forwarded to sms_forward=true numbers | unit | `pytest tests/webhook/test_routes.py::test_incoming_sms_forwarding -x` | ❌ Wave 0 |
| ROUTE-11 | MMS body gets [Media attached] note | unit | `pytest tests/webhook/test_routes.py::test_incoming_sms_mms_note -x` | ❌ Wave 0 |
| ROUTE-11 | SMS forward failure is non-fatal | unit | `pytest tests/webhook/test_routes.py::test_incoming_sms_partial_failure -x` | ❌ Wave 0 |
| ROUTE-12 | provisionPhoneNumber sets voice_url/sms_url (JS) | manual | N/A — no JS test infrastructure | manual |
| ROUTE-12 | Cutover script updates Twilio number config | manual | N/A — Twilio API integration test | manual |

### Sampling Rate

- **Per task commit:** `python -m pytest tests/webhook/ -x -q`
- **Per wave merge:** `python -m pytest tests/webhook/ -q`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/webhook/test_routes.py` — update existing file with Phase 40 test functions (don't replace; Phase 39 tests remain)
- [ ] Monkeypatch pattern for `get_supabase_admin` needed in all new route tests (follow `test_caps.py` pattern: `monkeypatch.setattr("src.supabase_client.get_supabase_admin", ...)`)
- [ ] No new test files needed — all Phase 40 route tests extend `tests/webhook/test_routes.py`

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python | livekit-agent tests | ✓ | 3.13.3 | — |
| twilio SDK (Python) | SMS forwarding, request validation | ✓ | 9.10.4 | — |
| twilio SDK (Node.js) | provisionPhoneNumber, cutover script | ✓ | (npm installed) | — |
| `RAILWAY_WEBHOOK_URL` env var (Vercel) | Provisioning update | ✗ | — | None — must be set before deploying |
| `RAILWAY_WEBHOOK_URL` env var (local) | Cutover script | ✗ | — | Set manually before running script |
| Supabase (test env) | Route tests | Optional | — | Tests mock with monkeypatch |

**Missing dependencies with no fallback:**
- `RAILWAY_WEBHOOK_URL` in Vercel environment — must be added before the provisioning update is deployed, otherwise new numbers will not have webhook routing configured.

---

## Open Questions

1. **`call_sid` column placement**
   - What we know: Migration 045 is adding `sms_messages` anyway; adding `call_sid` to `calls` in the same migration is clean
   - What's unclear: Whether any other Phase 40 consumer needs `call_sid` exposed to the dashboard
   - Recommendation: Add `call_sid TEXT` to `calls` in migration 045; planner should include this in Plan wave 0

2. **Twilio SDK client reuse for SMS forwarding**
   - What we know: The webhook handler is async; `twilio.rest.Client` is synchronous
   - What's unclear: Whether to instantiate the TwilioClient once at module level (shared across requests) or per-request (safer for test isolation)
   - Recommendation: Module-level lazy-init singleton, same pattern as `get_supabase_admin()` — create `_get_twilio_client()` in `twilio_routes.py` or a new `src/lib/twilio_client.py`

3. **Subscription check — join vs. two queries**
   - What we know: PostgREST join syntax works for FK relationships in supabase-py
   - What's unclear: Whether `subscriptions(status)` join returns latest subscription or all
   - Recommendation: Use two queries if the join behavior is uncertain: one for tenant, one for `subscriptions.select("status").eq("tenant_id", tenant_id).order("created_at", desc=True).limit(1)`. This is unambiguous.

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `C:/Users/leheh/.Projects/livekit-agent/src/webhook/twilio_routes.py` — Phase 39 stub handlers
- Direct code inspection: `C:/Users/leheh/.Projects/livekit-agent/src/webhook/schedule.py` — `evaluate_schedule` pure function
- Direct code inspection: `C:/Users/leheh/.Projects/livekit-agent/src/webhook/caps.py` — `check_outbound_cap` async function
- Direct code inspection: `C:/Users/leheh/.Projects/livekit-agent/src/webhook/security.py` — signature verification dependency
- Direct code inspection: `C:/Users/leheh/.Projects/livekit-agent/src/webhook/app.py` — FastAPI app structure
- Direct code inspection: `C:/Users/leheh/.Projects/livekit-agent/src/supabase_client.py` — singleton pattern
- Direct code inspection: `C:/Users/leheh/.Projects/livekit-agent/src/lib/phone.py` — `_normalize_phone`
- Direct code inspection: `C:/Users/leheh/.Projects/homeservice_agent/src/app/api/stripe/webhook/route.js` — `provisionPhoneNumber` function
- Direct code inspection: `C:/Users/leheh/.Projects/homeservice_agent/supabase/migrations/042_call_routing_schema.sql` — Phase 39 schema
- Migration number verification: `ls supabase/migrations/` — 043 = appointments_realtime, 044 = calendar_blocks (Phase 42 planning), 045 = available for sms_messages
- Direct inspection: `livekit-agent/tests/webhook/conftest.py` and `test_routes.py` — existing test infrastructure
- Direct inspection: `livekit-agent/pyproject.toml` — twilio 9.10.4 installed, Python 3.13.3

### Secondary (MEDIUM confidence)
- Twilio TwiML `<Dial>` `action` callback fields (CallSid, DialCallStatus, DialCallDuration) — based on established Twilio documentation patterns and confirmed by the CONTEXT.md description of the dial-status writeback

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in pyproject.toml, versions verified
- Architecture: HIGH — all patterns derived directly from existing Phase 39 code
- Pitfalls: HIGH — migration conflict verified by filesystem inspection, other pitfalls derived from direct code reading
- Test infrastructure: HIGH — conftest.py and test_routes.py read directly

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (stable codebase, no fast-moving dependencies)

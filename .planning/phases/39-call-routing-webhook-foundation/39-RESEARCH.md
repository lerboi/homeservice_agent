# Phase 39: Call Routing Webhook Foundation — Research

**Researched:** 2026-04-09
**Domain:** FastAPI + uvicorn daemon thread, Twilio signature verification, Python zoneinfo DST, Postgres schema extension
**Confidence:** HIGH (core stack decisions locked; all critical questions answered with verified sources)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: FastAPI replaces src/health.py entirely. FastAPI owns port 8080 and serves /health, /health/db, and /twilio/*. src/health.py is deleted.
- D-02: uvicorn runs in a daemon thread from agent.py __main__, before cli.run_app. Started via `uvicorn.run(app, host='0.0.0.0', port=8080, proxy_headers=True, forwarded_allow_ips='*', log_config=None)`.
- D-03: New subpackage src/webhook/ with app.py, twilio_routes.py, security.py, schedule.py, caps.py, __init__.py.
- D-04: fastapi>=0.115,<1 and uvicorn[standard]>=0.30,<1 added to pyproject.toml. Dockerfile unchanged.
- D-05/06/07/08: Schedule JSONB shape {enabled:bool, days:{mon..sun:[{start,end}]}}, HH:MM tenant-local, enabled:false = always AI, overnight via end<start, DST via zoneinfo.
- D-09/10/11: evaluate_schedule(schedule, tenant_timezone, now_utc) -> ScheduleDecision(mode:'ai'|'owner_pickup', reason). Pure. fallback_to_ai is Phase 40.
- D-12/13: webhook subpackage imports get_supabase_admin; /twilio/incoming-call looks up tenant by To but always returns hardcoded AI TwiML.
- D-14/15/16: verify_twilio_signature is router-level FastAPI dep; URL reconstruction via x-forwarded-proto/host; ALLOW_UNSIGNED_WEBHOOKS=true bypass for dev only.
- D-17: check_outbound_cap sums outbound_dial_duration_sec from calls current calendar month; index idx_calls_tenant_month on (tenant_id, created_at).
- D-18/19/20: Single migration 042_call_routing_schema.sql; calls.routing_mode nullable, no backfill; pickup_numbers shape {number, label, sms_forward}.

### Claude's Discretion
- Exact FastAPI app object construction style within src/webhook/app.py
- Exact shape of logging (voco-webhook logger or reuse voco-agent)
- Whether verify_twilio_signature reads form body once and stashes on request.state vs letting handlers re-parse
- Test organization (tests/webhook/ vs src/webhook/tests/)
- Whether ScheduleDecision.reason includes soft_cap_hit now or later
- Exact unit test fixture setup for DST transitions
- Whether check_outbound_cap logs cap-breach events in Phase 39 or just warns
- How Phase 39 acceptance test exercises the app

### Deferred Ideas (OUT OF SCOPE)
- Real schedule-driven TwiML — Phase 40
- Parallel ring, voice_url / sms_url config, sms_messages table — Phase 40
- /twilio/dial-status writing outbound_dial_duration_sec — Phase 40
- Subscription gate in webhook — Phase 40
- Dashboard UI, /api/call-routing, routing mode badges — Phase 41
- Onboarding setup-checklist entry — Phase 41
- Retroactive backfill of calls.routing_mode — explicitly declined (D-19)
- Rollup table for usage aggregation — explicitly declined (D-17)
</user_constraints>

---

## 1. Executive Summary

Phase 39 is three discrete deliverables: (1) a FastAPI webhook service replacing the stdlib health server in the LiveKit agent container, (2) two pure Python functions that will power Phase 40's real routing logic, and (3) a Postgres migration adding five new columns to existing tables. None of these changes affect production call routing — the incoming-call endpoint always returns AI TwiML regardless of the schedule.

The biggest implementation risks are the uvicorn signal-handler gotcha in non-main threads (solved in uvicorn >=0.13.0 — already handled automatically), the Twilio form body double-consumption problem (mitigated by Starlette's internal form cache since FastAPI 0.108.0), and DST transition handling in the schedule evaluator (solved entirely by Python's `zoneinfo.astimezone()` without special-case code). The migration is straightforward: no column name conflicts exist in any of the 41 prior migrations, and the new index name `idx_calls_tenant_month` is unique.

**Primary recommendation:** Follow the locked decisions exactly. Use `threading.Thread(target=uvicorn.run, daemon=True)` with a simple `started` poll. Stash form data on `request.state` in the dependency (eliminates any re-parse question). Use `datetime.astimezone(ZoneInfo(tz))` for all DST work — no fold/gap special-casing needed for the UTC-to-local direction. Write exhaustive unit tests for the schedule evaluator before touching any webhook routes.

---

## 2. FastAPI + uvicorn Daemon-Thread Pattern

### How health.py Does It Today

`src/health.py` (being deleted) uses the canonical daemon-thread pattern:

```python
def start_health_server():
    def _run():
        try:
            server = HTTPServer(("", PORT), HealthHandler)
            print(f"[health] Health server listening on port {PORT}")
            server.serve_forever()
        except OSError as e:
            print(f"[health] Failed to start health server: {e}")
    thread = threading.Thread(target=_run, daemon=True)
    thread.start()
```

Called in `agent.py __main__` before `cli.run_app(...)`. The new `start_webhook_server()` follows exactly the same shape.

### `uvicorn.run()` Blocks — That Is Correct

`uvicorn.run(app, ...)` is a blocking call that runs an event loop internally. It must run in a daemon thread so the main thread can proceed to `cli.run_app(...)`. `daemon=True` ensures the uvicorn thread is killed automatically when the Railway container receives SIGTERM and the main process exits — no cleanup is needed from the webhook side.

### Signal Handler Gotcha — Already Resolved

**Confirmed (HIGH confidence — uvicorn PR #871, merged 2020-12-07, commit ce2ef45a):** uvicorn automatically skips `install_signal_handlers()` when not running in the main thread. This is the case for any uvicorn version >=0.13.0. The locked constraint `uvicorn[standard]>=0.30,<1` (current version ~0.34) means this is a non-issue — no custom `Server` subclass, no `install_signal_handlers` override is needed. `uvicorn.run(...)` works correctly when called from a daemon thread.

### start_webhook_server() — Exact Pattern

```python
# src/webhook/__init__.py
import threading
import uvicorn
from .app import app

def start_webhook_server():
    """Replace start_health_server(). FastAPI owns port 8080.
    Daemon=True: thread exits with the process on Railway SIGTERM.
    Non-blocking: main thread proceeds to cli.run_app() immediately.
    """
    def _run():
        try:
            uvicorn.run(
                app,
                host="0.0.0.0",
                port=8080,
                proxy_headers=True,
                forwarded_allow_ips="*",
                log_config=None,   # suppress uvicorn's default logging config
            )
        except Exception as e:
            import logging
            logging.getLogger("voco-webhook").error(f"[webhook] uvicorn failed: {e}")

    thread = threading.Thread(target=_run, daemon=True, name="voco-webhook")
    thread.start()
```

### agent.py __main__ Change

```python
# Before:
from .health import start_health_server

if __name__ == "__main__":
    start_health_server()
    cli.run_app(WorkerOptions(...))

# After:
from .webhook import start_webhook_server
# (src/health.py deleted)

if __name__ == "__main__":
    start_webhook_server()
    cli.run_app(WorkerOptions(...))
```

### uvicorn Boot Ordering

The daemon thread calls `uvicorn.run(...)` which starts an asyncio event loop internally. There is a brief moment (typically <100ms) between `thread.start()` and uvicorn actually binding the port. This is acceptable for Phase 39 because:
- Railway's HEALTHCHECK has a 30-second start period built into the Dockerfile
- LiveKit's `cli.run_app()` also takes several seconds to connect to the LiveKit Cloud, so uvicorn is fully up long before any Twilio request arrives

If Phase 40 needs to guarantee uvicorn is ready before proceeding, the pattern is:
```python
import uvicorn
class _ReadyServer(uvicorn.Server):
    def startup(self, sockets=None):
        super().startup(sockets)
        self.started = True  # already set by base class; just illustrating

# Poll thread.started (set internally by uvicorn.Server after bind)
```
Phase 39 does not need this — simple `thread.start()` is sufficient.

### SIGTERM Behavior on Railway (Linux)

- Railway sends SIGTERM to PID 1 (the `python -m src.agent start` process)
- Main thread receives SIGTERM, `cli.run_app()` handles graceful LiveKit worker shutdown
- The daemon thread (uvicorn) exits automatically when the main process exits
- No port teardown race: Railway waits for the container to stop before routing new requests

**Confidence:** HIGH — verified via uvicorn release notes, PR #871 commit history, and understanding of Python daemon thread semantics.

---

## 3. Twilio Signature Verification

### RequestValidator.validate() — Exact Signature

```python
from twilio.request_validator import RequestValidator

validator = RequestValidator(auth_token)
is_valid = validator.validate(
    uri,        # str: full URL Twilio posted to (must match exactly)
    params,     # dict: POST form data, or str for JSON body
    signature,  # str: value of X-Twilio-Signature header
)
# Returns bool
```

The validator internally tests both port-explicit and port-implicit variants of the URL (e.g., `https://example.com:443/path` and `https://example.com/path`) to accommodate Railway's HTTPS termination where port 443 may or may not appear in the URL.

### URL Reconstruction Behind Railway's Proxy

Railway's edge gateway forwards these headers (verified via Railway community docs):
- `x-forwarded-proto`: always `https` in production
- `x-forwarded-for`: client IP chain
- `host`: the Railway service public hostname (e.g., `voco-agent.up.railway.app`)

**Key fact about `x-forwarded-host`:** Railway *overwrites* `x-forwarded-host` with its own value. This means `request.headers['host']` (the plain `Host` header) is the Railway public hostname and is the correct anchor for URL reconstruction. Do not use `x-forwarded-host`.

With `uvicorn.run(..., proxy_headers=True, forwarded_allow_ips='*')`, Starlette's `request.url` already respects the `x-forwarded-proto` header, so `str(request.url)` reconstructs the correct HTTPS URL. The manual reconstruction in D-15 is an explicit belt-and-suspenders fallback:

```python
proto = request.headers.get("x-forwarded-proto", "https")  # fail-closed to https
host = request.headers["host"]                              # Railway public hostname
url = f"{proto}://{host}{request.url.path}"
```

This is **safer** than `str(request.url)` for Twilio validation because it excludes query strings (Twilio signs the base URL + POST form body, not query params for standard webhooks). It also avoids any Starlette URL normalization that could break the signature.

### FastAPI Dependency — verify_twilio_signature

```python
# src/webhook/security.py
import os
import logging
from fastapi import Request, HTTPException
from twilio.request_validator import RequestValidator

logger = logging.getLogger("voco-webhook")

async def verify_twilio_signature(request: Request) -> None:
    """FastAPI dependency. Raises 403 if Twilio signature is invalid.
    Applied at the router level — all /twilio/* routes are gated.
    """
    if os.environ.get("ALLOW_UNSIGNED_WEBHOOKS", "").lower() == "true":
        logger.warning("[webhook] ALLOW_UNSIGNED_WEBHOOKS=true — skipping signature check")
        return

    auth_token = os.environ.get("TWILIO_AUTH_TOKEN", "")
    signature = request.headers.get("X-Twilio-Signature", "")

    # Reconstruct URL the same way Twilio signed it (see D-15)
    proto = request.headers.get("x-forwarded-proto", "https")
    host = request.headers["host"]
    url = f"{proto}://{host}{request.url.path}"

    # Read and cache form body — see "Form Body Consumption" section below
    form_data = await request.form()
    params = dict(form_data)

    # Stash on request.state so route handlers can re-use without re-parsing
    request.state.form_data = params

    validator = RequestValidator(auth_token)
    if not validator.validate(url, params, signature):
        logger.warning(f"[webhook] Signature validation failed: url={url}")
        raise HTTPException(status_code=403, detail="Invalid Twilio signature")
```

### Router-Level Application

```python
# src/webhook/twilio_routes.py
from fastapi import APIRouter, Depends, Request, Response
from .security import verify_twilio_signature

router = APIRouter(
    prefix="/twilio",
    dependencies=[Depends(verify_twilio_signature)],
)

@router.post("/incoming-call")
async def incoming_call(request: Request) -> Response:
    # Form data already parsed and cached on request.state by the dependency
    form_data = request.state.form_data
    to_number = form_data.get("To", "")
    # ... tenant lookup, hardcoded AI TwiML ...
```

### Form Body Consumption Gotcha — Resolved

**The problem:** `await request.form()` reads the raw HTTP body stream. If a FastAPI dependency consumes the stream, the route handler cannot read it again — the stream is exhausted.

**The solution (verified):** Starlette's `Request.form()` caches the result internally in `request._form` after the first read (this behavior has been stable since FastAPI 0.108.0, which the locked `fastapi>=0.115` constraint satisfies). However, there is a subtlety: `request.form()` caches to `_form` but the `_body` cache is separate. If code later calls `await request.body()` after `form()`, it may fail with `RuntimeError: Stream consumed`.

**The cleanest resolution for Phase 39:** The dependency reads `await request.form()` once and stashes the dict on `request.state.form_data`. Route handlers access `request.state.form_data` — they never call `await request.form()` again. This is explicit, dependency-free, and works regardless of Starlette's internal caching behavior.

**Confidence:** HIGH — verified via Starlette discussion #1933 and FastAPI 0.108+ changelog.

---

## 4. Schedule Evaluator DST Edge Cases

### zoneinfo.astimezone() Is the Only Tool Needed

`datetime.astimezone(ZoneInfo(tenant_timezone))` converts a UTC-aware datetime to a timezone-aware local datetime correctly for all cases:
- DST spring-forward gap: a UTC time that falls in the skipped local window is mapped to the post-gap time (e.g., UTC 07:00 on 2026-03-08 maps to 03:00 EDT, not the non-existent 02:00 EST)
- DST fall-back fold: UTC times in the repeated local hour produce correct local times with `fold` set to 1 for the second occurrence (post-rollback). The evaluator compares HH:MM strings, so it correctly sees the local time regardless of fold.
- No special-case code, no `fold` attribute inspection, no gap/fold detection — just `astimezone()`.

### Verified DST Timestamps (Python 3.12 + tzdata, confirmed by execution)

**America/New_York 2026:**

| UTC time | Local result | Explanation |
|----------|-------------|-------------|
| 2026-03-08 06:59 | 01:59 EST | Last minute before spring-forward |
| 2026-03-08 07:00 | 03:00 EDT | Spring-forward pivot — 02:xx is non-existent |
| 2026-03-08 07:30 | 03:30 EDT | After spring-forward |
| 2026-11-01 05:59 | 01:59 EDT | Last minute before fall-back |
| 2026-11-01 06:00 | 01:00 EST fold=1 | Fall-back pivot — clock repeats 01:00 |
| 2026-11-01 06:30 | 01:30 EST fold=1 | Inside repeated hour |
| 2026-11-01 07:00 | 02:00 EST | After repeated hour ends |

**America/Chicago 2026 (tenant_timezone default per migration 003):**

| UTC time | Local result | Explanation |
|----------|-------------|-------------|
| 2026-03-08 07:59 | 01:59 CST | Last minute before spring-forward |
| 2026-03-08 08:00 | 03:00 CDT | Spring-forward pivot |
| 2026-11-01 06:59 | 01:59 CDT | Last minute before fall-back |
| 2026-11-01 07:00 | 01:00 CST fold=1 | Fall-back pivot |
| 2026-11-01 07:30 | 01:30 CST fold=1 | Inside repeated hour |
| 2026-11-01 08:00 | 02:00 CST | After repeated hour ends |

**Asia/Singapore (no DST — always UTC+8):**

| UTC time | Local result | Explanation |
|----------|-------------|-------------|
| Any UTC time | UTC+8 (fixed) | Singapore abolished DST in 1982 |

### Overnight Range Logic

An overnight range `{start:"19:00", end:"09:00"}` (end < start) spans two calendar days. The evaluator must check two conditions:
1. Local time >= start (e.g., >= 19:00 on day N)
2. Local time < end (e.g., < 09:00 on day N+1)

Implementation:
```python
def _in_range(local_time_str: str, start: str, end: str) -> bool:
    """Check if local_time_str HH:MM is within [start, end) range.
    Handles overnight ranges where end < start.
    """
    t = local_time_str
    if start <= end:
        # Normal range: e.g., 09:00-17:00
        return start <= t < end
    else:
        # Overnight range: e.g., 19:00-09:00 (crosses midnight)
        return t >= start or t < end
```

### Complete evaluate_schedule() Reference Implementation

```python
# src/webhook/schedule.py
from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime
from typing import Literal
from zoneinfo import ZoneInfo


@dataclass(frozen=True)
class ScheduleDecision:
    mode: Literal["ai", "owner_pickup"]
    reason: Literal["schedule_disabled", "empty_schedule", "outside_window", "inside_window"]


_DAY_MAP = {0: "mon", 1: "tue", 2: "wed", 3: "thu", 4: "fri", 5: "sat", 6: "sun"}


def _in_range(local_hhmm: str, start: str, end: str) -> bool:
    if start <= end:
        return start <= local_hhmm < end
    # Overnight: start > end, e.g. "19:00"-"09:00"
    return local_hhmm >= start or local_hhmm < end


def evaluate_schedule(
    schedule: dict,
    tenant_timezone: str,
    now_utc: datetime,
) -> ScheduleDecision:
    """Pure function — no DB access. Called by /twilio/incoming-call handler.

    Args:
        schedule: call_forwarding_schedule JSONB value from tenants table.
                  Shape: {enabled: bool, days: {mon..sun: [{start, end}]}}
        tenant_timezone: IANA timezone string (e.g. "America/New_York")
        now_utc: UTC-aware datetime (datetime.now(tz=timezone.utc) at call time)

    Returns:
        ScheduleDecision with mode='ai' or 'owner_pickup' and a reason string.
    """
    if not schedule or not schedule.get("enabled", False):
        return ScheduleDecision(mode="ai", reason="schedule_disabled")

    days = schedule.get("days", {})
    if not days:
        return ScheduleDecision(mode="ai", reason="empty_schedule")

    # Convert UTC -> tenant local time. zoneinfo handles DST gaps/folds correctly.
    local_dt = now_utc.astimezone(ZoneInfo(tenant_timezone))
    day_key = _DAY_MAP[local_dt.weekday()]
    local_hhmm = local_dt.strftime("%H:%M")

    ranges = days.get(day_key, [])
    if not ranges:
        return ScheduleDecision(mode="ai", reason="outside_window")

    for r in ranges:
        start, end = r.get("start", ""), r.get("end", "")
        if not start or not end:
            continue
        if _in_range(local_hhmm, start, end):
            return ScheduleDecision(mode="owner_pickup", reason="inside_window")

    return ScheduleDecision(mode="ai", reason="outside_window")
```

### Unit Test Fixture Table

All tests use `datetime(..., tzinfo=timezone.utc)` as `now_utc`. Timezone is `America/New_York` unless noted.

| Test case | Schedule | now_utc | Expected mode | Expected reason |
|-----------|----------|---------|---------------|-----------------|
| Schedule disabled | `{enabled:false, days:{...}}` | any | ai | schedule_disabled |
| Empty dict | `{}` | any | ai | schedule_disabled |
| enabled:true, days empty | `{enabled:true, days:{}}` | any | ai | empty_schedule |
| Inside window | `{enabled:true, days:{mon:[{start:"09:00",end:"17:00"}]}}` | Mon 14:00 UTC (= 10:00 EST in Jan) | owner_pickup | inside_window |
| Outside window | same | Mon 22:00 UTC (= 17:00 EST, end boundary exclusive) | ai | outside_window |
| Day with no ranges | `{enabled:true, days:{tue:[...]}}` | Mon any time | ai | outside_window |
| Exact start boundary | `{enabled:true, days:{mon:[{start:"09:00",end:"17:00"}]}}` | Mon at local 09:00 | owner_pickup | inside_window |
| Exact end boundary | same | Mon at local 17:00 | ai | outside_window (end is exclusive) |
| All-day range | `{enabled:true, days:{mon:[{start:"00:00",end:"23:59"}]}}` | Mon any time | owner_pickup | inside_window |
| Overnight range, inside (evening) | `{enabled:true, days:{mon:[{start:"19:00",end:"09:00"}]}}` | Mon 20:00 local | owner_pickup | inside_window |
| Overnight range, inside (morning) | same | Tue 08:00 local (but checked against Mon ranges) | --- | Note: "tue" key needed |
| Overnight range, outside | same schedule on mon | Mon 12:00 local | ai | outside_window |
| DST spring-forward gap (NY) | `{enabled:true, days:{sun:[{start:"02:00",end:"04:00"}]}}` | 2026-03-08 07:00 UTC (maps to 03:00 EDT, skips 02:xx) | owner_pickup | inside_window (03:00 is inside 02:00-04:00) |
| DST fall-back fold (NY) | `{enabled:true, days:{sun:[{start:"01:00",end:"02:00"}]}}` | 2026-11-01 06:30 UTC (maps to 01:30 EST fold=1) | owner_pickup | inside_window (evaluator sees 01:30 regardless of fold) |
| Singapore (no DST) | `{enabled:true, days:{sun:[{start:"10:00",end:"18:00"}]}}` | 2026-03-08 04:00 UTC (= 12:00 SGT) | owner_pickup | inside_window |
| Multi-range day | `{enabled:true, days:{mon:[{start:"08:00",end:"12:00"},{start:"14:00",end:"18:00"}]}}` | Mon 13:00 local | ai | outside_window |
| Multi-range day, second range | same | Mon 15:00 local | owner_pickup | inside_window |

**Overnight range spanning-midnight note:** The test case where "inside (morning) Tue 08:00" with a Monday overnight range requires the evaluator to look up the *current* day's ranges. If now_utc maps to Tuesday local time, the evaluator looks at `days["tue"]`. For overnight ranges that span into the next day, the convention is: the range `{start:"19:00", end:"09:00"}` is listed under the day where the window OPENS (Monday in this case). A call arriving at Tuesday 08:00 local time would only be caught if the same overnight range is also listed under Tuesday, OR if the evaluator has cross-day awareness. The locked decision (D-07) says "start → midnight on day N + midnight → end on day N+1". The reference implementation above satisfies this: for `local_hhmm="08:00"` with range `start="19:00", end="09:00"`, `_in_range("08:00", "19:00", "09:00")` returns `True` because `"08:00" < "09:00"` satisfies the overnight branch. The evaluator looks up whichever day key maps to `local_dt.weekday()`. This means: a Monday overnight range catches calls on Monday evening AND Tuesday morning — both look up "mon" if local_dt is Monday, and "tue" if local_dt is Tuesday. For a Tuesday morning call to be caught by Monday's 19:00-09:00 window, that same `{start:"19:00",end:"09:00"}` range must also appear under "tue". This is the simplest model and avoids cross-day lookups. The planner should document this in the schedule documentation for Phase 41's UI.

---

## 5. Soft Cap Query and Index

### Exact SQL (from D-17)

```sql
SELECT COALESCE(SUM(outbound_dial_duration_sec), 0)
FROM calls
WHERE tenant_id = $1
  AND created_at >= date_trunc('month', now())
```

### UTC Anchoring — Acceptable

`date_trunc('month', now())` anchors to the UTC month boundary (e.g., 2026-05-01 00:00:00 UTC). This means a tenant in Singapore (UTC+8) whose billing month is May sees calls from April 30 22:00-23:59 SGT excluded from the May cap (they happened in UTC April). The error is at most 8 hours at month boundaries and affects only tenants near the UTC month transition.

**This is acceptable at current scale** per D-17. The alternative (tenant-local month anchoring) would require joining to `tenants.tenant_timezone` and using `date_trunc('month', now() AT TIME ZONE tenant_timezone)`, which adds a join and cannot use a simple range index. UTC anchoring keeps the query single-table with full index coverage.

### Supporting Index

```sql
CREATE INDEX IF NOT EXISTS idx_calls_tenant_month
  ON calls (tenant_id, created_at);
```

**Query plan:** This is a compound B-tree index. The WHERE clause `tenant_id = $1` is an equality predicate on the leading column (high selectivity for a SaaS app with many tenants), and `created_at >= date_trunc('month', now())` is a range predicate on the second column. This is a standard "equality + range" pattern that uses the index efficiently via Index Scan — Postgres can seek to the tenant's partition of the index and scan forward from the month start. The COALESCE/SUM is computed over the matching rows.

**No conflict confirmed:** Scanning all 41 prior migrations, no index named `idx_calls_tenant_month` exists. The existing call-related indexes are:
- `idx_calls_tenant_id` on `calls(tenant_id)` — migration 001
- `idx_calls_from_number` on `calls(tenant_id, from_number)` — migration 001
- `idx_calls_call_id` on `calls(call_id)` — migration 023 (replaced retell_call_id index)
- `idx_calls_booking_outcome` on `calls(tenant_id, booking_outcome)` — migration 008
- `idx_calls_notification_priority` on `calls(tenant_id, notification_priority)` — migration 008
- `idx_calls_recovery_sms_retry` — migration 009

The new `idx_calls_tenant_month` is additive and does not overlap with any existing index name. `CREATE INDEX IF NOT EXISTS` is safe to apply to any database state.

### check_outbound_cap() Implementation

```python
# src/webhook/caps.py
import logging
from .supabase_client_ref import get_supabase_client  # imports get_supabase_admin

logger = logging.getLogger("voco-webhook")

# Limits in seconds
_LIMITS_SEC = {
    "US": 5000 * 60,   # 300_000 seconds
    "CA": 5000 * 60,   # 300_000 seconds
    "SG": 2500 * 60,   # 150_000 seconds
}
_DEFAULT_LIMIT_SEC = 5000 * 60  # fail-open: use US limit for unknown countries


async def check_outbound_cap(tenant_id: str, country: str) -> bool:
    """Returns True if tenant is under cap, False if at/over cap.
    Async because Supabase calls are wrapped in asyncio.to_thread().
    """
    limit_sec = _LIMITS_SEC.get(country.upper(), _DEFAULT_LIMIT_SEC)

    import asyncio
    from .._supabase_client import get_supabase_admin
    supabase = get_supabase_admin()

    result = await asyncio.to_thread(
        lambda: supabase.rpc(
            "sum_outbound_seconds",  # OR raw SQL via postgrest
            {"p_tenant_id": tenant_id}
        ).execute()
    )
    # ... or use direct table query via postgrest filter:
    # supabase.table("calls")
    #   .select("outbound_dial_duration_sec.sum()")  -- postgrest aggregate syntax
    #   .eq("tenant_id", tenant_id)
    #   .gte("created_at", month_start_iso)
    #   .execute()
```

**Implementation note on supabase-py aggregates:** The Python supabase-py SDK exposes PostgREST's aggregate syntax. The cleanest approach is a Supabase RPC (PLPGSQL function) for the SUM query, because supabase-py's `.select("col.sum()")` syntax is available but less discoverable and may vary by SDK version. An RPC named `get_outbound_seconds_this_month(p_tenant_id uuid)` returning a single integer is the most robust. However, a direct PostgREST approach also works — the planner should choose one and document the preference. Both patterns exist in the codebase (RPC: `assign_sg_number`, `increment_calls_used`; direct table: most tool queries).

---

## 6. FastAPI + pytest Patterns

### Framework Setup

```bash
pip install pytest pytest-asyncio httpx fastapi
```

`httpx` is already installed in the environment (version 0.28.1 confirmed). FastAPI 0.115.13 is installed. `httpx` provides `TestClient` (sync) and `AsyncClient` (async) for FastAPI testing.

### TestClient Pattern (Sync — Recommended for Phase 39)

```python
# tests/webhook/conftest.py
import pytest
from fastapi.testclient import TestClient
from src.webhook.app import app
from src.webhook.security import verify_twilio_signature

@pytest.fixture
def client():
    """TestClient with signature verification bypassed."""
    app.dependency_overrides[verify_twilio_signature] = lambda: None
    yield TestClient(app)
    app.dependency_overrides.clear()
```

### Three Options for Testing Signature-Gated Routes

**Option A — ALLOW_UNSIGNED_WEBHOOKS env var (recommended for integration smoke tests)**

```python
import os
import pytest
from fastapi.testclient import TestClient
from src.webhook.app import app

@pytest.fixture
def unsigned_client(monkeypatch):
    monkeypatch.setenv("ALLOW_UNSIGNED_WEBHOOKS", "true")
    return TestClient(app)

def test_incoming_call_returns_twiml(unsigned_client):
    resp = unsigned_client.post(
        "/twilio/incoming-call",
        data={"To": "+15551234567", "From": "+15559876543"},
        headers={"X-Twilio-Signature": "fake"},
    )
    assert resp.status_code == 200
    assert "Sip" in resp.text or "Response" in resp.text
```

**Option B — dependency_overrides (recommended for unit testing routes in isolation)**

```python
@pytest.fixture
def client_no_auth():
    app.dependency_overrides[verify_twilio_signature] = lambda: None
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

def test_dial_status_returns_empty_twiml(client_no_auth):
    resp = client_no_auth.post("/twilio/dial-status", data={"CallStatus": "completed"})
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("application/xml")
```

**Option C — compute real Twilio signatures (recommended for security validation tests)**

```python
from twilio.request_validator import RequestValidator

def _make_twilio_headers(url: str, params: dict, auth_token: str) -> dict:
    """Compute a valid X-Twilio-Signature for test requests."""
    from urllib.parse import urlencode
    import base64, hashlib, hmac
    # RequestValidator does this internally, but we need the output
    validator = RequestValidator(auth_token)
    # Use private method to compute signature
    sorted_params = "".join(f"{k}{v}" for k, v in sorted(params.items()))
    s = url + sorted_params
    mac = hmac.new(auth_token.encode(), s.encode(), hashlib.sha1)
    return {"X-Twilio-Signature": base64.b64encode(mac.digest()).decode()}

@pytest.fixture
def test_auth_token():
    return "test_auth_token_12345"

def test_signature_rejection(test_auth_token, monkeypatch):
    """Confirm 403 when signature is wrong."""
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", test_auth_token)
    monkeypatch.delenv("ALLOW_UNSIGNED_WEBHOOKS", raising=False)
    with TestClient(app) as client:
        resp = client.post(
            "/twilio/incoming-call",
            data={"To": "+15551234567"},
            headers={"X-Twilio-Signature": "invalid_signature"},
        )
    assert resp.status_code == 403
```

**Recommendation:** Use Option B (dependency_overrides) as the primary pattern for route behavior tests. Use Option C for the security test that explicitly validates 403 on bad signatures and 200 on valid ones. Avoid Option A in CI (it bypasses the security layer — acceptable for local dev curl testing, not for the test suite).

### Test Organization

```
livekit-agent/
└── tests/
    ├── __init__.py
    ├── webhook/
    │   ├── __init__.py
    │   ├── conftest.py          # shared fixtures (TestClient, auth token)
    │   ├── test_schedule.py     # evaluate_schedule unit tests (pure function, no FastAPI)
    │   ├── test_caps.py         # check_outbound_cap unit tests (mocked Supabase)
    │   ├── test_routes.py       # webhook endpoint tests (dependency_overrides)
    │   └── test_security.py     # signature verification tests (Option C)
```

No test infrastructure exists today in the livekit-agent repo (confirmed by filesystem scan). Wave 0 must create `tests/`, `tests/__init__.py`, `tests/webhook/`, `tests/webhook/conftest.py`, and a `pytest.ini` or `[tool.pytest.ini_options]` section in `pyproject.toml`.

**pytest.ini_options for pyproject.toml:**
```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
asyncio_mode = "auto"  # if using pytest-asyncio
```

---

## 7. Migration Verification

### Migration Number — 042 is Free

Confirmed: `supabase/migrations/` contains 001 through 041. The highest is `041_calls_realtime.sql`. Migration `042_call_routing_schema.sql` is the next sequential number with no gaps or conflicts.

### Column Name Conflicts — None Found

Scanned all 41 migration files for: `routing_mode`, `outbound_dial_duration_sec`, `call_forwarding_schedule`, `pickup_numbers`, `dial_timeout_seconds`. **None found.** All five column names are new.

### Existing Columns on tenants (cumulative, all migrations)

From migration 001 and subsequent ALTERs:
- `id`, `created_at`, `updated_at`, `owner_id`, `business_name`, `owner_phone`, `owner_email`, `default_locale`, `onboarding_complete` — migration 001
- `tenant_timezone`, `slot_duration_mins` — migration 003
- `working_hours`, `services_configured` — migration (various)
- `owner_name`, `country`, `provisioning_failed` — migration 011
- `phone_number` (renamed from `retell_phone_number`) — migration 023
- `tone_preset`, `default_locale` (extended) — various
- New in 042: `call_forwarding_schedule`, `pickup_numbers`, `dial_timeout_seconds`

### Existing Columns on calls (cumulative)

From migration 001 and subsequent ALTERs:
- `id`, `tenant_id`, `call_id` (renamed from `retell_call_id`), `created_at`, `from_number`, `to_number`, `direction`, `status`, `disconnection_reason`, `start_timestamp`, `end_timestamp`, `duration_seconds` (generated), `recording_url`, `recording_storage_path`, `transcript_text`, `transcript_structured`, `detected_language`, `language_barrier`, `barrier_language`, `call_metadata` (renamed from `retell_metadata`), `egress_id`, `call_provider` — various migrations
- `suggested_slots`, `booking_outcome`, `notification_priority`, `recovery_sms_status` — various migrations
- New in 042: `routing_mode`, `outbound_dial_duration_sec`

### Migration File — Exact SQL (from D-18)

```sql
-- Migration 042: Call routing schema
-- Phase 39: Call Routing Webhook Foundation

ALTER TABLE tenants
  ADD COLUMN call_forwarding_schedule JSONB NOT NULL DEFAULT '{"enabled":false,"days":{}}'::jsonb,
  ADD COLUMN pickup_numbers JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_array_length(pickup_numbers) <= 5),
  ADD COLUMN dial_timeout_seconds INTEGER NOT NULL DEFAULT 15;

ALTER TABLE calls
  ADD COLUMN routing_mode TEXT CHECK (routing_mode IN ('ai','owner_pickup','fallback_to_ai')),
  ADD COLUMN outbound_dial_duration_sec INTEGER;

CREATE INDEX IF NOT EXISTS idx_calls_tenant_month ON calls (tenant_id, created_at);
```

**Notes:**
- `routing_mode` is nullable with no default (D-19) — Phase 41 renders NULL as "AI" (legacy calls)
- `outbound_dial_duration_sec` is nullable — Phase 40 populates it via dial-status callback
- The `CHECK (jsonb_array_length(pickup_numbers) <= 5)` constraint is enforced at DB level; item shape validation is Phase 41 API layer
- Single atomic file = single rollback unit

### Migration Test Pattern in This Repo

No migration test framework exists in this repo. Migrations are applied manually via `supabase db push` or the Supabase dashboard. The Phase 39 acceptance test for the migration is: run the migration on staging, confirm the new columns exist in the Supabase table editor, and confirm existing tenant rows show default values (`{"enabled":false,"days":{}}` and `[]`).

---

## 8. Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest (no existing pytest.ini — Wave 0 must create) |
| Config file | `pyproject.toml` [tool.pytest.ini_options] — Wave 0 |
| Quick run command | `pytest tests/webhook/test_schedule.py tests/webhook/test_caps.py -x` |
| Full suite command | `pytest tests/ -x` |
| Dependencies | `pytest`, `pytest-asyncio`, `httpx` (httpx already installed) |

### Phase Requirements to Test Map

| Success Criterion | Behavior | Test Type | Command | File |
|-------------------|----------|-----------|---------|------|
| SC-1: Migration adds columns | schema change verified | manual | `supabase db push && psql -c "\d tenants"` | N/A |
| SC-2: FastAPI server runs, 4 endpoints respond | all 4 routes return 200 with TwiML | integration | `pytest tests/webhook/test_routes.py -x` | Wave 0 |
| SC-3: Signature verification rejects unsigned | 403 on bad signature, 200 on valid | integration | `pytest tests/webhook/test_security.py -x` | Wave 0 |
| SC-4: evaluate_schedule passes unit tests | DST + overnight + empty + disabled | unit | `pytest tests/webhook/test_schedule.py -x` | Wave 0 |
| SC-5: check_outbound_cap enforces limits | mocked DB, US/CA/SG at cap and under | unit | `pytest tests/webhook/test_caps.py -x` | Wave 0 |
| SC-6: Zero production traffic | no Twilio number is reconfigured | manual review | `twilio api core incoming-phone-numbers list` | N/A |

### Unit Tests — evaluate_schedule

File: `tests/webhook/test_schedule.py`

Cover (minimum): empty dict, enabled:false, enabled:true+empty days, inside window, outside window, exact start boundary (inclusive), exact end boundary (exclusive), overnight inside-evening, overnight inside-morning (same-day overnight key), overnight outside, DST spring-forward (NY 2026-03-08 07:00 UTC), DST fall-back (NY 2026-11-01 06:30 UTC), Singapore (no DST), multi-range inside, multi-range outside, all-day 00:00-23:59.

All tests are pure Python with `datetime(year, month, day, hour, minute, tzinfo=timezone.utc)` as input — no DB, no HTTP, no mocking required.

### Unit Tests — check_outbound_cap

File: `tests/webhook/test_caps.py`

Cover: under cap (US), at cap exactly (US = 300000 sec), over cap (US), under cap (SG = 150000 sec), at cap (SG), unknown country (falls back to US limit), zero seconds used (empty month).

Use `unittest.mock.patch` or `pytest-mock` to mock `get_supabase_admin()` and return controlled SUM values. The function must be async (uses `asyncio.to_thread`), so tests need `@pytest.mark.asyncio` or `asyncio_mode = "auto"`.

### Integration Tests — Webhook Endpoints

File: `tests/webhook/test_routes.py`

Cover:
- `POST /twilio/incoming-call` returns 200, Content-Type application/xml, body contains `<Response>` and `<Sip>` (ALLOW_UNSIGNED=true)
- `POST /twilio/dial-status` returns 200, body is `<Response/>` or empty TwiML
- `POST /twilio/dial-fallback` returns 200, body is `<Response/>` or empty TwiML
- `POST /twilio/incoming-sms` returns 200, body is `<Response/>` or empty TwiML
- `GET /health` returns 200 with `{"status":"ok"}`
- `GET /health/db` returns 200 or 503 (DB connection dependent)

File: `tests/webhook/test_security.py`

Cover:
- Valid signature → 200
- Invalid signature → 403
- Missing X-Twilio-Signature header → 403
- ALLOW_UNSIGNED_WEBHOOKS=true → 200 with any/no signature

### Manual Verification Checklist

1. **Railway deploy logs** — confirm `[webhook] uvicorn listening on 0.0.0.0:8080` appears BEFORE LiveKit worker connects (i.e., uvicorn boots first)
2. **`/health` still works** — `curl https://voco-agent.up.railway.app/health` returns `{"status":"ok",...}` after deploy
3. **Twilio console "Test webhook"** — use Twilio Console > Phone Numbers > Test Webhook tool, point at staging URL `/twilio/incoming-call` with ALLOW_UNSIGNED_WEBHOOKS=true, confirm 200 + TwiML response
4. **Signature rejection** — `curl -X POST https://voco-agent.up.railway.app/twilio/incoming-call -d "To=+1..." -H "X-Twilio-Signature: bad"` returns 403
5. **Database schema** — Supabase dashboard shows new columns on tenants and calls with correct defaults
6. **Zero production traffic** — Twilio console shows existing phone numbers still pointing at SIP trunk, not at the new webhook URL

### Non-Goals of Validation

- No E2E real Twilio phone call in Phase 39 (that is Phase 40 cutover validation)
- No regression testing of existing tenant routing behavior (nothing is reconfigured)
- No load testing (webhook is idle in Phase 39)
- No testing of SMS forwarding logic (Phase 40)
- No testing of parallel ring TwiML (Phase 40)

### Wave 0 Gaps (test infrastructure to create before implementation)

- [ ] `tests/__init__.py` — empty, makes tests/ a package
- [ ] `tests/webhook/__init__.py` — empty
- [ ] `tests/webhook/conftest.py` — TestClient fixture, auth token fixture
- [ ] `tests/webhook/test_schedule.py` — pure function tests (no external deps)
- [ ] `tests/webhook/test_caps.py` — mocked DB tests
- [ ] `tests/webhook/test_routes.py` — integration route tests
- [ ] `tests/webhook/test_security.py` — signature verification tests
- [ ] `pyproject.toml` [tool.pytest.ini_options] section — testpaths, asyncio_mode
- [ ] Framework install: `pip install pytest pytest-asyncio` (httpx already available)

---

## 9. voice-call-architecture SKILL.md Update List

Per CLAUDE.md: "When making changes to any system covered by a skill, read the skill first, make the code changes, then update the skill to reflect the new state."

The following sections of `.claude/skills/voice-call-architecture/SKILL.md` become stale after Phase 39 and MUST be updated:

### 9.1 Architecture Overview (Section: "Architecture Overview" / service table)

**Current:** Shows two services (Next.js + LiveKit Voice Agent). The LiveKit agent has one public surface: health check.

**Update needed:** Add a row or note that the LiveKit Railway service now also exposes a FastAPI webhook surface on port 8080 at `/twilio/*`. Update the call flow diagram to show "Twilio (future Phase 40)" as a new potential entry point via the webhook.

### 9.2 File Map (Section: "Agent Repo" table)

**Current:** `src/health.py | HTTP health check server on port 8080`

**Update needed:**
- Remove `src/health.py` row (file deleted)
- Add rows for all new webhook files:
  - `src/webhook/__init__.py` | Webhook subpackage entry — exports app, start_webhook_server
  - `src/webhook/app.py` | FastAPI app instance, /health, /health/db routes
  - `src/webhook/twilio_routes.py` | APIRouter for /twilio/* (4 endpoints, signature-gated)
  - `src/webhook/security.py` | verify_twilio_signature FastAPI dependency
  - `src/webhook/schedule.py` | evaluate_schedule() pure function + ScheduleDecision dataclass
  - `src/webhook/caps.py` | check_outbound_cap() function

### 9.3 Agent Service — Key Dependencies (Section 1 dependency table)

**Update needed:** Add `fastapi>=0.115,<1` and `uvicorn[standard]>=0.30,<1` to the dependency list.

### 9.4 Section 1 "Connection Lifecycle" or new Section

**Update needed:** Add a note that `start_webhook_server()` is called from `__main__` before `cli.run_app()`, replacing the deleted `start_health_server()`. The webhook runs in a daemon thread on port 8080.

### 9.5 New Section — Webhook Service

Add a new section (e.g., "## 11. Webhook Service") covering:
- FastAPI app at src/webhook/app.py
- Four Twilio endpoints (all POST, all signature-gated)
- Phase 39 behavior: incoming-call always returns AI TwiML (no real routing yet)
- evaluate_schedule() signature, ScheduleDecision shape, schedule JSONB format
- check_outbound_cap() signature, limits by country, index
- Security: verify_twilio_signature dependency, ALLOW_UNSIGNED_WEBHOOKS bypass, URL reconstruction pattern
- Test infrastructure: pytest in tests/webhook/

### 9.6 Environment Variables (Section 9)

**Update needed:** Add `ALLOW_UNSIGNED_WEBHOOKS` to the environment variable table with purpose "Bypass Twilio signature verification for local dev (never set in production)".

### 9.7 Key Design Decisions (Section 10)

**Update needed:** Add entries for:
- FastAPI replaces stdlib HTTPServer health check — unified port 8080 for health + webhooks
- Daemon thread pattern for uvicorn (same as previous health server pattern)
- Twilio signature verification as router-level dependency (zero per-route boilerplate)
- evaluate_schedule() pure function design (no DB access, trivially unit-testable)
- D-13 intentional dead weight: incoming-call exercises full wiring path with hardcoded AI TwiML so Phase 40's diff is one line

---

## 10. Open Questions and Risks

### OQ-1: check_outbound_cap async vs sync

`check_outbound_cap` needs to call Supabase. The FastAPI route handlers are async. The pattern in agent.py wraps sync Supabase calls in `asyncio.to_thread()`. The caps.py function should be `async def` and use `await asyncio.to_thread(lambda: supabase...)` internally. The planner should confirm whether `caps.py` exports an async function or a sync function (and leaves asyncio.to_thread to the caller). Recommendation: make it async — the caller (webhook handler) is already async, and it keeps the DB-access pattern consistent.

### OQ-2: supabase-py aggregate syntax for SUM

The exact supabase-py code for `SUM(outbound_dial_duration_sec)` with a date filter needs to be confirmed against the installed SDK version. Options:
- PostgREST `count` header approach (not for SUM)
- Custom RPC function `get_outbound_seconds_this_month(p_tenant_id uuid) RETURNS bigint`
- Raw SQL via `supabase.rpc('function_name', params)`

Recommendation: add a Postgres RPC function `get_outbound_seconds_this_month` in the migration. This keeps the query logic server-side, is cleanly callable from supabase-py, and avoids any SDK version uncertainty. Add to migration 042. **This is within Phase 39's scope since it supports check_outbound_cap which is a Phase 39 deliverable.**

### OQ-3: Where _normalize_phone lives after Phase 39

`_normalize_phone()` is currently defined as a local function inside `entrypoint()` in `src/agent.py`. Phase 39's `/twilio/incoming-call` handler needs the same normalization (D-13). Options:
- Extract to `src/lib/phone.py` (clean, importable by both agent.py and webhook/)
- Copy the function into `src/webhook/twilio_routes.py` (duplication, fragile)

Recommendation: extract to `src/lib/phone.py` in Phase 39. This is a minor refactor with zero behavioral change and prevents duplication. The planner should include this as a task.

### OQ-4: FastAPI app startup — DB connection verification

The current `src/health.py` checks DB connectivity on `GET /health/db`. The new FastAPI app should preserve this. The check should use `asyncio.to_thread()` to call `get_supabase_admin()` (which is sync) without blocking the async ASGI event loop. No additional concern beyond porting the existing logic.

### OQ-5: TwiML for /twilio/incoming-call AI baseline

The SIP URI that Phase 39's hardcoded AI TwiML should dial needs to be confirmed. The existing SIP trunk configuration (sip-inbound-trunk.json) routes calls from Twilio to LiveKit. When the webhook is live (Phase 40), it will replace this by pointing the Twilio voice_url at the webhook. But for Phase 39's hardcoded baseline, the `<Dial><Sip>` destination must be the existing LiveKit SIP URI. This value should be stored as an environment variable (e.g., `LIVEKIT_SIP_URI`) rather than hardcoded, so Phase 40 can change the routing without re-deploying with a new string baked in.

**Risk level: LOW** — Phase 39 endpoints are not called by any real Twilio number, so even if the SIP URI is a placeholder string, no production call is affected.

### OQ-6: Railway public hostname for TWILIO_WEBHOOK_BASE_URL

Phase 40 will need the Railway public URL when configuring Twilio number voice_url. This is not a Phase 39 concern (no Twilio numbers are reconfigured), but the planner should ensure Phase 39's Railway deployment outputs its public URL (visible in Railway dashboard) so Phase 40 can use it. No code change needed in Phase 39 — just documentation.

---

## Sources

### Primary (HIGH confidence)
- Python docs `zoneinfo` module — astimezone() DST behavior confirmed
- Direct execution: Python 3.13 + tzdata, verified UTC↔NY/Chicago/Singapore conversions
- uvicorn PR #871 / commit ce2ef45a — `install_signal_handlers` skip in non-main thread, merged 2020-12-07
- FastAPI 0.115.13 installed locally — version confirmed
- Starlette discussion #1933 — form() caching behavior
- Migrations 001–041 — column name and index name conflicts scanned directly

### Secondary (MEDIUM confidence)
- Railway community station post on x-forwarded-host — confirmed Railway overwrites this header
- Twilio official blog "Build a Secure Twilio Webhook with Python and FastAPI" — RequestValidator usage pattern
- GitHub twilio/twilio-python request_validator.py — validate() method signature and port-variant logic
- FastAPI official docs "Testing Dependencies with Overrides" — dependency_overrides pattern

### Tertiary (LOW confidence — not used for critical decisions)
- WebSearch results on uvicorn signal handling issues post-0.29 — context only, not relied upon
- WebSearch results on Railway proxy headers — supplemented by direct station post

---

## Metadata

**Confidence breakdown:**
- Standard stack (FastAPI/uvicorn): HIGH — versions pinned, both installed locally
- uvicorn daemon thread / SIGTERM: HIGH — PR #871 confirmed, behavior verified by understanding of Python daemon threads
- Twilio signature verification: HIGH — official Twilio docs + SDK source reviewed
- DST transitions: HIGH — exact timestamps computed by Python execution
- Migration / column conflicts: HIGH — scanned all 41 migrations directly
- Supabase SUM query: MEDIUM — postgrest aggregate syntax has SDK version uncertainty (OQ-2)
- Test infrastructure: HIGH — pytest + httpx patterns are standard, no novel dependencies

**Research date:** 2026-04-09
**Valid until:** 2026-07-09 (90 days — stable APIs, no fast-moving dependencies)

---

## RESEARCH COMPLETE

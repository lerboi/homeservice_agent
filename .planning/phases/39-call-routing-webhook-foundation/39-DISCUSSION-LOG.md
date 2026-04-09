# Phase 39: Call Routing Webhook Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-09
**Phase:** 39-call-routing-webhook-foundation
**Areas discussed:** FastAPI co-process model, Schedule JSONB shape, Evaluator I/O + module boundary, Signature verification + soft cap plumbing

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Schedule JSONB shape | Canonical shape of `call_forwarding_schedule` — per-day arrays, one range vs multi-range, how 'AI-only' / 'owner-only' / overnight crossings are encoded | ✓ |
| FastAPI co-process model | How FastAPI lives alongside the LiveKit worker in the same Railway container — same port as health.py or separate, uvicorn in a thread vs subprocess | ✓ |
| Signature verification + soft cap plumbing | Grouped: X-Twilio-Signature verification (URL reconstruction behind Railway TLS proxy, local dev handling) AND check_outbound_cap data source | ✓ |
| Evaluator I/O + module boundary | Grouped: evaluate_schedule signature + shared-code boundary between src/webhook and existing src/lib | ✓ |

**User's choice:** All four selected.

---

## FastAPI Co-Process Model

### Q1: How should the FastAPI webhook service coexist with the LiveKit agent worker?

| Option | Description | Selected |
|--------|-------------|----------|
| Replace health.py with FastAPI on 8080 | FastAPI serves /health, /health/db, AND /twilio/* on a single port | ✓ |
| FastAPI sidecar on new port | Keep src/health.py; FastAPI on 8081; requires second Railway service or front proxy | |
| Separate Railway service entirely | New Railway service with its own Dockerfile, only runs FastAPI | |

**User's choice:** Replace health.py with FastAPI on 8080
**Notes:** One process, one public port, unified logging, no deployment surface change. `src/health.py` is deleted.

### Q2: How should uvicorn be started?

| Option | Description | Selected |
|--------|-------------|----------|
| Daemon thread from agent.py main | Same pattern as start_health_server today | ✓ |
| Separate process via supervisor/honcho | Procfile with agent + web processes | |
| Async task inside the worker entrypoint | Mix uvicorn with livekit-agents' asyncio loop | |

**User's choice:** Daemon thread from agent.py main
**Notes:** Before cli.run_app(...), spawn daemon thread running uvicorn.run(app, host='0.0.0.0', port=8080, ...).

### Q3: Module layout

| Option | Description | Selected |
|--------|-------------|----------|
| src/webhook/ subpackage | app.py, twilio_routes.py, security.py, schedule.py, caps.py | ✓ |
| Flat under src/ | src/app.py + src/webhook_handlers.py | |
| Under src/lib/ alongside booking/triage | blurs execution-surface boundary | |

**User's choice:** src/webhook/ subpackage

### Q4: Deps & build

| Option | Description | Selected |
|--------|-------------|----------|
| Add fastapi + uvicorn[standard], no Dockerfile change | pip install . picks them up; HEALTHCHECK still valid | ✓ |
| Add deps + explicit Dockerfile EXPOSE 8080 | Documentation-only | |
| Keep stdlib http.server, no FastAPI | Rejected by Q1 | |

**User's choice:** Add fastapi + uvicorn[standard], no Dockerfile change

---

## Schedule JSONB Shape

### Q1: Canonical shape

| Option | Description | Selected |
|--------|-------------|----------|
| Enabled flag + per-day keyed object | {enabled, days: {mon: [{start,end}], ...}} | ✓ |
| Flat rules array | {enabled, rules: [{days:[...], start, end}]} | |
| Mode enum + optional windows | {mode: 'always_ai'|'always_owner'|'scheduled', windows: ...} | |

**User's choice:** Enabled flag + per-day keyed object

### Q2: Whose window do ranges represent?

| Option | Description | Selected |
|--------|-------------|----------|
| Ranges = owner pickup windows | Natural language match: "ring me after hours" | ✓ |
| Ranges = AI windows | Inverse semantics | |

**User's choice:** Ranges = owner pickup windows

### Q3: Overnight range handling

| Option | Description | Selected |
|--------|-------------|----------|
| end < start means 'crosses midnight' | Standard business-hours convention | ✓ |
| Require splitting across days | Dashboard splits into mon: 19:00-23:59 + tue: 00:00-09:00 | |

**User's choice:** end < start means 'crosses midnight'

### Q4: DST boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Use fold-aware zoneinfo conversion | datetime.astimezone(ZoneInfo(tz)) — no special-case code | ✓ |
| Document as known edge case | Same impl, different doc commitment | |

**User's choice:** Use fold-aware zoneinfo conversion

---

## Evaluator I/O + Module Boundary

### Q1: evaluate_schedule signature

| Option | Description | Selected |
|--------|-------------|----------|
| Pure fn, minimal inputs + dataclass return | (schedule: dict, tz: str, now_utc: datetime) -> ScheduleDecision | ✓ |
| Takes full tenant row | (tenant: dict, now_utc: datetime) | |
| Returns tuple instead of dataclass | (mode, reason) tuple | |

**User's choice:** Pure fn, minimal inputs + dataclass return

### Q2: fallback_to_ai ownership

| Option | Description | Selected |
|--------|-------------|----------|
| Evaluator returns only ai|owner_pickup; fallback_to_ai set in Phase 40 | Phase 40 dial-status handler writes it | ✓ |
| Evaluator can return fallback_to_ai | Blurs evaluator's temporal contract | |

**User's choice:** Evaluator returns only ai|owner_pickup

### Q3: Soft cap composition

| Option | Description | Selected |
|--------|-------------|----------|
| Separate; handler composes them | Handler calls evaluate_schedule then check_outbound_cap | ✓ |
| Evaluator calls check_outbound_cap internally | Evaluator becomes impure (needs DB) | |

**User's choice:** Separate; handler composes them

### Q4: Shared code boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Share src/supabase_client.py and helpers | One singleton across the process | ✓ |
| Separate webhook-local supabase client | Two pools in one process | |

**User's choice:** Share src/supabase_client.py and helpers

### Q5: Tenant lookup in Phase 39 incoming-call

| Option | Description | Selected |
|--------|-------------|----------|
| Look up tenant; return always-AI TwiML even if found | Exercises full path; Phase 40 diff is tiny | ✓ |
| Skip lookup; return static TwiML | Leaves wiring untested | |
| Look up tenant AND evaluate schedule but still return AI | Maximum exercise but no real schedules exist yet | |

**User's choice:** Look up tenant; return always-AI TwiML even if found

---

## Signature Verification + Soft Cap Plumbing

### Q1: Signature verification wiring

| Option | Description | Selected |
|--------|-------------|----------|
| FastAPI dependency applied to router | APIRouter(dependencies=[Depends(verify_twilio_signature)]) — zero per-route boilerplate | ✓ |
| Middleware on path prefix | Body-reading conflicts with form parsing in routes | |
| Per-route Depends() call | More verbose | |

**User's choice:** FastAPI dependency applied to router

### Q2: URL reconstruction behind TLS proxy

| Option | Description | Selected |
|--------|-------------|----------|
| Trust X-Forwarded-Proto + host header | Reconstruct via proxy headers; fail-closed default | ✓ |
| Hardcode a PUBLIC_URL env var | Ops overhead | |
| Both — env var preferred, header fallback | Belt-and-suspenders | |

**User's choice:** Trust X-Forwarded-Proto + host header
**Notes:** uvicorn started with proxy_headers=True, forwarded_allow_ips='*'.

### Q3: Testability gate

| Option | Description | Selected |
|--------|-------------|----------|
| Env flag ALLOW_UNSIGNED_WEBHOOKS, off in prod | Log warning on bypass | ✓ |
| Staging uses a separate auth token | More realistic; harder for ad-hoc testing | |
| Twilio test tool + prod signing only | Blocks local curl-based dev | |

**User's choice:** Env flag ALLOW_UNSIGNED_WEBHOOKS, off in prod

### Q4: Soft cap data source

| Option | Description | Selected |
|--------|-------------|----------|
| SUM(outbound_dial_duration_sec) from calls, per call | Trivial indexed scan at current scale; no state drift | ✓ |
| Materialized monthly counter on tenants | Cron + drift risk | |
| Separate rollup table | Premature schema complexity | |

**User's choice:** SUM(outbound_dial_duration_sec) from calls, per call
**Notes:** Country read from tenants.country (Phase 27), not dialed prefix. Migration adds idx_calls_tenant_month.

---

## Migration Schema

### Q1: Single vs split migration

| Option | Description | Selected |
|--------|-------------|----------|
| Single migration: 042_call_routing_schema.sql | Atomic deploy, one rollback unit | ✓ |
| Split by table | Two files for one feature | |

**User's choice:** Single migration

### Q2: routing_mode nullability

| Option | Description | Selected |
|--------|-------------|----------|
| Nullable, backfill not required | Historical calls stay NULL; dashboard renders as AI legacy | ✓ |
| NOT NULL DEFAULT 'ai' | Requires backfill UPDATE on potentially large calls table | |

**User's choice:** Nullable, backfill not required

### Q3: pickup_numbers shape validation

| Option | Description | Selected |
|--------|-------------|----------|
| Shape frozen at {number, label, sms_forward}; no DB validation | API-layer validation in Phase 41; DB only constrains array length ≤ 5 | ✓ |
| Validate item shape in DB via CHECK | Postgres JSONB CHECK on array element shape is painful | |

**User's choice:** Shape frozen at {number, label, sms_forward}; no DB validation

---

## Claude's Discretion

The following are left to Claude's judgment during planning / execution:

- Exact FastAPI app object construction style (single file vs `create_app()` factory)
- Logging namespace for webhook (`voco-webhook` vs reuse `voco-agent`)
- Whether `verify_twilio_signature` stashes parsed form body on `request.state`
- Test organization layout (`tests/webhook/` vs `src/webhook/tests/`)
- Whether `ScheduleDecision.reason` includes forward-looking `soft_cap_hit` value now or later
- Exact DST transition dates used in unit test fixtures
- Whether `check_outbound_cap` logs cap-breach events to a dedicated table in Phase 39 or just emits a warning
- How the Phase 39 acceptance test exercises the FastAPI app (Twilio console vs curl vs pytest TestClient)

## Deferred Ideas

Captured as out-of-scope for Phase 39; belong to Phase 40 or Phase 41. See the `<deferred>` section of 39-CONTEXT.md for the full list. No scope-creep ideas came up during discussion that required rejection.

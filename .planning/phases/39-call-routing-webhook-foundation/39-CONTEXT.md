# Phase 39: Call Routing Webhook Foundation - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the backend foundation for conditional call routing (time-based AI vs owner pickup) as **purely additive work**. Ships:

1. A new FastAPI webhook service running in the same Railway container as the LiveKit agent, on port 8080. It exposes four endpoints (`POST /twilio/incoming-call`, `POST /twilio/dial-status`, `POST /twilio/dial-fallback`, `POST /twilio/incoming-sms`), all signature-verified.
2. A pure-function schedule evaluator (`evaluate_schedule`) and a per-country soft cap function (`check_outbound_cap`).
3. A single Postgres migration adding routing columns to `tenants` and `calls`.

**Not in scope for this phase (belongs to Phase 40):** updating any existing Twilio number's `voice_url` / `sms_url`, implementing the real schedule-driven TwiML response, parallel-ring `<Dial><Number>...</Number></Dial>` generation, SMS forwarding logic, the migration script that reconfigures existing tenants, and the dial-status duration writeback.

**Not in scope for this phase (belongs to Phase 41):** any dashboard UI, any `/api/call-routing` Next.js route, any call row badges.

**Zero production traffic is routed through the new webhook.** `/twilio/incoming-call` returns a default "always-AI" `<Dial><Sip>` TwiML as a compatibility baseline. All routing logic beyond that is Phase 40.

</domain>

<decisions>
## Implementation Decisions

### FastAPI Co-Process Model

- **D-01:** FastAPI replaces `src/health.py` entirely. The FastAPI app owns port 8080 and serves `/health`, `/health/db`, and `/twilio/*` on the same single public port. One process, one public URL, unified logging. `src/health.py` is deleted.
- **D-02:** uvicorn runs in a daemon thread spawned from `src/agent.py`'s `__main__` block, **before** `cli.run_app(WorkerOptions(...))`. Same lifecycle pattern as today's `start_health_server`. uvicorn is started programmatically via `uvicorn.run(app, host='0.0.0.0', port=8080, proxy_headers=True, forwarded_allow_ips='*', log_config=None)`.
- **D-03:** New subpackage `src/webhook/` with files:
  - `app.py` — FastAPI instance, lifespan hooks, `/health`, `/health/db` routes (ported from `src/health.py`)
  - `twilio_routes.py` — `APIRouter` for `/twilio/*` with signature-verification dependency applied at router level
  - `security.py` — `verify_twilio_signature` FastAPI dependency
  - `schedule.py` — pure `evaluate_schedule` + `ScheduleDecision` dataclass
  - `caps.py` — `check_outbound_cap` function
  - `__init__.py` — exports `app` and `start_webhook_server`
- **D-04:** `fastapi>=0.115,<1` and `uvicorn[standard]>=0.30,<1` added to `pyproject.toml` dependencies. Dockerfile unchanged — existing `pip install --no-cache-dir .` picks them up, and the `HEALTHCHECK` line (`curl -f http://localhost:8080/health`) remains valid since FastAPI serves `/health`.

### Schedule JSONB Shape

- **D-05:** `call_forwarding_schedule` JSONB shape: `{enabled: bool, days: {mon|tue|wed|thu|fri|sat|sun: [{start:"HH:MM", end:"HH:MM"}, ...]}}`. Times stored in tenant-local HH:MM 24-hour format. Empty/missing day array = AI all day. Multi-range per day is allowed by the shape; Phase 41 dashboard only writes one range per day.
- **D-06:** Semantics: time ranges represent **owner pickup windows**. Inside any range → owner_pickup. Outside all ranges → AI. "Always owner pickup" on a day is encoded as `[{start:"00:00", end:"23:59"}]`. `enabled:false` means "schedule off, always AI" regardless of `days`.
- **D-07:** Overnight ranges are encoded with `end < start` (e.g. `{start:"19:00", end:"09:00"}`). The evaluator interprets this as `start → midnight on day N` + `midnight → end on day N+1`. Standard business-hours convention.
- **D-08:** DST handling: the evaluator always converts incoming UTC `now` to tenant-local via `now.astimezone(ZoneInfo(tenant_timezone))` and compares HH:MM in tenant local time. Python's `zoneinfo` handles gaps (spring-forward) and folds (fall-back) correctly with no special-case code. Tests must cover both transitions per success criterion #4.

### Evaluator I/O

- **D-09:** Signature: `def evaluate_schedule(schedule: dict, tenant_timezone: str, now_utc: datetime) -> ScheduleDecision`. Pure function, no DB access, no tenant row. `ScheduleDecision` is a `@dataclass(frozen=True)` with:
  - `mode: Literal['ai', 'owner_pickup']`
  - `reason: Literal['schedule_disabled', 'empty_schedule', 'outside_window', 'inside_window']`
  Callers fetch the tenant row and pass only `schedule` and `tenant_timezone` into the evaluator. Trivially unit-testable.
- **D-10:** The evaluator returns only `ai` or `owner_pickup`. The `fallback_to_ai` value on `calls.routing_mode` is a **post-call observation** set by Phase 40's `/twilio/dial-status` handler when the owner dial times out or no-answers. Phase 39's evaluator never emits it.
- **D-11:** Soft cap composition is done at the **handler layer**, not inside the evaluator:
  ```
  decision = evaluate_schedule(schedule, tz, now_utc)
  if decision.mode == 'owner_pickup':
      if not check_outbound_cap(tenant_id, country):
          # downgrade to AI, log cap breach event (Phase 40 wires this)
          decision = ScheduleDecision(mode='ai', reason='soft_cap_hit')  # or similar
  ```
  In Phase 39 the downgrade path is **not wired** (handler always returns AI TwiML anyway); the composition contract is defined so Phase 40 has a single line to change.

### Module Boundary

- **D-12:** `src/webhook/*` imports `get_supabase_admin` from `src/supabase_client.py` and is free to import from `src/lib/*`. Same singleton service-role client, same env vars, same Python process on Railway. No duplicate connection pools.
- **D-13:** Phase 39's `/twilio/incoming-call` handler **does** look up the tenant by the `To` number using the same `_normalize_phone` pattern as `src/agent.py`, but always returns the AI TwiML `<Dial><Sip>` regardless of result. This exercises the full wiring path (signature verification → URL reconstruction → form parse → tenant lookup → TwiML render) so Phase 40's diff is just replacing the hardcoded TwiML branch with the `evaluate_schedule` / `check_outbound_cap` composition. Zero production risk because no real Twilio numbers are reconfigured in this phase.

### Signature Verification

- **D-14:** `src/webhook/security.py` defines `async def verify_twilio_signature(request: Request)` as a FastAPI dependency. Applied **once** at the router level: `APIRouter(prefix="/twilio", dependencies=[Depends(verify_twilio_signature)])`. All four Twilio endpoints are signature-gated by default with zero per-route boilerplate. Failing validation raises `HTTPException(status_code=403)`.
- **D-15:** URL reconstruction for Twilio signature validation trusts proxy headers set by Railway's edge:
  ```python
  proto = request.headers.get('x-forwarded-proto', 'https')  # fail-closed to https
  host = request.headers['host']
  url = f"{proto}://{host}{request.url.path}"
  ```
  uvicorn is started with `proxy_headers=True, forwarded_allow_ips='*'` so `request.url` respects X-Forwarded-*. Uses `twilio.request_validator.RequestValidator(TWILIO_AUTH_TOKEN).validate(url, params, signature)` from the already-pinned `twilio>=9.0,<10` dependency.
- **D-16:** Testability gate: environment variable `ALLOW_UNSIGNED_WEBHOOKS=true` bypasses signature verification with a warning log. Only set in local dev and staging. Production Railway never has it set. Fail-closed default: if the env var is unset, validation always runs.

### Soft Cap

- **D-17:** `check_outbound_cap(tenant_id: str, country: str) -> bool` lives in `src/webhook/caps.py`. Returns `True` if under cap, `False` if at/over cap.
  - Data source: `SELECT COALESCE(SUM(outbound_dial_duration_sec),0) FROM calls WHERE tenant_id = $1 AND created_at >= date_trunc('month', now())`
  - Limits: US/CA = 5000 minutes (300000 seconds), SG = 2500 minutes (150000 seconds)
  - Country is read from `tenants.country` (locked in Phase 27), not derived from the dialed number prefix
  - Supporting index: `CREATE INDEX IF NOT EXISTS idx_calls_tenant_month ON calls (tenant_id, created_at)` — part of the Phase 39 migration
  - No rollup table, no materialized counter, no cron — premature optimization at current scale

### Migration Schema

- **D-18:** Single migration `supabase/migrations/042_call_routing_schema.sql` atomically adds all new columns + index:
  ```sql
  ALTER TABLE tenants
    ADD COLUMN call_forwarding_schedule JSONB NOT NULL DEFAULT '{"enabled":false,"days":{}}'::jsonb,
    ADD COLUMN pickup_numbers JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_array_length(pickup_numbers) <= 5),
    ADD COLUMN dial_timeout_seconds INTEGER NOT NULL DEFAULT 15;

  ALTER TABLE calls
    ADD COLUMN routing_mode TEXT CHECK (routing_mode IN ('ai','owner_pickup','fallback_to_ai')),
    ADD COLUMN outbound_dial_duration_sec INTEGER;

  CREATE INDEX IF NOT EXISTS idx_calls_tenant_month ON calls (tenant_id, created_at);
  ```
  Single atomic file → single rollback unit.
- **D-19:** `calls.routing_mode` is **nullable** with no default. No backfill of historical pre-cutover calls. Phase 41's dashboard badge interprets NULL as "AI" (legacy rendering).
- **D-20:** `pickup_numbers` item shape is `{number: string (E.164), label: string, sms_forward: boolean}`. The DB only constrains `jsonb_array_length ≤ 5`; item shape validation happens at the API layer (Phase 41 PUT handler). `pickup_numbers` shape is fully frozen at Phase 39 to unblock Phase 40's TwiML generation code.

### Claude's Discretion

- Exact FastAPI app object construction style (single file vs factory fn — `create_app()`) within `src/webhook/app.py`
- Exact shape of logging (whether to use `logging.getLogger("voco-webhook")` or reuse `voco-agent` logger)
- Whether `verify_twilio_signature` reads the form body once and stashes it on `request.state` so route handlers don't re-parse, vs. letting handlers re-parse via `await request.form()`
- Test organization (`tests/webhook/test_schedule.py` vs `src/webhook/tests/...`)
- Whether `ScheduleDecision.reason` includes forward-looking values like `soft_cap_hit` now or later
- Exact unit test fixture setup for DST transitions (specific dates chosen, specific tenant timezone)
- Whether `check_outbound_cap` logs cap-breach events to a dedicated table in Phase 39 or just emits a warning log (Phase 40 wires the real cap-breach event path)
- How the FastAPI app is exercised in Phase 39's acceptance test (Twilio console "Test webhook" button vs curl with `ALLOW_UNSIGNED_WEBHOOKS=true` vs pytest + TestClient)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### LiveKit Agent Repo (`C:/Users/leheh/.Projects/livekit-agent/`)
- `src/agent.py` — Main entry point; lines 50-54 define `BLOCKED_STATUSES`, entrypoint pattern, how `_normalize_phone` works and is applied to SIP attributes for tenant lookup. Phase 39's `/twilio/incoming-call` handler reuses this normalization + lookup pattern.
- `src/health.py` — Current stdlib HTTP health server on port 8080 via daemon thread. **Being replaced** — its two routes (`/health`, `/health/db`) move into the new FastAPI app in `src/webhook/app.py`.
- `src/supabase_client.py` — `get_supabase_admin()` singleton; `src/webhook/*` reuses this, no new client.
- `pyproject.toml` — FastAPI + uvicorn deps added here. `twilio>=9.0,<10` already pinned (`twilio.request_validator.RequestValidator`).
- `Dockerfile` — No changes needed. `pip install --no-cache-dir .` picks up new deps automatically. `HEALTHCHECK` line remains valid.
- `livekit.toml` — No changes needed.
- `sip-inbound-trunk.json` / `sip-outbound-trunk.json` / `sip-dispatch-rule.json` — No changes needed. Phase 39 does not touch SIP routing.

### Main Repo (`C:/Users/leheh/.Projects/homeservice_agent/`)
- `src/app/api/stripe/webhook/route.js` §`provisionPhoneNumber` (lines 34-109) — Phase 27 precedent for country-aware provisioning and SIP trunk association. **Not modified in Phase 39.** Phase 40 will add `voice_url` / `sms_url` configuration here.
- `supabase/migrations/003_scheduling.sql` — line 8 adds `tenant_timezone text NOT NULL DEFAULT 'America/Chicago'` to `tenants`. The evaluator reads this column via `tenants.tenant_timezone`.
- `supabase/migrations/011_country_provisioning.sql` — Adds `tenants.country` (Phase 27). `check_outbound_cap` reads country from here.
- `supabase/migrations/041_calls_realtime.sql` — Latest migration. Phase 39's migration is `042_call_routing_schema.sql`.
- `.claude/skills/voice-call-architecture/SKILL.md` — Full architecture reference. **Must be updated after Phase 39** to reflect: FastAPI webhook service on port 8080, replacement of `src/health.py`, `src/webhook/*` subpackage, routing schema columns. Living architectural doc per CLAUDE.md rules.

### Prior Phase Context
- `.planning/phases/27-country-aware-onboarding-and-number-provisioning/27-CONTEXT.md` — D-05 (country column), D-11/D-12 (provisioning flow), `assign_sg_number` RPC for SG inventory. Phase 39 inherits the country and provisioning assumptions.

### Roadmap
- `.planning/ROADMAP.md` §Phase 39 (lines 436-451) — Goal, success criteria. Requirements ROUTE-01 through ROUTE-06 will be added to `.planning/REQUIREMENTS.md` during planning.
- `.planning/ROADMAP.md` §Phase 40 (lines 453-471) — Downstream consumer; ensures Phase 39 decisions keep Phase 40's diff minimal.
- `.planning/ROADMAP.md` §Phase 41 (lines 473-491) — Downstream UI consumer; ensures `pickup_numbers` and schedule shapes are frozen at Phase 39.

### External Specs
- Twilio Python helper library `twilio.request_validator.RequestValidator` — signature verification reference. No local ADR; behavior per Twilio SDK source.
- Twilio webhook security docs — URL reconstruction rules behind proxies.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/supabase_client.get_supabase_admin()`** — singleton service-role Supabase client. `src/webhook/*` imports and reuses; no duplicate clients.
- **`_normalize_phone()` in `src/agent.py`** — strips `sip:`/`tel:` prefixes, `@domain` suffixes, ensures `+` for E.164. Reused by `/twilio/incoming-call` to normalize the `To` number before tenant lookup. Consider extracting to `src/lib/phone.py` during planning if not already there.
- **`BLOCKED_STATUSES` constant in `src/agent.py:51`** — `["canceled", "paused", "incomplete"]`. Phase 40 will reuse this in the webhook handler for the subscription gate; Phase 39 doesn't need it yet but should not duplicate it.
- **`src/health.py` daemon-thread HTTP server pattern** — the same pattern (daemon thread boot before `cli.run_app`) is applied for uvicorn.
- **`twilio>=9.0,<10` Python SDK** — already a dependency. `twilio.request_validator.RequestValidator` is the canonical signature verifier.

### Established Patterns
- **Daemon thread boot before `cli.run_app`** — `start_health_server()` is called from agent.py before the blocking LiveKit worker starts. Phase 39 follows the same pattern with `start_webhook_server()`.
- **Service-role Supabase client singleton** — one client per process, instantiated lazily. Shared across `src/tools/*`, `src/lib/*`, `src/webhook/*`.
- **`asyncio.to_thread` for sync DB calls** — `src/agent.py` wraps sync Supabase calls in `asyncio.to_thread(...)`. Webhook handlers (async FastAPI) should do the same for DB reads.
- **Pure-function test seams** — `src/lib/triage/layer1_keywords.py` is a pure function with its own unit tests. `evaluate_schedule` follows the same shape.

### Integration Points
- **`src/agent.py` `__main__` / entrypoint module-level** — where `start_health_server()` is called today. Phase 39 adds `start_webhook_server()` at the same spot (or in its place, since `src/health.py` is being deleted).
- **`pyproject.toml` [dependencies]** — add `fastapi` and `uvicorn[standard]`.
- **`src/supabase_client.py`** — imported by `src/webhook/*`. No changes to this file, but it becomes a shared dep across two execution surfaces (in-call tools + pre-call webhook).
- **`supabase/migrations/`** — new migration `042_call_routing_schema.sql` numbered after `041_calls_realtime.sql`.

</code_context>

<specifics>
## Specific Ideas

- **The webhook should feel like a quiet second face on the existing container**, not a separate service. One process, one Dockerfile, one Railway deployment, one public URL. The only observable change to an outside observer is that new `/twilio/*` paths return 200 with TwiML instead of 404.
- **Success criterion #6 ("zero production traffic is routed") is the scope anchor.** Any temptation to reconfigure a real tenant's Twilio number, or to wire a real schedule evaluation into the `/twilio/incoming-call` response in Phase 39, is scope creep into Phase 40.
- **Tenant lookup in Phase 39's `/twilio/incoming-call` handler is intentional dead weight.** It exercises the full path so Phase 40's diff is minimal (one line: replace hardcoded AI TwiML branch with `evaluate_schedule` + `check_outbound_cap` composition).
- **Phase 39 tests should cover the pure evaluator exhaustively** — empty schedule, per-day windows, overnight ranges, DST spring-forward (e.g. America/New_York 2026-03-08 02:30), DST fall-back (e.g. America/New_York 2026-11-01 01:30), all-day owner pickup, enabled:false. These are cheap to write and lock the contract for Phase 40 before any real routing exists.
- **All four Twilio endpoints must return valid (even if stubbed) TwiML in Phase 39** so Twilio's test webhook tool can verify them in the console before any real number is reconfigured. `/twilio/dial-status` and `/twilio/dial-fallback` can return empty TwiML (`<Response/>`); `/twilio/incoming-call` returns `<Response><Dial><Sip>...</Sip></Dial></Response>` pointing at the existing LiveKit SIP URI; `/twilio/incoming-sms` returns `<Response/>` for now.

</specifics>

<deferred>
## Deferred Ideas

- **Real schedule-driven TwiML (`<Dial timeout callerId><Number>...`)** — Phase 40.
- **Parallel ring across `pickup_numbers`** — Phase 40.
- **`voice_url` / `sms_url` / `voice_fallback_url` configuration on Twilio numbers** — Phase 40 (both for new provisioning in `provisionPhoneNumber` and for the migration script that updates existing tenant numbers).
- **`sms_messages` table for forwarded SMS audit log** — Phase 40 success criterion #6.
- **`/twilio/dial-status` writing `outbound_dial_duration_sec` on the `calls` row** — Phase 40 success criterion #9.
- **Subscription gate (`BLOCKED_STATUSES`) inside the webhook** — Phase 40 success criterion #3.
- **Cap-breach event logging path** — Phase 40 (Phase 39 can emit a warning log only).
- **Dashboard UI at `/dashboard/more/call-routing`, `GET/PUT /api/call-routing`, routing mode badges, usage meter** — Phase 41.
- **Onboarding setup-checklist entry for call routing** — Phase 41.
- **Dry-run migration script for reconfiguring existing tenant numbers** — Phase 40 success criterion #7.
- **Retroactive backfill of `calls.routing_mode = 'ai'` for historical rows** — explicitly declined (D-19). Out of scope.
- **Separate webhook rollup table for usage aggregation** — premature optimization; declined in D-17. Revisit only if `SUM()` query becomes a hot spot.

</deferred>

---

*Phase: 39-call-routing-webhook-foundation*
*Context gathered: 2026-04-09*

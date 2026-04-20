# Telemetry — last_context_fetch_at + activity_log Integration Events

Covers: `accounting_credentials.last_context_fetch_at` write path,
`activity_log` per-fetch rows (Phase 58 `integration_fetch`), per-call fanout
rows (`integration_fetch_fanout`), owner-facing Last-synced UI, column-name
reconciliation.

## File map

| Concern | File |
|---------|------|
| Shared Python telemetry helpers | `livekit-agent/src/lib/telemetry.py` |
| Xero adapter success-path emit | `livekit-agent/src/integrations/xero.py` |
| Jobber adapter success-path emit | `livekit-agent/src/integrations/jobber.py` |
| Agent pre-session fanout wrapper | `livekit-agent/src/agent.py :: fetch_customer_context_with_fanout_telemetry` |
| Dashboard Last-synced render | `src/components/dashboard/BusinessIntegrationsClient.jsx` |
| Schema | `supabase/migrations/004_leads_crm.sql` (activity_log definition — `event_type` + `metadata`) |

## last_context_fetch_at

Column on `accounting_credentials` (migration 055). Written by Python
adapters on successful `fetchCustomerByPhone`:

```python
async def _touch_last_context_fetch_at(cred_id: str) -> None:
    from ..supabase_client import get_supabase_admin
    def _update():
        admin = get_supabase_admin()
        (admin.table("accounting_credentials")
             .update({"last_context_fetch_at": datetime.now(timezone.utc).isoformat()})
             .eq("id", cred_id).execute())
    try:
        await asyncio.to_thread(_update)
    except Exception:
        pass  # telemetry — silent on failure
```

Called at the end of `fetch_xero_customer_by_phone` and
`fetch_jobber_customer_by_phone` success path, parallelized with
`emit_integration_fetch` via `asyncio.gather`.

**Not written on failure.** The adapter catches exceptions and returns
`None`; telemetry writes do not happen on the None path.

## activity_log — per-fetch row (event_type='integration_fetch')

Phase 58 Plan 03 addition. One row per successful `fetchCustomerByPhone` call.

### Schema

The real `activity_log` schema (migration 004) has these columns:

```sql
CREATE TABLE activity_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type  text NOT NULL,          -- NOT "action"
  lead_id     uuid REFERENCES leads(id) ON DELETE SET NULL,
  metadata    jsonb,                  -- NOT "meta"
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

⚠️ Column-name reconciliation: CONTEXT D-06 (Phase 58) wording uses `action`
and `meta`. The real columns are `event_type` and `metadata`. Phase 58
research §B.2 selected **Option A — use real column names** (zero schema
change, matches existing `src/lib/leads.js` writers). Do NOT add alias
columns or generated views.

### Row shape

```sql
INSERT INTO activity_log (tenant_id, event_type, metadata)
VALUES (
  '<tenant-uuid>',
  'integration_fetch',
  jsonb_build_object(
    'provider', 'xero' | 'jobber',
    'duration_ms', 312,
    'cache_hit', false,
    'counts', jsonb_build_object(
      'customers', 1, 'invoices', 5               -- xero
      -- OR 'customers', 1, 'jobs', 3, 'invoices', 2   -- jobber
    ),
    'phone_e164', '+14085551234'
  )
);
```

### Helper — emit_integration_fetch

`livekit-agent/src/lib/telemetry.py`:

```python
async def emit_integration_fetch(
    admin,               # supabase admin client, INJECTED by caller
    tenant_id: str,
    provider: str,       # 'xero' | 'jobber'
    duration_ms: int,
    cache_hit: bool,
    counts: dict,
    phone_e164: str,
) -> None:
    if admin is None:
        return
    def _insert():
        admin.table("activity_log").insert({
            "tenant_id": tenant_id,
            "event_type": "integration_fetch",
            "metadata": {
                "provider": provider,
                "duration_ms": duration_ms,
                "cache_hit": cache_hit,
                "counts": counts,
                "phone_e164": phone_e164,
            },
        }).execute()
    try:
        await asyncio.to_thread(_insert)
    except Exception as e:
        logger.warning("integration_fetch telemetry failed: %s", e)
```

- **Admin injected by caller.** The caller (xero.py / jobber.py) resolves
  `get_supabase_admin()` in its module scope; telemetry.py never imports it
  directly. This lets tests patch the caller's module-level symbol.
- **Silent on failure.** `logger.warning` only — never raises, never
  propagates to the primary call path.

### cache_hit semantics

`cache_hit=False` always (as of Phase 58). No in-process LRU in the Python
adapter yet. Column retained forward-compatible for future in-memory cache.

## activity_log — per-call fanout row (event_type='integration_fetch_fanout')

One row per call (at session-start time) measuring the full pre-session
merged fetch. Phase 58 Plan 03 addition.

### Row shape

```sql
INSERT INTO activity_log (tenant_id, event_type, metadata)
VALUES (
  '<tenant-uuid>',
  'integration_fetch_fanout',
  jsonb_build_object(
    'call_id', '<call-uuid>',
    'duration_ms', 1247,
    'per_task_ms', jsonb_build_object(
      'xero', 612,
      'jobber', 1234   -- Jobber slower here
    )
  )
);
```

### Helper — emit_integration_fetch_fanout

```python
async def emit_integration_fetch_fanout(
    admin, tenant_id: str, call_id: str | None,
    duration_ms: int, per_task_ms: dict,
) -> None:
    ...
```

Called via `asyncio.create_task(...)` — fire-and-forget so `session.start`
is NEVER delayed by telemetry INSERT latency.

## Owner-facing surface — Last synced

`BusinessIntegrationsClient.jsx` renders the per-provider card with:

```jsx
{row?.last_context_fetch_at && (
  <p className="text-xs text-muted-foreground">
    Last synced {formatDistanceToNow(parseISO(row.last_context_fetch_at), { addSuffix: true })}
  </p>
)}
```

Populated on the Server Component side via `getIntegrationStatus` which
selects `last_context_fetch_at` for both providers symmetrically
(Phase 56 caching uplift unified this; Phase 58 Plan 03 D-08 confirmation).

Per CONTEXT D-08 (Phase 58), owner-facing telemetry is ONLY the Last-synced
timestamp. Duration / cache-hit rate stays ops-only (SQL below).

## Ops-facing SQL — aggregation queries

### Pre-call fanout latency (D-07 budget = p95 ≤ 2.5s)

```sql
SELECT
  percentile_cont(0.50) WITHIN GROUP (ORDER BY (metadata->>'duration_ms')::int) AS p50,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY (metadata->>'duration_ms')::int) AS p95,
  percentile_cont(0.99) WITHIN GROUP (ORDER BY (metadata->>'duration_ms')::int) AS p99,
  count(*) AS sample_size
FROM activity_log
WHERE event_type = 'integration_fetch_fanout'
  AND created_at > now() - interval '24 hours';
```

### Per-provider breakdown

```sql
SELECT
  metadata->>'provider' AS provider,
  percentile_cont(0.50) WITHIN GROUP (ORDER BY (metadata->>'duration_ms')::int) AS p50,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY (metadata->>'duration_ms')::int) AS p95,
  percentile_cont(0.99) WITHIN GROUP (ORDER BY (metadata->>'duration_ms')::int) AS p99,
  count(*) AS sample_size
FROM activity_log
WHERE event_type = 'integration_fetch'
  AND created_at > now() - interval '24 hours'
GROUP BY metadata->>'provider';
```

### Cache hit rate (will be 0% until in-memory cache lands)

```sql
SELECT
  metadata->>'provider' AS provider,
  sum(CASE WHEN (metadata->>'cache_hit')::boolean THEN 1 ELSE 0 END)::float
    / count(*) AS cache_hit_rate
FROM activity_log
WHERE event_type = 'integration_fetch'
  AND created_at > now() - interval '24 hours'
GROUP BY metadata->>'provider';
```

### Miss rate (per-call fanout had zero per_task_ms entries)

```sql
SELECT
  count(*) FILTER (WHERE (metadata->'per_task_ms') = '{}'::jsonb) AS zero_provider_calls,
  count(*) AS total_calls
FROM activity_log
WHERE event_type = 'integration_fetch_fanout'
  AND created_at > now() - interval '24 hours';
```

## Phase 58 deployment handoff

Telemetry ships across the Voco worktree mirror + the sibling Railway repo
(`lerboi/livekit_agent` at `C:/Users/leheh/.Projects/livekit-agent/`).
Phase 58 Plan 03 documented the file-by-file sync:

1. Copy `livekit-agent/src/lib/telemetry.py` → sibling `src/lib/telemetry.py`.
2. Copy `livekit-agent/src/integrations/{xero,jobber}.py` → sibling
   (Voco version has a defensive `try/except` fallback on
   `get_supabase_admin()` that the sibling lacks).
3. Apply `fetch_customer_context_with_fanout_telemetry` snippet from
   `livekit-agent/src/agent.py` docstring into sibling `src/agent.py`
   ~line 161 (the `entrypoint` function).
4. Push to `lerboi/livekit_agent` main → Railway auto-deploys.

Sanity check after deploy:

```sql
SELECT event_type, metadata, created_at
FROM activity_log
WHERE event_type IN ('integration_fetch', 'integration_fetch_fanout')
ORDER BY created_at DESC LIMIT 10;
```

Expect: fanout row per call + per-provider rows for every successful fetch.

## Failure tests

The test files (Phase 58 Plan 03):
- `livekit-agent/tests/integrations/test_xero_telemetry.py`
- `livekit-agent/tests/integrations/test_jobber_telemetry.py`

Each covers:
1. `test_success_writes_telemetry` — fetch succeeds → one `integration_fetch`
   row inserted with correct shape.
2. `test_failure_does_not_write_telemetry` — fetch raises → zero rows inserted.
3. `test_admin_client_none_does_not_break_fetch` — defensive fallback
   preserves fetch result when `get_supabase_admin()` raises.

All 6/6 green (3 per provider). See Phase 58 Plan 03 Summary.

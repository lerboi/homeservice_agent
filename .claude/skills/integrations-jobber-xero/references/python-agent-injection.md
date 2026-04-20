# Python Agent Injection — Xero + Jobber Customer Context

Covers: pre-session fanout inside the livekit-agent entrypoint, per-provider
fetch bounded timeouts, merge order, `check_customer_account` tool with
STATE+DIRECTIVE prompt format.

## File map

| Concern | File |
|---------|------|
| Agent entrypoint + pre-session fanout | `livekit-agent/src/agent.py` (see `entrypoint` + `_run_db_queries` + `fetch_customer_context_with_fanout_telemetry`) |
| Xero adapter (Python) | `livekit-agent/src/integrations/xero.py` |
| Jobber adapter (Python) | `livekit-agent/src/integrations/jobber.py` |
| Merged fetch | `livekit-agent/src/integrations/jobber.py :: fetch_merged_customer_context_bounded` (also imports Xero) |
| check_customer_account tool | `livekit-agent/src/tools/check_customer_account.py` |
| Prompt STATE+DIRECTIVE section | `livekit-agent/src/prompt.py :: build_system_prompt` (customer_context block) |

⚠️ The Voco worktree contains a mirror of the livekit-agent repo at
`livekit-agent/`. The production Railway deploy pulls from the sibling repo
`lerboi/livekit_agent` at `C:/Users/leheh/.Projects/livekit-agent/`.
Changes must be synced on redeploy (Phase 58 Plan 03 documented this handoff).

## Pre-session fanout

In `agent.py :: entrypoint`, before `session.start(...)`, the agent fans out
multiple DB + external API lookups concurrently:

```python
# Simplified — see agent.py for real code.
async def _run_db_queries(...):
    sub_task    = asyncio.create_task(_fetch_subscription(tenant_id))
    intake_task = asyncio.create_task(_fetch_intake(tenant_id))
    call_task   = asyncio.create_task(_insert_call_row(...))
    results = await asyncio.gather(sub_task, intake_task, call_task,
                                    return_exceptions=True)
    ...

# The Xero + Jobber fetch is a SEPARATE fanout, measured by
# fetch_customer_context_with_fanout_telemetry (Phase 58 Plan 03):
customer_context = await fetch_customer_context_with_fanout_telemetry(
    tenant_id=tenant_id,
    phone_e164=from_number,
    admin=admin,
    fetch_fn=fetch_merged_customer_context_bounded,
)
```

### Bounded timeouts

Each provider has a 2.5s budget (Phase 55 D-04):

```python
# xero.py
async def fetch_xero_context_bounded(tenant_id, phone_e164, admin, timeout=2.5):
    try:
        return await asyncio.wait_for(
            fetch_xero_customer_by_phone(tenant_id, phone_e164, admin),
            timeout=timeout,
        )
    except asyncio.TimeoutError:
        return None
    except Exception:
        return None  # swallow — customer_context is best-effort
```

Same shape for Jobber. On timeout or exception, `customer_context` is empty
for that provider — prompt continues without it.

## Merged fetch

`fetch_merged_customer_context_bounded(tenant_id, phone_e164, admin)`:

1. `asyncio.gather(fetch_xero_context_bounded(...), fetch_jobber_context_bounded(...))`.
2. Prefer Jobber's customer record if both non-null (Jobber is home-service
   native — the customer's job history, notes, outstanding balance all
   live there).
3. Fall back to Xero (accounting-only view) if Jobber missed.
4. Return a shaped dict: `{provider, customer_name, outstanding_balance,
   recent_invoices, recent_jobs?, notes?}`.

## Per-provider adapter shape

### Xero — `livekit-agent/src/integrations/xero.py`

Entry point: `fetch_xero_customer_by_phone(tenant_id, phone_e164, admin)`.

1. Load cred from `accounting_credentials` (service role).
2. If `cred is None` or `cred.error_state` is set → return None.
3. Refresh token if needed (Python mirror of Next.js refresh logic; uses
   the same `oauth_refresh_locks` table).
4. `_get_contacts_by_phone(cred, phone_e164)` — Xero Contacts API with
   `where` filter on Phones.
5. `_get_outstanding_balance(cred, contact_id)` + `_get_recent_invoices(cred, contact_id)`.
6. On success: parallel
   `asyncio.gather(_touch_last_context_fetch_at(cred_id),
                  emit_integration_fetch(admin, tenant_id, 'xero', duration_ms, False, counts, phone_e164))`.
   (Phase 58 Plan 03 — zero added latency because the two writes run together.)
7. Return shaped dict.

### Jobber — `livekit-agent/src/integrations/jobber.py`

Entry point: `fetch_jobber_customer_by_phone`.

1. Same cred load + refresh + error_state check.
2. Single GraphQL query via `_post_graphql` — fetches client + recent jobs
   + recent invoices in one round-trip.
3. Phone matching uses `_normalize_phone_compare` (Jobber stores phones
   unformatted; we match by digits-only).
4. Success path: same parallel `_touch_last_context_fetch_at` +
   `emit_integration_fetch` via `asyncio.gather`.
5. Return shaped dict with `counts = {customers, jobs, invoices}` (vs Xero's
   `{customers, invoices}` — Jobber has jobs as first-class).

## check_customer_account tool

When the customer_context is non-empty at session start, it's injected into
the system prompt. The agent can also proactively query it mid-call via the
`check_customer_account` tool (in-process, no extra Xero/Jobber call —
reads the already-fetched context from `deps`).

Registration: `livekit-agent/src/tools/check_customer_account.py`.

Tool return uses the Phase 60 STATE+DIRECTIVE format (see
`voice-call-architecture` skill):

```
STATE:CUSTOMER_FOUND|DIRECTIVE:Acknowledge you see them in our records, then continue the current task without repeating customer details. Do not repeat this message text on-air.
```

or:

```
STATE:CUSTOMER_NOT_FOUND|DIRECTIVE:Proceed as a new-customer intake. Do not acknowledge searching. Do not repeat this message text on-air.
```

The return string is NOT spoken — it's model-facing only. The model translates
into natural speech based on the DIRECTIVE.

## STATE+DIRECTIVE prompt injection

In `prompt.py :: build_system_prompt`, when `customer_context is not None`,
the prompt gains a CUSTOMER CONTEXT section:

```
# CUSTOMER CONTEXT
You have looked up the caller's record in the business's accounting system.
- Name: {customer_name}
- Outstanding balance: {outstanding_balance}
- Recent jobs: {job_summary}
- Recent invoices: {invoice_summary}

DIRECTIVE: Reference the customer by name ONCE when greeting them (name-once
policy, D-01..D-05 Phase 60). Do NOT volunteer outstanding-balance or
invoice details unless the caller asks. Do NOT list everything from this
section — use it to personalize, not to report.
```

Spanish locale has an `es` mirror (Phase 60 D-13/D-14).

## Failure modes

| Condition | Behavior |
|-----------|----------|
| `cred is None` (never connected) | Return None → customer_context empty → prompt has no CUSTOMER CONTEXT section |
| `cred.error_state = 'token_refresh_failed'` | Return None → same as above. Owner sees Reconnect banner on dashboard. |
| Provider API 5xx | Return None (swallowed) → prompt skipped |
| Timeout (2.5s) | Return None → prompt skipped |
| Phone not found in provider | Return None → prompt skipped |
| Success | Shaped dict → prompt injected |

On failure, NO `activity_log` row is written — `emit_integration_fetch` only
fires on success (Phase 58 Plan 03 `test_*_failure_does_not_write_telemetry`
green in both providers).

## Telemetry on fetch

On success, `emit_integration_fetch(admin, tenant_id, provider, duration_ms,
cache_hit, counts, phone_e164)` inserts:

```sql
INSERT INTO activity_log (tenant_id, event_type, metadata)
VALUES (?, 'integration_fetch',
        jsonb_build_object(
          'provider', ?,
          'duration_ms', ?,
          'cache_hit', false,    -- always false today
          'counts', ?::jsonb,    -- {customers, invoices} or {customers, jobs, invoices}
          'phone_e164', ?
        ));
```

See `references/telemetry.md` for full schema + aggregation SQL.

## Pre-session fanout telemetry

Wrapping the merged fetch:

```python
async def fetch_customer_context_with_fanout_telemetry(
    tenant_id, phone_e164, admin, fetch_fn
):
    start = time.perf_counter()
    result = await fetch_fn(tenant_id, phone_e164, admin)
    duration_ms = int((time.perf_counter() - start) * 1000)

    # fire-and-forget — session.start never delayed
    asyncio.create_task(emit_integration_fetch_fanout(
        admin=admin, tenant_id=tenant_id, duration_ms=duration_ms,
        per_task_ms={}, ...
    ))
    return result
```

Row shape: `event_type='integration_fetch_fanout'`,
`metadata = {call_id, duration_ms, per_task_ms: {xero, jobber, ...}}`.

See `telemetry.md` for query + aggregation.

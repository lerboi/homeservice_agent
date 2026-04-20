---
phase: 58
report: telemetry
status: deferred
created: 2026-04-20
updated: 2026-04-20
deferred_to: Phase 999.6 (backlog)
---

# Phase 58 Telemetry Report

**Collected:** deferred — see Phase 999.6 in ROADMAP.md backlog
**Sample size:** deferred (requires ≥20 `integration_fetch_fanout` rows in staging `activity_log`)
**Environment:** staging (planned)

## Pre-call parallel lookup latency (D-07)

Measurement boundary: start of `asyncio.gather(sub_task, intake_task, call_task, xero_fetch_task, jobber_fetch_task)` → end of gather, inside `livekit-agent/src/agent.py :: _run_db_queries`.

| Percentile | Duration (ms) | Budget | Status |
|------------|---------------|--------|--------|
| p50        | <fill>        | —      | —      |
| p95        | <fill>        | 2500   | ✅ / ❌ |
| p99        | <fill>        | —      | —      |

## Per-provider breakdown

| Provider | p50 (ms) | p95 (ms) | cache hit rate | failure rate |
|----------|----------|----------|----------------|--------------|
| Xero     | <fill>   | <fill>   | <fill %>       | <fill %>     |
| Jobber   | <fill>   | <fill>   | <fill %>       | <fill %>     |

## Methodology

**Source:** `activity_log` rows with `event_type='integration_fetch'` (per-provider, Plan 58-03) and `event_type='integration_fetch_fanout'` (per-call aggregate, Plan 58-03).

**SQL — fanout percentiles:**

```sql
SELECT
  percentile_cont(0.5)  WITHIN GROUP (ORDER BY (metadata->>'duration_ms')::int) AS p50,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY (metadata->>'duration_ms')::int) AS p95,
  percentile_cont(0.99) WITHIN GROUP (ORDER BY (metadata->>'duration_ms')::int) AS p99,
  count(*) AS sample_size
FROM activity_log
WHERE event_type = 'integration_fetch_fanout'
  AND created_at BETWEEN '<start-iso>' AND '<end-iso>';
```

**SQL — per-provider percentiles + cache hit rate:**

```sql
SELECT
  metadata->>'provider' AS provider,
  percentile_cont(0.5)  WITHIN GROUP (ORDER BY (metadata->>'duration_ms')::int) AS p50,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY (metadata->>'duration_ms')::int) AS p95,
  avg( CASE WHEN (metadata->>'cache_hit')::bool THEN 1 ELSE 0 END ) AS cache_hit_rate,
  count(*) AS sample_size
FROM activity_log
WHERE event_type = 'integration_fetch'
  AND created_at BETWEEN '<start-iso>' AND '<end-iso>'
GROUP BY metadata->>'provider';
```

## Ship-gate assertion

- [ ] p95 ≤ 2500 ms on pre-call fanout (D-07)
- [ ] Sample size ≥ 20 calls

## Notes / anomalies
<fill during Plan 58-07 execution>

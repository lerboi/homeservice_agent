---
type: system
system: Voice Agent
status: current
description: "src/lib/telemetry.py shared helpers emit_integration_fetch +"
source: .claude/skills/voice-call-architecture/SKILL.md § 10. Phase 58 Telemetry — integration_fetch + integration_fetch_fanout
migrated: 2026-11-23
verified:
tags: [voco/system/voice-agent]
---

# Phase 58 Telemetry - integration_fetch + integration_fetch_fanout

Part of [[Voice Agent]]. Migrated verbatim from the `voice-call-architecture` skill; check `verified` before trusting details.

`src/lib/telemetry.py` shared helpers `emit_integration_fetch` +
`emit_integration_fetch_fanout`. Silent-on-failure (try/except +
`logger.warning`, never propagates).

- **Per-fetch row** (`event_type='integration_fetch'`): one per
  successful `fetch_xero_customer_by_phone` / `fetch_jobber_customer_by_phone`.
  Written in parallel with `_touch_last_context_fetch_at` via
  `asyncio.gather` — zero added latency.
- **Per-call fanout row** (`event_type='integration_fetch_fanout'`):
  wrapper `fetch_customer_context_with_fanout_telemetry` in `agent.py`
  captures `time.perf_counter()` around the merged Xero+Jobber fetch
  and emits via `asyncio.create_task` — `session.start` is NEVER
  delayed.
- Admin client INJECTED as first parameter to helpers (not imported
  inside) — lets tests patch the caller's module-level symbol.

D-07 latency budget (p95 ≤ 2.5s) queried via SQL on
`integration_fetch_fanout` rows. See
`integrations-jobber-xero/references/telemetry.md` for aggregation
queries and deployment handoff.

---

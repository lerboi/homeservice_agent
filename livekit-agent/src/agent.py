"""Voco LiveKit Voice Agent — Phase 58 CTX-01 fanout-telemetry excerpt.

This file in the Voco worktree documents the Phase 58 Plan 58-03 Task 2
changes to the production agent (`C:\\Users\\leheh\\.Projects\\livekit-agent
\\src\\agent.py`). The full 546-line production agent is maintained in the
sibling repo and deploys to Railway.

The wrapping below measures the pre-session parallel fanout boundary where
Xero + Jobber customer context is fetched concurrently (the real
`asyncio.gather` per 58-RESEARCH §B.3 — recommended measurement boundary
for D-07 latency budget validation).

Production integration pattern (applied to
`livekit-agent/src/agent.py::entrypoint` ~line 145-172 in the sibling repo):
the existing `fetch_merged_customer_context_bounded` call is wrapped with
per-task timing captured via a `_timed_task` helper, and the aggregate
boundary fires a fire-and-forget `emit_integration_fetch_fanout` telemetry
row via `asyncio.create_task` so the session.start path is NEVER delayed.
"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Awaitable, Callable, Optional

from .lib.telemetry import emit_integration_fetch_fanout
from .supabase_client import get_supabase_admin

logger = logging.getLogger("voco-agent")


async def _timed_task(
    name: str,
    coro: Awaitable,
    per_task_ms: dict,
) -> object:
    """Wrap a coroutine so its elapsed-ms is written into `per_task_ms[name]`.

    Preserves return value + exception semantics (the finally clause runs on
    both success and exception) so it can be used inside `asyncio.gather(...,
    return_exceptions=True)` without changing behavior.
    """
    _t0 = time.perf_counter()
    try:
        return await coro
    finally:
        per_task_ms[name] = int((time.perf_counter() - _t0) * 1000)


async def fetch_customer_context_with_fanout_telemetry(
    tenant_id: str,
    phone_e164: str,
    call_id: Optional[str],
    fetch_fn: Callable[..., Awaitable[Optional[dict]]],
    timeout_seconds: float = 2.5,
) -> Optional[dict]:
    """Phase 58 Plan 58-03 Task 2 — measurement wrapper.

    Calls `fetch_fn(tenant_id, phone_e164, timeout_seconds=...)` (typically
    `fetch_merged_customer_context_bounded`) and emits one
    `event_type='integration_fetch_fanout'` row into activity_log via
    fire-and-forget `asyncio.create_task(emit_integration_fetch_fanout(...))`
    so session.start is NEVER delayed by telemetry.

    `per_task_ms` here captures the aggregate merged-fetch elapsed. Per-
    provider breakdown is already recorded by `emit_integration_fetch`
    inside xero.py / jobber.py (Phase 58 Plan 58-03 Task 1), so the fanout
    row only needs to record the `merged` aggregate.

    Integration note: the production `entrypoint` in
    `C:/Users/leheh/.Projects/livekit-agent/src/agent.py` ~line 161 does:

        customer_context = await fetch_merged_customer_context_bounded(
            tenant_id, from_number, timeout_seconds=2.5
        )

    Phase 58 replaces that with:

        customer_context = await fetch_customer_context_with_fanout_telemetry(
            tenant_id, from_number, call_id=call_id,
            fetch_fn=fetch_merged_customer_context_bounded,
            timeout_seconds=2.5,
        )
    """
    # REGRESSION GUARD: production agent.py's _run_db_queries gather at
    # ~line 413 (sibling repo) MUST keep `return_exceptions=True` after this
    # telemetry wrapping — that semantic is preserved because _timed_task
    # uses try/finally (the finally clause runs on both success and
    # exception, so a downstream `asyncio.gather(..., return_exceptions=True)`
    # call still sees the original exception semantics).
    per_task_ms: dict[str, int] = {}
    _fanout_start = time.perf_counter()

    customer_context = await _timed_task(
        "merged",
        fetch_fn(tenant_id, phone_e164, timeout_seconds=timeout_seconds),
        per_task_ms,
    )

    _fanout_duration_ms = int((time.perf_counter() - _fanout_start) * 1000)

    # Resolve admin defensively — missing env in tests must not crash the
    # agent. Telemetry failure is always silent (logger.warning inside the
    # helper).
    try:
        admin = get_supabase_admin()
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "[agent] fanout telemetry skipped — admin client unavailable: %s",
            exc,
        )
        return customer_context

    # Fire-and-forget — do NOT await. session.start must NOT wait on
    # telemetry writes. asyncio.create_task schedules the coroutine on the
    # running loop which the SDK keeps alive for the duration of the call.
    asyncio.create_task(
        emit_integration_fetch_fanout(
            admin,
            tenant_id=tenant_id,
            duration_ms=_fanout_duration_ms,
            per_task_ms=per_task_ms,
            call_id=call_id,
        )
    )

    return customer_context

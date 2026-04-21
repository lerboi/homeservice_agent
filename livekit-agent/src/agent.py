"""Voco LiveKit Voice Agent — Phase 59 post-call RPC write path.

This file in the Voco worktree documents the Phase 59 Plan 05 changes to the
production agent (`C:\\Users\\leheh\\.Projects\\livekit-agent\\src\\agent.py`).
The full production agent is maintained in the sibling repo and deploys to Railway.

Phase 59 change: post-call pipeline now calls the `record_call_outcome` RPC
(src/post_call/write_outcome.py) instead of direct inserts into the legacy
`leads` + `lead_calls` tables. See Phase 59 CONTEXT D-14, D-16, D-02a, D-02b.

Phase 58 change (preserved): pre-session parallel Xero + Jobber customer context
fetch is wrapped with per-task timing via `_timed_task`, with fire-and-forget
`emit_integration_fetch_fanout` telemetry so session.start is NEVER delayed.

Deploy ordering (CRITICAL — Pitfall 5 per Phase 59 CONTEXT D-04):
  1. Plan 02 + 03 migrations pushed FIRST (creates customers/jobs/inquiries + RPC)
  2. Plan 04 Next.js deploys (reads new tables)
  3. This agent deploys (writes via RPC — D-02a: new tables only, no legacy writes)
  4. Plan 08 Migration 053b pushed AFTER agent confirmed live (drops legacy tables)
"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Awaitable, Callable, Optional

from .lib.telemetry import emit_integration_fetch_fanout
from .post_call.write_outcome import record_outcome, RecordOutcomeError
from .supabase_client import get_supabase_admin

logger = logging.getLogger("voco-agent")


# ---------------------------------------------------------------------------
# Phase 58: pre-session customer context fetch with fanout telemetry
# ---------------------------------------------------------------------------


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
    per_task_ms: dict[str, int] = {}
    _fanout_start = time.perf_counter()

    customer_context = await _timed_task(
        "merged",
        fetch_fn(tenant_id, phone_e164, timeout_seconds=timeout_seconds),
        per_task_ms,
    )

    _fanout_duration_ms = int((time.perf_counter() - _fanout_start) * 1000)

    try:
        admin = get_supabase_admin()
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "[agent] fanout telemetry skipped — admin client unavailable: %s",
            exc,
        )
        return customer_context

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


# ---------------------------------------------------------------------------
# Phase 59: post-call RPC write path (D-14 / D-16 / D-02a / D-02b)
# ---------------------------------------------------------------------------
# Production integration pattern (applied to run_post_call_pipeline in the
# sibling repo, replacing the prior create_or_merge_lead / lead_calls inserts):
#
#   from src.post_call.write_outcome import record_outcome, RecordOutcomeError
#
#   # ... (steps 1-8: transcript, call update, booking reconciliation, usage
#   #      tracking, language detection, triage, suggested slots, booking_outcome)
#
#   # Step 9 (Phase 59): replaced create_or_merge_lead() with record_call_outcome RPC.
#   if call_duration_seconds >= 15:
#       await _persist_call_outcome(
#           supabase_service=supabase_service,
#           tenant_id=tenant_id,
#           from_number=from_number,
#           extracted_info=extracted_info,
#           booking_result=booking_result,
#           triage_result=triage_result,
#           call_id=call_id,
#           tenant=tenant,
#       )


async def _persist_call_outcome(
    supabase_service,
    *,
    tenant_id: str,
    from_number: str,
    extracted_info: dict,
    booking_result: Optional[object],
    triage_result: object,
    call_id: str,
    tenant: dict,
) -> None:
    """Phase 59 replacement for create_or_merge_lead() post-call step.

    Single round-trip RPC call (D-14) replacing the prior multi-step:
      1. leads INSERT / ON CONFLICT UPDATE
      2. lead_calls junction INSERT

    D-02a: writes EXCLUSIVELY to new tables via record_call_outcome RPC.
           NO fallback to legacy leads/lead_calls — those tables are read-
           only after 053a and dropped in 053b.
    D-02b: On failure, the fix is a forward patch + redeploy. The except
           branch intentionally does NOT insert into legacy leads.

    T-59-05-04: Only call_id + tenant_id are logged. raw_phone / caller_name
                are NEVER logged.
    """
    try:
        result = await record_outcome(
            supabase_service,
            tenant_id=tenant_id,
            raw_phone=from_number,
            caller_name=extracted_info.get("caller_name"),
            service_address=extracted_info.get("service_address"),
            appointment_id=(
                booking_result.appointment_id if booking_result else None
            ),
            urgency=triage_result.urgency,
            call_id=call_id,
            job_type=extracted_info.get("job_type"),
            country_hint=tenant.get("country"),
        )
        logger.info(
            "record_call_outcome ok tenant=%s customer=%s job=%s inquiry=%s",
            tenant_id,
            result.get("customer_id"),
            result.get("job_id"),
            result.get("inquiry_id"),
        )
    except RecordOutcomeError as e:
        # D-02a + D-02b: NO fallback to legacy leads insert. Forward-fix-only.
        # If this error is systemic, operator hotfixes the agent code and
        # redeploys. Calls briefly lose DB persistence until redeploy — they do
        # NOT get resurrected into the legacy schema (D-02b forbids this).
        # T-59-05-04: log call_id + tenant_id only — never raw_phone or caller_name.
        logger.error(
            "record_call_outcome failed tenant=%s call=%s err=%s",
            tenant_id,
            call_id,
            e,
        )
        # Do not re-raise; call already succeeded audio-wise.

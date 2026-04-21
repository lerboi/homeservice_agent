"""Post-call write path — Phase 59.

Replaces prior direct inserts into leads + lead_calls with a single
record_call_outcome RPC call that atomically upserts the customer and
creates either a job (booked) or inquiry (unbooked), plus links the call
to both junction tables. See supabase/migrations/054_phase59_rpcs.sql.

D-02a: This module writes EXCLUSIVELY to the RPC. There is no fallback
       path to legacy leads/lead_calls. If the RPC fails, record_outcome
       raises — caller logs and moves on. NO DUAL-WRITE.
D-02b: On failure, the fix is forward — patch + redeploy. Do NOT add
       a legacy-leads fallback branch here.
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from src.lib.phone import _normalize_phone

logger = logging.getLogger(__name__)


class RecordOutcomeError(Exception):
    """Raised when record_call_outcome RPC fails or returns an unexpected shape.

    Caller (agent.py) logs and continues — the call already succeeded audio-
    wise. D-02a: caller MUST NOT insert into legacy leads as a fallback.
    """


async def record_outcome(
    supabase: Any,
    *,
    tenant_id: str,
    raw_phone: str,
    caller_name: Optional[str],
    service_address: Optional[str],
    appointment_id: Optional[str],
    urgency: str,
    call_id: str,
    job_type: Optional[str] = None,
    country_hint: Optional[str] = None,
) -> dict[str, Any]:
    """Call the record_call_outcome RPC and return the result dict.

    Args:
        supabase:        Service-role Supabase client (bypasses RLS).
        tenant_id:       Tenant UUID — derived from inbound SIP routing
                         (never from call payload; T-59-05-01).
        raw_phone:       Raw phone string from SIP attributes (e.g.
                         "sip:+15551234567@pstn.twilio.com"). Normalized to
                         E.164 before the RPC call.
        caller_name:     Caller's name extracted from transcript; may be None.
        service_address: Service address from transcript; may be None.
        appointment_id:  UUID of the booked appointment, or None if unbooked.
                         None → inquiry path; non-None → job path (D-10).
        urgency:         One of 'emergency', 'urgent', 'routine'.
        call_id:         Call UUID (from ctx.room.name, e.g. "call-{uuid}").
        job_type:        Trade/job type from transcript; optional.
        country_hint:    ISO-2 country code hint for phone normalization; optional.

    Returns:
        Dict with keys: customer_id, job_id (may be None), inquiry_id (may be None).

    Raises:
        RecordOutcomeError: If phone normalization fails, the RPC raises, or
                            the RPC returns an unexpected shape.
                            D-02a: caller MUST NOT fall back to leads insert.
    """
    # Step 1: Normalize phone to E.164 before passing to RPC.
    # Raises RecordOutcomeError on invalid/empty phone (T-59-05-04: only
    # call_id + tenant_id are safe to log; never log raw_phone or caller_name).
    try:
        phone_e164 = _normalize_phone(raw_phone, country_hint)
    except Exception as e:
        raise RecordOutcomeError(f"phone_normalize_failed: {e}") from e

    # Step 2: Invoke RPC — single atomic round-trip (D-14/D-16).
    # Passes p_appointment_id=None for inquiry path; non-None for job path (D-10).
    params: dict[str, Any] = {
        "p_tenant_id": tenant_id,
        "p_phone_e164": phone_e164,
        "p_caller_name": caller_name,
        "p_service_address": service_address,
        "p_appointment_id": appointment_id,  # None → NULL → inquiry branch
        "p_urgency": urgency,
        "p_call_id": call_id,
        "p_job_type": job_type,
    }
    try:
        result = supabase.rpc("record_call_outcome", params).execute()
    except Exception as e:
        raise RecordOutcomeError(f"rpc_failed: {e}") from e

    # Step 3: Validate shape.
    data = getattr(result, "data", None)
    if not isinstance(data, dict) or "customer_id" not in data:
        raise RecordOutcomeError(
            f"rpc_returned_unexpected_shape: {data!r}"
        )

    return data

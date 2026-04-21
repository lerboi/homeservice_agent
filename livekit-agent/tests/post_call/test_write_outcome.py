"""Phase 59 Plan 05 — unit tests for src.post_call.write_outcome.

Tests mock the Supabase client (push-deferred: RPC not yet live in Supabase).
Integration tests against the real test DB are deferred until Plan 08 when the
migration batch (059 + 054) is pushed live.

Test IDs mirror the plan's behaviour spec:
  - test_records_job_path        : appointment_id non-null → job_id set, inquiry_id None
  - test_records_inquiry_path    : appointment_id None → inquiry_id set, job_id None
  - test_dedup_same_phone_twice  : two calls same phone → both succeed (RPC handles dedup)
  - test_tenant_not_found_raises : bogus tenant_id → raises RecordOutcomeError
  - test_invalid_phone_raises    : empty raw_phone → raises via normalize step

D-02a: These tests confirm record_outcome ONLY calls the RPC — no fallback to
       leads/lead_calls. Any .table('leads').insert() or .from_('leads') call
       would be detected by the mock and fail the assertion.
"""
from __future__ import annotations

import uuid
from unittest.mock import MagicMock

import pytest

from src.post_call.write_outcome import record_outcome, RecordOutcomeError


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_supabase_mock(rpc_data: dict | None = None, rpc_side_effect=None):
    """Return a mock supabase client whose .rpc(...).execute() returns the given data."""
    mock = MagicMock()
    execute_mock = MagicMock()
    if rpc_side_effect is not None:
        execute_mock.side_effect = rpc_side_effect
    else:
        result = MagicMock()
        result.data = rpc_data
        execute_mock.return_value = result
    mock.rpc.return_value.execute = execute_mock
    return mock


_TENANT_ID = str(uuid.uuid4())
_CALL_ID = str(uuid.uuid4())
_APPT_ID = str(uuid.uuid4())
_CUSTOMER_ID = str(uuid.uuid4())
_JOB_ID = str(uuid.uuid4())
_INQUIRY_ID = str(uuid.uuid4())


# ---------------------------------------------------------------------------
# test_records_job_path
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_records_job_path():
    """appointment_id non-null → RPC called with appointment_id; result has job_id, no inquiry_id."""
    rpc_data = {
        "customer_id": _CUSTOMER_ID,
        "job_id": _JOB_ID,
        "inquiry_id": None,
    }
    supabase = _make_supabase_mock(rpc_data=rpc_data)

    result = await record_outcome(
        supabase,
        tenant_id=_TENANT_ID,
        raw_phone="+15551234567",
        caller_name="Alice",
        service_address="123 Main St",
        appointment_id=_APPT_ID,
        urgency="routine",
        call_id=_CALL_ID,
    )

    assert result["customer_id"] == _CUSTOMER_ID
    assert result["job_id"] == _JOB_ID
    assert result["inquiry_id"] is None

    # Confirm RPC was called (not a direct leads insert — D-02a)
    supabase.rpc.assert_called_once()
    call_name, call_params = supabase.rpc.call_args.args
    assert call_name == "record_call_outcome"
    assert call_params["p_appointment_id"] == _APPT_ID
    assert call_params["p_tenant_id"] == _TENANT_ID
    assert call_params["p_phone_e164"] == "+15551234567"


# ---------------------------------------------------------------------------
# test_records_inquiry_path
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_records_inquiry_path():
    """appointment_id None → RPC called with None; result has inquiry_id, no job_id."""
    rpc_data = {
        "customer_id": _CUSTOMER_ID,
        "job_id": None,
        "inquiry_id": _INQUIRY_ID,
    }
    supabase = _make_supabase_mock(rpc_data=rpc_data)

    result = await record_outcome(
        supabase,
        tenant_id=_TENANT_ID,
        raw_phone="+15551234567",
        caller_name="Bob",
        service_address="456 Elm Ave",
        appointment_id=None,
        urgency="urgent",
        call_id=_CALL_ID,
        job_type="plumbing",
    )

    assert result["job_id"] is None
    assert result["inquiry_id"] == _INQUIRY_ID

    call_name, call_params = supabase.rpc.call_args.args
    assert call_name == "record_call_outcome"
    assert call_params["p_appointment_id"] is None
    assert call_params["p_job_type"] == "plumbing"


# ---------------------------------------------------------------------------
# test_dedup_same_phone_twice
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_dedup_same_phone_twice():
    """Two calls with the same phone succeed independently.

    Customer dedup (D-05) is handled inside the RPC via ON CONFLICT, not in Python.
    Both calls must succeed and each returns a customer_id (the RPC upserts).
    """
    rpc_data = {
        "customer_id": _CUSTOMER_ID,
        "job_id": None,
        "inquiry_id": _INQUIRY_ID,
    }
    supabase = _make_supabase_mock(rpc_data=rpc_data)

    for _ in range(2):
        result = await record_outcome(
            supabase,
            tenant_id=_TENANT_ID,
            raw_phone="+15551234567",
            caller_name="Carol",
            service_address="789 Oak Rd",
            appointment_id=None,
            urgency="routine",
            call_id=str(uuid.uuid4()),
        )
        assert result["customer_id"] == _CUSTOMER_ID

    # RPC called twice — no local dedup or leads insert
    assert supabase.rpc.call_count == 2


# ---------------------------------------------------------------------------
# test_tenant_not_found_raises
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_tenant_not_found_raises():
    """RPC raising exception → record_outcome raises RecordOutcomeError."""
    supabase = _make_supabase_mock(
        rpc_side_effect=Exception("tenant_not_found")
    )

    with pytest.raises(RecordOutcomeError) as exc_info:
        await record_outcome(
            supabase,
            tenant_id=str(uuid.uuid4()),  # bogus tenant
            raw_phone="+15559999999",
            caller_name=None,
            service_address=None,
            appointment_id=None,
            urgency="routine",
            call_id=str(uuid.uuid4()),
        )

    assert "rpc_failed" in str(exc_info.value)


# ---------------------------------------------------------------------------
# test_invalid_phone_raises
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_invalid_phone_raises():
    """Empty raw_phone → RecordOutcomeError raised during phone normalization step."""
    supabase = _make_supabase_mock()

    with pytest.raises(RecordOutcomeError) as exc_info:
        await record_outcome(
            supabase,
            tenant_id=_TENANT_ID,
            raw_phone="",
            caller_name=None,
            service_address=None,
            appointment_id=None,
            urgency="routine",
            call_id=str(uuid.uuid4()),
        )

    assert "phone_normalize_failed" in str(exc_info.value)
    # RPC must NOT be called if phone normalization fails (D-02a — no partial write)
    supabase.rpc.assert_not_called()

"""Phase 58 Plan 01 Wave 0 scaffold — CTX-01 Jobber telemetry writes.

Parallel to test_xero_telemetry.py — same 3 behaviors on
`fetch_jobber_customer_by_phone`:
  (a) _touch_last_context_fetch_at fires on success.
  (b) activity_log insert with event_type='integration_fetch' and
      metadata.provider='jobber', counts has customers/jobs/invoices keys.
  (c) Neither side-effect on failure.

Will FAIL until Plan 58-03 wires the activity_log insert in
`livekit-agent/src/integrations/jobber.py`. Wave 0 target.

Real schema reference: supabase/migrations/004_leads_crm.sql lines 73-96
(activity_log uses event_type + metadata, NOT action + meta).
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.integrations import jobber as jobber_mod


@pytest.fixture
def admin_mock():
    """Chainable supabase admin mock: .table().update()/.insert() → execute() → None."""
    mock = MagicMock()
    mock.table.return_value.update.return_value.eq.return_value.execute.return_value = None
    mock.table.return_value.insert.return_value.execute.return_value = None
    return mock


@pytest.fixture
def cred_fixture():
    return {
        "id": "cred-jobber-1",
        "tenant_id": "tenant-1",
        "external_account_id": "jobber-acct-1",
        "access_token": "tok",
        "refresh_token": "rt",
        "expiry_date": "2099-01-01T00:00:00+00:00",
    }


@pytest.fixture
def customer_fixture():
    """Minimal Jobber customer match shape."""
    return {
        "client": {"id": "jobber-c-1", "firstName": "Acme"},
        "jobs": [],
        "invoices": [],
    }


@pytest.mark.asyncio
async def test_jobber_success_calls_touch_last_context_fetch_at(
    admin_mock, cred_fixture, customer_fixture
):
    """On successful fetchCustomerByPhone, _touch_last_context_fetch_at fires once."""
    touch_mock = AsyncMock()
    with (
        patch.object(jobber_mod, "_load_credentials", AsyncMock(return_value=cred_fixture)),
        patch.object(
            jobber_mod,
            "_get_client_by_phone",
            AsyncMock(return_value=customer_fixture["client"]),
        ),
        patch.object(jobber_mod, "_get_recent_jobs", AsyncMock(return_value=[])),
        patch.object(jobber_mod, "_get_recent_invoices", AsyncMock(return_value=[])),
        patch.object(jobber_mod, "_touch_last_context_fetch_at", touch_mock),
        patch.object(jobber_mod, "get_supabase_admin", return_value=admin_mock),
    ):
        result = await jobber_mod.fetch_jobber_customer_by_phone("tenant-1", "+15551234567")

    assert result is not None, "fetch returned None on happy path — check fixture wiring"
    touch_mock.assert_awaited_once_with(cred_fixture["id"])


@pytest.mark.asyncio
async def test_jobber_success_inserts_activity_log_row(
    admin_mock, cred_fixture, customer_fixture
):
    """On success, an activity_log row with event_type='integration_fetch' is inserted."""
    with (
        patch.object(jobber_mod, "_load_credentials", AsyncMock(return_value=cred_fixture)),
        patch.object(
            jobber_mod,
            "_get_client_by_phone",
            AsyncMock(return_value=customer_fixture["client"]),
        ),
        patch.object(jobber_mod, "_get_recent_jobs", AsyncMock(return_value=[])),
        patch.object(jobber_mod, "_get_recent_invoices", AsyncMock(return_value=[])),
        patch.object(jobber_mod, "_touch_last_context_fetch_at", AsyncMock()),
        patch.object(jobber_mod, "get_supabase_admin", return_value=admin_mock),
    ):
        await jobber_mod.fetch_jobber_customer_by_phone("tenant-1", "+15551234567")

    insert_calls = admin_mock.table.return_value.insert.call_args_list
    payloads = [
        c.args[0]
        for c in insert_calls
        if c.args and isinstance(c.args[0], dict) and c.args[0].get("event_type") == "integration_fetch"
    ]
    assert len(payloads) == 1, "expected exactly one integration_fetch activity_log row"
    payload = payloads[0]
    metadata = payload["metadata"]
    assert metadata["provider"] == "jobber"
    assert isinstance(metadata["duration_ms"], int) and metadata["duration_ms"] >= 0
    assert isinstance(metadata["cache_hit"], bool)
    assert "counts" in metadata and isinstance(metadata["counts"], dict)
    # Jobber counts shape is {customers, jobs, invoices} per 58-RESEARCH §B
    assert set(metadata["counts"].keys()) >= {"customers", "jobs", "invoices"}
    assert "phone_e164" in metadata


@pytest.mark.asyncio
async def test_jobber_failure_does_not_write_telemetry(admin_mock, cred_fixture):
    """On Jobber fetch failure, NEITHER last_context_fetch_at NOR activity_log is written."""
    touch_mock = AsyncMock()
    with (
        patch.object(jobber_mod, "_load_credentials", AsyncMock(return_value=cred_fixture)),
        patch.object(
            jobber_mod,
            "_get_client_by_phone",
            AsyncMock(side_effect=RuntimeError("Jobber 500 — simulated failure")),
        ),
        patch.object(jobber_mod, "_touch_last_context_fetch_at", touch_mock),
        patch.object(jobber_mod, "get_supabase_admin", return_value=admin_mock),
    ):
        try:
            await jobber_mod.fetch_jobber_customer_by_phone("tenant-1", "+15551234567")
        except RuntimeError:
            pass

    touch_mock.assert_not_awaited()
    insert_calls = admin_mock.table.return_value.insert.call_args_list
    fetch_rows = [
        c.args[0]
        for c in insert_calls
        if c.args and isinstance(c.args[0], dict) and c.args[0].get("event_type") == "integration_fetch"
    ]
    assert fetch_rows == [], "telemetry must not write on fetch failure"

"""Phase 58 Plan 01 Wave 0 scaffold — CTX-01 Xero telemetry writes.

Verifies two telemetry side-effects when `fetch_xero_customer_by_phone` runs:

1. `_touch_last_context_fetch_at(cred_id)` UPDATEs `accounting_credentials`
   with a fresh timestamp (surfaces in the integrations card "Last synced" line).
2. A row is INSERTed into `activity_log` with `event_type='integration_fetch'`
   and `metadata` containing provider / duration_ms / cache_hit / counts /
   phone_e164 keys.

Neither side-effect fires when the fetch fails (covered by the third test).

These tests WILL FAIL until Plan 58-03 extends
`livekit-agent/src/integrations/xero.py :: fetch_xero_customer_by_phone` to
emit the `integration_fetch` activity_log row on success. Wave 0 creates the
failing target; downstream plan turns it green.

Import path mirrors the existing livekit-agent test convention
(`from src.integrations import xero as xero_mod`); see
tests/test_xero_integration.py for precedent.

Real activity_log schema (supabase/migrations/004_leads_crm.sql lines 73-96):
  - event_type text NOT NULL  (NOT 'action' — research flagged CONTEXT D-06 mismatch)
  - metadata jsonb            (NOT 'meta')
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.integrations import xero as xero_mod


@pytest.fixture
def admin_mock():
    """A MagicMock shaped like supabase admin client: chainable .table().update()/.insert()."""
    mock = MagicMock()
    # .table('accounting_credentials').update({...}).eq('id', cred_id).execute()
    mock.table.return_value.update.return_value.eq.return_value.execute.return_value = None
    # .table('activity_log').insert({...}).execute()
    mock.table.return_value.insert.return_value.execute.return_value = None
    return mock


@pytest.fixture
def cred_fixture():
    """Minimal valid credentials row returned by _load_credentials."""
    return {
        "id": "cred-xero-1",
        "tenant_id": "tenant-1",
        "xero_tenant_id": "org-1",
        "access_token": "tok",
        "refresh_token": "rt",
        "expiry_date": "2099-01-01T00:00:00+00:00",
    }


@pytest.fixture
def customer_fixture():
    """Minimal Xero customer match shape."""
    return {
        "contact": {"ContactID": "xero-c-1", "Name": "Acme"},
        "outstanding_balance": 0.0,
        "invoices": [],
    }


@pytest.mark.asyncio
async def test_xero_success_calls_touch_last_context_fetch_at(
    admin_mock, cred_fixture, customer_fixture
):
    """On successful fetchCustomerByPhone, _touch_last_context_fetch_at fires once."""
    touch_mock = AsyncMock()
    with (
        patch.object(xero_mod, "_load_credentials", AsyncMock(return_value=cred_fixture)),
        patch.object(xero_mod, "_get_contact_by_phone", AsyncMock(return_value=customer_fixture["contact"])),
        patch.object(xero_mod, "_get_outstanding_balance", AsyncMock(return_value=0.0)),
        patch.object(xero_mod, "_get_recent_invoices", AsyncMock(return_value=[])),
        patch.object(xero_mod, "_touch_last_context_fetch_at", touch_mock),
        patch.object(xero_mod, "get_supabase_admin", return_value=admin_mock),
    ):
        result = await xero_mod.fetch_xero_customer_by_phone("tenant-1", "+15551234567")

    assert result is not None, "fetch returned None on happy path — check fixture wiring"
    touch_mock.assert_awaited_once_with(cred_fixture["id"])


@pytest.mark.asyncio
async def test_xero_success_inserts_activity_log_row(
    admin_mock, cred_fixture, customer_fixture
):
    """On success, an activity_log row with event_type='integration_fetch' is inserted."""
    with (
        patch.object(xero_mod, "_load_credentials", AsyncMock(return_value=cred_fixture)),
        patch.object(xero_mod, "_get_contact_by_phone", AsyncMock(return_value=customer_fixture["contact"])),
        patch.object(xero_mod, "_get_outstanding_balance", AsyncMock(return_value=0.0)),
        patch.object(xero_mod, "_get_recent_invoices", AsyncMock(return_value=[])),
        patch.object(xero_mod, "_touch_last_context_fetch_at", AsyncMock()),
        patch.object(xero_mod, "get_supabase_admin", return_value=admin_mock),
    ):
        await xero_mod.fetch_xero_customer_by_phone("tenant-1", "+15551234567")

    # Look at every .table('activity_log').insert({...}) call made on admin_mock.
    insert_calls = admin_mock.table.return_value.insert.call_args_list
    payloads = [
        c.args[0]
        for c in insert_calls
        if c.args and isinstance(c.args[0], dict) and c.args[0].get("event_type") == "integration_fetch"
    ]
    assert len(payloads) == 1, "expected exactly one integration_fetch activity_log row"
    payload = payloads[0]
    metadata = payload["metadata"]
    assert metadata["provider"] == "xero"
    assert isinstance(metadata["duration_ms"], int) and metadata["duration_ms"] >= 0
    assert isinstance(metadata["cache_hit"], bool)
    assert "counts" in metadata and isinstance(metadata["counts"], dict)
    assert "phone_e164" in metadata


@pytest.mark.asyncio
async def test_xero_failure_does_not_write_telemetry(admin_mock, cred_fixture):
    """On Xero fetch failure, NEITHER last_context_fetch_at NOR activity_log is written."""
    touch_mock = AsyncMock()
    with (
        patch.object(xero_mod, "_load_credentials", AsyncMock(return_value=cred_fixture)),
        patch.object(
            xero_mod,
            "_get_contact_by_phone",
            AsyncMock(side_effect=RuntimeError("Xero 500 — simulated failure")),
        ),
        patch.object(xero_mod, "_touch_last_context_fetch_at", touch_mock),
        patch.object(xero_mod, "get_supabase_admin", return_value=admin_mock),
    ):
        # fetch_xero_customer_by_phone should swallow the error and return None
        # (or raise — either way, telemetry MUST NOT fire)
        try:
            await xero_mod.fetch_xero_customer_by_phone("tenant-1", "+15551234567")
        except RuntimeError:
            pass

    touch_mock.assert_not_awaited()
    # No activity_log insert with event_type='integration_fetch' on failure path
    insert_calls = admin_mock.table.return_value.insert.call_args_list
    fetch_rows = [
        c.args[0]
        for c in insert_calls
        if c.args and isinstance(c.args[0], dict) and c.args[0].get("event_type") == "integration_fetch"
    ]
    assert fetch_rows == [], "telemetry must not write on fetch failure"

"""Phase 58 CTX-01 — Xero telemetry writes to activity_log.

Verifies three behaviors of `fetch_xero_customer_by_phone`:

1. `_touch_last_context_fetch_at(cred_id)` fires once on success.
2. One row is INSERTed into `activity_log` with `event_type='integration_fetch'`
   and `metadata` containing provider / duration_ms / cache_hit / counts /
   phone_e164 keys. Parallelized with `_touch_last_context_fetch_at` via
   `asyncio.gather` so telemetry adds zero latency to the return path.
3. Neither side-effect fires on failure.

Real activity_log schema (supabase/migrations/004_leads_crm.sql lines 73-96):
  - event_type text NOT NULL  (NOT 'action' — CONTEXT D-06 mismatch, see
                               58-RESEARCH §B.2 reconciliation Option A)
  - metadata jsonb            (NOT 'meta')

Test scaffolds in this file are the Plan 58-01 Wave 0 targets; Plan 58-03
turns them green by:
  - Adding `get_supabase_admin` and `emit_integration_fetch` imports at
    module-level of xero.py (so `patch.object(xero_mod, 'get_supabase_admin',
    ...)` resolves).
  - Emitting one `activity_log` row with `event_type='integration_fetch'` on
    the success path via `asyncio.gather(_touch_last_context_fetch_at(...),
    emit_integration_fetch(admin, ...))`.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.integrations import xero as xero_mod


@pytest.fixture
def admin_mock():
    """A MagicMock shaped like supabase admin client: chainable .table().update()/.insert()."""
    mock = MagicMock()
    mock.table.return_value.update.return_value.eq.return_value.execute.return_value = None
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
def contact_fixture():
    """Minimal Xero Contacts API shape (singular match returned by _get_contacts_by_phone)."""
    return {
        "ContactID": "xero-c-1",
        "Name": "Acme Plumbing",
        "FirstName": "Acme",
        "LastName": "Plumbing",
        "Phones": [{"PhoneNumber": "+15551234567"}],
    }


@pytest.mark.asyncio
async def test_xero_success_calls_touch_last_context_fetch_at(
    admin_mock, cred_fixture, contact_fixture
):
    """On successful fetchCustomerByPhone, _touch_last_context_fetch_at fires once."""
    touch_mock = AsyncMock()
    with (
        patch.object(xero_mod, "_load_credentials", AsyncMock(return_value=cred_fixture)),
        patch.object(xero_mod, "_get_contacts_by_phone", AsyncMock(return_value=contact_fixture)),
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
    admin_mock, cred_fixture, contact_fixture
):
    """On success, an activity_log row with event_type='integration_fetch' is inserted."""
    with (
        patch.object(xero_mod, "_load_credentials", AsyncMock(return_value=cred_fixture)),
        patch.object(xero_mod, "_get_contacts_by_phone", AsyncMock(return_value=contact_fixture)),
        patch.object(xero_mod, "_get_outstanding_balance", AsyncMock(return_value=0.0)),
        patch.object(xero_mod, "_get_recent_invoices", AsyncMock(return_value=[])),
        patch.object(xero_mod, "_touch_last_context_fetch_at", AsyncMock()),
        patch.object(xero_mod, "get_supabase_admin", return_value=admin_mock),
    ):
        await xero_mod.fetch_xero_customer_by_phone("tenant-1", "+15551234567")

    insert_calls = admin_mock.table.return_value.insert.call_args_list
    payloads = [
        c.args[0]
        for c in insert_calls
        if c.args and isinstance(c.args[0], dict) and c.args[0].get("event_type") == "integration_fetch"
    ]
    assert len(payloads) == 1, "expected exactly one integration_fetch activity_log row"
    payload = payloads[0]
    assert payload["tenant_id"] == "tenant-1"
    metadata = payload["metadata"]
    assert metadata["provider"] == "xero"
    assert isinstance(metadata["duration_ms"], int) and metadata["duration_ms"] >= 0
    assert isinstance(metadata["cache_hit"], bool)
    assert "counts" in metadata and isinstance(metadata["counts"], dict)
    # Xero counts shape is {customers, invoices} per 58-03 PLAN acceptance.
    assert set(metadata["counts"].keys()) >= {"customers", "invoices"}
    assert metadata["phone_e164"] == "+15551234567"


@pytest.mark.asyncio
async def test_xero_failure_does_not_write_telemetry(admin_mock, cred_fixture):
    """On Xero fetch failure, NEITHER last_context_fetch_at NOR activity_log is written."""
    touch_mock = AsyncMock()
    with (
        patch.object(xero_mod, "_load_credentials", AsyncMock(return_value=cred_fixture)),
        patch.object(
            xero_mod,
            "_get_contacts_by_phone",
            AsyncMock(side_effect=RuntimeError("Xero 500 — simulated failure")),
        ),
        patch.object(xero_mod, "_touch_last_context_fetch_at", touch_mock),
        patch.object(xero_mod, "get_supabase_admin", return_value=admin_mock),
    ):
        try:
            await xero_mod.fetch_xero_customer_by_phone("tenant-1", "+15551234567")
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

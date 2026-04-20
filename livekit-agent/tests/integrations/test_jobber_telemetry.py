"""Phase 58 CTX-01 — Jobber telemetry writes to activity_log.

Parallel to test_xero_telemetry.py — same 3 behaviors on
`fetch_jobber_customer_by_phone`:
  (a) _touch_last_context_fetch_at fires on success.
  (b) activity_log insert with event_type='integration_fetch' and
      metadata.provider='jobber', counts has customers/jobs/invoices keys.
  (c) Neither side-effect on failure.

Patches at the `_post_graphql` + `_match_phone` layer (NOT at the
non-existent `_get_client_by_phone` layer — jobber.py does client lookup via
a single GraphQL query, not discrete helpers like xero.py).

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
        # Far future so we skip the expired-refresh branch.
        "expiry_date": "2099-01-01T00:00:00+00:00",
    }


@pytest.fixture
def jobber_graphql_response():
    """Minimal GraphQL response for `clients(filter: { phoneNumber: $phone })`.

    Shape mirrors the FETCH_QUERY in jobber.py; one client with one matching
    phone. `_match_phone` normalizes via `phonenumbers` so we pass a raw
    E.164 string that will normalize to itself.
    """
    resp = MagicMock()
    resp.status_code = 200
    resp.json.return_value = {
        "data": {
            "clients": {
                "nodes": [
                    {
                        "id": "jobber-c-1",
                        "name": "Acme Plumbing",
                        "emails": [{"address": "acme@example.com"}],
                        "phones": [{"number": "+15551234567"}],
                        "jobs": {"nodes": []},
                        "invoices": {"nodes": []},
                        "visits": {"nodes": []},
                    }
                ]
            }
        }
    }
    return resp


@pytest.mark.asyncio
async def test_jobber_success_calls_touch_last_context_fetch_at(
    admin_mock, cred_fixture, jobber_graphql_response
):
    """On successful fetchCustomerByPhone, _touch_last_context_fetch_at fires once."""
    touch_mock = AsyncMock()
    with (
        patch.object(jobber_mod, "_load_credentials", AsyncMock(return_value=cred_fixture)),
        patch.object(
            jobber_mod,
            "_post_graphql",
            AsyncMock(return_value=jobber_graphql_response),
        ),
        patch.object(jobber_mod, "_touch_last_context_fetch_at", touch_mock),
        patch.object(jobber_mod, "get_supabase_admin", return_value=admin_mock),
    ):
        result = await jobber_mod.fetch_jobber_customer_by_phone("tenant-1", "+15551234567")

    assert result is not None, "fetch returned None on happy path — check fixture wiring"
    touch_mock.assert_awaited_once_with(cred_fixture["id"])


@pytest.mark.asyncio
async def test_jobber_success_inserts_activity_log_row(
    admin_mock, cred_fixture, jobber_graphql_response
):
    """On success, an activity_log row with event_type='integration_fetch' is inserted."""
    with (
        patch.object(jobber_mod, "_load_credentials", AsyncMock(return_value=cred_fixture)),
        patch.object(
            jobber_mod,
            "_post_graphql",
            AsyncMock(return_value=jobber_graphql_response),
        ),
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
    assert payload["tenant_id"] == "tenant-1"
    metadata = payload["metadata"]
    assert metadata["provider"] == "jobber"
    assert isinstance(metadata["duration_ms"], int) and metadata["duration_ms"] >= 0
    assert isinstance(metadata["cache_hit"], bool)
    assert "counts" in metadata and isinstance(metadata["counts"], dict)
    # Jobber counts shape is {customers, jobs, invoices} per 58-03 PLAN acceptance.
    assert set(metadata["counts"].keys()) >= {"customers", "jobs", "invoices"}
    assert metadata["phone_e164"] == "+15551234567"


@pytest.mark.asyncio
async def test_jobber_failure_does_not_write_telemetry(admin_mock, cred_fixture):
    """On Jobber fetch failure, NEITHER last_context_fetch_at NOR activity_log is written.

    jobber.py wraps the entire body in try/except that returns None on any
    exception (contract: never raise into Plan 06's 800ms race). So a
    RuntimeError from _post_graphql is caught silently; we assert no
    telemetry side-effects.
    """
    touch_mock = AsyncMock()
    with (
        patch.object(jobber_mod, "_load_credentials", AsyncMock(return_value=cred_fixture)),
        patch.object(
            jobber_mod,
            "_post_graphql",
            AsyncMock(side_effect=RuntimeError("Jobber 500 — simulated failure")),
        ),
        patch.object(jobber_mod, "_touch_last_context_fetch_at", touch_mock),
        patch.object(jobber_mod, "get_supabase_admin", return_value=admin_mock),
    ):
        result = await jobber_mod.fetch_jobber_customer_by_phone("tenant-1", "+15551234567")

    assert result is None, "jobber.py contract: return None on any error, never raise"
    touch_mock.assert_not_awaited()
    insert_calls = admin_mock.table.return_value.insert.call_args_list
    fetch_rows = [
        c.args[0]
        for c in insert_calls
        if c.args and isinstance(c.args[0], dict) and c.args[0].get("event_type") == "integration_fetch"
    ]
    assert fetch_rows == [], "telemetry must not write on fetch failure"

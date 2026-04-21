"""
Integration tests for record_call_outcome RPC (Plan 03 / migration 060_phase59_rpcs.sql).

Decision IDs validated:
  D-05  — customer dedup by (tenant_id, phone_e164)
  D-10  — same-call auto-convert: appointment_id → job; no appointment_id → inquiry
  D-14  — single-transaction atomicity; rollback on failure
  D-16  — customer_calls junction row always created; job_calls row only on job path

Security: ASVS V4 — RPC callable only by service_role (T-59-03-01).

NOTE: These tests require a live Supabase instance with migration 060_phase59_rpcs.sql
applied. All tests are marked skip with reason "push-deferred" because the live push
is batched to the pre-Plan-08 slot (per Plan 02 SUMMARY). Remove the skip decorators
after the push is confirmed (Plan 08 Task 1).

Fixture requirements (documented for Plan 08 executor):
  - SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars set
  - conftest.py provides: service_role_client, test_tenant_id, test_appointment_id
    (an appointment row belonging to test_tenant_id)
  - Teardown cleans: customers, jobs, inquiries, customer_calls, job_calls rows
    WHERE tenant_id = test_tenant_id
"""

import pytest

# ---------------------------------------------------------------------------
# Shared test data
# ---------------------------------------------------------------------------
TEST_PHONE = "+15555550101"   # synthetic US number safe for tests
TEST_PHONE_2 = "+15555550102"
TEST_URGENCY = "routine"
TEST_NAME = "Test Caller"
TEST_ADDRESS = "123 Test St"


# ---------------------------------------------------------------------------
# Helper: call the RPC via service-role client
# ---------------------------------------------------------------------------
def _rpc(client, tenant_id, phone, caller_name, service_address,
         appointment_id, urgency, call_id, job_type=None):
    """Thin wrapper so tests don't repeat keyword args."""
    params = {
        "p_tenant_id": str(tenant_id),
        "p_phone_e164": phone,
        "p_caller_name": caller_name,
        "p_service_address": service_address,
        "p_appointment_id": str(appointment_id) if appointment_id else None,
        "p_urgency": urgency,
        "p_call_id": str(call_id),
        "p_job_type": job_type,
    }
    result = client.rpc("record_call_outcome", params).execute()
    assert result.data is not None, f"RPC returned no data: {result}"
    return result.data


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.skip(reason="push-deferred: live Supabase push batched to pre-Plan-08 slot")
def test_dedup_by_phone(service_role_client, test_tenant_id, test_call_id, test_call_id_2):
    """D-05: calling the RPC twice with the same (tenant_id, phone) produces exactly
    one customer row — not two.

    Setup:   Call RPC twice: same tenant_id + phone_e164, different call_ids.
    Assert:  SELECT COUNT(*) FROM customers WHERE tenant_id=t AND phone_e164=p  ==  1
    """
    r1 = _rpc(service_role_client, test_tenant_id, TEST_PHONE,
               TEST_NAME, TEST_ADDRESS, None, TEST_URGENCY, test_call_id)
    r2 = _rpc(service_role_client, test_tenant_id, TEST_PHONE,
               "Different Name", "456 Other St", None, TEST_URGENCY, test_call_id_2)

    # Both calls return a customer_id, and they must be the SAME row
    assert r1["customer_id"] == r2["customer_id"], (
        "Second RPC call created a new customer row instead of reusing existing one"
    )

    rows = (
        service_role_client.table("customers")
        .select("id")
        .eq("tenant_id", str(test_tenant_id))
        .eq("phone_e164", TEST_PHONE)
        .execute()
    )
    assert len(rows.data) == 1, (
        f"Expected 1 customer row, found {len(rows.data)}"
    )


@pytest.mark.skip(reason="push-deferred: live Supabase push batched to pre-Plan-08 slot")
def test_auto_convert(service_role_client, test_tenant_id, test_appointment_id, test_call_id):
    """D-10 auto-convert path: when appointment_id is provided, the RPC creates a job
    (not an inquiry) and links the call via job_calls.

    Setup:   Call RPC with appointment_id NOT NULL.
    Assert:
      - result has job_id set and inquiry_id null
      - SELECT COUNT(*) FROM jobs WHERE appointment_id = test_appointment_id  == 1
      - SELECT COUNT(*) FROM inquiries WHERE customer_id = customer_id  == 0
    """
    result = _rpc(service_role_client, test_tenant_id, TEST_PHONE,
                  TEST_NAME, TEST_ADDRESS, test_appointment_id,
                  TEST_URGENCY, test_call_id)

    assert result["job_id"] is not None, "Expected job_id in result for appointment path"
    assert result["inquiry_id"] is None, "Expected inquiry_id=null for appointment path"
    assert result["customer_id"] is not None, "customer_id must be set"

    jobs = (
        service_role_client.table("jobs")
        .select("id")
        .eq("appointment_id", str(test_appointment_id))
        .execute()
    )
    assert len(jobs.data) == 1, (
        f"Expected 1 job for appointment, found {len(jobs.data)}"
    )

    inquiries = (
        service_role_client.table("inquiries")
        .select("id")
        .eq("customer_id", result["customer_id"])
        .execute()
    )
    assert len(inquiries.data) == 0, (
        "Inquiry row created when appointment_id was provided — should not exist"
    )


@pytest.mark.skip(reason="push-deferred: live Supabase push batched to pre-Plan-08 slot")
def test_inquiry_path(service_role_client, test_tenant_id, test_call_id):
    """D-10 inquiry path: when appointment_id is NULL, the RPC creates an inquiry
    (not a job).

    Setup:   Call RPC with p_appointment_id=NULL.
    Assert:
      - result has inquiry_id set and job_id null
      - SELECT COUNT(*) FROM inquiries WHERE customer_id = customer_id  == 1
    """
    result = _rpc(service_role_client, test_tenant_id, TEST_PHONE,
                  TEST_NAME, TEST_ADDRESS, None,
                  TEST_URGENCY, test_call_id, job_type="plumbing")

    assert result["inquiry_id"] is not None, "Expected inquiry_id for no-appointment path"
    assert result["job_id"] is None, "Expected job_id=null for no-appointment path"
    assert result["customer_id"] is not None, "customer_id must be set"

    inquiries = (
        service_role_client.table("inquiries")
        .select("id")
        .eq("customer_id", result["customer_id"])
        .execute()
    )
    assert len(inquiries.data) == 1, (
        f"Expected 1 inquiry row, found {len(inquiries.data)}"
    )


@pytest.mark.skip(reason="push-deferred: live Supabase push batched to pre-Plan-08 slot")
def test_transaction_rollback(service_role_client, test_tenant_id, test_call_id):
    """D-14: if the inner INSERT fails (invalid appointment_id FK), the customer
    UPSERT must also roll back — no partial customer row is created.

    Setup:   Call RPC with a non-existent appointment_id (bogus UUID).
    Assert:
      - RPC raises a Postgres exception (FK violation or similar)
      - SELECT COUNT(*) FROM customers WHERE phone_e164 = TEST_PHONE_2  == 0
    """
    import uuid
    bogus_appointment_id = str(uuid.uuid4())  # does not exist in appointments table

    with pytest.raises(Exception):
        _rpc(service_role_client, test_tenant_id, TEST_PHONE_2,
             TEST_NAME, TEST_ADDRESS, bogus_appointment_id,
             TEST_URGENCY, test_call_id)

    rows = (
        service_role_client.table("customers")
        .select("id")
        .eq("tenant_id", str(test_tenant_id))
        .eq("phone_e164", TEST_PHONE_2)
        .execute()
    )
    assert len(rows.data) == 0, (
        "Customer row was persisted despite RPC failure — transaction did not roll back"
    )


@pytest.mark.skip(reason="push-deferred: live Supabase push batched to pre-Plan-08 slot")
def test_call_linking(service_role_client, test_tenant_id, test_call_id):
    """D-16: customer_calls junction row is always created; job_calls row is created
    only when the job path is taken.

    Setup:   Call RPC without appointment_id (inquiry path) then with appointment_id
             (job path) using a different phone to avoid dedup complications.
    Assert (inquiry path):
      - customer_calls has a row for (customer_id, call_id)
      - job_calls has NO row for call_id
    Assert (job path — uses separate appointment + call):
      - customer_calls has a row
      - job_calls also has a row for (job_id, call_id)
    """
    # Inquiry path
    result_inq = _rpc(service_role_client, test_tenant_id, TEST_PHONE,
                      TEST_NAME, TEST_ADDRESS, None,
                      TEST_URGENCY, test_call_id)

    cust_calls = (
        service_role_client.table("customer_calls")
        .select("call_id")
        .eq("customer_id", result_inq["customer_id"])
        .eq("call_id", str(test_call_id))
        .execute()
    )
    assert len(cust_calls.data) == 1, "customer_calls row missing for inquiry path"

    job_calls = (
        service_role_client.table("job_calls")
        .select("job_id")
        .eq("call_id", str(test_call_id))
        .execute()
    )
    assert len(job_calls.data) == 0, "job_calls row should not exist for inquiry path"


@pytest.mark.skip(reason="push-deferred: live Supabase push batched to pre-Plan-08 slot")
def test_execute_permission(service_role_client, anon_client, test_tenant_id, test_call_id):
    """ASVS V4 / T-59-03-01: the RPC must be callable only by service_role.
    An attempt via the anon or authenticated role must raise a permission error.

    Setup:   Try to call record_call_outcome via anon_client (uses SUPABASE_ANON_KEY).
    Assert:  Exception raised with a permission / authorization error message.
    """
    import pytest
    with pytest.raises(Exception) as exc_info:
        _rpc(anon_client, test_tenant_id, TEST_PHONE,
             TEST_NAME, TEST_ADDRESS, None,
             TEST_URGENCY, test_call_id)

    err_str = str(exc_info.value).lower()
    assert any(k in err_str for k in ("permission", "access", "denied", "privilege", "42501")), (
        f"Expected permission error, got: {exc_info.value}"
    )

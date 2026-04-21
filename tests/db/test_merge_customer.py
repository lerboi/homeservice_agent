"""
Integration tests for merge_customer and unmerge_customer RPCs (Plan 03 / 054_phase59_rpcs.sql).

Decision IDs validated:
  D-19          — merge: repoint children; soft-delete source; 7-day undo window
  D-19 expanded — customer_merge_audit: one row per merge, retained forever;
                  row_counts JSONB with 6 keys; unmerge marks unmerged_at (never deletes)

Security: ASVS V4 — T-59-03-02 (cross-tenant merge rejected).

NOTE: These tests require a live Supabase instance with migrations 053a + 054_phase59_rpcs.sql
applied. All tests are marked skip with reason "push-deferred" because the live push is
batched to the pre-Plan-08 slot (per Plan 02/03 SUMMARY). Remove the skip decorators after
the push is confirmed (Plan 08 Task 1).

Fixture requirements (documented for Plan 08 executor):
  - SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars set
  - conftest.py provides:
      service_role_client     — service-role Supabase client
      test_tenant_id          — UUID of test tenant
      test_tenant_id_b        — UUID of a DIFFERENT test tenant (for cross-tenant test)
      make_customer(tenant_id, phone) → uuid  — helper that inserts a customer row and returns id
      make_job(tenant_id, customer_id, appointment_id) → uuid  — inserts a job row
      make_inquiry(tenant_id, customer_id) → uuid               — inserts an inquiry row
      make_activity(tenant_id, customer_id) → uuid              — inserts an activity_log row
      make_call(tenant_id) → uuid                               — inserts a calls row
  - Teardown cleans all rows WHERE tenant_id IN (test_tenant_id, test_tenant_id_b)
    from customers, jobs, inquiries, customer_calls, job_calls, activity_log,
    customer_merge_audit
"""

import uuid
import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _merge(client, tenant_id, source_id, target_id, merged_by=None):
    """Call merge_customer RPC via service-role client. Returns result dict."""
    result = client.rpc("merge_customer", {
        "p_tenant_id": str(tenant_id),
        "p_source_id": str(source_id),
        "p_target_id": str(target_id),
        "p_merged_by": str(merged_by) if merged_by else None,
    }).execute()
    assert result.data is not None, f"merge_customer returned no data: {result}"
    return result.data


def _unmerge(client, tenant_id, source_id):
    """Call unmerge_customer RPC via service-role client. Returns result dict."""
    result = client.rpc("unmerge_customer", {
        "p_tenant_id": str(tenant_id),
        "p_source_id": str(source_id),
    }).execute()
    assert result.data is not None, f"unmerge_customer returned no data: {result}"
    return result.data


def _get_customer(client, customer_id):
    row = client.table("customers").select("*").eq("id", str(customer_id)).single().execute()
    return row.data


def _get_audit_rows(client, source_id):
    rows = (
        client.table("customer_merge_audit")
        .select("*")
        .eq("source_customer_id", str(source_id))
        .execute()
    )
    return rows.data


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.skip(reason="push-deferred: live Supabase push batched to pre-Plan-08 slot")
def test_merge_repoints_children(
    service_role_client,
    test_tenant_id,
    make_customer,
    make_job,
    make_inquiry,
    make_activity,
    make_call,
    test_appointment_id,
):
    """D-19: merge_customer moves all children from source → target and soft-deletes source.

    Setup:
      - source customer with 1 job, 1 inquiry, 1 activity_log row, 1 customer_calls row
      - target customer (empty)
    Assert:
      - result has source_id, target_id, audit_id, moved_counts
      - jobs.customer_id for source's job now == target_id
      - inquiries.customer_id for source's inquiry now == target_id
      - source customer has merged_into == target_id (soft-deleted, not hard-deleted)
      - source customer row still exists in DB
      - merge_snapshot on source is not null and contains job/inquiry IDs
    """
    source_id = make_customer(test_tenant_id, "+15555550201")
    target_id = make_customer(test_tenant_id, "+15555550202")
    job_id     = make_job(test_tenant_id, source_id, test_appointment_id)
    inq_id     = make_inquiry(test_tenant_id, source_id)
    act_id     = make_activity(test_tenant_id, source_id)
    call_id    = make_call(test_tenant_id)

    # Link call to source
    service_role_client.table("customer_calls").insert({
        "customer_id": str(source_id),
        "call_id": str(call_id),
    }).execute()

    result = _merge(service_role_client, test_tenant_id, source_id, target_id)

    assert str(result["source_id"]) == str(source_id)
    assert str(result["target_id"]) == str(target_id)
    assert result["audit_id"] is not None
    assert result["moved_counts"]["jobs"] >= 1

    # Job repointed
    job_row = service_role_client.table("jobs").select("customer_id").eq("id", str(job_id)).single().execute()
    assert str(job_row.data["customer_id"]) == str(target_id), "Job not repointed to target"

    # Inquiry repointed
    inq_row = service_role_client.table("inquiries").select("customer_id").eq("id", str(inq_id)).single().execute()
    assert str(inq_row.data["customer_id"]) == str(target_id), "Inquiry not repointed to target"

    # Source soft-deleted (not hard-deleted)
    src = _get_customer(service_role_client, source_id)
    assert src is not None, "Source customer row was hard-deleted — should be soft-deleted"
    assert str(src["merged_into"]) == str(target_id), "merged_into not set on source"
    assert src["merge_snapshot"] is not None, "merge_snapshot should be populated"


@pytest.mark.skip(reason="push-deferred: live Supabase push batched to pre-Plan-08 slot")
def test_undo_within_7_days(
    service_role_client,
    test_tenant_id,
    make_customer,
    make_job,
    test_appointment_id,
):
    """D-19: unmerge_customer restores the original state when called within 7 days.

    Setup:   merge_customer → immediately call unmerge_customer.
    Assert:
      - source.merged_into is NULL after unmerge
      - source.merge_snapshot is NULL after unmerge
      - job.customer_id == source_id (restored)
      - unmerge result has source_id, restored_from, audit_id
    """
    source_id = make_customer(test_tenant_id, "+15555550203")
    target_id = make_customer(test_tenant_id, "+15555550204")
    job_id    = make_job(test_tenant_id, source_id, test_appointment_id)

    _merge(service_role_client, test_tenant_id, source_id, target_id)

    result = _unmerge(service_role_client, test_tenant_id, source_id)

    assert str(result["source_id"]) == str(source_id)
    assert str(result["restored_from"]) == str(target_id)
    assert result["audit_id"] is not None

    src = _get_customer(service_role_client, source_id)
    assert src["merged_into"] is None, "merged_into should be NULL after unmerge"
    assert src["merge_snapshot"] is None, "merge_snapshot should be NULL after unmerge"

    job_row = service_role_client.table("jobs").select("customer_id").eq("id", str(job_id)).single().execute()
    assert str(job_row.data["customer_id"]) == str(source_id), (
        "Job customer_id not restored to source after unmerge"
    )


@pytest.mark.skip(reason="push-deferred: live Supabase push batched to pre-Plan-08 slot")
def test_unmerge_after_7_days_raises(service_role_client, test_tenant_id, make_customer):
    """D-19: unmerge_customer raises merge_window_expired when called after 7 days.

    Setup:   merge_customer; then manually UPDATE customers SET merged_at = now() - interval '8 days'.
    Assert:  unmerge_customer raises an exception containing 'merge_window_expired'.
    """
    source_id = make_customer(test_tenant_id, "+15555550205")
    target_id = make_customer(test_tenant_id, "+15555550206")

    _merge(service_role_client, test_tenant_id, source_id, target_id)

    # Backdate merged_at to simulate expired window
    service_role_client.table("customers").update({
        "merged_at": "1970-01-01T00:00:00Z"
    }).eq("id", str(source_id)).execute()

    with pytest.raises(Exception) as exc_info:
        _unmerge(service_role_client, test_tenant_id, source_id)

    assert "merge_window_expired" in str(exc_info.value), (
        f"Expected merge_window_expired, got: {exc_info.value}"
    )


@pytest.mark.skip(reason="push-deferred: live Supabase push batched to pre-Plan-08 slot")
def test_cross_tenant_merge_rejected(
    service_role_client,
    test_tenant_id,
    test_tenant_id_b,
    make_customer,
):
    """T-59-03-02: merge_customer must refuse when source and target belong to different tenants.

    Setup:   source in tenant A, target in tenant B.
    Assert:  merge_customer raises source_invalid or target_invalid.
    """
    source_id = make_customer(test_tenant_id,   "+15555550207")
    target_id = make_customer(test_tenant_id_b, "+15555550208")

    with pytest.raises(Exception) as exc_info:
        _merge(service_role_client, test_tenant_id, source_id, target_id)

    err = str(exc_info.value)
    assert "source_invalid" in err or "target_invalid" in err, (
        f"Expected source_invalid or target_invalid for cross-tenant merge, got: {err}"
    )


@pytest.mark.skip(reason="push-deferred: live Supabase push batched to pre-Plan-08 slot")
def test_self_merge_rejected(service_role_client, test_tenant_id, make_customer):
    """T-59-03-05: merge_customer must refuse source_id == target_id.

    Assert:  raises self_merge_forbidden.
    """
    customer_id = make_customer(test_tenant_id, "+15555550209")

    with pytest.raises(Exception) as exc_info:
        _merge(service_role_client, test_tenant_id, customer_id, customer_id)

    assert "self_merge_forbidden" in str(exc_info.value), (
        f"Expected self_merge_forbidden, got: {exc_info.value}"
    )


@pytest.mark.skip(reason="push-deferred: live Supabase push batched to pre-Plan-08 slot")
def test_merge_inserts_customer_merge_audit_row(
    service_role_client,
    test_tenant_id,
    make_customer,
    make_job,
    make_inquiry,
    test_appointment_id,
):
    """D-19 expanded: merge_customer inserts exactly ONE row into customer_merge_audit
    with all 6 required row_counts keys.

    Setup:   source with 1 job + 1 inquiry; merge into target.
    Assert:
      - SELECT COUNT(*) FROM customer_merge_audit WHERE source_customer_id = source AND
        target_customer_id = target  ==  1
      - row_counts JSONB has all 6 keys: jobs, inquiries, invoices, activity_log,
        customer_calls, job_calls
      - each value is a non-negative integer
      - row_counts['jobs'] == 1, row_counts['inquiries'] == 1
    """
    source_id = make_customer(test_tenant_id, "+15555550210")
    target_id = make_customer(test_tenant_id, "+15555550211")
    _job_id   = make_job(test_tenant_id, source_id, test_appointment_id)
    _inq_id   = make_inquiry(test_tenant_id, source_id)

    result = _merge(service_role_client, test_tenant_id, source_id, target_id)
    audit_id = result["audit_id"]

    # Exactly 1 audit row
    rows = _get_audit_rows(service_role_client, source_id)
    assert len(rows) == 1, f"Expected 1 audit row, found {len(rows)}"
    assert str(rows[0]["id"]) == str(audit_id)
    assert str(rows[0]["source_customer_id"]) == str(source_id)
    assert str(rows[0]["target_customer_id"]) == str(target_id)

    # row_counts has all 6 required keys with non-negative integer values
    row_counts = rows[0]["row_counts"]
    required_keys = {"jobs", "inquiries", "invoices", "activity_log", "customer_calls", "job_calls"}
    assert required_keys == set(row_counts.keys()), (
        f"row_counts keys mismatch. Expected {required_keys}, got {set(row_counts.keys())}"
    )
    for k, v in row_counts.items():
        assert isinstance(v, int) and v >= 0, f"row_counts['{k}'] = {v!r} is not a non-negative int"

    # Counts match what we set up
    assert row_counts["jobs"] == 1, f"Expected jobs=1, got {row_counts['jobs']}"
    assert row_counts["inquiries"] == 1, f"Expected inquiries=1, got {row_counts['inquiries']}"


@pytest.mark.skip(reason="push-deferred: live Supabase push batched to pre-Plan-08 slot")
def test_unmerge_updates_audit_unmerged_at(
    service_role_client,
    test_tenant_id,
    make_customer,
):
    """D-19 expanded: after a successful unmerge, the matching customer_merge_audit row
    has unmerged_at IS NOT NULL. The row is NOT deleted.

    Setup:   merge → unmerge.
    Assert:
      - audit row still exists (not deleted)
      - audit row has unmerged_at IS NOT NULL
      - total count of customer_merge_audit rows for this source is unchanged
        (unmerge does not delete the audit row)
    """
    source_id = make_customer(test_tenant_id, "+15555550212")
    target_id = make_customer(test_tenant_id, "+15555550213")

    _merge(service_role_client, test_tenant_id, source_id, target_id)

    count_before = len(_get_audit_rows(service_role_client, source_id))

    _unmerge(service_role_client, test_tenant_id, source_id)

    rows_after = _get_audit_rows(service_role_client, source_id)
    count_after = len(rows_after)

    assert count_after == count_before, (
        f"Audit row count changed after unmerge: {count_before} → {count_after}. "
        "Audit rows must be retained forever."
    )
    assert rows_after[0]["unmerged_at"] is not None, (
        "unmerged_at should be set after successful unmerge"
    )


@pytest.mark.skip(reason="push-deferred: live Supabase push batched to pre-Plan-08 slot")
def test_audit_retained_after_7_days(service_role_client, test_tenant_id, make_customer):
    """D-19 expanded: even when the 7-day undo window has expired and unmerge raises
    merge_window_expired, the customer_merge_audit row is still present with
    unmerged_at IS NULL (retained forever; undo window expiry does not purge the audit row).

    Setup:
      - merge_customer (creates audit row, unmerged_at = NULL)
      - backdate merged_at to 8 days ago
      - attempt unmerge_customer → expect merge_window_expired exception
    Assert:
      - audit row still exists
      - audit row has unmerged_at IS NULL (undo never happened)
    """
    source_id = make_customer(test_tenant_id, "+15555550214")
    target_id = make_customer(test_tenant_id, "+15555550215")

    _merge(service_role_client, test_tenant_id, source_id, target_id)

    # Backdate merged_at so the 7-day window is expired
    service_role_client.table("customers").update({
        "merged_at": "1970-01-01T00:00:00Z"
    }).eq("id", str(source_id)).execute()

    with pytest.raises(Exception) as exc_info:
        _unmerge(service_role_client, test_tenant_id, source_id)
    assert "merge_window_expired" in str(exc_info.value)

    # Audit row must still be there with unmerged_at = NULL
    rows = _get_audit_rows(service_role_client, source_id)
    assert len(rows) == 1, "Audit row missing after expired undo attempt"
    assert rows[0]["unmerged_at"] is None, (
        "unmerged_at should still be NULL — undo never succeeded"
    )

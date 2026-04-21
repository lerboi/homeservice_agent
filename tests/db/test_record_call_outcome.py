"""
Scaffold tests for record_call_outcome RPC (Plan 03).

Decision IDs validated: D-05 (dedup by phone), D-10 (auto-convert inquiry → job),
D-14 (transaction rollback on RPC failure).

All tests are skipped until Plan 03 creates the RPC.
"""
import pytest


@pytest.mark.skip(reason="Plan 03: RPC not yet created")
def test_dedup_by_phone():
    """D-05: record_call_outcome deduplicates callers by E.164 phone.

    When a call arrives from a phone number that already has a customer row
    (same tenant_id + from_number), the RPC reuses the existing customer
    rather than creating a duplicate.
    """
    pass


@pytest.mark.skip(reason="Plan 03: RPC not yet created")
def test_auto_convert():
    """D-10: record_call_outcome auto-converts an inquiry to a job.

    When appointment_id is provided and a prior inquiry exists for the same
    customer + call, the RPC creates a job row and marks the inquiry as
    converted — no manual intervention required.
    """
    pass


@pytest.mark.skip(reason="Plan 03: RPC not yet created")
def test_transaction_rollback():
    """D-14: record_call_outcome rolls back all writes on any RPC failure.

    If any INSERT/UPDATE inside the RPC fails (e.g. constraint violation on
    jobs.appointment_id), the entire transaction is rolled back — no partial
    customer or partial job row is persisted.
    """
    pass

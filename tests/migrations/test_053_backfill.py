"""
Scaffold tests for the 053a backfill migration (Plan 02).

Decision IDs validated: D-05 (customer count from distinct phones),
D-11 (invoices repointed to jobs), D-12/D-13 (activity_log three FKs).

All tests are skipped until Plan 02 applies the 053a migration.
"""
import pytest


@pytest.mark.skip(reason="Plan 02: 053a not yet applied")
def test_invoices_repointed():
    """D-11: After backfill, invoices.lead_id column replaced by job_id.

    Every invoice that previously had a lead_id pointing to a lead with
    appointment_id IS NOT NULL now has job_id pointing to the corresponding
    jobs row. No invoice.lead_id values remain after migration.
    """
    pass


@pytest.mark.skip(reason="Plan 02: 053a not yet applied")
def test_activity_log_three_fks():
    """D-12, D-13: After backfill, activity_log has three nullable FKs.

    activity_log gains customer_id and job_id columns alongside the existing
    lead_id (which is deprecated but retained for backward compatibility).
    Existing rows have customer_id populated where from_number was non-NULL.
    """
    pass


@pytest.mark.skip(reason="Plan 02: 053a not yet applied")
def test_customer_count_matches_audit():
    """D-05: Post-backfill customers count matches 053_pre_audit.sql output.

    SELECT COUNT(*) FROM customers should equal the expected_customers count
    produced by the pre-audit query:
      SELECT COUNT(*) FROM (
        SELECT DISTINCT tenant_id, from_number FROM leads
        WHERE from_number IS NOT NULL
      ) s;
    """
    pass

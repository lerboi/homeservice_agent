"""
Scaffold tests for the 053a backfill migration (Plan 02).

Decision IDs validated:
  D-05  — customer count derived from distinct E.164 phones
  D-11  — invoices repointed to jobs
  D-12  — activity_log three FKs
  D-13a — orphan leads (appointment_id IS NULL) become inquiries; status preserved
  D-13b — duplicate-phone leads collapse to one customer; name/address from most recent
  D-13c — no quality filtering (test/spam rows included verbatim)

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
    """D-12: After backfill, activity_log has three nullable FKs.

    activity_log gains customer_id, job_id, and inquiry_id columns alongside
    the existing lead_id (which is deprecated but retained for backward
    compatibility). Existing rows have customer_id populated where from_number
    was non-NULL.
    """
    pass


@pytest.mark.skip(reason="Plan 02: 053a not yet applied")
def test_customer_count_matches_audit():
    """D-05 / D-13b: Post-backfill customers count matches pre-audit prediction.

    SELECT COUNT(*) FROM customers should equal the expected_customers count
    produced by 053_pre_audit.sql:
      SELECT COUNT(*) FROM (
        SELECT DISTINCT tenant_id, from_number FROM leads
        WHERE from_number IS NOT NULL
      ) s;

    This equality confirms D-13b duplicate-phone collapse happened correctly —
    N leads sharing (tenant_id, from_number) produce exactly 1 customer row.
    """
    pass


@pytest.mark.skip(reason="Plan 02: 053a not yet applied")
def test_orphan_leads_become_inquiries_status_preserved():
    """D-13a: Orphan leads (appointment_id IS NULL) backfill into inquiries
    with status preserved verbatim.

    For every distinct status value S observed in legacy leads
    (open, contacted, qualified, converted, lost, spam, etc.):

        COUNT(*) FROM leads WHERE appointment_id IS NULL AND status = S
      ==
        COUNT(*) FROM inquiries WHERE status = S

    No status value is dropped, coerced, or renamed during backfill.
    Run against the per-status breakdown from 053_pre_audit.sql
    (`orphan_leads_by_status`) for row-count equality.
    """
    pass


@pytest.mark.skip(reason="Plan 02: 053a not yet applied")
def test_duplicate_phone_collapse_uses_most_recent_lead():
    """D-13b: When multiple leads share (tenant_id, from_number), backfill
    collapses them to a single customer row whose name and address come
    from the MOST RECENT lead (ORDER BY created_at DESC LIMIT 1).

    For each duplicate-phone group G identified by 053_pre_audit.sql:
      - Exactly one customers row exists for (G.tenant_id, G.from_number)
      - customers.name == (SELECT caller_name FROM leads
                            WHERE tenant_id = G.tenant_id
                              AND from_number = G.from_number
                            ORDER BY created_at DESC LIMIT 1)
      - Same equality for address fields
      - All child rows (customer_calls, jobs, inquiries, invoices) from
        every lead in the group now point to that single customer.id
    """
    pass


@pytest.mark.skip(reason="Plan 02: 053a not yet applied")
def test_no_quality_filtering_applied():
    """D-13c: Backfill processes every lead row verbatim — no filtering
    on test/spam/low-quality data.

    COUNT(*) FROM leads WHERE from_number IS NOT NULL
      ==
    SUM over customers of (count of source leads per customer)

    Equivalently: every non-NULL-phone lead ends up linked to exactly one
    customer — nothing is silently dropped. Owner deletes test customers
    post-cutover via the dashboard, not during migration.
    """
    pass


@pytest.mark.skip(reason="Plan 02: 053a not yet applied")
def test_job_count_matches_booked_leads():
    """D-06 / D-13a complement: leads with appointment_id IS NOT NULL
    backfill into jobs (expected_jobs count from audit), with the rest
    going to inquiries (expected_inquiries count from audit).
    """
    pass

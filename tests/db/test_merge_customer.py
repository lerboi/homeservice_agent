"""
Scaffold tests for merge_customer and unmerge_customer RPCs (Plan 03).

Decision ID validated: D-19 (merge/unmerge customer records).

All tests are skipped until Plan 03 creates the RPCs.
"""
import pytest


@pytest.mark.skip(reason="Plan 03: merge RPC not yet created")
def test_merge_repoints_children():
    """D-19: merge_customer repoints all child records from source to target.

    After merge_customer(source_id, target_id), all rows in jobs, inquiries,
    activity_log, and invoices that reference source_id are updated to
    reference target_id. The source customer row is soft-deleted.
    """
    pass


@pytest.mark.skip(reason="Plan 03: unmerge RPC not yet created")
def test_undo_within_7_days():
    """D-19: unmerge_customer restores the original state within 7 days.

    Within 7 days of a merge, unmerge_customer(merge_event_id) reverts all
    child-record repointing and restores the source customer row to active
    status. After 7 days the undo window is closed.
    """
    pass

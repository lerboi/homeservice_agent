# Deferred Items — Phase 39

Items discovered during Phase 39 execution that are out-of-scope for the current task
but should be cleaned up in a follow-up cleanup phase.

## Pre-existing Gaps

### `.claude/skills/auth-database-multitenancy/SKILL.md` migration list stale

**Discovered during:** Plan 39-02 execution
**Gap:** The skill's migration list (lines ~74-109) jumps from 036 to 042. Missing entries
for migrations 037-041 that already exist on disk:

- `037_fix_overage_off_by_one.sql`
- `038_schema_hardening_2.sql`
- `039_lock_increment_calls_used.sql`
- `040_call_recordings_storage_policy.sql`
- `041_calls_realtime.sql`

**Why not fixed now:** Pre-existing condition, not caused by Plan 39-02's changes
(Plan 39-02 only introduces migration 042). Per GSD scope boundary rule, out-of-scope
auto-fixes are logged here, not silently fixed.

**Recommendation:** A future documentation cleanup phase should backfill the skill's
migration list for 037-041.

## Environmental Conflicts Resolved Inline

### Untracked `042_appointments_realtime.sql` renamed to `043_appointments_realtime.sql`

**Discovered during:** Plan 39-02 Task 1
**Issue:** The plan (per RESEARCH.md §7) assumed migration slot 042 was free. At
execution time, an untracked local file `042_appointments_realtime.sql` already
occupied the slot (not committed, not referenced by any planning doc — appears to be
in-progress calendar realtime work).
**Fix:** Renamed the untracked file to `043_appointments_realtime.sql` so the plan's
frozen interface `042_call_routing_schema.sql` (referenced by 9+ planning docs,
RESEARCH §7, CONTEXT D-18, ROUTE-01 traceability, 39-07 skill update) can be honored
without contradiction.
**Scope of rename:** Filesystem only. The file had no git history (untracked) and had
not been applied to any Supabase environment, so renumbering has zero DB side effects.
**Commit:** Tracked as part of Plan 39-02's task commit (the rename is committed
alongside the new migration).

---
phase: 46-vip-caller-direct-routing
plan: "02"
subsystem: livekit-agent-webhook
tags: [vip-routing, webhook, python, testing]
dependency_graph:
  requires: [46-01]
  provides: [VIP-06, VIP-07, VIP-08]
  affects: [livekit-agent/src/webhook/twilio_routes.py, livekit-agent/tests/webhook/test_routes.py]
tech_stack:
  added: []
  patterns: [fail-open error handling, asyncio.to_thread for sync supabase-py, per-table mock dispatch]
key_files:
  created: []
  modified:
    - livekit-agent/src/webhook/twilio_routes.py
    - livekit-agent/tests/webhook/test_routes.py
decisions:
  - "VIP check uses two-source lookup (vip_numbers JSONB on tenant + leads is_vip=true), checking tenant row first (no DB hit) then querying leads"
  - "VIP check inserted at step 2.5 — after subscription check, before evaluate_schedule — so subscription gates VIP but schedule does not"
  - "VIP match without pickup_numbers falls through to AI (fail-open) rather than erroring"
  - "_make_tenant_mock updated to route leads table to empty response to prevent false VIP matches in existing Phase 40 tests (Rule 1 auto-fix)"
metrics:
  duration_minutes: 3
  completed_date: "2026-04-12"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 46 Plan 02: VIP Caller Webhook Routing Summary

VIP caller bypass implemented in livekit-agent webhook — `_is_vip_caller` two-source lookup (tenant `vip_numbers` JSONB + `leads.is_vip=true`) inserted between subscription check and `evaluate_schedule` in `incoming_call`, reusing existing `_owner_pickup_twiml` and `_insert_owner_pickup_call`.

## What Was Built

### Task 1: _is_vip_caller function and VIP check (livekit-agent)

**File:** `livekit-agent/src/webhook/twilio_routes.py`

Three changes made:

1. **Tenant lookup SELECT extended** — added `vip_numbers` between `dial_timeout_seconds` and `subscriptions(status)` so standalone VIP numbers are available in memory without an extra DB query.

2. **`_is_vip_caller` async function added** — placed above `incoming_call` alongside other helpers. Checks two sources in order:
   - Source 1: `tenant.get("vip_numbers")` — no DB hit, O(n) scan of JSONB array
   - Source 2: Supabase query on `leads` table for `tenant_id + from_number + is_vip=true` — wrapped in `asyncio.to_thread` for the sync supabase-py client, with try/except returning `False` on error (fail-open)

3. **VIP check block inserted at step 2.5** — between subscription check exception handler and `evaluate_schedule()` call. When `_is_vip_caller` returns True:
   - If `pickup_numbers` exist: calls `_insert_owner_pickup_call` then returns `_owner_pickup_twiml` (same path as schedule-based owner pickup)
   - If no `pickup_numbers`: logs warning, falls through to AI TwiML
   - Entire block wrapped in try/except with fail-open warning log

**Commit:** `ece3e8e`

### Task 2: VIP routing pytest tests

**File:** `livekit-agent/tests/webhook/test_routes.py`

Added a `# ---------- Phase 46 — VIP caller routing tests ----------` section with:

- `_make_vip_supabase_mock` — new helper that routes `table()` calls per-table (tenants/leads/calls), enabling independent control of lead VIP query results
- `_patch_vip_routing` — parallel to `_patch_routing` for VIP test setup, accepts `vip_lead_found` parameter
- 5 new test functions covering all VIP routing behaviors

**Commit:** `39b251c`

## Test Results

```
57 passed, 0 failed, 2 warnings in 1.38s
```

Full webhook suite green: 8 caps + 28 routes (23 existing + 5 new VIP) + 17 schedule + 4 security.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `_make_tenant_mock` returned tenant data for ALL table calls including leads**

- **Found during:** Task 2 test run
- **Issue:** The existing `_make_tenant_mock` used `supabase.table.return_value = chain` which returned the same mock chain for every table name. When `_is_vip_caller` queried `table("leads")`, it got back the tenant row data — causing `bool(response.data)` to be `True` and falsely triggering VIP routing in all existing Phase 40 tests. `test_incoming_call_cap_breach` failed because the cap-breached call was being routed via VIP instead.
- **Fix:** Updated `_make_tenant_mock` to use `supabase.table.side_effect` dispatching `"leads"` to an empty-data chain and all other tables to the existing `chain`. Set `supabase.table.return_value = chain` for backward compatibility with `test_owner_pickup_inserts_calls_row` which reads `mock_sb.table.return_value.insert`.
- **Files modified:** `livekit-agent/tests/webhook/test_routes.py`
- **Commit:** `39b251c`

## Known Stubs

None — all routing logic is fully wired. VIP check calls real `_is_vip_caller` which queries real supabase (mocked in tests). `vip_numbers` column must exist on `tenants` table (created in Plan 46-01 migration) for production routing to work.

## Self-Check: PASSED

- livekit-agent/src/webhook/twilio_routes.py: FOUND
- livekit-agent/tests/webhook/test_routes.py: FOUND
- .planning/phases/46-vip-caller-direct-routing/46-02-SUMMARY.md: FOUND
- Commit ece3e8e (feat 46-02 twilio_routes): FOUND
- Commit 39b251c (test 46-02 test_routes): FOUND
- 57 webhook tests passing (verified above)

---
phase: 23
plan: 01
subsystem: billing/usage-tracking
tags: [usage-tracking, billing, postgres-rpc, idempotency, tdd]
dependency_graph:
  requires: [22-billing-foundation]
  provides: [usage-events-table, increment_calls_used-rpc, per-call-usage-tracking]
  affects: [25-enforcement, call-processor-pipeline]
tech_stack:
  added: [usage_events table, increment_calls_used RPC]
  patterns: [TDD RED-GREEN, postgres-on-conflict-idempotency, atomic-update, error-resilient-rpc]
key_files:
  created:
    - supabase/migrations/013_usage_events.sql
    - tests/billing/usage-tracking.test.js
  modified:
    - src/lib/call-processor.js
    - .claude/skills/auth-database-multitenancy/SKILL.md
    - .claude/skills/voice-call-architecture/SKILL.md
decisions:
  - "Migration renumbered 012→013 (012_admin_users.sql already occupied that slot — Phase 28)"
  - "No SECURITY DEFINER on increment_calls_used — service_role client bypasses RLS automatically (per RESEARCH.md)"
  - "Duration computed from raw timestamps, not duration_seconds generated column (not returned by upsert)"
  - "try/catch wraps entire usage block — billing counter glitch must never lose call data (D-06)"
metrics:
  duration: 566s
  completed_date: "2026-03-26"
  tasks_completed: 3
  files_changed: 5
---

# Phase 23 Plan 01: Usage Tracking Summary

**One-liner**: Atomic per-call usage counting via `increment_calls_used` Postgres RPC with `usage_events` call_id idempotency guard, integrated into `processCallEnded()` with 10-second duration filter and test call exclusion.

---

## What Was Built

### Migration 013: usage_events + increment_calls_used RPC

`supabase/migrations/013_usage_events.sql` creates:

1. **`usage_events` table** — Minimal idempotency table with `call_id` (text PK), `tenant_id` (FK → tenants), `created_at`. Service_role-only RLS (no authenticated user access). Index on `tenant_id`.

2. **`increment_calls_used(p_tenant_id uuid, p_call_id text)` RPC** — Returns `TABLE(success, calls_used, calls_limit, limit_exceeded)`. Flow:
   - INSERT usage_events with `ON CONFLICT (call_id) DO NOTHING`
   - If `NOT FOUND` (duplicate): return current subscription state, `success=false`, no increment
   - Atomic `UPDATE subscriptions SET calls_used = calls_used + 1` — Postgres guarantees atomicity
   - No active subscription: return `(false, 0, 0, false)`
   - No SECURITY DEFINER — service_role client used by webhook handlers bypasses RLS

### src/lib/call-processor.js — Usage Tracking Block

Added after the `isTestCall` block (before function close):

```javascript
const durationSeconds = (end_timestamp && start_timestamp)
  ? Math.round((end_timestamp - start_timestamp) / 1000)
  : 0;

if (!isTestCall && durationSeconds >= 10 && tenantId) {
  try {
    const { data: usageResult, error: usageError } = await supabase.rpc(
      'increment_calls_used',
      { p_tenant_id: tenantId, p_call_id: call_id }
    );
    // error logging + result logging
  } catch (err) {
    console.error('[usage] increment failed (non-fatal):', err);
  }
}
```

Filters applied before RPC: `!isTestCall AND durationSeconds >= 10 AND tenantId`.

### Tests — 14 passing

`tests/billing/usage-tracking.test.js` covers:
- RPC called with correct params for qualifying call
- Duplicate `success=false` handled without error
- No-subscription `success=false` handled without error
- `handleInvoicePaid` resets `calls_used` only for `subscription_cycle`
- Duration filter: < 10s → no RPC call
- Test call filter: metadata.test_call='true' → no RPC call
- Test call via retell_llm_dynamic_variables → no RPC call
- Happy path (>= 10s, real call) → RPC called
- RPC error response → no throw
- RPC throws → no throw
- No tenant → no RPC call
- Exactly 10s (boundary) → RPC called
- 9s (just below) → no RPC call

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Migration renumbered 012→013**
- **Found during**: Task 1 pre-implementation check
- **Issue**: Plan specified `012_usage_events.sql` but `012_admin_users.sql` already exists (created in Phase 28-01). Using 012 would overwrite or conflict with existing migration.
- **Fix**: Created `013_usage_events.sql` instead. Both skill files updated to reflect 013.
- **Files modified**: `supabase/migrations/013_usage_events.sql`, both SKILL.md files
- **Commit**: 7518212

---

## Known Stubs

None — all behaviors are fully implemented. The RPC return value's `limit_exceeded` field is logged but not yet enforced (enforcement is Phase 25 by design — this phase is tracking only).

---

## Verification

- [x] `supabase/migrations/013_usage_events.sql` — usage_events table, RLS, increment_calls_used RPC with idempotency guard
- [x] `src/lib/call-processor.js` — usage increment block with durationSeconds >= 10, !isTestCall, tenantId guard
- [x] All 14 tests pass: `npm test -- tests/billing/usage-tracking.test.js`
- [x] USAGE-03 verified by test (handleInvoicePaid resets calls_used — already implemented in Phase 22)
- [x] Both skill files updated per CLAUDE.md "keep skills in sync" rule

## Self-Check: PASSED

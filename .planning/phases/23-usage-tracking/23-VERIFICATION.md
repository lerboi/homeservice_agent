---
phase: 23-usage-tracking
verified: 2026-03-26T00:00:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 23: Usage Tracking Verification Report

**Phase Goal:** Every completed call increments the tenant's usage counter exactly once — atomic, idempotent, and reset precisely on billing cycle rollover — so enforcement in the next phase can trust the counter as a reliable source of truth
**Verified:** 2026-03-26
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A completed call >= 10 seconds increments calls_used by exactly 1; call < 10s or test call produces no increment | VERIFIED | `call-processor.js` lines 111-138: `durationSeconds >= 10 && !isTestCall && tenantId` guard before `supabase.rpc('increment_calls_used',...)`; Tests 5, 6, 6b, 7 all pass |
| 2 | Duplicate call_ended webhook (same call_id) results in calls_used incrementing by 1, not 2 | VERIFIED | `013_usage_events.sql` lines 48-50: `INSERT INTO usage_events ... ON CONFLICT (call_id) DO NOTHING` + `IF NOT FOUND` guard returns `success=false` without UPDATE; Test 2 (USAGE-02) passes |
| 3 | After invoice.paid with billing_reason = subscription_cycle, calls_used resets to 0 — no cron, no midnight trigger | VERIFIED | `stripe/webhook/route.js` lines 332-352: `handleInvoicePaid` guards on `billing_reason !== 'subscription_cycle'` then calls `.update({ calls_used: 0 })`; Tests 4a and 4b pass |
| 4 | Two calls completing simultaneously increment calls_used by exactly 2 — no race condition | VERIFIED | `013_usage_events.sql` line 66: `SET calls_used = calls_used + 1` is a single atomic SQL UPDATE statement — Postgres guarantees read-modify-write atomicity within a transaction; no application-level race possible |
| 5 | A duplicate call_id via RPC is rejected by idempotency guard without incrementing | VERIFIED | `usage_events` table `call_id text PRIMARY KEY` + `ON CONFLICT (call_id) DO NOTHING` + `IF NOT FOUND` branch returns `success=false`; Test 2 verifies JS caller handles this path without error |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/013_usage_events.sql` | usage_events table and increment_calls_used RPC | VERIFIED | File exists, 81 lines. Contains `CREATE TABLE usage_events`, `call_id text PRIMARY KEY`, `ON CONFLICT (call_id) DO NOTHING`, `IF NOT FOUND`, `calls_used = calls_used + 1`, `service_role_all_usage_events` RLS policy. No SECURITY DEFINER (correct per RESEARCH.md). Note: PLAN specified 012 but executor correctly renumbered to 013 because 012_admin_users.sql was already occupied. |
| `src/lib/call-processor.js` | Usage increment integration in processCallEnded | VERIFIED | File exists, 411 lines. Lines 107-138 contain the usage tracking block with `durationSeconds` computation, `!isTestCall && durationSeconds >= 10 && tenantId` guard, `supabase.rpc('increment_calls_used', { p_tenant_id: tenantId, p_call_id: call_id })`, and try/catch error resilience. |
| `tests/billing/usage-tracking.test.js` | Unit tests for all usage tracking behaviors | VERIFIED | File exists, 462 lines. Contains 14 tests covering: RPC called with correct params, success=false (duplicate) handled gracefully, no-subscription result handled, billing cycle reset, duration filter (5s), test call filter (metadata.test_call), test call filter (retell_llm_dynamic_variables), happy path (15s), RPC error response (no throw), RPC throw (no throw), no tenant (no RPC call), exactly 10s boundary, 9s below threshold. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/call-processor.js` | `supabase/migrations/013_usage_events.sql` | `supabase.rpc('increment_calls_used', ...)` | WIRED | Line 117-120: `await supabase.rpc('increment_calls_used', { p_tenant_id: tenantId, p_call_id: call_id })` — parameter names match RPC signature exactly |
| `src/app/api/webhooks/retell/route.js` | `src/lib/call-processor.js` | `after()` callback calling `processCallEnded` | WIRED | Lines 32-36: `if (event === 'call_ended') { after(async () => { await processCallEnded(payload.call); }); }` — imported at line 5 |
| `src/app/api/stripe/webhook/route.js` | subscriptions table | `handleInvoicePaid` resets `calls_used` | WIRED | Lines 332-352: `handleInvoicePaid` function called at line 164 on `invoice.paid` event; updates `calls_used: 0` where `stripe_subscription_id` matches and `is_current = true` |

---

### Data-Flow Trace (Level 4)

Not applicable for this phase. The artifacts are an RPC function, a webhook integration module, and a test suite — not UI components that render dynamic data. The data flow is: Retell webhook -> `processCallEnded` -> `increment_calls_used` RPC -> `subscriptions.calls_used` increment. This is a write path, not a read/render path.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 14 unit tests pass | `npm test -- tests/billing/usage-tracking.test.js` | 14 passed, 0 failed, 1.089s | PASS |
| `call-processor.js` contains RPC call pattern | grep `increment_calls_used` | Found at line 118 | PASS |
| Migration contains idempotency guard | grep `ON CONFLICT (call_id) DO NOTHING` | Found at line 50 | PASS |
| Migration contains atomic increment | grep `calls_used = calls_used + 1` | Found at line 66 | PASS |
| `handleInvoicePaid` guards on `billing_reason` | grep `billing_reason !== 'subscription_cycle'` | Found at line 333 | PASS |
| `after()` wiring in Retell webhook handler | grep `processCallEnded` in retell route | Found at line 34 | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| USAGE-01 | 23-01-PLAN.md | Per-call usage increment via atomic Postgres RPC on call_ended webhook — minimum 10-second duration filter, test call exclusion | SATISFIED | `increment_calls_used` RPC in `013_usage_events.sql` with atomic `UPDATE ... SET calls_used = calls_used + 1`; `call-processor.js` guards on `!isTestCall && durationSeconds >= 10 && tenantId`; Tests 1, 5, 6, 7 pass |
| USAGE-02 | 23-01-PLAN.md | Usage events row inserted per call with call_id as idempotency key — prevents double-counting from webhook retries | SATISFIED | `usage_events` table with `call_id text PRIMARY KEY` + `ON CONFLICT (call_id) DO NOTHING` + `IF NOT FOUND` returns `success=false` without increment; Test 2 pass |
| USAGE-03 | 23-01-PLAN.md | calls_used reset to 0 triggered by invoice.paid webhook with billing_reason = subscription_cycle — not a cron job | SATISFIED | `handleInvoicePaid` in `stripe/webhook/route.js` guards on `billing_reason !== 'subscription_cycle'` and performs `.update({ calls_used: 0 })`; invoked at line 164 only on `invoice.paid` event; Tests 4a and 4b pass |

**Orphaned requirements check:** REQUIREMENTS.md maps USAGE-01, USAGE-02, USAGE-03 to Phase 23 — all three are claimed by 23-01-PLAN.md. No orphaned requirements.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `tests/billing/usage-tracking.test.js` | 214-295 | Test 4 (USAGE-03) tests a locally-defined replica of `handleInvoicePaid` rather than importing and testing the real function in `stripe/webhook/route.js` | INFO | The test verifies the logic contract is correct but does not guard against the real function being modified to use different field names or logic. The SUMMARY acknowledges this: "importing the stripe webhook route would require extensive mocking." Risk is low given the real function is 20 lines and matches the replicated logic exactly. Not a blocker. |

No stub patterns, empty implementations, or placeholder content found in any phase artifact.

---

### Human Verification Required

None. All success criteria for this phase are programmatically verifiable and all automated checks passed.

The one item that technically cannot be verified in isolation is the concurrent-increment atomicity guarantee (SC-4 / Truth 4). The SQL design (`calls_used = calls_used + 1` as a single UPDATE) is inherently atomic in Postgres — it does not require application-level locking. This is a well-established Postgres property and the VALIDATION.md documents it as "Manual-Only Verification: guaranteed by Postgres atomicity on single UPDATE statements; no Jest-level concurrent DB test feasible." This is architecturally sound and needs no further verification.

---

## Summary

Phase 23 fully achieved its goal. All five observable truths are verified:

1. **Duration and test-call filtering** — the `!isTestCall && durationSeconds >= 10 && tenantId` guard in `call-processor.js` is correctly placed after the test-call cancellation block, uses raw timestamps (not the generated column), and the 10-second boundary is inclusive (`>=`). 14 tests with boundary cases confirm this.

2. **Idempotency** — the `usage_events` table's `call_id PRIMARY KEY` with `ON CONFLICT (call_id) DO NOTHING` combined with the `IF NOT FOUND` Postgres branch form a complete idempotency guard. Duplicate webhooks increment `calls_used` by 0, not 1.

3. **Billing cycle reset** — `handleInvoicePaid` in the Stripe webhook handler is the sole reset trigger. It is guarded on `billing_reason = 'subscription_cycle'`. No cron job, no midnight timer, no other trigger.

4. **Concurrent atomicity** — `UPDATE subscriptions SET calls_used = calls_used + 1 WHERE ...` is a single SQL statement. Postgres serializes concurrent updates to the same row; two simultaneous calls will each add exactly 1.

5. **Error resilience** — the entire usage block in `processCallEnded` is wrapped in try/catch. RPC errors and network failures are logged but never re-thrown, so a billing counter glitch cannot lose call data.

The one deviation from the PLAN — renumbering migration 012→013 because 012_admin_users.sql was already occupied — was handled correctly and both skill files were updated to reflect 013.

---

_Verified: 2026-03-26_
_Verifier: Claude (gsd-verifier)_

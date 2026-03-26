# Phase 23: Usage Tracking - Research

**Researched:** 2026-03-26
**Domain:** Atomic per-call usage counting — Postgres RPC, idempotency table, billing cycle reset
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Usage increment happens inside `processCallEnded()` in `src/lib/call-processor.js`, after the call record upsert. Runs async via `after()` — fire-and-forget counting, not blocking the Retell webhook response.

**D-02:** Minimum 10-second duration filter is a JS if-guard in `processCallEnded()` before calling the RPC. Skip the RPC entirely for short calls. Easy to adjust threshold later.

**D-03:** Test calls identified via Retell webhook payload metadata (`test_call === 'true'` or `retell_llm_dynamic_variables.test_call === 'true'`). Check in `processCallEnded()` before incrementing — no RPC call for test calls.

**D-04:** Minimal `usage_events` table: `call_id` (idempotency key), `tenant_id`, `created_at`. Its job is idempotency, not data storage. Rich call data lives on the `calls` table — join via `call_id` when needed.

**D-05:** Usage event rows kept forever. Rows are tiny (3 columns), storage is negligible even at 400 calls/month/tenant. No cleanup job needed.

**D-06:** If the increment RPC fails (DB error, timeout), the call is still recorded normally. Recording, transcript, lead creation, and notifications proceed regardless. Log the increment failure for manual reconciliation.

**D-07:** Calls spanning a billing cycle reset count toward the new cycle. The increment fires at `call_ended` time, landing in the new period. Simple, no special logic, slightly benefits the tenant.

**D-08:** The RPC returns `{ success, calls_used, calls_limit, limit_exceeded }`. Enables logging and future enforcement (Phase 25) without another query. `processCallEnded()` logs the result but does not block or reject the call.

### Claude's Discretion

- RPC function name and exact Postgres implementation (e.g., `increment_calls_used`)
- Whether the RPC uses `FOR UPDATE` row locking or relies on atomic `SET calls_used = calls_used + 1`
- Billing cycle boundary handling: count toward new cycle (D-07)
- Exact error logging format for failed increments

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| USAGE-01 | Per-call usage increment via atomic Postgres RPC (`increment_calls_used`) on `call_ended` webhook — minimum 10-second duration filter, test call exclusion | RPC pattern verified against existing `assign_sg_number` RPC; `processCallEnded()` integration point confirmed at line 73; `isTestCall` check already present at line 78 |
| USAGE-02 | Usage events row inserted per call with `call_id` as idempotency key — prevents double-counting from webhook retries | `stripe_webhook_events` idempotency pattern already in codebase (migration 010); same `ON CONFLICT DO NOTHING` pattern applies directly |
| USAGE-03 | `calls_used` reset to 0 triggered by `invoice.paid` webhook with `billing_reason = subscription_cycle` — not a cron job | `handleInvoicePaid()` already resets `calls_used` to 0 (line 332–351, stripe/webhook/route.js); Phase 23 does NOT modify this |
</phase_requirements>

---

## Summary

Phase 23 has three deliverables: a new Postgres migration adding the `usage_events` table and the `increment_calls_used` RPC, a 12-line modification to `processCallEnded()` in `src/lib/call-processor.js`, and a test suite covering the four key behaviors (increment fires once, idempotency blocks doubles, short calls skipped, test calls skipped).

All architecture decisions are locked in CONTEXT.md. The billing cycle reset (USAGE-03) is already implemented in `handleInvoicePaid()` — Phase 23 only needs to verify it and ensure it is not accidentally broken. The `calls` table already has a `duration_seconds` GENERATED column, but it is computed from bigint timestamps; the duration check in `processCallEnded()` must compute duration directly from `start_timestamp` and `end_timestamp` because the generated column is not returned by the call record upsert.

The highest-risk element is the race condition between two concurrent `call_ended` webhooks. The correct mitigation is a single atomic `UPDATE ... SET calls_used = calls_used + 1 WHERE is_current = true` inside the RPC — no advisory lock, no `SELECT FOR UPDATE` on the subscriptions row. Postgres integer addition is atomic at the statement level. The `usage_events` idempotency insert (`ON CONFLICT (call_id) DO NOTHING`) provides the second guard for webhook retries.

**Primary recommendation:** Implement the RPC as a single atomic UPDATE with RETURNING, wrap the JS caller in try/catch that logs failures without rethrowing, and insert into `usage_events` inside the same RPC function using `INSERT ... ON CONFLICT DO NOTHING` to ensure the idempotency check and counter increment are a single database round-trip.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.99.2 (installed) | Supabase RPC calls and table inserts | Already in project; service-role client in `src/lib/supabase.js` |
| Postgres plpgsql | built-in | `increment_calls_used` RPC function | All existing atomic operations (`assign_sg_number`) use the same pattern |

### Supporting

No new packages needed. This phase is pure SQL migration + JS modification.

**Version verification:** All packages already installed. No new installs required for this phase.

---

## Architecture Patterns

### Recommended Project Structure

```
supabase/migrations/
└── 012_usage_events.sql          # NEW: usage_events table + increment_calls_used RPC

src/lib/
└── call-processor.js             # MODIFY: add usage increment after call upsert (line 73)

tests/billing/
└── usage-tracking.test.js        # NEW: Wave 0 test file (does not exist yet)
```

Note: Migration numbering — `011_country_provisioning.sql` exists, so next is `012_usage_events.sql`.

### Pattern 1: Atomic Postgres RPC with Idempotency

**What:** Single RPC function that atomically increments `calls_used`, inserts the `usage_events` idempotency row, and returns updated counter state — all in one database round-trip.

**When to use:** Any counter that must survive concurrent webhook delivery and Retell retry scenarios.

**Example:**
```sql
-- Source: Postgres plpgsql docs + assign_sg_number pattern in 011_country_provisioning.sql
CREATE OR REPLACE FUNCTION increment_calls_used(
  p_tenant_id  uuid,
  p_call_id    text
)
RETURNS TABLE(
  success        boolean,
  calls_used     int,
  calls_limit    int,
  limit_exceeded boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_calls_used   int;
  v_calls_limit  int;
BEGIN
  -- Idempotency guard: if this call_id was already counted, skip the increment
  -- and return the current counter state without error.
  INSERT INTO usage_events (call_id, tenant_id)
  VALUES (p_call_id, p_tenant_id)
  ON CONFLICT (call_id) DO NOTHING;

  -- If no row was inserted (conflict = already processed), return current state
  -- without touching calls_used.
  IF NOT FOUND THEN
    SELECT s.calls_used, s.calls_limit
    INTO v_calls_used, v_calls_limit
    FROM subscriptions s
    WHERE s.tenant_id = p_tenant_id AND s.is_current = true;

    RETURN QUERY SELECT false, v_calls_used, v_calls_limit,
      (v_calls_used >= v_calls_limit);
    RETURN;
  END IF;

  -- Atomic increment: single UPDATE statement, no race condition possible
  UPDATE subscriptions
  SET calls_used = calls_used + 1
  WHERE tenant_id = p_tenant_id AND is_current = true
  RETURNING calls_used, calls_limit
  INTO v_calls_used, v_calls_limit;

  IF v_calls_used IS NULL THEN
    -- No active subscription row — log and return gracefully
    RETURN QUERY SELECT false, 0, 0, false;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, v_calls_used, v_calls_limit,
    (v_calls_used >= v_calls_limit);
END;
$$;
```

### Pattern 2: JS Caller with Fire-and-Forget Error Handling

**What:** Call the RPC from `processCallEnded()` after the call record upsert; wrap in try/catch; log failures without rethrowing.

**When to use:** All async operations inside `after()` that must not block the webhook response.

**Example:**
```javascript
// Source: CONTEXT.md D-01, D-02, D-03, D-06, D-08
// Integration point: src/lib/call-processor.js, after line 73 (call record upsert)

// Duration filter (D-02): compute from raw timestamps, not the generated column
const durationSeconds = (end_timestamp && start_timestamp)
  ? Math.round((end_timestamp - start_timestamp) / 1000)
  : 0;

// Test call filter (D-03): reuse existing isTestCall variable already in scope
if (!isTestCall && durationSeconds >= 10 && tenantId) {
  try {
    const { data: usageResult, error: usageError } = await supabase.rpc(
      'increment_calls_used',
      { p_tenant_id: tenantId, p_call_id: call_id }
    );

    if (usageError) {
      console.error('[usage] increment_calls_used RPC error:', usageError);
    } else if (usageResult?.[0]) {
      const { success, calls_used, calls_limit, limit_exceeded } = usageResult[0];
      console.log(
        `[usage] tenant=${tenantId} call=${call_id} ` +
        `success=${success} used=${calls_used}/${calls_limit} ` +
        `limit_exceeded=${limit_exceeded}`
      );
    }
  } catch (err) {
    // D-06: billing counter glitch must never lose call data
    console.error('[usage] increment failed (non-fatal):', err);
  }
}
```

### Pattern 3: Migration Structure

**What:** Sequential migration file with table creation, RPC, and RLS.

**Example:**
```sql
-- Source: existing migration conventions (010_billing_schema.sql, 011_country_provisioning.sql)
-- Migration 012: Usage events (idempotency table + increment RPC)
-- Phase 23-01: usage-tracking

-- 1. usage_events table (D-04: minimal — idempotency key only)
CREATE TABLE usage_events (
  call_id    text PRIMARY KEY,   -- Retell call_id string as idempotency key
  tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_usage_events_tenant_id ON usage_events(tenant_id);

-- 2. RLS: service_role only — no authenticated user access
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_all_usage_events ON usage_events
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. increment_calls_used RPC (see pattern above)
```

### Anti-Patterns to Avoid

- **`SELECT ... FOR UPDATE` on the subscriptions row:** Unnecessary serialization. The `UPDATE ... SET calls_used = calls_used + 1` is atomic at the statement level. `FOR UPDATE` should only be added if calls routinely spike near the plan limit (Phase 25 can revisit). CONTEXT.md leaves this to Claude's Discretion; the simpler form is correct here.
- **Duration from `duration_seconds` generated column:** The generated column is not returned by the upsert in `processCallEnded()`. Compute duration directly from `(end_timestamp - start_timestamp) / 1000`. Timestamps are stored as bigint milliseconds (confirmed in migration 001).
- **Inserting into `usage_events` then calling a separate RPC:** Two round-trips instead of one. Do both inside the RPC for atomicity.
- **Rethrowing RPC errors:** Violates D-06. The increment failure must be logged, not thrown; call recording and notifications must not be blocked.
- **Adding `billing_period_start`/`billing_period_end` to `usage_events`:** The SUMMARY.md mentioned this but CONTEXT.md D-04 explicitly removes it as unnecessary duplication. Follow D-04.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Concurrent increment safety | Custom mutex, advisory lock, JS-level locking | Postgres `UPDATE ... SET x = x + 1` | Single-statement atomic update is the correct tool; application-level locks add complexity and fail on multi-instance deployments |
| Webhook deduplication | In-memory cache, Redis, request hash comparison | `usage_events.call_id` PRIMARY KEY with `ON CONFLICT DO NOTHING` | Database constraint survives process restarts and multi-instance webhook delivery |
| Billing cycle boundary detection | Cron job, datetime comparison | `invoice.paid` webhook with `billing_reason = 'subscription_cycle'` — already implemented | Already live in `handleInvoicePaid()`; any cron-based alternative drifts from actual Stripe billing date |

**Key insight:** The database is the right concurrency primitive here. Postgres atomicity handles races that application-level code cannot.

---

## Common Pitfalls

### Pitfall 1: Duration Computed from Wrong Source

**What goes wrong:** `processCallEnded()` attempts to read `duration_seconds` from the upsert result, gets `null`, skips the duration filter, and every call — including 2-second robocalls — gets counted.

**Why it happens:** `duration_seconds` is a GENERATED ALWAYS AS column. It is not writable and is not returned by a standard upsert unless `.select('duration_seconds')` is chained. The current upsert at line 59 has no `.select()` chain.

**How to avoid:** Compute duration from the raw `start_timestamp` and `end_timestamp` values in scope at the top of `processCallEnded()`. Both are available as bigint milliseconds before the upsert runs. Formula: `Math.round((end_timestamp - start_timestamp) / 1000)`.

**Warning signs:** All calls including short calls appear in `usage_events`. Usage counter grows by more than one call per real conversation.

---

### Pitfall 2: RPC Called Before Call Record Upsert Completes

**What goes wrong:** If the usage increment is placed before the `await supabase.from('calls').upsert(...)` call, the `usage_events` row is written but the call record may not exist yet. If the webhook retries and the call upsert succeeds but the usage insert was already deduplicated, the increment still fires correctly — but if the RPC is the first thing written, there is no tenant record to join against in the RPC if something queries across tables.

**Why it happens:** The integration comment says "after line 73" but the exact position matters.

**How to avoid:** Place the usage increment block after the entire call record upsert block (the closing `}`  of the `await supabase.from('calls').upsert(...)` call at line 73) and after the `isTestCall` block. The `tenantId` and `isTestCall` variables are both in scope at that point.

---

### Pitfall 3: `IF NOT FOUND` Logic Inverted in RPC

**What goes wrong:** `INSERT ... ON CONFLICT DO NOTHING` sets `FOUND = false` when the conflict fires (no rows inserted). If the `IF NOT FOUND` branch is written as "no subscription exists" rather than "already counted", the idempotency check logic is inverted and duplicate webhook deliveries increment the counter instead of skipping.

**Why it happens:** `IF NOT FOUND` after `INSERT ... ON CONFLICT DO NOTHING` is a well-known Postgres pattern but the semantics are easy to reverse.

**How to avoid:** Test the idempotency branch explicitly. In the test suite, call `increment_calls_used` twice with the same `call_id` and assert `calls_used` equals 1, not 2. The RPC structure above has the correct logic.

---

### Pitfall 4: No Subscription Row = Silent Failure

**What goes wrong:** A new tenant completes onboarding, receives their first call before the `customer.subscription.created` webhook arrives from Stripe, and `increment_calls_used` returns no rows from the `UPDATE` because `is_current = true` matches nothing. The call is not counted. If Phase 25 enforcement relies on this count, the tenant has a narrow window of free calls that were never recorded.

**Why it happens:** Phase 22 creates the subscription row synchronously during onboarding (`/api/onboarding/complete`), so this window should be ~0ms in normal operation. But if the onboarding API route fails silently before writing the subscription row, the gap exists.

**How to avoid:** The RPC handles this gracefully — `v_calls_used IS NULL` returns `{ success: false, ... }`. The JS caller logs the failure. No increment happens. This is the correct behavior: if there is no subscription, there is nothing to count against.

**Warning signs:** Log line `[usage] increment failed` appearing immediately after onboarding for a new tenant. Investigate whether the Phase 22 subscription creation ran successfully.

---

### Pitfall 5: Test Call Flag Missing from `processCallEnded()` Metadata

**What goes wrong:** The `isTestCall` check on line 78 reads `metadata?.test_call === 'true'`. If a test call is made from a path that does not include `test_call: 'true'` in Retell metadata (e.g., a manual Retell dashboard test), the call passes the test call filter and gets counted.

**Why it happens:** The test call flag is set by `src/app/api/onboarding/test-call/route.js` as a Retell dynamic variable. Calls made directly from the Retell dashboard have no such flag.

**How to avoid:** The 10-second duration filter (D-02) provides a second line of defense. Test calls from the onboarding wizard are typically short. For a production environment, document that manual Retell dashboard calls may be counted if they exceed 10 seconds. This is acceptable behavior.

---

## Code Examples

Verified patterns from existing codebase:

### `assign_sg_number` RPC Pattern (Existing Parallel)
```sql
-- Source: supabase/migrations/011_country_provisioning.sql lines 54-69
-- This is the canonical pattern for Supabase RPCs in this project.
-- SECURITY DEFINER is used when the RPC needs to bypass RLS.
-- RETURNS TABLE is the return pattern used — not RETURNS SETOF or RETURNS json.
CREATE OR REPLACE FUNCTION assign_sg_number(p_tenant_id uuid)
RETURNS TABLE(phone_number text) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  UPDATE phone_inventory
  SET status = 'assigned', assigned_tenant_id = p_tenant_id
  WHERE id = (
    SELECT pi.id FROM phone_inventory pi
    WHERE pi.country = 'SG' AND pi.status = 'available'
    ORDER BY pi.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING phone_inventory.phone_number;
END;
$$;
```

### Idempotency Pattern (Existing Parallel — stripe_webhook_events)
```javascript
// Source: src/app/api/stripe/webhook/route.js lines 132-145
// This is how the project already handles idempotency for Stripe webhooks.
// The usage_events pattern is identical but at the DB level via ON CONFLICT.
const { error: idempotencyError } = await supabase
  .from('stripe_webhook_events')
  .insert({ event_id: event.id, event_type: event.type });

if (idempotencyError?.code === '23505') {
  // Duplicate event — already processed
  return Response.json({ received: true });
}
```

### Supabase RPC Call Pattern
```javascript
// Source: src/app/api/stripe/webhook/route.js lines 28-43
// Existing pattern for calling Supabase RPCs with the service-role client.
const { data, error } = await supabase.rpc('assign_sg_number', {
  p_tenant_id: tenantId,
});
// data is an array of rows (RETURNS TABLE pattern)
if (!data || data.length === 0) { /* handle no result */ }
```

### `processCallEnded()` Integration Point
```javascript
// Source: src/lib/call-processor.js lines 37-106
// The upsert completes at line 73. The isTestCall block runs lines 78-105.
// Usage increment belongs after line 105 (closing brace of the isTestCall block).
// Both tenantId (line 56) and isTestCall (line 78) are in scope.
// start_timestamp and end_timestamp are destructured at line 44.
```

### `handleInvoicePaid()` — Already Implemented (USAGE-03)
```javascript
// Source: src/app/api/stripe/webhook/route.js lines 332-352
// This function already handles USAGE-03. Phase 23 must NOT modify it.
// Only write a test that verifies it fires on billing_reason = 'subscription_cycle'.
async function handleInvoicePaid(invoice) {
  if (invoice.billing_reason !== 'subscription_cycle') {
    return; // Only reset on cycle renewals
  }
  const { error } = await supabase
    .from('subscriptions')
    .update({ calls_used: 0 })
    .eq('stripe_subscription_id', subscriptionId)
    .eq('is_current', true);
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Stripe usage records API | Stripe Billing Meters v2 | Deprecated in Stripe API 2025-03-31.basil | Not relevant here — Phase 23 uses local DB counter, not Stripe metered billing |
| Per-call RPC call + separate idempotency insert | Combined idempotency + increment in single RPC | Best practice from Phase 27 (assign_sg_number pattern) | Single round-trip; no partial failure window between the two writes |

---

## Open Questions

1. **`SECURITY DEFINER` required on RPC?**
   - What we know: `assign_sg_number` uses `SECURITY DEFINER` to bypass RLS on `phone_inventory`. The `subscriptions` table has a service_role policy that grants full access.
   - What's unclear: The `supabase` client in `call-processor.js` already uses the service role key (`SUPABASE_SERVICE_ROLE_KEY`). The RPC will run as the service role. `SECURITY DEFINER` may not be required.
   - Recommendation: Omit `SECURITY DEFINER` initially. The service-role client bypasses RLS automatically. Add it only if the RPC fails with an RLS permission error during testing.

2. **`IF NOT FOUND` after `INSERT ON CONFLICT` in plpgsql**
   - What we know: In plpgsql, `FOUND` is set to `true` if the preceding command affected at least one row. `INSERT ... ON CONFLICT DO NOTHING` sets `FOUND = false` when the conflict fires.
   - Recommendation: Test this branch explicitly in the test suite to confirm Postgres behavior in the project's Supabase version.

---

## Environment Availability

Step 2.6: SKIPPED — this phase makes no changes to external infrastructure. All changes are SQL migrations and a JS file modification. Postgres (Supabase) and Node.js are verified running (Node v22.16.0 confirmed).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 29.7.0 |
| Config file | `package.json` scripts: `"test": "node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --passWithNoTests"` |
| Quick run command | `npm test -- tests/billing/usage-tracking.test.js` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| USAGE-01 | Completed call (>=10s, not test) increments `calls_used` exactly once | unit | `npm test -- tests/billing/usage-tracking.test.js` | No — Wave 0 |
| USAGE-01 | Call under 10s does NOT call the RPC | unit | `npm test -- tests/billing/usage-tracking.test.js` | No — Wave 0 |
| USAGE-01 | Test call (metadata.test_call=true) does NOT call the RPC | unit | `npm test -- tests/billing/usage-tracking.test.js` | No — Wave 0 |
| USAGE-02 | Second `call_ended` with same `call_id` does NOT increment (idempotency) | unit | `npm test -- tests/billing/usage-tracking.test.js` | No — Wave 0 |
| USAGE-02 | Two concurrent calls increment by exactly 2 (race condition) | integration | `npm test:integration -- tests/integration/usage-concurrency.test.js` | No — Wave 0 |
| USAGE-03 | `handleInvoicePaid()` with `billing_reason=subscription_cycle` sets `calls_used=0` | unit | `npm test -- tests/billing/usage-tracking.test.js` | No — Wave 0 |
| USAGE-03 | `handleInvoicePaid()` with other `billing_reason` does NOT reset | unit | `npm test -- tests/billing/usage-tracking.test.js` | No — Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test -- tests/billing/usage-tracking.test.js`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/billing/usage-tracking.test.js` — covers USAGE-01, USAGE-02, USAGE-03 unit behaviors
- [ ] `tests/integration/usage-concurrency.test.js` — covers USAGE-02 concurrent increment (may require real Supabase connection; flag as manual if integration DB not available)

*(Existing test infrastructure — Jest + `jest.unstable_mockModule` — covers all unit test requirements. No new framework install needed.)*

---

## Sources

### Primary (HIGH confidence)

- Existing codebase — `src/lib/call-processor.js` (integration point verified line-by-line)
- Existing codebase — `supabase/migrations/010_billing_schema.sql` (subscriptions table schema)
- Existing codebase — `supabase/migrations/011_country_provisioning.sql` (RPC pattern)
- Existing codebase — `src/app/api/stripe/webhook/route.js` (idempotency pattern, `handleInvoicePaid`)
- Existing codebase — `supabase/migrations/001_initial_schema.sql` (`duration_seconds` generated column, bigint timestamps)
- `.planning/phases/23-usage-tracking/23-CONTEXT.md` (all locked decisions)
- `.planning/research/SUMMARY.md` — v3.0 architecture decisions

### Secondary (MEDIUM confidence)

- `.planning/research/PITFALLS.md` — Pitfall 1 (webhook idempotency), Pitfall 4 (race condition) — verified against codebase

### Tertiary (LOW confidence)

- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all patterns verified against existing codebase
- Architecture: HIGH — integration point identified by exact file and line numbers; RPC pattern copied from existing production migration
- Pitfalls: HIGH — all pitfalls derived from reading the actual code, not assumptions

**Research date:** 2026-03-26
**Valid until:** 2026-05-26 (stable patterns; only invalidated if Supabase plpgsql semantics change)

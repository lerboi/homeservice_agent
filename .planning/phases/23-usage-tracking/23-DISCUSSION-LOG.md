# Phase 23: Usage Tracking - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-26
**Phase:** 23-usage-tracking
**Areas discussed:** Increment trigger point, Usage events audit table, Concurrency and failure modes

---

## Increment Trigger Point

### Where should the usage increment happen?

| Option | Description | Selected |
|--------|-------------|----------|
| Inside processCallEnded() | After call record upsert in call-processor.js. Duration and test-call data available. Runs async via after(). | ✓ |
| Synchronous in Retell webhook | Before returning 200 to Retell. Guarantees increment but adds latency. | |
| In processCallAnalyzed() | Later in pipeline. More data but higher risk of never firing if analysis fails. | |

**User's choice:** Inside processCallEnded()
**Notes:** Recommended approach — data is already available at this point, async is fine for counting.

### How should the 10-second minimum duration filter work?

| Option | Description | Selected |
|--------|-------------|----------|
| Check in JS before calling RPC | Simple if-guard in processCallEnded(). Skip RPC for short calls. | ✓ |
| Check inside the Postgres RPC | Centralizes billing logic in DB. Requires passing extra params. | |
| Both (belt and suspenders) | JS guard + RPC double-check. Maximum safety but more complexity. | |

**User's choice:** Check in JS before calling RPC
**Notes:** Simple threshold check, easy to adjust later.

### How should test calls be identified and excluded?

| Option | Description | Selected |
|--------|-------------|----------|
| Check call metadata from Retell payload | Test-call flow sets identifiable metadata. Check before incrementing. | ✓ |
| Flag on the calls table | is_test_call column, RPC checks flag. Adds queryability. | |
| You decide | Claude picks simplest approach. | |

**User's choice:** Check call metadata from Retell payload

---

## Usage Events Audit Table

### How much data should each usage event row store?

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal: call_id + tenant_id + timestamp | Idempotency only. Rich data on calls table, join via call_id. | ✓ |
| Add calls_used_after snapshot | Minimal plus counter snapshot for billing disputes. | |

**User's choice:** Minimal + join to calls table
**Notes:** User initially wanted richer data but confirmed that all rich call data (duration, outcome, transcript) is already captured on the calls table via Retell webhooks. No duplication needed.

### Should usage_events rows be retained indefinitely?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep forever | Rows are tiny. No cleanup job needed. | ✓ |
| Prune after 12 months | Cron job to delete old rows. Adds operational complexity. | |
| You decide | Claude picks based on projections. | |

**User's choice:** Keep forever

---

## Concurrency and Failure Modes

### If the increment RPC fails, should the call still be recorded?

| Option | Description | Selected |
|--------|-------------|----------|
| Record call regardless | Call data preserved. Log increment failure for reconciliation. | ✓ |
| Retry once, then record anyway | One retry attempt. Still records on failure. | |
| Fail entire processCallEnded | Consistency over availability. Risks losing call data. | |

**User's choice:** Record call regardless
**Notes:** Billing counter failure should never lose call data.

### Call spanning billing cycle reset?

| Option | Description | Selected |
|--------|-------------|----------|
| Count toward new cycle | Increment fires at call_ended time (in new cycle). Simple. | |
| Count toward old cycle | Attribute to correct cycle via period timestamps. Complex. | |
| You decide | Claude picks simplest approach. | ✓ |

**User's choice:** You decide
**Notes:** Claude will count toward new cycle (simplest, slightly benefits tenant).

### Should the RPC return limit status?

| Option | Description | Selected |
|--------|-------------|----------|
| Return status + count | { success, calls_used, calls_limit, limit_exceeded }. Enables Phase 25 enforcement. | ✓ |
| Silent increment only | Just UPDATE. Enforcement is Phase 25's problem. | |
| You decide | Claude picks based on downstream needs. | |

**User's choice:** Return status + count

---

## Claude's Discretion

- RPC function name and Postgres implementation details
- Row locking strategy (FOR UPDATE vs atomic increment)
- Billing cycle boundary: count toward new cycle
- Error logging format for failed increments

## Deferred Ideas

None

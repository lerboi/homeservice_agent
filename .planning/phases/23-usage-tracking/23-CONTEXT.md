# Phase 23: Usage Tracking - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Atomic per-call usage counting: every completed call increments `calls_used` exactly once via a Postgres RPC, with `usage_events` table as an idempotency guard against webhook retries, and billing cycle reset driven by the existing `invoice.paid` webhook handler.

</domain>

<decisions>
## Implementation Decisions

### Increment Trigger Point
- **D-01:** Usage increment happens inside `processCallEnded()` in `src/lib/call-processor.js`, after the call record upsert. Runs async via `after()` — fire-and-forget counting, not blocking the Retell webhook response.
- **D-02:** Minimum 10-second duration filter is a JS if-guard in `processCallEnded()` before calling the RPC. Skip the RPC entirely for short calls. Easy to adjust threshold later.
- **D-03:** Test calls identified via Retell webhook payload metadata (e.g., test call flag or from_number matching tenant's own number). Check in `processCallEnded()` before incrementing — no RPC call for test calls.

### Usage Events Audit Table
- **D-04:** Minimal `usage_events` table: `call_id` (idempotency key), `tenant_id`, `created_at`. Its job is idempotency, not data storage. Rich call data (duration, outcome, transcript) already lives on the `calls` table — join via `call_id` when needed.
- **D-05:** Usage event rows kept forever. Rows are tiny (3 columns), storage is negligible even at 400 calls/month/tenant. No cleanup job needed.

### Concurrency and Failure Modes
- **D-06:** If the increment RPC fails (DB error, timeout), the call is still recorded normally. Recording, transcript, lead creation, and notifications proceed regardless. Log the increment failure for manual reconciliation — a billing counter glitch should never lose call data.
- **D-07:** Calls spanning a billing cycle reset count toward the new cycle. Claude's Discretion — the increment fires at `call_ended` time, which lands in the new period. Simple, no special logic, slightly benefits the tenant.
- **D-08:** The RPC returns `{ success, calls_used, calls_limit, limit_exceeded }`. Enables logging and future enforcement (Phase 25) without another query. `processCallEnded()` logs the result but does not block or reject the call.

### Claude's Discretion
- RPC function name and exact Postgres implementation (e.g., `increment_calls_used`)
- Whether the RPC uses `FOR UPDATE` row locking or relies on atomic `SET calls_used = calls_used + 1`
- Billing cycle boundary handling: count toward new cycle (D-07)
- Exact error logging format for failed increments

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Billing Infrastructure (Phase 22)
- `supabase/migrations/010_billing_schema.sql` — subscriptions table with `calls_used`/`calls_limit` columns, `stripe_webhook_events` idempotency table, RLS policies
- `src/app/api/stripe/webhook/route.js` — `handleInvoicePaid()` already resets `calls_used` to 0 on `billing_reason === 'subscription_cycle'`

### Call Processing Pipeline
- `src/lib/call-processor.js` — `processCallEnded()` (lines 37-106) is the integration point for usage increment; `processCallAnalyzed()` (lines 120-377) runs later with full transcript/triage
- `src/app/api/webhooks/retell/route.js` — Retell webhook handler; `call_ended` event (lines 31-36) delegates to `processCallEnded()` via `after()`

### Pricing Data
- `src/app/(public)/pricing/pricingData.js` — Tier call limits: Starter 40, Growth 120, Scale 400

### Prior Phase Context
- `.planning/phases/22-billing-foundation/22-CONTEXT.md` — Billing foundation decisions (D-09 idempotency, D-10 out-of-order protection, D-12 price-to-plan mapping, D-13 history table pattern)

### Research
- `.planning/research/SUMMARY.md` — v3.0 architecture decisions
- `.planning/research/PITFALLS.md` — Webhook idempotency and enforcement latency pitfalls

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`calls_used`/`calls_limit` columns**: Already exist on subscriptions table (Phase 22). No schema changes needed for the counter itself.
- **`stripe_webhook_events` idempotency pattern**: UNIQUE constraint on `event_id` prevents duplicate Stripe event processing. Same pattern applies to `usage_events` with `call_id`.
- **`handleInvoicePaid()`**: Already handles billing cycle reset (`calls_used = 0`). Phase 23 does NOT need to touch this.
- **Retell webhook `after()` pattern**: `processCallEnded()` already runs async via `after()` — usage increment slots naturally into this existing flow.

### Established Patterns
- **Supabase RPC**: Used elsewhere for atomic operations (e.g., `assign_sg_number` for SG phone provisioning). Same pattern for `increment_calls_used`.
- **Migration numbering**: Next migration is `011_usage_events.sql` following existing sequential convention.
- **RLS pattern**: `tenant_own` (SELECT for authenticated) + `service_role_all` (full access for service role). Usage events table should use service_role-only access since writes come from webhook handlers.

### Integration Points
- **`processCallEnded()` in `src/lib/call-processor.js`**: Insert usage increment call after the call record upsert (around line 73). Guard with duration check (>= 10s) and test call exclusion before calling RPC.
- **`duration_seconds`**: Generated column on calls table, computed from `start_timestamp` and `end_timestamp`. Available after the call record upsert.

</code_context>

<specifics>
## Specific Ideas

- Rich call audit data (duration, outcome, transcript) is already captured on the `calls` table via `processCallAnalyzed()`. The `usage_events` table should NOT duplicate this — join via `call_id` when debugging billing.
- Retell provides all call metadata (duration, timestamps, recording, transcript) via webhooks. We store locally for dashboard performance and recording permanence (Retell URLs expire in ~7 days), not because we can't get it from Retell.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 23-usage-tracking*
*Context gathered: 2026-03-26*

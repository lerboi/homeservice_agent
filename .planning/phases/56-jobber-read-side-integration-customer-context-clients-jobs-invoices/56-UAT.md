---
status: complete
phase: 56-jobber-read-side-integration-customer-context-clients-jobs-invoices
source: [56-VERIFICATION.md]
started: 2026-04-19T00:00:00Z
updated: 2026-04-19T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. End-to-end Jobber OAuth connect against live sandbox
expected: You click "Connect Jobber" on /dashboard/more/integrations. Browser opens Jobber OAuth consent. After approving, you land back on the dashboard. Jobber card shows "Connected" state with a last-synced timestamp. No `error=account_probe_failed` or `error=connection_failed` in the URL. In Supabase, the `accounting_credentials` row for your tenant has `provider='jobber'`, non-null `access_token`, non-null `refresh_token`, AND non-null `external_account_id` (the Jobber account UUID).
result: pass
note: "Failed initially with HTTP 404 'GraphQL API version 2024-04-01 does not exist'. Fixed inline by updating JOBBER_API_VERSION to 2025-04-16 in 3 files (callback route, jobber.js lib, jobber.py Python agent). Commits d8242a8 (monorepo) and b9688c8 (livekit-agent)."

### 2. Webhook delivery from Jobber sandbox with correct HMAC
expected: Trigger any event in the Jobber sandbox (e.g., edit a client). Jobber POSTs to your `/api/webhooks/jobber` endpoint. The endpoint returns HTTP 200. Server logs show HMAC verification passed and `revalidateTag('jobber-context-<tenantId>:<phone>')` fired. A subsequent `fetchJobberCustomerByPhone` call for that phone bypasses the 5-min cache (fresh GraphQL round-trip, not stale).
result: pass
note: "Confirmed via Next.js 16 revalidateTag deprecation warning fired by the handler — proves webhook arrived, HMAC verified, handler routed and called revalidateTag. Non-blocking: revalidateTag → updateTag(tag, 'max') is a trivial cleanup for a later phase."

### 3. Visual parity of Jobber card with Xero card (all 4 states)
expected: Open /dashboard/more/integrations in the browser. All four Jobber card states render correctly: (a) Disconnected — "Connect Jobber" CTA; (b) Connected — green check, last-synced timestamp, "Disconnect" option; (c) Error — yellow reconnect banner saying "Jobber token expired" (not "Xero"); (d) Preferred badge — only visible when both Xero AND Jobber are connected, badge shown on Jobber card only.
result: pass

### 4. Concurrent Jobber + Xero fetch during live call stays within latency budget
expected: During an inbound test call with both Jobber AND Xero connected, Python agent's `_run_db_queries` completes in ≤1s (grep logs for elapsed timing). `deps.customer_context` in the Gemini prompt contains both `(Jobber)` AND `(Xero)` source annotations on merged fields. The "CRITICAL RULE — CUSTOMER CONTEXT" STATE block appears in the system prompt. Call audio sounds natural with no audible pause before greeting.
result: skipped
reason: "Deferred to later session — will test after Phase 57 ships and a staged LiveKit environment is available for call testing."

### 5. Refresh-failure email arrives in owner inbox when Jobber token expires
expected: Force a Jobber refresh-token failure (revoke in Jobber dashboard, or mock a 401 from /api/oauth/token). Within seconds, owner's email receives a message with subject "Your Jobber connection needs attention". The body contains a CTA button "Reconnect Jobber" linking to `/dashboard/more/integrations`. No access_token, refresh_token, or client_secret appears anywhere in the email body or headers. The dashboard Jobber card flips to Error state (yellow reconnect banner) immediately.
result: pass
note: "Verified 2026-04-19 via scripts/test-jobber-refresh-email.mjs. Resend accepted the email, owner received it, amber Reconnect banner appeared on /dashboard/calendar (IntegrationReconnectBanner), and Jobber card on /dashboard/more/integrations flipped to Error state. Adapter refreshTokenIfNeeded now wires notifyJobberRefreshFailure automatically on 401."

## Summary

total: 5
passed: 4
issues: 0
pending: 0
skipped: 1
blocked: 0

## Gaps

[none yet]

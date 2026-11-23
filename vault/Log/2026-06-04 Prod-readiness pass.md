---
type: log
date: 2026-06-04
status: superseded
description: "Prod-readiness fix pass (2026-06) — branch, 3 pending migrations, Stripe Basil verification, deferred follow-ups"
source: "Claude memory note project_prod_readiness_2026_06.md"
migrated: 2026-11-23
tags: [voco/log]
---

# 2026-06-04 Prod-readiness pass
Five-batch production-readiness pass completed 2026-06-03 on branch `fix/prod-readiness-2026-06` (main repo) and same-named branch in the livekit-agent repo. Not yet merged/deployed.

A second pass (2026-06-04) fixed 7 verified Critical/High livekit-agent issues (commit `02a55c9` agent repo + `e36312e` main repo, same branch): Stripe overage via Billing Meters (was the removed create_usage_record), 15s billable threshold, intake_questions prompt-injection framing, single-service triage over-escalation, unsupported-region short-circuit, call_sid upsert. One reported issue (greeting/tool mute race) was a verified FALSE POSITIVE (unreachable). Zero new test failures.

**Deploy-order obligation:** four new Supabase migrations must be applied before/with the code deploy, or features fail:
- `063_estimates_customer_id.sql` (estimates re-link after leads drop)
- `064_webhook_event_status.sql` (Stripe webhook `processed` flag — idempotency)
- `065_rate_limit.sql` (rate_limit_hits table + increment_rate_limit RPC; limiter fails open until applied)
- `066_calls_call_sid_unique.sql` (dedupe + UNIQUE(call_sid); MUST apply before the agent's owner-pickup upsert deploys or the upsert errors)

**User actions still pending:** (1) confirm live Stripe API version is `2025-03-31.basil` (code pins it with pre-Basil fallbacks). (2) Set `GOOGLE_MAPS_API_KEY` on Railway (livekit-agent) — without it ALL address validation returns 'skipped' (feature dead). (3) Confirm a Stripe Billing Meter named `voco_calls` exists with payload keys `stripe_customer_id` + `value` before relying on overage billing.

**Deferred (intentionally not done):** CSP (ship Report-Only first — Stripe/Spline-WASM risk); Gemini `context_window_compression` (needs live UAT vs the tool-result-replay path — only `session_resumption` was enabled, see [[2026-05-06 Phase 61 Gemini cancellation cascade failure mode]]); `listCustomers` data-layer follow-ups (the new Customers list shows total inquiries not just open, and VIP star is inert until the list endpoint returns is_vip); pre-existing failing tests in the livekit-agent repo from the earlier check_availability→check_slot/check_day/next_available_days split (`test_check_availability_slot_cache`, `test_slot_token_handoff`, `test_tenant_timezone_fallback`).

**Pre-existing main-repo test baseline:** ~27 failing suites unrelated to this pass (billing crons, pricing, landing-section migration-count assertions). The fixes introduced zero new failures.

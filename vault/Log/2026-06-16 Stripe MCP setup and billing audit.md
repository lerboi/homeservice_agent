---
type: log
date: 2026-06-16
status: record
description: "Stripe MCP reconfigured to local test-key server; 2026-06-16 billing/onboarding audit outcome + open items"
source: "Claude memory note project_stripe_mcp_and_billing_audit.md"
migrated: 2026-11-23
tags: [voco/log]
---

# 2026-06-16 Stripe MCP setup and billing audit
**Stripe MCP setup (2026-06-16):** The hosted OAuth Stripe MCP (`mcp.stripe.com`) authenticated into the WRONG account ("MakeitAI" `acct_1QqVRaAJsVayTGRc`, live mode). Replaced it with a **local stdio server** keyed to the app's test secret: `claude mcp add stripe -s local -- npx -y @stripe/mcp --tools=all --api-key=sk_test_51TEjeJ1Q8wktDRzn...` (stored in `~/.claude.json`, project-local). This pins the MCP to the same account+mode the app uses (test, `…1Q8wktDRzn` fingerprint). A leftover `plugin:stripe:stripe` (hosted, unauthenticated) is inert. MCP CANNOT read billing-meters or webhook-endpoints operations.

**Billing/onboarding audit outcome:** Test-mode pipeline verified GOOD. All 9 env price IDs exist/active/correct ($99/$249/$599 monthly; annual = monthly×0.8×12; overage metered $2.48/$2.08/$1.50 all linked to meter `mtr_test_61UQ4hQwyT6E0I03j411Q8wktDRznXkO`). Dashboard overageRate == metered price amounts. Annual+metered attach works in `billing_mode: flexible`. Webhook idempotency/out-of-order/one-current-row invariant all sound (0 live violations). Migrations 068–071 ARE applied (verified by introspection — `list_migrations` is empty because there's no `supabase_migrations.schema_migrations` table). `increment_calls_used` + Python `post_call.py` meter-post + `stripe_meter_failures` outbox + retry cron all symmetric on `event_name: voco_calls`.

**FIXED 2026-06-18 — annual overage bug:** `PLAN_MAP` annual `calls_limit` was the ×12 figure (480/1440/4800) but `calls_used` resets every month (monthly metered overage item → monthly `subscription_cycle` invoice → `handleInvoicePaid` reset), so annual subs got ~12× their calls before overage metered (unbillable). Fix: annual `calls_limit` now = monthly (40/120/400) in `src/lib/stripe-plans.js` with explanatory comment. Added regression test `tests/billing/plan-map.test.js` (12 tests, locks annual==monthly). Hardening: replaced the DEAD-CODE unknown-price guard (`if (priceId && !PLAN_MAP[priceId])` is unreachable — flatRateItem only matches PLAN_MAP keys) with a real `!flatRateItem` → Sentry alert in BOTH `stripe/webhook/route.js` and `onboarding/verify-checkout/route.js`. Backfill of existing annual rows was a NO-OP (0 rows) — the 3 stale 1440 rows had already re-synced to 120 by 06-18. All uncommitted. Pre-existing `tests/billing/trial-reminders.test.js` 6 failures are an unrelated `.in()` mock gap (NOT caused by these changes).

**Open items:** (P1, High) Everything verified is TEST mode — production needs live-mode mirrors (live prices, live `voco_calls` meter, live webhook endpoint+secret, live keys in Vercel); UNVERIFIED. (M1) Confirm meter `voco_calls` mapping in Dashboard: customer key `stripe_customer_id`, value key `value`, agg sum. (M2) Webhook never back-fills overage onto subs created before the overage price existed. (L1) Unknown price → defaults starter/40, no Sentry. (L2) canceled-branch billing_notifications delete is fire-and-forget. (L3) 56 legacy processed=false rows (harmless); stripe_webhook_events has no insert timestamp. Relates to [[2026-06-04 Prod-readiness pass]] and [[2026-06-12 Eight-pass full audit]].

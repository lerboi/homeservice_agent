# Phase 22: Billing Foundation - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Stripe integration backbone: create Stripe products/prices matching existing pricing tiers, build a subscriptions database table as the authoritative local billing mirror, implement a Stripe webhook handler with idempotency and version protection, and wire trial auto-start into the onboarding completion flow with CC required via Stripe Checkout.

</domain>

<decisions>
## Implementation Decisions

### Trial Activation Flow
- **D-01:** Stripe Checkout happens AFTER the test call but BEFORE onboarding completes. Flow: Auth -> Profile -> Services -> Test Call (aha moment) -> Plan Selection -> Stripe Checkout (CC + trial) -> Celebration -> Dashboard. The test call is the conversion hook — user experiences the AI before entering payment.
- **D-02:** User selects their plan (Starter/Growth/Scale) on a plan selection screen shown after the test call, before being redirected to Stripe Checkout for that specific plan with 14-day trial.
- **D-03:** CC is required for the 14-day trial — `payment_method_collection: 'always'` on the Checkout Session.
- **D-04:** After Checkout success, user returns to a celebration/confirmation screen ("You're all set!") with trial countdown info, then auto-redirects to the dashboard. Onboarding completion is triggered server-side by the Checkout success flow.
- **D-05:** The existing CelebrationOverlay pattern from the test call step can be adapted for the post-Checkout celebration.

### Webhook Event Handling
- **D-06:** Stripe webhook at `/api/stripe/webhook` follows the existing Retell webhook pattern: `request.text()` for raw body, `stripe.webhooks.constructEvent()` for signature verification, event routing via if/switch.
- **D-07:** Unknown/unhandled Stripe events are logged and return 200 (not rejected). Standard Stripe best practice — prevents unnecessary retries.
- **D-08:** Webhook processing is SYNCHRONOUS (inline before returning 200). Stripe has a 20-second timeout which is generous. Simpler error handling and idempotency than async. Does NOT use `after()` pattern.
- **D-09:** Idempotency enforced via `stripe_webhook_events` table with UNIQUE on `event_id`. Check before processing, insert after processing.
- **D-10:** Out-of-order protection via `stripe_updated_at` timestamp column — only apply event if its timestamp is newer than stored value.

### Subscription State Mapping
- **D-11:** No legacy user handling needed — all existing users are manual test accounts that won't exist at deployment. No backfill migration required.
- **D-12:** Subscriptions table stores BOTH `stripe_price_id` (for Stripe reconciliation/debugging) AND a local `plan_id` enum (starter/growth/scale) for fast local queries and enforcement. Webhook handler maps price ID to local plan_id.
- **D-13:** Subscription history table design — every subscription event creates a new row (not upsert). A `status` column and `is_current` flag (or a view) identifies the active subscription. Enables plan change history and audit trail.
- **D-14:** Stripe statuses map to local enforcement: `trialing` = allow, `active` = allow, `past_due` = allow (3-day grace), `canceled` = block, `paused` = block, `incomplete` = block.

### Claude's Discretion
- Exact column naming and index design for the subscriptions/history tables
- Whether to use a view or `is_current` boolean for active subscription lookup
- Stripe Checkout Session configuration details beyond what's specified (success/cancel URLs, metadata)
- Migration file naming (010_billing_schema.sql following existing convention)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Pricing Data
- `src/app/(public)/pricing/pricingData.js` — Tier definitions (Starter $99/40, Growth $249/120, Scale $599/400) that Stripe products must match exactly

### Existing Webhook Pattern
- `src/app/api/webhooks/retell/route.js` — Reference for raw body handling, signature verification, event routing pattern

### Onboarding Integration Point
- `src/app/api/onboarding/complete/route.js` — Current onboarding completion handler; Stripe customer + trial creation happens here (after Checkout redirect)

### Middleware
- `src/middleware.js` — Current auth middleware with onboarding_complete check; subscription gate will be added in Phase 24

### Database Migrations
- `supabase/migrations/` — All 9 existing migrations; new billing migration follows same RLS pattern (tenant_own + service_role_all)

### Research
- `.planning/research/SUMMARY.md` — Synthesized research with architecture decisions, pitfalls, and suggested phase structure
- `.planning/research/ARCHITECTURE.md` — Detailed integration architecture with file-level specifics
- `.planning/research/PITFALLS.md` — Critical pitfalls: webhook idempotency, enforcement latency, trial leakage, RLS write-protection

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Retell webhook pattern** (`/api/webhooks/retell/route.js`): `request.text()` → signature verify → event routing. Stripe webhook follows identical structure.
- **CelebrationOverlay** (onboarding test call step): Animated success screen with confetti. Can be adapted for post-Checkout celebration.
- **supabase-server.js / supabase-service.js**: Existing Supabase client helpers. Billing webhook handler uses service_role client for writes.
- **Migration RLS pattern**: All 9 migrations use identical `tenant_own` + `service_role_all` policy pattern. Billing tables follow the same but with write-protection (INSERT/UPDATE blocked for authenticated role, only service_role can write).

### Established Patterns
- **API route structure**: POST handlers in `src/app/api/[feature]/route.js` with Next.js App Router conventions
- **Environment variables**: API keys follow `SERVICE_API_KEY` naming convention. Stripe needs: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, plus Price IDs per plan.
- **Migrations**: Sequential numbering `NNN_feature_name.sql`, all timestamps as `timestamptz DEFAULT now()`

### Integration Points
- **Onboarding flow** (`/api/onboarding/complete`): Currently sets `onboarding_complete = true`. Will be modified to also create Stripe customer + subscription after Checkout success.
- **Pricing data** (`pricingData.js`): Stripe products/prices must match the `PRICING_TIERS` array exactly (ids: starter, growth, scale).
- **Test call celebration**: Current Step 5 celebration flow will need to transition to plan selection → Checkout instead of directly completing onboarding.

</code_context>

<specifics>
## Specific Ideas

- The post-Checkout celebration screen should feel like a natural continuation of the onboarding wizard — not a jarring redirect back from Stripe.
- Plan selection screen after test call should reuse the existing pricing tier card design from `PricingTiers.jsx` (or a simplified version) so it feels consistent with the public pricing page.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 22-billing-foundation*
*Context gathered: 2026-03-26*

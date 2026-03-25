# Domain Pitfalls: Stripe Billing & Usage Enforcement

**Domain:** Adding Stripe subscription billing and per-call usage metering to an existing multi-tenant voice AI platform (Next.js + Supabase + Retell)
**Researched:** 2026-03-26
**Confidence:** HIGH (Stripe official docs + Retell community findings + Supabase RLS patterns + codebase analysis)

---

## Critical Pitfalls

Mistakes in this section cause data loss, double-charges, free access leakage, or require production migrations.

---

### Pitfall 1: Stripe Webhook Idempotency Not Enforced — Double-Counting Subscriptions and Usage

**What goes wrong:**
Stripe guarantees at-least-once delivery of webhook events. The same `customer.subscription.updated`, `invoice.paid`, or `invoice.payment_failed` event will occasionally be delivered 2–3 times, typically during Stripe retry windows. If the webhook handler does not check whether it has already processed an event before acting on it, subscriptions get updated twice, usage resets happen twice, plan upgrades double-charge, and access revocations fire on already-revoked accounts.

Retell webhooks have the same problem: `call_analyzed` fires once per call, but `call_ended` and `call_started` fire for the same call. If the usage increment is wired to `call_ended` instead of `call_analyzed`, or if the handler does not check for an existing record with the same `call_id`, each call gets counted 3 times.

**Why it happens:**
Developers test against Stripe's CLI (which delivers each event exactly once) and against Retell's test calls (which rarely retry). Duplicate delivery only surfaces in production under load or during brief network partitions. By the time it's discovered, usage counts are corrupted.

**Consequences:**
- Usage counter inflated — tenants hit plan limits prematurely, see billing errors, churn
- Subscription records toggled active/inactive rapidly — access flapping during high webhook delivery
- Overage charges on calls that were already counted — chargebacks from tenants

**Prevention:**
1. Store processed Stripe event IDs in a `stripe_webhook_events` table with a `UNIQUE` constraint on `event_id`. Before processing any webhook, attempt an insert. If it fails (duplicate), return 200 immediately without processing. This is the database idempotency key pattern.
2. For Retell call counting, use `call_id` as the idempotency key on the `usage_events` table. Use `INSERT ... ON CONFLICT (call_id) DO NOTHING` so retried Retell webhooks are silently ignored.
3. Wire usage increment to `call_analyzed` only (not `call_started` or `call_ended`). `call_analyzed` fires exactly once per call with the complete record, making it the correct metering point.
4. For Stripe meter events (if using Stripe's usage-based billing API), pass the `call_id` as the `identifier` field in the meter event — Stripe deduplicates meter events by identifier.

**Detection:**
- Usage counts that grow faster than call volume
- Subscription records with `updated_at` changing twice within milliseconds
- `stripe_webhook_events` table with duplicate `event_id` entries (before idempotency was added)

**Phase to address:** v3.0 Phase 1 (Stripe Integration Foundation) — must be the first thing built, before any other billing logic. All subsequent phases depend on correct event processing.

---

### Pitfall 2: Enforcement Gate Adds Latency to Sub-Second Call Pickup

**What goes wrong:**
Calls through Retell must be answered in under 1 second. The inbound webhook handler (`/api/webhooks/retell/route.js`) currently runs slot calculation, triage setup, and dynamic variable injection in that window. Adding a synchronous Stripe API call to check subscription status (`stripe.subscriptions.retrieve()`) in this path adds 200–500ms of Stripe API latency, pushing call pickup past 1 second and causing Retell to timeout.

Even a synchronous Supabase query for subscription status adds 50–150ms round-trip from Railway to Supabase — acceptable in isolation, but stacked on top of existing operations it creates a latency cliff.

**Why it happens:**
The billing enforcement check feels natural to put at the call entry point: "Is this tenant allowed to take a call?" Developers reach for the most authoritative source (Stripe API) for that check, not realizing the latency budget is already spent by the time the webhook fires.

**Consequences:**
- Retell drops the call or answers with silence
- The AI receptionist — the product's core value prop — fails at the moment of first caller contact
- Callers hang up and call the competitor

**Prevention:**
1. **Never call the Stripe API synchronously from the inbound call webhook.** The Stripe API is not a real-time enforcement endpoint.
2. Maintain a `tenant_billing_status` field directly on the `tenants` table (or a `subscriptions` table with a direct row per tenant). This field (`active | trialing | past_due | suspended | cancelled`) is updated by Stripe webhook handlers asynchronously. The inbound webhook reads only from the local Supabase row — a single indexed query that costs 5–20ms.
3. Keep the local `subscriptions` table in sync via Stripe webhooks: `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`. The local cache is the enforcement source; Stripe is the source of truth for billing data only.
4. Accept a maximum staleness of 30 seconds on the enforcement status. If Stripe's `invoice.payment_failed` webhook takes 30 seconds to deliver and update local state, the tenant gets 30 extra seconds of access. This is acceptable — it is not exploitable in real-time and is standard SaaS practice.
5. For the actual `billing_status` check: use a Postgres function or indexed query on `tenant_id` only — do not join to other tables on this hot path.

**Detection:**
- Retell call pickup time > 800ms after adding billing enforcement
- `customer_webhook_events` processing time exceeding 500ms in logs
- Calls answered by silence followed by Retell timeout errors

**Phase to address:** v3.0 Phase 1 (Foundation) and repeated in Phase 2 (Enforcement Gate). The cache-first pattern must be established in Phase 1 so enforcement in Phase 2 never touches the Stripe API on the call path.

---

### Pitfall 3: Trial Expiry Without Payment Method — Silent "Free Forever" Access

**What goes wrong:**
The 14-day free trial requires no credit card. When the trial ends, if the tenant has no payment method on file, Stripe either cancels or pauses the subscription (depending on `trial_settings.end_behavior.missing_payment_method`). Stripe sends `customer.subscription.trial_will_end` 3 days before, then `customer.subscription.deleted` or `customer.subscription.paused` at expiry.

If the application only listens for `invoice.paid` to confirm active status, and never listens for `customer.subscription.deleted` or `customer.subscription.paused`, the local `billing_status` never updates on trial expiry without a payment method. The tenant continues receiving full service indefinitely.

**Why it happens:**
Developers test the "happy path": tenant starts trial, adds card, pays first invoice, continues on paid plan. The no-card trial expiry path is never tested because it requires waiting 14 days or using Stripe's test clock (which many teams skip). The `customer.subscription.trial_will_end` event is only 3 days before expiry, so the bug isn't caught in manual testing.

**Consequences:**
- Free indefinite access leaking revenue
- The hard paywall requirement ("trial expires = hard stop") is violated
- Tenants never convert to paid because there's no enforcement pressure

**Prevention:**
1. Listen for ALL subscription lifecycle events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused`, `customer.subscription.trial_will_end`, `customer.subscription.resumed`.
2. Map Stripe subscription `status` directly to local `billing_status` on every event, not just on `invoice.paid`. The mapping: `trialing` → `trialing`, `active` → `active`, `past_due` → `past_due`, `paused` → `suspended`, `canceled` → `cancelled`, `incomplete_expired` → `cancelled`.
3. Set `trial_settings.end_behavior.missing_payment_method = 'cancel'` (not `pause`). Cancellation sends a clear `customer.subscription.deleted` event and creates a simpler local state machine. Pause creates a third state (`suspended`) that needs its own enforcement logic.
4. Test with Stripe Test Clocks. A Stripe Test Clock lets you advance time to trial end without waiting 14 days. This is non-negotiable for billing — never skip it.
5. On `customer.subscription.trial_will_end` (3 days before): trigger in-app notification, email, and dashboard banner prompting card entry. Do not wait for the expiry event.

**Detection:**
- Tenants with `trial_ends_at` in the past but `billing_status = 'trialing'` still in local DB
- No `customer.subscription.deleted` events logged for tenants who started trials without cards
- Dashboard showing "active trial" for tenants whose Stripe subscription status is `canceled`

**Phase to address:** v3.0 Phase 1 (webhook listeners and status sync) + Phase 3 (trial enforcement hardening, test clock validation).

---

### Pitfall 4: Race Condition Between Call Completion and Usage Enforcement

**What goes wrong:**
Two concurrent calls can both pass the enforcement gate simultaneously with `calls_used = 9` and `plan_limit = 10`. Both get approved. Both complete. Both increment the counter. The tenant ends up at `calls_used = 11` with 1 overage that was never shown or charged.

A second variant: the enforcement gate reads `calls_used = 10`, `plan_limit = 10`, and blocks the new call. Simultaneously, a Retell webhook for a just-completed call is still in flight — it hasn't incremented the counter yet. The real count is 9, and the new call was blocked incorrectly.

**Why it happens:**
Read-then-write patterns on usage counters are not atomic. Any gap between "read current usage" and "write new usage" creates a race window. At low call volumes (1-2 calls/day) this never happens. At peak (5-10 simultaneous calls), it's routine.

**Consequences:**
- Overage not detected: lost revenue on per-call overage billing
- False blocking: a paying tenant is told they've hit their limit when they haven't
- Under-enforcement: usage limit is exceeded silently without overage charge or block

**Prevention:**
1. Use an atomic increment function in Postgres for usage tracking: `UPDATE usage_counters SET calls_used = calls_used + 1 WHERE tenant_id = $1 AND billing_period_start = $2 RETURNING calls_used`. The returned value is the authoritative post-increment count.
2. For enforcement at call start, use a Postgres advisory lock or a `SELECT ... FOR UPDATE` on the usage row when the enforcement check and increment need to be atomic. For the common case (well below plan limit), skip the lock and accept minor over-delivery. Only lock when `calls_used >= plan_limit - 2` (the "near limit" zone).
3. Never read usage from an application-layer cache for enforcement decisions. The cache can be stale by multiple increments. Always read from Postgres for the enforcement check.
4. For the Retell-specific case: the enforcement check happens at `call_started` (webhook fires before AI responds). The increment happens at `call_analyzed` (call is complete). These events are seconds apart, not milliseconds — less concurrency risk, but still requires atomic increment.
5. Use the `call_id` as the idempotency key for the increment (as covered in Pitfall 1) to ensure the increment fires exactly once regardless of webhook retries.

**Detection:**
- `calls_used` exceeding `plan_limit` in the DB without a corresponding overage record
- Tenants blocked when their `calls_used` is below the limit
- Usage counter incrementing by 2 for single calls (duplicate increment)

**Phase to address:** v3.0 Phase 2 (Usage Tracking Schema) and verified in Phase 4 (Enforcement Gate).

---

### Pitfall 5: Proration Creates Unexpected Charges on Plan Downgrades

**What goes wrong:**
When a tenant upgrades mid-cycle, Stripe generates an immediate proration invoice. When they downgrade mid-cycle, Stripe generates a negative proration credit but does not automatically refund it — it applies to the next invoice. If the product grants the new (lower) plan limits immediately on downgrade, the tenant may be denied features they've technically paid for (they paid for the higher plan through the end of the cycle) while Stripe still has their money as a credit.

A second problem: if downgrade is to a plan with a lower call limit and the tenant has already used more calls this cycle than the new plan allows, the enforcement gate needs to decide: block immediately (unfair — they paid for calls this cycle) or allow until cycle reset (creates an enforcement gap). Neither is right without a clear policy.

**Why it happens:**
Proration behavior (`proration_behavior: 'create_prorations' | 'none' | 'always_invoice'`) is a Stripe API parameter that most tutorials gloss over. Developers use the default and discover the side effects when a real customer complains about an unexpected charge.

**Consequences:**
- Tenant charged immediately on upgrade mid-cycle (expected), but also immediately loses credit on downgrade without a refund (unexpected to tenant)
- Billing complaints and chargebacks
- Enforcement gate behaving incorrectly in the cycle after a plan change

**Prevention:**
1. **Upgrades:** Use `proration_behavior: 'always_invoice'` so the proration is charged immediately and the tenant gains new features right away. This is the least confusing behavior for upgrades.
2. **Downgrades:** Use `proration_behavior: 'none'` and schedule the downgrade at the end of the current billing cycle using Stripe Subscription Schedules. The tenant keeps the current plan until cycle end, then drops to the lower plan. No mid-cycle proration charge or confusing credit.
3. For usage limits on downgrade: grant the current cycle's limit at the current plan. On the next cycle start (Stripe sends `customer.subscription.updated` with the new price), enforce the new lower limit.
4. Preview prorations before applying them: use `stripe.invoices.retrieveUpcoming()` to show the tenant exactly what they'll be charged before confirming a plan change. This eliminates surprise charges.
5. Document the policy explicitly in the billing dashboard UI: "Upgrades take effect immediately. Downgrades take effect at the end of your current billing period."

**Detection:**
- Tenants complaining about unexpected charges after upgrading
- Negative balance on Stripe customer account (credit sitting unused)
- `calls_used` exceeding the new plan limit on the same day as a downgrade

**Phase to address:** v3.0 Phase 3 (Subscription Lifecycle Management) and Phase 5 (Billing Dashboard).

---

### Pitfall 6: Failed Payment Dunning — Service Suspended Before Customer Can Fix It

**What goes wrong:**
Stripe's Smart Retries will attempt a failed invoice payment multiple times over several days. The default Stripe configuration marks subscriptions as `past_due` during retry windows. If the enforcement gate treats `past_due` the same as `cancelled` and immediately suspends service, tenants who had a transient card decline (expired card, bank hold) lose service before they have a chance to update their payment method. This is the number-one churn cause for subscription SaaS — involuntary churn from payment failure accounts for 20-40% of cancellations.

**Why it happens:**
The billing status state machine has three states: `active`, `past_due`, `cancelled`. The simplest enforcement logic is `active → allow, anything else → block`. This feels correct but is too aggressive.

**Consequences:**
- Tenants in `past_due` (recoverable) lose service immediately
- Their AI receptionist stops answering calls — they lose live leads during the grace period
- They churn not because they wanted to cancel but because of a payment hiccup
- High involuntary churn rate (industry average is 1-3%; hitting 10%+ means dunning logic is wrong)

**Prevention:**
1. Implement a grace period: allow `past_due` tenants full service for a configurable grace period (default: 7 days for B2B SaaS). During this period, the enforcement gate treats them as `active`.
2. After the grace period expires without payment, downgrade to a limited mode (not full suspension): allow incoming calls to be answered but do not process new bookings. This keeps the core promise (calls answered) while creating urgency to pay.
3. Send escalating notifications during the grace period: Day 1 (email with payment link), Day 3 (email + SMS), Day 5 (in-app banner), Day 7 (final notice before suspension).
4. Use Stripe's Customer Portal for payment method updates — do not build your own payment update form. The portal handles 3DS, card validation, and retry triggering automatically.
5. On `invoice.payment_succeeded` after dunning: immediately restore full service and reset the grace period counter. Do not require a manual admin action to restore.
6. Never immediately cancel on `invoice.payment_failed`. Wait for Stripe's retry cycle to complete (Smart Retries over 14 days) before moving from `past_due` to `cancelled`.

**Detection:**
- High involuntary churn rate (> 3% monthly)
- Tenants complaining calls aren't being answered right after a declined card
- `billing_status = 'past_due'` tenants with active usage counters (they're paying attention and using the product — they'll fix the payment)

**Phase to address:** v3.0 Phase 3 (Dunning & Grace Periods) — must be designed alongside the enforcement gate, not added later.

---

### Pitfall 7: Supabase RLS on Billing Tables — Service Role Bypass Silently Breaks Enforcement

**What goes wrong:**
Supabase RLS policies enforce tenant isolation on data reads. Billing tables (`subscriptions`, `usage_counters`, `billing_events`) need to be readable by the tenant (for the dashboard) but writable only by server-side webhook handlers (Stripe webhooks, Retell webhooks). If RLS is not set up correctly, two failure modes occur:

**Mode A (too permissive):** Tenant can `UPDATE` their own `subscriptions` row via the Supabase client SDK. A motivated tenant sets `billing_status = 'active'` and `plan_limit = 999` directly. There is no amount of application-level validation that catches this if the RLS policy has `USING (tenant_id = auth.uid())` on both SELECT and UPDATE.

**Mode B (too restrictive):** Webhook handlers using the Supabase `service_role` key bypass RLS entirely. If developers assume RLS protects the billing tables and rely on it for authorization in the webhook handler itself, they may not add application-level tenant verification. A malicious actor who discovers the webhook endpoint can submit a crafted payload (without Stripe signature verification) and modify any tenant's billing status.

**Why it happens:**
The existing codebase already has RLS on all tables (a valid pattern for this project). Developers add billing tables following the same pattern — RLS for tenant isolation — without recognizing that billing tables have a different trust boundary: they should be immutable from the client SDK but mutable from authenticated server-side processes only.

**Consequences:**
- Mode A: Trivial billing bypass — any tenant can give themselves free access
- Mode B: Stripe signature verification is the only gate; if it's skipped in testing or misconfigured, billing state becomes externally writable
- Misconfigured RLS also causes Supabase RealTime subscription updates to broadcast billing data to wrong tenants

**Prevention:**
1. **Billing tables must have `WITH CHECK (false)` on INSERT and UPDATE for authenticated users.** Only the `service_role` (used by server-side webhook handlers) can write to billing tables. Tenants can only read their own rows.
2. RLS policy pattern for billing tables:
   ```sql
   -- SELECT: tenant can see their own billing status
   CREATE POLICY "tenant_read_own_subscription"
     ON subscriptions FOR SELECT
     USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

   -- INSERT/UPDATE/DELETE: only service_role (no policy = default deny for authenticated users)
   -- service_role bypasses RLS entirely
   ```
3. Always verify Stripe webhook signatures with `stripe.webhooks.constructEvent()` before processing. Never skip this in any environment. The signature prevents forged webhook payloads.
4. Never expose the `service_role` key to the browser. All Stripe webhook handlers and billing mutations run server-side only (Next.js API routes, not client-side SDK calls).
5. Validate `tenant_id` from the Stripe customer metadata, not from the request body: `const tenantId = stripeCustomer.metadata.tenant_id` — then look up the subscription by that `tenant_id`. Don't trust any tenant identifier from the webhook payload without cross-referencing Stripe's customer object.

**Detection:**
- Supabase Dashboard: RLS policy test — try updating `billing_status` as an authenticated tenant user; the update should fail
- `subscriptions` table audit log showing `UPDATE` operations with `auth.role() = 'authenticated'` (should not exist)
- Stripe webhook handler processing events without checking `stripe.webhooks.constructEvent()` return value

**Phase to address:** v3.0 Phase 1 (Database Schema) — RLS policies must be correct before any billing data is written to production.

---

### Pitfall 8: Usage Counter Reset at Billing Cycle Boundary — Off-by-One and Race Conditions

**What goes wrong:**
Monthly billing cycles reset the call usage counter on the billing anniversary date (e.g., the 15th of each month). Two failure modes:

**Mode A (wrong reset trigger):** Usage is reset by a cron job running on a fixed schedule (midnight UTC on the 1st, or "every 30 days"). Stripe's billing cycle is tied to the subscription's `current_period_start`, which is not necessarily the 1st and shifts when trials end, plans are changed, or invoices are manually generated. A cron-based reset drifts from the actual billing cycle, creating periods where tenants are over- or under-charged for usage.

**Mode B (race during reset):** The usage counter is reset to 0 at cycle start. A call completes at the exact moment of reset. The increment fires, reads the fresh 0, increments to 1. Simultaneously, the reset job is also running and writes 0, erasing the just-completed call. The call is never counted.

**Why it happens:**
Usage reset feels like a simple cron task. The connection between Stripe's billing cycle and the reset trigger is not obvious from the Stripe docs, which recommend listening to `invoice.paid` for this purpose but many developers use cron instead because it's simpler.

**Consequences:**
- Tenants get "free" extra calls when the reset fires early
- Tenants hit limits prematurely when the reset fires late
- Per-call overage billing is incorrect (overage calculated on a counter that's out of sync with the billing period)

**Prevention:**
1. Always reset usage counters in response to Stripe webhooks, not cron jobs. The correct event is `invoice.paid` for the subscription invoice (not a one-time invoice). On `invoice.paid`, check `invoice.subscription` is non-null and `invoice.billing_reason = 'subscription_cycle'`, then reset the counter for the period `invoice.period.start` to `invoice.period.end`.
2. Store `billing_period_start` and `billing_period_end` on the `usage_counters` row, sourced from the Stripe invoice. This makes the counter period explicit and queryable.
3. For the race condition: use `INSERT ... ON CONFLICT (tenant_id, billing_period_start) DO UPDATE SET calls_used = 0` for the reset, and `UPDATE usage_counters SET calls_used = calls_used + 1 WHERE tenant_id = $1 AND billing_period_start = $2` for increments. These are separate rows — the old period row is not overwritten when a new period starts.
4. Keep the previous period's usage row (don't delete it). It's needed for invoice reconciliation and overage billing.

**Detection:**
- `usage_counters.calls_used` resetting to 0 on a fixed-date schedule that doesn't match `subscriptions.current_period_start`
- Calls missing from usage count after a billing cycle rollover
- Discrepancy between Stripe invoice line items and local `calls_used` counter

**Phase to address:** v3.0 Phase 2 (Usage Tracking Schema) — the reset mechanism must be tied to `invoice.paid` from day one.

---

### Pitfall 9: Stripe Event Out-of-Order Delivery Corrupts Local State

**What goes wrong:**
Stripe does not guarantee delivery order. `customer.subscription.updated` may arrive before `customer.subscription.created`. An `invoice.paid` for a renewed subscription can arrive before the `customer.subscription.updated` that changed the plan price. If the webhook handler blindly applies each event's embedded data to the local DB, events processed out of order overwrite newer state with older state.

Example: `subscription.updated` (plan upgraded, `status = active`) arrives. Handler updates local DB. Then `subscription.created` (initial state, `status = trialing`) arrives and overwrites the active record with trialing status. Tenant is on a paid plan but local DB shows trialing.

**Why it happens:**
Webhook handlers are usually written as "take the event data, write to DB." Out-of-order delivery is not tested because Stripe's test webhook delivery is sequential, and this issue only manifests when Stripe's infrastructure has delivery delays across different event types.

**Consequences:**
- Tenant on paid plan blocked as if still on trial
- Tenant downgraded locally while still on upgraded plan in Stripe
- `billing_status` oscillating between states

**Prevention:**
1. Use `created` timestamps from Stripe event objects to version-protect writes: `UPDATE subscriptions SET status = $1, updated_at = $2 WHERE tenant_id = $3 AND stripe_updated_at < $2`. Only write if the incoming event's timestamp is newer than what's already stored.
2. For subscription status, never apply `subscription.created` data if a `subscription.updated` with a later timestamp already exists. Check `stripe_updated_at` before writing.
3. For missing-dependency scenarios (e.g., `invoice.paid` arrives before the subscription row exists locally): fetch the subscription from Stripe API directly (`stripe.subscriptions.retrieve(invoice.subscription)`) and create the local row, then process the invoice.
4. Add a `stripe_event_id` and `stripe_created_at` column to the `subscriptions` table. This is the version vector — all updates must include these values and only apply if newer.

**Detection:**
- `subscriptions.billing_status` changing without a corresponding Stripe event log entry
- Tenant reports being blocked while Stripe Dashboard shows active subscription
- `stripe_event_id` log showing the same subscription receiving conflicting status events within milliseconds

**Phase to address:** v3.0 Phase 1 (webhook processing infrastructure) — event ordering protection must be built in from the start, not added after state corruption is observed.

---

## Moderate Pitfalls

Issues that create incorrect behavior or maintenance pain but don't require a rewrite.

---

### Pitfall 10: Hard Paywall on `call_started` Webhook — Wrong Event for Enforcement

**What goes wrong:**
The enforcement gate fires at the moment Retell sends the `call_started` webhook to the application. This is before the AI has answered. If the enforcement check blocks the call, Retell has already connected the call — the caller hears silence or a hang-up, not a graceful "service unavailable" message.

**Why it happens:**
Developers wire enforcement to `call_started` because it fires first and seems like the right "entry gate." But Retell's `call_started` fires after the call is picked up. The only pre-answer hook is the inbound call webhook that Retell sends before connecting the call to the AI — this is the `POST /api/webhooks/retell` inbound handler.

**Prevention:**
The enforcement check (is this tenant `active` or `trialing`?) must happen in the inbound webhook handler, before Retell is told to connect the call to the LLM WebSocket server. If the tenant is suspended, respond with a Retell configuration that plays a pre-recorded "service unavailable" message instead of connecting to the AI. Never enforce in `call_started` — the call is already live.

**Phase to address:** v3.0 Phase 4 (Enforcement Gate).

---

### Pitfall 11: Free Trial Counter Not Initialized at Onboarding

**What goes wrong:**
Tenants start their 14-day free trial during onboarding. If the `subscriptions` row and `usage_counters` row are not created during onboarding (relying on a Stripe `customer.subscription.created` webhook to trigger creation), there is a window between account creation and webhook delivery where:
- The enforcement gate finds no subscription row and either blocks all calls (overly restrictive) or allows all calls (too permissive)
- Usage increments fail because there's no `usage_counters` row to update

**Prevention:**
1. During onboarding completion, synchronously create the Stripe customer (`stripe.customers.create()`), create the trial subscription (`stripe.subscriptions.create()` with `trial_period_days: 14`), and immediately write the local `subscriptions` and `usage_counters` rows — do not wait for the webhook.
2. The webhook handler for `customer.subscription.created` should use `INSERT ... ON CONFLICT DO NOTHING` to handle the case where the row already exists (created synchronously at onboarding).
3. The enforcement gate default for "no subscription row found" must be `trialing` (allow calls), not `suspended`. Stripe webhooks can take seconds to arrive; the absence of a local row immediately after onboarding is expected.

**Phase to address:** v3.0 Phase 1 (Foundation) and Phase 3 (Trial Management).

---

### Pitfall 12: Billing Dashboard Showing Stale Usage — Counter vs. Real-Time Accuracy

**What goes wrong:**
The billing dashboard shows `calls_used` from the `usage_counters` table. Calls are incremented by the Retell `call_analyzed` webhook. If `call_analyzed` takes 30–60 seconds to fire after a call ends (Retell's analysis pipeline), the dashboard shows a count that's 1-2 calls behind the real usage. Tenants think they have more budget left than they do. This is especially visible as they approach their plan limit.

**Prevention:**
1. Use Supabase Realtime to push live updates to the billing dashboard when `usage_counters` changes. The tenant sees the counter increment in real time without polling.
2. Consider incrementing the counter optimistically at `call_ended` (faster, ~5 seconds after call) and reconciling at `call_analyzed`. Mark `call_analyzed` as the source of truth. This gives the dashboard near-real-time accuracy.
3. Display the billing period boundary clearly: "X of Y calls used this period (resets [date])." Tenants need to know the reset date to understand their budget.

**Phase to address:** v3.0 Phase 5 (Billing Dashboard).

---

### Pitfall 13: Stripe Customer Portal Not Configured — Cancellation and Card Updates Broken

**What goes wrong:**
Stripe's Customer Portal handles cancellations, card updates, and subscription upgrades/downgrades. If the portal is not configured in the Stripe Dashboard (it requires explicit product/price registration, allowed features, and redirect URLs), the portal link throws a Stripe API error when clicked by tenants. Many developers discover this in production when a real customer tries to cancel.

**Prevention:**
1. Configure the Customer Portal in the Stripe Dashboard (not via API) before any billing goes live. Required settings: allowed products/prices, cancelation flow (immediate vs. end of period), allowed updates (upgrade/downgrade pricing).
2. Set `return_url` to the billing dashboard page in the application — not to the homepage. After portal actions, the tenant should land back in the billing context.
3. Test the portal in Stripe test mode before going live. The portal URL is generated via `stripe.billingPortal.sessions.create()` — test that the entire flow (cancel, update card, upgrade) works end-to-end.

**Phase to address:** v3.0 Phase 5 (Billing Dashboard).

---

## Minor Pitfalls

---

### Pitfall 14: `invoice.payment_action_required` Not Handled — 3DS Payments Silently Fail

**What goes wrong:**
European tenants often have Stripe Radar rules or bank requirements that mandate 3D Secure authentication on subscription renewals. When a renewal requires 3DS and the tenant is not present to authenticate, Stripe sends `invoice.payment_action_required`. If the handler ignores this event, the invoice stays unpaid, the subscription moves to `past_due`, and the tenant gets no notification about why.

**Prevention:**
Listen for `invoice.payment_action_required` and send the tenant a link to authenticate: the `hosted_invoice_url` or `payment_intent.next_action.redirect_to_url` from the invoice. Without this, European tenants silently go delinquent.

**Phase to address:** v3.0 Phase 3 (Dunning & Grace Periods).

---

### Pitfall 15: Overage Billing Not Idempotent — Double-Charged at Cycle End

**What goes wrong:**
Per-call overage is billed by creating a Stripe invoice item for excess calls at the end of the billing period. If the overage calculation job runs twice (cron retried, duplicate `invoice.paid` event processed), two identical invoice items are created. The tenant is double-charged for overage.

**Prevention:**
Use Stripe's idempotency keys when creating invoice items for overage: `stripe.invoiceItems.create({ ... }, { idempotencyKey: \`overage-${tenantId}-${periodStart}\` })`. The `periodStart` makes the key unique per billing cycle and prevents duplicate creation.

**Phase to address:** v3.0 Phase 4 (Overage Billing).

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Stripe schema setup | Adding billing tables without correct RLS write-protection | Pitfall 7: `WITH CHECK (false)` on all billing table mutations for authenticated users |
| Webhook handler | First Stripe `invoice.paid` processed before `subscription.created` | Pitfall 9: fetch subscription from Stripe API when dependency is missing |
| Usage tracking | Retell `call_ended` firing 3 times per call | Pitfall 1: use `call_analyzed` only; deduplicate on `call_id` |
| Enforcement gate | Synchronous Stripe API call on call pickup path | Pitfall 2: local cache-first, webhook-updated, never Stripe API on hot path |
| Trial management | Trial expires without card, no `subscription.deleted` listener | Pitfall 3: listen to all 7 subscription lifecycle events |
| Plan changes | Mid-cycle downgrade with immediate limit enforcement | Pitfall 5: schedule downgrade at cycle end, keep current limits until then |
| Dunning | `past_due` treated as `suspended` | Pitfall 6: 7-day grace period, limited mode not full suspension |
| Usage reset | Cron-based reset drifting from Stripe billing cycle | Pitfall 8: reset only on `invoice.paid` with `billing_reason = 'subscription_cycle'` |
| Overage billing | Duplicate overage invoice items | Pitfall 15: idempotency key = `overage-${tenantId}-${periodStart}` |
| Billing dashboard | Stale usage counter | Pitfall 12: Supabase Realtime push on counter changes |

---

## Integration-Specific Gotchas

| Integration Point | Common Mistake | Correct Approach |
|-------------------|----------------|------------------|
| Stripe webhooks | Treating HTTP 200 response as "processed successfully" | Store event ID first, process async, mark complete after DB write succeeds |
| Retell `call_analyzed` | Assuming it fires within 5 seconds of call end | It can take 30-60s; enforcement must tolerate this latency gap |
| Retell inbound webhook | Adding enforcement after existing slot calculation | Enforcement reads a single indexed column; add before slot calculation, fail fast |
| Supabase RLS | Using `auth.uid()` directly in billing table policies | tenant_id requires a join to profiles table; cache it in JWT custom claim |
| Stripe Customer Portal | Assuming portal just works after `stripe.billingPortal.sessions.create()` | Portal must be configured in Stripe Dashboard UI first with allowed products |
| Stripe Subscription Schedules | Not using schedules for end-of-cycle downgrades | Without schedules, downgrade takes effect immediately with proration charges |
| Stripe Test Clocks | Testing trial expiry with real 14-day wait | Always use Test Clocks for billing cycle testing; this is not optional |
| Stripe Meter Events | Using Stripe meter events without an `identifier` field | Without `identifier`, Stripe cannot deduplicate — use Retell `call_id` as identifier |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Stripe API call on inbound webhook | Call pickup > 1 second; Retell timeouts | Cache billing_status locally; never call Stripe on hot path | Every call after billing enforcement added |
| RLS policies joining profiles table on usage queries | Slow usage counter reads; dashboard lag | Cache tenant_id in JWT custom claim; keep RLS policies join-free | 50+ tenants with active calls simultaneously |
| Counting all Retell event types for usage | 3x overcounting; premature plan limit hits | Filter to `call_analyzed` events only | From day one of usage counting |
| Cron-based usage reset without idempotency | Counter reset twice; lost usage data | Webhook-triggered reset with `ON CONFLICT DO NOTHING` | First time Stripe retries the `invoice.paid` event |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| No Stripe signature verification | Forged webhooks can set any tenant to `active` | `stripe.webhooks.constructEvent()` on every incoming event, no exceptions |
| Tenant can write to own subscriptions row via SDK | Trivial billing bypass | RLS: SELECT allowed, INSERT/UPDATE blocked for authenticated role on billing tables |
| Exposing Stripe secret key to client | Full account takeover | Stripe key only in server-side env vars; never in `NEXT_PUBLIC_*` |
| Using tenant ID from webhook body without verification | Tenant spoofing | Derive tenant_id from `stripe.customers.retrieve(event.data.object.customer).metadata.tenant_id` |
| `service_role` key used in client-side code | RLS bypass from browser | service_role only in server API routes; anon key for client SDK |

---

## "Looks Done But Isn't" Checklist

- [ ] **Webhook idempotency:** Check that `stripe_webhook_events` table has `UNIQUE(event_id)` — not just an app-level check
- [ ] **Retell usage dedup:** Verify only `call_analyzed` triggers increment — grep for any increment on `call_started` or `call_ended`
- [ ] **Enforcement latency:** Measure inbound webhook response time with enforcement gate active — must be < 400ms total
- [ ] **Trial expiry no-card path:** Run a Stripe Test Clock through a trial that expires with no payment method — local DB must update
- [ ] **Downgrade cycle end:** Verify downgrade is scheduled at cycle end, not applied immediately with proration
- [ ] **Grace period active:** `past_due` status allows calls for grace period days — verify enforcement code has this branch
- [ ] **Usage reset on invoice.paid:** Grep for cron-based usage reset — it must not exist; only `invoice.paid` webhook triggers reset
- [ ] **RLS write protection:** Attempt `UPDATE subscriptions SET billing_status = 'active'` via authenticated Supabase client — must be rejected
- [ ] **Out-of-order protection:** Webhook handler checks `stripe_updated_at` before overwriting — verify with out-of-order test delivery
- [ ] **Overage idempotency key:** `stripe.invoiceItems.create()` call includes idempotency key `overage-${tenantId}-${periodStart}`
- [ ] **Customer Portal configured:** Test the portal in Stripe test mode — portal session creation must succeed and portal must show correct products
- [ ] **`call_started` not used for enforcement:** Enforcement fires in the inbound webhook handler before call connection, not in `call_started` handler

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Duplicate webhook processing (usage inflated) | HIGH | Audit `usage_events` for duplicate `call_id` entries. Recalculate correct count. Issue Stripe credit memos for tenants overcharged on overage. Manual tenant communication. |
| Enforcement gate latency causing call failures | MEDIUM | Roll back enforcement to async-only mode. Move check to post-call audit. Redesign to local cache. No data loss but temporary service degradation. |
| Trial expiry silent free access | MEDIUM | Stripe Dashboard audit: find all `canceled` subscriptions with active local accounts. Bulk-update local `billing_status`. Notify affected tenants. |
| Billing table RLS bypass | CRITICAL | Audit all `subscriptions` rows for anomalous data. Lock table. Reset from Stripe API as source of truth. Fix RLS. Force re-auth for all sessions. |
| Usage counter out of sync with billing period | MEDIUM | Re-derive `calls_used` from `call_events` table for the billing period. Cross-reference with Stripe invoice data. Manual correction per tenant. |
| Double overage charges | MEDIUM | Stripe Dashboard: void duplicate invoice items. Issue refunds. Add idempotency keys retroactively. Tenants need individual communication. |

---

## Sources

- [Stripe: Idempotent requests](https://docs.stripe.com/api/idempotent_requests) — HIGH confidence (official docs)
- [Stripe: Use trial periods on subscriptions](https://docs.stripe.com/billing/subscriptions/trials) — HIGH confidence (official docs)
- [Stripe: Prorations](https://docs.stripe.com/billing/subscriptions/prorations) — HIGH confidence (official docs)
- [Stripe: Record usage for billing (Meters API)](https://docs.stripe.com/billing/subscriptions/usage-based/recording-usage-api) — HIGH confidence (official docs)
- [Stripe: Automate payment retries (Smart Retries)](https://docs.stripe.com/billing/revenue-recovery/smart-retries) — HIGH confidence (official docs)
- [Stripe: Optimizing API performance with caching](https://stripe.dev/blog/optimizing-stripe-api-performance-lambda-caching-elasticache-dynamodb) — HIGH confidence (Stripe official blog)
- [Stigg: Best practices for integrating Stripe webhooks](https://www.stigg.io/blog-posts/best-practices-i-wish-we-knew-when-integrating-stripe-webhooks) — MEDIUM confidence (practitioner post-mortem)
- [Retell AI: Webhook documentation](https://docs.retellai.com/features/webhook) — HIGH confidence (official docs)
- [Retell community: call_ended webhook not firing](https://community.retellai.com/t/call-ended-webhook-not-firing-for-ivr-forwarded-calls-to-retell-twilio-number/2074) — MEDIUM confidence (community report)
- [n8n community: Retell triggering multiple executions per call](https://community.n8n.io/t/my-retell-ai-voice-agent-webhook-is-triggering-multiple-n8n-executions-per-call-and-i-only-want-one-execution-from-the-final-analyzed-event-to-run-my-automation/215323) — MEDIUM confidence (community, confirms 3-events-per-call pattern)
- [Supabase: RLS Best Practices](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices) — MEDIUM confidence (practitioner guide, verified against official RLS docs)
- [MakerKit: Multi-tenant Supabase RLS patterns](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices) — MEDIUM confidence (established Next.js + Supabase SaaS boilerplate author)
- Direct codebase analysis: `src/app/api/webhooks/retell/route.js`, `src/lib/call-processor.js`, existing `subscriptions` table patterns — HIGH confidence

---

*Pitfalls research for: v3.0 Stripe Subscription Billing & Usage Enforcement*
*Researched: 2026-03-26*

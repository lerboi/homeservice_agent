# Phase 24: Subscription Lifecycle and Notifications - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Graceful handling of degraded subscription states: failed payment notifications (SMS + email), 3-day past_due grace period with dashboard warning banner, trial reminder emails at day 7 and day 12 via cron job, trial_will_end webhook notification, and middleware gate that redirects expired/cancelled tenants to /billing/upgrade.

</domain>

<decisions>
## Implementation Decisions

### Grace Period UX
- **D-01:** When a tenant enters past_due status, a persistent warning banner appears across all dashboard pages: "Your payment failed — update your payment method within X days to avoid service interruption." with a direct link to Stripe Customer Portal.
- **D-02:** The banner shows a relative countdown ("X days remaining") rather than an exact date. Simpler, no timezone complexity.
- **D-03:** No feature degradation during grace period — all dashboard features remain fully functional. The banner is the only indicator.

### Notification Content and Tone
- **D-04:** All billing notifications use a helpful and direct tone. E.g., "Hey [name], your payment didn't go through. Update your card here: [link]. Your service continues for 3 more days." No corporate formality, no guilt.
- **D-05:** Failed payment SMS includes a direct Stripe Customer Portal link — one tap to fix. Email also sent with same link + more context.
- **D-06:** Trial reminder emails (day 7 and day 12) use React email templates via Resend, consistent with the existing NewLeadEmail pattern in src/emails/. Branded HTML with Voco logo, usage stats, upgrade CTA button.

### Trial Reminder Timing
- **D-07:** Trial reminder idempotency enforced via a separate `billing_notifications` tracking table (tenant_id, notification_type, sent_at). More flexible for future notification types than adding columns to subscriptions.
- **D-08:** Trial reminder cron runs as a Vercel Cron route at /api/cron/trial-reminders, following the existing send-recovery-sms and renew-calendar-channels patterns. Configured in vercel.json.

### Middleware Gate Behavior
- **D-09:** When an expired/cancelled tenant navigates to any dashboard route, middleware immediately redirects to /billing/upgrade. No interstitial, no flash of dashboard content.
- **D-10:** All /billing/* routes are exempt from the subscription gate so expired tenants can reach the upgrade page and Stripe Checkout return URLs.

### Claude's Discretion
- Exact banner component implementation (likely a new BillingWarningBanner component in the dashboard layout)
- React email template design details for trial reminders and payment failure
- Cron job frequency (daily should suffice for day 7/12 reminders)
- billing_notifications table schema details (columns beyond tenant_id, notification_type, sent_at)
- Whether trial_will_end webhook notification is SMS, email, or both

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Stripe Webhook Handler (Phase 22)
- `src/app/api/stripe/webhook/route.js` — Contains stub handlers for `handleTrialWillEnd()` (line 361) and `handleInvoicePaymentFailed()` (line 366) ready for Phase 24 implementation. Also has status mapping at line 272.

### Existing Notification Infrastructure
- `src/lib/notifications.js` — `sendOwnerSMS()`, `sendOwnerEmail()`, `sendCallerRecoverySMS()` patterns with Twilio + Resend clients. Reuse for billing notifications.
- `src/emails/NewLeadEmail.jsx` — React email template pattern for Resend. Trial reminder emails should follow this pattern.

### Middleware
- `src/middleware.js` — Current auth + onboarding gate. Subscription gate will be added here.

### Existing Cron Patterns
- `src/app/api/cron/send-recovery-sms/` — Existing Vercel Cron route pattern for trial-reminders cron
- `src/app/api/cron/renew-calendar-channels/` — Second cron pattern reference

### Billing Schema
- `supabase/migrations/010_billing_schema.sql` — Subscriptions table with status, trial_ends_at, current_period_start/end columns needed for grace period calculation and trial day computation

### Prior Phase Context
- `.planning/phases/22-billing-foundation/22-CONTEXT.md` — D-14 status mapping (past_due = 3-day grace), D-08 synchronous webhook processing
- `.planning/phases/23-usage-tracking/23-CONTEXT.md` — Usage counter decisions (D-06 error resilience pattern)

### Pricing Data
- `src/app/(public)/pricing/pricingData.js` — Tier names and limits for email templates

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **sendOwnerSMS()** / **sendOwnerEmail()**: Twilio + Resend client wrappers with lazy initialization. Billing notifications follow same pattern.
- **NewLeadEmail**: React email template with Resend. Trial reminder emails extend this pattern.
- **Cron route structure**: /api/cron/send-recovery-sms provides the exact blueprint for /api/cron/trial-reminders (CRON_SECRET auth, Supabase query, iterate + send).
- **handleTrialWillEnd()** and **handleInvoicePaymentFailed()**: Stub functions in Stripe webhook handler — just need implementation bodies added.

### Established Patterns
- **Middleware gating**: src/middleware.js uses Supabase SSR client to check user state and redirect. Subscription check follows same approach.
- **Webhook → notification**: Retell webhook → processCallEnded → sendOwnerNotifications pattern. Stripe webhook → handleInvoicePaymentFailed → send billing notifications follows same structure.
- **Migration RLS**: service_role-only for webhook-written tables. billing_notifications table follows same pattern.

### Integration Points
- **Middleware** (`src/middleware.js`): Add subscription status check after auth check, before onboarding check. Query subscriptions table for is_current=true row.
- **Dashboard layout**: Past_due warning banner component added to the dashboard layout wrapper.
- **Stripe webhook handler** (`src/app/api/stripe/webhook/route.js`): Fill in handleTrialWillEnd() and handleInvoicePaymentFailed() stubs.
- **vercel.json**: Add trial-reminders cron schedule.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 24-subscription-lifecycle-and-notifications*
*Context gathered: 2026-03-27*

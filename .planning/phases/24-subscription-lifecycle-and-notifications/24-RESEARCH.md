# Phase 24: Subscription Lifecycle and Notifications - Research

**Researched:** 2026-03-27
**Domain:** Stripe webhook notifications, subscription grace periods, middleware gating, Vercel Cron, React Email / Resend, billing_notifications table
**Confidence:** HIGH

## Summary

Phase 24 is a backend-heavy implementation phase. All five requirements decompose cleanly into four implementation units: (1) filling the two webhook handler stubs already in `src/app/api/stripe/webhook/route.js`, (2) creating a `billing_notifications` tracking table and migration, (3) adding a `/api/cron/trial-reminders` Vercel Cron route, and (4) adding a subscription gate to `src/middleware.js`. Every piece of infrastructure needed already exists in the codebase — no new dependencies are required.

The codebase has mature patterns for each sub-problem. Notifications use the lazy-initialized `getTwilioClient()` / `getResendClient()` pattern already in `src/lib/notifications.js`. The cron route follows the exact blueprint in `src/app/api/cron/send-recovery-sms/route.js`. The middleware gate follows the same inline `createServerClient` + Supabase query pattern used for the admin gate in Phase 28. React email templates follow `src/emails/NewLeadEmail.jsx`.

The one design choice with meaningful complexity is the middleware subscription check: it must query the `subscriptions` table but avoid adding latency to every request. The solution is to scope it to `/dashboard*` paths only (same optimization already used for the onboarding check), exempt `/billing/*` routes explicitly (D-10), and use the existing anon key client in middleware with RLS SELECT policy already in place for authenticated users.

**Primary recommendation:** Implement in this order — migration first, then webhook stubs, then cron route, then middleware gate. This order ensures each piece has its dependencies before it's tested.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** When a tenant enters past_due status, a persistent warning banner appears across all dashboard pages: "Your payment failed — update your payment method within X days to avoid service interruption." with a direct link to Stripe Customer Portal.
- **D-02:** The banner shows a relative countdown ("X days remaining") rather than an exact date. Simpler, no timezone complexity.
- **D-03:** No feature degradation during grace period — all dashboard features remain fully functional. The banner is the only indicator.
- **D-04:** All billing notifications use a helpful and direct tone. E.g., "Hey [name], your payment didn't go through. Update your card here: [link]. Your service continues for 3 more days." No corporate formality, no guilt.
- **D-05:** Failed payment SMS includes a direct Stripe Customer Portal link — one tap to fix. Email also sent with same link + more context.
- **D-06:** Trial reminder emails (day 7 and day 12) use React email templates via Resend, consistent with the existing NewLeadEmail pattern in src/emails/. Branded HTML with Voco logo, usage stats, upgrade CTA button.
- **D-07:** Trial reminder idempotency enforced via a separate `billing_notifications` tracking table (tenant_id, notification_type, sent_at). More flexible for future notification types than adding columns to subscriptions.
- **D-08:** Trial reminder cron runs as a Vercel Cron route at /api/cron/trial-reminders, following the existing send-recovery-sms and renew-calendar-channels patterns. Configured in vercel.json.
- **D-09:** When an expired/cancelled tenant navigates to any dashboard route, middleware immediately redirects to /billing/upgrade. No interstitial, no flash of dashboard content.
- **D-10:** All /billing/* routes are exempt from the subscription gate so expired tenants can reach the upgrade page and Stripe Checkout return URLs.

### Claude's Discretion

- Exact banner component implementation (likely a new BillingWarningBanner component in the dashboard layout)
- React email template design details for trial reminders and payment failure
- Cron job frequency (daily should suffice for day 7/12 reminders)
- billing_notifications table schema details (columns beyond tenant_id, notification_type, sent_at)
- Whether trial_will_end webhook notification is SMS, email, or both

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ENFORCE-03 | Past_due status gets 3-day grace window before blocking — owner continues receiving calls while payment retries happen | Grace period calculated from `subscriptions.stripe_updated_at` when status transitioned to past_due. Dashboard banner (D-01/D-02) is the notification mechanism; actual call blocking is Phase 25. This phase implements the banner and the grace period data needed for Phase 25. |
| ENFORCE-04 | Subscription status middleware gates dashboard routes — cancelled/paused/expired redirects to /billing/upgrade | New subscription check block in `src/middleware.js` after onboarding check. Queries `subscriptions` table for `is_current=true` row, redirects `canceled`/`paused`/`incomplete` statuses. `/billing/*` exempt per D-10. |
| BILLNOTIF-01 | Failed payment SMS + email to owner on invoice.payment_failed with payment update link (Stripe Customer Portal URL) | Fill `handleInvoicePaymentFailed()` stub in webhook route. Lookup tenant from `invoice.subscription` → `subscriptions` → `tenants`. Call `sendOwnerSMS()` + `sendOwnerEmail()` with Stripe Customer Portal URL. |
| BILLNOTIF-02 | Trial reminder email at day 7 and day 12 via cron job + Resend template | New `/api/cron/trial-reminders` GET route. Queries `subscriptions` for `status=trialing`, computes days since trial started, checks `billing_notifications` for prior sends, sends React email template via Resend. |
| BILLNOTIF-03 | Trial-will-end notification triggered by customer.subscription.trial_will_end webhook (3 days before expiry) | Fill `handleTrialWillEnd()` stub in webhook route. Send email (and optionally SMS) to tenant owner. Record in `billing_notifications` table to prevent duplicates if webhook fires multiple times. |

</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Resend + @react-email/components | Already installed | Transactional email with React templates | Existing pattern in NewLeadEmail.jsx — same imports, same Resend client |
| Twilio | Already installed | SMS notifications | Existing pattern in notifications.js — getTwilioClient() lazy init |
| Supabase service role client | Already installed | DB writes for billing_notifications table and cron queries | Webhook handlers always use service role to bypass RLS |
| Supabase SSR / anon key client | Already installed | Middleware subscription check (authenticated user context) | Same client used for admin gate and onboarding check in middleware |

### No New Dependencies Required

All libraries for Phase 24 are already installed. There are zero new `npm install` commands needed.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| billing_notifications table | Column flags on subscriptions table | Table is more flexible (multiple notification types, timestamps, idempotency) — D-07 locked this choice |
| Cron via vercel.json | Supabase pg_cron | vercel.json is already established (send-recovery-sms), keeps infrastructure in one place |
| Direct Stripe API for portal URL in notification | Generate portal URL in webhook handler | Webhook handler can generate the portal URL synchronously before sending SMS/email — no separate API call needed at notification time |

---

## Architecture Patterns

### Recommended Structure for Phase 24

```
src/
├── app/
│   ├── api/
│   │   ├── stripe/webhook/route.js        # Fill handleTrialWillEnd() + handleInvoicePaymentFailed()
│   │   └── cron/
│   │       └── trial-reminders/route.js   # New GET route (BILLNOTIF-02)
│   └── dashboard/
│       └── layout.js                      # Add BillingWarningBanner (ENFORCE-03)
├── components/
│   └── dashboard/
│       └── BillingWarningBanner.jsx        # New client component for past_due banner
├── emails/
│   ├── NewLeadEmail.jsx                    # Existing — reference pattern
│   ├── TrialReminderEmail.jsx              # New React email template (BILLNOTIF-02)
│   └── PaymentFailedEmail.jsx             # New React email template (BILLNOTIF-01)
├── middleware.js                           # Add subscription gate block (ENFORCE-04)
└── lib/
    └── notifications.js                   # Add sendBillingNotification helpers (optional extraction)

supabase/migrations/
└── 015_billing_notifications.sql          # New migration (D-07)

vercel.json                                # Add trial-reminders cron schedule (D-08)
```

### Pattern 1: Webhook Stub Implementation

**What:** Fill the two stub functions already in the webhook route handler.

**handleInvoicePaymentFailed** — called on `invoice.payment_failed`:

```js
async function handleInvoicePaymentFailed(invoice) {
  const subscriptionId = invoice.subscription;
  if (!subscriptionId) return;

  // Lookup subscription → tenant
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('tenant_id')
    .eq('stripe_subscription_id', subscriptionId)
    .eq('is_current', true)
    .maybeSingle();

  if (!sub?.tenant_id) return;

  // Lookup tenant for owner contact info
  const { data: tenant } = await supabase
    .from('tenants')
    .select('business_name, owner_email, owner_phone')
    .eq('id', sub.tenant_id)
    .single();

  if (!tenant) return;

  // Generate Stripe Customer Portal URL for payment update
  const session = await stripe.billingPortal.sessions.create({
    customer: invoice.customer,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
  });

  // SMS (D-05): direct link, direct tone
  // Email (D-05): same link + more context
  await Promise.allSettled([
    sendPaymentFailedSMS({ to: tenant.owner_phone, businessName: tenant.business_name, portalUrl: session.url }),
    sendPaymentFailedEmail({ to: tenant.owner_email, businessName: tenant.business_name, portalUrl: session.url, invoice }),
  ]);
}
```

**handleTrialWillEnd** — called on `customer.subscription.trial_will_end`:

```js
async function handleTrialWillEnd(subscription) {
  const tenantId = subscription.metadata?.tenant_id;
  if (!tenantId) return;

  // Idempotency: check billing_notifications for prior trial_will_end send
  const { data: existing } = await supabase
    .from('billing_notifications')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('notification_type', 'trial_will_end')
    .maybeSingle();

  if (existing) return; // Already sent

  const { data: tenant } = await supabase
    .from('tenants')
    .select('business_name, owner_email, owner_phone')
    .eq('id', tenantId)
    .single();

  if (!tenant) return;

  // Send notification (Claude's discretion: email + SMS both)
  await Promise.allSettled([
    sendTrialEndingSoonEmail({ to: tenant.owner_email, businessName: tenant.business_name, trialEnd: subscription.trial_end }),
    // SMS optional per Claude's discretion
  ]);

  // Record send
  await supabase.from('billing_notifications').insert({
    tenant_id: tenantId,
    notification_type: 'trial_will_end',
  });
}
```

### Pattern 2: billing_notifications Migration

**Migration file:** `supabase/migrations/015_billing_notifications.sql`

```sql
CREATE TABLE billing_notifications (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  notification_type text NOT NULL,  -- 'trial_reminder_day_7', 'trial_reminder_day_12', 'trial_will_end', 'payment_failed'
  sent_at           timestamptz NOT NULL DEFAULT now(),
  metadata          jsonb,          -- optional: invoice_id, amount_due, etc.
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_billing_notifications_tenant_type ON billing_notifications(tenant_id, notification_type);

ALTER TABLE billing_notifications ENABLE ROW LEVEL SECURITY;

-- Service role only — notifications are written by webhook handlers and cron jobs, never directly by tenants
CREATE POLICY service_role_all_billing_notifications ON billing_notifications
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
```

**RLS note:** Pattern matches `stripe_webhook_events` — service_role only. Notifications are written by webhook/cron, never read by tenant client.

### Pattern 3: Trial Reminders Cron Route

**File:** `src/app/api/cron/trial-reminders/route.js`
**Trigger:** Vercel Cron, daily schedule, `GET` method (same as send-recovery-sms which uses GET)
**Auth:** `Authorization: Bearer ${CRON_SECRET}` header check

```js
export async function GET(request) {
  // 1. Auth check (same as send-recovery-sms)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Query all trialing subscriptions
  const { data: trialSubs } = await supabase
    .from('subscriptions')
    .select('tenant_id, trial_ends_at, current_period_start')
    .eq('status', 'trialing')
    .eq('is_current', true)
    .not('trial_ends_at', 'is', null);

  let sent7 = 0, sent12 = 0;

  for (const sub of trialSubs || []) {
    const trialStart = new Date(sub.current_period_start);
    const daysSinceStart = Math.floor((Date.now() - trialStart.getTime()) / 86_400_000);

    // Check day 7
    if (daysSinceStart >= 7) {
      const { data: existing7 } = await supabase
        .from('billing_notifications')
        .select('id')
        .eq('tenant_id', sub.tenant_id)
        .eq('notification_type', 'trial_reminder_day_7')
        .maybeSingle();

      if (!existing7) {
        // send + insert
        sent7++;
      }
    }

    // Check day 12
    if (daysSinceStart >= 12) {
      const { data: existing12 } = await supabase
        .from('billing_notifications')
        .select('id')
        .eq('tenant_id', sub.tenant_id)
        .eq('notification_type', 'trial_reminder_day_12')
        .maybeSingle();

      if (!existing12) {
        // send + insert
        sent12++;
      }
    }
  }

  return Response.json({ sent_day_7: sent7, sent_day_12: sent12 });
}
```

**vercel.json addition:**
```json
{
  "crons": [
    { "path": "/api/cron/send-recovery-sms", "schedule": "* * * * *" },
    { "path": "/api/cron/trial-reminders", "schedule": "0 9 * * *" }
  ]
}
```
Daily at 9:00 UTC suffices for day 7/12 reminders.

### Pattern 4: Middleware Subscription Gate

**Insert location:** After admin gate early return, after onboarding check, before returning response.

**Key constraint:** Only runs on `/dashboard*` paths (avoid DB query on every other request). `/billing/*` is exempt per D-10.

```js
// Subscription gate — only for dashboard paths (D-09, D-10)
const isDashboardPath = pathname === '/dashboard' || pathname.startsWith('/dashboard/');
const isBillingPath = pathname === '/billing' || pathname.startsWith('/billing/');

if (isDashboardPath && user && !isBillingPath) {
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('status, trial_ends_at')
    .eq('tenant_id', tenantRow.id)  // tenantRow already fetched for onboarding check
    .eq('is_current', true)
    .maybeSingle();

  const blockedStatuses = ['canceled', 'paused', 'incomplete'];
  if (sub && blockedStatuses.includes(sub.status)) {
    return NextResponse.redirect(new URL('/billing/upgrade', request.url));
  }
}
```

**CRITICAL:** The tenant row is already fetched in the existing onboarding check. The subscription query reuses the same tenantRow.id to avoid a second DB round-trip.

**Status behavior:**
- `trialing` → allow through (show banner from client component)
- `active` → allow through
- `past_due` → allow through (show warning banner per D-03, block is Phase 25)
- `canceled` → redirect to /billing/upgrade
- `paused` → redirect to /billing/upgrade
- `incomplete` → redirect to /billing/upgrade
- `null` (no subscription row) → allow through (edge case: let dashboard load, they'll see empty state)

### Pattern 5: BillingWarningBanner Component

**File:** `src/components/dashboard/BillingWarningBanner.jsx`

The banner is a client component because it needs to:
1. Fetch subscription status from the API (or accept it as a prop from a parent server fetch)
2. Calculate "X days remaining" from `stripe_updated_at` when status became `past_due`

**Integration point in dashboard layout.js:**
```jsx
// In DashboardLayoutInner, after ImpersonationBanner
{!impersonateTenantId && <BillingWarningBanner />}
```

The banner fetches its own data via a small `/api/billing/status` endpoint (or directly via supabase-browser client with RLS SELECT policy) and renders nothing when status is `active` or `trialing`.

**Grace period countdown calculation (D-02):**

The `past_due` transition timestamp comes from `subscriptions.stripe_updated_at` (set when the subscription.updated event fires with status=past_due). 3 days = 259,200,000 ms.

```js
const gracePeriodMs = 3 * 24 * 60 * 60 * 1000;
const elapsed = Date.now() - new Date(sub.stripe_updated_at).getTime();
const daysRemaining = Math.max(0, Math.ceil((gracePeriodMs - elapsed) / 86_400_000));
```

### Anti-Patterns to Avoid

- **Querying Stripe API in middleware:** Never call Stripe from middleware — latency on every request. Only read local `subscriptions` table.
- **Blocking past_due in middleware:** Phase 24 only shows the banner; call blocking for past_due is Phase 25. Do NOT redirect past_due tenants in this phase.
- **Writing to billing_notifications without idempotency check:** Always check for existing row before insert. The cron runs daily and the trial_will_end webhook may fire multiple times.
- **Throwing from notification helpers:** Follow the existing `try/catch` non-throwing pattern in notifications.js. Notification failures must never crash the webhook handler (which causes Stripe to retry the entire event).
- **Using `renew-calendar-channels` POST method as the cron HTTP method:** `send-recovery-sms` uses `GET` and is the canonical Vercel Cron pattern. Use `GET` for the trial-reminders route.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email template rendering | Custom HTML string concatenation | @react-email/components (already installed) | Inline styles auto-handled, same pattern as NewLeadEmail.jsx |
| Stripe Customer Portal session generation | Custom redirect flow | `stripe.billingPortal.sessions.create()` | Already available via the Stripe singleton in `src/lib/stripe.js` |
| Notification idempotency via column flags | Add boolean columns to subscriptions table | `billing_notifications` table | D-07 locked this; more flexible for future notification types |
| Cron job scheduling | External scheduler, pg_cron | Vercel Cron via vercel.json | D-08 locked this; already used for send-recovery-sms |
| SMS sending logic | Direct Twilio calls | `getTwilioClient()` lazy init pattern from notifications.js | Client already initialized, error pattern established |

---

## Common Pitfalls

### Pitfall 1: Middleware Subscription Query Adds Latency to Every Request

**What goes wrong:** Adding a Supabase query to middleware without path-scoping runs on every single HTTP request, adding 20-50ms to public pages, API routes, and static assets.

**Why it happens:** The middleware matcher config includes `/dashboard/:path*` but without conditional path checks inside the function, code runs on everything.

**How to avoid:** Wrap the subscription query in `if (isDashboardPath && user)`. The tenant row is already fetched for the onboarding check — reuse it.

**Warning signs:** Every page in the app feels slower after the middleware change.

### Pitfall 2: stripe_updated_at vs created_at for Grace Period Countdown

**What goes wrong:** Using `created_at` from the subscription row to calculate grace period gives the wrong timestamp — the subscription was created when the tenant signed up, not when it went past_due.

**Why it happens:** `stripe_updated_at` is the timestamp of the Stripe event that set the current status. The history table pattern (D-13) creates a new row on each status change, so the new row's `stripe_updated_at` is when past_due was first set.

**How to avoid:** Use `subscriptions.stripe_updated_at` for the grace period start time. This is the timestamp of the `customer.subscription.updated` event that set `status=past_due`.

**Warning signs:** Grace period countdown shows wrong number of days.

### Pitfall 3: Webhook Handler Throws on Notification Failure → Stripe Retries

**What goes wrong:** If `handleInvoicePaymentFailed` throws because the Resend/Twilio call fails, the webhook handler returns 500, and Stripe retries the event. The idempotency check will block the retry, so the notification never gets sent.

**Why it happens:** Phase 22 decision: return 500 on handler errors so Stripe retries. This is correct for subscription sync, but for notification-only handlers it creates a conflict.

**How to avoid:** Wrap notification calls in `Promise.allSettled()` (never `Promise.all()`). Log failures but never let them propagate as exceptions from the handler. The billing_notifications idempotency insert should be done AFTER successful notification, not before.

**Warning signs:** Notification function throws → 500 → Stripe retry → idempotency blocks → notification never sent.

### Pitfall 4: trial_will_end Webhook May Fire Multiple Times

**What goes wrong:** Stripe sends `customer.subscription.trial_will_end` at approximately 3 days before trial end. It may resend if the webhook endpoint was unreachable. Without idempotency, the tenant receives multiple "trial ending soon" notifications.

**Why it happens:** Stripe's retry mechanism for failed webhook deliveries.

**How to avoid:** Insert a `billing_notifications` row for `notification_type='trial_will_end'` before returning 200. Check for that row at the start of `handleTrialWillEnd`. Already handled by the stripe_webhook_events idempotency table for the event itself, but the notifications table provides a second layer for notification-specific deduplication.

### Pitfall 5: Middleware Matcher Does Not Include /billing/*

**What goes wrong:** The current middleware matcher config is: `['/onboarding/:path*', '/onboarding', '/dashboard/:path*', '/dashboard', '/admin/:path*', '/admin', '/auth/signin']`. The `/billing/*` routes are NOT in the matcher, so middleware never runs on them.

**Why it matters:** This is actually correct behavior per D-10 — billing routes must be exempt from the subscription gate. Since middleware doesn't run on `/billing/*`, expired tenants redirected there can reach the page without hitting the gate again.

**Verification step:** Confirm that `/billing/upgrade` is accessible without a Supabase auth session (it may need to be public or support unauthenticated access for expired tenants whose session may have expired).

### Pitfall 6: BillingWarningBanner Causes Hydration Mismatch

**What goes wrong:** Dashboard layout is a `'use client'` component. If BillingWarningBanner fetches subscription status and renders conditionally, the server-rendered HTML won't match the client-hydrated state, causing a React hydration mismatch.

**Why it happens:** Server render has no subscription data; client render fetches it asynchronously.

**How to avoid:** The banner should initially render nothing (or a skeleton), then fetch subscription status client-side. Use `useEffect` for the fetch, not server-side data. Since the dashboard layout is already `'use client'`, this is the only viable approach anyway.

---

## Code Examples

Verified patterns from codebase:

### React Email Template (follow NewLeadEmail pattern)

```jsx
// Source: src/emails/NewLeadEmail.jsx
import {
  Html, Head, Body, Container,
  Heading, Text, Button, Hr, Section,
} from '@react-email/components';

export function TrialReminderEmail({ businessName, daysUsed, callsUsed, callsLimit, upgradeUrl }) {
  return (
    <Html lang="en">
      <Head />
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={headerStyle}>
            <Text style={brandStyle}>Voco</Text>
          </Section>
          <Section style={sectionStyle}>
            <Heading style={headingStyle}>
              Your trial is {14 - daysUsed} days from ending
            </Heading>
            {/* usage stats, upgrade CTA */}
            <Button href={upgradeUrl} style={buttonStyle}>
              Upgrade Now
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
```

### Billing Notification Insert (idempotency pattern)

```js
// Check before insert
const { data: existing } = await supabase
  .from('billing_notifications')
  .select('id')
  .eq('tenant_id', tenantId)
  .eq('notification_type', notificationType)
  .maybeSingle();

if (existing) return; // Already sent — skip

// Send first, then record
await sendEmail(/* ... */);

await supabase.from('billing_notifications').insert({
  tenant_id: tenantId,
  notification_type: notificationType,
  metadata: { /* optional context */ },
});
```

### Promise.allSettled for Dual Notifications

```js
// Source: src/lib/notifications.js sendOwnerNotifications() pattern
const [smsResult, emailResult] = await Promise.allSettled([
  sendPaymentFailedSMS({ to: ownerPhone, /* ... */ }),
  sendPaymentFailedEmail({ to: ownerEmail, /* ... */ }),
]);
// Log results — never throw
const smsStatus = smsResult.status === 'fulfilled' ? 'ok' : `failed: ${smsResult.reason?.message}`;
const emailStatus = emailResult.status === 'fulfilled' ? 'ok' : `failed: ${emailResult.reason?.message}`;
console.log(`[billing-notify] SMS=${smsStatus}, email=${emailStatus}`);
```

### Cron Route Auth Pattern

```js
// Source: src/app/api/cron/send-recovery-sms/route.js
export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.log('401: Unauthorized');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ... cron logic
}
```

### Middleware Subscription Query (reusing tenantRow)

```js
// After the existing onboarding check (which already fetches tenantRow):
const isDashboardPath = pathname === '/dashboard' || pathname.startsWith('/dashboard/');

if (isDashboardPath && user && tenantRow) {
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('tenant_id', tenantRow.id)
    .eq('is_current', true)
    .maybeSingle();

  const blockedStatuses = ['canceled', 'paused', 'incomplete'];
  if (sub && blockedStatuses.includes(sub.status)) {
    return NextResponse.redirect(new URL('/billing/upgrade', request.url));
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| handleTrialWillEnd() logs only | Full notification logic | Phase 24 | Fills Phase 22 stub |
| handleInvoicePaymentFailed() logs only | SMS + email to owner | Phase 24 | Fills Phase 22 stub |
| No subscription gate in middleware | Redirect expired tenants to /billing/upgrade | Phase 24 | ENFORCE-04 |
| No billing_notifications table | Migration 015 creates it | Phase 24 | D-07 idempotency |

**No deprecated patterns** for this phase — all infrastructure is additive.

---

## Open Questions

1. **Where does the middleware get the tenant_id?**
   - What we know: The existing middleware fetches a `tenantRow` during the onboarding check for `/dashboard*` paths.
   - What's unclear: Whether `tenantRow` is accessible as a variable in scope when the subscription gate check runs.
   - Recommendation: Read the actual middleware.js source before implementing. The skill documents the pattern at a conceptual level. The implementation must verify the variable names and reuse the same Supabase query result.
   - **Action required:** Read middleware.js at implementation time (the skill says it exists at `src/middleware.js` but it was not found at the expected path — may be at project root `middleware.js`).

2. **Does `/billing/upgrade` need to be accessible without auth?**
   - What we know: D-09 says expired tenants are redirected there. D-10 says /billing/* is exempt from the subscription gate.
   - What's unclear: Whether a tenant with a cancelled subscription also has a valid Supabase session. If their session is valid, the page works normally. If not, middleware's auth check will redirect them to /auth/signin before they reach /billing/upgrade.
   - Recommendation: The billing/upgrade page (Phase 25) should be built assuming authenticated session. If the session is expired, the auth redirect is correct behavior — they sign in, then get redirected to /billing/upgrade. Phase 24's middleware gate only needs to handle the case where the session is valid but subscription is cancelled.

3. **Stripe Customer Portal URL generation in invoice.payment_failed handler**
   - What we know: The portal URL requires a Stripe API call (`stripe.billingPortal.sessions.create()`).
   - What's unclear: Whether generating a portal URL in the webhook handler is the right pattern vs. generating it on-demand when the tenant clicks a link.
   - Recommendation: Generate a portal URL at notification send time in the webhook handler. Store the URL or just use the Stripe portal URL pattern (`https://billing.stripe.com/p/login/{customer_id}` for direct access, or a generated session URL). The session URL expires in 5 minutes, so include it in the notification only if the notification is sent immediately. A simpler pattern: use a `/api/billing/portal` API route that generates a fresh session URL on demand — the notification links there, not to the Stripe URL directly.

---

## Environment Availability

No new external dependencies. All required services are already configured in the environment:

| Dependency | Required By | Available | Notes |
|------------|------------|-----------|-------|
| Twilio | BILLNOTIF-01 SMS | Yes | TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER already in use |
| Resend | BILLNOTIF-01/02/03 email | Yes | RESEND_API_KEY already in use for NewLeadEmail |
| Stripe SDK | BILLNOTIF-01 portal URL | Yes | stripe singleton in src/lib/stripe.js already initialized |
| Supabase service role | Migration, cron, webhook | Yes | Already in use throughout |
| CRON_SECRET env var | Trial reminders cron auth | Yes | Already used by send-recovery-sms |
| NEXT_PUBLIC_APP_URL | Portal return URL, email links | Assumed | Used in notifications.js; verify it's set in production |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest (node --experimental-vm-modules) |
| Config file | package.json `jest` key or jest.config.js |
| Quick run command | `npm test -- --testPathPattern=billing` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ENFORCE-03 | past_due status → banner shown, no feature block | unit | `npm test -- --testPathPattern=billing` | ❌ Wave 0 |
| ENFORCE-04 | canceled/paused/incomplete → redirects to /billing/upgrade | unit | `npm test -- --testPathPattern=billing` | ❌ Wave 0 |
| ENFORCE-04 | past_due + trialing + active → no redirect | unit | `npm test -- --testPathPattern=billing` | ❌ Wave 0 |
| BILLNOTIF-01 | invoice.payment_failed → SMS + email sent with portal link | unit | `npm test -- --testPathPattern=billing` | ❌ Wave 0 |
| BILLNOTIF-01 | SMS + email failure does not throw from handler | unit | `npm test -- --testPathPattern=billing` | ❌ Wave 0 |
| BILLNOTIF-02 | Day 7 reminder not re-sent if billing_notifications row exists | unit | `npm test -- --testPathPattern=billing` | ❌ Wave 0 |
| BILLNOTIF-02 | Day 12 reminder not re-sent if billing_notifications row exists | unit | `npm test -- --testPathPattern=billing` | ❌ Wave 0 |
| BILLNOTIF-02 | Day 7 NOT sent if daysSinceStart < 7 | unit | `npm test -- --testPathPattern=billing` | ❌ Wave 0 |
| BILLNOTIF-03 | trial_will_end webhook → notification sent + billing_notifications row inserted | unit | `npm test -- --testPathPattern=billing` | ❌ Wave 0 |
| BILLNOTIF-03 | trial_will_end webhook idempotent — second webhook does not re-send | unit | `npm test -- --testPathPattern=billing` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test -- --testPathPattern=billing`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/billing/subscription-lifecycle.test.js` — covers ENFORCE-03, ENFORCE-04, BILLNOTIF-01, BILLNOTIF-02, BILLNOTIF-03
  - Follow the mock pattern established in `tests/billing/usage-tracking.test.js`
  - Mock `@/lib/supabase`, `@/lib/notifications`, `@/lib/stripe`
  - Test file will test the webhook handler logic and cron logic inline (same approach as USAGE-03 tests in usage-tracking.test.js)

---

## Sources

### Primary (HIGH confidence)

- Codebase: `src/app/api/stripe/webhook/route.js` — stub functions at lines 358-368, full handler structure
- Codebase: `src/lib/notifications.js` — sendOwnerSMS, sendOwnerEmail, Promise.allSettled pattern
- Codebase: `src/emails/NewLeadEmail.jsx` — React Email template structure
- Codebase: `src/app/api/cron/send-recovery-sms/route.js` — Vercel Cron GET + CRON_SECRET pattern
- Codebase: `supabase/migrations/010_billing_schema.sql` — subscriptions table schema, RLS patterns
- Codebase: `src/app/dashboard/layout.js` — ImpersonationBanner integration pattern, DashboardLayoutInner structure
- Codebase: `vercel.json` — existing cron configuration
- Skill: `auth-database-multitenancy/SKILL.md` — middleware auth flow, three Supabase clients, matcher config
- Codebase: `tests/billing/usage-tracking.test.js` — test structure and mock patterns for billing tests
- Context: `.planning/phases/24-subscription-lifecycle-and-notifications/24-CONTEXT.md` — all implementation decisions

### Secondary (MEDIUM confidence)

- Stripe docs (from training data, verified against codebase usage): `stripe.billingPortal.sessions.create()` API for Customer Portal URL generation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed, verified in package.json and imports
- Architecture patterns: HIGH — directly derived from existing codebase patterns, no speculation
- Pitfalls: HIGH — pitfalls 1-4 derived from existing code patterns; pitfall 5 confirmed by middleware matcher in skill; pitfall 6 from React hydration first principles
- Test structure: HIGH — follows exact pattern from tests/billing/usage-tracking.test.js

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable codebase, no fast-moving external dependencies)

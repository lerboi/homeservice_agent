# Verified Issues — Implementation Plans

## CRITICAL

### C2 — Service-role Supabase client bypasses RLS on all user API routes
**File:** `src/lib/supabase.js` imported by 18+ routes (leads, calls, appointments, services, zones, escalation-contacts, working-hours, notification-settings, dashboard/stats, calendar-sync/*, account, setup-checklist, etc.)
**Problem:** `src/lib/supabase.js` creates a client with `SUPABASE_SERVICE_ROLE_KEY`, bypassing all RLS. Every user-facing API route imports this client for data queries. Tenant isolation relies solely on `.eq('tenant_id', tenantId)` in JS — one missed filter leaks all tenants' data.
**Plan:**
1. In each user-facing API route, replace `import { supabase } from '@/lib/supabase'` with `import { createSupabaseServer } from '@/lib/supabase-server'` and call `const supabase = await createSupabaseServer()` at the top of each handler.
2. Keep the service-role import ONLY in: webhook handlers (`/api/stripe/webhook`, `/api/webhooks/*`), cron routes (`/api/cron/*`), admin routes, and `src/lib/leads.js` / `src/lib/scheduling/booking.js` (called from the Python agent server-to-server).
3. `getTenantId()` already uses `createSupabaseServer()` — no change needed there.
4. Test that each migrated route still returns correct data for the authenticated user.

---

### C3 — useMemo after conditional return — Rules of Hooks crash
**File:** `src/components/dashboard/AnalyticsCharts.jsx:150,160,171-173`
**Problem:** Two early returns (loading skeleton at line 150, "not enough data" at line 160) appear before three `useMemo` calls at lines 171-173. React requires hooks to be called unconditionally on every render. This will crash when data crosses the threshold.
**Plan:**
1. Move all three `useMemo` calls (lines 171-173) to BEFORE the first early return (before line 150).
2. The memos depend on `allLeads` which is derived from `leads` prop — this is available before the early returns.
3. The early returns can still reference the memoized values if needed, or simply return without using them.

---

### C4 — Open redirect via unvalidated `return_url` in billing portal
**File:** `src/app/api/billing/portal/route.js:50`
**Problem:** `returnPath` taken verbatim from query string, concatenated to app URL for Stripe portal return.
**Plan:**
1. Add an allowlist of valid return paths: `['/dashboard', '/dashboard/more/billing']`.
2. Validate `returnPath` against the allowlist. Default to `/dashboard/more/billing` if not in the list.

---

### C5 — Cron auth bypass when CRON_SECRET is unset
**Files:** `src/app/api/cron/send-recovery-sms/route.js:25`, `cron/trial-reminders/route.js:24`, `cron/renew-calendar-channels/route.js`
**Problem:** When `CRON_SECRET` is undefined, the expected token becomes `"Bearer undefined"`. Anyone sending that header passes the check.
**Plan:**
1. Add an early guard at the top of each cron handler: `if (!process.env.CRON_SECRET) return Response.json({ error: 'Not configured' }, { status: 500 })`.
2. Apply to all three cron files.

---

### C6 — Outlook token exchange drops refreshToken — tokens expire permanently
**File:** `src/lib/scheduling/outlook-calendar.js:87-99`
**Problem:** `exchangeCodeForTokens` returns `{ accessToken, account }` but omits `refreshToken`. The callback stores `undefined` for `refresh_token`. After access token expiry (~1 hour), Outlook sync silently dies.
**Plan:**
1. In `exchangeCodeForTokens`, add `refreshToken: tokenResponse.refreshToken` to the return object (alongside `accessToken` and `account`).
2. Verify the callback at `src/app/api/outlook-calendar/callback/route.js` already stores `tokenResponse.refreshToken` — it does, so once the return object is fixed, it will store the real value.

---

### C8 — Stripe overage billing broken — removed API in stripe>=10
**File:** `livekit-agent/src/post_call.py:133-141`, `pyproject.toml:17`
**Problem:** `stripe.SubscriptionItem.create_usage_record()` was removed in stripe>=10. The call raises `AttributeError`, silently swallowed. Overage billing does nothing.
**Plan:**
1. Replace `stripe.SubscriptionItem.create_usage_record(...)` with the Stripe Billing Meter V2 API: `stripe.billing.MeterEvent.create(...)`.
2. This requires a Meter to be set up in the Stripe Dashboard first (event name, aggregation formula, etc.).
3. Move `import stripe` to module top level and set `stripe.api_key` at load time.
4. Read `My Prompts/STRIPE-OVERAGE-SETUP-GUIDE.md` for the specific Meter setup needed before making the code change.

---

### C9 — Checkout webhook doesn't create subscription row — race condition
**File:** `src/app/api/stripe/webhook/route.js:209-254`
**Problem:** `handleCheckoutCompleted` sets `onboarding_complete = true` and provisions a phone, but never creates a subscription row. The subscription row only comes from the separate `customer.subscription.created` event. If `verify-checkout` polls between the two events, it returns `{ verified: false }`.
**Plan:**
1. At the end of `handleCheckoutCompleted`, after phone provisioning, retrieve the subscription from the session: `const subscription = await stripe.subscriptions.retrieve(session.subscription)`.
2. Call `handleSubscriptionEvent(subscription)` to create the subscription row immediately.
3. The idempotency in `handleSubscriptionEvent` (upsert on `stripe_subscription_id`) means the later `customer.subscription.created` event will just update the same row — no conflict.

---

### C7 — `book_appointment_atomic` + `assign_sg_number` callable by anonymous users
**Files:** `supabase/migrations/003_scheduling.sql:173`, `011_country_provisioning.sql:54`
**Problem:** Both functions are `SECURITY DEFINER` with no `REVOKE EXECUTE FROM PUBLIC`. Anon users can call them via `supabase.rpc()` to book appointments for any tenant or drain phone inventory.
**Plan:**
1. Create a new migration `supabase/migrations/025_lock_rpc_functions.sql`.
2. Add `REVOKE EXECUTE ON FUNCTION book_appointment_atomic FROM PUBLIC; GRANT EXECUTE ON FUNCTION book_appointment_atomic TO service_role;`.
3. Add `REVOKE EXECUTE ON FUNCTION assign_sg_number FROM PUBLIC; GRANT EXECUTE ON FUNCTION assign_sg_number TO service_role;`.
4. These functions are only called from service-role contexts (webhook handlers, Python agent), so no user-facing breakage.

---

### C11 — Missing /billing/upgrade page — blocked subscribers get 404
**File:** `src/proxy.js:136,144`
**Problem:** Proxy redirects cancelled/paused/incomplete subscribers to `/billing/upgrade`, which doesn't exist (404).
**Plan:**
1. Remove the redirect logic in `src/proxy.js` that sends users to `/billing/upgrade`.
2. Instead, let blocked subscribers through to the dashboard normally. The existing `BillingWarningBanner` component already handles showing billing warnings on the dashboard.
3. Specifically, remove/modify the redirect at lines 136 and 144 so they fall through to normal dashboard access.

---

## HIGH

### H6 — Dashboard Toaster never mounted — all toast notifications silently fail
**File:** `src/app/dashboard/layout.js`
**Problem:** `<Toaster>` from sonner is only mounted in `(public)/layout.js`. Dashboard components (LeadFlyout, CalendarSyncCard, EscalationChainSection, WorkingHoursEditor, ZoneManager, AppointmentFlyout, etc.) all call `toast()` but no `<Toaster>` exists in the dashboard layout tree.
**Plan:**
1. In `src/app/dashboard/layout.js`, import `Toaster` from `sonner`.
2. Add `<Toaster richColors position="top-right" />` inside the layout JSX (inside `DashboardLayoutInner`, before the closing fragment or after the main content wrapper).

---

### H7 — `_extract_field_from_transcript` always returns None — post-call leads have no name/job
**File:** `livekit-agent/src/post_call.py:335-339`
**Problem:** Stub function that unconditionally returns `None`. For calls where in-call tools weren't triggered, leads always have `caller_name=None` and `job_type=None` even when the transcript contains this data.
**Plan:**
1. Implement basic extraction logic in `_extract_field_from_transcript`.
2. For `caller_name`: scan assistant and user turns for patterns like "my name is X", "this is X calling", "I'm X". Return the extracted name.
3. For `job_type`: scan for service-related keywords matching the trade types (plumbing, HVAC, electrical, etc.) and common job descriptions.
4. Keep it simple — regex-based matching on transcript turns, no AI calls needed.

---

### H8 — capture_lead uses room name for UUID FK when call_uuid is None
**File:** `livekit-agent/src/tools/capture_lead.py:47`
**Problem:** `call_id=deps.get("call_uuid") or deps.get("call_id", "")` — when `call_uuid` is None, falls back to room name string. `lead_calls.call_id` is a UUID FK referencing `calls.id`. Causes silent FK violation.
**Plan:**
1. Change the fallback to `None` instead of `deps.get("call_id", "")`.
2. In `create_or_merge_lead` (or wherever `lead_calls` insert happens), skip the `lead_calls` insert entirely if `call_id` is `None`.
3. The lead is still created — it just won't have a `lead_calls` association for calls where the DB record wasn't created.

---

## MEDIUM

### M2 — Pricing CTA links to /pricing (self-referential)
**File:** `src/app/(public)/pricing/page.js:148`
**Problem:** "Start Free Trial" button links back to `/pricing` itself.
**Plan:**
1. Replace `<Link href="/pricing">` with a scroll-to-top action that smoothly scrolls to the pricing cards section.
2. Add an `id` attribute (e.g., `id="pricing-plans"`) to the pricing cards container if one doesn't exist.
3. Change the CTA to use `<a href="#pricing-plans">` or an `onClick` handler with `document.getElementById('pricing-plans').scrollIntoView({ behavior: 'smooth' })`.

---

### M4 — AppointmentFlyout "View Transcript" button has no onClick
**File:** `src/components/dashboard/AppointmentFlyout.js:196-202`
**Problem:** Button renders when `call.transcript_text` is truthy but has no `onClick` handler. Dead button.
**Plan:**
1. Add an `onClick` handler that toggles a local state to show/hide the transcript text.
2. Add a collapsible section below the button that renders `call.transcript_text` when expanded.
3. Toggle the button label between "View Transcript" and "Hide Transcript".

---

### M6 — WorkingHoursEditor lunch/no-lunch branches identical
**File:** `src/components/dashboard/WorkingHoursEditor.js:412-416`
**Problem:** Both branches of the ternary produce the same string — lunch break is never shown in the weekly overview.
**Plan:**
1. Change the lunch-enabled branch to show the split schedule, e.g.: `${formatTimeLabel(d.open)}-${formatTimeLabel(d.lunchStart)}, ${formatTimeLabel(d.lunchEnd)}-${formatTimeLabel(d.close)}`.
2. Keep the non-lunch branch as-is: `${formatTimeLabel(d.open)}-${formatTimeLabel(d.close)}`.

---

### M7 — LeadFlyout disabled-button operator precedence bug
**File:** `src/components/dashboard/LeadFlyout.jsx:439`
**Problem:** `disabled={saving || selectedStatus === lead.status && !revenueAmount}` — `&&` binds tighter than `||`, so the button is never disabled while `saving` is true if `revenueAmount` is truthy.
**Plan:**
1. Add parentheses to clarify intent: `disabled={saving || (selectedStatus === lead.status && !revenueAmount)}`.
2. This ensures: disabled when saving, OR when status hasn't changed and no revenue entered.

---

### M8 — Realtime INSERT ignores active filters on leads page
**File:** `src/app/dashboard/leads/page.js:132-137`
**Problem:** New leads from Realtime INSERT are unconditionally prepended regardless of active filter state.
**Plan:**
1. In the Realtime INSERT handler, check the new lead against current filters before adding it.
2. If `hasActiveFilters` is true, validate `payload.new` matches the active `filters` (status, urgency, search term).
3. Only prepend the lead if it matches, or if no filters are active.

---

### M9 — Analytics page fetches capped /api/leads (max 100)
**File:** `src/app/dashboard/analytics/page.js:14-22`, `src/app/api/leads/route.js:40`
**Problem:** Analytics page fetches `/api/leads` which has `.limit(100)`. Charts are truncated for tenants with >100 leads.
**Plan:**
1. Create a new endpoint `/api/analytics/leads` (or add a query param to `/api/leads`) that returns all leads without the 100 cap, selecting only the columns needed for charts (id, status, urgency, revenue, created_at, updated_at).
2. Alternatively, add `?limit=all` or `?limit=10000` support to the existing `/api/leads` route.
3. Update `analytics/page.js` to call the new/modified endpoint.

---

### M14 — Demo-voice rate limiter ineffective on serverless
**File:** `src/app/api/demo-voice/route.js:2-4`
**Problem:** In-memory `Map` resets per Vercel serverless cold start. Provides no real protection.
**Plan:**
1. Replace the in-memory Map with a Supabase-based rate check: query a `demo_rate_limits` table (or use the existing `usage_events` table) to check recent calls from the same IP.
2. Alternative: use Vercel KV (Redis) or Upstash Redis for atomic rate limiting.
3. Simplest approach: use Supabase RPC to check+insert an IP record with a timestamp, rejecting if one exists within the cooldown window.

---

### M19 — Missing .env.example — env vars undocumented
**Problem:** No `.env.example` file exists. `CRON_SECRET`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `OUTLOOK_WEBHOOK_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` are used in code but absent from `.env.local` and undocumented.
**Plan:**
1. Create `.env.example` at project root with all required environment variables, grouped by service.
2. Include every `process.env.*` reference found in the codebase, with placeholder values and comments.
3. Mark which ones are required vs optional.

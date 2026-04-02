# Voco — Verified Codebase Audit & Implementation Guide

**Date**: 2026-04-02
**Verified**: Every issue verified against actual source code with 7 parallel agents. False positives removed.
**Status**: Items marked ~~strikethrough~~ are either FIXED or FALSE POSITIVE — skip them.

---

## How to Use This Document

This document contains verified issues with exact implementation instructions. Each fix includes:
- The exact file(s) and line numbers
- What the current code looks like
- What to change and why
- What NOT to do (gotchas)

**Sections 1-6**: Code bugs and fixes (actionable)
**Sections 7-11**: Recommendations, UX suggestions, and architectural improvements (guidance only — implement at your discretion)

---

## BEFORE YOU START — Required Reading for Full Context

Before making ANY changes, read these files and skills to understand the architecture:

### Skill files (read ALL of these first):
1. `.claude/skills/auth-database-multitenancy/SKILL.md` — DB schema, 3 Supabase client types, RLS, getTenantId pattern
2. `.claude/skills/voice-call-architecture/SKILL.md` — call flow, triage, post-call pipeline, notifications
3. `.claude/skills/dashboard-crm-system/SKILL.md` — dashboard pages, lead lifecycle, design tokens
4. `.claude/skills/payment-architecture/SKILL.md` — Stripe webhooks, billing, subscriptions
5. `.claude/skills/scheduling-calendar-system/SKILL.md` — booking, calendar sync, slot calculation

### Key architecture files:
- `src/lib/supabase.js` — Service-role client (bypasses RLS, for webhooks/cron)
- `src/lib/supabase-server.js` — SSR server client (respects RLS, cookie-based auth)
- `src/lib/supabase-browser.js` — Browser client (anon key, for client components + Realtime)
- `src/lib/get-tenant-id.js` — Standard pattern for resolving tenant from auth session
- `src/lib/design-tokens.js` — `card`, `btn`, `heading`, `body` tokens used across all dashboard pages
- `src/lib/notifications.js` — Twilio SMS + Resend email (fire-and-forget, no retry)
- `src/lib/scheduling/slot-calculator.js` — Timezone-aware slot calculation with `date-fns-tz`

### Database schema:
- All migrations are in `supabase/migrations/` (001-032, numbered sequentially)
- `migration 009` defines `recovery_sms_status` CHECK constraint: `('pending', 'sent', 'failed', 'retrying')`
- `migration 027` shows the pattern for locking RPC functions (REVOKE/GRANT)
- `migration 029` creates invoice tables + `get_next_invoice_number` RPC
- `migration 030_estimates_schema.sql` creates estimate tables + `get_next_estimate_number` RPC

### Critical context:
- **Three Supabase clients**: API routes under `src/app/api/` use EITHER `supabase-server` (authenticated, respects RLS) OR `supabase` (service-role, bypasses RLS). Check the import at the top of each file before making changes.
- **Cron routes** (`src/app/api/cron/*`) use the service-role client (`@/lib/supabase`)
- **Regular API routes** (`src/app/api/invoices/`, etc.) use the server client (`@/lib/supabase-server`)
- **RPC functions** called via `.rpc()` run with the caller's role — if the route uses `supabase-server`, the RPC runs as `authenticated`, NOT `service_role`

---

## 1. Critical Bugs

### ~~1.1 Annual plan `calls_limit`~~ — FIXED
### ~~1.5 "No credit card required"~~ — FIXED
### ~~1.3 Invoice/Lead circular sync~~ — FALSE POSITIVE
`sync_source` guard in `src/lib/invoice-sync.js` correctly prevents loops.

### ~~1.2 AnimatePresence destroys page state on every navigation~~ — FIXED
Removed `mode="wait"` from AnimatePresence in `src/app/dashboard/layout.js`. Verified safe with framer-motion 12.38.0.

---

### ~~1.4 Recurring invoice generation creates empty invoices on line item failure~~ — FIXED
Added rollback delete of orphaned invoice on line item insert failure in `src/app/api/cron/recurring-invoices/route.js`. ON DELETE CASCADE confirmed in migration 029.

---

## 2. Security Concerns

### 2.1 No rate limiting on sensitive endpoints
**Severity**: CRITICAL — but requires Upstash Redis setup. Skip if not ready for infrastructure changes.

Unprotected endpoints: `/api/onboarding/sms-verify`, `/api/onboarding/provision-number`, `/api/billing/checkout-session`, `/api/onboarding/test-call`. `/api/demo-voice` has in-memory rate limit that resets on cold start.

### 2.2 No CSP headers
**Severity**: HIGH — Add `headers()` config to `next.config.js`.

### 2.3 OAuth state has no replay protection
**Files**: `src/app/api/google-calendar/auth/route.js`, `src/app/api/accounting/[provider]/auth/route.js`
HMAC state has no timestamp/nonce. Can be replayed.

### 2.4 HMAC uses service role key
**File**: `src/app/api/google-calendar/auth/route.js:12`
Should use dedicated `OAUTH_SIGNING_SECRET` instead of `SUPABASE_SERVICE_ROLE_KEY`.

### 2.5 CSRF relies on Supabase defaults only
SameSite=Lax by default. Low-medium risk. No action needed immediately.

### 2.6 Impersonation is CSS-only
**File**: `src/app/dashboard/layout.js:40`
`pointer-events-none opacity-60` can be bypassed. No server-side enforcement.

### 2.7 Client-side Supabase queries bypass API route patterns
- `dashboard/page.js:134` — `activity_log` direct query
- ~~`more/billing/page.js` — `tenants` + `subscriptions` direct query~~ — FIXED (6.6)
- `more/invoice-settings/page.js:47-55` — `tenants` table direct query
- `more/ai-voice-settings/page.js:14` — `tenants` table direct query

RLS protects these, but inconsistency makes auditing harder.

### 2.8 No explicit request size limits
Next.js has 1MB default. Defensive hardening, not critical.

### 2.9 Cron job endpoints use simple Bearer auth
CRON_SECRET is plain string comparison. Vercel infrastructure provides primary protection. Secondary defense only.

---

## 3. Backend / API Issues

### ~~3.1 Missing pagination on invoices and estimates~~ — FIXED
Added `limit` + `offset` query params with `range()` to `/api/invoices` and `/api/estimates` (default 50, max 500). Response includes `total_count`, `limit`, `offset`. `/api/calls` limit now configurable (default 200, max 500).

### 3.2 Missing input validation on some fields
- `/api/escalation-contacts` — `timeout_seconds` IS validated (OK)
- `/api/zones` — `postal_codes` not validated
- `/api/estimates` + `/api/invoices` — line items allow negative `quantity`/`unit_price`

### ~~3.3 JSON body parsing lacks error handling~~ — FIXED
Added try/catch with SyntaxError handling to all 8 `request.json()` calls across `services/route.js` (4) and `escalation-contacts/route.js` (4). Auth checks remain outside try/catch.

### 3.4 Missing max limit on inventory bulk endpoint
`/api/admin/inventory/bulk` has no max array size. `/api/invoices/batch-send` already has max 50 (OK).

### ~~3.5 Stripe webhook error handling~~ — FALSE POSITIVE
### ~~3.6 Debug test-error endpoint~~ — FALSE POSITIVE
### ~~3.7 Calendar conflict timezone~~ — FALSE POSITIVE
### ~~3.8 Inconsistent API response shapes~~ — FALSE POSITIVE

### ~~3.9 Missing env var: `OUTLOOK_WEBHOOK_SECRET`~~ — FIXED
Added to `.env.local`. Used by `outlook-calendar.js` and `outlook-calendar-push.js`.

### ~~3.10 Missing env var: `CRON_SECRET`~~ — FIXED
Added to `.env.local`. All 5 cron routes now have a valid secret. Must also be set in Vercel project settings for production.

---

## 4. Database Schema Issues

### 4.1 Missing `updated_at` triggers on key tables
Only `leads` has auto-trigger (`trg_leads_updated_at` from migration 024). These have `updated_at` columns but NO auto-update trigger:
- `invoices` (migration 029)
- `estimates` (migration 030_estimates)
- `escalation_contacts` (migration 006)
- `invoice_settings` (migration 029)

### 4.2 Missing index on `calls.status`
No index exists on `(tenant_id, status)`. Should add: `CREATE INDEX idx_calls_tenant_status ON calls(tenant_id, status);`

### ~~4.3 Address fields NOT NULL~~ — FALSE POSITIVE (intentionally nullable)
### ~~4.6 leads.primary_call_id orphaning~~ — FALSE POSITIVE (ON DELETE SET NULL is correct)
### ~~4.7 Zone travel buffers~~ — FALSE POSITIVE (app queries both directions)

### 4.4 Migration naming collision
Two files named `030_*`:
- `030_accounting_integrations.sql`
- `030_estimates_schema.sql`

Supabase runs migrations alphabetically. These are independent (no cross-dependencies), but the collision is fragile. **Note**: These have already been applied to the local dev database and likely production. Renaming now would require updating Supabase's migration history. Consider creating a note/comment file rather than renaming.

### ~~4.5 `get_next_invoice_number` and `get_next_estimate_number` not locked~~ — FIXED
Created `supabase/migrations/033_lock_counter_functions.sql`. REVOKE from PUBLIC, GRANT to both `service_role` and `authenticated`. Function signatures `(uuid, int)` verified against migrations 029/030.

---

## 5. Voice Agent / Call System Issues

### 5.1 No environment variable validation at startup
No startup validation. Missing env vars silently pass `undefined`. Not a quick fix — requires designing a validation module.

### ~~5.2 Phone number validation gap~~ — FIXED
Added `isValidE164()` helper to `notifications.js`. All SMS functions now validate E.164 format before calling Twilio. Invalid numbers return early with structured error instead of hitting the API.

### 5.3 Subscription gate fails open by design
`src/lib/subscription-gate.js:44-46` — documented as "D-06 error resilience". Intentional design choice.

### ~~5.4 Recovery SMS retry doesn't distinguish error types~~ — FIXED
Added `PERMANENT_ERROR_CODES` set (Twilio codes 21211, 21210, 21612, etc.) to `send-recovery-sms/route.js`. Both Branch A and Branch B now check error codes — permanent errors fail immediately without retrying.

### 5.5 Triage Layer 2 has 5s timeout
`src/lib/triage/layer2-llm.js:27` — `TIMEOUT_MS = 5000`. Falls back to `urgency: 'routine'` on timeout.

### 5.6 Test call rooms never cleaned up
`src/app/api/onboarding/test-call/route.js` — creates LiveKit room but never calls `roomService.deleteRoom()`.

### ~~5.7 Phone provisioning failure sends no notification~~ — FIXED
Added email notification in `stripe/webhook/route.js` after provisioning failure. Expanded tenant select to include `owner_email, owner_phone, business_name`. Fire-and-forget email via Resend.

### ~~5.8 Minor timezone edge case in available-slots route~~ — FIXED
Refactored `available-slots/route.js` to use `fromZonedTime` + `addDays` + `toZonedTime` from `date-fns-tz`. Date parsing moved outside loop, anchored to noon to avoid DST edge cases.

### ~~5.9 Recovery SMS marks short calls as "sent" (status lie)~~ — FIXED
Created `supabase/migrations/034_add_skipped_sms_status.sql` adding `'skipped'` to CHECK constraint. Updated `send-recovery-sms/route.js` lines 83 and 91 from `'sent'` to `'skipped'`. Dashboard badge (`calls/page.js:211`) only shows for `=== 'sent'` — no frontend change needed.

### ~~5.10 No retry logic on external API calls~~ — FIXED
Added `withRetry()` wrapper with exponential backoff (500ms/1s/2s) to all 4 SMS/email functions in `notifications.js`. Transient errors (429, 503, network) retry up to 3x. Permanent Twilio errors (21211, etc.) and validation errors (INVALID_PHONE, NO_PHONE) fail immediately.

---

## 6. Frontend Bugs & Code Quality

### ~~6.1 Some catch blocks silently swallow errors~~ — FIXED
- `dashboard/page.js` — already handled by 7.2 fix (Promise.allSettled with graceful degradation)
- `more/ai-voice-settings/page.js` — added error handling with `toast.error()`
- `calls/page.js` — added `error` state, error UI with retry button, proper `setError()` in catch

### 6.2 Inconsistent i18n usage
Only `services-pricing/page.js` uses `useTranslations('services')`. All other More pages use hardcoded English.

### ~~6.3 Sidebar and Bottom Tab Bar nav mismatch~~ — FIXED
Added Estimates tab with `ClipboardList` icon to `BottomTabBar.jsx`. Now matches sidebar exactly (7 items).

### ~~6.4 Redundant redirect pages~~ — PARTIALLY FIXED
Redirect pages kept (they serve as backwards-compatible URL aliases). Fixed 2 stale links pointing to old `/dashboard/settings#ai` path:
- `EmptyStateAnalytics.jsx` → now links to `/dashboard/more/ai-voice-settings`
- `EmptyStateLeads.jsx` → now links to `/dashboard/more/ai-voice-settings`

### ~~6.5 No React error boundary in dashboard layout~~ — FIXED
Created `src/app/dashboard/error.js` with `'use client'` directive and `error`/`reset` props. Colors match design tokens.

### ~~6.6 Billing page queries Supabase directly from client~~ — FIXED
Created `GET /api/billing/data` route that consolidates tenant + subscription lookup server-side. Billing page now uses `useSWRFetch` for both subscription and invoices — no more direct Supabase browser queries.

### 6.7 Invoice settings uploads logo directly from client
`more/invoice-settings/page.js:101-118` uploads to Supabase Storage from browser.

### ~~6.8 Service deletion has a timing race~~ — FIXED
Toast duration `4000` → `5000`, setTimeout `4100` → `5500` (500ms safety margin). In `services-pricing/page.js`.

### ~~6.9 Duplicate code: Invoices and Estimates pages~~ — FIXED
Extracted shared code: `useDocumentList` hook (SWR-based fetch + status filtering + summary caching), `DocumentListShell` components (StatusTabs, ListError, ListSkeleton, EmptyFiltered), and `format-utils.js` (formatAmount, formatDate). Both pages refactored to use shared hook + components while keeping unique features (sync indicators, recurring badges, tier pricing).

### ~~6.10 No debouncing on filter inputs~~ — FIXED
Added 300ms debounce to `calls/page.js` search input using same `setTimeout` + `useRef` pattern as `LeadFilterBar.jsx`. `leads/page.js` already had proper debouncing — no change needed.

### ~~6.11 No data caching (SWR/React Query)~~ — FIXED
Installed `swr@2.4.1`. Created `useSWRFetch` hook with stale-while-revalidate, focus revalidation, and request deduplication. Migrated invoices, estimates, and billing pages to SWR. Leads page intentionally kept as-is (uses Supabase Realtime which conflicts with SWR cache).

---

## 7. Performance Problems

### ~~7.2 Dashboard home makes sequential API calls~~ — FIXED
Refactored `loadActiveData()` in `dashboard/page.js` to use `Promise.allSettled()` for all 3 independent fetches. Supabase response `{data, error}` handled correctly vs fetch Response.

### ~~7.1 Missing pagination~~ — FIXED (see 3.1)
Added pagination to `/api/invoices` and `/api/estimates` (limit+offset+range). `/api/calls` limit now configurable.

### 7.3, 7.4, 7.5, 7.6
Remaining architectural improvements (caching, server-side aggregation). Not quick fixes.

---

## 8-11: UI/UX, Accessibility, Config (Recommendations)

These sections contain recommendations and guidance — not line-by-line fixes. Implement at your discretion. Key highlights:

- **More tab consolidation** (Section 9): Group 11 items into 4 sections with headers
- **Missing .env.example** (11.1): Create from `.env.local` with placeholder values
- **Hardcoded dev IP** (11.2): `next.config.js` line 2: `allowedDevOrigins: ['192.168.10.148']`
- **No structured logging** (11.9): 91 `console.error` calls, only 1 `Sentry.captureException` in entire codebase

---

## 12. Previously Found Payment Issues — ALL FIXED

- 12.1 Annual `calls_limit` — FIXED (480/1440/4800 for annual plans)
- 12.2 "No credit card required" copy — FIXED ("Cancel anytime")
- 12.3 `billing_notifications` cleanup — FIXED (deleted on cancellation)

---

## Quick-Win Fixes — ALL FIXED

All 11 quick-win fixes have been implemented and verified:

| # | Fix | Status |
|---|-----|--------|
| 1.2 | Remove `mode="wait"` | FIXED |
| 6.5 | Add error boundary | FIXED |
| 6.3 | Add Estimates to mobile nav | FIXED |
| 6.8 | Fix deletion timing | FIXED |
| 3.10 | Add CRON_SECRET | FIXED |
| 3.9 | Add OUTLOOK_WEBHOOK_SECRET | FIXED |
| 3.3 | JSON try/catch | FIXED |
| 7.2 | Parallelize home fetches | FIXED |
| 5.9 | Fix SMS status lie | FIXED |
| 1.4 | Rollback empty invoices | FIXED |
| 4.5 | Lock RPC functions | FIXED |

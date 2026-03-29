# Remaining Issues (Low only — all Medium issues resolved)

## Migrations to Apply

Run these two new migrations in order after applying 001-018:
- `supabase/migrations/019_appointments_exclusion_constraint.sql` — replaces UNIQUE with GiST exclusion constraint
- `supabase/migrations/020_billing_notifications_unique.sql` — adds UNIQUE on (tenant_id, notification_type)

---

## Schema Changes Needed (New Migration Required)

### S1. Missing index on `subscriptions.stripe_customer_id`
**File:** `supabase/migrations/010_billing_schema.sql`
Indexes exist on `(tenant_id, is_current)` and `stripe_subscription_id`, but not on `stripe_customer_id`. Used in invoice lookups. Will degrade at scale.
```sql
CREATE INDEX idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
```

### S2. `call_provider` column should be NOT NULL
**File:** `supabase/migrations/023_livekit_migration.sql`
Column has `DEFAULT 'livekit'` but no NOT NULL constraint. Explicit NULL inserts are possible. All existing rows already have a value (backfilled in migration 023).
```sql
ALTER TABLE calls ALTER COLUMN call_provider SET NOT NULL;
```

### S3. `supabase/DB` schema file is outdated
Missing recovery SMS columns from migration 009 (`recovery_sms_status`, `recovery_sms_retry_count`, `recovery_sms_last_error`, `recovery_sms_last_attempt_at`) and LiveKit columns from migration 023 (`call_provider`, `egress_id`, renamed columns). Regenerate from current schema.

---

## Low Severity

### L1. `messages/public.log` not gitignored
Contains call transcript metadata. Add `messages/*.log` to `.gitignore`.

### L2. Dead component from another product
**File:** `src/components/sticky-scroll-cards-section.jsx`
References "Hyperlink", "on-device AI", Google Drive -- content from a different product. Delete it.

### L3. No password reset flow on signin page
**File:** `src/app/auth/signin/page.js`
Users who forget their password have no self-service recovery path.

### L4. Account page is a stub
**File:** `src/app/dashboard/more/account/page.js`
Shows "Account management coming soon." -- no way to manage account, change email, delete data. GDPR concern.

### L5. No TypeScript, no ESLint config
Zero static analysis. No `.eslintrc` or `eslint.config.js`.

### L6. Demo page uses undefined Tailwind design tokens
**File:** `src/app/demo/page.js`
`bg-landing-surface`, `text-landing-muted`, `bg-landing-accent` -- may not be defined in tailwind config.

### L7. Non-standard Tailwind classes `h-4.5`/`size-4.5`
**Files:** `src/app/dashboard/calls/page.js:119`, `src/components/landing/LandingNav.jsx:135`
Tailwind doesn't include `.5` values by default. Icons may render at wrong size.

### L8. Missing `save_failed` translation key
**File:** `src/app/dashboard/more/services-pricing/page.js:113`
`t('save_failed', { defaultMessage: "..." })` -- `next-intl` doesn't support `defaultMessage`. Falls back to key string.

### L9. `t.raw` check always truthy in onboarding layout
**File:** `src/app/onboarding/layout.js:60`
`t.raw` is a function (always truthy). `'Done'` is not i18n'd.

### L10. Dead/orphaned onboarding files
- `src/app/onboarding/plan/page.js` -- redirect-only stub
- `src/app/onboarding/profile/page.js` -- redirect to `/onboarding`
- `src/app/onboarding/verify/page.js` -- redirect to `/onboarding/contact`
- `src/app/api/onboarding/sms-verify/route.js` -- dead phone OTP flow

### L11. Impersonation mode blocks mouse but not keyboard
**File:** `src/app/dashboard/layout.js:137`
`pointer-events-none` doesn't prevent keyboard/tab navigation.

### L12. In-memory rate limiter ineffective in serverless
**File:** `src/app/api/demo-voice/route.js`
Module-level `Map` is per-instance in Vercel serverless. Need external store (Vercel KV, Upstash Redis) for proper rate limiting.

### L13. `handleCheckCallerHistory` is 78 lines of unreachable dead code
**File:** `src/app/api/webhooks/retell/route.js:691-772`
Either re-enable with a proper approach or delete entirely.

### L14. Calendar event deletion loop is O(n) sequential DB round-trips
**Files:** `src/lib/scheduling/google-calendar.js:196`, `src/lib/scheduling/outlook-calendar.js:310`
Batch deletes with `.in('external_id', toDelete)` instead of looping.

### L15. `leads.updated_at` not maintained by trigger
**File:** `supabase/migrations/004_leads_crm.sql:24`
Some update paths don't set `updated_at`. Add a `BEFORE UPDATE` trigger.

### L16. `admin_users.role` has no CHECK constraint
**File:** `supabase/migrations/012_admin_users.sql:7`
Any string is accepted as a role. Add `CHECK (role IN ('admin', 'super_admin'))`.

### L17. `phone_inventory_waitlist` missing index on email
**File:** `supabase/migrations/011_country_provisioning.sql:39`

### L18. `zone_travel_buffers` missing `tenant_id` index
**File:** `supabase/migrations/003_scheduling.sql:78`
Queried by `tenant_id` in every scheduling path. Sequential scan at scale.

### L19. Stripe webhook `PLAN_MAP` fallback to `starter` for unknown price IDs
**File:** `src/app/api/stripe/webhook/route.js:280`
Unknown price IDs silently default to starter/40 calls. Should log warning.

### L20. `processCallAnalyzed` loads full appointment history
**File:** `src/lib/call-processor.js:292`
Loads all non-cancelled appointments (including historical) instead of filtering `.gte('end_time', ...)`.

### L21. LeadFlyout save button not disabled for paid-without-revenue
**File:** `src/components/dashboard/LeadFlyout.jsx:424`
Button is enabled when status is changed to `paid` without entering revenue. The `handleSave` validation catches it, but the UX is confusing. Add `(selectedStatus === 'paid' && !revenueAmount)` to the disabled condition.

---

## Skill File Drift (needs updating)

| Skill | Key Issue |
|-------|-----------|
| auth-database-multitenancy | Says "13 migrations" -- actual is 18. Missing 014-018 docs. |
| onboarding-flow | Wizard flow wrong -- Step 4 is test-call not plan, Step 5 is embedded checkout. Missing files. |
| dashboard-crm-system | Says appointments API doesn't exist (it does). Missing 15+ components. |
| scheduling-calendar-system | Missing 5 API routes. Uses stale field name `google_event_id`. |
| public-site-i18n | `AuthAwareCTA` routes to `/pricing` not `/onboarding`. |
| (none) | No skill for billing/subscription lifecycle, admin panel, or email templates. |

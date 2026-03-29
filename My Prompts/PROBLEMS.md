# Remaining Issues

## Migrations to Apply

Run this new migration after applying 001-023:
- `supabase/migrations/024_schema_hardening.sql` — adds leads updated_at trigger, admin_users role CHECK, waitlist email index, zone_travel_buffers tenant_id index

---

## Low Severity

### L3. No password reset flow on signin page
**File:** `src/app/auth/signin/page.js`
Users who forget their password have no self-service recovery path.

### L4. Account page is a stub
**File:** `src/app/dashboard/more/account/page.js`
Shows "Account management coming soon." -- no way to manage account, change email, delete data. GDPR concern.

### L5. No TypeScript, no ESLint config
Zero static analysis. No `.eslintrc` or `eslint.config.js`.

### L11. Impersonation mode blocks mouse but not keyboard
**File:** `src/app/dashboard/layout.js:39`
`pointer-events-none` doesn't prevent keyboard/tab navigation. Add `inert` attribute.

### L12. In-memory rate limiter ineffective in serverless
**File:** `src/app/api/demo-voice/route.js`
Module-level `Map` is per-instance in Vercel serverless. Need external store (Vercel KV, Upstash Redis) for proper rate limiting.

---

## Skill File Drift (needs updating)

| Skill | Key Issue |
|-------|-----------|
| auth-database-multitenancy | Says "13 migrations" -- actual is 24. Missing 014-024 docs. |
| onboarding-flow | Wizard flow wrong -- Step 4 is test-call not plan, Step 5 is embedded checkout. Missing files. |
| dashboard-crm-system | Says appointments API doesn't exist (it does). Missing 15+ components. |
| scheduling-calendar-system | Missing 5 API routes. Uses stale field name `google_event_id`. |
| public-site-i18n | `AuthAwareCTA` routes to `/pricing` not `/onboarding`. |
| (none) | No skill for billing/subscription lifecycle, admin panel, or email templates. |

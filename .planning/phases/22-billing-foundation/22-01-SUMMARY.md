---
phase: 22-billing-foundation
plan: 01
subsystem: database, payments
tags: [stripe, supabase, postgres, rls, billing, subscriptions, webhooks]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: tenants table and RLS patterns
provides:
  - Stripe SDK singleton (src/lib/stripe.js)
  - subscriptions table with plan state, usage counters, and stripe_updated_at for out-of-order protection
  - stripe_webhook_events table with UNIQUE event_id for idempotency
  - RLS write-protection (authenticated SELECT-only on subscriptions, service_role ALL)
  - stripe and @stripe/stripe-js npm packages
affects: [22-billing-foundation plans 02-04, webhook handler, checkout flow, usage enforcement]

# Tech tracking
tech-stack:
  added: [stripe@21.0.0, "@stripe/stripe-js@9.0.0"]
  patterns: [stripe-sdk-singleton, webhook-idempotency-table, subscription-history-with-is-current-flag]

key-files:
  created:
    - src/lib/stripe.js
    - supabase/migrations/010_billing_schema.sql
  modified:
    - package.json
    - package-lock.json
    - .claude/skills/auth-database-multitenancy/SKILL.md

key-decisions:
  - "Minimal Stripe singleton — no client-side code in stripe.js, @stripe/stripe-js imported directly in client components"
  - "Write-protection via RLS — authenticated users can only SELECT subscriptions, all writes go through service_role webhook handlers"
  - "is_current boolean flag for active subscription lookup instead of complex status queries"

patterns-established:
  - "Stripe SDK singleton: import from src/lib/stripe.js for all server-side Stripe API calls"
  - "Webhook idempotency: check stripe_webhook_events.event_id UNIQUE before processing"
  - "Subscription write-protection: only service_role (webhook handlers) can write to subscriptions table"

requirements-completed: [BILL-01, BILL-02, BILL-03]

# Metrics
duration: 4min
completed: 2026-03-26
---

# Phase 22 Plan 01: Billing Foundation Summary

**Stripe SDK singleton with billing database schema — subscriptions table (plan state, usage counters, out-of-order protection) and webhook idempotency table with RLS write-protection**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-26T05:52:28Z
- **Completed:** 2026-03-26T05:56:44Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Installed stripe@21.0.0 and @stripe/stripe-js@9.0.0 packages
- Created server-side Stripe SDK singleton at src/lib/stripe.js
- Created billing migration (010) with subscriptions table (all BILL-02 columns) and stripe_webhook_events table (UNIQUE event_id for BILL-03/D-09 idempotency)
- RLS enforces write-protection: authenticated users SELECT-only on subscriptions, service_role ALL on both tables
- Updated auth-database-multitenancy skill file with migrations 009-010 and Stripe env vars

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Stripe packages and create SDK singleton** - `557547c` (feat)
2. **Task 2: Create billing database migration** - `a6b67e7` (feat)
3. **Skill file update** - `63493d1` (docs)

## Files Created/Modified
- `src/lib/stripe.js` - Server-side Stripe SDK singleton exporting configured Stripe instance
- `supabase/migrations/010_billing_schema.sql` - Billing schema with subscriptions + stripe_webhook_events tables, indexes, and RLS
- `package.json` - Added stripe and @stripe/stripe-js dependencies
- `package-lock.json` - Lock file updated for new dependencies
- `.claude/skills/auth-database-multitenancy/SKILL.md` - Added migrations 009-010, new tables, Stripe env vars

## Decisions Made
- Minimal Stripe singleton (2 lines) — no client-side code in stripe.js; @stripe/stripe-js is imported directly in client components that need it
- Write-protection via RLS omission — authenticated users only get a SELECT policy on subscriptions; no INSERT/UPDATE policy means all writes must go through service_role (webhook handlers)
- is_current boolean flag on subscriptions for fast active-row lookup rather than complex status-based queries
- Stripe products/prices must be created manually in Stripe Dashboard (test mode) — Price IDs stored as env vars

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Updated auth-database-multitenancy skill file**
- **Found during:** Task 2 (billing migration creation)
- **Issue:** CLAUDE.md requires skill files to be updated when making architecture changes; migration 009 was also missing from the skill file
- **Fix:** Added migration 009 and 010 entries, new tables to reference, Stripe env vars to environment section
- **Files modified:** .claude/skills/auth-database-multitenancy/SKILL.md
- **Verification:** Skill file accurately reflects all 10 migrations and new Stripe configuration
- **Committed in:** 63493d1

---

**Total deviations:** 1 auto-fixed (1 missing critical per CLAUDE.md requirement)
**Impact on plan:** Essential for maintaining skill file accuracy per project instructions. No scope creep.

## Issues Encountered
None

## User Setup Required

The following environment variables must be configured in `.env.local`:
- `STRIPE_SECRET_KEY` — from Stripe Dashboard > Developers > API keys
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — publishable key from same location
- `STRIPE_WEBHOOK_SECRET` — from Stripe webhook endpoint configuration
- `STRIPE_PRICE_STARTER` — Price ID for Starter plan ($99/mo, 40 calls)
- `STRIPE_PRICE_GROWTH` — Price ID for Growth plan ($249/mo, 120 calls)
- `STRIPE_PRICE_SCALE` — Price ID for Scale plan ($599/mo, 400 calls)

Stripe products and prices must be created in Stripe Dashboard (test mode) before Plans 02-04 can be fully tested.

## Known Stubs

None - all code is functional (Stripe SDK reads STRIPE_SECRET_KEY at runtime; migration is ready to apply).

## Next Phase Readiness
- Stripe SDK singleton ready for import by webhook handler (Plan 02) and checkout flow (Plan 03)
- Migration ready to apply via `npx supabase db push`
- RLS patterns established for billing tables — consistent with existing codebase patterns
- Stripe products/prices need to be created in Dashboard before checkout testing

## Self-Check: PASSED

All files exist. All commits verified (557547c, a6b67e7, 63493d1).

---
*Phase: 22-billing-foundation*
*Completed: 2026-03-26*

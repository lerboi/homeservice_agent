---
phase: 27-country-aware-onboarding-and-number-provisioning
plan: 01
subsystem: database
tags: [supabase, postgres, rls, rpc, phone-provisioning, singapore, inventory]

# Dependency graph
requires:
  - phase: 22-billing-foundation
    provides: tenants table with onboarding_complete, subscriptions table (migration foundation)
provides:
  - phone_inventory table with country/status/assigned_tenant_id columns
  - phone_inventory_waitlist table for SG waitlist signups
  - tenants.owner_name, tenants.country, tenants.provisioning_failed columns
  - assign_sg_number(p_tenant_id) RPC with FOR UPDATE SKIP LOCKED race protection
  - GET /api/onboarding/sg-availability returns available SG number count
  - POST /api/onboarding/sg-waitlist inserts email into waitlist
affects:
  - 27-02 (contact step UI reads sg-availability, posts to sg-waitlist)
  - 27-03 (Stripe webhook calls assign_sg_number RPC after checkout)
  - auth-database-multitenancy skill (new migration 011)
  - onboarding-flow skill (new API routes)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PostgreSQL FOR UPDATE SKIP LOCKED via SECURITY DEFINER RPC for concurrent inventory assignment"
    - "Partial unique index on phone_inventory(assigned_tenant_id) WHERE status='assigned' for double-assignment prevention"
    - "RLS with service_role bypass for admin-only tables (phone_inventory)"
    - "Permissive INSERT-only policy for public-facing waitlist table"

key-files:
  created:
    - supabase/migrations/011_country_provisioning.sql
    - src/app/api/onboarding/sg-availability/route.js
    - src/app/api/onboarding/sg-waitlist/route.js
  modified: []

key-decisions:
  - "SECURITY DEFINER on assign_sg_number RPC allows it to bypass RLS and perform atomic row locking without needing service_role SQL directly"
  - "phone_inventory has no authenticated SELECT policy — all reads via service_role client or SECURITY DEFINER RPC"
  - "Waitlist is DB-only in v1 — email notification on slot open deferred as future enhancement"
  - "provisioning_failed column added to tenants to enable admin follow-up when SG inventory exhausted at checkout time"

patterns-established:
  - "Concurrent inventory assignment: use SECURITY DEFINER RPC with SELECT ... FOR UPDATE SKIP LOCKED inside UPDATE subquery"
  - "Availability API uses service_role client with count: 'exact', head: true for zero-overhead count query"

requirements-completed:
  - COUNTRY-02
  - COUNTRY-03

# Metrics
duration: 2min
completed: 2026-03-26
---

# Phase 27 Plan 01: DB Foundation for Country-Aware Phone Provisioning Summary

**PostgreSQL phone_inventory table with FOR UPDATE SKIP LOCKED RPC for race-safe SG number assignment, plus tenants.country/owner_name/provisioning_failed columns and SG availability/waitlist API routes**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-26T07:54:21Z
- **Completed:** 2026-03-26T07:56:39Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Migration 011 creates phone_inventory, phone_inventory_waitlist, assigns tenants.owner_name/country/provisioning_failed, and defines the assign_sg_number SECURITY DEFINER RPC with FOR UPDATE SKIP LOCKED for race-safe concurrent checkout handling
- GET /api/onboarding/sg-availability uses service_role client to count available SG numbers — no auth required, fires on dropdown change per D-07
- POST /api/onboarding/sg-waitlist accepts email, validates format, inserts into waitlist table with 400 on invalid input

## Task Commits

Each task was committed atomically:

1. **Task 1: Create migration for phone_inventory, waitlist, and tenants columns** - `a8969c4` (feat)
2. **Task 2: Create SG availability and waitlist API routes** - `c5a00f7` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `supabase/migrations/011_country_provisioning.sql` - Phone inventory schema, waitlist table, tenants columns, assign_sg_number RPC, RLS policies, performance indexes
- `src/app/api/onboarding/sg-availability/route.js` - Public GET endpoint returning available SG number count from phone_inventory
- `src/app/api/onboarding/sg-waitlist/route.js` - POST endpoint inserting email into phone_inventory_waitlist, 400 on invalid email

## Decisions Made

- **SECURITY DEFINER on assign_sg_number:** Allows the RPC to bypass RLS and acquire row-level locks atomically without requiring callers to use the service_role key directly in SQL
- **No authenticated SELECT on phone_inventory:** Admin-only table — all access through service_role client or the SECURITY DEFINER RPC; prevents tenants from seeing each other's assigned numbers
- **Waitlist is DB-only:** Email notification when a slot opens is deferred — simple table with `notified_at` column enables future automated notification without schema changes
- **provisioning_failed flag on tenants:** Allows the webhook handler (Plan 27-03) to mark a tenant when SG inventory is exhausted at checkout time rather than throwing an error, enabling admin follow-up

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. The migration must be applied to the Supabase database before the SG availability API returns meaningful data. Phone inventory rows must be seeded manually by an admin (INSERT into phone_inventory with real SG phone numbers purchased via Retell/Twilio).

## Next Phase Readiness

- Migration 011 provides all schema dependencies for Plans 27-02 (UI) and 27-03 (webhook provisioning)
- assign_sg_number RPC is ready for Plan 27-03 webhook integration
- sg-availability and sg-waitlist APIs are ready for Plan 27-02 frontend consumption
- No blockers for downstream plans

---
*Phase: 27-country-aware-onboarding-and-number-provisioning*
*Completed: 2026-03-26*

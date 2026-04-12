---
phase: 46-vip-caller-direct-routing
plan: "01"
subsystem: backend-data-layer
tags: [vip-routing, database, api, supabase, call-routing, leads]
dependency_graph:
  requires: [Phase 41 pickup_numbers infrastructure, calls table routing_mode column from Phase 42]
  provides: [vip_numbers JSONB on tenants, is_vip boolean on leads, VIP API endpoints, partial index for webhook lookup]
  affects: [livekit-agent webhook handler (Plan 02), dashboard UI VIP section (Plan 03)]
tech_stack:
  added: []
  patterns: [JSONB array on tenants matching pickup_numbers pattern, partial index for sparse boolean lookup, optional field update payload pattern]
key_files:
  created:
    - supabase/migrations/049_vip_caller_routing.sql
  modified:
    - src/app/api/call-routing/route.js
    - src/app/api/leads/[id]/route.js
    - src/app/api/leads/route.js
    - tests/api/call-routing.test.js
decisions:
  - No CHECK constraint on vip_numbers array length per D-09 (unlimited VIP entries)
  - updatePayload pattern for optional vip_numbers field avoids overwriting if not provided
  - Partial index on (tenant_id, from_number) WHERE is_vip=true avoids full-table scan in webhook hot path
metrics:
  duration_minutes: 5
  completed_date: "2026-04-12T03:26:00Z"
  tasks_completed: 2
  files_changed: 5
---

# Phase 46 Plan 01: VIP Caller Routing Data Layer and API Extensions Summary

**One-liner:** Migration adds `vip_numbers` JSONB on tenants and `is_vip` boolean on leads with partial index; GET/PUT /api/call-routing extended for VIP E.164 validation and persistence; PATCH leads and GET leads list extended for is_vip.

## What Was Built

### Task 1: Database migration and API extensions

**Migration 049** (`supabase/migrations/049_vip_caller_routing.sql`):
- `ALTER TABLE tenants ADD COLUMN vip_numbers JSONB NOT NULL DEFAULT '[]'::jsonb` — no array length cap per D-09
- `ALTER TABLE leads ADD COLUMN is_vip BOOLEAN NOT NULL DEFAULT false`
- `CREATE INDEX idx_leads_vip_lookup ON leads (tenant_id, from_number) WHERE is_vip = true` — sparse partial index for fast webhook lookup

**GET /api/call-routing** extended:
- SELECT string now includes `vip_numbers`
- Response object includes `vip_numbers: tenant.vip_numbers`

**PUT /api/call-routing** extended:
- Destructure includes `vip_numbers` (optional)
- Validation block checks: array type, E.164 format per E164_RE regex, no duplicates via Set
- Uses `updatePayload` pattern: includes `vip_numbers` only if provided, avoiding accidental overwrites
- SELECT after update and response object both include `vip_numbers`

**PATCH /api/leads/[id]** extended:
- Destructure includes `is_vip`
- `if (is_vip !== undefined) updateData.is_vip = is_vip` added to updateData building block

**GET /api/leads** extended:
- `is_vip` added to explicit column SELECT list (maintains no-wildcard pattern per RESEARCH pitfall 4)

### Task 2: VIP numbers API test coverage

6 new test cases added to `tests/api/call-routing.test.js`:
1. PUT with valid vip_numbers saves successfully (200)
2. PUT with invalid VIP number format returns 400 (error contains "Invalid VIP phone number format")
3. PUT with duplicate VIP numbers returns 400 (error contains "Duplicate VIP phone number")
4. PUT with vip_numbers not an array returns 400 (error contains "vip_numbers must be an array")
5. PUT with VIP number missing number field returns 400 (error contains "Each VIP number must have a number field")
6. GET returns vip_numbers in response (vip_numbers array present with correct entry)

All 16 tests pass (9 existing + 7 new).

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | 96417f2 | feat(46-01): VIP caller routing data layer and API extensions |
| 2 | 629d5f8 | test(46-01): add VIP number validation tests for call-routing API |

## Decisions Made

- **No array length cap:** `vip_numbers` has no CHECK constraint per D-09 (unlimited VIP entries is an explicit product decision)
- **Optional field update payload:** `updatePayload` pattern with conditional `vip_numbers` inclusion allows clients to PUT call-routing config without wiping existing VIP numbers if the field is omitted
- **Partial index:** `WHERE is_vip = true` keeps the index sparse — only VIP leads are indexed, minimizing index size for the common case where is_vip=false

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all API fields are wired to the database layer. The `vip_numbers` and `is_vip` data flows end-to-end from DB through API response. UI consumption (Plan 03) and webhook routing (Plan 02) are tracked in their respective plans.

## Self-Check: PASSED

Files verified:
- `supabase/migrations/049_vip_caller_routing.sql` — EXISTS
- `src/app/api/call-routing/route.js` — contains `vip_numbers` (11 occurrences)
- `src/app/api/leads/[id]/route.js` — contains `is_vip` (2 occurrences)
- `src/app/api/leads/route.js` — contains `is_vip`
- `tests/api/call-routing.test.js` — 16 tests all pass

Commits verified:
- 96417f2 — feat(46-01): VIP caller routing data layer and API extensions
- 629d5f8 — test(46-01): add VIP number validation tests for call-routing API

---
phase: 04-crm-dashboard-and-notifications
plan: 01
subsystem: database
tags: [supabase, postgres, rls, realtime, leads, crm, jest]

# Dependency graph
requires:
  - phase: 03-scheduling-and-calendar-sync
    provides: appointments table (appointment_id FK used in leads)
  - phase: 01-voice-infrastructure
    provides: calls table (primary_call_id FK, lead_calls junction)
  - phase: 02-onboarding-and-triage
    provides: tenants table (tenant_id FK), supabase service role client pattern

provides:
  - leads table with status/urgency CHECK constraints, revenue_amount, RLS policies, Realtime publication
  - lead_calls junction table for repeat-caller many-to-many mapping
  - activity_log table for dashboard home feed
  - recovery_sms_sent_at column on calls table (for NOTIF-03 cron approach)
  - createOrMergeLead() — short call filter, repeat caller merge, activity logging
  - getLeads() — filtered/sorted lead list excluding transcript_text for performance

affects:
  - 04-02-notifications
  - 04-03-api-routes
  - 04-04-dashboard-ui
  - 04-05-realtime
  - 04-06-webhook-integration

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Repeat-caller merge via .in('status', ['new','booked']) query before insert
    - activity_log event sourcing pattern for dashboard feed
    - Supabase Realtime REPLICA IDENTITY FULL for live lead updates
    - jest.unstable_mockModule with chainable query builder mocks (established pattern)
    - transcript_text excluded from list queries (performance — Supabase RESEARCH Pitfall 4)

key-files:
  created:
    - supabase/migrations/004_leads_crm.sql
    - src/lib/leads.js
    - tests/crm/leads.test.js
    - tests/crm/lead-merge.test.js
  modified: []

key-decisions:
  - "Short call filter at 15 seconds — calls under 15s return null (voicemails, mis-dials)"
  - "Repeat caller merge uses .in('status', ['new','booked']) — completed/paid/lost leads trigger new lead creation"
  - "getLeads excludes transcript_text from list queries — fetched separately on lead detail view (Supabase RESEARCH Pitfall 4)"
  - "REPLICA IDENTITY FULL on leads table — required for Supabase Realtime row-level change events"
  - "recovery_sms_sent_at added to calls table now — Vercel Cron approach for NOTIF-03 missed-call SMS recovery"

patterns-established:
  - "Supabase merge-or-create: query for open status first, insert only if null (createOrMergeLead pattern)"
  - "activity_log append for all CRM state transitions — event_type, lead_id, metadata jsonb"

requirements-completed: [CRM-01, CRM-02, CRM-03, CRM-05, TRIAGE-06]

# Metrics
duration: ~15min
completed: 2026-03-21
---

# Phase 4 Plan 01: CRM Data Foundation Summary

**Supabase leads/lead_calls/activity_log migration with repeat-caller merge logic and 24 passing Jest tests**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-03-21
- **Tasks:** 2
- **Files created:** 4

## Accomplishments

- Migration 004_leads_crm.sql ships leads, lead_calls, activity_log tables with RLS, 3 indexes, Realtime publication, and recovery_sms_sent_at on calls
- createOrMergeLead() implements all 5 pipeline statuses — short call filter, repeat-caller attach, new-lead creation with activity log entry
- getLeads() supports status/urgency/date/search/jobType filters and excludes transcript_text for performance
- 24 unit tests covering all merge scenarios, filter params, and edge cases

## Task Commits

Each task was committed atomically:

1. **Task 1: Database migration 004_leads_crm.sql** - `0040f65` (feat)
2. **Task 2: Leads module with createOrMergeLead and getLeads + tests** - `376df36` (feat)

## Files Created/Modified

- `supabase/migrations/004_leads_crm.sql` - leads table, lead_calls junction, activity_log, RLS policies (6 total), Realtime publication, recovery_sms_sent_at column
- `src/lib/leads.js` - createOrMergeLead() and getLeads() with full filter support
- `tests/crm/leads.test.js` - 7 tests for getLeads filter behavior and transcript exclusion
- `tests/crm/lead-merge.test.js` - 17 tests covering short call filter, new caller creation, and all repeat-caller merge scenarios

## Decisions Made

- Short call threshold is 15 seconds (callDuration < 15 returns null) — excludes voicemails and accidental calls
- Merge query uses `.in('status', ['new', 'booked'])` — completed/paid/lost leads are intentionally excluded so repeat callers with closed jobs start fresh
- transcript_text omitted from getLeads select string — list view has no need for it, avoids large payloads per RESEARCH.md Pitfall 4
- `REPLICA IDENTITY FULL` required on leads so Supabase Realtime can emit old+new row data for dashboard live updates

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Migration will be applied to Supabase when `supabase db push` is run (covered in deployment phase).

## Next Phase Readiness

- CRM data layer is complete and tested — 04-02 (notifications) and 04-03 (API routes) can import from `src/lib/leads.js` immediately
- leads table is Realtime-enabled — 04-05 dashboard live feed can subscribe without schema changes
- activity_log is seeded on every new lead creation — 04-04 dashboard home feed has data to display

---
*Phase: 04-crm-dashboard-and-notifications*
*Completed: 2026-03-21*

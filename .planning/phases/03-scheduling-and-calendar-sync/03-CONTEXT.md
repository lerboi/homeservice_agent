# Phase 3: Scheduling and Calendar Sync - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Emergency calls book a confirmed appointment slot while the caller is still on the line. Routine calls also get offered booking during the call (not just leads). Zero double-bookings via atomic slot locking. Travel time buffers between consecutive jobs using postal code zones. Bidirectional Google Calendar sync with local DB mirror. AI extracts and confirms caller address before locking any slot.

</domain>

<decisions>
## Implementation Decisions

### Booking Conversation Flow — Emergency
- AI offers 2-3 available slot options based on availability + travel buffers
- Caller picks from the offered options
- Before locking: conversational address extraction + mandatory read-back confirmation ("Just to confirm, you're at 123 Main St, correct?") — must get verbal yes before slot lock
- If no emergency slots available today: offer earliest available slot + escalate to owner with priority notification ("The earliest I can book is [tomorrow at X]. I'm also alerting [Owner] now so they can try to fit you in sooner.")

### Booking Conversation Flow — Routine
- Same flow as emergency but less urgent tone — AI offers booking during the call (not deferred to lead-only)
- AI offers 2-3 available slots, caller picks
- Address read-back confirmation required before locking
- If caller doesn't want to book during call, create a lead with suggested slots for owner follow-up

### Calendar Sync
- **Google Calendar only** for Phase 3 — Outlook deferred to Phase 5 or a patch
- **Sync architecture:** Local DB mirror + Google Calendar push notifications for near-real-time sync (sub-60 second)
- Platform DB is source of truth for availability — calendar never queried live during a call (SCHED-09)
- Bookings made on platform push to Google Calendar asynchronously after confirmation
- **Conflict resolution:** Platform bookings always win. If an external Google Calendar event conflicts with an existing platform booking, the conflict is flagged in the dashboard for owner to resolve manually — no auto-cancellation of confirmed bookings
- **OAuth flow:** "Connect Google Calendar" button in dashboard settings page. Standard OAuth consent flow. Owner can see which calendar is synced and disconnect anytime.

### Travel Buffers & Geographic Zones
- **Zone model:** Owner defines 2-5 service zones by grouping postal codes (e.g., "North zone: 730xxx, 750xxx")
- **Same-zone bookings:** Zero travel buffer (assumed nearby)
- **Cross-zone bookings:** 30-minute default travel buffer. Owner can adjust per zone pair if needed
- **Without zones configured:** Flat 30-minute buffer between ALL consecutive bookings (system works without zones)
- **Zone setup timing:** Post-activation optimization task, not required during onboarding. Owner configures zones from dashboard when they want to pack more jobs per day

### Slot Structure (not discussed — Claude's discretion applies)
- Working hours editor UI (tenants.working_hours JSONB stub already exists)
- Time slot granularity and duration per service type
- How availability windows are calculated

### Claude's Discretion
- Database schema design for appointments, slots, zones, calendar sync tables
- Atomic slot locking implementation (database-level constraints vs application logic)
- Google Calendar API integration details (webhook registration, token refresh)
- Retell custom function design for `book_appointment`
- Working hours editor UI design
- Exact slot calculation algorithm (combining working hours + existing bookings + travel buffers + external calendar blocks)
- Address validation/normalization approach
- Agent prompt extensions for booking conversation flow

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project specs
- `.planning/PROJECT.md` — Core value prop, scheduling logic description ("Calendar must be single source of truth, slot locking must be atomic"), constraints
- `.planning/REQUIREMENTS.md` — SCHED-01 through SCHED-09, VOICE-03, VOICE-04 are Phase 3 requirements
- `.planning/ROADMAP.md` — Phase 3 success criteria (6 test scenarios including concurrency test)

### Prior phase context
- `.planning/phases/01-voice-infrastructure/01-CONTEXT.md` — Tech stack (Next.js/JS, Supabase, Vercel), multi-tenant RLS, recording handling
- `.planning/phases/02-onboarding-and-triage/02-CONTEXT.md` — Onboarding philosophy (speed-to-aha), trade templates, tag-per-service simplicity, triage pipeline architecture

### Database schema
- `supabase/migrations/001_initial_schema.sql` — tenants + calls base tables with RLS
- `supabase/migrations/002_onboarding_triage.sql` — services table, triage columns, `tenants.working_hours` JSONB stub (line 27)

### Existing integration points
- `src/app/api/webhooks/retell/route.js` — Webhook handler (inbound/ended/analyzed/function_invoked events). Phase 3 adds `book_appointment` custom function
- `src/lib/call-processor.js` — Call processing pipeline, triage result stored as `urgency_classification`
- `src/lib/retell-agent-config.js` — Agent config with custom functions pattern (existing: `transfer_call`)
- `src/lib/agent-prompt.js` — System prompt builder. Currently says "You cannot book appointments yet" — Phase 3 removes this and adds booking conversation flow
- `src/app/dashboard/services/page.js` — Services CRUD + WorkingHoursStub placeholder (lines 316-328)

### Auth patterns
- `src/lib/supabase-server.js` — Server client with cookies (for authenticated API routes)
- `src/lib/supabase.js` — Service role client (for webhook handlers)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `transfer_call` custom function pattern in `retell-agent-config.js` — template for adding `book_appointment` function
- `handleFunctionCall()` in webhook route — dispatcher for Retell custom functions, add booking handler here
- `createSupabaseServer()` — authenticated Supabase client for dashboard API routes
- Service role Supabase client — for webhook-triggered booking operations
- shadcn/ui components (Button, Card, Input, Select, Badge, Skeleton) — for calendar/booking UI
- Sonner toasts — for booking confirmation feedback
- `WorkingHoursStub` component — replace with actual working hours editor

### Established Patterns
- Multi-tenant via `tenant_id` + RLS policies on every table
- Webhook handler uses `after()` for deferred heavy processing — use for async calendar sync
- API routes: auth check → Supabase operation → Response.json()
- Service-role bypass for webhook handler operations
- Trade templates provide smart defaults — apply same pattern for zone defaults per region

### Integration Points
- `handleInbound()` → passes tenant config to Retell agent as `dynamic_variables` — add working hours + availability data here
- `processCallAnalyzed()` → post-call processing — trigger calendar sync and lead creation with suggested slots
- Dashboard services page → add working hours editor and calendar settings
- New dashboard page needed: calendar/appointments view

</code_context>

<specifics>
## Specific Ideas

- Routine calls get offered booking during the call (not just captured as leads) — the AI should try to close the booking for every call type
- Address read-back is mandatory before ANY slot lock — "Just to confirm, you're at [address], correct?" — verbal yes required
- Zones are an optimization, not a requirement — system works out of the box with flat 30-min buffer between all bookings
- Google Calendar push notifications for sub-60s sync, not polling
- Platform bookings are sacred — external calendar events never auto-cancel confirmed bookings

</specifics>

<deferred>
## Deferred Ideas

- Outlook Calendar sync (SCHED-03) — deferred to Phase 5 or a patch. Architecture should support adding providers easily
- Cal.com integration — mentioned in Phase 2 as deferred idea, not pursued for Phase 3
- Geocoding-based travel time calculation — postal code clusters chosen over address-level distance for simplicity

</deferred>

---

*Phase: 03-scheduling-and-calendar-sync*
*Context gathered: 2026-03-20*

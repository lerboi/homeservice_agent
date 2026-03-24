# Phase 4: CRM, Dashboard, and Notifications - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Every lead created by the AI is visible in a web dashboard with full call context (recording, transcript, triage result). Owner can move leads through a 5-status pipeline (New → Booked → Completed → Paid + Lost), receive immediate SMS and email alerts when leads/bookings arrive, and track cumulative revenue. Callers who hang up before booking get an auto-SMS recovery message.

</domain>

<decisions>
## Implementation Decisions

### Lead Data Model
- **Separate leads table** linked to calls — a lead is the "customer journey", calls are events within it
- **Smart merge for repeat callers (CRM-03):** If existing lead from same phone number is in New/Booked status, attach new call to it. If existing lead is Completed/Paid, create a new lead (it's a new job)
- **Lead creation trigger:** After call ends (in call_analyzed webhook handler), once transcript + triage result + booking info are available
- **Short call filter:** Calls under 10-15 seconds or with no detected intent are logged as calls but don't create leads — keeps pipeline clean

### Pipeline Statuses
- 5 statuses: **New → Booked → Completed → Paid + Lost**
- "Lost" for leads that didn't convert — lets owner track drop-offs
- AI creates leads as "New"; booking during call auto-promotes to "Booked"
- Owner manually moves leads through Completed → Paid (with revenue amount)

### Dashboard Lead List
- **Card-style rows** — each lead is a mini card with icon, key details (caller, job type, urgency badge, address, status, date), and action buttons
- **Full filter bar:** Status, Urgency, Date range, Job type, and Search by caller name/number
- **Default sort:** Newest first
- **Lead detail:** Flyout panel from the right (consistent with existing AppointmentFlyout pattern)
- **Inline audio player** in flyout for call recording playback — HTML5 player with play/pause/scrub alongside transcript
- **Both list and kanban views** — list view as primary, kanban toggle available

### Dashboard Overview
- **Home page at /dashboard** — today's summary: new leads count, upcoming appointments, quick stats (calls today, conversion rate), recent activity feed
- **Sidebar nav:** Home + Leads + Calendar + Services + Settings (5-item nav, extending existing DashboardSidebar)

### Real-time Updates
- **Supabase Realtime** subscriptions for live dashboard updates — new leads appear instantly, status changes reflect live. Already in stack, minimal additional infrastructure.

### Notification System — Owner Alerts
- **SMS via Twilio** — owner receives alert with: caller name, job type, urgency, address, one-tap callback link AND dashboard link
- **Email via Resend** — same lead details, richer formatting with React Email templates
- Both fire within 60 seconds of lead/booking creation

### Notification System — Caller Recovery (NOTIF-03)
- **Auto-SMS to caller** who hangs up before booking completes
- **Timing:** 60 seconds after hangup
- **Tone:** Warm + helpful — "Hi [Name], thanks for calling [Business]. We'd love to help — book online at [link] or call us back anytime."
- **SMS sent via Twilio** from the business's Retell phone number (or a Twilio number if Retell doesn't support outbound SMS)

### Revenue Tracking (CRM-05)
- **Manual amount entry** on status change — when owner moves lead to Completed or Paid, a dollar amount input appears inline
- Amount optional on Completed, required on Paid
- **Dedicated analytics tab** at /dashboard/analytics for revenue summary, conversion funnels, and revenue over time charts

### Claude's Discretion
- Kanban board column layout and mobile responsiveness approach
- Leads table schema design (columns, indexes, relationships to calls and appointments)
- Supabase Realtime subscription design (which tables, which events)
- Email template design (React Email)
- Analytics page chart types and layout
- Dashboard home page widget arrangement
- Filter bar component design and state management
- Audio player styling

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project specs
- `.planning/PROJECT.md` — Core value prop, lead tracker (not full CRM) decision, constraints
- `.planning/REQUIREMENTS.md` — CRM-01 through CRM-05, TRIAGE-06, NOTIF-01 through NOTIF-03
- `.planning/ROADMAP.md` — Phase 4 success criteria (6 test scenarios including repeat caller dedup, 60s notification SLA)

### Prior phase context
- `.planning/phases/01-voice-infrastructure/01-CONTEXT.md` — Tech stack (Next.js/JS, Supabase, Vercel), multi-tenant RLS, recording handling
- `.planning/phases/02-onboarding-and-triage/02-CONTEXT.md` — Onboarding philosophy (speed-to-aha), tone presets, triage pipeline, tag-per-service simplicity
- `.planning/phases/03-scheduling-and-calendar-sync/03-CONTEXT.md` — Booking flow, calendar sync architecture, travel buffers, AppointmentFlyout pattern

### Database schema
- `supabase/migrations/001_initial_schema.sql` — tenants + calls base tables (calls has from_number, transcript, recording_url, urgency fields)
- `supabase/migrations/002_onboarding_triage.sql` — services table, urgency_classification/confidence on calls
- `supabase/migrations/003_scheduling.sql` — appointments table (status: confirmed/cancelled/completed), service_zones, calendar_events

### Existing dashboard code
- `src/components/dashboard/DashboardSidebar.jsx` — Navy sidebar with orange accent, currently Services + Calendar nav. Phase 4 adds Home, Leads, Settings
- `src/components/dashboard/AppointmentFlyout.js` — Flyout panel pattern to reuse for lead detail
- `src/components/dashboard/CalendarView.js` — Calendar view component
- `src/components/ui/` — shadcn components (badge, card, button, skeleton, sonner toasts, etc.)

### Webhook integration
- `src/app/api/webhooks/retell/route.js` — Webhook handler where lead creation will be triggered (call_analyzed event)
- `src/lib/call-processor.js` — Call processing pipeline, triage result stored as urgency_classification

### Auth patterns
- `src/lib/supabase-server.js` — Server client with cookies (for authenticated dashboard API routes)
- `src/lib/supabase.js` — Service role client (for webhook-triggered lead creation and notifications)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DashboardSidebar.jsx` — Navy sidebar with existing nav pattern, extend with new items
- `AppointmentFlyout.js` — Flyout panel pattern, reuse for lead detail flyout
- `BookingStatusBadge.js` — Badge component, adapt for lead pipeline status badges
- `ConflictAlertBanner.js` — Alert banner pattern, reuse for notification-related alerts
- shadcn/ui: badge, card, button, skeleton, sonner, select, sheet — all available for lead list/detail UI
- `GridTexture` — Visual texture component used in sidebar
- `src/lib/design-tokens.js` — Design token system with orange accent (#C2410C), navy (#0F172A)

### Established Patterns
- Multi-tenant via `tenant_id` + RLS policies on every table
- Webhook handler uses `after()` for deferred heavy processing — use for async notification delivery
- API routes: auth check → Supabase operation → Response.json()
- Service-role bypass for webhook handler operations
- Flyout panel pattern for detail views (AppointmentFlyout)
- Dashboard layout: sidebar + main content area with `lg:pl-60` offset

### Integration Points
- `processCallAnalyzed()` in call-processor — trigger lead creation here after triage + recording
- `handleInbound()` → lead merge check against existing leads by from_number
- New API routes needed: /api/leads, /api/notifications
- New dashboard pages: /dashboard (home), /dashboard/leads, /dashboard/analytics, /dashboard/settings
- Supabase Realtime: subscribe to leads and appointments table changes in dashboard client components

</code_context>

<specifics>
## Specific Ideas

- Card-style lead rows should feel modern and visual — not a sterile table
- Both list and kanban views gives owner flexibility — list for daily management, kanban for pipeline overview
- Flyout panel keeps owner in context of the list — no page navigation needed to see lead detail
- Owner SMS should have one-tap callback link AND dashboard link — everything needed to act immediately
- Caller recovery SMS should feel warm and human, not robotic — "We'd love to help" not "Your call was not completed"
- Revenue tracking is lightweight — just a dollar amount on status change, no invoicing system
- Smart merge means a plumber who calls about a leak gets one lead, but if they call again 3 months later about a different issue after the first was paid, it's a new lead

</specifics>

<deferred>
## Deferred Ideas

- Push notifications (browser/mobile) — v2, SMS + email sufficient for v1
- In-app notification center — v2, direct SMS/email is more immediate for SME owners
- Invoicing integration — out of scope, lead tracker only (PROJECT.md decision)
- Outbound follow-up automation — out of scope for v1 (voice-first, inbound only)
- Advanced analytics (cohort analysis, LTV, churn prediction) — v2 analytics
- Drag-and-drop kanban reordering within columns — nice-to-have, not required for v1

</deferred>

---

*Phase: 04-crm-dashboard-and-notifications*
*Context gathered: 2026-03-21*

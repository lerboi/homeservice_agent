# Phase 8: Outlook Calendar Sync - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Bidirectional Microsoft Graph calendar sync: OAuth connect/disconnect from dashboard settings, delta query incremental sync, webhook subscription auto-renewal before 3-day expiry. Owner can connect Outlook alongside an existing Google Calendar connection. Both providers feed into availability; bookings push to one designated "primary" calendar only.

</domain>

<decisions>
## Implementation Decisions

### Dual-Provider Policy
- **D-01:** Both Google and Outlook can be connected simultaneously. Both calendar providers feed blocked slots into the local `calendar_events` mirror, and the availability calculator (which already queries without a provider filter) merges them automatically.
- **D-02:** Bookings push to one "primary" calendar only — not both. This avoids duplicate events when the owner has external cross-sync (e.g., Google-Outlook sync enabled by their IT admin).
- **D-03:** First connected calendar becomes the primary automatically. A "Make Primary" button appears on the non-primary provider row.
- **D-04:** When the primary calendar is disconnected while the other is still connected, the remaining calendar is auto-promoted to primary. No user prompt needed.

### Settings UI Layout
- **D-05:** Single combined "Calendar Sync" card in dashboard settings. Both providers appear as rows inside one card — Google row and Outlook row — each with its own connect/disconnect button, sync status dot, and last-synced timestamp.
- **D-06:** The primary calendar row shows a `[PRIMARY]` badge. The non-primary row shows a `[Make Primary]` button.
- **D-07:** When neither provider is connected, show the current empty-state pattern (dashed border, icon, description) but with two connect buttons (one for Google, one for Outlook) instead of one.

### Code Migration Required
- **D-08:** Fix 5-6 `.single()` calls in `google-calendar.js` that query `calendar_credentials` without a `.eq('provider', 'google')` filter — these will throw errors when a second provider row exists.
- **D-09:** Generalize `appointments.google_event_id` column to support provider-agnostic external event references (e.g., `external_event_id` + `external_event_provider`, or a jsonb column).
- **D-10:** Add `is_primary boolean DEFAULT false` column to `calendar_credentials` table (or a `primary_calendar_provider` column on `tenants`).

### Claude's Discretion
- Microsoft Graph API integration details (delta queries vs. full sync, subscription creation)
- Outlook OAuth callback route design and token refresh strategy
- Outlook webhook endpoint and notification validation (client state token approach)
- Cron schedule for Outlook subscription renewal (3-day expiry vs Google's 7-day)
- How to handle Microsoft 365 admin consent errors in UX (STATE.md blocker noted — verify against live Azure AD response)
- `onboarding_complete` backfill safety approach (STATE.md blocker)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing calendar sync implementation (Google — pattern to mirror for Outlook)
- `src/lib/scheduling/google-calendar.js` — Full Google sync module: OAuth client, event creation, watch registration, incremental sync, push-to-calendar, revoke/disconnect. Mirror this structure for Outlook.
- `src/components/dashboard/CalendarSyncCard.js` — Current Google-only UI. Replace with combined dual-provider card.
- `src/app/api/google-calendar/auth/route.js` — Google OAuth initiation route
- `src/app/api/google-calendar/callback/route.js` — Google OAuth callback route
- `src/app/api/webhooks/google-calendar/route.js` — Google push notification webhook handler
- `src/app/api/cron/renew-calendar-channels/route.js` — Google watch channel renewal cron
- `src/app/api/calendar-sync/status/route.js` — Calendar sync status API
- `src/app/api/calendar-sync/disconnect/route.js` — Calendar disconnect API (currently Google-specific dynamic import)
- `src/lib/webhooks/google-calendar-push.js` — Google push notification processing

### Database schema
- `supabase/migrations/003_scheduling.sql` — `calendar_credentials` table (lines 98-118, already has `provider IN ('google', 'outlook')` check), `calendar_events` table (lines 130-156, already has `provider` column with unique constraint on `tenant_id, provider, external_id`)

### Prior phase context
- `.planning/phases/03-scheduling-and-calendar-sync/03-CONTEXT.md` — Original calendar sync decisions: local DB mirror is source of truth, platform bookings always win, conflict flagging approach, push notifications for sub-60s sync

### Project-level
- `.planning/REQUIREMENTS.md` — OUTLOOK-01 through OUTLOOK-04
- `.planning/STATE.md` — Blockers: admin consent error shape verification, onboarding_complete backfill safety

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `google-calendar.js` module structure — Mirror for `outlook-calendar.js`: OAuth client factory, event creation, subscription registration, incremental sync, push-to-calendar, revoke/disconnect
- `CalendarSyncCard` component — Refactor into multi-provider card with Google/Outlook rows
- `SyncStatusDot` component — Reuse directly for Outlook sync status display
- `AlertDialog` pattern — Reuse for Outlook disconnect confirmation
- OAuth popup flow (`window.open` + poll for close) — Same pattern for Microsoft OAuth
- `after()` pattern in webhook handler — Use for async Outlook calendar sync triggers

### Established Patterns
- Multi-tenant via `tenant_id` + RLS policies on every table (apply to any new Outlook-specific tables/columns)
- API routes: auth check via `getTenantId()` → Supabase operation → `Response.json()`
- Service-role bypass for webhook handler operations
- Cron routes for subscription/channel renewal
- Dynamic import fallback in disconnect route (handles missing env vars gracefully)

### Integration Points
- `calendar_credentials` table — Add Outlook rows alongside Google rows (schema already supports it)
- `calendar_events` table — Outlook events synced here with `provider: 'outlook'` (schema already supports it)
- Availability calculator — Already queries without provider filter, will automatically include Outlook events
- `pushBookingToCalendar()` — Needs refactoring: query by `tenant_id` AND `is_primary = true` instead of `.single()`
- Disconnect route — Needs provider parameter to distinguish Google vs Outlook disconnect
- Status route — Needs to return both providers' status
- Settings page — CalendarSyncCard replacement with combined card

</code_context>

<specifics>
## Specific Ideas

- Combined card UI: both providers as rows inside one card, primary badge on designated calendar, "Make Primary" button on the other
- First-connected-is-primary rule eliminates a choice step during onboarding
- Auto-promote on disconnect keeps the system in a valid state without user intervention
- Bookings push to primary only — explicitly avoids the duplicate-event problem from external cross-sync

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-outlook-calendar-sync*
*Context gathered: 2026-03-24*

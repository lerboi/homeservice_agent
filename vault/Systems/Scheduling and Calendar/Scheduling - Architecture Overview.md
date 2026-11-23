---
type: system
system: Scheduling and Calendar
status: current
description: "The scheduling system spans slot generation, atomic booking, and bidirectional calendar sync for both Google and Outlook."
source: .claude/skills/scheduling-calendar-system/SKILL.md § Architecture Overview
migrated: 2026-11-23
verified:
tags: [voco/system/scheduling-and-calendar]
---

# Architecture Overview

Part of [[Scheduling and Calendar]]. Migrated verbatim from the `scheduling-calendar-system` skill; check `verified` before trusting details.

> **Read first (2026-11-23):** voice-agent bookings no longer go through the JavaScript functions described here. The current agent path is in [[Scheduling - Booking to calendar on agent calls (verified path)]]. This note remains accurate for the Next app side (dashboard, API routes, OAuth, sync).

The scheduling system spans slot generation, atomic booking, and bidirectional calendar sync for both Google and Outlook.

| Component | File(s) | Purpose |
|-----------|---------|---------|
| **Slot Calculator** | `slot-calculator.js` | Pure function — computes available slots from working hours, bookings, calendar blocks, and travel buffers |
| **Atomic Booking Engine** | `booking.js` + Postgres RPC | Non-blocking advisory lock + tsrange overlap check for race-free slot reservation |
| **Google Calendar** | `google-calendar.js` | OAuth, event push, incremental sync, watch registration, disconnect |
| **Outlook Calendar** | `outlook-calendar.js` | MSAL OAuth, event push, delta sync, subscription management, disconnect |
| **Google Webhook Handler** | `api/webhooks/google-calendar/route.js` | Receives push notifications from Google, resolves tenant via `watch_channel_id` DB lookup (header token never trusted), triggers incremental sync. (`src/lib/webhooks/google-calendar-push.js` DELETED 2026-06-12) |
| **Outlook Webhook Handler** | `webhooks/outlook-calendar-push.js` | Receives Microsoft Graph notifications, validates clientState, triggers delta sync |
| **Cron: renew-calendar-channels** | `cron/renew-calendar-channels/route.js` | Dual-provider renewal of Google watch channels + Outlook subscriptions before TTL expiry; monthly (1st) full window re-anchor of every connected credential |
| **Appointments API** | `api/appointments/route.js`, `api/appointments/[id]/route.js` | Calendar view fetch, travel buffer + conflict detection, cancel, dismiss conflict |
| **Working Hours API** | `api/working-hours/route.js` | GET/PUT tenant working hours, slot duration, timezone |
| **Service Area API** | `api/service-area/route.js` | GET/PUT the single flat Service Area coverage list (union of `postal_codes` + `cities`) + out-of-area owner settings. Replaces the retired `api/zones/*` (M16 P1) |
| **Google OAuth Routes** | `api/google-calendar/auth/route.js`, `api/google-calendar/callback/route.js` | Initiate Google OAuth, handle callback, store credentials, register watch, initial sync |
| **Outlook OAuth Routes** | `api/outlook-calendar/auth/route.js`, `api/outlook-calendar/callback/route.js` | Initiate Microsoft OAuth, handle callback, store credentials, create Graph subscription, initial sync |

```
Tenant configures working hours (PUT /api/working-hours)
       ↓
Google/Outlook calendars sync via push webhooks + incremental pull
       ↓
LiveKit agent joins room → fetches appointments + calendar_events + zones + buffers in parallel
       ↓
calculateAvailableSlots() → pure computation → returns ISO slot pairs
       ↓
AI offers slots to caller → caller picks one
       ↓
book_appointment tool (in-process) → atomicBookSlot() → book_appointment_atomic RPC
       ↓  (Postgres advisory lock + tsrange overlap check)
       ↓
On success → pushBookingToCalendar(tenantId, appointmentId) (async, non-blocking)
       ↓                 (queries is_primary=true credential, creates calendar event)
       ↓
pushBookingToCalendar writes external_event_id + external_event_provider on appointment
       ↓
Google/Outlook push webhooks → google-calendar route handler / handleOutlookCalendarPush
       ↓                          trigger syncCalendarEvents / syncOutlookCalendarEvents
       ↓
calendar_events local mirror kept in sync (slot calculator reads from this, never live-queries)
```

---

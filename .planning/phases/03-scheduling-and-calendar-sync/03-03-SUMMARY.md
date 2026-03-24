---
phase: 03-scheduling-and-calendar-sync
plan: 03
status: complete
started: 2026-03-20
completed: 2026-03-21
---

## What Shipped

Bidirectional Google Calendar sync — OAuth flow, push notification webhook, incremental sync, and post-booking event push.

## Key Files

### Created
- `src/lib/scheduling/google-calendar.js` — Core module: createOAuth2Client, getAuthUrl, createCalendarEvent, registerWatch, syncCalendarEvents, pushBookingToCalendar, revokeAndDisconnect
- `src/lib/webhooks/google-calendar-push.js` — Push notification webhook handler for real-time sync
- `src/app/api/google-calendar/auth/route.js` — GET returns OAuth URL with auth check
- `src/app/api/google-calendar/callback/route.js` — Exchanges code for tokens, stores credentials, registers watch, initial sync
- `src/app/api/webhooks/google-calendar/route.js` — POST handler with after() async sync
- `src/app/api/cron/renew-calendar-channels/route.js` — CRON_SECRET protected channel renewal
- `tests/scheduling/google-calendar-push.test.js` — 6 test cases

### Modified
- `package.json` — Added googleapis, google-auth-library

## Decisions
- Used googleapis and google-auth-library packages for Google Calendar integration
- Push notifications use after() pattern for non-blocking async sync
- Channel renewal via cron with CRON_SECRET protection
- Sync handles 410 Gone with full re-sync fallback

## Self-Check: PASSED

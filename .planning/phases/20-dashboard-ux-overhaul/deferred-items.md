# Deferred Items — Phase 20 Dashboard UX Overhaul

## Pre-existing Build Error (Out of Scope)

**@sentry/nextjs missing package**
- Discovered during: Plan 20-03, Task 2 verification (npm run build)
- Error: `Module not found: Can't resolve '@sentry/nextjs'` in instrumentation.js and sentry.server.config.js
- Status: Pre-existing — was present before plan 20-03 changes
- Action needed: Install @sentry/nextjs package or remove Sentry instrumentation if not needed
- Files affected: instrumentation.js, sentry.server.config.js, next.config.js (withSentryConfig wrapper)

## Known Future Work

**Appointments API**
- The `/api/appointments` route does not yet exist
- The Next Appointment card on the dashboard home page always shows "No upcoming appointments"
- A future plan must create the appointments API and wire the card with real data

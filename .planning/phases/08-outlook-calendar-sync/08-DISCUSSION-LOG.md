# Phase 8: Outlook Calendar Sync - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-24
**Phase:** 08-outlook-calendar-sync
**Areas discussed:** Dual-provider policy, Settings UI layout

---

## Dual-Provider Policy

| Option | Description | Selected |
|--------|-------------|----------|
| One provider at a time | Owner chooses Google OR Outlook, not both. Simpler but misses events from unused calendar. | |
| Both connected, push to both | Maximum coverage. Both calendars sync availability AND receive bookings. Risk: duplicate events from external cross-sync. ~12 files changed. | |
| Both connected, push to one "primary" | Both calendars sync availability. Bookings push to primary only. Avoids duplicate-event problem. ~8 files changed. | ✓ |

**User's choice:** Both connected, bookings push to one "primary" calendar
**Notes:** User asked for a research-backed analysis of feasibility before deciding. Research confirmed the existing DB schema (`calendar_credentials` with provider column, `calendar_events` with provider column and no-filter availability queries) was designed for dual-provider from day one. The "primary calendar" approach was recommended as the pragmatic sweet spot — 90% of the value with ~60% of the effort, completely sidestepping the duplicate-event problem.

---

## Settings UI Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Two separate cards | One card per provider, matching existing CalendarSyncCard pattern. Primary badge on designated calendar. | |
| Single combined card | One "Calendar Sync" card with both providers as rows inside. More compact, diverges from existing card pattern. | ✓ |
| Tabbed interface | Tabs for "Google" and "Outlook" within one section. Hides the non-active provider. | |

**User's choice:** Single combined card
**Notes:** User selected based on ASCII preview showing both providers as rows with primary badge and sync status.

### Follow-up: Primary Calendar Determination

| Option | Description | Selected |
|--------|-------------|----------|
| First connected is primary | Whichever calendar is connected first becomes primary. "Make Primary" button on the other. | ✓ |
| Owner always chooses | Prompt owner to pick primary after connecting second calendar. | |
| Claude's discretion | Let Claude decide the UX. | |

**User's choice:** First connected is primary (Recommended)

### Follow-up: Disconnect Primary Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-promote the other | Remaining calendar automatically becomes primary. No prompt needed. | ✓ |
| Revert to no primary | Availability syncs but bookings don't push until owner sets new primary. | |
| Claude's discretion | Let Claude decide. | |

**User's choice:** Auto-promote the other (Recommended)

---

## Claude's Discretion

- Microsoft Graph API integration details (delta queries, subscription model)
- Outlook OAuth route design and token refresh
- Webhook notification validation
- Cron schedule for 3-day subscription renewal
- Admin consent error handling UX
- onboarding_complete backfill safety

## Deferred Ideas

None — discussion stayed within phase scope

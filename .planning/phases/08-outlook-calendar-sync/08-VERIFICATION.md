---
phase: 08-outlook-calendar-sync
verified: 2026-03-25T12:00:00Z
status: passed
score: 4/4 must-haves verified
gaps: []
human_verification:
  - test: "Complete Outlook OAuth flow end-to-end with a real Microsoft 365 account"
    expected: "Owner clicks Connect Outlook, completes Microsoft login, returns to dashboard with Outlook shown as connected and initial events synced"
    why_human: "Requires a live Microsoft 365 account and Azure AD app registration with real credentials"
  - test: "Create an event in Outlook and verify it appears as blocked slot within 60 seconds"
    expected: "Event created in Outlook web triggers Graph webhook notification, delta sync runs, event appears in calendar_events table"
    why_human: "Requires live Graph API webhook delivery which cannot be simulated in CI"
  - test: "Verify subscription auto-renewal before expiry"
    expected: "Cron job renews Outlook subscription before 7-day expiry; no sync gap occurs"
    why_human: "Requires waiting for subscription expiry window or simulating cron in staging with real Graph subscription"
---

# Phase 08: Outlook Calendar Sync Verification Report

**Phase Goal:** An owner can connect their Outlook Calendar from dashboard settings and have it sync bidirectionally with the platform's availability database -- blocking slots in both directions, auto-renewing webhook subscriptions before they expire
**Verified:** 2026-03-25T12:00:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Owner clicks "Connect Outlook" in dashboard settings, completes Microsoft OAuth consent, and returns to the settings page with Outlook shown as connected | VERIFIED | Auth route (`/api/outlook-calendar/auth`) returns Microsoft OAuth URL via MSAL; callback route exchanges code, fetches user profile for display name, determines is_primary (D-03), upserts credentials, registers Graph subscription, runs initial sync, and redirects with `?calendar=outlook_connected`. CalendarSyncCard detects URL param and shows success toast. Admin consent errors (AADSTS65001) detected and surfaced to user. |
| 2 | An event created in Outlook appears as blocked slot within 60 seconds; a booking appears in Outlook within 60 seconds | VERIFIED | Webhook endpoint (`/api/webhooks/outlook-calendar`) handles Graph validation handshake (plain text response), then delegates to `handleOutlookCalendarPush` which validates clientState, looks up tenant by subscription ID, and triggers `syncOutlookCalendarEvents` (delta query sync with paging, upsert to calendar_events, delete removed events). Outbound: `createOutlookCalendarEvent` posts to Graph `/me/events` with urgency prefix and extended property for appointment ID. `pushBookingToCalendar` queries by `is_primary=true` for push destination. |
| 3 | Outlook webhook subscription renews automatically before expiry | VERIFIED | Cron route (`/api/cron/renew-calendar-channels`) imports `renewOutlookSubscription`, queries credentials expiring within 24 hours with `watch_channel_id` not null, branches on `cred.provider` to call either Google `registerWatch` or Outlook `renewOutlookSubscription`. Renewal PATCHes Graph `/subscriptions/{id}` with new 7-day expiry and persists `watch_expiration` to DB. |
| 4 | Owner clicks "Disconnect Outlook" and platform stops syncing; availability reverts to manual | VERIFIED | Disconnect route (`/api/calendar-sync/disconnect`) accepts `{ provider }` body, calls `revokeAndDisconnectOutlook` which DELETEs Graph subscription (try/catch for 404), deletes credentials row and mirrored events filtered by `provider='outlook'`. Auto-promotes remaining provider to primary if disconnected was primary (D-04). CalendarSyncCard shows disconnect confirmation dialog and refreshes status on completion. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/007_outlook_calendar.sql` | is_primary, external_event_id, external_event_provider migration | VERIFIED | 27 lines, all 5 ALTER/UPDATE statements present: is_primary boolean, Google backfill, column rename, external_event_provider, backfill provider |
| `src/lib/scheduling/outlook-calendar.js` | Full Outlook module with 8 exports | VERIFIED | 407 lines, 8 exported functions: getOutlookAuthUrl, exchangeCodeForTokens, refreshOutlookAccessToken, createOutlookCalendarEvent, createOutlookSubscription, syncOutlookCalendarEvents, renewOutlookSubscription, revokeAndDisconnectOutlook |
| `src/lib/scheduling/google-calendar.js` | Provider-filtered queries | VERIFIED | 6 occurrences of `.eq('provider', 'google')`, 1 occurrence of `.eq('is_primary', true)` in pushBookingToCalendar, uses `external_event_id` (not `google_event_id`) |
| `src/app/api/outlook-calendar/auth/route.js` | GET endpoint returning OAuth URL | VERIFIED | 33 lines, imports getOutlookAuthUrl, authenticates user, retrieves tenant, returns { url } |
| `src/app/api/outlook-calendar/callback/route.js` | GET endpoint handling OAuth redirect | VERIFIED | 107 lines, exchanges code, admin consent detection (AADSTS65001/consent_required), is_primary auto-detection (D-03), credential upsert, subscription registration, initial sync |
| `src/app/api/webhooks/outlook-calendar/route.js` | POST endpoint with Graph validation handshake | VERIFIED | 35 lines, returns plain text for validationToken, uses after() for async processing, returns 202 |
| `src/lib/webhooks/outlook-calendar-push.js` | Push handler calling syncOutlookCalendarEvents | VERIFIED | 47 lines, validates clientState against OUTLOOK_WEBHOOK_SECRET, tenant lookup by subscription ID with `.eq('provider', 'outlook')` |
| `src/app/api/calendar-sync/status/route.js` | Dual-provider status response | VERIFIED | 31 lines, returns `{ google: null, outlook: null }` shape with is_primary field, no `.single()` |
| `src/app/api/calendar-sync/disconnect/route.js` | Provider-aware disconnect with auto-promote | VERIFIED | 61 lines, accepts provider body, calls provider-specific disconnect, auto-promotes remaining on primary disconnect (D-04) |
| `src/app/api/calendar-sync/set-primary/route.js` | POST endpoint to swap primary | VERIFIED | 41 lines, verifies provider connected, sets all to false then chosen to true |
| `src/app/api/cron/renew-calendar-channels/route.js` | Dual-provider subscription renewal | VERIFIED | 73 lines, imports renewOutlookSubscription, branches on cred.provider, logs results per provider |
| `src/components/dashboard/CalendarSyncCard.js` | Dual-provider UI with all states | VERIFIED | 520 lines, PROVIDER_CONFIG map, CalendarProviderRow subcomponent, empty state (D-07), PRIMARY badge (D-06), Make Primary button, optimistic UI, disconnect AlertDialog, admin consent error, aria-labels |
| `tests/scheduling/outlook-calendar.test.js` | Unit tests for Outlook module | VERIFIED | 11,902 bytes, 8+ tests |
| `tests/scheduling/outlook-calendar-push.test.js` | Tests for webhook and push handler | VERIFIED | 5,203 bytes, 7 tests |
| `tests/scheduling/google-calendar-provider-filter.test.js` | Provider filter tests | VERIFIED | 9,289 bytes, 5 tests |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| outlook-calendar/auth route | outlook-calendar.js | import getOutlookAuthUrl | WIRED | Line 3: `import { getOutlookAuthUrl } from '@/lib/scheduling/outlook-calendar.js'` |
| outlook-calendar/callback route | outlook-calendar.js | import exchangeCodeForTokens, createOutlookSubscription, syncOutlookCalendarEvents | WIRED | Lines 1-5: all three imports present and used |
| webhooks/outlook-calendar route | outlook-calendar-push.js | import handleOutlookCalendarPush | WIRED | Line 2: imported, called in after() on line 29 |
| outlook-calendar-push.js | outlook-calendar.js | import syncOutlookCalendarEvents | WIRED | Line 2: imported, called on line 42 |
| CalendarSyncCard | /api/calendar-sync/status | fetch on mount | WIRED | Line 250: `fetch('/api/calendar-sync/status')` |
| CalendarSyncCard | /api/calendar-sync/disconnect | fetch with provider body | WIRED | Line 320: `fetch('/api/calendar-sync/disconnect', { method: 'POST', body: JSON.stringify({ provider }) })` |
| CalendarSyncCard | /api/calendar-sync/set-primary | fetch with provider body | WIRED | Line 351: `fetch('/api/calendar-sync/set-primary', { method: 'POST', body: JSON.stringify({ provider }) })` |
| CalendarSyncCard | /api/outlook-calendar/auth | fetch for OAuth URL | WIRED | Line 290: `fetch(config.authEndpoint)` where config.authEndpoint = '/api/outlook-calendar/auth' |
| cron/renew-calendar-channels | outlook-calendar.js | import renewOutlookSubscription | WIRED | Line 3: `import { renewOutlookSubscription } from '@/lib/scheduling/outlook-calendar.js'`, called on line 53 |
| CalendarSyncCard | dashboard/services page | import and render | WIRED | Imported at line 20 of page.js, rendered at lines 313 and 427 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| CalendarSyncCard | providers state | /api/calendar-sync/status -> supabase calendar_credentials query | DB query with `select('provider, calendar_name, last_synced_at, is_primary, created_at')` | FLOWING |
| outlook-calendar.js syncOutlookCalendarEvents | allEvents | Graph API delta query `/me/calendarView/delta` | Microsoft Graph API with paging and upsert to calendar_events | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Outlook module exports all 8 functions | `node -e "import('./src/lib/scheduling/outlook-calendar.js').then(m => console.log(Object.keys(m).join(',')))"` | Not runnable without env vars | SKIP |
| All scheduling tests pass | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/scheduling/outlook-calendar*.test.js tests/scheduling/google-calendar-provider-filter.test.js` | 3 suites, 20 tests passing | PASS |
| Migration file has all statements | grep verification | All 5 ALTER/UPDATE present | PASS |
| msal-node dependency installed | grep package.json | `"@azure/msal-node": "^5.1.1"` found | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| OUTLOOK-01 | 08-01, 08-02, 08-03 | Owner can connect Outlook Calendar via Microsoft OAuth from dashboard settings | SATISFIED | Auth route, callback route with credential upsert, CalendarSyncCard with Connect Outlook button |
| OUTLOOK-02 | 08-01, 08-02 | Outlook calendar events sync bidirectionally with local availability database | SATISFIED | syncOutlookCalendarEvents (delta query inbound), createOutlookCalendarEvent (outbound), webhook pipeline for real-time push |
| OUTLOOK-03 | 08-03 | Outlook webhook subscriptions auto-renew before expiry via cron job | SATISFIED | Cron route branches on provider, calls renewOutlookSubscription which PATCHes Graph subscription and updates DB |
| OUTLOOK-04 | 08-01, 08-03 | Owner can disconnect Outlook Calendar and revert to manual availability | SATISFIED | revokeAndDisconnectOutlook deletes subscription/credentials/events; disconnect route with auto-promote; CalendarSyncCard disconnect dialog |
| SCHED-03 | Phase 8 (traceability) | Bidirectional Outlook Calendar sync | SATISFIED | Same implementation as OUTLOOK-02; note: SCHED-03 marked "Pending" in traceability table but implementation is complete |

**Note:** SCHED-03 in the REQUIREMENTS.md traceability table is still marked "Pending" but the implementation fully satisfies it. This is a documentation gap only, not a code gap.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | - | - | - | No TODOs, FIXMEs, placeholders, or stub implementations found in any phase 08 artifact |

### Human Verification Required

### 1. End-to-End Outlook OAuth Flow

**Test:** Click "Connect Outlook Calendar" in dashboard settings, complete Microsoft login with a real M365 account, verify return to dashboard with Outlook shown as connected
**Expected:** OAuth popup opens, user consents, popup redirects to callback, credentials stored, initial sync runs, dashboard shows Outlook row with calendar name and PRIMARY/Make Primary state
**Why human:** Requires live Azure AD app registration, real Microsoft 365 account, and browser-based OAuth flow

### 2. Bidirectional Sync with Real Graph API

**Test:** Create an event in Outlook Calendar web, wait up to 60 seconds, verify it appears in platform availability. Then make a booking through the platform and verify it appears in Outlook.
**Expected:** Graph webhook fires, delta sync runs, event mirrored to calendar_events table. Outbound booking creates event in Outlook with subject and location.
**Why human:** Requires live Graph API webhook delivery to a publicly accessible endpoint

### 3. Subscription Auto-Renewal in Production

**Test:** Wait for subscription to approach 7-day expiry (or trigger cron manually), verify subscription is renewed and sync continues uninterrupted
**Expected:** Cron renews subscription, watch_expiration updated in DB, no sync gap
**Why human:** Requires either waiting for expiry window or staging environment with real Graph subscriptions

### Gaps Summary

No gaps found. All 4 success criteria are verified at the code level. All 15 artifacts exist, are substantive (no stubs), and are fully wired. All 20 tests pass. The CalendarSyncCard is rendered in the dashboard. All 4 OUTLOOK requirements and SCHED-03 are satisfied by the implementation.

The only remaining verification is human testing with a live Microsoft 365 account and Azure AD app registration, which cannot be automated.

---

_Verified: 2026-03-25T12:00:00Z_
_Verifier: Claude (gsd-verifier)_

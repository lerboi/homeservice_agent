---
type: system
system: Scheduling and Calendar
status: current
description: "Webhook Handlers. Covers: Google Push Handler; Outlook Change Handler"
source: .claude/skills/scheduling-calendar-system/SKILL.md § 5. Webhook Handlers
migrated: 2026-11-23
verified:
tags: [voco/system/scheduling-and-calendar]
---

# Webhook Handlers

Part of [[Scheduling and Calendar]]. Migrated verbatim from the `scheduling-calendar-system` skill; check `verified` before trusting details.

### Google Push Handler

**File**: `src/app/api/webhooks/google-calendar/route.js` (the logic lives directly in the route — `src/lib/webhooks/google-calendar-push.js` and its test were DELETED in the 2026-06-12 audit)

Google sends POST to `/api/webhooks/google-calendar` after any calendar state change.

- `X-Goog-Resource-State: sync` — handshake confirmation, return immediately
- `X-Goog-Resource-State: exists` — calendar changed. The tenant is resolved by looking up `calendar_credentials.watch_channel_id === X-Goog-Channel-ID` and using the **DB-sourced `tenant_id`** — the `X-Goog-Channel-Token` header is logged but never trusted
- **No resolvable channel id → dropped with 200** (stops Google retrying). The legacy fallback that trusted the spoofable `X-Goog-Channel-Token` header as a tenant_id was REMOVED: Google push has no HMAC, so that path let anyone trigger arbitrary tenants' calendar syncs. Every channel registered by `registerWatch` writes `watch_channel_id` to `calendar_credentials`, so a legitimate notification always carries a resolvable channel id

The sync runs inside `after()` so Google receives a fast 200 response while `syncCalendarEvents(verifiedTenantId)` runs post-response.

### Outlook Change Handler

**File**: `src/lib/webhooks/outlook-calendar-push.js`

```js
export async function handleOutlookCalendarPush(body)
```

Microsoft Graph sends POST to `/api/webhooks/outlook-calendar` with `body.value[]` array.

For each notification:
1. Validate `notification.clientState === process.env.OUTLOOK_WEBHOOK_SECRET` — skip if invalid
2. Look up tenant via `calendar_credentials.watch_channel_id === notification.subscriptionId AND provider = 'outlook'`
3. Call `syncOutlookCalendarEvents(cred.tenant_id)`

**Validation token flow** (Graph subscription creation requirement): When Graph first creates a subscription, it sends a GET request with `?validationToken=` to the webhook URL. This must be handled by the route returning the token as `text/plain`. The route handler in `src/app/api/webhooks/outlook-calendar/route.js` handles this before delegating to `handleOutlookCalendarPush`.

---

---
type: system
system: Scheduling and Calendar
status: current
description: "Local DB mirror is source of truth — calendar_events table mirrors Google/Outlook events locally. Slot calculator reads from calendar_events, never live-quer…"
source: .claude/skills/scheduling-calendar-system/SKILL.md § 10. Key Design Decisions
migrated: 2026-11-23
verified:
tags: [voco/system/scheduling-and-calendar]
---

# Key Design Decisions

Part of [[Scheduling and Calendar]]. Migrated verbatim from the `scheduling-calendar-system` skill; check `verified` before trusting details.

- **Local DB mirror is source of truth** — `calendar_events` table mirrors Google/Outlook events locally. Slot calculator reads from `calendar_events`, never live-queries the calendar APIs. This keeps the LiveKit agent's slot calculation fast and eliminates dependency on external API availability during calls.

- **`pg_try_advisory_xact_lock` is non-blocking** — Using `pg_try_advisory_xact_lock` instead of `pg_advisory_lock` means if the slot is being concurrently booked, the second transaction immediately returns `slot_taken` instead of queuing. This prevents queue buildup under concurrent call load.

- **`UNIQUE (tenant_id, start_time)` as secondary defense** — Even if two concurrent transactions race through the advisory lock and overlap check simultaneously (extremely rare), the DB-level unique constraint catches the second insert and raises an error. Belt-and-suspenders concurrency safety.

- **Travel buffer is owner-adjustable + symmetric** (M16 P2) — the default buffer is the tenant's `travel_buffer_mins` (DEFAULT 30, 0 disables), enforced on **both** sides of every booking (forward + backward). The zone-differentiated path (same zone = 0-min; cross-zone = `zonePairBuffers` lookup) remains in the code but is dormant (`zone_id` always NULL), so every booking resolves to the flat owner-set value. `candidateZoneId` is still passed through for that dormant path.

- **`after()` for calendar push** — `pushBookingToCalendar` is always called inside `after()` from webhook handlers. Calendar event creation never blocks the synchronous `book_appointment` response to the AI. This keeps the booking confirmation fast and tolerates temporary calendar API unavailability.

- **Store full deltaLink URL as `last_sync_token` for Outlook** — Microsoft Graph returns `@odata.deltaLink` as a full URL containing the delta state. Storing the full URL (not just a token fragment) avoids having to reconstruct the endpoint. Google uses a bare `nextSyncToken` string — the two providers have different sync token patterns.

- **Direct fetch for Outlook token refresh (serverless-safe)** — MSAL's `acquireTokenSilent` relies on in-memory token cache. In serverless environments, each request may start a fresh process with no cache. `refreshOutlookAccessToken` bypasses MSAL cache entirely and posts directly to the token endpoint.

- **`is_primary` flag for multi-provider calendar push** — Only the primary calendar receives pushed booking events. `pushBookingToCalendar` queries `is_primary=true`, so pushing to one calendar is deterministic regardless of how many providers are connected. First connected calendar becomes primary; owner can re-assign via dashboard (optimistic UI swap).

- **`PROVIDER_CONFIG` map** — Auth endpoints, icon colors, popup names are centralized in a config map in the dashboard component (not scattered across files). Adding a third provider requires one config entry, not changes across multiple files.

- **Optimistic UI for make-primary badge swap** — The dashboard swaps primary badge instantly on click, then reverts on server error. No loading spinner — perceived instant response.

- **Admin consent detection in Outlook callback** — Microsoft 365 Business accounts with admin-controlled app permissions trigger `consent_required` or `AADSTS65001` error codes. The callback detects these and redirects to `?calendar=admin_consent` for a specific error message, distinct from generic OAuth failures.

- **Google OAuth state = HMAC-signed tenant_id** — The `state` parameter is a `tenantId:hmac` string signed via HMAC-SHA256 (keyed on `SUPABASE_SERVICE_ROLE_KEY`). The callback calls `verifyOAuthState()` to validate the signature before extracting the tenant_id. Outlook auth imports `signOAuthState` from the Google auth route rather than having its own implementation.

- **Webhook tenant identity comes from the DB, never headers (2026-06-12)** — Google push has no HMAC, so the `X-Goog-Channel-Token` header is spoofable. The Google webhook resolves the tenant exclusively via `watch_channel_id` lookup in `calendar_credentials`; unresolvable notifications are dropped with 200. (Outlook's equivalent is the `clientState` shared-secret check.)

- **Sync windows must be re-anchored, not just renewed (2026-06-12)** — Sync tokens (Google `nextSyncToken`, Outlook deltaLink) only report changes inside the window of the last FULL sync. The monthly re-anchor in `renew-calendar-channels` (clear token → wipe mirror → full resync) keeps the now−30d→now+180d window rolling; the 410 recovery paths re-anchor lazily on token expiry.

---

---
type: system
system: Scheduling and Calendar
status: current
description: "Which files implement Scheduling and Calendar and what each one is responsible for."
source: .claude/skills/scheduling-calendar-system/SKILL.md § File Map
migrated: 2026-11-23
verified:
tags: [voco/system/scheduling-and-calendar]
---

# File Map

Part of [[Scheduling and Calendar]]. Migrated verbatim from the `scheduling-calendar-system` skill; check `verified` before trusting details.

| File | Role |
|------|------|
| `src/lib/scheduling/slot-calculator.js` | Pure slot calculation — no DB, fully testable |
| `src/lib/scheduling/booking.js` | Calls `book_appointment_atomic` Supabase RPC |
| `src/lib/scheduling/google-calendar.js` | Google Calendar: OAuth, push, sync, watch, revoke |
| `src/lib/scheduling/outlook-calendar.js` | Outlook Calendar: MSAL, Graph, delta sync, subscription, revoke |
| `src/app/api/webhooks/google-calendar/route.js` | Google push notification route — handshake ack, `watch_channel_id` → tenant lookup (DB-trusted), sync via `after()`. The old `src/lib/webhooks/google-calendar-push.js` + its test were DELETED (2026-06-12) when the spoofable header fallback was removed |
| `src/lib/webhooks/outlook-calendar-push.js` | Outlook Graph notification handler (validates + triggers sync) |
| `src/app/api/google-calendar/auth/route.js` | GET — returns Google OAuth consent URL |
| `src/app/api/google-calendar/callback/route.js` | GET — handles Google OAuth callback, stores creds, registers watch, initial sync |
| `src/app/api/outlook-calendar/auth/route.js` | GET — returns Microsoft OAuth consent URL |
| `src/app/api/outlook-calendar/callback/route.js` | GET — handles Microsoft OAuth callback, stores creds, creates Graph subscription, initial sync |
| `src/app/api/appointments/route.js` | GET — returns appointments + external events + travel buffers + conflicts for a date range |
| `src/app/api/appointments/[id]/route.js` | GET — single appointment with call data; PATCH — cancel (deletes external event via the owning provider's credential) or dismiss conflict |
| `src/app/api/appointments/available-slots/route.js` | GET — dashboard slot lookup; fetches bookings + calendar_events/calendar_blocks mirrors (selecting `is_all_day`) and runs `calculateAvailableSlots` |
| `src/app/api/cron/renew-calendar-channels/route.js` | POST — dual-provider channel/subscription renewal (run daily) |
| `src/app/api/working-hours/route.js` | GET/PUT — tenant working_hours JSONB, slot_duration_mins, tenant_timezone |
| `src/app/api/service-area/route.js` | GET/PUT — the single flat Service Area coverage list (GET returns the union of `postal_codes` + `cities` across rows + tenant `out_of_area_action`/`out_of_area_referral_note`; PUT collapses coverage into ONE canonical `service_zones` row — updates the oldest row in place, deletes extras — and persists the two tenant settings). Replaced the git-rm'd `api/zones/route.js` + `api/zones/[id]/route.js` (M16 P1). Dashboard surface is `ServiceAreaManager.js` (see dashboard-crm-system skill) |
| `supabase/migrations/003_scheduling.sql` | Appointments, zones, credentials, events tables + `book_appointment_atomic` function (since extended — 17-arg as of 062) |
| `supabase/migrations/007_outlook_calendar.sql` | Adds is_primary to calendar_credentials; renames google_event_id → external_event_id on appointments |
| `supabase/migrations/019_appointments_exclusion_constraint.sql` | Replaces `UNIQUE(tenant_id, start_time)` with GiST exclusion constraint `appointments_no_overlap` (no overlapping non-cancelled ranges per tenant) |
| `supabase/migrations/062_phase61_address_validation.sql` | Extends `book_appointment_atomic` to its current 17-arg signature (6 validated-address params, all DEFAULT NULL) — see auth-database-multitenancy skill |
| `supabase/migrations/038_schema_hardening_2.sql` | `set_primary_calendar(p_tenant_id, p_provider)` RPC — atomic primary-calendar swap (single-statement UPDATE that flips is_primary across all of a tenant's calendar_credentials rows in one transaction). SECURITY DEFINER, service_role only. |
| `supabase/migrations/074_service_area_gate.sql` | **M16 P1 (2026-06-20) — PENDING manual apply.** Adds `service_zones.cities text[] NOT NULL DEFAULT '{}'` (Service Area town/city coverage) + tenant `out_of_area_action` / `out_of_area_referral_note` owner settings. See §8. |

---

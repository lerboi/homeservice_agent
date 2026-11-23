---
type: system
system: Scheduling and Calendar
status: current
description: "The app declares 11 Vercel Cron endpoints in vercel.json. Only renew-calendar-channels is strictly 'scheduling/calendar' — the others touch adjacent systems … Covers: `renew-calendar-channels` (scheduling/calendar specific); Recurring appointments + maintenance contracts — NOT implemented"
source: .claude/skills/scheduling-calendar-system/SKILL.md § 6. Cron Jobs
migrated: 2026-11-23
verified:
tags: [voco/system/scheduling-and-calendar]
---

# Cron Jobs

Part of [[Scheduling and Calendar]]. Migrated verbatim from the `scheduling-calendar-system` skill; check `verified` before trusting details.

The app declares **11 Vercel Cron endpoints** in `vercel.json`. Only `renew-calendar-channels` is strictly "scheduling/calendar" — the others touch adjacent systems (recovery SMS, trial/invoice reminders, orphan cleanup, recurring invoice generation, Jobber schedule mirror, integration token keep-fresh, rate-limit cleanup, churned-number release, meter-event retry) and are listed here for completeness so readers know the full cron surface:

| # | Route | Schedule | Purpose |
|---|-------|----------|---------|
| 1 | `POST /api/cron/send-recovery-sms` | `* * * * *` (every minute) | Sends SMS recovery messages to callers whose calls were analyzed but didn't book. Two branches: first-send for `not_attempted` calls, and retries (up to 3 total) with exponential backoff (30s → 120s). |
| 2 | `GET /api/cron/trial-reminders` | `0 9 * * *` (daily 9:00 UTC) | Sends day-7 and day-12 trial reminder emails to trialing subscription tenants. Idempotency via the `billing_notifications` table (composite uniqueness on tenant + notification type). |
| 3 | `GET /api/cron/renew-calendar-channels` | `0 2 * * *` (daily 2:00 UTC) | **Primary responsibility of this skill.** Renews expiring Google Calendar watch channels and Outlook subscriptions before their 7-day TTLs expire. See detailed spec below. |
| 4 | `GET /api/cron/invoice-reminders` | **UNSCHEDULED 2026-08-20** (was `0 9 * * *`) | Invoicing v1 freeze: removed from `vercel.json` and no-op gated on `INVOICING_ENABLED` (`src/lib/invoicing-enabled.js`, fail-closed master flag; the per-tenant enable toggle is also blocked while it's off, so no tenant can depend on this cron). Route kept in-tree. When live it sends payment reminders at −3/0/+3/+7 days, applies late fees, and flips `sent`→`overdue`. Re-enable = flip the flag AND re-add the schedule (checklist in the flag file). |
| 5 | `GET /api/cron/recurring-invoices` | **UNSCHEDULED 2026-08-20** (was `0 8 * * *`) | Same freeze as row 4 (flag-gated, removed from `vercel.json`, in-tree). When live it generates draft invoices from active recurring templates where `recurring_next_date <= today`, advancing `recurring_next_date` without drift. |
| 6 | `GET /api/cron/cleanup-orphaned-calls` | `0 */4 * * *` (every 4 hours) | Finds calls stuck in `status='started'` for more than 2 hours, marks them `failed` with reason `'orphaned'`. Covered by voice-call-architecture. |
| 7 | `GET /api/cron/poll-jobber-visits` | `*/15 * * * *` (every 15 min) | Phase 57 Jobber schedule-mirror poll fallback (webhooks are primary). Re-fetches the P90/F180 visit window per Jobber tenant; idempotent via the `calendar_events` UNIQUE upsert. Covered by integrations-jobber-xero. |
| 8 | `GET /api/cron/cleanup-rate-limits` | `0 3 * * *` (daily 3:00 UTC) | Prunes stale `rate_limit_hits` rows (prod-readiness 2026-06). Covered by auth-database-multitenancy. |
| 9 | `GET /api/cron/refresh-integration-tokens` | `*/10 * * * *` (every 10 min) | **Added 2026-06-10.** Keep-fresh sweep for Jobber/Xero OAuth tokens: refreshes healthy `accounting_credentials` rows expiring within 15 min via `refreshTokenIfNeeded(admin, cred, { bufferMs })`, so the LiveKit agent's sub-second call path never has to perform a rotation-bearing refresh. Skips rows with `error_state` set. Covered by integrations-jobber-xero. |
| 10 | `GET /api/cron/release-churned-numbers` | `0 4 * * *` (daily 4:00 UTC) | **Added 2026-06-12.** Releases phone numbers of tenants whose current subscription is canceled >30 days (SG → phone_inventory, US/CA → Twilio release). Covered by payment-architecture. |
| 11 | `GET /api/cron/retry-meter-events` | `0 */6 * * *` (every 6 hours) | **Added 2026-06-12.** Drains the `stripe_meter_failures` outbox (migration 071) — re-posts failed Stripe Billing Meter overage events with the idempotent `overage_{call_id}` identifier. Covered by payment-architecture. |

All cron endpoints require `Authorization: Bearer {CRON_SECRET}` and return 401 without it (Vercel Cron provides this header automatically from the deployment secret).

### `renew-calendar-channels` (scheduling/calendar specific)

**File**: `src/app/api/cron/renew-calendar-channels/route.js`

**Endpoint**: `GET /api/cron/renew-calendar-channels` (Vercel Cron uses GET)

**Auth**: `Authorization: Bearer {CRON_SECRET}` header required (returns 401 otherwise)

**Logic**:
1. Query `calendar_credentials` where `watch_channel_id IS NOT NULL AND watch_expiration < now() + 24h`
2. For each expiring credential:
   - `provider = 'google'` → call `registerWatch(tenant_id, { access_token, refresh_token, expiry_date })` — creates a new 7-day watch channel
   - `provider = 'outlook'` → call `renewOutlookSubscription(cred)` — PATCHes existing subscription for +7 days (404 → creates a fresh subscription, see §4)
3. **Monthly window re-anchor (2026-06-12, runs when `new Date().getDate() === 1`)**: for EVERY connected credential (google + outlook, capped at 100): clear `last_sync_token`, delete that tenant+provider's `calendar_events` mirror rows, and run a full `syncCalendarEvents` / `syncOutlookCalendarEvents`. **Why**: both providers' sync windows (now−30d → now+180d) are otherwise fixed at whatever moment the LAST full sync ran — sync tokens only report changes inside the original window, so ~6 months after connect the mirror stopped seeing new events entirely unless a fortuitous 410 forced a resync. Per-credential failures are logged and don't abort the loop
4. Returns `{ ok: true, renewed: N, failed: M, reanchored: R, results: [...] }`

**Why run daily**: Both Google watch channels and Outlook subscriptions have 7-day TTLs. Running daily with a 24h lookahead ensures channels are renewed before they expire even if a cron execution is missed.

### Recurring appointments + maintenance contracts — NOT implemented

Phase 43 on the roadmap lists "recurring appointments and maintenance contracts" but **neither is implemented in the appointments subsystem** as of 2026-04-15:

- The `appointments` table has no `recurring_*` / `rrule` / `recurrence_group_id` columns (verified through migrations 001-050).
- There is no `src/app/api/appointments/recurring` route, no `RecurringSetupDialog` or `RecurringBadge` wired to appointments, and no recurrence-aware logic in the slot calculator or atomic booking RPC.
- "Maintenance contracts" appears only in marketing copy and the pricing page ("no lock-in contracts"). There is no `contracts` table, no contract API routes, and no contract-flavored CRM components.

**Where recurring DOES exist**: Invoice generation. Migration 032 (`reminders_recurring.sql`) adds `is_recurring_template`, `recurring_frequency`, `recurring_start_date`, `recurring_end_date`, `recurring_next_date`, `recurring_active`, and `generated_from_id` to the `invoices` table. The `recurring-invoices` cron (row 5 above) consumes that. If you're asked about "recurring" for this codebase, confirm whether the user means invoices (implemented, covered by payment-architecture) or appointments (not yet implemented — would need a phase).

---

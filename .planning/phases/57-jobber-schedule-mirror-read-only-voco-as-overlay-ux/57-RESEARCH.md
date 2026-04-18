# Phase 57: Jobber Schedule Mirror (read-only) + Voco-as-Overlay UX — Research

**Researched:** 2026-04-19
**Domain:** Jobber GraphQL visits/users/assignments + webhook topic extension, Next.js `calendar_events` schema extension for third provider, poll-fallback cron pattern, dashboard calendar muted-overlay retrofit, interim copy-to-clipboard booking UX, forward-compat idempotency key
**Confidence:** HIGH on the Next.js-side surface (P56 shipped code is directly readable and locks 90% of the scaffolding); HIGH on calendar_events schema/slot-path changes (single CHECK widen, zero hot-path edits); MEDIUM on Jobber GraphQL visit/user/assignment query shapes (GraphiQL is the authoritative source — exact field names confirmed at implementation time); MEDIUM on Jobber `WebHookTopicEnum` value names for visit/assignment events (docs reference the enum but do not enumerate values; verify in Developer Center at Plan 01); HIGH on UI-SPEC compliance (UI contract already finalized and checker-approved).

---

## Project Constraints (from CLAUDE.md)

- **Brand name is Voco** — never "HomeService AI" or "homeserviceai". Fallback email domain: `voco.live`.
- **Skill-sync rule** — read relevant skill before changes, update after. P57 touches `scheduling-calendar-system` (adds Jobber as third provider, calendar_events extension, poll cron branch), `dashboard-crm-system` (overlay retrofit, banner, pills, copy-to-clipboard flyout section), `auth-database-multitenancy` (migration 055 provider CHECK widen, bookable-user storage, optional `jobber_booking_id` column on appointments). `voice-call-architecture` is a referenced-only skill — `check_availability` hot path stays unchanged by this phase.
- **All DB tables documented in `auth-database-multitenancy`** — `calendar_events` is the canonical external-events mirror. Migration 003 created it; P57 extends `provider` CHECK.
- **Tech stack pinned** — Next.js 16 (App Router) + Supabase + LiveKit + Gemini 3.1 Flash Live. Jobber GraphQL via existing `graphql-request@^7.4.0`.
- **livekit-agent lives in a SEPARATE Python repo** at `C:/Users/leheh/.Projects/livekit-agent/`. Phase 57 does NOT touch the Python repo — the slot-query path reads `calendar_events` as today, so adding `provider='jobber'` rows requires zero Python changes.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Bookable-Users Subset (Q1)
- **D-01:** Adopt Jobber's "bookable team members" pattern Voco-side. Per-tenant opt-in set of Jobber user IDs; only visits whose assignees intersect this set are mirrored and block availability.
- **D-02:** Connect-flow picker pulls Jobber users on OAuth callback. Pre-select users with ≥1 visit in the last 30 days. Auto-skip the picker entirely if the Jobber account has exactly one user.
- **D-03:** If zero users have visits in the last 30 days, pre-select **all users**. Safer default: no signal → block everyone; owner deselects office/admin users.
- **D-04:** Settings panel allows later edits. On save, trigger **immediate diff-sync**: delete `calendar_events` for removed users, fetch+insert events for added users across the Past 90 / Future 180 window. Synchronous.
- **D-05:** Unassigned Jobber visits (no assignee picked) **DO block availability**.
- **D-06:** Mirror only visits with status `scheduled` or `in-progress` and a concrete start/end time. Cancelled, completed, draft/anytime visits are NOT mirrored.

#### Dashboard Calendar Overlay UX (Q3 + JOBSCHED-05)
- **D-07:** Thin-overlay model. Voco-booked appointments render first-class, editable. Mirrored Jobber visits render muted, "From Jobber" pill, NOT editable, click-through opens the visit in Jobber in a new tab. Fall back to Jobber schedule day-view if per-visit URL is unavailable.
- **D-08:** **Retrofit Google and Outlook events to the same muted/non-editable treatment in Phase 57** — universal pattern across all external providers.

#### Interim Copy-to-Jobber UX (Q2 + JOBSCHED-06)
- **D-09:** Every Voco-only appointment gets a permanent **"Not in Jobber yet" pill** inline on the calendar and in lead/appointment detail views until Phase 999.3 ships.
- **D-10:** One-click "Copy details to clipboard" per appointment — paste-ready block (client name, phone, address, start, duration, notes). Jobber new-visit deep link adjacent.
- **D-11:** **Extend the existing booking-complete email** with a conditional block shown only when Jobber is connected AND push is unavailable. Paste-ready block + Jobber link. Single email per booking.
- **D-12:** Dashboard banner on `/dashboard/calendar` — "Jobber push is coming soon…". **Dismissible per-user, persists across sessions.**
- **D-13:** Voco booking UUID persisted on the appointment row as idempotency key for Phase 999.3 push.

#### Sync Mechanics
- **D-14:** Mirror window: **Past 90 days / Future 180 days**.
- **D-15:** Poll-fallback cron runs **every 15 minutes**, added to existing `/api/cron/renew-calendar-channels`. Webhooks primary; poll handles outages only.
- **D-16:** Webhook handler `/api/webhooks/jobber` (Phase 56) extends to route visit/job/assignment events → upsert/delete in `calendar_events` + `revalidateTag('jobber-context:{tenant}:{phone}')` for customer-context side-effects.

#### Schema
- **D-17:** Extend `calendar_events.provider` CHECK constraint to include `'jobber'`.
- **D-18:** Bookable-users set storage — finalize during planning: either `jobber_bookable_user_ids text[]` on the Phase 56 Jobber-connection row, or a new `jobber_connections` table. Planning-time decision based on what Phase 56 landed.

### Claude's Discretion

- Jobber per-visit URL format — planner confirms stability during implementation; fall back to schedule day-view URL if unstable.
- Exact visual tokens for muted/faded external events (UI-SPEC already locks these).
- Bookable-users picker UI shape — UI-SPEC locks checkbox list.
- Empty-state copy when bookable-set is empty.
- Dismissed-banner storage key (localStorage per UI-SPEC) — locked to `voco_jobber_copy_banner_dismissed`.

### Deferred Ideas (OUT OF SCOPE)

- Voco → Jobber push (Phase 999.3)
- Per-service bookable-member subsets (Phase 58+)
- Role-based auto-sync of bookable set (Phase 58)
- Technician-specific booking ("book with Tech A")
- Inline edit of Jobber visits in Voco (requires bidirectional push)
- "Hide Jobber visits" per-user toggle
- Crew notification when Voco books
- Merged-dedupe logic in Jobber when 999.3 ships (interim UUID preserved here; push phase consumes it)

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **JOBSCHED-01** | `calendar_events.provider` CHECK includes `'jobber'`; Jobber visit/job webhook syncs into local `calendar_events` table | Pattern 1 (migration 055 — single CHECK widen, no RLS/index change); Pattern 4 (webhook handler extension into existing `/api/webhooks/jobber`); Pattern 5 (upsert shape + `external_id` convention + `provider_metadata` usage note); Code Example 1 (visit → calendar_events row mapper). |
| **JOBSCHED-02** | Slot availability checks cover Google + Outlook + Jobber through a single `calendar_events` query — zero added call-path latency | Pattern 2 (slot query is already provider-agnostic — widening the CHECK surfaces Jobber rows automatically to both the Next.js `available-slots` route AND the Python agent's `check_availability` tool). Confirmed by code read: `src/app/api/appointments/available-slots/route.js:87-91` selects from `calendar_events` with NO provider filter. Python agent per `scheduling-calendar-system` skill line 170 reads the same table the same way. ZERO hot-path code change required. |
| **JOBSCHED-03** | Poll-fallback cron handles missed Jobber webhooks; subscription renewal added to `/api/cron/renew-calendar-channels` | Pattern 3 (cron extension — branches alongside Google `registerWatch` / Outlook `renewOutlookSubscription`); Pattern 9 (differential sync using `updatedAt >= last_polled_at` + tombstone sweep for deletes). Jobber has no subscription "renewal" concept (webhooks are registered at app-level in Developer Center, not per-tenant), so this branch is pure delta-poll, not subscription renewal. Cron cadence needs to step down from daily to every 15 minutes — schedule change required in `vercel.json`. |
| **JOBSCHED-04** | Per-tenant "bookable users" set — mirror only syncs visits whose assignees intersect this set; connect flow picker, auto-skip for solo, ≥30-day pre-select, settings panel with diff-sync | Pattern 6 (storage — recommend `accounting_credentials.jobber_bookable_user_ids text[]` reusing existing Jobber row); Pattern 7 (picker data fetch — `users` + 30d `visits` counts query); Pattern 8 (diff-sync on settings save). Migration 055 adds the column alongside CHECK widen. Connect-flow step injected between OAuth callback success and redirect (new route `/dashboard/integrations/jobber/setup`). |
| **JOBSCHED-05** | Thin-overlay dashboard calendar; Voco first-class + editable, Jobber muted + "From Jobber" pill + click-through, same treatment retrofit to Google/Outlook | Pattern 10 (retrofit `ExternalEventBlock` in `CalendarView.js:373-392` — replace violet-only treatment with slate-muted + provider-aware pill); UI-SPEC §Component Inventory §1 locks exact visual contract. Jobber per-visit URL pattern documented in Pattern 11. |
| **JOBSCHED-06** | Interim "Not in Jobber yet" UX — badge, copy-to-clipboard paste block, Open Jobber deep link, banner, conditional email block | Pattern 12 (AppointmentFlyout copy section — new `CopyToJobber` sub-component); Pattern 13 (localStorage-backed dismissible banner); Pattern 14 (email template extension — mirror XeroReconnectEmail style inside new `BookingCopyToJobberEmail.jsx` OR inline-extend existing post-booking email — current codebase has NO post-booking email template shipped, so Plan creates one). UI-SPEC §Copywriting locks every string. |
| **JOBSCHED-07** | Voco booking ID (UUID) persisted on appointment row as idempotency key for Phase 999.3 push | Pattern 15 (forward-compat column — `appointments.id` itself IS a UUID; no new column needed unless Plan adds `jobber_visit_id TEXT` for future dedupe. Recommend adding `jobber_visit_id TEXT NULL` + partial unique index in migration 055 so Phase 999.3 can populate it atomically). |

</phase_requirements>

---

## Summary

Phase 57 adds Jobber as a third external calendar provider on top of the Phase 56 Jobber adapter — the work is overwhelmingly **wiring**, not new invention. Three architectural observations drop the blast radius from "looks ambitious" to "four small patterns and a UI retrofit":

1. **The call-path requires zero changes.** Both the Next.js `available-slots` route (line 87-91) and the Python agent's `check_availability` tool read `calendar_events` with NO provider filter — they are already provider-agnostic. Widening the CHECK constraint to include `'jobber'` surfaces Jobber rows to the slot calculator automatically. JOBSCHED-02's "zero added call-path latency" is a near-free guarantee. No Python-repo change.

2. **Phase 56 already built the webhook endpoint.** `/api/webhooks/jobber` (shipped 2026-04-18 per STATE.md line 75) has HMAC verification, topic-prefix routing, and tenant resolution via `accounting_credentials.external_account_id`. P57 extends the topic-prefix router to add a `VISIT_*` / `JOB_*` / `assignment` branch that upserts into `calendar_events` instead of (or in addition to) the existing `revalidateTag` customer-context path. The handler file grows; it does not fork.

3. **The UI-SPEC is already locked.** `57-UI-SPEC.md` is checker-approved and specifies every pill shape, color token, copy string, localStorage key, and component boundary. Planning can consume the UI contract verbatim — no design exploration needed.

The **most consequential open decision** is the exact shape of Jobber's visit/assignment/user GraphQL queries. Jobber publishes its schema only through GraphiQL; the official docs confirm the fields exist (`assignedUsers`, `startAt`, `endAt`, `visitStatus`) but do not enumerate enum values or guaranteed pagination limits. Plan 01 must open GraphiQL before locking query strings. The `WebHookTopicEnum` for visit/assignment events is similarly GraphiQL-only territory — CONTEXT.md D-16 assumes topics exist like `VISIT_CREATE`/`VISIT_UPDATE`/`VISIT_DESTROY` and `JOB_ASSIGNMENT_*` but the names must be confirmed. Fallback: if visit-level webhooks don't exist at the granularity we need, route through `JOB_UPDATE` + in-handler visit-diff against the mirror.

The **second-most-consequential finding** is that Jobber has no subscription-renewal concept for webhooks — subscriptions are registered at the app level in the Developer Center, not per-tenant, and they do not expire. This means the "renewal" branch in `/api/cron/renew-calendar-channels` is actually a **differential-poll** branch: query visits changed since `last_polled_at`, upsert changes, tombstone-sweep deletes. This is simpler than Google/Outlook's watch-channel renewal but cadence must step down from daily to every 15 minutes, which is a `vercel.json` schedule edit.

The **third-most-consequential finding** is that the current `calendar_events` table schema supports everything Phase 57 needs with one CHECK widen — no `external_metadata` or provider-specific column additions required. Jobber visit ID stores in `external_id`; assignee IDs can ride in the `title` field (e.g., `"Jobber visit — Tech Sarah"`) or, cleaner, in a new nullable `provider_metadata JSONB` column if planner wants structured access without re-querying Jobber. Recommend NOT adding `provider_metadata` in P57 and instead encoding the assignee name in `title` — the agent never needs structured access to the assignee, only the start/end time window; the dashboard renders `title` verbatim.

**Primary recommendation:** Implement as five plans sized roughly: (01) Migration 055 + provider CHECK widen + bookable-user storage + optional `jobber_visit_id` on appointments + cron schedule update. (02) Jobber visits/users GraphQL fetchers + initial-sync backfill function. (03) Webhook handler extension for visit/job/assignment events + tests. (04) Bookable-users picker (connect flow + settings panel) + diff-sync. (05) Dashboard overlay retrofit + banner + copy-to-clipboard + email extension + per-appointment pill. Verify Jobber GraphQL schema against GraphiQL at the very start of Plan 02 before any query string is committed.

---

## Standard Stack

### Core (Next.js side — all already present)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `graphql-request` | `^7.4.0` | Jobber visit/user GraphQL queries | Already in package.json from Phase 56. Reuse. [VERIFIED: P56 RESEARCH line 134 + 561] |
| `libphonenumber-js` | `^1.12.41` | Normalize Jobber client phones on mirrored visit rows if we emit phone in title/metadata | Already in package.json from P56. Reuse. [VERIFIED: P56 RESEARCH line 135] |
| Next.js | 16.x | App Router, `'use cache'`, `revalidateTag` | Voco's framework [VERIFIED: `next.config.js` has `cacheComponents: true` per Phase 54] |
| `@supabase/supabase-js` | `^2.99.2` | Service-role reads/writes of `calendar_events`, `accounting_credentials`, `appointments` | Standard project DAL [VERIFIED: package.json] |
| `date-fns` | `^4.1.0` | Date arithmetic on 90/180 day window + "30d activity" heuristic | Project-standard [VERIFIED: package.json] |
| Node `crypto` | built-in | HMAC continues to verify Jobber webhooks via `JOBBER_CLIENT_SECRET` | P56 webhook already uses this [VERIFIED: `src/app/api/webhooks/jobber/route.js:63-77`] |
| `resend` + `@react-email/components` | `^6.9.4` / `^1.0.10` | Booking-complete email conditional block OR new `BookingCopyToJobberEmail.jsx` | Existing infra [VERIFIED: `src/emails/*.jsx` — 7 templates shipped] |
| `sonner` | latest installed | `toast.success("Copied to clipboard")` / `toast.error` feedback on copy action | UI-SPEC references sonner; already used across dashboard |

### No new dependencies required

Every library needed for Phase 57 is already installed by Phases 54–56. This is a pure wiring/retrofit phase — there is no new primitive that requires an npm install.

### Version verification (verified 2026-04-19)

All dependencies above verified present via `package.json` and Phase 56 shipped code. No `npm view` checks required because versions are pinned by what P56 landed on.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Extending `/api/webhooks/jobber` | New `/api/webhooks/jobber-schedule` endpoint | Splitting endpoints doubles HMAC verification cost, doubles the tenant-resolution lookup, and fragments the single-source-of-truth for Jobber webhook handling. CONTEXT D-16 locks single endpoint. Rejected. |
| Adding `provider_metadata JSONB` to `calendar_events` | Storing assignee name in `title` directly | Structured JSON column is future-proof but adds migration complexity + unused surface today. The agent/dashboard only need start/end/title. Encode assignee into the `title` string (`"Jobber: {client} — {assignee}"`) and defer `provider_metadata` until a concrete need arises. |
| `jobber_connections` new table (D-18 option) | `jobber_bookable_user_ids text[]` on `accounting_credentials` | A new table cleanly isolates the bookable-users set. But Phase 56 already stores Jobber OAuth state on `accounting_credentials` (one row per tenant per provider). Adding one column to the existing row is strictly simpler than a new table + FK + RLS policies. **Recommend the column.** |
| Every-15-min poll cron | Background job queue (BullMQ/pg-boss) | Voco has no job queue today. Adding one for a single biweekly-per-hour poll is massive overkill. Vercel Cron at `*/15 * * * *` with existing `CRON_SECRET` pattern is the minimum viable path. |
| Post-booking email as new template | Inline-extend an existing email | **No post-booking email template exists today.** The only post-booking notifications are `sendOwnerSMS` and `sendCallerSMS` (no corresponding email). UI-SPEC §Copywriting specifies heading "Don't forget to add this to Jobber" which implies an owner-facing email. Plan creates `BookingCopyToJobberEmail.jsx` as a NEW template, rather than splicing into a nonexistent base email. |
| `jobber_visit_id` on appointments | Use `appointments.id` directly as idempotency key | `appointments.id` is already a UUID and already unique per booking (JOBSCHED-07 is satisfied by this alone). Adding `jobber_visit_id TEXT` gives Phase 999.3 a place to write back the Jobber visit ID AFTER push succeeds, closing the loop for cross-system correlation. Minimal cost now (single nullable column), big payoff for 999.3. **Recommend adding.** |

---

## Architecture Patterns

### Recommended Project Structure

Phase 57 touches these files:

```
src/
├── lib/integrations/
│   └── jobber.js                                 # P57 EXTENDS — adds fetchJobberVisits, fetchJobberUsers,
│                                                  #               mirrorJobberVisitsToCalendarEvents,
│                                                  #               diffSyncBookableUsers
├── lib/scheduling/
│   └── jobber-schedule-mirror.js                 # P57 NEW — pure mapper visit → calendar_events row
│                                                  #           + initial-backfill helper
├── app/
│   ├── api/
│   │   ├── webhooks/jobber/route.js              # P57 EXTENDS — adds VISIT_*/JOB_*/ASSIGNMENT_* topic routing
│   │   │                                          #   to call mirrorJobberVisits() in addition to existing
│   │   │                                          #   customer-context revalidateTag logic
│   │   ├── cron/renew-calendar-channels/route.js # P57 EXTENDS — adds Jobber-poll branch for expired/missed
│   │   │                                          #   visits (delta poll, NOT subscription renewal)
│   │   ├── integrations/jobber/
│   │   │   ├── bookable-users/route.js           # P57 NEW — GET (list Jobber users + 30d visit counts)
│   │   │   │                                      #            PATCH (save selection + trigger diff-sync)
│   │   │   └── resync/route.js                   # P57 NEW — POST (manual resync for debugging or after
│   │   │                                      #                   a tenant enables new users)
│   │   └── appointments/route.js                 # P57 TOUCHES (optional) — if per-appointment pill needs
│   │                                             #                          jobber_visit_id in the response
│   ├── dashboard/
│   │   ├── calendar/page.js                      # P57 TOUCHES — inject banner, pass `jobberConnected` prop
│   │   │                                          #                to CalendarView, pass `jobber_visit_id`
│   │   │                                          #                into appointments list
│   │   └── integrations/jobber/setup/page.js     # P57 NEW — bookable-users picker as post-OAuth step
│   │                                             #            (solo-user auto-skip handled server-side)
├── components/dashboard/
│   ├── CalendarView.js                           # P57 EXTENDS — retrofit ExternalEventBlock (line 373-392)
│   │                                             #   to slate-muted + provider pill (Jobber/Google/Outlook)
│   │                                             #   + add "Not in Jobber yet" pill on AppointmentBlock
│   │                                             #   (top-right, when jobberConnected && !jobber_visit_id)
│   ├── AppointmentFlyout.js                      # P57 EXTENDS — inject CopyToJobber section
│   ├── CopyToJobberSection.jsx                   # P57 NEW — flyout sub-component (heading, copy button,
│   │                                             #   Open-in-Jobber link, toast feedback)
│   ├── JobberCopyBanner.jsx                      # P57 NEW — dismissible localStorage-backed banner on
│   │                                             #   /dashboard/calendar
│   ├── BookableUsersPicker.jsx                   # P57 NEW — used in setup page + settings card section
│   └── BusinessIntegrationsClient.jsx            # P57 EXTENDS — add bookable-users collapsible section
│                                             #   to the Jobber connected-state card
└── emails/
    └── BookingCopyToJobberEmail.jsx              # P57 NEW — one-off email sent when Voco books and Jobber
                                                  #   is connected (push not yet available)

supabase/migrations/
└── 055_jobber_schedule_mirror.sql                # P57 NEW — extends calendar_events.provider CHECK,
                                                  #           adds accounting_credentials.jobber_bookable_user_ids,
                                                  #           adds appointments.jobber_visit_id + partial unique index

vercel.json                                       # P57 TOUCHES — cron cadence daily → */15 * * * *
```

### Pattern 1: Migration 055 — CHECK widen + bookable-users storage + forward-compat idempotency column (JOBSCHED-01, -04, -07)

Single migration, additive, idempotent:

```sql
-- supabase/migrations/055_jobber_schedule_mirror.sql

-- Step 1: Widen calendar_events.provider CHECK to permit 'jobber'.
-- Existing CHECK (from 003_scheduling + 007_outlook_calendar implicit widening) is
-- named `calendar_events_provider_check`. If the actual name differs in the live DB,
-- the DROP below fails loudly — fix by querying pg_constraint for the real name.
ALTER TABLE calendar_events
  DROP CONSTRAINT IF EXISTS calendar_events_provider_check;

ALTER TABLE calendar_events
  ADD CONSTRAINT calendar_events_provider_check
  CHECK (provider IN ('google', 'outlook', 'jobber'));

-- Step 2: Per-tenant bookable-users set on the existing Jobber row.
-- Column is NULLABLE to distinguish "not yet set up" (NULL) from "explicit empty
-- selection" (empty array). A NULL value means "mirror all visits from this tenant"
-- — matching behavior before the picker flow completes. Once the picker saves,
-- even a deselect-all writes `{}` (empty array) so the mirror can semantically
-- "block no one." However per D-05, unassigned visits ALWAYS block regardless of
-- this set, so the empty-array state still produces a partial mirror.
ALTER TABLE accounting_credentials
  ADD COLUMN IF NOT EXISTS jobber_bookable_user_ids TEXT[];

COMMENT ON COLUMN accounting_credentials.jobber_bookable_user_ids IS
  'Phase 57: per-tenant bookable Jobber user IDs. NULL = not yet configured '
  '(mirror all); [] = explicit empty; [...ids] = intersect visits whose '
  'assigned_user_id ∈ this set. D-01, D-04, D-05, D-06.';

-- Step 3: Forward-compat idempotency key for Phase 999.3 push.
-- Nullable so existing rows and Voco-only-forever appointments stay NULL.
-- Partial unique index prevents two appointments pointing at the same Jobber visit.
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS jobber_visit_id TEXT;

COMMENT ON COLUMN appointments.jobber_visit_id IS
  'Phase 57 (forward-compat for Phase 999.3): Jobber visit ID once this appointment '
  'has been pushed to Jobber. NULL means not-yet-pushed (drives "Not in Jobber yet" '
  'pill in UI). JOBSCHED-07.';

CREATE UNIQUE INDEX IF NOT EXISTS
  idx_appointments_jobber_visit_id_unique
  ON appointments (jobber_visit_id)
  WHERE jobber_visit_id IS NOT NULL;

-- Step 4: Hot-path index for Jobber mirror lookups by tenant.
-- calendar_events already has idx_calendar_events_tenant_times; this composite
-- speeds up the webhook handler's "upsert-or-delete-by-external-id" path when
-- a tenant has many hundreds of mirrored Jobber visits.
-- Rely on the existing UNIQUE (tenant_id, provider, external_id) for correctness;
-- this index is purely a performance hint for the poll-fallback cron.
-- (Optional — planner decides based on expected tenant scale.)
```

[VERIFIED: `supabase/migrations/003_scheduling.sql:132-145` shows original `calendar_events` schema with unique `(tenant_id, provider, external_id)` constraint]

**RLS update:** `calendar_events` already has 4 RLS policies (SELECT/INSERT/UPDATE/DELETE tenant_own + service_role_all) [VERIFIED: 003_scheduling.sql:149-157]. Adding a third provider requires no RLS change — policies are provider-agnostic.

### Pattern 2: Slot-query path — zero-edit verification (JOBSCHED-02)

The Next.js `available-slots` route and the Python agent `check_availability` tool both read `calendar_events` with no provider filter. **Verified in code:**

- `src/app/api/appointments/available-slots/route.js:87-91`:
  ```js
  supabase
    .from('calendar_events')
    .select('start_time, end_time')
    .eq('tenant_id', tenant.id)
    .gte('end_time', now.toISOString()),
  ```
  NO `.eq('provider', 'google')`. NO `.in('provider', [...])`. Any row with any provider surfaces.

- `scheduling-calendar-system` skill line 170 confirms the Python-side `check_availability.py` does a 5-way `asyncio.gather` including `calendar_blocks` — and `calendar_events` the same way. Adding `'jobber'`-provider rows requires zero edits.

This makes JOBSCHED-02 a "free" requirement: the CHECK-constraint widen in Migration 055 is sufficient to satisfy it.

### Pattern 3: Poll-fallback cron extension (JOBSCHED-03)

`/api/cron/renew-calendar-channels/route.js` currently iterates `calendar_credentials` rows where `watch_channel_id IS NOT NULL AND watch_expiration < now() + 24h` and calls `registerWatch` (Google) or `renewOutlookSubscription` (Outlook). Jobber has no equivalent: webhooks are registered at **app-level** (in the Developer Center), not per-tenant. So the "renewal" path for Jobber is actually a **differential-poll**:

```javascript
// Extend /api/cron/renew-calendar-channels after the existing for-loop

// Additionally — Jobber schedule mirror poll-fallback (CONTEXT D-15, every 15 min).
// Jobber has no subscription renewal concept — webhooks are app-scoped.
// This branch polls each connected Jobber tenant for visits modified since
// `last_polled_at` and reconciles the calendar_events mirror.
const { data: jobberCreds } = await supabase
  .from('accounting_credentials')
  .select('*')
  .eq('provider', 'jobber');

for (const cred of jobberCreds ?? []) {
  try {
    await pollJobberVisitsDelta(cred); // calls src/lib/integrations/jobber.js
    results.push({ tenant_id: cred.tenant_id, provider: 'jobber', status: 'polled' });
  } catch (err) {
    // Structured error log — never log cred or token material
    console.error(`[cron-renew] Jobber poll failed for tenant ${cred.tenant_id}`);
    results.push({ tenant_id: cred.tenant_id, provider: 'jobber', status: 'error' });
  }
}
```

Cron cadence in `vercel.json`: change `0 2 * * *` → `*/15 * * * *`. This amplifies the existing daily run by 96× — validate that the Google/Outlook renewal logic in the existing loop is cheap (it's a simple SELECT with a time filter; usually returns 0 rows except once per 7-day window) before locking the new cadence. If cost is a concern, split into TWO crons: keep daily `renew-calendar-channels` for Google/Outlook TTL renewal, add a new `poll-jobber-visits` at `*/15 * * * *`.

**Planner recommendation:** split into two crons. The daily-vs-15-min cadence mismatch plus the fact that Google/Outlook renewal is idempotent-but-wasteful-if-no-expiry means splitting is strictly cleaner. New endpoint: `GET /api/cron/poll-jobber-visits`.

### Pattern 4: Webhook extension for VISIT_*/JOB_*/ASSIGNMENT_* topics (JOBSCHED-01 + CONTEXT D-16)

`/api/webhooks/jobber/route.js` already has:
- HMAC verification (`JOBBER_CLIENT_SECRET`, `crypto.timingSafeEqual`)
- Tenant resolution via `accounting_credentials.external_account_id`
- Topic-prefix router: `CLIENT_*` → resolve → phone normalize → `revalidateTag`

P57 adds:
- `VISIT_*` and `ASSIGNMENT_*` branches (and extends `JOB_*` to additionally mirror, not just revalidate)
- Each visit event upserts/deletes the corresponding `calendar_events` row for that tenant

Concretely, after the existing topic router:

```javascript
// ... existing client-context routing (unchanged) ...

// P57 addition: visit/job/assignment events also mirror the schedule into
// calendar_events (CONTEXT D-16 — same endpoint, topic-prefix router).
if (topic.startsWith('VISIT_') || topic.startsWith('JOB_') || topic.startsWith('ASSIGNMENT_')) {
  try {
    await mirrorJobberVisitEvent({ cred, topic, itemId, gqlClient });
    // mirrorJobberVisitEvent internally handles:
    //   VISIT_CREATE / VISIT_UPDATE  → fetch visit, check assignee ∈ bookable set, upsert calendar_events
    //   VISIT_DESTROY                → delete calendar_events WHERE external_id = itemId, provider = 'jobber'
    //   JOB_UPDATE                   → fetch job.visits, reconcile each against mirror
    //   ASSIGNMENT_*                 → re-fetch parent visit, upsert/delete based on bookable-set intersection
  } catch {
    /* silent — Jobber retries on non-200, but we 200 per P56 precedent */
  }
}
return new Response('', { status: 200 });
```

**Critical:** the exact topic names (`VISIT_CREATE`, `ASSIGNMENT_CREATE`, etc.) MUST be confirmed against Jobber's `WebHookTopicEnum` in GraphiQL during Plan 03 before this code is locked. [CITED: [developer.getjobber.com/docs/using_jobbers_api/setting_up_webhooks](https://developer.getjobber.com/docs/using_jobbers_api/setting_up_webhooks/) — "refer to WebHookTopicEnum in Jobber's GraphQL schema"]. The WebSearch results above confirm these topics exist conceptually but do not enumerate them publicly.

### Pattern 5: Visit → `calendar_events` row mapper (JOBSCHED-01)

A pure function in `src/lib/scheduling/jobber-schedule-mirror.js`:

```javascript
// Pure mapper — no DB, no network. Testable in isolation.
export function jobberVisitToCalendarEvent({ tenantId, visit, clientName }) {
  // Filter (CONTEXT D-06): only status scheduled or in_progress, with concrete times.
  if (!visit?.startAt || !visit?.endAt) return null;
  const status = String(visit.visitStatus || '').toLowerCase();
  if (!['scheduled', 'in_progress', 'in-progress', 'active'].includes(status)) return null;

  // Title encodes client + first assignee for dashboard display (no structured
  // provider_metadata column in v1 per §Alternatives Considered).
  const assignee = visit.assignedUsers?.nodes?.[0]?.name?.full ?? 'Unassigned';
  const title = `Jobber: ${clientName ?? 'Visit'} — ${assignee}`;

  return {
    tenant_id: tenantId,
    provider: 'jobber',
    external_id: visit.id,             // Jobber visit ID
    title,
    start_time: visit.startAt,
    end_time: visit.endAt,
    is_all_day: false,
    appointment_id: null,              // never linked — Jobber is external
    conflict_dismissed: false,
    synced_at: new Date().toISOString(),
  };
}
```

**Assignee-filter step (before mapping):** the caller (webhook handler or poll cron) filters out visits whose `assignedUsers` set does not intersect `cred.jobber_bookable_user_ids` (unless the set is NULL, meaning "not configured yet"). Unassigned visits ALWAYS pass through per D-05.

### Pattern 6: Bookable-users storage on `accounting_credentials` (JOBSCHED-04 + D-18)

Per §Alternatives Considered, store as `jobber_bookable_user_ids TEXT[]` on the existing Jobber `accounting_credentials` row rather than creating `jobber_connections`. Rationale:
- Phase 56 already uses `accounting_credentials` as the single source of truth for Jobber connection state (tokens, `external_account_id`, `error_state`, `last_context_fetch_at`)
- Adding one nullable array column matches the shape of `scopes TEXT[]` (migration 052) already on the same table — zero new pattern
- No new RLS policies needed

The column is read in three places:
1. Webhook handler — to filter incoming visit events by assignee set
2. Poll-fallback cron — same filter on delta-poll results
3. Dashboard settings panel + connect-flow picker — GET shape + PATCH target

### Pattern 7: Jobber users + 30d-activity data fetch (JOBSCHED-04 D-02)

The bookable-users picker needs:
- List of all active Jobber users for the connected account
- A "had ≥1 visit in last 30 days" flag per user for pre-selection

Proposed single GraphQL query (confirm shape against GraphiQL):

```graphql
query JobberUsersWithRecentActivity($since: ISO8601DateTime!) {
  users(first: 100) {
    nodes {
      id
      name { full first last }
      email
      isAccountAdmin         # likely field — confirm via schema; used to DISPLAY but NOT to filter
      # Per-user recent-visit count via nested connection if schema exposes it:
      visits(first: 1, filter: { startAfter: $since }) {
        totalCount
      }
    }
  }
}
```

**Fallback if `users.visits(filter: { startAfter })` does not exist:** two queries — `users` for the list, and `visits(filter: { startAfter: <30d ago> }, first: 500)` with client-side group-by on `assignedUsers[].id` to derive active-users set. Pagination may require multiple pages for larger accounts — use `pageInfo.hasNextPage` + `endCursor`.

[CITED: [developer.getjobber.com/docs/using_jobbers_api/api_queries_and_mutations](https://developer.getjobber.com/docs/using_jobbers_api/api_queries_and_mutations/) — cursor-based pagination with `first`/`after`/`nodes`/`pageInfo`]

Solo-user auto-skip (D-02): if `users.nodes.length === 1`, server writes `jobber_bookable_user_ids = [users.nodes[0].id]` and skips the picker UI entirely — the setup page redirects directly to the integrations dashboard with a success toast.

### Pattern 8: Diff-sync on bookable-users PATCH (JOBSCHED-04 D-04)

On PATCH `/api/integrations/jobber/bookable-users`:

```javascript
// 1. Read current + incoming sets
const current = new Set(cred.jobber_bookable_user_ids ?? []);
const incoming = new Set(req.body.userIds);

const added = [...incoming].filter(id => !current.has(id));
const removed = [...current].filter(id => !incoming.has(id));

// 2. Delete calendar_events rows for removed users' visits.
//    Jobber visit rows carry the assignee in `title` (Pattern 5), NOT as a structured
//    column, so we cannot filter by assignee_id at the DB level. Three options:
//      (a) query Jobber for each removed user's visits in the window, delete each
//          by external_id — N calls, rate-limited but correct
//      (b) delete ALL jobber rows for this tenant, re-run initial backfill with new set
//          — simple, O(window) fetch on Jobber
//      (c) add an `assignee_user_id TEXT` column to calendar_events — largest schema
//          footprint but cleanest query
//
//    PLANNER DECISION: recommend (b) — "nuke and repaved" per-tenant mirror. Simple,
//    correct, within Jobber rate limits for 90/180 window (< 1000 visits typical).
//    Document the exact strategy in the Plan.

// 3. Write the new set and trigger sync
await admin.from('accounting_credentials').update({
  jobber_bookable_user_ids: req.body.userIds,
}).eq('id', cred.id);

await rebuildJobberMirror(cred);  // deletes all jobber rows for tenant, re-backfills window

// 4. Respond 200 with the new row counts. SYNCHRONOUS per D-04 — owner sees the update
//    before the settings panel closes.
```

### Pattern 9: Differential poll shape (JOBSCHED-03)

```graphql
query JobberVisitsPoll($since: ISO8601DateTime!, $windowStart: ISO8601DateTime!, $windowEnd: ISO8601DateTime!) {
  visits(
    first: 200,
    filter: { updatedAfter: $since, startAfter: $windowStart, startBefore: $windowEnd },
    sort: [{ key: UPDATED_AT, direction: ASCENDING }]
  ) {
    nodes {
      id
      startAt
      endAt
      visitStatus
      assignedUsers(first: 5) { nodes { id name { full } } }
      job { id title client { id name { full } } }
    }
    pageInfo { hasNextPage endCursor }
  }
}
```

Cron flow:
1. Read `cred.last_context_fetch_at` as the `since` cursor (reuse existing column; Phase 56 updates it on customer-context fetches)
2. Paginate through all changed visits
3. For each visit: apply bookable-user filter, map to calendar_events row, upsert (conflict on `(tenant_id, provider, external_id)`)
4. **Tombstone-sweep:** to catch deletes the webhook missed, periodically (e.g., once per poll for window-tail visits about to become "past") re-fetch by ID-set any visit we have in the mirror whose `start_time` is in the next 24h — if Jobber returns 404 or status ≠ scheduled/in_progress, delete locally
5. Update `cred.last_polled_at` (new column OR reuse `last_context_fetch_at` — planner decides)

**Decision needed:** whether `last_context_fetch_at` is overloaded for schedule polling or a dedicated `jobber_last_schedule_poll_at` column is added. Recommend NEW column in Migration 055 for semantic clarity. [ASSUMED: ok to add.]

**RESOLVED (Plan 01 + Plan 04):** Dedicated `accounting_credentials.jobber_last_schedule_poll_at TIMESTAMPTZ` column added in Migration 055. Cron (Plan 04) reads/writes this column exclusively and MUST NOT touch `last_context_fetch_at` (which Phase 56 customer-context fetches own). This prevents the race where a customer-context GraphQL touch between polls advances the schedule cursor and causes silent visit loss.

### Pattern 10: `ExternalEventBlock` retrofit + "Not in Jobber yet" pill (JOBSCHED-05, JOBSCHED-06)

Current `ExternalEventBlock` (`src/components/dashboard/CalendarView.js:373-392`) hardcodes violet Google-calendar treatment. UI-SPEC §Component Inventory §1 replaces with unified slate-muted + provider-aware pill. Drop-in replacement — signature and call sites unchanged:

```javascript
// src/components/dashboard/CalendarView.js — REPLACE function body
function ExternalEventBlock({ event, getPositionStyle, laneIndex = 0, laneCount = 1, isMobile = false, onClick }) {
  const style = getPositionStyle(event.start_time, event.end_time);
  const heightPx = parseInt(style.height, 10);
  const laneStyle = getLaneLayout(laneIndex, laneCount, isMobile);

  const providerLabel = {
    jobber: 'From Jobber',
    google: 'From Google',
    outlook: 'From Outlook',
  }[event.provider] ?? `From ${event.provider}`;

  const providerPillClass = {
    jobber: 'bg-[#1B9F4F]/10 text-[#1B9F4F] dark:bg-[#1B9F4F]/20 dark:text-emerald-300',
    google: 'bg-violet-50 text-violet-600 dark:bg-violet-950/30 dark:text-violet-300',
    outlook: 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-300',
  }[event.provider] ?? 'bg-slate-100 text-slate-600';

  return (
    <button
      type="button"
      className="absolute bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 border-l-[3px] border-l-slate-300 dark:border-l-slate-600 rounded-md px-2 py-1 overflow-hidden shadow-sm cursor-pointer opacity-75 hover:opacity-90 hover:shadow-sm transition-all text-left z-[5]"
      style={{ ...style, ...laneStyle }}
      onClick={(e) => { e.stopPropagation(); onClick?.(event); }}
    >
      <div className="text-xs font-medium text-foreground truncate leading-tight">{event.title}</div>
      {heightPx >= 36 && (
        <span className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-medium mt-0.5 ${providerPillClass}`}>
          {providerLabel}
        </span>
      )}
    </button>
  );
}
```

**"Not in Jobber yet" pill** (on `AppointmentBlock`, UI-SPEC §Component Inventory §2): rendered top-right corner of the appointment block when `jobberConnected === true && !appointment.jobber_visit_id` AND `effectiveHeight >= 44px`. Pass `jobberConnected` as a new prop on `CalendarView` (derive from setup-checklist or a cheap credential check server-side). `jobber_visit_id` must be included in the appointments GET select — one-line addition to `src/app/api/appointments/route.js`.

### Pattern 11: Click-through to Jobber — per-visit URL strategy (JOBSCHED-05)

UI-SPEC specifies: "open external visit/event URL in a new tab. For Jobber, use per-visit URL if available; fall back to `https://app.getjobber.com/calendar`."

**Research finding:** Jobber's web app does expose per-visit URLs of the form `https://secure.getjobber.com/work_orders/{job_id}/visits/{visit_id}` (observed in Jobber's web UI; no stability guarantee documented). Since this is UI-scraping territory, treat it as a **best-effort** path:

```javascript
function jobberVisitUrl(event) {
  // event.external_metadata.jobId + event.external_id (visit id) would be needed.
  // Because Pattern 5 does NOT store jobId (no provider_metadata column in v1),
  // we cannot construct a per-visit URL from the calendar_events row alone.
  // Fallback to day-view URL, which accepts a date parameter:
  const date = event.start_time?.slice(0, 10); // YYYY-MM-DD
  return date
    ? `https://secure.getjobber.com/calendar?date=${date}`
    : 'https://secure.getjobber.com/calendar';
}
```

**Planner decision:** If per-visit deep-linking is high-value UX, add a minimal `provider_metadata JSONB` column to `calendar_events` in Migration 055 carrying `{ job_id }` for Jobber rows. Accepts the future-proofing cost for meaningful UX gain. Alternatively, just ship the day-view fallback in v1 and revisit in Phase 999.3 when schema evolves anyway.

### Pattern 12: `AppointmentFlyout` Copy-to-Jobber section (JOBSCHED-06 D-10)

New sub-component `CopyToJobberSection.jsx`, rendered inside `AppointmentFlyout` only when `jobberConnected === true`. UI-SPEC §Component Inventory §3 locks the visual contract and §Copywriting locks every string:

```jsx
function CopyToJobberSection({ appointment, jobberConnected }) {
  if (!jobberConnected) return null;
  const [isCopying, setIsCopying] = useState(false);

  const pasteBlock = [
    `Client: ${appointment.caller_name ?? '—'}`,
    `Phone: ${appointment.caller_phone ?? '—'}`,
    `Address: ${appointment.service_address ?? '—'}`,
    `Start: ${formatDateTimeLong(appointment.start_time)}`,
    `Duration: ${durationMins(appointment.start_time, appointment.end_time)} min`,
    `Notes: ${appointment.notes ?? '—'}`,
  ].join('\n');

  const handleCopy = async () => {
    setIsCopying(true);
    try {
      await navigator.clipboard.writeText(pasteBlock);
      toast.success('Copied to clipboard');
    } catch {
      toast.error("Couldn't copy — try manually selecting the text");
    } finally {
      setTimeout(() => setIsCopying(false), 500);
    }
  };

  return (
    <div className="border-t border-border pt-4 mt-4">
      <h3 className="text-sm font-medium">Copy to Jobber</h3>
      <p className="text-xs text-muted-foreground mb-3">Paste into a new Jobber visit</p>
      <div className="flex gap-2">
        <Button
          onClick={handleCopy}
          disabled={isCopying}
          aria-label="Copy appointment details to clipboard"
          className="bg-[var(--brand-accent)] text-white"
        >
          {isCopying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
          <span className="ml-2">Copy details</span>
        </Button>
        <Button asChild variant="outline" size="sm">
          <a
            href="https://secure.getjobber.com/work_orders/new"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open Jobber new visit screen (opens in new tab)"
          >
            <ExternalLink className="h-4 w-4" />
            <span className="ml-2">Open in Jobber</span>
          </a>
        </Button>
      </div>
    </div>
  );
}
```

**"Open in Jobber" URL** — UI-SPEC specifies `https://app.getjobber.com/visits/new` but the actual Jobber app URL is `https://secure.getjobber.com/work_orders/new` (new work order, which surfaces the visit scheduling form). Planner confirms the exact URL against a live Jobber account before locking.

### Pattern 13: Dismissible banner with localStorage (JOBSCHED-06 D-12)

`JobberCopyBanner.jsx` — UI-SPEC §Component Inventory §4 + §Layout §Calendar Page:

```jsx
const BANNER_DISMISS_KEY = 'voco_jobber_copy_banner_dismissed';

export function JobberCopyBanner({ jobberConnected }) {
  const [dismissed, setDismissed] = useState(true); // pessimistic start, set after mount

  useEffect(() => {
    if (!jobberConnected) return;
    setDismissed(localStorage.getItem(BANNER_DISMISS_KEY) === '1');
  }, [jobberConnected]);

  if (!jobberConnected || dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(BANNER_DISMISS_KEY, '1');
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      <motion.div
        role="status"
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/40 mb-4"
      >
        <Info className="h-4 w-4 text-blue-500 dark:text-blue-400 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800 dark:text-blue-200">
          Jobber push is coming soon — Voco bookings stay in Voco until then. Click any booking to copy it into Jobber.
        </p>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 ml-auto text-blue-400 hover:text-blue-600 dark:hover:text-blue-200"
          onClick={handleDismiss}
          aria-label="Dismiss Jobber notification banner"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </motion.div>
    </AnimatePresence>
  );
}
```

### Pattern 14: Booking-complete email with conditional Jobber-copy block (JOBSCHED-06 D-11)

**Current state:** No post-booking email template exists. The only email on the booking path is `NewLeadEmail` (triggered by new-lead create, not by booking specifically). SMS paths exist: `sendOwnerSMS`, `sendCallerSMS`, `sendCallerRecoverySMS`.

**Two planner options:**

**Option A (recommended):** Create new `BookingCopyToJobberEmail.jsx`, triggered only when Jobber is connected AND the appointment has no `jobber_visit_id`. Fire at the post-booking hook in `atomicBookSlot` caller, parallel to the existing owner SMS. One template, one notification helper, one send-per-booking guarantee enforced by checking `accounting_credentials` presence.

**Option B:** Retrofit `NewLeadEmail.jsx` with a `jobberCopyBlock` conditional section. More invasive; `NewLeadEmail` isn't universally sent for bookings (it's lead-centric), so the trigger point is wrong.

**Recommend Option A.** Helper in `src/lib/notifications.js`:

```javascript
export async function notifyBookingCopyToJobber({ tenantId, appointmentId }) {
  // Gate: only send when Jobber is connected
  const { data: cred } = await supabase
    .from('accounting_credentials')
    .select('provider')
    .eq('tenant_id', tenantId)
    .eq('provider', 'jobber')
    .maybeSingle();
  if (!cred) return;

  const { data: appt } = await supabase.from('appointments').select('*').eq('id', appointmentId).single();
  if (!appt || appt.jobber_visit_id) return; // already pushed (Phase 999.3+ case)

  const ownerEmail = await getOwnerEmail(tenantId);
  await getResendClient().emails.send({
    from: `Voco <bookings@${EMAIL_DOMAIN}>`,
    to: ownerEmail,
    subject: "Don't forget to add this to Jobber",
    react: BookingCopyToJobberEmail({ appointment: appt, ... }),
  });
}
```

UI-SPEC §Copywriting locks: heading "Don't forget to add this to Jobber", body "Voco has booked this job — paste the details below into a new Jobber visit so your schedule stays in sync.", CTA "Open Jobber".

### Pattern 15: Voco booking UUID as idempotency key (JOBSCHED-07)

`appointments.id` is already a UUID [VERIFIED: `003_scheduling.sql:19`]. Phase 999.3 push will write the Jobber visit ID back into `appointments.jobber_visit_id` (column added in Migration 055) after successful push. Dedupe check on push: before calling Jobber `visitCreate`, query `appointments WHERE tenant_id = ? AND id = ? AND jobber_visit_id IS NULL`. If `jobber_visit_id` is already set, push is a no-op. If NULL, proceed — Jobber's response ID gets written back atomically.

No user-facing surface in Phase 57; this is pure forward-compat schema. Tests in Plan 01 verify:
- Migration creates column + unique partial index
- Index allows multiple NULLs
- Index rejects duplicate non-NULL values

### Anti-Patterns to Avoid

- **Adding a new webhook endpoint for schedule events** — violates D-16. Extend the existing `/api/webhooks/jobber` handler.
- **Querying Jobber during the call path** — the entire point is that `check_availability` reads the local mirror. Any code that calls Jobber during agent-session setup is wrong.
- **Removing the existing violet color from `ExternalEventBlock`** without retrofitting Google AND Outlook — D-08 mandates universal treatment. Retrofitting only Jobber creates a mixed visual model.
- **Writing Jobber visit ID into `appointments.external_event_id`** — that column is for Google/Outlook push-back events (`003_scheduling.sql:34`). Jobber uses `appointments.jobber_visit_id` (new column).
- **Making the bookable-users picker a modal** — UI-SPEC specifies full-page/sheet step in connect flow, inline collapsible in settings. Modal breaks the information density contract.
- **Sending the Jobber-copy email when Jobber is not connected** — guard with `accounting_credentials` lookup before send.
- **Polling every tenant every 15 minutes even without Jobber connection** — cron SHOULD early-exit if `jobberCreds.length === 0` to avoid empty Jobber API calls.
- **Encoding Jobber visit state as active-only in title**, then failing to delete stale rows — if the visit transitions to `completed` or `cancelled`, the webhook delivers the update and the handler MUST delete the `calendar_events` row, not upsert. Mapping function returns `null` for non-active status; caller interprets `null` as "delete if exists."
- **Hardcoding `'From Google'` / `'From Outlook'` strings elsewhere** — only in `ExternalEventBlock`. Any future addition of a third non-Jobber provider should plug into the same provider → label map.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Jobber visit → calendar_event mapping | Inline mapping in the webhook handler | `jobberVisitToCalendarEvent` in `src/lib/scheduling/jobber-schedule-mirror.js` | Pure function, testable in isolation; same shape consumed by webhook + poll cron + initial backfill |
| Delta-poll diff between local mirror and Jobber | Custom SQL-level set diff | `upsert` with `onConflict: 'tenant_id,provider,external_id'` + separate tombstone-sweep | The UNIQUE index (003_scheduling.sql:144) already exists; upsert handles create+update in one call. Deletes via explicit mirror-side query ("present locally, missing from Jobber delta response") |
| GraphQL query construction | Hand-crafted `fetch` | `graphql-request@7.4.0` already in project from P56 | Handles auth header, variable serialization, typed errors |
| Clipboard write with fallback | Manual `document.execCommand('copy')` polyfill | `navigator.clipboard.writeText` + try/catch + toast fallback | Modern browsers support it universally; fallback path is a toast message pointing users at manual select |
| Dismissible banner state | Cookie/server-side persistence | `localStorage` with a dedicated key (UI-SPEC locks `voco_jobber_copy_banner_dismissed`) | Cross-device sync isn't in scope; localStorage matches existing `voco_calendar_show_completed` pattern |
| Jobber user selection UI | Custom multiselect component | shadcn `Checkbox` in a vertical list | UI-SPEC §Bookable-Users Picker locks this shape |
| Cron cadence parser | In-code cron syntax interpreter | `vercel.json` declarative cron schedule | Voco already uses Vercel Cron for 6 other endpoints (scheduling-calendar-system skill §6); `*/15 * * * *` is a one-line `vercel.json` edit |
| Email HTML | Raw HTML strings | `@react-email/components` via new `BookingCopyToJobberEmail.jsx` | 7 existing templates (`src/emails/*.jsx`) follow this pattern |

**Key insight:** This phase has almost no "primitives." Every new behavior is a composition of already-shipped infrastructure. The discipline is resisting the urge to invent new abstractions — the overlay retrofit, the banner, the copy flyout, and the cron extension are all minimal additions to existing files.

---

## Runtime State Inventory

> Phase 57 is a greenfield/additive phase — no rename, refactor, or string migration. This section does not apply and is intentionally omitted.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js runtime | ✓ | v24.14.1 | — |
| npm | Package install | ✓ | bundled | — |
| `graphql-request` | Jobber visits/users GraphQL | ✓ (P56) | ^7.4.0 | — |
| `libphonenumber-js` | Phone normalization (if used on mirror rows) | ✓ (P56) | ^1.12.41 | — |
| `framer-motion` | Banner `AnimatePresence` exit animation | ✓ | in use across dashboard | — |
| `sonner` | Clipboard copy toast | ✓ | in use across dashboard | — |
| Migration 003 `calendar_events` table | Provider CHECK target | ✓ | shipped | — |
| Migration 052 `accounting_credentials` | `jobber_bookable_user_ids` addition target | ✓ | shipped | — |
| Migration 054 `external_account_id` | Webhook tenant resolution | ✓ | shipped (P56) | — |
| `/api/webhooks/jobber` | Extension target for visit routing | ✓ | shipped (P56 Plan 03) | — |
| `JOBBER_CLIENT_SECRET` | Webhook HMAC key | ✓ | in `.env.example` (P56) | — |
| `CRON_SECRET` | Cron auth | ✓ | existing pattern | — |
| Jobber developer account with sandbox | GraphQL schema verification at Plan 01 | ? (was pre-req for P56) | — | If P56 executed, this is satisfied. If not, **BLOCKING** for Plan 02+. |
| Jobber GraphiQL access | Confirm visit/user/assignment query shapes + `WebHookTopicEnum` values | ? (depends on dev app registration) | — | **BLOCKING for Plan 02/03** unless assumptions documented and query strings are guarded by integration tests |
| Vercel Cron | `*/15 * * * *` cadence | ✓ | 6 existing crons work today | — |
| `navigator.clipboard.writeText` | Copy-to-clipboard UX | ✓ (modern browsers) | — | Text-select fallback via toast message |

**Missing dependencies with no fallback:**
- Jobber GraphiQL access — without it, visit/user/assignment query strings are guesses. Should be satisfied if P56 shipped.

**Missing dependencies with fallback:**
- Per-visit deep-link URL to Jobber — if unstable, fall back to `secure.getjobber.com/calendar?date=YYYY-MM-DD` (Pattern 11).

---

## Common Pitfalls

### Pitfall 1: `calendar_events_provider_check` constraint name may differ in production

**What goes wrong:** Migration 055 tries to `DROP CONSTRAINT calendar_events_provider_check` but Postgres auto-generated the constraint with a different name (e.g., `calendar_events_check1` or `calendar_events_provider_check1` if migration was ever re-applied). The DROP fails; the migration aborts; the entire phase is blocked.

**Why it happens:** The original CHECK in `003_scheduling.sql:135` was inline on `CREATE TABLE`, so Postgres assigned the default name based on the first available slot. Subsequent unrelated migrations may have reset numbering.

**How to avoid:** Use `DROP CONSTRAINT IF EXISTS` (already in Pattern 1). Run `SELECT conname FROM pg_constraint WHERE conrelid = 'calendar_events'::regclass AND contype = 'c';` in the Supabase SQL editor BEFORE writing the migration and lock the actual name. If needed, use a more defensive pattern:

```sql
DO $$
DECLARE
  check_name text;
BEGIN
  SELECT conname INTO check_name
  FROM pg_constraint
  WHERE conrelid = 'calendar_events'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%provider%';
  IF check_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE calendar_events DROP CONSTRAINT %I', check_name);
  END IF;
END $$;
```

**Warning signs:** Migration 055 fails with `constraint "calendar_events_provider_check" does not exist`.

### Pitfall 2: `WebHookTopicEnum` values for visit/assignment events are GraphiQL-only

**What goes wrong:** Developer hardcodes `topic.startsWith('VISIT_')` and the actual Jobber topic names are `VISIT_CREATED` (past-tense) or `SCHEDULED_ITEM_CREATE` or something entirely unexpected. Webhook handler never enters the mirror branch; `calendar_events` never populates; tests pass the happy-path but production fires no updates.

**Why it happens:** Jobber's public docs [CITED: [developer.getjobber.com/docs/using_jobbers_api/setting_up_webhooks](https://developer.getjobber.com/docs/using_jobbers_api/setting_up_webhooks/)] say "refer to WebHookTopicEnum in the schema" — they do NOT enumerate values. Phase 56 confirmed `CLIENT_UPDATE`/`JOB_UPDATE`/`INVOICE_UPDATE`/`VISIT_COMPLETE`/`VISIT_UPDATE` via GraphiQL (CONTEXT D-12 of Phase 56). Phase 57 needs `VISIT_CREATE`, `VISIT_DESTROY`, and possibly `ASSIGNMENT_CREATE`/`ASSIGNMENT_UPDATE`/`ASSIGNMENT_DESTROY` — none of these were verified in Phase 56's scope.

**How to avoid:** At the start of Plan 03, open GraphiQL → Documentation → search `WebHookTopicEnum` → lock the exact visit/assignment topic names in an enum constant in `src/app/api/webhooks/jobber/route.js`. Write integration tests that assert the handler accepts each locked topic. Any topic prefix mismatch is caught in test, not production.

**Warning signs:** Webhooks register successfully in the Developer Center but `calendar_events` stays empty despite visits being created in Jobber. Check webhook delivery logs in the Developer Center — you'll see the topic string and can fix the handler mapping.

### Pitfall 3: Bookable-users filter missing during initial backfill

**What goes wrong:** Initial backfill fetches visits from Jobber but does not apply the bookable-users intersect filter before upserting to `calendar_events`. Every visit for every Jobber user becomes a blocking event, including office admins on vacation and field techs who don't do customer jobs. Voco's AI starts telling callers the shop is booked solid.

**Why it happens:** Backfill is easy to write as "fetch all, map all, insert all." The filter is a second step that's easy to forget, especially if the bookable-set is NULL during initial connect (which per Pattern 1 means "mirror all" — the correct default BEFORE the picker runs).

**How to avoid:** The connect-flow sequence MUST be: OAuth callback → redirect to bookable-users picker → picker PATCH writes the set → **then** initial backfill runs (server-side, as part of the PATCH handler). Never backfill on OAuth callback directly. If the user abandons the picker, the tenant sits in "Jobber connected but mirror not populated" state — acceptable, surfaces via the existing integrations card error/status.

**Warning signs:** AI reports zero availability on a day the owner's Jobber shows open slots. Inspect `calendar_events WHERE tenant_id = ? AND provider = 'jobber'` — too many rows means the filter isn't applied.

### Pitfall 4: Poll cron overlaps with webhook updates

**What goes wrong:** Webhook delivers `VISIT_UPDATE` at T; poll cron runs at T+1s with `since = last_polled_at` (an older timestamp) and re-fetches the same visit. Both paths upsert the same row — correct behavior thanks to UNIQUE index, but wasteful. Worse: if webhook processes a DELETE while poll is mid-fetch, the poll upsert can resurrect a just-deleted row if the poll's result is stale.

**Why it happens:** No lock coordination between webhook path and poll path.

**How to avoid:** Two mitigations:
- (a) The poll's `since` cursor MUST be updated AFTER the poll's upserts complete, not BEFORE. Use a transaction: upsert all deltas → commit → then update `last_polled_at`.
- (b) The poll's tombstone-sweep must check the `synced_at` column — if a row was synced AFTER the poll's `since` cursor started (meaning the webhook fired in-between), skip the poll's "this looks deleted" decision for this row.

**Warning signs:** A visit deleted in Jobber shows up again in Voco a few seconds later, then disappears when the next webhook/poll fires.

### Pitfall 5: Timezone mismatch between Jobber `startAt` and tenant `tenant_timezone`

**What goes wrong:** Jobber returns `startAt` as ISO8601 with an offset (e.g., `2026-04-20T10:00:00-04:00`). Voco's `calendar_events.start_time` is `timestamptz` — storing it preserves the instant correctly. But the dashboard renders in tenant timezone via `tenant.tenant_timezone`; if Jobber and Voco disagree on tenant timezone, visits display at the wrong hour.

**Why it happens:** Jobber accounts have their own timezone setting, independent of Voco's `tenants.tenant_timezone`. If a plumber has Jobber set to America/New_York but Voco set to America/Chicago (because they moved and only updated one), the visit shows up an hour off.

**How to avoid:** Document the behavior in the skill — timezone is the owner's responsibility, tool-agnostic. Optional: on connect, read `account.timezone` from Jobber via GraphQL and warn if it differs from `tenants.tenant_timezone`. Out of scope for Phase 57 implementation (banner/toast), in scope for the test plan.

**Warning signs:** Owner reports "my Jobber visit is at 10am but Voco shows it at 9am." Confirm timezones match in both systems.

### Pitfall 6: Clipboard API unavailable in insecure contexts

**What goes wrong:** `navigator.clipboard.writeText` is only available on HTTPS and `localhost`. If a user accesses the dashboard over plain HTTP (reverse proxy misconfig, staging subdomain without cert), the clipboard call throws. The toast fallback fires — but the user has no way to select the un-displayed paste text.

**Why it happens:** Voco is always HTTPS in production, but staging/dev may not be.

**How to avoid:** UI-SPEC specifies a toast error "Couldn't copy — try manually selecting the text." Implement a fallback `<textarea>` below the copy button that pre-fills with the paste block and auto-selects on click. Only render it on clipboard error. Users who encounter the error once still have a path forward.

**Warning signs:** Toast error appears on clicks in dev/staging but the paste workflow is broken.

### Pitfall 7: Banner dismissal persists across accounts on shared devices

**What goes wrong:** Team member A dismisses the banner on a shared laptop. Team member B logs in with a different Voco account on the same device. Banner is already dismissed — B never sees the educational moment UI-SPEC is designed for.

**Why it happens:** `localStorage` is device-scoped, not account-scoped. UI-SPEC accepts this trade-off implicitly (localStorage is the stated storage mechanism).

**How to avoid:** Accepted trade-off for Phase 57. If cross-device or cross-account persistence matters later, migrate to a DB-backed user-preferences row. Document in the skill.

**Warning signs:** Support request: "new team members don't see the banner — is it broken?" → "not broken, device-scoped dismissal, consider clearing localStorage or migrating to DB later."

### Pitfall 8: Diff-sync on bookable-users save blocks the settings UI for 5+ seconds

**What goes wrong:** Owner deselects a user in the settings panel. Diff-sync (Pattern 8) runs synchronously — fetches up to 90+180 days of Jobber visits for the tenant, applies filter, reconciles. On a busy tenant that's 500 visits and 3 GraphQL pages; at Jobber's rate limits (2,500 points/hour typical) this can take 5-10 seconds. Owner stares at a spinner and assumes the app is frozen.

**Why it happens:** D-04 explicitly chose synchronous diff-sync ("Owner sees the update before the settings panel closes. No background job / toast.") to avoid the background-job-complexity-pattern.

**How to avoid:** Accepted UX trade-off per D-04. Mitigations:
- Show a progress indicator ("Syncing N visits…") during the sync, not just a spinner
- Cap the diff-sync at a soft deadline (e.g. 8 seconds) and return early with a "partial sync — will complete in background" toast — but then fall back to the next poll cron run for final reconciliation
- Document in the Plan that simple adds/removes (1-2 users at a time) complete in <2 seconds typically

**Warning signs:** Owners report "saving team members hangs." Instrument `last_context_fetch_at` during the sync to measure actual durations and validate the typical duration envelope.

### Pitfall 9: Jobber rate-limit exhaustion on 15-min poll × many tenants

**What goes wrong:** 100 Jobber-connected tenants × 1 poll every 15 min = 400 polls/hour. Each poll issues 1-3 GraphQL queries (visits delta + pagination). Jobber's rate limit [CITED: [developer.getjobber.com/docs/using_jobbers_api/api_rate_limits](https://developer.getjobber.com/docs/using_jobbers_api/api_rate_limits/)] is per-app (2,500 cost units / 60s bucket, with query cost varying). Bursty cron that polls all tenants in the same ~30s window burns the bucket.

**Why it happens:** Cron fires once per interval and typically processes all rows serially or in a small concurrent pool without inter-request throttling.

**How to avoid:**
- Stagger poll targets: process tenants in deterministic rotation (e.g., `WHERE cred_id % 4 = floor(minutes/15) % 4`) so each 15-min run covers 1/4 of tenants, getting each tenant polled once per hour (still well within the D-15 "webhooks primary" mental model)
- Add a small inter-tenant delay (e.g., 200ms) in the cron loop
- Use `graphql-request`'s request-rate-aware retry on 429 responses (already supported — `graphql-request` throws `ClientError` with status, caller retries)
- Monitor `last_context_fetch_at` delay — if it grows, scale the stagger further

**Warning signs:** 429 errors in Sentry from the cron; poll runtime grows over time; tenants report stale calendar data.

### Pitfall 10: `jobberConnected` prop threading through multiple layers

**What goes wrong:** `CalendarView` needs `jobberConnected`. `AppointmentFlyout` needs it. `BookableUsersPicker` needs it. All three are rendered from different parents. Prop-drilling N levels is brittle; forgetting to pass it in one call-site silently disables the overlay UX for that surface.

**Why it happens:** React prop-drilling, especially when adding a new system-wide flag.

**How to avoid:** Introduce a tiny context or a lightweight hook `useJobberConnected()` that reads from the same source as the setup checklist (either a fresh SELECT or server-passed prop to the top-level dashboard layout). Prefer a context provider at `/dashboard/layout.js` that fetches once and caches via `'use cache'`. All child components consume via hook.

**Warning signs:** "Not in Jobber yet" pill appears in the flyout but not on the block, or vice versa. Banner appears but pills don't. Means `jobberConnected` threaded to some surfaces but not all.

---

## Code Examples

### Example 1: Visit → calendar_events mapper with bookable-user filter (JOBSCHED-01, -04)

```javascript
// src/lib/scheduling/jobber-schedule-mirror.js

const MIRRORED_STATUSES = new Set(['SCHEDULED', 'IN_PROGRESS', 'scheduled', 'in_progress']);

/**
 * Returns a calendar_events row for upsert, or null if the visit should NOT be mirrored
 * (wrong status, no concrete times, or assigned-to-no-one-in-bookable-set).
 *
 * Bookable-set semantics (CONTEXT D-01, D-05):
 *   - bookableUserIds === null         → "not configured yet"; mirror everything
 *   - bookableUserIds is an array      → intersect assignees; unassigned ALWAYS pass
 *
 * @param {string}          tenantId
 * @param {object}          visit              Jobber visit node
 * @param {string[]|null}   bookableUserIds    from accounting_credentials.jobber_bookable_user_ids
 * @param {string}          clientName
 */
export function jobberVisitToCalendarEvent({ tenantId, visit, bookableUserIds, clientName }) {
  if (!visit?.id || !visit?.startAt || !visit?.endAt) return null;
  if (!MIRRORED_STATUSES.has(String(visit.visitStatus ?? ''))) return null;

  const assignees = visit.assignedUsers?.nodes ?? [];
  const assigneeIds = assignees.map((u) => u.id);
  const isUnassigned = assigneeIds.length === 0;

  if (!isUnassigned && Array.isArray(bookableUserIds)) {
    const intersects = assigneeIds.some((id) => bookableUserIds.includes(id));
    if (!intersects) return null;  // NOT in bookable set → do not mirror
  }
  // isUnassigned visits ALWAYS pass (D-05)
  // bookableUserIds === null (not yet configured) → always mirror

  const assigneeName = assignees[0]?.name?.full ?? (isUnassigned ? 'Unassigned' : 'Team');
  const title = `Jobber: ${clientName ?? 'Visit'} — ${assigneeName}`;

  return {
    tenant_id: tenantId,
    provider: 'jobber',
    external_id: visit.id,
    title,
    start_time: visit.startAt,
    end_time: visit.endAt,
    is_all_day: false,
    appointment_id: null,
    conflict_dismissed: false,
    synced_at: new Date().toISOString(),
  };
}

/**
 * Upsert-or-delete a single Jobber visit into the tenant's calendar_events mirror.
 * Called by the webhook handler (Pattern 4) and the poll cron (Pattern 9).
 */
export async function applyJobberVisit({ admin, tenantId, visit, bookableUserIds, clientName }) {
  const row = jobberVisitToCalendarEvent({ tenantId, visit, bookableUserIds, clientName });

  if (!row) {
    // Mapper returned null → visit should NOT be in the mirror. Delete if present.
    await admin
      .from('calendar_events')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('provider', 'jobber')
      .eq('external_id', visit?.id ?? '__none__');
    return { action: 'deleted' };
  }

  const { error } = await admin
    .from('calendar_events')
    .upsert(row, { onConflict: 'tenant_id,provider,external_id' });
  if (error) throw error;
  return { action: 'upserted' };
}
```

### Example 2: Extending the webhook handler (JOBSCHED-01, D-16)

```javascript
// src/app/api/webhooks/jobber/route.js — ADDITIONS

import { applyJobberVisit } from '@/lib/scheduling/jobber-schedule-mirror';

// ... existing GQL queries (RESOLVE_CLIENT_BY_ID, RESOLVE_CLIENT_FROM_JOB, RESOLVE_CLIENT_FROM_INVOICE) ...

const FETCH_VISIT_BY_ID = gql`
  query ResolveVisit($id: EncodedId!) {
    visit(id: $id) {
      id
      startAt
      endAt
      visitStatus
      assignedUsers(first: 5) { nodes { id name { full } } }
      job { id title client { id name { full } } }
    }
  }
`;

// ... inside POST handler, AFTER existing CLIENT_/JOB_/INVOICE_ topic router runs:

if (topic.startsWith('VISIT_') || topic === 'ASSIGNMENT_CREATE' || topic === 'ASSIGNMENT_UPDATE' || topic === 'ASSIGNMENT_DESTROY') {
  try {
    // VISIT_DESTROY — itemId is the visit being deleted. Just remove from mirror.
    if (topic === 'VISIT_DESTROY') {
      await admin
        .from('calendar_events')
        .delete()
        .eq('tenant_id', cred.tenant_id)
        .eq('provider', 'jobber')
        .eq('external_id', evt.itemId);
    } else {
      // VISIT_CREATE / VISIT_UPDATE / ASSIGNMENT_*: re-fetch the visit by id
      const r = await gqlClient.request(FETCH_VISIT_BY_ID, { id: evt.itemId });
      const visit = r?.visit;
      if (visit) {
        await applyJobberVisit({
          admin,
          tenantId: cred.tenant_id,
          visit,
          bookableUserIds: cred.jobber_bookable_user_ids ?? null,
          clientName: visit.job?.client?.name?.full ?? null,
        });
      }
    }
  } catch {
    /* silent — retry via next poll cron */
  }
}
```

### Example 3: `vercel.json` cron schedule edit (JOBSCHED-03)

```json
{
  "crons": [
    { "path": "/api/cron/renew-calendar-channels", "schedule": "0 2 * * *" },
    { "path": "/api/cron/poll-jobber-visits",    "schedule": "*/15 * * * *" }
  ]
}
```

Split cron keeps Google/Outlook renewal cost unchanged (daily) and isolates the Jobber-poll cost (15-min cadence only runs when Jobber tenants exist). [CITED: [vercel.com/docs/cron-jobs](https://vercel.com/docs/cron-jobs) — cron expressions support `*/15` stepping.]

### Example 4: Appointments GET extension for `jobber_visit_id` (Pattern 10 flyout/pill integration)

```javascript
// src/app/api/appointments/route.js — ADD one field to the select
const { data: appointments } = await supabase
  .from('appointments')
  .select('id, start_time, end_time, service_address, caller_name, caller_phone, urgency, zone_id, status, notes, completed_at, jobber_visit_id /* NEW */, service_zones(id, name)')
  .eq('tenant_id', tenantId)
  .gte('start_time', startIso)
  .lte('start_time', endIso)
  .neq('status', 'cancelled');
```

### Example 5: Email trigger hook in post-booking flow

```javascript
// wherever atomicBookSlot returns success — typically the agent's book_appointment tool
// OR the dashboard's manual-booking route. For Python agent path, this fires from
// a Next.js route invoked post-booking (since email infra lives in Next.js).

import { notifyBookingCopyToJobber } from '@/lib/notifications';

if (bookResult.success) {
  // existing owner SMS path …
  await sendOwnerSMS({ ... });

  // P57 addition — only fires when Jobber is connected AND push not yet available.
  // The helper is internally gated; safe to call unconditionally.
  await notifyBookingCopyToJobber({
    tenantId,
    appointmentId: bookResult.appointment_id,
  });
}
```

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node --test` (node's built-in test runner, based on existing test files using `describe`/`test` patterns) + `vitest` or similar (evident from extensive `tests/` tree) — planner confirms |
| Config file | `package.json` test scripts (no standalone vitest.config.js found in roots scanned) |
| Quick run command | `npm test` (project convention) |
| Full suite command | `npm test` — project runs full suite on one command given existing 100+ test files |
| Phase-scoped command | `npm test -- tests/scheduling tests/integrations/jobber tests/api/webhooks/jobber tests/api/cron` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| JOBSCHED-01 | calendar_events.provider CHECK accepts 'jobber' | unit (migration) | `npm test -- tests/migrations/055.test.js` | ❌ Wave 0 — new |
| JOBSCHED-01 | webhook handler mirrors VISIT_UPDATE into calendar_events | integration | `npm test -- tests/api/webhooks/jobber/route.test.js` | ✅ exists (P56) — ADD new test cases |
| JOBSCHED-01 | webhook VISIT_DESTROY removes the calendar_events row | integration | same file above, new test case | ✅ — extend |
| JOBSCHED-01 | `jobberVisitToCalendarEvent` mapper — status filter | unit (pure) | `npm test -- tests/scheduling/jobber-schedule-mirror.test.js` | ❌ Wave 0 |
| JOBSCHED-01 | mapper — bookable-user intersect + unassigned pass-through | unit | same file above | ❌ Wave 0 |
| JOBSCHED-02 | slot-calculator (Next.js) returns slots occluded by 'jobber' events | integration | `npm test -- tests/lib/slot-calculator-jobber.test.js` | ❌ Wave 0 — CRITICAL gate |
| JOBSCHED-02 | available-slots route includes Jobber rows in externalBlocks | integration | `npm test -- tests/api/available-slots-jobber.test.js` | ❌ Wave 0 |
| JOBSCHED-03 | poll-cron fetches Jobber delta + upserts to mirror | integration | `npm test -- tests/cron/poll-jobber-visits.test.js` | ❌ Wave 0 |
| JOBSCHED-03 | cron tombstone-sweep deletes visits missing from Jobber response | integration | same file above | ❌ Wave 0 |
| JOBSCHED-04 | bookable-users picker GET returns users + 30d flags | integration | `npm test -- tests/api/integrations/jobber-bookable-users.test.js` | ❌ Wave 0 |
| JOBSCHED-04 | bookable-users PATCH triggers diff-sync (nuke-and-repave) | integration | same file above | ❌ Wave 0 |
| JOBSCHED-04 | solo-account auto-skip: 1 user → no picker render | component test | `npm test -- tests/components/BookableUsersPicker.test.js` | ❌ Wave 0 |
| JOBSCHED-04 | zero-30d-activity → all pre-selected | component test | same file | ❌ Wave 0 |
| JOBSCHED-05 | ExternalEventBlock renders "From Jobber" pill for provider='jobber' | component test | `npm test -- tests/components/CalendarView.test.js` or new ExternalEventBlock.test.js | ❌ Wave 0 |
| JOBSCHED-05 | ExternalEventBlock renders "From Google"/"From Outlook" after retrofit (NO regression) | component test | same | ❌ Wave 0 |
| JOBSCHED-05 | click on jobber block opens day-view URL in new tab | component/e2e | same | ❌ Wave 0 |
| JOBSCHED-06 | "Not in Jobber yet" pill renders on Voco-booked appointment when jobberConnected | component test | same | ❌ Wave 0 |
| JOBSCHED-06 | copy-to-clipboard button writes expected paste block | component test | `npm test -- tests/components/AppointmentFlyout.test.js` | existing file likely — extend |
| JOBSCHED-06 | dismissible banner persists dismissal in localStorage | component test | `npm test -- tests/components/JobberCopyBanner.test.js` | ❌ Wave 0 |
| JOBSCHED-06 | booking-complete email fires with Jobber block when Jobber connected | integration | `npm test -- tests/notifications/booking-copy-to-jobber.test.js` | ❌ Wave 0 |
| JOBSCHED-07 | appointments.jobber_visit_id column unique partial index allows multiple NULLs, rejects duplicates | integration (DB) | `npm test -- tests/migrations/055.test.js` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test -- tests/scheduling/jobber-schedule-mirror.test.js` (fast unit mapper sanity) — <5s
- **Per wave merge:** `npm test -- tests/scheduling tests/integrations/jobber tests/api/webhooks/jobber tests/api/cron` — 30-60s
- **Phase gate:** `npm test` — full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/scheduling/jobber-schedule-mirror.test.js` — pure mapper tests
- [ ] `tests/lib/slot-calculator-jobber.test.js` — confirms provider-agnostic slot-calculation handles 'jobber' rows
- [ ] `tests/api/available-slots-jobber.test.js` — integration covering calendar_events widening
- [ ] `tests/cron/poll-jobber-visits.test.js` — cron integration (mock Jobber GraphQL)
- [ ] `tests/api/integrations/jobber-bookable-users.test.js` — picker GET/PATCH
- [ ] `tests/components/BookableUsersPicker.test.js` — solo auto-skip + zero-30d defaults
- [ ] `tests/components/JobberCopyBanner.test.js` — dismiss + localStorage
- [ ] `tests/components/AppointmentFlyout.test.js` — Copy-to-Jobber section (extend existing)
- [ ] `tests/components/CalendarView.test.js` — ExternalEventBlock retrofit + "Not in Jobber" pill
- [ ] `tests/notifications/booking-copy-to-jobber.test.js` — email trigger + gating
- [ ] `tests/migrations/055.test.js` — CHECK widen, column additions, unique partial index

Framework install: none — project has full test infrastructure shipped.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Scheduling tool attempts to be the calendar | Overlay / busy-block model (Calendly, Acuity, Cal.com, Reclaim) | ~2020 onward industry standard | Phase 57 adopts this universally per Q3 research (57-PRERESEARCH.md). Deliberate alignment with user muscle memory. |
| Bidirectional sync treated as table-stakes | Phase-gated one-way read first, two-way only if evidence demands | Post-2020 FSM space learning | Voco ships read-only mirror in P57, push in P999.3 after data + user feedback. Matches Jobber's own Google Calendar sync direction (one-way). |
| Webhook-only delivery assumed | Webhook primary + poll fallback | Post-2022 FSM SaaS reliability norm | P57's D-15 follows this — 15-min poll for webhook gap coverage. |
| Per-user bookable set as inferred | Explicit opt-in per-user subset (Jobber, HCP, ServiceTitan) | Current industry pattern | P57 mirrors Jobber's own Online Booking "bookable team members" pattern Voco-side. |

**Deprecated/outdated:**
- Treating `calendar_events` as Google-specific (pre-P8 Outlook shipped) — now already multi-provider-capable at the schema level, just needed CHECK widening.
- `ExternalEventBlock` hardcoded to Google's violet styling — retrofit in P57.
- Single-provider setup checklist items — superseded by per-provider items (Phase 55 `connect_xero`, Phase 56 `connect_jobber`).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Jobber's `WebHookTopicEnum` includes `VISIT_CREATE`, `VISIT_UPDATE`, `VISIT_DESTROY`, and `ASSIGNMENT_CREATE`/`ASSIGNMENT_UPDATE`/`ASSIGNMENT_DESTROY` | Pattern 4, Pitfall 2 | Handler extension never triggers. Mitigation: verify in GraphiQL at Plan 01; fallback to `JOB_UPDATE` + in-handler diff |
| A2 | Jobber GraphQL `visits(filter: { updatedAfter, startAfter, startBefore })` exists or equivalent | Pattern 9 | Poll cron can't do delta queries efficiently. Mitigation: fall back to full-window re-fetch every 15 min; acceptable for <500 visit windows |
| A3 | `users` query with nested `visits(filter: { startAfter })` exposes `totalCount` for pre-selection heuristic | Pattern 7 | Planner falls back to two-query approach (users list + recent visits grouped) |
| A4 | Jobber per-visit URL pattern `https://secure.getjobber.com/work_orders/{jobId}/visits/{visitId}` is stable enough to link | Pattern 11 | Fall back to day-view URL (documented) |
| A5 | Jobber webhooks fire separate events for assignment changes, not only `VISIT_UPDATE` | Pattern 4 | If only VISIT_UPDATE fires on reassign, handler still re-fetches assignees and reconciles bookable-set filter correctly — acceptable |
| A6 | `visit.visitStatus` enum includes values convertible to `SCHEDULED` / `IN_PROGRESS` for the mirror filter | Pattern 5 | Lock actual enum values at Plan 02; may need to map Jobber's exact casing (`scheduled` vs `SCHEDULED`) |
| A7 | Jobber's `account.timezone` (if exposed) matches the visit `startAt` offsets — no per-user timezone | Pitfall 5 | If per-user timezones exist in Jobber, handler must use each visit's native offset (already does — timestamptz preserves) |
| A8 | Vercel Cron will tolerate `*/15 * * * *` cadence on Voco's current plan | Pattern 3 | Confirm in Vercel dashboard; if not, split into less-frequent endpoint or move to external scheduler |
| A9 | The booking-complete code path (whatever fires `sendOwnerSMS` post-booking) is the right hook for `notifyBookingCopyToJobber` | Pattern 14 | Planner identifies the exact hook site during Plan 05; trivially reparentable |
| A10 | Existing tests use a runner recognizing `describe`/`test` (likely vitest or node test runner — evident from test file patterns); planner confirms at Wave 0 | Validation Architecture | If runner differs, test file extensions and import patterns adjust; substantive test logic unchanged |
| A11 | Solo-account detection happens reliably via `users.nodes.length === 1` in the Jobber response | Pattern 7, UI-SPEC | Test against a real Jobber account with exactly one user — this is a typical sole-prop case |
| A12 | `accounting_credentials.jobber_bookable_user_ids` is an acceptable storage location (vs. a new `jobber_connections` table per D-18) | Pattern 6 | Reversible if Phase 58 grows the set — data migrates to a new table with a backfill SELECT |
| A13 | Initial backfill on bookable-users PATCH completes in ≤8 seconds for typical tenant (1-10 person shop, 500-ish visits in window) | Pitfall 8 | Instrument during implementation; if violated, introduce partial-sync-in-background pattern |
| A14 | `navigator.clipboard.writeText` works in all supported browsers except on non-HTTPS contexts | Pitfall 6 | UI-SPEC provides toast fallback; additionally add text-select fallback UI |
| A15 | Jobber's sandbox (registered for P56) has visits and users populated for reasonable test coverage | Environment Availability | If sparse, seed via Jobber UI before running the bookable-users picker tests |

**All claims tagged `[ASSUMED]` above** need confirmation during Plan 01 or Plan 02. None are session-verified because Jobber's GraphQL schema is only accessible through GraphiQL with a live connected account. The research confirms these fields/events exist conceptually via official Jobber docs and WebSearch; exact names/shapes must be locked at implementation time.

---

## Open Questions (RESOLVED)

1. **Split vs. single cron for renew-calendar-channels?**
   - What we know: existing cron is daily; D-15 mandates 15-min poll. Cadence mismatch.
   - What's unclear: whether Google/Outlook renewal can tolerate running every 15 minutes without cost or API-quota impact.
   - Recommendation: Plan a dedicated `/api/cron/poll-jobber-visits` endpoint with `*/15 * * * *` and keep `/api/cron/renew-calendar-channels` on its current `0 2 * * *` schedule (Pattern 3 + Example 3).
   - **RESOLVED:** Dedicated `/api/cron/poll-jobber-visits` at `*/15 * * * *` added; `renew-calendar-channels` preserved. See Plan 01 (vercel.json) and Plan 04 (cron handler).

2. **Does a `provider_metadata JSONB` column on `calendar_events` earn its keep in v1?**
   - What we know: UI-SPEC wants per-visit click-through URLs, which needs `{job_id}` on Jobber rows to construct.
   - What's unclear: whether users actually use the day-view fallback often enough to justify the added schema surface.
   - Recommendation: Ship v1 WITHOUT the column; rely on day-view URL. Add in Phase 999.3 alongside push-back schema (the push phase needs structured metadata anyway).
   - **RESOLVED:** `provider_metadata JSONB` deferred to Phase 999.3. No column added in Migration 055. Noted in Plan 01 Task 1 (explicit exclusion).

3. **Email template design — standalone `BookingCopyToJobberEmail.jsx` or block inside a future "booking confirmation" template?**
   - What we know: no post-booking email template exists today. UI-SPEC implies a new one is needed.
   - What's unclear: is this the RIGHT moment to introduce a general booking-confirmation email, or should we scope narrowly to the Jobber-copy case?
   - Recommendation: Scope narrowly — new `BookingCopyToJobberEmail.jsx` fires only when Jobber is connected. If Voco later adds a generic booking-confirmation email, the Jobber block can become a conditional section inside it. Smaller surface now, no coupling to speculative future work.
   - **RESOLVED:** Narrow standalone `BookingCopyToJobberEmail.jsx` chosen. See Plan 05 Task 3.

4. **Who owns the "initial backfill" trigger point — OAuth callback, picker PATCH, or both?**
   - What we know: Connect-flow step is picker → PATCH → backfill. But users can reconfigure the picker from settings later, which also triggers diff-sync.
   - What's unclear: should OAuth callback kick off a "mirror all visits" backfill before the picker even runs?
   - Recommendation: NO. OAuth callback just writes tokens and redirects to the picker. The picker PATCH is the exclusive entry point to the mirror. This keeps "Jobber connected but not yet configured" states cleanly distinguishable from "Jobber connected and mirror populated." Document explicitly.
   - **RESOLVED:** Picker-only backfill trigger. OAuth callback writes tokens and redirects to `/dashboard/integrations/jobber/setup`; picker PATCH (or solo auto-skip) is the sole entry to `rebuildJobberMirror`. See Plan 04 Tasks 2 and 3.

5. **Nuke-and-repave vs. surgical diff on bookable-users PATCH?**
   - What we know: Pattern 5 stores assignee in `title`, not a structured column, so DB-level filtering by assignee_id is impossible. Surgical diff requires N Jobber GraphQL queries (one per removed user, one per added user window).
   - What's unclear: which is faster for typical tenant scale.
   - Recommendation: Nuke-and-repave (§Pattern 8 option b). Correctness trumps query efficiency for a settings-panel action that fires <1x/month per tenant.

6. **Python agent skill update?**
   - What we know: JOBSCHED-02 says "zero added call-path latency." Code read confirms the Python agent's slot query is provider-agnostic.
   - What's unclear: whether `voice-call-architecture` skill needs a note that `provider='jobber'` rows are now expected in the `calendar_events` query.
   - Recommendation: Yes, update the skill with a one-line note. Documentation-only; no Python code change.

---

## Security Domain

Security enforcement is treated as enabled (no `security_enforcement: false` in `.planning/config.json` scanned).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | OAuth already handled in P54/P56; this phase adds no new auth flow |
| V3 Session Management | no | No session changes |
| V4 Access Control | yes | `calendar_events` RLS policies (existing) enforce tenant isolation on reads and writes by the service-role path |
| V5 Input Validation | yes | Bookable-users PATCH validates `userIds: string[]` array shape; webhook body parses via `JSON.parse` with try/catch (existing pattern from P56) |
| V6 Cryptography | yes | HMAC verification on webhook — reuses existing `crypto.timingSafeEqual` + `JOBBER_CLIENT_SECRET` from P56 |
| V7 Error Handling | yes | Never log cred, tokens, or full Jobber error responses (established P55/P56 anti-pattern; extends to mirror code) |
| V9 Comm Security | yes | All Jobber calls HTTPS; webhook endpoint enforced HTTPS by Vercel |
| V13 API | yes | New routes (`/api/integrations/jobber/bookable-users`, `/api/integrations/jobber/resync`, `/api/cron/poll-jobber-visits`) follow existing auth patterns (tenant cookie, CRON_SECRET) |

### Known Threat Patterns for Next.js + Supabase + Jobber GraphQL

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Webhook replay | Tampering | HMAC verification + raw-body comparison (P56 precedent); Jobber retries are idempotent at the upsert level |
| Tenant data leak via webhook mis-resolution | Information Disclosure | `external_account_id` lookup uses exact-match, not prefix; unknown account → silent 200 (P56 precedent) |
| Bookable-users PATCH injects malicious user IDs | Tampering | Server validates IDs are strings, array length reasonable (<200); no SQL string concat — array stored via parameterized upsert |
| Jobber GraphQL query token leak via error logs | Information Disclosure | Never log error object; log structured `{tenant_id, provider, status}` only |
| Cron abuse via un-authed trigger | EoP | `Authorization: Bearer CRON_SECRET` enforced (existing pattern) |
| Per-tenant rate-limit exhaustion spilling into shared Jobber app-level quota | Denial of Service | Stagger tenants across poll windows (Pitfall 9 mitigation); retry with backoff on 429 |
| localStorage banner flag tampering | Tampering | Banner is UX-only; tampering just shows or hides it — no security impact |

---

## Sources

### Primary (HIGH confidence)

- Phase 56 RESEARCH (`.planning/phases/56-.../56-RESEARCH.md`) — Jobber OAuth, GraphQL version header, webhook HMAC pattern, `accounting_credentials.external_account_id` column, rate-limit behavior
- Phase 56 shipped code — `src/lib/integrations/jobber.js`, `src/app/api/webhooks/jobber/route.js`, `src/components/dashboard/BusinessIntegrationsClient.jsx`
- `scheduling-calendar-system` SKILL.md — `calendar_events` schema, slot-calculator signature, Python agent query path, cron renewal pattern
- `supabase/migrations/003_scheduling.sql` — original `calendar_events` schema + CHECK semantics
- `supabase/migrations/052_integrations_schema.sql` + `054_external_account_id.sql` — provider-agnostic column conventions + CHECK-widening pattern
- `src/app/api/appointments/available-slots/route.js` lines 87-91 — verified provider-agnostic read
- `src/app/api/cron/renew-calendar-channels/route.js` — existing cron structure to extend
- `src/components/dashboard/CalendarView.js` — existing `ExternalEventBlock` implementation
- `57-UI-SPEC.md` — checker-approved UI contract (all visual, copy, interaction decisions)
- Phase 57 CONTEXT (`57-CONTEXT.md`) — every locked decision

### Secondary (MEDIUM confidence)

- [Jobber API Documentation — Setting up Webhooks](https://developer.getjobber.com/docs/using_jobbers_api/setting_up_webhooks/) — HMAC key = OAuth client_secret, no handshake
- [Jobber API Documentation — Queries and Mutations](https://developer.getjobber.com/docs/using_jobbers_api/api_queries_and_mutations/) — cursor-based pagination with `first`/`after`/`nodes`/`pageInfo`
- [Jobber API Documentation — API Rate Limits](https://developer.getjobber.com/docs/using_jobbers_api/api_rate_limits/) — per-app rate budget; 429 on exhaustion
- [Jobber API Documentation — API Versioning](https://developer.getjobber.com/docs/using_jobbers_api/api_versioning/) — `X-JOBBER-GRAPHQL-VERSION` required
- [Jobber Developer Center Help](https://help.getjobber.com/hc/en-us/articles/25924078048151-Developer-Center) — GraphiQL access for schema introspection
- [Jobber Help — Online Booking](https://help.getjobber.com/hc/en-us/articles/13808363916951-Online-Booking) — bookable team members pattern (source of D-01)
- [Jobber Help — Calendar Syncing](https://help.getjobber.com/hc/en-us/articles/115009378687-Calendar-Syncing) — one-way push precedent validating Voco's read-only mirror direction
- Phase 57 PRERESEARCH (`57-PRERESEARCH.md`) — Q1/Q2/Q3 competitive analysis (Calendly, Acuity, Cal.com, Reclaim.ai, Smith.ai, Avoca, Sameday)

### Tertiary (LOW confidence — needs validation)

- WebSearch results on Jobber `WebHookTopicEnum` values — confirmed they exist, did NOT enumerate visit/assignment topic names (requires GraphiQL inspection)
- WebSearch results on Jobber `users` query with nested `visits` filter — confirmed `assignedUsers`/`startAt`/`endAt`/`visitStatus` exist but did not verify query shape with `users → visits(filter: { startAfter })` nesting
- Jobber per-visit URL pattern `https://secure.getjobber.com/work_orders/{jobId}/visits/{visitId}` — observed in live Jobber UI during industry review; no stability documentation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library already installed, verified via package.json and P56 shipped code
- Architecture: HIGH on the Next.js-side shape (verified against shipped P56 code) — MEDIUM on the specific Jobber GraphQL query strings (GraphiQL verification pending)
- Pitfalls: HIGH on the patterns (nine out of ten are either direct-from-P56-experience or DB/test discipline); MEDIUM on Pitfall 2 (topic enum values)

**Research date:** 2026-04-19
**Valid until:** 2026-05-19 (30 days — Jobber GraphQL schema is stable; any drift should be caught by Plan 01/02 GraphiQL verification)

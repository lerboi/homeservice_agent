# Phase 62: Jobber write-side — push booked customer + job into Jobber — Context (seed)

**Seeded:** 2026-04-19 (pre-discuss, promoted from backlog 999.3)
**Status:** Awaiting `/gsd:discuss-phase 62`

This file is the seed context for Phase 62. It inherits the design direction from the Phase 999.3 backlog entry, extends it with the new Phase 61 structured-address substrate, and captures the open decisions `/gsd:discuss-phase` must resolve. Decisions land in this same file (as `D-XX:` bullets) during discuss.

---

## Phase boundary

When a tenant has Jobber connected and the LiveKit agent successfully books an appointment, the post-call pipeline creates (or finds) the Jobber Client by phone and creates a Jobber Visit (or Request — decided in discuss) assigned per the Phase 57 `bookable_user_ids` opt-in subset. The appointment's `voco_booking_id` acts as the idempotency key across manual-copy (Phase 57 interim UX) and this phase's push.

Out of scope:
- Push to Xero or any other integration (Jobber-only this phase).
- Real-time push during the live call (happens in post-call pipeline — zero added call-path latency).
- Bidirectional update propagation (e.g., edit a Voco appointment → edit the corresponding Jobber visit). Deferred to a future phase.
- Invoice push (remains gated behind the invoicing feature flag, unchanged).

---

## User intent (2026-04-19)

> "...once it's confirmed and successfully booked, add it directly to the CRM (and the connected Jobber)."

Phase 61 delivers "add to the CRM" (structured-address write to `appointments` + `leads`). Phase 62 delivers "add to the connected Jobber".

---

## Why now (promotion from 999.3)

Backlog 999.3's promote trigger was: "56+57 shipped + at least one tenant connected to Jobber with live call traffic + assignee-selection pattern validated". Current state:
- Phase 56 (Jobber read-side): shipped 2026-04-18.
- Phase 57 (Jobber schedule mirror): 4/5 plans executed; 57-05 (overlay UX) is the last pending plan. Effectively closing.
- At least one tenant connected to Jobber with live traffic: true per the 2026-04-19 Railway call referenced by the user.
- Assignee-selection pattern validated: `bookable_user_ids` lives on `tenants` and is populated during Phase 56/57 onboarding.

The user is also explicitly asking for this work as part of the voice-intake polish batch. Promoting now is aligned with the original trigger.

---

## Inherited design constraints (from 999.3 + Phase 57 pre-research)

1. **Idempotency key: `appointments.voco_booking_id` (UUID).** Phase 57 (JOBSCHED-07) persists this on every Voco booking precisely so Phase 62 can dedup anything a tenant manually copied during the interim copy-paste UX. The Jobber visit/request created by this phase must include this UUID in a field that survives (Jobber custom fields or the notes field — decided in discuss).

2. **Assignee mapping from `tenants.bookable_user_ids`.** Phase 57 established the opt-in subset of Jobber users considered "bookable" from Voco. The Phase 62 push must choose an assignee from this subset. Assignment strategy options:
   - **First-bookable-user fallback:** assign to the first user in `bookable_user_ids`. Cheapest; acceptable for single-user tenants.
   - **Round-robin or least-loaded:** look at existing `calendar_events` visits for the day to pick the least-loaded assignee. Better for multi-user; more logic.
   - **Match-the-slot-calculation path:** `check_availability` / `book_appointment` today does not record which assignee the slot was calculated against. If the slot was computed treating all bookable users as interchangeable, any bookable user is a defensible assignee; if not, the assignee would need to be decided up front during booking.
   
   **Operating hypothesis (confirm in discuss):** first-bookable-user fallback for v1 of this phase, with a TODO comment for the multi-user round-robin in a follow-up phase. Document the trade-off explicitly.

3. **Degraded-mode permanence.** Phase 57's copy-to-clipboard + email-fallback UX remains the permanent fallback for tenants who opt out, whose push fails, or who disconnect Jobber. Phase 62 does not remove that code path.

---

## Current state (confirmed via code read)

### Jobber integration — read-side only today
- `livekit_agent/src/integrations/jobber.py` — has `fetch_jobber_customer_by_phone`, `_graphql_request`, `refresh_jobber_token`, `_load_jobber_credentials`.
- **No write-side mutations exist** (`grep` for `clientCreate|ClientCreate|createClient` returns zero hits).
- Next.js side: `src/lib/integrations/jobber.js` (Phase 56) — same read-only shape.
- OAuth scope audit needed: current scopes grant read; write (`write_clients`, `write_requests` / `write_visits`) may require user reconnect.

### Where push fires
- `livekit_agent/src/post_call.py:24-429` — the `run_post_call_pipeline` function is the natural home. Booking reconciliation already lives there (step 2b). A new step (6b or 9b, depending on ordering) adds Jobber push after the lead is created/merged.
- Post-call is off the call path — the push adds no caller-perceptible latency.
- Failure mode: push failure must not poison the lead/owner-notification/usage-tracking steps. Current pipeline wraps every step in try/except with "(non-fatal)" logging — Phase 62 must match that pattern.

### Idempotency ingredients already in place
- `appointments.voco_booking_id` (JOBSCHED-07, Phase 57).
- `calendar_events.jobber_visit_id` + `external_event_id` partial unique index (Phase 57 migration 055).
- `tenants.bookable_user_ids` jsonb (Phase 56/57).

---

## The Jobber GraphQL mutations (to confirm in discuss)

Jobber's API exposes (confirm against live developer.getjobber.com docs during discuss):
- `clientCreate(input: ClientCreateInput!)` — creates a client with optional properties, phones, emails, and billing/service addresses.
- `requestCreate(input: RequestCreateInput!)` — creates a request (the equivalent of a "lead" / "prospect job" in Jobber terminology).
- `scheduledItemCreate` / visit creation — depends on whether Voco appointments map to Jobber "visits" (on an existing job) or "requests" (pre-job).

**Operating hypothesis:** Voco booked appointments are most naturally Jobber **Requests** (new prospect) for first-time callers, and Jobber **Visits on the client's existing active job** for repeat callers with an open job. The Phase 56 `fetch_jobber_customer_by_phone` path already returns whether the caller has active jobs — this data is available at post-call time. Discuss must verify this mapping against real Jobber semantics.

---

## UX flip — dashboard side

Phase 57 shipped the "Not in Jobber yet" badge on Voco-only appointments in the calendar view. Phase 62 must flip that to "In Jobber" with a click-through to the Jobber visit/request on successful push:
- Add `jobber_sync_status` column to `appointments`: `not_synced` / `pending` / `synced` / `failed`.
- Add `jobber_visit_id` / `jobber_request_id` on `appointments` (nullable; populated on success).
- Calendar overlay reads these fields and renders pill state accordingly.
- Flyout click on "In Jobber" opens the Jobber visit in a new tab (same URL pattern as Phase 57 mirrored visits).
- `failed` state shows an error tooltip + "Retry" action (admin action — MVP could defer the UI and rely on Sentry + cron retry).

---

## Known open questions for discuss

- **Jobber entity mapping:** Request vs. Visit vs. new Job. Does each Voco appointment become a Jobber Request (pre-job), a visit on an existing job (for repeat callers with open jobs), or always a new Request regardless? Depends on Jobber's own conventions (confirm in discuss).
- **Assignee strategy v1:** first-bookable-user vs. round-robin. First-bookable is simpler; round-robin is fairer for multi-tech tenants.
- **Scope audit + reconnect:** which exact OAuth scopes are needed? Does the existing Jobber dev app need scope additions? Must users re-consent? If yes, dashboard Reconnect banner messaging needed.
- **Retry policy:** on network/API failure, how many retries, what backoff? Current `post_call.py` runs in a shutdown-callback with an 8s timeout budget — retries must fit inside that window, or offload to a Next.js cron (recommended).
- **Cron retry path:** does Phase 62 ship with a Next.js cron that retries `jobber_sync_status='failed'` appointments hourly, or is that deferred to a follow-up?
- **Idempotency key storage:** Jobber custom field vs. the `description`/`notes` field on the visit/request. Custom fields require tenant account tier and per-tenant setup; notes are universally available but less queryable.
- **Multi-call merges:** when Phase 59 (customer/job separation) lands, a repeat caller merges into an existing customer record. Does Phase 62 need to handle the case where a single Jobber client already exists and a second Voco booking should become a second request on the same client? (Proposal: yes — `fetch_jobber_customer_by_phone` already finds the existing client; Phase 62 just has to not create a duplicate.)
- **Booking-fail semantics:** if Jobber push fails, does the owner get a different notification color than a normal booking? (Proposal: Sentry + dashboard pill only; do not pollute the owner-SMS happy path.)
- **Timing:** does Phase 62 need Phase 61's structured address to ship well, or can it ship against the unvalidated verbatim fields? (Proposal: works either way, but Jobber Client.properties normalizes better with structured components — so Phase 61 first is ideal but not blocking.)

---

## Files expected to change

**Agent repo (livekit_agent, Railway):**
- `src/integrations/jobber.py` — add `create_jobber_client`, `find_or_create_jobber_client_by_phone`, `create_jobber_request` (or visit) functions. Reuse existing token refresh.
- `src/lib/jobber_push.py` (new) — orchestration: find-or-create client → create request/visit → write back sync status to Voco DB.
- `src/post_call.py` — new step that invokes `jobber_push` when `booking_succeeded=True` and tenant has Jobber connected.
- Tests: `tests/test_jobber_push.py`, fixture responses.

**Main repo (homeservice_agent, Vercel):**
- `supabase/migrations/NNN_jobber_sync_fields.sql` — `jobber_sync_status`, `jobber_visit_id` / `jobber_request_id` on `appointments`.
- `src/lib/integrations/jobber.js` — matching write-side helpers (for any Next.js-side use: e.g., manual "Push to Jobber" button).
- Dashboard calendar overlay + flyout components — pill state flip and Jobber click-through.
- Optional: `/api/cron/jobber-push-retry` cron for `failed` rows.
- OAuth scope configuration: `src/lib/integrations/jobber.js` scope list + UI reconnect banner if needed.
- `.claude/skills/voice-call-architecture/SKILL.md` + `dashboard-crm-system/SKILL.md` + (if created) an `integrations-jobber-xero/SKILL.md` per Phase 58.

---

## Validation approach (sketch)

- Unit tests for each mutation against recorded GraphQL responses.
- Integration test: end-to-end post-call pipeline with a mocked-Jobber service-role Supabase fixture; assert `jobber_sync_status='synced'`, `jobber_visit_id` populated, dashboard badge flips.
- Duplicate-prevention test: run the push twice for the same `voco_booking_id`; assert the second call is a no-op and the client/request are not duplicated.
- Manual-copy-then-push test: simulate a tenant having manually copied the visit into Jobber during the Phase 57 interim period (by seeding a Jobber visit with the same `voco_booking_id` in the custom-field or notes); assert Phase 62 push detects and dedupes.
- Live test with the real Jobber sandbox: at least one booking → client created → request created → dashboard pill flipped.

---

## Related context

- Phase 56 (shipped) — read-side Jobber integration; provides `fetch_jobber_customer_by_phone` + token refresh.
- Phase 57 (closing) — read-only schedule mirror + `voco_booking_id` persistence + `bookable_user_ids` + interim copy-paste UX that this phase supersedes on the happy path.
- Phase 999.3 (promoted here) — original backlog entry for this work.
- Phase 61 (recommended predecessor) — structured address improves Jobber Client write quality.
- Phase 59 (v7.0) — customer/job separation will later simplify the "repeat caller → existing Jobber client → new request on existing job" case.

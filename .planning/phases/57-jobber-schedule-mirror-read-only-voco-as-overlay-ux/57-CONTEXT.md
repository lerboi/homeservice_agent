# Phase 57: Jobber Schedule Mirror (read-only) + Voco-as-Overlay UX — Context

**Gathered:** 2026-04-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Mirror Jobber visits (one-way, Jobber → Voco) into the existing `calendar_events` table so the AI's `check_availability` tool stays a single query across Google + Outlook + Jobber with zero added call-path latency. Introduce the "Voco-as-overlay" dashboard calendar UX that treats Jobber (and all external providers) as authoritative external sources: Voco bookings are first-class and editable; mirrored external visits are muted, non-editable, click-through to source-of-truth. Ship the interim manual-copy UX ("Not in Jobber yet" badge + copy-to-clipboard + email fallback) that bridges the gap until bidirectional push lands in Phase 999.3.

**In scope:** `calendar_events.provider='jobber'` extension, Jobber visit read via existing `JobberAdapter`, webhook handler extension for visit/job/assignment events, poll-fallback cron, bookable-users picker (connect flow + settings), thin-overlay dashboard calendar (retrofitted for Google/Outlook too), interim copy-to-clipboard UX, per-appointment "Not in Jobber yet" pills, dismissible dashboard banner, email fallback conditional block, Voco booking UUID idempotency key for 999.3.

**Out of scope:** Voco → Jobber push (Phase 999.3), per-service bookable-member subsets, role-based auto-sync of bookable set (Phase 58), technician-specific booking, inline edit of Jobber visits in Voco.

</domain>

<decisions>
## Implementation Decisions

### Bookable-Users Subset (Q1)
- **D-01:** Adopt Jobber's "bookable team members" pattern Voco-side. Per-tenant opt-in set of Jobber user IDs; only visits whose assignees intersect this set are mirrored and block availability.
- **D-02:** Connect-flow picker pulls Jobber users on OAuth callback. Pre-select users with ≥1 visit in the last 30 days. Auto-skip the picker entirely if the Jobber account has exactly one user (solo owners get zero friction).
- **D-03:** Edge case — if zero users have visits in the last 30 days (new Jobber account, seasonal lull), pre-select **all users**. Safer default: no historical signal → block everyone's calendar; owner manually deselects office/admin users.
- **D-04:** Settings panel allows later edits. On save, trigger **immediate diff-sync**: delete `calendar_events` for removed users, fetch+insert events for added users across the Past 90 / Future 180 window. Synchronous — owner sees the update before the settings panel closes. No background job / toast.
- **D-05:** Unassigned Jobber visits (no assignee picked) **DO block availability**. Still real work on the schedule; matches Jobber's own online-booking behavior; prevents AI from booking over a pending-assignment slot.
- **D-06:** Status filter — mirror only visits with status `scheduled` or `in-progress` and a concrete start/end time. Cancelled, completed, and draft/anytime visits are NOT mirrored.

### Dashboard Calendar Overlay UX (Q3 + JOBSCHED-05)
- **D-07:** Thin-overlay model. Voco-booked appointments render first-class, full-colour, editable (status, cancel, notes). Mirrored Jobber visits render muted/faded with a "From Jobber" pill, NOT editable in Voco, click-through opens the visit in Jobber in a new tab. Fall back to Jobber schedule day-view if per-visit URL is unavailable (planner to confirm Jobber URL stability).
- **D-08:** **Retrofit Google and Outlook events to the same muted/non-editable treatment in Phase 57** — "From Google" / "From Outlook" pills applied consistently. Universal pattern across all external providers; avoids a mixed visual model where Jobber alone is muted while Google/Outlook stay first-class.

### Interim Copy-to-Jobber UX (Q2 + JOBSCHED-06)
- **D-09:** Every Voco-only appointment (not yet in Jobber) gets a permanent **"Not in Jobber yet" pill** inline on the calendar and in lead/appointment detail views. Pill persists until Phase 999.3 push ships.
- **D-10:** One-click "Copy details to clipboard" action per appointment — produces paste-ready block: client name, phone, address, start time, duration, service notes. Jobber new-visit deep link adjacent.
- **D-11:** Email fallback — **extend the existing booking-complete email** with a conditional block that appears only when Jobber is connected AND push is unavailable. Contains the same paste-ready block + Jobber link. Single email per booking, no notification noise.
- **D-12:** Dashboard banner on `/dashboard/calendar` — "Jobber push is coming soon — Voco bookings stay in Voco until then; click a booking to copy it into Jobber." **Dismissible per-user, persists across sessions.** Two-layer pattern: banner teaches the workflow once; per-appointment pills do the ongoing point-of-action nudging. New team members see the banner on their first visit.
- **D-13:** Voco booking UUID persisted on the appointment row as the idempotency key for Phase 999.3 push — ensures visits manually copied into Jobber during the interim are deduped when bidirectional push ships.

### Sync Mechanics
- **D-14:** Mirror window: **Past 90 days / Future 180 days**. Home-service pipelines span quarters (HVAC installs, roofing, maintenance contracts); 30-day lookback misses quarterly callbacks. Row-count impact negligible at 1-10-person-shop tenant scale.
- **D-15:** Poll-fallback cron runs **every 15 minutes**, added to existing `/api/cron/renew-calendar-channels`. Aligns with Google/Outlook cadence — single mental model for calendar ops. Webhooks are the primary path (sub-second); poll handles webhook outages only.
- **D-16:** Webhook handler `/api/webhooks/jobber` (already exists from Phase 56) extends to route visit/job/assignment events → upsert/delete in `calendar_events` + `revalidateTag('jobber-context:{tenant}:{phone}')` for customer-context side-effects.

### Schema
- **D-17:** Extend `calendar_events.provider` CHECK constraint to include `'jobber'`.
- **D-18:** Bookable-users set storage — finalize during planning: either `jobber_bookable_user_ids text[]` on the existing Phase 56 Jobber-connection row, or a new `jobber_connections` table. Planning-time decision based on what Phase 56 landed.

### Claude's Discretion
- Jobber per-visit URL format — planner confirms stability during implementation; if per-visit URLs aren't stable, fall back to schedule day-view URL.
- Exact visual tokens for muted/faded external events — designer's discretion within the existing design system.
- Bookable-users picker UI shape (list + checkboxes vs. multi-select chip input) — planner/designer choice.
- Empty-state copy when bookable-set is empty (picker + settings).
- Dismissed-banner storage key (localStorage vs. user profile DB column) — planner's call based on existing patterns.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 57 Pre-Research
- `.planning/phases/56-jobber-read-side-integration-customer-context-clients-jobs-invoices/57-PRERESEARCH.md` — Competitor analysis and recommendations for Q1 (bookable-users), Q2 (overlay UX pattern), Q3 (interim copy flow). All three recommendations locked into decisions above.

### Upstream Phase Context
- `.planning/phases/56-jobber-read-side-integration-customer-context-clients-jobs-invoices/56-CONTEXT.md` — Phase 56 Jobber OAuth + `JobberAdapter` + `/api/webhooks/jobber` decisions; Phase 57 extends the same adapter + webhook endpoint.
- `.planning/phases/56-jobber-read-side-integration-customer-context-clients-jobs-invoices/56-RESEARCH.md` — Jobber GraphQL schema, webhook event types, OAuth scopes.
- `.planning/phases/56-jobber-read-side-integration-customer-context-clients-jobs-invoices/56-UI-SPEC.md` — `BusinessIntegrationsClient` design contract; Phase 57 adds the bookable-users picker to the same flow.

### Requirements
- `.planning/REQUIREMENTS.md` §"Jobber Schedule Mirror (Phase 57)" — JOBSCHED-01 through JOBSCHED-07.

### Roadmap
- `.planning/ROADMAP.md` §"Phase 57: Jobber schedule mirror (read-only) + Voco-as-overlay UX" — goal, dependencies, requirement mapping.

### Existing Architecture Skills (READ before planning)
- `scheduling-calendar-system` skill — `calendar_events` schema, slot calculation, webhook renewal cron, Google/Outlook overlay patterns (for retrofit consistency in D-08).
- `dashboard-crm-system` skill — calendar page structure, appointment render components, pill component patterns.
- `auth-database-multitenancy` skill — migrations, RLS, `tenants` row patterns (for bookable-set storage decision D-18).

### External Docs (inform planning/research)
- [Jobber API docs](https://developer.getjobber.com/docs/) — visit/job/assignment GraphQL types, webhook event enum.
- [Jobber Online Booking — bookable team members](https://help.getjobber.com/hc/en-us/articles/13808363916951-Online-Booking) — source of the bookable-users pattern mirrored in D-01.
- [Jobber Calendar Syncing](https://help.getjobber.com/hc/en-us/articles/115009378687-Calendar-Syncing) — one-way push precedent that validates Voco's one-way mirror direction.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`JobberAdapter`** (Phase 56) — extends for visit reads; same OAuth tokens, same refresh-aware getter, same rate-limit handling.
- **`/api/webhooks/jobber`** (Phase 56) — HMAC handler exists; extend event routing to cover visit/job/assignment events.
- **`calendar_events` table + `check_availability` tool** — reuse as-is; only the `provider` CHECK needs widening.
- **`/api/cron/renew-calendar-channels`** — add Jobber poll-fallback branch alongside Google/Outlook subscription renewal.
- **Existing booking-complete email template** — extend with conditional Jobber-copy block (D-11).
- **Dashboard calendar view + existing external-event render path** — retrofit muted treatment for Google/Outlook AND Jobber (D-08).

### Established Patterns
- **One-way mirror pattern** — Google + Outlook already do this; Jobber follows the same contract.
- **Tenant-row-based connection state** — Phase 56 pattern; D-18 continues this unless `jobber_connections` table emerges as cleaner.
- **HMAC-verified webhook → `revalidateTag` loop** — established in Phase 55 (Xero) and Phase 56 (Jobber customer-context); Phase 57 adds schedule-side invalidation.
- **`revalidateTag` for cache invalidation** — `next.config.js` has `cacheComponents: true` (Phase 54); Phase 57 does not change the caching model, only extends tags.

### Integration Points
- `calendar_events` migration — new migration adds `'jobber'` to provider CHECK and (likely) adds `jobber_bookable_user_ids` column or creates `jobber_connections` table (D-18).
- Jobber connect flow (Phase 56) — insert bookable-users picker step after OAuth callback, before marking `connect_jobber` checklist complete.
- Dashboard calendar page — retrofit external-event render with muted/pill treatment; add dismissible banner.
- Settings panel (`/dashboard/more/integrations` Jobber card) — add bookable-users edit affordance.
- Booking-complete email template — conditional Jobber-copy section.
- Appointment detail components (flyout, list) — permanent "Not in Jobber yet" pill + "Copy to clipboard" action + Jobber deep link.

</code_context>

<specifics>
## Specific Ideas

- Thin-overlay pattern follows Calendly / Acuity / Cal.com / Reclaim.ai universal convention (external events = busy blocks, not first-class objects). Deliberate choice to match industry muscle memory, not invent a new paradigm.
- Interim copy-to-clipboard UX is deliberately friction-ful — better to make manual copy obvious and easy than pretend the push gap doesn't exist. "Fake-smooth" integrations generate duplicate-entry complaints (documented across Jobber Trustpilot + community threads).
- Voco's positioning: "respects your Jobber schedule" — contractor keeps Jobber, Voco reads it. Never frame Voco as replacing the FSM schedule.
- Two-layer educate-then-nudge UX: dismissible banner teaches the copy workflow; permanent per-appointment pills do the ongoing point-of-action nudging. Avoids banner fatigue while preserving discoverability for new team members.

</specifics>

<deferred>
## Deferred Ideas

- **Per-service bookable-member subsets** — Jobber supports this; Voco's first availability model is service-agnostic. Phase 58 or later.
- **Role-based auto-sync of bookable set** — if Jobber adds a user mid-contract, Voco needs a reconciliation path. Phase 58.
- **Technician-specific booking** ("book with Tech A specifically") — out of scope; Voco's 1-10-person ICP rarely needs it.
- **Inline edit of Jobber visits from Voco** — requires bidirectional push. Phase 999.3+.
- **"Hide Jobber visits" per-user toggle** on dashboard calendar — defer until user signal justifies it.
- **Crew notification when Voco books a job** — defer; Jobber's native push notifications cover this once push ships in 999.3.
- **Merged dedupe logic** in Jobber when 999.3 push ships — use Voco booking UUID (D-13) as idempotency key so manually-copied visits from the interim period don't double-up. Phase 999.3 implementation concern; Phase 57 preserves the UUID.

</deferred>

---

*Phase: 57-jobber-schedule-mirror-read-only-voco-as-overlay-ux*
*Context gathered: 2026-04-19*

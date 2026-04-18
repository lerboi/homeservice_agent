# Phase 57 Pre-Research — Jobber Schedule Mirror

Scope: Phase 57 mirrors Jobber visits into `calendar_events` (read-only, Jobber → Voco). This document researches three open design questions before planning.

---

## Q1 — Multi-user Jobber accounts: whose calendar blocks Voco's availability?

### What the evidence shows

**Jobber itself does not treat "business calendar" as a single global thing.** Its Online Booking feature — the closest analogue to "is the shop available at 3pm for a new call-in?" — operates on a **configurable subset of team members** called "bookable team members." The admin explicitly picks which employees' calendars participate in booking availability, and per-service bookable-member overrides exist. If multiple bookable team members are free, Jobber assigns randomly. ([Jobber Online Booking help](https://help.getjobber.com/hc/en-us/articles/13808363916951-Online-Booking))

Availability per team member is driven by:
- Working hours on each user profile
- Existing job assignments on the schedule
- Drive time between jobs
- Earliest-availability and buffer settings
- Manually assigned "tasks" (e.g. vacation blocks)

**Housecall Pro uses the same pattern.** A per-employee "Available for booking" toggle in the online booking settings controls who counts for availability. Company-wide closures are represented as Events that apply to all employees. ([HCP Online Booking Overview](https://help.housecallpro.com/en/articles/7034474-online-booking-overview))

**ServiceTitan goes further with Adaptive Capacity** — business units × technician shifts × arrival windows × capacity rules ("leave 20% for demand calls"), which is a per-tenant capacity model, not a per-user one. ([ServiceTitan Adaptive Capacity](https://www.servicetitan.com/podcasts/mastering-servicetitan/zack-kays-interview-2))

**Competitor AI receptionists delegate, they don't recompute.**
- **Smith.ai** explicitly "uses Jobber's online booking form to book appointments" and relies on "Jobber's team assignment technology" for assignee selection. ([Smith.ai × Jobber](https://smith.ai/integrates-with/jobber), [setup doc](https://docs.smith.ai/article/0umf8lqdwy-how-to-connect-jobber-to-smith-ai-appointment-setting))
- **Avoca AI**, **Sameday**, and **NextPhone** market "books based on technician availability" for ServiceTitan/HCP but don't publish the exact availability algorithm; they integrate with the FSM's native booking surface. ([Avoca](https://www.avoca.ai/), [Sameday for ServiceTitan](https://www.gosameday.com/post/best-virtual-receptionist-for-servicetitan-why-contractors-choose-sameday), [NextPhone × HCP](https://www.getnextphone.com/blog/housecall-pro-integration))
- **Numa** side-steps entirely by handing the caller a booking link to the existing online-booking portal. ([Numa receptionist](https://www.numa.com/blog/virtual-receptionist-software))

**The naive "mirror all users" option is known to be wrong.** The explicit Jobber-side design choice to separate "team member" from "bookable team member" exists precisely because not every active user should block customer-facing availability (e.g. office admins, seasonal leads, apprentices without full service authorization).

### Recommendation for Phase 57

Adopt the **"bookable team members" model Voco-side** — option (c) from the brief. Specifically:

- On connect, pull `users` from Jobber with their roles and display them.
- Voco maintains a per-tenant `jobber_blocking_user_ids` set (stored on the `tenants` row or a new `jobber_connections` table field).
- Default on connect: pre-select all users whose Jobber role is not "Office User" / dispatcher-only. A reasonable heuristic is "users who have at least one visit assigned in the last 30 days." Show the list; let the owner confirm/deselect during the connect flow.
- Availability check during AI booking = union of visits whose assignees intersect `jobber_blocking_user_ids`.

Tradeoff: one extra checkbox step in the connect flow. Pay-off: avoids both over-blocking (2-tech shop that thinks it is booked when only Tech B is out) and under-blocking (solo owner connects from a multi-user account and only their calendar mirrors).

### Defer / flag

- **Per-service bookable-member subset** (Jobber supports this) — defer to Phase 58. Voco's first availability model is service-agnostic.
- **Role-based auto-sync of bookable set** — if Jobber adds a user mid-contract, Voco needs a reconciliation path. Flag for Phase 58.
- **Technician-specific booking** ("book with Tech A specifically") — out of scope; Voco's 1–10-person ICP rarely needs it.

---

## Q2 — Jobber-as-source-of-truth UX: what happens in practice

### What the evidence shows

**"Works alongside your existing FSM" is a live category position.** Smith.ai, Avoca, Sameday, NextPhone, Goodcall, and Jobber's own AI Receptionist all frame themselves as layers on top of the FSM, not replacements. ([Sameday](https://www.gosameday.com/), [Goodcall](https://www.goodcall.com/), [Jobber AI Receptionist launch](https://www.prnewswire.com/news-releases/jobber-launches-ai-powered-receptionist-to-answer-calls-and-texts-for-busy-home-service-businesses-302531125.html))

**Third-party bookings appear live in the FSM with standard assignment.** Smith.ai books go directly into the Jobber schedule and are auto-assigned via Jobber's own assignment logic. No contractor approval step is imposed by the integration itself. Contractor review is something contractors configure on their own side (e.g. by assigning to a review queue user) — the integrations don't enforce a "pending" state.

**The dominant complaint category across Jobber reviews is duplicates and sync fragmentation** — not "wrong person got the job" but "the same customer / same job exists twice because two systems wrote to us." Trustpilot and community threads call this out as Jobber's #1 integration pain. ([Jobber duplicate-client community thread](https://community.getjobber.com/discussions/customer-management-and-self-serve/how-to-manage-duplicate-clients-flags-and-scheduling-visibility-in-jobber/8134), [Jobber Trustpilot reviews](https://www.trustpilot.com/review/getjobber.com))

**Jobber's native Google Calendar sync is one-way (Jobber → Google) by design.** Users have publicly noted that turning on the sync "really clutter[s] up our calendar and added a redundant item." ([Jobber Calendar Syncing help](https://help.getjobber.com/hc/en-us/articles/115009378687-Calendar-Syncing)) Jobber itself treats the external calendar as read-only output, which is exactly the pattern Voco is proposing in reverse.

**No vendor found publishes a clean "read-only interim" UX.** When bidirectional sync is not yet shipped, the typical pattern in FSM-adjacent tools is (a) ship the integration with read-only messaging in release notes, (b) label the feature "beta," (c) leave the contractor to manually mirror. There is no observed best-practice pattern for "Voco-only appointments, please copy to Jobber" UX — the field is empty.

### Recommendation for Phase 57

1. **Match the category position.** Market Phase 57 as "Voco respects your Jobber schedule" — the contractor keeps Jobber, Voco reads it. Do not frame Voco as replacing the schedule.
2. **Interim read-only UX for Voco-booked appointments (before Phase 999.3 push ships):**
   - Voco dashboard marks each Voco-only appointment with a visible **"Not in Jobber yet"** badge.
   - Each appointment has a one-click **"Copy details to clipboard"** action that produces a paste-ready block (client, address, start, duration, notes) plus a **"Open Jobber"** deep link to the new-visit screen.
   - Send an email on booking: "Voco booked a job for Tuesday 3pm — add it to Jobber: [link]." This is the fallback humans will actually use.
   - Surface a **setup-checklist / banner** in the dashboard: "Jobber push is coming soon. Until then, Voco bookings stay in Voco. Click a booking to copy it into Jobber."
3. **Dedupe on the Jobber side when push ships (Phase 999.3).** Use Voco's booking ID as an idempotency key on the Jobber job, so a contractor who manually copied it during the interim period doesn't end up with two entries.

Tradeoff: the interim UX is deliberately friction-ful — it is better to make manual copy obvious and easy than to pretend the gap doesn't exist. "Fake-smooth" integrations are what generate the duplicate complaints above.

### Defer / flag

- Phase 999.3 push: treat Phase 57's copy-to-clipboard flow as the graceful fallback mode that remains available even after push ships (for tenants who disable push).
- Crew notification when Voco books — defer; Jobber's native push notifications cover this once the visit lands there via push.

---

## Q3 — Dashboard calendar model: merged vs. thin overlay

### What the evidence shows

**Every scheduling tool in the space uses the "overlay" pattern, not "be the calendar" pattern.** The consistent convention:

- **Calendly** only reads external-calendar events marked *Busy* and displays them as opaque conflict blocks — no event details, no editing. The user's connected Google/Outlook remains the source-of-truth UI. ([Calendly Busy/Free](https://help.calendly.com/hc/en-us/articles/32482941398167-How-to-manage-Busy-vs-Free-calendar-settings))
- **Acuity** explicitly blocks synced external events as labeled "Busy" in daily/weekly view and as blocked time in monthly view, with a toggle to hide titles. It does not let you edit them. ([Acuity Syncing your calendar](https://help.acuityscheduling.com/hc/en-us/articles/16676868807181-Syncing-your-calendar))
- **Cal.com** treats connected calendars as conflict-check sources only; native Cal.com bookings are the first-class objects, everything else is a busy block. There is an open issue (CAL-2371) to even *show* external busy blocks in the public view because they were previously hidden entirely. ([Cal.com issue #10879](https://github.com/calcom/cal.com/issues/10879))
- **Reclaim.ai** goes further by explicitly creating *two tiers* — "Connected Calendars" (blocking-only, invisible to others) vs. "Calendar Sync" (duplicated events). The default is the conservative blocking-only path. ([Reclaim connected calendars](https://help.reclaim.ai/en/articles/5202336-how-to-use-reclaim-with-your-existing-calendars))
- **Housecall Pro / Jobber Google sync** is one-way push; HCP/Jobber do not even attempt to pull external events back in as first-class objects.

**Nobody in this space tries to be the calendar UI on top of another system of record.** The pattern is universal and the reason is universal: the source-of-truth system has richer edit affordances, already works on mobile, and is where the team's muscle memory lives. A scheduling-adjacent tool that re-implements the calendar ends up (a) always behind on features, (b) generating duplicate-entry complaints, and (c) confusing users about where to edit.

### Recommendation for Phase 57

**Thin availability overlay.** Voco's dashboard calendar:

- Voco-booked appointments: full-colour, first-class, editable (status, cancel, notes).
- Mirrored Jobber visits: muted grey/faded "busy" blocks labeled with client name and "From Jobber" pill. **Not editable in Voco** — clicking opens the visit in Jobber in a new tab.
- Google/Outlook calendar events (existing integration): already fit this model; keep consistent visual treatment with Jobber blocks.
- Clear visual hierarchy: Voco bookings pop, mirrored sources recede. The calendar answers "where does Voco have bookings?" primarily and "is the business busy?" secondarily.

Tradeoff: contractors cannot edit a Jobber visit inside Voco — they click through. This matches the entire industry convention and prevents the duplicate / stale-edit problems the evidence documents.

### Defer / flag

- **Merged-edit** (editing Jobber visits from Voco) requires bidirectional push and is Phase 999.3+.
- **Click-through deep links** to the specific Jobber visit URL: confirm during Phase 57 implementation that Jobber exposes a stable per-visit URL; if not, fall back to the Jobber schedule day-view for that date.
- **"Hide Jobber visits" toggle** per-user — defer until we have signal it's wanted.

---

## Summary of recommendations

| Question | Phase 57 decision | Deferred to |
|---|---|---|
| Q1 — whose calendar | Per-tenant "bookable users" subset, default = users with recent visits | Per-service subset, role-based auto-sync (Ph 58) |
| Q2 — UX pattern | Read-only mirror + explicit "Not in Jobber yet" badge + copy-to-clipboard + email fallback | Bidirectional push (Ph 999.3) with idempotency key |
| Q3 — calendar model | Thin availability overlay — Voco bookings first-class, Jobber visits faded/click-through | Inline edit of Jobber visits (Ph 999.3+) |

## Key sources

- [Jobber Online Booking help](https://help.getjobber.com/hc/en-us/articles/13808363916951-Online-Booking)
- [Jobber Receptionist help](https://help.getjobber.com/hc/en-us/articles/25315927533847-Receptionist-powered-by-Jobber-AI)
- [Jobber Calendar Syncing help](https://help.getjobber.com/hc/en-us/articles/115009378687-Calendar-Syncing)
- [Jobber API docs](https://developer.getjobber.com/docs/)
- [Housecall Pro Online Booking](https://help.housecallpro.com/en/articles/7034474-online-booking-overview)
- [ServiceTitan Adaptive Capacity](https://www.servicetitan.com/podcasts/mastering-servicetitan/zack-kays-interview-2)
- [Smith.ai × Jobber](https://smith.ai/integrates-with/jobber)
- [Smith.ai Jobber setup](https://docs.smith.ai/article/0umf8lqdwy-how-to-connect-jobber-to-smith-ai-appointment-setting)
- [Avoca AI](https://www.avoca.ai/)
- [Sameday for ServiceTitan](https://www.gosameday.com/post/best-virtual-receptionist-for-servicetitan-why-contractors-choose-sameday)
- [Calendly Busy/Free settings](https://help.calendly.com/hc/en-us/articles/32482941398167-How-to-manage-Busy-vs-Free-calendar-settings)
- [Acuity calendar sync](https://help.acuityscheduling.com/hc/en-us/articles/16676868807181-Syncing-your-calendar)
- [Cal.com overlay issue #10879](https://github.com/calcom/cal.com/issues/10879)
- [Reclaim.ai connected calendars](https://help.reclaim.ai/en/articles/5202336-how-to-use-reclaim-with-your-existing-calendars)
- [Jobber duplicate client community thread](https://community.getjobber.com/discussions/customer-management-and-self-serve/how-to-manage-duplicate-clients-flags-and-scheduling-visibility-in-jobber/8134)

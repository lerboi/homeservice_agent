---
type: system
system: Dashboard and CRM
status: legacy-app
description: "5b. Inquiries - Callbacks view (merged into Calls, 2026-06-10). Covers: D-07a Owner Responsibility Stance; InquiryStatusPills; API filters (UI consumer deleted); InquiryFlyout"
source: .claude/skills/dashboard-crm-system/SKILL.md § 5b. Inquiries — Callbacks view (merged into Calls, 2026-06-10)
migrated: 2026-11-23
verified:
tags: [voco/system/dashboard-and-crm]
---

# 5b. Inquiries - Callbacks view (merged into Calls, 2026-06-10)

Part of [[Dashboard and CRM]]. Migrated verbatim from the `dashboard-crm-system` skill; check `verified` before trusting details.

**Files**: `src/app/dashboard/calls/page.js` (the view lives here — see
Section 6) + `src/app/dashboard/inquiries/page.js` (now a one-line server
component calling `redirect('/dashboard/calls?view=callbacks')`, kept
only so old deep links / bookmarks / notification links keep working).

The Phase 59 Inquiries TAB no longer exists. Its work queue is the
**"Callbacks" view** inside the Calls page (renamed same-day from "Needs
reply" after user feedback), which reuses the surviving inquiry components:
`InquiryCard` + `InquiryStatusPills` (Open/Booked/Lost sub-pills) +
`InquiryFlyout` (Convert-to-Job via QuickBookSheet + Mark-as-Lost with 5s
sonner undo), plus the `inquiries` Realtime subscription — all ported from
the old page. The view is headed by an `<h1>Callbacks</h1>` and a
**"← All calls" back control** (ArrowLeft + muted-foreground text button,
same pattern as the admin/merges breadcrumb) that switches back to the
classic view. **The inquiries data model, `/api/inquiries*` routes,
voice-agent writes, stats, and customer-page inquiry surfaces are
unchanged.**

**M16 P1 (2026-06-20)** — a new durable `inquiries.out_of_area boolean`
(migration 074) is set by the voice agent when a caller's confirmed address
is outside the Service Area (see Section 14, `ServiceAreaManager`). The flag
is persisted but a CRM badge to surface it in the Callbacks/inquiries view is
a DEFERRED follow-up — **not yet displayed**.

**Known consequences (deliberate, not bugs):**
- The Callbacks view has **NO search / urgency / date filters** —
  `InquiryFilterBar.jsx` was deleted with the old page. The API still
  supports those filters (see below); only the UI consumer is gone.
- Old `?status=` deep links to `/dashboard/inquiries` land on the **Open**
  sub-pill (the redirect drops the param; default sub-filter is `open`).

**Deleted components (2026-06-10)**: `InquiryFilterBar.jsx`,
`EmptyStateInquiries.jsx` — only the old inquiries page used them. The
empty state is now an inline "All caught up" block in the calls page.

### D-07a Owner Responsibility Stance

Open inquiries stay `open` indefinitely. **No cron, no auto-timeout, no
visual staleness flag in V1.** Matches "inbox" mental model — owner converts
or marks lost when ready. The Callbacks queue is the owner's
responsibility to triage. Revisit if owners report cognitive load from the
inbox filling up. The D-07a MUST-NOT invariant comment (no age-based
mutation / staleness flags / auto-lost) was carried from the old inquiries
page into `calls/page.js`.

The chatbot knowledge doc `inquiries.md` includes a "Stale inquiries" section
explaining this D-07a policy.

### InquiryStatusPills

**File**: `src/components/dashboard/InquiryStatusPills.jsx`

Horizontal pill strip. Status enum: `open/converted/lost`. Display labels
(2026-06-10): **Open · Booked · (gap) · Lost** with `ml-2` gap before Lost.

**`converted` renders as "Booked" everywhere** — display label only, via
status-label maps in `InquiryStatusPills`, `InquiryCard` (`STATUS_LABEL`),
and `InquiryFlyout` (`STATUS_LABELS`); the Callbacks filtered-empty
copy also says "No booked callbacks right now." **Stored DB values and API
filters are unchanged** (`status=converted`) — never send "booked" to the
API.

### API filters (UI consumer deleted)

`InquiryFilterBar.jsx` was **deleted** in the 2026-06-10 merge, but the
server-side filters it drove remain live: `listInquiries`
(`src/lib/inquiries.js`) + `GET /api/inquiries` honor `urgency` (exact),
`job_type` (partial `ilike`, inquiries DO have a `job_type` column — unlike
jobs), `search` (customer name OR phone via the same escaped `.or` on the
`customers!inner` join as `listJobs`), and `date_from`/`date_to`
(`YYYY-MM-DD` validated in the route, invalid ignored; `date_to` inclusive
end-of-day UTC). The Callbacks view currently calls `GET /api/inquiries`
unfiltered (all statuses, API limit 200) and filters by status client-side
so the sub-pills (and the CallbacksStrip count) carry live counts.

### InquiryFlyout

**File**: `src/components/dashboard/InquiryFlyout.jsx`

Right Sheet. Shows inquiry details, customer link, urgency badge,
transcript (if call linked), status Select (status rendered via
`STATUS_LABELS` — `converted` → "Booked"). Actions:
- "Convert to Job" button → `POST /api/inquiries/${id}/convert` (creates Job + marks inquiry `converted`)
- "Mark as Lost" → `PATCH /api/inquiries/${id}` with `{status: 'lost'}`
- Links to customer detail page (`/dashboard/customers/[customerId]`)

---

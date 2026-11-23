---
type: system
system: Dashboard and CRM
status: legacy-app
description: "Jobs Tab (Phase 59 - rewired to jobs table). Covers: JobStatusPills; JobFilterBar; Batch invoicing failure UX (2026-06-10); JobFlyout (formerly LeadFlyout); HotJobsTile — 'Needs follow-up' (2026-06-10 retitle); EmptyStateJobs"
source: .claude/skills/dashboard-crm-system/SKILL.md § 5. Jobs Tab (Phase 59 — rewired to jobs table)
migrated: 2026-11-23
verified:
tags: [voco/system/dashboard-and-crm]
---

# Jobs Tab (Phase 59 - rewired to jobs table)

Part of [[Dashboard and CRM]]. Migrated verbatim from the `dashboard-crm-system` skill; check `verified` before trusting details.

**File**: `src/app/dashboard/jobs/page.js`

Client component. Status pill strip + filter bar + job list + Realtime
subscription on `jobs` table (filtered by `tenant_id`).

### JobStatusPills

**File**: `src/components/dashboard/JobStatusPills.jsx`

Horizontal pill strip. One pill per pipeline status with live count.
DB enum (`scheduled/completed/paid/cancelled/lost`) drives data. Display
labels: **Scheduled · Completed · Paid · (gap) · Cancelled · Lost**.
`ml-2` gap before Cancelled separates active from terminal states.
Phase 49 categorical dark-mode palette preserved. Clicking active pill
clears filter. Counts derived client-side from parent's `jobs` array.

### JobFilterBar

**File**: `src/components/dashboard/JobFilterBar.jsx`

Desktop (≥640px): inline flex-wrap (search, urgency Select, date range,
Clear all). Mobile (<640px): search + Filters button
that opens a bottom Sheet. Status filter in `JobStatusPills`.
The job-type Input was REMOVED 2026-06-12 (no backing column — see below).

**Server-side filters wired (2026-06-10)** — `listJobs` (`src/lib/jobs.js`)
+ `GET /api/jobs` now honor:

- `search` — customer **name OR phone** via an escaped `.or(
  'name.ilike.%s%,phone_e164.ilike.%s%', { referencedTable: 'customer' })`
  on the `customers!inner` join (parent-row filter, same pattern as
  `listCustomers`; term escaped with `escapeOrTerm` from
  `src/lib/search-filter.js`, capped at 100 chars). This makes the
  Calls-page → Jobs `?search=<phone>` cross-link actually filter.
- `date_from` / `date_to` — `created_at` range; route validates strict
  `YYYY-MM-DD` (invalid values silently ignored, not 400); `date_to` is
  inclusive of the whole day (`T23:59:59.999Z` UTC).

**RESOLVED (2026-06-12) — jobs `job_type` UI removed everywhere**:
`jobs.job_type` has **no backing column** (migration 059; the API documents
`job_type` as NOT supported and `listJobs` cannot apply it). The dead UI was
removed rather than wired to nothing: the JobFilterBar job-type Input, the
JobCard and JobFlyout job-type chips, and the jobs page's `job_type` param
are all gone; the batch-invoice dialog now shows **`service_address`**
instead of the always-empty job type. (Inquiries DO have a `job_type`
column — that surface is unchanged.) Do not reintroduce job_type UI without
first adding the column.

### Batch invoicing failure UX (2026-06-10)

`handleBatchCreate` (jobs page → `POST /api/invoices/batch` →
`/dashboard/invoices/batch-review?ids=`) on failure now shows a **sonner
`toast.error("Couldn't create batch invoices. Try again.")`** and preserves
the selection. It previously set the page-level `error` state — swapping the
entire list for `ErrorState` — with an uncleared 5s `setTimeout`; both the
page-swap and the timer are gone.

### JobFlyout (formerly LeadFlyout)

**File**: `src/components/dashboard/JobFlyout.jsx`

Right Sheet. On open: fetches `/api/jobs/${jobId}` (with transcript)
AND `/api/invoices?job_id=${jobId}` for linked-invoice check.
**2026-06-12 fix**: `getJob`'s detail select now actually includes
`recording_storage_path`, `transcript_text`, `transcript_structured` — it
previously selected none of them, so the TranscriptViewer was always empty
and storage-path recordings never resolved (the "with transcript" claim was
aspirational until this fix). Renders:

- Urgency badge + relative time
- Customer info (phone, timestamp) — links to `/dashboard/customers/[customerId]`
- Job details (service_address, triage layer/confidence — the job_type chip
  was removed 2026-06-12, no backing column)
- `AudioPlayer` recording URL
- `TranscriptViewer` (structured + text)
- Status `Select` + `RevenueInput` (for completed/paid)
- "Update Status" → `PATCH /api/jobs/${jobId}`
- **Create/View Invoice**: Create button when status completed or paid AND no linked invoice. View when linked.
- "Mark as Lost" with AlertDialog.

`URGENCY_STYLES`, `STATUS_LABELS`, `STATUS_OPTIONS`. `formatRelativeTime(iso)` helper.

### HotJobsTile — "Needs follow-up" (2026-06-10 retitle)

**File**: `src/components/dashboard/HotJobsTile.jsx`

Replaces `HotLeadsTile` (deleted in Phase 59). Wired in `DailyOpsHub`.
**Despite the filename, this tile shows OPEN INQUIRIES, not jobs.** It reads
`newLeadsCount` / `newLeadsPreview` from `GET /api/dashboard/stats`, which
(post-Phase-59 repointing) count open inquiries. The 2026-06-10 wave fixed
the mislabel: title is **"Needs follow-up"** (was "Scheduled jobs"), icon is
`PhoneIncoming` (was `Flame`), CTA is **"View callbacks"** →
`/dashboard/calls?view=callbacks` (the Callbacks view — repointed in
the Inquiries → Calls merge), count copy is "N caller(s) waiting for a
callback". The originally planned `hotJobsCount`/`hotJobsPreview` backend
fields never shipped — the legacy-shape fallback was removed.

### EmptyStateJobs

**File**: `src/components/dashboard/EmptyStateJobs.jsx`

Thin wrapper delegating to shared `<EmptyState icon={Users} headline="No jobs yet"
... ctaHref="/dashboard/more/ai-voice-settings" />`. See Section 11.

---

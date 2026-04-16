# Phase 52: Rename Leads Tab to Jobs and Restructure Status Pills — Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Pure frontend reframe of the `/dashboard/leads` surface to match the mental model of a home-service SME owner. Scope:

- Nav labels "Leads" → "Jobs" (sidebar + BottomTabBar + breadcrumbs)
- Canonical URL renamed from `/dashboard/leads` to `/dashboard/jobs` (with permanent redirect from the old path)
- Status pill strip relabeled with home-service vernacular and reordered by progression
- User-facing copy on the leads page, LeadFlyout, home-page widgets (HotLeadsTile, DailyOpsHub), EmptyStateLeads, stats API response labels, and search index reframed as "job(s)"

Explicitly **out of scope** (hard boundaries, do not cross):

- No changes to the `leads` DB table, `leads.status` CHECK enum, or any migration
- No changes to `/api/leads/*` route paths, request/response shape, or any API contract
- No changes to the voice agent, call processor, notification schemas, or any backend pipeline
- No changes to component file names (`LeadCard.jsx`, `LeadFlyout.jsx`, `LeadStatusPills.jsx`, `LeadFilterBar.jsx`, `EmptyStateLeads.jsx`, `HotLeadsTile.jsx` all stay)
- No repainting of pill colors — Phase 49 Plan 04's categorical dark-mode palette is preserved verbatim

</domain>

<decisions>
## Implementation Decisions

### Status Pill Structure
- **D-01:** Keep 5 pills, 1:1 with the existing DB enum (`new`, `booked`, `completed`, `paid`, `lost`). No merging, no derived/virtual sub-states. Rationale: the `completed` vs `paid` distinction is the home-service owner's "who owes me money" list — merging it into a single "Done" pill buries collections workflow behind a click. The "quick UI win" framing in v6.0 also argues for the cheapest shape.
- **D-02:** Pill labels use home-service vernacular: **New · Scheduled · Completed · Paid · Lost**. `booked` relabels to "Scheduled" (closer to the calendar mental model owners already use). `new`, `completed`, `paid`, `lost` keep their current English labels — they already match how owners talk about their work.
- **D-03:** Pill order is job-progression left-to-right, with Lost pushed visually to the right via a small gap (Tailwind `ml-2` or thin divider). Terminal-negative states read as separated from the active pipeline. The existing `overflow-x-auto` scroll behavior on 375px stays.
- **D-04:** Keep the numeric count badge on each pill. The count on the Completed pill doubles as the owner's at-a-glance "unpaid jobs" counter — the single most valuable number on this screen.

### URL and Route
- **D-05:** Canonical URL is renamed from `/dashboard/leads` to `/dashboard/jobs`. The Next.js `redirects` config emits a permanent 308 from the old path to the new so that bookmarks, old notification emails, and any external references (including OG tags, onboarding emails, setup checklist deep links) keep working. Page file moves from `src/app/dashboard/leads/page.js` and `loading.js` to `src/app/dashboard/jobs/page.js` and `loading.js`.
- **D-06:** API routes stay unchanged: `/api/leads/[id]`, `/api/leads` remain under the `leads` path. The frontend page fetches from `/api/leads/...` even after the URL rename — this matches the ROADMAP constraint "no API changes."
- **D-07:** All 22 internal source files that reference `/dashboard/leads` must be updated to `/dashboard/jobs`. These include: the 6 chatbot-knowledge markdown files under `src/lib/chatbot-knowledge/`; `src/lib/notifications.js:319` (dashboard link in email templates — new emails use the new URL, legacy emails rely on the redirect); `DashboardSidebar.jsx`, `BottomTabBar.jsx`, `DashboardTour.jsx`, `HotLeadsTile.jsx`, `AppointmentFlyout.js`; pages under `src/app/dashboard/{invoices,calls,estimates,more}/**`; and `src/app/api/search/route.js`.

### Lost Status Fate
- **D-08:** Keep the label "Lost" — it already matches home-service vernacular ("I lost the Henderson job"). No rename to "Cancelled" or "Dead." Lost remains a filterable pill; it sits at the far right of the progression with a visual gap separating it from `Paid`.

### Copy Reframe Scope
- **D-09:** Reframe "Lead(s)" → "Job(s)" in **all** user-facing strings across these surfaces:
  - `DashboardSidebar.jsx` and `BottomTabBar.jsx` nav labels (RENAME-01)
  - Page H1/title on `/dashboard/jobs`
  - `LeadFilterBar` placeholders and aria-labels (`"Search leads"`, `"Filter leads by status"`, `"Filter leads"` sheet title, `"Search name or phone..."` if kept)
  - `LeadFlyout` sheet titles (`"Lead Details"` → `"Job Details"`, `"Loading lead details"` → `"Loading job details"`), body copy, toast messages (`"Lead marked as Lost"`, `"Lead moved to ..."`)
  - `HotLeadsTile` title and any copy that says "leads"
  - `DailyOpsHub` widgets that reference leads on the dashboard home
  - `EmptyStateLeads` headline + body
  - Stats API response labels (where the response string surfaces to UI — internal keys stay)
  - `src/app/api/search/route.js` — display text for `/dashboard/leads` search hits re-labeled as "Jobs" and the URL updated
  - Breadcrumbs on `/dashboard/jobs` (required by RENAME-01)
- **D-10:** Component file names stay as-is per RENAME-03. Internal variable names (`lead`, `leads`, `LeadStatusPills`, `STATUS_OPTIONS`, `PIPELINE_STATUSES`) stay. The reframe is copy-only, not symbol-renaming.

### Visual and Token Treatment
- **D-11:** Phase 49 Plan 04's categorical dark-mode color mapping for status pills is preserved verbatim — no repaint. DARK-07's categorical-distinguishability guarantee remains intact. The only visual change is the `ml-2` (or equivalent) gap before the Lost pill.
- **D-12:** Count badge styling stays identical to today. Hover/focus/active states stay identical. The pill-strip markup shape in `LeadStatusPills.jsx` stays identical — only `PIPELINE_STATUSES` array labels and ordering change.

### Chatbot Knowledge
- **D-13:** Update the 6 `src/lib/chatbot-knowledge/*.md` files that reference `/dashboard/leads` or "leads" to use `/dashboard/jobs` / "jobs." These files feed the in-app AI chatbot; stale URLs mean the chatbot's deep-links will 308-redirect (still works) but its natural-language answers will say "Leads" when the UI says "Jobs," which breaks the reframe.

### Claude's Discretion
- Exact wording of page H1, empty-state headlines, toast messages, and breadcrumb text — pick home-service-natural copy at plan/implementation time.
- Exact size of the visual gap before Lost (`ml-2` vs `ml-3` vs a vertical divider) — pick whichever reads best in light + dark.
- Whether the filter bar's "Search name or phone…" placeholder needs any change (it doesn't say "lead" — may not need edit).
- Whether to rename `PIPELINE_STATUSES` constant in `LeadStatusPills.jsx` internally — no user impact either way; keep the change minimal.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §"Rename / UX (Phase 52)" — RENAME-01, RENAME-02, RENAME-03 requirement text
- `.planning/ROADMAP.md` line 191 — Phase 52 scope summary ("pure frontend reframe... no DB/API/agent changes")

### Prior Phase Context (locks in place that Phase 52 must respect)
- `.planning/phases/49-dark-mode-foundation-and-token-migration/49-04-PLAN.md` — UI-SPEC §Status Badges categorical mapping used by all status pills; DARK-07 contract (categorical distinguishability in dark mode)
- `.planning/phases/49-dark-mode-foundation-and-token-migration/49-04-SUMMARY.md` — confirms `LeadStatusPills.jsx` was migrated to this palette
- `.planning/phases/49-dark-mode-foundation-and-token-migration/49-RESEARCH.md` §"Pitfall 3: Categorical Inversion Collapse in Status Pills" — explains why the pill colors cannot be naively repainted

### Existing Code (source of truth for what changes)
- `src/components/dashboard/LeadStatusPills.jsx` — the `PIPELINE_STATUSES` array that defines pill labels, order, and per-pill active classes; this is the primary mutation target
- `src/components/dashboard/LeadFilterBar.jsx` — urgency/search/date filters on the page; aria-labels and sheet titles need copy reframe
- `src/components/dashboard/LeadCard.jsx` — `STATUS_BADGE` and `STATUS_LABEL` maps that render the per-card badge (should relabel "Booked" → "Scheduled" to match the pill strip)
- `src/components/dashboard/LeadFlyout.jsx` — sheet titles, toast messages, and any "Lead" copy that surfaces to the owner
- `src/components/dashboard/HotLeadsTile.jsx` — home-page widget that currently says "Leads"
- `src/components/dashboard/DailyOpsHub.jsx` — home-page orchestrator that may reference leads
- `src/components/dashboard/EmptyStateLeads.jsx` — empty-state copy
- `src/components/dashboard/DashboardSidebar.jsx:18` — nav label "Leads" + route `/dashboard/leads`
- `src/components/dashboard/BottomTabBar.jsx:10` — mobile nav label + route
- `src/components/dashboard/DashboardTour.jsx` — onboarding tour step that points at `/dashboard/leads`
- `src/app/dashboard/leads/page.js` — moves to `src/app/dashboard/jobs/page.js`
- `src/app/dashboard/leads/loading.js` — moves to `src/app/dashboard/jobs/loading.js`
- `src/app/api/search/route.js` — search-index entry for leads; update display text and URL
- `src/lib/notifications.js:319` — dashboard link embedded in notification email templates
- `src/lib/chatbot-knowledge/index.js`, `leads.md`, `calendar.md`, `calls.md`, `call-routing.md`, `estimates.md`, `invoices.md`, `getting-started.md` — chatbot answer corpus; 6+ files reference `/dashboard/leads` or "leads"
- `supabase/migrations/004_leads_crm.sql:19` — `leads.status` CHECK constraint (`new`, `booked`, `completed`, `paid`, `lost`); **read-only in this phase** — this is the immutable source of truth for pill values

### Architectural Skill
- `dashboard-crm-system` skill (in CLAUDE.md skill table) — read before any dashboard change; update after Phase 52 ships to reflect new nav label, new URL, new status-pill labels

### Next.js Redirect Pattern
- `next.config.js` (root of repo) — where the permanent redirect `/dashboard/leads` → `/dashboard/jobs` is registered. Use `{ source, destination, permanent: true }` form.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `LeadStatusPills.jsx` already has a clean `PIPELINE_STATUSES` array driving render — label + order changes are one-array edits.
- `STATUS_BADGE` and `STATUS_LABEL` maps in `LeadCard.jsx` are already keyed by the DB enum — relabeling is one-map edit.
- `overflow-x-auto` scroll behavior on the pill strip already handles narrow viewports — no new responsive work needed when adding the Lost gap.
- Phase 49's dark-mode categorical palette is already applied to every pill; no color work to do.
- Next.js `redirects()` in `next.config.js` is the standard pattern for route rename with back-compat.

### Established Patterns
- User-facing copy lives in JSX strings, not in an i18n dictionary (the `en.json` / `es.json` translation files are public-site-only — dashboard is English-only today per the `public-site-i18n` skill). So copy changes are inline edits; no translation key rename.
- Internal variable names do not have to match user-facing labels — the codebase already calls a "Booked" pill `booked` in `PIPELINE_STATUSES` (value) with label "Booked". Relabeling to "Scheduled" only touches the `label` field.
- Route files under `src/app/dashboard/` move by directory rename. Next.js App Router picks up the new path automatically once the file exists.
- Chatbot knowledge markdown files are read at build time — changes require a redeploy but no code change.

### Integration Points
- **Nav:** `DashboardSidebar.jsx` + `BottomTabBar.jsx` are the two user-visible nav surfaces that both need the label + href update.
- **Redirect:** `next.config.js` is the only infra file that registers the permanent 308.
- **Email templates:** `src/lib/notifications.js:319` constructs `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/leads` — update to `/jobs`. Legacy emails still work via the redirect.
- **Search index:** `src/app/api/search/route.js` has a static entry pointing at `/dashboard/leads` with a "Leads" display label — both fields update.
- **Setup checklist / dashboard tour:** `DashboardTour.jsx` references `/dashboard/leads` — step anchor needs the new URL.

### Blast Radius (22-file audit)
- 22 files contain `/dashboard/leads`. The planner should batch these into one "internal link audit" task rather than per-file tasks. A final `grep /dashboard/leads src/` should return zero hits at phase completion (the redirect-only reference in `next.config.js` is the one allowed mention).

</code_context>

<specifics>
## Specific Ideas

- The Completed pill's count badge is the owner's "who still owes me money" counter. Design intent: it should be glance-readable; if the count is >0, the pill visually signals "work to do." Phase 49's emerald/stone palette for Completed is fine as-is — no attention-grabbing red/amber upgrade needed. If a future phase wants to elevate unpaid-completed visibility further, that's its own decision.
- Lost pill visual gap: intent is "this is terminal-negative, not part of the live pipeline." A small `ml-2` is the minimum viable treatment. A thin vertical divider element (`<div className="w-px h-4 bg-border mx-1" />`) is also acceptable if it reads cleaner — pick whichever looks better in light + dark.
- The word "Scheduled" is preferred over "Booked" because home-service owners think of the calendar as the source of truth for scheduled work. "Booked" is a CRM verb; "Scheduled" is an operator verb.

</specifics>

<deferred>
## Deferred Ideas

- Adding `quoted` and `in_progress` as real DB status values (the RENAME-02 6-state example) — requires migration + voice-agent call-processor updates + LeadFlyout status dropdown expansion + notification copy updates. Belongs in a future milestone, not Phase 52.
- Repainting the pill palette for a warmer home-service theme — would invalidate Phase 49's categorical work and re-trigger a dark-mode audit. Out of scope.
- Adding a visual attention treatment on the Completed pill when its count is non-zero (e.g., subtle amber dot) to spotlight collections — valuable but not RENAME-02-required; log as a future UI polish item.
- Renaming the `leads` DB table, `/api/leads/*` API routes, or the `LeadCard`/`LeadFlyout`/`LeadStatusPills` component files — ROADMAP explicitly excludes this. Would be its own "backend rename" phase if ever justified.
- Dashboard-chatbot i18n for Spanish dashboard copy — dashboard is English-only today; i18n belongs to a separate initiative.

</deferred>

---

*Phase: 52-rename-leads-tab-to-jobs-and-restructure-status-pills-for-home-service-mental-model*
*Context gathered: 2026-04-16*

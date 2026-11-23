---
type: system
system: Dashboard and CRM
status: legacy-app
description: "Calls Page. Covers: 2026-06-10 UX wave"
source: .claude/skills/dashboard-crm-system/SKILL.md § 6. Calls Page
migrated: 2026-11-23
verified:
tags: [voco/system/dashboard-and-crm]
---

# Calls Page

Part of [[Dashboard and CRM]]. Migrated verbatim from the `dashboard-crm-system` skill; check `verified` before trusting details.

**File**: `src/app/dashboard/calls/page.js`

Since the 2026-06-10 Inquiries → Calls merge (reworked same-day after user
feedback) the page has **one default landing view — the classic calls
layout** — plus an opt-in **"Callbacks"** view:

- **Classic calls view (default)** — the pre-merge calls page **unchanged**:
  summary stat cards, search, filters, date-grouped expandable call cards.
  Renders immediately; it never waits on the inquiries fetch.
- **CallbacksStrip** — compact one-line nudge rendered ABOVE the stat cards,
  **only when open inquiries > 0** (hidden at 0 and while the count is still
  loading — it appears when the fetch resolves). Brand-accent tint
  (`border-[var(--brand-accent)]/25 bg-[var(--brand-accent)]/10
  text-[var(--brand-accent)]`, AiNumberBanner pattern — the token flips for
  dark mode), `min-h-[44px]`, PhoneIncoming icon, copy
  **"N caller(s) waiting for a callback"** + a "View →" affordance,
  `aria-label="N caller(s) waiting for a callback — view callbacks"`.
  Clicking switches to the Callbacks view.
- **Callbacks** — the open-inquiries work queue (see Section 5b), headed by
  a **"← All calls" back control** + `<h1>Callbacks</h1>`. `InquiryCard`
  list + `InquiryStatusPills` Open/Booked/Lost sub-pills (default `open`;
  `converted` displays "Booked") + `InquiryFlyout` (Convert-to-Job via
  QuickBookSheet, Mark-as-Lost with 5s sonner undo). Own Supabase channel
  **`inquiries-realtime`** (tenant-filtered; since 2026-06-12 INSERT triggers
  a refetch instead of prepending the join-less payload — no "Unknown" rows;
  UPDATE replaces the row — keeps list AND strip count live; status callback
  refetches on reconnect).
  Empty state: inline **"All caught up"** block (CheckCircle2 + "No callers
  waiting for a callback right now." + a link-style "View all calls"
  affordance) — kept for when the queue is empty but the user navigates
  here explicitly.

**View resolution (NO smart default — removed same-day)**: resolved
synchronously from the URL via `resolveViewParam()` —
`?view=callbacks` OR the **legacy alias `?view=needs-reply`** (old deep
links + the inquiries redirect) → Callbacks; **no param, `?view=all`, or
any unknown value → classic calls view**. There is no view-resolution
skeleton and no auto-landing on the queue. View switches
`router.replace('/dashboard/calls?view=…', { scroll: false })` (no history
push, no scroll reset), and a `searchParams` effect keeps `view` in sync
for back/forward + deep links (no-param resolves back to classic).

Calls table in Supabase Realtime publication (migration 041) with
`REPLICA IDENTITY FULL` so the page receives live INSERT/UPDATE events.

**Phase 58**: shared `<EmptyState icon={Phone} headline="No calls yet">`
wired to zero-data branch. Local helper renamed `CallsEmptyState` to
avoid shadowing the shared primitive. Filtered-empty branch keeps its
Clear-filters Button.

### 2026-06-10 UX wave

- **Transcript in expanded card** — `GET /api/calls` now selects
  `transcript_text` + `transcript_structured`; the expanded `CallCard`
  renders a collapsible `<TranscriptViewer transcriptStructured
  transcriptText>` below the `AudioPlayer`. `TranscriptViewer` degrades
  gracefully ("No transcript available for this call.") when both are null.
- **Search matches caller name OR phone** — placeholder is now "Search by
  name or phone...". `/api/calls` has no caller-name column, so it first
  does a tenant-scoped `customers` name lookup (`ilike` on `name`, capped at
  **50 rows**), then ORs the matched `phone_e164` values into the
  `from_number` filter (`from_number.ilike.%s% , from_number.in.(...)`);
  the term is escaped via `escapeOrTerm` + phones stripped of
  PostgREST-reserved chars.
- **Plain-language copy** — `EXCEPTION_LABEL` maps `exception_reason` to
  friendly text (`clarification_limit` → "The AI couldn't get enough
  details", `caller_requested` → "Caller asked to speak with a person",
  anything else → "Call ended unexpectedly" — no more raw
  `replace(/_/g,' ')`). Badge "Recovery SMS Sent" → **"We texted them
  back"**. Outcome `attempted` label "Attempted" → **"Reached out"** (badge
  + outcome filter `SelectItem`; the `not_attempted` label stays
  "No Booking").

---

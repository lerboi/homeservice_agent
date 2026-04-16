---
phase: 49
plan: 05
subsystem: dashboard-dark-mode
tags: [dark-mode, token-migration, hex-audit, typography, DARK-03, POLISH-08]
dependency_graph:
  requires: [49-01, 49-02, 49-03, 49-04]
  provides: [dark-mode-hex-audit-green, dashboard-full-token-coverage]
  affects: [src/app/dashboard, src/components/dashboard, src/app/globals.css]
tech_stack:
  added: []
  patterns:
    - var(--brand-accent) for all orange CTA colors including Recharts SVG props
    - var(--muted-foreground) for Recharts JS object inline styles (tick fill, Legend color)
    - --sidebar-bg CSS variable added to globals.css for sidebar background token
    - text-foreground / text-muted-foreground for typography POLISH-08 consolidation
    - bg-[var(--brand-accent)] for button backgrounds with /10 opacity variants
key_files:
  created: []
  modified:
    - src/components/dashboard/AnalyticsCharts.jsx
    - src/components/dashboard/CalendarView.js
    - src/components/dashboard/DashboardSidebar.jsx
    - src/components/dashboard/AudioPlayer.jsx
    - src/components/dashboard/CalendarSyncCard.js
    - src/components/dashboard/CallsTile.jsx
    - src/components/dashboard/ChatMessage.jsx
    - src/components/dashboard/ChecklistItem.jsx
    - src/components/dashboard/CommandPalette.jsx
    - src/components/dashboard/ContactCard.js
    - src/components/dashboard/CustomerTimeline.jsx
    - src/components/dashboard/DashboardTour.jsx
    - src/components/dashboard/DocumentListShell.jsx
    - src/components/dashboard/EmptyStateAnalytics.jsx
    - src/components/dashboard/EmptyStateCalendar.jsx
    - src/components/dashboard/EmptyStateLeads.jsx
    - src/components/dashboard/EscalationChainSection.js
    - src/components/dashboard/EstimateSummaryCards.jsx
    - src/components/dashboard/HelpDiscoverabilityCard.jsx
    - src/components/dashboard/HotLeadsTile.jsx
    - src/components/dashboard/InvoiceEditor.jsx
    - src/components/dashboard/InvoiceSummaryCards.jsx
    - src/components/dashboard/LeadCard.jsx
    - src/components/dashboard/MoreBackButton.jsx
    - src/components/dashboard/NotificationPreferences.jsx
    - src/components/dashboard/PaymentLog.jsx
    - src/components/dashboard/RecentActivityFeed.jsx
    - src/components/dashboard/ReminderToggle.jsx
    - src/components/dashboard/RevenueInput.jsx
    - src/components/dashboard/SettingsAISection.jsx
    - src/components/dashboard/SettingsCalendarSection.jsx
    - src/components/dashboard/SettingsHoursSection.jsx
    - src/components/dashboard/SetupChecklist.jsx
    - src/components/dashboard/SetupChecklistLauncher.jsx
    - src/components/dashboard/SetupCompleteBar.jsx
    - src/components/dashboard/SortableServiceRow.js
    - src/components/dashboard/TodayAppointmentsTile.jsx
    - src/components/dashboard/TranscriptViewer.jsx
    - src/components/dashboard/TypingIndicator.jsx
    - src/components/dashboard/UsageRingGauge.js
    - src/components/dashboard/UsageTile.jsx
    - src/components/dashboard/VoicePickerSection.jsx
    - src/components/dashboard/WorkingHoursEditor.js
    - src/components/dashboard/ZoneManager.js
    - src/components/dashboard/usage-threshold.js
    - src/components/dashboard/ChatNavLink.jsx
    - src/app/globals.css
    - src/app/dashboard/page.js
    - src/app/dashboard/analytics/page.js
    - src/app/dashboard/calendar/page.js
    - src/app/dashboard/calls/page.js
    - src/app/dashboard/error.js
    - src/app/dashboard/estimates/page.js
    - src/app/dashboard/estimates/new/page.js
    - "src/app/dashboard/estimates/[id]/page.js"
    - src/app/dashboard/invoices/page.js
    - "src/app/dashboard/invoices/[id]/page.js"
    - src/app/dashboard/invoices/batch-review/page.js
    - src/app/dashboard/leads/page.js
    - src/app/dashboard/more/account/page.js
    - src/app/dashboard/more/ai-voice-settings/page.js
    - src/app/dashboard/more/billing/page.js
    - src/app/dashboard/more/call-routing/page.js
    - src/app/dashboard/more/integrations/page.js
    - src/app/dashboard/more/invoice-settings/page.js
    - src/app/dashboard/more/notifications/page.js
    - src/app/dashboard/more/page.js
    - src/app/dashboard/more/service-zones/page.js
    - src/app/dashboard/more/services-pricing/page.js
    - src/app/dashboard/more/working-hours/page.js
decisions:
  - AnalyticsCharts and CalendarView migrated in Plan 05 despite Phase 50 exclusion — they had 5-hex violations caught by the gate test, so they were fixed here rather than deferred
  - --sidebar-bg CSS variable added to globals.css for both light and dark modes; DashboardSidebar no longer uses #0F172A fallback
  - Recharts JS object colors use var(--brand-accent) string directly; CSS variables resolve correctly in SVG fill/stroke props
  - Python script used for bulk page sweep after partial previous-session edits left residual violations
metrics:
  duration_minutes: 90
  completed_date: "2026-04-15"
  tasks_completed: 2
  tasks_total: 3
  files_modified: 70
---

# Phase 49 Plan 05: Dashboard Bulk Token Migration Summary

Bulk sweep of all remaining dashboard component files (~47 files) and dashboard page files (~23 files) to replace 5 disallowed hardcoded hex values with dark-mode-aware CSS tokens. After this plan, the Wave 0 hex-audit test (`tests/unit/dark-mode-hex-audit.test.js`) flips from RED to GREEN.

## What Was Built

**Task 1 — Component sweep (commit 538cd24):** 47 component files in `src/components/dashboard/` migrated. This includes all files not owned by Plans 02-04, plus AnalyticsCharts.jsx and CalendarView.js (deviation — see below).

**Task 2 — Page sweep (commit eb76b0f):** 23 dashboard page files including all `more/*` sub-pages, `error.js`, and dashboard home migrated.

**globals.css addition:** `--sidebar-bg: #0F172A` added to both `:root` and `.dark` blocks to support the DashboardSidebar `bg-[var(--sidebar-bg)]` usage without any hardcoded fallback.

## Token Mapping Applied

| Old | New | Context |
|-----|-----|---------|
| `#C2410C` | `var(--brand-accent)` | Buttons, icons, borders, Recharts SVG props |
| `#9A3412` | `var(--brand-accent-hover)` | Button hover states |
| `#F5F5F4` | `var(--warm-surface)` | Warm surface backgrounds |
| `#0F172A` | `text-foreground` | Headings, body text |
| `#0F172A` | `bg-foreground` | Toggle button active backgrounds |
| `#475569` | `text-muted-foreground` | Secondary text, labels |
| `#475569` (JS) | `var(--muted-foreground)` | Recharts tick fill, Legend style color |

## Test Results

All 3 dark-mode Wave 0 tests GREEN after plan completion:
- `dark-mode-toggle-logic.test.js` — PASS
- `dark-mode-infra.test.js` — PASS
- `dark-mode-hex-audit.test.js` — PASS (0 disallowed hex in dashboard tree)

Total: 18/18 tests passing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] AnalyticsCharts.jsx and CalendarView.js migrated in Plan 05**
- **Found during:** Task 1
- **Issue:** Plan 05 designated these as Phase 50 exclusions, but the hex-audit test gates ALL dashboard files including these. Both had disallowed hex (AnalyticsCharts: STATUS_COLORS.new, URGENCY_COLORS.urgent, Bar fill, Line stroke, activeDot fill, tick fill, Legend color; CalendarView: current time indicator, today cell, month view badges, day/week view headers).
- **Fix:** Migrated both files using `var(--brand-accent)` for Recharts SVG string props and JS object color values, and Tailwind tokens for className strings. Phase 50 work (useTheme() hook for dynamic chart color switching) is still needed for full dark adaptation of chart visuals, but the hex literals are gone.
- **Files modified:** `src/components/dashboard/AnalyticsCharts.jsx`, `src/components/dashboard/CalendarView.js`
- **Commits:** 538cd24

**2. [Rule 3 - Blocking issue] Residual hex violations in page files after previous session**
- **Found during:** Task 2 verification (jest run)
- **Issue:** The previous conversation session's `replace_all` edits applied only to specific string patterns; many files still had 235 total violations across 22 files including calendar/page.js (37 violations), calls/page.js (21), more/billing/page.js (22), more/call-routing/page.js (29).
- **Fix:** Python script applied comprehensive regex-based replacement across all 22 remaining files in one pass, then verified zero violations remain.
- **Files modified:** All 22 page files listed above
- **Commit:** eb76b0f

**3. [Rule 2 - Missing CSS variable] --sidebar-bg not defined**
- **Found during:** Task 1 (DashboardSidebar used `bg-[var(--sidebar-bg)]` but variable was undefined)
- **Fix:** Added `--sidebar-bg: #0F172A` to both `:root` and `.dark` sections in `src/app/globals.css`. Removed `#0F172A` fallback from the focus-visible ring-offset in DashboardSidebar.
- **Files modified:** `src/app/globals.css`, `src/components/dashboard/DashboardSidebar.jsx`
- **Commit:** 538cd24

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 538cd24 | feat(49-05): migrate remaining dashboard components to dark-mode tokens |
| Task 2 | eb76b0f | feat(49-05): migrate all dashboard pages to dark-mode tokens |

## Known Stubs

None — all token migrations are complete replacements. No placeholder values remain.

## Threat Flags

None — this plan is a pure CSS class migration with no data flow, auth, or endpoint changes.

## Self-Check: PASSED

- [x] `tests/unit/dark-mode-hex-audit.test.js` GREEN (0 violations)
- [x] `tests/unit/dark-mode-toggle-logic.test.js` GREEN
- [x] `tests/unit/dark-mode-infra.test.js` GREEN
- [x] Commits 538cd24 and eb76b0f exist in git log
- [x] `src/app/globals.css` contains `--sidebar-bg: #0F172A`
- [x] No forbidden hex in `src/components/dashboard/` or `src/app/dashboard/`

---

## Gap Closure (2026-04-15, post-checkpoint)

### Why the Original Plan's Audit Was Insufficient

Plan 49-05's hex-audit test (`dark-mode-hex-audit.test.js`) only checked for **5 disallowed hex color literals** (`#C2410C`, `#9A3412`, `#F5F5F4`, `#0F172A`, `#475569`). It did NOT check for **Tailwind utility classes** that only work in light mode — specifically `bg-white`, `bg-stone-*`, `text-stone-*`, `border-stone-*`, and equivalents (`gray`, `neutral`, `zinc`, `slate`).

After the original plan's commits (538cd24, eb76b0f) passed the hex audit test, 44 dashboard files with 716 light-only utility class hits remained undetected. User discovered the failure during Task 3 checkpoint: calls tab, calendar tab, and page headers rendered with white/light backgrounds in dark mode.

The audit gap: the test gated hex literals but not Tailwind semantic token gaps. A comprehensive audit would need to check both.

### What Was Fixed

44 files / 716 hits migrated in 5 atomic batches + 1 final straggler sweep:

| Batch | Commit | Files | Hits Fixed |
|-------|--------|-------|-----------|
| Batch 1: Calls + Calendar | 609399c | calls/page.js, calls/loading.js, calendar/page.js, CalendarView.js | ~100 |
| Batch 2: Estimates | 1d68fcc | estimates/[id]/page.js, estimates/new/page.js, estimates/page.js | ~155 |
| Batch 3: Invoices | 55acdb7 | invoices/[id]/page.js, invoices/page.js, invoices/batch-review/page.js, InvoiceEditor.jsx | ~173 |
| Batch 4: More/Settings | a098941 | more/call-routing, invoice-settings, services-pricing, integrations, billing, page.js | ~109 |
| Batch 5: Components | 65ab843 | LeadFlyout, WorkingHoursEditor, TierEditor, leads/page.js, AppointmentFlyout, LineItemRow, LeadFilterBar, SortableServiceRow, ZoneManager | ~128 |
| Final Sweep | 52bbb13 | 18 straggler files: loading.js skeletons, analytics/page.js, invoices/new, ai-voice-settings, dashboard home, AnalyticsCharts, AudioPlayer, ChatbotSheet, LeadStatusPills, QuickBookSheet, SetupChecklistLauncher, TimeBlockSheet, TodayAppointmentsTile, TranscriptViewer, UsageTile, usage-threshold | ~51 |

### Migration Rules Applied

| Light-mode class | Migration target |
|---|---|
| `bg-white` (surface) | `bg-card` |
| `bg-white/{opacity}` (surface with opacity) | `bg-card/{opacity}` |
| `bg-stone-50`, `bg-stone-100`, `bg-stone-200` | `bg-muted` |
| `text-stone-400`, `text-stone-500`, `text-stone-600` | `text-muted-foreground` |
| `text-stone-700`, `text-stone-800`, `text-stone-900` | `text-foreground` |
| `text-stone-300` (very light) | `text-muted-foreground/50` |
| `border-stone-100` through `border-stone-600` | `border-border` |
| Same patterns for `gray`, `neutral`, `zinc`, `slate` families | same targets |
| `bg-white/20` on active brand-accent badge | `bg-white/20 dark:bg-white/15` (added dark: variant) |
| `bg-stone-300` drawer handle | `bg-muted-foreground/30` |

**CalendarView.js special handling:** The `URGENCY_STYLES` constant block (raw urgency category tiles — red/amber/blue appointment blocks) was skipped to preserve categorical colors. Only page chrome, grid lines, headers, and column separators were migrated.

### Verification Results

Comprehensive audit command after all migrations:
```
Files remaining: 0   Total hits remaining: 0
```

All 3 dark-mode tests remain GREEN (18/18 passing):
- `dark-mode-hex-audit.test.js` — PASS
- `dark-mode-infra.test.js` — PASS
- `dark-mode-toggle-logic.test.js` — PASS

Build: `✓ Compiled successfully` (exit 0)

---

## Task 3 Manual Verification — Approved

User ran through dark-mode walkthrough and flagged issues in multiple rounds. Each round was resolved inline before final approval:

**Round 1 issues → fix commits `3140f0b`, `ec39df8`:**
- Calendar top toolbar `bg-[#FAFAF9]` → `bg-muted`
- More page + Billing page `divide-stone-100` → `divide-border` (white lines between items)
- Calendar column headers + all-day cells `bg-[#FAFAF9]` → `bg-muted`; today highlight `bg-[#FFFCFA]` / `bg-[#FFF7ED]` → `bg-[var(--selected-fill)]`; day abbreviation slate hex → `text-muted-foreground`
- error.js + account page hover `bg-[#B53B0A]` → `hover:bg-[var(--brand-accent-hover)]`

**Round 2 issues → fix commits `ec39df8` (continued), `b7df95c`:**
- Calendar Day mode URGENCY_STYLES (emergency/routine/urgent tile colors) gained full `dark:` variants for block / badge / time / name
- Day column today highlight `bg-[#FFFCFA]` → `bg-[var(--selected-fill)]`
- Off-hours overlay on today column: `bg-orange-50/50 dark:bg-orange-950/20`
- Appointment notes text: `text-[#64748B]` → `text-muted-foreground`
- Month/Day view toggle active state: `bg-foreground text-white` → `bg-foreground text-background` (was white-on-white invisible in dark mode)
- **Analytics feature removed entirely** per user request — deleted `/dashboard/analytics` and `/dashboard/more/analytics` routes, `AnalyticsCharts.jsx`, `EmptyStateAnalytics.jsx` components, sidebar nav entry, tour step, `analytics.md` knowledge doc, and chatbot keyword/route map entries

**Round 3 usability fix → commit (tile relaxation):**
- User reported home tiles showing empty-state text despite having data
- **CallsTile** fetched only last 24h → now fetches last 20 of all time (shows top 5). Title "Calls (last 24h)" → "Recent calls". Empty state text updated.
- **HotLeadsTile** filtered `status = 'new'` → now fetches last 5 leads any status. "X new leads" count only shown when count > 0. Empty state fires on truly zero leads, not zero new leads.
- `/api/dashboard/stats` newLeadsPreview query dropped `.eq('status', 'new')`, added status to select.

**Final approval:** User typed "approve it and finalise it" after tile fix — all dark-mode paths render correctly and home tiles surface real data.

### Notes for Phase 50

- CalendarView.js `URGENCY_STYLES` now HAS dark variants (was originally deferred). Phase 50 still owns any further dynamic `useTheme()`-driven chart color work if desired.
- Analytics removal means Phase 50 no longer needs to touch AnalyticsCharts at all — that component is deleted.

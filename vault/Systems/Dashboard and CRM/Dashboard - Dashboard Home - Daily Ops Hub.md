---
type: system
system: Dashboard and CRM
status: legacy-app
description: "Dashboard Home - Daily Ops Hub. Covers: 3a. CallReadinessCard (2026-06-21 onboarding revamp); AiNumberBanner (2026-06-13 onboarding-audit fix wave); Tile behavior (2026-06-10 UX wave); RecentActivityFeed (2026-06-10 rewrite)"
source: .claude/skills/dashboard-crm-system/SKILL.md § 3. Dashboard Home — Daily Ops Hub
migrated: 2026-11-23
verified:
tags: [voco/system/dashboard-and-crm]
---

# Dashboard Home - Daily Ops Hub

Part of [[Dashboard and CRM]]. Migrated verbatim from the `dashboard-crm-system` skill; check `verified` before trusting details.

**File**: `src/app/dashboard/page.js`

Post-Phase-48 single-column daily ops hub. No setup/active mode branching
(setup lives in overlay launcher).

Structure:
```
Greeting (time-of-day + AI status pulse + optional tour button)
CallReadinessCard (onboarding progress indicator — see §3a; hides when set up)
AiNumberBanner (AI number + copy button / provisioning-failed alert)
DailyOpsHub (bento: TodayAppointmentsTile, CallsTile, HotJobsTile, UsageTile)
MoneySnapshot (invoice money strip — gated by invoicing flag)
HelpDiscoverabilityCard (4 quick-link tiles)
RecentActivityFeed (wrapped in card.base)
```

### 3a. CallReadinessCard (2026-06-21 onboarding revamp)

**File**: `src/components/dashboard/CallReadinessCard.jsx` — the prominent
home-page onboarding indicator. Answers "how close is my AI to fully taking and
booking calls?" and points at the single next action. Tracks **ESSENTIAL**
checklist items only (the call-readiness meter); recommended/optional steps live
in the full checklist behind "View all steps".

- Reads `/api/setup-checklist` (shared SWR key — no extra request) and the new
  `readiness` block (`essentialsTotal`, `essentialsComplete`, `callReady`); also
  recomputes essentials from the live `items` so an optimistic mark-done moves the
  meter instantly.
- **Not call-ready** → segmented essentials bar + "Next step" (the first
  incomplete essential) as a primary deep-link, plus a "View all setup steps"
  button that dispatches the `open-setup-checklist` window event (the launcher
  Sheet listens for it).
- **Call-ready** → calm success state ("You're call-ready"), an optional
  "N steps to go further" link (opens the Sheet), and a dismiss X. Dismissal is
  stored in `localStorage['voco_readiness_dismissed']`, read via
  `useSyncExternalStore` (project bans setState-in-effect); it only suppresses the
  success state — if an essential later lapses (e.g. billing), the not-ready card
  returns on its own.
- The live AI line status (active/paused) stays in the greeting row; this card is
  purely about setup completeness, so the two signals don't compete.
- Carries `data-tour="call-readiness"` for the guided-tour step (§2).

### AiNumberBanner (2026-06-13 onboarding-audit fix wave)

**File**: `src/components/dashboard/AiNumberBanner.jsx` — fetches `/api/account`
(which now returns `provisioning_failed`). Three states:
- **Number assigned** — Link card to `/dashboard/more/account` with the
  formatted number, forwarding nudge, and a **copy-to-clipboard button**
  (`e.preventDefault()` so the click doesn't navigate; Check icon for 2s).
- **No number + `provisioning_failed=true`** — amber `role="alert"` card:
  "We hit a snag assigning your AI number… team has been notified", support
  link. Previously a paying customer with failed provisioning saw NOTHING.
- **No number, not failed** — renders null (account page carries the
  "being assigned" copy, which now also has a failed-state variant and a
  support link instead of the old indefinite "within a minute" promise).

### Tile behavior (2026-06-10 UX wave)

- **TodayAppointmentsTile** — "View full schedule" CTA now links to
  `/dashboard/calendar` (was the dead `/dashboard/appointments` route).
  Each appointment row is a tappable `<Link href="/dashboard/calendar">`
  (`min-h-[44px]`, hover `bg-muted/50`, `focus.ring`).
- **CallsTile** — last 5 calls (no 24h window, Phase 49). The missed-calls
  block no longer leaks the raw `not_attempted` enum: copy is now
  `"needs callback"` / `"need callback"`. Missed + recent rows are tappable
  `<Link href="/dashboard/calls">` (`min-h-[44px]`). Outcome/Missed badges
  gained dark-mode variants (`dark:border-*-800/60 dark:bg-*-950/40
  dark:text-*-300`).
- **HotJobsTile** — retitled **"Needs follow-up"** (see Section 5; it shows
  open inquiries, not scheduled jobs).
- **MoneySnapshot** — local component in `page.js`. Compact `card.base` strip:
  **Outstanding · Overdue · Paid this month** (`invoiceOutstandingAmount`,
  `invoiceOverdueAmount` — red when > 0, `paidThisMonth` — emerald), wrapped
  in a single `<Link href="/dashboard/invoices">`. **Gated by the `invoicing`
  feature flag** (renders `null` when off or stats unloaded) and reads the
  shared `/api/dashboard/stats` SWR key — no extra request.

### RecentActivityFeed (2026-06-10 rewrite)

**File**: `src/components/dashboard/RecentActivityFeed.jsx`

- `EVENT_CONFIG` now covers **all 16 values of the `activity_event_type`
  strict enum** (migration 061): `call_received`, `inquiry_opened/converted/lost`,
  `job_booked/completed/paid/cancelled`, `customer_created/updated/merged/unmerged`,
  `invoice_created/paid/voided`, `other`. **Labels mirror
  `CustomerActivityTimeline.jsx`** so both surfaces speak the same language;
  icon tones come from a shared `TONES` map (accent/blue/emerald/amber/red/muted,
  all with dark variants).
- Each row shows the **caller/customer name from `metadata`**
  (`caller_name || customer_name || name`), joined with
  `metadata.job_type || metadata.invoice_number` as a `— detail` suffix.
- Rows are **deep links by event family** (`getHref`): `call_received` →
  `/dashboard/calls`, `inquiry_*` → `/dashboard/calls?view=callbacks`
  (Inquiries → Calls merge), `job_*` →
  `/dashboard/jobs`, `customer_*` → `/dashboard/customers/<customer_id>`
  (only when the row carries `customer_id`), `invoice_*` →
  `/dashboard/invoices` **gated on the `invoicing` flag** (unlinked when
  off). Rows without a resolvable href render as plain (non-link) items.
  Linked rows are `min-h-[44px]` with hover + `focus.ring`.

No sidebar, no grid. Responsive for free — children stack vertically.

---

---
type: system
system: Dashboard and CRM
status: legacy-app
description: "Onboarding revamp (2026-06-21): the checklist is organized by call-readiness Covers: Launcher; Accordion; Leaf — ChecklistItem (3-tier badge + Phase 58 red-dot); API — setup-checklist"
source: .claude/skills/dashboard-crm-system/SKILL.md § 4. Setup Checklist — Tiered Accordion + Overlay Launcher (Phase 48 → 2026-06-21 retier)
migrated: 2026-11-23
verified:
tags: [voco/system/dashboard-and-crm]
---

# Setup Checklist - Tiered Accordion + Overlay Launcher (Phase 48 to 2026-06-21 retier)

Part of [[Dashboard and CRM]]. Migrated verbatim from the `dashboard-crm-system` skill; check `verified` before trusting details.

**Onboarding revamp (2026-06-21)**: the checklist is organized by **call-readiness
TIER**, not by settings theme. Three tiers (single source of truth = `TIER_GROUPS`
/ `TIER_ORDER` in the API route):

| Tier | Items | Meaning |
|------|-------|---------|
| **essential** | `setup_profile`, `configure_services`, `configure_hours`, `configure_zones` (Service Area), `setup_billing` | Gate "can my AI take and book calls properly?" — drive the CallReadinessCard meter |
| **recommended** | `connect_calendar`, `configure_call_routing`, `configure_notifications`, `setup_escalation`, `make_test_call` | Improve handling; AI still works on defaults |
| **optional** | `connect_xero`, `connect_jobber` | Integrations / power features |

`required` is derived per item as `tier === 'essential'` (back-compat with the
leaf's dismiss/CTA logic). `THEME_GROUPS`/`THEME_ORDER` are still **exported** (and
each item still carries a `theme`) for back-compat + the Phase-55 test asserting
`connect_xero` lives under the `voice` theme — but the UI no longer groups by theme.
`configure_zones` meta is now "Set up your service area" (the Service Area feature;
still detected by `service_zones` count > 0).

### Launcher

**File**: `src/components/dashboard/SetupChecklistLauncher.jsx`

- **No auto-open** (changed 2026-06-21): the always-visible CallReadinessCard is the
  surfaced guide now, so popping a Sheet on top of it (and, for new users, the tour)
  was redundant. The `voco_setup_opened` session gate is gone.
- **Opens on demand**: FAB click OR the `open-setup-checklist` window event (fired by
  the readiness card's "View all steps" / "go further" links).
- **FAB** (circular copper, `var(--brand-accent)`): conic-gradient overall-progress
  ring; center count = **essentials remaining** (falls back to total remaining once
  essentials are done). `aria-label` includes "…finish setup". Min 44px tap target,
  `bottom-[72px]` on mobile to clear the BottomTabBar.
- **Complete state**: FAB hides entirely when `percent >= 100`.
- **Hidden during impersonation**: layout skips mount on `?impersonate=...`.

### Accordion

**File**: `src/components/dashboard/SetupChecklist.jsx`

Tier accordion in `TIER_ORDER` order: **Essential → Recommended → Optional**
(`TIER_LABELS` + per-tier sublabels). The header conic-gradient ring shows
**essentials** progress (`essentialsComplete/essentialsTotal`), titled "Get
call-ready" / "You're call-ready"; once essentials are done (but extras remain) a
call-ready note renders above the accordions. Default-open tier = the first with an
incomplete item. `SetupCompleteBar` still shows when ALL items complete. Per-item
actions: Dismiss / Mark done / Jump. Window-focus refetch. Essentials are computed
from the live (optimistically-mutated) item list so the meter reacts before the
server round-trip.

**Phase 58 contract comment** above `{tierItems.map(...)}` names `has_error`,
`error_subtitle`, and "red-dot" as Phase 58 CHECKLIST-01 forwarding fields —
grep-anchored regression guard.

### Leaf — ChecklistItem (3-tier badge + Phase 58 red-dot)

**File**: `src/components/dashboard/ChecklistItem.jsx`

Badge is 3-tier from `item.tier` (fallback `required ? 'essential' :
'recommended'`): **Essential** (accent), **Recommended** (muted fill), **Optional**
(outline). `isEssential = tier === 'essential'` drives dismiss + CTA:
- Only NON-essential items can be dismissed (`canDismiss = !isEssential`).
- CTA precedence: `has_error` → **Reconnect** (red-dot variant) → non-essential →
  **Open settings** → essential-in-progress → **Continue** → else **Finish setup**.

Completion icon variants (first match wins): **Error (red-dot)**
`<span className="h-2 w-2 rounded-full bg-red-600 dark:bg-red-500" />` +
"Reconnect needed" subtitle; **Complete** `<CheckCircle2>`; **Idle** `<Circle>`.

### API — setup-checklist

**File**: `src/app/api/setup-checklist/route.js`

- Exports `TIER_GROUPS`, `TIER_ORDER` (+ legacy `THEME_GROUPS`, `VALID_ITEM_IDS`,
  `deriveChecklistItems`). `deriveChecklistItems` tags each item with `tier` +
  `theme`, sets `required = tier === 'essential'`, and orders items by tier.
- GET adds a **`readiness`** block: `{ essentialsTotal, essentialsComplete,
  callReady }` (callReady = all essentials complete) alongside the existing
  `progress` + `completedCount`. Consumed by CallReadinessCard + the FAB.
- `fetchChecklistState` issues **4** `accounting_credentials` count queries per
  provider pair (Phase 58): Healthy `.is('error_state', null)` / Error
  `.not('error_state', 'is', null)`. Separate counts let auto-complete +
  `has_error` derive from independent row sets.
- `deriveChecklistItems` emits `has_error` + `error_subtitle` UNIFORMLY on every
  item so the leaf never guards undefined.
- Phase 50 migration added `tenants.checklist_overrides` JSONB; API consumes for
  per-item `mark_done` + `dismiss` actions.
- `make_test_call` auto-completes from `tenants.test_call_completed` (migration
  002) — set only when a test call genuinely connects, via the LiveKit
  `participant_joined` webhook `/api/webhooks/livekit` (2026-06-21 test-call
  verification; migration 077 adds `test_call_status`/`test_call_last_at`). It no
  longer keys off `onboarding_complete`. Owners can still "Mark done" manually if
  the LiveKit webhook isn't registered.

See `integrations-jobber-xero/references/dashboard-ui.md` for the full
Reconnect-flow interaction.

---

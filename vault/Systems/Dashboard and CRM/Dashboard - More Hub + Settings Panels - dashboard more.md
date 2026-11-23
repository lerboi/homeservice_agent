---
type: system
system: Dashboard and CRM
status: legacy-app
description: "The flat 11-item MORE_ITEMS list was regrouped into THREE labeled Covers: More hub page (`/dashboard/more/page.js`) — three-section regroup (prod-readiness 2026-06); Settings route quick list; Quick access (mobile-only on `/more` hub)"
source: ".claude/skills/dashboard-crm-system/SKILL.md § 14. More Hub + Settings Panels — /dashboard/more/*"
migrated: 2026-11-23
verified:
tags: [voco/system/dashboard-and-crm]
---

# More Hub + Settings Panels - dashboard more

Part of [[Dashboard and CRM]]. Migrated verbatim from the `dashboard-crm-system` skill; check `verified` before trusting details.

### More hub page (`/dashboard/more/page.js`) — three-section regroup (prod-readiness 2026-06)

The flat 11-item `MORE_ITEMS` list was regrouped into THREE labeled
sections (`MORE_SECTIONS`). **Presentational only — every route is preserved
1:1.** Each section renders a `card.base` group with a uppercase
section-label heading. Empty sections are dropped after flag filtering.

| Section | Items (in order) |
|---------|------------------|
| **Business** | Services & Pricing, Working Hours, Service Area, Account, **Customers** (`/dashboard/customers`), **Calendar** (`/dashboard/calendar`) |
| **AI & Calls** | AI & Voice Settings, Call Routing, Notifications & Escalation, Features |
| **Billing & Money** | Billing, Invoice Settings, Integrations |

- **Customers + Calendar** were added to **Business** for **mobile
  parity** when neither had a `BottomTabBar` slot. Since the 2026-06-10
  Inquiries → Calls merge, **Calendar has a tab again** (it took the freed
  Inquiries slot), so its Business entry is now a redundant-but-harmless
  second path; Customers still has no tab, so the More hub remains the only
  mobile path to it. Both appear in the desktop sidebar.
- **`invoicing` flag gating is intact**: `Invoice Settings` is filtered out
  of Billing & Money when `invoicing=false`; the mobile quick-access
  `Invoices`/`Estimates` block is likewise hidden. A section that ends up
  empty after filtering is not rendered.

### Settings route quick list

- `/more/services-pricing` — full service table (DnD, urgency tags,
  bulk select).
- `/more/working-hours` — `WorkingHoursEditor`.
- `/more/service-zones` — `ServiceAreaManager` (single **"Service Area"**
  editor — page heading was "Service Zones & Travel"). Postal/ZIP-code chip
  input + town/city chip input (comma/Enter to add), an **out-of-area action**
  select — `callback` (default: take a message & call back, don't book) /
  `decline_referral` (politely decline + optional referral) / `trip_fee` (book
  but mention a possible travel fee) — with a conditional referral-note textarea
  shown only for `decline_referral`, and an explicit dirty-tracked **"Save
  service area"** button. Backed by `GET/PUT /api/service-area`. Persists the
  owner choice to `tenants.out_of_area_action` + `tenants.out_of_area_referral_note`
  (migration 074); coverage persists to `service_zones` (`postal_codes` + new
  `cities[]`), collapsed to one canonical row on save. **Replaced the removed
  multi-zone `ZoneManager` (`zone_travel_buffers` pairwise-buffer matrix) +
  `/api/zones` (+`[id]`) routes (M16 P1, 2026-06-20).**
- `/more/escalation-contacts` — `EscalationChainSection`.
- `/more/notifications` — per-outcome SMS/email Switch grid
  (booked/declined/not_attempted/attempted × SMS/email).
- `/more/ai-voice-settings` — `SettingsAISection` (phone number + test call)
  + `VoicePickerSection` — 3 voice labels (`professional`/`friendly`/
  `local_expert`, 2026-06-12) with display names; stored value IS the label
  (validated by `VALID_VOICES` in `src/lib/ai-voice-validation.js`, CHECK in
  migration 070); preview files `/audio/voices/{label}.mp3` (assets pending).
- `/more/features` — feature-flag toggles (Phase 53).
- `/more/billing` — plan card, usage ring gauge, invoices. Phase 58
  `ErrorState onRetry={refetchBilling}` (mutates both SWR caches).
- `/more/invoice-settings` — business identity, tax, late fees, defaults,
  numbering. **Gated by `invoicing` flag.**
- `/more/integrations` — Business Integrations (see Section 9).
- `/more/call-routing` — schedule, pickup numbers, **Priority Callers**
  unified list merging `tenants.vip_numbers` (standalone) +
  `leads.is_vip=true` (lead-based). Brand "Priority"; DB keeps "vip".
  See `voice-call-architecture` skill for webhook-side routing.
- `/more/account` — profile editor, account details, sign out.

### Quick access (mobile-only on `/more` hub)

`Ask Voco AI` button (fires `window.dispatchEvent(new Event('open-voco-chat'))`)
+ `Invoices` / `Estimates` quick-access links (desktop sidebar entries
but not mobile bottom-bar tabs). Hidden entirely when `invoicing=false`.

---

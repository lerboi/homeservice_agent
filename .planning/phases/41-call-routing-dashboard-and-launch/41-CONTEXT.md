# Phase 41: Call Routing Dashboard and Launch - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship the user-facing surface for the call routing feature — a new dedicated dashboard settings page where tenants configure their per-day schedule, manage pickup numbers, adjust dial timeout, toggle SMS forwarding per number, and see their monthly outbound minute usage. Also surface owner-pickup calls in the existing dashboard calls page with routing mode badges, so owners have a single view of all call activity regardless of routing path.

**Not in scope:** Changes to webhook logic (Phase 40), schedule evaluator (Phase 39), Twilio number configuration (Phase 40), recurring appointments (Phase 43).

</domain>

<decisions>
## Implementation Decisions

### Schedule Editor Layout

- **D-01:** Vertical day list (Mon–Sun) with per-day enable toggle + start/end time pickers. Disabled days show muted "AI all day" label. Matches the existing working-hours page pattern in the codebase.
- **D-02:** Master ON/OFF toggle at top of the schedule section maps directly to `call_forwarding_schedule.enabled`. When OFF, all day rows are disabled/muted and the explanation reads "AI answers all calls."
- **D-03:** "Copy from working hours" quick-start button at the top of the schedule section. One tap pre-fills all day rows from the tenant's existing `working_hours` column. User can then tweak individual days. Dramatically reduces first-time setup friction for the typical case where routing hours match working hours.
- **D-04:** One time range per day in the UI (schema allows multi-range but dashboard writes single range). Times in tenant-local HH:MM 24h format per Phase 39 D-05.

### Page Structure

- **D-05:** Single scrolling page at `/dashboard/more/call-routing` with clear section cards. No tabs. Four sections in order: (1) master toggle + schedule editor with dial timeout slider, (2) pickup numbers, (3) usage meter, (4) any explanatory notes.
- **D-06:** Dial timeout slider (10-30s, default 15s) lives inside the schedule section — contextually tied to "how long to ring before AI picks up."
- **D-07:** Page added to the More page (`MORE_ITEMS` array) with a phone/routing icon and the call routing link. AI Voice Settings page links to the Call Routing page.

### Pickup Number Management

- **D-08:** Inline card list. Each pickup number rendered as a card row showing: formatted phone number, label text, SMS forward toggle, edit/delete action icons.
- **D-09:** "Add pickup number" button at bottom opens an inline form (not modal/sheet) — phone input (E.164 validated), label text field, SMS forward checkbox. Three fields don't warrant a full sheet.
- **D-10:** Section header shows "Pickup Numbers (2 of 5)" counter so the contractor has instant awareness of the 5-entry limit.
- **D-11:** Validation per Phase 41 success criterion #7: submitting zero pickup numbers while schedule is enabled shows a blocking warning "Add at least one pickup number to route calls to you." Also validates: E.164 format, no duplicates, no self-reference to the Twilio number.

### Usage Meter

- **D-12:** Compact horizontal progress bar with text: "42 of 5,000 minutes used this month." Minimal vertical space — usage is supplementary info, not the star of the page.
- **D-13:** Color shifts as usage grows: green (<70%), amber (70-90%), red (>90%). Universal affordance.
- **D-14:** Cap value is shown (US/CA = 5,000 min, SG = 2,500 min based on `tenants.country`). Hiding the cap creates anxiety.
- **D-15:** Data source: `SUM(outbound_dial_duration_sec)` from `calls` table for the current calendar month, converted from seconds to minutes. Same query as `check_outbound_cap` in the Python webhook (Phase 39 D-17).

### Routing Mode Badges on Calls Page

- **D-16:** Three-badge system on call card rows:
  - `routing_mode = 'ai'` → **"AI"** badge, stone/muted color. Default/most common — should not be visually noisy.
  - `routing_mode = 'owner_pickup'` → **"You answered"** badge, blue. Distinct color so contractors can spot their own calls instantly.
  - `routing_mode = 'fallback_to_ai'` → **"Missed → AI"** badge, amber. Communicates "you didn't pick up, AI handled it" — actionable info.
  - `routing_mode = NULL` (legacy/pre-cutover) → No badge shown. No retroactive labeling.
- **D-17:** Owner-pickup call cards show caller phone number and duration but gracefully hide AI-specific expanded details (urgency, booking outcome, recording, language). Replace with a simple note: "You handled this call directly." Call Back action still available.
- **D-18:** Owner-pickup calls appear in the same list as AI calls (no separate tab/filter). The routing badge provides sufficient visual differentiation.

### API Routes

- **D-19:** `GET /api/call-routing` returns the tenant's `call_forwarding_schedule`, `pickup_numbers`, `dial_timeout_seconds`, plus the current month's outbound minutes usage (computed from `calls` table).
- **D-20:** `PUT /api/call-routing` validates and updates `call_forwarding_schedule`, `pickup_numbers`, `dial_timeout_seconds` on the `tenants` row. Validation: E.164 phone numbers, no duplicates, no self-reference to tenant's Twilio number, max 5 entries, valid time ranges (HH:MM format, start != end), dial_timeout 10-30.

### Onboarding Setup Checklist

- **D-21:** Optional "Configure call routing" step added to the setup checklist (after existing items). Links to `/dashboard/more/call-routing`. Marked complete when `call_forwarding_schedule.enabled` is true AND `pickup_numbers` has at least one entry. Users can skip it and configure later.

### Claude's Discretion

- Exact time picker component choice (native HTML time input vs custom component)
- Whether the "Copy from working hours" button appears only when schedule is empty or always
- Exact animation/transition patterns on the page (framer-motion patterns from existing pages)
- Whether the usage meter section is collapsible or always visible
- Test organization for new API route tests
- Whether the calls page filters get a new "Routing" filter dropdown or if badges are display-only

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 39 & 40 Context (Call Routing Foundation)
- `.planning/phases/39-call-routing-webhook-foundation/39-CONTEXT.md` — All Phase 39 decisions (D-01 through D-20). Defines schedule JSONB shape, pickup_numbers shape, evaluator contract, migration schema.
- `.planning/phases/40-call-routing-provisioning-cutover/40-CONTEXT.md` — All Phase 40 decisions (D-01 through D-23). Defines routing behavior, fallback logic, owner-pickup call lifecycle, SMS forwarding.

### Database Schema
- `supabase/migrations/042_call_routing_schema.sql` — Phase 39 migration adding `call_forwarding_schedule`, `pickup_numbers`, `dial_timeout_seconds` to tenants and `routing_mode`, `outbound_dial_duration_sec` to calls.

### Dashboard Patterns
- `src/app/dashboard/more/page.js` — More page with `MORE_ITEMS` array. Phase 41 adds call-routing entry here.
- `src/app/dashboard/more/working-hours/page.js` — Working hours settings page. Schedule editor follows this layout pattern.
- `src/app/dashboard/calls/page.js` — Calls page with `CallCard` component, `URGENCY_STYLE`/`OUTCOME_STYLE` maps, date grouping, Supabase Realtime subscription. Phase 41 adds routing mode badge here.
- `src/app/dashboard/more/ai-voice-settings/page.js` — AI Voice Settings page. Phase 41 adds a link to the call routing page here.

### Setup Checklist
- `src/app/api/setup-checklist/route.js` — Setup checklist API with `deriveChecklistItems()`. Phase 41 adds optional call routing step.
- `src/components/dashboard/SetupChecklist.jsx` — Setup checklist UI component.

### Existing Components
- `src/components/ui/badge.jsx` — Badge component used for urgency/outcome badges on calls page. Routing mode badges use same component.
- `src/lib/design-tokens.js` — `card` design tokens used across all dashboard pages.
- `src/components/dashboard/AudioPlayer.jsx` — Audio player in call cards (not shown for owner-pickup calls).

### Roadmap
- `.planning/ROADMAP.md` §Phase 41 (line 488) — Goal, success criteria, requirements ROUTE-13 through ROUTE-18.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`card` design tokens** from `src/lib/design-tokens.js` — consistent card styling across all dashboard pages
- **`Badge` component** from `src/components/ui/badge.jsx` — used for urgency/outcome badges, reuse for routing mode
- **`Select`, `Input`, `Button`, `Skeleton`** from `src/components/ui/` — standard form components
- **`WorkingHoursEditor`** component — schedule editor layout reference (day list with toggles pattern)
- **`supabase` browser client** from `src/lib/supabase-browser` — used for Realtime subscriptions in calls page
- **`formatPhone`, `formatDuration`, `formatTime`** helpers in calls page — reuse for owner-pickup call display

### Established Patterns
- **Settings pages** — `'use client'` page wrapping a card with heading + description + editor component (working-hours, service-zones, notifications all follow this)
- **API routes** — `createSupabaseServer()` for auth check, `supabase` (service role) for data operations, standard 401/404 error responses
- **Calls page** — `URGENCY_STYLE` / `OUTCOME_STYLE` map pattern for badge styling. Add `ROUTING_STYLE` map for routing badges.
- **Supabase Realtime** — calls page subscribes to INSERT/UPDATE on `calls` table filtered by `tenant_id`. Owner-pickup calls inserted by webhook will appear via this subscription.
- **More page** — `MORE_ITEMS` array of `{href, label, description, icon}` objects for settings links

### Integration Points
- **`MORE_ITEMS` in `src/app/dashboard/more/page.js`** — add call-routing entry
- **`CallCard` component in `src/app/dashboard/calls/page.js`** — add routing mode badge + owner-pickup card variant
- **`deriveChecklistItems` in `src/app/api/setup-checklist/route.js`** — add optional call routing step
- **New route directory** `src/app/dashboard/more/call-routing/page.js` — new settings page
- **New API routes** `src/app/api/call-routing/route.js` — GET + PUT handlers

</code_context>

<specifics>
## Specific Ideas

- **"Copy from working hours" is the killer UX feature** — most contractors want routing hours = working hours. One tap pre-fills, then tweak. Reduces 14 taps to 1.
- **Owner-pickup cards should feel intentionally lighter** — they're "you handled this" confirmations, not AI analysis reports. The contractor already knows what happened on their own calls. Show caller + duration + "You handled this call directly" and nothing else in the expanded panel.
- **The usage meter is supplementary, not primary** — it should not visually compete with the schedule editor. Compact horizontal bar at the bottom of the page is the right weight.
- **Blocking validation on zero pickup numbers** — if someone enables routing but has no numbers, the save should show an inline warning, not a toast. Inline warnings at the point of error are harder to miss on mobile.

</specifics>

<deferred>
## Deferred Ideas

- **Multi-range per day** — Schema supports it (Phase 39 D-05) but UI writes single range per day. Could be a future enhancement for split-shift contractors.
- **Routing mode filter on calls page** — A "Routing" dropdown filter in the calls page filter bar. Current scope is display-only badges.
- **Usage alerts/notifications** — Push notification when approaching cap (e.g., 90% of outbound minutes). Currently just a visual meter.
- **Call routing analytics** — Charts showing AI vs owner-pickup call distribution over time. Belongs in a future analytics enhancement.

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 41-call-routing-dashboard-and-launch*
*Context gathered: 2026-04-11*

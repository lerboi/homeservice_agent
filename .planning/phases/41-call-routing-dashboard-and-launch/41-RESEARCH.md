# Phase 41: Call Routing Dashboard and Launch — Research

**Researched:** 2026-04-11
**Domain:** Next.js App Router dashboard UI, Supabase REST API routes, settings page patterns
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Vertical day list (Mon–Sun) with per-day enable toggle + start/end time pickers. Disabled days show muted "AI all day" label. Matches the existing working-hours page pattern.
- **D-02:** Master ON/OFF toggle at top maps to `call_forwarding_schedule.enabled`. When OFF, all day rows are disabled/muted with "AI answers all calls."
- **D-03:** "Copy from working hours" button — always visible at top of schedule section. One tap pre-fills all day rows from `tenants.working_hours`. Dramatically reduces first-time setup friction.
- **D-04:** One time range per day in the UI (schema allows multi-range). Times in tenant-local HH:MM 24h format.
- **D-05:** Single scrolling page at `/dashboard/more/call-routing` with four section cards. No tabs.
- **D-06:** Dial timeout slider (10-30s, default 15s) inside the schedule section.
- **D-07:** Page added to the `MORE_ITEMS` array in `src/app/dashboard/more/page.js`. AI Voice Settings page links to this page.
- **D-08:** Pickup numbers as inline card list — each shows formatted phone + label + SMS forward toggle + edit/delete icons.
- **D-09:** "Add pickup number" opens inline form (not modal/sheet) at bottom of section: phone, label, SMS forward checkbox.
- **D-10:** Section header shows "(N of 5)" counter.
- **D-11:** Validation: zero pickup numbers while schedule enabled → blocking Alert warning "Add at least one pickup number to route calls to you." E.164, no duplicates, no self-reference to Twilio number.
- **D-12:** Compact horizontal progress bar: "42 of 5,000 minutes used this month."
- **D-13:** Color threshold: green (<70%), amber (70-90%), red (>90%).
- **D-14:** Cap value shown: US/CA = 5,000 min, SG = 2,500 min (from `tenants.country`).
- **D-15:** Data source: `SUM(outbound_dial_duration_sec)` from `calls` table for current calendar month. Same as Python `check_outbound_cap`.
- **D-16:** Routing mode badges: `ai` = stone "AI", `owner_pickup` = blue "You answered", `fallback_to_ai` = amber "Missed → AI", `null` = no badge.
- **D-17:** Owner-pickup call cards show caller + duration + "You handled this call directly." AI-specific details hidden.
- **D-18:** Owner-pickup calls appear in the same list as AI calls (no separate tab).
- **D-19:** `GET /api/call-routing` returns schedule + pickup_numbers + dial_timeout_seconds + current month outbound minutes usage.
- **D-20:** `PUT /api/call-routing` validates and updates tenants row. Validation: E.164, no duplicates, no self-reference, max 5, valid HH:MM ranges (start != end), dial_timeout 10-30.
- **D-21:** Optional "Configure call routing" checklist step — complete when `call_forwarding_schedule.enabled === true` AND `pickup_numbers.length >= 1`. Links to `/dashboard/more/call-routing`.

### Claude's Discretion

- Exact time picker component (native HTML `<input type="time">` per UI-SPEC).
- Whether "Copy from working hours" appears only when schedule is empty or always (always visible per UI-SPEC).
- Exact animation/transition patterns (framer-motion opacity 0→1 / y 8→0 per UI-SPEC).
- Whether the usage meter section is collapsible (no — always visible per UI-SPEC).
- Test organization for new API route tests.
- Whether the calls page filters get a new "Routing" filter dropdown (deferred — display-only badges).

### Deferred Ideas (OUT OF SCOPE)

- Multi-range per day UI (schema supports it, Phase 41 writes single range only).
- Routing mode filter dropdown on calls page.
- Usage alerts/notifications.
- Call routing analytics charts.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ROUTE-13 | `/dashboard/more/call-routing` page — schedule editor, dial timeout slider, pickup number management | D-01 through D-11; WorkingHoursEditor pattern confirmed in codebase |
| ROUTE-14 | `GET /api/call-routing` and `PUT /api/call-routing` with validation | D-19, D-20; working-hours API pattern confirmed as template |
| ROUTE-15 | Usage meter showing outbound minutes SUM from `calls` table | D-12 through D-15; `progress.jsx` exists; `idx_calls_tenant_month` index exists |
| ROUTE-16 | Routing mode badges on calls page | D-16; URGENCY_STYLE/OUTCOME_STYLE map pattern confirmed; `routing_mode` column confirmed in migration 042 |
| ROUTE-17 | Owner-pickup calls visible in calls page with collapsed detail panel | D-17, D-18; CallCard component confirmed; `outbound_dial_duration_sec` column confirmed |
| ROUTE-18 | Setup checklist optional "Configure call routing" step | D-21; `deriveChecklistItems` function confirmed in setup-checklist route |
</phase_requirements>

---

## Summary

Phase 41 is a pure frontend phase — all backend data columns (`call_forwarding_schedule`, `pickup_numbers`, `dial_timeout_seconds`, `routing_mode`, `outbound_dial_duration_sec`) were added in Phase 39's migration 042 and are already present in the live database. Phase 40 wires the actual routing behavior. Phase 41 only needs to expose configuration to tenants and surface call data already being written.

Every major pattern this phase needs is already implemented in the codebase. The schedule editor follows the WorkingHoursEditor component pattern precisely — same day-list structure, same `<input type="time">`, same Switch components, same sticky save bar. The API routes follow the working-hours route pattern: `getTenantId()` → service-role Supabase query → validate → respond. The setup checklist extension follows the `deriveChecklistItems` function pattern already in place.

The one new dependency not yet installed is the `Slider` shadcn component (required for the dial timeout slider, D-06). All other components (`Switch`, `Badge`, `Alert`, `Progress`, `Input`, `Button`, `Skeleton`, `Select`) are already installed. The `npx shadcn add slider` command is the only environment gap.

**Primary recommendation:** Build the call-routing page as a single 'use client' page following the WorkingHoursEditor component architecture exactly. Build the API route following the working-hours route pattern. Add the slider component via shadcn CLI before implementation begins.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 14+ (project standard) | Page routing, API routes | Project foundation |
| `@supabase/supabase-js` | project-pinned | DB queries via service-role client | Project standard |
| `framer-motion` | project-installed | Entry animations, expand/collapse | Used on all dashboard pages |
| `sonner` | project-installed | Toast notifications | Used by every settings page |
| `shadcn/ui` | new-york preset | Switch, Badge, Input, Button, Skeleton, Alert, Progress, Slider | Project UI library |
| `lucide-react` | project-installed | Icons | Project standard |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `src/lib/design-tokens.js` | local | `card.base`, color constants | Every dashboard card/page |
| `src/lib/get-tenant-id.js` | local | Auth + tenant resolution for API routes | Every API route |
| `src/lib/supabase.js` | local | Service-role Supabase client | API routes (not browser client) |
| `src/lib/supabase-browser.js` | local | Browser Supabase client | Calls page Realtime (already present) |

### Missing Dependency (Wave 0 task)

The `Slider` shadcn component does NOT exist in `src/components/ui/`. Confirmed by directory listing — no `slider.jsx`. Install before implementing the schedule section:

```bash
npx shadcn add slider
```

This generates `src/components/ui/slider.jsx` using the Radix UI Slider primitive.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| native `<input type="time">` | custom time picker | Native is sufficient for single-range-per-day, matches mobile browser affordances, zero dependencies — UI-SPEC decided this |
| Slider shadcn | custom range input | Shadcn Slider is Radix-based, accessible, matches existing component library — correct choice |
| inline progress bar | shadcn Progress | `progress.jsx` already exists with color override support via className — reuse it |

---

## Architecture Patterns

### Recommended File Structure

```
src/app/dashboard/more/call-routing/
└── page.js                        ← 'use client', full page component

src/app/api/call-routing/
└── route.js                       ← GET + PUT handlers

src/app/dashboard/calls/
└── page.js                        ← MODIFY: add ROUTING_STYLE map + update CallCard

src/app/api/setup-checklist/
└── route.js                       ← MODIFY: add call routing step to deriveChecklistItems

src/app/dashboard/more/
└── page.js                        ← MODIFY: add call-routing to MORE_ITEMS array

src/app/dashboard/more/ai-voice-settings/
└── page.js                        ← MODIFY: add link to /dashboard/more/call-routing
```

### Pattern 1: Settings Page Structure (from working-hours/page.js)

Settings pages in this codebase are minimal — a `'use client'` page that renders one card wrapper from `card` design tokens, then delegates to an editor component:

```javascript
// Source: src/app/dashboard/more/working-hours/page.js
'use client';
import { card } from '@/lib/design-tokens';
import WorkingHoursEditor from '@/components/dashboard/WorkingHoursEditor';

export default function WorkingHoursPage() {
  return (
    <div className={`${card.base} p-6`}>
      <h1 className="text-xl font-semibold text-[#0F172A] mb-1">Working Hours</h1>
      <p className="text-sm text-[#475569] mb-6">...</p>
      <WorkingHoursEditor />
    </div>
  );
}
```

Phase 41 deviates slightly because the call-routing page has FOUR section cards (schedule, pickup numbers, usage meter, no 4th card). The page itself renders all four sections since they share state (schedule.enabled gates pickup numbers validation, all three go in one PUT). A single component file containing all sections is appropriate at this complexity level. Break out only if a section exceeds ~200 lines.

### Pattern 2: API Route Structure (from working-hours/route.js)

```javascript
// Source: src/app/api/working-hours/route.js
import { getTenantId } from '@/lib/get-tenant-id';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const tenantId = await getTenantId();
  if (!tenantId) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { data, error } = await supabase.from('tenants').select('...').eq('id', tenantId).single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ... });
}

export async function PUT(request) {
  const tenantId = await getTenantId();
  if (!tenantId) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  // validate...
  const { data, error } = await supabase.from('tenants').update(updates).eq('id', tenantId)...;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ... });
}
```

The `GET /api/call-routing` handler needs one extra query: SUM of `outbound_dial_duration_sec` for the current calendar month. Use a separate `.from('calls').select('outbound_dial_duration_sec').eq('tenant_id', tenantId).gte('created_at', monthStart)` query alongside the tenants query.

### Pattern 3: ROUTING_STYLE Map (from URGENCY_STYLE pattern in calls/page.js)

```javascript
// Source: src/app/dashboard/calls/page.js — additive pattern
const ROUTING_STYLE = {
  ai:           { badge: 'bg-stone-100 text-stone-600',  border: 'border-l-stone-300',  label: 'AI' },
  owner_pickup: { badge: 'bg-blue-100 text-blue-700',    border: 'border-l-blue-500',   label: 'You answered' },
  fallback_to_ai:{ badge: 'bg-amber-100 text-amber-700', border: 'border-l-amber-500',  label: 'Missed \u2192 AI' },
};
// null routing_mode → no badge rendered (legacy calls)
```

Add this map alongside `URGENCY_STYLE` and `OUTCOME_STYLE`. In `CallCard`, render the routing badge in the badges row alongside `os` and urgency badges. For `owner_pickup` calls, guard the expanded panel so AI-specific details (AudioPlayer, urgency, booking outcome, language, recording info) are hidden and replaced with "You handled this call directly."

### Pattern 4: deriveChecklistItems Extension (from setup-checklist/route.js)

```javascript
// Source: src/app/api/setup-checklist/route.js — additive pattern
function deriveChecklistItems(tenant, serviceCount, calendarConnected, zoneCount, escalationCount) {
  return [
    // ... existing items ...
    {
      id: 'configure_call_routing',
      label: 'Configure call routing',
      complete: !!(
        tenant.call_forwarding_schedule?.enabled === true &&
        Array.isArray(tenant.pickup_numbers) &&
        tenant.pickup_numbers.length >= 1
      ),
      locked: false,
      href: '/dashboard/more/call-routing',
      optional: true,   // if the checklist component supports optional flag — see note below
    },
  ];
}
```

**Note:** The existing checklist items do not use an `optional` field. The UI-SPEC says "optional step." Look at `SetupChecklist.jsx` to see whether optional rendering already exists or needs to be added. Add `optional: true` to the item shape regardless — if the component ignores unknown fields, it will render as a normal step without harm, and the optional visual treatment can be wired in a follow-up.

The `GET` handler must also add `call_forwarding_schedule, pickup_numbers` to the tenants select query in the setup-checklist route so `deriveChecklistItems` can read them.

### Pattern 5: Schedule State Shape (from Phase 39 D-05)

The `call_forwarding_schedule` JSONB on the tenant row has this shape:
```json
{
  "enabled": false,
  "days": {
    "mon": [{"start": "09:00", "end": "17:00"}],
    "tue": [{"start": "09:00", "end": "17:00"}],
    "wed": [],
    "thu": [],
    "fri": [],
    "sat": [],
    "sun": []
  }
}
```

Day keys are three-letter lowercase: `mon`, `tue`, `wed`, `thu`, `fri`, `sat`, `sun`. Times are HH:MM 24h in tenant-local timezone. Empty array or missing key = AI all day. The UI writes exactly one element per enabled day. Disabled days write empty array `[]`. The Phase 39 schedule evaluator uses this shape.

**Key difference from WorkingHoursEditor:** WorkingHoursEditor uses full day names as keys (`monday`, `tuesday`, ...) in `tenants.working_hours`. The call routing schedule uses 3-letter lowercase keys (`mon`, `tue`, ...) per Phase 39 D-05. Do not confuse these two schemas.

The "Copy from working hours" feature must transform the working_hours shape (full day names, `open`/`close` fields, `enabled` boolean) into the routing schedule shape (3-letter keys, `[{start, end}]` array). The transformation is straightforward:

```javascript
// working_hours shape → call_forwarding_schedule.days shape
const WH_TO_ROUTE_KEY = {
  monday: 'mon', tuesday: 'tue', wednesday: 'wed', thursday: 'thu',
  friday: 'fri', saturday: 'sat', sunday: 'sun',
};
function copyFromWorkingHours(workingHours) {
  const days = {};
  for (const [whDay, routeKey] of Object.entries(WH_TO_ROUTE_KEY)) {
    const d = workingHours?.[whDay];
    days[routeKey] = (d?.enabled && d?.open && d?.close)
      ? [{ start: d.open, end: d.close }]
      : [];
  }
  return days;
}
```

This needs to be fetched from the tenant row on page load (`working_hours` column) and used only when the button is clicked.

### Anti-Patterns to Avoid

- **Fetching working_hours from a separate API call**: the GET /api/call-routing can include `working_hours` in the tenant select so the page has both pieces of data in a single fetch.
- **Using supabase-browser in API routes**: API routes use `src/lib/supabase.js` (service-role). Browser client (`supabase-browser`) is only for client-side components needing Realtime or auth.
- **Putting validation in the page component instead of the API**: E.164 validation, duplicate detection, max-5 check must all be in `PUT /api/call-routing`. The page also validates for UX, but the API is the authoritative gate.
- **Writing `routing_mode: null` calls as owner-pickup**: owner-pickup calls always have `routing_mode = 'owner_pickup'` set by Phase 40's webhook. The calls page just reads the column — no inference needed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| E.164 phone validation | custom regex | Simple regex `^\\+[1-9]\\d{1,14}$` in the API route | The codebase does not use a phone library; this simple regex matches Twilio's E.164 contract |
| Dial timeout slider | custom range input | `shadcn Slider` (Radix UI Slider) | Accessible, keyboard-navigable, matches existing component library |
| Progress bar for usage meter | custom div with inline width | `src/components/ui/progress.jsx` (already installed) | Already follows Radix UI Progress pattern; color override via className works |
| Toast notifications | custom toast system | `sonner` (already installed) | Project standard, used by every settings page |
| Date math for "current calendar month" | manual date arithmetic | `new Date()` + ISO string slice `new Date().toISOString().slice(0, 7) + '-01'` | Month start is a single line; no library needed |

**Key insight:** This phase is almost entirely UI wiring. Every hard problem (schedule evaluation, phone number provisioning, routing logic, DB schema) was solved in Phases 39 and 40. Phase 41 reads and writes columns that already exist.

---

## Common Pitfalls

### Pitfall 1: Schedule JSONB Key Mismatch (mon vs monday)

**What goes wrong:** The schedule editor is written following WorkingHoursEditor, which uses full day names (`monday`, `tuesday`). Developer copies the day iteration loop and writes full-name keys to `call_forwarding_schedule.days`, which the Python evaluator cannot match.

**Why it happens:** WorkingHoursEditor uses `const DAYS = ['monday', 'tuesday', ...]`. The call routing schema uses 3-letter keys per Phase 39 D-05.

**How to avoid:** Define a separate `const ROUTING_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']` in the call-routing page. Do not reuse the WorkingHoursEditor day key arrays.

**Warning signs:** Schedule evaluator never returns `owner_pickup` even though schedule is enabled.

### Pitfall 2: `routing_mode` Column Not Included in calls API SELECT

**What goes wrong:** The routing mode badge on CallCard renders nothing for all calls because `routing_mode` is not in the `select(...)` string in `src/app/api/calls/route.js`.

**Why it happens:** The calls API was written before Phase 39 added the `routing_mode` and `outbound_dial_duration_sec` columns.

**How to avoid:** Add `routing_mode, outbound_dial_duration_sec` to the calls API select query in Phase 41. The planner should include this as an explicit task.

**Warning signs:** ROUTING_STYLE map is defined but `call.routing_mode` is always undefined in CallCard.

### Pitfall 3: Slider Component Not Installed

**What goes wrong:** Import of `@/components/ui/slider` throws a module-not-found error. The page crashes on load.

**Why it happens:** The Slider component is NOT in the current `src/components/ui/` directory (verified by directory listing). Only 21 components exist; slider is absent.

**How to avoid:** Wave 0 task must run `npx shadcn add slider` before any implementation plan that imports Slider.

**Warning signs:** Module resolution error at build time or runtime.

### Pitfall 4: Validation Error on Zero Pickup Numbers Triggers Toast Instead of Inline Alert

**What goes wrong:** Developer uses `toast.error(...)` for the "Add at least one pickup number" warning. On mobile, toasts appear at the bottom and can be missed while the user looks at the top of the form.

**Why it happens:** All other save errors in settings pages use `toast.error`. The zero-numbers case requires different treatment.

**How to avoid:** Per CONTEXT.md D-11 and UI-SPEC: use the `Alert` component (variant warning) rendered inline above the Add pickup number button. This is an explicit design decision, not a code smell. The `Alert` component is already installed (`src/components/ui/alert.jsx`).

**Warning signs:** "Failed to save" toast appears instead of inline red/yellow block near the pickup numbers section.

### Pitfall 5: Self-Reference Validation Requires the Tenant's Twilio Number

**What goes wrong:** The PUT handler validates that no pickup number equals the tenant's Twilio number, but the Twilio number is NOT in the request body. Developer skips this check or fetches it incorrectly.

**Why it happens:** The API handler already knows the tenantId, so it must fetch `tenants.phone_number` to perform the self-reference check. This requires a pre-validation DB read.

**How to avoid:** In `PUT /api/call-routing`, fetch `{ phone_number, country }` from the tenants row (needed for both self-reference check and to enforce country-appropriate context). The select query already needed `country` for the usage meter cap anyway — combine into one tenant fetch.

**Warning signs:** User can add their own Twilio number as a pickup number, causing Twilio to call itself in an infinite loop.

### Pitfall 6: Usage Meter SUM Returns null When No Calls Exist

**What goes wrong:** `SUM(outbound_dial_duration_sec)` returns null when no rows match (no outbound calls this month). JavaScript treats `null / 60` as `0` due to coercion, but if the comparison is `null >= threshold` it returns `false` instead of `true`, making the progress bar render at 100%.

**Why it happens:** SQL aggregate SUM returns NULL on empty result sets. JavaScript null arithmetic is inconsistent.

**How to avoid:** Coerce with `const used = Number(data?.sum ?? 0)` immediately after the DB response. The cap check uses `COALESCE(SUM(...), 0)` in the Python code but the JS API must add its own null guard.

**Warning signs:** Usage meter renders as full bar (100%) for new tenants who have never had an owner-pickup call.

### Pitfall 7: Calls API Does Not Filter Out Any calls by routing_mode

**What goes wrong:** Developer sees that owner-pickup calls don't have transcripts/recordings and considers filtering them out of the calls API response. This breaks success criterion #5.

**Why it happens:** The existing calls API was written for AI-only calls. Owner-pickup calls look unusual in the result set (null urgency, null booking_outcome, no recording_url).

**How to avoid:** Owner-pickup calls must appear in the calls list. The calls API should NOT add a `routing_mode != 'owner_pickup'` filter. The CallCard component handles owner-pickup rendering gracefully per D-17.

---

## Code Examples

### GET /api/call-routing response shape

```javascript
// src/app/api/call-routing/route.js
{
  call_forwarding_schedule: {
    enabled: false,
    days: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] }
  },
  pickup_numbers: [
    { number: "+15551234567", label: "Cell", sms_forward: true }
  ],
  dial_timeout_seconds: 15,
  usage: {
    used_seconds: 2520,
    used_minutes: 42,           // Math.floor(used_seconds / 60)
    cap_minutes: 5000,          // 5000 for US/CA, 2500 for SG
    country: "US"
  },
  working_hours: { monday: { enabled: true, open: "08:00", close: "17:00", ... }, ... }
  // working_hours included so the UI can pre-fill "Copy from working hours"
}
```

### PUT /api/call-routing validation contract

```javascript
// Validates:
// 1. body.dial_timeout_seconds: integer, 10 <= x <= 30
// 2. body.call_forwarding_schedule: object with enabled (bool) + days (object)
//    - each day key must be in ['mon','tue','wed','thu','fri','sat','sun']
//    - each day value must be array of {start: HH:MM, end: HH:MM} with start != end
// 3. body.pickup_numbers: array, length <= 5
//    - each item: { number (E.164), label (string), sms_forward (bool) }
//    - no duplicate .number values
//    - no item.number === tenant.phone_number (self-reference)
// 4. If call_forwarding_schedule.enabled === true AND pickup_numbers.length === 0: 400
const E164_RE = /^\+[1-9]\d{1,14}$/;
```

### CallCard owner_pickup expanded panel

```javascript
// Inside CallCard expanded panel — guard on routing_mode
const isOwnerPickup = call.routing_mode === 'owner_pickup';

// In the expanded panel:
{isOwnerPickup ? (
  <div className="px-4 pb-4 pt-1 border-t border-stone-100">
    <p className="text-sm text-[#475569] mt-2">You handled this call directly.</p>
    {call.from_number && (
      <a href={`tel:${call.from_number}`} className="...">
        <PhoneOutgoing className="h-3 w-3" /> Call Back
      </a>
    )}
  </div>
) : (
  // existing expanded panel content
)}
```

### Usage meter with color threshold

```javascript
// Usage meter color calculation
function usageColor(usedMinutes, capMinutes) {
  const pct = capMinutes > 0 ? (usedMinutes / capMinutes) * 100 : 0;
  if (pct > 90) return 'bg-red-500';
  if (pct > 70) return 'bg-amber-500';
  return 'bg-green-500';
}

// Progress component with color override
// Note: progress.jsx uses bg-primary on the indicator — override via className on the indicator
// The Radix Progress component accepts a custom indicator class via the data-slot
// Simpler: use a plain div progress bar since the color is dynamic
<div className="relative h-2 w-full overflow-hidden rounded-full bg-stone-100">
  <div
    className={`h-full rounded-full transition-all ${usageColor(usedMinutes, capMinutes)}`}
    style={{ width: `${Math.min(100, (usedMinutes / capMinutes) * 100)}%` }}
  />
</div>
```

### Month start calculation for usage query

```javascript
// No date library needed — ISO string slice
const now = new Date();
const monthStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01T00:00:00.000Z`;
// Query: .from('calls').select('outbound_dial_duration_sec').eq('tenant_id', tenantId).gte('created_at', monthStart)
```

### deriveChecklistItems extension

```javascript
// In setup-checklist/route.js — add to tenants select:
.select('id, business_name, working_hours, onboarding_complete, phone_number, setup_checklist_dismissed, notification_preferences, call_forwarding_schedule, pickup_numbers')

// In deriveChecklistItems — add to returned array:
{
  id: 'configure_call_routing',
  label: 'Configure call routing',
  complete: !!(
    tenant.call_forwarding_schedule?.enabled === true &&
    Array.isArray(tenant.pickup_numbers) &&
    tenant.pickup_numbers.length >= 1
  ),
  locked: false,
  href: '/dashboard/more/call-routing',
},
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Calls always routed to AI (SIP trunk) | Conditional routing via webhook + schedule evaluator | Phase 40 cutover | Phase 41 must surface the new routing mode data in the existing calls UI |
| No `routing_mode` column | `routing_mode` TEXT nullable on calls (ai/owner_pickup/fallback_to_ai) | Phase 39 migration 042 | CallCard needs to handle the three values + null |
| No routing config columns on tenants | `call_forwarding_schedule`, `pickup_numbers`, `dial_timeout_seconds` on tenants | Phase 39 migration 042 | All three columns ready to read/write |

---

## Open Questions

1. **Does SetupChecklist.jsx support an `optional` visual treatment?**
   - What we know: `deriveChecklistItems` returns items with `id`, `label`, `complete`, `locked`, `href`. No `optional` field exists today.
   - What's unclear: Whether the checklist UI renders optional items differently (e.g., "Optional" badge, faded styling) or the same as required items.
   - Recommendation: Add `optional: true` to the call routing step item regardless. Inspect `src/components/dashboard/SetupChecklist.jsx` during implementation to decide if the optional badge is worth wiring.

2. **Does the calls page query `/api/calls` in a way that already includes all calls including owner-pickup?**
   - What we know: The calls API selects from `calls` table with `eq('tenant_id', tenantId)` and no routing_mode filter. Owner-pickup calls inserted by Phase 40's webhook will appear.
   - What's unclear: Whether there's a `status` filter in the default calls page fetch that would exclude owner-pickup calls (which don't go through the normal `ended`/`analyzed` lifecycle).
   - Recommendation: The default calls page fetch does not set a status filter (verified in `fetchCalls` in calls/page.js — `callStatus` param is only applied when `filters.status` exists, which is not in `DEFAULT_FILTERS`). Owner-pickup calls will appear by default. No API change needed for inclusion.

3. **Does the calls page summary bar need to exclude owner-pickup calls from "Avg Duration"?**
   - What we know: `avgDur` is computed as `Math.round(calls.reduce(...) / total)`. Owner-pickup calls have `duration_seconds` from... wait — the calls API currently selects `duration_seconds` but NOT `outbound_dial_duration_sec`. The duration for owner-pickup calls lives in `outbound_dial_duration_sec`, not `duration_seconds`. Owner-pickup calls likely have `duration_seconds: null` or 0.
   - Recommendation: The planner should add `outbound_dial_duration_sec` to the calls API select, and the CallCard should render `formatDuration(call.outbound_dial_duration_sec)` for owner-pickup calls. The summary bar average can remain as-is (owner-pickup calls with 0 duration won't inflate the average).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| shadcn Slider component | Dial timeout slider | ✗ (not installed) | — | None — must install via `npx shadcn add slider` |
| `calls.routing_mode` DB column | Routing mode badges | ✓ | migration 042 applied | — |
| `calls.outbound_dial_duration_sec` DB column | Owner-pickup duration display, usage meter | ✓ | migration 042 applied | — |
| `tenants.call_forwarding_schedule` column | Schedule editor GET/PUT | ✓ | migration 042 applied | — |
| `tenants.pickup_numbers` column | Pickup numbers GET/PUT | ✓ | migration 042 applied | — |
| `tenants.dial_timeout_seconds` column | Dial timeout GET/PUT | ✓ | migration 042 applied | — |
| `idx_calls_tenant_month` index | Usage meter SUM query | ✓ | migration 042 applied | — |
| `tenants.country` column | Usage cap display (5000 vs 2500 min) | ✓ | migration 011 applied | — |
| `tenants.working_hours` column | "Copy from working hours" feature | ✓ | existing | — |

**Missing dependencies with no fallback:**
- Slider component — must install with `npx shadcn add slider` in Wave 0.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest (node environment) |
| Config file | `jest.config.js` |
| Quick run command | `npx jest tests/api/call-routing.test.js --no-coverage` |
| Full suite command | `npx jest --no-coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ROUTE-13 | Schedule editor renders with correct initial state | manual/visual | — | N/A |
| ROUTE-14 | GET /api/call-routing returns schedule + usage | unit | `npx jest tests/api/call-routing.test.js -t "GET"` | ❌ Wave 0 |
| ROUTE-14 | PUT /api/call-routing validates E.164, no dupes, no self-ref, max 5, dial_timeout range | unit | `npx jest tests/api/call-routing.test.js -t "PUT"` | ❌ Wave 0 |
| ROUTE-14 | PUT rejects zero pickup numbers when schedule enabled | unit | `npx jest tests/api/call-routing.test.js -t "zero pickup"` | ❌ Wave 0 |
| ROUTE-15 | Usage meter SUM returns 0 when no calls (null guard) | unit | `npx jest tests/api/call-routing.test.js -t "usage"` | ❌ Wave 0 |
| ROUTE-16 | ROUTING_STYLE map covers all three routing_mode values + null | unit (trivial) | `npx jest tests/unit/routing-style.test.js` | ❌ Wave 0 |
| ROUTE-17 | Owner-pickup calls not filtered from calls API (no routing_mode filter added) | unit | `npx jest tests/api/calls-routing.test.js` | ❌ Wave 0 |
| ROUTE-18 | deriveChecklistItems adds call routing step with correct complete condition | unit | `npx jest tests/agent/setup-checklist.test.js -t "call routing"` | ✅ (file exists, test case to be added) |

### Sampling Rate

- **Per task commit:** `npx jest tests/api/call-routing.test.js --no-coverage`
- **Per wave merge:** `npx jest --no-coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/api/call-routing.test.js` — covers ROUTE-14 (GET and PUT) and ROUTE-15 (usage null guard)
- [ ] `tests/unit/routing-style.test.js` — trivial map coverage for ROUTE-16
- [ ] `tests/api/calls-routing.test.js` — verifies calls API does not filter owner-pickup calls
- [ ] Slider component install: `npx shadcn add slider` — required before any implementation that imports Slider
- [ ] Add `call routing` test case to existing `tests/agent/setup-checklist.test.js` — covers ROUTE-18

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 41 |
|-----------|-------------------|
| **Brand name is Voco** | Use "Voco" in any user-facing copy (e.g., "You can't forward to your Voco business number.") — already reflected in UI-SPEC copywriting |
| **Keep skills in sync** — read skill first, update after | Read `dashboard-crm-system/SKILL.md` before modifying calls page and dashboard more page. Read `voice-call-architecture/SKILL.md` before adding routing mode to calls. Update both after implementation. |
| **App Router, Supabase, Twilio, LiveKit, Gemini, Stripe, Resend, Tailwind, shadcn/ui, next-intl** | All components must use shadcn/ui and Tailwind only. No external CSS. |
| **getTenantId() pattern** | Both GET and PUT routes must call `getTenantId()` from `src/lib/get-tenant-id.js` for auth + tenant resolution. |
| **Service-role Supabase client for API routes** | `src/lib/supabase.js` (service-role) in API routes. `src/lib/supabase-browser.js` only for client-side Realtime. |

---

## Sources

### Primary (HIGH confidence)

- Direct code inspection: `src/app/dashboard/more/working-hours/page.js` — settings page shell pattern
- Direct code inspection: `src/components/dashboard/WorkingHoursEditor.js` — day-list + Switch + native time input + sticky save bar pattern
- Direct code inspection: `src/app/api/working-hours/route.js` — GET/PUT API route pattern
- Direct code inspection: `src/app/dashboard/calls/page.js` — URGENCY_STYLE/OUTCOME_STYLE map, CallCard, Realtime subscription
- Direct code inspection: `src/app/api/setup-checklist/route.js` — deriveChecklistItems function
- Direct code inspection: `src/app/dashboard/more/page.js` — MORE_ITEMS array structure
- Direct code inspection: `src/app/dashboard/more/ai-voice-settings/page.js` — page shell to add link to
- Direct code inspection: `src/components/ui/` directory listing — confirms Slider is NOT installed
- Direct code inspection: `supabase/migrations/042_call_routing_schema.sql` — confirms all routing columns exist
- Direct code inspection: `src/lib/design-tokens.js` — card, colors, focus tokens
- Direct code inspection: `src/components/ui/progress.jsx` — confirms progress bar component exists
- `.planning/phases/41-call-routing-dashboard-and-launch/41-CONTEXT.md` — all locked decisions
- `.planning/phases/41-call-routing-dashboard-and-launch/41-UI-SPEC.md` — visual contract, component inventory, copywriting

### Secondary (MEDIUM confidence)

- `.planning/phases/39-call-routing-webhook-foundation/39-CONTEXT.md` — schedule JSONB shape (D-05, D-07), pickup_numbers item shape (D-20)
- `.planning/phases/40-call-routing-provisioning-cutover/40-CONTEXT.md` — owner-pickup call lifecycle (D-07 through D-10), routing mode values

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed by direct directory inspection
- Architecture: HIGH — all patterns from live source code, no assumptions
- Pitfalls: HIGH — derived from direct schema inspection and code reading, not speculation
- Missing dependency (Slider): HIGH — confirmed absent by directory listing

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (stable codebase)

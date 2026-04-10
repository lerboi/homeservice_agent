# Phase 42: Calendar Essentials — Time Blocks and Mark Complete - Research

**Researched:** 2026-04-10
**Domain:** Next.js dashboard calendar, Supabase schema, Python LiveKit agent slot calculation
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Click + Sheet pattern for time block creation. User clicks a '+' button or empty time slot → a Sheet opens with title, start/end time, date, all-day toggle, and optional note.
- **D-02:** Fields: title (free text), date, start time, end time, all-day toggle. No recurrence. No category presets.
- **D-03:** Time blocks are editable and deletable. Clicking a block reopens the Sheet in edit mode with a delete button.
- **D-04:** Hatched/striped diagonal pattern over a muted background (gray or slate). Distinct from solid appointment blocks.
- **D-05:** Time blocks render full width behind appointments as a background layer. They do NOT participate in `layoutEventsInLanes`. Appointments render on top.
- **D-06:** "Mark Complete" button in the existing AppointmentFlyout, alongside "Cancel Appointment".
- **D-07:** Instant status update. Click "Mark Complete" → status `completed` + `completed_at` timestamp → flyout closes → success toast with "Undo" action. Undo reverts to `confirmed`. No confirmation dialog.
- **D-08:** Optional completion notes — expandable text area in flyout when user clicks "Mark Complete". Notes appended to existing `notes` column (or set if empty). Not required.
- **D-09:** Completed appointments render at ~40% opacity with a small checkmark badge. Urgency color tint preserved. Block remains clickable.
- **D-10:** "Show completed" toggle filter above the calendar. On by default. Toggling off hides completed appointments.
- **D-11 (Claude's Discretion):** The `check_availability` tool in the LiveKit Python agent must query `calendar_blocks` and treat overlapping blocks as unavailable.

### Claude's Discretion

- Voice agent integration approach for time blocks (D-11) — direct query vs feeding as `externalBlocks`
- Database schema for `calendar_blocks` table (columns, constraints, RLS)
- API route structure for CRUD on time blocks
- How `completed_at` timestamp is stored (new column vs reusing existing fields)
- Slot calculator integration method
- Toast + undo implementation details

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

## Summary

Phase 42 adds two independent capabilities to the existing calendar system. Both are additive — they extend existing components rather than rewriting them.

**Time blocks** require: (1) a new `calendar_blocks` DB table with RLS, (2) CRUD API routes at `/api/calendar-blocks`, (3) a new `TimeBlockSheet` component for create/edit, (4) a `TimeBlockLayer` component rendered before (behind) `AppointmentBlock` in CalendarView, and (5) feeding `calendar_blocks` as `externalBlocks` into both the JS slot calculator (via `available-slots/route.js`) and the Python `check_availability` tool (via a new parallel DB query).

**Mark complete** requires: (1) a `completed_at` column migration on the `appointments` table, (2) a new PATCH handler branch `{ status: 'completed' }` in `/api/appointments/[id]`, (3) a "Mark Complete" button + expandable notes textarea added to `AppointmentFlyout`, (4) a new `completed` entry in `URGENCY_STYLES` (or a separate `STATUS_STYLES` map for completed), and (5) a "Show completed" toggle in the calendar page that filters state before passing to `CalendarView`.

The cross-repo aspect (LiveKit Python agent) is a focused addition: add a fifth parallel DB query in `check_availability` to fetch `calendar_blocks` for the tenant, merge results into the `external_blocks` list before calling `calculate_available_slots`.

**Primary recommendation:** Use migration 044 for `calendar_blocks` and a `completed_at` column on `appointments`. Feed `calendar_blocks` as additional `externalBlocks` in both the JS and Python slot calculators — this keeps slot-calculator logic unchanged and reuses the proven overlap-avoidance path.

---

## Standard Stack

### Core (all already in the project — no new installs needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | Current | API routes + page | Already deployed on Vercel |
| Supabase JS | `>=2.0,<3` (supabase-js) | DB reads/writes, RLS | Project standard |
| shadcn/ui `Sheet` | Current | Side-panel UI (create/edit block) | Already used for quick-book and working-hours editor |
| `sonner` (toast) | Current | Toast + undo pattern | Already used in `AppointmentFlyout` and calendar page |
| Tailwind CSS | Current | Hatched pattern via `bg-[image]` or gradient | Already used throughout |
| `date-fns` + `date-fns-tz` | Current | Date math in JS slot calculator and available-slots route | Already imported |
| Python `supabase-py` | `>=2.0,<3` | Agent DB queries | Already in pyproject.toml |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Lucide React `Ban` / `CheckCircle2` | Current | Mark-complete checkmark icon in appointment block | Completed state badge |
| `@radix-ui/react-collapsible` or native `details` | Current | Expandable notes field in flyout | D-08 requires expandable textarea |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New `calendar_blocks` table | Reuse `calendar_events` with a new `provider = 'manual_block'` | Mixing personal blocks with Google/Outlook mirrors creates filter complexity; separate table is cleaner and avoids touching webhook sync logic |
| `completed` entry in `URGENCY_STYLES` | Separate `STATUS_STYLES` map | Status and urgency are orthogonal; a separate map avoids every URGENCY_STYLES consumer needing a null-check for `completed` |

**Installation:** No new packages. All libraries already present in both repos.

---

## Architecture Patterns

### Recommended Project Structure

```
supabase/migrations/
└── 044_calendar_blocks_and_completed_at.sql   # new table + new column

src/app/api/calendar-blocks/
├── route.js          # GET (list for tenant+date range), POST (create)
└── [id]/route.js     # PATCH (update), DELETE

src/components/dashboard/
├── TimeBlockSheet.js          # Create/edit Sheet component (new)
└── TimeBlockLayer.js          # Full-width background renderer for CalendarView (new)

src/app/dashboard/calendar/page.js  # Add: time block state + fetch, TimeBlockSheet, show-completed toggle
src/components/dashboard/CalendarView.js  # Add: time block background layer render, completed style
src/components/dashboard/AppointmentFlyout.js  # Add: Mark Complete button + expandable notes

livekit-agent/src/tools/check_availability.py  # Add: calendar_blocks parallel query
```

### Pattern 1: `calendar_blocks` table design

**What:** A new Supabase table keyed by `tenant_id` with the fields matching D-02 decisions.

**Recommended schema:**

```sql
-- In 044_calendar_blocks_and_completed_at.sql

CREATE TABLE calendar_blocks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title       text NOT NULL,
  start_time  timestamptz NOT NULL,
  end_time    timestamptz NOT NULL,
  is_all_day  boolean NOT NULL DEFAULT false,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS: owner reads/writes their own blocks
ALTER TABLE calendar_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON calendar_blocks
  FOR SELECT USING (
    tenant_id = (SELECT id FROM tenants WHERE owner_id = auth.uid())
  );

CREATE POLICY "tenant_insert" ON calendar_blocks
  FOR INSERT WITH CHECK (
    tenant_id = (SELECT id FROM tenants WHERE owner_id = auth.uid())
  );

CREATE POLICY "tenant_update" ON calendar_blocks
  FOR UPDATE USING (
    tenant_id = (SELECT id FROM tenants WHERE owner_id = auth.uid())
  );

CREATE POLICY "tenant_delete" ON calendar_blocks
  FOR DELETE USING (
    tenant_id = (SELECT id FROM tenants WHERE owner_id = auth.uid())
  );

-- Index for date-range queries (slot calculator + calendar fetch)
CREATE INDEX idx_calendar_blocks_tenant_time
  ON calendar_blocks (tenant_id, start_time, end_time);

-- Add completed_at column to appointments
ALTER TABLE appointments ADD COLUMN completed_at timestamptz;
```

**Why:** Separate table keeps the `calendar_events` mirror table clean. The `completed_at` column is the correct approach — adding a new column is a simple additive migration that avoids repurposing existing fields.

**All-day block handling:** When `is_all_day = true`, the API layer converts to the tenant's working hours window (`open` → `close`) before writing `start_time`/`end_time` as UTC timestamptz. The UI sends absolute ISO timestamps; the all-day toggle is purely a UI convenience.

### Pattern 2: `calendar_blocks` API routes

**What:** Two route files follow the exact same structure as the appointments API.

**GET `/api/calendar-blocks`** (list for a date range):

```javascript
// Source: mirrors /api/appointments/route.js pattern
export async function GET(request) {
  const tenantId = await getTenantId();
  if (!tenantId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  const { data, error } = await supabase
    .from('calendar_blocks')
    .select('id, title, start_time, end_time, is_all_day, note, created_at')
    .eq('tenant_id', tenantId)
    .lte('start_time', end)
    .gte('end_time', start)
    .order('start_time', { ascending: true });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ blocks: data || [] });
}
```

**POST `/api/calendar-blocks`** (create):

```javascript
export async function POST(request) {
  const tenantId = await getTenantId();
  if (!tenantId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { title, start_time, end_time, is_all_day, note } = await request.json();
  if (!title || !start_time || !end_time) {
    return Response.json({ error: 'title, start_time, end_time required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('calendar_blocks')
    .insert({ tenant_id: tenantId, title, start_time, end_time, is_all_day: !!is_all_day, note })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ block: data }, { status: 201 });
}
```

**PATCH + DELETE `/api/calendar-blocks/[id]`**: Standard update/delete with `tenant_id` guard.

### Pattern 3: Time block visual rendering

**What:** A separate `TimeBlockLayer` component renders full-width blocks behind appointments.

**Key insight from `layoutEventsInLanes`:** Time blocks must NOT be passed into `layoutEventsInLanes`. They render at `left: 4px / right: 4px` (full column width) with `z-index` below appointment blocks. Appointments use `z-10` (already set by `AppointmentBlock`), so time blocks should use `z-0` or `z-[1]`.

**CSS hatched pattern:** Use a CSS `backgroundImage` with a repeating diagonal gradient — no external library needed:

```javascript
// Hatched/striped diagonal pattern (standard CSS, no library)
const BLOCK_STYLE = {
  backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.05) 4px, rgba(0,0,0,0.05) 8px)',
  backgroundColor: 'rgb(241 245 249)', // slate-100
};
```

**Positioning math:** Reuses the same `getPositionStyle(start_time, end_time)` function already used by `AppointmentBlock`. Same `top` / `height` calculation.

**Full-width layout:**

```javascript
function TimeBlockLayer({ block, getPositionStyle, isMobile }) {
  const style = getPositionStyle(block.start_time, block.end_time);
  const outerMargin = isMobile ? 2 : 4;
  return (
    <button
      type="button"
      className="absolute rounded-md overflow-hidden cursor-pointer border border-slate-200 hover:border-slate-300"
      style={{
        ...style,
        left: `${outerMargin}px`,
        right: `${outerMargin}px`,
        width: undefined,
        zIndex: 1,
        backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.05) 4px, rgba(0,0,0,0.05) 8px)',
        backgroundColor: 'rgb(241 245 249)',
      }}
      onClick={(e) => { e.stopPropagation(); onBlockClick(block); }}
    >
      <span className="px-2 py-1 text-xs font-medium text-slate-500 truncate block">{block.title}</span>
    </button>
  );
}
```

### Pattern 4: Mark Complete — PATCH handler extension

**What:** Extend the existing `PATCH /api/appointments/[id]` handler with a new `status: 'completed'` branch.

**Existing code insight:** The PATCH route already has two branches: `conflict_dismissed` and `status: 'cancelled'`. A third branch `status: 'completed'` follows the same shape:

```javascript
// In /api/appointments/[id]/route.js — new branch
if (body.status === 'completed') {
  const notes = body.notes; // optional completion notes
  const updatePayload = {
    status: 'completed',
    completed_at: new Date().toISOString(),
  };
  if (notes !== undefined) {
    // Append to existing notes or set if empty
    const { data: existing } = await supabase
      .from('appointments')
      .select('notes')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();
    updatePayload.notes = existing?.notes
      ? `${existing.notes}\n\n[Completed] ${notes}`
      : notes ? `[Completed] ${notes}` : existing?.notes;
  }

  const { data: updated, error } = await supabase
    .from('appointments')
    .update(updatePayload)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select('id, status, completed_at, notes, start_time, end_time, caller_name')
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ appointment: updated });
}
```

### Pattern 5: Toast + Undo

**What:** The `sonner` toast library (already imported in `AppointmentFlyout.js`) supports action buttons natively.

**Sonner action button pattern:**

```javascript
// Source: sonner API — action property on toast()
toast.success('Job marked as complete', {
  duration: 5000,
  action: {
    label: 'Undo',
    onClick: async () => {
      await fetch(`/api/appointments/${appointment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'confirmed' }),
      });
      // Notify parent to refresh
      onUndoComplete?.(appointment.id);
    },
  },
});
```

**PATCH for undo:** The undo action sends `{ status: 'confirmed' }` — requires a fourth PATCH branch that sets `status: 'confirmed'` and clears `completed_at` (SET NULL). This is a lightweight reversal route.

### Pattern 6: Completed visual state in `URGENCY_STYLES`

**What:** Add a `completed` processing mode that overrides urgency color with muted/low-opacity styling.

**Recommended approach — status-aware rendering in `AppointmentBlock`:**

```javascript
// In CalendarView.js AppointmentBlock — status-override
const isCompleted = appointment.status === 'completed';
const urgency = appointment.urgency || 'routine';
const styles = URGENCY_STYLES[urgency] || URGENCY_STYLES.routine;

// Apply completed overlay: 40% opacity, checkmark badge
const blockClass = isCompleted
  ? `${styles.block} opacity-40`
  : styles.block;
```

This preserves urgency color tint (as specified in D-09) while applying `opacity-40`. No new `URGENCY_STYLES` entry needed. The checkmark badge renders inside `AppointmentBlock` conditionally when `isCompleted`.

**`appointments` GET query update:** The existing `GET /api/appointments` already excludes `cancelled` via `.neq('status', 'cancelled')`. It must NOT exclude `completed` — so completed appointments continue to appear unless the "Show completed" toggle is off. The `show-completed` filter should be applied client-side in the calendar page state, not in the API query.

### Pattern 7: Voice agent integration (D-11)

**Recommendation:** Add `calendar_blocks` as a fifth parallel query in `check_availability.py`, then merge the results into `external_blocks` before calling `calculate_available_slots`. This is the cleanest approach — zero changes to `slot_calculator.py` signature.

**Rationale:** The Python `calculate_available_slots` already accepts an `external_blocks` list with `{ start_time, end_time }` shape. `calendar_blocks` rows have the same shape. Merging them before the call means the slot calculator treats time blocks identically to Google/Outlook calendar events — no new slot-calculator logic, no new parameters, no edge cases.

```python
# In check_availability.py — fifth parallel query added to gather()
blocks_result = await asyncio.to_thread(
    lambda: supabase.table("calendar_blocks")
    .select("start_time, end_time")
    .eq("tenant_id", tenant_id)
    .gte("end_time", now_iso)
    .execute()
)

# Merge into external_blocks before calculate_available_slots
combined_external_blocks = (events_result.data or []) + (blocks_result.data or [])

# Then pass combined_external_blocks as external_blocks to calculate_available_slots
```

**Same merge needed in `available-slots/route.js`** (Next.js dashboard API). The `eventsResult` fetch must include a parallel `blocksResult` fetch, and both are merged before calling `calculateAvailableSlots`.

### Pattern 8: Calendar page state management for time blocks

**What:** The calendar page needs to fetch and hold `calendar_blocks` alongside `appointments`.

**Current state shape in `page.js`:**

```javascript
const [data, setData] = useState({
  appointments: [],
  externalEvents: [],
  travelBuffers: [],
  conflicts: [],
});
```

**New shape:**

```javascript
const [data, setData] = useState({
  appointments: [],
  externalEvents: [],
  travelBuffers: [],
  conflicts: [],
  timeBlocks: [],   // new
});
```

`fetchData` (the existing fetch function in `page.js`) must be extended to also call `GET /api/calendar-blocks?start=...&end=...` in parallel with the existing appointments fetch.

### Anti-Patterns to Avoid

- **Passing time blocks into `layoutEventsInLanes`:** They must bypass the lane algorithm per D-05. Render them before (behind) the laid-out events.
- **Filtering completed appointments in the API:** The "Show completed" toggle is a client-side state filter, not an API query parameter. Changing the API would cause stale data when toggled on.
- **Adding a `completed` key to `URGENCY_STYLES`:** Status and urgency are orthogonal. A status-based overlay on the existing style is cleaner.
- **Using `calendar_events` table for time blocks:** The calendar_events table is a mirror of external provider data (Google/Outlook). Mixing in user-created time blocks would require filtering on provider name everywhere the table is queried, and would cause time blocks to be incorrectly processed by the Google/Outlook sync handlers.
- **Sending all-day blocks as `00:00–23:59`:** The slot calculator would block all slots. All-day blocks should be stored as the tenant's `working_hours` window for that day (derived at create time from the tenant config). If tenant has no working hours configured, use 07:00–20:00 as a fallback (matches `DEFAULT_START`/`DEFAULT_END` in CalendarView.js).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toast with undo action | Custom toast+timer system | `sonner` `toast()` with `action` prop | Already imported; handles duration + dismiss + action natively |
| CSS hatched pattern | SVG pattern element | CSS `repeating-linear-gradient(45deg, ...)` | Zero DOM nodes, pure CSS, works in all browsers |
| Date range overlap query | Manual JS filter | Supabase `.lte('start_time', end).gte('end_time', start)` | Same pattern already used for `calendar_events` in appointments route |
| Sheet component | Custom modal | shadcn/ui `Sheet` | Already in project; used by quick-book, working-hours editor |
| Slot overlap check | New logic in slot calculator | Pass `calendar_blocks` as `externalBlocks` | `_intervals_overlap` in Python slot calculator already handles this path |

---

## Common Pitfalls

### Pitfall 1: Supabase service role vs SSR client for calendar_blocks API

**What goes wrong:** Using the browser `supabase-browser` client in API routes, or the service role client for user-scoped reads — both work for writes but service role bypasses RLS, giving cross-tenant data access risk.

**Why it happens:** The project uses three distinct clients. The appointments API uses the service role client (`supabase.js`) but with explicit `tenant_id` guards on every query. This is established pattern — follow it.

**How to avoid:** The `calendar_blocks` API routes should use `supabase` (service role) from `@/lib/supabase` with `.eq('tenant_id', tenantId)` on every query — exactly as `appointments/route.js` does. The service role client is safe here because `getTenantId()` derives tenant from the authenticated user session.

### Pitfall 2: Rendering completed appointments — opacity collapses child elements

**What goes wrong:** Applying `opacity-0.4` (CSS `opacity: 0.4`) to the block wrapper makes all children semi-transparent, including text. This is intended per D-09 but the click handler must still work.

**Why it happens:** CSS `opacity` applies to the entire element tree including the click surface. This is fine here — D-09 says "block remains clickable".

**How to avoid:** The opacity approach is correct. Do not use `pointer-events: none` on completed blocks.

### Pitfall 3: All-day time block storage — working hours dependency

**What goes wrong:** Storing `is_all_day = true` blocks with placeholder times (like `00:00–23:59`) and then computing the working hours window on read. This requires the slot calculator to handle a special `is_all_day` field — it currently does not.

**Why it happens:** The temptation is to mirror the `calendar_events.is_all_day` field, which Google/Outlook use for all-day events.

**How to avoid:** Resolve all-day blocks to concrete UTC `start_time`/`end_time` at **write time** in the API route (POST/PATCH). The client sends `is_all_day: true` + the date; the server looks up the tenant's `working_hours` for that day and writes the appropriate UTC window. The `is_all_day` column is stored for UI display only (so the edit Sheet can show the toggle state). The slot calculator receives concrete ISO timestamps and doesn't need to handle all-day logic.

### Pitfall 4: Migration numbering — 043 is already taken

**What goes wrong:** Trying to use migration `043_*` — that file already exists (`043_appointments_realtime.sql`). The next available number is `044`.

**Why it happens:** The git status shows `supabase/migrations/043_appointments_realtime.sql` as a new untracked file.

**How to avoid:** Use `044_calendar_blocks_and_completed_at.sql` for this phase.

### Pitfall 5: `check_availability` Python query — `neq('status', 'cancelled')` filter for appointments

**What goes wrong:** The existing appointments query in `check_availability.py` already uses `.neq("status", "cancelled")`. With the addition of `completed` status, completed appointments would still be included in `existing_bookings` passed to `calculate_available_slots`, which would block those time slots from being offered to callers.

**Why it happens:** Completed appointments occupy real calendar time that is now actually free (the job is done). Including them as blockers prevents re-booking the same slot for a different job on a different day.

**How to avoid:** Update the appointments query in `check_availability.py` to also exclude `completed` appointments: `.not_("status", "in", '("cancelled","completed")')` or two `.neq()` calls. A completed job's time slot is freed for future bookings.

**Verification:** This same logic applies to `GET /api/appointments` (calendar display — keep completed for display), `available-slots/route.js` (slot calc — exclude completed), and `check_availability.py` (slot calc — exclude completed).

### Pitfall 6: Sonner `action` button on toast — flyout must close before toast fires

**What goes wrong:** The flyout closes (`onOpenChange(false)`) and then the toast fires. If the toast `action.onClick` calls `onUndoComplete(appointment.id)`, the parent `page.js` needs to know to update state. If the appointment object is captured in a stale closure, the undo PATCH may reference a stale ID.

**Why it happens:** React stale closure over the appointment prop.

**How to avoid:** Capture `appointment.id` into a local variable before the toast call. `const appointmentId = appointment.id;` — this is safe because `id` is a primitive string.

### Pitfall 7: Time block Sheet re-open for edit — same Sheet, different mode

**What goes wrong:** Using two separate Sheet components (one for create, one for edit) — this causes the `open` state to conflict and the Sheet to flash on close/reopen.

**Why it happens:** D-03 says clicking a time block reopens the same Sheet in edit mode. This means one Sheet component with a `mode: 'create' | 'edit'` prop and a `selectedBlock` state.

**How to avoid:** Use a single `TimeBlockSheet` with `open={timeBlockSheetOpen}` controlled by page-level state. `selectedBlock` = null means create mode; `selectedBlock` = a block object means edit mode. This mirrors how the calendar page already has one `quickBookOpen` Sheet for both initial click and quick-book flow.

---

## Code Examples

### Existing `externalBlocks` feed into slot calculator (JS)

```javascript
// Source: src/app/api/appointments/available-slots/route.js lines 79-99
const [appointmentsResult, eventsResult, zonesResult, buffersResult] = await Promise.all([
  supabase.from('appointments').select('start_time, end_time, zone_id')
    .eq('tenant_id', tenant.id).neq('status', 'cancelled').gte('end_time', now.toISOString()),
  supabase.from('calendar_events').select('start_time, end_time')
    .eq('tenant_id', tenant.id).gte('end_time', now.toISOString()),
  // ...
]);

// Extend to 5-way parallel fetch:
const [appointmentsResult, eventsResult, zonesResult, buffersResult, blocksResult] = await Promise.all([
  // ... same as above ...
  supabase.from('calendar_blocks').select('start_time, end_time')
    .eq('tenant_id', tenant.id).gte('end_time', now.toISOString()),
]);

// Then merge:
externalBlocks: [...(eventsResult.data || []), ...(blocksResult.data || [])],
```

### Existing Python parallel gather extension

```python
# Source: livekit-agent/src/tools/check_availability.py lines 131-158
appointments_result, events_result, zones_result, buffers_result, blocks_result = await asyncio.gather(
    asyncio.to_thread(lambda: supabase.table("appointments")
      .select("start_time, end_time, zone_id")
      .eq("tenant_id", tenant_id)
      .not_("status", "in", '("cancelled","completed")')  # exclude completed
      .gte("end_time", now_iso).execute()),
    asyncio.to_thread(lambda: supabase.table("calendar_events")
      .select("start_time, end_time").eq("tenant_id", tenant_id)
      .gte("end_time", now_iso).execute()),
    asyncio.to_thread(lambda: supabase.table("service_zones")
      .select("id, name, postal_codes").eq("tenant_id", tenant_id).execute()),
    asyncio.to_thread(lambda: supabase.table("zone_travel_buffers")
      .select("zone_a_id, zone_b_id, buffer_mins").eq("tenant_id", tenant_id).execute()),
    asyncio.to_thread(lambda: supabase.table("calendar_blocks")
      .select("start_time, end_time").eq("tenant_id", tenant_id)
      .gte("end_time", now_iso).execute()),
)

# Merge calendar_blocks into external_blocks:
combined_external_blocks = (events_result.data or []) + (blocks_result.data or [])
```

### Supabase `.not_("status", "in", ...)` syntax for Python supabase-py

```python
# supabase-py uses PostgREST filter syntax
# For "NOT IN ('cancelled', 'completed')":
supabase.table("appointments").not_("status", "in", '("cancelled","completed")')
# Alternative — two .neq() calls:
supabase.table("appointments").neq("status", "cancelled").neq("status", "completed")
```

Confidence: HIGH — supabase-py `not_` method signature matches PostgREST docs. Two `.neq()` chained calls are the safer, more explicit approach.

### Existing `PATCH /api/appointments/[id]` branch pattern

```javascript
// Source: src/app/api/appointments/[id]/route.js
// Existing branches:
if ('conflict_dismissed' in body && body.calendar_event_id) { ... }
if (body.status === 'cancelled') { ... }
// New branches to add:
if (body.status === 'completed') { ... }
if (body.status === 'confirmed') { ... }  // for undo
```

---

## Runtime State Inventory

> Not applicable. This is a greenfield addition of a new table and new UI. No rename or migration of existing data. No stored strings that need updating across systems.

None — verified: no existing `calendar_blocks` table, no existing `completed_at` column (appointments.status already has `completed` in its CHECK constraint but the column carries no timestamp). The migration adds `completed_at timestamptz` as a new nullable column.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js build | Yes | v22.16.0 | — |
| Python 3 | livekit-agent tests | Yes | 3.13.3 | — |
| pytest | Agent unit tests | Yes (in pyproject.toml dev deps) | >=8.0 | — |
| Supabase CLI | Migration apply | Not verified locally | — | Apply via Supabase dashboard |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| **Next.js (main repo)** | Jest (project standard) |
| **Python (livekit-agent)** | pytest + pytest-asyncio |
| Config file | `pyproject.toml` (`[tool.pytest.ini_options]` section) |
| Quick run (agent) | `cd /c/Users/leheh/.Projects/livekit-agent && pytest tests/ -x -q` |
| Full suite (agent) | `cd /c/Users/leheh/.Projects/livekit-agent && pytest tests/` |

### Phase Requirements → Test Map

| Behavior | Test Type | Automated Command | Notes |
|----------|-----------|-------------------|-------|
| `calendar_blocks` table CRUD via API | Integration (manual or Supabase test) | Manual: POST/GET/PATCH/DELETE via curl | API route logic is thin CRUD; RLS verified via policy definitions |
| `check_availability` respects calendar blocks | Unit (Python) | `pytest tests/ -k "test_check_availability_blocks" -x` | New test file needed: `tests/test_check_availability_blocks.py` |
| Completed appointments excluded from slot calc | Unit (Python) | `pytest tests/ -k "test_slots_exclude_completed" -x` | Add test in existing or new file |
| Mark-complete PATCH handler | Manual curl test | `curl -X PATCH .../api/appointments/{id} -d '{"status":"completed"}'` | Route handler branch |
| Toast undo reverts to confirmed | Manual UI test | Manual | Sonner action callback; no unit-testable surface |
| Time blocks render behind appointments | Visual | Manual UI test | CSS z-index; not unit-testable |

### Wave 0 Gaps (Python agent tests)

- [ ] `tests/test_check_availability_blocks.py` — covers `calendar_blocks` parallel query and merge into `external_blocks`
- [ ] `tests/test_check_availability_blocks.py` — covers completed appointments excluded from slot calc (`.neq("status", "completed")` path)

*(No existing tests cover `check_availability` tool directly; the existing `test_caps.py`, `test_schedule.py`, `test_routes.py`, `test_security.py` cover Phase 39 webhook logic only. New test file needed for Phase 42 agent behavior.)*

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `UNIQUE (tenant_id, start_time)` on appointments | GiST exclusion constraint `appointments_no_overlap` (migration 019) | Phase 19 | Atomic booking now uses tsrange overlap, not just start_time uniqueness |
| `google_event_id` column on appointments | `external_event_id` + `external_event_provider` (migration 007) | Phase 8 | Supports both Google and Outlook |
| `high_ticket` urgency tier | `urgent` (migration 036) | Phase 36 | All URGENCY_STYLES and CHECK constraints use `urgent` now |

---

## Open Questions

1. **All-day block working hours fallback when tenant has no working hours configured**
   - What we know: CalendarView uses `DEFAULT_START = 7` and `DEFAULT_END = 20` when `workingHours` is null
   - What's unclear: Should the API use these constants or reject all-day block creation when no working hours are configured?
   - Recommendation: Use 07:00–20:00 fallback (mirroring CalendarView constants). Reject with 400 if the specific day is marked as closed (not enabled).

2. **Supabase `.not_("status", "in", ...)` syntax in supabase-py**
   - What we know: The `not_` method exists on supabase-py query builder; PostgREST supports `not.in.(val1,val2)`
   - What's unclear: Exact string quoting for the tuple in Python supabase-py (parentheses vs braces)
   - Recommendation: Use two chained `.neq()` calls for clarity and safety: `.neq("status", "cancelled").neq("status", "completed")`

3. **`undo` PATCH to `confirmed` — should `completed_at` be cleared?**
   - What we know: D-07 says undo reverts to `confirmed`. No mention of `completed_at`.
   - What's unclear: Should `completed_at` be set to NULL on undo?
   - Recommendation: Yes — set `completed_at = NULL` when reverting to `confirmed`. Clean state is preferable; a partially-written row with `completed_at` set but `status = 'confirmed'` could confuse future reporting logic.

---

## Sources

### Primary (HIGH confidence — code directly read)

- `src/components/dashboard/CalendarView.js` — `layoutEventsInLanes`, `AppointmentBlock`, `URGENCY_STYLES`, `HOUR_HEIGHT`, positioning math
- `src/components/dashboard/AppointmentFlyout.js` — cancel pattern, toast pattern, Sheet structure, `sonner` usage
- `src/app/dashboard/calendar/page.js` — state shape, `fetchData`, Sheet patterns, Realtime subscription
- `src/app/api/appointments/route.js` — GET response shape, `computeTravelBuffers`, `detectConflicts`, service role client usage
- `src/app/api/appointments/[id]/route.js` — PATCH branch pattern (cancelled + conflict_dismissed), `after()` usage
- `src/app/api/appointments/available-slots/route.js` — `calculateAvailableSlots` call with `externalBlocks`
- `livekit-agent/src/tools/check_availability.py` — 5-way gather pattern, `calculate_available_slots` call, `external_blocks` parameter
- `livekit-agent/src/lib/slot_calculator.py` — Python slot calculator signature and `external_blocks` handling
- `supabase/migrations/003_scheduling.sql` — appointments table with `status CHECK ('confirmed', 'cancelled', 'completed')` — confirmed `completed` already valid
- `supabase/migrations/042_call_routing_schema.sql` — most recent migration, confirmed numbering
- `supabase/migrations/043_appointments_realtime.sql` — confirmed 043 is taken; next is 044
- `.claude/skills/scheduling-calendar-system/SKILL.md` — full scheduling architecture
- `.planning/phases/42-calendar-essentials-time-blocks-and-mark-complete/42-CONTEXT.md` — locked decisions
- `.planning/config.json` — nyquist_validation: true (validation section required)

### Secondary (MEDIUM confidence)

- CSS `repeating-linear-gradient` diagonal hatching — standard CSS, widely supported in all modern browsers; no external source needed
- `sonner` `action` prop for toast — established API in sonner v1.x (already imported in project)

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all libraries verified as present in package.json / pyproject.toml
- Architecture: HIGH — all patterns derived directly from reading the existing source files
- Migration numbering: HIGH — 043 confirmed as existing, 044 confirmed as next
- `status = 'completed'` already valid: HIGH — read directly from `003_scheduling.sql` CHECK constraint
- `completed_at` column: HIGH — not in any migration; confirmed absent, must be added
- Python supabase-py `.not_` syntax: MEDIUM — recommend two `.neq()` calls as safer fallback
- Pitfalls: HIGH (derived from code reading) / MEDIUM (all-day fallback edge case)

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable libraries; 30-day window)

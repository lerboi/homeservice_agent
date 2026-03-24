# Phase 10: Dashboard Guided Setup and First-Run Experience — Research

**Researched:** 2026-03-23
**Domain:** Next.js 15 App Router dashboard UI — onboarding checklist, empty states, settings page buildout, test call panel adaptation
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Setup checklist**
- Top banner card on dashboard home page, above the stats grid
- Full-width card with progress bar and checklist items
- 6 total items with onboarding steps pre-checked for momentum:
  - [x] Create account (pre-checked from onboarding)
  - [x] Set up business profile (pre-checked from onboarding)
  - [x] Configure services (pre-checked from onboarding)
  - [ ] Connect Google Calendar — links to Settings > Calendar Connections
  - [ ] Configure working hours — links to Settings > Working Hours
  - [ ] Make a test call — links to Settings > AI Receptionist
- Each uncompleted item has an arrow/link to the relevant settings section
- Progress persists across sessions — stored in DB (not sessionStorage)
- Dismiss behavior: When all items complete, collapses to a small "Setup complete!" celebration bar with X to dismiss permanently. Dismiss state persisted in DB.

**Empty states (per-page)**
- Style: Lucide icon + 1-2 line description + action CTA button
- Pages needing empty states: Leads, Calendar, Analytics, Activity feed
- First-run only: Rich empty state with CTA shown only when page has NEVER had data. After first lead/appointment, filtered-to-zero uses simple "No results match your filters" text.

**Dashboard home welcome**
- When stats are all zeros AND activity feed is empty, show a welcome section below the checklist
- Disappears once any data exists

**Test call from dashboard**
- Two entry points: Checklist item links to Settings; Settings page has permanent "Test My AI" card
- Settings page inline card: Shows AI phone number + "Test My AI" button
- Flow: Reuses/adapts existing TestCallPanel component from onboarding — triggers call, polls /api/onboarding/test-call-status, shows success inline. No page navigation.
- Checklist auto-checks "Make a test call" when a completed call is detected

**Settings page buildout**
- Currently a stub — build out with 3 sections:
  1. Your AI Receptionist — phone number display + "Test My AI" button with inline polling
  2. Working Hours — reuse existing WorkingHoursEditor component
  3. Calendar Connections — reuse existing CalendarSyncCard component
- Sections are stacked cards, consistent with dashboard design language

**First-run guidance approach**
- No tooltips, no tour overlay, no coach marks
- Checklist banner + per-page empty states with CTAs are sufficient

### Claude's Discretion
- Exact checklist detection logic (how to determine which items are complete from DB state)
- Welcome section design and animation
- Empty state icon choices per page
- "Setup complete" celebration bar design
- How to differentiate first-run empty state vs filtered-to-zero (query-based or flag-based)
- Settings page section spacing and responsive layout
- TestCallPanel adaptation for settings context (removing onboarding-specific copy)

### Deferred Ideas (OUT OF SCOPE)
- "Invite team member" checklist item — requires team/invite feature (separate phase)
- Notification preferences in settings — already covered by onboarding contact step, future enhancement
</user_constraints>

---

<phase_requirements>
## Phase Requirements

Requirements are TBD — to be derived from success criteria during planning. The 5 success criteria from the ROADMAP define the behavioral contract:

| ID (proposed) | Behavior | Research Support |
|---------------|----------|-----------------|
| SETUP-01 | New owner after onboarding sees setup checklist with clear next steps; each item links directly to relevant action | Checklist component, DB completion detection, `/api/setup-checklist` endpoint |
| SETUP-02 | Every dashboard page with no data shows a helpful empty state (not blank); filter-zero shows simple text instead | Per-page empty state upgrade in Leads, Calendar, Analytics, Activity Feed |
| SETUP-03 | Owner can trigger test voice call from dashboard (Settings) and hear AI receptionist answer | TestCallPanel adaptation with `context='settings'` prop |
| SETUP-04 | Checklist progress persists across sessions; checklist auto-dismisses on full completion or manual dismiss | DB column `setup_checklist_dismissed` on `tenants` table, completion derived from existing DB fields |
| SETUP-05 | Non-technical user can identify what each section does within 30 seconds — met by sidebar labels + empty state descriptions | Empty state copy from UI-SPEC, no additional UI patterns needed |
</phase_requirements>

---

## Summary

Phase 10 is a pure frontend buildout with minimal backend surface area. The design contract (UI-SPEC) and interaction decisions (CONTEXT.md) are fully locked. The primary implementation work is: (1) a new `SetupChecklist` client component inserted above stats on the dashboard home, (2) a new API endpoint that derives checklist item completion from existing DB columns and returns/updates dismiss state, (3) upgraded empty states on Leads/Calendar/Analytics/Activity pages, (4) a full settings page replacing the current stub, and (5) a `TestCallPanel` adaptation for the settings context.

All dependencies — shadcn components (Card, Progress, Button, Separator, Skeleton), Lucide icons, Framer Motion (AnimatedSection), Supabase browser client — are already installed. No new packages are needed. All reusable components (WorkingHoursEditor, CalendarSyncCard, TestCallPanel, AnimatedSection) are confirmed present and their APIs are understood. The only new backend work is one new API route for checklist state management and one new Supabase migration adding `setup_checklist_dismissed` to the `tenants` table.

**Primary recommendation:** Build in component-first order: API endpoint + migration first (Wave 0 or Plan 1), then SetupChecklist, then Settings page, then empty state upgrades. Each wave is independently deliverable and testable.

---

## Standard Stack

### Core (all already installed — no npm install needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js 15 App Router | installed | Page routing, server/client components | Project standard |
| React 18 | installed | Component model | Project standard |
| shadcn/ui (new-york) | installed | Button, Card, Progress, Separator, Skeleton, Alert | Project standard — components.json confirms all required components present |
| lucide-react | installed | Icons (CheckCircle2, Circle, ArrowRight, Users, Calendar, BarChart3, Activity) | Project standard |
| framer-motion | installed | AnimatedSection entrance animations | Project standard (Phase 02.1 decision) |
| @supabase/ssr | installed | Supabase browser client for client components | Project standard |
| date-fns | installed | Timestamp formatting in RecentActivityFeed | Project standard |

**Installation:** None required. All packages confirmed present.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner | installed | Toast notifications (WorkingHoursEditor uses it) | Already wired in WorkingHoursEditor — no new integration needed |

### Alternatives Considered

None — stack is locked. No new libraries are being introduced.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   ├── api/
│   │   └── setup-checklist/
│   │       └── route.js          # NEW: GET checklist state, PATCH dismiss
│   ├── dashboard/
│   │   ├── page.js               # MODIFY: insert SetupChecklist above stats
│   │   └── settings/
│   │       └── page.js           # REBUILD: 3-section settings page
├── components/
│   └── dashboard/
│       ├── SetupChecklist.jsx     # NEW: full-width checklist banner card
│       ├── ChecklistItem.jsx      # NEW: single row with state (checked/unchecked)
│       ├── SetupCompleteBar.jsx   # NEW: collapsed celebration bar
│       └── WelcomeBanner.jsx      # NEW: zero-state welcome below checklist
supabase/migrations/
└── 005_setup_checklist.sql       # NEW: ADD COLUMN setup_checklist_dismissed to tenants
tests/
└── agent/
    └── setup-checklist.test.js   # NEW: API route unit tests
```

### Pattern 1: Checklist Completion Derived from Existing DB Columns

**What:** No new "checklist_items" table. Completion state is derived from existing tenant/services/calendar_credentials fields at read time.

**When to use:** Always — this avoids dual-write complexity and keeps completion state canonical.

**Derivation logic (confirmed from actual schema):**
```javascript
// Source: migrations 001-003, UI-SPEC implementation note 1
const items = [
  {
    id: 'create_account',
    label: 'Create account',
    complete: true,                          // always true post-auth
    locked: true,
  },
  {
    id: 'setup_profile',
    label: 'Set up business profile',
    complete: !!tenant.business_name,        // tenants.business_name IS NOT NULL
    locked: true,
  },
  {
    id: 'configure_services',
    label: 'Configure services',
    complete: serviceCount > 0,              // COUNT(services WHERE tenant_id AND is_active)
    locked: true,
  },
  {
    id: 'connect_calendar',
    label: 'Connect Google Calendar',
    complete: calendarConnected,             // calendar_credentials row with provider='google'
    href: '/dashboard/settings#calendar',
  },
  {
    id: 'configure_hours',
    label: 'Configure working hours',
    complete: !!tenant.working_hours,        // tenants.working_hours IS NOT NULL
    href: '/dashboard/settings#hours',
  },
  {
    id: 'make_test_call',
    label: 'Make a test call',
    complete: tenant.onboarding_complete,    // tenants.onboarding_complete = true (set by Retell webhook on call completion)
    href: '/dashboard/settings#ai',
  },
];
```

**Key insight:** `onboarding_complete` is the correct signal for "Make a test call" — it is set by the Retell webhook on confirmed call completion (Phase 07 decision). `test_call_completed` also exists on tenants (migration 002) but `onboarding_complete` is the authoritative signal used everywhere else.

### Pattern 2: Single API Endpoint for Checklist State

**What:** `/api/setup-checklist` GET returns derived completion + dismissed state. PATCH sets `setup_checklist_dismissed = true`.

**When to use:** Called on dashboard home load, updated on dismiss.

```javascript
// GET /api/setup-checklist
// Returns: { items: [...], dismissed: boolean, completedCount: number }

// PATCH /api/setup-checklist
// Body: { dismissed: true }
// Returns: { ok: true }
```

**Query pattern (parallel fetch, established pattern from dashboard/page.js):**
```javascript
// Source: existing pattern in src/app/dashboard/page.js useEffect
const [tenantData, serviceCountData, calendarData] = await Promise.allSettled([
  supabase.from('tenants').select('business_name, working_hours, onboarding_complete, retell_phone_number, setup_checklist_dismissed').eq('owner_id', userId).single(),
  supabase.from('services').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('is_active', true),
  supabase.from('calendar_credentials').select('id').eq('tenant_id', tenantId).eq('provider', 'google').maybeSingle(),
]);
```

**Note on direct Supabase vs API route:** The checklist state needs aggregation from 3 tables. Use an API route (not direct Supabase browser client) so the service role key handles joins and the client side avoids RLS complexity. This matches the pattern used by `/api/onboarding/test-call-status` which aggregates tenant data.

### Pattern 3: TestCallPanel Context Prop Adaptation

**What:** Add `context` prop (`'onboarding' | 'settings'`) to existing TestCallPanel. When `context='settings'`, suppress CelebrationOverlay and onboarding-specific headings; replace "Go to Dashboard" button with inline success message.

**When to use:** Settings page SettingsAISection.

```javascript
// Source: src/components/onboarding/TestCallPanel.js — confirmed API
// Current: TestCallPanel({ phoneNumber, onComplete, onGoToDashboard })
// Modified: TestCallPanel({ phoneNumber, onComplete, onGoToDashboard, context = 'onboarding' })

// In complete state:
if (callState === 'complete') {
  if (context === 'settings') {
    // Inline success — no CelebrationOverlay, no navigation
    return (
      <div className="flex items-center gap-2 text-[#166534]">
        <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
        <span className="text-sm font-medium">Test call complete. Your AI is working!</span>
      </div>
    );
  }
  // existing onboarding complete state...
}
```

**Note:** TestCallPanel already uses `onComplete` callback — the checklist auto-check on test call completion can be wired via this callback when the panel is used in settings.

### Pattern 4: First-Run vs Filter-Zero Empty State Distinction

**What:** Leads page already has the correct pattern implemented. Extend it to other pages.

**Confirmed from `src/app/dashboard/leads/page.js`:**
```javascript
// Source: leads/page.js lines 260-278 — already correct
} else if (leads.length === 0 && !isFiltered) {
  // First-run / truly empty → rich empty state with CTA
} else if (leads.length === 0 && isFiltered) {
  // Filtered to zero → simple "no results" text
}
```

**For Calendar page:** The calendar always shows a grid — empty state applies to the "Today's Agenda" sidebar (`todayAppts.length === 0`) and potentially the main grid when no appointments exist in the visible window. The page does not have a concept of "filters" in the same way — treat any window with zero appointments as the empty state if no appointments exist in the DB at all (determined by a separate count query or a prop from the parent).

**For Analytics page:** `AnalyticsCharts` receives `leads` array. If `leads.length === 0` and not in a filtered state, show empty state above/instead of charts.

### Pattern 5: Settings Page Structure

**What:** Convert `settings/page.js` from server stub to `'use client'` component with 3 stacked Card sections.

**Why `'use client'`:** TestCallPanel requires client-side polling state. WorkingHoursEditor and CalendarSyncCard already have their own `'use client'` boundaries so they would work as islands, but wrapping the page in `'use client'` is cleaner given all 3 sections are interactive.

```javascript
// Source: UI-SPEC layout specification
'use client';

// Three sections, each a Card with p-6 rounded-2xl border-stone-200/60
// Section 1: SettingsAISection — fetches retell_phone_number from tenant, renders adapted TestCallPanel
// Section 2: SettingsHoursSection — wraps WorkingHoursEditor (already self-contained, fetches /api/working-hours internally)
// Section 3: SettingsCalendarSection — wraps CalendarSyncCard (already self-contained, fetches /api/calendar-sync/status internally)
```

**WorkingHoursEditor and CalendarSyncCard are fully self-contained.** They fetch their own data and save their own changes. No props needed — just render them. Settings page only needs to fetch `retell_phone_number` for the AI section.

### Anti-Patterns to Avoid

- **Storing checklist item completion in a separate table:** Completion is always derived from existing columns. A separate table creates dual-write complexity.
- **Using sessionStorage for checklist dismiss:** The decision is DB persistence. sessionStorage would reset on new devices/browsers.
- **Triggering AnimatedSection with `whileInView` for the checklist:** The checklist is above the fold on dashboard home — `whileInView` may not trigger if the element is already visible on mount. Use `animate` (always-run) instead of `whileInView`, or ensure the initial animation runs immediately. Alternatively, use a simpler CSS transition.
- **Making settings page a server component:** TestCallPanel's polling `useEffect` requires client context.
- **Passing all checklist data through context/global state:** Fetch on mount in SetupChecklist, pass completion callbacks down as props. Avoid Context for this one-page use.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Progress bar | Custom div width calculation | shadcn `Progress` component | Already installed, accessible `role="progressbar"` built-in |
| Icon checkmarks | Custom SVG | `lucide-react` CheckCircle2, Circle | Already imported in project |
| Dismiss animation | Raw CSS transitions | Framer Motion inline `motion.div` with `animate={{ opacity, scaleY }}` | Already used for AnimatedSection; handles reduced-motion via useReducedMotion |
| Polling loop | setInterval + manual cleanup | Existing TestCallPanel polling (already built) | Proven, tested, handles timeout after 180s |
| Toast notifications | Custom alert | sonner (already wired in WorkingHoursEditor) | Consistent with existing pattern |
| Supabase auth check | Manual JWT parse | `createSupabaseServer()` in API routes (established pattern) | RLS-safe, matches all other API routes |

**Key insight:** Every UI building block for this phase already exists in the project. This phase is pure assembly — connecting existing components into the correct structure.

---

## Common Pitfalls

### Pitfall 1: AnimatedSection whileInView Doesn't Trigger Above the Fold

**What goes wrong:** `AnimatedSection` uses `whileInView` which fires when the element enters the viewport. The checklist banner is the FIRST element on the dashboard home — it's visible on mount without scrolling. Framer Motion's `whileInView` may not fire if the element is already in view on initial render depending on the `margin` setting.

**Why it happens:** `whileInView` + `viewport={{ once: true, margin: '-80px' }}` (current AnimatedSection config) requires the element to enter the viewport from outside. An element already in view may not trigger.

**How to avoid:** Use `motion.div` with `animate` (always triggers on mount) instead of `whileInView` for the checklist, or set `viewport={{ once: true, margin: '0px' }}` and test. Alternatively, use a simple CSS `@keyframes` fade-in on mount, consistent with the project's `draw-in` pattern.

**Warning signs:** Checklist appears with no animation on page load in dev mode.

### Pitfall 2: Settings Page Fetching Phone Number Before Tenant Exists

**What goes wrong:** Settings page needs `retell_phone_number` from tenant to display in AI section. If fetched before tenant row is populated, returns null and displays empty.

**Why it happens:** `retell_phone_number` is set during onboarding provisioning (Phase 02). All Phase 10 users have completed onboarding, so this should always be set — but null handling is still required.

**How to avoid:** Display a skeleton while loading, show "Phone number not yet assigned" if null. Don't crash — `retell_phone_number` can be null for tenants who didn't complete phone provisioning.

### Pitfall 3: Checklist Dismissed Flag Causes Flash of Content

**What goes wrong:** On dashboard home load, checklist is shown (default state), then API returns `dismissed: true`, causing a visible layout shift as the checklist collapses.

**Why it happens:** Optimistic render assumes checklist is visible, API call takes ~200ms.

**How to avoid:** Initialize checklist state as `null` (loading), render a `Skeleton` placeholder during load, only render the real checklist or nothing once data is fetched. Match the same skeleton height to the expected checklist height to prevent layout shift.

### Pitfall 4: Calendar Empty State Shows on Every Navigation

**What goes wrong:** Calendar page fetches a week/day window — there may be zero appointments in the current window even for active users. The "No appointments yet" empty state would show when browsing future weeks.

**Why it happens:** The empty state condition `appointments.length === 0` conflates "never had data" with "no data in this time window."

**How to avoid:** The calendar empty state (per CONTEXT.md) is specifically for the "Today's Agenda" sidebar. The main calendar grid always renders (it shows empty time slots). Only show the rich empty state for Today's Agenda when the user has no appointments ever — determine this via a separate lightweight API call or by using the `data.appointments` array length at the global level (if fetching all appointments returns 0, it's first-run). The simpler approach: show the rich empty state only when `data.appointments.length === 0` AND no filters are active AND the current week includes today (i.e., not browsing the future).

### Pitfall 5: `setup_checklist_dismissed` Column Missing in Production

**What goes wrong:** Settings page or checklist API route crashes because `setup_checklist_dismissed` column doesn't exist on `tenants` table.

**Why it happens:** Migration not run before deployment.

**How to avoid:** The migration (`005_setup_checklist.sql`) must run before any code depending on this column is deployed. It is the first task of Wave 0/Plan 1.

### Pitfall 6: Checklist Auto-Check Race Condition

**What goes wrong:** User completes a test call from settings. `onComplete` callback fires. Checklist component re-fetches state. The Retell webhook sets `onboarding_complete = true` asynchronously — the refetch may run before the webhook completes.

**Why it happens:** The Retell webhook processes after the call ends, with inherent delay. TestCallPanel polls `/api/onboarding/test-call-status` which returns `complete: tenant.onboarding_complete`. The polling resolves when the webhook has already set the flag.

**How to avoid:** No issue in practice — TestCallPanel only resolves the `complete` state after the status endpoint confirms `onboarding_complete = true`, which means the webhook has already run. When the checklist refetches after `onComplete`, the flag is guaranteed to be set.

---

## Code Examples

### SetupChecklist: Skeleton Loading Pattern

```jsx
// Pattern: initialize as null, show skeleton, avoid layout shift
// Source: established pattern from DashboardHomeStats (src/components/dashboard/DashboardHomeStats.jsx)

function ChecklistSkeleton() {
  return (
    <div className="rounded-2xl border border-stone-200/60 p-6 bg-white space-y-4">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-2 w-full rounded-full" />
      <div className="space-y-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
    </div>
  );
}
```

### API Route Pattern: Parallel Supabase Queries

```javascript
// Pattern: Promise.allSettled with multiple Supabase queries
// Source: established pattern from src/app/dashboard/page.js lines 34-41

export async function GET() {
  const serverSupabase = await createSupabaseServer();
  const { data: { user } } = await serverSupabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // Use service-role supabase (from @/lib/supabase) for joins across tenant boundary
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, business_name, working_hours, onboarding_complete, retell_phone_number, setup_checklist_dismissed')
    .eq('owner_id', user.id)
    .single();

  if (!tenant) return Response.json({ error: 'Tenant not found' }, { status: 404 });

  const [serviceResult, calendarResult] = await Promise.allSettled([
    supabase.from('services').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('is_active', true),
    supabase.from('calendar_credentials').select('id').eq('tenant_id', tenant.id).eq('provider', 'google').maybeSingle(),
  ]);

  const serviceCount = serviceResult.status === 'fulfilled' ? (serviceResult.value.count ?? 0) : 0;
  const calendarConnected = calendarResult.status === 'fulfilled' ? !!calendarResult.value.data : false;

  const items = deriveChecklistItems(tenant, serviceCount, calendarConnected);

  return Response.json({
    items,
    dismissed: tenant.setup_checklist_dismissed ?? false,
    completedCount: items.filter(i => i.complete).length,
  });
}
```

### Empty State Component Pattern

```jsx
// Source: existing pattern in leads/page.js lines 260-267, extended with icon + CTA
// All empty state components follow this structure

import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export function EmptyStateLeads() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Users className="h-10 w-10 text-stone-300 mb-4" aria-hidden="true" />
      <h2 className="text-base font-semibold text-[#0F172A] mb-2">No leads yet</h2>
      <p className="text-sm text-[#475569] max-w-sm mb-6">
        When callers reach your AI, leads appear here with caller details, job type, and urgency.
      </p>
      <Button asChild>
        <Link href="/dashboard/settings#ai">Make a Test Call</Link>
      </Button>
    </div>
  );
}
```

### SetupCompleteBar Dismiss Animation

```jsx
// Pattern: Framer Motion layout animation for dismiss
// Source: AnimatedSection pattern from src/app/components/landing/AnimatedSection.jsx

import { motion, useReducedMotion } from 'framer-motion';

export function SetupCompleteBar({ onDismiss }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={prefersReducedMotion
        ? { opacity: 0 }
        : { opacity: 0, scaleY: 0, transformOrigin: 'top' }
      }
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="flex items-center justify-between py-3 px-6 rounded-2xl bg-[#C2410C]/[0.06] border border-[#C2410C]/20"
    >
      {/* ... content ... */}
    </motion.div>
  );
}
// Wrap parent in <AnimatePresence> to enable exit animation
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tooltip tours (Shepherd.js, Intro.js) | Contextual empty states + inline checklist | Design decision Phase 10 | Simpler, no JS library, works without user interaction |
| Separate checklist_items DB table | Derive from existing columns | Design decision Phase 10 | No migration complexity, always in sync |
| Celebration overlay on test call complete | Inline success message (settings context) | Phase 10 adaptation | CelebrationOverlay is onboarding-specific, settings needs subtler feedback |

**Deprecated/outdated:**
- Current RecentActivityFeed empty state: plain `<p>No recent activity</p>` — will be upgraded to rich empty state with Activity icon.
- Current leads page empty state: text-only — will be upgraded with Lucide icon and "Make a Test Call" CTA (icon + CTA added, existing "no filters" path preserved).

---

## Open Questions

1. **Calendar page first-run detection**
   - What we know: Calendar page fetches appointments for a time window. Zero appointments in a window ≠ first-run.
   - What's unclear: The CONTEXT.md says the empty state is for "when your AI books jobs" — implying the main calendar, but the UI-SPEC only references "Today's Agenda" sidebar.
   - Recommendation: Scope the rich empty state to Today's Agenda sidebar only. For the main calendar grid, a windowed time period with no appointments is a normal operational state (non-working days, future dates). Planner should confirm which element gets the rich empty state.

2. **Settings page anchor-link navigation from checklist**
   - What we know: Checklist items link to `/dashboard/settings#calendar`, `/dashboard/settings#hours`, `/dashboard/settings#ai`
   - What's unclear: Next.js App Router does not natively scroll to anchor links within the same page on client-side navigation. An `id` on each section + `scrollIntoView` on hash change may be needed.
   - Recommendation: Add `id="ai"`, `id="hours"`, `id="calendar"` to each settings Card, and a `useEffect` that reads `window.location.hash` on mount and calls `document.getElementById(hash).scrollIntoView()`. This is a 5-line addition to the settings page.

3. **`test_call_completed` vs `onboarding_complete` for checklist item 6**
   - What we know: Migration 002 added `test_call_completed` column. The onboarding system uses `onboarding_complete` as the primary flag (Phase 07 decision).
   - What's unclear: Are both columns updated consistently? `test_call_completed` may reflect any test call, while `onboarding_complete` reflects the wizard finale.
   - Recommendation: Use `onboarding_complete` as the checklist signal, consistent with the test-call-status endpoint which already reads this field. `test_call_completed` appears to be a redundant column — do not add another dependency on it.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest (ESM, node environment) |
| Config file | `jest.config.js` (project root) |
| Quick run command | `node node_modules/jest-cli/bin/jest.js tests/agent/setup-checklist.test.js --no-coverage` |
| Full suite command | `node node_modules/jest-cli/bin/jest.js --no-coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SETUP-01 | Checklist API returns correct completion state from DB fields | unit | `node node_modules/jest-cli/bin/jest.js tests/agent/setup-checklist.test.js -x` | ❌ Wave 0 |
| SETUP-01 | Items with `locked: true` always show as complete regardless of DB | unit | same | ❌ Wave 0 |
| SETUP-02 | Leads page renders rich empty state when zero leads and no filters | manual | Load /dashboard/leads with empty DB | manual |
| SETUP-03 | TestCallPanel with `context='settings'` shows inline success (no overlay) | manual | Complete test call on settings page | manual |
| SETUP-04 | PATCH /api/setup-checklist sets dismissed=true and persists across reload | unit | `node node_modules/jest-cli/bin/jest.js tests/agent/setup-checklist.test.js -x` | ❌ Wave 0 |
| SETUP-05 | 30-second comprehension test | manual-only | User test on staging | manual |

### Sampling Rate
- **Per task commit:** `node node_modules/jest-cli/bin/jest.js tests/agent/setup-checklist.test.js --no-coverage`
- **Per wave merge:** `node node_modules/jest-cli/bin/jest.js --no-coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/agent/setup-checklist.test.js` — covers SETUP-01, SETUP-04 (API route unit tests)
- [ ] `supabase/migrations/005_setup_checklist.sql` — adds `setup_checklist_dismissed` column before any code uses it

---

## Sources

### Primary (HIGH confidence)

- Source code inspection: `src/app/dashboard/page.js` — confirmed data fetching pattern (parallel Promise.allSettled, useEffect)
- Source code inspection: `src/components/onboarding/TestCallPanel.js` — confirmed current API: `{ phoneNumber, onComplete, onGoToDashboard }`, all 5 states (`ready → calling → in_progress → complete → timeout`)
- Source code inspection: `src/components/dashboard/WorkingHoursEditor.js` — confirmed self-contained (fetches own data from `/api/working-hours`, saves own changes, no props required)
- Source code inspection: `src/components/dashboard/CalendarSyncCard.js` — confirmed self-contained (fetches own data from `/api/calendar-sync/status`, no props required)
- Source code inspection: `src/components/dashboard/RecentActivityFeed.jsx` — confirmed current empty state is minimal text only (upgrade candidate)
- Source code inspection: `src/app/dashboard/leads/page.js` — confirmed first-run vs filter-zero pattern already implemented
- Source code inspection: `supabase/migrations/001-003` — confirmed all relevant DB columns: `business_name`, `working_hours`, `onboarding_complete`, `retell_phone_number`, `test_call_completed`, services table, calendar_credentials table
- Source code inspection: `src/app/components/landing/AnimatedSection.jsx` — confirmed API: `{ children, className, delay, direction }`, uses `whileInView` (pitfall noted)
- Source code inspection: `.planning/phases/10-dashboard-guided-setup-and-first-run-experience/10-UI-SPEC.md` — full design contract: component inventory, copy, colors, animation, accessibility
- Source code inspection: `src/app/api/onboarding/test-call-status/route.js` — confirmed endpoint already exists, returns `{ complete, retell_phone_number }`
- Source code inspection: `.planning/config.json` — `nyquist_validation: true` confirmed

### Secondary (MEDIUM confidence)

- Next.js App Router docs pattern: anchor link scrolling behavior in SPA navigation (recommendation for `useEffect` + `scrollIntoView` — standard workaround)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed present via source code inspection
- Architecture: HIGH — all patterns derived from existing code in the repo
- Pitfalls: HIGH — derived from actual code behavior, schema inspection, and established project decisions
- Checklist completion logic: HIGH — all source columns confirmed in migrations

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (stable domain — Next.js/shadcn/Supabase patterns don't change fast)

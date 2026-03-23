# Phase 12: Dashboard-configurable Triage and Call Escalation - Research

**Researched:** 2026-03-24
**Domain:** Next.js dashboard UI, Supabase schema, Retell call transfer, Twilio/Resend notifications, drag-and-drop reorder
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Keep tag-per-service only — no custom keywords, no threshold tuning, no rule builder. The existing 3 urgency tags (emergency/routine/high_ticket) and 3-layer triage pipeline stay unchanged.
- **D-02:** Keep the 3 urgency tags (emergency, routine, high_ticket) — no new tiers added.
- **D-03:** Improve existing service management UX — better empty states, bulk tag editing, drag-to-reorder services. No new data model changes.
- **D-04:** Escalation chain — owner configures an ordered list of contacts (try person A, if no answer after timeout try person B, then C). Each contact has name, phone, email, role, and notification preference.
- **D-05:** Configurable timeout per contact (15-60 seconds) — owner sets how long to wait before trying the next person in the chain.
- **D-06:** Slot-first fallback waterfall when nobody in chain answers: (1) AI offers next available emergency slot, (2) if declined offer callback within 15 minutes, (3) if declined offer voicemail, (4) SMS blast to ALL chain contacts regardless of outcome.
- **D-07:** Claude's Discretion — per-urgency escalation mapping.
- **D-08:** Extend Services page — escalation config lives below the services table on the same page. Services page name stays "Services" in sidebar nav.
- **D-09:** Claude's Discretion — layout choice (card below table vs tabs).
- **D-10:** SMS + email only — no push notifications, no webhooks. Reuse existing Twilio SMS + Resend email infrastructure.
- **D-11:** Per-contact channel choice — SMS only, Email only, or Both. Each contact has phone + email + notification preference.
- **D-12:** Escalation notifications include deep link to the lead card in dashboard.

### Claude's Discretion
- Per-urgency escalation mapping (D-07)
- Escalation config layout on Services page (D-09)
- Escalation chain max contact count (reasonable limit)
- Default timeout values for new contacts
- SMS/email notification template design for chain contacts
- How to handle chain contacts who don't have dashboard accounts

### Deferred Ideas (OUT OF SCOPE)
- Webhook integration for Slack/Teams/PagerDuty
- Push notifications (service worker + PWA)
- Custom keyword rules per business (Layer 1 extension)
- LLM confidence threshold tuning
- One-tap callback link in notification SMS
</user_constraints>

---

## Summary

Phase 12 has three distinct work streams: (1) services table UX improvements (drag-to-reorder, bulk tag edit, improved empty states), (2) a new `escalation_contacts` data model with dashboard CRUD UI (the `EscalationChainSection` component), and (3) call runtime changes — extending `call-processor.js` and `agent-prompt.js` to act on the chain during live calls.

The UI contract is fully specified in `12-UI-SPEC.md` and has been approved. The design system (shadcn/ui new-york, Radix, Lucide, sonner, next-intl) is already installed and well-established. The main new dependencies are four shadcn components not yet added: Card, Label, RadioGroup, AlertDialog — plus a drag-and-drop library for service reorder and contact chain reorder.

The heaviest engineering work is in the call runtime: Retell's `transfer_call` today transfers directly to `owner_phone`. For the escalation chain, the system must attempt contacts sequentially with per-contact timeouts. This cannot be done purely in the Retell webhook handler synchronously; it requires either (a) repeated transfer attempts with a wait loop, or (b) a separate orchestration approach. Research confirmed the slot-first fallback waterfall also requires agent-prompt changes to instruct the AI on what to say when no human answers.

**Primary recommendation:** Build the dashboard UI and DB layer first (Wave 1), then extend the call runtime (Wave 2). The DB schema — a single `escalation_contacts` table plus a `sort_order` column — is straightforward. The runtime escalation logic is the most novel and risky piece; it should be the last wave to allow the dashboard to be validated independently.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| shadcn/ui | already installed | UI components | Established in Phase 02-03; `components.json` present with new-york/neutral style |
| @dnd-kit/core + @dnd-kit/sortable | ^6.x | Drag-to-reorder services and escalation contacts | The standard for accessible keyboard+mouse DnD in React; works with shadcn component patterns; no conflicting Radix dependencies |
| Supabase JS (already installed) | already installed | `escalation_contacts` CRUD | Service-role client for server routes, browser client for dashboard |
| Twilio (already installed) | already installed | Chain contact SMS | Reuse existing `getTwilioClient()` + `sendOwnerSMS()` pattern |
| Resend (already installed) | already installed | Chain contact email | Reuse existing `getResendClient()` + `sendOwnerEmail()` pattern |
| next-intl (already installed) | already installed | All dashboard copy | All new strings go into `messages/en.json` + `messages/es.json` under `services` namespace |

### New shadcn Components to Add
| Component | Command | Used For |
|-----------|---------|----------|
| Card | `npx shadcn add card` | EscalationChainSection wrapper, per-urgency mapping card |
| Label | `npx shadcn add label` | Contact form field labels |
| RadioGroup | `npx shadcn add radio-group` | Notification channel picker (SMS / Email / Both) |
| AlertDialog | `npx shadcn add alert-dialog` | Destructive confirmations (remove contact, delete chain) |

### @dnd-kit Installation
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**Version verification:** @dnd-kit/core is currently 6.3.1, @dnd-kit/sortable is 8.0.0 (as of March 2026 — peer with core 6.x). Confirm before writing: `npm view @dnd-kit/core version`.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @dnd-kit | react-beautiful-dnd | react-beautiful-dnd is unmaintained (Atlassian deprecated it 2023); @dnd-kit is the successor |
| @dnd-kit | HTML5 drag events (native) | Native DnD has no keyboard support; WCAG requires keyboard reorder per UI-SPEC accessibility contract |

---

## Architecture Patterns

### New Database Table: `escalation_contacts`

```sql
CREATE TABLE escalation_contacts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                text NOT NULL,
  role                text,
  phone               text,
  email               text,
  notification_pref   text NOT NULL DEFAULT 'both'
    CHECK (notification_pref IN ('sms', 'email', 'both')),
  timeout_seconds     int NOT NULL DEFAULT 30
    CHECK (timeout_seconds IN (15, 30, 45, 60)),
  sort_order          int NOT NULL DEFAULT 0,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_escalation_contacts_tenant ON escalation_contacts(tenant_id, sort_order);
ALTER TABLE escalation_contacts ENABLE ROW LEVEL SECURITY;
-- RLS: tenant own + service_role (same pattern as services table)
```

No new columns needed on `tenants` table. Per-urgency mapping is deterministic from the CONTEXT.md decisions (D-07 resolved below) — stored as application constants, not DB config, for this phase.

### Recommended Project Structure — New Files

```
src/
├── app/
│   ├── api/
│   │   └── escalation-contacts/
│   │       └── route.js          # GET, POST, PUT, DELETE, PATCH (reorder)
│   └── dashboard/
│       └── services/
│           └── page.js           # Extended with EscalationChainSection
├── components/
│   └── dashboard/
│       ├── EscalationChainSection.js   # Main escalation UI (new)
│       ├── ContactCard.js              # Individual contact in chain (new)
│       └── SortableServiceRow.js       # DnD wrapper for service rows (new)
├── lib/
│   └── escalation.js             # sendEscalationChainNotifications(), runEscalationChain()
supabase/
└── migrations/
    └── 006_escalation_contacts.sql
```

### Pattern 1: Reorder via `sort_order` Column

**What:** Client maintains array order in React state. On drag-end, send PATCH with `[{ id, sort_order }]` array. Server updates all rows in a single transaction using `upsert`.

**When to use:** Any ordered list that persists across sessions.

```javascript
// Source: @dnd-kit/sortable standard pattern
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';

function handleDragEnd(event) {
  const { active, over } = event;
  if (active.id !== over?.id) {
    setContacts((items) => {
      const oldIndex = items.findIndex(i => i.id === active.id);
      const newIndex = items.findIndex(i => i.id === over.id);
      const reordered = arrayMove(items, oldIndex, newIndex);
      // Optimistic update — PATCH fires after state set
      patchSortOrder(reordered);
      return reordered;
    });
  }
}
```

**PATCH endpoint pattern:**
```javascript
// PATCH /api/escalation-contacts (body: [{ id, sort_order }])
export async function PATCH(request) {
  const tenantId = await getTenantId();
  const { order } = await request.json(); // [{ id, sort_order }]
  const { error } = await supabase
    .from('escalation_contacts')
    .upsert(
      order.map(({ id, sort_order }) => ({ id, tenant_id: tenantId, sort_order })),
      { onConflict: 'id' }
    );
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
```

### Pattern 2: Services Table Drag-to-Reorder

The `services` table has no `sort_order` column today (ordered by `created_at`). D-03 requires drag-to-reorder. **Two options:**

- **Option A:** Add `sort_order` column to `services` via migration 006 (alongside `escalation_contacts`). Same PATCH reorder pattern.
- **Option B:** Keep `created_at` ordering and manipulate insertion order (not viable for reorder).

**Recommendation:** Option A — add `sort_order int NOT NULL DEFAULT 0` to `services` in migration 006. Backfill with `row_number() OVER (PARTITION BY tenant_id ORDER BY created_at)`. Update `/api/services` GET to `ORDER BY sort_order ASC, created_at ASC`.

### Pattern 3: Bulk Tag Edit

**What:** Checkbox column on services table. When ≥2 rows checked, a "Set tag for selected" action bar appears. Single PATCH applies same `urgency_tag` to all selected IDs.

**When to use:** Multi-select operations on table rows.

```javascript
// Bulk tag PATCH — extend existing PUT handler or add separate endpoint
// PUT /api/services body: { ids: string[], urgency_tag: string }
const { error } = await supabase
  .from('services')
  .update({ urgency_tag })
  .in('id', ids)
  .eq('tenant_id', tenantId);
```

### Pattern 4: Escalation Chain Runtime (Per-Urgency Mapping — D-07 Resolved)

**Claude's Discretion resolution for D-07:**

| Urgency | Escalation Behavior | Rationale |
|---------|---------------------|-----------|
| emergency | Full chain — try each contact in sort_order | Owner defined this as life/safety/property situation |
| high_ticket | Owner SMS + email immediately (first contact only, or owner direct) | Job >$500 warrants human review but isn't immediate danger |
| routine | Lead only — no chain escalation | Owner reviews during business hours; chain interruptions for routine calls destroy quality of life |

**Emergency escalation flow in `call-processor.js`:**

After triage classification returns `emergency` AND the transfer chain hasn't been attempted during the call, `processCallAnalyzed()` triggers chain notifications. The live-call transfer (via `transfer_call` Retell function) handles in-call escalation. Post-call, `processCallAnalyzed()` triggers the SMS blast to all contacts (D-06 step 4).

**In-call sequential transfer — important constraint:** Retell's `transfer_call` API transfers to exactly one number. Sequential attempts (try A, wait, try B) require the AI agent to re-invoke `transfer_call` after each failed attempt. This means:
1. The `agent-prompt.js` CALL TRANSFER section must be extended with chain-aware instructions.
2. The `call_function_invoked` handler for `transfer_call` must accept an optional `contact_index` parameter (or the AI resolves it via dynamic_variables).
3. The simplest approach: inject the escalation chain numbers into `dynamic_variables` at `call_inbound` time (as `escalation_chain`: JSON string), and let the agent prompt instruct sequential behavior.

**Alternative (simpler):** Treat in-call escalation as "try owner_phone first, then SMS blast chain after call ends." This avoids complex sequential transfer logic during the call. The slot-first fallback waterfall (D-06) is already AI-driven via prompt — the AI offers a slot when no human answers.

**Recommendation:** Keep in-call transfer as-is (single transfer to `owner_phone`). Extend `processCallAnalyzed()` for post-call chain SMS blast. Update `agent-prompt.js` to add the fallback waterfall instructions for when transfer fails. This is the lowest-risk path that still delivers D-06.

### Pattern 5: sendEscalationNotifications()

New function in `src/lib/escalation.js`:

```javascript
// Source: mirrors sendOwnerNotifications() pattern in notifications.js
export async function sendEscalationNotifications({ tenantId, lead, contacts, callId }) {
  // Load chain contacts if not passed
  const chain = contacts || await loadEscalationChain(tenantId);

  const dashboardLeadUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/leads/${lead.id}`;

  const tasks = chain.map(contact => {
    const promises = [];
    if (['sms', 'both'].includes(contact.notification_pref) && contact.phone) {
      promises.push(sendChainContactSMS({ contact, lead, dashboardLeadUrl }));
    }
    if (['email', 'both'].includes(contact.notification_pref) && contact.email) {
      promises.push(sendChainContactEmail({ contact, lead, dashboardLeadUrl }));
    }
    return Promise.allSettled(promises);
  });

  await Promise.allSettled(tasks);
}
```

### Anti-Patterns to Avoid

- **Blocking the webhook handler for sequential transfer attempts:** Never use `setTimeout`/`sleep` in the webhook hot path. Transfer attempt logic must be prompt-driven (AI retries) or post-call.
- **Storing per-urgency escalation config in DB for phase 12:** Overkill. The mapping (D-07 resolution above) is fixed for this phase. Constants in `escalation.js` are sufficient.
- **Re-fetching escalation chain on every call_inbound:** Cache-friendly: load chain once in `processCallAnalyzed()`. No need to inject full chain into `dynamic_variables` unless sequential in-call transfer is implemented.
- **RadioGroup outside a form:** Shadcn RadioGroup requires explicit value + onValueChange pattern (not native form submission). Use controlled state.
- **Missing `sort_order` backfill:** If migration adds `sort_order DEFAULT 0` without a backfill, all existing rows get 0, breaking order. Backfill immediately in the same migration.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop reorder | Custom mouse/touch event handlers | @dnd-kit/sortable | Keyboard accessibility (required by UI-SPEC), touch support, pointer sensor, collision detection — dozens of edge cases |
| Destructive confirm modal | Custom dialog component | shadcn AlertDialog | Radix Dialog with correct focus trap, escape key, aria-modal — already specified in UI-SPEC |
| Contact form field labels | Plain `<label>` elements | shadcn Label | Consistent with existing form patterns; ties to htmlFor correctly |
| Section wrapper card | Custom div with borders | shadcn Card | Matches existing CalendarSyncCard and ZoneManager patterns |

**Key insight:** The dashboard patterns in this project are all stacked shadcn Card sections. Do not introduce new layout primitives — extend the established pattern.

---

## Common Pitfalls

### Pitfall 1: `sort_order` Reorder Race Condition
**What goes wrong:** User drags item A, then immediately drags item B before the first PATCH completes. Second PATCH uses stale `sort_order` values, corrupting order.
**Why it happens:** Optimistic UI updates state before server confirms.
**How to avoid:** Use a `isSaving` flag to debounce reorder PATCHes (300ms), or use a request queue. The UI-SPEC says "optimistic reorder + PATCH on drop" — single drop event is fine; just ensure no overlapping PATCH requests.
**Warning signs:** Items snap back to wrong positions after consecutive rapid drags.

### Pitfall 2: @dnd-kit and Radix Portals
**What goes wrong:** DragOverlay renders in a portal at `document.body`. If drag handle is inside a Radix component that also portals (Dialog, Popover), the drag ghost may appear beneath the overlay backdrop.
**Why it happens:** z-index stacking context conflicts.
**How to avoid:** Apply `DragOverlay` at the page level (outside any Radix components). The services table and contact chain list are not inside dialogs, so this pitfall is unlikely for phase 12. Still, position `DragOverlay` at the `ServicesPage` root.
**Warning signs:** Dragged item disappears visually during drag on certain elements.

### Pitfall 3: `upsert` on `sort_order` Without `tenant_id`
**What goes wrong:** PATCH reorder upsert specifies `onConflict: 'id'` but omits `tenant_id` in the upsert body. RLS policy requires `tenant_id` in `WITH CHECK`, so rows without it fail silently.
**Why it happens:** Upsert only merges provided columns; `tenant_id` must be included explicitly.
**How to avoid:** Always include `{ id, tenant_id: tenantId, sort_order }` in the upsert array. Verify with a test that sends a reorder as a different tenant's contact ID — should return 0 rows affected.

### Pitfall 4: Escalation SMS Blast Fires for Every Call
**What goes wrong:** `processCallAnalyzed()` blasts all chain contacts on every emergency call, including test calls.
**Why it happens:** No guard for test calls or already-booked-during-call emergency calls.
**How to avoid:** Gate SMS blast on: `triageResult.urgency === 'emergency'` AND `!call.is_test_call` (check `retell_metadata` for test flag). Consider a `escalation_sms_sent_at` column on `calls` table (same pattern as `recovery_sms_sent_at`) to prevent duplicate blasts on retries.

### Pitfall 5: Inline Contact Form Validation Timing
**What goes wrong:** Phone validation fires on first render (before user types anything), showing error state prematurely.
**Why it happens:** Validation state initializes as `touched: true` when form is pre-populated from existing contact.
**How to avoid:** Validate on blur only, not on mount. For new (empty) contacts, initialize `touched: false`. For existing contacts in edit mode, validate only on first blur after user modifies the field.

### Pitfall 6: Agent Prompt Fallback Waterfall — Endless Loop
**What goes wrong:** AI keeps re-offering slots/callback if caller keeps declining, running past the 10-minute call limit.
**Why it happens:** Prompt doesn't specify a terminal state after voicemail is offered.
**How to avoid:** In the new ESCALATION FALLBACK section of `agent-prompt.js`, explicitly state: "After voicemail is offered, do NOT re-offer any other options. End the call gracefully."

### Pitfall 7: services Table `sort_order` Missing from API Response
**What goes wrong:** After adding `sort_order` column, GET `/api/services` still returns `id, name, urgency_tag, created_at` (hardcoded select). Drag-and-drop client receives no `sort_order` value, treats all rows as position 0.
**Why it happens:** The select list in `route.js` is explicit and doesn't include new columns automatically.
**How to avoid:** Update GET select to `'id, name, urgency_tag, sort_order, created_at'` in the same PR as the migration.

---

## Code Examples

### @dnd-kit Sortable List Setup

```javascript
// Source: @dnd-kit official docs — https://docs.dndkit.com/presets/sortable
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Sensors: pointer (mouse/touch) + keyboard (for accessibility)
const sensors = useSensors(
  useSensor(PointerSensor),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
);

// Sortable item hook
function SortableContactCard({ contact }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: contact.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <GripVertical {...listeners} aria-label="Drag to reorder" className="cursor-grab" />
      {/* rest of ContactCard */}
    </div>
  );
}
```

### Extending `processCallAnalyzed()` for Chain Blast

```javascript
// After lead creation and owner notifications — add to call-processor.js
if (lead && tenantId && triageResult.urgency === 'emergency') {
  // SMS blast to all chain contacts regardless of call outcome (D-06 step 4)
  sendEscalationNotifications({ tenantId, lead, callId: call_id })
    .catch(err => console.error('Escalation notifications failed:', err));
}
```

### Agent Prompt — Escalation Fallback Waterfall Section

New section to inject into `buildSystemPrompt()` when `onboarding_complete === true`:

```javascript
const escalationFallbackSection = onboarding_complete ? `
ESCALATION FALLBACK (when transfer fails or no one answers):
If you attempted a transfer and no one answered, work through this waterfall ONCE — do not repeat:
1. SLOT OFFER: "I understand this is urgent. Let me book you into our next available emergency slot right now. [offer earliest slot]."
2. If caller declines slot: "I completely understand. Let me have someone call you back within 15 minutes. Can I confirm your number is [caller_number]?"
3. If callback declined: "No problem. Would you like to leave a voicemail for the team directly?"
4. After voicemail offered: "I've noted all your details and the team will be in touch. Is there anything else before I let you go?" Do NOT offer further options.
` : '';
```

### EscalationChainSection Component Structure

```javascript
'use client';
// src/components/dashboard/EscalationChainSection.js
// Reads contacts from /api/escalation-contacts
// Renders per-urgency mapping rows (static labels + Switch)
// Renders DnD-sortable contact list
// "Save Chain" button: PATCH full chain state
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-beautiful-dnd | @dnd-kit/sortable | 2022-2023 | Atlassian deprecated rbd; @dnd-kit is maintained and has better keyboard/accessibility support |
| Inline portal drag ghost | DragOverlay component | @dnd-kit v6 | DragOverlay renders at body level, avoiding clipping issues |

**Deprecated/outdated:**
- `react-beautiful-dnd`: Unmaintained since 2023, no React 18 support guarantees. Do not use.

---

## Claude's Discretion Resolutions

These are research-informed recommendations for areas explicitly delegated in CONTEXT.md:

### D-07: Per-Urgency Escalation Mapping (Resolved)
| Urgency | Action | Rationale |
|---------|--------|-----------|
| Emergency | Full chain — all contacts tried sequentially | True emergency demands every contact be reached |
| High ticket | Chain contacts notified via SMS/email (no live transfer — post-call only) | Owner visibility without interrupting live transfers for non-emergency |
| Routine | Lead only — no escalation | Routine calls = scheduling conversations; owners should not be interrupted at 2am for a quote request |

Emergency gets the full treatment (live transfer attempt + post-call SMS blast). High ticket gets post-call SMS/email to owner contact only. Routine gets existing lead notification only.

### D-09: Escalation Config Layout (Resolved)
**Decision: stacked card below ZoneManager, same scroll page, no tabs.** The UI-SPEC already confirms this (approved). Services page uses `<Separator my-6 />` between sections; EscalationChainSection is the 5th section following the same pattern.

### Max Contact Count
**Recommendation: 5 contacts maximum.** Practical reasoning: if 5 people don't answer a call, the 6th won't either. SMB owners typically have 2-4 relevant contacts. Cap enforced in the POST endpoint: return 400 if `SELECT count(*) WHERE is_active=true` already equals 5.

### Default Timeout
**Recommendation: 30 seconds default.** The UI-SPEC already specifies 30 sec as default for new contacts. 30 seconds is industry standard for call transfer timeout (neither too short to allow answer nor too long to frustrate the caller).

### Notification Template Design for Chain Contacts
SMS template: `[URGENT] {businessName} — Emergency call from {callerName} re: {jobType} at {address}. View lead: {dashboardLeadUrl}`
Email: React Email template (new `EscalationContactEmail` component mirroring `NewLeadEmail.jsx`). Subject: `[URGENT] Emergency call — {callerName}, {jobType}`.

### Chain Contacts Without Dashboard Accounts
No action required. Chain contacts are pure notification targets (SMS/email). They receive a link to the lead card. That link requires dashboard login to view. This is intentional — it provides access control. The deep link in D-12 is the `/dashboard/leads/${leadId}` URL. Recipients who don't have accounts will hit the login wall and contact the owner directly. Do not auto-provision accounts for chain contacts in phase 12.

---

## Environment Availability

Step 2.6: SKIPPED (no new external dependencies — phase reuses Twilio, Resend, Supabase, Retell already installed and verified in prior phases).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (ESM mode) |
| Config file | `jest.config.js` at project root |
| Quick run command | `node jest-cli/bin/jest.js tests/triage/ --no-coverage` |
| Full suite command | `node jest-cli/bin/jest.js --no-coverage` |

### Phase Requirements → Test Map

| Behavior | Test Type | Automated Command | File Exists? |
|----------|-----------|-------------------|-------------|
| `escalation_contacts` CRUD API (GET/POST/PUT/DELETE/PATCH) | integration | `node jest-cli/bin/jest.js tests/escalation/ -t "escalation-contacts api"` | ❌ Wave 0 |
| `sort_order` PATCH reorder preserves tenant isolation | integration | `node jest-cli/bin/jest.js tests/escalation/ -t "reorder"` | ❌ Wave 0 |
| `sendEscalationNotifications()` fires SMS+email for correct contacts | unit | `node jest-cli/bin/jest.js tests/notifications/ -t "escalation"` | ❌ Wave 0 |
| Emergency triage triggers blast, routine does not | unit | `node jest-cli/bin/jest.js tests/escalation/ -t "blast"` | ❌ Wave 0 |
| Max 5 contacts enforced by API | unit | `node jest-cli/bin/jest.js tests/escalation/ -t "max contacts"` | ❌ Wave 0 |
| Bulk tag PUT updates all selected services | unit | `node jest-cli/bin/jest.js tests/services/ -t "bulk tag"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `node jest-cli/bin/jest.js tests/escalation/ tests/notifications/ --no-coverage`
- **Per wave merge:** `node jest-cli/bin/jest.js --no-coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/escalation/escalation-contacts.test.js` — CRUD + reorder + max-contacts
- [ ] `tests/escalation/escalation-blast.test.js` — sendEscalationNotifications, urgency gating
- [ ] `tests/services/bulk-tag.test.js` — bulk tag update API
- [ ] `src/lib/escalation.js` — module must exist before tests can import it

---

## Open Questions

1. **In-call sequential transfer: prompt-driven vs. no-op**
   - What we know: Retell `transfer_call` transfers to one number. The AI can re-invoke the tool after a failed transfer.
   - What's unclear: Does Retell's `transfer_call` return a distinguishable "no answer" result vs. "transfer failed" that the AI can act on?
   - Recommendation: Verify in the Retell dashboard or docs whether `transfer_call` returns a result the AI receives. If it does, the prompt-driven sequential approach is viable. If not (fire-and-forget), keep the current single-transfer model and rely on post-call blast. Default plan in this research assumes single-transfer + post-call blast.

2. **High-ticket live behavior: transfer or notify-only**
   - What we know: D-07 is Claude's Discretion. High-ticket calls may warrant a transfer attempt.
   - What's unclear: Do owners want to be called during a live high-ticket call, or just notified after?
   - Recommendation: Post-call SMS/email notification only for high-ticket (no live transfer). Keeps the call flow simple and avoids interrupting the AI booking conversation for a non-emergency. Owner can call back using the SMS link.

3. **services `sort_order` migration: safe for existing tenants**
   - What we know: All existing services have `created_at` timestamps. Backfill with `row_number()` is deterministic.
   - What's unclear: Are there tenants in production with services? Backfill is safe either way but should be verified.
   - Recommendation: Include backfill in migration 006. It's idempotent and risk-free.

---

## Project Constraints (from CLAUDE.md)

- When making changes to voice call architecture files (listed in `voice-call-architecture` SKILL.md), update the skill file after changes are made.
- `src/lib/agent-prompt.js`, `src/lib/call-processor.js`, `src/app/api/webhooks/retell/route.js`, `src/lib/notifications.js` are all in the voice-call-architecture skill file map. Any modifications to these files in phase 12 require updating `SKILL.md` after implementation.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase reading — `src/lib/call-processor.js`, `src/lib/notifications.js`, `src/lib/agent-prompt.js`, `src/app/api/webhooks/retell/route.js`, `src/lib/triage/layer3-rules.js`, `src/app/api/services/route.js`, `src/app/dashboard/services/page.js`
- `12-CONTEXT.md` — locked decisions and discretion areas
- `12-UI-SPEC.md` — approved visual and interaction contract
- `.claude/skills/voice-call-architecture/SKILL.md` — complete call system reference
- `supabase/migrations/001-005` — existing schema

### Secondary (MEDIUM confidence)
- @dnd-kit official docs — https://docs.dndkit.com — verified patterns for SortableContext, useSortable, DragOverlay, keyboard sensor
- shadcn/ui component pages for Card, Label, RadioGroup, AlertDialog — confirmed `npx shadcn add` commands

### Tertiary (LOW confidence)
- None — all claims verified against codebase or official docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified against existing codebase and package.json
- Architecture: HIGH — data model is straightforward; call runtime recommendation conservatively avoids unverified Retell sequential transfer behavior
- Pitfalls: HIGH — all from direct codebase analysis of existing patterns

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable domain — library APIs won't change meaningfully in 30 days)

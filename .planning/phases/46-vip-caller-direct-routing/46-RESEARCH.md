# Phase 46: VIP Caller Direct Routing - Research

**Researched:** 2026-04-11
**Domain:** Webhook routing logic, tenant settings API, dashboard UI, database schema
**Confidence:** HIGH

## Summary

Phase 46 adds a VIP caller bypass to the existing call routing system. When a caller's number matches either a standalone VIP number stored on the tenant or a lead marked as VIP, the webhook skips schedule evaluation and cap checks entirely, routing the call directly to the owner's phone via the existing `_owner_pickup_twiml()` path. This is a cross-repo phase touching the livekit-agent Python webhook (at `C:/Users/leheh/.Projects/livekit-agent/`), the Next.js API routes, the Supabase schema, and two dashboard surfaces (call routing settings page and leads page flyout).

The implementation is architecturally simple because it reuses existing infrastructure heavily: the `_owner_pickup_twiml()` and `_insert_owner_pickup_call()` functions from Phase 40, the `cleanPhone()`/`validatePhone()` helpers from Phase 41, and the inline card+form UI pattern from the pickup numbers section. The core new logic is a VIP check function inserted into the webhook routing composition between subscription check (line 173) and `evaluate_schedule()` (line 176) in `twilio_routes.py`, plus a new `is_vip` boolean column on the leads table and a `vip_numbers` JSONB array on the tenants table.

**Primary recommendation:** Implement as four layers -- (1) database migration adding `vip_numbers` to tenants and `is_vip` to leads, (2) webhook VIP check in livekit-agent, (3) API extensions for GET/PUT call-routing and PATCH leads, (4) dashboard UI in call routing page and LeadFlyout.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Both standalone phone numbers AND lead-based VIP marking. Owner can add phone numbers manually in the call routing settings page (for contacts not yet in the system) AND mark existing leads as VIP from the leads page. The webhook checks both sources -- the tenant's `vip_numbers` JSONB array and the `is_vip` boolean on leads (matching by `from_number`).
- **D-02:** When a lead is marked as VIP, the webhook resolves it by querying the leads table for `from_number` + `is_vip = true` at routing time. This means VIP status from leads is always current (no sync needed).
- **D-03:** Full bypass -- VIP calls ring the owner 24/7, ignoring schedule and outbound minute caps entirely. The whole point is "I always want to talk to this person."
- **D-04:** If the owner doesn't pick up a VIP call, AI takes over as fallback (same `fallback_to_ai` behavior as schedule-based routing). The VIP caller still gets answered -- just by AI instead.
- **D-05:** VIP check happens in the webhook AFTER subscription check but BEFORE `evaluate_schedule()`. If the caller is VIP, skip schedule eval and cap check entirely -> route to `_owner_pickup_twiml()`.
- **D-06:** VIP management lives in two places: (1) A "VIP Callers" section on the existing call routing settings page (`/dashboard/more/call-routing`) for standalone phone numbers, and (2) a "Mark as VIP" / "Remove VIP" action in the lead flyout on the leads page.
- **D-07:** The VIP Callers section on the call routing page follows the same card + inline form pattern as the existing "Your Phone Numbers" section -- list of entries with edit/delete, add form at bottom.
- **D-08:** VIP callers appear on the calls page with the same "You answered" blue badge (routing_mode='owner_pickup'). No separate VIP badge on calls -- VIP is about routing priority, not call display.
- **D-09:** Unlimited VIP entries -- no cap on standalone numbers or marked leads.
- **D-10:** No special notification for VIP calls. The phone rings like any owner-pickup call.
- **D-11:** Exact E.164 matching at routing time (Twilio always sends E.164). Store all VIP numbers in E.164 format.

### Claude's Discretion
- **Phone input normalization:** Reuse `cleanPhone()` helper, auto-prepend country code based on tenant's country if omitted. Exact normalization logic at implementer's discretion.
- **Leads page VIP badge:** Color, position, icon at Claude's discretion. UI-SPEC specifies violet-100/violet-700 with filled Star icon, positioned before urgency badge.
- **VIP section placement on call routing page:** UI-SPEC specifies below "Your Phone Numbers" and above "Ring Duration", outside the AnimatePresence block (always visible).

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

## Project Constraints (from CLAUDE.md)

- **Brand name is Voco** -- not HomeService AI, not homeserviceai
- **Keep skills in sync**: When making changes to any system covered by a skill, read the skill first, make the code changes, then update the skill to reflect the new state. Relevant skills: `voice-call-architecture`, `dashboard-crm-system`, `auth-database-multitenancy`
- **Tech stack**: Next.js App Router, Supabase (Auth + Postgres + RLS + Realtime), Twilio SIP + LiveKit + Gemini, Tailwind CSS, shadcn/ui
- **Two repos**: Main Next.js app at `C:/Users/leheh/.Projects/homeservice_agent/`, LiveKit Python agent at `C:/Users/leheh/.Projects/livekit-agent/`

## Standard Stack

### Core (Already Installed -- No New Dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js (App Router) | Existing | Dashboard pages, API routes | Project framework |
| Supabase (service-role) | Existing | DB reads/writes with RLS bypass | Standard for API routes |
| FastAPI | >=0.115 | Webhook routing in livekit-agent | Already running webhook server |
| supabase-py | >=2.0 | Python Supabase client in webhook | Already used in twilio_routes.py |
| shadcn/ui | Existing | Switch, Input, Button, Badge, Sheet | Already installed |
| lucide-react | Existing | Star icon for VIP badge | Already installed |
| sonner | Existing | Toast notifications | Already installed |
| framer-motion | Existing | Section animations | Already installed |

**No new packages required.** All libraries needed are already in both repos.

## Architecture Patterns

### Recommended Implementation Structure

```
Main repo (homeservice_agent):
  supabase/migrations/049_vip_caller_routing.sql    # New migration (next after 048)
  src/app/api/call-routing/route.js                 # Extend GET/PUT for vip_numbers
  src/app/api/leads/[id]/route.js                   # Extend PATCH for is_vip
  src/app/dashboard/more/call-routing/page.js       # Add VIP Callers section
  src/components/dashboard/LeadCard.jsx             # Add VIP badge
  src/components/dashboard/LeadFlyout.jsx           # Add VIP toggle

livekit-agent repo:
  src/webhook/twilio_routes.py                      # Add VIP check function + insert into routing
```

### Pattern 1: Webhook VIP Check (Two-Source Lookup)

**What:** A function that checks both `vip_numbers` JSONB on the tenant row (already fetched) and queries leads for `from_number` + `is_vip = true`.
**When to use:** Between subscription check and schedule evaluation in `incoming_call()`.
**Why two sources:** Standalone VIP numbers are for contacts not yet in the system. Lead VIP marking is for existing customers. Both must be checked.

```python
# Source: CONTEXT.md D-01, D-02, D-05
async def _is_vip_caller(tenant: dict, from_number: str) -> bool:
    """Check if caller is VIP via tenant's vip_numbers or lead is_vip flag.
    
    Returns True if the from_number matches any entry in tenant's
    vip_numbers JSONB array OR any lead with is_vip=true for this tenant.
    """
    # Check 1: Standalone VIP numbers on tenant row (already in memory)
    vip_numbers = tenant.get("vip_numbers") or []
    for entry in vip_numbers:
        if entry.get("number") == from_number:
            return True
    
    # Check 2: Lead-based VIP (requires DB query)
    from src.supabase_client import get_supabase_admin
    
    def _query():
        return (
            get_supabase_admin()
            .table("leads")
            .select("id")
            .eq("tenant_id", tenant["id"])
            .eq("from_number", from_number)
            .eq("is_vip", True)
            .limit(1)
            .execute()
        )
    
    response = await asyncio.to_thread(_query)
    return bool(response.data)
```

### Pattern 2: Tenant Lookup Extension

**What:** The existing tenant lookup query in `incoming_call()` must include `vip_numbers` in its SELECT.
**Current query:** `"id, call_forwarding_schedule, tenant_timezone, country, pickup_numbers, dial_timeout_seconds, subscriptions(status)"`
**Extended query:** Add `vip_numbers` to the select string.

```python
# Source: twilio_routes.py line 140
.select(
    "id, call_forwarding_schedule, tenant_timezone, country, "
    "pickup_numbers, dial_timeout_seconds, vip_numbers, subscriptions(status)"
)
```

### Pattern 3: VIP Check Insertion Point in Routing Composition

**What:** The VIP check inserts between subscription check (step 2) and evaluate_schedule (step 3).
**Critical:** VIP calls still require active subscription (blocked callers don't bypass billing). VIP calls DO bypass schedule and cap checks.

```python
# Source: CONTEXT.md D-05, twilio_routes.py lines 162-225
# Current flow: tenant lookup -> sub check -> evaluate_schedule -> cap check -> TwiML
# New flow:     tenant lookup -> sub check -> VIP check -> evaluate_schedule -> cap check -> TwiML

# After subscription check (line 173), before evaluate_schedule (line 176):
# 2.5. VIP check
try:
    if await _is_vip_caller(tenant, from_number):
        logger.info("[webhook] VIP caller %s for tenant %s — direct routing", from_number, tenant["id"])
        pickup_numbers = [p["number"] for p in (tenant.get("pickup_numbers") or []) if p.get("number")]
        if pickup_numbers:
            await _insert_owner_pickup_call(tenant["id"], call_sid, from_number, to_number)
            timeout = tenant.get("dial_timeout_seconds", 15)
            return _xml_response(_owner_pickup_twiml(from_number, pickup_numbers, timeout))
        else:
            logger.info("[webhook] VIP caller but no pickup numbers — AI TwiML")
except Exception as e:
    logger.warning("[webhook] VIP check failed (fail-open): %s", e)
```

**Key insight:** If VIP is detected but no pickup_numbers exist, fall through to AI TwiML (fail-open). VIP routing requires at least one pickup number configured.

### Pattern 4: JSONB Array Column on Tenants (Same as pickup_numbers)

**What:** `vip_numbers` stored as JSONB array with `{number: string, label: string}` shape.
**Why JSONB:** Matches the established `pickup_numbers` pattern. No separate table needed for a simple array of phone numbers.
**No array length constraint:** Unlike `pickup_numbers` (capped at 5), VIP numbers are unlimited per D-09.

```sql
-- Source: migration 042 pattern, CONTEXT.md D-09
ALTER TABLE tenants
  ADD COLUMN vip_numbers JSONB NOT NULL DEFAULT '[]'::jsonb;
-- No CHECK constraint on array length (unlimited per D-09)
```

### Pattern 5: Boolean Column on Leads

**What:** `is_vip` boolean on leads table with default false.
**Why boolean:** Simple flag, no complex state. Queried at webhook time via `from_number` + `is_vip = true`.

```sql
-- Source: CONTEXT.md D-01, D-02
ALTER TABLE leads
  ADD COLUMN is_vip BOOLEAN NOT NULL DEFAULT false;

-- Performance index for webhook lookup (tenant_id + from_number + is_vip)
CREATE INDEX idx_leads_vip_lookup ON leads (tenant_id, from_number) WHERE is_vip = true;
```

### Pattern 6: API Extension (Call Routing GET/PUT)

**What:** Extend existing `/api/call-routing` GET and PUT to include `vip_numbers`.
**GET:** Add `vip_numbers` to the tenant SELECT, return in response.
**PUT:** Accept `vip_numbers` in body, validate E.164 format, no duplicate VIP numbers, persist alongside existing fields.

```javascript
// Source: route.js lines 15-17, 221-225
// GET: extend select
.select('call_forwarding_schedule, pickup_numbers, dial_timeout_seconds, vip_numbers, working_hours, phone_number, country')

// PUT: extend destructure and update
const { call_forwarding_schedule, pickup_numbers, dial_timeout_seconds, vip_numbers } = await request.json();
// Validate vip_numbers same pattern as pickup_numbers (E.164, no dupes)
// but NO length cap (unlimited per D-09)
.update({ call_forwarding_schedule, pickup_numbers, dial_timeout_seconds, vip_numbers })
```

### Pattern 7: Lead PATCH Extension (is_vip)

**What:** Extend existing `PATCH /api/leads/[id]` to accept `is_vip` boolean.
**How:** Add `is_vip` to destructure and updateData, same as existing `email` and `caller_name` fields.

```javascript
// Source: route.js lines 59, 73-77
const { status, revenue_amount, previous_status, sync_source, email, caller_name, is_vip } = body;
// ...
if (is_vip !== undefined) updateData.is_vip = is_vip;
```

### Pattern 8: VIP Badge on LeadCard

**What:** Violet badge with filled Star icon positioned before urgency badge in badges row.
**How:** Conditional render `lead.is_vip === true` -> violet pill badge.

```jsx
// Source: UI-SPEC
{lead.is_vip && (
  <Badge className="bg-violet-100 text-violet-700 text-xs shrink-0 gap-1">
    <Star className="h-3 w-3 fill-current" />
    VIP
  </Badge>
)}
```

### Pattern 9: VIP Toggle in LeadFlyout

**What:** Switch toggle between contact details and Pipeline Status sections.
**How:** PATCH `/api/leads/[id]` with `{ is_vip: true/false }` on toggle change. Optimistic UI with revert on error.

### Pattern 10: Leads API List Query Extension

**What:** The GET `/api/leads` list endpoint must include `is_vip` in its select query so LeadCards can render the VIP badge.
**Current select:** `id, tenant_id, from_number, caller_name, email, job_type, service_address, postal_code, street_name, urgency, status, revenue_amount, primary_call_id, appointment_id, created_at, updated_at, lead_calls(...)`
**Note:** The wildcard `*` is used in the leads detail endpoint (`GET /api/leads/[id]`) which will automatically include the new `is_vip` column. But the list endpoint uses explicit column names and MUST be extended.

### Anti-Patterns to Avoid
- **Syncing VIP status between leads and vip_numbers:** Per D-02, the webhook queries both sources independently. Never copy lead VIP status into `vip_numbers` or vice versa.
- **Adding a new routing_mode value:** Per D-08, VIP calls use existing `owner_pickup` mode. No new enum value.
- **Checking VIP after schedule evaluation:** Per D-05, VIP check must happen BEFORE schedule eval, not after. VIP completely bypasses scheduling.
- **Skipping subscription check for VIP:** VIP callers still need an active subscription. The subscription check comes BEFORE the VIP check.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Phone normalization | Custom E.164 parser | `cleanPhone()` + `validatePhone()` from call-routing page.js | Already handles format variants, E.164 validation, country code prepending |
| Owner-pickup TwiML | Custom TwiML builder | `_owner_pickup_twiml()` from twilio_routes.py | Already builds correct parallel-ring Dial TwiML with action URL |
| Call record insertion | Custom insert logic | `_insert_owner_pickup_call()` from twilio_routes.py | Already handles async insert with routing_mode field |
| Inline card list UI | Custom card pattern | Copy exact pattern from "Your Phone Numbers" section | Same edit/delete/add form layout, already responsive |
| VIP badge rendering | Custom badge component | shadcn Badge with className override | Matches all existing badge patterns in LeadCard.jsx |

**Key insight:** This phase is 80% reuse of existing patterns. The only truly new logic is the `_is_vip_caller()` function and the VIP section UI.

## Common Pitfalls

### Pitfall 1: Forgetting to Add vip_numbers to Tenant Lookup SELECT

**What goes wrong:** The webhook tenant lookup query in `incoming_call()` uses an explicit SELECT string. If `vip_numbers` isn't added, `tenant.get("vip_numbers")` returns None and standalone VIP numbers never match.
**Why it happens:** The SELECT is a single string with comma-separated fields, easy to miss.
**How to avoid:** Extend the SELECT string on line 140 of `twilio_routes.py`.
**Warning signs:** Standalone VIP numbers don't trigger owner-pickup routing, but lead-based VIP does work.

### Pitfall 2: Forgetting to Extend Leads List API SELECT

**What goes wrong:** The GET `/api/leads` route uses explicit column names (not `*`). If `is_vip` isn't added, LeadCard never sees `lead.is_vip` and the VIP badge doesn't render.
**Why it happens:** The list endpoint deliberately avoids `*` for performance (transcript exclusion).
**How to avoid:** Add `is_vip` to the explicit column list in `GET /api/leads/route.js` line 24.
**Warning signs:** VIP badge shows in LeadFlyout (detail endpoint uses `*`) but not in LeadCard (list endpoint).

### Pitfall 3: VIP Section Gated by schedule.enabled

**What goes wrong:** If the VIP section is inside the `AnimatePresence` block that gates on `schedule.enabled`, owners who haven't enabled schedule-based routing can't add VIP numbers.
**Why it happens:** The UI-SPEC explicitly states VIP section must be OUTSIDE the AnimatePresence block because VIP routing works regardless of schedule (D-03).
**How to avoid:** Render VIP section at the same level as the hero toggle card, not nested inside the conditional sections.
**Warning signs:** VIP section disappears when the master toggle is off.

### Pitfall 4: Pickup Numbers Dependency for VIP Routing

**What goes wrong:** VIP routing requires at least one pickup_number to ring. If the owner has VIP callers configured but no pickup numbers, VIP calls fall through to AI silently.
**Why it happens:** The VIP check finds a match, but `_owner_pickup_twiml()` needs actual numbers to dial.
**How to avoid:** Log clearly when VIP caller detected but no pickup numbers available. The webhook already handles this gracefully (falls through to AI), but it should be logged for debugging.
**Warning signs:** VIP callers get AI despite being marked VIP.

### Pitfall 5: Leads Realtime Subscription and is_vip

**What goes wrong:** If `is_vip` changes are not picked up by Realtime, the LeadCard badge won't update until page refresh.
**Why it happens:** The leads table already has `REPLICA IDENTITY FULL` and is in the `supabase_realtime` publication (migration 004). New columns added via ALTER TABLE are automatically included in Realtime broadcasts.
**How to avoid:** No action needed -- `REPLICA IDENTITY FULL` broadcasts all columns on UPDATE. Just ensure the LeadCard component reads `lead.is_vip` from the Realtime payload.

### Pitfall 6: Migration Number Collision

**What goes wrong:** Using a migration number that already exists causes deployment failure.
**Why it happens:** Multiple phases can be developed concurrently, and migration numbers are sequential.
**How to avoid:** Latest migration is `048_calendar_blocks_group_id.sql`. However, `047_calendar_blocks_external_event.sql` appears in git status as untracked, so 049 is the safe next number. Check `supabase/migrations/` directory before finalizing.
**Warning signs:** Supabase migration apply fails with duplicate error.

## Code Examples

### Database Migration (049_vip_caller_routing.sql)

```sql
-- Migration 049: VIP caller routing
-- Phase 46: VIP Caller Direct Routing
--
-- Adds vip_numbers JSONB array to tenants for standalone VIP phone numbers,
-- and is_vip boolean to leads for marking existing customers as VIP.
-- Both sources are checked at webhook routing time.

-- Standalone VIP numbers on tenant (unlimited, no CHECK constraint per D-09)
ALTER TABLE tenants
  ADD COLUMN vip_numbers JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Lead-based VIP flag
ALTER TABLE leads
  ADD COLUMN is_vip BOOLEAN NOT NULL DEFAULT false;

-- Partial index for webhook lookup: only index VIP leads (sparse, fast)
CREATE INDEX idx_leads_vip_lookup
  ON leads (tenant_id, from_number)
  WHERE is_vip = true;
```

### VIP Check Function (twilio_routes.py)

```python
async def _is_vip_caller(tenant: dict, from_number: str) -> bool:
    """Check if caller is VIP via tenant's vip_numbers or lead is_vip flag."""
    # Source 1: Standalone VIP numbers (already in tenant row, no DB hit)
    vip_numbers = tenant.get("vip_numbers") or []
    for entry in vip_numbers:
        if entry.get("number") == from_number:
            return True

    # Source 2: Lead-based VIP (requires DB query per D-02)
    try:
        from src.supabase_client import get_supabase_admin

        def _query():
            return (
                get_supabase_admin()
                .table("leads")
                .select("id")
                .eq("tenant_id", tenant["id"])
                .eq("from_number", from_number)
                .eq("is_vip", True)
                .limit(1)
                .execute()
            )

        response = await asyncio.to_thread(_query)
        return bool(response.data)
    except Exception as e:
        logger.warning("[webhook] VIP lead lookup failed (fail-open): %s", e)
        return False
```

### VIP Numbers Validation (call-routing route.js PUT)

```javascript
// Validate vip_numbers (same pattern as pickup_numbers, no length cap)
if (vip_numbers !== undefined) {
  if (!Array.isArray(vip_numbers)) {
    return Response.json({ error: 'vip_numbers must be an array' }, { status: 400 });
  }
  const seenVipNumbers = new Set();
  for (const item of vip_numbers) {
    if (!item.number || typeof item.number !== 'string') {
      return Response.json({ error: 'Each VIP number must have a number field' }, { status: 400 });
    }
    if (!E164_RE.test(item.number)) {
      return Response.json({ error: `Invalid VIP phone number format: ${item.number}` }, { status: 400 });
    }
    if (seenVipNumbers.has(item.number)) {
      return Response.json({ error: `Duplicate VIP phone number: ${item.number}` }, { status: 400 });
    }
    seenVipNumbers.add(item.number);
  }
}
```

### VIP Toggle in LeadFlyout (excerpt)

```jsx
// VIP Caller toggle row
{lead.from_number && (
  <>
    <Separator className="bg-stone-100" />
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2">
        <Star className={`h-3.5 w-3.5 ${lead.is_vip ? 'text-violet-500 fill-violet-500' : 'text-stone-400'}`} />
        <div>
          <span className="text-sm font-medium text-[#0F172A]">VIP Caller</span>
          <p className="text-xs text-[#475569]">Always ring your phone when this caller dials in.</p>
        </div>
      </div>
      <Switch
        checked={lead.is_vip || false}
        onCheckedChange={async (checked) => {
          // Optimistic update
          setLead(prev => ({ ...prev, is_vip: checked }));
          try {
            const res = await fetch(`/api/leads/${lead.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ is_vip: checked }),
            });
            if (!res.ok) throw new Error();
            toast.success(checked ? 'Caller marked as VIP' : 'VIP status removed');
          } catch {
            setLead(prev => ({ ...prev, is_vip: !checked }));
            toast.error('Could not update VIP status -- try again');
          }
        }}
        aria-label="Toggle VIP status"
      />
    </div>
    <Separator className="bg-stone-100" />
  </>
)}
```

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework (Next.js) | Jest with `--experimental-vm-modules` |
| Framework (livekit-agent) | pytest >= 8.0, pytest-asyncio >= 0.23 |
| Quick run (Next.js) | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/api/call-routing.test.js --passWithNoTests` |
| Quick run (livekit-agent) | `cd C:/Users/leheh/.Projects/livekit-agent && python -m pytest tests/webhook/test_routes.py -x` |
| Full suite (Next.js) | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --passWithNoTests` |
| Full suite (livekit-agent) | `cd C:/Users/leheh/.Projects/livekit-agent && python -m pytest tests/webhook/ -x` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VIP-DB | Migration adds vip_numbers + is_vip columns | manual | SQL review | N/A |
| VIP-WEBHOOK-01 | VIP caller from vip_numbers -> owner_pickup TwiML | unit | `pytest tests/webhook/test_routes.py::test_incoming_call_vip_standalone -x` | Wave 0 |
| VIP-WEBHOOK-02 | VIP caller from is_vip lead -> owner_pickup TwiML | unit | `pytest tests/webhook/test_routes.py::test_incoming_call_vip_lead -x` | Wave 0 |
| VIP-WEBHOOK-03 | Non-VIP caller -> normal schedule evaluation | unit | `pytest tests/webhook/test_routes.py::test_incoming_call_non_vip_continues -x` | Wave 0 |
| VIP-WEBHOOK-04 | VIP caller with no pickup_numbers -> AI TwiML | unit | `pytest tests/webhook/test_routes.py::test_incoming_call_vip_no_pickup -x` | Wave 0 |
| VIP-WEBHOOK-05 | VIP check failure -> fail-open (continue to schedule) | unit | `pytest tests/webhook/test_routes.py::test_incoming_call_vip_check_fail -x` | Wave 0 |
| VIP-API-01 | GET call-routing returns vip_numbers | unit | `jest tests/api/call-routing.test.js` | Extend existing |
| VIP-API-02 | PUT call-routing persists vip_numbers with E.164 validation | unit | `jest tests/api/call-routing.test.js` | Extend existing |
| VIP-API-03 | PATCH leads/[id] accepts is_vip boolean | unit | Manual test / new test file | Wave 0 |
| VIP-UI-01 | VIP badge renders on LeadCard when is_vip=true | manual | Visual verification | N/A |
| VIP-UI-02 | VIP toggle in LeadFlyout PATCHes lead | manual | Visual verification | N/A |
| VIP-UI-03 | VIP section on call-routing page visible regardless of schedule toggle | manual | Visual verification | N/A |

### Sampling Rate
- **Per task commit:** Quick run for affected test file
- **Per wave merge:** Full suite for both repos
- **Phase gate:** Full suite green before verify-work

### Wave 0 Gaps
- [ ] `tests/webhook/test_routes.py` -- 5 new VIP routing tests (VIP-WEBHOOK-01 through 05)
- [ ] `tests/api/call-routing.test.js` -- extend with VIP numbers validation cases (VIP-API-01, VIP-API-02)
- [ ] No new conftest or framework install needed (both test frameworks already configured)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded AI TwiML (Phase 39) | Schedule-based routing (Phase 40) | Phase 40 | Webhook now evaluates schedule + caps |
| No VIP concept | VIP bypass routing (Phase 46) | Phase 46 | VIP callers skip schedule + caps entirely |

## Open Questions

1. **Country code auto-prepend for VIP numbers**
   - What we know: The `cleanPhone()` helper strips spaces/dashes/parens. The `validatePhone()` checks E.164 format.
   - What's unclear: Whether auto-prepend should use the same logic as pickup number input (not explicitly implemented there) or require full E.164 from the user.
   - Recommendation: Implement the same `cleanPhone()` + E.164 validation pattern as pickup numbers. If the user omits `+1` or `+65`, show the validation error asking for country code. This matches the existing pickup number UX exactly and avoids complexity of guessing country codes.

2. **VIP call logging reason**
   - What we know: CONTEXT.md suggests `reason="vip_caller"` in ScheduleDecision for analytics.
   - What's unclear: Whether to add a reason field to the calls row or just log it.
   - Recommendation: Log `reason="vip_caller"` in webhook logs. Don't add a new column to calls -- the calls row already has `routing_mode='owner_pickup'` which is sufficient for display (per D-08). If analytics differentiation is needed later, it can be inferred from the VIP status of the caller at query time.

## Sources

### Primary (HIGH confidence)
- `twilio_routes.py` in livekit-agent repo -- current webhook routing composition, TwiML builders, insertion point verified at lines 162-225
- `src/app/api/call-routing/route.js` -- current GET/PUT API with E.164 validation pattern, lines 1-242
- `src/app/api/leads/[id]/route.js` -- current PATCH API with field extension pattern, lines 50-130
- `src/app/dashboard/more/call-routing/page.js` -- current UI with pickup number section pattern, lines 1-637
- `src/components/dashboard/LeadCard.jsx` -- current badge rendering pattern, lines 164-179
- `src/components/dashboard/LeadFlyout.jsx` -- current flyout sections and toggle pattern, lines 124-647
- `supabase/migrations/042_call_routing_schema.sql` -- JSONB column pattern for phone arrays
- `supabase/migrations/004_leads_crm.sql` -- leads table schema with RLS and Realtime
- `46-CONTEXT.md` -- all locked decisions D-01 through D-11
- `46-UI-SPEC.md` -- approved visual design contract

### Secondary (MEDIUM confidence)
- `tests/webhook/test_routes.py` -- existing test patterns for routing tests with monkeypatch helpers
- `tests/api/call-routing.test.js` -- existing test patterns for call-routing API with ESM mocks

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all existing libraries, zero new dependencies
- Architecture: HIGH -- direct extension of existing patterns (pickup_numbers, routing composition, PATCH leads)
- Pitfalls: HIGH -- all pitfalls identified from concrete code analysis of existing files
- Webhook routing: HIGH -- exact insertion point verified in source code (between lines 173 and 176)
- Database: HIGH -- migration pattern verified against 042 and 004

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (stable -- all patterns are internal codebase patterns, not external library APIs)

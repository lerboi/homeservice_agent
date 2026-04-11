# Phase 46: VIP Caller Direct Routing - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Let owners mark specific callers as VIP so their incoming calls bypass AI and route directly to the owner's phone — regardless of schedule, time of day, or outbound caps. VIP callers can be defined as standalone phone numbers (in settings) or by marking existing leads as VIP (from the leads page). The webhook checks both sources before falling back to the normal schedule-based routing.

</domain>

<decisions>
## Implementation Decisions

### VIP Source
- **D-01:** Both standalone phone numbers AND lead-based VIP marking. Owner can add phone numbers manually in the call routing settings page (for contacts not yet in the system) AND mark existing leads as VIP from the leads page. The webhook checks both sources — the tenant's `vip_numbers` JSONB array and the `is_vip` boolean on leads (matching by `from_number`).
- **D-02:** When a lead is marked as VIP, the webhook resolves it by querying the leads table for `from_number` + `is_vip = true` at routing time. This means VIP status from leads is always current (no sync needed).

### Routing Behavior
- **D-03:** Full bypass — VIP calls ring the owner 24/7, ignoring schedule and outbound minute caps entirely. The whole point is "I always want to talk to this person."
- **D-04:** If the owner doesn't pick up a VIP call, AI takes over as fallback (same `fallback_to_ai` behavior as schedule-based routing). The VIP caller still gets answered — just by AI instead.
- **D-05:** VIP check happens in the webhook AFTER subscription check but BEFORE `evaluate_schedule()`. If the caller is VIP, skip schedule eval and cap check entirely → route to `_owner_pickup_twiml()`.

### Dashboard Surface
- **D-06:** VIP management lives in two places: (1) A "VIP Callers" section on the existing call routing settings page (`/dashboard/more/call-routing`) for standalone phone numbers, and (2) a "Mark as VIP" / "Remove VIP" action in the lead flyout on the leads page.
- **D-07:** The VIP Callers section on the call routing page follows the same card + inline form pattern as the existing "Your Phone Numbers" section — list of entries with edit/delete, add form at bottom.
- **D-08:** VIP callers appear on the calls page with the same "You answered" blue badge (routing_mode='owner_pickup'). No separate VIP badge on calls — VIP is about routing priority, not call display.

### Scope Limits
- **D-09:** Unlimited VIP entries — no cap on standalone numbers or marked leads. If everything is VIP, that's the owner's choice.
- **D-10:** No special notification for VIP calls. The phone rings like any owner-pickup call. VIP is visible after the fact on the leads page badge.
- **D-11:** Exact E.164 matching at routing time (Twilio always sends E.164). Store all VIP numbers in E.164 format.

### Claude's Discretion
- **Phone input normalization:** The VIP number input should accept any reasonable format the owner types (555-123-4567, (555) 123-4567, +1 555 123 4567), auto-prepend the country code based on tenant's country if omitted, and show the cleaned E.164 format back for confirmation. Same pattern as existing pickup number input with `cleanPhone()` helper. Researcher/planner decides exact normalization logic.
- **Leads page VIP badge:** How the VIP badge renders on LeadCard (color, position, icon) is at Claude's discretion, following existing badge patterns in the codebase.
- **VIP section placement on call routing page:** Whether the VIP section goes above or below the existing sections is at Claude's discretion based on visual hierarchy.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Call Routing Architecture
- `.planning/phases/39-call-routing-webhook-foundation/39-CONTEXT.md` — Schedule evaluator design, soft caps, webhook composition
- `.planning/phases/40-call-routing-provisioning-cutover/40-CONTEXT.md` — Webhook routing flow: tenant lookup → subscription check → schedule eval → cap check → TwiML
- `.planning/phases/41-call-routing-dashboard-and-launch/41-CONTEXT.md` — Dashboard settings page decisions, routing badge design

### Webhook Code
- `livekit-agent/src/webhook/twilio_routes.py` — Current routing handler, TwiML builders, VIP check insertion point (after line 173, before line 176)
- `livekit-agent/src/webhook/schedule.py` — Schedule evaluator (pure function, skipped for VIP)
- `livekit-agent/src/webhook/caps.py` — Outbound cap checker (skipped for VIP)

### Dashboard Code
- `src/app/dashboard/more/call-routing/page.js` — Call routing settings page (VIP section to be added)
- `src/app/api/call-routing/route.js` — GET/PUT API for call routing config (extend for vip_numbers)
- `src/app/dashboard/leads/page.js` — Leads page with LeadCard, LeadFlyout, Kanban, Realtime

### Database
- `supabase/migrations/042_call_routing_schema.sql` — Existing routing columns on tenants
- `supabase/migrations/004_leads_crm.sql` — Leads table schema

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `_owner_pickup_twiml()` in `twilio_routes.py` — Reuse exactly for VIP routing (same parallel-ring TwiML)
- `_insert_owner_pickup_call()` in `twilio_routes.py` — Reuse for inserting VIP call records
- `cleanPhone()` and `validatePhone()` in `call-routing/page.js` — Reuse for VIP number input validation
- `E164_RE` regex in `call-routing/route.js` — Reuse for server-side VIP number validation
- Existing inline card list + add form pattern from "Your Phone Numbers" section — Reuse for VIP Numbers section

### Established Patterns
- JSONB arrays on tenants table for phone number lists (pickup_numbers pattern)
- Webhook routing composition: sequential checks with early return to TwiML
- LeadCard badges for status/urgency — same pattern for VIP badge
- LeadFlyout actions — existing pattern for adding "Mark as VIP" toggle

### Integration Points
- Webhook: VIP check inserts between subscription check and schedule evaluator
- API: Extend existing GET/PUT /api/call-routing with vip_numbers field
- Dashboard: New section on call routing page, new action in LeadFlyout
- Database: New column on tenants (vip_numbers JSONB), new column on leads (is_vip boolean)
- Realtime: Leads page already has Realtime subscriptions — will auto-see is_vip changes

</code_context>

<specifics>
## Specific Ideas

- Auto-prepend country code on VIP number input based on tenant's country (same UX improvement as discussed for phone input)
- VIP routing reason logged as `reason="vip_caller"` in ScheduleDecision for distinguishing from schedule-based routing in analytics
- No new routing_mode enum value — VIP calls use existing `owner_pickup` mode

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 46-vip-caller-direct-routing*
*Context gathered: 2026-04-12*

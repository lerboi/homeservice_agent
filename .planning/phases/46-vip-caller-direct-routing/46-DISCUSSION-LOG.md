# Phase 46: VIP Caller Direct Routing - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-12
**Phase:** 46-vip-caller-direct-routing
**Areas discussed:** VIP source, Routing behavior, Dashboard surface, Scope limits

---

## VIP Source — Numbers vs Leads vs Both

| Option | Description | Selected |
|--------|-------------|----------|
| Both — numbers + leads | Owner can add standalone phone numbers in settings AND mark existing leads as VIP from leads page. Webhook checks both. Most flexible. | ✓ |
| Standalone number list only | Owner adds VIP phone numbers manually in call routing settings. Simple, no leads integration. | |
| Lead-based only | Owner marks leads as VIP from leads/Kanban page. Only works for callers who already have a lead record. | |

**User's choice:** Both — numbers + leads (Recommended)
**Notes:** Most flexible for real-world use. Covers contacts not yet in the system (standalone numbers) and repeat customers already tracked as leads.

---

## Routing Behavior — Schedule Bypass

| Option | Description | Selected |
|--------|-------------|----------|
| Full bypass — always ring owner | VIP calls ring owner 24/7, ignoring schedule and outbound caps. AI fallback if owner doesn't answer. | ✓ |
| Schedule-aware — only during active hours | VIP calls only ring owner during configured schedule hours. Respects off-hours. | |
| Extended hours — wider window than schedule | VIP calls ring owner during wider time window (e.g., 7 AM–10 PM). Requires separate VIP schedule. | |

**User's choice:** Full bypass — always ring owner (Recommended)
**Notes:** The whole point of VIP is "I always want to talk to this person." AI handles the fallback if owner doesn't pick up.

---

## Dashboard Surface — Where to Manage VIPs

| Option | Description | Selected |
|--------|-------------|----------|
| Call routing page + leads page | VIP Numbers section on existing call routing settings page, plus "Mark as VIP" action in lead flyout. | ✓ |
| Dedicated VIP page under More | New /dashboard/more/vip-callers page showing all VIP callers in one unified list. | |
| Leads page only | All VIP management from leads page. No standalone number support. | |

**User's choice:** Call routing page + leads page (Recommended)
**Notes:** Consistent with where routing config already lives. Both surfaces feed the same routing logic.

---

## Scope Limits — Cap, Matching, Notifications

| Option | Description | Selected |
|--------|-------------|----------|
| 20 max, no special notification | Max 20 VIP numbers. No special ring. VIP badge visible on calls page after the fact. | |
| 20 max, with VIP notification | Max 20 entries. Distinct SMS or push when VIP calls. Adds notification complexity. | |
| Unlimited, no special notification | No cap on VIP entries. Owner can mark as many as they want. No special notification. | ✓ |

**User's choice:** Unlimited, no special notification
**Notes:** If everything is VIP, that's the owner's choice. Phone rings like any owner-pickup call.

---

## Phone Input & Matching

Discussion clarified outside of AskUserQuestion flow. User asked about verification for correct number format.

**Decision:** Accept any reasonable format the owner types (555-123-4567, (555) 123-4567, +1 555 123 4567). Auto-prepend country code based on tenant's country if omitted. Store in E.164. Show cleaned format back for confirmation. Exact E.164 match at webhook routing time (Twilio always sends E.164). Claude's discretion on exact normalization logic.

---

## Claude's Discretion

- Phone input normalization approach (cleanPhone helper extension)
- VIP badge rendering on LeadCard (color, position, icon)
- VIP section placement on call routing page (above or below existing sections)

## Deferred Ideas

None — discussion stayed within phase scope

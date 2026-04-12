---
phase: 46-vip-caller-direct-routing
verified: 2026-04-12T05:30:00Z
status: human_needed
score: 13/13 must-haves verified
human_verification:
  - test: "Navigate to /dashboard/more/call-routing. Verify 'Priority Callers' section appears ABOVE the schedule card (after the hero toggle), even when the master schedule toggle is OFF. Add a number, save, reload — verify persistence."
    expected: "Priority Callers section is always visible regardless of schedule toggle state. Numbers persist across page reload."
    why_human: "Section placement (above vs below AnimatePresence) and persistence through real Supabase round-trip cannot be verified programmatically."
  - test: "Add an invalid number (e.g. 'hello') to Priority Callers and click 'Add priority number'. Then add a duplicate number."
    expected: "Inline error 'Enter a valid phone number including country code (e.g. +1 555 000 0000).' for invalid. 'This number is already in your priority list.' for duplicate."
    why_human: "Inline validation error display is visual/interactive."
  - test: "Open any lead flyout on /dashboard/leads. Find the 'Priority Caller' toggle row (between Customer Timeline and Pipeline Status). Toggle it ON."
    expected: "Toast reads 'Caller marked as priority'. Star icon turns violet/filled. Closing and reopening the flyout shows the toggle still ON. The LeadCard badge shows 'Priority' with a violet filled star."
    why_human: "Optimistic UI behavior, toast display, badge reactivity via Realtime subscription."
  - test: "Toggle the Priority Caller switch OFF from the flyout."
    expected: "Toast reads 'Priority status removed'. Badge disappears from LeadCard."
    why_human: "Toast copy and badge removal are visual."
  - test: "Simulate a VIP call routing on a staging environment where livekit-agent is live. Place a call from a number listed in a tenant's vip_numbers. Verify the owner's phone rings regardless of schedule."
    expected: "Owner's pickup numbers ring immediately. Call appears with 'You answered' blue badge on the calls page."
    why_human: "Live Twilio/LiveKit webhook call routing cannot be verified without a running agent and real SIP infrastructure."
---

# Phase 46: VIP Caller Direct Routing — Verification Report

**Phase Goal:** Owner selects specific phone numbers or leads whose calls bypass AI and route directly to the owner's phone, regardless of schedule. Covers webhook routing logic (livekit-agent), tenant settings API, and dashboard UI.
**Verified:** 2026-04-12T05:30:00Z
**Status:** human_needed (all automated checks pass; 5 items require live/visual confirmation)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | tenants table has vip_numbers JSONB column with default empty array | VERIFIED | `supabase/migrations/049_vip_caller_routing.sql` line 11-12: `ALTER TABLE public.tenants ADD COLUMN vip_numbers JSONB NOT NULL DEFAULT '[]'::jsonb` — no length CHECK constraint |
| 2 | leads table has is_vip boolean column with default false | VERIFIED | `049_vip_caller_routing.sql` line 15-16: `ALTER TABLE public.leads ADD COLUMN is_vip BOOLEAN NOT NULL DEFAULT false` |
| 3 | Partial index idx_leads_vip_lookup exists | VERIFIED | `049_vip_caller_routing.sql` lines 18-21: `CREATE INDEX idx_leads_vip_lookup ON public.leads (tenant_id, from_number) WHERE is_vip = true` |
| 4 | GET /api/call-routing returns vip_numbers in response | VERIFIED | `src/app/api/call-routing/route.js` line 17: SELECT includes `vip_numbers`; line 51: response includes `vip_numbers: tenant.vip_numbers` |
| 5 | PUT /api/call-routing validates vip_numbers (E.164, no duplicates, array type) and persists | VERIFIED | Lines 212-229: full validation block with `E164_RE.test`, `seenVipNumbers` Set, array type check; line 243: `updatePayload` pattern avoids overwrite if omitted |
| 6 | PATCH /api/leads/[id] accepts is_vip boolean and persists it | VERIFIED | `src/app/api/leads/[id]/route.js` line 59: `is_vip` in destructure; line 78: `if (is_vip !== undefined) updateData.is_vip = is_vip` |
| 7 | GET /api/leads list includes is_vip | VERIFIED | `src/app/api/leads/route.js` line 27: `is_vip` in explicit column SELECT list |
| 8 | _is_vip_caller() exists with two-source lookup | VERIFIED | `livekit-agent/src/webhook/twilio_routes.py` lines 104-139: function with Source 1 (in-memory vip_numbers scan) and Source 2 (leads DB query with `.eq("is_vip", True)`), fail-open on exception |
| 9 | VIP check inserted AFTER subscription check and BEFORE evaluate_schedule | VERIFIED | Lines 213-239: comment `# 2.5. VIP check` placed between subscription check exception handler (line 211) and `evaluate_schedule` call (line 242); VIP match routes to `_owner_pickup_twiml` without calling `evaluate_schedule` or `check_outbound_cap` |
| 10 | Tenant lookup SELECT includes vip_numbers | VERIFIED | Lines 177-179: `"pickup_numbers, dial_timeout_seconds, vip_numbers, subscriptions(status)"` |
| 11 | Priority Callers section always visible on call routing page (outside AnimatePresence) | VERIFIED | `src/app/dashboard/more/call-routing/page.js` line 423: section comment `-- Priority Callers (always visible, outside AnimatePresence per D-03) ---`; Priority Callers block rendered at line 424-534, AnimatePresence block starts at line 537 (AFTER the Priority Callers section) |
| 12 | LeadCard renders Priority badge for is_vip leads | VERIFIED | `src/components/dashboard/LeadCard.jsx` line 175: `{lead.is_vip && (<Badge className="bg-violet-100 text-violet-700 ..."><Star className="h-3 w-3 fill-current" />Priority</Badge>)}` — both desktop and mobile layouts covered |
| 13 | LeadFlyout Priority Caller toggle PATCHes leads with is_vip | VERIFIED | `src/components/dashboard/LeadFlyout.jsx` lines 559-594: toggle row guarded by `lead.from_number`, optimistic `setLead(prev => ({ ...prev, is_vip: checked }))`, PATCH to `/api/leads/${lead.id}` with `{ is_vip: checked }`, optimistic revert on error |

**Score:** 13/13 truths verified (automated)

---

## Required Artifacts

### 46-01: Data Layer and API

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/049_vip_caller_routing.sql` | vip_numbers + is_vip + index | VERIFIED | All three DDL statements present, no length cap |
| `src/app/api/call-routing/route.js` | GET/PUT extended for vip_numbers | VERIFIED | 11+ occurrences of `vip_numbers`; E.164 + duplicate + array-type validation; updatePayload pattern |
| `src/app/api/leads/[id]/route.js` | PATCH accepts is_vip | VERIFIED | 2 occurrences: destructure and updateData conditional |
| `src/app/api/leads/route.js` | GET list includes is_vip | VERIFIED | `is_vip` in explicit column list (no wildcard) |

### 46-02: Webhook Routing

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `livekit-agent/src/webhook/twilio_routes.py` | `_is_vip_caller` + VIP check in routing | VERIFIED | Function at lines 104-139; VIP check block at lines 213-239; tenant SELECT extended at line 179 |
| `livekit-agent/tests/webhook/test_routes.py` | 5 VIP routing tests | VERIFIED | `# Phase 46 — VIP caller routing tests` section at line 719; all 5 test functions present (`test_incoming_call_vip_standalone`, `test_incoming_call_vip_lead`, `test_incoming_call_non_vip_continues`, `test_incoming_call_vip_no_pickup`, `test_incoming_call_vip_check_fail`) |

### 46-03: Dashboard UI

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/dashboard/more/call-routing/page.js` | Priority Callers section with add/edit/delete | VERIFIED | 9 VIP state variables, all 5 handler functions, isDirty extended, PUT payload includes vip_numbers, section rendered before AnimatePresence block |
| `src/components/dashboard/LeadCard.jsx` | Priority badge when is_vip | VERIFIED | Star import, violet-100/violet-700 Badge, fill-current, before urgency badge in both layouts |
| `src/components/dashboard/LeadFlyout.jsx` | Priority Caller toggle | VERIFIED | Star + Switch imports, VIP toggle row with optimistic PATCH and revert |
| `src/app/dashboard/more/page.js` | "Call Routing" menu item | VERIFIED | Line 32: `label: 'Call Routing'` |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `call-routing/route.js` PUT | `tenants` table vip_numbers | `updatePayload.vip_numbers` | WIRED | Lines 242-250: `updatePayload` conditionally includes `vip_numbers`, passed to `.update()` |
| `leads/[id]/route.js` PATCH | `leads` table is_vip | `updateData.is_vip = is_vip` | WIRED | Line 78: conditional assignment; line 80-87: supabase `.update(updateData)` |
| `twilio_routes.py` `_is_vip_caller` | `leads` table | `.eq("is_vip", True)` | WIRED | Lines 121-133: query with `tenant_id + from_number + is_vip=True`, limit 1 |
| `twilio_routes.py` VIP check | `_owner_pickup_twiml` | `_owner_pickup_twiml(from_number, pickup_numbers, timeout)` | WIRED | Line 231: direct call with same parameters as schedule-based routing |
| `call-routing/page.js` handleSave | PUT /api/call-routing | `fetch PUT with vip_numbers` | WIRED | Lines 323-331: `vip_numbers: vipNumbers` in JSON body |
| `LeadFlyout.jsx` toggle | PATCH /api/leads/[id] | `fetch PATCH with is_vip` | WIRED | Lines 577-581: `JSON.stringify({ is_vip: checked })` |
| `LeadCard.jsx` | `lead.is_vip` | `{lead.is_vip && ...Badge}` | WIRED | Lines 175-179: conditional render in desktop layout; lines 267-272: mobile layout |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `call-routing/page.js` | `vipNumbers` | `data.vip_numbers` from GET `/api/call-routing` | GET → Supabase `tenants.vip_numbers` column | FLOWING |
| `LeadCard.jsx` | `lead.is_vip` | `leads` array from parent via `/api/leads` GET | GET → Supabase `leads.is_vip` column (explicit select) | FLOWING |
| `LeadFlyout.jsx` | `lead.is_vip` | Lead detail fetched on open via `/api/leads/[id]` | GET uses `SELECT *` which includes is_vip | FLOWING |
| `twilio_routes.py` `_is_vip_caller` | `vip_numbers` | `tenant.get("vip_numbers")` from tenant row | Tenant SELECT includes `vip_numbers` column | FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Check | Status |
|----------|-------|--------|
| Migration 049 exists with correct DDL | File existence + content grep | PASS |
| vip_numbers in GET /api/call-routing response path | Code path trace: SELECT → response object | PASS |
| E.164 validation in PUT | `E164_RE.test(item.number)` in validation block | PASS |
| Duplicate detection in PUT | `seenVipNumbers.has(item.number)` | PASS |
| VIP check before evaluate_schedule | Comment `# 2.5. VIP check` at line 213, `evaluate_schedule` at line 242 | PASS |
| Fail-open behavior in VIP check | try/except at lines 214 and 201 in `incoming_call` | PASS |
| VIP test section exists | `# Phase 46 — VIP caller routing tests` at line 719 | PASS |
| All 5 VIP test functions present | grep confirms all 5 function names | PASS |
| Priority Callers outside AnimatePresence | Section at line 424, AnimatePresence opens at line 537 | PASS |
| Page heading renamed to "Call Routing" | `page.js` line 387: "Call Routing"; `more/page.js` line 32: label "Call Routing" | PASS |
| LeadCard badge text is "Priority" | Lines 178, 270: "Priority" (not "VIP") | PASS |
| Badge uses fill-current Star | Lines 177, 269: `fill-current` class | PASS |
| VIP toggle section before Pipeline Status | VIP toggle block (lines 559-594) precedes Pipeline Status separator (line 596) | PASS |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| VIP-01 | 46-01 | Migration 049: vip_numbers JSONB + is_vip BOOLEAN + partial index | SATISFIED | `049_vip_caller_routing.sql` all three DDL statements verified |
| VIP-02 | 46-01 | GET /api/call-routing returns vip_numbers | SATISFIED | `route.js` line 17 + 51 |
| VIP-03 | 46-01 | PUT /api/call-routing validates vip_numbers (E.164, dedup, no cap) | SATISFIED | Lines 212-229: full validation; no array length check |
| VIP-04 | 46-01 | PATCH /api/leads/[id] accepts is_vip | SATISFIED | `leads/[id]/route.js` lines 59, 78 |
| VIP-05 | 46-01 | GET /api/leads list includes is_vip | SATISFIED | `leads/route.js` line 27 |
| VIP-06 | 46-02 | `_is_vip_caller` two-source lookup, fail-open | SATISFIED | `twilio_routes.py` lines 104-139 |
| VIP-07 | 46-02 | VIP check after subscription check, before evaluate_schedule; VIP+no-pickup falls through to AI | SATISFIED | Lines 213-239; no-pickup branch at lines 234-237 falls through |
| VIP-08 | 46-02 | Tenant SELECT includes vip_numbers | SATISFIED | Line 179: `vip_numbers` in SELECT string |
| VIP-09 | 46-03 | VIP/Priority section outside AnimatePresence, always visible | SATISFIED | Section at 424-534, AnimatePresence at 537 |
| VIP-10 | 46-03 | Add/edit/delete with E.164 validation, duplicate detection, no cap, saved via PUT | SATISFIED | All 5 handlers present; isDirty extended; PUT payload includes vip_numbers |
| VIP-11 | 46-03 | VIP badge (violet-100/violet-700, filled Star) before urgency badge | SATISFIED | LeadCard lines 175-179; positioned before urgency Badge at line 181 |
| VIP-12 | 46-03 | LeadFlyout Priority Caller toggle PATCHes is_vip, optimistic UI + revert, guarded by from_number | SATISFIED | LeadFlyout lines 559-594: all criteria met |
| VIP-13 | 46-03 | VIP routing uses existing owner_pickup routing_mode | SATISFIED | `_insert_owner_pickup_call` called with existing routing_mode "owner_pickup" (no new enum) |

All 13 VIP requirements satisfied. No orphaned requirements found.

---

## Anti-Patterns Found

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| `LeadFlyout.jsx` line 587 | `toast.error('Could not update VIP status -- try again')` — error toast still uses "VIP" not "Priority" | Info | Cosmetic inconsistency only. Error path is rarely seen and the message is still accurate (referring to the internal field name). Not a functional gap. |
| `LeadFlyout.jsx` line 590 | `aria-label="Toggle VIP status"` — aria-label not renamed to "Toggle priority status" | Info | Cosmetic inconsistency. Functional aria-label is still correctly descriptive. Screen reader behavior unaffected. |

No blocker or warning anti-patterns found. Both items are purely cosmetic regressions from the VIP-to-Priority rename: two strings in the error/aria path were not updated. Success toasts and all visible copy were correctly renamed.

---

## Human Verification Required

### 1. Priority Callers Section Placement and Persistence

**Test:** Navigate to `http://localhost:3000/dashboard/more/call-routing`. Confirm "Priority Callers" card appears between the hero toggle and the schedule card, regardless of whether the schedule toggle is ON or OFF. Add a number, click Save changes, reload the page — verify the number is still there.
**Expected:** Section is always visible. Numbers persist across page reload.
**Why human:** AnimatePresence placement confirmed in code, but visual rendering and real Supabase persistence require running app.

### 2. Priority Callers Validation UI

**Test:** Add an invalid number (e.g. "hello") and click "Add priority number". Then add a valid number twice.
**Expected:** Inline error "Enter a valid phone number including country code (e.g. +1 555 000 0000)." for invalid; "This number is already in your priority list." for duplicate.
**Why human:** Validation errors are rendered conditionally — requires interactive session.

### 3. LeadFlyout Priority Caller Toggle End-to-End

**Test:** Open any lead flyout. Locate "Priority Caller" toggle between Customer Timeline and Pipeline Status. Toggle ON.
**Expected:** Toast "Caller marked as priority". Star icon turns violet/filled. Reopening the flyout shows toggle still ON. LeadCard shows "Priority" badge with violet filled star.
**Why human:** Optimistic UI, toast messages, badge reactivity via Supabase Realtime subscription cannot be verified without running app.

### 4. Priority Caller Toggle OFF

**Test:** Toggle the Priority Caller switch OFF from the flyout.
**Expected:** Toast "Priority status removed". Badge disappears from LeadCard.
**Why human:** Toast copy and badge removal are visual/interactive.

### 5. Live VIP Call Routing (Production Smoke Test)

**Test:** On a staging environment with livekit-agent deployed, place a call from a number listed in a tenant's `vip_numbers` when the schedule is in "AI answers" state (schedule disabled or outside hours).
**Expected:** Owner's pickup numbers ring immediately. Call record shows `routing_mode = owner_pickup`. Calls page shows the blue "You answered" badge.
**Why human:** Requires live Twilio/LiveKit/livekit-agent environment. Cannot be verified by code inspection alone.

---

## Gaps Summary

None. All 13 automated must-haves pass. No artifacts are missing, stub, or orphaned. All key links are wired. The two cosmetic string inconsistencies (error toast "VIP status" and aria-label "Toggle VIP status" not renamed during the VIP-to-Priority rename) are informational only and do not affect functionality.

The only outstanding items are human visual/interactive checks that are inherent to a UI + live voice routing feature.

---

_Verified: 2026-04-12T05:30:00Z_
_Verifier: Claude (gsd-verifier)_

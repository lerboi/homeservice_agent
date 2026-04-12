---
status: diagnosed
phase: 46-vip-caller-direct-routing
source: [46-VERIFICATION.md]
started: 2026-04-12T00:00:00Z
updated: 2026-04-12T00:00:00Z
---

## Current Test

[1 gap diagnosed during test 3 walkthrough — see Gaps section]

## Tests

### 1. Priority Callers section placement and persistence
expected: On `/dashboard/more/call-routing`, the "Priority Callers" card is the first card below the page header. Section remains visible when the master schedule toggle is OFF. After adding a number and clicking "Save changes", reloading the page shows the number persists.
result: [pending]

### 2. Inline validation errors
expected: Adding an invalid phone number (e.g. `abc123`) surfaces an inline validation error below the input. Adding a duplicate phone number shows "This number is already in your priority list."
result: [pending]

### 3. LeadFlyout toggle ON
expected: Opening a lead flyout, toggling "Priority Caller" ON shows a success toast "Caller marked as priority", the star icon turns violet, and the lead's card in the leads list shows a violet "Priority" badge with a filled star. State persists across flyout close/reopen.
result: partial — toggle mechanics work (toast fires, `is_vip` persists), but revealed a broader UX gap: the lead does NOT appear in the Priority Callers section on /dashboard/more/call-routing. See Gap 1.

### 4. LeadFlyout toggle OFF
expected: Toggling "Priority Caller" OFF shows "Priority status removed" toast and the violet badge disappears from the lead card.
result: [pending]

### 5. Live priority call routing (staging smoke test)
expected: With the master schedule toggle in AI-only mode, placing a real phone call from a number that is either in `tenants.vip_numbers` OR is on a lead with `is_vip=true` routes the call directly to the owner's pickup phone, bypassing the AI and bypassing outbound cap checks. A non-priority call from the same environment still reaches the AI.
result: [pending]

## Summary

total: 5
passed: 0
issues: 1
pending: 4
skipped: 0
blocked: 0

## Gaps

### 1. Lead-based priority callers not visible on call-routing settings page
source: test 3 (LeadFlyout toggle ON) — surfaced during manual walkthrough
expected: When a lead is toggled as Priority via the LeadFlyout, that lead also appears in the Priority Callers section on `/dashboard/more/call-routing` so the owner has a single place to see everyone who rings through directly. The webhook routing logic correctly checks both data sources (`tenants.vip_numbers` AND `leads.is_vip`) per design decision D-01/D-02, so a call from a priority lead WILL bypass the AI — but the settings UI provides no way to see or manage those lead-sourced entries.
actual: Priority Callers section reads only `tenants.vip_numbers` from the `/api/call-routing` GET response. Leads with `is_vip=true` are invisible on the settings page. Owner has to open each lead flyout to see/change priority status — there is no unified view.
fix: (1) Extend `GET /api/call-routing` to also return `vip_leads: [{ id, caller_name, from_number }]` for `leads WHERE is_vip=true AND tenant_id=<current>`. (2) Merge both sources into ONE unified Priority Callers list in `src/app/dashboard/more/call-routing/page.js`. Each row shows phone number + name (standalone entry's label OR the lead's caller_name). Remove (trash) button dispatches based on source: standalone → removes from `vip_numbers` array on next PUT; lead-sourced → `PATCH /api/leads/[id]` with `{ is_vip: false }`. Lead-sourced rows show a subtle "Lead ↗" affordance that opens the lead flyout. Edit (pencil) only appears for standalone entries — lead caller details are edited on the lead record itself. Toast copy stays the same ("Priority number removed" / "Priority status removed").
status: failed

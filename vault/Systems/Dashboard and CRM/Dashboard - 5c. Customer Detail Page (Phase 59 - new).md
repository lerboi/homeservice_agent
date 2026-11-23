---
type: system
system: Dashboard and CRM
status: legacy-app
description: "5c. Customer Detail Page (Phase 59 - new). Covers: Layout; Realtime subscriptions (3); Edit Modal (D-18); Merge UX (D-19); UnmergeBanner (D-19)"
source: .claude/skills/dashboard-crm-system/SKILL.md § 5c. Customer Detail Page (Phase 59 — new)
migrated: 2026-11-23
verified:
tags: [voco/system/dashboard-and-crm]
---

# 5c. Customer Detail Page (Phase 59 - new)

Part of [[Dashboard and CRM]]. Migrated verbatim from the `dashboard-crm-system` skill; check `verified` before trusting details.

**File**: `src/app/dashboard/customers/[id]/page.js`

### Layout

Sticky header + 3 tabs:

```
CustomerDetailHeader (sticky)
  name, phone, default_address, lifetime_value, outstanding_balance
  tel: Call button (2026-06-10) — brand-accent <a href="tel:{phone_e164}">
    next to the copy-phone button; PhoneOutgoing icon,
    aria-label "Call <name>" (falls back to formatted phone / "customer");
    rendered only when phone_e164 is present
  Jobber/Xero context badges (gracefully absent when not connected)
  Overflow menu: Edit, Merge into another, View merge history → /dashboard/admin/merges
  UnmergeBanner (ALWAYS mounted since 2026-06-12 — self-detects an undoable merge
    via /api/admin/merges and renders null when inactive; 7-day undo)

Tabs:
  Activity    Unified chronological timeline (calls + booking events + invoice events + notes)
  Jobs        JobCard list filtered by customer_id (Phase 49 pill palette)
  Invoices    Invoice list scoped to this customer (gated by features_enabled.invoicing — Phase 53)
```

### Realtime subscriptions (3)

```js
// Triple-subscribe (D-15):
supabase.channel(`customer-${id}`).on('postgres_changes', { table: 'customers', filter: `id=eq.${id}` }, ...)
supabase.channel(`jobs-${id}`).on('postgres_changes', { table: 'jobs', filter: `customer_id=eq.${id}` }, ...)
supabase.channel(`inquiries-${id}`).on('postgres_changes', { table: 'inquiries', filter: `customer_id=eq.${id}` }, ...)
```

All three pass a status callback to `.subscribe()` and refetch on reconnect
after `CHANNEL_ERROR`/`TIMED_OUT`/`CLOSED`; INSERTs trigger a refetch rather
than prepending the join-less payload (2026-06-12 — see Section 13).

### Edit Modal (D-18)

Full CRUD modal triggered by Edit button. Fields: name, default_address,
email, notes, tags. Phone is **read-only** — to "change" a customer's
phone the owner uses Merge. Save → `PATCH /api/customers/[id]`.
Modal pattern matches existing dashboard editing UX.

### Merge UX (D-19)

Secondary action in CustomerDetailHeader overflow menu ("Merge into another").
Flow:
1. Typeahead picker → select target customer
2. Preview dialog: "Will move: N jobs, M inquiries, K invoices, L calls.
   Name 'X' will become 'Y'. Undoable for 7 days."
3. Confirm → `POST /api/customers/[id]/merge` → `merge_customer` RPC
4. Response includes `audit_id` → UI can navigate to `/dashboard/admin/merges`

### UnmergeBanner (D-19)

Shown on the **target** customer's detail page when a merge has been
performed within the last 7 days. Surfaces undo button → `POST /api/customers/[id]/unmerge`
→ `unmerge_customer` RPC. After 7 days the banner disappears
(window expired — forward-fix only).

**2026-06-12 fix — always mounted, self-detecting**: the banner is now
unconditionally rendered by the customer detail page and decides for itself
whether to show: it queries `GET /api/admin/merges`, looks for an active
(un-expired, not-yet-unmerged) merge targeting this customer, and renders
null otherwise. The previous mount condition gated on a
`merged_source_info` field **that no API ever returned** — the condition
could never be true, so the banner never appeared and the 7-day undo was
unreachable from the UI.

---

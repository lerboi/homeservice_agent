---
type: system
system: Dashboard and CRM
status: legacy-app
description: "Supabase Realtime. Covers: Publication; Client subscription pattern (2026-06-12 resilience rework)"
source: .claude/skills/dashboard-crm-system/SKILL.md § 13. Supabase Realtime
migrated: 2026-11-23
verified:
tags: [voco/system/dashboard-and-crm]
---

# Supabase Realtime

Part of [[Dashboard and CRM]]. Migrated verbatim from the `dashboard-crm-system` skill; check `verified` before trusting details.

### Publication

`supabase_realtime` publication covers:

| Table | Added in | Purpose |
|-------|----------|---------|
| `leads` | 004 | **DROPPED** (migration 061) — superseded by customers/jobs/inquiries |
| `customers` | 059 | Live customer updates (`REPLICA IDENTITY FULL`) |
| `jobs` | 059 | Live job updates on jobs tab (`REPLICA IDENTITY FULL`) |
| `inquiries` | 059 | Live inquiry updates on the Calls Callbacks view (`REPLICA IDENTITY FULL`) |
| `calls` | 041 | Live call updates on calls page (`REPLICA IDENTITY FULL`) |
| `appointments` | (standard) | Calendar live updates |
| `calendar_events` | 057 | Provider='jobber' schedule-mirror live updates |

**NOT published** (derived/audit-only): `customer_calls`, `job_calls`, `customer_merge_audit`.

### Client subscription pattern (2026-06-12 resilience rework)

Two rules now apply to **every** dashboard channel (calls page ×2, jobs,
customer-detail ×3, calendar ×2):

1. **Status callback + refetch-on-reconnect**: `.subscribe()` is passed a
   status callback; after a `CHANNEL_ERROR`, `TIMED_OUT`, or `CLOSED` status
   the page refetches its data when the channel re-establishes — events
   missed while the WebSocket was down are no longer silently lost (the old
   bare `.subscribe()` meant a dropped channel froze the page until manual
   refresh).
2. **INSERT → refetch, never prepend the raw payload**: Realtime INSERT
   payloads have **no joins** (no customer name, no embeds), so prepending
   `payload.new` rendered "Unknown" rows — and a phantom-field filter
   (checking fields the payload never carried) silently dropped many inserts
   entirely. INSERT events now trigger the page's existing fetch function;
   UPDATE events may still patch rows in place.

```js
// Jobs tab — src/app/dashboard/jobs/page.js
const channel = supabase
  .channel(`jobs-${tenantId}`)
  .on('postgres_changes',
      { event: '*', schema: 'public', table: 'jobs',
        filter: `tenant_id=eq.${tenantId}` },
      (payload) => handleRealtimeEvent(payload))   // INSERT → fetchJobs()
  .subscribe((status) => {                         // 2026-06-12
    // CHANNEL_ERROR / TIMED_OUT / CLOSED → refetch on reconnect
  });

// Callbacks view — src/app/dashboard/calls/page.js (Inquiries → Calls merge)
// INSERT → refetch (was prependWithSlideIn(payload.new)); UPDATE replaces row.

// Customer detail — triple-subscribe (customers + jobs + inquiries by customer_id)
// See Section 5c for subscription details. All three carry the status callback.
```

Cleanup in the effect return — `channel.unsubscribe()` on older pages,
`supabase.removeChannel(channel)` for the calls-page `inquiries-realtime`
channel (on unmount / tenant change).

---

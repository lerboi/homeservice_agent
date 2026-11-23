---
type: system
system: Dashboard and CRM
status: legacy-app
description: "5e. Customers List Page (prod-readiness 2026-06 - new). Covers: Data flow; Row shape (`CustomerRow`); Two accuracy caveats (DO NOT silently 'fix' — they are known)"
source: .claude/skills/dashboard-crm-system/SKILL.md § 5e. Customers List Page (prod-readiness 2026-06 — new)
migrated: 2026-11-23
verified:
tags: [voco/system/dashboard-and-crm]
---

# 5e. Customers List Page (prod-readiness 2026-06 - new)

Part of [[Dashboard and CRM]]. Migrated verbatim from the `dashboard-crm-system` skill; check `verified` before trusting details.

**File**: `src/app/dashboard/customers/page.js`

Client component, modeled on the Jobs / Inquiries pages. **Added to close
5 dead "Back to Customers" 404s** — previously only `customers/[id]` existed,
so every "back to list" affordance pointed at a non-existent route.

### Data flow

- Fetches `GET /api/customers?search=<term>` (route → `listCustomers` in
  `src/lib/customers.js`). No Realtime subscription here (unlike Jobs/Inquiries);
  refetch is driven by the committed `?search=` URL param.
- Search input is debounced 300ms → `router.replace('/dashboard/customers?search=')`;
  the committed `searchParams.get('search')` is the single fetch trigger.
- States: loading (4× `<Skeleton>` rows), `<ErrorState onRetry>`,
  filtered-empty (Clear-search affordance), zero-data `<EmptyState icon={Contact}
  headline="No customers yet">`, and the row list.

### Row shape (`CustomerRow`)

Each row is a `<Link href={/dashboard/customers/${id}}>` card (`card`-token
styling, hover lift) showing:
- `Contact` avatar + `name || phone_e164 || 'Unknown'`
- phone (`phone_e164`, `Phone` icon)
- **jobs count** — `readCount(customer.jobs)` from the `jobs:jobs(count)` embed
- **inquiries count** — `readCount(customer.open_inquiries)`, brand-accent
  pill, only rendered when `> 0`

`readCount()` handles the Supabase `relation:relation(count)` embed shape
(`[{ count: N }]`).

### Two accuracy caveats (DO NOT silently "fix" — they are known)

1. **Inquiries count is TOTAL, not open.** The `listCustomers` select aliases
   the embed `open_inquiries:inquiries(count)`, but the embed has **no
   `.eq('status','open')` filter**, so the badge counts ALL inquiries for the
   customer regardless of status. The alias name is aspirational. (Contrast:
   the customer-detail `computeStatsInline` *does* filter `status='open'`.)
   To make the badge truly "open", add a filtered embed/aggregate to
   `listCustomers`.
2. **VIP star is inert.** `CustomerRow` reads `customer.is_vip ||
   customer.has_vip_job`, but the `listCustomers` select returns **neither**
   field, so the `<Star>` never renders today. It lights up only once the list
   endpoint starts returning an `is_vip` (or `has_vip_job`) flag.

---

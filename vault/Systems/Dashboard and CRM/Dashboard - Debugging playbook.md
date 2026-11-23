---
type: system
system: Dashboard and CRM
status: legacy-app
description: "Symptoms, likely causes and where to look when Dashboard and CRM misbehaves."
source: .claude/skills/dashboard-crm-system/SKILL.md § 19. Debugging playbook
migrated: 2026-11-23
verified:
tags: [voco/system/dashboard-and-crm]
---

# Debugging playbook

Part of [[Dashboard and CRM]]. Migrated verbatim from the `dashboard-crm-system` skill; check `verified` before trusting details.

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Jobs tab shows no data | Realtime subscription on wrong table (old `leads`) | Check subscription uses `table: 'jobs'` not `table: 'leads'` |
| Callbacks view always empty | Default sub-filter excludes non-open OR Realtime channel dropped | Check the `open` default sub-pill; verify the `inquiries-realtime` channel in `calls/page.js` |
| `/dashboard/inquiries` "doesn't render" | It's a server redirect since 2026-06-10 | Expected — lands on `/dashboard/calls?view=callbacks`; old `?status=` params are dropped (Open sub-pill) |
| No search/urgency/date filters on Callbacks | `InquiryFilterBar` deleted with the old page | Expected (known consequence) — API still supports the filters; re-adding needs a UI consumer |
| Calls page lands on the queue instead of the call log | Smart default re-introduced | There is NO smart default (removed same-day, 2026-06-10) — classic view is always the default; only explicit `?view=callbacks` / legacy `?view=needs-reply` opens Callbacks |
| CallbacksStrip not showing | Open count is 0, inquiries fetch still loading, or fetch errored | Expected — strip renders only when `openCallbacksCount > 0`; it appears once `/api/inquiries` resolves and never blocks the classic view |
| Customer detail page flickers on activity | Only one of 3 Realtime channels subscribed | Ensure triple-subscribe: customers + jobs + inquiries filtered by customer_id |
| UnmergeBanner not showing | Pre-2026-06-12: gated on `merged_source_info` (never returned by any API) | Banner is now ALWAYS mounted and self-detects via `/api/admin/merges`; it appears on the TARGET customer page within the 7-day window |
| Merge throws "source_invalid" | Source already merged OR wrong tenant | Check `customers.merged_into IS NULL` before initiating merge |
| Admin merges page 404 | Not admin user OR navigating without admin gate | Route is `/dashboard/admin/merges`; ensure verifyAdmin() passes |
| HotJobsTile shows "No jobs" after Phase 59 deploy | DailyOpsHub still importing deleted HotLeadsTile | Fix import to `HotJobsTile` |
| Setup checklist item shows red-dot without "Reconnect needed" subtitle | `error_subtitle` not emitted uniformly OR `has_error` missing | Check `deriveChecklistItems` returns both fields; see 58-02 |
| BusinessIntegrationsClient stuck on "Connecting…" | Callback didn't `revalidateTag('integration-status-${tenantId}')` | See `integrations-jobber-xero/references/caching.md` |
| Calendar shows empty grids on error instead of retry affordance | `fetchError` state missing | Top-level `<ErrorState onRetry={fetchData}/>` early-return |
| Hardcoded `focus:ring-2` on new component | Missed Phase 58 POLISH-03 sweep | Import `{ focus }` from `@/lib/design-tokens` or use `focus-visible:` directly |
| `<EmptyState>` import shadows local helper | Name collision | Rename local → `<PageName>EmptyState`; delegate zero-data to shared primitive |
| Invoices/estimates batch-review 404 | Missing `?ids=` query param | Expected — route requires ID list |
| Recurring setup dialog for appointment | Not supported — invoice-only | Disambiguate user intent before implementation |
| Dashboard dark-mode regression | Hardcoded `bg-white`/`bg-stone-*` without `dark:` variant | Swap to `bg-card`/`bg-muted` semantic tokens |
| "Back to Customers" 404 | `/dashboard/customers` list route missing | Fixed prod-readiness 2026-06 (`customers/page.js`); ensure route exists |
| Customers list inquiry badge looks too high | Embed `open_inquiries` is NOT filtered to open — counts ALL inquiries | Known caveat (Section 5e); add `status='open'` filter to `listCustomers` embed to fix |
| VIP star never shows on customers list | `listCustomers` returns no `is_vip`/`has_vip_job` | Known caveat (Section 5e); list endpoint must return the flag |
| Customer not reachable on mobile | Customers has no `BottomTabBar` tab | Expected — reach via `/dashboard/more` Business section |
| Command palette doesn't trap focus / Esc not closing | Reverted to hand-rolled overlay | Must wrap in Radix `Dialog` (Section 21) |
| Search shows "leads" group/copy | Stale pre-repointing copy | Group `type` is `customers`; update icon/placeholder to match |
| Jobs job-type filter/chips reappear in a diff | `jobs.job_type` column doesn't exist (059) — all job_type UI was REMOVED 2026-06-12 | Don't reintroduce without adding the column (Section 5); inquiries DO support `job_type` |
| Calls nav badge missing/stale | `useAttentionCounts` reads `/api/dashboard/stats`; badge = `callsAttention` (openInquiries + missedCallsToday) | Check stats response; 60s SWR refresh + focus revalidate; badge hidden at 0, caps at "9+" |
| Activity feed row not clickable | `customer_*` event without `customer_id`, or `invoice_*` with invoicing flag off | Expected — `getHref` returns null and the row renders unlinked |
| MoneySnapshot strip not rendering | `invoicing` flag off or stats not loaded | Expected — component returns null in both cases |

---

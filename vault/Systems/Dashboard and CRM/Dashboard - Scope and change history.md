---
type: system
system: Dashboard and CRM
status: record
description: "The former dashboard-crm-system skill's scope statement, preamble and running 'last updated' change history. Read only when you need to know when or why something changed."
source: ".claude/skills/dashboard-crm-system/SKILL.md § frontmatter description + preamble"
migrated: 2026-11-23
verified:
tags: [voco/system/dashboard-and-crm]
---

# Scope and change history

Part of [[Dashboard and CRM]]. Migrated verbatim from the `dashboard-crm-system` skill.

## Scope: what the former skill covered

Complete architectural reference for the Voco dashboard and CRM system — all dashboard pages (home, jobs tab, customers list + detail, calendar, calls with its Callbacks inquiries view, invoices, estimates, more/*), Phase 59 customer/job model split (Jobs tab from jobs table, inquiries surfaced as the Callbacks view inside Calls since the 2026-06-10 merge, Customers list page + Customer detail page with Activity/Jobs/Invoices tabs + Edit modal + Merge/Unmerge UX + UnmergeBanner), admin /dashboard/admin/merges view (customer_merge_audit, D-19 expanded), D-07a owner-responsibility for open inquiries (no auto-timeout), setup checklist (Phase 48; 2026-06-21 onboarding revamp — retiered into Essential/Recommended/Optional, CallReadinessCard home indicator, auto-start tour) with Phase 58 red-dot error variant, Business Integrations card (Phase 55/56 — BusinessIntegrationsClient), Phase 57 overlays (JobberBookableUsersSection, JobberCopyBanner), Phase 58 UI polish primitives (EmptyState, ErrorState, AsyncButton, focus-visible ring token), prod-readiness 2026-06 UX/IA repointing (Customers list route, More-tab three-section regroup, CommandPalette Radix Dialog a11y, dashboard/stats 'new' = open inquiries, global search customers group), design tokens (Phase 49 light+dark mode via CSS variables), ImpersonationBanner / BillingWarningBanner / TrialCountdownBanner, guided tour, FeatureFlagsProvider (Phase 53), Supabase Realtime integration. Use this skill whenever making changes to dashboard pages, customer management, job management, inquiry management, merge/unmerge UX, CRM components, escalation contacts, service management, setup checklist, business integrations card, command palette, navigation/IA, design tokens, or UI polish patterns.

## Preamble and change history

## Dashboard & CRM System — Complete Reference

This document is the single source of truth for the dashboard and CRM
system. Read this before making any changes to dashboard pages or CRM
components.

> ⚠️ **AI Voice picker (2026-06-12):** the picker
> (`VoicePickerSection.jsx`, `ai-voice-settings/page.js`, `src/lib/ai-voice-validation.js`)
> now offers the **3 stable labels** — `professional` / `friendly` / `local_expert` — with
> display names; the **stored value is the label**, paired with migration `070` (which
> replaced 067's OpenAI-name CHECK; apply 070 BEFORE deploying the picker). The Phase 66
> cascade agent maps labels → ElevenLabs voice ids via `ELEVENLABS_VOICE_MAP`. Preview-play
> files are `/audio/voices/{label}.mp3` — **assets pending** (not call-blocking). The earlier
> Phase 65 10-voice OpenAI picker is historical.

**Last updated**: 2026-06-20 (M16 P1 — "Service-Area gate", Capability A:
the multi-zone `ZoneManager` (+ `zone_travel_buffers` pairwise-buffer matrix)
and its `/api/zones` (+`[id]`) routes were **removed**, replaced by a single
`ServiceAreaManager` mounted at `/dashboard/more/service-zones` (page heading
"Service Zones & Travel" → **"Service Area"**) — a postal/ZIP-code chip input +
town/city chip input (comma/Enter to add), an out-of-area action select
(`callback` default: take a message & call back / `decline_referral`: politely
decline + optional referral / `trip_fee`: book but mention a possible travel
fee) with a conditional referral-note textarea (only for `decline_referral`),
and an explicit dirty-tracked **"Save service area"** button; backed by new
`GET/PUT /api/service-area`. Persists owner choice to `tenants.out_of_area_action`
+ `tenants.out_of_area_referral_note` (migration 074) and collapses
`service_zones` coverage (`postal_codes` + new `cities[]`) to one canonical row
on save. New durable `inquiries.out_of_area boolean` is set by the voice agent
when a caller's confirmed address is outside the Service Area — **persisted but
the Callbacks/CRM badge to surface it is a DEFERRED follow-up, not yet
displayed**.)

**2026-06-12 update**: (audit wave 1 dashboard fixes — (1) **Invoices/estimates pagination**: `useDocumentList` now paginates — `limit` grows 50 → 500 via a "Load more" button, `hasMore` derived from the API's `total_count`; a status-tab change resets the limit. The silent 50-row hard cap is gone. (2) **JobFlyout transcript + recordings work**: `getJob`'s detail select now includes `recording_storage_path`, `transcript_text`, `transcript_structured` (it previously selected none of them, so the flyout's TranscriptViewer was always empty and storage-path recordings never resolved). (3) **`job_type` UI removed everywhere** — the column never existed (migration 059): JobFilterBar input gone, JobCard/JobFlyout chips gone, jobs page param gone; the batch-invoice dialog now shows `service_address` instead. (4) **Realtime resilience**: ALL dashboard channels (calls ×2, jobs, customer-detail ×3, calendar ×2) now pass a status callback to `.subscribe()` and refetch on reconnect after `CHANNEL_ERROR`/`TIMED_OUT`/`CLOSED`; INSERT events now trigger the page's fetch function instead of prepending the join-less Realtime payload — no more "Unknown" rows, and the phantom-field filter that silently dropped inserts is gone. (5) **AbortController everywhere**: the calendar page's abort pattern replicated in calls/jobs/customers/customer-detail fetches + CommandPalette search + CustomerMergeDialog typeahead. (6) **Mobile create-FABs** on invoices/estimates moved `bottom-6` → `bottom-20` (no longer cover the BottomTabBar). (7) **UnmergeBanner is ALWAYS mounted** on the customer detail page — it self-detects undoable merges via `/api/admin/merges` and renders null when inactive; the `merged_source_info` gate that could never be true is gone. (8) **Billing/Trial banners**: dismiss buttons removed; `BillingWarningBanner` gains a RED "AI receptionist is paused" suspended variant post-grace (see payment-architecture). (9) Voice picker → 3 labels (see banner above). (10) The stale untracked `src/app/dashboard/leads/` page (broken imports, pre-Phase-59 leftover) was deleted.)

**Previous update**: 2026-06-10 (b: calendar page rework — see §7 "2026-06-10
rework": `IntegrationReconnectBanner` + `JobberCopyBanner` DELETED, replaced
by the new `CalendarConnectionsCard` (calendars + Jobber/Xero rows with
inline Reconnect state, "Action needed" pill); single-row toolbar;
`initialLoading`/`fetching` state split kills the skeleton flash on
navigation; AbortController on fetchData; bottom cards now one responsive
grid; `jobberConnected` from `/api/integrations/status` SWR. Token-refresh
backend fixes same day → integrations-jobber-xero skill.)

**Same-day prior**: 2026-06-10 (Inquiries → Calls merge + same-day rework
after user feedback + dark-mode pass + dashboard UX wave — Inquiries tab
removed: `/dashboard/inquiries` is now a server redirect to
`/dashboard/calls?view=callbacks`; the queue is the **Callbacks** view
(renamed from "Needs reply") inside Calls. The classic calls layout is the
ONE default landing view — the smart default and the two-pill ViewSwitcher
were removed same-day; a compact brand-accent **CallbacksStrip** above the
stat cards (only when open count > 0) opens the Callbacks view, which has a
"← All calls" back control. URL: `?view=callbacks` explicit (legacy
`?view=needs-reply` accepted as alias), no param / `?view=all` → classic;
`InquiryFilterBar` + `EmptyStateInquiries` deleted; nav: sidebar drops
Inquiries, BottomTabBar re-promotes Calendar, Calls badge = combined
`callsAttention`; HotJobsTile CTAs + activity-feed inquiry events →
`?view=callbacks`; chatbot calls/inquiries/jobs docs rewritten +
ROUTE_DOC_MAP fix. Dark mode: neutral dark `--sidebar-bg`, new
`--sidebar-bg-border` token, calendar/UsageRingGauge hex→token sweep,
system-wide `dark:` badge pass (~107 spots / 26 files). Plus the same-day
UX wave: Home tiles repointed, TodayAppointmentsTile CTA+rows →
`/dashboard/calendar`, HotJobsTile retitled "Needs follow-up" (open
inquiries), CallsTile friendly copy + linked rows; RecentActivityFeed full
16-event map + deep links; new MoneySnapshot strip; nav attention badges
via `useAttentionCounts`; `/api/dashboard/stats` adds `missedCallsToday` +
`invoiceOverdueAmount`; jobs/inquiries `search` + date-range filters wired
server-side; calls transcript viewer + name-or-phone search +
plain-language copy; inquiry `converted` displayed as "Booked"; customer
tel: Call button; jobs batch-invoice failure → sonner toast)

**Prior update**: 2026-06-04 (prod-readiness 2026-06 — Customers LIST page
added at `/dashboard/customers` (closes 5 dead "Back to Customers" 404s);
sidebar + mobile More-menu Customers entry; More-tab regrouped into three
sections (Business / AI & Calls / Billing & Money); CommandPalette wrapped
in Radix Dialog for a11y + "leads"→"customers" copy; Phase-59 repointing of
dashboard/stats 'new' tile, global search customers group, and
HelpDiscoverabilityCard links)

**Earlier**: 2026-04-21 (Phase 59 — customer/job model separation:
Jobs tab rewired to jobs table, new Inquiries tab, Customer detail page,
Merge/Unmerge UX, Admin Merges view, D-07a owner-responsibility stance,
chatbot corpus split into customers/jobs/inquiries)

---

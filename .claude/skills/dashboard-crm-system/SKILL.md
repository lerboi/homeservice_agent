---
name: dashboard-crm-system
description: "Complete architectural reference for the Voco dashboard and CRM system — all dashboard pages (home, jobs tab, customers list + detail, calendar, calls with its Callbacks inquiries view, invoices, estimates, more/*), Phase 59 customer/job model split (Jobs tab from jobs table, inquiries surfaced as the Callbacks view inside Calls since the 2026-06-10 merge, Customers list page + Customer detail page with Activity/Jobs/Invoices tabs + Edit modal + Merge/Unmerge UX + UnmergeBanner), admin /dashboard/admin/merges view (customer_merge_audit, D-19 expanded), D-07a owner-responsibility for open inquiries (no auto-timeout), setup checklist (Phase 48; 2026-06-21 onboarding revamp — retiered into Essential/Recommended/Optional, CallReadinessCard home indicator, auto-start tour) with Phase 58 red-dot error variant, Business Integrations card (Phase 55/56 — BusinessIntegrationsClient), Phase 57 overlays (JobberBookableUsersSection, JobberCopyBanner), Phase 58 UI polish primitives (EmptyState, ErrorState, AsyncButton, focus-visible ring token), prod-readiness 2026-06 UX/IA repointing (Customers list route, More-tab three-section regroup, CommandPalette Radix Dialog a11y, dashboard/stats 'new' = open inquiries, global search customers group), design tokens (Phase 49 light+dark mode via CSS variables), ImpersonationBanner / BillingWarningBanner / TrialCountdownBanner, guided tour, FeatureFlagsProvider (Phase 53), Supabase Realtime integration. Use this skill whenever making changes to dashboard pages, customer management, job management, inquiry management, merge/unmerge UX, CRM components, escalation contacts, service management, setup checklist, business integrations card, command palette, navigation/IA, design tokens, or UI polish patterns."
---

# dashboard-crm-system (moved to the vault)

The architecture reference that used to be in this file now lives in the Obsidian vault as small linked notes. This system is part of the legacy home-service app: deployed and unchanged, not the current product focus.

1. Read the index: `vault/Systems/Dashboard and CRM/Dashboard and CRM.md`. It lists every note with a one-line description.
2. Open only the notes the task needs (same folder).
3. Notes with an empty `verified:` field were migrated verbatim on 2026-11-23 and not re-checked: confirm specifics against the code.
4. After changing code in this system, update the matching vault note and set its `verified:` date. Do not add documentation back into this file.

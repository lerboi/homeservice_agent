---
type: system
system: Integrations Jobber Xero
status: legacy-app
description: "voice-call-architecture — the call path that wires check_customer_account"
source: .claude/skills/integrations-jobber-xero/SKILL.md § Related skills
migrated: 2026-11-23
verified:
tags: [voco/system/integrations-jobber-xero]
---

# Related skills

Part of [[Integrations Jobber Xero]]. Migrated verbatim from the `integrations-jobber-xero` skill; check `verified` before trusting details.

- `voice-call-architecture` — the call path that wires `check_customer_account`
  and pre-session context injection into the agent entrypoint.
- `dashboard-crm-system` — owns `BusinessIntegrationsClient`, the setup
  checklist renderer, and the `/dashboard/more/integrations` route.
- `auth-database-multitenancy` — `accounting_credentials` RLS policies,
  service-role Supabase client pattern, migration counts.
- `scheduling-calendar-system` — Jobber schedule mirror (Phase 57) writes into
  the same `calendar_events` table that Google + Outlook sync populate.

---

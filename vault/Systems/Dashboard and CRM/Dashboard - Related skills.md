---
type: system
system: Dashboard and CRM
status: legacy-app
description: "integrations-jobber-xero — BusinessIntegrationsClient rendering"
source: .claude/skills/dashboard-crm-system/SKILL.md § Related skills
migrated: 2026-11-23
verified:
tags: [voco/system/dashboard-and-crm]
---

# Related skills

Part of [[Dashboard and CRM]]. Migrated verbatim from the `dashboard-crm-system` skill; check `verified` before trusting details.

- `integrations-jobber-xero` — BusinessIntegrationsClient rendering
  details, setup-checklist Reconnect flow mechanics, Xero/Jobber OAuth,
  webhooks, caching, Python agent injection, telemetry. **Read this
  skill for anything on the integrations page or Reconnect flow.**
- `auth-database-multitenancy` — `leads` / `calls` / `appointments` /
  `activity_log` RLS, middleware guards, migration catalog.
- `payment-architecture` — billing page, Stripe Checkout Session, usage
  ring gauge, subscription gate, overage metering.
- `scheduling-calendar-system` — calendar events, slot calculation,
  TimeBlocks, Google/Outlook/Jobber calendar sync.
- `public-site-i18n` — landing page, pricing page, i18n config
  (dashboard itself is English-only; `src/messages/*` covers agent +
  notifications).

---

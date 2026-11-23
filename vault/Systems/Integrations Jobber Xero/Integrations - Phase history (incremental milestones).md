---
type: system
system: Integrations Jobber Xero
status: legacy-app
description: "Migration 058 (oauth_refresh_locks) shipped in Phase 55 to eliminate"
source: .claude/skills/integrations-jobber-xero/SKILL.md § Phase history (incremental milestones)
migrated: 2026-11-23
verified:
tags: [voco/system/integrations-jobber-xero]
---

# Phase history (incremental milestones)

Part of [[Integrations Jobber Xero]]. Migrated verbatim from the `integrations-jobber-xero` skill; check `verified` before trusting details.

| Phase | Plan | Shipped |
|-------|------|---------|
| 52 | — | `integrations_schema.sql` migration scaffolding |
| 54 | — | `/dashboard/more/integrations` Server Component + `getIntegrationStatus` 'use cache' |
| 55 | Plan 01–06 | Xero OAuth + refresh + `fetchCustomerByPhone` + webhook + dashboard card + pre-session Python fetch |
| 56 | Plan 01–06 | Jobber OAuth (GraphQL) + webhook + dashboard card + Python adapter + external_account_id migration |
| 57 | Plan 01–05 | Jobber schedule mirror (calendar_events provider='jobber'), poll cron, webhook visits, `JobberCopyBanner`, `JobberBookableUsersSection` |
| 58 | Plan 02 | Setup checklist error-state detection (red-dot + Reconnect needed) |
| 58 | Plan 03 | `activity_log` `integration_fetch` + `integration_fetch_fanout` telemetry in Python adapters |
| 58 | Plan 04/05 | `<AsyncButton>` migration on `BusinessIntegrationsClient` Connect/Disconnect/Reconnect |

Migration 058 (`oauth_refresh_locks`) shipped in Phase 55 to eliminate
refresh-token race between concurrent calls. **Prod-readiness 2026-06** extended
participation to the Python agent (`_refresh_lock.py`) and fixed the Python-side
`expiry_date` write (ISO string → `int(epoch_ms)`) — see "Token-expiry storage
contract" and "OAuth refresh-lock — cross-runtime participation" above.

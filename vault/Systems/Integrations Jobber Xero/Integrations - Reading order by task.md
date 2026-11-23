---
type: system
system: Integrations Jobber Xero
status: legacy-app
description: "Reading order by task (Integrations Jobber Xero)"
source: .claude/skills/integrations-jobber-xero/SKILL.md § Reading order by task
migrated: 2026-11-23
verified:
tags: [voco/system/integrations-jobber-xero]
---

# Reading order by task

Part of [[Integrations Jobber Xero]]. Migrated verbatim from the `integrations-jobber-xero` skill; check `verified` before trusting details.

| Task | Read |
|------|------|
| Add a new OAuth scope | references/oauth-flows.md |
| Debug a webhook silently dropped | references/webhooks.md |
| Ship a new cache tag | references/caching.md |
| Change what gets injected into `customer_context` | references/python-agent-injection.md |
| Modify `BusinessIntegrationsClient` card state | references/dashboard-ui.md |
| Query p95 latency for integration fetches | references/telemetry.md |
| Add a new provider (e.g., Housecall Pro) | references/oauth-flows.md + `src/lib/integrations/adapter.js` + this SKILL.md |
| Move Jobber from polling to push on schedule mirror | references/webhooks.md + `scheduling-calendar-system` skill |

---

---
name: integrations-jobber-xero
description: "Xero (REST, xero-node SDK) + Jobber (GraphQL, graphql-request) OAuth/refresh/refresh-locks, shared src/lib/integrations/ adapter contract, webhook HMAC + intent-verify + per-phone cacheTag invalidation, Python agent pre-session context fetch (livekit-agent/src/integrations/{xero,jobber}.py), check_customer_account tool, BusinessIntegrationsClient 4-state card + reconnect banner, setup checklist Reconnect flow, telemetry (last_context_fetch_at + activity_log integration_fetch events). Use this skill when you need to modify Xero or Jobber OAuth, debug webhook delivery, change caching or cacheTag invalidation, touch the Python agent's customer-context injection, update BusinessIntegrationsClient, debug setup-checklist Reconnect flow, or investigate integration latency."
---

# integrations-jobber-xero (moved to the vault)

The architecture reference that used to be in this file now lives in the Obsidian vault as small linked notes. Jobber and Xero are feature-flagged off.

1. Read the index: `vault/Systems/Integrations Jobber Xero/Integrations Jobber Xero.md`. It lists every note with a one-line description.
2. Open only the notes the task needs (same folder).
3. Notes with an empty `verified:` field were migrated verbatim on 2026-11-23 and not re-checked: confirm specifics against the code.
4. After changing code in this system, update the matching vault note and set its `verified:` date. Do not add documentation back into this file.

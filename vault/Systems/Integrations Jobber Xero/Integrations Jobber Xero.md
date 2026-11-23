---
type: system-index
system: Integrations Jobber Xero
status: legacy-app
repo: homeservice_agent + livekit-agent
description: Xero (REST, xero-node SDK) + Jobber (GraphQL, graphql-request) OAuth/refresh/refresh-locks, shared src/lib/integrations/ adapter contract, webhook HMAC + intent-verify + per-phone cacheTag invalidation, Python agent pre-session context fetc…
source_skills: [integrations-jobber-xero]
migrated: 2026-11-23
verified:
tags: [voco/system/integrations-jobber-xero]
---

# Integrations Jobber Xero

Up: [[Home]] · [[Systems]]

> **How to use:** read this index, then open only the notes the task needs. After changing code in this system, update the matching note and set its `verified:` date.

**Status (2026-11-23):** legacy app, feature-flagged off: [[Decision - Jobber and Xero integrations frozen behind a flag for v1]].

## Notes (from `integrations-jobber-xero`)

| Note | Lines | Status | What is in it |
|---|---|---|---|
| [[Integrations - Architecture Overview]] | 222 | legacy-app | End-to-end flow and main components of Integrations Jobber Xero. Covers: Database surface; Token-expiry storage contract (prod-readiness 2026-06); Refresh reliability (2026-06-10) — why "tokens expired" kept recurring, and the fix; OAuth refresh-lock — cross-runtime participation (prod-readiness 2026-06); Data flow (dashboard vs call path) |
| [[Integrations - Subsystems - Reading Guide]] | 44 | legacy-app | For each subsystem, jump to the deep-dive reference file: Covers: OAuth + refresh + refresh locks → references/oauth-flows.md; Caching → references/caching.md; Webhook handlers → references/webhooks.md; Python agent injection → references/python-agent-injection.md; Dashboard UI → references/dashboard-ui.md; Telemetry → references/telemetry.md |
| [[Integrations - Phase 61 cross-link - Voco-normalized address shape]] | 44 | legacy-app | Phase 61 added a Voco-normalized address_components JSONB column to |
| [[Integrations - Related skills]] | 11 | legacy-app | voice-call-architecture — the call path that wires check_customer_account |
| [[Integrations - Gotchas]] | 58 | legacy-app | Next.js 16 forbids 'use cache' on class methods. Use module-level |
| [[Integrations - Reading order by task]] | 13 | legacy-app | Reading order by task (Integrations Jobber Xero) |
| [[Integrations - Phase history (incremental milestones)]] | 16 | legacy-app | Migration 058 (oauth_refresh_locks) shipped in Phase 55 to eliminate |
| [[Integrations - Reference - Caching]] | 159 | legacy-app | Covers: 'use cache' directive, per-tenant + per-phone cacheTag, webhook-driven |
| [[Integrations - Reference - Dashboard Ui]] | 206 | legacy-app | Covers: 4-state machine, reconnect banner, setup-checklist red-dot variant, |
| [[Integrations - Reference - Oauth Flows]] | 206 | legacy-app | Covers: auth URL construction, token exchange, refresh rotation, migration 058 |
| [[Integrations - Reference - Python Agent Injection]] | 217 | legacy-app | Covers: pre-session fanout inside the livekit-agent entrypoint, per-provider |
| [[Integrations - Reference - Telemetry]] | 283 | legacy-app | Covers: accounting_credentials.last_context_fetch_at write path, |
| [[Integrations - Reference - Webhooks]] | 187 | legacy-app | Covers: HMAC verification, Xero intent-verify, Jobber topic routing, per-phone |
| [[Integrations - Scope and change history]] | 31 | record | The former integrations-jobber-xero skill's scope statement, preamble and running 'last updated' change history. Read only when you need to know when or why something changed. |

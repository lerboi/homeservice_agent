---
type: system
system: Integrations Jobber Xero
status: record
description: "The former integrations-jobber-xero skill's scope statement, preamble and running 'last updated' change history. Read only when you need to know when or why something changed."
source: ".claude/skills/integrations-jobber-xero/SKILL.md § frontmatter description + preamble"
migrated: 2026-11-23
verified:
tags: [voco/system/integrations-jobber-xero]
---

# Scope and change history

Part of [[Integrations Jobber Xero]]. Migrated verbatim from the `integrations-jobber-xero` skill.

## Scope: what the former skill covered

Xero (REST, xero-node SDK) + Jobber (GraphQL, graphql-request) OAuth/refresh/refresh-locks, shared src/lib/integrations/ adapter contract, webhook HMAC + intent-verify + per-phone cacheTag invalidation, Python agent pre-session context fetch (livekit-agent/src/integrations/{xero,jobber}.py), check_customer_account tool, BusinessIntegrationsClient 4-state card + reconnect banner, setup checklist Reconnect flow, telemetry (last_context_fetch_at + activity_log integration_fetch events). Use this skill when you need to modify Xero or Jobber OAuth, debug webhook delivery, change caching or cacheTag invalidation, touch the Python agent's customer-context injection, update BusinessIntegrationsClient, debug setup-checklist Reconnect flow, or investigate integration latency.

## Preamble and change history

## Integrations (Jobber + Xero) — Complete Reference

This document is the single source of truth for the Jobber and Xero read-side
integrations — OAuth, caching, webhooks, Python agent injection, dashboard UI,
and telemetry. **Read this before making any changes to either provider.**

**Last updated**: 2026-06-12 (audit wave 1 — (1) **Refresh-lock loser GIVES UP on poll timeout (H7)**: `xero.py _refresh_locked` + `jobber.py _refresh_token_locked` now return None when the loser's 3s poll times out, mirroring `adapter.js` (which throws) — the old refresh-anyway fallback re-fired the wire refresh with a single-use token the winner had usually already consumed (the winner's token POST can take up to its 10s read timeout), got a 400, persisted `error_state='token_refresh_failed'`, and bricked the connection behind a false Reconnect banner that the keep-fresh cron then skipped. The 30s lease TTL releases a genuinely stuck slot on its own. (2) **`accounting_credentials` client-role privileges REVOKED (migration 069)**: plaintext OAuth tokens are no longer browser-readable via PostgREST; all reads were already service-role, so nothing broke. (3) **Telemetry actually persists now (migration 071)**: the `activity_event_type` enum gained `integration_fetch` + `integration_fetch_fanout` — every Phase 58 telemetry INSERT had been failing the enum cast silently since Phase 58 (verified live: 0 rows ever written).) Previous: 2026-06-10 (token-refresh reliability overhaul — see "Refresh reliability (2026-06-10)" section below: shielded cancellation-safe refresh in both Python adapters, fatal-only `error_state` flagging in both runtimes, new keep-fresh cron `/api/cron/refresh-integration-tokens` every 10 min, `refreshTokenIfNeeded` gained `options.bufferMs`, one-shot reconnect email guard. Calendar-page UI: `IntegrationReconnectBanner` + `JobberCopyBanner` DELETED — replaced by `CalendarConnectionsCard` business-apps rows.) Previous: 2026-06-04 (prod-readiness 2026-06 — documented the `accounting_credentials.expiry_date` BIGINT epoch-MILLISECONDS storage contract + the Python ISO-string write bug fix, and the Python agent's new participation in the migration-058 OAuth refresh lock via `livekit-agent/src/integrations/_refresh_lock.py`; corrected the `oauth_refresh_locks` table columns and `expiry_date`/migration-030 row in the DB-surface table.) + Phase 61 — Voco-normalized `address_components` JSONB shape (D-D1) added to `appointments` + `inquiries` via migration 062; `livekit-agent/src/integrations/google_maps.py::map_components` is the source of truth for the named-key mapper that Phase 62 Jobber write-side will read. + Phase 61.1 WR-03 — corrected tool-return shape claim (success uses label form `BOOKED [verdict=...]:`, only failure path uses STATE+DIRECTIVE)

---

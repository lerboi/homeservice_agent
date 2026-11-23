---
type: system
system: Integrations Jobber Xero
status: legacy-app
description: "For each subsystem, jump to the deep-dive reference file: Covers: OAuth + refresh + refresh locks → references/oauth-flows.md; Caching → references/caching.md; Webhook handlers → references/webhooks.md; Python agent injection → references/python-agent-injection.md; Dashboard UI → references/dashboar"
source: .claude/skills/integrations-jobber-xero/SKILL.md § Subsystems — Reading Guide
migrated: 2026-11-23
verified:
tags: [voco/system/integrations-jobber-xero]
---

# Subsystems - Reading Guide

Part of [[Integrations Jobber Xero]]. Migrated verbatim from the `integrations-jobber-xero` skill; check `verified` before trusting details.

For each subsystem, jump to the deep-dive reference file:

### OAuth + refresh + refresh locks → references/oauth-flows.md
Xero + Jobber auth URL generation, token exchange, refresh rotation, migration
058 refresh-lock pattern, `error_state` surfacing on refresh failure, reconnect
path that clears `error_state` on callback success.

### Caching → references/caching.md
Next.js 16 `'use cache'` + `cacheTag` layer for dashboard reads (module-level
fns only — class methods forbidden). Per-tenant + per-phone tags.
`src/lib/integrations/status.js` as the single cached-read entry point.

### Webhook handlers → references/webhooks.md
HMAC-SHA256 timing-safe compare on raw body. Xero intent-verify branch.
Jobber uses `JOBBER_CLIENT_SECRET` (no separate webhook-secret env var).
Topic routing (Jobber `CLIENT_*` / `JOB_*` / `VISIT_*` / `INVOICE_*`).
Per-phone `revalidateTag` with broad-tenant fallback.

### Python agent injection → references/python-agent-injection.md
Pre-session `fetch_xero_context_bounded` + `fetch_jobber_context_bounded`
inside `_run_db_queries`. `check_customer_account` tool with STATE+DIRECTIVE
prompt format. Merge order and null-safety in `fetch_merged_customer_context_bounded`.

### Dashboard UI → references/dashboard-ui.md
`BusinessIntegrationsClient` 4-state machine (disconnected, connecting,
connected, error-degraded). Reconnect banner. Setup checklist Phase 58
red-dot + "Reconnect needed" subtitle + "Reconnect" CTA swap.
`JobberBookableUsersSection` (Phase 57) and `<AsyncButton>` migration (Phase 58).

### Telemetry → references/telemetry.md
`last_context_fetch_at` write on success (Python `_touch_last_context_fetch_at`).
`activity_log` rows: `event_type='integration_fetch'` per-provider (Phase 58)
and `event_type='integration_fetch_fanout'` per-call (Phase 58). Owner-facing
Last-synced timestamp on the BusinessIntegrationsClient card. Column-name
reconciliation (Option A: `event_type` + `metadata`, NOT `action` + `meta`).
**Migration 071 (2026-06-12, pending application) adds both values to the
`activity_event_type` enum** — `activity_log.event_type` is a strict enum
(migration 061), so every Phase 58 telemetry INSERT failed the cast and was
silently swallowed by the helpers' try/except (verified live: 0 rows ever
written). The inserts persist only once 071 is applied; any p95 latency
queries before then return empty.

---

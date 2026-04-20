---
name: integrations-jobber-xero
description: "Xero (REST, xero-node SDK) + Jobber (GraphQL, graphql-request) OAuth/refresh/refresh-locks, shared src/lib/integrations/ adapter contract, webhook HMAC + intent-verify + per-phone cacheTag invalidation, Python agent pre-session context fetch (livekit-agent/src/integrations/{xero,jobber}.py), check_customer_account tool, BusinessIntegrationsClient 4-state card + reconnect banner, setup checklist Reconnect flow, telemetry (last_context_fetch_at + activity_log integration_fetch events). Use this skill when you need to modify Xero or Jobber OAuth, debug webhook delivery, change caching or cacheTag invalidation, touch the Python agent's customer-context injection, update BusinessIntegrationsClient, debug setup-checklist Reconnect flow, or investigate integration latency."
---

# Integrations (Jobber + Xero) — Complete Reference

This document is the single source of truth for the Jobber and Xero read-side
integrations — OAuth, caching, webhooks, Python agent injection, dashboard UI,
and telemetry. **Read this before making any changes to either provider.**

**Last updated**: 2026-04-20 (Phase 58 — telemetry + checklist red-dot + skill consolidation)

---

## Architecture Overview

Two providers, one adapter contract:

- **Xero** (REST, `xero-node` SDK) — Phase 55 read-side shipped.
- **Jobber** (GraphQL, `graphql-request`) — Phase 56 read-side shipped.
- **Jobber schedule mirror** (local `calendar_events` rows) — Phase 57.

Shared contract: `src/lib/integrations/` exposes per-provider adapter classes
that each implement the same interface:

| Method | Purpose |
|--------|---------|
| `getAuthUrl(state, redirectUri)` | Build the OAuth consent URL |
| `exchangeCode(code, redirectUri, extra)` | OAuth code → tokens → row insert |
| `refreshTokenIfNeeded(admin, cred)` | Rotate expiring tokens, honor lock |
| `fetchCustomerByPhone(tenantId, phoneE164)` | Dashboard-side cached read (Next.js 16 `'use cache'`) |
| `revoke(tokenSet)` | Tell provider to drop the grant |

The Python livekit-agent has its own mirror of the read path — see
`references/python-agent-injection.md`. The adapter contract is TypeScript-free
(JSX project), so consistency is enforced by convention + tests in
`tests/integrations/`.

### Database surface

`accounting_credentials` table (migration 052):

| Column | Purpose | Introduced |
|--------|---------|-----------|
| `id` | PK | 052 |
| `tenant_id` | FK tenants(id), RLS scope | 052 |
| `provider` | `'xero'` or `'jobber'` | 052 |
| `access_token`, `refresh_token`, `expires_at`, `scopes`, `tenant_name` | OAuth state | 052 |
| `error_state` | `null` when healthy; `'token_refresh_failed'` surfaces Reconnect banner | 053 |
| `external_account_id` | Provider-side account/org ID for webhook tenant resolution | 054 |
| `last_context_fetch_at` | Set by Python adapter on successful fetch (owner-facing Last-synced) | 055 |
| `jobber_bookable_user_ids` (Jobber only) | Employees whose schedule mirrors | 057 |
| `jobber_last_schedule_poll_at` (Jobber only) | Schedule poll cursor, distinct from `last_context_fetch_at` | 057 |

`oauth_refresh_locks` table (migration 058):

| Column | Purpose |
|--------|---------|
| `credential_id` | FK accounting_credentials(id), PK |
| `locked_at` | Timestamp; advisory lock TTL |

`calendar_events` (since migration 055 — provider='jobber'): schedule-mirror
rows populated by Phase 57's poll + webhook pipeline.

### Data flow (dashboard vs call path)

```
Dashboard (Next.js)
    getIntegrationStatus()                     src/lib/integrations/status.js
      |  'use cache' + cacheTag('integration-status-${tenantId}')
      v
    accounting_credentials row read            (service-role Supabase)
      |
      v
    BusinessIntegrationsClient                 4-state render

Call path (Python livekit-agent)
    entrypoint → _run_db_queries
      |  pre-session asyncio.gather(fetch_xero_context_bounded,
      |                             fetch_jobber_context_bounded, …)
      v
    Xero/Jobber HTTPS API                      src/integrations/{xero,jobber}.py
      |  on success:
      |    - _touch_last_context_fetch_at (blind UPDATE)
      |    - emit_integration_fetch (activity_log INSERT)
      v
    merged customer_context → prompt build

Webhook
    POST /api/webhooks/{xero,jobber}           HMAC verify (raw body)
      |  resolve provider accountId → tenant via external_account_id
      v
    revalidateTag('<provider>-context-${tenantId}-${E164}')
      (per phone on success; broad tenant tag on fallback)
```

---

## Subsystems — Reading Guide

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

---

## Related skills

- `voice-call-architecture` — the call path that wires `check_customer_account`
  and pre-session context injection into the agent entrypoint.
- `dashboard-crm-system` — owns `BusinessIntegrationsClient`, the setup
  checklist renderer, and the `/dashboard/more/integrations` route.
- `auth-database-multitenancy` — `accounting_credentials` RLS policies,
  service-role Supabase client pattern, migration counts.
- `scheduling-calendar-system` — Jobber schedule mirror (Phase 57) writes into
  the same `calendar_events` table that Google + Outlook sync populate.

---

## Gotchas

1. **Next.js 16 forbids `'use cache'` on class methods.** Use module-level
   cached functions. `xero.js` exports a top-level `fetchCustomerByPhone`
   function; the adapter class's `fetchCustomerByPhone` delegates to it.
2. **Cross-runtime casing divergence is intentional.** Next.js side is
   camelCase (`externalAccountId`), Python side is snake_case
   (`external_account_id`). Don't "normalize" — one side will break.
3. **`activity_log` column names are `event_type` + `metadata`**, NOT
   `action` + `meta` despite what CONTEXT D-06 (Phase 58) wording says.
   Phase 58 Plan 03 reconciled to real column names (Option A in research).
4. **Jobber webhook HMAC key = `JOBBER_CLIENT_SECRET`** (no separate
   `JOBBER_WEBHOOK_SECRET` env var). This is Pitfall 1 Option B from
   Phase 56 research and a common onboarding confusion.
5. **`jobber_last_schedule_poll_at` is separate from `last_context_fetch_at`.**
   Schedule poll cursor (Phase 57) vs customer-context touch (Phase 55/56).
   Don't conflate when debugging stale data.
6. **Raw body must be read ONCE for HMAC.** Calling `request.json()` and
   re-stringifying breaks the Xero + Jobber HMAC compare. Always
   `await request.text()` and `JSON.parse` manually.
7. **Silent-ignore on unknown tenant (HTTP 200).** Both webhooks return
   200 with an empty body when `external_account_id` lookup misses —
   prevents Jobber/Xero from retrying indefinitely against stale
   registrations.
8. **`_touch_last_context_fetch_at` is a blind UPDATE.** No read-modify-write,
   no race with Next.js side. Telemetry `INSERT` uses a fresh UUID PK —
   also race-free. Both are parallelized via `asyncio.gather` in the
   Python adapters (zero added latency on fetch return path).
9. **Xero `GET /Contacts` requires `summaryOnly=false` for phone data.**
   Default response omits `PhoneNumber`/`PhoneCountryCode`/`PhoneAreaCode`
   (returns PhoneType slots with null values). Any caller that matches
   contacts by phone — `xeroContactMatchesPhone`, the Python pre-session
   matcher, the webhook phone-cacheTag resolver — must pass the parameter.
   Affected call sites kept in sync: `livekit-agent/src/integrations/xero.py`
   `_get_contacts_by_phone`; `src/lib/integrations/xero.js`
   `fetchCustomerByPhone`; `src/app/api/webhooks/xero/route.js` invoice
   contact resolution. `findOrCreateCustomer` (email-search, ID-only read)
   does not need the flag.

---

## Reading order by task

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

## Phase history (incremental milestones)

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
refresh-token race between concurrent calls.

---
name: integrations-jobber-xero
description: "Xero (REST, xero-node SDK) + Jobber (GraphQL, graphql-request) OAuth/refresh/refresh-locks, shared src/lib/integrations/ adapter contract, webhook HMAC + intent-verify + per-phone cacheTag invalidation, Python agent pre-session context fetch (livekit-agent/src/integrations/{xero,jobber}.py), check_customer_account tool, BusinessIntegrationsClient 4-state card + reconnect banner, setup checklist Reconnect flow, telemetry (last_context_fetch_at + activity_log integration_fetch events). Use this skill when you need to modify Xero or Jobber OAuth, debug webhook delivery, change caching or cacheTag invalidation, touch the Python agent's customer-context injection, update BusinessIntegrationsClient, debug setup-checklist Reconnect flow, or investigate integration latency."
---

# Integrations (Jobber + Xero) — Complete Reference

This document is the single source of truth for the Jobber and Xero read-side
integrations — OAuth, caching, webhooks, Python agent injection, dashboard UI,
and telemetry. **Read this before making any changes to either provider.**

**Last updated**: 2026-06-12 (audit wave 1 — (1) **Refresh-lock loser GIVES UP on poll timeout (H7)**: `xero.py _refresh_locked` + `jobber.py _refresh_token_locked` now return None when the loser's 3s poll times out, mirroring `adapter.js` (which throws) — the old refresh-anyway fallback re-fired the wire refresh with a single-use token the winner had usually already consumed (the winner's token POST can take up to its 10s read timeout), got a 400, persisted `error_state='token_refresh_failed'`, and bricked the connection behind a false Reconnect banner that the keep-fresh cron then skipped. The 30s lease TTL releases a genuinely stuck slot on its own. (2) **`accounting_credentials` client-role privileges REVOKED (migration 069)**: plaintext OAuth tokens are no longer browser-readable via PostgREST; all reads were already service-role, so nothing broke. (3) **Telemetry actually persists now (migration 071)**: the `activity_event_type` enum gained `integration_fetch` + `integration_fetch_fanout` — every Phase 58 telemetry INSERT had been failing the enum cast silently since Phase 58 (verified live: 0 rows ever written).) Previous: 2026-06-10 (token-refresh reliability overhaul — see "Refresh reliability (2026-06-10)" section below: shielded cancellation-safe refresh in both Python adapters, fatal-only `error_state` flagging in both runtimes, new keep-fresh cron `/api/cron/refresh-integration-tokens` every 10 min, `refreshTokenIfNeeded` gained `options.bufferMs`, one-shot reconnect email guard. Calendar-page UI: `IntegrationReconnectBanner` + `JobberCopyBanner` DELETED — replaced by `CalendarConnectionsCard` business-apps rows.) Previous: 2026-06-04 (prod-readiness 2026-06 — documented the `accounting_credentials.expiry_date` BIGINT epoch-MILLISECONDS storage contract + the Python ISO-string write bug fix, and the Python agent's new participation in the migration-058 OAuth refresh lock via `livekit-agent/src/integrations/_refresh_lock.py`; corrected the `oauth_refresh_locks` table columns and `expiry_date`/migration-030 row in the DB-surface table.) + Phase 61 — Voco-normalized `address_components` JSONB shape (D-D1) added to `appointments` + `inquiries` via migration 062; `livekit-agent/src/integrations/google_maps.py::map_components` is the source of truth for the named-key mapper that Phase 62 Jobber write-side will read. + Phase 61.1 WR-03 — corrected tool-return shape claim (success uses label form `BOOKED [verdict=...]:`, only failure path uses STATE+DIRECTIVE)

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

`accounting_credentials` table (migration 052). **Migration 069 (2026-06-12,
pending application) REVOKEs ALL client-role (anon/authenticated) table
privileges** — the plaintext `access_token`/`refresh_token` were
owner-browser-readable via PostgREST under the tenant-own RLS policies. All
reads in both runtimes were already service-role, so nothing breaks; the
tenant-own policies remain but are unreachable for client roles.

| Column | Purpose | Introduced |
|--------|---------|-----------|
| `id` | PK | 052 |
| `tenant_id` | FK tenants(id), RLS scope | 052 |
| `provider` | `'xero'` or `'jobber'` | 052 |
| `access_token`, `refresh_token`, `scopes`, `tenant_name` | OAuth state | 052 |
| `expiry_date` | **BIGINT epoch-MILLISECONDS** (`Date.now() + expires_in*1000`) — see "Token-expiry storage contract" below | 030 |
| `error_state` | `null` when healthy; `'token_refresh_failed'` surfaces Reconnect banner | 053 |
| `external_account_id` | Provider-side account/org ID for webhook tenant resolution | 054 |
| `last_context_fetch_at` | Set by Python adapter on successful fetch (owner-facing Last-synced) | 055 |
| `jobber_bookable_user_ids` (Jobber only) | Employees whose schedule mirrors | 057 |
| `jobber_last_schedule_poll_at` (Jobber only) | Schedule poll cursor, distinct from `last_context_fetch_at` | 057 |

`oauth_refresh_locks` table (migration 058):

| Column | Purpose |
|--------|---------|
| `tenant_id` + `provider` | Lock identity (one in-flight refresh per pair) |
| `holder_id` | UUID returned to the winning caller; required to release |
| `expires_at` | Lease TTL (30s default) — stale leases are reclaimable |

Acquired via `try_acquire_oauth_refresh_lock(p_tenant_id, p_provider, p_ttl_ms DEFAULT 30000)` → holder UUID (won) or NULL (contested); released via `release_oauth_refresh_lock(p_tenant_id, p_provider, p_holder_id)` (no-op unless `holder_id` matches). **Both runtimes now participate** — see "OAuth refresh-lock — cross-runtime participation" below.

`calendar_events` (since migration 055 — provider='jobber'): schedule-mirror
rows populated by Phase 57's poll + webhook pipeline.

### Token-expiry storage contract (prod-readiness 2026-06)

`accounting_credentials.expiry_date` is a **BIGINT holding epoch-MILLISECONDS**
(`Date.now() + expires_in*1000`; migration 030). This is a hard cross-runtime
contract — **every writer must store an integer of epoch-ms**:

- **Next.js adapters** (`src/lib/integrations/*.js`): `adapter.js` and
  `jobber.js` write `expiry_date` ms directly; `xero.js` converts the Xero
  SDK's epoch-**seconds** `expires_at` via `expires_at * 1000`.
- **Python agent** (`livekit-agent/src/integrations/{xero,jobber}.py`): both
  refresh paths persist `int(epoch_ms)` — Xero computes
  `int((now + expires_in).timestamp() * 1000)`; Jobber decodes the access-token
  JWT `exp` claim and stores `exp * 1000` (`_decode_jwt_exp_ms`).

**Readers tolerate legacy ISO rows.** `_expiry_to_epoch(value)` (defined
identically in both Python adapters) returns **epoch SECONDS**: a numeric/
numeric-string value is divided by 1000 (ms→s); an ISO-8601 string is parsed
with `datetime.fromisoformat(...).timestamp()` (already seconds, no division);
`None`/unparseable → `0.0` which forces a refresh.

> **Prior bug (fixed 2026-06-04).** The Python side previously wrote an **ISO
> string** into the BIGINT column. Postgres rejected the text→bigint cast, the
> error was swallowed in the fail-soft wrapper, and so **agent-side token
> refreshes never persisted** — every call re-refreshed from a stale row. The
> fix makes both Python adapters write `int(epoch_ms)`, matching the Next.js
> writers. Do not "normalize" the column to a timestamptz — the BIGINT-ms shape
> is the contract.

### Refresh reliability (2026-06-10) — why "tokens expired" kept recurring, and the fix

**Root cause found and fixed.** The LiveKit agent's pre-session context fetch
runs under `asyncio.wait_for(0.8s)` (`customer_context.py`) and previously
performed OAuth refreshes inline on that budget with the sub-second data
httpx client (Jobber read=0.7s). Two failure modes resulted:

1. **Lost rotation → bricked connection.** Jobber refresh tokens are
   single-use; Xero rotates with only a ~30-min grace. If the token POST was
   read-timed-out or the outer 0.8s deadline CANCELLED the coroutine
   mid-POST, the provider had already consumed the old refresh token but the
   rotated replacement was never read/persisted → every later refresh 401s →
   owner must reconnect. This is the "connect once but it keeps dying" bug.
2. **False banners.** Both runtimes flagged
   `error_state='token_refresh_failed'` on ANY failure — including timeouts,
   network errors, and 5xx — so transient hiccups raised "Reconnect
   Jobber/Xero" banners + emails even when the stored token was fine.

**Fixes (all shipped 2026-06-10):**

- **Python adapters** (`livekit-agent/src/integrations/{jobber,xero}.py`):
  - The wire refresh + persist now runs as an `asyncio.ensure_future` task
    awaited through `asyncio.shield(...)`, with strong refs kept in a
    module-level `_REFRESH_TASKS` set. Outer cancellation lets the fetch
    give up while the rotation completes + persists in the background.
  - The refresh POST uses a DEDICATED client with `REFRESH_HTTP_TIMEOUT`
    (connect=3s, read=10s) — never the sub-second data-fetch client.
  - `_persist_refresh_failure` fires ONLY on token-endpoint HTTP 400/401
    (dead grant). Timeouts/5xx/network errors log and leave `error_state`
    untouched. Missing env vars no longer flag (config issue, reconnect
    can't fix it).
  - Jobber: `_refresh_token(cred)` (shield wrapper) → `_refresh_token_locked`
    (lock + poll) → `_do_wire_refresh(cred)`. Xero: `_refresh_if_needed(cred)`
    (buffer check + shield) → `_refresh_locked` → `_do_wire_refresh(cred)`.
    None of them take an httpx client param anymore.
- **Next.js adapter** (`src/lib/integrations/adapter.js`):
  - `refreshTokenIfNeeded(supabase, credentials, options?)` — new
    `options.bufferMs` (default 5 min) so the keep-fresh cron can force a
    wider lookahead.
  - Fatal-vs-transient classification: only `status 400/401`,
    `err.error === 'invalid_grant'`, or an invalid-grant-shaped message sets
    `error_state` + notifies. Transient errors rethrow un-flagged.
    `jobber.js refreshToken` attaches `err.status` for this.
  - One-shot email: the notify path is skipped when
    `credentials.error_state === 'token_refresh_failed'` already (webhook
    bursts / cron retries no longer re-email the owner every cycle).
- **Keep-fresh cron** — `GET /api/cron/refresh-integration-tokens`
  (vercel.json, `*/10 * * * *`): sweeps `accounting_credentials` where
  `error_state IS NULL AND expiry_date < now + 15min` and calls
  `refreshTokenIfNeeded(admin, cred, { bufferMs: 15min })`. Guarantees a
  healthy row always has ≥ ~10 min validity when a call arrives, so the
  agent's in-call refresh is a rarely-hit fallback (and now a safe one).
  Rows already flagged are skipped — only a reconnect heals them.

**UI surface change:** `IntegrationReconnectBanner.jsx` and
`JobberCopyBanner.jsx` were DELETED. The calendar page's
`CalendarConnectionsCard` (`src/components/dashboard/CalendarConnectionsCard.jsx`)
now renders Jobber/Xero rows from `/api/integrations/status` (SWR, 60s poll)
with an inline amber "Reconnect" affordance + "Action needed" header pill,
and a quiet "Push to Jobber is coming soon" hint replacing the dismissible
banner. `BusinessIntegrationsClient` on /dashboard/more/integrations is
unchanged and remains the actual reconnect destination.

### OAuth refresh-lock — cross-runtime participation (prod-readiness 2026-06)

Previously **only the Next.js adapter** honored the migration-058 refresh lock;
the Python agent refreshed unconditionally, racing the dashboard. The agent now
participates via a new module
`livekit-agent/src/integrations/_refresh_lock.py`, a port of the lease guard in
`src/lib/integrations/adapter.js`. Timing constants mirror the JS adapter
exactly: `REFRESH_LOCK_TTL_MS=30_000`, `WAIT_MS=3_000`, `POLL_MS=200`;
refresh-buffer `REFRESH_BUFFER_SECONDS=300` (refresh when the token expires in
< 5 min).

Flow inside each adapter's `_refresh_if_needed`:

1. `_expiry_to_epoch(expiry_date) - now > 300s` → token still valid, return as-is.
2. `acquire_refresh_lock(tenant_id, provider)` →
   `try_acquire_oauth_refresh_lock(...)` RPC returns a **holder UUID** (winner)
   or `None` (contested / RPC error).
3. **Winner**: refreshes via the provider HTTP endpoint, persists the fresh
   row (epoch-ms), then `release_refresh_lock(...)` in a `finally`.
4. **Loser**: `poll_for_fresh_credential(cred_id, ...)` re-reads
   `accounting_credentials` every 200ms for up to 3s, returning the winner's
   freshly-persisted row once `expiry_date` is comfortably in the future
   (`> now + 300s`).
5. **Loser gives up on poll timeout (2026-06-12 audit H7)**: when the 3s poll
   times out (or a lock RPC error leaves the loser without the lock), the
   loser returns **None** — the fetch proceeds without context, exactly
   mirroring `adapter.js` (which throws here). The previous "fail-soft"
   fallback re-fired the wire refresh with the possibly-consumed single-use
   token: the winner's token POST can take up to its 10s read timeout, so the
   loser's retry usually hit a 400 → persisted
   `error_state='token_refresh_failed'` → false Reconnect banner that the
   keep-fresh cron then skipped — a transient slow refresh became a
   permanently bricked Jobber connection until the owner re-authed. The 30s
   lease TTL still releases a genuinely stuck slot on its own; the next caller
   refreshes cleanly. Nothing here ever raises into the live-call hot path.

This closes the agent-vs-dashboard refresh race. It is **critical for Jobber**,
whose refresh-token rotation is **single-use**: a second concurrent refresh
either 401s or orphans the first caller's rotated token.

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
**Migration 071 (2026-06-12, pending application) adds both values to the
`activity_event_type` enum** — `activity_log.event_type` is a strict enum
(migration 061), so every Phase 58 telemetry INSERT failed the cast and was
silently swallowed by the helpers' try/except (verified live: 0 rows ever
written). The inserts persist only once 071 is applied; any p95 latency
queries before then return empty.

---

## Phase 61 cross-link — Voco-normalized address shape

Phase 61 added a Voco-normalized `address_components` JSONB column to
`appointments` and `inquiries` (D-D1 named-key shape):

```
{
  "street_number": str | null,
  "route": str | null,
  "subpremise": str | null,
  "locality": str | null,
  "admin_area_level_1": str | null,
  "admin_area_level_2": str | null,
  "postal_code": str | null,
  "country": str | null,
  "country_code": str | null   // ISO short code from Google's postalAddress.regionCode
}
```

The Voco-normalized shape is **what Phase 62 Jobber write-side will read**
when pushing a booked appointment into Jobber's `Client.properties`.
Named-key access — zero translation. Mapper in
`livekit-agent/src/integrations/google_maps.py::map_components` is the
source of truth; the mapper absorbs Google API surface changes (raw
response is NOT stored). The companion `address_validation_verdict`
column gates which Jobber-push paths are safe — only `confirmed` and
`confirmed_with_changes` rows carry a Google-validated `formatted_address`
suitable for downstream provider writes.

Tool-return shapes after Phase 61 fall into two patterns: the success path
uses a label form (`BOOKED [verdict=validated]: <directive>`,
`LEAD CAPTURED [verdict=validated_with_corrections]: <directive>`, etc.)
and the failure path uses the STATE+DIRECTIVE form
(`STATE:<reason> | DIRECTIVE:<action>`). Both carry the verdict token
verbatim; the prompt's `_build_address_validation_section` substring-matches
on `verdict=validated` / `verdict=validated_with_corrections` /
`verdict=unvalidated` and is shape-agnostic. Source of truth:
`livekit-agent/src/tools/book_appointment.py` and
`livekit-agent/src/tools/capture_lead.py`. The Phase 61
`_build_address_validation_section(locale)` block in `prompt.py` enforces
that the agent never speaks "validated"/"verified"/etc. unless the
preceding tool return contained the validating verdict — see
`voice-call-architecture` for the EN+ES CRITICAL RULE structure.

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
10. **`accounting_credentials.expiry_date` is BIGINT epoch-MILLISECONDS, not a
   timestamp.** Every writer (both runtimes) must store `int(epoch_ms)`. Writing
   an ISO string is silently rejected by the text→bigint cast and swallowed by
   the fail-soft wrapper — the Python side had exactly this bug (refreshes never
   persisted) until 2026-06-04. Readers (`_expiry_to_epoch`) return epoch
   SECONDS and tolerate legacy ISO rows. See "Token-expiry storage contract".
11. **The Python agent now holds the OAuth refresh lock too.** Don't assume the
   agent refreshes unconditionally — it acquires `try_acquire_oauth_refresh_lock`
   and a loser polls for the winner's row; **on poll timeout the loser returns
   None (2026-06-12) — never re-fire the wire refresh as a "fallback"**, the
   winner has usually already consumed the single-use token and the retry's 400
   bricks the connection behind a false Reconnect banner. Critical for Jobber's
   single-use refresh-token rotation. See "OAuth refresh-lock — cross-runtime
   participation".
12. **Phase 58 telemetry rows only persist once migration 071 is applied.**
   The `activity_event_type` enum lacked `integration_fetch`/
   `integration_fetch_fanout` until 071 — inserts before that failed the cast
   silently (the emit helpers never raise). Zero rows is a migration gap, not
   an agent bug.

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
refresh-token race between concurrent calls. **Prod-readiness 2026-06** extended
participation to the Python agent (`_refresh_lock.py`) and fixed the Python-side
`expiry_date` write (ISO string → `int(epoch_ms)`) — see "Token-expiry storage
contract" and "OAuth refresh-lock — cross-runtime participation" above.

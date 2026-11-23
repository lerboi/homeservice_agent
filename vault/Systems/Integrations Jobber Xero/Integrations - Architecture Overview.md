---
type: system
system: Integrations Jobber Xero
status: legacy-app
description: "End-to-end flow and main components of Integrations Jobber Xero. Covers: Database surface; Token-expiry storage contract (prod-readiness 2026-06); Refresh reliability (2026-06-10) — why 'tokens expired' kept recurring, and the fix; OAuth refresh-lock — cross-runtime participation (prod-readiness 202"
source: .claude/skills/integrations-jobber-xero/SKILL.md § Architecture Overview
migrated: 2026-11-23
verified:
tags: [voco/system/integrations-jobber-xero]
---

# Architecture Overview

Part of [[Integrations Jobber Xero]]. Migrated verbatim from the `integrations-jobber-xero` skill; check `verified` before trusting details.

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

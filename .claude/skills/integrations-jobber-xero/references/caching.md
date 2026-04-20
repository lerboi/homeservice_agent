# Caching — Next.js 16 'use cache' + cacheTag

Covers: `'use cache'` directive, per-tenant + per-phone cacheTag, webhook-driven
`revalidateTag`, why `fetchCustomerByPhone` is a module-level fn.

## File map

| Concern | File |
|---------|------|
| Dashboard-facing integration status | `src/lib/integrations/status.js` |
| Xero customer fetch (module-level, cached) | `src/lib/integrations/xero.js` (top-level `fetchCustomerByPhone`) |
| Jobber customer fetch (module-level, cached) | `src/lib/integrations/jobber.js` (top-level `fetchCustomerByPhone`) |
| Adapter dispatcher | `src/lib/integrations/adapter.js` |
| Webhook invalidation (Xero) | `src/app/api/webhooks/xero/route.js` |
| Webhook invalidation (Jobber) | `src/app/api/webhooks/jobber/route.js` |

## Next.js 16 'use cache' directive

Next.js 16 introduced `'use cache'` as an opt-in cache directive. It must be
the FIRST statement inside the function body, and only works on:

- Server Components
- Module-level async functions (NOT class methods or instance methods)
- Route handlers (limited)

## Cached entry points

### getIntegrationStatus — `src/lib/integrations/status.js`

```js
import { cacheTag } from 'next/cache';

export async function getIntegrationStatus(tenantId) {
  'use cache';
  cacheTag(`integration-status-${tenantId}`);

  const admin = getServiceRoleClient();
  const { data: rows } = await admin
    .from('accounting_credentials')
    .select('id, provider, tenant_name, external_account_id, error_state, last_context_fetch_at, jobber_bookable_user_ids')
    .eq('tenant_id', tenantId);

  // Shape into { xero: {...} | null, jobber: {...} | null, calendar: ... }
  return shape(rows);
}
```

- **Tag:** `integration-status-${tenantId}` — one tag per tenant.
- **Invalidation:** connect callback, disconnect, reconnect, and any write
  that touches `accounting_credentials` must call
  `revalidateTag('integration-status-${tenantId}')`.

### fetchCustomerByPhone — per-provider, per-phone

```js
// src/lib/integrations/xero.js — module-level fn (NOT class method).
export async function fetchCustomerByPhone(tenantId, phoneE164) {
  'use cache';
  cacheTag(`xero-context-${tenantId}`);
  cacheTag(`xero-context-${tenantId}-${phoneE164}`);

  const admin = getServiceRoleClient();
  const { data: cred } = await admin
    .from('accounting_credentials')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('provider', 'xero')
    .maybeSingle();

  if (!cred || cred.error_state) return null;

  const refreshed = await refreshTokenIfNeeded(admin, cred);
  // ... HTTP to Xero, shape response, return
}

// The class method just delegates:
export class XeroAdapter {
  async fetchCustomerByPhone(tenantId, phoneE164) {
    return fetchCustomerByPhone(tenantId, phoneE164);
  }
}
```

- **Two tags per call:** broad (`xero-context-${tenantId}`) + narrow
  (`xero-context-${tenantId}-${phoneE164}`).
- **Why both:** broad lets connect/disconnect/error-state transitions blow
  the whole tenant cache; narrow lets webhooks invalidate only the affected
  phone number.

## Module-level vs class-method constraint

Next.js 16 rejects `'use cache'` on class methods:

```js
// ❌ This does NOT cache.
export class XeroAdapter {
  async fetchCustomerByPhone(tenantId, phoneE164) {
    'use cache';
    cacheTag(`xero-context-${tenantId}`);
    // ...
  }
}
```

Reason: `'use cache'` needs a stable function identity at module scope
(for the framework to hoist + key the cache). Class methods get bound at
instance construction, so the identity isn't stable across requests.

**Workaround:** Keep the class for ergonomics (dispatch, strategy pattern,
adapter interface), but implement the cached read as a module-level fn
and delegate from the method.

## revalidateTag call sites

Every write to `accounting_credentials` or every provider-side data change
must trigger `revalidateTag` for consistency:

| Trigger | Tag pattern | Where |
|---------|------------|-------|
| Callback (connect/reconnect) | `integration-status-${tenantId}`, `xero-context-${tenantId}`, `jobber-context-${tenantId}` | `/api/integrations/{xero,jobber}/callback` |
| Disconnect | Same three tags | `/api/integrations/{xero,jobber}/disconnect` |
| Xero webhook — per-phone | `xero-context-${tenantId}-${phoneE164}` | `/api/webhooks/xero` |
| Xero webhook — broad fallback | `xero-context-${tenantId}` | same |
| Jobber webhook — per-phone | `jobber-context-${tenantId}-${phoneE164}` | `/api/webhooks/jobber` |
| Jobber webhook — broad fallback | `jobber-context-${tenantId}` | same |
| Jobber schedule mirror writes (Phase 57) | `calendar-events-${tenantId}` | `src/lib/scheduling/jobber-schedule-mirror.js` |

## Python agent is NOT cached

The livekit-agent adapters (`livekit-agent/src/integrations/{xero,jobber}.py`)
do NOT go through Next.js's cache layer — they hit Xero/Jobber APIs directly
with a 2.5s budget (Phase 55 D-04). The reason:

1. Different process (Python on Railway, separate from Next.js on Vercel).
2. Call path has a latency budget (pre-session fanout — see
   `python-agent-injection.md`).
3. The dashboard 'use cache' layer would be irrelevant in the agent's
   process space.

A future optimization could add an in-memory LRU per-process (short TTL)
if the Python fetches become a hotspot — the `_cache_hit=False` field in
`metadata` on the `integration_fetch` telemetry row is placeholder-ready
for that. Not currently implemented.

## Debugging cache staleness

Symptoms vs likely cause:

| Symptom | Likely cause |
|---------|--------------|
| BusinessIntegrationsClient shows old `last_context_fetch_at` | `integration-status-${tenantId}` not invalidated — check whatever recently wrote `accounting_credentials` didn't call `revalidateTag` |
| Call path shows stale Xero/Jobber customer | Webhook not firing (check HMAC env vars) OR per-phone tag mismatch (E.164 format drift) |
| Dashboard stuck in "disconnected" after callback | Callback didn't call `revalidateTag('integration-status-${tenantId}')` |

Grep anchors to check when adding a new write path:
```bash
grep -rn "revalidateTag.*integration-status" src/
grep -rn "cacheTag.*-context-" src/lib/integrations/
```

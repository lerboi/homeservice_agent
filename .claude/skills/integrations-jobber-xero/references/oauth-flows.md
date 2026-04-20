# OAuth Flows — Xero + Jobber

Covers: auth URL construction, token exchange, refresh rotation, migration 058
refresh locks, `error_state` surfacing, reconnect + revoke paths.

## File map

| Concern | File |
|---------|------|
| Xero adapter | `src/lib/integrations/xero.js` |
| Jobber adapter | `src/lib/integrations/jobber.js` |
| Shared adapter dispatcher + `refreshTokenIfNeeded` | `src/lib/integrations/adapter.js` |
| Xero callback | `src/app/api/integrations/xero/callback/route.js` |
| Jobber callback | `src/app/api/integrations/jobber/callback/route.js` |
| Xero connect entry | `src/app/api/integrations/xero/connect/route.js` |
| Jobber connect entry | `src/app/api/integrations/jobber/connect/route.js` |
| Xero disconnect | `src/app/api/integrations/xero/disconnect/route.js` |
| Jobber disconnect | `src/app/api/integrations/jobber/disconnect/route.js` |
| Schema | `supabase/migrations/052_integrations_schema.sql`, `053_xero_error_state.sql`, `054_external_account_id.sql`, `058_oauth_refresh_locks.sql` |

## Xero OAuth

**Scopes** (see `xero.js` `_SCOPES`):
- `offline_access` (required for refresh tokens)
- `openid`, `profile`, `email` (identity)
- `accounting.contacts.read`
- `accounting.transactions.read`

**Auth URL** — `XeroAdapter.getAuthUrl(state, redirectUri)`:
1. Build the consent URL with `response_type=code`, `client_id=XERO_CLIENT_ID`,
   `redirect_uri`, `scope` (joined), `state` (CSRF token).
2. Caller stores `state` in an HTTP-only cookie for callback compare.

**Exchange** — `XeroAdapter.exchangeCode(code, redirectUri, extraParams)`:
1. POST to `https://identity.xero.com/connect/token` with
   `grant_type=authorization_code`, `code`, `redirect_uri`, Basic auth
   (client_id:client_secret).
2. Response: `{ access_token, refresh_token, expires_in, id_token }`.
3. Decode `id_token` → `sub` (Xero user id).
4. Fetch connected tenant via `/connections` endpoint, pick first tenant
   (single-tenant assumption per Phase 55 D-03).
5. Insert into `accounting_credentials`:
   ```sql
   INSERT INTO accounting_credentials
     (tenant_id, provider, access_token, refresh_token, expires_at,
      scopes, tenant_name, external_account_id, error_state)
   VALUES (?, 'xero', ?, ?, NOW() + (expires_in)*interval '1 sec',
      ?, ?, <xero_tenant_id>, NULL);
   ```

## Jobber OAuth

**Scopes** — Jobber uses a smaller grant:
- `read_clients`, `read_jobs`, `read_invoices`, `read_users`, `read_schedule`
  (Phase 57), `read_custom_fields` (future).
- Jobber does NOT have an explicit offline-access scope — refresh tokens are
  always issued.

**Auth URL** — `JobberAdapter.getAuthUrl`:
Standard OAuth 2.0 — `client_id=JOBBER_CLIENT_ID`, `redirect_uri`, `state`.
No PKCE (Jobber does not require it for confidential clients).

**Exchange** — `JobberAdapter.exchangeCode`:
1. POST to `https://api.getjobber.com/api/oauth/token` with
   `grant_type=authorization_code`, `code`, `client_secret` (confidential client).
2. Response: `{ access_token, refresh_token, expires_in, scope }`.
3. Fetch Jobber account identity via a minimal GraphQL query
   (`{ account { id name } }`) → `external_account_id`.
4. Insert row into `accounting_credentials` with `provider='jobber'`.

## Refresh rotation — shared path

`src/lib/integrations/adapter.js :: refreshTokenIfNeeded(admin, cred)`:

```js
// Pseudocode — see adapter.js for actual implementation.
export async function refreshTokenIfNeeded(admin, cred) {
  const now = Date.now();
  const expiresAt = new Date(cred.expires_at).getTime();
  const skew = 60_000; // refresh 60s before real expiry
  if (expiresAt - skew > now) return cred; // not yet

  // Acquire refresh lock (migration 058)
  const { data: lock } = await admin
    .from('oauth_refresh_locks')
    .upsert({ credential_id: cred.id, locked_at: new Date().toISOString() },
            { onConflict: 'credential_id', ignoreDuplicates: true })
    .select()
    .maybeSingle();

  if (!lock) {
    // Another process is refreshing — re-fetch the row, hope it's fresh.
    const { data: fresh } = await admin
      .from('accounting_credentials')
      .select('*')
      .eq('id', cred.id)
      .single();
    return fresh;
  }

  try {
    const tokenResponse = await providerRefresh(cred); // HTTP to provider
    await admin.from('accounting_credentials').update({
      access_token: tokenResponse.access_token,
      refresh_token: tokenResponse.refresh_token ?? cred.refresh_token,
      expires_at: new Date(now + tokenResponse.expires_in * 1000).toISOString(),
      error_state: null, // CLEAR on successful refresh
    }).eq('id', cred.id);
    return { ...cred, ...tokenResponse };
  } catch (err) {
    // Mark error_state — BusinessIntegrationsClient + setup checklist pick this up
    await admin.from('accounting_credentials').update({
      error_state: 'token_refresh_failed',
    }).eq('id', cred.id);
    throw err;
  } finally {
    await admin.from('oauth_refresh_locks').delete().eq('credential_id', cred.id);
  }
}
```

### Lock TTL

The `oauth_refresh_locks` row has no TTL enforced at DB level — the
`finally` block guarantees delete. If the process crashes mid-refresh,
the next call clears it via its own upsert (old `locked_at` is overwritten).
This is acceptable because the only penalty of a stale lock is that
concurrent refreshers fall through to the "re-fetch fresh row" branch,
which is safe.

### Concurrent refresh race — covered

Tested in `tests/integrations/refresh-lock.test.js`. Two concurrent
callers: one acquires the lock + writes new tokens, the other hits the
`!lock` branch and re-reads the row. Both end with fresh tokens; no
double-refresh (which Xero/Jobber would reject since refresh tokens
rotate).

## error_state surface

`error_state` values (`accounting_credentials.error_state`):

| Value | Set when | Cleared when |
|-------|----------|--------------|
| `null` | Healthy | — |
| `'token_refresh_failed'` | `refreshTokenIfNeeded` catches non-recoverable error from provider (typically: refresh token revoked, user removed access in Xero/Jobber admin, scope revoked) | Next successful `exchangeCode` (Reconnect clicked) |

### Downstream consumers

- **Setup checklist** (Phase 58 Plan 02):
  `src/app/api/setup-checklist/route.js` issues two queries per provider —
  `.is('error_state', null)` (healthy count) and `.not('error_state', 'is', null)`
  (error count). Healthy > 0 → item complete; Error > 0 → `has_error=true`
  + `error_subtitle='Reconnect needed'` on the item.
- **BusinessIntegrationsClient** (Phase 55/56): reads `status.error_state` from
  `getIntegrationStatus` → renders "error-degraded" card state with the
  Reconnect banner Alert above the provider cards.
- **Python agent**: no special branch — just gets `cred=None` (if refresh
  catches), `customer_context` is empty, prompt continues without Xero/Jobber
  context.

## Reconnect flow

When user clicks "Reconnect" on BusinessIntegrationsClient:

1. Redirects to `/api/integrations/{xero,jobber}/connect` (the normal Connect
   entry).
2. OAuth flow runs.
3. Callback route's `exchangeCode` UPSERTs the `accounting_credentials` row
   with fresh tokens AND `error_state = null`.
4. Callback redirects to `/dashboard/more/integrations?reconnected=1` (or similar).
5. Server Component re-reads → `error_state = null` → card flips back to
   connected state + Reconnect banner disappears.

No user-facing diff between "first Connect" and "Reconnect" — the callback
writes to the same row (UPSERT by tenant_id + provider).

## Revoke path

`XeroAdapter.revoke(tokenSet)`:
1. POST to `https://identity.xero.com/connect/revocation` with refresh token.
2. Failure is non-fatal — the DB row is still deleted.

`JobberAdapter.revoke(tokenSet)`:
Jobber does not publish a documented revoke endpoint. The adapter is a
no-op; the DB row delete is the only remediation.

**Disconnect route** (`/api/integrations/{xero,jobber}/disconnect`):
1. Load `accounting_credentials` row.
2. Call `adapter.revoke(...)` (best-effort).
3. DELETE row.
4. `revalidateTag('integration-status-${tenantId}')` so the dashboard card
   flips back to disconnected.
5. Response 200.

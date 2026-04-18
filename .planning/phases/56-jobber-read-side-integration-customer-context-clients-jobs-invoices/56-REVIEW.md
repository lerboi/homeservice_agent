---
phase: 56-jobber-read-side-integration-customer-context-clients-jobs-invoices
reviewed: 2026-04-19T00:00:00Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - .env.example
  - src/app/api/integrations/[provider]/callback/route.js
  - src/app/api/setup-checklist/route.js
  - src/app/api/webhooks/jobber/route.js
  - src/components/dashboard/BusinessIntegrationsClient.jsx
  - src/emails/JobberReconnectEmail.jsx
  - src/lib/integrations/jobber.js
  - src/lib/notifications.js
  - supabase/migrations/054_external_account_id.sql
  - tests/api/integrations/disconnect-jobber.test.js
  - tests/api/integrations/jobber-callback.test.js
  - tests/api/setup-checklist-jobber.test.js
  - tests/api/webhooks/jobber/route.test.js
  - tests/app/dashboard/integrations-page.test.js
  - tests/components/BusinessIntegrationsClient.static.test.js
  - tests/components/BusinessIntegrationsClient.test.js
  - tests/integrations/jobber.adapter.test.js
  - tests/integrations/jobber.cache.test.js
  - tests/integrations/jobber.fetch.test.js
  - tests/integrations/jobber.phone-match.test.js
  - tests/integrations/jobber.refresh.test.js
  - tests/notifications/jobber-refresh-email.test.js
findings:
  critical: 0
  warning: 3
  info: 5
  total: 8
status: issues_found
---

# Phase 56: Code Review Report

**Reviewed:** 2026-04-19
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

Phase 56 implements the Jobber read-side integration mirroring the P55 Xero pattern: OAuth callback with post-exchange account-id probe, GraphQL-based customer fetcher with `'use cache'` tagging, HMAC webhook verification, dashboard UI, and token-refresh failure email. The focused concerns (HMAC correctness, `'use cache'` placement, secret logging, RLS boundary, migration 054 safety, refresh-token rotation) are largely handled well. Notable positives:

- HMAC verification (`src/app/api/webhooks/jobber/route.js:63-77`) reads raw body before JSON.parse, length-checks buffers before `timingSafeEqual`, and keys off `JOBBER_CLIENT_SECRET` per Jobber's docs.
- `fetchJobberCustomerByPhone` is a module-level `'use cache'` function with proper `cacheTag` usage (not a class method) — correct for Next.js 16.
- `JobberAdapter.refreshToken` enforces rotation by throwing when the response omits `refresh_token` (`jobber.js:288`).
- Migration 054 is idempotent (`ADD COLUMN IF NOT EXISTS`, null-guarded UPDATE, `CREATE UNIQUE INDEX IF NOT EXISTS`) with a partial unique index that correctly excludes NULL rows.
- No secret material appears in logs; error objects are logged by `.message` only.

Main concerns are (1) a silent refresh-token rotation break when DB persistence fails in `refreshTokenIfNeeded`, (2) the OAuth callback leaving a half-provisioned row when the account probe fails, and (3) webhook behavior when two tenants share the same Jobber account.

## Warnings

### WR-01: Silent auth break when persisting rotated refresh_token fails

**File:** `src/lib/integrations/adapter.js:70-86`
**Issue:** Jobber rotates `refresh_token` on every refresh (confirmed in `jobber.js:258` and `tests/integrations/jobber.refresh.test.js`). In `refreshTokenIfNeeded`, if the Supabase `update` fails, the code logs the error but still returns the refreshed `newTokenSet` and callers proceed with a valid access_token. However, the new `refresh_token` returned by Jobber invalidates the old one server-side; the DB still holds the old (now dead) token. The next refresh attempt will fail and silently mark the integration `token_refresh_failed`. This is the exact "silent auth break" called out in the phase focus areas.

Impact is broader than Jobber (Xero has the same code path), but Jobber's mandatory rotation makes it the hot surface.
**Fix:** Treat persistence failure as fatal — surface it so the caller falls back to the cached row (and the current access_token survives its remaining TTL) rather than continuing with a lost rotation:
```js
const { error } = await supabase
  .from('accounting_credentials')
  .update(updatePayload)
  .eq('id', credentials.id);

if (error) {
  console.error('[integrations] Failed to persist refreshed tokens:', error.message);
  // Do NOT return the un-persisted rotated tokens — they'll be orphaned on next call.
  throw new Error(`Token rotation persistence failed for provider=${credentials.provider}: ${error.message}`);
}
```
Callers (`fetchJobberCustomerByPhone`, webhook handler) already wrap this in try/catch and fall back to `{ client: null }` / broad revalidation, so throwing is safe.

### WR-02: OAuth callback leaves tokens persisted but integration non-functional when probe fails

**File:** `src/app/api/integrations/[provider]/callback/route.js:134-151`
**Issue:** For Jobber, `probeJobberAccountId` runs after the token upsert. If the probe fails (network blip, transient 5xx, 5s timeout), the callback redirects with `?error=account_probe_failed&provider=jobber` but tokens have already been persisted with `external_account_id = NULL`. Subsequent webhook deliveries silently no-op forever (webhook handler filters on `external_account_id = evt.accountId`, which is NULL). The UI will show the integration as "connected" (green state) because the row exists — the user has no signal that webhooks are broken.

The comment on line 142-146 acknowledges "tokens persisted; external_account_id remains NULL" but does not roll back.
**Fix:** Either (a) delete the just-inserted row on probe failure so the user can retry cleanly, or (b) retry the probe opportunistically from `fetchJobberCustomerByPhone` (best on subsequent real call) and write back `external_account_id` there. Option (a) is simpler:
```js
if (!accountId) {
  await supabase
    .from('accounting_credentials')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('provider', 'jobber');
  console.error('[integrations-callback] jobber account probe failed — row rolled back');
  return NextResponse.redirect(`${...}?error=account_probe_failed&provider=jobber`);
}
```

### WR-03: Webhook lookup by `external_account_id` is ambiguous if two tenants connect the same Jobber account

**File:** `src/app/api/webhooks/jobber/route.js:121-127`
**Issue:** Migration 054's unique index is `(tenant_id, provider, external_account_id)` — it prevents the same account appearing twice under one tenant but does not prevent the same Jobber `accountId` appearing across two different Voco tenants (e.g. contractor franchise split into two sub-accounts). The webhook lookup uses `.maybeSingle()` which returns an error (not a row) when >1 match; the catch-all `try/catch` on line 169-173 then silently returns 200. Webhooks for both tenants are dropped.

Jobber can only emit one webhook per `accountId` per event, so the ambiguity is real: you'd need policy on which tenant owns it.
**Fix:** Either (a) enforce a global unique index `(provider, external_account_id) WHERE external_account_id IS NOT NULL` to make the OAuth callback fail cleanly with a "this Jobber account is already connected" error, or (b) switch the lookup to `.limit(1)` / iterate all matches and revalidate all tenants. Option (a) is correct for a B2B product:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS
  idx_accounting_credentials_provider_external_unique
  ON accounting_credentials (provider, external_account_id)
  WHERE external_account_id IS NOT NULL;
```
Then handle the unique-violation error in the callback to return `?error=account_already_connected`.

## Info

### IN-01: Inconsistent E.164 regex between notifications and integration fetcher

**File:** `src/lib/integrations/jobber.js:93` vs `src/lib/notifications.js:47`
**Issue:** `fetchJobberCustomerByPhone` validates `^\+[1-9]\d{6,14}$` (7–15 digits after country code) while `isValidE164` validates `^\+[1-9]\d{1,14}$` (2–15 digits). Both are "correct" E.164 interpretations but should be consistent across the codebase.
**Fix:** Import `isValidE164` from `notifications.js` or move it to a shared util (e.g., `src/lib/phone.js`) and use it in both places. Rejection of 2-6-digit shortcodes as keys is probably intentional for this lookup; document why if kept.

### IN-02: Tenant features_enabled update is best-effort without error logging

**File:** `src/app/api/integrations/[provider]/callback/route.js:116-128`
**Issue:** The invoicing feature-flag flip on connect has no error handling. If the update fails (e.g. RLS denial under the service client shouldn't occur, but network flakes can), the integration is connected but invoicing is off silently — user reports "I connected Xero but Invoices tab never appeared."
**Fix:** Capture and log the update error at minimum, or return `?warning=invoicing_flag_not_set` to surface:
```js
const { error: flagErr } = await supabase.from('tenants').update({...}).eq('id', tenantId);
if (flagErr) console.error('[integrations-callback] invoicing flag update failed:', flagErr.message);
```

### IN-03: Webhook handler selects full credential row (`select('*')`) including tokens

**File:** `src/app/api/webhooks/jobber/route.js:121-126`
**Issue:** `SELECT *` pulls `access_token`, `refresh_token`, `expiry_date`, `scopes`, etc. All are needed by `refreshTokenIfNeeded`, so this is functional, but `SELECT *` is fragile if the table schema grows (e.g., a future `client_secret_encrypted` column would start flowing through this read). The existing code never logs the cred object, so there's no active leak — this is defense-in-depth.
**Fix:** Select only the columns `refreshTokenIfNeeded` and the downstream fetch need:
```js
.select('id, tenant_id, provider, access_token, refresh_token, expiry_date, scopes')
```

### IN-04: `probeJobberAccountId` does not check GraphQL-level errors

**File:** `src/app/api/integrations/[provider]/callback/route.js:54-57`
**Issue:** The probe only checks `resp.ok`. Jobber can return HTTP 200 with a body containing `{ errors: [...] }` and no `data.account.id`. In that case `body?.data?.account?.id` is `undefined` and the function correctly returns `null` — so the behavior is actually safe. Calling out for future maintainers because it looks like an oversight.
**Fix:** No code change needed; add a comment or a one-line errors check for clarity:
```js
if (Array.isArray(body?.errors) && body.errors.length) return null;
```

### IN-05: `.env.example` is missing an explicit `NEXT_PUBLIC_APP_URL` reminder for Jobber redirect URI

**File:** `.env.example:14`
**Issue:** The comment says "Redirect URI: $NEXT_PUBLIC_APP_URL/api/integrations/jobber/callback" but `NEXT_PUBLIC_APP_URL` itself is not listed in this block; contributors tracing only the Jobber section won't see where it comes from.
**Fix:** Add a cross-reference comment or ensure `NEXT_PUBLIC_APP_URL` is documented in a nearby block.

---

_Reviewed: 2026-04-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

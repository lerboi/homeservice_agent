# Webhooks — Xero + Jobber

Covers: HMAC verification, Xero intent-verify, Jobber topic routing, per-phone
`revalidateTag` invalidation, tenant resolution via `external_account_id`,
silent-ignore for at-least-once retry safety.

## File map

| Handler | File |
|---------|------|
| Xero | `src/app/api/webhooks/xero/route.js` |
| Jobber | `src/app/api/webhooks/jobber/route.js` |
| Jobber visit → calendar_events (Phase 57) | `src/lib/scheduling/jobber-schedule-mirror.js :: applyJobberVisit` |
| Jobber visit fetch (Phase 57) | `src/lib/integrations/jobber.js :: fetchJobberVisitById` |

## HMAC verification — shared pattern

Both webhooks:

1. Read raw body via `await request.text()` — **must** be read ONCE, before
   any `JSON.parse`. Calling `request.json()` and re-stringifying breaks
   HMAC compare because `JSON.stringify` is not byte-identical to the
   received bytes.
2. Compute `crypto.createHmac('sha256', SECRET).update(rawBody, 'utf8').digest('base64')`.
3. Timing-safe compare via `crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))`.
4. Bad signature → HTTP 401 with empty body (covers Xero intent-verify probes).
5. Good signature → proceed to JSON.parse + business logic.

### Xero signing secret — XERO_WEBHOOK_KEY

Xero publishes a dedicated webhook signing key per webhook registration
(distinct from client_secret). Set via env var `XERO_WEBHOOK_KEY`.

Header: `x-xero-signature`.

### Jobber signing secret — JOBBER_CLIENT_SECRET

⚠️ **Common pitfall:** Jobber re-uses the OAuth `client_secret` as the HMAC
key. There is NO separate `JOBBER_WEBHOOK_SECRET` env var. Phase 56
research "Pitfall 1 Option B" explicitly resolved this after confusion.

Header: `x-jobber-hmac-sha256` (base64-encoded).

## Xero intent-verify branch

When Xero first registers a webhook, it sends 4 probes with different sigs
to confirm the endpoint does HMAC correctly:

1. 3 probes with INVALID sigs → endpoint must return 401.
2. 1 probe with VALID sig → endpoint returns 200.

Xero's probe algorithm matches the normal handler path (401 on bad sig, 200
on good sig with no events to process). No special branch — the handler's
HMAC gate handles intent-verify by design.

## Jobber topic routing

Jobber webhook body shape:

```json
{
  "data": {
    "webHookEvent": {
      "topic": "CLIENT_UPDATE",
      "accountId": "...",
      "itemId": "...",
      "occuredAt": "2026-04-20T..."
    }
  }
}
```

Topic routing (see `jobber/route.js`):

| Topic | Item | Query |
|-------|------|-------|
| `CLIENT_CREATE`, `CLIENT_UPDATE`, `CLIENT_DESTROY` | clientId | `{ client { phones { number } } }` |
| `JOB_CREATE`, `JOB_UPDATE`, `JOB_DESTROY` | jobId | `{ job { client { phones { number } } } }` |
| `VISIT_CREATE`, `VISIT_UPDATE`, `VISIT_DESTROY` | visitId | Phase 57: fetch visit + client → `applyJobberVisit` into `calendar_events` AND revalidate per-phone |
| `INVOICE_CREATE`, `INVOICE_UPDATE`, `INVOICE_DESTROY` | invoiceId | `{ invoice { client { phones { number } } } }` |

For VISIT_* topics (Phase 57 schedule mirror):
1. Resolve visit → calendar_events row via `applyJobberVisit`.
2. AND resolve visit → parent job → client → phones for cache invalidation.

## Tenant resolution — external_account_id

Both providers send their OWN account ID in the webhook payload
(`evt.accountId` for Jobber, `evt.tenantId` for Xero). Voco maps this back
to a Voco tenant via `accounting_credentials.external_account_id` (migration
054, global unique since migration 056).

```js
const { data: cred } = await admin
  .from('accounting_credentials')
  .select('tenant_id, access_token, refresh_token, expires_at')
  .eq('provider', 'jobber')
  .eq('external_account_id', evt.accountId)
  .maybeSingle();

if (!cred) return new Response('', { status: 200 }); // silent-ignore
```

**Why silent-ignore on unknown account:** Jobber and Xero both have at-
least-once delivery semantics. If we return non-200 on an unknown account,
they retry forever (observed: Xero retries for up to 48h). Silent-ignore
lets stale webhook registrations drain naturally.

## Phone normalization — libphonenumber-js

Provider responses may include unformatted phones. Normalize to E.164
before revalidating:

```js
import { parsePhoneNumberFromString } from 'libphonenumber-js';

for (const raw of client?.phones ?? []) {
  const parsed = parsePhoneNumberFromString(raw.number, defaultCountry);
  if (parsed?.isValid()) {
    revalidateTag(`jobber-context-${tenant_id}-${parsed.number}`);
  }
}
```

`defaultCountry` is inferred from the tenant's `country` column
(fallback US). This matters because Jobber clients may store local-format
phones.

## Per-phone revalidateTag with broad fallback

On successful resolve + normalize:
```js
revalidateTag(`jobber-context-${tenant_id}-${phoneE164}`);
```

On ANY resolve failure (GraphQL throws, missing client, zero valid phones,
topic not recognized):
```js
revalidateTag(`jobber-context-${tenant_id}`); // broad tenant tag
```

The broad tag bust is conservative — it blows the whole per-tenant cache
rather than risk stale data. Rare enough (resolve failures are unusual)
that it doesn't cause a cache storm.

## No console.log in production

Both handlers avoid `console.log` with any user data, tokens, or full
response bodies. Xero/Jobber PII + tokens land in Railway/Vercel logs
if logged; Phase 55/56 research V7 explicitly forbids.

Minimal error surface:
```js
} catch (err) {
  // Never log the full err or the raw body.
  return new Response('', { status: 200 }); // always 200 after HMAC pass
}
```

## Tests

Both handlers have integration tests under `tests/integrations/`:
- `tests/integrations/jobber/` (topic routing, HMAC, intent-verify)
- Xero webhook tests (naming varies — search `tests/webhooks/xero`)

Refresh lock regression: `tests/integrations/refresh-lock.test.js`.

## Debugging "webhook silently dropped"

Order of investigation:

1. **HMAC mismatch** — `XERO_WEBHOOK_KEY` or `JOBBER_CLIENT_SECRET` env drift
   on Vercel. Check `curl` test against the endpoint with a known good body.
2. **Wrong `external_account_id`** — If the tenant was reconnected, the
   external_account_id may have changed. Query:
   ```sql
   SELECT tenant_id, provider, external_account_id
   FROM accounting_credentials
   WHERE provider IN ('xero','jobber');
   ```
3. **Raw body read twice** — Grep for `request.json()` in the handler;
   must be `request.text()`.
4. **Silent-ignore firing** — Add a Sentry breadcrumb (or debug log gated
   behind `DEBUG_WEBHOOKS=1`) at the 200-empty return path to confirm.
5. **Tag invalidation mismatch** — Check the dashboard read is using the
   same E.164 format as the webhook emits (`parsePhoneNumberFromString`
   defaults must match).

---
phase: 54-integration-credentials-foundation-caching-prep-sandbox-provisioning
plan: 03
type: execute
wave: 3
depends_on:
  - 54-02
files_modified:
  - src/app/api/integrations/[provider]/auth/route.js
  - src/app/api/integrations/[provider]/callback/route.js
  - src/app/api/integrations/disconnect/route.js
  - src/app/api/integrations/status/route.js
autonomous: false
requirements:
  - INTFOUND-01

must_haves:
  truths:
    - "`GET /api/integrations/xero/auth` returns `{ url: <consent-url> }` for authenticated tenant owners"
    - "`GET /api/integrations/xero/callback?code=...&state=...` exchanges the code, upserts `accounting_credentials` with `scopes` populated, calls `revalidateTag`, and 302-redirects to `/dashboard/more/integrations?connected=xero`"
    - "`POST /api/integrations/disconnect` with `{provider}` deletes the credential row AND calls adapter.revoke (best-effort), then calls `revalidateTag`"
    - "`GET /api/integrations/status` returns `{xero: {...}|null, jobber: {...}|null}` using `getIntegrationStatus` from Plan 02"
    - "Legacy `/api/accounting/**` paths return 404 (directory was removed in Plan 02)"
    - "All four new routes reject unsupported providers with 400 and unauthenticated requests with 401"
  artifacts:
    - path: "src/app/api/integrations/[provider]/auth/route.js"
      provides: "OAuth initiation Route Handler — returns consent URL"
      exports: ["GET"]
    - path: "src/app/api/integrations/[provider]/callback/route.js"
      provides: "OAuth callback Route Handler — exchanges code, upserts credentials with scopes, revalidates cache tag"
      exports: ["GET"]
    - path: "src/app/api/integrations/disconnect/route.js"
      provides: "Disconnect Route Handler — revokes upstream best-effort, deletes credential row, revalidates cache tag"
      exports: ["POST"]
    - path: "src/app/api/integrations/status/route.js"
      provides: "Status Route Handler — returns per-provider integration status via getIntegrationStatus"
      exports: ["GET"]
  key_links:
    - from: "src/app/api/integrations/[provider]/callback/route.js"
      to: "accounting_credentials upsert + revalidateTag"
      via: "service-role Supabase client + next/cache revalidateTag"
      pattern: "revalidateTag\\(`integration-status-\\$\\{tenantId\\}`\\)"
    - from: "src/app/api/integrations/[provider]/auth/route.js"
      to: "signOAuthState from google-calendar helper"
      via: "named import"
      pattern: "signOAuthState.*google-calendar"
    - from: "src/app/api/integrations/status/route.js"
      to: "getIntegrationStatus from integrations/status.js"
      via: "named import — exercises 'use cache' on API request"
      pattern: "getIntegrationStatus"
---

<objective>
Land the canonical `/api/integrations/**` Route Handlers that INTFOUND-01 requires. The legacy `/api/accounting/**` directory was removed as part of Plan 02 (see Plan 02 Task 2 Option A) because its modules imported from deleted `accounting/adapter.js`. Plan 03 ships the four new routes under `src/app/api/integrations/` so that the OAuth loop, disconnect flow, and status reader all work end-to-end.

Purpose:
- Phase 55 (Xero) and Phase 56 (Jobber) plug their real implementations into the `IntegrationAdapter` factory; the routes here drive the lifecycle.
- Plan 05's Business Integrations page reads from `GET /api/integrations/status` (per UI-SPEC §Data Flow) AND the Server Component variant may call `getIntegrationStatus` directly — both paths work after this plan.
- Phase 58 telemetry depends on the status endpoint including `last_context_fetch_at`.

Output:
- 4 new route files under `src/app/api/integrations/`
- OAuth `state` uses existing `signOAuthState`/`verifyOAuthState` from `src/app/api/google-calendar/auth/route.js` (CONTEXT.md discretion — no extraction to `oauth-state.js`)
- Callback persists `scopes` into the new `TEXT[]` column (migration 051 applied in Plan 01)
- Callback + disconnect call `revalidateTag(\`integration-status-${tenantId}\`)` so the cached status reader invalidates on state change (D-10 smoke test loop)
- Disconnect calls `adapter.revoke(tokenSet)` best-effort before deleting the DB row (research §Security Domain "Revoke that doesn't actually revoke upstream" mitigation)

**Pre-merge checklist surfaced to user** (per CONTEXT.md D-05 + research §Runtime State Inventory):
- If a Xero dev sandbox app is already registered with the old `/api/accounting/xero/callback` URL, update it to `/api/integrations/xero/callback` BEFORE merging this plan. Zero risk if not yet registered. Checklist captured in Task 4 checkpoint.
</objective>

<execution_context>
@.claude/get-shit-done/workflows/execute-plan.md
@.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/54-integration-credentials-foundation-caching-prep-sandbox-provisioning/54-CONTEXT.md
@.planning/phases/54-integration-credentials-foundation-caching-prep-sandbox-provisioning/54-RESEARCH.md
@src/lib/integrations/types.js
@src/lib/integrations/adapter.js
@src/lib/integrations/status.js
@src/app/api/google-calendar/auth/route.js

<interfaces>
<!-- Plan 02 output that Plan 03 consumes -->

From `src/lib/integrations/types.js`:
```javascript
export const PROVIDERS = ['xero', 'jobber'];
```

From `src/lib/integrations/adapter.js`:
```javascript
export async function getIntegrationAdapter(provider): Promise<IntegrationAdapter>
export async function refreshTokenIfNeeded(supabase, credentials): Promise<credentials>
```

From `src/lib/integrations/status.js`:
```javascript
export async function getIntegrationStatus(tenantId): Promise<{ xero: row|null, jobber: row|null }>
// Internally: 'use cache' + cacheTag(`integration-status-${tenantId}`)
```

Adapter method signatures (mandatory for every provider):
```javascript
getAuthUrl(stateParam, redirectUri): string
exchangeCode(code, redirectUri, extraParams?): Promise<TokenSet>    // TokenSet includes .scopes[] (added in Plan 02)
refreshToken(tokenSet): Promise<TokenSet>
revoke(tokenSet): Promise<void>                                      // Jobber throws; Xero implemented
fetchCustomerByPhone(tenantId, phone): Promise<CustomerContext>      // Both throw NotImplementedError in Phase 54
```

From `src/app/api/google-calendar/auth/route.js`:
```javascript
export function signOAuthState(tenantId): string         // returns "tenantId:hmac"
export function verifyOAuthState(state): string | null   // returns tenantId or null
```

From `src/lib/supabase-server.js` (existing):
```javascript
export async function createSupabaseServer()   // cookie-aware client for auth.getUser()
```

From `src/lib/supabase.js` (existing):
```javascript
export const supabase    // service-role singleton for writes
```

From `src/lib/get-tenant-id.js` (existing):
```javascript
export async function getTenantId(): Promise<string | null>   // for authenticated tenant owner
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create /api/integrations/[provider]/auth + /api/integrations/[provider]/callback</name>
  <files>src/app/api/integrations/[provider]/auth/route.js, src/app/api/integrations/[provider]/callback/route.js</files>
  <read_first>
    - src/app/api/google-calendar/auth/route.js (lines 1-45 — signOAuthState signature and import style)
    - .planning/phases/54-integration-credentials-foundation-caching-prep-sandbox-provisioning/54-RESEARCH.md §Code Examples "OAuth initiation" + "OAuth callback with revalidateTag" (verbatim templates)
    - src/lib/supabase-server.js (confirm createSupabaseServer signature)
    - src/lib/supabase.js (confirm default `supabase` service-role export)
  </read_first>
  <action>
**Step 1.** Create `src/app/api/integrations/[provider]/auth/route.js` with exact content:

```javascript
/**
 * GET /api/integrations/[provider]/auth
 *
 * Returns { url } — the OAuth authorization URL for the given provider.
 * Reuses the HMAC-signed state pattern from Google Calendar OAuth
 * (signOAuthState — keyed by SUPABASE_SERVICE_ROLE_KEY, timing-safe verify).
 *
 * Phase 54 — supported providers: 'xero', 'jobber'.
 */

import { createSupabaseServer } from '@/lib/supabase-server';
import { supabase } from '@/lib/supabase';
import { signOAuthState } from '@/app/api/google-calendar/auth/route';
import { getIntegrationAdapter } from '@/lib/integrations/adapter';
import { PROVIDERS } from '@/lib/integrations/types';

export async function GET(request, { params }) {
  const { provider } = await params;

  if (!PROVIDERS.includes(provider)) {
    return Response.json(
      { error: `Unsupported provider: "${provider}". Must be one of: ${PROVIDERS.join(', ')}` },
      { status: 400 },
    );
  }

  const supabaseServer = await createSupabaseServer();
  const { data: { user }, error: authError } = await supabaseServer.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('owner_id', user.id)
    .single();
  if (!tenant) {
    return Response.json({ error: 'Tenant not found' }, { status: 404 });
  }

  const adapter = await getIntegrationAdapter(provider);
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/${provider}/callback`;
  const state = signOAuthState(tenant.id);
  const authUrl = adapter.getAuthUrl(state, redirectUri);

  return Response.json({ url: authUrl });
}
```

**Step 2.** Create `src/app/api/integrations/[provider]/callback/route.js` with exact content:

```javascript
/**
 * GET /api/integrations/[provider]/callback
 *
 * OAuth callback handler. Exchanges the authorization code for tokens via
 * the provider adapter, persists the credential row (scopes + xero_tenant_id
 * + display_name + tokens), and calls revalidateTag so the cached
 * getIntegrationStatus reader sees the new state on the next render.
 *
 * Phase 54 — supported providers: 'xero', 'jobber'. Jobber's exchangeCode
 * throws NotImplementedError; the try/catch surfaces that as ?error= on the
 * redirect so the frontend can toast.error gracefully.
 */

import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { supabase } from '@/lib/supabase';
import { verifyOAuthState } from '@/app/api/google-calendar/auth/route';
import { getIntegrationAdapter } from '@/lib/integrations/adapter';
import { PROVIDERS } from '@/lib/integrations/types';

const PAGE_URL = '/dashboard/more/integrations';

export async function GET(request, { params }) {
  const { provider } = await params;

  if (!PROVIDERS.includes(provider)) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}${PAGE_URL}?error=unsupported_provider&provider=${provider}`,
    );
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  const tenantId = verifyOAuthState(state);
  if (!code || !tenantId) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}${PAGE_URL}?error=invalid_state&provider=${provider}`,
    );
  }

  try {
    const adapter = await getIntegrationAdapter(provider);
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/${provider}/callback`;
    const tokenSet = await adapter.exchangeCode(code, redirectUri);

    const { error: upsertError } = await supabase.from('accounting_credentials').upsert(
      {
        tenant_id: tenantId,
        provider,
        access_token: tokenSet.access_token,
        refresh_token: tokenSet.refresh_token,
        expiry_date: tokenSet.expiry_date,
        xero_tenant_id: tokenSet.xero_tenant_id || null,
        display_name: tokenSet.display_name || null,
        scopes: tokenSet.scopes || [],
        connected_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,provider' },
    );

    if (upsertError) {
      console.error(`[integrations-callback] ${provider} upsert failed:`, upsertError.message);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}${PAGE_URL}?error=persist_failed&provider=${provider}`,
      );
    }

    revalidateTag(`integration-status-${tenantId}`);

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}${PAGE_URL}?connected=${provider}`,
    );
  } catch (err) {
    console.error(`[integrations-callback] ${provider} error:`, err?.message || err);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}${PAGE_URL}?error=connection_failed&provider=${provider}`,
    );
  }
}
```

Do NOT hand-roll token exchange. Do NOT extract HMAC helpers. Do NOT touch any other file.
  </action>
  <verify>
    <automated>test -f "src/app/api/integrations/[provider]/auth/route.js" && test -f "src/app/api/integrations/[provider]/callback/route.js" && grep -c "signOAuthState" "src/app/api/integrations/[provider]/auth/route.js" && grep -c "verifyOAuthState" "src/app/api/integrations/[provider]/callback/route.js" && grep -cF "revalidateTag(\`integration-status-" "src/app/api/integrations/[provider]/callback/route.js" && grep -c "scopes: tokenSet.scopes" "src/app/api/integrations/[provider]/callback/route.js" && grep -c "PROVIDERS.includes(provider)" "src/app/api/integrations/[provider]/auth/route.js"</automated>
  </verify>
  <acceptance_criteria>
    - `src/app/api/integrations/[provider]/auth/route.js` exists and exports `GET`
    - Auth route imports `signOAuthState` from `@/app/api/google-calendar/auth/route` (grep: `import.*signOAuthState.*google-calendar`)
    - Auth route imports `PROVIDERS` from `@/lib/integrations/types` (grep: `import.*PROVIDERS.*integrations/types`)
    - Auth route contains literal `PROVIDERS.includes(provider)` guard and returns 400 on mismatch
    - Auth route contains literal `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/${provider}/callback`
    - `src/app/api/integrations/[provider]/callback/route.js` exists and exports `GET`
    - Callback route imports `revalidateTag` from `next/cache`
    - Callback route contains literal `revalidateTag(\`integration-status-${tenantId}\`)`
    - Callback route upserts with literal `onConflict: 'tenant_id,provider'`
    - Callback route upsert includes `scopes: tokenSet.scopes || []` (grep must find literal string)
    - Callback route redirects to `/dashboard/more/integrations?connected=${provider}` on success and `?error=...&provider=${provider}` on failure
    - Neither file imports from `@/lib/accounting/...` (grep returns 0)
  </acceptance_criteria>
  <done>
Both Route Handlers exist with exact content above. OAuth initiation loop works end-to-end for Xero (Jobber path returns a URL but the callback will throw NotImplementedError → user sees toast.error via the `?error=connection_failed` redirect, correctly). `revalidateTag` fires on successful connection.
  </done>
</task>

<task type="auto">
  <name>Task 2: Create /api/integrations/disconnect and /api/integrations/status Route Handlers</name>
  <files>src/app/api/integrations/disconnect/route.js, src/app/api/integrations/status/route.js</files>
  <read_first>
    - src/lib/integrations/types.js (confirm PROVIDERS array for disconnect body guard)
    - src/lib/integrations/adapter.js (confirm getIntegrationAdapter signature for revoke call)
    - src/lib/integrations/status.js (confirm return shape for status API)
    - src/lib/get-tenant-id.js (confirm getTenantId signature — disconnect + status route both use it)
    - src/lib/supabase.js (confirm service-role supabase import)
  </read_first>
  <action>
**Step 1.** Create `src/app/api/integrations/disconnect/route.js` with exact content:

```javascript
/**
 * POST /api/integrations/disconnect
 *
 * Revokes the upstream OAuth token (best-effort) and deletes the credential row.
 * Calls revalidateTag so the cached getIntegrationStatus reader invalidates.
 *
 * Body: { provider: 'xero' | 'jobber' }
 *
 * Upstream revoke is best-effort — if the provider's revoke endpoint fails,
 * the local row is still deleted (owner's intent was "disconnect locally
 * regardless of upstream state"). Failure is logged, not propagated.
 */

import { revalidateTag } from 'next/cache';
import { getTenantId } from '@/lib/get-tenant-id';
import { supabase } from '@/lib/supabase';
import { getIntegrationAdapter } from '@/lib/integrations/adapter';
import { PROVIDERS } from '@/lib/integrations/types';

export async function POST(request) {
  const tenantId = await getTenantId();
  if (!tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { provider } = body || {};
  if (!provider || !PROVIDERS.includes(provider)) {
    return Response.json(
      { error: `Invalid provider. Must be one of: ${PROVIDERS.join(', ')}` },
      { status: 400 },
    );
  }

  // Load existing credential row so the adapter can revoke upstream before we delete.
  const { data: credential } = await supabase
    .from('accounting_credentials')
    .select('access_token, refresh_token, expiry_date, xero_tenant_id')
    .eq('tenant_id', tenantId)
    .eq('provider', provider)
    .maybeSingle();

  // Best-effort upstream revoke. Jobber throws NotImplementedError — log + continue.
  if (credential) {
    try {
      const adapter = await getIntegrationAdapter(provider);
      await adapter.revoke({
        access_token: credential.access_token,
        refresh_token: credential.refresh_token,
        expiry_date: credential.expiry_date,
        xero_tenant_id: credential.xero_tenant_id,
      });
    } catch (err) {
      console.error(`[integrations-disconnect] ${provider} revoke failed (non-fatal):`, err?.message || err);
    }
  }

  const { error: deleteError } = await supabase
    .from('accounting_credentials')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('provider', provider);

  if (deleteError) {
    console.error(`[integrations-disconnect] ${provider} delete failed:`, deleteError.message);
    return Response.json({ error: 'Failed to disconnect' }, { status: 500 });
  }

  revalidateTag(`integration-status-${tenantId}`);

  return Response.json({ success: true });
}
```

**Step 2.** Create `src/app/api/integrations/status/route.js` with exact content:

```javascript
/**
 * GET /api/integrations/status
 *
 * Returns per-provider integration status for the authenticated tenant.
 * Shape: { xero: <row>|null, jobber: <row>|null } — each row contains
 * provider, scopes, last_context_fetch_at, connected_at, display_name.
 *
 * Internally calls getIntegrationStatus which is wrapped in 'use cache'
 * with a per-tenant cacheTag. Callback + disconnect revalidate the tag.
 */

import { getTenantId } from '@/lib/get-tenant-id';
import { getIntegrationStatus } from '@/lib/integrations/status';

export async function GET() {
  const tenantId = await getTenantId();
  if (!tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const status = await getIntegrationStatus(tenantId);
    return Response.json(status);
  } catch (err) {
    console.error('[integrations-status] fetch failed:', err?.message || err);
    return Response.json({ error: 'Failed to fetch status' }, { status: 500 });
  }
}
```

Do NOT add a disconnect body `{ all: true }` bulk delete path (out of scope). Do NOT return `access_token`/`refresh_token` in status (information-disclosure mitigation). Do NOT implement `/api/integrations/refresh` or similar — Phase 55/56 own that.
  </action>
  <verify>
    <automated>test -f src/app/api/integrations/disconnect/route.js && test -f src/app/api/integrations/status/route.js && grep -c "getIntegrationAdapter" src/app/api/integrations/disconnect/route.js && grep -c "adapter.revoke" src/app/api/integrations/disconnect/route.js && grep -cF "revalidateTag(\`integration-status-" src/app/api/integrations/disconnect/route.js && grep -c "getIntegrationStatus" src/app/api/integrations/status/route.js && ! grep -q "access_token" src/app/api/integrations/status/route.js</automated>
  </verify>
  <acceptance_criteria>
    - `src/app/api/integrations/disconnect/route.js` exists and exports `POST`
    - Disconnect route calls `adapter.revoke(...)` inside a try/catch (best-effort upstream revoke)
    - Disconnect route deletes the credential row scoped by `tenant_id` AND `provider`
    - Disconnect route calls `revalidateTag(\`integration-status-${tenantId}\`)` after successful delete
    - Disconnect route returns 401 when `getTenantId()` returns null, 400 on invalid body/provider, 500 on delete error, 200 `{success: true}` on success
    - `src/app/api/integrations/status/route.js` exists and exports `GET`
    - Status route imports `getIntegrationStatus` from `@/lib/integrations/status` (grep: `import.*getIntegrationStatus.*integrations/status`)
    - Status route does NOT reference `access_token` or `refresh_token` anywhere (grep returns 0)
    - Status route returns 401 when unauthenticated, 500 on error, JSON body with shape `{xero, jobber}` on success
    - Neither file imports from `@/lib/accounting/...` (grep returns 0)
  </acceptance_criteria>
  <done>
Both Route Handlers exist with exact content above. Disconnect revokes upstream (best-effort) + deletes local row + revalidates cache. Status returns non-sensitive fields only and exercises the `'use cache'` loop through `getIntegrationStatus`.
  </done>
</task>

<task type="auto">
  <name>Task 3: Smoke-test build + npm test pass; confirm no stale imports or legacy paths remain</name>
  <files>(validation only — no files modified)</files>
  <read_first>
    - package.json (confirm `npm run build` and `npm test` commands)
    - src/app/dashboard/more/integrations/page.js (the page still references /api/accounting/... URLs — expected to be broken, Plan 05 fixes; this task tolerates the broken page)
  </read_first>
  <action>
Run a quick sweep that the Phase 54 API scaffolding holds together:

1. `npm test -- --testPathPatterns=integrations` — all Plan 02 tests still green (no regression from route introduction).
2. `npm run build` — the build MAY surface a warning that `/dashboard/more/integrations/page.js` calls `/api/accounting/...` (404 at runtime), but it MUST NOT fail with a compile error on any file under `src/app/api/integrations/**` or `src/lib/integrations/**`. If the build fails, read the error — the fix almost always traces back to an incorrect import path from Plan 02.
3. `grep -rE "from ['\"]@?/?src?/?lib/accounting/(types|adapter|xero|quickbooks|freshbooks)" src/` — must return zero hits. If hits exist, fix the imports (repoint to `@/lib/integrations/...`).
4. `grep -rE "'/api/accounting/" src/app/api/integrations/ || true` — must return zero hits (new routes should NOT reference old paths).
5. `test ! -d src/app/api/accounting` — must be true (Plan 02 deleted the directory).

Document findings in the plan SUMMARY even if everything is green — this is the integrator checkpoint that confirms the Plan 02+03 seam is clean before Plan 04 adds `cacheComponents: true` (which would hard-fail the build if anything were misconfigured).
  </action>
  <verify>
    <automated>npm test -- --testPathPatterns=integrations 2>&1 | tail -10 && test ! -d src/app/api/accounting && npm run build 2>&1 | tail -30</automated>
  </verify>
  <acceptance_criteria>
    - `npm test -- --testPathPatterns=integrations` exits 0 and shows all Plan 02 tests green
    - `test ! -d src/app/api/accounting` succeeds
    - `grep -rE "from ['\"]@?/?src?/?lib/accounting/(types|adapter|xero|quickbooks|freshbooks)" src/` returns empty (no remaining legacy imports)
    - `npm run build` finishes without errors referencing `src/app/api/integrations/**` or `src/lib/integrations/**` (warnings about the dashboard page's `/api/accounting/...` fetches calling non-existent URLs are acceptable — they're runtime concerns Plan 05 fixes)
  </acceptance_criteria>
  <done>
Plan 02 + Plan 03 seam is clean. Build compiles. No stale imports. Legacy directory confirmed gone. The broken-dashboard-page warning window remains open until Plan 05, by design.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: Dev-console redirect URI update checkpoint (pre-Plan-05 merge)</name>
  <what-built>New OAuth initiation + callback routes at `/api/integrations/[provider]/{auth,callback}`. The old `/api/accounting/xero/callback` path no longer exists (returns 404).</what-built>
  <how-to-verify>
Before Plan 05 merges (which completes the end-to-end flow), confirm Xero + Jobber dev-console settings match the new callback paths:

1. **Xero Developer Portal** (https://developer.xero.com/app/manage/):
   - Open the sandbox app (if registered).
   - Under "Configuration" → "OAuth 2.0 redirect URIs", ensure ONE of the entries is:
     `{NEXT_PUBLIC_APP_URL}/api/integrations/xero/callback`
     (where `{NEXT_PUBLIC_APP_URL}` is your dev/staging host — e.g. `http://localhost:3000` or `https://dev.voco.live`).
   - If the old `/api/accounting/xero/callback` URI is present, DELETE it (clean cut per CONTEXT.md D-05).
   - If no Xero sandbox app exists yet, skip — register during Phase 55 kickoff using the new URL from the start.

2. **Jobber Developer Center** (https://developer.getjobber.com/):
   - If the sandbox app is already registered, confirm the redirect URI is `{NEXT_PUBLIC_APP_URL}/api/integrations/jobber/callback`.
   - If not yet registered, note that Phase 54 ships a stub — real OAuth loop is Phase 56. The Jobber dev app can be registered during Phase 56 kickoff.

3. **Spot-check environment variables** (in `.env`, NOT `.env.example`):
   - `XERO_CLIENT_ID` and `XERO_CLIENT_SECRET` present (if Xero sandbox exists).
   - `JOBBER_CLIENT_ID` and `JOBBER_CLIENT_SECRET` may be empty until Phase 56 — that's OK.

4. **Optional smoke test** (if Xero sandbox exists):
   - `curl -i -H 'Cookie: <authenticated session>' http://localhost:3000/api/integrations/xero/auth` → expect `200` JSON with `url` pointing at `login.xero.com`.
  </how-to-verify>
  <files>(external — Xero + Jobber developer portals; .env file)</files>
  <action>Log in to https://developer.xero.com/app/manage/ and confirm the sandbox app (if registered) has redirect URI `{NEXT_PUBLIC_APP_URL}/api/integrations/xero/callback`. Remove any old `{NEXT_PUBLIC_APP_URL}/api/accounting/xero/callback` entry. If not yet registered, skip — defer to Phase 55 kickoff. Repeat for Jobber at https://developer.getjobber.com/ (confirm redirect URI `{NEXT_PUBLIC_APP_URL}/api/integrations/jobber/callback`, or defer to Phase 56). Spot-check `.env` for XERO_CLIENT_ID/SECRET; JOBBER_CLIENT_ID/SECRET may be empty until Phase 56.</action>
  <verify>
    <automated>MISSING — dev-console configuration is UI-driven. Optional curl smoke: `curl -i -H 'Cookie: <session>' http://localhost:3000/api/integrations/xero/auth` should return 200 JSON `{ url: <login.xero.com consent URL> }` if Xero sandbox + .env are set.</automated>
  </verify>
  <done>User confirms Xero + Jobber redirect URIs point to `{NEXT_PUBLIC_APP_URL}/api/integrations/<provider>/callback` (or explicitly defers to Phase 55/56 with no sandbox registered). Plan 04 can proceed.</done>
  <resume-signal>Type "redirect URIs confirmed" (or "not yet registered — will do in Phase 55/56") to unblock Plan 04. If something broke (e.g., old URL still live in dev console, or auth endpoint returns 500), paste the error.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → `/api/integrations/[provider]/auth` | Untrusted `provider` path param from URL. Authenticated owner session required. |
| Browser → `/api/integrations/[provider]/callback` | Untrusted `code` + `state` query params. State HMAC proves tenant ownership; no session cookie required (OAuth returnee is coming back from provider domain). |
| Browser → `/api/integrations/disconnect` | Authenticated owner session required. `provider` from body. |
| Adapter `revoke` → identity.xero.com / api.getjobber.com | Outbound HTTPS; failure-tolerant (best-effort). |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-54-12 | Spoofing | OAuth callback CSRF (attacker forces victim to bind attacker's provider account) | mitigate | `verifyOAuthState(state)` HMAC-SHA256 timing-safe compare keyed to `SUPABASE_SERVICE_ROLE_KEY`. Attacker cannot forge a valid state without the secret. Existing helper reused unchanged. |
| T-54-13 | Tampering | `provider` path/body param used in SQL or adapter lookup | mitigate | `PROVIDERS.includes(provider)` allowlist BEFORE any DB or adapter call; Supabase client uses parameterized queries, so even without the allowlist SQL injection is structurally impossible. |
| T-54-14 | Information Disclosure | Leaking `access_token` or `refresh_token` via `/api/integrations/status` | mitigate | `getIntegrationStatus` SELECT list explicitly excludes tokens (Plan 02 Task 1). Status route passes through shape unchanged; verified by acceptance criteria grep `! grep -q "access_token"`. |
| T-54-15 | Information Disclosure | Cache-tag collision returning another tenant's status | mitigate | `cacheTag(\`integration-status-${tenantId}\`)` per-tenant (set inside `getIntegrationStatus`). Closure-captured `tenantId` becomes part of cache key per Next.js 16 contract. |
| T-54-16 | Repudiation | Disconnect deletes DB row but upstream token remains valid | mitigate | `adapter.revoke(tokenSet)` called best-effort BEFORE delete. If revoke fails (Jobber NotImplementedError or network), failure is logged; DB row still deleted because owner's intent was "disconnect locally regardless of upstream state" (research §Security Domain). Acceptable for Phase 54. |
| T-54-17 | Elevation of Privilege | OAuth redirect URI manipulation | mitigate | `redirectUri` computed server-side from `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/${provider}/callback`. Attacker cannot inject a custom `redirect_uri`; the provider validates it matches the dev-console-registered URI. |
| T-54-18 | Denial-of-Service | Unauthenticated traffic to `/api/integrations/status` exhausts the cache | accept | Cache is per-tenant; unauthenticated requests hit the 401 branch before `getIntegrationStatus` is called. No cache amplification. Low-value target. |
| T-54-19 | Tampering | CHECK-constraint-swap window from Plan 01 allows brief moment where QB/FB row could re-appear before new CHECK enforces | accept | Migration is transactional (`BEGIN`/`COMMIT` in Plan 01); swap is atomic. No window exists outside the migration's single transaction. Inherits Plan 01's T-54-02 mitigation. |
</threat_model>

<verification>
- All 4 route files present and exporting expected HTTP verbs
- `npm test` — integrations tests green
- `npm run build` — compiles (warnings from dashboard page's old fetch URLs acceptable)
- Task 4 checkpoint resolved (dev-console redirect URI updated OR explicitly deferred to Phase 55/56 with user acknowledgment)
- No legacy `src/lib/accounting/*` imports anywhere in new routes
- No `access_token`/`refresh_token` in status response
</verification>

<success_criteria>
- `/api/integrations/xero/auth` issues a real Xero consent URL for an authenticated owner; `/api/integrations/jobber/auth` issues a Jobber authorize URL (stub scope config)
- `/api/integrations/xero/callback` exchanges code, writes credential row with scopes, revalidates tag, redirects to `?connected=xero`
- `/api/integrations/jobber/callback` fails gracefully via `NotImplementedError` → `?error=connection_failed`
- `/api/integrations/disconnect` revokes upstream + deletes row + revalidates tag
- `/api/integrations/status` returns `{xero, jobber}` shape via cached `getIntegrationStatus`
- Dev-console redirect URIs updated (or deferred intentionally)
</success_criteria>

<output>
After completion, create `.planning/phases/54-integration-credentials-foundation-caching-prep-sandbox-provisioning/54-03-SUMMARY.md`

Required fields:
- Files created: 4 route files under `src/app/api/integrations/`
- `npm test` result
- `npm run build` result (brief — note any warnings worth flagging for Plan 04)
- Task 4 checkpoint resolution: "Xero dev console updated" / "deferred to Phase 55 (no sandbox yet)" / "Jobber deferred to Phase 56"
- Known broken state: `/dashboard/more/integrations` page still 404-fetches until Plan 05 rewrites it
</output>

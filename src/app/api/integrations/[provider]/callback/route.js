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

// Jobber GraphQL constants — keep in sync with src/lib/integrations/jobber.js
const JOBBER_GRAPHQL_URL = 'https://api.getjobber.com/api/graphql';
const JOBBER_API_VERSION = '2025-04-16';

/**
 * Post-token-exchange probe for Jobber — resolves the `accountId` the
 * webhook handler (/api/webhooks/jobber) looks up via
 * accounting_credentials.external_account_id (P56 Plan 02 migration 054).
 *
 * Returns the account.id string on success, null on any failure. Never
 * throws — caller treats null as a non-fatal degraded state.
 *
 * @param {string} accessToken
 * @returns {Promise<string|null>}
 */
async function probeJobberAccountId(accessToken) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(JOBBER_GRAPHQL_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-JOBBER-GRAPHQL-VERSION': JOBBER_API_VERSION,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ query: 'query { account { id } }' }),
    });
    clearTimeout(timeout);
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      console.error(
        `[probeJobberAccountId] HTTP ${resp.status}: ${text.slice(0, 500)}`,
      );
      return null;
    }
    const body = await resp.json();
    if (body?.errors) {
      console.error(
        '[probeJobberAccountId] GraphQL errors:',
        JSON.stringify(body.errors).slice(0, 500),
      );
    }
    const id = body?.data?.account?.id;
    if (!id) {
      console.error(
        '[probeJobberAccountId] no account.id in response; body shape:',
        JSON.stringify(body).slice(0, 500),
      );
    }
    return typeof id === 'string' && id.length > 0 ? id : null;
  } catch (err) {
    console.error(
      '[probeJobberAccountId] network/parse error:',
      err?.message || err,
    );
    return null;
  }
}

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
        error_state: null,
      },
      { onConflict: 'tenant_id,provider' },
    );

    if (upsertError) {
      console.error(`[integrations-callback] ${provider} upsert failed:`, upsertError.message);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}${PAGE_URL}?error=persist_failed&provider=${provider}`,
      );
    }

    // Connecting an accounting/job-management integration is a strong declaration
    // that the owner wants invoice sync. Flip invoicing on if it isn't already —
    // this avoids the chicken-and-egg where Xero is connected but produces no
    // user-visible effect because the invoicing feature flag is still off.
    const { data: tenantRow } = await supabase
      .from('tenants')
      .select('features_enabled')
      .eq('id', tenantId)
      .single();
    if (tenantRow && tenantRow.features_enabled?.invoicing !== true) {
      await supabase
        .from('tenants')
        .update({
          features_enabled: { ...(tenantRow.features_enabled || {}), invoicing: true },
        })
        .eq('id', tenantId);
    }

    // P56 Plan 03 Task 3 — Jobber-only account-id write-back.
    // The webhook handler at /api/webhooks/jobber looks up tenants via
    // accounting_credentials.external_account_id. Without this probe + UPDATE,
    // webhook delivery in production would silently no-op on unknown accountId.
    if (provider === 'jobber') {
      const accountId = await probeJobberAccountId(tokenSet.access_token);
      if (accountId) {
        const { error: extIdErr } = await supabase
          .from('accounting_credentials')
          .update({ external_account_id: accountId })
          .eq('tenant_id', tenantId)
          .eq('provider', 'jobber');
        if (extIdErr) {
          // Migration 056 enforces a global unique index on
          // (provider, external_account_id). If another Voco tenant already has
          // this Jobber accountId connected, the UPDATE will fail with a
          // unique-violation (Postgres code 23505). Roll back the just-upserted
          // row and surface a specific error so the user understands.
          const isUniqueViolation =
            extIdErr.code === '23505' ||
            /duplicate key|unique constraint/i.test(extIdErr.message || '');
          await supabase
            .from('accounting_credentials')
            .delete()
            .eq('tenant_id', tenantId)
            .eq('provider', 'jobber');
          console.error(
            '[integrations-callback] jobber external_account_id write-back failed:',
            extIdErr.message,
          );
          const errCode = isUniqueViolation
            ? 'account_already_connected'
            : 'account_probe_failed';
          return NextResponse.redirect(
            `${process.env.NEXT_PUBLIC_APP_URL}${PAGE_URL}?error=${errCode}&provider=jobber`,
          );
        }
      } else {
        // Probe failed — roll back the just-upserted row so the user can retry
        // cleanly. Leaving tokens persisted with external_account_id = NULL would
        // show the integration as "connected" in the UI while silently dropping
        // every webhook delivery (webhook handler filters on external_account_id).
        const { error: rollbackErr } = await supabase
          .from('accounting_credentials')
          .delete()
          .eq('tenant_id', tenantId)
          .eq('provider', 'jobber');
        if (rollbackErr) {
          console.error(
            '[integrations-callback] jobber rollback after probe failure failed:',
            rollbackErr.message,
          );
        } else {
          console.error(
            '[integrations-callback] jobber account probe failed — row rolled back',
          );
        }
        return NextResponse.redirect(
          `${process.env.NEXT_PUBLIC_APP_URL}${PAGE_URL}?error=account_probe_failed&provider=jobber`,
        );
      }
    }

    revalidateTag(`integration-status-${tenantId}`);
    revalidateTag(`${provider}-context-${tenantId}`);

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

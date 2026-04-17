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

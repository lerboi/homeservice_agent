import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyOAuthState } from '@/app/api/google-calendar/auth/route';
import { getAccountingAdapter } from '@/lib/accounting/adapter';
import { PROVIDERS } from '@/lib/accounting/types';

const INTEGRATIONS_URL = '/dashboard/more/integrations';

/**
 * GET /api/accounting/[provider]/callback
 * Handles the OAuth redirect after the owner grants accounting access.
 * Exchanges the authorization code for tokens and upserts credentials.
 */
export async function GET(request, { params }) {
  const { provider } = await params;

  if (!PROVIDERS.includes(provider)) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}${INTEGRATIONS_URL}?error=unsupported_provider&provider=${provider}`
    );
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const realmId = searchParams.get('realmId'); // QuickBooks passes this as query param

  const tenantId = verifyOAuthState(state);

  if (!code || !tenantId) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}${INTEGRATIONS_URL}?error=invalid_state&provider=${provider}`
    );
  }

  try {
    const adapter = await getAccountingAdapter(provider);
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/accounting/${provider}/callback`;

    const tokenSet = await adapter.exchangeCode(code, redirectUri, { realmId });

    await supabase.from('accounting_credentials').upsert(
      {
        tenant_id: tenantId,
        provider,
        access_token: tokenSet.access_token,
        refresh_token: tokenSet.refresh_token,
        expiry_date: tokenSet.expiry_date,
        realm_id: tokenSet.realm_id || null,
        xero_tenant_id: tokenSet.xero_tenant_id || null,
        account_id: tokenSet.account_id || null,
        display_name: tokenSet.display_name || null,
        connected_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,provider' }
    );

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}${INTEGRATIONS_URL}?connected=${provider}`
    );
  } catch (err) {
    console.error(`[accounting-callback] ${provider} error:`, err);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}${INTEGRATIONS_URL}?error=connection_failed&provider=${provider}`
    );
  }
}

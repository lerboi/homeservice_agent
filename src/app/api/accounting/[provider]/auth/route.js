import { createSupabaseServer } from '@/lib/supabase-server';
import { supabase } from '@/lib/supabase';
import { signOAuthState } from '@/app/api/google-calendar/auth/route';
import { getAccountingAdapter } from '@/lib/accounting/adapter';
import { PROVIDERS } from '@/lib/accounting/types';

/**
 * GET /api/accounting/[provider]/auth
 * Returns the OAuth consent URL for connecting an accounting platform.
 * Reuses the HMAC-signed state pattern from Google Calendar OAuth.
 */
export async function GET(request, { params }) {
  const { provider } = await params;

  if (!PROVIDERS.includes(provider)) {
    return Response.json(
      { error: `Unsupported provider: "${provider}". Must be one of: ${PROVIDERS.join(', ')}` },
      { status: 400 }
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

  const adapter = await getAccountingAdapter(provider);
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/accounting/${provider}/callback`;
  const state = signOAuthState(tenant.id);
  const authUrl = adapter.getAuthUrl(state, redirectUri);

  return Response.json({ url: authUrl });
}

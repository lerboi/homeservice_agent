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

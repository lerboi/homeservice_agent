import { createSupabaseServer } from '@/lib/supabase-server.js';
import { supabase } from '@/lib/supabase.js';
import { getOutlookAuthUrl } from '@/lib/scheduling/outlook-calendar.js';
import { signOAuthState } from '@/app/api/google-calendar/auth/route.js';

/**
 * GET /api/outlook-calendar/auth
 * Returns the Microsoft OAuth consent URL for connecting an Outlook calendar.
 * Requires authentication -- only the owner can initiate OAuth.
 */
export async function GET(request) {
  const supabaseServer = await createSupabaseServer();
  const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

  if (authError || !user) {
    console.log('401: Unauthorized');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Retrieve tenant ID for the authenticated user
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('owner_id', user.id)
    .single();

  if (!tenant) {
    console.log('404: Not found');
    return Response.json({ error: 'Tenant not found' }, { status: 404 });
  }

  // Pass HMAC-signed state for CSRF protection
  const url = await getOutlookAuthUrl(signOAuthState(tenant.id));

  return Response.json({ url });
}

import { createSupabaseServer } from '@/lib/supabase-server.js';
import { createOAuth2Client } from '@/lib/scheduling/google-calendar.js';
import { supabase } from '@/lib/supabase.js';

/**
 * GET /api/google-calendar/auth
 * Returns the Google OAuth consent URL for connecting a calendar.
 * Requires authentication — only the owner can initiate OAuth.
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

  const oauth2Client = createOAuth2Client();

  // Include tenant_id as state parameter for CSRF protection and callback correlation
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    state: tenant.id,
  });

  return Response.json({ url: authUrl });
}

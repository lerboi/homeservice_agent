import crypto from 'crypto';
import { createSupabaseServer } from '@/lib/supabase-server.js';
import { createOAuth2Client } from '@/lib/scheduling/google-calendar.js';
import { supabase } from '@/lib/supabase.js';

/**
 * Sign an OAuth state parameter with HMAC to prevent CSRF / tenant spoofing.
 * @param {string} tenantId
 * @returns {string} `${tenantId}:${hmac}`
 */
export function signOAuthState(tenantId) {
  const hmac = crypto.createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY)
    .update(tenantId)
    .digest('hex');
  return `${tenantId}:${hmac}`;
}

/**
 * Verify and extract tenant ID from a signed OAuth state parameter.
 * @param {string} state
 * @returns {string|null} tenantId if valid, null if tampered
 */
export function verifyOAuthState(state) {
  if (!state || !state.includes(':')) return null;
  const [tenantId, hmac] = state.split(':');
  const expected = crypto.createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY)
    .update(tenantId)
    .digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(expected, 'hex'))) {
    return null;
  }
  return tenantId;
}

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

  // HMAC-signed state parameter for CSRF protection and callback correlation
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    state: signOAuthState(tenant.id),
  });

  return Response.json({ url: authUrl });
}

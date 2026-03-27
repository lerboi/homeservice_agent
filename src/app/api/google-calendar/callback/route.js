import { createOAuth2Client, registerWatch, syncCalendarEvents } from '@/lib/scheduling/google-calendar.js';
import { google } from 'googleapis';
import { supabase } from '@/lib/supabase.js';
import { verifyOAuthState } from '@/app/api/google-calendar/auth/route.js';

/**
 * GET /api/google-calendar/callback
 * Handles the Google OAuth redirect after the owner grants calendar access.
 *
 * Query params:
 *   - code: Authorization code from Google
 *   - state: HMAC-signed tenant ID for CSRF protection
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const rawState = searchParams.get('state');

  // Verify HMAC-signed state to prevent CSRF / tenant spoofing
  const tenantId = verifyOAuthState(rawState);

  if (!code || !tenantId) {
    console.log('400:', 'Missing code or invalid state');
    return Response.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/services?calendar=error`
    );
  }

  try {
    const oauth2Client = createOAuth2Client();

    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    const { access_token, refresh_token, expiry_date } = tokens;

    oauth2Client.setCredentials(tokens);

    // Fetch calendar display name
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    let calendarName = 'Primary Calendar';
    try {
      const calendarList = await calendar.calendarList.get({ calendarId: 'primary' });
      calendarName = calendarList.data.summary || 'Primary Calendar';
    } catch {
      // Non-critical — continue with default name
    }

    // Determine is_primary: first connected calendar becomes primary
    const { count } = await supabase
      .from('calendar_credentials')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    const isPrimary = count === 0;

    // Upsert credentials into DB
    await supabase.from('calendar_credentials').upsert(
      {
        tenant_id: tenantId,
        provider: 'google',
        access_token,
        refresh_token,
        expiry_date,
        calendar_id: 'primary',
        calendar_name: calendarName,
        is_primary: isPrimary,
      },
      { onConflict: 'tenant_id,provider' }
    );

    // Register push notification watch channel
    await registerWatch(tenantId, { access_token, refresh_token, expiry_date });

    // Perform initial full sync
    await syncCalendarEvents(tenantId);

    return Response.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/services?calendar=connected`
    );
  } catch (err) {
    console.error('[google-calendar-callback] Error:', err);
    return Response.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/services?calendar=error`
    );
  }
}

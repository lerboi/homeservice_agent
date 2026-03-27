import {
  exchangeCodeForTokens,
  createOutlookSubscription,
  syncOutlookCalendarEvents,
} from '@/lib/scheduling/outlook-calendar.js';
import { supabase } from '@/lib/supabase.js';
import { verifyOAuthState } from '@/app/api/google-calendar/auth/route.js';

/**
 * GET /api/outlook-calendar/callback
 * Handles the Microsoft OAuth redirect after the owner grants calendar access.
 *
 * Query params:
 *   - code: Authorization code from Microsoft
 *   - state: Tenant ID (passed in auth URL for CSRF protection)
 *   - error: OAuth error code (if consent was denied or admin approval required)
 *   - error_description: Human-readable error description
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const rawState = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description') || '';

  // Admin consent error detection (Pitfall 4)
  if (error) {
    const isAdminConsentError =
      error === 'consent_required' ||
      error === 'interaction_required' ||
      errorDescription.includes('AADSTS65001') ||
      errorDescription.includes('AADSTS90094');

    if (isAdminConsentError) {
      console.log('400:', 'Admin consent required');
      return Response.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/services?calendar=admin_consent`
      );
    }

    console.log('400:', 'OAuth error:', error, errorDescription);
    return Response.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/services?calendar=outlook_error`
    );
  }

  // Verify HMAC-signed state to prevent CSRF / tenant spoofing
  const tenantId = verifyOAuthState(rawState);

  if (!code || !tenantId) {
    console.log('400:', 'Missing code or invalid state');
    return Response.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/services?calendar=outlook_error`
    );
  }

  try {
    // Exchange authorization code for tokens
    const tokenResponse = await exchangeCodeForTokens(code);

    // Fetch user profile for calendar display name
    let calendarName = 'Outlook Calendar';
    try {
      const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${tokenResponse.accessToken}` },
      });
      if (profileRes.ok) {
        const profile = await profileRes.json();
        calendarName = profile.mail || profile.displayName || 'Outlook Calendar';
      }
    } catch {
      // Non-critical -- continue with default name
    }

    // Determine is_primary (D-03): first connected calendar becomes primary
    const { count } = await supabase
      .from('calendar_credentials')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    const isPrimary = count === 0;

    // Upsert credentials into DB
    await supabase.from('calendar_credentials').upsert(
      {
        tenant_id: tenantId,
        provider: 'outlook',
        access_token: tokenResponse.accessToken,
        refresh_token: tokenResponse.refreshToken,
        expiry_date: new Date(tokenResponse.expiresOn).getTime(),
        calendar_id: 'primary',
        calendar_name: calendarName,
        is_primary: isPrimary,
      },
      { onConflict: 'tenant_id,provider' }
    );

    // Register Graph subscription for push notifications
    await createOutlookSubscription(tenantId, tokenResponse.accessToken);

    // Perform initial full sync
    await syncOutlookCalendarEvents(tenantId);

    return Response.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/services?calendar=outlook_connected`
    );
  } catch (err) {
    console.error('[outlook-calendar-callback] Error:', err);
    return Response.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/services?calendar=outlook_error`
    );
  }
}

import { after } from 'next/server';
import { supabase } from '@/lib/supabase.js';
import { syncCalendarEvents } from '@/lib/scheduling/google-calendar.js';

/**
 * POST /api/webhooks/google-calendar
 * Receives push notifications from Google Calendar when watched calendar events change.
 *
 * Google requires a fast 200 response. All sync work is deferred via after().
 * Channel token is the tenant_id — set when registering the watch channel.
 */
export async function POST(request) {
  const state = request.headers.get('X-Goog-Resource-State');
  const tenantId = request.headers.get('X-Goog-Channel-Token');
  const channelId = request.headers.get('X-Goog-Channel-ID');

  console.log(`[google-webhook] Received: state=${state}, channelId=${channelId}, tenantId=${tenantId}`);

  // Handshake — acknowledge immediately
  if (state === 'sync') {
    console.log('[google-webhook] Handshake acknowledged');
    return Response.json({ ok: true });
  }

  // Validate channel is registered and use DB-sourced tenant_id (not the header)
  // to prevent forged push notifications with spoofed X-Goog-Channel-Token
  if (channelId) {
    const { data: creds } = await supabase
      .from('calendar_credentials')
      .select('tenant_id')
      .eq('watch_channel_id', channelId)
      .single();

    if (!creds) {
      // Stale or unknown channel — return 200 to stop Google retrying
      return Response.json({ ok: true });
    }

    // Use the trusted DB tenant_id for sync, not the header value
    if (state === 'exists' && creds.tenant_id) {
      const verifiedTenantId = creds.tenant_id;
      console.log(`[google-webhook] Triggering sync for tenant ${verifiedTenantId}`);
      after(async () => {
        try {
          await syncCalendarEvents(verifiedTenantId);
          console.log(`[google-webhook] Sync completed for tenant ${verifiedTenantId}`);
        } catch (err) {
          console.error(`[google-webhook] Sync FAILED for tenant ${verifiedTenantId}:`, err?.message || err);
        }
      });
    }

    return Response.json({ ok: true });
  }

  // No channelId → drop. The legacy fallback that trusted the spoofable
  // X-Goog-Channel-Token header as a tenant_id was removed (2026-06-12 audit):
  // Google push has no HMAC, so that path let anyone trigger arbitrary
  // tenants' calendar syncs. Every channel registered by registerWatch writes
  // watch_channel_id to calendar_credentials, so a legitimate notification
  // always carries a resolvable channel id. 200 keeps Google from retrying.
  return Response.json({ ok: true });
}

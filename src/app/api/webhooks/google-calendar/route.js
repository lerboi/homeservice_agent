import { after } from 'next/server';
import { supabase } from '@/lib/supabase.js';
import { handleGoogleCalendarPush } from '@/lib/webhooks/google-calendar-push.js';

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

  // Handshake — acknowledge immediately
  if (state === 'sync') {
    return Response.json({ ok: true });
  }

  // Validate that the channel is still registered (reject stale channels)
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
  }

  // Trigger async incremental sync — runs after response is sent
  if (state === 'exists' && tenantId) {
    after(async () => {
      await handleGoogleCalendarPush(request);
    });
  }

  // Always return 200 immediately — Google requires fast acknowledgment
  return Response.json({ ok: true });
}

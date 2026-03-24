import { supabase } from '@/lib/supabase.js';
import { syncOutlookCalendarEvents } from '@/lib/scheduling/outlook-calendar.js';

/**
 * Handle incoming Microsoft Graph calendar push notification.
 *
 * Graph sends a POST to /api/webhooks/outlook-calendar with a body containing
 * `value[]` array of notifications. Each notification includes:
 *   - subscriptionId: ID of the Graph subscription
 *   - clientState: secret we set during subscription creation
 *   - changeType: created | updated | deleted
 *
 * We validate clientState against OUTLOOK_WEBHOOK_SECRET, look up the tenant
 * by subscription ID, and trigger an incremental delta sync.
 *
 * @param {Object} body - Graph notification payload
 * @returns {Promise<{ ok: boolean }>}
 */
export async function handleOutlookCalendarPush(body) {
  if (!body || !body.value) return { ok: true };

  for (const notification of body.value) {
    // Validate clientState matches our secret
    if (notification.clientState !== process.env.OUTLOOK_WEBHOOK_SECRET) {
      console.warn('[outlook-webhook] Invalid clientState, skipping notification');
      continue;
    }

    // Look up tenant by subscription ID
    const { data: cred } = await supabase
      .from('calendar_credentials')
      .select('tenant_id')
      .eq('watch_channel_id', notification.subscriptionId)
      .eq('provider', 'outlook')
      .single();

    if (!cred) {
      console.warn(`[outlook-webhook] No credentials for subscription ${notification.subscriptionId}`);
      continue;
    }

    await syncOutlookCalendarEvents(cred.tenant_id);
  }

  return { ok: true };
}

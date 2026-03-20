import { syncCalendarEvents } from '@/lib/scheduling/google-calendar.js';

/**
 * Handle incoming Google Calendar push notification.
 *
 * Google sends a POST to /api/webhooks/google-calendar when calendar state changes.
 * The 'sync' state is a handshake confirmation — return immediately.
 * The 'exists' state signals a change — trigger incremental sync asynchronously.
 *
 * Note: This function performs the sync inline (not via after()) when called directly.
 * The route handler wraps this in after() so Google receives a fast 200 response.
 *
 * @param {Request} request - Incoming Next.js request object
 * @returns {Promise<{ ok: boolean }>}
 */
export async function handleGoogleCalendarPush(request) {
  const state = request.headers.get('X-Goog-Resource-State');
  const tenantId = request.headers.get('X-Goog-Channel-Token');

  // Handshake notification — acknowledge and return immediately
  if (state === 'sync') {
    return { ok: true };
  }

  // Change notification — sync the tenant's calendar mirror
  if (state === 'exists' && tenantId) {
    await syncCalendarEvents(tenantId);
  }

  return { ok: true };
}

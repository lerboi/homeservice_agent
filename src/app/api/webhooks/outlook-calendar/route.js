import { after } from 'next/server';
import { handleOutlookCalendarPush } from '@/lib/webhooks/outlook-calendar-push.js';

/**
 * POST /api/webhooks/outlook-calendar
 * Receives push notifications from Microsoft Graph when watched calendar events change.
 *
 * Graph requires a validation handshake: when creating a subscription, Graph sends
 * a POST with ?validationToken=... and expects the token back as plain text (Pitfall 1).
 *
 * For actual notifications, return 202 immediately and process async via after().
 */
export async function POST(request) {
  const { searchParams } = new URL(request.url);
  const validationToken = searchParams.get('validationToken');

  // Graph validation handshake -- MUST return plain text (Pitfall 1)
  if (validationToken) {
    return new Response(decodeURIComponent(validationToken), {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  // Actual notification processing
  const body = await request.json();

  after(async () => {
    await handleOutlookCalendarPush(body);
  });

  // Return 202 immediately -- Graph requires fast acknowledgment
  return new Response(null, { status: 202 });
}

/**
 * POST /api/admin/demo/cleanup — remove what a demo call left on the calendar.
 *
 * Admin-only. Body: { room_name }. Deletes the external calendar event the
 * call created, drops its mirrored calendar_events row and cancels the
 * appointment, so retakes do not pile up. Scope is deliberately narrow: the
 * room must be a `test-web-` room of the demo tenant and the call must be
 * flagged as a test call; nothing a real caller booked can be reached.
 */

import { verifyAdmin } from '@/lib/admin';
import { removeDemoBooking, resolveDemoTenant } from '@/lib/demo/server';
import { isDemoRoomOfTenant } from '@/lib/demo/session';

export const maxDuration = 30;

export async function POST(request) {
  const admin = await verifyAdmin();
  if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 });

  let body = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const tenant = await resolveDemoTenant(admin);
  if (!tenant) {
    return Response.json({ error: 'No demo tenant found for this admin' }, { status: 404 });
  }

  const roomName = body.room_name;
  if (!isDemoRoomOfTenant(roomName, tenant.id)) {
    return Response.json({ error: 'room_name must be a demo room of the demo tenant' }, { status: 400 });
  }

  try {
    const outcome = await removeDemoBooking(tenant.id, roomName);
    if (outcome.error) {
      return Response.json({ error: outcome.error }, { status: 400 });
    }
    return Response.json({
      found: outcome.found,
      removed: outcome.removed,
      // False when an event could not be deleted (for example the calendar
      // connection died): the page tells the owner to remove it by hand.
      clean: outcome.removed.every((r) => r.event_deleted || r.event_note === 'no_event'),
    });
  } catch (err) {
    console.error('[demo/cleanup] failed:', err);
    return Response.json({ error: 'Cleanup failed' }, { status: 500 });
  }
}

/**
 * GET /api/admin/demo/status — what the Demo Studio needs before a take.
 *
 * Admin-only. Returns the demo tenant, the tasks, each "Save to" destination
 * with its health (external calendars get a REAL token refresh, so a dead
 * connection shows up here instead of mid-recording), the test voices, and
 * any demo bookings still sitting on the calendar from earlier takes.
 */

import { verifyAdmin } from '@/lib/admin';
import { SCENARIOS } from '@/lib/demo/scenarios';
import { VOICE_OPTIONS } from '@/lib/demo/voices';
import { getDestinationStatuses, listKeptBookings, resolveDemoTenant } from '@/lib/demo/server';

export const maxDuration = 30;

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const tenant = await resolveDemoTenant(admin);
  if (!tenant) {
    return Response.json(
      { error: 'No demo tenant: the signed-in admin owns no tenant and DEMO_TENANT_ID is not set.' },
      { status: 404 },
    );
  }

  const [destinations, keptBookings] = await Promise.all([
    getDestinationStatuses(tenant.id),
    listKeptBookings(tenant.id),
  ]);

  return Response.json({
    tenant: {
      id: tenant.id,
      business_name: tenant.business_name,
      timezone: tenant.tenant_timezone || 'UTC',
      can_take_calls: Boolean(tenant.phone_number),
    },
    scenarios: SCENARIOS,
    destinations,
    voices: VOICE_OPTIONS,
    kept_bookings: keptBookings,
  });
}

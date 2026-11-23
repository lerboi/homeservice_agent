/**
 * POST /api/admin/demo/session — start a Demo Studio call.
 *
 * Admin-only. Like /api/admin/test-agent/session it creates a `test-web-`
 * LiveKit room and returns a join token for the browser microphone; the room
 * name keeps that prefix so the shared dispatch and result routes work
 * unchanged. The difference is the SERVER-SET metadata: on top of the
 * sandbox flags it carries
 *
 *   demo: { task, destination, keep_booking: true, business_name? }
 *
 * which tells the agent to push the booking to the chosen calendar and to
 * leave it there after the call. The agent honours `demo` only when
 * `test_call` is true, and still sends no SMS, bills nothing and writes no
 * CRM rows. The chosen destination is health-checked here (a real token
 * refresh) so a call cannot start against a dead calendar connection.
 */

import { RoomServiceClient, AccessToken } from 'livekit-server-sdk';
import { verifyAdmin } from '@/lib/admin';
import { getDestinationStatuses, resolveDemoTenant } from '@/lib/demo/server';
import { buildDemoRoomMetadata, buildDemoRoomName, validateDemoRequest } from '@/lib/demo/session';

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
  if (!tenant.phone_number) {
    return Response.json(
      { error: 'The demo tenant has no phone number, so the agent cannot resolve it.' },
      { status: 400 },
    );
  }

  const statuses = await getDestinationStatuses(tenant.id);
  const checked = validateDemoRequest(body, statuses);
  if (!checked.ok) {
    return Response.json({ error: checked.error }, { status: checked.status });
  }

  try {
    const roomName = buildDemoRoomName(tenant.id);
    const roomService = new RoomServiceClient(
      process.env.LIVEKIT_URL,
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
    );
    await roomService.createRoom({
      name: roomName,
      // 10-min agent watchdog cap + margin; an abandoned room self-deletes.
      emptyTimeout: 600,
      metadata: JSON.stringify(
        buildDemoRoomMetadata({
          tenant,
          task: checked.task,
          destination: checked.destination,
          voiceOverride: checked.voiceOverride,
          llm: checked.llm,
          businessName: checked.businessName,
          voiceQuality: checked.voiceQuality,
          greeting: checked.greeting,
          typingSound: checked.typingSound,
        }),
      ),
    });

    const identity = `demo-studio-${Date.now()}`;
    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      { identity, name: 'Demo Caller (Web)', ttl: '30m' },
    );
    // Join + publish mic + subscribe. No metadata/admin grants — the browser
    // can never alter the server-set room metadata.
    at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });
    const token = await at.toJwt();

    return Response.json({
      room_name: roomName,
      token,
      livekit_url: process.env.LIVEKIT_URL,
      identity,
      demo: { task: checked.task, destination: checked.destination, llm: checked.llm },
      tenant: {
        id: tenant.id,
        business_name: checked.businessName || tenant.business_name,
        timezone: tenant.tenant_timezone || 'UTC',
      },
    });
  } catch (err) {
    console.error('[demo/session] failed:', err);
    return Response.json({ error: 'Failed to create the demo session' }, { status: 500 });
  }
}

/**
 * POST /api/admin/test-agent/session — start a browser-based test call session.
 *
 * Admin-only (verifyAdmin). Creates a LiveKit room named `test-web-<tenant>-<ts>`
 * whose SERVER-SET metadata marks it as a sandboxed test call for the Python
 * agent (`{ test_call: true, web_test: true, tenant_id, to_number }` — the agent
 * resolves the tenant from to_number exactly like a phone test call, and gates
 * every real-world side effect on test_call; see livekit_agent sandbox mode).
 * Returns a short-lived join token for the admin's browser microphone.
 *
 * The room name deliberately avoids the `call-` prefix (SIP dispatch rule) and
 * the `test-call-` prefix (the LiveKit webhook flips tenants.test_call_status
 * for those) so a web test can never interfere with either flow.
 *
 * The agent is NOT dispatched here — the browser connects first, then calls
 * POST /api/admin/test-agent/dispatch, so the agent's 30s wait_for_participant
 * never races a slow tab.
 *
 * Optional `simulate_from_number` lets the admin exercise the repeat-caller /
 * caller-history path (read-only lookups). CRM writes are disabled for test
 * calls agent-side, so a simulated number can never pollute a real customer.
 */

import { verifyAdmin } from '@/lib/admin';
import { supabase } from '@/lib/supabase';
import { RoomServiceClient, AccessToken } from 'livekit-server-sdk';

export async function POST(request) {
  const admin = await verifyAdmin();
  if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 });

  let body = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const tenantId = body.tenant_id;
  if (!tenantId || typeof tenantId !== 'string') {
    return Response.json({ error: 'tenant_id is required' }, { status: 400 });
  }

  // Optional simulated caller number (E.164-ish). Strip common formatting,
  // then require + and 7-15 digits — same shape the agent's normalizer expects.
  let simulateFrom = null;
  if (body.simulate_from_number) {
    const cleaned = String(body.simulate_from_number).replace(/[\s()\-.]/g, '');
    const withPlus = cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
    if (!/^\+\d{7,15}$/.test(withPlus)) {
      return Response.json(
        { error: 'simulate_from_number must be a phone number in international format (e.g. +6591234567)' },
        { status: 400 },
      );
    }
    simulateFrom = withPlus;
  }

  const { data: tenant, error: tenantErr } = await supabase
    .from('tenants')
    .select('id, business_name, phone_number, onboarding_complete, country, default_locale')
    .eq('id', tenantId)
    .single();

  if (tenantErr || !tenant) {
    return Response.json({ error: 'Tenant not found' }, { status: 404 });
  }
  if (!tenant.phone_number) {
    // The agent resolves the tenant by to_number — without a provisioned AI
    // number there is nothing to look up and the call would run tenant-less.
    return Response.json(
      { error: 'This tenant has no AI phone number provisioned yet — the agent cannot resolve it. Provision a number first.' },
      { status: 400 },
    );
  }

  try {
    const roomName = `test-web-${tenantId}-${Date.now()}`;

    const roomService = new RoomServiceClient(
      process.env.LIVEKIT_URL,
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
    );
    await roomService.createRoom({
      name: roomName,
      // 10-min agent watchdog cap + margin; an abandoned room self-deletes.
      emptyTimeout: 600,
      metadata: JSON.stringify({
        test_call: true,
        web_test: true,
        tenant_id: tenantId,
        to_number: tenant.phone_number,
        ...(simulateFrom ? { from_number: simulateFrom } : {}),
      }),
    });

    const identity = `admin-web-tester-${Date.now()}`;
    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      { identity, name: 'Test Caller (Web)', ttl: '30m' },
    );
    // Join + publish mic + subscribe to the agent's audio. No metadata/admin
    // grants — the browser can never alter the server-set room metadata.
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
    });
    const token = await at.toJwt();

    return Response.json({
      room_name: roomName,
      token,
      livekit_url: process.env.LIVEKIT_URL,
      identity,
      tenant: {
        id: tenant.id,
        business_name: tenant.business_name,
        phone_number: tenant.phone_number,
        onboarding_complete: tenant.onboarding_complete,
      },
    });
  } catch (err) {
    console.error('test-agent session failed:', err);
    return Response.json({ error: 'Failed to create test session' }, { status: 500 });
  }
}

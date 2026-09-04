/**
 * POST /api/admin/test-agent/dispatch — dispatch the voice agent into a web
 * test room.
 *
 * Admin-only (verifyAdmin). The worker registers with agent_name
 * "voco-voice-agent", which disables automatic dispatch — an explicit
 * AgentDispatchClient.createDispatch is the only way the agent joins a
 * non-SIP room. Called by the admin test console AFTER the browser has
 * connected, so the agent's wait_for_participant resolves immediately
 * (no 30s timeout race against a slow tab).
 *
 * Only `test-web-` rooms are dispatchable through this route so it can never
 * be used to inject a second agent into a live production call room.
 */

import { verifyAdmin } from '@/lib/admin';
import { AgentDispatchClient } from 'livekit-server-sdk';

const AGENT_NAME = 'voco-voice-agent';

// Vercel function budget: the LiveKit Cloud API + Supabase round-trips must
// finish before the platform's default 10 s cutoff (a timeout surfaces to the
// browser as an HTML error page, not JSON). 30 s is within the Hobby limit.
export const maxDuration = 30;

export async function POST(request) {
  const _t0 = Date.now();
  const _log = (step) => console.log(`[test-agent/dispatch] ${step} +${Date.now() - _t0}ms`);

  const admin = await verifyAdmin();
  if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 });

  let body = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const roomName = body.room_name;
  if (!roomName || typeof roomName !== 'string' || !roomName.startsWith('test-web-')) {
    return Response.json({ error: 'room_name must be a test-web-* room' }, { status: 400 });
  }

  try {
    const dispatchClient = new AgentDispatchClient(
      process.env.LIVEKIT_URL,
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
    );
    const dispatch = await dispatchClient.createDispatch(roomName, AGENT_NAME);
    _log('dispatch created');
    return Response.json({ dispatch_id: dispatch?.id || null, agent_name: AGENT_NAME });
  } catch (err) {
    console.error(`test-agent dispatch failed after ${Date.now() - _t0}ms:`, err);
    return Response.json({ error: 'Failed to dispatch agent' }, { status: 500 });
  }
}

/**
 * LiveKit webhook — confirms a test call ACTUALLY CONNECTED.
 *
 * The "Test My AI" button (TestCallPanel) → POST /api/onboarding/test-call places
 * an outbound SIP call to the owner's phone in a room named
 * `test-call-<tenantId>-<ts>` (metadata `{ test_call, tenant_id, to_number }`)
 * and sets tenants.test_call_status = 'calling'. This endpoint listens for the
 * LiveKit `participant_joined` event: when the owner's SIP leg
 * (identity `caller-<phone>`, set by the trigger route; ParticipantInfo_Kind.SIP
 * === 3) joins that room, the call genuinely connected — so we flip
 * tenants.test_call_completed = true (which gates the setup checklist's
 * "Make a test call" item), test_call_status = 'connected', and test_call_last_at.
 *
 * Security
 *  - LiveKit signs each delivery with a JWT in the `Authorization` header whose
 *    `sha256` claim must match the raw body. `WebhookReceiver.receive()` verifies
 *    this with the project API key/secret. The raw body MUST be read via
 *    `request.text()` BEFORE any parse — re-stringifying would break the hash.
 *  - 401 on bad/missing signature; 200 on every irrelevant event (so LiveKit's
 *    at-least-once delivery doesn't retry forever); 500 only on a DB write
 *    failure so it retries — the UPDATE is idempotent.
 *
 * Deployment: the webhook URL MUST be registered in the LiveKit project config
 *   - LiveKit Cloud: Project → Settings → Webhooks
 *   - self-hosted: `webhook.urls` in config.yaml
 * pointing at https://<your-domain>/api/webhooks/livekit. Without it, test calls
 * never auto-complete (the owner can still "Mark done" on the checklist).
 */

import { WebhookReceiver } from 'livekit-server-sdk';
import { supabase } from '@/lib/supabase';

// Webhook delivery is inherently dynamic; never cache.
export const dynamic = 'force-dynamic';

// ParticipantInfo_Kind.SIP — @livekit/protocol enum value (verified v2.15).
const PARTICIPANT_KIND_SIP = 3;

/**
 * Resolve the tenant id from a `test-call-*` room. Prefer the JSON metadata
 * (`{ tenant_id }`) the trigger route sets; fall back to parsing the room name
 * `test-call-<uuid>-<ts>` (the uuid contains hyphens, the ts is trailing digits).
 */
function resolveTenantId(room) {
  if (room?.metadata) {
    try {
      const meta = JSON.parse(room.metadata);
      if (meta && typeof meta.tenant_id === 'string' && meta.tenant_id) {
        return meta.tenant_id;
      }
    } catch {
      /* metadata not JSON — fall through to name parse */
    }
  }
  if (typeof room?.name === 'string') {
    const m = room.name.match(/^test-call-(.+)-\d+$/);
    if (m) return m[1];
  }
  return null;
}

export async function POST(request) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!apiKey || !apiSecret) {
    console.error('LiveKit webhook: missing LIVEKIT_API_KEY/LIVEKIT_API_SECRET');
    return Response.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  // Raw body + Authorization header → verify the signed payload.
  const body = await request.text();
  const authHeader = request.headers.get('authorization') || undefined;

  let event;
  try {
    const receiver = new WebhookReceiver(apiKey, apiSecret);
    event = await receiver.receive(body, authHeader);
  } catch (err) {
    console.error('LiveKit webhook: signature verification failed:', err?.message);
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // Only the owner's SIP leg joining a test-call room marks a genuine connect.
  if (event?.event !== 'participant_joined') {
    return Response.json({ received: true });
  }

  const room = event.room;
  const participant = event.participant;
  const isTestRoom =
    typeof room?.name === 'string' && room.name.startsWith('test-call-');
  // identity `caller-<phone>` is set by /api/onboarding/test-call; kind === SIP
  // is the secondary signal. The agent participant fails both, so it's ignored.
  const isOwnerLeg =
    (typeof participant?.identity === 'string' &&
      participant.identity.startsWith('caller-')) ||
    participant?.kind === PARTICIPANT_KIND_SIP;

  if (!isTestRoom || !isOwnerLeg) {
    return Response.json({ received: true });
  }

  const tenantId = resolveTenantId(room);
  if (!tenantId) {
    console.warn('LiveKit webhook: test-call connect with no resolvable tenant:', room?.name);
    return Response.json({ received: true });
  }

  const { error } = await supabase
    .from('tenants')
    .update({
      test_call_completed: true,
      test_call_status: 'connected',
      test_call_last_at: new Date().toISOString(),
    })
    .eq('id', tenantId);

  if (error) {
    console.error('LiveKit webhook: tenant update failed:', error.message);
    // Non-2xx → LiveKit retries; the UPDATE is idempotent.
    return Response.json({ error: 'Update failed' }, { status: 500 });
  }

  return Response.json({ received: true, tenant_id: tenantId, status: 'connected' });
}

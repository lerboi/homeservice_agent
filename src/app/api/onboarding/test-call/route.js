import { getTenantId } from '@/lib/get-tenant-id';
import { supabase } from '@/lib/supabase';
import { SipClient, RoomServiceClient, AgentDispatchClient } from 'livekit-server-sdk';

export async function POST(request) {
  const tenantId = await getTenantId();
  if (!tenantId) {
    console.log('401: Unauthorized');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: tenant } = await supabase
    .from('tenants')
    .select('phone_number, owner_phone, business_name, tone_preset')
    .eq('id', tenantId)
    .single();

  if (!tenant?.phone_number || !tenant?.owner_phone) {
    console.log('400:', 'Phone numbers not configured');
    return Response.json({ error: 'Phone numbers not configured' }, { status: 400 });
  }

  try {
    const roomName = `test-call-${tenantId}-${Date.now()}`;

    // Create a room with metadata so the agent knows it's a test call
    const roomService = new RoomServiceClient(
      process.env.LIVEKIT_URL,
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
    );
    await roomService.createRoom({
      name: roomName,
      metadata: JSON.stringify({
        test_call: true,
        tenant_id: tenantId,
        to_number: tenant.phone_number,
      }),
    });

    // Explicitly dispatch the voice agent into the room BEFORE dialing the
    // owner. The worker registers with agent_name "voco-voice-agent", which
    // disables automatic dispatch — and outbound SIP participants don't go
    // through the inbound SIP dispatch rule, so without this the owner's
    // phone connected to an agent-less room (silence).
    const dispatchClient = new AgentDispatchClient(
      process.env.LIVEKIT_URL,
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
    );
    await dispatchClient.createDispatch(roomName, 'voco-voice-agent');

    // Initiate outbound call to owner's phone via LiveKit SIP
    const sipClient = new SipClient(
      process.env.LIVEKIT_URL,
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
    );
    await sipClient.createSipParticipant(
      process.env.LIVEKIT_SIP_OUTBOUND_TRUNK_ID,
      tenant.owner_phone,
      roomName,
      {
        participantIdentity: `caller-${tenant.owner_phone}`,
        participantName: 'Test Caller',
      },
    );

    // Mark the attempt as in-flight. The LiveKit `participant_joined` webhook
    // (/api/webhooks/livekit) flips this to 'connected' + test_call_completed
    // once the owner's phone actually joins the room — i.e. the call truly
    // connected, not merely that we placed it.
    await supabase
      .from('tenants')
      .update({ test_call_status: 'calling' })
      .eq('id', tenantId);

    return Response.json({ call_id: roomName });
  } catch (err) {
    console.error('Test call failed:', err);
    return Response.json({ error: 'Test call failed' }, { status: 500 });
  }
}

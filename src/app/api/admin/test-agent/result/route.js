/**
 * GET /api/admin/test-agent/result?room=test-web-... — post-call results for a
 * web test call.
 *
 * Admin-only (verifyAdmin). Returns the flagged calls row (transcript, triage,
 * booking outcome) plus a server-side signed URL for the MP4 recording. The
 * signed URL MUST be minted here with the service-role client — the dashboard
 * flyouts sign storage URLs with the user's own browser session, which is
 * RLS-scoped to their tenant folder; an admin testing an arbitrary tenant has
 * no such storage grant.
 *
 * The recording lands asynchronously (LiveKit egress uploads after the room
 * closes), so recording_url may be null for the first few seconds — the
 * console polls until it appears.
 */

import { verifyAdmin } from '@/lib/admin';
import { supabase } from '@/lib/supabase';

export async function GET(request) {
  const admin = await verifyAdmin();
  if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const room = searchParams.get('room');
  if (!room || !room.startsWith('test-web-')) {
    return Response.json({ error: 'room must be a test-web-* room name' }, { status: 400 });
  }

  const { data: call, error } = await supabase
    .from('calls')
    .select(
      'id, call_id, status, booking_outcome, urgency_classification, triage_layer_used, ' +
      'detected_language, disconnection_reason, start_timestamp, end_timestamp, ' +
      'duration_seconds, transcript_text, transcript_structured, recording_storage_path, is_test_call'
    )
    .eq('call_id', room)
    .maybeSingle();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  if (!call) {
    // The agent's background db_task may not have inserted the row yet.
    return Response.json({ call: null, recording_url: null });
  }
  if (!call.is_test_call) {
    // Defense-in-depth: this surface only ever serves flagged test calls.
    return Response.json({ error: 'Not a test call' }, { status: 400 });
  }

  let recordingUrl = null;
  if (call.recording_storage_path) {
    const { data: signed } = await supabase.storage
      .from('call-recordings')
      .createSignedUrl(call.recording_storage_path, 3600, {
        download: `${call.call_id}.mp4`,
      });
    recordingUrl = signed?.signedUrl || null;
  }

  return Response.json({ call, recording_url: recordingUrl });
}

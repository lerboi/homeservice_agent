import { supabase } from '@/lib/supabase';
import { getTenantId } from '@/lib/get-tenant-id';

export async function GET(request) {
  const tenantId = await getTenantId();
  if (!tenantId) {
    console.log('401: Unauthorized');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');
  const urgency = searchParams.get('urgency');
  const bookingOutcome = searchParams.get('booking_outcome');
  const search = searchParams.get('search');
  const callStatus = searchParams.get('status');

  let query = supabase
    .from('calls')
    .select(`
      id, call_id, from_number, to_number, direction, status,
      disconnection_reason, start_timestamp, end_timestamp, duration_seconds,
      recording_url, recording_storage_path, detected_language, language_barrier,
      urgency_classification, urgency_confidence, triage_layer_used,
      booking_outcome, exception_reason, notification_priority,
      recovery_sms_status, created_at
    `)
    .eq('tenant_id', tenantId);

  if (callStatus) query = query.eq('status', callStatus);
  if (urgency) query = query.eq('urgency_classification', urgency);
  if (bookingOutcome) query = query.eq('booking_outcome', bookingOutcome);
  if (dateFrom) query = query.gte('created_at', dateFrom);
  if (dateTo) query = query.lte('created_at', dateTo);
  if (search) query = query.ilike('from_number', `%${search}%`);

  query = query.order('created_at', { ascending: false }).limit(200);

  const { data, error } = await query;
  if (error) {
    console.log('500:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ calls: data });
}

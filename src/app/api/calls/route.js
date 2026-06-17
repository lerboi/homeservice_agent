import { supabase } from '@/lib/supabase';
import { getTenantId } from '@/lib/get-tenant-id';
import { escapeOrTerm } from '@/lib/search-filter';

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
      recovery_sms_status, created_at,
      routing_mode, outbound_dial_duration_sec,
      transcript_text, transcript_structured
    `)
    .eq('tenant_id', tenantId);

  if (callStatus) query = query.eq('status', callStatus);
  if (urgency) query = query.eq('urgency_classification', urgency);
  if (bookingOutcome) query = query.eq('booking_outcome', bookingOutcome);
  if (dateFrom) query = query.gte('created_at', dateFrom);
  if (dateTo) query = query.lte('created_at', dateTo);
  if (search) {
    const s = escapeOrTerm(search.trim().slice(0, 100));
    // calls has no caller-name column — resolve names via the tenant's customers,
    // then OR their phone numbers into the from_number filter.
    const { data: nameMatches } = await supabase
      .from('customers')
      .select('phone_e164')
      .eq('tenant_id', tenantId)
      .ilike('name', `%${s}%`)
      .limit(50);
    const phones = (nameMatches ?? [])
      .map((c) => String(c.phone_e164 ?? '').replace(/[",()\\]/g, ''))
      .filter(Boolean);
    const orTerms = [`from_number.ilike.%${s}%`];
    if (phones.length > 0) {
      orTerms.push(`from_number.in.(${phones.map((p) => `"${p}"`).join(',')})`);
    }
    query = query.or(orTerms.join(','));
  }

  const limit = Math.min(parseInt(searchParams.get('limit') || '200', 10), 500);
  query = query.order('created_at', { ascending: false }).limit(limit);

  const { data, error } = await query;
  if (error) {
    console.log('500:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ calls: data });
}

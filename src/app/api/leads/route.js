import { supabase } from '@/lib/supabase';
import { createSupabaseServer } from '@/lib/supabase-server';

async function getTenantId() {
  const serverSupabase = await createSupabaseServer();
  const { data: { user } } = await serverSupabase.auth.getUser();
  if (!user) return null;
  return user.user_metadata?.tenant_id || null;
}

export async function GET(request) {
  const tenantId = await getTenantId();
  if (!tenantId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const urgency = searchParams.get('urgency');
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');
  const search = searchParams.get('search');
  const jobType = searchParams.get('job_type');

  // Build query — join calls via lead_calls junction for urgency/recording data
  // DO NOT select transcript_text (performance per RESEARCH.md Pitfall 4)
  let query = supabase
    .from('leads')
    .select(`
      id, tenant_id, from_number, caller_name, job_type, service_address,
      urgency, status, revenue_amount, primary_call_id, appointment_id,
      created_at, updated_at,
      lead_calls(
        calls(id, urgency_classification, urgency_confidence, recording_url, duration_seconds, start_timestamp)
      )
    `)
    .eq('tenant_id', tenantId);

  if (status) query = query.eq('status', status);
  if (urgency) query = query.eq('urgency', urgency);
  if (dateFrom) query = query.gte('created_at', dateFrom);
  if (dateTo) query = query.lte('created_at', dateTo);
  if (jobType) query = query.eq('job_type', jobType);
  if (search) query = query.or(`caller_name.ilike.%${search}%,from_number.ilike.%${search}%`);

  query = query.order('created_at', { ascending: false }).limit(100);

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ leads: data });
}

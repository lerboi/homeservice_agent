import { supabase } from '@/lib/supabase';

export async function GET(request) {
  // Auth guard — same pattern as other crons
  if (!process.env.CRON_SECRET) {
    return Response.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  const authHeader = request.headers.get('authorization');
  if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Find calls stuck in 'started' status for over 2 hours
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const { data: orphaned, error: queryError } = await supabase
    .from('calls')
    .select('id, tenant_id, call_id')
    .eq('status', 'started')
    .lt('created_at', twoHoursAgo)
    .limit(50);

  if (queryError) {
    console.error('[cron-cleanup] Query error:', queryError.message);
    return Response.json({ error: queryError.message }, { status: 500 });
  }

  if (!orphaned || orphaned.length === 0) {
    return Response.json({ ok: true, cleaned: 0 });
  }

  const ids = orphaned.map((c) => c.id);

  const { error: updateError } = await supabase
    .from('calls')
    .update({
      status: 'failed',
      disconnection_reason: 'orphaned',
      booking_outcome: 'not_attempted',
    })
    .in('id', ids);

  if (updateError) {
    console.error('[cron-cleanup] Update error:', updateError.message);
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  console.log(`[cron-cleanup] Cleaned ${ids.length} orphaned call(s)`);
  return Response.json({ ok: true, cleaned: ids.length });
}

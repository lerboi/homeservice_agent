import { supabase } from '@/lib/supabase';

/**
 * GET /api/cron/cleanup-rate-limits
 *
 * Deletes rate_limit_hits rows older than 1 day. The durable rate limiter
 * (migration 065) accumulates one row per (bucket, key, window); these are
 * disposable once their window has long passed. Runs daily.
 *
 * Gated on Bearer ${CRON_SECRET}, same as other crons.
 */
export async function GET(request) {
  if (!process.env.CRON_SECRET) {
    return Response.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  const authHeader = request.headers.get('authorization');
  if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from('rate_limit_hits')
    .delete()
    .lt('window_start', oneDayAgo);

  if (error) {
    console.error('[cron-cleanup-rate-limits] Delete error:', error.message);
    return Response.json({ error: 'cleanup_failed' }, { status: 500 });
  }

  return Response.json({ ok: true });
}

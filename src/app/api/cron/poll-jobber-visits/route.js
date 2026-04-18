// Phase 57 — Jobber schedule mirror poll-fallback cron (JOBSCHED-03, D-15).
// Runs every 15 minutes (vercel.json). Webhooks are primary; this is gap-fill.
//
// Cursor: accounting_credentials.jobber_last_schedule_poll_at — DEDICATED to
// this path. Phase 56 customer-context fetches own last_context_fetch_at;
// overloading would silently lose visits updated between a customer-context
// fetch and the next poll.

import { createClient } from '@supabase/supabase-js';
import { applyJobberVisit } from '@/lib/scheduling/jobber-schedule-mirror';
import { fetchJobberVisits } from '@/lib/integrations/jobber';

const PAST_DAYS = 90;
const FUTURE_DAYS = 180;
const MS_PER_DAY = 86_400_000;

export async function GET(request) {
  if (!process.env.CRON_SECRET) {
    return Response.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const { data: creds } = await admin
    .from('accounting_credentials')
    .select('*')
    .eq('provider', 'jobber');

  const windowStart = new Date(Date.now() - PAST_DAYS * MS_PER_DAY).toISOString();
  const windowEnd = new Date(Date.now() + FUTURE_DAYS * MS_PER_DAY).toISOString();

  const results = [];

  for (const cred of creds ?? []) {
    try {
      // First-run fallback: 1 hour back if cursor unset.
      const since = cred.jobber_last_schedule_poll_at
        ?? new Date(Date.now() - 3600 * 1000).toISOString();

      let cursor = null;
      let count = 0;
      do {
        const { visits, pageInfo } = await fetchJobberVisits({
          cred,
          windowStart,
          windowEnd,
          updatedAfter: since,
          after: cursor,
          first: 100,
        });
        for (const visit of visits ?? []) {
          // Client.name is scalar on the live Jobber schema.
          const clientName = visit.job?.client?.name ?? null;
          await applyJobberVisit({
            admin,
            tenantId: cred.tenant_id,
            visit,
            bookableUserIds: cred.jobber_bookable_user_ids ?? null,
            clientName,
          });
          count += 1;
        }
        cursor = pageInfo?.hasNextPage ? pageInfo.endCursor : null;
      } while (cursor);

      // Pitfall 4: cursor advances ONLY after every visit in the page-loop has
      // landed. If a partial-failure leaves the loop early, the cursor stays
      // and the next poll re-replays the same delta (idempotent via upsert).
      await admin
        .from('accounting_credentials')
        .update({ jobber_last_schedule_poll_at: new Date().toISOString() })
        .eq('id', cred.id);

      results.push({ tenant_id: cred.tenant_id, visits_applied: count, status: 'ok' });
    } catch {
      console.error(JSON.stringify({
        scope: 'cron-poll-jobber-visits',
        tenant_id: cred.tenant_id,
        status: 'error',
      }));
      results.push({ tenant_id: cred.tenant_id, status: 'error' });
      // Per-tenant isolation — continue to next tenant.
    }
  }

  return Response.json({ tenants_polled: creds?.length ?? 0, results });
}

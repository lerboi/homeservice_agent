// Phase 57 — Manual Jobber resync endpoint (debugging / "force refresh" button).
// Same diff-sync semantics as the bookable-users PATCH path: nuke calendar_events
// jobber rows for the tenant, then re-fetch the P90/F180 window with the current
// bookable-set.

import { createClient } from '@supabase/supabase-js';
import { getTenantId } from '@/lib/get-tenant-id';
import { fetchJobberVisits } from '@/lib/integrations/jobber';
import { rebuildJobberMirror } from '@/lib/scheduling/jobber-schedule-mirror';

function fetchVisitsPage({ cred, windowStart, windowEnd, after }) {
  return fetchJobberVisits({ cred, windowStart, windowEnd, after, first: 100 });
}

export async function POST() {
  const tenantId = await getTenantId();
  if (!tenantId) return new Response('Unauthorized', { status: 401 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const { data: cred } = await admin
    .from('accounting_credentials')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('provider', 'jobber')
    .maybeSingle();
  if (!cred) return new Response('Not connected', { status: 404 });

  const { inserted } = await rebuildJobberMirror({ admin, cred, fetchVisitsPage });
  return Response.json({ ok: true, inserted });
}

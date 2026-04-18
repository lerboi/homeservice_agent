// Phase 57 — Jobber bookable-users picker API (JOBSCHED-04, D-01/D-04).
//
// GET   → list users from Jobber + 30-day-active flag, plus current selection
// PATCH → persist selection, then synchronously rebuild calendar_events mirror

import { createClient } from '@supabase/supabase-js';
import { getTenantId } from '@/lib/get-tenant-id';
import { fetchJobberUsersWithRecentActivity, fetchJobberVisits } from '@/lib/integrations/jobber';
import { rebuildJobberMirror } from '@/lib/scheduling/jobber-schedule-mirror';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

function fetchVisitsPage({ cred, windowStart, windowEnd, after }) {
  return fetchJobberVisits({ cred, windowStart, windowEnd, after, first: 100 });
}

export async function GET() {
  const tenantId = await getTenantId();
  if (!tenantId) return new Response('Unauthorized', { status: 401 });

  const admin = adminClient();
  const { data: cred } = await admin
    .from('accounting_credentials')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('provider', 'jobber')
    .maybeSingle();
  if (!cred) return Response.json({ users: [], selected: null }, { status: 404 });

  const users = await fetchJobberUsersWithRecentActivity({ cred });
  return Response.json({ users, selected: cred.jobber_bookable_user_ids });
}

export async function PATCH(request) {
  const tenantId = await getTenantId();
  if (!tenantId) return new Response('Unauthorized', { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }
  const userIds = body?.userIds;
  if (!Array.isArray(userIds)) {
    return new Response('userIds must be array', { status: 400 });
  }
  if (userIds.some((id) => typeof id !== 'string')) {
    return new Response('userIds must be strings', { status: 400 });
  }
  if (userIds.length > 200) {
    return new Response('too many userIds', { status: 400 });
  }

  const admin = adminClient();
  const { data: cred } = await admin
    .from('accounting_credentials')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('provider', 'jobber')
    .maybeSingle();
  if (!cred) return new Response('Not connected', { status: 404 });

  await admin
    .from('accounting_credentials')
    .update({ jobber_bookable_user_ids: userIds })
    .eq('id', cred.id);

  const updatedCred = { ...cred, jobber_bookable_user_ids: userIds };
  const { inserted } = await rebuildJobberMirror({
    admin,
    cred: updatedCred,
    fetchVisitsPage,
  });

  return Response.json({ ok: true, inserted });
}

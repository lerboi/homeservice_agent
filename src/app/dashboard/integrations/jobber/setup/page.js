// Phase 57 — post-OAuth setup page for Jobber. Owner picks which team
// members' visits should block Voco availability. Solo accounts auto-skip
// server-side (D-02): write the single user, run initial mirror rebuild,
// redirect to integrations card.

import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { getTenantId } from '@/lib/get-tenant-id';
import { fetchJobberUsersWithRecentActivity, fetchJobberVisits } from '@/lib/integrations/jobber';
import { rebuildJobberMirror } from '@/lib/scheduling/jobber-schedule-mirror';
import { BookableUsersPicker } from '@/components/dashboard/BookableUsersPicker';

function fetchVisitsPage({ cred, windowStart, windowEnd, after }) {
  return fetchJobberVisits({ cred, windowStart, windowEnd, after, first: 100 });
}

export default async function JobberSetupPage() {
  const tenantId = await getTenantId();
  if (!tenantId) redirect('/auth/signin');

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
  if (!cred) redirect('/dashboard/more/integrations');

  const users = await fetchJobberUsersWithRecentActivity({ cred });

  // Solo auto-skip (D-02). Empty list (zero users) renders the empty state in
  // the picker rather than auto-skipping — guards against treating an API hiccup
  // as a "solo account".
  if (users.length === 1) {
    await admin
      .from('accounting_credentials')
      .update({ jobber_bookable_user_ids: [users[0].id] })
      .eq('id', cred.id);
    const updatedCred = { ...cred, jobber_bookable_user_ids: [users[0].id] };
    await rebuildJobberMirror({ admin, cred: updatedCred, fetchVisitsPage });
    redirect('/dashboard/more/integrations?jobber=connected');
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-lg font-medium mb-4">Connect Jobber — team members</h1>
      <BookableUsersPicker
        users={users}
        initialSelected={cred.jobber_bookable_user_ids}
      />
    </div>
  );
}

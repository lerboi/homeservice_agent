import { verifyAdmin } from '@/lib/admin';
import { supabase } from '@/lib/supabase';

const PAGE_SIZE = 25;

export async function GET(request) {
  const admin = await verifyAdmin();
  if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '0');
  const search = searchParams.get('search') || '';

  let query = supabase
    .from('tenants')
    .select(
      `
      id, business_name, owner_name, country, retell_phone_number,
      onboarding_complete, provisioning_failed, created_at,
      subscriptions(plan_id, status, is_current)
    `,
      { count: 'exact' }
    )
    .order('created_at', { ascending: false });

  if (search) {
    query = query.or(`business_name.ilike.%${search}%,owner_name.ilike.%${search}%`);
  }

  query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

  const { data, error, count } = await query;

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Post-process: extract current subscription from the joined array
  const tenants = (data || []).map((t) => {
    const currentSub = (t.subscriptions || []).find((s) => s.is_current === true);
    return {
      ...t,
      plan_id: currentSub?.plan_id || null,
      subscription_status: currentSub?.status || null,
      subscriptions: undefined, // remove raw join data
    };
  });

  return Response.json({ data: tenants, total: count, page, pageSize: PAGE_SIZE });
}

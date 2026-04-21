/**
 * GET /api/customers/[id]/merge-preview?target_id=<uuid>
 * Phase 59 Plan 07 — preflight merge count preview (T-59-07-03)
 *
 * Returns row counts for source customer that will move on merge.
 * Validates both source + target belong to caller's tenant before counting.
 * T-59-07-03: preflight verifies tenant ownership to prevent cross-tenant count leak.
 */

import { NextResponse } from 'next/server';
import { getTenantId } from '@/lib/get-tenant-id';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function GET(request, { params }) {
  const tenantId = await getTenantId();
  if (!tenantId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id: sourceId } = await params;
  const { searchParams } = new URL(request.url);
  const targetId = searchParams.get('target_id');

  if (!targetId) {
    return NextResponse.json({ error: 'target_id_required' }, { status: 400 });
  }

  const supabase = await createSupabaseServer();

  // T-59-07-03: verify both customers belong to caller's tenant
  const [{ data: source }, { data: target }] = await Promise.all([
    supabase
      .from('customers')
      .select('id')
      .eq('id', sourceId)
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    supabase
      .from('customers')
      .select('id')
      .eq('id', targetId)
      .eq('tenant_id', tenantId)
      .maybeSingle(),
  ]);

  if (!source || !target) {
    return NextResponse.json({ error: 'not_found_or_cross_tenant' }, { status: 404 });
  }

  // Count rows that would move on merge
  const [jobsRes, inquiriesRes, invoicesRes, callsRes] = await Promise.all([
    supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', sourceId),
    supabase
      .from('inquiries')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', sourceId),
    // invoices are linked via job_id; count jobs with invoices
    supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .in(
        'job_id',
        // subquery-style: get job ids for this customer then count invoices
        // Supabase JS doesn't support sub-selects in count — use separate jobs query
        ['__placeholder__'] // replaced below
      ),
    supabase
      .from('customer_calls')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', sourceId),
  ]);

  // Re-fetch job ids to properly count invoices
  const { data: jobIds } = await supabase
    .from('jobs')
    .select('id')
    .eq('customer_id', sourceId);

  let invoiceCount = 0;
  if (jobIds && jobIds.length > 0) {
    const { count: invCount } = await supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .in('job_id', jobIds.map((j) => j.id));
    invoiceCount = invCount ?? 0;
  }

  return NextResponse.json({
    counts: {
      jobs: jobsRes.count ?? 0,
      inquiries: inquiriesRes.count ?? 0,
      invoices: invoiceCount,
      call_recordings: callsRes.count ?? 0,
    },
  });
}

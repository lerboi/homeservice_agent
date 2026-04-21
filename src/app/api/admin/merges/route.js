/**
 * GET /api/admin/merges
 * Phase 59 Plan 07 — D-19 expanded: Admin Merges view API
 *
 * Returns customer_merge_audit rows for caller's tenant, joined with source + target
 * customer names. Retained forever — shows all rows regardless of undo status.
 *
 * Query params:
 *   ?active=1       → filter to unmerged_at IS NULL only
 *   ?focus=<uuid>   → filter to rows where source OR target = <uuid>
 *   ?count_only=1   → returns {count: N} only (used by CustomerDetailHeader overflow preflight)
 *
 * T-59-07-07: Scoped to caller's tenant via getTenantId(). RLS on audit table is belt+suspenders.
 * T-59-07-08: Accepted — soft-deleted customer names shown within same tenant (no cross-tenant leak).
 * T-59-07-09: Accepted — any authenticated tenant owner sees their own merge history (no sub-role in V1).
 *
 * merged_by_email: resolved via service-role admin.listUsers lookup if possible.
 * If the helper doesn't exist, returns merged_by_email: null (documented follow-up).
 *
 * Source customers may be soft-deleted (merged_into NOT NULL). Service-role client bypasses
 * RLS so soft-deleted rows are still included in the join — intentional for full audit history.
 */

import { NextResponse } from 'next/server';
import { getTenantId } from '@/lib/get-tenant-id';
import { supabase as svc } from '@/lib/supabase';

export async function GET(request) {
  const tenantId = await getTenantId();
  if (!tenantId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get('active') === '1';
  const focus = searchParams.get('focus');
  const countOnly = searchParams.get('count_only') === '1';

  try {
    // Use service-role client to resolve soft-deleted customer names (T-59-07-08 accepted).
    // RLS on customer_merge_audit uses tenant_own policy; service-role bypasses for admin read.
    let q = svc
      .from('customer_merge_audit')
      .select(
        `
        id,
        merged_at,
        unmerged_at,
        row_counts,
        merged_by,
        source_customer:customers!customer_merge_audit_source_customer_id_fkey(id, name, phone_e164),
        target_customer:customers!customer_merge_audit_target_customer_id_fkey(id, name, phone_e164)
        `,
        { count: 'exact' }
      )
      .eq('tenant_id', tenantId)
      .order('merged_at', { ascending: false });

    if (activeOnly) {
      q = q.is('unmerged_at', null);
    }

    if (focus) {
      q = q.or(`source_customer_id.eq.${focus},target_customer_id.eq.${focus}`);
    }

    if (countOnly) {
      const { count, error } = await q.limit(0);
      if (error) throw error;
      return NextResponse.json({ count: count ?? 0 });
    }

    q = q.limit(100);

    const { data, error, count } = await q;
    if (error) throw error;

    // merged_by_email resolution:
    // The service-role client exposes supabase.auth.admin.listUsersById() in @supabase/supabase-js v2.
    // However this is a batch call; for V1 we return null to avoid N+1 requests on list load.
    // Follow-up: add a /api/admin/user-email?id=<uuid> helper or cache user emails locally.
    const merges = (data ?? []).map((row) => ({
      ...row,
      merged_by_email: null, // TODO(follow-up): resolve via service-role auth admin API
    }));

    return NextResponse.json({ merges, count: count ?? merges.length });
  } catch (err) {
    console.error('[api/admin/merges] GET error:', String(err?.message ?? err));
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

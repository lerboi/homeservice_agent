/**
 * POST /api/customers/[id]/unmerge
 * Phase 59 Plan 04 — Customer unmerge endpoint (D-19 7-day undo).
 *
 * No request body required.
 * Response 200: { source_id, restored_from, audit_id }
 * Response 404: source is not in a merged state
 * Response 410: merge window expired (> 7 days ago)
 *
 * D-02a: Zero legacy leads/lead_calls references.
 */

import { NextResponse } from 'next/server';
import { getTenantId } from '@/lib/get-tenant-id';
import { unmergeCustomer } from '@/lib/customers';

export async function POST(request, { params }) {
  const tenantId = await getTenantId();
  if (!tenantId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const result = await unmergeCustomer({ tenantId, sourceId: id });
    return NextResponse.json(result); // includes audit_id (D-19 expanded)
  } catch (err) {
    const msg = String(err?.message ?? err);
    if (msg.includes('not_merged')) {
      return NextResponse.json({ error: 'not_merged' }, { status: 404 });
    }
    if (msg.includes('merge_window_expired')) {
      // 410 Gone — clear semantics for 7-day rule expiry
      return NextResponse.json({ error: 'merge_window_expired' }, { status: 410 });
    }
    console.error('[api/customers/[id]/unmerge] POST error:', msg);
    return NextResponse.json({ error: 'unmerge_failed', detail: msg }, { status: 500 });
  }
}

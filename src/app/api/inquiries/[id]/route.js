/**
 * GET /api/inquiries/[id]  — inquiry detail with joined customer
 * PATCH /api/inquiries/[id] — update status (open ↔ lost only)
 *
 * Phase 59 Plan 04.
 * D-10: 'converted' status is NOT patchable — use POST /api/inquiries/[id]/convert.
 * D-07: status 3-value enum enforced.
 * D-02a: Zero legacy leads/lead_calls references.
 */

import { NextResponse } from 'next/server';
import { getTenantId } from '@/lib/get-tenant-id';
import { getInquiry, updateInquiry } from '@/lib/inquiries';

export async function GET(request, { params }) {
  const tenantId = await getTenantId();
  if (!tenantId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const inquiry = await getInquiry({ tenantId, inquiryId: id });
    return NextResponse.json({ inquiry });
  } catch (err) {
    const msg = String(err?.message ?? err);
    if (msg.includes('PGRST116') || msg.includes('not_found')) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    console.error('[api/inquiries/[id]] GET error:', msg);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  const tenantId = await getTenantId();
  if (!tenantId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  try {
    const updated = await updateInquiry({ tenantId, inquiryId: id, patch: body });
    return NextResponse.json({ inquiry: updated });
  } catch (err) {
    const msg = String(err?.message ?? err);
    if (err.code === 'status_not_patchable' || msg.includes('status_not_patchable')) {
      return NextResponse.json({
        error: 'status_not_patchable',
        hint: 'Use POST /api/inquiries/:id/convert to convert an inquiry to a job',
      }, { status: 400 });
    }
    if (err.code === 'invalid_status' || msg.includes('invalid_status')) {
      return NextResponse.json({ error: 'invalid_status', detail: msg }, { status: 400 });
    }
    if (msg.includes('PGRST116') || msg.includes('not_found')) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    console.error('[api/inquiries/[id]] PATCH error:', msg);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

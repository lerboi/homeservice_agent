/**
 * GET /api/jobs/[id]  — job detail with customer + appointment + calls
 * PATCH /api/jobs/[id] — update status/urgency/revenue_amount/is_vip
 *
 * Phase 59 Plan 04.
 * D-06: job.appointment_id NOT NULL (enforced at DB level).
 * D-02a: Zero legacy leads/lead_calls references.
 */

import { NextResponse } from 'next/server';
import { getTenantId } from '@/lib/get-tenant-id';
import { getJob, updateJob } from '@/lib/jobs';

export async function GET(request, { params }) {
  const tenantId = await getTenantId();
  if (!tenantId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const job = await getJob({ tenantId, jobId: id });
    return NextResponse.json({ job });
  } catch (err) {
    const msg = String(err?.message ?? err);
    if (msg.includes('PGRST116') || msg.includes('not_found')) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    console.error('[api/jobs/[id]] GET error:', msg);
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
    const updated = await updateJob({ tenantId, jobId: id, patch: body });
    return NextResponse.json({ job: updated });
  } catch (err) {
    const msg = String(err?.message ?? err);
    if (err.code === 'invalid_status' || msg.includes('invalid_status')) {
      return NextResponse.json({ error: 'invalid_status', detail: msg }, { status: 400 });
    }
    if (err.code === 'invalid_urgency' || msg.includes('invalid_urgency')) {
      return NextResponse.json({ error: 'invalid_urgency', detail: msg }, { status: 400 });
    }
    if (msg.includes('PGRST116') || msg.includes('not_found')) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    console.error('[api/jobs/[id]] PATCH error:', msg);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

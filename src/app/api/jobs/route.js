/**
 * GET /api/jobs
 * Phase 59 Plan 04 — Jobs list endpoint replacing /api/leads for booked work.
 *
 * Query params: status, urgency, customer_id
 * Response: { jobs: [...] } — each job has customer + appointment + calls joined.
 *
 * D-06: Jobs always have appointment_id NOT NULL (source-of-truth: 059 migration).
 * D-02a: Zero legacy leads/lead_calls reads.
 * T-59-04-01: RLS-bound server client + explicit tenant_id filter.
 */

import { NextResponse } from 'next/server';
import { getTenantId } from '@/lib/get-tenant-id';
import { listJobs } from '@/lib/jobs';

export async function GET(request) {
  const tenantId = await getTenantId();
  if (!tenantId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') ?? undefined;
  const urgency = searchParams.get('urgency') ?? undefined;
  const customerId = searchParams.get('customer_id') ?? undefined;

  try {
    const jobs = await listJobs({ tenantId, status, urgency, customerId });
    return NextResponse.json({ jobs });
  } catch (err) {
    console.error('[api/jobs] GET error:', err?.message);
    return NextResponse.json({ error: err?.message ?? 'internal_error' }, { status: 500 });
  }
}

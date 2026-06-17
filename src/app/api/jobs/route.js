/**
 * GET /api/jobs
 * Phase 59 Plan 04 — Jobs list endpoint replacing /api/leads for booked work.
 *
 * Query params: status, urgency, customer_id, search (customer name/phone),
 * date_from, date_to (YYYY-MM-DD, created_at range).
 * NOTE: job_type is NOT supported — the jobs table has no job_type column (059).
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
  const search = searchParams.get('search')?.trim().slice(0, 100) || undefined;
  // Date params must be YYYY-MM-DD — invalid values are ignored, not erred.
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const rawFrom = searchParams.get('date_from');
  const rawTo = searchParams.get('date_to');
  const dateFrom = rawFrom && DATE_RE.test(rawFrom) ? rawFrom : undefined;
  const dateTo = rawTo && DATE_RE.test(rawTo) ? rawTo : undefined;

  try {
    const jobs = await listJobs({ tenantId, status, urgency, customerId, search, dateFrom, dateTo });
    return NextResponse.json({ jobs });
  } catch (err) {
    console.error('[api/jobs] GET error:', err?.message);
    return NextResponse.json({ error: err?.message ?? 'internal_error' }, { status: 500 });
  }
}

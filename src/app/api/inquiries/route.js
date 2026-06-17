/**
 * GET /api/inquiries
 * Phase 59 Plan 04 — Inquiries list endpoint.
 *
 * Query params: status (open|converted|lost), urgency, job_type (partial match),
 * search (customer name/phone), date_from, date_to (YYYY-MM-DD, created_at range).
 * Response: { inquiries: [...] } — each inquiry joined with customer.
 *
 * D-07: status 3-value enum.
 * D-07a: stale open inquiries stay open indefinitely — no auto-filter.
 * D-02a: Zero legacy leads/lead_calls reads.
 */

import { NextResponse } from 'next/server';
import { getTenantId } from '@/lib/get-tenant-id';
import { listInquiries } from '@/lib/inquiries';

export async function GET(request) {
  const tenantId = await getTenantId();
  if (!tenantId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') ?? undefined;
  const urgency = searchParams.get('urgency') ?? undefined;
  const jobType = searchParams.get('job_type')?.trim().slice(0, 100) || undefined;
  const search = searchParams.get('search')?.trim().slice(0, 100) || undefined;
  // Date params must be YYYY-MM-DD — invalid values are ignored, not erred.
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const rawFrom = searchParams.get('date_from');
  const rawTo = searchParams.get('date_to');
  const dateFrom = rawFrom && DATE_RE.test(rawFrom) ? rawFrom : undefined;
  const dateTo = rawTo && DATE_RE.test(rawTo) ? rawTo : undefined;

  try {
    const inquiries = await listInquiries({ tenantId, status, urgency, jobType, search, dateFrom, dateTo });
    return NextResponse.json({ inquiries });
  } catch (err) {
    console.error('[api/inquiries] GET error:', err?.message);
    return NextResponse.json({ error: err?.message ?? 'internal_error' }, { status: 500 });
  }
}

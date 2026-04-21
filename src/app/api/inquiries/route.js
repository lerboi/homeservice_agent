/**
 * GET /api/inquiries
 * Phase 59 Plan 04 — Inquiries list endpoint.
 *
 * Query params: status (open|converted|lost)
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

  try {
    const inquiries = await listInquiries({ tenantId, status });
    return NextResponse.json({ inquiries });
  } catch (err) {
    console.error('[api/inquiries] GET error:', err?.message);
    return NextResponse.json({ error: err?.message ?? 'internal_error' }, { status: 500 });
  }
}

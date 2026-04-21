/**
 * GET /api/customers
 * Phase 59 Plan 04 — Customer list endpoint.
 *
 * D-02a: Reads ONLY from the customers table (new schema). Zero legacy leads reads.
 * T-59-04-01: Uses RLS-bound server client + explicit tenant_id filter (double enforcement).
 */

import { NextResponse } from 'next/server';
import { getTenantId } from '@/lib/get-tenant-id';
import { listCustomers } from '@/lib/customers';

export async function GET(request) {
  const tenantId = await getTenantId();
  if (!tenantId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') ?? undefined;

  try {
    const customers = await listCustomers({ tenantId, search });
    return NextResponse.json({ customers });
  } catch (err) {
    console.error('[api/customers] GET error:', err?.message);
    return NextResponse.json({ error: err?.message ?? 'internal_error' }, { status: 500 });
  }
}

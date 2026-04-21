/**
 * GET /api/customers/[id]  — customer detail + live-computed stats
 * PATCH /api/customers/[id] — update name/email/notes/default_address/tags (D-18)
 *
 * Phase 59 Plan 04.
 * D-05: phone_e164 is immutable — PATCH rejects it with 400.
 * T-59-04-01: RLS-bound client + explicit tenant_id guard.
 * T-59-04-02: forbidden field check in lib/customers.js (updateCustomer).
 * T-59-04-04: mass-assignment guard — only 5 whitelisted fields accepted.
 * T-59-04-05: errors return {error: slug, field?} — no PII echoed.
 * D-02a: Zero reads/writes to legacy leads/lead_calls.
 */

import { NextResponse } from 'next/server';
import { getTenantId } from '@/lib/get-tenant-id';
import { getCustomerWithStats, updateCustomer, getCustomerActivity } from '@/lib/customers';

export async function GET(request, { params }) {
  const tenantId = await getTenantId();
  if (!tenantId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const includeActivity = searchParams.get('include_activity') === '1';

  try {
    const result = await getCustomerWithStats({ tenantId, customerId: id });
    // Activity approach A (Plan 07): include ≤50 most-recent activity_log rows inline when requested.
    if (includeActivity) {
      const activity = await getCustomerActivity({ tenantId, customerId: id, limit: 50 });
      result.activity = activity;
    }
    return NextResponse.json(result);
  } catch (err) {
    const msg = String(err?.message ?? err);
    if (msg.includes('customer_not_found') || msg.includes('PGRST116')) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    console.error('[api/customers/[id]] GET error:', msg);
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

  // D-05 + T-59-04-02: reject forbidden fields at HTTP layer (defense-in-depth; lib also checks)
  const FORBIDDEN = ['phone_e164', 'tenant_id', 'id', 'merged_into', 'merged_at', 'merge_snapshot'];
  for (const k of FORBIDDEN) {
    if (k in body) {
      return NextResponse.json({ error: 'field_not_editable', field: k }, { status: 400 });
    }
  }

  try {
    const updated = await updateCustomer({ tenantId, customerId: id, patch: body });
    return NextResponse.json({ customer: updated });
  } catch (err) {
    const msg = String(err?.message ?? err);
    if (msg.startsWith('field_not_editable:')) {
      const field = err.field ?? msg.replace('field_not_editable: ', '');
      return NextResponse.json({ error: 'field_not_editable', field }, { status: 400 });
    }
    if (msg.includes('PGRST116') || msg.includes('not_found')) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    console.error('[api/customers/[id]] PATCH error:', msg);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

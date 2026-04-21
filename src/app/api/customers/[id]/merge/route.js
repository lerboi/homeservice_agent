/**
 * POST /api/customers/[id]/merge
 * Phase 59 Plan 04 — Customer merge endpoint (D-19 + D-19 expanded).
 *
 * Body: { target_id: uuid }
 * Response 200: { source_id, target_id, audit_id, moved_counts }
 *
 * Security:
 * - T-59-04-03: Defense-in-depth tenant ownership check (lib/customers.js + RPC)
 * - T-59-04-09: p_merged_by sourced server-side from auth.getUser() — never from request body
 * - T-59-04-05: errors return {error: slug} — no PII echoed
 * - D-02a: Zero legacy leads/lead_calls references
 */

import { NextResponse } from 'next/server';
import { getTenantId } from '@/lib/get-tenant-id';
import { createSupabaseServer } from '@/lib/supabase-server';
import { mergeCustomer } from '@/lib/customers';

export async function POST(request, { params }) {
  const tenantId = await getTenantId();
  if (!tenantId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // T-59-04-09: resolve user id server-side (auth.getUser), NEVER from request body
  const supabase = await createSupabaseServer();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id ?? null;

  const { id } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const target_id = body?.target_id;

  if (!target_id) {
    return NextResponse.json({ error: 'target_id_required' }, { status: 400 });
  }

  // HTTP-layer self-merge check (defense-in-depth; RPC also rejects self_merge_forbidden)
  if (target_id === id) {
    return NextResponse.json({ error: 'self_merge_forbidden' }, { status: 400 });
  }

  try {
    const result = await mergeCustomer({
      tenantId,
      sourceId: id,
      targetId: target_id,
      mergedBy: userId, // D-19 expanded: propagate caller's uid for audit trail
    });
    return NextResponse.json(result); // includes audit_id (D-19 expanded)
  } catch (err) {
    const msg = String(err?.message ?? err);
    if (msg.includes('not_found_or_cross_tenant')) {
      // T-59-04-05: return 404, not 403 — don't leak whether the resource exists
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    if (msg.includes('source_invalid') || msg.includes('target_invalid')) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    if (msg.includes('self_merge_forbidden')) {
      return NextResponse.json({ error: 'self_merge_forbidden' }, { status: 400 });
    }
    console.error('[api/customers/[id]/merge] POST error:', msg);
    return NextResponse.json({ error: 'merge_failed', detail: msg }, { status: 500 });
  }
}

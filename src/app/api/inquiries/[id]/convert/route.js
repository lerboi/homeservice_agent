/**
 * POST /api/inquiries/[id]/convert
 * Phase 59 Plan 04 — D-10 offline inquiry → job conversion path.
 *
 * Body: { appointment_id: uuid }
 * Response 200: { job_id, inquiry_id }
 *
 * Two-step operation (intentionally not an RPC at this phase — acceptable at dev-phase
 * volumes; Plan 08 may consolidate into a record_inquiry_conversion RPC if needed):
 *   1. Verify inquiry (open) + appointment (same tenant)
 *   2. Insert job with originated_as_inquiry_id = inquiry.id (D-10 audit FK)
 *   3. Update inquiry: status='converted', converted_to_job_id=job.id
 *
 * If no appointment_id provided: 400 with hint pointing to /api/appointments.
 *
 * D-02a: Zero legacy leads/lead_calls references.
 * T-59-04-08: Both DB statements use RLS-bound server client (not service-role).
 */

import { NextResponse } from 'next/server';
import { getTenantId } from '@/lib/get-tenant-id';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function POST(request, { params }) {
  const tenantId = await getTenantId();
  if (!tenantId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id: inquiryId } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { appointment_id } = body ?? {};

  // D-10: appointment_id is required — booking UX lives in QuickBook sheet (Plan 07)
  if (!appointment_id) {
    return NextResponse.json({
      error: 'appointment_required',
      hint: 'Use /api/appointments to create first, then pass appointment_id',
    }, { status: 400 });
  }

  const supabase = await createSupabaseServer();

  // Verify inquiry belongs to this tenant and is still open
  const { data: inquiry, error: inqErr } = await supabase
    .from('inquiries')
    .select('*')
    .eq('id', inquiryId)
    .eq('tenant_id', tenantId)
    .eq('status', 'open')
    .single();

  if (inqErr || !inquiry) {
    return NextResponse.json({ error: 'inquiry_not_found_or_not_open' }, { status: 404 });
  }

  // Verify appointment belongs to this tenant
  const { data: appt, error: apptErr } = await supabase
    .from('appointments')
    .select('id')
    .eq('id', appointment_id)
    .eq('tenant_id', tenantId)
    .single();

  if (apptErr || !appt) {
    return NextResponse.json({ error: 'appointment_not_found' }, { status: 404 });
  }

  // Insert job with originated_as_inquiry_id (D-10 audit FK)
  const { data: job, error: jErr } = await supabase
    .from('jobs')
    .insert({
      tenant_id: tenantId,
      customer_id: inquiry.customer_id,
      appointment_id,
      originated_as_inquiry_id: inquiryId, // D-10: audit FK for same-call auto-convert path
      urgency: inquiry.urgency,
      status: 'scheduled',
    })
    .select('id')
    .single();

  if (jErr) {
    console.error('[api/inquiries/[id]/convert] job insert error:', jErr.message);
    return NextResponse.json({ error: 'job_create_failed', detail: jErr.message }, { status: 500 });
  }

  // Update inquiry status to converted + link to new job
  const { error: uErr } = await supabase
    .from('inquiries')
    .update({
      status: 'converted',
      converted_to_job_id: job.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', inquiryId)
    .eq('tenant_id', tenantId);

  if (uErr) {
    console.error('[api/inquiries/[id]/convert] inquiry update error:', uErr.message);
    return NextResponse.json({ error: 'inquiry_update_failed', detail: uErr.message }, { status: 500 });
  }

  return NextResponse.json({ job_id: job.id, inquiry_id: inquiryId });
}

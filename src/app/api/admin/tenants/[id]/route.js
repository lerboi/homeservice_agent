import { verifyAdmin } from '@/lib/admin';
import { supabase } from '@/lib/supabase';

/**
 * PATCH /api/admin/tenants/[id]
 * Toggle provisioning_failed flag for a tenant.
 * Body: { provisioning_failed: boolean }
 */
export async function PATCH(request, { params }) {
  const admin = await verifyAdmin();
  if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 });

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body.provisioning_failed !== 'boolean') {
    return Response.json({ error: 'provisioning_failed must be a boolean' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('tenants')
    .update({ provisioning_failed: body.provisioning_failed })
    .eq('id', params.id)
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: 'Tenant not found' }, { status: 404 });

  return Response.json({ data });
}

/**
 * POST /api/admin/tenants/[id]/re-provision
 * Trigger re-provisioning for a tenant with provisioning_failed = true (SG only).
 * Calls assign_sg_number RPC and updates tenant record on success.
 *
 * Note: Unlike the Stripe webhook handler, admin re-provisioning does NOT call
 * Retell API or Twilio API — it only assigns the inventory number and updates the tenant.
 * Retell agent association is a separate operational step.
 */
export async function POST(request, { params }) {
  const admin = await verifyAdmin();
  if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 });

  // Fetch tenant to verify preconditions
  const { data: tenant, error: fetchError } = await supabase
    .from('tenants')
    .select('id, business_name, country, provisioning_failed')
    .eq('id', params.id)
    .single();

  if (fetchError || !tenant) {
    return Response.json({ error: 'Tenant not found' }, { status: 404 });
  }

  if (!tenant.provisioning_failed) {
    return Response.json(
      { error: 'Tenant does not have provisioning_failed = true. Re-provisioning is only allowed for failed tenants.' },
      { status: 409 }
    );
  }

  if (tenant.country !== 'SG') {
    return Response.json(
      { error: 'Admin re-provisioning is only supported for Singapore (SG) tenants. US/CA numbers require Twilio API.' },
      { status: 409 }
    );
  }

  // Call atomic RPC to assign SG number from inventory
  const { data: rpcData, error: rpcError } = await supabase.rpc('assign_sg_number', {
    p_tenant_id: params.id,
  });

  if (rpcError) {
    console.error('[admin/tenants] assign_sg_number RPC error:', rpcError);
    return Response.json({ error: rpcError.message }, { status: 500 });
  }

  // Empty array means no numbers available in inventory
  if (!rpcData || rpcData.length === 0) {
    return Response.json(
      { error: 'No Singapore numbers available. Add numbers to inventory and try again.' },
      { status: 409 }
    );
  }

  const assignedNumber = rpcData[0].phone_number;

  // Update tenant: set retell_phone_number and clear provisioning_failed
  const { error: updateError } = await supabase
    .from('tenants')
    .update({
      retell_phone_number: assignedNumber,
      provisioning_failed: false,
    })
    .eq('id', params.id);

  if (updateError) {
    console.error('[admin/tenants] Failed to update tenant after number assignment:', updateError);
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  return Response.json({ data: { phone_number: assignedNumber } }, { status: 200 });
}

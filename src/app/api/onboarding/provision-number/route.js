import { getTenantId } from '@/lib/get-tenant-id';
import { supabase } from '@/lib/supabase';

export async function POST(request) {
  const tenantId = await getTenantId();
  if (!tenantId) {
    console.log('401: Unauthorized');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Idempotency: check if tenant already has a number provisioned
    const { data: existingTenant } = await supabase
      .from('tenants')
      .select('phone_number')
      .eq('id', tenantId)
      .single();

    if (existingTenant?.phone_number) {
      return Response.json({
        phone_number: existingTenant.phone_number,
        phone_number_pretty: existingTenant.phone_number,
        already_provisioned: true,
      });
    }

    // Phone provisioning now happens during Stripe checkout webhook
    // (Twilio purchase for US/CA, inventory assignment for SG).
    // This route is a fallback check — if no number yet, return error.
    return Response.json({ error: 'Number not yet provisioned. Complete checkout first.' }, { status: 400 });
  } catch (err) {
    console.error('Number provisioning check failed:', err);
    return Response.json({ error: 'Provisioning check failed' }, { status: 500 });
  }
}

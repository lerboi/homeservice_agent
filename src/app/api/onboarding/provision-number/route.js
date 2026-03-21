import { getTenantId } from '@/lib/get-tenant-id';
import { retell } from '@/lib/retell';
import { supabase } from '@/lib/supabase';

export async function POST(request) {
  const tenantId = await getTenantId();
  if (!tenantId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // Provision a new Retell phone number
    const phoneNumber = await retell.phoneNumber.create({});

    // Save to tenant row
    await supabase
      .from('tenants')
      .update({ retell_phone_number: phoneNumber.phone_number })
      .eq('id', tenantId);

    return Response.json({
      phone_number: phoneNumber.phone_number,
      phone_number_pretty: phoneNumber.phone_number_pretty,
    });
  } catch (err) {
    console.error('Retell number provisioning failed:', err);
    return Response.json({ error: 'Provisioning failed' }, { status: 500 });
  }
}

import { getTenantId } from '@/lib/get-tenant-id';
import { retell } from '@/lib/retell';
import { supabase } from '@/lib/supabase';

export async function POST(request) {
  const tenantId = await getTenantId();
  if (!tenantId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: tenant } = await supabase
    .from('tenants')
    .select('retell_phone_number, owner_phone, business_name, tone_preset')
    .eq('id', tenantId)
    .single();

  if (!tenant?.retell_phone_number || !tenant?.owner_phone) {
    return Response.json({ error: 'Phone numbers not configured' }, { status: 400 });
  }

  try {
    const call = await retell.call.createPhoneCall({
      from_number: tenant.retell_phone_number,
      to_number: tenant.owner_phone,
      retell_llm_dynamic_variables: {
        business_name: tenant.business_name,
        onboarding_complete: true,
        tone_preset: tenant.tone_preset,
      },
    });

    // Mark onboarding complete — set atomically with test call trigger
    // Per Pitfall 5 in RESEARCH.md: set flag here, not on webhook callback
    await supabase
      .from('tenants')
      .update({ test_call_completed: true, onboarding_complete: true })
      .eq('id', tenantId);

    return Response.json({ call_id: call.call_id });
  } catch (err) {
    console.error('Test call failed:', err);
    return Response.json({ error: 'Test call failed' }, { status: 500 });
  }
}

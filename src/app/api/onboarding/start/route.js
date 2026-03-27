import { supabase } from '@/lib/supabase';
import { createSupabaseServer } from '@/lib/supabase-server';
import { TRADE_TEMPLATES } from '@/lib/trade-templates';

export async function POST(request) {
  // Authenticate user via server-side session
  const serverSupabase = await createSupabaseServer();
  const { data: { user } } = await serverSupabase.auth.getUser();
  if (!user) {
    console.log('401: Unauthorized');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { business_name, tone_preset, trade_type, services } = body;

  // Step 1 data: business name + tone preset
  if (business_name !== undefined) {
    const { data, error } = await supabase
      .from('tenants')
      .upsert(
        {
          owner_id: user.id,
          business_name,
          tone_preset: tone_preset || 'professional',
        },
        { onConflict: 'owner_id' }
      )
      .select('id')
      .single();

    if (error) {
      console.log('500:', error.message);
      return Response.json({ error: error.message }, { status: 500 });
    }
    return Response.json({ tenant_id: data.id });
  }

  // Step 2 data: trade type + services list
  if (trade_type !== undefined) {
    // Get the tenant for this user
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id')
      .eq('owner_id', user.id)
      .single();

    if (tenantError || !tenant) {
      console.log('400:', 'Tenant not found. Complete step 1 first.');
      return Response.json({ error: 'Tenant not found. Complete step 1 first.' }, { status: 400 });
    }

    // Update trade_type on tenant
    const { error: updateError } = await supabase
      .from('tenants')
      .update({ trade_type })
      .eq('id', tenant.id);

    if (updateError) {
      console.log('500:', updateError.message);
      return Response.json({ error: updateError.message }, { status: 500 });
    }

    // Insert services if provided
    if (Array.isArray(services) && services.length > 0) {
      // Delete existing services first (fresh setup)
      await supabase
        .from('services')
        .delete()
        .eq('tenant_id', tenant.id);

      // Get intake questions for this trade type from TRADE_TEMPLATES
      const tradeTemplate = TRADE_TEMPLATES[trade_type];
      const tradeIntakeQuestions = tradeTemplate?.intakeQuestions || [];

      const serviceRows = services.map((svc) => ({
        tenant_id: tenant.id,
        name: svc.name,
        urgency_tag: svc.urgency_tag || 'routine',
        intake_questions: tradeIntakeQuestions,
      }));

      const { error: servicesError } = await supabase
        .from('services')
        .insert(serviceRows);

      if (servicesError) {
        console.log('500:', servicesError.message);
        return Response.json({ error: servicesError.message }, { status: 500 });
      }
    }

    return Response.json({ tenant_id: tenant.id });
  }

  console.log('400:', 'No valid data provided');
  return Response.json({ error: 'No valid data provided' }, { status: 400 });
}

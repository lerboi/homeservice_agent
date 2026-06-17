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
    // business_name feeds the AI greeting and system prompt — reject empty or
    // absurd values rather than persisting them.
    if (typeof business_name !== 'string' || !business_name.trim() || business_name.trim().length > 120) {
      return Response.json({ error: 'Enter your business name.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('tenants')
      .upsert(
        {
          owner_id: user.id,
          business_name: business_name.trim(),
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
    // trade_type drives template lookups and the AI prompt — only known trades.
    if (!Object.prototype.hasOwnProperty.call(TRADE_TEMPLATES, trade_type)) {
      return Response.json({ error: 'Please select a valid trade type.' }, { status: 400 });
    }

    // When a services array is sent it REPLACES the saved list, so an empty
    // array would leave the AI with nothing to triage. Reject it here; the
    // wizard also blocks submission client-side at zero services.
    if (services !== undefined) {
      if (!Array.isArray(services) || services.length === 0) {
        return Response.json({ error: 'Add at least one service.' }, { status: 400 });
      }
      if (services.length > 50) {
        return Response.json({ error: 'Too many services (max 50).' }, { status: 400 });
      }
      const VALID_URGENCY = new Set(['emergency', 'urgent', 'routine']);
      for (const svc of services) {
        if (typeof svc?.name !== 'string' || !svc.name.trim() || svc.name.trim().length > 80) {
          return Response.json({ error: 'Each service needs a name (max 80 characters).' }, { status: 400 });
        }
        if (svc.urgency_tag !== undefined && !VALID_URGENCY.has(svc.urgency_tag)) {
          return Response.json({ error: 'Invalid urgency tag.' }, { status: 400 });
        }
      }
    }

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

    // Replace services when provided (validated non-empty above)
    if (Array.isArray(services) && services.length > 0) {
      // Get intake questions for this trade type from TRADE_TEMPLATES
      const tradeTemplate = TRADE_TEMPLATES[trade_type];
      const tradeIntakeQuestions = tradeTemplate?.intakeQuestions || [];

      const serviceRows = services.map((svc) => ({
        tenant_id: tenant.id,
        name: svc.name.trim(),
        urgency_tag: svc.urgency_tag || 'routine',
        intake_questions: tradeIntakeQuestions,
      }));

      // Delete-then-insert is intentionally ordered after row construction so
      // a malformed payload can't wipe services and then fail the insert.
      const { error: deleteError } = await supabase
        .from('services')
        .delete()
        .eq('tenant_id', tenant.id);

      if (deleteError) {
        console.log('500:', deleteError.message);
        return Response.json({ error: deleteError.message }, { status: 500 });
      }

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

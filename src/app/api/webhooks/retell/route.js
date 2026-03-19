import { after } from 'next/server';
import Retell from 'retell-sdk';
import { retell } from '@/lib/retell';
import { supabase } from '@/lib/supabase';
import { processCallAnalyzed, processCallEnded } from '@/lib/call-processor';

export async function POST(request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-retell-signature') || '';

  if (!Retell.verify(rawBody, process.env.RETELL_API_KEY, signature)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  const { event } = payload;

  if (event === 'call_inbound') {
    return handleInbound(payload);
  }

  if (event === 'call_ended') {
    after(async () => {
      await processCallEnded(payload.call);
    });
    return Response.json({ received: true });
  }

  if (event === 'call_analyzed') {
    after(async () => {
      await processCallAnalyzed(payload.call);
    });
    return Response.json({ received: true });
  }

  // Handle Retell custom function invocations (e.g., transfer_call tool)
  if (event === 'call_function_invoked') {
    return handleFunctionCall(payload);
  }

  return Response.json({ received: true });
}

async function handleInbound(payload) {
  const { from_number, to_number } = payload;

  // Look up tenant by the Retell phone number that was called
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, business_name, default_locale, onboarding_complete, owner_phone, tone_preset')
    .eq('retell_phone_number', to_number)
    .single();

  if (!tenant) {
    // No tenant configured for this number — use defaults
    return Response.json({
      dynamic_variables: {
        business_name: 'HomeService',
        default_locale: 'en',
        onboarding_complete: false,
        caller_number: from_number,
        owner_phone: '',
        tone_preset: 'professional',
      },
    });
  }

  return Response.json({
    dynamic_variables: {
      business_name: tenant.business_name || 'HomeService',
      default_locale: tenant.default_locale || 'en',
      onboarding_complete: tenant.onboarding_complete,
      caller_number: from_number,
      tenant_id: tenant.id,
      owner_phone: tenant.owner_phone || '',
      tone_preset: tenant.tone_preset || 'professional',
    },
  });
}

/**
 * Handle Retell custom function calls invoked by the AI agent during a live call.
 * Currently supports: transfer_call (transfer to owner's phone).
 */
async function handleFunctionCall(payload) {
  const { call_id, function_call } = payload;

  if (function_call?.name === 'transfer_call') {
    // Look up the call's tenant to get owner_phone
    // The call_id in function invocation events is the retell call_id
    const { data: call } = await supabase
      .from('calls')
      .select('tenant_id')
      .eq('retell_call_id', call_id)
      .single();

    let ownerPhone = null;
    if (call?.tenant_id) {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('owner_phone')
        .eq('id', call.tenant_id)
        .single();
      ownerPhone = tenant?.owner_phone;
    }

    // Fallback: if no call record yet, look up tenant by the inbound number
    // The tenant lookup may also come from function_call.arguments if the agent passes it
    if (!ownerPhone && function_call.arguments?.tenant_id) {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('owner_phone')
        .eq('id', function_call.arguments.tenant_id)
        .single();
      ownerPhone = tenant?.owner_phone;
    }

    if (ownerPhone) {
      try {
        await retell.call.transfer({
          call_id,
          transfer_to: ownerPhone,
        });
        return Response.json({ result: 'transfer_initiated' });
      } catch (err) {
        console.error('Transfer failed:', err);
        return Response.json({ result: 'transfer_failed', error: err.message });
      }
    }

    // No owner phone configured — graceful fallback
    return Response.json({
      result: 'transfer_unavailable',
      message: 'No owner phone number configured for this business.',
    });
  }

  return Response.json({ received: true });
}

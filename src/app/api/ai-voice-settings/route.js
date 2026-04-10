import { getTenantId } from '@/lib/get-tenant-id';
import { supabase } from '@/lib/supabase';
import { VALID_VOICES, isValidVoice } from '@/lib/ai-voice-validation';

export { VALID_VOICES };

export async function PATCH(request) {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ai_voice } = await request.json();

    if (!isValidVoice(ai_voice)) {
      return Response.json({ error: 'Invalid voice selection' }, { status: 400 });
    }

    const { error } = await supabase
      .from('tenants')
      .update({ ai_voice })
      .eq('id', tenantId);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ ai_voice });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

import { getTenantId } from '@/lib/get-tenant-id';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabase
      .from('calendar_credentials')
      .select('provider, calendar_name, last_synced_at, is_primary, created_at')
      .eq('tenant_id', tenantId);

    if (error) return Response.json({ error: error.message }, { status: 500 });

    const result = { google: null, outlook: null };
    for (const row of (data || [])) {
      result[row.provider] = {
        connected: true,
        calendar_name: row.calendar_name,
        last_synced_at: row.last_synced_at,
        is_primary: row.is_primary,
      };
    }

    return Response.json(result);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

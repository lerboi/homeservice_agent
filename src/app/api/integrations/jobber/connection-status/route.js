// Phase 57 — lightweight Jobber connection-status flag for client components
// (e.g., AppointmentFlyout invoked outside the calendar page server-pass).

import { createClient } from '@supabase/supabase-js';
import { getTenantId } from '@/lib/get-tenant-id';

export async function GET() {
  const tenantId = await getTenantId();
  if (!tenantId) return Response.json({ connected: false });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  const { data } = await admin
    .from('accounting_credentials')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('provider', 'jobber')
    .maybeSingle();
  return Response.json({ connected: !!data });
}

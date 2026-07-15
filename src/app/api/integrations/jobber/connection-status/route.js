// Phase 57 — lightweight Jobber connection-status flag for client components
// (e.g., AppointmentFlyout invoked outside the calendar page server-pass).

import { createClient } from '@supabase/supabase-js';
import { getTenantId } from '@/lib/get-tenant-id';
import { INTEGRATIONS_ENABLED } from '@/lib/integrations-enabled';

export async function GET() {
  // v1: integrations flagged off — always report not-connected (a dead
  // accounting_credentials row must not read as connected). See
  // My Prompts/Jobber-Xero-Disable.md.
  if (!INTEGRATIONS_ENABLED) return Response.json({ connected: false });
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

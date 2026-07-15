/**
 * GET /api/integrations/status
 *
 * Returns per-provider integration status for the authenticated tenant.
 * Shape: { xero: <row>|null, jobber: <row>|null } — each row contains
 * provider, scopes, last_context_fetch_at, connected_at, display_name.
 *
 * Internally calls getIntegrationStatus which is wrapped in 'use cache'
 * with a per-tenant cacheTag. Callback + disconnect revalidate the tag.
 */

import { getTenantId } from '@/lib/get-tenant-id';
import { getIntegrationStatus } from '@/lib/integrations/status';
import { INTEGRATIONS_ENABLED } from '@/lib/integrations-enabled';

export async function GET() {
  const tenantId = await getTenantId();
  if (!tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // v1: integrations flagged off — no provider status to report. Return an empty
  // shape so any client renders "not connected"/nothing. See
  // My Prompts/Jobber-Xero-Disable.md.
  if (!INTEGRATIONS_ENABLED) {
    return Response.json({ xero: null, jobber: null });
  }

  try {
    const status = await getIntegrationStatus(tenantId);
    return Response.json(status);
  } catch (err) {
    console.error('[integrations-status] fetch failed:', err?.message || err);
    return Response.json({ error: 'Failed to fetch status' }, { status: 500 });
  }
}

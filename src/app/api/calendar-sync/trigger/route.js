import { getTenantId } from '@/lib/get-tenant-id';
import { supabase } from '@/lib/supabase';
import { syncCalendarEvents } from '@/lib/scheduling/google-calendar';
import { syncOutlookCalendarEvents } from '@/lib/scheduling/outlook-calendar';

/**
 * POST /api/calendar-sync/trigger
 * Manually trigger a calendar sync for the authenticated tenant.
 * Syncs all connected providers (Google, Outlook).
 */
export async function POST() {
  const tenantId = await getTenantId();
  if (!tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: credentials } = await supabase
    .from('calendar_credentials')
    .select('provider')
    .eq('tenant_id', tenantId);

  if (!credentials || credentials.length === 0) {
    return Response.json({ error: 'No calendars connected' }, { status: 404 });
  }

  const results = [];

  for (const cred of credentials) {
    try {
      if (cred.provider === 'google') {
        await syncCalendarEvents(tenantId);
      } else if (cred.provider === 'outlook') {
        await syncOutlookCalendarEvents(tenantId);
      }
      results.push({ provider: cred.provider, status: 'ok' });
    } catch (err) {
      console.error(`[calendar-sync] Manual sync failed for ${cred.provider}:`, err.message);
      results.push({ provider: cred.provider, status: 'error', message: err.message });
    }
  }

  return Response.json({ results });
}

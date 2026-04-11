import { createSupabaseServer } from '@/lib/supabase-server';
import { supabase } from '@/lib/supabase';

// ─── Checklist derivation ─────────────────────────────────────────────────────

const DEFAULT_NOTIFICATION_PREFS = {
  booked: { sms: true, email: true },
  declined: { sms: false, email: false },
  not_attempted: { sms: false, email: false },
  attempted: { sms: false, email: false },
};

function hasCustomNotificationPrefs(prefs) {
  if (!prefs || typeof prefs !== 'object') return false;
  return JSON.stringify(prefs) !== JSON.stringify(DEFAULT_NOTIFICATION_PREFS);
}

function deriveChecklistItems(tenant, serviceCount, calendarConnected, zoneCount, escalationCount) {
  return [
    {
      id: 'configure_services',
      label: 'Configure services',
      complete: serviceCount > 0,
      locked: true,
    },
    {
      id: 'make_test_call',
      label: 'Make a test call',
      complete: !!tenant.onboarding_complete,
      locked: false,
      href: '/dashboard/more/ai-voice-settings',
    },
    {
      id: 'configure_hours',
      label: 'Configure working hours',
      complete: !!tenant.working_hours,
      locked: false,
      href: '/dashboard/more/working-hours',
    },
    {
      id: 'connect_calendar',
      label: 'Connect your calendar',
      complete: calendarConnected,
      locked: false,
      href: '/dashboard/calendar',
    },
    {
      id: 'configure_zones',
      label: 'Set up service zones',
      complete: zoneCount > 0,
      locked: false,
      href: '/dashboard/more/service-zones',
    },
    {
      id: 'setup_escalation',
      label: 'Add escalation contacts',
      complete: escalationCount > 0,
      locked: false,
      href: '/dashboard/more/escalation-contacts',
    },
    {
      id: 'configure_notifications',
      label: 'Configure notifications',
      complete: hasCustomNotificationPrefs(tenant.notification_preferences),
      locked: false,
      href: '/dashboard/more/notifications',
    },
    {
      id: 'configure_call_routing',
      label: 'Configure call routing',
      complete: !!(
        tenant.call_forwarding_schedule?.enabled === true &&
        Array.isArray(tenant.pickup_numbers) &&
        tenant.pickup_numbers.length >= 1
      ),
      locked: false,
      href: '/dashboard/more/call-routing',
    },
  ];
}

// ─── GET /api/setup-checklist ─────────────────────────────────────────────────

export async function GET() {
  const serverSupabase = await createSupabaseServer();
  const { data: { user } } = await serverSupabase.auth.getUser();

  if (!user) {
    console.log('401: Unauthorized');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, business_name, working_hours, onboarding_complete, phone_number, setup_checklist_dismissed, notification_preferences, call_forwarding_schedule, pickup_numbers')
    .eq('owner_id', user.id)
    .single();

  if (!tenant) {
    console.log('404: Tenant not found');
    return Response.json({ error: 'Tenant not found' }, { status: 404 });
  }

  const [serviceResult, calendarResult, zoneResult, escalationResult] = await Promise.allSettled([
    supabase
      .from('services')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant.id)
      .eq('is_active', true),
    supabase
      .from('calendar_credentials')
      .select('id')
      .eq('tenant_id', tenant.id)
      .maybeSingle(),
    supabase
      .from('service_zones')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant.id),
    supabase
      .from('escalation_contacts')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant.id)
      .eq('is_active', true),
  ]);

  const serviceCount =
    serviceResult.status === 'fulfilled' ? (serviceResult.value.count ?? 0) : 0;
  const calendarConnected =
    calendarResult.status === 'fulfilled' ? !!calendarResult.value.data : false;
  const zoneCount =
    zoneResult.status === 'fulfilled' ? (zoneResult.value.count ?? 0) : 0;
  const escalationCount =
    escalationResult.status === 'fulfilled' ? (escalationResult.value.count ?? 0) : 0;

  const items = deriveChecklistItems(tenant, serviceCount, calendarConnected, zoneCount, escalationCount);

  return Response.json({
    items,
    dismissed: tenant.setup_checklist_dismissed ?? false,
    completedCount: items.filter((i) => i.complete).length,
  });
}

// ─── PATCH /api/setup-checklist ───────────────────────────────────────────────

export async function PATCH(request) {
  const serverSupabase = await createSupabaseServer();
  const { data: { user } } = await serverSupabase.auth.getUser();

  if (!user) {
    console.log('401: Unauthorized');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { dismissed } = await request.json();

  await supabase
    .from('tenants')
    .update({ setup_checklist_dismissed: !!dismissed })
    .eq('owner_id', user.id);

  return Response.json({ ok: true });
}

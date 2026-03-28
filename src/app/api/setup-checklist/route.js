import { createSupabaseServer } from '@/lib/supabase-server';
import { supabase } from '@/lib/supabase';

// ─── Checklist derivation ─────────────────────────────────────────────────────

function deriveChecklistItems(tenant, serviceCount, calendarConnected) {
  return [
    {
      id: 'create_account',
      label: 'Create account',
      complete: true,
      locked: true,
    },
    {
      id: 'setup_profile',
      label: 'Set up business profile',
      complete: !!tenant.business_name,
      locked: true,
    },
    {
      id: 'configure_services',
      label: 'Configure services',
      complete: serviceCount > 0,
      locked: true,
    },
    {
      id: 'connect_calendar',
      label: 'Connect Google Calendar',
      complete: calendarConnected,
      locked: false,
      href: '/dashboard/more/calendar-connections',
    },
    {
      id: 'configure_hours',
      label: 'Configure working hours',
      complete: !!tenant.working_hours,
      locked: false,
      href: '/dashboard/more/working-hours',
    },
    {
      id: 'make_test_call',
      label: 'Make a test call',
      complete: !!tenant.onboarding_complete,
      locked: false,
      href: '/dashboard/more/ai-voice-settings',
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
    .select('id, business_name, working_hours, onboarding_complete, phone_number, setup_checklist_dismissed')
    .eq('owner_id', user.id)
    .single();

  if (!tenant) {
    console.log('404: Tenant not found');
    return Response.json({ error: 'Tenant not found' }, { status: 404 });
  }

  const [serviceResult, calendarResult] = await Promise.allSettled([
    supabase
      .from('services')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant.id)
      .eq('is_active', true),
    supabase
      .from('calendar_credentials')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('provider', 'google')
      .maybeSingle(),
  ]);

  const serviceCount =
    serviceResult.status === 'fulfilled' ? (serviceResult.value.count ?? 0) : 0;
  const calendarConnected =
    calendarResult.status === 'fulfilled' ? !!calendarResult.value.data : false;

  const items = deriveChecklistItems(tenant, serviceCount, calendarConnected);

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

import { createSupabaseServer } from '@/lib/supabase-server';
import { supabase } from '@/lib/supabase';

// ─── Constants (Phase 48 — exported for tests + UI consumers) ────────────────

/** All valid checklist item IDs. PATCH validates `item_id` against this. */
export const VALID_ITEM_IDS = [
  'setup_profile',
  'configure_services',
  'make_test_call',
  'configure_hours',
  'configure_notifications',
  'configure_call_routing',
  'connect_calendar',
  'configure_zones',
  'setup_escalation',
  'setup_billing',
  'connect_xero',
];

/** Theme → item IDs map used by the SetupChecklist accordion (Phase 48 D-02). */
export const THEME_GROUPS = {
  profile: ['setup_profile'],
  voice: [
    'configure_services',
    'make_test_call',
    'configure_hours',
    'configure_notifications',
    'configure_call_routing',
    'connect_xero',
  ],
  calendar: ['connect_calendar', 'configure_zones', 'setup_escalation'],
  billing: ['setup_billing'],
};

/** Ordered theme list (drives GET response ordering). */
const THEME_ORDER = ['profile', 'voice', 'calendar', 'billing'];

/** Required = badge, NOT grouping (per D-02 + interfaces contract in 48-01-PLAN). */
const REQUIRED_ITEM_IDS = new Set([
  'setup_profile',
  'configure_services',
  'make_test_call',
  'configure_hours',
  'setup_billing',
]);

/** Static metadata per item: title, description, deep-link href. */
const ITEM_META = {
  setup_profile: {
    title: 'Complete your business profile',
    description: 'Set your business name so callers hear the right greeting.',
    href: '/dashboard/settings#profile',
  },
  configure_services: {
    title: 'Configure services',
    description: 'List the jobs you offer so the AI can triage and book them.',
    href: '/dashboard/services',
  },
  make_test_call: {
    title: 'Make a test call',
    description: 'Call your own AI line to verify greeting and booking flow.',
    href: '/dashboard/more/ai-voice-settings',
  },
  configure_hours: {
    title: 'Configure working hours',
    description: 'Tell the AI when to book jobs vs. offer next-day slots.',
    href: '/dashboard/more/working-hours',
  },
  configure_notifications: {
    title: 'Configure notifications',
    description: 'Pick how you want to be alerted when a job gets booked.',
    href: '/dashboard/more/notifications',
  },
  configure_call_routing: {
    title: 'Set up call answering',
    description: 'Choose when the AI picks up vs. when your phone rings first.',
    href: '/dashboard/more/call-routing',
  },
  connect_calendar: {
    title: 'Connect your calendar',
    description: 'Sync Google or Outlook so the AI never double-books.',
    href: '/dashboard/calendar',
  },
  configure_zones: {
    title: 'Set up service zones',
    description: 'Define travel zones so appointments factor in drive time.',
    href: '/dashboard/more/service-zones',
  },
  setup_escalation: {
    title: 'Add escalation contacts',
    description: 'Backup humans the AI can transfer to when it gets stuck.',
    href: '/dashboard/more/escalation-contacts',
  },
  setup_billing: {
    title: 'Activate billing',
    description: 'Pick a plan so your AI line stays active after the trial.',
    href: '/dashboard/more/billing',
  },
  connect_xero: {
    title: 'Connect Xero',
    description:
      'Let your AI receptionist see customer history during calls.',
    href: '/dashboard/more/integrations',
  },
};

// ─── Notification prefs helper (preserved from previous version) ─────────────

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

function themeFor(itemId) {
  for (const theme of THEME_ORDER) {
    if (THEME_GROUPS[theme].includes(itemId)) return theme;
  }
  return 'voice';
}

// ─── deriveChecklistItems (pure — takes a resolved tenant + counts) ───────────

/**
 * Build themed checklist items from tenant state + per-table counts.
 *
 * @param {Object} tenant - tenants row (must include business_name, working_hours,
 *   onboarding_complete, notification_preferences, call_forwarding_schedule,
 *   pickup_numbers, checklist_overrides)
 * @param {Object} counts - { serviceCount, calendarConnected, zoneCount,
 *   escalationCount, hasActiveSubscription }
 * @returns {Array<Object>} items ordered by theme (profile → voice → calendar → billing)
 */
export function deriveChecklistItems(tenant, counts) {
  const {
    serviceCount = 0,
    calendarConnected = false,
    zoneCount = 0,
    escalationCount = 0,
    hasActiveSubscription = false,
  } = counts || {};

  const overrides = (tenant && tenant.checklist_overrides) || {};

  // Auto-detected completion per item
  const autoComplete = {
    setup_profile: !!(
      tenant &&
      typeof tenant.business_name === 'string' &&
      tenant.business_name.trim().length > 0
    ),
    configure_services: serviceCount > 0,
    make_test_call: !!(tenant && tenant.onboarding_complete),
    configure_hours: !!(tenant && tenant.working_hours),
    configure_notifications: hasCustomNotificationPrefs(
      tenant && tenant.notification_preferences
    ),
    configure_call_routing: !!(
      tenant &&
      tenant.call_forwarding_schedule?.enabled === true &&
      Array.isArray(tenant.pickup_numbers) &&
      tenant.pickup_numbers.length >= 1
    ),
    connect_calendar: !!calendarConnected,
    configure_zones: zoneCount > 0,
    setup_escalation: escalationCount > 0,
    setup_billing: !!hasActiveSubscription,
    connect_xero: !!counts.xeroConnected,
  };

  const items = [];
  for (const theme of THEME_ORDER) {
    for (const id of THEME_GROUPS[theme]) {
      const override = overrides[id] || {};
      // dismiss removes the item from the list entirely
      if (override.dismissed === true) continue;
      const meta = ITEM_META[id] || { title: id, description: '', href: '#' };
      const markDoneOverride = override.mark_done === true;
      items.push({
        id,
        theme,
        required: REQUIRED_ITEM_IDS.has(id),
        complete: autoComplete[id] || markDoneOverride,
        dismissed: false, // dismissed items never reach the output array
        mark_done_override: markDoneOverride,
        title: meta.title,
        description: meta.description,
        href: meta.href,
      });
    }
  }
  return items;
}

// ─── Server-side data fetcher ─────────────────────────────────────────────────

async function fetchChecklistState(tenantId) {
  // Parallel: tenant row + 4 count/presence queries + current subscription row
  const [
    tenantResult,
    serviceResult,
    calendarResult,
    zoneResult,
    escalationResult,
    subResult,
    xeroResult,
  ] = await Promise.allSettled([
      supabase
        .from('tenants')
        .select(
          'id, business_name, working_hours, onboarding_complete, phone_number, ' +
            'setup_checklist_dismissed, notification_preferences, call_forwarding_schedule, ' +
            'pickup_numbers, checklist_overrides'
        )
        .eq('id', tenantId)
        .single(),
      supabase
        .from('services')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('is_active', true),
      supabase
        .from('calendar_credentials')
        .select('id')
        .eq('tenant_id', tenantId)
        .maybeSingle(),
      supabase
        .from('service_zones')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
      supabase
        .from('escalation_contacts')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('is_active', true),
      supabase
        .from('subscriptions')
        .select('status')
        .eq('tenant_id', tenantId)
        .eq('is_current', true)
        .maybeSingle(),
      supabase
        .from('accounting_credentials')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('provider', 'xero'),
    ]);

  const tenant = tenantResult.status === 'fulfilled' ? tenantResult.value.data : null;
  const serviceCount =
    serviceResult.status === 'fulfilled' ? serviceResult.value.count ?? 0 : 0;
  const calendarConnected =
    calendarResult.status === 'fulfilled' ? !!calendarResult.value.data : false;
  const zoneCount = zoneResult.status === 'fulfilled' ? zoneResult.value.count ?? 0 : 0;
  const escalationCount =
    escalationResult.status === 'fulfilled' ? escalationResult.value.count ?? 0 : 0;

  const subStatus =
    subResult.status === 'fulfilled' ? subResult.value.data?.status : null;
  const hasActiveSubscription =
    subStatus === 'active' || subStatus === 'trialing' || subStatus === 'past_due';

  const xeroConnected =
    xeroResult.status === 'fulfilled' && (xeroResult.value.count ?? 0) > 0;

  return {
    tenant,
    serviceCount,
    calendarConnected,
    zoneCount,
    escalationCount,
    hasActiveSubscription,
    xeroConnected,
  };
}

// ─── GET /api/setup-checklist ─────────────────────────────────────────────────

export async function GET() {
  const serverSupabase = await createSupabaseServer();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: tenantRow } = await serverSupabase
    .from('tenants')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle();

  if (!tenantRow) {
    return Response.json({ error: 'Tenant not found' }, { status: 404 });
  }

  const state = await fetchChecklistState(tenantRow.id);
  if (!state.tenant) {
    return Response.json({ error: 'Tenant not found' }, { status: 404 });
  }

  const items = deriveChecklistItems(state.tenant, state);
  const completeCount = items.filter((i) => i.complete).length;
  const total = items.length;

  return Response.json({
    items,
    dismissed: state.tenant.setup_checklist_dismissed ?? false,
    dismissedGlobal: state.tenant.setup_checklist_dismissed ?? false,
    // Back-compat field preserved for existing callers
    completedCount: completeCount,
    progress: {
      total,
      complete: completeCount,
      percent: total > 0 ? Math.round((completeCount / total) * 100) : 0,
    },
  });
}

// ─── PATCH /api/setup-checklist ───────────────────────────────────────────────

/**
 * Accepts THREE body shapes (validated manually — zod is not a project dep):
 *   1. { dismissed: boolean }                                 (whole-checklist dismiss)
 *   2. { item_id: <VALID_ITEM_IDS>, mark_done: boolean }      (per-item manual override)
 *   3. { item_id: <VALID_ITEM_IDS>, dismiss:   boolean }      (per-item hide)
 *
 * Rate limiting: No project-wide rate-limit middleware detected
 * (`grep -r rateLimit src/` only finds public-chat + demo-voice). Skipping here.
 */
export async function PATCH(request) {
  const serverSupabase = await createSupabaseServer();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return Response.json({ error: 'Invalid body' }, { status: 400 });
  }

  // Resolve tenant via session client (V4: NEVER trust body-supplied tenant_id)
  const { data: tenant } = await serverSupabase
    .from('tenants')
    .select('id, checklist_overrides')
    .eq('owner_id', user.id)
    .maybeSingle();

  if (!tenant) {
    return Response.json({ error: 'Tenant not found' }, { status: 404 });
  }

  const tenantId = tenant.id;

  // Shape 1: whole-checklist dismiss (existing behavior, preserved)
  if (
    'dismissed' in body &&
    !('item_id' in body) &&
    !('mark_done' in body) &&
    !('dismiss' in body)
  ) {
    if (typeof body.dismissed !== 'boolean') {
      return Response.json(
        { error: 'dismissed must be boolean' },
        { status: 400 }
      );
    }
    const { error } = await supabase
      .from('tenants')
      .update({ setup_checklist_dismissed: body.dismissed })
      .eq('id', tenantId);
    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    return Response.json({ success: true, ok: true, item: null });
  }

  // Shapes 2 + 3: per-item override (mark_done OR dismiss)
  if ('item_id' in body) {
    if (typeof body.item_id !== 'string' || !VALID_ITEM_IDS.includes(body.item_id)) {
      return Response.json({ error: 'Invalid item_id' }, { status: 400 });
    }

    const hasMarkDone = 'mark_done' in body;
    const hasDismiss = 'dismiss' in body;
    if (hasMarkDone === hasDismiss) {
      // Exactly one of the two must be present
      return Response.json(
        { error: 'Body must include exactly one of mark_done or dismiss' },
        { status: 400 }
      );
    }

    if (hasMarkDone && typeof body.mark_done !== 'boolean') {
      return Response.json(
        { error: 'mark_done must be boolean' },
        { status: 400 }
      );
    }
    if (hasDismiss && typeof body.dismiss !== 'boolean') {
      return Response.json(
        { error: 'dismiss must be boolean' },
        { status: 400 }
      );
    }

    const currentOverrides =
      tenant.checklist_overrides && typeof tenant.checklist_overrides === 'object'
        ? { ...tenant.checklist_overrides }
        : {};
    const itemOverride = { ...(currentOverrides[body.item_id] || {}) };

    if (hasMarkDone) {
      if (body.mark_done) itemOverride.mark_done = true;
      else delete itemOverride.mark_done;
    } else {
      if (body.dismiss) itemOverride.dismissed = true;
      else delete itemOverride.dismissed;
    }

    if (Object.keys(itemOverride).length === 0) {
      delete currentOverrides[body.item_id];
    } else {
      currentOverrides[body.item_id] = itemOverride;
    }

    const { error: updateError } = await supabase
      .from('tenants')
      .update({ checklist_overrides: currentOverrides })
      .eq('id', tenantId);

    if (updateError) {
      return Response.json({ error: updateError.message }, { status: 500 });
    }

    // Re-derive and return the updated item (or null if dismissed — filtered out)
    const state = await fetchChecklistState(tenantId);
    if (!state.tenant) {
      return Response.json({ success: true, item: null });
    }
    const items = deriveChecklistItems(state.tenant, state);
    const updated = items.find((i) => i.id === body.item_id) || null;

    return Response.json({ success: true, ok: true, item: updated });
  }

  return Response.json({ error: 'Invalid body shape' }, { status: 400 });
}

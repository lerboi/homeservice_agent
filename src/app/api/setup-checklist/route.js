import { createSupabaseServer } from '@/lib/supabase-server';
import { supabase } from '@/lib/supabase';
import { INTEGRATIONS_ENABLED } from '@/lib/integrations-enabled';

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
  'connect_jobber',
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
    'connect_jobber',
  ],
  calendar: ['connect_calendar', 'configure_zones', 'setup_escalation'],
  billing: ['setup_billing'],
};

/** Ordered theme list (drives GET response ordering). */
const THEME_ORDER = ['profile', 'voice', 'calendar', 'billing'];

/**
 * Tier classification (onboarding revamp) — the single source of truth for what
 * the call-readiness meter tracks and how the checklist is grouped.
 *
 *   ESSENTIAL   → gates "can my AI actually take and book calls properly?"
 *                 (greeting, what you do, when you work, where you serve, a live plan)
 *   RECOMMENDED → improves call handling; the AI still works on sensible defaults
 *   OPTIONAL    → integrations / power features
 *
 * `required` on each emitted item is derived as (tier === 'essential') so the
 * existing ChecklistItem dismiss/CTA logic keeps working without a rename.
 */
export const TIER_GROUPS = {
  essential: [
    'setup_profile',
    'configure_services',
    'configure_hours',
    // make_test_call is the keystone: it's the ONLY item that proves the live
    // call path actually connects (verified inbound by the LiveKit
    // participant_joined webhook). It is also the gate the inbound Twilio
    // webhook enforces (is_tenant_call_ready / migration 078) — until it's done,
    // live callers are forwarded to the owner instead of an unproven AI. So it
    // belongs in ESSENTIAL, alongside the config the AI needs to handle a call.
    'make_test_call',
    'setup_billing',
  ],
  recommended: [
    'connect_calendar',
    'configure_call_routing',
    'configure_notifications',
    'setup_escalation',
    // configure_zones demoted from essential: booking works fine with zero
    // zones (no service-area restriction), so it improves quality but does not
    // gate call-readiness.
    'configure_zones',
  ],
  optional: ['connect_xero', 'connect_jobber'],
};

/** Ordered tier list — drives GET item ordering AND the checklist accordions. */
export const TIER_ORDER = ['essential', 'recommended', 'optional'];

function tierFor(itemId) {
  for (const tier of TIER_ORDER) {
    if (TIER_GROUPS[tier].includes(itemId)) return tier;
  }
  return 'recommended';
}

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
    title: 'Set up your service area',
    description: 'Tell the AI which areas you serve so it only books jobs you can reach.',
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
  connect_jobber: {
    title: 'Connect Jobber',
    description:
      'Let your AI receptionist see customer and job history during calls.',
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
    // Verified by the LiveKit participant_joined webhook (/api/webhooks/livekit)
    // — true only once a test call actually connected, not at trigger time.
    make_test_call: !!(tenant && tenant.test_call_completed),
    // Reject an empty object: the enforced gate is_tenant_call_ready (migration
    // 078) treats working_hours in ('null','{}') as NOT set, so a bare
    // !!{} === true here would mark the item complete while the gate still fails
    // and the webhook keeps forwarding every call (DASH-1). Require a non-empty object.
    configure_hours: !!(
      tenant &&
      tenant.working_hours &&
      typeof tenant.working_hours === 'object' &&
      Object.keys(tenant.working_hours).length > 0
    ),
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
    connect_jobber: !!counts.jobberConnected,
  };

  const items = [];
  for (const tier of TIER_ORDER) {
    for (const id of TIER_GROUPS[tier]) {
      // v1: Jobber/Xero integrations are flagged off — don't surface their
      // checklist items (no "connect / reconnect" nudge). See
      // My Prompts/Jobber-Xero-Disable.md.
      if (!INTEGRATIONS_ENABLED && (id === 'connect_xero' || id === 'connect_jobber')) continue;
      const override = overrides[id] || {};
      // dismiss removes the item from the list entirely
      if (override.dismissed === true) continue;
      const meta = ITEM_META[id] || { title: id, description: '', href: '#' };
      const markDoneOverride = override.mark_done === true;
      // Essentials (except make_test_call) must NOT be satisfiable by a manual
      // "Mark done". The enforced routing gate is_tenant_call_ready (migration 078)
      // reads raw columns and ignores checklist overrides, so honoring mark-done
      // here let the dashboard show "You're call-ready" while the gate still
      // forwarded every inbound call to the owner (DASH-1). make_test_call KEEPS the
      // mark-done fallback — its auto-detect needs the external LiveKit
      // participant_joined webhook, which is the documented manual-completion escape
      // hatch until that path is verified live (see webhooks/livekit/route.js).
      const markDoneAllowed = !(tier === 'essential' && id !== 'make_test_call');
      const complete = autoComplete[id] || (markDoneAllowed && markDoneOverride);
      // Phase 58 CHECKLIST-01: only connect_xero / connect_jobber can enter the
      // error sub-state. Emit has_error + error_subtitle uniformly on every item
      // so ChecklistItem.jsx doesn't have to guard undefined fields.
      const isErrorItem =
        (id === 'connect_xero' && counts.xeroHasError === true) ||
        (id === 'connect_jobber' && counts.jobberHasError === true);
      items.push({
        id,
        tier,
        // `theme` retained for back-compat (THEME_GROUPS export + any caller
        // still keying off it); `tier` is the active grouping/ordering field.
        theme: themeFor(id),
        required: tier === 'essential',
        complete,
        dismissed: false, // dismissed items never reach the output array
        mark_done_override: markDoneOverride,
        title: meta.title,
        description: meta.description,
        href: meta.href,
        has_error: isErrorItem,
        error_subtitle: isErrorItem ? 'Reconnect needed' : null,
      });
    }
  }
  return items;
}

// ─── Server-side data fetcher ─────────────────────────────────────────────────

async function fetchChecklistState(tenantId) {
  // Parallel: tenant row + count/presence queries + current subscription row.
  // Phase 58 CHECKLIST-01: 4 accounting_credentials queries (healthy + error per
  // provider) so connect_xero / connect_jobber can emit has_error + error_subtitle.
  const [
    tenantResult,
    serviceResult,
    calendarResult,
    zoneResult,
    escalationResult,
    subResult,
    xeroOkResult,
    xeroErrResult,
    jobberOkResult,
    jobberErrResult,
  ] = await Promise.allSettled([
      supabase
        .from('tenants')
        .select(
          'id, business_name, working_hours, onboarding_complete, phone_number, ' +
            'setup_checklist_dismissed, notification_preferences, call_forwarding_schedule, ' +
            'pickup_numbers, checklist_overrides, test_call_completed'
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
      // Xero — healthy (row exists AND error_state IS NULL) per D-01
      supabase
        .from('accounting_credentials')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('provider', 'xero')
        .is('error_state', null),
      // Xero — error (row exists AND error_state IS NOT NULL) per D-02
      supabase
        .from('accounting_credentials')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('provider', 'xero')
        .not('error_state', 'is', null),
      // Jobber — healthy
      supabase
        .from('accounting_credentials')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('provider', 'jobber')
        .is('error_state', null),
      // Jobber — error
      supabase
        .from('accounting_credentials')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('provider', 'jobber')
        .not('error_state', 'is', null),
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

  // Phase 58 CHECKLIST-01: xeroConnected = healthy-only count (error_state IS NULL).
  // Rows with error_state set do NOT bump xeroConnected → item stays incomplete,
  // and xeroHasError separately signals the "Reconnect needed" sub-state (D-01 + D-02).
  const xeroConnected =
    xeroOkResult.status === 'fulfilled' && (xeroOkResult.value.count ?? 0) > 0;
  const xeroHasError =
    xeroErrResult.status === 'fulfilled' && (xeroErrResult.value.count ?? 0) > 0;
  const jobberConnected =
    jobberOkResult.status === 'fulfilled' && (jobberOkResult.value.count ?? 0) > 0;
  const jobberHasError =
    jobberErrResult.status === 'fulfilled' && (jobberErrResult.value.count ?? 0) > 0;

  return {
    tenant,
    serviceCount,
    calendarConnected,
    zoneCount,
    escalationCount,
    hasActiveSubscription,
    xeroConnected,
    jobberConnected,
    xeroHasError,
    jobberHasError,
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

  // Call-readiness = ESSENTIAL items only. This is the meter that answers
  // "can my AI take and book calls properly?" — recommended/optional items
  // improve quality but never gate readiness.
  const essentials = items.filter((i) => i.tier === 'essential');
  const essentialsComplete = essentials.filter((i) => i.complete).length;

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
    readiness: {
      essentialsTotal: essentials.length,
      essentialsComplete,
      callReady:
        essentials.length > 0 && essentialsComplete === essentials.length,
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

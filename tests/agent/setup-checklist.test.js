/**
 * setup-checklist — tier model + derivation tests (onboarding revamp).
 *
 * Replaces the stale create_account / `locked` 6-item assertions (that model was
 * removed in the Phase 48 rewrite). Tests the pure deriveChecklistItems() with
 * no Supabase mocking, plus the GET auth guard.
 */

import { jest } from '@jest/globals';

const mockGetUser = jest.fn();

jest.unstable_mockModule('@/lib/supabase-server', () => ({
  createSupabaseServer: jest.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
  }),
}));

jest.unstable_mockModule('@/lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

let GET, deriveChecklistItems, TIER_GROUPS, TIER_ORDER, VALID_ITEM_IDS;

beforeAll(async () => {
  const mod = await import('@/app/api/setup-checklist/route.js');
  GET = mod.GET;
  deriveChecklistItems = mod.deriveChecklistItems;
  TIER_GROUPS = mod.TIER_GROUPS;
  TIER_ORDER = mod.TIER_ORDER;
  VALID_ITEM_IDS = mod.VALID_ITEM_IDS;
});

beforeEach(() => {
  jest.clearAllMocks();
});

const fullTenant = {
  business_name: 'Acme Plumbing',
  working_hours: { mon: '09:00-17:00' },
  onboarding_complete: true,
  notification_preferences: null,
  call_forwarding_schedule: null,
  pickup_numbers: [],
  checklist_overrides: {},
};

describe('tier model', () => {
  it('classifies items into essential / recommended / optional', () => {
    expect(TIER_ORDER).toEqual(['essential', 'recommended', 'optional']);
    expect(TIER_GROUPS.essential).toEqual(
      expect.arrayContaining([
        'setup_profile',
        'configure_services',
        'configure_hours',
        'make_test_call',
        'setup_billing',
      ])
    );
    expect(TIER_GROUPS.recommended).toEqual(
      expect.arrayContaining([
        'connect_calendar',
        'configure_call_routing',
        'configure_notifications',
        'setup_escalation',
        'configure_zones',
      ])
    );
    expect(TIER_GROUPS.optional).toEqual(['connect_xero', 'connect_jobber']);
  });

  it('test call (make_test_call) is essential; service area (configure_zones) is recommended', () => {
    // make_test_call is the keystone readiness proof + the inbound webhook gate;
    // configure_zones only restricts service area, so booking works without it.
    expect(TIER_GROUPS.essential).toContain('make_test_call');
    expect(TIER_GROUPS.recommended).toContain('configure_zones');
  });

  it('every tiered id is a valid item id', () => {
    const all = [
      ...TIER_GROUPS.essential,
      ...TIER_GROUPS.recommended,
      ...TIER_GROUPS.optional,
    ];
    for (const id of all) expect(VALID_ITEM_IDS).toContain(id);
  });
});

describe('deriveChecklistItems', () => {
  it('tags each item with its tier and sets required = (tier === essential)', () => {
    const items = deriveChecklistItems(fullTenant, {});
    const byId = Object.fromEntries(items.map((i) => [i.id, i]));
    expect(byId.make_test_call.tier).toBe('essential');
    expect(byId.make_test_call.required).toBe(true);
    expect(byId.configure_zones.tier).toBe('recommended');
    expect(byId.configure_zones.required).toBe(false);
    expect(byId.connect_xero.tier).toBe('optional');
    expect(byId.connect_xero.required).toBe(false);
  });

  it('orders items essential → recommended → optional', () => {
    const tiers = deriveChecklistItems(fullTenant, {}).map((i) => i.tier);
    const lastEssential = tiers.lastIndexOf('essential');
    const firstRecommended = tiers.indexOf('recommended');
    const firstOptional = tiers.indexOf('optional');
    expect(lastEssential).toBeLessThan(firstRecommended);
    expect(firstRecommended).toBeLessThan(firstOptional);
  });

  it('derives completion from tenant state + counts', () => {
    const items = deriveChecklistItems(fullTenant, {
      serviceCount: 2,
      zoneCount: 1,
      hasActiveSubscription: true,
    });
    const byId = Object.fromEntries(items.map((i) => [i.id, i]));
    expect(byId.setup_profile.complete).toBe(true); // business_name set
    expect(byId.configure_services.complete).toBe(true); // serviceCount > 0
    expect(byId.configure_hours.complete).toBe(true); // working_hours set
    expect(byId.configure_zones.complete).toBe(true); // zoneCount > 0
    expect(byId.setup_billing.complete).toBe(true); // active subscription
    expect(byId.connect_calendar.complete).toBe(false); // not connected
  });

  it('call-ready = every essential complete (derived)', () => {
    // Essentials now require a connected test call (test_call_completed) instead
    // of configure_zones, mirroring the inbound webhook readiness gate.
    const items = deriveChecklistItems(
      { ...fullTenant, test_call_completed: true },
      {
        serviceCount: 2,
        hasActiveSubscription: true,
      }
    );
    const essentials = items.filter((i) => i.tier === 'essential');
    expect(essentials).toHaveLength(5);
    expect(essentials.every((i) => i.complete)).toBe(true);
  });

  it('mark_done override forces complete:true', () => {
    const t = {
      ...fullTenant,
      business_name: null,
      checklist_overrides: { setup_profile: { mark_done: true } },
    };
    const profile = deriveChecklistItems(t, {}).find((i) => i.id === 'setup_profile');
    expect(profile.complete).toBe(true);
    expect(profile.mark_done_override).toBe(true);
  });

  it('dismiss override removes the item from the list', () => {
    const t = {
      ...fullTenant,
      checklist_overrides: { connect_xero: { dismissed: true } },
    };
    const items = deriveChecklistItems(t, {});
    expect(items.find((i) => i.id === 'connect_xero')).toBeUndefined();
  });

  it('emits has_error + Reconnect subtitle for a failed integration', () => {
    const jobber = deriveChecklistItems(fullTenant, { jobberHasError: true }).find(
      (i) => i.id === 'connect_jobber'
    );
    expect(jobber.has_error).toBe(true);
    expect(jobber.error_subtitle).toBe('Reconnect needed');
  });

  it('make_test_call completes from test_call_completed (verified), not onboarding', () => {
    // fullTenant has onboarding_complete: true but no test_call_completed — the
    // item must stay incomplete until a test call actually connected.
    const notTested = deriveChecklistItems(
      { ...fullTenant, test_call_completed: false },
      {}
    ).find((i) => i.id === 'make_test_call');
    expect(notTested.complete).toBe(false);

    const tested = deriveChecklistItems(
      { ...fullTenant, test_call_completed: true },
      {}
    ).find((i) => i.id === 'make_test_call');
    expect(tested.complete).toBe(true);
  });
});

describe('GET /api/setup-checklist auth guard', () => {
  it('returns 401 when the user is not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });
});

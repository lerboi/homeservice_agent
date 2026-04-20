/**
 * Phase 56 Plan 04 — setup-checklist connect_jobber item.
 *
 * Validates the pure `deriveChecklistItems(tenant, counts)` export + static
 * invariants on the route source. Network-side GET coverage is kept light
 * because fetchChecklistState wraps Supabase directly — the pure derivation
 * function is the testable unit.
 *
 * SC1: item with id='connect_jobber' present in derived output
 * SC2: completed=true when counts.jobberConnected is truthy
 * SC3: completed=false when counts.jobberConnected is falsy
 * SC4: title/description/href/theme exact per UI-SPEC
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { jest } from '@jest/globals';

jest.unstable_mockModule('@/lib/supabase-server', () => ({
  createSupabaseServer: jest.fn(async () => ({})),
}));
jest.unstable_mockModule('@/lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

let deriveChecklistItems;
let VALID_ITEM_IDS;
let THEME_GROUPS;

beforeAll(async () => {
  const mod = await import('@/app/api/setup-checklist/route');
  deriveChecklistItems = mod.deriveChecklistItems;
  VALID_ITEM_IDS = mod.VALID_ITEM_IDS;
  THEME_GROUPS = mod.THEME_GROUPS;
});

const baseTenant = {
  business_name: 'Acme',
  working_hours: { mon: '9-5' },
  onboarding_complete: true,
  notification_preferences: null,
  call_forwarding_schedule: null,
  pickup_numbers: [],
  checklist_overrides: {},
  setup_checklist_dismissed: false,
};

describe('setup-checklist — connect_jobber item', () => {
  it('SC1: item with id="connect_jobber" appears in derived output', () => {
    const items = deriveChecklistItems(baseTenant, { jobberConnected: false });
    const jobberItem = items.find((i) => i.id === 'connect_jobber');
    expect(jobberItem).toBeDefined();
  });

  it('SC2: connect_jobber.complete === true when jobberConnected truthy', () => {
    const items = deriveChecklistItems(baseTenant, { jobberConnected: true });
    const jobberItem = items.find((i) => i.id === 'connect_jobber');
    expect(jobberItem.complete).toBe(true);
  });

  it('SC3: connect_jobber.complete === false when jobberConnected falsy', () => {
    const items = deriveChecklistItems(baseTenant, { jobberConnected: false });
    const jobberItem = items.find((i) => i.id === 'connect_jobber');
    expect(jobberItem.complete).toBe(false);
  });

  it('SC4a: title/description/href match UI-SPEC exactly', () => {
    const items = deriveChecklistItems(baseTenant, { jobberConnected: false });
    const jobberItem = items.find((i) => i.id === 'connect_jobber');
    expect(jobberItem.title).toBe('Connect Jobber');
    expect(jobberItem.description).toBe(
      'Let your AI receptionist see customer and job history during calls.',
    );
    expect(jobberItem.href).toBe('/dashboard/more/integrations');
  });

  it('SC4b: theme=voice, required=false', () => {
    const items = deriveChecklistItems(baseTenant, { jobberConnected: false });
    const jobberItem = items.find((i) => i.id === 'connect_jobber');
    expect(jobberItem.theme).toBe('voice');
    expect(jobberItem.required).toBe(false);
  });

  it('connect_jobber is in VALID_ITEM_IDS and THEME_GROUPS.voice', () => {
    expect(VALID_ITEM_IDS).toContain('connect_jobber');
    expect(THEME_GROUPS.voice).toContain('connect_jobber');
  });

  it('fetchChecklistState source includes Jobber accounting_credentials query', () => {
    const routeSource = readFileSync(
      resolve(process.cwd(), 'src/app/api/setup-checklist/route.js'),
      'utf8',
    );
    expect(routeSource).toMatch(/provider.*jobber|'jobber'/);
    expect(routeSource).toMatch(/jobberConnected/);
  });

  // Phase 58 CHECKLIST-01 — error_state branch assertions
  it('connect_jobber is complete when jobberConnected=true and jobberHasError=false', () => {
    const items = deriveChecklistItems(baseTenant, {
      serviceCount: 1,
      calendarConnected: true,
      zoneCount: 1,
      escalationCount: 1,
      hasActiveSubscription: true,
      xeroConnected: false,
      jobberConnected: true,
      xeroHasError: false,
      jobberHasError: false,
    });
    const j = items.find((i) => i.id === 'connect_jobber');
    expect(j.complete).toBe(true);
    expect(j.has_error).toBe(false);
    expect(j.error_subtitle).toBeNull();
  });

  it('connect_jobber is incomplete + has_error when jobberHasError=true', () => {
    const items = deriveChecklistItems(baseTenant, {
      serviceCount: 1,
      calendarConnected: true,
      zoneCount: 1,
      escalationCount: 1,
      hasActiveSubscription: true,
      xeroConnected: false,
      jobberConnected: false,
      xeroHasError: false,
      jobberHasError: true,
    });
    const j = items.find((i) => i.id === 'connect_jobber');
    expect(j.complete).toBe(false);
    expect(j.has_error).toBe(true);
    expect(j.error_subtitle).toBe('Reconnect needed');
  });
});

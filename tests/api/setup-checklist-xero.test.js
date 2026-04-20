/**
 * Tests for the connect_xero item in /api/setup-checklist (Phase 55 Plan 05).
 * Tests the pure deriveChecklistItems function — avoids supabase integration.
 */

import { describe, it, expect } from '@jest/globals';
import {
  deriveChecklistItems,
  VALID_ITEM_IDS,
  THEME_GROUPS,
} from '@/app/api/setup-checklist/route';

const baseTenant = {
  id: 't1',
  business_name: 'Acme',
  working_hours: null,
  onboarding_complete: false,
  notification_preferences: null,
  call_forwarding_schedule: null,
  pickup_numbers: null,
  checklist_overrides: null,
};

describe('setup-checklist connect_xero', () => {
  it('registers connect_xero in VALID_ITEM_IDS', () => {
    expect(VALID_ITEM_IDS).toContain('connect_xero');
  });

  it('places connect_xero under the voice theme', () => {
    expect(THEME_GROUPS.voice).toContain('connect_xero');
  });

  it('connect_xero is complete=true when xeroConnected=true', () => {
    const items = deriveChecklistItems(baseTenant, { xeroConnected: true });
    const xero = items.find((i) => i.id === 'connect_xero');
    expect(xero).toBeDefined();
    expect(xero.complete).toBe(true);
    expect(xero.theme).toBe('voice');
    expect(xero.href).toBe('/dashboard/more/integrations');
  });

  it('connect_xero is complete=false when xeroConnected=false/undefined', () => {
    const items = deriveChecklistItems(baseTenant, {});
    const xero = items.find((i) => i.id === 'connect_xero');
    expect(xero.complete).toBe(false);
  });

  it('connect_xero respects dismissed override (filtered out entirely)', () => {
    const tenant = {
      ...baseTenant,
      checklist_overrides: { connect_xero: { dismissed: true } },
    };
    const items = deriveChecklistItems(tenant, { xeroConnected: false });
    expect(items.find((i) => i.id === 'connect_xero')).toBeUndefined();
  });

  // Phase 58 CHECKLIST-01 — error_state branch assertions
  it('connect_xero is complete when xeroConnected=true and xeroHasError=false', () => {
    const items = deriveChecklistItems(baseTenant, {
      serviceCount: 1,
      calendarConnected: true,
      zoneCount: 1,
      escalationCount: 1,
      hasActiveSubscription: true,
      xeroConnected: true,
      jobberConnected: false,
      xeroHasError: false,
      jobberHasError: false,
    });
    const x = items.find((i) => i.id === 'connect_xero');
    expect(x.complete).toBe(true);
    expect(x.has_error).toBe(false);
    expect(x.error_subtitle).toBeNull();
  });

  it('connect_xero is incomplete + has_error when xeroHasError=true', () => {
    const items = deriveChecklistItems(baseTenant, {
      serviceCount: 1,
      calendarConnected: true,
      zoneCount: 1,
      escalationCount: 1,
      hasActiveSubscription: true,
      xeroConnected: false,
      jobberConnected: false,
      xeroHasError: true,
      jobberHasError: false,
    });
    const x = items.find((i) => i.id === 'connect_xero');
    expect(x.complete).toBe(false);
    expect(x.has_error).toBe(true);
    expect(x.error_subtitle).toBe('Reconnect needed');
  });
});

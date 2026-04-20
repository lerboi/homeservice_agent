/**
 * Phase 58 Plan 01 — CHECKLIST-01 error-state branch tests (red-dot semantics).
 *
 * Wave 0 scaffold. These tests WILL FAIL until Plan 58-02 extends
 * `deriveChecklistItems` to accept `xeroHasError` / `jobberHasError` flags and
 * emit `has_error` / `error_subtitle`. That's the Nyquist point — Wave 0 creates
 * the failing target; downstream plans turn it green.
 *
 * Mirrors the structure of tests/api/setup-checklist-xero.test.js (Phase 55 P05)
 * and tests/api/setup-checklist-jobber.test.js (Phase 56 P04).
 */

import { describe, it, expect } from '@jest/globals';
import { deriveChecklistItems } from '@/app/api/setup-checklist/route';

const baseTenant = {
  id: 't1',
  business_name: 'Acme Plumbing',
  working_hours: { mon: { enabled: true, open: '09:00', close: '17:00' } },
  onboarding_complete: true,
  notification_preferences: { sms: '+15551234567' },
  call_forwarding_schedule: { enabled: false, days: {} },
  pickup_numbers: [],
  checklist_overrides: {},
};

const baseCounts = {
  serviceCount: 1,
  calendarConnected: true,
  zoneCount: 1,
  escalationCount: 1,
  hasActiveSubscription: true,
};

describe('setup-checklist — error_state branch (Phase 58 CHECKLIST-01)', () => {
  it('connect_xero is incomplete + has_error when xeroHasError', () => {
    const items = deriveChecklistItems(baseTenant, {
      ...baseCounts,
      xeroConnected: false,
      jobberConnected: false,
      xeroHasError: true,
      jobberHasError: false,
    });
    const x = items.find((i) => i.id === 'connect_xero');
    expect(x).toBeDefined();
    expect(x.complete).toBe(false);
    expect(x.has_error).toBe(true);
    expect(x.error_subtitle).toBe('Reconnect needed');
  });

  it('connect_jobber is incomplete + has_error when jobberHasError', () => {
    const items = deriveChecklistItems(baseTenant, {
      ...baseCounts,
      xeroConnected: false,
      jobberConnected: false,
      xeroHasError: false,
      jobberHasError: true,
    });
    const j = items.find((i) => i.id === 'connect_jobber');
    expect(j).toBeDefined();
    expect(j.complete).toBe(false);
    expect(j.has_error).toBe(true);
    expect(j.error_subtitle).toBe('Reconnect needed');
  });

  it('connect_xero is complete when xeroConnected + !xeroHasError', () => {
    const items = deriveChecklistItems(baseTenant, {
      ...baseCounts,
      xeroConnected: true,
      jobberConnected: false,
      xeroHasError: false,
      jobberHasError: false,
    });
    const x = items.find((i) => i.id === 'connect_xero');
    expect(x.complete).toBe(true);
    expect(x.has_error).toBe(false);
  });

  it('connect_jobber is complete when jobberConnected + !jobberHasError', () => {
    const items = deriveChecklistItems(baseTenant, {
      ...baseCounts,
      xeroConnected: false,
      jobberConnected: true,
      xeroHasError: false,
      jobberHasError: false,
    });
    const j = items.find((i) => i.id === 'connect_jobber');
    expect(j.complete).toBe(true);
    expect(j.has_error).toBe(false);
  });

  it('connect_xero is incomplete + no red-dot when row does not exist', () => {
    const items = deriveChecklistItems(baseTenant, {
      ...baseCounts,
      xeroConnected: false,
      jobberConnected: false,
      xeroHasError: false,
      jobberHasError: false,
    });
    const x = items.find((i) => i.id === 'connect_xero');
    expect(x.complete).toBe(false);
    expect(x.has_error).toBe(false);
  });

  it('connect_jobber is incomplete + no red-dot when row does not exist', () => {
    const items = deriveChecklistItems(baseTenant, {
      ...baseCounts,
      xeroConnected: false,
      jobberConnected: false,
      xeroHasError: false,
      jobberHasError: false,
    });
    const j = items.find((i) => i.id === 'connect_jobber');
    expect(j.complete).toBe(false);
    expect(j.has_error).toBe(false);
  });
});

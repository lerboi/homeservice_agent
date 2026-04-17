/**
 * Tests for xeroContactMatchesPhone (Phase 55 post-UAT fix).
 * Xero stores phones inconsistently — full E.164 strings, formatted strings,
 * or split across PhoneCountryCode/PhoneAreaCode/PhoneNumber. Our matcher
 * compares the last 10 digits after digits-only extraction.
 */

import { jest } from '@jest/globals';

// The helper is a pure function with no dependencies, but xero.js imports
// next/cache which isn't available in Jest node env. Stub it.
jest.unstable_mockModule('next/cache', () => ({
  cacheTag: jest.fn(),
  revalidateTag: jest.fn(),
}));
jest.unstable_mockModule('@supabase/supabase-js', () => ({
  createClient: () => ({ from: () => ({}) }),
}));
jest.unstable_mockModule('xero-node', () => ({
  XeroClient: jest.fn().mockImplementation(() => ({})),
}));
jest.unstable_mockModule('@/lib/integrations/adapter', () => ({
  refreshTokenIfNeeded: jest.fn(),
  getIntegrationAdapter: jest.fn(),
}));

let xeroContactMatchesPhone;
beforeAll(async () => {
  ({ xeroContactMatchesPhone } = await import('@/lib/integrations/xero'));
});

describe('xeroContactMatchesPhone', () => {
  it('matches exact E.164 stored in phoneNumber', () => {
    const c = { phones: [{ phoneNumber: '+15551234567' }] };
    expect(xeroContactMatchesPhone(c, '+15551234567')).toBe(true);
  });

  it('matches formatted string "(555) 123-4567" against +15551234567', () => {
    const c = { phones: [{ phoneNumber: '(555) 123-4567' }] };
    expect(xeroContactMatchesPhone(c, '+15551234567')).toBe(true);
  });

  it('matches "555-123-4567" against +15551234567', () => {
    const c = { phones: [{ phoneNumber: '555-123-4567' }] };
    expect(xeroContactMatchesPhone(c, '+15551234567')).toBe(true);
  });

  it('matches Xero-split compound fields (country/area/number)', () => {
    const c = {
      phones: [{
        phoneCountryCode: '1',
        phoneAreaCode: '555',
        phoneNumber: '1234567',
      }],
    };
    expect(xeroContactMatchesPhone(c, '+15551234567')).toBe(true);
  });

  it('matches area+number when country code is missing', () => {
    const c = {
      phones: [{
        phoneAreaCode: '555',
        phoneNumber: '123-4567',
      }],
    };
    expect(xeroContactMatchesPhone(c, '+15551234567')).toBe(true);
  });

  it('does not match different 10-digit number', () => {
    const c = { phones: [{ phoneNumber: '+19998887777' }] };
    expect(xeroContactMatchesPhone(c, '+15551234567')).toBe(false);
  });

  it('checks all phones in the array', () => {
    const c = {
      phones: [
        { phoneNumber: '+19998887777' },
        { phoneNumber: '+15551234567' },
      ],
    };
    expect(xeroContactMatchesPhone(c, '+15551234567')).toBe(true);
  });

  it('returns false for contact with empty phones', () => {
    expect(xeroContactMatchesPhone({ phones: [] }, '+15551234567')).toBe(false);
    expect(xeroContactMatchesPhone({}, '+15551234567')).toBe(false);
  });

  it('ignores empty phoneNumber entries', () => {
    const c = { phones: [{ phoneNumber: '' }, { phoneNumber: null }] };
    expect(xeroContactMatchesPhone(c, '+15551234567')).toBe(false);
  });
});

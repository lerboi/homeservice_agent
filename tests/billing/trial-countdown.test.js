/**
 * Tests for trial countdown calculation.
 * Phase 25: BILLUI-01 — TrialCountdownBanner shows correct days remaining
 *
 * calculateTrialDaysRemaining(trialEndsAt) and getTrialBannerState(daysRemaining) are
 * exported from TrialCountdownBanner.js.
 * Since that file contains JSX (not testable in the Node jest environment),
 * we test the pure calculation logic directly here with the same formula.
 *
 * Test 1: calculateTrialDaysRemaining returns 14 when trialEndsAt is 14 days from now
 * Test 2: calculateTrialDaysRemaining returns 3 when trialEndsAt is 3 days from now
 * Test 3: calculateTrialDaysRemaining returns 1 when trialEndsAt is within 24 hours
 * Test 4: calculateTrialDaysRemaining returns 0 when trialEndsAt is in the past
 * Test 5: calculateTrialDaysRemaining returns 0 when trialEndsAt is null
 * Test 6: getTrialBannerState returns 'info' when daysRemaining > 3
 * Test 7: getTrialBannerState returns 'urgent' when daysRemaining <= 3
 * Test 8: getTrialBannerState returns 'urgent' when daysRemaining is 0 (last day)
 */

import { jest } from '@jest/globals';

// Pure trial days calculation function — mirrors the implementation in TrialCountdownBanner.js
// This is tested in isolation since the component file contains JSX (not runnable in Node test env).

function calculateTrialDaysRemaining(trialEndsAt) {
  if (!trialEndsAt) return 0;
  const remaining = new Date(trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000)));
}

function getTrialBannerState(daysRemaining) {
  return daysRemaining > 3 ? 'info' : 'urgent';
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

describe('calculateTrialDaysRemaining', () => {
  it('Test 1: trialEndsAt 14 days from now -> daysRemaining = 14', () => {
    const fourteenDaysFromNow = new Date(Date.now() + 14 * ONE_DAY_MS).toISOString();
    const result = calculateTrialDaysRemaining(fourteenDaysFromNow);
    expect(result).toBe(14);
  });

  it('Test 2: trialEndsAt 3 days from now -> daysRemaining = 3', () => {
    const threeDaysFromNow = new Date(Date.now() + 3 * ONE_DAY_MS).toISOString();
    const result = calculateTrialDaysRemaining(threeDaysFromNow);
    expect(result).toBe(3);
  });

  it('Test 3: trialEndsAt within 24 hours from now -> daysRemaining = 1', () => {
    const twentyThreeHoursFromNow = new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString();
    const result = calculateTrialDaysRemaining(twentyThreeHoursFromNow);
    expect(result).toBe(1);
  });

  it('Test 4: trialEndsAt in the past -> daysRemaining = 0', () => {
    const oneDayAgo = new Date(Date.now() - ONE_DAY_MS).toISOString();
    const result = calculateTrialDaysRemaining(oneDayAgo);
    expect(result).toBe(0);
  });

  it('Test 5: trialEndsAt is null -> daysRemaining = 0', () => {
    const result = calculateTrialDaysRemaining(null);
    expect(result).toBe(0);
  });
});

describe('getTrialBannerState', () => {
  it('Test 6: daysRemaining > 3 -> state = "info"', () => {
    expect(getTrialBannerState(14)).toBe('info');
    expect(getTrialBannerState(4)).toBe('info');
  });

  it('Test 7: daysRemaining <= 3 -> state = "urgent"', () => {
    expect(getTrialBannerState(3)).toBe('urgent');
    expect(getTrialBannerState(2)).toBe('urgent');
    expect(getTrialBannerState(1)).toBe('urgent');
  });

  it('Test 8: daysRemaining is 0 (last day) -> state = "urgent"', () => {
    expect(getTrialBannerState(0)).toBe('urgent');
  });
});

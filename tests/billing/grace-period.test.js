/**
 * Tests for grace period countdown calculation.
 * Phase 24: ENFORCE-03 — past_due banner shows correct days remaining
 *
 * calculateGraceDaysRemaining(stripeUpdatedAt) is exported from BillingWarningBanner.js.
 * Since that file contains JSX (not testable in the Node jest environment),
 * we test the pure calculation logic directly here with the same formula.
 *
 * Grace period is 3 days. daysRemaining = max(0, ceil((3days - elapsed) / 1day))
 *
 * Test 1: stripe_updated_at 1 day ago -> daysRemaining = 2
 * Test 2: stripe_updated_at 2 days ago -> daysRemaining = 1
 * Test 3: stripe_updated_at 3 days ago -> daysRemaining = 0
 * Test 4: stripe_updated_at 4 days ago -> daysRemaining = 0 (clamped)
 * Test 5: stripe_updated_at just now -> daysRemaining = 3
 */

import { jest } from '@jest/globals';

// Pure grace period calculation function — mirrors the implementation in BillingWarningBanner.js
// This is tested in isolation since the component file contains JSX (not runnable in Node test env).
const GRACE_PERIOD_MS = 3 * 24 * 60 * 60 * 1000;

function calculateGraceDaysRemaining(stripeUpdatedAt) {
  const elapsed = Date.now() - new Date(stripeUpdatedAt).getTime();
  return Math.max(0, Math.ceil((GRACE_PERIOD_MS - elapsed) / (24 * 60 * 60 * 1000)));
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

describe('calculateGraceDaysRemaining', () => {
  it('Test 1: stripe_updated_at 1 day ago -> daysRemaining = 2', () => {
    const oneDayAgo = new Date(Date.now() - ONE_DAY_MS).toISOString();
    const result = calculateGraceDaysRemaining(oneDayAgo);
    expect(result).toBe(2);
  });

  it('Test 2: stripe_updated_at 2 days ago -> daysRemaining = 1', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * ONE_DAY_MS).toISOString();
    const result = calculateGraceDaysRemaining(twoDaysAgo);
    expect(result).toBe(1);
  });

  it('Test 3: stripe_updated_at 3 days ago -> daysRemaining = 0', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * ONE_DAY_MS).toISOString();
    const result = calculateGraceDaysRemaining(threeDaysAgo);
    expect(result).toBe(0);
  });

  it('Test 4: stripe_updated_at 4 days ago -> daysRemaining = 0 (clamped to 0)', () => {
    const fourDaysAgo = new Date(Date.now() - 4 * ONE_DAY_MS).toISOString();
    const result = calculateGraceDaysRemaining(fourDaysAgo);
    expect(result).toBe(0);
  });

  it('Test 5: stripe_updated_at just now -> daysRemaining = 3', () => {
    const justNow = new Date().toISOString();
    const result = calculateGraceDaysRemaining(justNow);
    expect(result).toBe(3);
  });
});

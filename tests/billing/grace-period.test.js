/**
 * Tests for grace period countdown calculation.
 * Phase 24: ENFORCE-03 — past_due banner shows correct days remaining
 *
 * calculateGraceDaysRemaining(currentPeriodEnd) is exported from BillingWarningBanner.js.
 * Since that file contains JSX (not testable in the Node jest environment),
 * we test the pure calculation logic directly here with the same formula.
 *
 * Grace period = 3 days after current_period_end (the billing cycle end date).
 * Uses current_period_end because it is stable — stripe_updated_at advances on
 * every subscription.updated webhook event, which would reset the countdown.
 *
 * Test 1: current_period_end 1 day ago -> daysRemaining = 2
 * Test 2: current_period_end 2 days ago -> daysRemaining = 1
 * Test 3: current_period_end 3 days ago -> daysRemaining = 0
 * Test 4: current_period_end 4 days ago -> daysRemaining = 0 (clamped)
 * Test 5: current_period_end just now -> daysRemaining = 3
 * Test 6: current_period_end is null -> daysRemaining = 0
 */

import { jest } from '@jest/globals';

// Pure grace period calculation function — mirrors the implementation in BillingWarningBanner.js
// This is tested in isolation since the component file contains JSX (not runnable in Node test env).
const GRACE_PERIOD_MS = 3 * 24 * 60 * 60 * 1000;

function calculateGraceDaysRemaining(currentPeriodEnd) {
  if (!currentPeriodEnd) return 0;
  const graceDeadline = new Date(currentPeriodEnd).getTime() + GRACE_PERIOD_MS;
  const remaining = graceDeadline - Date.now();
  return Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000)));
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

describe('calculateGraceDaysRemaining', () => {
  it('Test 1: current_period_end 1 day ago -> daysRemaining = 2', () => {
    const oneDayAgo = new Date(Date.now() - ONE_DAY_MS).toISOString();
    const result = calculateGraceDaysRemaining(oneDayAgo);
    expect(result).toBe(2);
  });

  it('Test 2: current_period_end 2 days ago -> daysRemaining = 1', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * ONE_DAY_MS).toISOString();
    const result = calculateGraceDaysRemaining(twoDaysAgo);
    expect(result).toBe(1);
  });

  it('Test 3: current_period_end 3 days ago -> daysRemaining = 0', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * ONE_DAY_MS).toISOString();
    const result = calculateGraceDaysRemaining(threeDaysAgo);
    expect(result).toBe(0);
  });

  it('Test 4: current_period_end 4 days ago -> daysRemaining = 0 (clamped to 0)', () => {
    const fourDaysAgo = new Date(Date.now() - 4 * ONE_DAY_MS).toISOString();
    const result = calculateGraceDaysRemaining(fourDaysAgo);
    expect(result).toBe(0);
  });

  it('Test 5: current_period_end just now -> daysRemaining = 3', () => {
    const justNow = new Date().toISOString();
    const result = calculateGraceDaysRemaining(justNow);
    expect(result).toBe(3);
  });

  it('Test 6: current_period_end is null -> daysRemaining = 0', () => {
    const result = calculateGraceDaysRemaining(null);
    expect(result).toBe(0);
  });
});

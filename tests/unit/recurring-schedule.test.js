import { calculateNextDate } from '../../src/lib/recurring-calculations.js';

describe('calculateNextDate (D-16, D-17)', () => {
  test('weekly: calculates next weekly date from start', () => {
    // Start: 2026-01-06 (Tuesday), current next was 2026-04-01
    // Next should be 2026-04-07 (next Tuesday after today 2026-04-01)
    const result = calculateNextDate('2026-01-06', 'weekly', '2026-04-01');
    expect(result).toBe('2026-04-07');
  });

  test('monthly: anchors to start date to avoid drift', () => {
    // Start: 2026-01-31, after generating March, next should be April 30 (not drift to March 28+1month)
    const result = calculateNextDate('2026-01-31', 'monthly', '2026-03-31');
    expect(result).toBe('2026-04-30');
  });

  test('monthly: standard case', () => {
    // Start: 2026-01-15, next after 2026-04-01 should be 2026-04-15
    const result = calculateNextDate('2026-01-15', 'monthly', '2026-04-01');
    expect(result).toBe('2026-04-15');
  });

  test('quarterly: calculates 3-month intervals from start', () => {
    // Start: 2026-01-01, quarterly = every 3 months
    // Occurrences: Jan 1, Apr 1, Jul 1, Oct 1
    // If currentNext is 2026-04-01, next should be 2026-07-01
    const result = calculateNextDate('2026-01-01', 'quarterly', '2026-04-01');
    expect(result).toBe('2026-07-01');
  });

  test('annually: calculates yearly intervals from start', () => {
    // Start: 2026-03-15, next after 2026-04-01 should be 2027-03-15
    const result = calculateNextDate('2026-03-15', 'annually', '2026-04-01');
    expect(result).toBe('2027-03-15');
  });

  test('handles case where start date is in the future', () => {
    // Start: 2026-05-01, today is 2026-04-01 — next should be 2026-05-01
    const result = calculateNextDate('2026-05-01', 'monthly', '2026-04-01');
    expect(result).toBe('2026-05-01');
  });
});

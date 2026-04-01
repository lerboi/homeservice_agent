import { formatEstimateNumber } from '../../src/lib/estimate-number.js';

describe('formatEstimateNumber (D-07)', () => {
  test('formats with default prefix', () => {
    expect(formatEstimateNumber('EST', 2026, 1)).toBe('EST-2026-0001');
  });

  test('pads sequence number to 4 digits', () => {
    expect(formatEstimateNumber('EST', 2026, 42)).toBe('EST-2026-0042');
  });

  test('handles custom prefix', () => {
    expect(formatEstimateNumber('QTE', 2026, 100)).toBe('QTE-2026-0100');
  });

  test('handles large sequence numbers', () => {
    expect(formatEstimateNumber('EST', 2026, 9999)).toBe('EST-2026-9999');
  });
});

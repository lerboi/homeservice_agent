import { calculateLateFee, shouldApplyLateFee } from '../../src/lib/late-fee-calculations.js';

describe('calculateLateFee (D-14)', () => {
  test('calculates flat fee correctly', () => {
    const result = calculateLateFee({
      invoiceTotal: 1000,
      lateFeeType: 'flat',
      lateFeeAmount: 25,
      existingLateFeeSum: 0,
    });
    expect(result.feeAmount).toBe(25);
  });

  test('calculates percentage fee on original total (excludes existing late fees)', () => {
    const result = calculateLateFee({
      invoiceTotal: 1000,
      lateFeeType: 'percentage',
      lateFeeAmount: 1.5,
      existingLateFeeSum: 15,
    });
    // 1.5% of (1000 - 15) = 1.5% of 985 = 14.775
    // Per RESEARCH: apply to original total, not compounded
    // Original total = invoiceTotal - existingLateFeeSum
    expect(result.feeAmount).toBe(14.78); // rounded to 2 decimal places
  });

  test('calculates percentage fee when no existing late fees', () => {
    const result = calculateLateFee({
      invoiceTotal: 2000,
      lateFeeType: 'percentage',
      lateFeeAmount: 2,
      existingLateFeeSum: 0,
    });
    expect(result.feeAmount).toBe(40); // 2% of 2000
  });

  test('returns zero fee when lateFeeAmount is 0', () => {
    const result = calculateLateFee({
      invoiceTotal: 1000,
      lateFeeType: 'flat',
      lateFeeAmount: 0,
      existingLateFeeSum: 0,
    });
    expect(result.feeAmount).toBe(0);
  });
});

describe('shouldApplyLateFee (D-14)', () => {
  test('flat fee: applies when never applied before', () => {
    expect(shouldApplyLateFee({
      lateFeeType: 'flat',
      lateFeeAppliedAt: null,
      today: '2026-04-01',
    })).toBe(true);
  });

  test('flat fee: does not re-apply once applied', () => {
    expect(shouldApplyLateFee({
      lateFeeType: 'flat',
      lateFeeAppliedAt: '2026-03-20T00:00:00Z',
      today: '2026-04-01',
    })).toBe(false);
  });

  test('percentage fee: applies when never applied', () => {
    expect(shouldApplyLateFee({
      lateFeeType: 'percentage',
      lateFeeAppliedAt: null,
      today: '2026-04-01',
    })).toBe(true);
  });

  test('percentage fee: re-applies after 30+ days', () => {
    expect(shouldApplyLateFee({
      lateFeeType: 'percentage',
      lateFeeAppliedAt: '2026-02-28T00:00:00Z',
      today: '2026-04-01',
    })).toBe(true);
  });

  test('percentage fee: does not re-apply within 30 days', () => {
    expect(shouldApplyLateFee({
      lateFeeType: 'percentage',
      lateFeeAppliedAt: '2026-03-15T00:00:00Z',
      today: '2026-04-01',
    })).toBe(false);
  });
});

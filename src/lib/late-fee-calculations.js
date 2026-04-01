/**
 * Pure functions for late fee calculation and application guard.
 * No side effects, no DB calls — safe to use in both client and server contexts.
 * Tested by Wave 0 tests (tests/unit/late-fee.test.js).
 */

/**
 * Calculate late fee amount based on type and invoice total.
 * For percentage type, applies to original total (excludes existing late fees).
 *
 * @param {{ invoiceTotal: number, lateFeeType: 'flat'|'percentage', lateFeeAmount: number, existingLateFeeSum: number }} params
 * @returns {{ feeAmount: number }}
 */
export function calculateLateFee({ invoiceTotal, lateFeeType, lateFeeAmount, existingLateFeeSum }) {
  if (lateFeeType === 'flat') {
    return { feeAmount: lateFeeAmount };
  }
  // Percentage: apply to original total (total minus existing late fees)
  const originalTotal = invoiceTotal - existingLateFeeSum;
  const feeAmount = Math.round(originalTotal * lateFeeAmount / 100 * 100) / 100;
  return { feeAmount };
}

/**
 * Determine whether a late fee should be applied.
 * Flat: only once (never re-apply). Percentage: re-apply after 30+ days.
 *
 * @param {{ lateFeeType: 'flat'|'percentage', lateFeeAppliedAt: string|null, today: string }} params
 * @returns {boolean}
 */
export function shouldApplyLateFee({ lateFeeType, lateFeeAppliedAt, today }) {
  if (!lateFeeAppliedAt) return true;
  if (lateFeeType === 'flat') return false;
  // Percentage: check if 30+ days since last application
  const lastApplied = new Date(lateFeeAppliedAt);
  const todayDate = new Date(today);
  const diffDays = Math.floor((todayDate - lastApplied) / (1000 * 60 * 60 * 24));
  return diffDays >= 30;
}

/**
 * Estimate number formatting utilities.
 */

/**
 * Format an estimate number in the pattern: {PREFIX}-{YEAR}-{NNNN}
 *
 * Same pattern as formatInvoiceNumber but for estimates (per D-07).
 * The sequence number is zero-padded to at least 4 digits.
 * Numbers exceeding 4 digits are NOT truncated.
 *
 * Examples:
 *   formatEstimateNumber('EST', 2026, 1)     => 'EST-2026-0001'
 *   formatEstimateNumber('QTE', 2026, 42)    => 'QTE-2026-0042'
 *   formatEstimateNumber('EST', 2026, 9999)  => 'EST-2026-9999'
 *   formatEstimateNumber('EST', 2026, 10000) => 'EST-2026-10000'
 *
 * @param {string} prefix - Estimate prefix (e.g. 'EST', 'QTE')
 * @param {number} year - 4-digit year
 * @param {number} sequenceNumber - Sequence number for this tenant/year
 * @returns {string} Formatted estimate number
 */
export function formatEstimateNumber(prefix, year, sequenceNumber) {
  return `${prefix}-${year}-${String(sequenceNumber).padStart(4, '0')}`;
}

/**
 * Invoice number formatting utilities.
 */

/**
 * Format an invoice number in the pattern: {PREFIX}-{YEAR}-{NNNN}
 *
 * The sequence number is zero-padded to at least 4 digits.
 * Numbers exceeding 4 digits are NOT truncated.
 *
 * Examples:
 *   formatInvoiceNumber('INV', 2026, 1)     => 'INV-2026-0001'
 *   formatInvoiceNumber('SP', 2026, 42)     => 'SP-2026-0042'
 *   formatInvoiceNumber('INV', 2026, 9999)  => 'INV-2026-9999'
 *   formatInvoiceNumber('INV', 2026, 10000) => 'INV-2026-10000'
 *
 * @param {string} prefix - Invoice prefix (e.g. 'INV', 'SP')
 * @param {number} year - 4-digit year
 * @param {number} sequenceNumber - Sequence number for this tenant/year
 * @returns {string} Formatted invoice number
 */
export function formatInvoiceNumber(prefix, year, sequenceNumber) {
  return `${prefix}-${year}-${String(sequenceNumber).padStart(4, '0')}`;
}

/**
 * Invoice number formatting.
 * Returns a formatted invoice number: {PREFIX}-{YEAR}-{NNNN}
 * The sequence number is zero-padded to 4 digits minimum, but never truncated.
 *
 * @param {string} prefix - e.g. 'INV', 'SP'
 * @param {number} year - 4-digit year, e.g. 2026
 * @param {number} sequenceNumber - integer >= 1
 * @returns {string} e.g. 'INV-2026-0001'
 */
export function formatInvoiceNumber(prefix, year, sequenceNumber) {
  return `${prefix}-${year}-${String(sequenceNumber).padStart(4, '0')}`;
}

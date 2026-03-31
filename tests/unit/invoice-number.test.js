import { formatInvoiceNumber } from '../../src/lib/invoice-number.js';

describe('formatInvoiceNumber', () => {
  test('formats with 4-digit zero-padded sequence number', () => {
    expect(formatInvoiceNumber('INV', 2026, 1)).toBe('INV-2026-0001');
  });

  test('handles short prefix', () => {
    expect(formatInvoiceNumber('SP', 2026, 42)).toBe('SP-2026-0042');
  });

  test('formats 4-digit number without padding', () => {
    expect(formatInvoiceNumber('INV', 2026, 9999)).toBe('INV-2026-9999');
  });

  test('does not truncate numbers exceeding 4 digits', () => {
    expect(formatInvoiceNumber('INV', 2026, 10000)).toBe('INV-2026-10000');
  });

  test('handles 3-digit number with padding', () => {
    expect(formatInvoiceNumber('INV', 2026, 100)).toBe('INV-2026-0100');
  });

  test('handles 2-digit number with padding', () => {
    expect(formatInvoiceNumber('ABC', 2027, 5)).toBe('ABC-2027-0005');
  });
});

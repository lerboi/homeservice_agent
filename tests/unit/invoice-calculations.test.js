import { calculateLineTotal, calculateInvoiceTotals } from '../../src/lib/invoice-calculations.js';

describe('calculateLineTotal', () => {
  test('labor: quantity * unit_price', () => {
    expect(calculateLineTotal('labor', { quantity: 3, unit_price: 75 })).toBe(225);
  });

  test('materials: quantity * unit_price * (1 + markup_pct)', () => {
    expect(calculateLineTotal('materials', { quantity: 10, unit_price: 5, markup_pct: 0.20 })).toBe(60);
  });

  test('travel: unit_price only (quantity ignored)', () => {
    expect(calculateLineTotal('travel', { quantity: 5, unit_price: 50 })).toBe(50);
  });

  test('flat_rate: unit_price only', () => {
    expect(calculateLineTotal('flat_rate', { quantity: 3, unit_price: 200 })).toBe(200);
  });

  test('discount: always negative', () => {
    expect(calculateLineTotal('discount', { unit_price: 50 })).toBe(-50);
  });

  test('discount: negative input stays negative', () => {
    expect(calculateLineTotal('discount', { unit_price: -50 })).toBe(-50);
  });

  test('labor: uses default quantity of 1 when not provided', () => {
    expect(calculateLineTotal('labor', { unit_price: 100 })).toBe(100);
  });
});

describe('calculateInvoiceTotals', () => {
  test('tax applies only to taxable items', () => {
    const lineItems = [
      { item_type: 'labor', quantity: 2, unit_price: 100, markup_pct: 0, taxable: true },    // $200 taxable
      { item_type: 'labor', quantity: 1, unit_price: 100, markup_pct: 0, taxable: true },    // $100 taxable
      { item_type: 'flat_rate', quantity: 1, unit_price: 100, markup_pct: 0, taxable: false }, // $100 non-taxable
    ];
    const result = calculateInvoiceTotals(lineItems, 0.0825);
    expect(result.subtotal).toBe(400);
    expect(result.tax_amount).toBe(24.75); // $300 * 0.0825
    expect(result.total).toBe(424.75);
  });

  test('returns subtotal, tax_amount, total', () => {
    const lineItems = [
      { item_type: 'labor', quantity: 1, unit_price: 100, markup_pct: 0, taxable: true },
    ];
    const result = calculateInvoiceTotals(lineItems, 0.10);
    expect(result).toHaveProperty('subtotal');
    expect(result).toHaveProperty('tax_amount');
    expect(result).toHaveProperty('total');
  });

  test('zero tax rate produces zero tax_amount', () => {
    const lineItems = [
      { item_type: 'labor', quantity: 2, unit_price: 50, markup_pct: 0, taxable: true },
    ];
    const result = calculateInvoiceTotals(lineItems, 0);
    expect(result.subtotal).toBe(100);
    expect(result.tax_amount).toBe(0);
    expect(result.total).toBe(100);
  });

  test('empty line items returns zeroes', () => {
    const result = calculateInvoiceTotals([], 0.0825);
    expect(result.subtotal).toBe(0);
    expect(result.tax_amount).toBe(0);
    expect(result.total).toBe(0);
  });

  test('materials with markup included in taxable base', () => {
    const lineItems = [
      { item_type: 'materials', quantity: 10, unit_price: 5, markup_pct: 0.20, taxable: true }, // $60 taxable
    ];
    const result = calculateInvoiceTotals(lineItems, 0.10);
    expect(result.subtotal).toBe(60);
    expect(result.tax_amount).toBe(6);
    expect(result.total).toBe(66);
  });
});

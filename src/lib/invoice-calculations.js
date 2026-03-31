/**
 * Pure calculation functions for invoice line items and totals.
 *
 * Line total rules per item type:
 *   labor      — quantity * unit_price
 *   materials  — quantity * unit_price * (1 + markup_pct)
 *   travel     — unit_price (quantity ignored)
 *   flat_rate  — unit_price
 *   discount   — -Math.abs(unit_price) (always negative)
 */

/**
 * Calculate the line total for a single line item.
 *
 * @param {string} type - 'labor' | 'materials' | 'travel' | 'flat_rate' | 'discount'
 * @param {{ quantity?: number, unit_price?: number, markup_pct?: number }} params
 * @returns {number} line total (2 decimal places)
 */
export function calculateLineTotal(type, { quantity = 1, unit_price = 0, markup_pct = 0 } = {}) {
  let total;
  switch (type) {
    case 'labor':
      total = quantity * unit_price;
      break;
    case 'materials':
      total = quantity * unit_price * (1 + markup_pct);
      break;
    case 'travel':
      total = unit_price;
      break;
    case 'flat_rate':
      total = unit_price;
      break;
    case 'discount':
      total = -Math.abs(unit_price);
      break;
    default:
      total = 0;
  }
  return Number(total.toFixed(2));
}

/**
 * Calculate invoice totals from an array of line items.
 *
 * @param {Array<{ item_type: string, quantity?: number, unit_price?: number, markup_pct?: number, taxable?: boolean }>} lineItems
 * @param {number} taxRate - e.g. 0.0825 for 8.25%
 * @returns {{ subtotal: number, tax_amount: number, total: number }}
 */
export function calculateInvoiceTotals(lineItems = [], taxRate = 0) {
  let subtotal = 0;
  let taxableSubtotal = 0;

  for (const item of lineItems) {
    const lineTotal = calculateLineTotal(item.item_type, {
      quantity: item.quantity,
      unit_price: item.unit_price,
      markup_pct: item.markup_pct,
    });
    subtotal += lineTotal;
    if (item.taxable !== false) {
      taxableSubtotal += lineTotal;
    }
  }

  const tax_amount = Number((taxableSubtotal * taxRate).toFixed(2));
  const total = Number((subtotal + tax_amount).toFixed(2));

  return {
    subtotal: Number(subtotal.toFixed(2)),
    tax_amount,
    total,
  };
}

/**
 * Calculate the new invoice status based on payment state.
 * Pure function — no side effects, no database calls.
 *
 * @param {Object} params
 * @param {number} params.invoiceTotal - Invoice total amount
 * @param {number} params.paymentsSum - Sum of all recorded payments
 * @param {string} params.currentStatus - Current invoice status
 * @param {string} params.dueDate - Due date (YYYY-MM-DD)
 * @param {string} params.today - Today's date (YYYY-MM-DD)
 * @returns {{ balance: number, newStatus: string }}
 */
export function calculatePaymentStatus({ invoiceTotal, paymentsSum, currentStatus, dueDate, today }) {
  // Do not auto-transition draft or void
  if (currentStatus === 'draft' || currentStatus === 'void') {
    return { balance: invoiceTotal - paymentsSum, newStatus: currentStatus };
  }

  const balance = Math.max(0, invoiceTotal - paymentsSum);

  if (balance <= 0) {
    return { balance: 0, newStatus: 'paid' };
  }

  if (paymentsSum > 0) {
    return { balance, newStatus: 'partially_paid' };
  }

  // No payments — check if overdue
  if (dueDate && today > dueDate) {
    return { balance, newStatus: 'overdue' };
  }

  return { balance, newStatus: 'sent' };
}

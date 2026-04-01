import { calculatePaymentStatus } from '../../src/lib/payment-calculations.js';

describe('calculatePaymentStatus (D-08, D-09)', () => {
  const today = '2026-04-01';

  test('returns paid when balance is zero', () => {
    const result = calculatePaymentStatus({
      invoiceTotal: 500,
      paymentsSum: 500,
      currentStatus: 'sent',
      dueDate: '2026-04-15',
      today,
    });
    expect(result.balance).toBe(0);
    expect(result.newStatus).toBe('paid');
  });

  test('returns paid when payments exceed total', () => {
    const result = calculatePaymentStatus({
      invoiceTotal: 500,
      paymentsSum: 550,
      currentStatus: 'sent',
      dueDate: '2026-04-15',
      today,
    });
    expect(result.balance).toBe(0);
    expect(result.newStatus).toBe('paid');
  });

  test('returns partially_paid when payments exist but balance > 0', () => {
    const result = calculatePaymentStatus({
      invoiceTotal: 1000,
      paymentsSum: 300,
      currentStatus: 'sent',
      dueDate: '2026-04-15',
      today,
    });
    expect(result.balance).toBe(700);
    expect(result.newStatus).toBe('partially_paid');
  });

  test('returns overdue when no payments and past due date', () => {
    const result = calculatePaymentStatus({
      invoiceTotal: 500,
      paymentsSum: 0,
      currentStatus: 'sent',
      dueDate: '2026-03-15',
      today,
    });
    expect(result.balance).toBe(500);
    expect(result.newStatus).toBe('overdue');
  });

  test('returns sent when no payments and before due date', () => {
    const result = calculatePaymentStatus({
      invoiceTotal: 500,
      paymentsSum: 0,
      currentStatus: 'sent',
      dueDate: '2026-04-15',
      today,
    });
    expect(result.balance).toBe(500);
    expect(result.newStatus).toBe('sent');
  });

  test('does not auto-transition draft status', () => {
    const result = calculatePaymentStatus({
      invoiceTotal: 500,
      paymentsSum: 0,
      currentStatus: 'draft',
      dueDate: '2026-03-15',
      today,
    });
    expect(result.newStatus).toBe('draft');
  });

  test('does not auto-transition void status', () => {
    const result = calculatePaymentStatus({
      invoiceTotal: 500,
      paymentsSum: 0,
      currentStatus: 'void',
      dueDate: '2026-03-15',
      today,
    });
    expect(result.newStatus).toBe('void');
  });
});

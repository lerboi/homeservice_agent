/**
 * Unit tests for bidirectional sync guard logic (Plan 33-07).
 *
 * Tests the pure functions that decide whether an invoice status change
 * should propagate to its linked lead (and vice-versa), and whether the
 * sync_source flag correctly prevents circular updates.
 */

import { shouldSyncToLead, shouldSyncToInvoice } from '../../src/lib/invoice-sync.js';

// ─── shouldSyncToLead ─────────────────────────────────────────────────────────

describe('shouldSyncToLead', () => {
  test('returns true when invoice paid, has linked lead, and no sync_source', () => {
    expect(shouldSyncToLead('paid', '123', undefined)).toBe(true);
  });

  test('returns false when no linked lead (null)', () => {
    expect(shouldSyncToLead('paid', null, undefined)).toBe(false);
  });

  test('returns false when sync_source is lead_paid (prevents circular update)', () => {
    expect(shouldSyncToLead('paid', '123', 'lead_paid')).toBe(false);
  });

  test('returns false when invoice status is not paid', () => {
    expect(shouldSyncToLead('draft', '123', undefined)).toBe(false);
  });

  test('returns false when invoice status is sent (not paid)', () => {
    expect(shouldSyncToLead('sent', '123', undefined)).toBe(false);
  });

  test('returns false when invoice status is overdue (not paid)', () => {
    expect(shouldSyncToLead('overdue', '123', undefined)).toBe(false);
  });

  test('returns false when invoice status is void (not paid)', () => {
    expect(shouldSyncToLead('void', '123', undefined)).toBe(false);
  });
});

// ─── shouldSyncToInvoice ──────────────────────────────────────────────────────

describe('shouldSyncToInvoice', () => {
  test('returns true when lead paid and no sync_source', () => {
    expect(shouldSyncToInvoice('paid', undefined)).toBe(true);
  });

  test('returns false when sync_source is invoice_paid (prevents circular update)', () => {
    expect(shouldSyncToInvoice('paid', 'invoice_paid')).toBe(false);
  });

  test('returns false when lead status is completed (not paid)', () => {
    expect(shouldSyncToInvoice('completed', undefined)).toBe(false);
  });

  test('returns false when lead status is new', () => {
    expect(shouldSyncToInvoice('new', undefined)).toBe(false);
  });

  test('returns false when lead status is booked', () => {
    expect(shouldSyncToInvoice('booked', undefined)).toBe(false);
  });

  test('returns false when lead status is lost', () => {
    expect(shouldSyncToInvoice('lost', undefined)).toBe(false);
  });
});

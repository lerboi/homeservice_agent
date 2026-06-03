/**
 * Unit tests for bidirectional sync guard logic (Plan 33-07).
 *
 * Tests the pure functions that decide whether an invoice status change
 * should propagate to its linked job (and vice-versa), and whether the
 * sync_source flag correctly prevents circular updates.
 *
 * Phase 59 / prod-readiness 2026-06: invoices link to a JOB (not a legacy lead).
 * shouldSyncToLead → shouldSyncToJob; circular-prevention token lead_paid → job_paid.
 */

import { shouldSyncToJob, shouldSyncToInvoice } from '../../src/lib/invoice-sync.js';

// ─── shouldSyncToJob ──────────────────────────────────────────────────────────

describe('shouldSyncToJob', () => {
  test('returns true when invoice paid, has linked job, and no sync_source', () => {
    expect(shouldSyncToJob('paid', '123', undefined)).toBe(true);
  });

  test('returns false when no linked job (null)', () => {
    expect(shouldSyncToJob('paid', null, undefined)).toBe(false);
  });

  test('returns false when sync_source is job_paid (prevents circular update)', () => {
    expect(shouldSyncToJob('paid', '123', 'job_paid')).toBe(false);
  });

  test('returns false when invoice status is not paid', () => {
    expect(shouldSyncToJob('draft', '123', undefined)).toBe(false);
  });

  test('returns false when invoice status is sent (not paid)', () => {
    expect(shouldSyncToJob('sent', '123', undefined)).toBe(false);
  });

  test('returns false when invoice status is overdue (not paid)', () => {
    expect(shouldSyncToJob('overdue', '123', undefined)).toBe(false);
  });

  test('returns false when invoice status is void (not paid)', () => {
    expect(shouldSyncToJob('void', '123', undefined)).toBe(false);
  });
});

// ─── shouldSyncToInvoice ──────────────────────────────────────────────────────

describe('shouldSyncToInvoice', () => {
  test('returns true when job paid and no sync_source', () => {
    expect(shouldSyncToInvoice('paid', undefined)).toBe(true);
  });

  test('returns false when sync_source is invoice_paid (prevents circular update)', () => {
    expect(shouldSyncToInvoice('paid', 'invoice_paid')).toBe(false);
  });

  test('returns false when job status is completed (not paid)', () => {
    expect(shouldSyncToInvoice('completed', undefined)).toBe(false);
  });

  test('returns false when job status is scheduled', () => {
    expect(shouldSyncToInvoice('scheduled', undefined)).toBe(false);
  });

  test('returns false when job status is lost', () => {
    expect(shouldSyncToInvoice('lost', undefined)).toBe(false);
  });
});

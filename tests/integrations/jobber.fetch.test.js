/**
 * Unit tests for fetchJobberCustomerByPhone (Phase 56 Plan 01).
 * Covers disconnected, no-match, full shape, status filter, ordering,
 * lastVisitDate, last_context_fetch_at touch, and never-throws contract.
 */

import { jest } from '@jest/globals';

// ─── Mocks ───────────────────────────────────────────────────────────────────
const mockMaybeSingle = jest.fn();
const mockUpdate = jest.fn(() => ({ eq: jest.fn().mockResolvedValue({ error: null }) }));
const fromChain = {
  select: function () { return this; },
  eq: function () { return this; },
  maybeSingle: () => mockMaybeSingle(),
  update: (payload) => mockUpdate(payload),
};
const mockFrom = jest.fn(() => fromChain);

jest.unstable_mockModule('@supabase/supabase-js', () => ({
  createClient: () => ({ from: mockFrom }),
}));

const mockRequest = jest.fn();
jest.unstable_mockModule('graphql-request', () => ({
  GraphQLClient: jest.fn().mockImplementation(() => ({ request: mockRequest })),
  gql: (strings) => strings[0],
}));

const mockRefresh = jest.fn();
jest.unstable_mockModule('@/lib/integrations/adapter', () => ({
  refreshTokenIfNeeded: mockRefresh,
  getIntegrationAdapter: jest.fn(),
}));

jest.unstable_mockModule('next/cache', () => ({
  cacheTag: jest.fn(),
  revalidateTag: jest.fn(),
}));

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
process.env.JOBBER_CLIENT_ID = 'cid';
process.env.JOBBER_CLIENT_SECRET = 'csec';

let fetchJobberCustomerByPhone;
beforeAll(async () => {
  ({ fetchJobberCustomerByPhone } = await import('@/lib/integrations/jobber'));
});

beforeEach(() => {
  jest.clearAllMocks();
  mockRefresh.mockImplementation(async (_admin, cred) => cred);
});

describe('fetchJobberCustomerByPhone', () => {
  it('F1: returns { client: null } when no accounting_credentials row', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null });
    const r = await fetchJobberCustomerByPhone('t1', '+15551234567');
    expect(r).toEqual({ client: null });
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('F2: returns { client: null } when no phone normalizes to match', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: 'cred-1', access_token: 'tok' } });
    mockRequest.mockResolvedValue({
      clients: { nodes: [{ id: 'c1', name: 'X', phones: [{ number: '(999) 888-7777' }] }] },
    });
    const r = await fetchJobberCustomerByPhone('t1', '+15551234567');
    expect(r).toEqual({ client: null });
  });

  it('F3: matches "(555) 123-4567" ↔ +15551234567 and returns full shape', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: 'cred-1', access_token: 'tok' } });
    mockRequest.mockResolvedValue({
      clients: { nodes: [{
        id: 'c1', name: 'John Smith',
        emails: [{ address: 'john@example.com' }],
        phones: [{ number: '(555) 123-4567' }],
        jobs: { nodes: [
          { jobNumber: 'JBN-204', title: 'AC install', jobStatus: 'upcoming',
            startAt: '2026-04-20T09:00:00Z', endAt: '2026-04-20T11:00:00Z',
            visits: { nodes: [{ startAt: '2026-04-20T09:00:00Z' }] } },
        ]},
        invoices: { nodes: [
          { invoiceNumber: 'INV-100', issuedDate: '2026-04-01', amount: 500, amountOutstanding: 500, invoiceStatus: 'AWAITING_PAYMENT' },
          { invoiceNumber: 'INV-099', issuedDate: '2026-03-01', amount: 200, amountOutstanding: 0, invoiceStatus: 'PAID' },
        ]},
        visits: { nodes: [{ endAt: '2026-04-15T14:00:00Z', completedAt: '2026-04-15T14:05:00Z' }] },
      }]},
    });
    const r = await fetchJobberCustomerByPhone('t1', '+15551234567');
    expect(r.client).toEqual({ id: 'c1', name: 'John Smith', email: 'john@example.com' });
    expect(r.recentJobs).toHaveLength(1);
    expect(r.recentJobs[0].jobNumber).toBe('JBN-204');
    expect(r.lastVisitDate).toBe('2026-04-15T14:00:00Z');
  });

  it('F4: outstandingBalance excludes DRAFT/PAID/VOIDED', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: 'cred-1', access_token: 'tok' } });
    mockRequest.mockResolvedValue({
      clients: { nodes: [{
        id: 'c1', name: 'X', phones: [{ number: '+15551234567' }],
        jobs: { nodes: [] },
        invoices: { nodes: [
          { invoiceNumber: 'A', issuedDate: '2026-04-01', amount: 100, amountOutstanding: 100, invoiceStatus: 'AWAITING_PAYMENT' },
          { invoiceNumber: 'B', issuedDate: '2026-04-01', amount: 200, amountOutstanding: 200, invoiceStatus: 'PAST_DUE' },
          { invoiceNumber: 'C', issuedDate: '2026-04-01', amount: 50, amountOutstanding: 50, invoiceStatus: 'DRAFT' },
          { invoiceNumber: 'D', issuedDate: '2026-04-01', amount: 999, amountOutstanding: 0, invoiceStatus: 'PAID' },
          { invoiceNumber: 'E', issuedDate: '2026-04-01', amount: 10, amountOutstanding: 10, invoiceStatus: 'VOIDED' },
        ]},
        visits: { nodes: [] },
      }]},
    });
    const r = await fetchJobberCustomerByPhone('t1', '+15551234567');
    expect(r.outstandingBalance).toBe(300);
    expect(r.outstandingInvoices).toHaveLength(2);
  });

  it('F5: recentJobs sorted — future nextVisitDate ASC first', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: 'cred-1', access_token: 'tok' } });
    const future1 = new Date(Date.now() + 86400000).toISOString();
    const future2 = new Date(Date.now() + 172800000).toISOString();
    mockRequest.mockResolvedValue({
      clients: { nodes: [{
        id: 'c1', name: 'X', phones: [{ number: '+15551234567' }],
        jobs: { nodes: [
          { jobNumber: 'OLD',  title: 'O', jobStatus: 'archived', startAt: null, endAt: null, visits: { nodes: [] } },
          { jobNumber: 'LATE', title: 'L', jobStatus: 'upcoming', startAt: null, endAt: null, visits: { nodes: [{ startAt: future2 }] } },
          { jobNumber: 'SOON', title: 'S', jobStatus: 'today',    startAt: null, endAt: null, visits: { nodes: [{ startAt: future1 }] } },
        ]},
        invoices: { nodes: [] },
        visits: { nodes: [] },
      }]},
    });
    const r = await fetchJobberCustomerByPhone('t1', '+15551234567');
    expect(r.recentJobs.map(j => j.jobNumber)).toEqual(['SOON', 'LATE', 'OLD']);
  });

  it('F6: lastVisitDate null when visits.nodes empty', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: 'cred-1', access_token: 'tok' } });
    mockRequest.mockResolvedValue({
      clients: { nodes: [{ id: 'c1', name: 'X', phones: [{ number: '+15551234567' }], jobs: { nodes: [] }, invoices: { nodes: [] }, visits: { nodes: [] } }]},
    });
    const r = await fetchJobberCustomerByPhone('t1', '+15551234567');
    expect(r.lastVisitDate).toBeNull();
  });

  it('F7: updates last_context_fetch_at on success', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: 'cred-1', access_token: 'tok' } });
    mockRequest.mockResolvedValue({
      clients: { nodes: [{ id: 'c1', name: 'X', phones: [{ number: '+15551234567' }], jobs: { nodes: [] }, invoices: { nodes: [] }, visits: { nodes: [] } }]},
    });
    await fetchJobberCustomerByPhone('t1', '+15551234567');
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ last_context_fetch_at: expect.any(String) }));
  });

  it('F8: returns { client: null } when refreshTokenIfNeeded throws (never throws out of cached fn)', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: 'cred-1', access_token: 'tok' } });
    mockRefresh.mockRejectedValue(new Error('refresh failed'));
    const r = await fetchJobberCustomerByPhone('t1', '+15551234567');
    expect(r).toEqual({ client: null });
  });
});

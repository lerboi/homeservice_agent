/**
 * Unit tests for XeroAdapter.fetchCustomerByPhone (Phase 55).
 * Covers disconnected, no-match, full-shape, no-PAID, and last_context_fetch_at touch.
 */

import { jest } from '@jest/globals';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockMaybeSingle = jest.fn();
const mockUpdate = jest.fn(() => ({ eq: jest.fn().mockResolvedValue({ error: null }) }));
const mockEq2 = jest.fn();
const mockEq1 = jest.fn();
const mockSelect = jest.fn();

// Chain: from().select().eq().eq().maybeSingle()
const fromChain = {
  select: () => { mockSelect(); return fromChain; },
  eq: (...args) => {
    if (args[0] === 'tenant_id') mockEq1(...args);
    else mockEq2(...args);
    return fromChain;
  },
  maybeSingle: () => mockMaybeSingle(),
  update: (payload) => mockUpdate(payload),
};
const mockFrom = jest.fn(() => fromChain);

jest.unstable_mockModule('@supabase/supabase-js', () => ({
  createClient: () => ({ from: mockFrom }),
}));

const mockGetContacts = jest.fn();
const mockGetInvoices = jest.fn();
const mockSetTokenSet = jest.fn();

jest.unstable_mockModule('xero-node', () => ({
  XeroClient: jest.fn().mockImplementation(() => ({
    accountingApi: { getContacts: mockGetContacts, getInvoices: mockGetInvoices },
    setTokenSet: mockSetTokenSet,
    buildConsentUrl: jest.fn(),
    apiCallback: jest.fn(),
    updateTenants: jest.fn(),
    refreshToken: jest.fn(),
  })),
}));

jest.unstable_mockModule('@/lib/integrations/adapter', () => ({
  refreshTokenIfNeeded: jest.fn(async (_admin, cred) => cred),
  getIntegrationAdapter: jest.fn(),
}));

jest.unstable_mockModule('next/cache', () => ({
  cacheTag: jest.fn(),
  revalidateTag: jest.fn(),
}));

let XeroAdapter;
beforeAll(async () => {
  ({ XeroAdapter } = await import('@/lib/integrations/xero'));
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('XeroAdapter.fetchCustomerByPhone', () => {
  it('returns { contact: null } when accounting_credentials row missing', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null });
    const adapter = new XeroAdapter();
    const result = await adapter.fetchCustomerByPhone('tenant-1', '+15551234567');
    expect(result).toEqual({ contact: null });
    expect(mockGetContacts).not.toHaveBeenCalled();
  });

  it('returns { contact: null } when no Xero contact matches phone (post-filter)', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'cred-1', tenant_id: 'tenant-1', xero_tenant_id: 'org-1', access_token: 'tok' },
    });
    mockGetContacts.mockResolvedValue({
      body: { contacts: [{ contactID: 'c1', phones: [{ phoneNumber: '+19998887777' }] }] },
    });
    const adapter = new XeroAdapter();
    const result = await adapter.fetchCustomerByPhone('tenant-1', '+15551234567');
    expect(result).toEqual({ contact: null });
  });

  it('returns full shape with outstandingBalance summed across AUTHORISED amountDue>0', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'cred-1', tenant_id: 'tenant-1', xero_tenant_id: 'org-1', access_token: 'tok' },
    });
    mockGetContacts.mockResolvedValue({
      body: { contacts: [{
        contactID: 'c1', name: 'John Smith',
        phones: [{ phoneNumber: '+15551234567' }],
      }] },
    });
    mockGetInvoices
      .mockResolvedValueOnce({ body: { invoices: [
        { amountDue: 500, status: 'AUTHORISED' },
        { amountDue: 347.25, status: 'AUTHORISED' },
      ] } })
      .mockResolvedValueOnce({ body: { invoices: [
        { invoiceNumber: 'INV-1042', date: '2026-04-10', total: 500, amountDue: 500, status: 'AUTHORISED', reference: 'Repair', fullyPaidOnDate: null },
        { invoiceNumber: 'INV-1041', date: '2026-04-01', total: 250, amountDue: 0, status: 'PAID', reference: 'Service', fullyPaidOnDate: '2026-04-05' },
        { invoiceNumber: 'INV-1040', date: '2026-03-20', total: 800, amountDue: 0, status: 'PAID', reference: 'Install', fullyPaidOnDate: '2026-03-25' },
        { invoiceNumber: 'INV-1039', date: '2026-03-01', total: 150, amountDue: 0, status: 'PAID', reference: 'Tune-up', fullyPaidOnDate: '2026-03-05' },
      ] } });

    const adapter = new XeroAdapter();
    const result = await adapter.fetchCustomerByPhone('tenant-1', '+15551234567');
    expect(result.contact?.contactID).toBe('c1');
    expect(result.outstandingBalance).toBeCloseTo(847.25);
    expect(result.lastInvoices).toHaveLength(3);
    expect(result.lastInvoices[0].invoiceNumber).toBe('INV-1042');
    expect(result.lastPaymentDate).toBe('2026-04-05');
  });

  it('lastPaymentDate is null when no PAID invoices', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'cred-1', tenant_id: 'tenant-1', xero_tenant_id: 'org-1', access_token: 'tok' },
    });
    mockGetContacts.mockResolvedValue({
      body: { contacts: [{ contactID: 'c1', phones: [{ phoneNumber: '+15551234567' }] }] },
    });
    mockGetInvoices
      .mockResolvedValueOnce({ body: { invoices: [] } })
      .mockResolvedValueOnce({ body: { invoices: [
        { invoiceNumber: 'INV-1', date: '2026-04-01', total: 100, amountDue: 100, status: 'AUTHORISED', fullyPaidOnDate: null },
      ] } });
    const adapter = new XeroAdapter();
    const result = await adapter.fetchCustomerByPhone('tenant-1', '+15551234567');
    expect(result.lastPaymentDate).toBeNull();
  });

  it('updates last_context_fetch_at on successful fetch', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'cred-1', tenant_id: 'tenant-1', xero_tenant_id: 'org-1', access_token: 'tok' },
    });
    mockGetContacts.mockResolvedValue({
      body: { contacts: [{ contactID: 'c1', phones: [{ phoneNumber: '+15551234567' }] }] },
    });
    mockGetInvoices
      .mockResolvedValueOnce({ body: { invoices: [] } })
      .mockResolvedValueOnce({ body: { invoices: [] } });
    const adapter = new XeroAdapter();
    await adapter.fetchCustomerByPhone('tenant-1', '+15551234567');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ last_context_fetch_at: expect.any(String) }),
    );
  });

  it('rejects malformed phone (non-E.164) and returns { contact: null }', async () => {
    const adapter = new XeroAdapter();
    const result = await adapter.fetchCustomerByPhone('tenant-1', '5551234567');
    expect(result).toEqual({ contact: null });
    expect(mockGetContacts).not.toHaveBeenCalled();
  });
});

/**
 * Tests for getLeads — filtering, sorting, and field selection.
 * Uses jest.unstable_mockModule pattern established in the project.
 */

import { jest } from '@jest/globals';

// ─── Supabase mock ────────────────────────────────────────────────────────────

const mockOrder = jest.fn();
const mockEq = jest.fn();
const mockIn = jest.fn();
const mockOr = jest.fn();
const mockGte = jest.fn();
const mockLte = jest.fn();
const mockSelect = jest.fn();

// Build a fresh chainable query per test
function makeLeadsQuery(resolvedData = []) {
  const q = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue({ data: resolvedData, error: null }),
  };
  // Track calls on the real mocks
  q.select.mockImplementation(() => q);
  q.eq.mockImplementation(() => q);
  q.in.mockImplementation(() => q);
  q.or.mockImplementation(() => q);
  q.gte.mockImplementation(() => q);
  q.lte.mockImplementation(() => q);
  q.order.mockImplementation(jest.fn().mockResolvedValue({ data: resolvedData, error: null }));
  return q;
}

let currentLeadsQuery;

const mockSupabase = {
  from: jest.fn((table) => {
    if (table === 'leads') return currentLeadsQuery;
    return { select: jest.fn().mockReturnThis() };
  }),
};

jest.unstable_mockModule('@/lib/supabase', () => ({
  supabase: mockSupabase,
}));

let getLeads;

beforeAll(async () => {
  const module = await import('@/lib/leads');
  getLeads = module.getLeads;
});

beforeEach(() => {
  jest.clearAllMocks();
});

const SAMPLE_LEADS = [
  {
    id: 'lead-1',
    tenant_id: 'tenant-uuid',
    from_number: '+15551234567',
    caller_name: 'John Doe',
    job_type: 'plumbing',
    status: 'new',
    urgency: 'routine',
    revenue_amount: null,
    created_at: '2026-03-20T10:00:00Z',
    calls: [],
  },
  {
    id: 'lead-2',
    tenant_id: 'tenant-uuid',
    from_number: '+15559876543',
    caller_name: 'Jane Smith',
    job_type: 'electrical',
    status: 'booked',
    urgency: 'emergency',
    revenue_amount: 450.00,
    created_at: '2026-03-19T08:00:00Z',
    calls: [],
  },
];

// ─── Base query behavior ──────────────────────────────────────────────────────

describe('getLeads - base behavior', () => {
  it('returns leads for tenant with joined call data', async () => {
    currentLeadsQuery = makeLeadsQuery(SAMPLE_LEADS);

    const result = await getLeads({ tenantId: 'tenant-uuid' });

    expect(result).toEqual(SAMPLE_LEADS);
    expect(mockSupabase.from).toHaveBeenCalledWith('leads');
    // Should join calls via lead_calls
    expect(currentLeadsQuery.select).toHaveBeenCalledWith(
      expect.stringContaining('calls')
    );
  });

  it('does NOT include transcript_text in select (performance)', async () => {
    currentLeadsQuery = makeLeadsQuery([]);

    await getLeads({ tenantId: 'tenant-uuid' });

    const selectCall = currentLeadsQuery.select.mock.calls[0][0];
    expect(selectCall).not.toContain('transcript_text');
  });

  it('orders results by created_at DESC (newest first) by default', async () => {
    currentLeadsQuery = makeLeadsQuery(SAMPLE_LEADS);

    await getLeads({ tenantId: 'tenant-uuid' });

    expect(currentLeadsQuery.order).toHaveBeenCalledWith(
      'created_at',
      expect.objectContaining({ ascending: false })
    );
  });

  it('filters by tenant_id', async () => {
    currentLeadsQuery = makeLeadsQuery([]);

    await getLeads({ tenantId: 'tenant-uuid' });

    expect(currentLeadsQuery.eq).toHaveBeenCalledWith('tenant_id', 'tenant-uuid');
  });
});

// ─── Filter params ────────────────────────────────────────────────────────────

describe('getLeads - filter params', () => {
  it('filters by status when status param is provided', async () => {
    currentLeadsQuery = makeLeadsQuery([SAMPLE_LEADS[0]]);

    await getLeads({ tenantId: 'tenant-uuid', status: 'new' });

    expect(currentLeadsQuery.eq).toHaveBeenCalledWith('status', 'new');
  });

  it('filters by urgency when urgency param is provided', async () => {
    currentLeadsQuery = makeLeadsQuery([SAMPLE_LEADS[1]]);

    await getLeads({ tenantId: 'tenant-uuid', urgency: 'emergency' });

    expect(currentLeadsQuery.eq).toHaveBeenCalledWith('urgency', 'emergency');
  });

  it('filters by date range when dateFrom is provided', async () => {
    currentLeadsQuery = makeLeadsQuery(SAMPLE_LEADS);

    await getLeads({ tenantId: 'tenant-uuid', dateFrom: '2026-03-19T00:00:00Z' });

    expect(currentLeadsQuery.gte).toHaveBeenCalledWith('created_at', '2026-03-19T00:00:00Z');
  });

  it('filters by date range when dateTo is provided', async () => {
    currentLeadsQuery = makeLeadsQuery(SAMPLE_LEADS);

    await getLeads({ tenantId: 'tenant-uuid', dateTo: '2026-03-20T23:59:59Z' });

    expect(currentLeadsQuery.lte).toHaveBeenCalledWith('created_at', '2026-03-20T23:59:59Z');
  });

  it('filters by job_type when jobType param is provided', async () => {
    currentLeadsQuery = makeLeadsQuery([SAMPLE_LEADS[0]]);

    await getLeads({ tenantId: 'tenant-uuid', jobType: 'plumbing' });

    expect(currentLeadsQuery.eq).toHaveBeenCalledWith('job_type', 'plumbing');
  });

  it('applies search filter using ilike on caller_name and from_number', async () => {
    currentLeadsQuery = makeLeadsQuery([SAMPLE_LEADS[0]]);

    await getLeads({ tenantId: 'tenant-uuid', search: 'John' });

    expect(currentLeadsQuery.or).toHaveBeenCalledWith(
      expect.stringContaining('caller_name.ilike.%John%')
    );
  });

  it('does NOT apply status filter when status param is not provided', async () => {
    currentLeadsQuery = makeLeadsQuery(SAMPLE_LEADS);

    await getLeads({ tenantId: 'tenant-uuid' });

    // eq should only be called once (for tenant_id), not for status
    const eqCalls = currentLeadsQuery.eq.mock.calls;
    const statusCalls = eqCalls.filter(([field]) => field === 'status');
    expect(statusCalls).toHaveLength(0);
  });
});

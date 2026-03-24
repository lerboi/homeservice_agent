/**
 * Tests for createOrMergeLead — repeat caller merge logic and short call filter.
 * Uses jest.unstable_mockModule pattern established in the project.
 */

import { jest } from '@jest/globals';

// ─── Supabase mock ────────────────────────────────────────────────────────────

// Dedicated insert mocks per table so we can assert independently
const mockLeadsInsert = jest.fn();
const mockLeadCallsInsert = jest.fn();
const mockActivityLogInsert = jest.fn();

/**
 * Chainable query builder for the leads table (has maybeSingle).
 */
function makeLeadsQuery() {
  const q = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    insert: mockLeadsInsert,
  };
  return q;
}

function makeLeadCallsQuery() {
  return {
    insert: mockLeadCallsInsert,
  };
}

function makeActivityLogQuery() {
  return {
    insert: mockActivityLogInsert,
  };
}

// Separate query instances per table so we can control return values per test
let leadsQuery;

const mockSupabase = {
  from: jest.fn((table) => {
    if (table === 'leads') return leadsQuery;
    if (table === 'lead_calls') return makeLeadCallsQuery();
    if (table === 'activity_log') return makeActivityLogQuery();
    return { select: jest.fn().mockReturnThis(), insert: jest.fn().mockResolvedValue({ data: null, error: null }) };
  }),
};

jest.unstable_mockModule('@/lib/supabase', () => ({
  supabase: mockSupabase,
}));

let createOrMergeLead;

beforeAll(async () => {
  const module = await import('@/lib/leads');
  createOrMergeLead = module.createOrMergeLead;
});

beforeEach(() => {
  jest.clearAllMocks();

  // Reset leads query
  leadsQuery = makeLeadsQuery();

  // Default: no existing lead
  leadsQuery.maybeSingle.mockResolvedValue({ data: null, error: null });

  // Default inserts succeed
  mockLeadsInsert.mockResolvedValue({ data: [{ id: 'new-lead-uuid' }], error: null });
  mockLeadCallsInsert.mockResolvedValue({ data: null, error: null });
  mockActivityLogInsert.mockResolvedValue({ data: null, error: null });
});

const BASE_PARAMS = {
  tenantId: 'tenant-uuid',
  callId: 'call-uuid',
  fromNumber: '+15551234567',
  callerName: 'Jane Smith',
  jobType: 'plumbing',
  serviceAddress: '123 Main St',
  triageResult: { urgency: 'routine' },
  appointmentId: null,
  callDuration: 60,
};

// ─── Short call filter ────────────────────────────────────────────────────────

describe('createOrMergeLead - short call filter', () => {
  it('returns null for calls with duration < 15 seconds', async () => {
    const result = await createOrMergeLead({ ...BASE_PARAMS, callDuration: 14 });
    expect(result).toBeNull();
  });

  it('returns null for calls with duration exactly 0', async () => {
    const result = await createOrMergeLead({ ...BASE_PARAMS, callDuration: 0 });
    expect(result).toBeNull();
  });

  it('does NOT return null for calls with duration exactly 15 seconds', async () => {
    leadsQuery.maybeSingle.mockResolvedValue({ data: null, error: null });
    mockLeadsInsert.mockResolvedValue({ data: [{ id: 'new-lead-uuid', status: 'new' }], error: null });
    const result = await createOrMergeLead({ ...BASE_PARAMS, callDuration: 15 });
    expect(result).not.toBeNull();
  });
});

// ─── New caller creates lead ──────────────────────────────────────────────────

describe('createOrMergeLead - new caller', () => {
  it('creates a new lead with status "new" when no existing lead', async () => {
    leadsQuery.maybeSingle.mockResolvedValue({ data: null, error: null });
    mockLeadsInsert.mockResolvedValue({
      data: [{ id: 'new-lead-uuid', status: 'new', urgency: 'routine' }],
      error: null,
    });

    const result = await createOrMergeLead(BASE_PARAMS);

    expect(mockLeadsInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ status: 'new' }),
      ])
    );
    expect(result).toMatchObject({ id: 'new-lead-uuid' });
  });

  it('inserts into lead_calls junction table after creating new lead', async () => {
    leadsQuery.maybeSingle.mockResolvedValue({ data: null, error: null });
    mockLeadsInsert.mockResolvedValueOnce({
      data: [{ id: 'new-lead-uuid', status: 'new' }],
      error: null,
    });
    mockLeadCallsInsert.mockResolvedValue({ data: null, error: null });

    await createOrMergeLead(BASE_PARAMS);

    expect(mockLeadCallsInsert).toHaveBeenCalledWith({
      lead_id: 'new-lead-uuid',
      call_id: 'call-uuid',
    });
  });

  it('sets status to "booked" when appointmentId is provided', async () => {
    leadsQuery.maybeSingle.mockResolvedValue({ data: null, error: null });
    mockLeadsInsert.mockResolvedValue({
      data: [{ id: 'new-lead-uuid', status: 'booked' }],
      error: null,
    });

    await createOrMergeLead({ ...BASE_PARAMS, appointmentId: 'appt-uuid' });

    expect(mockLeadsInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ status: 'booked', appointment_id: 'appt-uuid' }),
      ])
    );
  });

  it('logs activity_log entry with event_type "lead_created" for new leads', async () => {
    leadsQuery.maybeSingle.mockResolvedValue({ data: null, error: null });
    mockLeadsInsert.mockResolvedValueOnce({
      data: [{ id: 'new-lead-uuid', status: 'new' }],
      error: null,
    });
    mockActivityLogInsert.mockResolvedValue({ data: null, error: null });

    await createOrMergeLead(BASE_PARAMS);

    expect(mockActivityLogInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'tenant-uuid',
        event_type: 'lead_created',
        lead_id: 'new-lead-uuid',
      })
    );
  });
});

// ─── Repeat caller merge ──────────────────────────────────────────────────────

describe('createOrMergeLead - repeat caller merge', () => {
  it('attaches call to existing lead when existing lead has status "new"', async () => {
    const existingLead = { id: 'existing-lead-uuid', status: 'new' };
    leadsQuery.maybeSingle.mockResolvedValue({ data: existingLead, error: null });
    mockLeadCallsInsert.mockResolvedValue({ data: null, error: null });

    const result = await createOrMergeLead(BASE_PARAMS);

    expect(mockLeadCallsInsert).toHaveBeenCalledWith({
      lead_id: 'existing-lead-uuid',
      call_id: 'call-uuid',
    });
    // Should NOT create a new lead
    expect(mockLeadsInsert).not.toHaveBeenCalled();
    expect(result).toMatchObject({ id: 'existing-lead-uuid' });
  });

  it('attaches call to existing lead when existing lead has status "booked"', async () => {
    const existingLead = { id: 'booked-lead-uuid', status: 'booked' };
    leadsQuery.maybeSingle.mockResolvedValue({ data: existingLead, error: null });
    mockLeadCallsInsert.mockResolvedValue({ data: null, error: null });

    const result = await createOrMergeLead(BASE_PARAMS);

    expect(mockLeadCallsInsert).toHaveBeenCalledWith({
      lead_id: 'booked-lead-uuid',
      call_id: 'call-uuid',
    });
    expect(mockLeadsInsert).not.toHaveBeenCalled();
    expect(result).toMatchObject({ id: 'booked-lead-uuid' });
  });

  it('creates a NEW lead when existing lead is "completed" (new job)', async () => {
    // The query uses .in('status', ['new', 'booked']) so completed leads won't be found
    leadsQuery.maybeSingle.mockResolvedValue({ data: null, error: null });
    mockLeadsInsert.mockResolvedValue({
      data: [{ id: 'new-lead-for-completed', status: 'new' }],
      error: null,
    });

    const result = await createOrMergeLead(BASE_PARAMS);

    expect(mockLeadsInsert).toHaveBeenCalled();
    expect(result).toMatchObject({ id: 'new-lead-for-completed' });
  });

  it('creates a NEW lead when existing lead is "paid" (new job)', async () => {
    leadsQuery.maybeSingle.mockResolvedValue({ data: null, error: null });
    mockLeadsInsert.mockResolvedValue({
      data: [{ id: 'new-lead-for-paid', status: 'new' }],
      error: null,
    });

    const result = await createOrMergeLead(BASE_PARAMS);

    expect(mockLeadsInsert).toHaveBeenCalled();
    expect(result).toMatchObject({ id: 'new-lead-for-paid' });
  });

  it('creates a NEW lead when existing lead is "lost"', async () => {
    leadsQuery.maybeSingle.mockResolvedValue({ data: null, error: null });
    mockLeadsInsert.mockResolvedValue({
      data: [{ id: 'new-lead-for-lost', status: 'new' }],
      error: null,
    });

    const result = await createOrMergeLead(BASE_PARAMS);

    expect(mockLeadsInsert).toHaveBeenCalled();
    expect(result).toMatchObject({ id: 'new-lead-for-lost' });
  });

  it('queries leads with .in("status", ["new", "booked"]) for merge check', async () => {
    leadsQuery.maybeSingle.mockResolvedValue({ data: null, error: null });
    mockLeadsInsert.mockResolvedValue({ data: [{ id: 'x', status: 'new' }], error: null });

    await createOrMergeLead(BASE_PARAMS);

    expect(leadsQuery.in).toHaveBeenCalledWith('status', ['new', 'booked']);
  });
});

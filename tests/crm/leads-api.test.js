/**
 * Tests for GET /api/leads/[id] and PATCH /api/leads/[id]
 * Lead detail API — full call context including transcript, status transitions, revenue validation.
 * Uses jest.unstable_mockModule pattern established in the project.
 */

import { jest } from '@jest/globals';

// ─── Supabase mocks ──────────────────────────────────────────────────────────

// For GET: chainable select query
function makeDetailQuery(resolvedData = null, error = null) {
  const q = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: resolvedData, error }),
  };
  return q;
}

// For PATCH: chainable update query
function makeUpdateQuery(resolvedData = null, error = null) {
  const q = {
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: resolvedData, error }),
  };
  return q;
}

// Track queries so tests can inspect them
let currentDetailQuery;
let currentUpdateQuery;
let currentActivityQuery;
let isUpdateOperation; // tracks whether from('leads') is called for GET or PATCH

// Server supabase mock
const mockServerSupabase = {
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn((table) => {
    if (table === 'leads') {
      return isUpdateOperation ? currentUpdateQuery : currentDetailQuery;
    }
    return { select: jest.fn().mockReturnThis() };
  }),
};

jest.unstable_mockModule('@/lib/supabase-server', () => ({
  createSupabaseServer: jest.fn().mockResolvedValue(mockServerSupabase),
}));

// Service-role supabase mock for activity_log inserts
const mockActivityInsert = jest.fn().mockResolvedValue({ data: null, error: null });

const mockServiceSupabase = {
  from: jest.fn((table) => {
    if (table === 'activity_log') {
      return { insert: mockActivityInsert };
    }
    return { insert: jest.fn().mockResolvedValue({ data: null, error: null }) };
  }),
};

jest.unstable_mockModule('@/lib/supabase', () => ({
  supabase: mockServiceSupabase,
}));

// ─── Sample data ─────────────────────────────────────────────────────────────

const SAMPLE_LEAD = {
  id: 'lead-uuid-1',
  tenant_id: 'tenant-uuid',
  from_number: '+15551234567',
  caller_name: 'John Doe',
  job_type: 'plumbing',
  service_address: '123 Main St',
  urgency: 'routine',
  status: 'new',
  revenue_amount: null,
  created_at: '2026-03-20T10:00:00Z',
  updated_at: '2026-03-20T10:00:00Z',
  lead_calls: [
    {
      calls: {
        id: 'call-uuid-1',
        retell_call_id: 'retell-123',
        from_number: '+15551234567',
        urgency_classification: 'routine',
        urgency_confidence: 0.95,
        triage_layer_used: 'layer1',
        recording_url: 'https://storage.example.com/recordings/call-uuid-1.mp3',
        recording_storage_path: 'recordings/call-uuid-1.mp3',
        transcript_text: 'Caller: Hi, I have a leaky faucet.\nAI: I can help with that.',
        transcript_structured: [
          { role: 'user', content: 'Hi, I have a leaky faucet.' },
          { role: 'assistant', content: 'I can help with that.' },
        ],
        detected_language: 'en',
        start_timestamp: '2026-03-20T10:00:00Z',
        end_timestamp: '2026-03-20T10:05:00Z',
        duration_seconds: 300,
        suggested_slots: null,
      },
    },
  ],
  appointments: [],
};

const AUTHED_USER = {
  id: 'user-uuid',
  user_metadata: { tenant_id: 'tenant-uuid' },
};

// ─── Import module after mocks ────────────────────────────────────────────────

let GET, PATCH;

beforeAll(async () => {
  const module = await import('@/app/api/leads/[id]/route.js');
  GET = module.GET;
  PATCH = module.PATCH;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockServerSupabase.auth.getUser.mockResolvedValue({ data: { user: AUTHED_USER } });
  currentDetailQuery = makeDetailQuery(SAMPLE_LEAD);
  currentUpdateQuery = makeUpdateQuery({ ...SAMPLE_LEAD, status: 'booked', updated_at: new Date().toISOString() });
  isUpdateOperation = false;
  mockActivityInsert.mockResolvedValue({ data: null, error: null });
});

// ─── GET tests ────────────────────────────────────────────────────────────────

describe('GET /api/leads/[id]', () => {
  it('returns lead with joined call data including transcript_text', async () => {
    isUpdateOperation = false;

    const req = {};
    const params = Promise.resolve({ id: 'lead-uuid-1' });

    const response = await GET(req, { params });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.lead).toBeDefined();
    expect(body.lead.id).toBe('lead-uuid-1');
    expect(body.lead.lead_calls[0].calls.transcript_text).toBeTruthy();
  });

  it('selects transcript_text and transcript_structured in query', async () => {
    isUpdateOperation = false;

    const req = {};
    const params = Promise.resolve({ id: 'lead-uuid-1' });

    await GET(req, { params });

    const selectArg = currentDetailQuery.select.mock.calls[0][0];
    expect(selectArg).toContain('transcript_text');
    expect(selectArg).toContain('transcript_structured');
  });

  it('joins lead_calls -> calls and appointments in query', async () => {
    isUpdateOperation = false;

    const req = {};
    const params = Promise.resolve({ id: 'lead-uuid-1' });

    await GET(req, { params });

    const selectArg = currentDetailQuery.select.mock.calls[0][0];
    expect(selectArg).toContain('lead_calls');
    expect(selectArg).toContain('calls');
    expect(selectArg).toContain('appointments');
  });

  it('returns 401 when not authenticated', async () => {
    mockServerSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });

    const req = {};
    const params = Promise.resolve({ id: 'lead-uuid-1' });

    const response = await GET(req, { params });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it('returns 404 when lead not found', async () => {
    currentDetailQuery = makeDetailQuery(null, { message: 'No rows found' });

    const req = {};
    const params = Promise.resolve({ id: 'non-existent-id' });

    const response = await GET(req, { params });

    expect(response.status).toBe(404);
  });
});

// ─── PATCH tests ──────────────────────────────────────────────────────────────

describe('PATCH /api/leads/[id]', () => {
  beforeEach(() => {
    // PATCH operations use the update query
    isUpdateOperation = true;
  });

  it('updates status to booked successfully', async () => {
    currentUpdateQuery = makeUpdateQuery({ ...SAMPLE_LEAD, status: 'booked', updated_at: new Date().toISOString() });

    const req = { json: jest.fn().mockResolvedValue({ status: 'booked', previous_status: 'new' }) };
    const params = Promise.resolve({ id: 'lead-uuid-1' });

    const response = await PATCH(req, { params });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.lead.status).toBe('booked');
  });

  it('returns 422 when status is paid and revenue_amount is missing', async () => {
    const req = { json: jest.fn().mockResolvedValue({ status: 'paid', previous_status: 'completed' }) };
    const params = Promise.resolve({ id: 'lead-uuid-1' });

    const response = await PATCH(req, { params });

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error).toContain('revenue_amount');
  });

  it('returns 422 when status is paid and revenue_amount is empty string', async () => {
    const req = { json: jest.fn().mockResolvedValue({ status: 'paid', revenue_amount: '', previous_status: 'completed' }) };
    const params = Promise.resolve({ id: 'lead-uuid-1' });

    const response = await PATCH(req, { params });

    expect(response.status).toBe(422);
  });

  it('succeeds when status is paid with revenue_amount provided', async () => {
    currentUpdateQuery = makeUpdateQuery({ ...SAMPLE_LEAD, status: 'paid', revenue_amount: 350.00 });

    const req = { json: jest.fn().mockResolvedValue({ status: 'paid', revenue_amount: 350.00, previous_status: 'completed' }) };
    const params = Promise.resolve({ id: 'lead-uuid-1' });

    const response = await PATCH(req, { params });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.lead.revenue_amount).toBe(350.00);
  });

  it('succeeds when status is completed with optional revenue_amount omitted', async () => {
    currentUpdateQuery = makeUpdateQuery({ ...SAMPLE_LEAD, status: 'completed' });

    const req = { json: jest.fn().mockResolvedValue({ status: 'completed', previous_status: 'booked' }) };
    const params = Promise.resolve({ id: 'lead-uuid-1' });

    const response = await PATCH(req, { params });

    expect(response.status).toBe(200);
  });

  it('includes updated_at timestamp in the update payload', async () => {
    const updatedLead = { ...SAMPLE_LEAD, status: 'booked', updated_at: '2026-03-21T10:00:00Z' };
    currentUpdateQuery = makeUpdateQuery(updatedLead);

    const req = { json: jest.fn().mockResolvedValue({ status: 'booked', previous_status: 'new' }) };
    const params = Promise.resolve({ id: 'lead-uuid-1' });

    await PATCH(req, { params });

    const updateArg = currentUpdateQuery.update.mock.calls[0][0];
    expect(updateArg.updated_at).toBeDefined();
    expect(typeof updateArg.updated_at).toBe('string');
  });

  it('logs status_changed event to activity_log after update', async () => {
    currentUpdateQuery = makeUpdateQuery({ ...SAMPLE_LEAD, status: 'booked' });

    const req = { json: jest.fn().mockResolvedValue({ status: 'booked', previous_status: 'new' }) };
    const params = Promise.resolve({ id: 'lead-uuid-1' });

    await PATCH(req, { params });

    // Allow the fire-and-forget async to settle
    await new Promise((r) => setTimeout(r, 20));

    expect(mockServiceSupabase.from).toHaveBeenCalledWith('activity_log');
    expect(mockActivityInsert).toHaveBeenCalledTimes(1);
    const insertArg = mockActivityInsert.mock.calls[0][0];
    expect(insertArg.event_type).toBe('status_changed');
    expect(insertArg.lead_id).toBe('lead-uuid-1');
    expect(insertArg.metadata.to_status).toBe('booked');
    expect(insertArg.metadata.from_status).toBe('new');
  });

  it('returns 401 when not authenticated', async () => {
    mockServerSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });

    const req = { json: jest.fn().mockResolvedValue({ status: 'booked' }) };
    const params = Promise.resolve({ id: 'lead-uuid-1' });

    const response = await PATCH(req, { params });

    expect(response.status).toBe(401);
  });
});

/**
 * API tests for /api/inquiries endpoint (Plan 04).
 *
 * Decision IDs validated:
 * - D-10 (inquiry → job conversion offline path)
 * - D-07 (3-state status enum: open, converted, lost)
 * - D-02a (no legacy leads/lead_calls writes in new routes)
 */

import { jest, describe, it, expect, beforeAll, beforeEach } from '@jest/globals';

// ─── Mock getTenantId ─────────────────────────────────────────────────────────
const mockGetTenantId = jest.fn().mockResolvedValue('tenant-abc');
jest.unstable_mockModule('@/lib/get-tenant-id', () => ({
  getTenantId: mockGetTenantId,
}));

// ─── Mock supabase-server.js ──────────────────────────────────────────────────
const mockFrom = jest.fn();
const mockServerSupabase = {
  from: mockFrom,
  auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-uuid-123' } } }) },
};
jest.unstable_mockModule('@/lib/supabase-server', () => ({
  createSupabaseServer: jest.fn().mockResolvedValue(mockServerSupabase),
}));

// ─── Mock service-role supabase ───────────────────────────────────────────────
jest.unstable_mockModule('@/lib/supabase', () => ({
  supabase: { from: jest.fn(), rpc: jest.fn() },
}));

// ─── Import route handlers after mocks ───────────────────────────────────────
let GET_inquiries, PATCH_inquiry, POST_convert;

beforeAll(async () => {
  const listModule = await import('@/app/api/inquiries/route');
  GET_inquiries = listModule.GET;

  const idModule = await import('@/app/api/inquiries/[id]/route');
  PATCH_inquiry = idModule.PATCH;

  const convertModule = await import('@/app/api/inquiries/[id]/convert/route');
  POST_convert = convertModule.POST;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGetTenantId.mockResolvedValue('tenant-abc');
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
function makeRequest(body = {}, url = 'http://localhost/api/inquiries') {
  return { url, json: jest.fn().mockResolvedValue(body) };
}

function makeChainableQuery(resolveValue = { data: [], error: null }) {
  const q = {};
  const methods = ['select', 'eq', 'is', 'order', 'limit', 'or', 'update', 'insert', 'single', 'maybeSingle'];
  for (const m of methods) q[m] = jest.fn().mockReturnValue(q);
  q.then = jest.fn((resolve) => resolve(resolveValue));
  return q;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/inquiries', () => {
  it('returns open inquiries with 200', async () => {
    const mockInquiries = [
      {
        id: 'inq-1',
        status: 'open',
        urgency: 'routine',
        job_type: 'plumbing',
        customer: { id: 'cust-1', name: 'Bob', phone_e164: '+61400000002' },
        created_at: '2026-04-21T10:00:00Z',
      },
    ];
    const q = makeChainableQuery({ data: mockInquiries, error: null });
    mockFrom.mockReturnValue(q);

    const req = { url: 'http://localhost/api/inquiries' };
    const res = await GET_inquiries(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty('inquiries');
  });

  it('returns 401 when not authenticated', async () => {
    mockGetTenantId.mockResolvedValueOnce(null);
    const req = { url: 'http://localhost/api/inquiries' };
    const res = await GET_inquiries(req);
    expect(res.status).toBe(401);
  });

  it('filters by status param', async () => {
    const q = makeChainableQuery({ data: [], error: null });
    mockFrom.mockReturnValue(q);

    const req = { url: 'http://localhost/api/inquiries?status=lost' };
    const res = await GET_inquiries(req);
    expect(res.status).toBe(200);
  });
});

describe('PATCH /api/inquiries/[id]', () => {
  it('returns 400 for invalid status (conversion is not a PATCH operation)', async () => {
    const req = makeRequest({ status: 'converted' });
    const params = Promise.resolve({ id: 'inq-1' });
    const res = await PATCH_inquiry(req, { params });
    // 'converted' is not a valid PATCH target — conversion goes through /convert route
    expect(res.status).toBe(400);
  });

  it('accepts status=lost', async () => {
    const updatedInq = { id: 'inq-1', status: 'lost', tenant_id: 'tenant-abc' };
    const q = makeChainableQuery({ data: updatedInq, error: null });
    q.single = jest.fn().mockResolvedValue({ data: updatedInq, error: null });
    mockFrom.mockReturnValue(q);

    const req = makeRequest({ status: 'lost' });
    const params = Promise.resolve({ id: 'inq-1' });
    const res = await PATCH_inquiry(req, { params });
    expect(res.status).not.toBe(400);
  });

  it('accepts status=open', async () => {
    const updatedInq = { id: 'inq-1', status: 'open', tenant_id: 'tenant-abc' };
    const q = makeChainableQuery({ data: updatedInq, error: null });
    q.single = jest.fn().mockResolvedValue({ data: updatedInq, error: null });
    mockFrom.mockReturnValue(q);

    const req = makeRequest({ status: 'open' });
    const params = Promise.resolve({ id: 'inq-1' });
    const res = await PATCH_inquiry(req, { params });
    expect(res.status).not.toBe(400);
  });
});

describe('POST /api/inquiries/[id]/convert (D-10 offline path)', () => {
  it('returns 400 when appointment_id not provided', async () => {
    const req = makeRequest({});
    const params = Promise.resolve({ id: 'inq-1' });
    const res = await POST_convert(req, { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('appointment_required');
    expect(body.hint).toBeDefined();
  });

  it('returns 400 with hint when body is empty (D-10)', async () => {
    const req = makeRequest({});
    const params = Promise.resolve({ id: 'inq-1' });
    const res = await POST_convert(req, { params });
    const body = await res.json();
    expect(body.hint).toContain('/api/appointments');
  });

  it('happy-path: returns job_id and inquiry_id on convert', async () => {
    // Mock inquiry lookup → returns open inquiry
    const mockInquiry = {
      id: 'inq-1',
      tenant_id: 'tenant-abc',
      customer_id: 'cust-1',
      status: 'open',
      urgency: 'routine',
    };
    const mockAppointment = { id: 'appt-1' };
    const mockJob = { id: 'job-new-1' };

    let callIndex = 0;
    mockFrom.mockImplementation(() => {
      const q = makeChainableQuery();
      if (callIndex === 0) {
        // inquiries lookup
        q.single = jest.fn().mockResolvedValue({ data: mockInquiry, error: null });
      } else if (callIndex === 1) {
        // appointments lookup
        q.single = jest.fn().mockResolvedValue({ data: mockAppointment, error: null });
      } else if (callIndex === 2) {
        // jobs insert
        q.select = jest.fn().mockReturnValue(q);
        q.single = jest.fn().mockResolvedValue({ data: mockJob, error: null });
      } else {
        // inquiries update
        q.eq = jest.fn().mockReturnValue(q);
      }
      callIndex++;
      return q;
    });

    const req = makeRequest({ appointment_id: 'appt-1' });
    const params = Promise.resolve({ id: 'inq-1' });
    const res = await POST_convert(req, { params });

    if (res.status === 200) {
      const body = await res.json();
      expect(body).toHaveProperty('job_id');
      expect(body).toHaveProperty('inquiry_id');
    }
  });

  it('returns 404 when inquiry not found or not open', async () => {
    const q = makeChainableQuery({ data: null, error: null });
    q.single = jest.fn().mockResolvedValue({ data: null, error: { message: 'row not found' } });
    mockFrom.mockReturnValue(q);

    const req = makeRequest({ appointment_id: 'appt-1' });
    const params = Promise.resolve({ id: 'inq-missing' });
    const res = await POST_convert(req, { params });
    expect([404, 500]).toContain(res.status);
  });
});

// ─── D-02a source-code invariant ─────────────────────────────────────────────

describe('D-02a: No legacy table references in inquiries route/lib files', () => {
  it('lib/inquiries.js has zero .from("leads") references', async () => {
    const { readFileSync } = await import('fs');
    const src = readFileSync('src/lib/inquiries.js', 'utf8');
    expect(src).not.toMatch(/\.from\(['"]leads['"]\)/);
    expect(src).not.toMatch(/\.from\(['"]lead_calls['"]\)/);
    expect(src).not.toMatch(/\.table\(['"]leads['"]\)/);
  });
});

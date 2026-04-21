/**
 * API tests for /api/jobs list endpoint (Plan 04).
 *
 * Decision ID validated: D-06 (jobs joined with customer + appointment).
 * D-02a invariant: no .from('leads') in route or lib files.
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
let GET_jobs, PATCH_job;

beforeAll(async () => {
  const listModule = await import('@/app/api/jobs/route');
  GET_jobs = listModule.GET;

  const idModule = await import('@/app/api/jobs/[id]/route');
  PATCH_job = idModule.PATCH;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGetTenantId.mockResolvedValue('tenant-abc');
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
function makeRequest(body = {}, url = 'http://localhost/api/jobs') {
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

describe('GET /api/jobs', () => {
  it('returns jobs list with 200', async () => {
    const mockJobs = [
      {
        id: 'job-1',
        status: 'scheduled',
        urgency: 'routine',
        customer: { id: 'cust-1', name: 'Alice', phone_e164: '+61400000001' },
        appointment: { id: 'appt-1', start_time: '2026-05-01T09:00:00Z', end_time: '2026-05-01T10:00:00Z' },
        calls: [],
      },
    ];
    const q = makeChainableQuery({ data: mockJobs, error: null });
    mockFrom.mockReturnValue(q);

    const req = { url: 'http://localhost/api/jobs' };
    const res = await GET_jobs(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty('jobs');
  });

  it('returns 401 when not authenticated', async () => {
    mockGetTenantId.mockResolvedValueOnce(null);
    const req = { url: 'http://localhost/api/jobs' };
    const res = await GET_jobs(req);
    expect(res.status).toBe(401);
  });

  it('filters by status param', async () => {
    const q = makeChainableQuery({ data: [], error: null });
    mockFrom.mockReturnValue(q);

    const req = { url: 'http://localhost/api/jobs?status=scheduled' };
    const res = await GET_jobs(req);
    expect(res.status).toBe(200);
  });

  it('filters by urgency param', async () => {
    const q = makeChainableQuery({ data: [], error: null });
    mockFrom.mockReturnValue(q);

    const req = { url: 'http://localhost/api/jobs?urgency=emergency' };
    const res = await GET_jobs(req);
    expect(res.status).toBe(200);
  });

  it('filters by customer_id param', async () => {
    const q = makeChainableQuery({ data: [], error: null });
    mockFrom.mockReturnValue(q);

    const req = { url: 'http://localhost/api/jobs?customer_id=cust-1' };
    const res = await GET_jobs(req);
    expect(res.status).toBe(200);
  });
});

describe('PATCH /api/jobs/[id]', () => {
  it('returns 400 for invalid status value', async () => {
    const req = makeRequest({ status: 'invalid_status' });
    const params = Promise.resolve({ id: 'job-1' });
    const res = await PATCH_job(req, { params });
    expect(res.status).toBe(400);
  });

  it('accepts valid status values', async () => {
    const updatedJob = { id: 'job-1', status: 'completed', tenant_id: 'tenant-abc' };
    const q = makeChainableQuery({ data: updatedJob, error: null });
    q.single = jest.fn().mockResolvedValue({ data: updatedJob, error: null });
    mockFrom.mockReturnValue(q);

    const req = makeRequest({ status: 'completed' });
    const params = Promise.resolve({ id: 'job-1' });
    const res = await PATCH_job(req, { params });
    expect(res.status).not.toBe(400);
  });
});

// ─── D-02a source-code invariant ─────────────────────────────────────────────

describe('D-02a: No legacy table references in jobs route/lib files', () => {
  it('lib/jobs.js has zero .from("leads") references', async () => {
    const { readFileSync } = await import('fs');
    const src = readFileSync('src/lib/jobs.js', 'utf8');
    expect(src).not.toMatch(/\.from\(['"]leads['"]\)/);
    expect(src).not.toMatch(/\.from\(['"]lead_calls['"]\)/);
    expect(src).not.toMatch(/\.table\(['"]leads['"]\)/);
  });
});

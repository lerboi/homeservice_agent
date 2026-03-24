/**
 * Tests for the services CRUD API route.
 * Covers GET, POST, PUT, DELETE operations with auth, validation, and soft delete.
 */

import { jest } from '@jest/globals';

// ─── Mock supabase-server (auth / session) ────────────────────────────────────

const mockGetUser = jest.fn();

jest.unstable_mockModule('@/lib/supabase-server', () => ({
  createSupabaseServer: jest.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
  }),
}));

// ─── Mock supabase service-role client ───────────────────────────────────────

const mockSelect = jest.fn().mockReturnThis();
const mockEq = jest.fn().mockReturnThis();
const mockOrder = jest.fn();
const mockInsert = jest.fn().mockReturnThis();
const mockUpdate = jest.fn().mockReturnThis();
const mockSingle = jest.fn();

const mockServicesQuery = {
  select: mockSelect,
  eq: mockEq,
  order: mockOrder,
  insert: mockInsert,
  update: mockUpdate,
  single: mockSingle,
};

const mockSupabase = {
  from: jest.fn().mockReturnValue(mockServicesQuery),
};

jest.unstable_mockModule('@/lib/supabase', () => ({
  supabase: mockSupabase,
}));

// Mock getTenantId — returns tenant-abc by default
const mockGetTenantId = jest.fn().mockResolvedValue('tenant-abc');
jest.unstable_mockModule('@/lib/get-tenant-id', () => ({
  getTenantId: mockGetTenantId,
}));

// ─── Import route handlers after mocks are set up ────────────────────────────

let GET, POST, PUT, DELETE;

beforeAll(async () => {
  const module = await import('@/app/api/services/route');
  GET = module.GET;
  POST = module.POST;
  PUT = module.PUT;
  DELETE = module.DELETE;
});

beforeEach(() => {
  jest.clearAllMocks();

  // Restore chainable mocks after clearAllMocks
  mockSelect.mockReturnThis();
  mockEq.mockReturnThis();
  mockInsert.mockReturnThis();
  mockUpdate.mockReturnThis();

  // Authenticated by default
  mockGetUser.mockResolvedValue({
    data: { user: { user_metadata: { tenant_id: 'tenant-abc' } } },
  });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(body) {
  return { json: () => Promise.resolve(body) };
}

// ─── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/services', () => {
  it('returns services for authenticated tenant', async () => {
    const services = [
      { id: 'svc-1', name: 'Drain cleaning', urgency_tag: 'routine', created_at: '2026-01-01' },
    ];
    mockOrder.mockResolvedValue({ data: services, error: null });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.services).toEqual(services);
    expect(mockSupabase.from).toHaveBeenCalledWith('services');
  });

  it('returns 401 when not authenticated', async () => {
    mockGetTenantId.mockResolvedValueOnce(null);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 500 when database query fails', async () => {
    mockOrder.mockResolvedValue({ data: null, error: { message: 'DB error' } });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('DB error');
  });
});

// ─── POST ─────────────────────────────────────────────────────────────────────

describe('POST /api/services', () => {
  it('creates service with valid name and urgency_tag', async () => {
    const newService = { id: 'svc-new', name: 'AC repair', urgency_tag: 'high_ticket', created_at: '2026-01-01' };
    mockSingle.mockResolvedValue({ data: newService, error: null });

    const req = makeRequest({ name: 'AC repair', urgency_tag: 'high_ticket' });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.service).toEqual(newService);
  });

  it('defaults urgency_tag to routine when not provided', async () => {
    const newService = { id: 'svc-new', name: 'General inspection', urgency_tag: 'routine', created_at: '2026-01-01' };
    mockSingle.mockResolvedValue({ data: newService, error: null });

    const req = makeRequest({ name: 'General inspection' });
    await POST(req);

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ urgency_tag: 'routine' })
    );
  });

  it('returns 400 when name is empty', async () => {
    const req = makeRequest({ name: '', urgency_tag: 'routine' });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Name required');
  });

  it('returns 400 when name is whitespace only', async () => {
    const req = makeRequest({ name: '   ', urgency_tag: 'routine' });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Name required');
  });

  it('returns 400 when urgency_tag is invalid', async () => {
    const req = makeRequest({ name: 'Test service', urgency_tag: 'invalid_tag' });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid urgency_tag');
  });

  it('returns 401 when not authenticated', async () => {
    mockGetTenantId.mockResolvedValueOnce(null);

    const req = makeRequest({ name: 'Test', urgency_tag: 'routine' });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });
});

// ─── PUT ──────────────────────────────────────────────────────────────────────

describe('PUT /api/services', () => {
  it('updates urgency_tag for service owned by tenant', async () => {
    const updated = { id: 'svc-1', name: 'Drain cleaning', urgency_tag: 'emergency' };
    mockSingle.mockResolvedValue({ data: updated, error: null });

    const req = makeRequest({ id: 'svc-1', urgency_tag: 'emergency' });
    const res = await PUT(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.service).toEqual(updated);
    expect(mockUpdate).toHaveBeenCalledWith({ urgency_tag: 'emergency' });
  });

  it('returns 400 for invalid urgency_tag on update', async () => {
    const req = makeRequest({ id: 'svc-1', urgency_tag: 'not_valid' });
    const res = await PUT(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid urgency_tag');
  });

  it('returns 401 when not authenticated', async () => {
    mockGetTenantId.mockResolvedValueOnce(null);

    const req = makeRequest({ id: 'svc-1', urgency_tag: 'routine' });
    const res = await PUT(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });
});

// ─── DELETE ───────────────────────────────────────────────────────────────────

describe('DELETE /api/services', () => {
  it('soft-deletes service by setting is_active=false', async () => {
    mockEq.mockReturnThis();
    // Final eq call returns the result
    const eqMock = jest.fn()
      .mockReturnValueOnce(mockServicesQuery) // eq('id', ...)
      .mockResolvedValueOnce({ data: null, error: null }); // eq('tenant_id', ...)
    mockSupabase.from.mockReturnValue({
      ...mockServicesQuery,
      update: jest.fn().mockReturnValue({ eq: eqMock }),
    });

    const req = makeRequest({ id: 'svc-1' });
    const res = await DELETE(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.deleted).toBe(true);
  });

  it('returns 401 when not authenticated', async () => {
    mockGetTenantId.mockResolvedValueOnce(null);

    const req = makeRequest({ id: 'svc-1' });
    const res = await DELETE(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });
});

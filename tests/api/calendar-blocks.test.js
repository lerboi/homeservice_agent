/**
 * Tests for the calendar-blocks CRUD API.
 * Covers GET (list with date range), POST (create), PATCH (update), DELETE operations.
 */

import { jest } from '@jest/globals';

// ─── Mock getTenantId ─────────────────────────────────────────────────────────

const mockGetTenantId = jest.fn().mockResolvedValue('tenant-abc');

jest.unstable_mockModule('@/lib/get-tenant-id', () => ({
  getTenantId: mockGetTenantId,
}));

// ─── Mock supabase ────────────────────────────────────────────────────────────

const mockSelect = jest.fn().mockReturnThis();
const mockEq = jest.fn().mockReturnThis();
const mockNeq = jest.fn().mockReturnThis();
const mockLte = jest.fn().mockReturnThis();
const mockGte = jest.fn().mockReturnThis();
const mockOrder = jest.fn();
const mockInsert = jest.fn().mockReturnThis();
const mockUpdate = jest.fn().mockReturnThis();
const mockDelete = jest.fn().mockReturnThis();
const mockSingle = jest.fn();

const mockBlocksQuery = {
  select: mockSelect,
  eq: mockEq,
  neq: mockNeq,
  lte: mockLte,
  gte: mockGte,
  order: mockOrder,
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
  single: mockSingle,
};

const mockSupabase = {
  from: jest.fn().mockReturnValue(mockBlocksQuery),
};

jest.unstable_mockModule('@/lib/supabase', () => ({
  supabase: mockSupabase,
}));

// ─── Import route handlers after mocks ───────────────────────────────────────

let GET, POST;
let PATCH_ID, DELETE_ID;

beforeAll(async () => {
  const listModule = await import('@/app/api/calendar-blocks/route');
  GET = listModule.GET;
  POST = listModule.POST;

  const idModule = await import('@/app/api/calendar-blocks/[id]/route');
  PATCH_ID = idModule.PATCH;
  DELETE_ID = idModule.DELETE;
});

beforeEach(() => {
  jest.clearAllMocks();

  // Restore chainable mocks
  mockSelect.mockReturnThis();
  mockEq.mockReturnThis();
  mockNeq.mockReturnThis();
  mockLte.mockReturnThis();
  mockGte.mockReturnThis();
  mockInsert.mockReturnThis();
  mockUpdate.mockReturnThis();
  mockDelete.mockReturnThis();
  mockSupabase.from.mockReturnValue(mockBlocksQuery);

  // Authenticated by default
  mockGetTenantId.mockResolvedValue('tenant-abc');
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body) {
  return {
    json: () => Promise.resolve(body),
    url: 'http://localhost:3000/api/calendar-blocks',
  };
}

function makeGetRequest(params = {}) {
  const query = new URLSearchParams(params).toString();
  return {
    url: `http://localhost:3000/api/calendar-blocks${query ? '?' + query : ''}`,
  };
}

function makeParams(id) {
  return { params: Promise.resolve({ id }) };
}

// ─── GET /api/calendar-blocks ─────────────────────────────────────────────────

describe('GET /api/calendar-blocks', () => {
  it('returns blocks for authenticated tenant filtered by date range', async () => {
    const blocks = [
      {
        id: 'block-1',
        title: 'Lunch',
        start_time: '2026-04-11T12:00:00Z',
        end_time: '2026-04-11T13:00:00Z',
        is_all_day: false,
        note: null,
      },
    ];
    mockOrder.mockResolvedValue({ data: blocks, error: null });

    const req = makeGetRequest({ start: '2026-04-11T00:00:00Z', end: '2026-04-11T23:59:59Z' });
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.blocks).toEqual(blocks);
    expect(mockSupabase.from).toHaveBeenCalledWith('calendar_blocks');
  });

  it('returns 400 when start or end params are missing', async () => {
    const req = makeGetRequest({ start: '2026-04-11T00:00:00Z' }); // missing end
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/start.*end/i);
  });

  it('returns 401 when not authenticated', async () => {
    mockGetTenantId.mockResolvedValueOnce(null);

    const req = makeGetRequest({ start: '2026-04-11T00:00:00Z', end: '2026-04-11T23:59:59Z' });
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });
});

// ─── POST /api/calendar-blocks ────────────────────────────────────────────────

describe('POST /api/calendar-blocks', () => {
  it('creates a block and returns 201 with block object', async () => {
    const newBlock = {
      id: 'block-new',
      title: 'Vacation',
      start_time: '2026-04-15T00:00:00Z',
      end_time: '2026-04-20T00:00:00Z',
      is_all_day: true,
      note: 'Family trip',
    };
    mockSingle.mockResolvedValue({ data: newBlock, error: null });

    const req = makeRequest({
      title: 'Vacation',
      start_time: '2026-04-15T00:00:00Z',
      end_time: '2026-04-20T00:00:00Z',
      is_all_day: true,
      note: 'Family trip',
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.block).toEqual(newBlock);
    expect(mockSupabase.from).toHaveBeenCalledWith('calendar_blocks');
  });

  it('returns 400 when title is missing', async () => {
    const req = makeRequest({
      start_time: '2026-04-15T00:00:00Z',
      end_time: '2026-04-20T00:00:00Z',
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/title/i);
  });

  it('returns 400 when start_time is missing', async () => {
    const req = makeRequest({
      title: 'Lunch',
      end_time: '2026-04-11T13:00:00Z',
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
  });

  it('returns 400 when end_time is missing', async () => {
    const req = makeRequest({
      title: 'Lunch',
      start_time: '2026-04-11T12:00:00Z',
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
  });

  it('returns 401 when not authenticated', async () => {
    mockGetTenantId.mockResolvedValueOnce(null);

    const req = makeRequest({ title: 'Lunch', start_time: '2026-04-11T12:00:00Z', end_time: '2026-04-11T13:00:00Z' });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });
});

// ─── PATCH /api/calendar-blocks/[id] ─────────────────────────────────────────

describe('PATCH /api/calendar-blocks/[id]', () => {
  it('updates title and returns updated block', async () => {
    const updated = {
      id: 'block-1',
      title: 'Long Lunch',
      start_time: '2026-04-11T12:00:00Z',
      end_time: '2026-04-11T13:30:00Z',
      is_all_day: false,
      note: null,
    };
    mockSingle.mockResolvedValue({ data: updated, error: null });

    const req = makeRequest({ title: 'Long Lunch' });
    const res = await PATCH_ID(req, makeParams('block-1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.block).toEqual(updated);
    expect(mockSupabase.from).toHaveBeenCalledWith('calendar_blocks');
  });

  it('returns 401 when not authenticated', async () => {
    mockGetTenantId.mockResolvedValueOnce(null);

    const req = makeRequest({ title: 'Updated' });
    const res = await PATCH_ID(req, makeParams('block-1'));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });
});

// ─── DELETE /api/calendar-blocks/[id] ────────────────────────────────────────

describe('DELETE /api/calendar-blocks/[id]', () => {
  it('deletes a block and returns 200 with success', async () => {
    // delete().eq().eq() resolves to success
    const mockFinalEq = jest.fn().mockResolvedValue({ error: null });
    const mockFirstEq = jest.fn().mockReturnValue({ eq: mockFinalEq });
    mockSupabase.from.mockReturnValue({
      ...mockBlocksQuery,
      delete: jest.fn().mockReturnValue({ eq: mockFirstEq }),
    });

    const req = { url: 'http://localhost:3000/api/calendar-blocks/block-1' };
    const res = await DELETE_ID(req, makeParams('block-1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('returns 401 when not authenticated', async () => {
    mockGetTenantId.mockResolvedValueOnce(null);

    const req = { url: 'http://localhost:3000/api/calendar-blocks/block-1' };
    const res = await DELETE_ID(req, makeParams('block-1'));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });
});

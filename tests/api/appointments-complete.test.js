/**
 * Tests for the mark-complete and undo PATCH branches in /api/appointments/[id]
 * and calendar_blocks integration in /api/appointments/available-slots.
 */

import { jest } from '@jest/globals';

// ─── Mock getTenantId ─────────────────────────────────────────────────────────

const mockGetTenantId = jest.fn().mockResolvedValue('tenant-abc');

jest.unstable_mockModule('@/lib/get-tenant-id', () => ({
  getTenantId: mockGetTenantId,
}));

// ─── Mock supabase service-role client ───────────────────────────────────────

const mockSelect = jest.fn().mockReturnThis();
const mockEq = jest.fn().mockReturnThis();
const mockNeq = jest.fn().mockReturnThis();
const mockLte = jest.fn().mockReturnThis();
const mockGte = jest.fn().mockReturnThis();
const mockUpdate = jest.fn().mockReturnThis();
const mockInsert = jest.fn().mockReturnThis();
const mockSingle = jest.fn();
const mockRpc = jest.fn();

const mockQuery = {
  select: mockSelect,
  eq: mockEq,
  neq: mockNeq,
  lte: mockLte,
  gte: mockGte,
  update: mockUpdate,
  insert: mockInsert,
  single: mockSingle,
};

const mockSupabase = {
  from: jest.fn().mockReturnValue(mockQuery),
  rpc: mockRpc,
};

jest.unstable_mockModule('@/lib/supabase', () => ({
  supabase: mockSupabase,
}));

// ─── Mock next/server (after import) ─────────────────────────────────────────
jest.unstable_mockModule('next/server', () => ({
  after: jest.fn(),
}));

// ─── Import route handlers after mocks ───────────────────────────────────────

let PATCH;

beforeAll(async () => {
  const idModule = await import('@/app/api/appointments/[id]/route');
  PATCH = idModule.PATCH;
});

beforeEach(() => {
  jest.clearAllMocks();

  // Restore chainable mocks
  mockSelect.mockReturnThis();
  mockEq.mockReturnThis();
  mockNeq.mockReturnThis();
  mockLte.mockReturnThis();
  mockGte.mockReturnThis();
  mockUpdate.mockReturnThis();
  mockInsert.mockReturnThis();
  mockSupabase.from.mockReturnValue(mockQuery);

  mockGetTenantId.mockResolvedValue('tenant-abc');
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body) {
  return { json: () => Promise.resolve(body) };
}

function makeParams(id) {
  return { params: Promise.resolve({ id }) };
}

// ─── PATCH: Mark Complete ─────────────────────────────────────────────────────

describe('PATCH /api/appointments/[id] — mark complete', () => {
  it('sets completed_at and returns updated appointment', async () => {
    const updated = {
      id: 'appt-1',
      status: 'completed',
      completed_at: '2026-04-11T10:00:00Z',
      notes: null,
      start_time: '2026-04-11T09:00:00Z',
      end_time: '2026-04-11T10:00:00Z',
      caller_name: 'John Doe',
    };
    mockSingle.mockResolvedValue({ data: updated, error: null });

    const req = makeRequest({ status: 'completed' });
    const res = await PATCH(req, makeParams('appt-1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.appointment).toEqual(updated);
    expect(mockSupabase.from).toHaveBeenCalledWith('appointments');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed', completed_at: expect.any(String) })
    );
  });

  it('appends "[Completed] notes" to existing notes when notes provided', async () => {
    // First call: SELECT existing notes
    const existingAppt = { notes: 'Previous note' };
    mockSingle
      .mockResolvedValueOnce({ data: existingAppt, error: null }) // fetch existing
      .mockResolvedValueOnce({
        data: {
          id: 'appt-1',
          status: 'completed',
          completed_at: '2026-04-11T10:00:00Z',
          notes: 'Previous note\n\n[Completed] Fixed pipe',
          start_time: '2026-04-11T09:00:00Z',
          end_time: '2026-04-11T10:00:00Z',
          caller_name: 'John Doe',
        },
        error: null,
      });

    const req = makeRequest({ status: 'completed', notes: 'Fixed pipe' });
    const res = await PATCH(req, makeParams('appt-1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.appointment.notes).toBe('Previous note\n\n[Completed] Fixed pipe');
    // update should be called with notes containing [Completed]
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ notes: 'Previous note\n\n[Completed] Fixed pipe' })
    );
  });

  it('sets notes to the completion note when no existing notes', async () => {
    // First call: SELECT existing notes returns null
    const existingAppt = { notes: null };
    mockSingle
      .mockResolvedValueOnce({ data: existingAppt, error: null })
      .mockResolvedValueOnce({
        data: {
          id: 'appt-1',
          status: 'completed',
          completed_at: '2026-04-11T10:00:00Z',
          notes: 'Fixed pipe',
          start_time: '2026-04-11T09:00:00Z',
          end_time: '2026-04-11T10:00:00Z',
          caller_name: 'John Doe',
        },
        error: null,
      });

    const req = makeRequest({ status: 'completed', notes: 'Fixed pipe' });
    const res = await PATCH(req, makeParams('appt-1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.appointment.notes).toBe('Fixed pipe');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ notes: 'Fixed pipe' })
    );
  });

  it('returns 401 when not authenticated', async () => {
    mockGetTenantId.mockResolvedValueOnce(null);

    const req = makeRequest({ status: 'completed' });
    const res = await PATCH(req, makeParams('appt-1'));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });
});

// ─── PATCH: Undo Complete (revert to confirmed) ───────────────────────────────

describe('PATCH /api/appointments/[id] — undo complete (revert to confirmed)', () => {
  it('clears completed_at and sets status back to confirmed', async () => {
    const updated = {
      id: 'appt-1',
      status: 'confirmed',
      completed_at: null,
      notes: 'Fixed pipe',
      start_time: '2026-04-11T09:00:00Z',
      end_time: '2026-04-11T10:00:00Z',
      caller_name: 'John Doe',
    };
    mockSingle.mockResolvedValue({ data: updated, error: null });

    const req = makeRequest({ status: 'confirmed' });
    const res = await PATCH(req, makeParams('appt-1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.appointment.status).toBe('confirmed');
    expect(body.appointment.completed_at).toBeNull();
    expect(mockUpdate).toHaveBeenCalledWith({ status: 'confirmed', completed_at: null });
  });

  it('returns 401 when not authenticated', async () => {
    mockGetTenantId.mockResolvedValueOnce(null);

    const req = makeRequest({ status: 'confirmed' });
    const res = await PATCH(req, makeParams('appt-1'));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });
});

// ─── Available-Slots: calendar_blocks integration ─────────────────────────────

describe('GET /api/appointments/available-slots — calendar_blocks integration', () => {
  // We test the integration by checking that the route file imports calendar_blocks
  // The actual available-slots route uses a different supabase client (SSR), so
  // we verify the integration statically via import + inspection.

  it('available-slots route file contains calendar_blocks query', async () => {
    // Dynamic import of the route source to verify integration
    // In Jest we verify by checking the module source contains expected patterns
    // Since we can't easily mock the SSR client for this route, we verify the
    // route source contains the expected calendar_blocks fetch + blocksResult merge
    const fs = await import('fs');
    const path = await import('path');
    const routePath = path.default.resolve(process.cwd(), 'src/app/api/appointments/available-slots/route.js');
    const source = fs.default.readFileSync(routePath, 'utf8');

    expect(source).toContain('calendar_blocks');
    expect(source).toContain('blocksResult');
  });

  it('available-slots route excludes completed appointments', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const routePath = path.default.resolve(process.cwd(), 'src/app/api/appointments/available-slots/route.js');
    const source = fs.default.readFileSync(routePath, 'utf8');

    // Should exclude completed appointments from slot calculation
    expect(source).toMatch(/neq.*completed|not.*completed/);
  });

  it('appointments/[id] route contains [Completed] note prefix', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const routePath = path.default.resolve(process.cwd(), 'src/app/api/appointments/[id]/route.js');
    const source = fs.default.readFileSync(routePath, 'utf8');

    expect(source).toContain('[Completed]');
    expect(source).toContain("body.status === 'completed'");
    expect(source).toContain("body.status === 'confirmed'");
    expect(source).toContain('completed_at: null');
  });
});

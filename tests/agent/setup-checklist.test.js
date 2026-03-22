/**
 * Unit tests for the setup-checklist API route.
 * Tests GET (checklist derivation) and PATCH (dismiss state).
 */

import { jest } from '@jest/globals';

// ─── Shared mutable mocks ─────────────────────────────────────────────────────

const mockGetUser = jest.fn();

jest.unstable_mockModule('@/lib/supabase-server', () => ({
  createSupabaseServer: jest.fn().mockResolvedValue({
    auth: {
      getUser: mockGetUser,
    },
  }),
}));

const mockFromImpl = jest.fn();
const mockSupabase = {
  from: (...args) => mockFromImpl(...args),
};

jest.unstable_mockModule('@/lib/supabase', () => ({
  supabase: mockSupabase,
}));

// ─── Load route module after mocks ───────────────────────────────────────────

let GET, PATCH;

beforeAll(async () => {
  const routeModule = await import('@/app/api/setup-checklist/route.js');
  GET = routeModule.GET;
  PATCH = routeModule.PATCH;
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePatchRequest(body) {
  return new Request('http://localhost/api/setup-checklist', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/**
 * Chainable Supabase query mock — all methods return `q` (the chain object)
 * except terminal methods (single, maybeSingle) which resolve with the given value.
 */
function makeTenantQuery(resolvedValue) {
  const q = {};
  q.select = jest.fn(() => q);
  q.eq = jest.fn(() => q);
  q.single = jest.fn(() => Promise.resolve(resolvedValue));
  return q;
}

/**
 * Service query: select → eq → eq (last eq is the terminal, returns a thenable).
 * Promise.allSettled awaits the result of the last .eq() call.
 */
function makeServiceQuery(resolvedValue) {
  let eqCount = 0;
  const q = {};
  q.select = jest.fn(() => q);
  q.eq = jest.fn(() => {
    eqCount++;
    if (eqCount >= 2) return Promise.resolve(resolvedValue);
    return q;
  });
  return q;
}

/**
 * Calendar query: select → eq → eq → maybeSingle (terminal).
 */
function makeCalendarQuery(resolvedValue) {
  const q = {};
  q.select = jest.fn(() => q);
  q.eq = jest.fn(() => q);
  q.maybeSingle = jest.fn(() => Promise.resolve(resolvedValue));
  return q;
}

/**
 * Update query: update → eq (terminal).
 */
function makeUpdateQuery(resolvedValue) {
  const q = {};
  q.update = jest.fn(() => q);
  q.eq = jest.fn(() => Promise.resolve(resolvedValue));
  return q;
}

// ─── GET /api/setup-checklist ─────────────────────────────────────────────────

describe('GET /api/setup-checklist', () => {
  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 404 when tenant is not found', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } });

    const tenantQuery = makeTenantQuery({ data: null, error: null });
    mockFromImpl.mockReturnValueOnce(tenantQuery);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Tenant not found');
  });

  it('returns 6 items with correct completion derivation', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } });

    const tenant = {
      id: 'tenant-1',
      business_name: 'Acme Plumbing',
      working_hours: { mon: '09:00-17:00' },
      onboarding_complete: true,
      retell_phone_number: '+18005551234',
      setup_checklist_dismissed: false,
    };
    mockFromImpl
      .mockReturnValueOnce(makeTenantQuery({ data: tenant, error: null }))
      .mockReturnValueOnce(makeServiceQuery({ count: 2, error: null }))
      .mockReturnValueOnce(makeCalendarQuery({ data: null, error: null }));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toHaveLength(6);

    // completedCount: create_account(true) + setup_profile(true) + configure_services(true)
    // + connect_calendar(false) + configure_hours(true) + make_test_call(true) = 5
    expect(body.completedCount).toBe(5);

    expect(body.items[0].id).toBe('create_account');
    expect(body.items[0].complete).toBe(true);
    expect(body.items[3].id).toBe('connect_calendar');
    expect(body.items[3].complete).toBe(false);
  });

  it('returns dismissed: false when column is null', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } });

    const tenant = {
      id: 'tenant-1',
      business_name: 'Test Co',
      working_hours: null,
      onboarding_complete: false,
      retell_phone_number: null,
      setup_checklist_dismissed: null,
    };
    mockFromImpl
      .mockReturnValueOnce(makeTenantQuery({ data: tenant, error: null }))
      .mockReturnValueOnce(makeServiceQuery({ count: 0, error: null }))
      .mockReturnValueOnce(makeCalendarQuery({ data: null, error: null }));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.dismissed).toBe(false);
  });

  it('first 3 items always have locked: true', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } });

    const tenant = {
      id: 'tenant-1',
      business_name: null,
      working_hours: null,
      onboarding_complete: false,
      retell_phone_number: null,
      setup_checklist_dismissed: false,
    };
    mockFromImpl
      .mockReturnValueOnce(makeTenantQuery({ data: tenant, error: null }))
      .mockReturnValueOnce(makeServiceQuery({ count: 0, error: null }))
      .mockReturnValueOnce(makeCalendarQuery({ data: null, error: null }));

    const res = await GET();
    const body = await res.json();

    expect(body.items[0].locked).toBe(true);
    expect(body.items[1].locked).toBe(true);
    expect(body.items[2].locked).toBe(true);
    expect(body.items[3].locked).toBe(false);
    expect(body.items[4].locked).toBe(false);
    expect(body.items[5].locked).toBe(false);
  });
});

// ─── PATCH /api/setup-checklist ───────────────────────────────────────────────

describe('PATCH /api/setup-checklist', () => {
  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const res = await PATCH(makePatchRequest({ dismissed: true }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('sets dismissed to true and returns ok: true', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } });

    const updateQuery = makeUpdateQuery({ error: null });
    mockFromImpl.mockReturnValueOnce(updateQuery);

    const res = await PATCH(makePatchRequest({ dismissed: true }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(updateQuery.update).toHaveBeenCalledWith({ setup_checklist_dismissed: true });
    expect(updateQuery.eq).toHaveBeenCalledWith('owner_id', 'user-1');
  });
});

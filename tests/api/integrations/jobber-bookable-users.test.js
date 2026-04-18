import { jest } from '@jest/globals';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';

// --- getTenantId mock
const mockGetTenantId = jest.fn();
jest.unstable_mockModule('@/lib/get-tenant-id', () => ({
  getTenantId: () => mockGetTenantId(),
}));

// --- Supabase mock
const mockMaybeSingle = jest.fn();
const mockUpdate = jest.fn();
const mockUpdateEq = jest.fn().mockResolvedValue({ error: null });
const mockEventsDeleteEq3 = jest.fn().mockResolvedValue({ error: null });
const mockEventsDeleteEq2 = jest.fn(() => ({ eq: mockEventsDeleteEq3 }));
const mockEventsDeleteEq1 = jest.fn(() => ({ eq: mockEventsDeleteEq2 }));
const mockEventsDelete = jest.fn(() => ({ eq: mockEventsDeleteEq1 }));

const credChain = {
  select: () => credChain,
  eq: () => credChain,
  maybeSingle: () => mockMaybeSingle(),
};
const credUpdateChain = {
  update: (payload) => {
    mockUpdate(payload);
    return { eq: mockUpdateEq };
  },
};
const eventsChain = {
  delete: () => mockEventsDelete(),
};

jest.unstable_mockModule('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table) => {
      if (table === 'accounting_credentials') {
        // Return BOTH select+update capabilities — distinct chains called by the route
        return { ...credChain, ...credUpdateChain };
      }
      return eventsChain;
    },
  }),
}));

// --- jobber.js mocks
const mockFetchUsers = jest.fn();
const mockFetchVisits = jest.fn();
jest.unstable_mockModule('@/lib/integrations/jobber', () => ({
  fetchJobberUsersWithRecentActivity: (...a) => mockFetchUsers(...a),
  fetchJobberVisits: (...a) => mockFetchVisits(...a),
}));

let GET, PATCH, POST_RESYNC;
beforeAll(async () => {
  ({ GET, PATCH } = await import('@/app/api/integrations/jobber/bookable-users/route'));
  POST_RESYNC = (await import('@/app/api/integrations/jobber/resync/route')).POST;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGetTenantId.mockResolvedValue('voco-tenant-1');
  mockMaybeSingle.mockResolvedValue({ data: null });
  mockFetchUsers.mockResolvedValue([]);
  mockFetchVisits.mockResolvedValue({ visits: [], pageInfo: { hasNextPage: false, endCursor: null } });
});

function jsonReq(body) {
  return new Request('http://localhost/api/integrations/jobber/bookable-users', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('GET /api/integrations/jobber/bookable-users', () => {
  test('1. unauthenticated → 401', async () => {
    mockGetTenantId.mockResolvedValue(null);
    const r = await GET();
    expect(r.status).toBe(401);
  });

  test('2. authed but no Jobber cred → 404 with empty users', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null });
    const r = await GET();
    expect(r.status).toBe(404);
    const body = await r.json();
    expect(body).toEqual({ users: [], selected: null });
  });

  test('3. authed with Jobber cred → returns {users, selected}', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'cred-1', tenant_id: 'voco-tenant-1', provider: 'jobber', jobber_bookable_user_ids: ['u1'] },
    });
    mockFetchUsers.mockResolvedValue([
      { id: 'u1', name: 'Alice', hasRecentActivity: true },
      { id: 'u2', name: 'Bob', hasRecentActivity: false },
    ]);
    const r = await GET();
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.selected).toEqual(['u1']);
    expect(body.users).toHaveLength(2);
  });
});

describe('PATCH /api/integrations/jobber/bookable-users', () => {
  test('4. valid userIds → updates cred and triggers rebuild', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'cred-1', tenant_id: 'voco-tenant-1', provider: 'jobber' },
    });
    const r = await PATCH(jsonReq({ userIds: ['u1', 'u2'] }));
    expect(r.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith({ jobber_bookable_user_ids: ['u1', 'u2'] });
    expect(mockEventsDelete).toHaveBeenCalled();
    expect(mockFetchVisits).toHaveBeenCalled();
  });

  test('5. non-array userIds → 400', async () => {
    const r = await PATCH(jsonReq({ userIds: 'not-array' }));
    expect(r.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  test('6. userIds containing non-strings → 400', async () => {
    const r = await PATCH(jsonReq({ userIds: ['u1', 42] }));
    expect(r.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  test('7. PATCH waits for rebuild before responding (synchronous)', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'cred-1', tenant_id: 'voco-tenant-1', provider: 'jobber' },
    });
    let rebuildResolved = false;
    mockFetchVisits.mockImplementationOnce(
      () =>
        new Promise((resolve) =>
          setTimeout(() => {
            rebuildResolved = true;
            resolve({ visits: [], pageInfo: { hasNextPage: false, endCursor: null } });
          }, 30),
        ),
    );
    const r = await PATCH(jsonReq({ userIds: ['u1'] }));
    expect(r.status).toBe(200);
    expect(rebuildResolved).toBe(true);
  });
});

describe('POST /api/integrations/jobber/resync', () => {
  test('8. unauthenticated → 401', async () => {
    mockGetTenantId.mockResolvedValue(null);
    const r = await POST_RESYNC();
    expect(r.status).toBe(401);
  });

  test('9. authed → calls rebuildJobberMirror for caller tenant', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'cred-1', tenant_id: 'voco-tenant-1', provider: 'jobber', jobber_bookable_user_ids: null },
    });
    const r = await POST_RESYNC();
    expect(r.status).toBe(200);
    expect(mockEventsDelete).toHaveBeenCalled(); // rebuild deletes existing rows
    expect(mockFetchVisits).toHaveBeenCalled();
  });
});

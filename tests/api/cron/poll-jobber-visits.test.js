import { jest } from '@jest/globals';

process.env.CRON_SECRET = 'cron-secret-shh';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';

// --- Supabase mock — accounting_credentials select(provider='jobber') and
// .from('accounting_credentials').update({...}).eq('id', ...) for cursor advance,
// plus calendar_events upsert / delete for applyJobberVisit.
const mockCredsFetch = jest.fn();
const mockCursorUpdate = jest.fn().mockResolvedValue({ error: null });
const mockUpsert = jest.fn().mockResolvedValue({ error: null });
const mockDeleteEq3 = jest.fn().mockResolvedValue({ error: null });
const mockDeleteEq2 = jest.fn(() => ({ eq: mockDeleteEq3 }));
const mockDeleteEq1 = jest.fn(() => ({ eq: mockDeleteEq2 }));
const mockDelete = jest.fn(() => ({ eq: mockDeleteEq1 }));

// Track the relative order of upsert vs cursor-update calls so we can assert
// that cursor advance happens AFTER all upserts (Pitfall 4 ordering).
let opSeq = 0;
const upsertSeqs = [];
const cursorSeqs = [];

function makeFromCalendarEvents() {
  return {
    upsert: (...args) => {
      upsertSeqs.push(++opSeq);
      return mockUpsert(...args);
    },
    delete: () => mockDelete(),
  };
}
function makeFromAccountingCreds() {
  // Two distinct shapes: a select chain (for fetch) and an update chain (for cursor).
  return {
    select: () => ({
      eq: () => ({
        // For the cron initial fetch: returns array via the implicit await
        then: (resolve) => mockCredsFetch().then(resolve),
      }),
    }),
    update: (payload) => ({
      eq: (...eqArgs) => {
        cursorSeqs.push(++opSeq);
        return mockCursorUpdate(payload, ...eqArgs);
      },
    }),
  };
}

jest.unstable_mockModule('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table) => (table === 'calendar_events' ? makeFromCalendarEvents() : makeFromAccountingCreds()),
  }),
}));

const mockFetchVisits = jest.fn();
jest.unstable_mockModule('@/lib/integrations/jobber', () => ({
  fetchJobberVisits: (...args) => mockFetchVisits(...args),
}));

let GET;
beforeAll(async () => {
  GET = (await import('@/app/api/cron/poll-jobber-visits/route')).GET;
});

beforeEach(() => {
  jest.clearAllMocks();
  opSeq = 0;
  upsertSeqs.length = 0;
  cursorSeqs.length = 0;
  mockCredsFetch.mockResolvedValue({ data: [] });
  mockFetchVisits.mockResolvedValue({ visits: [], pageInfo: { hasNextPage: false, endCursor: null } });
});

function makeReq(authHeader) {
  const headers = new Headers();
  if (authHeader !== undefined) headers.set('authorization', authHeader);
  return new Request('http://localhost/api/cron/poll-jobber-visits', { method: 'GET', headers });
}
function cred(overrides = {}) {
  return {
    id: 'cred-1',
    tenant_id: 'voco-tenant-1',
    provider: 'jobber',
    access_token: 'tok',
    jobber_last_schedule_poll_at: '2026-04-01T00:00:00.000Z',
    jobber_bookable_user_ids: null,
    ...overrides,
  };
}
function visit(overrides = {}) {
  return {
    id: 'v-' + Math.random().toString(36).slice(2, 8),
    startAt: '2026-05-01T14:00:00.000Z',
    endAt: '2026-05-01T15:00:00.000Z',
    visitStatus: 'SCHEDULED',
    assignedUsers: { nodes: [] },
    job: { client: { name: { full: 'Acme' } } },
    ...overrides,
  };
}

describe('GET /api/cron/poll-jobber-visits', () => {
  test('1. no Authorization header → 401', async () => {
    const r = await GET(makeReq());
    expect(r.status).toBe(401);
    expect(mockFetchVisits).not.toHaveBeenCalled();
  });

  test('2. wrong bearer token → 401', async () => {
    const r = await GET(makeReq('Bearer wrong'));
    expect(r.status).toBe(401);
  });

  test('3. valid bearer + zero Jobber tenants → 200 with tenants_polled=0', async () => {
    mockCredsFetch.mockResolvedValue({ data: [] });
    const r = await GET(makeReq('Bearer cron-secret-shh'));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.tenants_polled).toBe(0);
  });

  test('4. one tenant returning two visits → applyJobberVisit upserts twice', async () => {
    mockCredsFetch.mockResolvedValue({ data: [cred()] });
    mockFetchVisits.mockResolvedValueOnce({
      visits: [visit({ id: 'v1' }), visit({ id: 'v2' })],
      pageInfo: { hasNextPage: false, endCursor: null },
    });
    await GET(makeReq('Bearer cron-secret-shh'));
    expect(mockUpsert).toHaveBeenCalledTimes(2);
  });

  test('5. visit with status=COMPLETED → mirror row deleted (mapper-null path)', async () => {
    mockCredsFetch.mockResolvedValue({ data: [cred()] });
    mockFetchVisits.mockResolvedValueOnce({
      visits: [visit({ visitStatus: 'COMPLETED' })],
      pageInfo: { hasNextPage: false, endCursor: null },
    });
    await GET(makeReq('Bearer cron-secret-shh'));
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  test('6. cursor (jobber_last_schedule_poll_at) updates AFTER all upserts; never touches last_context_fetch_at', async () => {
    mockCredsFetch.mockResolvedValue({ data: [cred()] });
    mockFetchVisits.mockResolvedValueOnce({
      visits: [visit({ id: 'v1' }), visit({ id: 'v2' })],
      pageInfo: { hasNextPage: false, endCursor: null },
    });
    await GET(makeReq('Bearer cron-secret-shh'));
    expect(upsertSeqs.length).toBe(2);
    expect(cursorSeqs.length).toBe(1);
    expect(Math.max(...upsertSeqs)).toBeLessThan(cursorSeqs[0]);
    const updatePayload = mockCursorUpdate.mock.calls[0][0];
    expect(updatePayload).toHaveProperty('jobber_last_schedule_poll_at');
    expect(updatePayload).not.toHaveProperty('last_context_fetch_at');
  });

  test('7. error in tenant A does not prevent tenant B from being polled', async () => {
    mockCredsFetch.mockResolvedValue({
      data: [cred({ id: 'A', tenant_id: 'tA' }), cred({ id: 'B', tenant_id: 'tB' })],
    });
    mockFetchVisits
      .mockRejectedValueOnce(new Error('boom A'))
      .mockResolvedValueOnce({
        visits: [visit({ id: 'vB' })],
        pageInfo: { hasNextPage: false, endCursor: null },
      });
    const r = await GET(makeReq('Bearer cron-secret-shh'));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.tenants_polled).toBe(2);
    expect(body.results.find((x) => x.tenant_id === 'tA').status).toBe('error');
    expect(body.results.find((x) => x.tenant_id === 'tB').status).toBe('ok');
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });
});

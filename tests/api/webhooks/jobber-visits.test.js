/**
 * Phase 57 Plan 03 — webhook handler mirror branch.
 *
 * Covers VISIT_CREATE / VISIT_UPDATE / VISIT_DESTROY / VISIT_COMPLETE /
 * ASSIGNMENT_CREATE behaviors, HMAC enforcement, unknown-account silent-200,
 * P56 customer-context regression, and bookable-user filter exclusion.
 */

import { jest } from '@jest/globals';
import crypto from 'node:crypto';

process.env.JOBBER_CLIENT_ID = 'test-client-id';
process.env.JOBBER_CLIENT_SECRET = 'test-secret-shared-with-hmac';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';

// --- Supabase mock — branches by table name
// accounting_credentials → maybeSingle (cred lookup)
// calendar_events       → upsert / delete().eq().eq().eq()
const mockMaybeSingle = jest.fn();
const mockUpsert = jest.fn().mockResolvedValue({ error: null });
const mockDeleteEq3 = jest.fn().mockResolvedValue({ error: null });
const mockDeleteEq2 = jest.fn(() => ({ eq: mockDeleteEq3 }));
const mockDeleteEq1 = jest.fn(() => ({ eq: mockDeleteEq2 }));
const mockDelete = jest.fn(() => ({ eq: mockDeleteEq1 }));

const credChain = {
  select: () => credChain,
  eq: () => credChain,
  maybeSingle: () => mockMaybeSingle(),
};
const eventsChain = {
  upsert: (...args) => mockUpsert(...args),
  delete: () => mockDelete(),
};

jest.unstable_mockModule('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table) => (table === 'accounting_credentials' ? credChain : eventsChain),
  }),
}));

// --- graphql-request mock (for the existing customer-context resolve path)
const mockGqlRequest = jest.fn().mockResolvedValue({});
jest.unstable_mockModule('graphql-request', () => ({
  GraphQLClient: jest.fn().mockImplementation(() => ({ request: mockGqlRequest })),
  gql: (strings) => strings[0],
}));

// --- adapter mock — returns the cred unchanged so refresh path is a no-op
jest.unstable_mockModule('@/lib/integrations/adapter', () => ({
  refreshTokenIfNeeded: jest.fn(async (_admin, cred) => cred),
}));

// --- next/cache mock
const mockRevalidateTag = jest.fn();
jest.unstable_mockModule('next/cache', () => ({
  cacheTag: jest.fn(),
  revalidateTag: (...args) => mockRevalidateTag(...args),
}));

// --- jobber.js fetcher mock — controls what visit shape the mirror branch sees
const mockFetchVisitById = jest.fn();
jest.unstable_mockModule('@/lib/integrations/jobber', () => ({
  fetchJobberVisitById: (...args) => mockFetchVisitById(...args),
}));

let POST;
beforeAll(async () => {
  POST = (await import('@/app/api/webhooks/jobber/route')).POST;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockMaybeSingle.mockResolvedValue({ data: null });
  mockFetchVisitById.mockResolvedValue(null);
});

function sign(body, secret) {
  return crypto.createHmac('sha256', secret).update(body, 'utf8').digest('base64');
}
function makeReq(bodyStr, signature) {
  const headers = new Headers();
  if (signature !== undefined) headers.set('x-jobber-hmac-sha256', signature);
  headers.set('content-type', 'application/json');
  return new Request('http://localhost/api/webhooks/jobber', {
    method: 'POST',
    headers,
    body: bodyStr,
  });
}
function payload(topic, accountId = 'acct-1', itemId = 'visit-1') {
  return JSON.stringify({
    data: {
      webHookEvent: { topic, appId: 'app-1', accountId, itemId, occurredAt: '2026-04-18T15:30:00Z' },
    },
  });
}
function knownCred(extra = {}) {
  return {
    id: 'cred-1',
    tenant_id: 'voco-tenant-abc',
    provider: 'jobber',
    access_token: 'tok',
    external_account_id: 'acct-1',
    jobber_bookable_user_ids: null,
    ...extra,
  };
}
function makeVisit(overrides = {}) {
  return {
    id: 'visit-1',
    startAt: '2026-05-01T14:00:00.000Z',
    endAt: '2026-05-01T15:00:00.000Z',
    visitStatus: 'SCHEDULED',
    assignedUsers: { nodes: [{ id: 'u1', name: { full: 'John Smith' } }] },
    job: { client: { name: { full: 'Jane Doe' } } },
    ...overrides,
  };
}

describe('POST /api/webhooks/jobber — Phase 57 mirror branch', () => {
  it('1. VISIT_CREATE with valid HMAC → calendar_events upsert', async () => {
    mockMaybeSingle.mockResolvedValue({ data: knownCred() });
    mockFetchVisitById.mockResolvedValue(makeVisit());
    const body = payload('VISIT_CREATE');
    const r = await POST(makeReq(body, sign(body, process.env.JOBBER_CLIENT_SECRET)));
    expect(r.status).toBe(200);
    expect(mockFetchVisitById).toHaveBeenCalledWith({ cred: expect.any(Object), id: 'visit-1' });
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const [row, opts] = mockUpsert.mock.calls[0];
    expect(row).toMatchObject({
      tenant_id: 'voco-tenant-abc',
      provider: 'jobber',
      external_id: 'visit-1',
    });
    expect(opts).toEqual({ onConflict: 'tenant_id,provider,external_id' });
  });

  it('2. VISIT_UPDATE with new times → upsert with refreshed times', async () => {
    mockMaybeSingle.mockResolvedValue({ data: knownCred() });
    mockFetchVisitById.mockResolvedValue(
      makeVisit({ startAt: '2026-05-01T16:00:00.000Z', endAt: '2026-05-01T17:00:00.000Z' }),
    );
    const body = payload('VISIT_UPDATE');
    const r = await POST(makeReq(body, sign(body, process.env.JOBBER_CLIENT_SECRET)));
    expect(r.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockUpsert.mock.calls[0][0]).toMatchObject({
      start_time: '2026-05-01T16:00:00.000Z',
      end_time: '2026-05-01T17:00:00.000Z',
    });
  });

  it('3. VISIT_DESTROY → delete on (tenant, jobber, visitId), no upsert, no fetch', async () => {
    mockMaybeSingle.mockResolvedValue({ data: knownCred() });
    const body = payload('VISIT_DESTROY');
    const r = await POST(makeReq(body, sign(body, process.env.JOBBER_CLIENT_SECRET)));
    expect(r.status).toBe(200);
    expect(mockFetchVisitById).not.toHaveBeenCalled();
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockDeleteEq1).toHaveBeenCalledWith('tenant_id', 'voco-tenant-abc');
    expect(mockDeleteEq2).toHaveBeenCalledWith('provider', 'jobber');
    expect(mockDeleteEq3).toHaveBeenCalledWith('external_id', 'visit-1');
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('4. VISIT_UPDATE where fetched visit is COMPLETED → row deleted via mapper-null path', async () => {
    mockMaybeSingle.mockResolvedValue({ data: knownCred() });
    mockFetchVisitById.mockResolvedValue(makeVisit({ visitStatus: 'COMPLETED' }));
    const body = payload('VISIT_UPDATE');
    await POST(makeReq(body, sign(body, process.env.JOBBER_CLIENT_SECRET)));
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockDeleteEq3).toHaveBeenCalledWith('external_id', 'visit-1');
  });

  it('5. ASSIGNMENT_CREATE → re-fetch visit, apply with bookable filter', async () => {
    mockMaybeSingle.mockResolvedValue({ data: knownCred({ jobber_bookable_user_ids: ['u1'] }) });
    mockFetchVisitById.mockResolvedValue(makeVisit());
    const body = payload('ASSIGNMENT_CREATE');
    const r = await POST(makeReq(body, sign(body, process.env.JOBBER_CLIENT_SECRET)));
    expect(r.status).toBe(200);
    expect(mockFetchVisitById).toHaveBeenCalled();
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it('6. VISIT_CREATE with invalid HMAC → 401, no DB writes', async () => {
    mockMaybeSingle.mockResolvedValue({ data: knownCred() });
    const body = payload('VISIT_CREATE');
    const r = await POST(makeReq(body, 'bogus'));
    expect(r.status).toBe(401);
    expect(mockMaybeSingle).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('7. unknown accountId → silent 200, no mirror writes', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null });
    const body = payload('VISIT_CREATE', 'unknown-acct');
    const r = await POST(makeReq(body, sign(body, process.env.JOBBER_CLIENT_SECRET)));
    expect(r.status).toBe(200);
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('8. CLIENT_UPDATE still hits revalidateTag (P56 regression)', async () => {
    mockMaybeSingle.mockResolvedValue({ data: knownCred() });
    mockGqlRequest.mockResolvedValueOnce({ client: { id: 'c1', phones: [{ number: '+15551234567' }] } });
    const body = payload('CLIENT_UPDATE', 'acct-1', 'c1');
    const r = await POST(makeReq(body, sign(body, process.env.JOBBER_CLIENT_SECRET)));
    expect(r.status).toBe(200);
    expect(mockRevalidateTag).toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled(); // CLIENT_UPDATE not in JOBBER_VISIT_TOPICS
  });

  it('9. VISIT_UPDATE filtered out by bookable-user set → row deleted (mapper-null)', async () => {
    mockMaybeSingle.mockResolvedValue({ data: knownCred({ jobber_bookable_user_ids: ['u-other'] }) });
    mockFetchVisitById.mockResolvedValue(makeVisit()); // assignee u1
    const body = payload('VISIT_UPDATE');
    await POST(makeReq(body, sign(body, process.env.JOBBER_CLIENT_SECRET)));
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockDeleteEq3).toHaveBeenCalledWith('external_id', 'visit-1');
  });
});

/**
 * Integration tests for /api/webhooks/jobber (Phase 56 Plan 03).
 *
 * Covers HMAC verify (401 paths), unknown-tenant silent-200, per-phone
 * revalidateTag for CLIENT_UPDATE / JOB_UPDATE / INVOICE_UPDATE / VISIT_COMPLETE,
 * broad-tag fallback on GraphQL failure or zero valid phones, never-throws,
 * and malformed-JSON silent-200.
 */

import { jest } from '@jest/globals';
import crypto from 'node:crypto';

process.env.JOBBER_CLIENT_ID = 'test-client-id';
process.env.JOBBER_CLIENT_SECRET = 'test-secret-shared-with-hmac';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';

// --- Supabase mock
const mockMaybeSingle = jest.fn();
const credChain = {
  select: () => credChain,
  eq: () => credChain,
  maybeSingle: () => mockMaybeSingle(),
};
jest.unstable_mockModule('@supabase/supabase-js', () => ({
  createClient: () => ({ from: () => credChain }),
}));

// --- graphql-request mock
const mockGqlRequest = jest.fn();
jest.unstable_mockModule('graphql-request', () => ({
  GraphQLClient: jest.fn().mockImplementation(() => ({ request: mockGqlRequest })),
  gql: (strings) => strings[0],
}));

// --- adapter mock
jest.unstable_mockModule('@/lib/integrations/adapter', () => ({
  refreshTokenIfNeeded: jest.fn(async (_admin, cred) => cred),
}));

// --- next/cache mock
const mockRevalidateTag = jest.fn();
jest.unstable_mockModule('next/cache', () => ({
  cacheTag: jest.fn(),
  revalidateTag: (...args) => mockRevalidateTag(...args),
}));

let POST;
beforeAll(async () => {
  POST = (await import('@/app/api/webhooks/jobber/route')).POST;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockMaybeSingle.mockResolvedValue({ data: null });
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

function payload(topic, accountId = 'acct-1', itemId = 'item-1') {
  return JSON.stringify({
    data: {
      webHookEvent: {
        topic,
        appId: 'app-1',
        accountId,
        itemId,
        occurredAt: '2026-04-18T15:30:00Z',
      },
    },
  });
}

describe('POST /api/webhooks/jobber', () => {
  it('W1: missing HMAC header → 401', async () => {
    const body = payload('CLIENT_UPDATE');
    const r = await POST(makeReq(body /* no sig */));
    expect(r.status).toBe(401);
    expect(mockRevalidateTag).not.toHaveBeenCalled();
  });

  it('W2: wrong HMAC → 401', async () => {
    const body = payload('CLIENT_UPDATE');
    const r = await POST(makeReq(body, 'bogus'));
    expect(r.status).toBe(401);
    expect(mockRevalidateTag).not.toHaveBeenCalled();
  });

  it('W3: correct HMAC + unknown accountId → silent 200', async () => {
    const body = payload('CLIENT_UPDATE', 'unknown-acct');
    const r = await POST(makeReq(body, sign(body, process.env.JOBBER_CLIENT_SECRET)));
    expect(r.status).toBe(200);
    expect(mockRevalidateTag).not.toHaveBeenCalled();
  });

  it('W4: correct HMAC + known accountId + CLIENT_UPDATE → per-phone revalidateTag', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 'cred-1',
        tenant_id: 'voco-tenant-abc',
        provider: 'jobber',
        access_token: 'tok',
        external_account_id: 'acct-1',
      },
    });
    mockGqlRequest.mockResolvedValue({
      client: {
        phones: [
          { number: '(555) 123-4567' },
          { number: 'unparseable' },
          { number: '+447911123456' },
        ],
      },
    });
    const body = payload('CLIENT_UPDATE', 'acct-1', 'client-xyz');
    const r = await POST(makeReq(body, sign(body, process.env.JOBBER_CLIENT_SECRET)));
    expect(r.status).toBe(200);
    expect(mockRevalidateTag).toHaveBeenCalledWith('jobber-context-voco-tenant-abc-+15551234567');
    expect(mockRevalidateTag).toHaveBeenCalledWith('jobber-context-voco-tenant-abc-+447911123456');
    expect(mockRevalidateTag).not.toHaveBeenCalledWith('jobber-context-voco-tenant-abc');
  });

  it('W5: JOB_UPDATE → job.client.phones resolve → per-phone revalidateTag', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 'cred-1',
        tenant_id: 'voco-tenant-abc',
        provider: 'jobber',
        access_token: 'tok',
        external_account_id: 'acct-1',
      },
    });
    mockGqlRequest.mockResolvedValue({
      job: { client: { id: 'c1', phones: [{ number: '+15551234567' }] } },
    });
    const body = payload('JOB_UPDATE', 'acct-1', 'job-123');
    const r = await POST(makeReq(body, sign(body, process.env.JOBBER_CLIENT_SECRET)));
    expect(r.status).toBe(200);
    expect(mockRevalidateTag).toHaveBeenCalledWith('jobber-context-voco-tenant-abc-+15551234567');
  });

  it('W6: INVOICE_UPDATE → invoice.client.phones resolve → per-phone revalidateTag', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 'cred-1',
        tenant_id: 'voco-tenant-abc',
        provider: 'jobber',
        access_token: 'tok',
        external_account_id: 'acct-1',
      },
    });
    mockGqlRequest.mockResolvedValue({
      invoice: { client: { id: 'c1', phones: [{ number: '+15551234567' }] } },
    });
    const body = payload('INVOICE_UPDATE', 'acct-1', 'inv-123');
    const r = await POST(makeReq(body, sign(body, process.env.JOBBER_CLIENT_SECRET)));
    expect(r.status).toBe(200);
    expect(mockRevalidateTag).toHaveBeenCalledWith('jobber-context-voco-tenant-abc-+15551234567');
  });

  it('W7: VISIT_COMPLETE → job.client.phones resolve (VISIT goes through JOB path)', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 'cred-1',
        tenant_id: 'voco-tenant-abc',
        provider: 'jobber',
        access_token: 'tok',
        external_account_id: 'acct-1',
      },
    });
    mockGqlRequest.mockResolvedValue({
      job: { client: { id: 'c1', phones: [{ number: '+15551234567' }] } },
    });
    const body = payload('VISIT_COMPLETE', 'acct-1', 'visit-123');
    const r = await POST(makeReq(body, sign(body, process.env.JOBBER_CLIENT_SECRET)));
    expect(r.status).toBe(200);
    expect(mockRevalidateTag).toHaveBeenCalledWith('jobber-context-voco-tenant-abc-+15551234567');
  });

  it('W8: GraphQL throws → broad revalidateTag fallback + 200', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 'cred-1',
        tenant_id: 'voco-tenant-abc',
        provider: 'jobber',
        access_token: 'tok',
        external_account_id: 'acct-1',
      },
    });
    mockGqlRequest.mockRejectedValue(new Error('network down'));
    const body = payload('CLIENT_UPDATE', 'acct-1', 'client-xyz');
    const r = await POST(makeReq(body, sign(body, process.env.JOBBER_CLIENT_SECRET)));
    expect(r.status).toBe(200);
    expect(mockRevalidateTag).toHaveBeenCalledWith('jobber-context-voco-tenant-abc');
  });

  it('W9: client has zero valid phones → broad revalidateTag fallback', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 'cred-1',
        tenant_id: 'voco-tenant-abc',
        provider: 'jobber',
        access_token: 'tok',
        external_account_id: 'acct-1',
      },
    });
    mockGqlRequest.mockResolvedValue({
      client: { phones: [{ number: 'gibberish' }, { number: 'abc' }] },
    });
    const body = payload('CLIENT_UPDATE', 'acct-1', 'client-xyz');
    const r = await POST(makeReq(body, sign(body, process.env.JOBBER_CLIENT_SECRET)));
    expect(r.status).toBe(200);
    expect(mockRevalidateTag).toHaveBeenCalledWith('jobber-context-voco-tenant-abc');
  });

  it('W10: handler never throws across all branches', async () => {
    mockMaybeSingle.mockRejectedValue(new Error('db down'));
    const body = payload('CLIENT_UPDATE', 'acct-1');
    const sig = sign(body, process.env.JOBBER_CLIENT_SECRET);
    await expect(POST(makeReq(body, sig))).resolves.toBeInstanceOf(Response);
  });

  it('W11: HMAC-valid + malformed JSON → 200 silent-ignore', async () => {
    const bad = '{not-json';
    const sig = sign(bad, process.env.JOBBER_CLIENT_SECRET);
    const r = await POST(makeReq(bad, sig));
    expect(r.status).toBe(200);
    expect(mockRevalidateTag).not.toHaveBeenCalled();
  });
});

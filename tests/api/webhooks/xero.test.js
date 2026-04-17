/**
 * Unit tests for /api/webhooks/xero (Phase 55 Plan 04).
 * Covers HMAC verify, intent-verify handshake, per-phone invalidation,
 * broad-tag fallback, and unknown-tenant silent-ignore.
 */

import { jest } from '@jest/globals';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

process.env.XERO_WEBHOOK_KEY = 'test-secret-key';

const mockRevalidateTag = jest.fn();
const mockMaybeSingle = jest.fn();
const mockGetInvoices = jest.fn();
const mockGetContacts = jest.fn();

jest.unstable_mockModule('next/cache', () => ({
  revalidateTag: (...args) => mockRevalidateTag(...args),
  cacheTag: jest.fn(),
}));

const credChain = {
  select: () => credChain,
  eq: () => credChain,
  maybeSingle: () => mockMaybeSingle(),
};

jest.unstable_mockModule('@supabase/supabase-js', () => ({
  createClient: () => ({ from: () => credChain }),
}));

jest.unstable_mockModule('@/lib/integrations/adapter', () => ({
  getIntegrationAdapter: jest.fn(async () => ({
    setCredentials: jest.fn(),
    _xeroClient: {
      accountingApi: {
        getInvoices: mockGetInvoices,
        getContacts: mockGetContacts,
      },
    },
  })),
  refreshTokenIfNeeded: jest.fn(async (_a, c) => c),
}));

let POST;
beforeAll(async () => {
  POST = (await import('@/app/api/webhooks/xero/route')).POST;
});

beforeEach(() => {
  jest.clearAllMocks();
});

function sign(body, key = 'test-secret-key') {
  return crypto.createHmac('sha256', key).update(body, 'utf8').digest('base64');
}

function makeReq(body, signature) {
  const headers = new Headers();
  if (signature !== undefined) headers.set('x-xero-signature', signature);
  return new Request('http://localhost/api/webhooks/xero', {
    method: 'POST',
    headers,
    body,
  });
}

const fxDir = 'tests/fixtures/xero-webhook-payloads';
const goodEmpty = readFileSync(resolve(process.cwd(), `${fxDir}/intent-verify-good.json`), 'utf8');
const badEmpty = readFileSync(resolve(process.cwd(), `${fxDir}/intent-verify-bad.json`), 'utf8');
const invoiceBody = readFileSync(resolve(process.cwd(), `${fxDir}/invoice-event.json`), 'utf8');

describe('POST /api/webhooks/xero', () => {
  it('returns 401 when signature header missing', async () => {
    const res = await POST(makeReq(goodEmpty, undefined));
    expect(res.status).toBe(401);
    expect(mockRevalidateTag).not.toHaveBeenCalled();
  });

  it('returns 401 on bad signature (intent-verify probes 1-3)', async () => {
    const res = await POST(makeReq(badEmpty, 'aGVsbG8td29ybGQ='));
    expect(res.status).toBe(401);
    expect(mockRevalidateTag).not.toHaveBeenCalled();
  });

  it('returns 200 on valid signature with empty events body (intent-verify probe 4)', async () => {
    const res = await POST(makeReq(goodEmpty, sign(goodEmpty)));
    expect(res.status).toBe(200);
    expect(mockRevalidateTag).not.toHaveBeenCalled();
  });

  it('revalidates per-phone tag on INVOICE event with resolvable contact phones', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { tenant_id: 'voco-t-1', xero_tenant_id: '00000000-0000-0000-0000-0000000000aa' },
    });
    mockGetInvoices.mockResolvedValue({ body: { invoices: [{ contact: { contactID: 'cx1' } }] } });
    mockGetContacts.mockResolvedValue({
      body: { contacts: [{ phones: [{ phoneNumber: '+15551234567' }] }] },
    });

    const res = await POST(makeReq(invoiceBody, sign(invoiceBody)));
    expect(res.status).toBe(200);
    expect(mockRevalidateTag).toHaveBeenCalledWith('xero-context-voco-t-1-+15551234567');
  });

  it('revalidates per-phone tag once per phone for multi-phone contact and skips empty', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { tenant_id: 'voco-t-1', xero_tenant_id: '00000000-0000-0000-0000-0000000000aa' },
    });
    mockGetInvoices.mockResolvedValue({ body: { invoices: [{ contact: { contactID: 'cx1' } }] } });
    mockGetContacts.mockResolvedValue({
      body: {
        contacts: [{
          phones: [
            { phoneNumber: '+15551234567' },
            { phoneNumber: '+15559876543' },
            { phoneNumber: '' },
          ],
        }],
      },
    });

    await POST(makeReq(invoiceBody, sign(invoiceBody)));
    expect(mockRevalidateTag).toHaveBeenCalledWith('xero-context-voco-t-1-+15551234567');
    expect(mockRevalidateTag).toHaveBeenCalledWith('xero-context-voco-t-1-+15559876543');
    expect(mockRevalidateTag).not.toHaveBeenCalledWith('xero-context-voco-t-1-');
  });

  it('falls back to broad tag when contact resolution throws', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { tenant_id: 'voco-t-1', xero_tenant_id: '00000000-0000-0000-0000-0000000000aa' },
    });
    mockGetInvoices.mockRejectedValue(new Error('Xero 500'));

    const res = await POST(makeReq(invoiceBody, sign(invoiceBody)));
    expect(res.status).toBe(200);
    expect(mockRevalidateTag).toHaveBeenCalledWith('xero-context-voco-t-1');
  });

  it('silent-ignores (200, no invalidation) when Xero tenantId is unknown', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null });
    const res = await POST(makeReq(invoiceBody, sign(invoiceBody)));
    expect(res.status).toBe(200);
    expect(mockRevalidateTag).not.toHaveBeenCalled();
  });
});

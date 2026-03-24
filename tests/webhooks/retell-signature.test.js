/**
 * Tests for Retell webhook signature verification.
 * Ensures invalid signatures are rejected with 401 and valid ones proceed.
 */

import { jest } from '@jest/globals';

// Mock retell-sdk before importing the route
jest.unstable_mockModule('retell-sdk', () => {
  const mockVerify = jest.fn();
  const MockRetell = jest.fn(() => ({
    call: {
      transfer: jest.fn(),
    },
  }));
  MockRetell.verify = mockVerify;
  return { default: MockRetell };
});

jest.unstable_mockModule('@/lib/retell', () => ({
  retell: {
    call: {
      transfer: jest.fn(),
    },
  },
}));

const mockQuery = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
  upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
};
const mockSupabase = {
  from: jest.fn(() => mockQuery),
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn().mockResolvedValue({ data: { path: 'test/path.wav' }, error: null }),
    })),
  },
};

jest.unstable_mockModule('@/lib/supabase', () => ({
  supabase: mockSupabase,
}));

jest.unstable_mockModule('@/lib/call-processor', () => ({
  processCallAnalyzed: jest.fn(),
  processCallEnded: jest.fn(),
}));

// Mock next/server after() — just execute immediately in tests
jest.unstable_mockModule('next/server', () => ({
  after: jest.fn((fn) => fn()),
}));

let Retell;
let POST;

beforeAll(async () => {
  const retellModule = await import('retell-sdk');
  Retell = retellModule.default;
  const routeModule = await import('@/app/api/webhooks/retell/route.js');
  POST = routeModule.POST;
});

function makeRequest(body, signature = '') {
  const rawBody = JSON.stringify(body);
  return new Request('http://localhost/api/webhooks/retell', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-retell-signature': signature,
    },
    body: rawBody,
  });
}

describe('Retell webhook signature verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when x-retell-signature is invalid', async () => {
    Retell.verify.mockReturnValue(false);

    const req = makeRequest({ event: 'call_inbound', from_number: '+1234', to_number: '+5678' }, 'bad-sig');
    const res = await POST(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: 'Unauthorized' });
  });

  it('returns 401 when x-retell-signature header is missing', async () => {
    Retell.verify.mockReturnValue(false);

    const rawBody = JSON.stringify({ event: 'call_inbound', from_number: '+1234', to_number: '+5678' });
    const req = new Request('http://localhost/api/webhooks/retell', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: rawBody,
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('proceeds past signature check when Retell.verify returns true', async () => {
    Retell.verify.mockReturnValue(true);

    // Mock supabase to return no tenant for the inbound call
    const supabaseModule = await import('@/lib/supabase');
    const mockQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
    };
    supabaseModule.supabase.from = jest.fn(() => mockQuery);

    const req = makeRequest({ event: 'call_inbound', from_number: '+1234', to_number: '+5678' }, 'valid-sig');
    const res = await POST(req);

    expect(res.status).toBe(200);
  });
});

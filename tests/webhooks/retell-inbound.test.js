/**
 * Tests for Retell webhook inbound call handling and transfer_call function invocation.
 */

import { jest } from '@jest/globals';

// Mock retell-sdk before importing the route
jest.unstable_mockModule('retell-sdk', () => {
  const mockVerify = jest.fn(() => true); // Always valid signature in these tests
  const MockRetell = jest.fn(() => ({
    call: {
      transfer: jest.fn(),
    },
  }));
  MockRetell.verify = mockVerify;
  return { default: MockRetell };
});

const mockTransfer = jest.fn();

jest.unstable_mockModule('@/lib/retell', () => ({
  retell: {
    call: {
      transfer: mockTransfer,
    },
  },
}));

// Shared mutable supabase mock object
const mockFromImpl = jest.fn();
const mockSupabase = {
  from: (...args) => mockFromImpl(...args),
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

jest.unstable_mockModule('next/server', () => ({
  after: jest.fn((fn) => fn()),
}));

let POST;

beforeAll(async () => {
  const routeModule = await import('@/app/api/webhooks/retell/route.js');
  POST = routeModule.POST;
});

function makeInboundRequest(overrides = {}) {
  const body = {
    event: 'call_inbound',
    from_number: '+6591234567',
    to_number: '+6598765432',
    ...overrides,
  };
  return new Request('http://localhost/api/webhooks/retell', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-retell-signature': 'valid' },
    body: JSON.stringify(body),
  });
}

function makeChainableQuery(resolvedValue) {
  const q = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(resolvedValue),
    upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
  };
  return q;
}

describe('call_inbound event handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTransfer.mockResolvedValue({ success: true });
  });

  it('returns dynamic_variables with business_name and owner_phone from tenant record', async () => {
    const tenantQuery = makeChainableQuery({
      data: {
        id: 'tenant-uuid',
        business_name: 'Ace Plumbing',
        default_locale: 'en',
        onboarding_complete: true,
        owner_phone: '+6591234567',
      },
      error: null,
    });
    mockFromImpl.mockReturnValue(tenantQuery);

    const req = makeInboundRequest();
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dynamic_variables).toBeDefined();
    expect(body.dynamic_variables.business_name).toBe('Ace Plumbing');
    expect(body.dynamic_variables.owner_phone).toBe('+6591234567');
    expect(body.dynamic_variables.onboarding_complete).toBe(true);
  });

  it('returns default dynamic_variables when tenant not found', async () => {
    const tenantQuery = makeChainableQuery({
      data: null,
      error: { code: 'PGRST116' },
    });
    mockFromImpl.mockReturnValue(tenantQuery);

    const req = makeInboundRequest();
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dynamic_variables.business_name).toBe('HomeService');
    expect(body.dynamic_variables.onboarding_complete).toBe(false);
  });

  it('returns 200 for call_ended event', async () => {
    const callQuery = makeChainableQuery({ data: null, error: null });
    mockFromImpl.mockReturnValue(callQuery);

    const body = {
      event: 'call_ended',
      call: {
        call_id: 'call_test_123',
        from_number: '+1111',
        to_number: '+2222',
        start_timestamp: Date.now() - 60000,
        end_timestamp: Date.now(),
      },
    };
    const req = new Request('http://localhost/api/webhooks/retell', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-retell-signature': 'valid' },
      body: JSON.stringify(body),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const resBody = await res.json();
    expect(resBody).toEqual({ received: true });
  });

  it('returns 200 for call_analyzed event', async () => {
    const callQuery = makeChainableQuery({ data: null, error: null });
    mockFromImpl.mockReturnValue(callQuery);

    const body = {
      event: 'call_analyzed',
      call: {
        call_id: 'call_test_123',
        from_number: '+1111',
        to_number: '+2222',
      },
    };
    const req = new Request('http://localhost/api/webhooks/retell', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-retell-signature': 'valid' },
      body: JSON.stringify(body),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const resBody = await res.json();
    expect(resBody).toEqual({ received: true });
  });

  it('returns 200 for unknown event type', async () => {
    const body = { event: 'something_unknown' };
    const req = new Request('http://localhost/api/webhooks/retell', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-retell-signature': 'valid' },
      body: JSON.stringify(body),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const resBody = await res.json();
    expect(resBody).toEqual({ received: true });
  });
});

describe('transfer_call function invocation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTransfer.mockResolvedValue({ success: true });
  });

  it('calls retell.call.transfer() with owner_phone when transfer_call function is invoked', async () => {
    // First call = calls table lookup, second call = tenants table lookup
    let callCount = 0;
    mockFromImpl.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // calls table lookup
        return makeChainableQuery({ data: { tenant_id: 'tenant-uuid' }, error: null });
      } else {
        // tenants table lookup
        return makeChainableQuery({ data: { owner_phone: '+6591234567' }, error: null });
      }
    });

    const body = {
      event: 'call_function_invoked',
      call_id: 'call_123',
      function_call: { name: 'transfer_call', arguments: {} },
    };
    const req = new Request('http://localhost/api/webhooks/retell', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-retell-signature': 'valid' },
      body: JSON.stringify(body),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockTransfer).toHaveBeenCalledWith({
      call_id: 'call_123',
      transfer_to: '+6591234567',
    });
  });

  it('returns transfer_unavailable when owner_phone is not configured', async () => {
    let callCount = 0;
    mockFromImpl.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return makeChainableQuery({ data: { tenant_id: 'tenant-uuid' }, error: null });
      } else {
        // tenant has no owner_phone
        return makeChainableQuery({ data: { owner_phone: null }, error: null });
      }
    });

    const body = {
      event: 'call_function_invoked',
      call_id: 'call_123',
      function_call: { name: 'transfer_call', arguments: {} },
    };
    const req = new Request('http://localhost/api/webhooks/retell', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-retell-signature': 'valid' },
      body: JSON.stringify(body),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockTransfer).not.toHaveBeenCalled();
    const resBody = await res.json();
    expect(resBody.result).toBe('transfer_unavailable');
  });
});

/**
 * Unit tests for the test-call API route.
 * Tests Retell outbound call triggering and onboarding completion.
 */

import { jest } from '@jest/globals';

// Mutable shared mock for retell
const mockCreatePhoneCall = jest.fn();

jest.unstable_mockModule('@/lib/retell', () => ({
  retell: {
    call: {
      createPhoneCall: mockCreatePhoneCall,
    },
  },
}));

// Shared mutable supabase mock
const mockFromImpl = jest.fn();
const mockSupabase = {
  from: (...args) => mockFromImpl(...args),
};

jest.unstable_mockModule('@/lib/supabase', () => ({
  supabase: mockSupabase,
}));

// Server supabase mock (cookie-based, for auth)
const mockGetUser = jest.fn();

jest.unstable_mockModule('@/lib/supabase-server', () => ({
  createSupabaseServer: jest.fn().mockResolvedValue({
    auth: {
      getUser: mockGetUser,
    },
  }),
}));

let POST;

beforeAll(async () => {
  const routeModule = await import('@/app/api/onboarding/test-call/route.js');
  POST = routeModule.POST;
});

beforeEach(() => {
  jest.clearAllMocks();
});

function makeRequest() {
  return new Request('http://localhost/api/onboarding/test-call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
}

function makeChainableQuery(resolvedValue) {
  const q = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(resolvedValue),
    update: jest.fn().mockReturnThis(),
  };
  return q;
}

describe('POST /api/onboarding/test-call', () => {
  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 400 when tenant has no retell_phone_number', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { user_metadata: { tenant_id: 'tenant-123' } } },
    });

    const tenantQuery = makeChainableQuery({
      data: { retell_phone_number: null, owner_phone: '+15551234567', business_name: 'Test Co', tone_preset: 'professional' },
      error: null,
    });
    mockFromImpl.mockReturnValueOnce(tenantQuery);

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/not configured/i);
  });

  it('returns 400 when tenant has no owner_phone', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { user_metadata: { tenant_id: 'tenant-123' } } },
    });

    const tenantQuery = makeChainableQuery({
      data: { retell_phone_number: '+18005551234', owner_phone: null, business_name: 'Test Co', tone_preset: 'professional' },
      error: null,
    });
    mockFromImpl.mockReturnValueOnce(tenantQuery);

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/not configured/i);
  });

  it('happy path: calls createPhoneCall with correct params and returns call_id', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: {
        user: {
          user_metadata: { tenant_id: 'tenant-abc' },
        },
      },
    });

    const tenantQuery = makeChainableQuery({
      data: {
        retell_phone_number: '+18005550001',
        owner_phone: '+15559990000',
        business_name: 'Acme Plumbing',
        tone_preset: 'friendly',
      },
      error: null,
    });
    const updateQuery = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ error: null }),
    };
    mockFromImpl
      .mockReturnValueOnce(tenantQuery)    // tenant SELECT
      .mockReturnValueOnce(updateQuery);   // tenant UPDATE

    mockCreatePhoneCall.mockResolvedValueOnce({ call_id: 'call-xyz-123' });

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.call_id).toBe('call-xyz-123');

    expect(mockCreatePhoneCall).toHaveBeenCalledWith({
      from_number: '+18005550001',
      to_number: '+15559990000',
      retell_llm_dynamic_variables: {
        business_name: 'Acme Plumbing',
        onboarding_complete: true,
        tone_preset: 'friendly',
      },
    });
  });

  it('sets onboarding_complete=true and test_call_completed=true after call', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: {
        user: {
          user_metadata: { tenant_id: 'tenant-abc' },
        },
      },
    });

    const tenantQuery = makeChainableQuery({
      data: {
        retell_phone_number: '+18005550001',
        owner_phone: '+15559990000',
        business_name: 'Acme Plumbing',
        tone_preset: 'professional',
      },
      error: null,
    });
    const mockUpdateEq = jest.fn().mockResolvedValue({ error: null });
    const mockUpdate = jest.fn().mockReturnValue({ eq: mockUpdateEq });
    const updateQuery = { update: mockUpdate, eq: jest.fn() };
    mockFromImpl
      .mockReturnValueOnce(tenantQuery)
      .mockReturnValueOnce({ update: mockUpdate });

    mockCreatePhoneCall.mockResolvedValueOnce({ call_id: 'call-abc' });

    await POST(makeRequest());

    expect(mockUpdate).toHaveBeenCalledWith({
      test_call_completed: true,
      onboarding_complete: true,
    });
    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'tenant-abc');
  });

  it('returns 500 when createPhoneCall throws (Retell API error)', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: {
        user: {
          user_metadata: { tenant_id: 'tenant-abc' },
        },
      },
    });

    const tenantQuery = makeChainableQuery({
      data: {
        retell_phone_number: '+18005550001',
        owner_phone: '+15559990000',
        business_name: 'Acme Plumbing',
        tone_preset: 'professional',
      },
      error: null,
    });
    mockFromImpl.mockReturnValueOnce(tenantQuery);

    mockCreatePhoneCall.mockRejectedValueOnce(new Error('Retell API error'));

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toMatch(/test call failed/i);
  });
});

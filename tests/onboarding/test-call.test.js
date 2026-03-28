/**
 * Unit tests for the test-call API route.
 * Tests LiveKit SIP outbound call triggering and onboarding completion.
 */

import { jest } from '@jest/globals';

// Mutable shared mocks for LiveKit SDK
const mockCreateRoom = jest.fn().mockResolvedValue({});
const mockCreateSipParticipant = jest.fn().mockResolvedValue({});

jest.unstable_mockModule('livekit-server-sdk', () => ({
  RoomServiceClient: jest.fn().mockImplementation(() => ({
    createRoom: mockCreateRoom,
  })),
  SipClient: jest.fn().mockImplementation(() => ({
    createSipParticipant: mockCreateSipParticipant,
  })),
}));

// Shared mutable supabase mock
const mockFromImpl = jest.fn();
const mockSupabase = {
  from: (...args) => mockFromImpl(...args),
};

jest.unstable_mockModule('@/lib/supabase', () => ({
  supabase: mockSupabase,
}));

// Mock getTenantId — returns tenant-123 by default
const mockGetTenantId = jest.fn().mockResolvedValue('tenant-123');
jest.unstable_mockModule('@/lib/get-tenant-id', () => ({
  getTenantId: mockGetTenantId,
}));

let POST;

beforeAll(async () => {
  const routeModule = await import('@/app/api/onboarding/test-call/route.js');
  POST = routeModule.POST;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGetTenantId.mockResolvedValue('tenant-123');
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
    mockGetTenantId.mockResolvedValueOnce(null);

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 400 when tenant has no phone_number', async () => {
    const tenantQuery = makeChainableQuery({
      data: { phone_number: null, owner_phone: '+15551234567', business_name: 'Test Co', tone_preset: 'professional' },
      error: null,
    });
    mockFromImpl.mockReturnValue(tenantQuery);

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/not configured/i);
  });

  it('returns 400 when tenant has no owner_phone', async () => {
    const tenantQuery = makeChainableQuery({
      data: { phone_number: '+18005551234', owner_phone: null, business_name: 'Test Co', tone_preset: 'professional' },
      error: null,
    });
    mockFromImpl.mockReturnValue(tenantQuery);

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/not configured/i);
  });

  it('happy path: creates LiveKit room and SIP participant, returns call_id', async () => {
    const tenantQuery = makeChainableQuery({
      data: {
        phone_number: '+18005550001',
        owner_phone: '+15559990000',
        business_name: 'Acme Plumbing',
        tone_preset: 'friendly',
      },
      error: null,
    });
    const mockUpdateEq = jest.fn().mockResolvedValue({ error: null });
    const mockUpdate = jest.fn().mockReturnValue({ eq: mockUpdateEq });
    mockFromImpl.mockImplementation((table) => {
      if (table === 'tenants') {
        // First call is SELECT, subsequent calls are UPDATE
        return tenantQuery;
      }
      return { update: mockUpdate };
    });

    // Override the select chain for update
    let selectCallCount = 0;
    mockFromImpl.mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) return tenantQuery; // SELECT
      return { update: mockUpdate, eq: jest.fn().mockResolvedValue({ error: null }) }; // UPDATE
    });

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.call_id).toMatch(/^test-call-tenant-123-/);

    // Verify room was created with test_call metadata
    expect(mockCreateRoom).toHaveBeenCalledTimes(1);
    const roomArgs = mockCreateRoom.mock.calls[0][0];
    expect(roomArgs.name).toMatch(/^test-call-/);
    const metadata = JSON.parse(roomArgs.metadata);
    expect(metadata.test_call).toBe(true);

    // Verify SIP participant was created
    expect(mockCreateSipParticipant).toHaveBeenCalledTimes(1);
  });

  it('returns 500 when LiveKit API throws', async () => {
    const tenantQuery = makeChainableQuery({
      data: {
        phone_number: '+18005550001',
        owner_phone: '+15559990000',
        business_name: 'Acme Plumbing',
        tone_preset: 'professional',
      },
      error: null,
    });
    mockFromImpl.mockReturnValue(tenantQuery);

    mockCreateRoom.mockRejectedValueOnce(new Error('LiveKit API error'));

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toMatch(/test call failed/i);
  });
});

/**
 * Tests for the admin Test Agent console API routes:
 *   POST /api/admin/test-agent/session  — room + token minting (sandbox metadata)
 *   POST /api/admin/test-agent/dispatch — explicit agent dispatch (test-web-* only)
 *   GET  /api/admin/test-agent/result   — flagged calls row + signed MP4 URL
 */

import { jest } from '@jest/globals';

const mockVerifyAdmin = jest.fn();
jest.unstable_mockModule('@/lib/admin', () => ({
  verifyAdmin: mockVerifyAdmin,
}));

const mockCreateRoom = jest.fn().mockResolvedValue({});
const mockCreateDispatch = jest.fn().mockResolvedValue({ id: 'dispatch-1' });
const mockAddGrant = jest.fn();
const mockToJwt = jest.fn().mockResolvedValue('mock-jwt');

jest.unstable_mockModule('livekit-server-sdk', () => ({
  RoomServiceClient: jest.fn().mockImplementation(() => ({
    createRoom: mockCreateRoom,
  })),
  AgentDispatchClient: jest.fn().mockImplementation(() => ({
    createDispatch: mockCreateDispatch,
  })),
  AccessToken: jest.fn().mockImplementation(() => ({
    addGrant: mockAddGrant,
    toJwt: mockToJwt,
  })),
}));

const mockFromImpl = jest.fn();
const mockCreateSignedUrl = jest.fn().mockResolvedValue({
  data: { signedUrl: 'https://signed.example/rec.mp4' },
});
jest.unstable_mockModule('@/lib/supabase', () => ({
  supabase: {
    from: (...args) => mockFromImpl(...args),
    storage: {
      from: () => ({ createSignedUrl: mockCreateSignedUrl }),
    },
  },
}));

let sessionPOST, sessionGET, dispatchPOST, resultGET;

beforeAll(async () => {
  ({ POST: sessionPOST, GET: sessionGET } = await import('@/app/api/admin/test-agent/session/route.js'));
  ({ POST: dispatchPOST } = await import('@/app/api/admin/test-agent/dispatch/route.js'));
  ({ GET: resultGET } = await import('@/app/api/admin/test-agent/result/route.js'));
});

beforeEach(() => {
  jest.clearAllMocks();
  mockVerifyAdmin.mockResolvedValue({ id: 'admin-user' });
  mockToJwt.mockResolvedValue('mock-jwt');
  mockCreateSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed.example/rec.mp4' } });
});

function jsonRequest(url, body) {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const TENANT = {
  id: 'tenant-1',
  business_name: 'Acme Plumbing',
  phone_number: '+18005550001',
  onboarding_complete: true,
  country: 'US',
  default_locale: 'en',
};

function mockTenantSelect(tenant) {
  mockFromImpl.mockImplementation((table) => {
    if (table === 'tenants') {
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: tenant, error: tenant ? null : { message: 'not found' } }),
          }),
        }),
      };
    }
    return null;
  });
}

describe('POST /api/admin/test-agent/session', () => {
  it('403s non-admins', async () => {
    mockVerifyAdmin.mockResolvedValueOnce(null);
    const res = await sessionPOST(jsonRequest('http://localhost/api/admin/test-agent/session', { tenant_id: 'tenant-1' }));
    expect(res.status).toBe(403);
  });

  it('400s without tenant_id', async () => {
    const res = await sessionPOST(jsonRequest('http://localhost/api/admin/test-agent/session', {}));
    expect(res.status).toBe(400);
  });

  it('400s on a malformed simulate_from_number', async () => {
    mockTenantSelect(TENANT);
    const res = await sessionPOST(jsonRequest('http://localhost/api/admin/test-agent/session', {
      tenant_id: 'tenant-1',
      simulate_from_number: 'not-a-phone',
    }));
    expect(res.status).toBe(400);
  });

  it('400s when the tenant has no AI phone number', async () => {
    mockTenantSelect({ ...TENANT, phone_number: null });
    const res = await sessionPOST(jsonRequest('http://localhost/api/admin/test-agent/session', { tenant_id: 'tenant-1' }));
    expect(res.status).toBe(400);
  });

  it('happy path: creates a test-web room with sandbox metadata and returns a token', async () => {
    mockTenantSelect(TENANT);
    const res = await sessionPOST(jsonRequest('http://localhost/api/admin/test-agent/session', {
      tenant_id: 'tenant-1',
      simulate_from_number: '+65 9123 4567',
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.room_name).toMatch(/^test-web-tenant-1-/);
    expect(body.token).toBe('mock-jwt');

    expect(mockCreateRoom).toHaveBeenCalledTimes(1);
    const roomArgs = mockCreateRoom.mock.calls[0][0];
    // Never the SIP dispatch prefix (call-) nor the webhook prefix (test-call-)
    expect(roomArgs.name.startsWith('test-web-')).toBe(true);
    const metadata = JSON.parse(roomArgs.metadata);
    expect(metadata.test_call).toBe(true);
    expect(metadata.web_test).toBe(true);
    expect(metadata.to_number).toBe('+18005550001');
    expect(metadata.from_number).toBe('+6591234567');

    // Join-only grant — no admin/metadata powers for the browser
    expect(mockAddGrant).toHaveBeenCalledWith(
      expect.objectContaining({ roomJoin: true, canPublish: true, canSubscribe: true }),
    );
  });

  it('GET returns the curated voice options (admin-gated)', async () => {
    const res = await sessionGET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(body.voices)).toBe(true);
    expect(body.voices.length).toBeGreaterThan(0);
    expect(body.voices[0]).toEqual(
      expect.objectContaining({ id: expect.any(String), label: expect.any(String), group: expect.any(String) }),
    );

    mockVerifyAdmin.mockResolvedValueOnce(null);
    const forbidden = await sessionGET();
    expect(forbidden.status).toBe(403);
  });

  it('400s on a voice_override outside the curated allowlist', async () => {
    mockTenantSelect(TENANT);
    const res = await sessionPOST(jsonRequest('http://localhost/api/admin/test-agent/session', {
      tenant_id: 'tenant-1',
      voice_override: 'not-a-curated-voice-id',
    }));
    expect(res.status).toBe(400);
    expect(mockCreateRoom).not.toHaveBeenCalled();
  });

  it('passes a curated voice_override through to the room metadata', async () => {
    mockTenantSelect(TENANT);
    const res = await sessionPOST(jsonRequest('http://localhost/api/admin/test-agent/session', {
      tenant_id: 'tenant-1',
      voice_override: 'EXAVITQu4vr4xnSDxMaL', // Sarah — in VOICE_OPTIONS
    }));
    expect(res.status).toBe(200);
    const metadata = JSON.parse(mockCreateRoom.mock.calls[0][0].metadata);
    expect(metadata.voice_override).toBe('EXAVITQu4vr4xnSDxMaL');
    expect(metadata.test_call).toBe(true);
  });

  it('omits voice_override from metadata when not requested', async () => {
    mockTenantSelect(TENANT);
    const res = await sessionPOST(jsonRequest('http://localhost/api/admin/test-agent/session', {
      tenant_id: 'tenant-1',
    }));
    expect(res.status).toBe(200);
    const metadata = JSON.parse(mockCreateRoom.mock.calls[0][0].metadata);
    expect('voice_override' in metadata).toBe(false);
  });
});

describe('POST /api/admin/test-agent/dispatch', () => {
  it('403s non-admins', async () => {
    mockVerifyAdmin.mockResolvedValueOnce(null);
    const res = await dispatchPOST(jsonRequest('http://localhost/api/admin/test-agent/dispatch', { room_name: 'test-web-x-1' }));
    expect(res.status).toBe(403);
  });

  it('rejects non test-web rooms (cannot inject an agent into live call rooms)', async () => {
    const res = await dispatchPOST(jsonRequest('http://localhost/api/admin/test-agent/dispatch', { room_name: 'call-abc123' }));
    expect(res.status).toBe(400);
    expect(mockCreateDispatch).not.toHaveBeenCalled();
  });

  it('dispatches the voco-voice-agent into a test-web room', async () => {
    const res = await dispatchPOST(jsonRequest('http://localhost/api/admin/test-agent/dispatch', { room_name: 'test-web-tenant-1-123' }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.agent_name).toBe('voco-voice-agent');
    expect(mockCreateDispatch).toHaveBeenCalledWith('test-web-tenant-1-123', 'voco-voice-agent');
  });
});

describe('GET /api/admin/test-agent/result', () => {
  function mockCallsSelect(call) {
    mockFromImpl.mockImplementation((table) => {
      if (table === 'calls') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: call, error: null }),
            }),
          }),
        };
      }
      return null;
    });
  }

  it('rejects non test-web rooms', async () => {
    const res = await resultGET(new Request('http://localhost/api/admin/test-agent/result?room=call-abc'));
    expect(res.status).toBe(400);
  });

  it('returns null call while the agent has not inserted the row yet', async () => {
    mockCallsSelect(null);
    const res = await resultGET(new Request('http://localhost/api/admin/test-agent/result?room=test-web-t-1'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.call).toBeNull();
  });

  it('refuses to serve a non-test call row', async () => {
    mockCallsSelect({ call_id: 'test-web-t-1', is_test_call: false });
    const res = await resultGET(new Request('http://localhost/api/admin/test-agent/result?room=test-web-t-1'));
    expect(res.status).toBe(400);
  });

  it('returns the call row and a signed MP4 URL', async () => {
    mockCallsSelect({
      call_id: 'test-web-t-1',
      is_test_call: true,
      status: 'analyzed',
      booking_outcome: 'booked',
      recording_storage_path: 'tenant-1/test-web-t-1.mp4',
    });
    const res = await resultGET(new Request('http://localhost/api/admin/test-agent/result?room=test-web-t-1'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.call.booking_outcome).toBe('booked');
    expect(body.recording_url).toBe('https://signed.example/rec.mp4');
    expect(mockCreateSignedUrl).toHaveBeenCalledWith(
      'tenant-1/test-web-t-1.mp4',
      3600,
      expect.objectContaining({ download: 'test-web-t-1.mp4' }),
    );
  });
});

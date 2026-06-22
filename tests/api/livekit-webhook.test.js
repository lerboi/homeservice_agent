/**
 * LiveKit webhook (/api/webhooks/livekit) — test-call connect verification.
 *
 * Mocks `livekit-server-sdk` (WebhookReceiver.receive) + `@/lib/supabase` so we
 * exercise the routing/guard logic without crafting a signed JWT.
 */

import { jest } from '@jest/globals';

const mockReceive = jest.fn();
jest.unstable_mockModule('livekit-server-sdk', () => ({
  WebhookReceiver: jest.fn().mockImplementation(() => ({ receive: mockReceive })),
}));

const mockEq = jest.fn();
const mockUpdate = jest.fn(() => ({ eq: mockEq }));
const mockFrom = jest.fn(() => ({ update: mockUpdate }));
jest.unstable_mockModule('@/lib/supabase', () => ({
  supabase: { from: mockFrom },
}));

let POST;

beforeAll(async () => {
  process.env.LIVEKIT_API_KEY = 'test-key';
  process.env.LIVEKIT_API_SECRET = 'test-secret';
  ({ POST } = await import('@/app/api/webhooks/livekit/route.js'));
});

beforeEach(() => {
  jest.clearAllMocks();
  mockEq.mockResolvedValue({ error: null });
});

function makeRequest(authHeader = 'Bearer signed.jwt.here') {
  return new Request('http://localhost/api/webhooks/livekit', {
    method: 'POST',
    headers: authHeader
      ? { authorization: authHeader, 'content-type': 'application/webhook+json' }
      : {},
    body: '{"raw":"body"}',
  });
}

const ownerJoin = (overrides = {}) => ({
  event: 'participant_joined',
  room: {
    name: 'test-call-tenant-123-1700000000',
    metadata: JSON.stringify({ test_call: true, tenant_id: 'tenant-123' }),
  },
  participant: { identity: 'caller-+18005551234', kind: 3 },
  ...overrides,
});

describe('POST /api/webhooks/livekit', () => {
  it('returns 401 on signature failure and writes nothing', async () => {
    mockReceive.mockRejectedValueOnce(new Error('bad sig'));
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('marks the tenant connected when the owner SIP leg joins a test-call room', async () => {
    mockReceive.mockResolvedValueOnce(ownerJoin());
    const res = await POST(makeRequest());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.received).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('tenants');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        test_call_completed: true,
        test_call_status: 'connected',
      })
    );
    expect(mockEq).toHaveBeenCalledWith('id', 'tenant-123');
  });

  it('resolves the tenant from the room name when metadata is absent', async () => {
    mockReceive.mockResolvedValueOnce(
      ownerJoin({ room: { name: 'test-call-abc-9-1700000000' } })
    );
    await POST(makeRequest());
    expect(mockEq).toHaveBeenCalledWith('id', 'abc-9');
  });

  it('ignores the agent participant (only the owner SIP leg counts)', async () => {
    mockReceive.mockResolvedValueOnce(
      ownerJoin({ participant: { identity: 'agent-AB12', kind: 4 } })
    );
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('ignores participant_joined outside a test-call room', async () => {
    mockReceive.mockResolvedValueOnce(
      ownerJoin({ room: { name: 'inbound-room-xyz', metadata: '' } })
    );
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('ignores non-participant_joined events', async () => {
    mockReceive.mockResolvedValueOnce({ event: 'room_finished', room: { name: 'test-call-x-1' } });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns 500 on DB write failure so LiveKit retries (idempotent update)', async () => {
    mockEq.mockResolvedValueOnce({ error: { message: 'db down' } });
    mockReceive.mockResolvedValueOnce(ownerJoin());
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
  });
});

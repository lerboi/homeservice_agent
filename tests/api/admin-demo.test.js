/**
 * Tests for the Demo Studio API routes:
 *   GET  /api/admin/demo/status   — tenant, tasks, destination health, leftovers
 *   POST /api/admin/demo/session  — room + token with the server-set demo block
 *   POST /api/admin/demo/cleanup  — remove a demo call's calendar event and booking
 *
 * The Supabase / Google side (src/lib/demo/server.js) is mocked at its module
 * boundary; the session rules themselves are covered in tests/unit/demo-studio.test.js.
 */

import { jest } from '@jest/globals';

const mockVerifyAdmin = jest.fn();
jest.unstable_mockModule('@/lib/admin', () => ({ verifyAdmin: mockVerifyAdmin }));

const mockCreateRoom = jest.fn().mockResolvedValue({});
const mockAddGrant = jest.fn();
const mockToJwt = jest.fn().mockResolvedValue('mock-jwt');
jest.unstable_mockModule('livekit-server-sdk', () => ({
  RoomServiceClient: jest.fn().mockImplementation(() => ({ createRoom: mockCreateRoom })),
  AccessToken: jest.fn().mockImplementation(() => ({ addGrant: mockAddGrant, toJwt: mockToJwt })),
}));

const mockResolveDemoTenant = jest.fn();
const mockGetDestinationStatuses = jest.fn();
const mockListKeptBookings = jest.fn();
const mockRemoveDemoBooking = jest.fn();
jest.unstable_mockModule('@/lib/demo/server', () => ({
  resolveDemoTenant: mockResolveDemoTenant,
  getDestinationStatuses: mockGetDestinationStatuses,
  listKeptBookings: mockListKeptBookings,
  removeDemoBooking: mockRemoveDemoBooking,
}));

let statusGET, sessionPOST, cleanupPOST;

beforeAll(async () => {
  ({ GET: statusGET } = await import('@/app/api/admin/demo/status/route.js'));
  ({ POST: sessionPOST } = await import('@/app/api/admin/demo/session/route.js'));
  ({ POST: cleanupPOST } = await import('@/app/api/admin/demo/cleanup/route.js'));
});

const TENANT = {
  id: 'tenant-1',
  business_name: 'Voco',
  phone_number: '+18005550001',
  tenant_timezone: 'Asia/Singapore',
};
const STATUSES = [
  { id: 'google', label: 'Google Calendar', kind: 'external', connected: true, healthy: true, account: 'owner@example.com' },
  { id: 'outlook', label: 'Outlook Calendar', kind: 'external', connected: false, healthy: false },
  { id: 'voco', label: 'Voco calendar only', kind: 'internal', connected: true, healthy: true },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockVerifyAdmin.mockResolvedValue({ id: 'admin-user' });
  mockToJwt.mockResolvedValue('mock-jwt');
  mockResolveDemoTenant.mockResolvedValue(TENANT);
  mockGetDestinationStatuses.mockResolvedValue(STATUSES);
  mockListKeptBookings.mockResolvedValue([]);
  mockRemoveDemoBooking.mockResolvedValue({ found: true, removed: [] });
});

function post(url, body) {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('GET /api/admin/demo/status', () => {
  it('403s non-admins without touching the tenant', async () => {
    mockVerifyAdmin.mockResolvedValueOnce(null);
    const res = await statusGET();
    expect(res.status).toBe(403);
    expect(mockResolveDemoTenant).not.toHaveBeenCalled();
  });

  it('404s when the admin has no demo tenant', async () => {
    mockResolveDemoTenant.mockResolvedValueOnce(null);
    expect((await statusGET()).status).toBe(404);
  });

  it('returns tenant, tasks, destination health, voices and leftovers', async () => {
    mockListKeptBookings.mockResolvedValueOnce([{ appointment_id: 'appt-9', room_name: 'test-web-tenant-1-1' }]);
    const res = await statusGET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.tenant).toEqual({ id: 'tenant-1', business_name: 'Voco', timezone: 'Asia/Singapore', can_take_calls: true });
    expect(json.scenarios.find((s) => s.id === 'scheduling').status).toBe('live');
    expect(json.destinations).toEqual(STATUSES);
    expect(json.voices.length).toBeGreaterThan(0);
    expect(json.kept_bookings).toHaveLength(1);
    // The phone number itself is not sent to the browser.
    expect(JSON.stringify(json)).not.toContain('+18005550001');
  });
});

describe('POST /api/admin/demo/session', () => {
  const url = 'http://localhost/api/admin/demo/session';

  it('403s non-admins', async () => {
    mockVerifyAdmin.mockResolvedValueOnce(null);
    const res = await sessionPOST(post(url, { task: 'scheduling', destination: 'google' }));
    expect(res.status).toBe(403);
    expect(mockCreateRoom).not.toHaveBeenCalled();
  });

  it('400s on a malformed body', async () => {
    expect((await sessionPOST(post(url, '{not json'))).status).toBe(400);
  });

  it('400s when the demo tenant cannot take calls', async () => {
    mockResolveDemoTenant.mockResolvedValueOnce({ ...TENANT, phone_number: null });
    const res = await sessionPOST(post(url, { task: 'scheduling', destination: 'google' }));
    expect(res.status).toBe(400);
    expect(mockCreateRoom).not.toHaveBeenCalled();
  });

  it('409s and creates no room when the chosen calendar is not ready', async () => {
    const res = await sessionPOST(post(url, { task: 'scheduling', destination: 'outlook' }));
    expect(res.status).toBe(409);
    expect(mockCreateRoom).not.toHaveBeenCalled();
  });

  it('400s for a task that is not live', async () => {
    const res = await sessionPOST(post(url, { task: 'lead_crm', destination: 'google' }));
    expect(res.status).toBe(400);
    expect(mockCreateRoom).not.toHaveBeenCalled();
  });

  it('creates a test-web room whose server-set metadata carries the demo block', async () => {
    const res = await sessionPOST(post(url, { task: 'scheduling', destination: 'google' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.room_name).toMatch(/^test-web-tenant-1-\d+$/);
    expect(json.token).toBe('mock-jwt');
    expect(json.demo).toEqual({ task: 'scheduling', destination: 'google' });

    expect(mockCreateRoom).toHaveBeenCalledTimes(1);
    const room = mockCreateRoom.mock.calls[0][0];
    expect(room.name).toBe(json.room_name);
    expect(JSON.parse(room.metadata)).toEqual({
      test_call: true,
      web_test: true,
      tenant_id: 'tenant-1',
      to_number: '+18005550001',
      demo: { task: 'scheduling', destination: 'google', keep_booking: true },
    });
  });

  it('ignores client attempts to set the tenant or sandbox flags', async () => {
    await sessionPOST(post(url, {
      task: 'scheduling',
      destination: 'voco',
      tenant_id: 'someone-else',
      test_call: false,
      demo: { destination: 'google', keep_booking: false },
    }));
    const meta = JSON.parse(mockCreateRoom.mock.calls[0][0].metadata);
    expect(meta.tenant_id).toBe('tenant-1');
    expect(meta.test_call).toBe(true);
    expect(meta.demo).toEqual({ task: 'scheduling', destination: 'voco', keep_booking: true });
  });

  it('grants the browser join and publish only, never room admin', async () => {
    await sessionPOST(post(url, { task: 'scheduling', destination: 'google' }));
    const grant = mockAddGrant.mock.calls[0][0];
    expect(grant).toMatchObject({ roomJoin: true, canPublish: true, canSubscribe: true });
    expect(grant.roomAdmin).toBeUndefined();
    expect(grant.canUpdateOwnMetadata).toBeUndefined();
  });
});

describe('POST /api/admin/demo/cleanup', () => {
  const url = 'http://localhost/api/admin/demo/cleanup';
  const ROOM = 'test-web-tenant-1-1700000000000';

  it('403s non-admins', async () => {
    mockVerifyAdmin.mockResolvedValueOnce(null);
    expect((await cleanupPOST(post(url, { room_name: ROOM }))).status).toBe(403);
    expect(mockRemoveDemoBooking).not.toHaveBeenCalled();
  });

  it.each([
    ['another tenant', 'test-web-tenant-2-1700000000000'],
    ['a real call room', 'call-tenant-1-1700000000000'],
    ['missing', undefined],
  ])('400s for a room that is %s', async (_label, room) => {
    const res = await cleanupPOST(post(url, { room_name: room }));
    expect(res.status).toBe(400);
    expect(mockRemoveDemoBooking).not.toHaveBeenCalled();
  });

  it('removes the booking of a demo room of the demo tenant', async () => {
    mockRemoveDemoBooking.mockResolvedValueOnce({
      found: true,
      removed: [{ appointment_id: 'appt-1', event_deleted: true, event_note: null }],
    });
    const res = await cleanupPOST(post(url, { room_name: ROOM }));
    expect(res.status).toBe(200);
    expect(mockRemoveDemoBooking).toHaveBeenCalledWith('tenant-1', ROOM);
    expect(await res.json()).toMatchObject({ found: true, clean: true });
  });

  it('reports when the calendar event could not be deleted', async () => {
    mockRemoveDemoBooking.mockResolvedValueOnce({
      found: true,
      removed: [{ appointment_id: 'appt-1', event_deleted: false, event_note: 'invalid_grant' }],
    });
    const json = await (await cleanupPOST(post(url, { room_name: ROOM }))).json();
    expect(json.clean).toBe(false);
  });

  it('400s when the call is not a test call', async () => {
    mockRemoveDemoBooking.mockResolvedValueOnce({ found: false, removed: [], error: 'Not a test call' });
    expect((await cleanupPOST(post(url, { room_name: ROOM }))).status).toBe(400);
  });
});

import { describe, test, expect, jest, beforeEach } from '@jest/globals';

// --- Mock googleapis before any imports ---
const mockEventsWatch = jest.fn();
const mockEventsList = jest.fn();
const mockEventsInsert = jest.fn();
const mockChannelsStop = jest.fn();
const mockCalendarListGet = jest.fn();
const mockGenerateAuthUrl = jest.fn();
const mockGetToken = jest.fn();
const mockRevokeToken = jest.fn();
const mockSetCredentials = jest.fn();

jest.unstable_mockModule('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        generateAuthUrl: mockGenerateAuthUrl,
        getToken: mockGetToken,
        revokeToken: mockRevokeToken,
        setCredentials: mockSetCredentials,
      })),
    },
    calendar: jest.fn().mockReturnValue({
      events: {
        watch: mockEventsWatch,
        list: mockEventsList,
        insert: mockEventsInsert,
      },
      channels: {
        stop: mockChannelsStop,
      },
      calendarList: {
        get: mockCalendarListGet,
      },
    }),
  },
}));

// --- Mock supabase ---
const mockFrom = jest.fn();
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockSingle = jest.fn();
const mockUpsert = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockInsert = jest.fn();

// Build chainable supabase mock
function makeChain(finalResult) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(finalResult),
    upsert: jest.fn().mockResolvedValue({ error: null }),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    insert: jest.fn().mockResolvedValue({ error: null }),
    lt: jest.fn().mockReturnThis(),
  };
  return chain;
}

jest.unstable_mockModule('@/lib/supabase.js', () => ({
  supabase: {
    from: mockFrom,
  },
}));

// Dynamic imports after mocks
const { createOAuth2Client, getAuthUrl, handleGoogleCalendarPush, syncCalendarEvents, pushBookingToCalendar } =
  await (async () => {
    const calendarModule = await import('@/lib/scheduling/google-calendar.js');
    const webhookModule = await import('@/lib/webhooks/google-calendar-push.js');
    return {
      createOAuth2Client: calendarModule.createOAuth2Client,
      getAuthUrl: calendarModule.getAuthUrl,
      syncCalendarEvents: calendarModule.syncCalendarEvents,
      pushBookingToCalendar: calendarModule.pushBookingToCalendar,
      handleGoogleCalendarPush: webhookModule.handleGoogleCalendarPush,
    };
  })();

beforeEach(() => {
  jest.clearAllMocks();
});

// --- createOAuth2Client tests ---
describe('createOAuth2Client', () => {
  test('creates OAuth2 client with correct env vars', async () => {
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';

    const client = createOAuth2Client();
    expect(client).toBeDefined();

    const { google } = await import('googleapis');
    expect(google.auth.OAuth2).toHaveBeenCalledWith(
      'test-client-id',
      'test-client-secret',
      'https://example.com/api/google-calendar/callback'
    );
  });
});

// --- getAuthUrl tests ---
describe('getAuthUrl', () => {
  test('returns auth URL with calendar.events scope and prompt=consent', async () => {
    const mockOAuth2Client = {
      generateAuthUrl: jest.fn().mockReturnValue('https://accounts.google.com/o/oauth2/auth?...'),
    };

    const url = getAuthUrl(mockOAuth2Client);

    expect(mockOAuth2Client.generateAuthUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        access_type: 'offline',
        prompt: 'consent',
        scope: expect.arrayContaining([
          expect.stringContaining('calendar.events'),
        ]),
      })
    );
    expect(url).toBe('https://accounts.google.com/o/oauth2/auth?...');
  });
});

// --- handleGoogleCalendarPush tests ---
describe('handleGoogleCalendarPush', () => {
  test('returns immediately on sync state without calling syncCalendarEvents', async () => {
    const request = {
      headers: {
        get: jest.fn((key) => {
          if (key === 'X-Goog-Resource-State') return 'sync';
          if (key === 'X-Goog-Channel-Token') return 'tenant-123';
          if (key === 'X-Goog-Channel-ID') return 'channel-abc';
          return null;
        }),
      },
    };

    const result = await handleGoogleCalendarPush(request);
    expect(result).toEqual({ ok: true });
    // syncCalendarEvents should NOT be called — we verify by checking supabase was not called
    expect(mockFrom).not.toHaveBeenCalled();
  });

  test('calls syncCalendarEvents with tenantId for exists state', async () => {
    // Mock supabase chain for credential load
    const credChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          access_token: 'acc',
          refresh_token: 'ref',
          expiry_date: 9999999999999,
          calendar_id: 'primary',
          last_sync_token: 'synctoken123',
        },
        error: null,
      }),
    };

    const eventChain = {
      upsert: jest.fn().mockResolvedValue({ error: null }),
    };

    const updateChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      update: jest.fn().mockResolvedValue({ error: null }),
    };

    let credCallCount = 0;
    mockFrom.mockImplementation((table) => {
      if (table === 'calendar_credentials') {
        credCallCount++;
        if (credCallCount === 1) {
          // First call: select credentials
          return { ...credChain };
        }
        // Subsequent calls: update sync token
        return {
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'calendar_events') return { ...eventChain };
      return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), update: jest.fn().mockResolvedValue({ error: null }) };
    });

    mockEventsList.mockResolvedValue({
      data: {
        items: [
          { id: 'evt-1', summary: 'Meeting', status: 'confirmed', start: { dateTime: '2026-03-23T10:00:00Z' }, end: { dateTime: '2026-03-23T11:00:00Z' } },
        ],
        nextSyncToken: 'newtoken456',
      },
    });

    const request = {
      headers: {
        get: jest.fn((key) => {
          if (key === 'X-Goog-Resource-State') return 'exists';
          if (key === 'X-Goog-Channel-Token') return 'tenant-123';
          if (key === 'X-Goog-Channel-ID') return 'channel-abc';
          return null;
        }),
      },
    };

    const result = await handleGoogleCalendarPush(request);
    expect(result).toEqual({ ok: true });
    // syncCalendarEvents was called: supabase.from('calendar_credentials') should be called
    expect(mockFrom).toHaveBeenCalledWith('calendar_credentials');
  });
});

// --- syncCalendarEvents tests ---
describe('syncCalendarEvents', () => {
  test('handles 410 Gone by retrying without syncToken', async () => {
    const credChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          access_token: 'acc',
          refresh_token: 'ref',
          expiry_date: 9999999999999,
          calendar_id: 'primary',
          last_sync_token: 'oldtoken',
        },
        error: null,
      }),
    };

    const eventChain = {
      upsert: jest.fn().mockResolvedValue({ error: null }),
    };

    const updateChain = {
      eq: jest.fn().mockReturnThis(),
      update: jest.fn().mockResolvedValue({ error: null }),
    };

    let credCallCount410 = 0;
    mockFrom.mockImplementation((table) => {
      if (table === 'calendar_credentials') {
        credCallCount410++;
        if (credCallCount410 === 1) {
          return { ...credChain };
        }
        // subsequent calls for update
        return {
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { access_token: 'acc', refresh_token: 'ref', expiry_date: 9999999999999, calendar_id: 'primary', last_sync_token: 'oldtoken' }, error: null }),
        };
      }
      if (table === 'calendar_events') return { ...eventChain };
      return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), update: jest.fn().mockResolvedValue({ error: null }) };
    });

    // First call returns 410, second returns success
    mockEventsList
      .mockRejectedValueOnce(Object.assign(new Error('Gone'), { code: 410 }))
      .mockResolvedValueOnce({
        data: {
          items: [],
          nextSyncToken: 'freshtoken',
        },
      });

    await syncCalendarEvents('tenant-123');

    // Should have called events.list twice (once with syncToken, once without)
    expect(mockEventsList).toHaveBeenCalledTimes(2);

    // First call includes syncToken
    expect(mockEventsList.mock.calls[0][0]).toMatchObject({
      syncToken: 'oldtoken',
    });

    // Second call does NOT include syncToken (full re-sync)
    expect(mockEventsList.mock.calls[1][0]).not.toHaveProperty('syncToken');
  });
});

// --- pushBookingToCalendar tests ---
describe('pushBookingToCalendar', () => {
  test('silently returns when no credentials exist for tenant', async () => {
    const apptChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'appt-1',
          tenant_id: 'tenant-123',
          start_time: '2026-03-23T14:00:00Z',
          end_time: '2026-03-23T15:00:00Z',
          service_address: '123 Main St',
          caller_name: 'Jane Doe',
          urgency: 'routine',
        },
        error: null,
      }),
    };

    const credChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
    };

    mockFrom.mockImplementation((table) => {
      if (table === 'appointments') return { ...apptChain };
      if (table === 'calendar_credentials') return { ...credChain };
      return {};
    });

    // Should not throw
    await expect(pushBookingToCalendar('tenant-123', 'appt-1')).resolves.toBeUndefined();

    // Google calendar events.insert should NOT be called
    expect(mockEventsInsert).not.toHaveBeenCalled();
  });
});

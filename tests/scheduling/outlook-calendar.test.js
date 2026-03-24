import { describe, test, expect, jest, beforeEach } from '@jest/globals';

// --- Mock @azure/msal-node ---
const mockGetAuthCodeUrl = jest.fn();
const mockAcquireTokenByCode = jest.fn();

jest.unstable_mockModule('@azure/msal-node', () => ({
  ConfidentialClientApplication: jest.fn().mockImplementation(() => ({
    getAuthCodeUrl: mockGetAuthCodeUrl,
    acquireTokenByCode: mockAcquireTokenByCode,
  })),
}));

// --- Mock supabase ---
function createChain(finalResult = { data: null, error: null }) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(finalResult),
    upsert: jest.fn().mockResolvedValue({ error: null }),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
  };
  return chain;
}

let mockFromImpl;

jest.unstable_mockModule('@/lib/supabase.js', () => ({
  supabase: {
    from: jest.fn((...args) => {
      if (mockFromImpl) return mockFromImpl(...args);
      return createChain();
    }),
  },
}));

// --- Mock global fetch ---
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Dynamic imports after mocks
const {
  getOutlookAuthUrl,
  exchangeCodeForTokens,
  refreshOutlookAccessToken,
  createOutlookCalendarEvent,
  createOutlookSubscription,
  syncOutlookCalendarEvents,
  revokeAndDisconnectOutlook,
} = await import('@/lib/scheduling/outlook-calendar.js');

beforeEach(() => {
  jest.clearAllMocks();
  mockFromImpl = null;
  process.env.MICROSOFT_CLIENT_ID = 'test-client-id';
  process.env.MICROSOFT_CLIENT_SECRET = 'test-client-secret';
  process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';
  process.env.OUTLOOK_WEBHOOK_SECRET = 'test-webhook-secret';
});

describe('Outlook Calendar Module', () => {
  describe('getOutlookAuthUrl', () => {
    test('returns a URL starting with https://login.microsoftonline.com', async () => {
      mockGetAuthCodeUrl.mockResolvedValue(
        'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=test'
      );

      const url = await getOutlookAuthUrl('tenant-1');

      expect(url).toMatch(/^https:\/\/login\.microsoftonline\.com/);
      expect(mockGetAuthCodeUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          scopes: expect.arrayContaining(['https://graph.microsoft.com/Calendars.ReadWrite']),
          redirectUri: 'https://example.com/api/outlook-calendar/callback',
          state: 'tenant-1',
        })
      );
    });
  });

  describe('exchangeCodeForTokens', () => {
    test('calls MSAL acquireTokenByCode and returns token data', async () => {
      mockAcquireTokenByCode.mockResolvedValue({
        accessToken: 'access-tok',
        account: { homeAccountId: 'acct-123' },
      });

      const result = await exchangeCodeForTokens('auth-code-123');

      expect(mockAcquireTokenByCode).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'auth-code-123',
          scopes: expect.arrayContaining(['https://graph.microsoft.com/Calendars.ReadWrite']),
        })
      );
      expect(result).toHaveProperty('accessToken', 'access-tok');
      expect(result).toHaveProperty('account');
    });
  });

  describe('refreshOutlookAccessToken', () => {
    test('POSTs to /common/oauth2/v2.0/token with refresh_token grant', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          expires_in: 3600,
        }),
      });

      const result = await refreshOutlookAccessToken('old-refresh-token');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        expect.objectContaining({
          method: 'POST',
        })
      );
      expect(result).toHaveProperty('access_token', 'new-access');
      expect(result).toHaveProperty('refresh_token', 'new-refresh');
    });
  });

  describe('createOutlookCalendarEvent', () => {
    test('calls graphFetch with POST /me/events and returns event id', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'outlook-evt-123' }),
      });

      const creds = {
        access_token: 'valid-token',
        refresh_token: 'ref',
        expiry_date: Date.now() + 3600000,
      };
      const appointment = {
        id: 'appt-1',
        tenant_id: 'tenant-1',
        start_time: '2026-03-25T10:00:00Z',
        end_time: '2026-03-25T11:00:00Z',
        service_address: '789 Elm St',
        caller_name: 'Bob',
        urgency: 'routine',
        job_type: 'Plumbing',
        timezone: 'UTC',
      };

      const eventId = await createOutlookCalendarEvent({ credentials: creds, appointment });

      expect(eventId).toBe('outlook-evt-123');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://graph.microsoft.com/v1.0/me/events',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  describe('createOutlookSubscription', () => {
    test('calls graphFetch with POST /subscriptions and updates calendar_credentials', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'sub-456', expirationDateTime: '2026-03-31T10:00:00Z' }),
      });

      const updateChain = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };

      mockFromImpl = (table) => {
        if (table === 'calendar_credentials') return updateChain;
        return createChain();
      };

      await createOutlookSubscription('tenant-1', 'valid-token');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://graph.microsoft.com/v1.0/subscriptions',
        expect.objectContaining({ method: 'POST' })
      );

      // Verify the body includes OUTLOOK_WEBHOOK_SECRET
      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.clientState).toBe('test-webhook-secret');

      // Verify DB update
      expect(updateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          watch_channel_id: 'sub-456',
        })
      );
      expect(updateChain.eq).toHaveBeenCalledWith('provider', 'outlook');
    });
  });

  describe('syncOutlookCalendarEvents', () => {
    test('uses deltaLink for incremental sync when stored', async () => {
      const credChain = createChain({
        data: {
          access_token: 'acc',
          refresh_token: 'ref',
          expiry_date: Date.now() + 3600000,
          last_sync_token: 'https://graph.microsoft.com/v1.0/me/calendarView/delta?$deltatoken=abc123',
        },
        error: null,
      });

      const updateChain = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };

      const eventsChain = {
        upsert: jest.fn().mockResolvedValue({ error: null }),
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };

      let credCallCount = 0;
      mockFromImpl = (table) => {
        if (table === 'calendar_credentials') {
          credCallCount++;
          if (credCallCount === 1) return credChain;
          return updateChain;
        }
        if (table === 'calendar_events') return eventsChain;
        return createChain();
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          value: [
            { id: 'evt-1', subject: 'Meeting', start: { dateTime: '2026-03-25T10:00:00' }, end: { dateTime: '2026-03-25T11:00:00' } },
          ],
          '@odata.deltaLink': 'https://graph.microsoft.com/v1.0/me/calendarView/delta?$deltatoken=new456',
        }),
      });

      await syncOutlookCalendarEvents('tenant-1');

      // Should use stored deltaLink URL
      expect(mockFetch).toHaveBeenCalledWith(
        'https://graph.microsoft.com/v1.0/me/calendarView/delta?$deltatoken=abc123',
        expect.anything()
      );

      // Verify credentials query uses provider filter
      expect(credChain.eq).toHaveBeenCalledWith('provider', 'outlook');
    });

    test('uses /me/calendarView/delta with date range when no stored deltaLink', async () => {
      const credChain = createChain({
        data: {
          access_token: 'acc',
          refresh_token: 'ref',
          expiry_date: Date.now() + 3600000,
          last_sync_token: null,
        },
        error: null,
      });

      const updateChain = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };

      const eventsChain = {
        upsert: jest.fn().mockResolvedValue({ error: null }),
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };

      let credCallCount = 0;
      mockFromImpl = (table) => {
        if (table === 'calendar_credentials') {
          credCallCount++;
          if (credCallCount === 1) return credChain;
          return updateChain;
        }
        if (table === 'calendar_events') return eventsChain;
        return createChain();
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          value: [],
          '@odata.deltaLink': 'https://graph.microsoft.com/v1.0/me/calendarView/delta?$deltatoken=initial',
        }),
      });

      await syncOutlookCalendarEvents('tenant-1');

      // Should use calendarView/delta with date parameters
      const fetchUrl = mockFetch.mock.calls[0][0];
      expect(fetchUrl).toContain('/me/calendarView/delta');
      expect(fetchUrl).toContain('startDateTime=');
      expect(fetchUrl).toContain('endDateTime=');
    });
  });

  describe('revokeAndDisconnectOutlook', () => {
    test('deletes subscription, credentials row, and mirrored events', async () => {
      const credChain = createChain({
        data: {
          access_token: 'acc',
          refresh_token: 'ref',
          expiry_date: Date.now() + 3600000,
          watch_channel_id: 'sub-789',
        },
        error: null,
      });

      const credDeleteChain = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };

      const eventsDeleteChain = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };

      // DELETE subscription returns 204
      mockFetch.mockResolvedValue({
        ok: true,
        status: 204,
      });

      let credCallCount = 0;
      mockFromImpl = (table) => {
        if (table === 'calendar_credentials') {
          credCallCount++;
          if (credCallCount === 1) return credChain;
          return credDeleteChain;
        }
        if (table === 'calendar_events') return eventsDeleteChain;
        return createChain();
      };

      await revokeAndDisconnectOutlook('tenant-1');

      // Verify subscription DELETE call
      expect(mockFetch).toHaveBeenCalledWith(
        'https://graph.microsoft.com/v1.0/subscriptions/sub-789',
        expect.objectContaining({ method: 'DELETE' })
      );

      // Verify credentials query with provider filter
      expect(credChain.eq).toHaveBeenCalledWith('provider', 'outlook');

      // Verify credentials delete with provider filter
      expect(credDeleteChain.eq).toHaveBeenCalledWith('provider', 'outlook');

      // Verify events delete with provider filter
      expect(eventsDeleteChain.eq).toHaveBeenCalledWith('provider', 'outlook');
    });
  });
});

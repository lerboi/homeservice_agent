/**
 * Tests for call-processor: processCallAnalyzed and processCallEnded.
 * Covers recording upload, transcript storage, language barrier detection,
 * and upsert idempotency.
 */

import { jest } from '@jest/globals';

// Build a fresh supabase mock per test for isolation
const mockUpsert = jest.fn();
const mockFromStorage = jest.fn();

const mockTenantsQuery = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
};

const mockCallsQuery = {
  upsert: mockUpsert,
};

const mockSupabase = {
  from: jest.fn((table) => {
    if (table === 'tenants') return mockTenantsQuery;
    if (table === 'calls') return mockCallsQuery;
    return {};
  }),
  storage: {
    from: mockFromStorage,
  },
};

jest.unstable_mockModule('@/lib/supabase', () => ({
  supabase: mockSupabase,
}));

jest.unstable_mockModule('@/i18n/routing', () => ({
  locales: ['en', 'es'],
  defaultLocale: 'en',
}));

let processCallAnalyzed;
let processCallEnded;

beforeAll(async () => {
  const module = await import('@/lib/call-processor');
  processCallAnalyzed = module.processCallAnalyzed;
  processCallEnded = module.processCallEnded;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUpsert.mockResolvedValue({ data: null, error: null });
  mockTenantsQuery.single.mockResolvedValue({
    data: { id: 'tenant-uuid' },
    error: null,
  });
});

// ─── processCallEnded ────────────────────────────────────────────────────────

describe('processCallEnded', () => {
  it('upserts call record with status ended and retell_call_id', async () => {
    const call = {
      call_id: 'call_test_123',
      from_number: '+6591234567',
      to_number: '+6598765432',
      direction: 'inbound',
      start_timestamp: 1000000,
      end_timestamp: 1060000,
    };

    await processCallEnded(call);

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const [upsertArg, upsertOptions] = mockUpsert.mock.calls[0];
    expect(upsertArg).toMatchObject({
      retell_call_id: 'call_test_123',
      status: 'ended',
      tenant_id: 'tenant-uuid',
    });
    expect(upsertOptions).toEqual({ onConflict: 'retell_call_id' });
  });
});

// ─── processCallAnalyzed ─────────────────────────────────────────────────────

const mockUpload = jest.fn();

describe('processCallAnalyzed', () => {
  beforeEach(() => {
    mockUpload.mockResolvedValue({ data: { path: 'call_test_123.wav' }, error: null });
    mockFromStorage.mockReturnValue({ upload: mockUpload });

    // Mock global fetch
    global.fetch = jest.fn().mockResolvedValue({
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
    });
  });

  afterEach(() => {
    delete global.fetch;
  });

  it('fetches recording, uploads to call-recordings bucket, and upserts record with path', async () => {
    const call = {
      call_id: 'call_test_123',
      from_number: '+6591234567',
      to_number: '+6598765432',
      direction: 'inbound',
      start_timestamp: 1000000,
      end_timestamp: 1060000,
      recording_url: 'https://retell-recording.example.com/test.wav',
      transcript: 'Hello, I need help with my plumbing.',
      transcript_object: [
        { role: 'agent', content: 'Hello, how can I help?', words: [] },
        { role: 'user', content: 'I need help with my plumbing.', words: [] },
      ],
    };

    await processCallAnalyzed(call);

    // Should have fetched the recording URL
    expect(global.fetch).toHaveBeenCalledWith('https://retell-recording.example.com/test.wav');

    // Should have uploaded to the call-recordings bucket
    expect(mockFromStorage).toHaveBeenCalledWith('call-recordings');
    expect(mockUpload).toHaveBeenCalledWith(
      'call_test_123.wav',
      expect.any(ArrayBuffer),
      expect.objectContaining({ contentType: 'audio/wav' })
    );

    // Should have upserted with all required fields
    const [upsertArg, upsertOptions] = mockUpsert.mock.calls[0];
    expect(upsertArg).toMatchObject({
      retell_call_id: 'call_test_123',
      recording_storage_path: 'call_test_123.wav',
      transcript_text: 'Hello, I need help with my plumbing.',
      status: 'analyzed',
    });
    expect(upsertArg.transcript_structured).toEqual(call.transcript_object);
    expect(upsertOptions).toEqual({ onConflict: 'retell_call_id' });
  });

  it('stores transcript and sets status to analyzed even when recording_url is null', async () => {
    const call = {
      call_id: 'call_no_recording',
      from_number: '+1111',
      to_number: '+2222',
      recording_url: null,
      transcript: 'Some transcript text.',
      transcript_object: [],
    };

    await processCallAnalyzed(call);

    // fetch should NOT have been called
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockUpload).not.toHaveBeenCalled();

    const [upsertArg] = mockUpsert.mock.calls[0];
    expect(upsertArg.recording_storage_path).toBeNull();
    expect(upsertArg.transcript_text).toBe('Some transcript text.');
    expect(upsertArg.status).toBe('analyzed');
  });

  it('does not throw on duplicate call (upsert behavior — idempotent)', async () => {
    const call = {
      call_id: 'call_duplicate',
      from_number: '+1111',
      to_number: '+2222',
      recording_url: null,
    };

    // Both calls succeed (upsert handles conflict)
    mockUpsert.mockResolvedValue({ data: null, error: null });

    await expect(processCallAnalyzed(call)).resolves.not.toThrow();
    await expect(processCallAnalyzed(call)).resolves.not.toThrow();
  });

  // ─── Language barrier detection ────────────────────────────────────────────

  it('sets language_barrier=true and barrier_language="zh" for unsupported language', async () => {
    const call = {
      call_id: 'call_zh',
      from_number: '+1111',
      to_number: '+2222',
      recording_url: null,
      metadata: { detected_language: 'zh' },
    };

    await processCallAnalyzed(call);

    const [upsertArg] = mockUpsert.mock.calls[0];
    expect(upsertArg.language_barrier).toBe(true);
    expect(upsertArg.barrier_language).toBe('zh');
    expect(upsertArg.detected_language).toBe('zh');
  });

  it('sets language_barrier=false and barrier_language=null for supported language "es"', async () => {
    const call = {
      call_id: 'call_es',
      from_number: '+1111',
      to_number: '+2222',
      recording_url: null,
      metadata: { detected_language: 'es' },
    };

    await processCallAnalyzed(call);

    const [upsertArg] = mockUpsert.mock.calls[0];
    expect(upsertArg.language_barrier).toBe(false);
    expect(upsertArg.barrier_language).toBeNull();
  });

  it('sets language_barrier=true and barrier_language="ar" for Arabic', async () => {
    const call = {
      call_id: 'call_ar',
      from_number: '+1111',
      to_number: '+2222',
      recording_url: null,
      metadata: { detected_language: 'ar' },
    };

    await processCallAnalyzed(call);

    const [upsertArg] = mockUpsert.mock.calls[0];
    expect(upsertArg.language_barrier).toBe(true);
    expect(upsertArg.barrier_language).toBe('ar');
  });

  it('sets language_barrier=false and barrier_language=null when detected_language is undefined', async () => {
    const call = {
      call_id: 'call_no_lang',
      from_number: '+1111',
      to_number: '+2222',
      recording_url: null,
      metadata: {},
    };

    await processCallAnalyzed(call);

    const [upsertArg] = mockUpsert.mock.calls[0];
    expect(upsertArg.language_barrier).toBe(false);
    expect(upsertArg.barrier_language).toBeNull();
  });

  it('sets language_barrier=false when supported language "en" is detected', async () => {
    const call = {
      call_id: 'call_en',
      from_number: '+1111',
      to_number: '+2222',
      recording_url: null,
      metadata: { detected_language: 'en' },
    };

    await processCallAnalyzed(call);

    const [upsertArg] = mockUpsert.mock.calls[0];
    expect(upsertArg.language_barrier).toBe(false);
    expect(upsertArg.barrier_language).toBeNull();
  });
});

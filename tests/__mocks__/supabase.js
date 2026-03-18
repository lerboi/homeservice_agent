export function createMockSupabase() {
  const storage = {
    from: jest.fn(() => ({
      upload: jest.fn(() => Promise.resolve({ data: { path: 'test/path.wav' }, error: null })),
      getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'https://example.com/test.wav' } })),
    })),
  };
  const query = {
    insert: jest.fn(() => query),
    update: jest.fn(() => query),
    upsert: jest.fn(() => query),
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    single: jest.fn(() => Promise.resolve({ data: {}, error: null })),
  };
  return {
    from: jest.fn(() => query),
    storage,
  };
}

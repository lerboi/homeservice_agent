/**
 * Phase 47 — /api/public-chat anonymous endpoint smoke test.
 * Confirms the route file exists and exports a POST function.
 * Full request/response integration is covered by live E2E, not this unit test.
 */

describe('/api/public-chat', () => {
  it('exports a POST handler', async () => {
    const route = await import('../../src/app/api/public-chat/route.js');
    expect(typeof route.POST).toBe('function');
  });
});

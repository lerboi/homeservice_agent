import { describe, it, expect } from '@jest/globals';
import { JobberAdapter } from '@/lib/integrations/jobber';

describe('JobberAdapter — Phase 54 stub', () => {
  it('getAuthUrl returns a URL with client_id, redirect_uri, response_type=code, state', () => {
    const adapter = new JobberAdapter();
    const url = adapter.getAuthUrl('tenant123:abc', 'https://app.example.com/api/integrations/jobber/callback');
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe('https://api.getjobber.com/api/oauth/authorize');
    expect(u.searchParams.get('response_type')).toBe('code');
    expect(u.searchParams.get('state')).toBe('tenant123:abc');
    expect(u.searchParams.get('redirect_uri')).toBe('https://app.example.com/api/integrations/jobber/callback');
    expect(u.searchParams.has('client_id')).toBe(true);
  });

  it('exchangeCode throws NotImplementedError', async () => {
    const adapter = new JobberAdapter();
    await expect(adapter.exchangeCode('code', 'uri')).rejects.toThrow(/NotImplementedError.*Phase 56/);
  });

  it('refreshToken throws NotImplementedError', async () => {
    const adapter = new JobberAdapter();
    await expect(adapter.refreshToken({})).rejects.toThrow(/NotImplementedError.*Phase 56/);
  });

  it('revoke throws NotImplementedError', async () => {
    const adapter = new JobberAdapter();
    await expect(adapter.revoke({})).rejects.toThrow(/NotImplementedError.*Phase 56/);
  });

  it('fetchCustomerByPhone throws NotImplementedError', async () => {
    const adapter = new JobberAdapter();
    await expect(adapter.fetchCustomerByPhone('t', '+1')).rejects.toThrow(/NotImplementedError.*Phase 56/);
  });
});

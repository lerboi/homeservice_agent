import { describe, it, expect } from '@jest/globals';
import { PROVIDERS } from '@/lib/integrations/types';
import { getIntegrationAdapter } from '@/lib/integrations/adapter';

describe('integrations adapter factory', () => {
  it('PROVIDERS is exactly xero + jobber', () => {
    expect(PROVIDERS).toEqual(['xero', 'jobber']);
  });

  it("returns an adapter with OAuth + read surface for 'xero'", async () => {
    const a = await getIntegrationAdapter('xero');
    for (const fn of ['getAuthUrl', 'exchangeCode', 'refreshToken', 'revoke', 'fetchCustomerByPhone']) {
      expect(typeof a[fn]).toBe('function');
    }
  });

  it("returns an adapter with OAuth + read surface for 'jobber'", async () => {
    const a = await getIntegrationAdapter('jobber');
    for (const fn of ['getAuthUrl', 'exchangeCode', 'refreshToken', 'revoke', 'fetchCustomerByPhone']) {
      expect(typeof a[fn]).toBe('function');
    }
  });

  it("throws on 'quickbooks'", async () => {
    await expect(getIntegrationAdapter('quickbooks')).rejects.toThrow(/Unsupported.*quickbooks/);
  });
});

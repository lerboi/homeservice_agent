/**
 * Integration adapter factory and shared token management.
 *
 * @module integrations/adapter
 */

import { PROVIDERS } from './types.js';

/**
 * Returns an instantiated adapter for the given provider.
 *
 * @param {string} provider - One of 'xero', 'jobber'
 * @returns {Promise<import('./types.js').IntegrationAdapter>}
 * @throws {Error} If provider is not supported
 */
export async function getIntegrationAdapter(provider) {
  if (!PROVIDERS.includes(provider)) {
    throw new Error(
      `Unsupported integration provider: "${provider}". Must be one of: ${PROVIDERS.join(', ')}`,
    );
  }

  switch (provider) {
    case 'xero': {
      const { XeroAdapter } = await import('./xero.js');
      return new XeroAdapter();
    }
    case 'jobber': {
      const { JobberAdapter } = await import('./jobber.js');
      return new JobberAdapter();
    }
  }
}

/**
 * Refresh expired tokens and persist. Same 5-minute buffer as Phase 35.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase - Service-role client
 * @param {Object} credentials - Row from accounting_credentials
 * @returns {Promise<Object>} Updated credentials
 */
export async function refreshTokenIfNeeded(supabase, credentials) {
  const FIVE_MINUTES_MS = 5 * 60 * 1000;
  const now = Date.now();

  if (!credentials.expiry_date || credentials.expiry_date > now + FIVE_MINUTES_MS) {
    return credentials;
  }

  const adapter = await getIntegrationAdapter(credentials.provider);
  const newTokenSet = await adapter.refreshToken({
    access_token: credentials.access_token,
    refresh_token: credentials.refresh_token,
    expiry_date: credentials.expiry_date,
    xero_tenant_id: credentials.xero_tenant_id,
  });

  const { error } = await supabase
    .from('accounting_credentials')
    .update({
      access_token: newTokenSet.access_token,
      refresh_token: newTokenSet.refresh_token,
      expiry_date: newTokenSet.expiry_date,
    })
    .eq('id', credentials.id);

  if (error) {
    console.error('[integrations] Failed to persist refreshed tokens:', error.message);
  }

  return {
    ...credentials,
    access_token: newTokenSet.access_token,
    refresh_token: newTokenSet.refresh_token,
    expiry_date: newTokenSet.expiry_date,
  };
}

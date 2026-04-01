/**
 * Accounting adapter factory and shared token management.
 *
 * Usage:
 *   const adapter = await getAccountingAdapter('quickbooks');
 *   adapter.pushInvoice(invoice, lineItems, settings);
 *
 * @module accounting/adapter
 */

import { PROVIDERS } from './types.js';

/**
 * Returns an instantiated adapter for the given provider.
 *
 * @param {string} provider - One of 'quickbooks', 'xero', 'freshbooks'
 * @returns {Promise<import('./types.js').AccountingAdapter>}
 * @throws {Error} If provider is not supported
 */
export async function getAccountingAdapter(provider) {
  if (!PROVIDERS.includes(provider)) {
    throw new Error(`Unsupported accounting provider: "${provider}". Must be one of: ${PROVIDERS.join(', ')}`);
  }

  switch (provider) {
    case 'quickbooks': {
      const { QuickBooksAdapter } = await import('./quickbooks.js');
      return new QuickBooksAdapter();
    }
    case 'xero': {
      const { XeroAdapter } = await import('./xero.js');
      return new XeroAdapter();
    }
    case 'freshbooks': {
      const { FreshBooksAdapter } = await import('./freshbooks.js');
      return new FreshBooksAdapter();
    }
  }
}

/**
 * Checks token expiry and refreshes if needed (within 5-minute buffer).
 * Upserts refreshed tokens back to accounting_credentials table.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase - Service-role Supabase client
 * @param {Object} credentials - Row from accounting_credentials table
 * @returns {Promise<Object>} Updated credentials (or original if not expired)
 */
export async function refreshTokenIfNeeded(supabase, credentials) {
  const FIVE_MINUTES_MS = 5 * 60 * 1000;
  const now = Date.now();

  // If no expiry_date set or token is still valid (more than 5 min remaining), return as-is
  if (!credentials.expiry_date || credentials.expiry_date > now + FIVE_MINUTES_MS) {
    return credentials;
  }

  // Token expired or within 5-minute buffer — refresh it
  const adapter = await getAccountingAdapter(credentials.provider);

  const newTokenSet = await adapter.refreshToken({
    access_token: credentials.access_token,
    refresh_token: credentials.refresh_token,
    expiry_date: credentials.expiry_date,
    realm_id: credentials.realm_id,
    xero_tenant_id: credentials.xero_tenant_id,
    account_id: credentials.account_id,
  });

  // Upsert refreshed tokens back to DB
  const { error } = await supabase
    .from('accounting_credentials')
    .update({
      access_token: newTokenSet.access_token,
      refresh_token: newTokenSet.refresh_token,
      expiry_date: newTokenSet.expiry_date,
    })
    .eq('id', credentials.id);

  if (error) {
    console.error('[accounting] Failed to persist refreshed tokens:', error.message);
  }

  return {
    ...credentials,
    access_token: newTokenSet.access_token,
    refresh_token: newTokenSet.refresh_token,
    expiry_date: newTokenSet.expiry_date,
  };
}

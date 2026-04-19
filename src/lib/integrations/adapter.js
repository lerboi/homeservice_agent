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
  let newTokenSet;
  try {
    newTokenSet = await adapter.refreshToken({
      access_token: credentials.access_token,
      refresh_token: credentials.refresh_token,
      expiry_date: credentials.expiry_date,
      xero_tenant_id: credentials.xero_tenant_id,
    });
  } catch (refreshErr) {
    // Refresh failed — token is revoked, expired, or the OAuth app changed.
    // Persist error_state so the dashboard banner + calendar banner can
    // prompt a reconnect, then rethrow so callers keep their existing
    // fallback behavior (webhook silent-ignore, context fetch → broad
    // revalidation). Best-effort, never throws from the notifier.
    try {
      const notifications = await import('../notifications.js');
      const notify =
        credentials.provider === 'jobber'
          ? notifications.notifyJobberRefreshFailure
          : notifications.notifyXeroRefreshFailure;
      // Resolve the tenant's owner email so the notifier can send the
      // one-shot Reconnect email (notify tolerates null — error_state is
      // still persisted even when email resolution fails).
      let ownerEmail = null;
      try {
        const { data: tenant } = await supabase
          .from('tenants')
          .select('email, personal_email, business_email')
          .eq('id', credentials.tenant_id)
          .maybeSingle();
        ownerEmail =
          tenant?.business_email ?? tenant?.email ?? tenant?.personal_email ?? null;
      } catch {
        // Best-effort — fall through with null email.
      }
      await notify?.(credentials.tenant_id, ownerEmail);
    } catch (notifyErr) {
      console.warn(
        '[refreshTokenIfNeeded] notify failure',
        notifyErr?.message || notifyErr,
      );
    }
    throw refreshErr;
  }

  const updatePayload = {
    access_token: newTokenSet.access_token,
    refresh_token: newTokenSet.refresh_token,
    expiry_date: newTokenSet.expiry_date,
  };

  // Persist scopes when the refreshed TokenSet carries them, so the
  // getIntegrationStatus reader (and downstream telemetry) stays in sync.
  if (Array.isArray(newTokenSet.scopes) && newTokenSet.scopes.length > 0) {
    updatePayload.scopes = newTokenSet.scopes;
  }

  const { error } = await supabase
    .from('accounting_credentials')
    .update(updatePayload)
    .eq('id', credentials.id);

  if (error) {
    console.error('[integrations] Failed to persist refreshed tokens:', error.message);
    // Do NOT return the un-persisted rotated tokens — Jobber rotates refresh_token
    // on every refresh, so returning the new access_token here would orphan the
    // rotated refresh_token (DB still holds the old, now-dead one). Throwing lets
    // callers (fetchJobberCustomerByPhone, webhook handler) fall back to cached
    // row / broad revalidation; the current access_token survives its remaining TTL.
    throw new Error(
      `Token rotation persistence failed for provider=${credentials.provider}: ${error.message}`,
    );
  }

  return {
    ...credentials,
    access_token: newTokenSet.access_token,
    refresh_token: newTokenSet.refresh_token,
    expiry_date: newTokenSet.expiry_date,
    ...(updatePayload.scopes ? { scopes: updatePayload.scopes } : {}),
  };
}

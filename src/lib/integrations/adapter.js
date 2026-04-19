/**
 * Integration adapter factory and shared token management.
 *
 * @module integrations/adapter
 */

import { PROVIDERS } from './types.js';

const REFRESH_LOCK_TTL_MS = 30_000;
const REFRESH_LOCK_WAIT_MS = 3_000;
const REFRESH_LOCK_POLL_MS = 200;

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
 * Concurrent-callers guard (Phase 999.5): acquires a lease-based lock on
 * (tenant, provider) via the try_acquire_oauth_refresh_lock RPC before
 * invoking the adapter's wire refresh. Losers poll the credentials row
 * for the winner's fresh tokens rather than firing a second HTTP refresh.
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

  // Serialize concurrent refreshers per (tenant, provider). Without this,
  // a burst of webhooks hitting the 5-min expiry window can fire two
  // adapter.refreshToken() calls — Jobber rotates refresh_token on every
  // refresh, so the second call either 401s (strict) or orphans the first
  // caller's rotated token (permissive, last-write-wins). Losers poll the
  // credentials row for the winner's fresh tokens and short-circuit.
  const { data: holderId, error: lockErr } = await supabase.rpc(
    'try_acquire_oauth_refresh_lock',
    {
      p_tenant_id: credentials.tenant_id,
      p_provider: credentials.provider,
      p_ttl_ms: REFRESH_LOCK_TTL_MS,
    },
  );

  if (lockErr) {
    // Locks table unavailable — fall through to the un-serialized path.
    // Availability beats perfect dedup; pre-Phase-999.5 behavior.
    console.warn('[refreshTokenIfNeeded] lock RPC failed:', lockErr.message);
  } else if (!holderId) {
    // Another caller holds the lock. Poll the creds row; the winner's
    // DB write will land within a few hundred ms.
    const deadline = Date.now() + REFRESH_LOCK_WAIT_MS;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, REFRESH_LOCK_POLL_MS));
      const { data: fresh } = await supabase
        .from('accounting_credentials')
        .select('*')
        .eq('id', credentials.id)
        .maybeSingle();
      if (
        fresh &&
        fresh.expiry_date &&
        fresh.expiry_date > Date.now() + FIVE_MINUTES_MS
      ) {
        return fresh;
      }
    }
    // Winner never wrote within the poll window. Rather than attempting our
    // own refresh (risk double-rotation), surface to callers — the 30s lease
    // TTL releases the stuck slot on its own. Caller's existing fallback
    // (webhook silent-ignore, context fetch → broad revalidation) applies.
    throw new Error(
      `OAuth refresh for provider=${credentials.provider} tenant=${credentials.tenant_id} contested; lock not released within ${REFRESH_LOCK_WAIT_MS}ms`,
    );
  }

  try {
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
      // Clear any prior 'token_refresh_failed' flag now that the chain is healthy
      // again. Only safe to clear AFTER the rotated tokens persist below — if the
      // DB update throws, the flag stays on and the reconnect banner remains.
      error_state: null,
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
  } finally {
    // Release the lease, even if we threw. Best-effort: the lease TTL is
    // the backstop if this RPC call fails (e.g., network blip).
    if (holderId) {
      try {
        await supabase.rpc('release_oauth_refresh_lock', {
          p_tenant_id: credentials.tenant_id,
          p_provider: credentials.provider,
          p_holder_id: holderId,
        });
      } catch (releaseErr) {
        console.warn(
          '[refreshTokenIfNeeded] release lock failed:',
          releaseErr?.message || releaseErr,
        );
      }
    }
  }
}

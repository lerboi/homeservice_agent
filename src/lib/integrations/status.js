/**
 * Cached per-tenant integration status reader.
 *
 * Uses Next.js 16 `'use cache'` with a per-tenant cacheTag so that
 * disconnect + callback routes can invalidate instantly via revalidateTag.
 *
 * IMPORTANT: `'use cache'` MUST be the FIRST statement inside the function body.
 * Placing it after any other statement silently disables caching with no compile error.
 *
 * @module integrations/status
 */

import { cacheTag } from 'next/cache';
import { createClient } from '@supabase/supabase-js';

/**
 * @param {string} tenantId
 * @returns {Promise<{
 *   xero: { provider: string, scopes: string[], last_context_fetch_at: string|null, connected_at: string, display_name: string|null }|null,
 *   jobber: { provider: string, scopes: string[], last_context_fetch_at: string|null, connected_at: string, display_name: string|null }|null
 * }>}
 */
export async function getIntegrationStatus(tenantId) {
  'use cache';
  cacheTag(`integration-status-${tenantId}`);

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const { data, error } = await admin
    .from('accounting_credentials')
    .select('provider, scopes, last_context_fetch_at, connected_at, display_name, error_state')
    .eq('tenant_id', tenantId);

  if (error) {
    console.error('[integrations-status] fetch failed:', error.message);
    return { xero: null, jobber: null };
  }

  const rows = data || [];
  return {
    xero: rows.find((r) => r.provider === 'xero') || null,
    jobber: rows.find((r) => r.provider === 'jobber') || null,
  };
}

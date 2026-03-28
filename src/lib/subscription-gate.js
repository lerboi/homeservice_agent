/**
 * Subscription enforcement gate.
 * Phase 25-01: ENFORCE-01, ENFORCE-02
 *
 * Checks whether a tenant's subscription status allows calls to proceed.
 * Used by the LiveKit agent (livekit-agent/src/agent.ts) to block inbound calls
 * for cancelled/paused/incomplete tenants.
 *
 * Architecture note: Originally planned for src/app/api/webhooks/retell/route.js
 * but extracted here since the Retell→LiveKit migration moved call handling
 * to livekit-agent/src/agent.ts (a TypeScript service).
 *
 * Design decisions (per 25-CONTEXT.md):
 * - D-02: Only checks status column — never trial_ends_at (Stripe webhook handles expiry)
 * - D-04: Over-quota calls are NEVER blocked (overage billing handles them)
 * - D-05: past_due allows calls (3-day grace period, per Phase 24 D-03)
 * - D-06 error resilience: query error → fail open (allow the call through)
 */

/**
 * Subscription statuses that block inbound calls.
 * CRITICAL: Do NOT include 'past_due' — grace period allows calls.
 * CRITICAL: Do NOT include any usage/quota check — overage billing handles over-quota calls.
 */
export const BLOCKED_STATUSES = ['canceled', 'paused', 'incomplete'];

/**
 * Check whether a tenant's subscription allows inbound calls.
 *
 * @param {object} supabase - Supabase client (service role)
 * @param {string} tenantId - Tenant UUID
 * @returns {Promise<{ blocked: boolean, reason?: string }>}
 */
export async function checkSubscriptionGate(supabase, tenantId) {
  try {
    const { data: sub, error } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('tenant_id', tenantId)
      .eq('is_current', true)
      .maybeSingle();

    // Error resilience: if the query fails, fail open (allow the call)
    if (error) {
      console.error('[subscription-gate] Query error, failing open:', error.message);
      return { blocked: false };
    }

    // No subscription row → allow (trial not yet started, or pre-subscription state)
    if (!sub?.status) {
      return { blocked: false };
    }

    // Check if the status is in the blocked list
    if (BLOCKED_STATUSES.includes(sub.status)) {
      return { blocked: true, reason: 'subscription_inactive' };
    }

    return { blocked: false };
  } catch (err) {
    // Unexpected error → fail open
    console.error('[subscription-gate] Unexpected error, failing open:', err);
    return { blocked: false };
  }
}

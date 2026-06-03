/**
 * src/lib/rate-limit.js
 *
 * Durable, Supabase-backed fixed-window rate limiter. Replaces the per-instance
 * in-memory Maps that did not survive serverless cold starts or span instances.
 *
 * Backed by migration 065 (rate_limit_hits table + increment_rate_limit RPC).
 * The RPC is SECURITY DEFINER and service-role-only, so we call it via the
 * service-role client.
 *
 * FAIL-OPEN: on any DB error we return { allowed: true } and console.error.
 * A limiter outage must never block legitimate traffic.
 */

import { supabase } from './supabase.js';

/**
 * Check (and consume one hit of) a fixed-window rate limit.
 *
 * @param {{ bucket: string, key: string, limit: number, windowSeconds: number }} opts
 *   bucket        — logical namespace, e.g. 'public-chat' or 'demo-voice'
 *   key           — per-subject key, e.g. an IP address or 'global'
 *   limit         — max hits allowed within the window
 *   windowSeconds — window size in seconds
 * @returns {Promise<{ allowed: boolean, count: number, limit: number }>}
 */
export async function checkRateLimit({ bucket, key, limit, windowSeconds }) {
  try {
    // Floor now() to the start of the current window.
    const nowMs = Date.now();
    const windowMs = windowSeconds * 1000;
    const windowStartMs = Math.floor(nowMs / windowMs) * windowMs;
    const windowStart = new Date(windowStartMs).toISOString();

    const { data, error } = await supabase.rpc('increment_rate_limit', {
      p_bucket: bucket,
      p_key: key,
      p_window_start: windowStart,
    });

    if (error) {
      console.error('[rate-limit] RPC error (failing open):', error.message);
      return { allowed: true, count: 0, limit };
    }

    const count = Number(data) || 0;
    return { allowed: count <= limit, count, limit };
  } catch (err) {
    console.error('[rate-limit] Unexpected error (failing open):', String(err?.message ?? err));
    return { allowed: true, count: 0, limit };
  }
}

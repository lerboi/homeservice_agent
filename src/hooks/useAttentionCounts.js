'use client';

import { useSWRFetch } from '@/hooks/useSWRFetch';

/**
 * useAttentionCounts — shared nav-badge counts from GET /api/dashboard/stats.
 *
 * Polls every 60s and revalidates on window focus so badges stay fresh as
 * calls come in. DashboardSidebar and BottomTabBar share the same SWR key
 * (and the same key as the Home tiles), so only one request is in flight.
 *
 * Inquiries → Calls merge (2026-06-10): the Inquiries nav item is gone, so
 * the Calls badge carries the combined "needs you" count — open inquiries
 * (the Callbacks view) + calls missed today — exposed as `callsAttention`
 * so both nav components stay consistent.
 *
 * @returns {{ openInquiries: number, missedCallsToday: number, callsAttention: number }}
 */
export function useAttentionCounts() {
  const { data } = useSWRFetch('/api/dashboard/stats', {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
  });

  // Stats "new" field counts open inquiries (Phase 59 repointing).
  const openInquiries = data?.newLeadsCount ?? 0;
  const missedCallsToday = data?.missedCallsToday ?? 0;

  return {
    openInquiries,
    missedCallsToday,
    // Combined Calls-tab attention count (inquiries merged into Calls).
    callsAttention: openInquiries + missedCallsToday,
  };
}

/**
 * Badge display text — caps at "9+" so the badge never widens the nav row.
 *
 * @param {number} count
 * @returns {string}
 */
export function formatBadgeCount(count) {
  return count > 9 ? '9+' : String(count);
}

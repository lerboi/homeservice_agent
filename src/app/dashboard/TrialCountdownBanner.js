'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Clock, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase-browser';

/**
 * Calculate the number of days remaining in the trial period.
 * Exported for unit testing.
 *
 * @param {string|null} trialEndsAt - ISO timestamp of trial end date
 * @returns {number} Days remaining (clamped to 0 minimum, rounded up)
 */
export function calculateTrialDaysRemaining(trialEndsAt) {
  if (!trialEndsAt) return 0;
  const remaining = new Date(trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000)));
}

/**
 * Get the visual state for the trial banner based on days remaining.
 * Exported for unit testing.
 *
 * @param {number} daysRemaining - Number of days remaining in trial
 * @returns {'info' | 'urgent'} Banner state
 */
export function getTrialBannerState(daysRemaining) {
  return daysRemaining > 3 ? 'info' : 'urgent';
}

/**
 * TrialCountdownBanner — persistent banner shown to trialing tenants.
 *
 * Shows days remaining in free trial with "Upgrade now" CTA.
 * Info state (>3 days): blue styling with Clock icon.
 * Urgent state (<=3 days): amber styling with AlertCircle icon.
 *
 * Per D-13/D-14/D-15/D-16: visible across all dashboard pages, not dismissible,
 * CTA links to /dashboard/more/billing, same z-39 positioning as BillingWarningBanner.
 */
export default function TrialCountdownBanner() {
  const [daysRemaining, setDaysRemaining] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    async function checkTrialStatus() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (!tenant) return;

      const { data: sub } = await supabase
        .from('subscriptions')
        .select('status, trial_ends_at')
        .eq('tenant_id', tenant.id)
        .eq('is_current', true)
        .maybeSingle();

      if (!sub || sub.status !== 'trialing') return;

      const days = calculateTrialDaysRemaining(sub.trial_ends_at);

      // Only show when trial is actively running (days > 0)
      if (days <= 0) return;

      setDaysRemaining(days);
      setVisible(true);
    }

    checkTrialStatus();
  }, []);

  if (!visible || daysRemaining === null) return null;

  const state = getTrialBannerState(daysRemaining);
  const isUrgent = state === 'urgent';
  const isLastDay = daysRemaining <= 1;

  // Determine urgency copy
  const bannerText = isUrgent
    ? isLastDay
      ? 'Your trial ends today - upgrade to keep your AI receptionist'
      : `Your trial ends in ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} - upgrade to keep your AI receptionist`
    : `${daysRemaining} days left in your free trial`;

  if (isUrgent) {
    return (
      <div
        role="alert"
        className="sticky top-0 z-39 h-11 bg-amber-50 border-b border-amber-300 flex items-center justify-between px-4 lg:px-8"
      >
        <div className="flex items-center gap-2 min-w-0">
          <AlertCircle className="h-4 w-4 text-amber-800 shrink-0" aria-hidden="true" />
          <p className="text-sm text-amber-800 truncate">{bannerText}</p>
        </div>
        <Link
          href="/dashboard/more/billing"
          className="text-sm font-medium border border-amber-400 text-amber-800 px-3 py-1 rounded-md hover:bg-amber-100 transition-colors shrink-0 ml-2"
        >
          Upgrade now
        </Link>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="sticky top-0 z-39 h-11 bg-blue-50 border-b border-blue-200 flex items-center justify-between px-4 lg:px-8"
    >
      <div className="flex items-center gap-2 min-w-0">
        <Clock className="h-4 w-4 text-blue-800 shrink-0" aria-hidden="true" />
        <p className="text-sm text-blue-800 truncate">{bannerText}</p>
      </div>
      <Link
        href="/dashboard/more/billing"
        className="text-sm font-medium text-blue-800 underline hover:text-blue-900 transition-colors shrink-0 ml-2"
      >
        Upgrade now
      </Link>
    </div>
  );
}

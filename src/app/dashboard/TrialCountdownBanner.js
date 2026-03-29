'use client';

import { useState, useEffect } from 'react';
import { Clock, AlertCircle, X } from 'lucide-react';
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
  const [dismissed, setDismissed] = useState(false);

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

  if (!visible || daysRemaining === null || dismissed) return null;

  const state = getTrialBannerState(daysRemaining);
  const isUrgent = state === 'urgent';
  const isLastDay = daysRemaining <= 1;

  // Determine urgency copy
  const bannerText = isUrgent
    ? isLastDay
      ? 'Your trial ends today - upgrade to keep your AI receptionist'
      : `Your trial ends in ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} - upgrade to keep your AI receptionist`
    : `${daysRemaining} days left in your free trial`;

  const bgClass = isUrgent
    ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200/60'
    : 'bg-gradient-to-r from-blue-50/80 to-indigo-50/60 border-b border-blue-200/40';
  const textClass = isUrgent ? 'text-amber-900' : 'text-blue-900/80';
  const iconClass = isUrgent ? 'text-amber-600' : 'text-blue-500';
  const Icon = isUrgent ? AlertCircle : Clock;

  return (
    <div
      role="alert"
      className={`relative z-39 h-10 ${bgClass} flex items-center justify-center gap-3 px-10`}
    >
      <Icon className={`h-3.5 w-3.5 ${iconClass} shrink-0`} aria-hidden="true" />
      <p className={`text-xs ${textClass} truncate`}>
        {bannerText}
      </p>
      <button
        onClick={() => setDismissed(true)}
        className={`absolute right-3 p-1 rounded-md ${isUrgent ? 'text-amber-600 hover:text-amber-900 hover:bg-amber-100/60' : 'text-blue-400 hover:text-blue-700 hover:bg-blue-100/60'} transition-colors`}
        aria-label="Dismiss banner"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

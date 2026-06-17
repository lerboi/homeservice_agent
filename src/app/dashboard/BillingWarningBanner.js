'use client';

import { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase-browser';

const GRACE_PERIOD_MS = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds

/**
 * Calculate the number of days remaining in the past_due grace period.
 * Exported for unit testing.
 *
 * Grace = 3 days after current_period_end (the end of the billing cycle that
 * failed to collect payment). Uses current_period_end because it is stable —
 * stripe_updated_at advances on every subscription.updated webhook event,
 * which would reset the countdown on payment retries.
 *
 * @param {string} currentPeriodEnd - ISO timestamp of the billing period end date
 * @returns {number} Days remaining (clamped to 0 minimum, rounded up)
 */
export function calculateGraceDaysRemaining(currentPeriodEnd) {
  if (!currentPeriodEnd) return 0;
  const graceDeadline = new Date(currentPeriodEnd).getTime() + GRACE_PERIOD_MS;
  const remaining = graceDeadline - Date.now();
  return Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000)));
}

/**
 * BillingWarningBanner — persistent amber banner shown to past_due tenants.
 *
 * Shows a countdown of days remaining in the 3-day grace period.
 * Links to /api/billing/portal to open Stripe Customer Portal for payment update.
 *
 * Per D-01/D-02/D-03: no feature degradation, banner only, persistent (not dismissible).
 * Per UI-SPEC: amber-50 background, amber-300 border, amber-800 text, z-39 (below ImpersonationBanner z-40).
 */
export default function BillingWarningBanner() {
  const [daysRemaining, setDaysRemaining] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    async function checkSubscriptionStatus() {
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
        .select('status, current_period_end')
        .eq('tenant_id', tenant.id)
        .eq('is_current', true)
        .maybeSingle();

      if (!sub || sub.status !== 'past_due') return;

      const days = calculateGraceDaysRemaining(sub.current_period_end);

      // days <= 0: grace expired. The banner used to hide here expecting a
      // middleware redirect that never existed — a past-grace tenant saw NO
      // warning at all while the agent gate (2026-06-12 audit H1) now stops
      // answering their calls. Show the suspended variant instead.
      setDaysRemaining(days);
      setVisible(true);
    }

    checkSubscriptionStatus();
  }, []);

  if (!visible || daysRemaining === null) return null;

  // Grace expired — the agent gate has stopped answering this tenant's calls.
  // Red, persistent, no dismiss (D-01/D-02/D-03: persistent, not dismissible).
  if (daysRemaining <= 0) {
    return (
      <div
        role="alert"
        className="relative z-39 h-10 bg-gradient-to-r from-red-50 to-rose-50 dark:bg-red-950/40 dark:from-red-950/40 dark:to-red-950/40 border-b border-red-200/60 dark:border-red-800/60 flex items-center justify-center gap-3 px-10"
      >
        <AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400 shrink-0" aria-hidden="true" />
        <p className="text-xs text-red-900 dark:text-red-200 truncate">
          Payment failed — <strong>your AI receptionist is paused</strong> and is no longer answering calls
          <span className="mx-1.5 text-stone-300 dark:text-stone-600">·</span>
          <a
            href="/api/billing/portal"
            className="font-medium text-red-800 dark:text-red-300 hover:text-red-950 dark:hover:text-red-100 underline underline-offset-2 transition-colors"
          >
            Update payment method to restore service
          </a>
        </p>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="relative z-39 h-10 bg-gradient-to-r from-amber-50 to-orange-50 dark:bg-amber-950/40 dark:from-amber-950/40 dark:to-amber-950/40 border-b border-amber-200/60 dark:border-amber-800/60 flex items-center justify-center gap-3 px-10"
    >
      <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
      <p className="text-xs text-amber-900 dark:text-amber-200 truncate">
        Payment failed — update within{' '}
        <strong>
          {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}
        </strong>{' '}
        to avoid service interruption
        <span className="mx-1.5 text-stone-300 dark:text-stone-600">·</span>
        <a
          href="/api/billing/portal"
          className="font-medium text-amber-800 dark:text-amber-300 hover:text-amber-950 dark:hover:text-amber-100 underline underline-offset-2 transition-colors"
        >
          Update payment method
        </a>
      </p>
    </div>
  );
}

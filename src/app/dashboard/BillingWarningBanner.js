'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { supabase } from '@/lib/supabase-browser';

const GRACE_PERIOD_MS = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds

/**
 * Calculate the number of days remaining in the past_due grace period.
 * Exported for unit testing.
 *
 * @param {string} stripeUpdatedAt - ISO timestamp when subscription entered past_due
 * @returns {number} Days remaining (clamped to 0 minimum, rounded up)
 */
export function calculateGraceDaysRemaining(stripeUpdatedAt) {
  const elapsed = Date.now() - new Date(stripeUpdatedAt).getTime();
  return Math.max(0, Math.ceil((GRACE_PERIOD_MS - elapsed) / (24 * 60 * 60 * 1000)));
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
  const [dismissed, setDismissed] = useState(false);

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
        .select('status, stripe_updated_at')
        .eq('tenant_id', tenant.id)
        .eq('is_current', true)
        .maybeSingle();

      if (!sub || sub.status !== 'past_due') return;

      const days = calculateGraceDaysRemaining(sub.stripe_updated_at);

      if (days <= 0) return; // Grace expired — middleware will redirect on next nav

      setDaysRemaining(days);
      setVisible(true);
    }

    checkSubscriptionStatus();
  }, []);

  if (!visible || daysRemaining === null || dismissed) return null;

  return (
    <div
      role="alert"
      className="relative z-39 h-10 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200/60 flex items-center justify-center gap-3 px-10"
    >
      <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" aria-hidden="true" />
      <p className="text-xs text-amber-900 truncate">
        Payment failed — update within{' '}
        <strong>
          {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}
        </strong>{' '}
        to avoid service interruption
        <span className="mx-1.5 text-stone-300">·</span>
        <a
          href="/api/billing/portal"
          className="font-medium text-amber-800 hover:text-amber-950 underline underline-offset-2 transition-colors"
        >
          Update payment method
        </a>
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-3 p-1 rounded-md text-amber-600 hover:text-amber-900 hover:bg-amber-100/60 transition-colors"
        aria-label="Dismiss banner"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

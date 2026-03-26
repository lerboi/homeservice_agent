'use client';

import { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
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

  if (!visible || daysRemaining === null) return null;

  return (
    <div
      role="alert"
      className="sticky top-0 z-39 h-11 bg-amber-50 border-b border-amber-300 flex items-center justify-between px-4 lg:px-8"
    >
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-amber-800" aria-hidden="true" />
        <p className="text-sm text-amber-800">
          Your payment failed — update your payment method within{' '}
          <strong>
            {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}
          </strong>{' '}
          to avoid service interruption.
        </p>
      </div>
      <a
        href="/api/billing/portal"
        className="text-sm font-medium border border-amber-400 text-amber-800 px-3 py-1 rounded-md hover:bg-amber-100 transition-colors"
      >
        Update Payment Method
      </a>
    </div>
  );
}

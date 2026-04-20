'use client';

import { useState } from 'react';
import { card, btn } from '@/lib/design-tokens';
import { PRICING_TIERS, getAnnualPrice } from '@/app/(public)/pricing/pricingData';
import UsageRingGauge from '@/components/dashboard/UsageRingGauge';
import { format } from 'date-fns';
import { AlertCircle, Loader2, ExternalLink, Receipt } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useSWRFetch } from '@/hooks/useSWRFetch';
import { ErrorState } from '@/components/ui/error-state';

// Phase 58 Plan 58-05 (POLISH-04): error surface swapped to the shared
// <ErrorState onRetry /> primitive so every dashboard page renders failures
// consistently. Retry re-runs the SWR fetchers via mutate().

/**
 * Billing page — /dashboard/more/billing
 *
 * Shows 4 sections:
 * 1. Plan card: current plan name, price, status badge, cancel warning
 * 2. Usage meter: UsageRingGauge with calls_used / calls_limit
 * 3. Billing details: renewal date and Manage Subscription button
 * 4. Recent invoices: inline table with portal link
 */
export default function BillingPage() {
  const [portalLoading, setPortalLoading] = useState(false);

  const { data: billingData, error: billingError, isLoading: billingLoading, mutate: mutateBilling } = useSWRFetch('/api/billing/data');
  const { data: invoicesData, isLoading: invoicesLoading, mutate: mutateInvoices } = useSWRFetch('/api/billing/invoices');

  const loading = billingLoading || invoicesLoading;
  const error = billingError?.message || null;

  const refetchBilling = () => {
    mutateBilling();
    mutateInvoices();
  };
  const subscription = billingData?.subscription ?? null;
  const invoices = invoicesData?.invoices || [];

  function handleManageSubscription() {
    setPortalLoading(true);
    window.location.href = '/api/billing/portal?return_url=/dashboard/more/billing';
  }

  // --- Loading state ---
  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-xl font-semibold text-foreground">Billing</h1>

        {/* Plan card skeleton */}
        <div className={`${card.base} p-6`}>
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>

        {/* Usage meter skeleton */}
        <div className={`${card.base} p-6`}>
          <Skeleton className="h-6 w-32 mb-4" />
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="h-[120px] w-[120px] rounded-full" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>

        {/* Billing details skeleton */}
        <div className={`${card.base} p-6`}>
          <Skeleton className="h-6 w-40 mb-4" />
          <div className="space-y-3">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
          </div>
        </div>

        {/* Invoices skeleton */}
        <div className={`${card.base} p-6`}>
          <Skeleton className="h-6 w-36 mb-4" />
          <div className="space-y-3">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
          </div>
        </div>
      </div>
    );
  }

  // --- Error state (POLISH-04) ---
  // <ErrorState onRetry={refetchBilling} /> replaces the prior ad-hoc card;
  // retry re-runs both SWR fetchers without a full page reload.
  if (error) {
    return (
      <div className="max-w-3xl mx-auto">
        <h1 className="text-xl font-semibold text-foreground mb-6">Billing</h1>
        <div className={`${card.base} p-4`}>
          <ErrorState message="Unable to load billing information. Please try again or contact support if the problem persists." onRetry={refetchBilling} />
        </div>
      </div>
    );
  }

  // --- No subscription state ---
  if (!subscription) {
    return (
      <div className="max-w-3xl mx-auto">
        <h1 className="text-xl font-semibold text-foreground mb-6">Billing</h1>
        <div className={`${card.base} p-12 flex flex-col items-center text-center gap-4`}>
          <AlertCircle className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">No active subscription found</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Please contact support if you believe this is an error.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // --- Data loaded — look up plan info ---
  const planTier = PRICING_TIERS.find((t) => t.id === subscription.plan_id);
  const planName = planTier?.name || subscription.plan_id || 'Unknown';
  const isAnnual = subscription.billing_interval === 'annual';
  const displayPrice = planTier?.monthlyPrice
    ? isAnnual
      ? `$${getAnnualPrice(planTier.monthlyPrice)}/mo`
      : `$${planTier.monthlyPrice}/mo`
    : '';
  const overageRate = planTier?.overageRate || 0;
  const callsUsed = subscription.calls_used || 0;
  const callsLimit = subscription.calls_limit || 0;

  // Status badge config
  const statusBadgeConfig = {
    active: { className: 'bg-green-100 text-green-800 hover:bg-green-100', label: 'Active' },
    trialing: { className: 'bg-blue-100 text-blue-800 hover:bg-blue-100', label: 'Trialing' },
    past_due: { className: 'bg-amber-100 text-amber-800 hover:bg-amber-100', label: 'Past Due' },
    cancelled: { className: 'bg-red-100 text-red-800 hover:bg-red-100', label: 'Cancelled' },
    canceled: { className: 'bg-red-100 text-red-800 hover:bg-red-100', label: 'Cancelled' },
    paused: { className: 'bg-muted text-muted-foreground hover:bg-muted', label: 'Paused' },
    incomplete: { className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100', label: 'Incomplete' },
  };
  const statusBadge = statusBadgeConfig[subscription.status] || {
    className: 'bg-muted text-muted-foreground hover:bg-muted',
    label: subscription.status,
  };

  // Renewal label and date
  const isTrialing = subscription.status === 'trialing';
  const renewalLabel = isTrialing ? 'Trial ends' : 'Next renewal';
  const renewalDate = isTrialing
    ? subscription.trial_ends_at
      ? format(new Date(subscription.trial_ends_at), 'MMM d, yyyy')
      : '\u2014'
    : subscription.current_period_end
    ? format(new Date(subscription.current_period_end), 'MMM d, yyyy')
    : '\u2014';

  const resetDate = subscription.current_period_end
    ? format(new Date(subscription.current_period_end), 'MMM d, yyyy')
    : '\u2014';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-xl font-semibold text-foreground">Billing</h1>

      {/* Section 1: Plan Card */}
      <div className={`${card.base} p-6`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xl font-semibold text-foreground">{planName}</p>
            {displayPrice && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {displayPrice}{isAnnual && ' (billed annually)'}
              </p>
            )}
          </div>
          <Badge className={statusBadge.className}>{statusBadge.label}</Badge>
        </div>

        {/* Cancel at period end warning */}
        {subscription.cancel_at_period_end && subscription.current_period_end && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            Your subscription will end on{' '}
            {format(new Date(subscription.current_period_end), 'MMM d, yyyy')}. You&apos;ll lose
            access to call answering.
          </div>
        )}
      </div>

      {/* Section 2: Usage Meter */}
      <div className={`${card.base} p-6`}>
        <h2 className="text-xl font-semibold text-foreground mb-4">Call Usage</h2>
        <div className="flex flex-col items-center">
          <UsageRingGauge
            callsUsed={callsUsed}
            callsLimit={callsLimit}
            overageRate={overageRate}
          />
          <p className="text-xs text-muted-foreground mt-3">Resets on {resetDate}</p>
        </div>
      </div>

      {/* Section 3: Billing Details */}
      <div className={`${card.base} p-6`}>
        <h2 className="text-xl font-semibold text-foreground mb-4">Billing Details</h2>
        <div className="divide-y divide-border">
          <div className="flex justify-between py-3">
            <span className="text-sm text-muted-foreground">{renewalLabel}</span>
            <span className="text-sm text-foreground font-medium">{renewalDate}</span>
          </div>
        </div>
        <div className="mt-4">
          <button
            onClick={handleManageSubscription}
            disabled={portalLoading}
            className={`${btn.primary} w-full sm:w-auto px-6 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-70`}
          >
            {portalLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Redirecting...
              </>
            ) : (
              'Manage Subscription'
            )}
          </button>
        </div>
      </div>

      {/* Section 4: Recent Invoices */}
      <div className={`${card.base} p-6`}>
        <h2 className="text-xl font-semibold text-foreground mb-4">Recent Invoices</h2>

        {invoices.length > 0 ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.slice(0, 5).map((inv) => {
                  const invoiceBadge =
                    inv.status === 'paid'
                      ? 'bg-green-100 text-green-800 hover:bg-green-100'
                      : inv.status === 'open'
                      ? 'bg-blue-100 text-blue-800 hover:bg-blue-100'
                      : 'bg-red-100 text-red-800 hover:bg-red-100';

                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(inv.date * 1000), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-sm text-foreground font-medium">
                        ${(inv.amount / 100).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge className={invoiceBadge}>
                          {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {inv.hosted_invoice_url && (
                          <a
                            href={inv.hosted_invoice_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="View invoice"
                          >
                            <ExternalLink className="h-4 w-4" aria-hidden="true" />
                          </a>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="mt-4 pt-4 border-t border-border">
              <a
                href="/api/billing/portal?return_url=/dashboard/more/billing"
                className="text-sm text-muted-foreground hover:text-foreground underline transition-colors"
              >
                View all invoices
              </a>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center text-center py-8 gap-3">
            <Receipt className="h-10 w-10 text-muted-foreground/50" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-foreground">No invoices yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your first invoice will appear after your trial ends.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { Plus, ClipboardList } from 'lucide-react';
import Link from 'next/link';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import EstimateSummaryCards from '@/components/dashboard/EstimateSummaryCards';
import EstimateStatusBadge from '@/components/dashboard/EstimateStatusBadge';
import { useDocumentList } from '@/hooks/useDocumentList';
import { StatusTabs, ListError, ListSkeleton, EmptyFiltered } from '@/components/dashboard/DocumentListShell';
import { formatAmount, formatDate } from '@/lib/format-utils';

const STATUS_TABS = [
  { key: 'all',      label: 'All' },
  { key: 'draft',    label: 'Draft' },
  { key: 'sent',     label: 'Sent' },
  { key: 'approved', label: 'Approved' },
  { key: 'declined', label: 'Declined' },
  { key: 'expired',  label: 'Expired' },
];

function formatAmountRange(estimate) {
  if (estimate.tier_range) {
    const min = formatAmount(estimate.tier_range.min);
    const max = formatAmount(estimate.tier_range.max);
    return `${min} - ${max}`;
  }
  return formatAmount(estimate.total);
}

export default function EstimatesPage() {
  const router = useRouter();

  const {
    items: estimates,
    summary,
    statusCounts,
    loading,
    error,
    activeStatus,
    setActiveStatus,
    mutate,
  } = useDocumentList('/api/estimates', { itemsKey: 'estimates' });

  function handleRowClick(estimateId) {
    router.push(`/dashboard/estimates/${estimateId}`);
  }

  // Total count across all statuses for "All" tab
  const totalCount =
    (statusCounts.draft || 0) +
    (statusCounts.sent || 0) +
    (statusCounts.approved || 0) +
    (statusCounts.declined || 0) +
    (statusCounts.expired || 0);

  function getTabCount(key) {
    if (key === 'all') return totalCount;
    return statusCounts[key] || 0;
  }

  return (
    <div className="relative min-h-screen">
      <div className="p-4 sm:p-6 space-y-6 pb-20 sm:pb-6">

        {/* Header row */}
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-stone-900">Estimates</h1>
          <Link
            href="/dashboard/estimates/new"
            className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-md bg-[var(--brand-accent)] hover:bg-[var(--brand-accent)]/90 text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Estimate
          </Link>
        </div>

        {/* Summary cards */}
        <EstimateSummaryCards summary={summary} />

        {/* Status filter tabs */}
        <StatusTabs
          tabs={STATUS_TABS}
          activeStatus={activeStatus}
          onStatusChange={setActiveStatus}
          loading={loading}
          getCount={getTabCount}
        />

        {/* Error state */}
        {error && <ListError message="Couldn't load estimates. Check your connection and try again." onRetry={mutate} />}

        {/* Loading skeleton */}
        {loading && !error && <ListSkeleton />}

        {/* Empty state - no estimates at all */}
        {!loading && !error && estimates.length === 0 && activeStatus === 'all' && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ClipboardList className="h-10 w-10 text-stone-300 mb-4" aria-hidden="true" />
            <h2 className="text-base font-semibold text-foreground mb-2">No estimates yet</h2>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              Send professional estimates to your customers and convert more leads into paying jobs.
            </p>
            <Link
              href="/dashboard/estimates/new"
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-[var(--brand-accent)] hover:bg-[var(--brand-accent)]/90 text-white text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Your First Estimate
            </Link>
          </div>
        )}

        {/* Empty state - filtered with no results */}
        {!loading && !error && estimates.length === 0 && activeStatus !== 'all' && (
          <EmptyFiltered icon={ClipboardList} activeStatus={activeStatus} documentName="estimates" />
        )}

        {/* Estimate table - desktop */}
        {!loading && !error && estimates.length > 0 && (
          <>
            <div className="hidden sm:block border border-stone-200 rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-stone-50">
                    <TableHead className="text-xs font-medium text-stone-500">Estimate #</TableHead>
                    <TableHead className="text-xs font-medium text-stone-500">Customer</TableHead>
                    <TableHead className="text-xs font-medium text-stone-500">Job Type</TableHead>
                    <TableHead className="text-xs font-medium text-stone-500">Amount</TableHead>
                    <TableHead className="text-xs font-medium text-stone-500">Created</TableHead>
                    <TableHead className="text-xs font-medium text-stone-500">Valid Until</TableHead>
                    <TableHead className="text-xs font-medium text-stone-500">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {estimates.map((estimate) => (
                    <TableRow
                      key={estimate.id}
                      onClick={() => handleRowClick(estimate.id)}
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(estimate.id); }}}
                      className="cursor-pointer hover:bg-stone-50 transition-colors"
                    >
                      <TableCell className="text-sm font-medium text-stone-900">{estimate.estimate_number}</TableCell>
                      <TableCell className="text-sm text-stone-700">{estimate.customer_name}</TableCell>
                      <TableCell className="text-sm text-stone-500">{estimate.job_type || '\u2014'}</TableCell>
                      <TableCell className="text-sm font-medium text-stone-900">{formatAmountRange(estimate)}</TableCell>
                      <TableCell className="text-sm text-stone-500">{formatDate(estimate.created_at)}</TableCell>
                      <TableCell className="text-sm text-stone-500">{formatDate(estimate.valid_until)}</TableCell>
                      <TableCell><EstimateStatusBadge status={estimate.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Estimate cards - mobile */}
            <div className="sm:hidden space-y-2">
              {estimates.map((estimate) => (
                <div
                  key={estimate.id}
                  onClick={() => handleRowClick(estimate.id)}
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(estimate.id); }}}
                  role="button"
                  className="bg-white border border-stone-200 rounded-lg p-4 cursor-pointer hover:bg-stone-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-stone-900 truncate">{estimate.estimate_number}</p>
                      <p className="text-sm text-stone-700 truncate">{estimate.customer_name}</p>
                    </div>
                    <p className="text-sm font-medium text-stone-900 flex-shrink-0">{formatAmountRange(estimate)}</p>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <EstimateStatusBadge status={estimate.status} />
                    <p className="text-xs text-stone-400">Valid {formatDate(estimate.valid_until)}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Mobile floating action button */}
      <Link
        href="/dashboard/estimates/new"
        className="sm:hidden fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[var(--brand-accent)] hover:bg-[var(--brand-accent)]/90 text-white shadow-lg flex items-center justify-center transition-colors"
        aria-label="Create Estimate"
      >
        <Plus className="w-6 h-6" />
      </Link>
    </div>
  );
}

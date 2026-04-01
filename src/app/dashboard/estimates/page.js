'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Plus, ClipboardList } from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import EstimateSummaryCards from '@/components/dashboard/EstimateSummaryCards';
import EstimateStatusBadge from '@/components/dashboard/EstimateStatusBadge';

const STATUS_TABS = [
  { key: 'all',      label: 'All' },
  { key: 'draft',    label: 'Draft' },
  { key: 'sent',     label: 'Sent' },
  { key: 'approved', label: 'Approved' },
  { key: 'declined', label: 'Declined' },
  { key: 'expired',  label: 'Expired' },
];

function formatAmount(value) {
  return '$' + Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });
}

function formatAmountRange(estimate) {
  if (estimate.tier_range) {
    const min = formatAmount(estimate.tier_range.min);
    const max = formatAmount(estimate.tier_range.max);
    return `${min} - ${max}`;
  }
  return formatAmount(estimate.total);
}

function formatDate(dateStr) {
  if (!dateStr) return '\u2014';
  try {
    return format(new Date(dateStr), 'MMM d, yyyy');
  } catch {
    return '\u2014';
  }
}

export default function EstimatesPage() {
  const router = useRouter();

  const [estimates, setEstimates] = useState([]);
  const [summary, setSummary] = useState(null);
  const [statusCounts, setStatusCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeStatus, setActiveStatus] = useState('all');

  // Track whether summary has been loaded yet (only fetch once)
  const [summaryLoaded, setSummaryLoaded] = useState(false);

  useEffect(() => {
    async function fetchEstimates() {
      setLoading(true);
      setError(null);
      try {
        const url =
          activeStatus === 'all'
            ? '/api/estimates'
            : `/api/estimates?status=${activeStatus}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        setEstimates(data.estimates || []);

        // Status counts always come from the response
        if (data.status_counts) {
          setStatusCounts(data.status_counts);
        }

        // Only set summary on first load
        if (!summaryLoaded && data.summary) {
          setSummary(data.summary);
          setSummaryLoaded(true);
        }
      } catch (err) {
        console.error('Failed to load estimates:', err);
        setError('Couldn\'t load estimates. Check your connection and try again.');
      } finally {
        setLoading(false);
      }
    }

    fetchEstimates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStatus]);

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
      {/* Page content */}
      <div className="p-4 sm:p-6 space-y-6 pb-20 sm:pb-6">

        {/* Header row */}
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-stone-900">Estimates</h1>
          {/* Desktop CTA */}
          <Link
            href="/dashboard/estimates/new"
            className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-md bg-[#C2410C] hover:bg-[#C2410C]/90 text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Estimate
          </Link>
        </div>

        {/* Summary cards */}
        <EstimateSummaryCards summary={summaryLoaded ? summary : null} />

        {/* Status filter tabs */}
        <div className="border-b border-stone-200">
          <div className="flex gap-0 overflow-x-auto">
            {STATUS_TABS.map((tab) => {
              const isActive = activeStatus === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveStatus(tab.key)}
                  className={`
                    flex-shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
                    ${
                      isActive
                        ? 'border-[#C2410C] text-[#C2410C]'
                        : 'border-transparent text-stone-500 hover:text-stone-700'
                    }
                  `}
                >
                  {tab.label}
                  {!loading && (
                    <span
                      className={`ml-1.5 text-xs ${
                        isActive ? 'text-[#C2410C]' : 'text-stone-400'
                      }`}
                    >
                      ({getTabCount(tab.key)})
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="text-center py-12">
            <p className="text-sm text-red-600 mb-3">{error}</p>
            <button
              onClick={() => {
                setError(null);
                setActiveStatus(activeStatus === 'all' ? 'all' : activeStatus);
              }}
              className="text-sm text-[#C2410C] hover:text-[#9A3412] underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !error && (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton
                key={i}
                className={`h-12 w-full rounded-md ${i % 2 === 0 ? 'opacity-70' : ''}`}
              />
            ))}
          </div>
        )}

        {/* Empty state - no estimates at all */}
        {!loading && !error && estimates.length === 0 && activeStatus === 'all' && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ClipboardList className="w-12 h-12 text-stone-300 mb-6" />
            <h2 className="text-xl font-semibold text-stone-900 mb-2">No estimates yet</h2>
            <p className="text-sm text-stone-500 max-w-md mb-6">
              Send professional estimates to your customers and convert more leads into paying jobs.
            </p>
            <Link
              href="/dashboard/estimates/new"
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-[#C2410C] hover:bg-[#C2410C]/90 text-white text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Your First Estimate
            </Link>
          </div>
        )}

        {/* Empty state - filtered with no results */}
        {!loading && !error && estimates.length === 0 && activeStatus !== 'all' && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ClipboardList className="w-12 h-12 text-stone-300 mb-4" />
            <h2 className="text-xl font-semibold text-stone-900 mb-2">
              No {activeStatus} estimates
            </h2>
            <p className="text-sm text-stone-500">
              You don&apos;t have any estimates with this status.
            </p>
          </div>
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
                      className="cursor-pointer hover:bg-stone-50 transition-colors"
                    >
                      <TableCell className="text-sm font-medium text-stone-900">
                        {estimate.estimate_number}
                      </TableCell>
                      <TableCell className="text-sm text-stone-700">
                        {estimate.customer_name}
                      </TableCell>
                      <TableCell className="text-sm text-stone-500">
                        {estimate.job_type || '\u2014'}
                      </TableCell>
                      <TableCell className="text-sm font-medium text-stone-900">
                        {formatAmountRange(estimate)}
                      </TableCell>
                      <TableCell className="text-sm text-stone-500">
                        {formatDate(estimate.created_at)}
                      </TableCell>
                      <TableCell className="text-sm text-stone-500">
                        {formatDate(estimate.valid_until)}
                      </TableCell>
                      <TableCell>
                        <EstimateStatusBadge status={estimate.status} />
                      </TableCell>
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
                  className="bg-white border border-stone-200 rounded-lg p-4 cursor-pointer hover:bg-stone-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-stone-900 truncate">
                        {estimate.estimate_number}
                      </p>
                      <p className="text-sm text-stone-700 truncate">{estimate.customer_name}</p>
                    </div>
                    <p className="text-sm font-medium text-stone-900 flex-shrink-0">
                      {formatAmountRange(estimate)}
                    </p>
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
        className="sm:hidden fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#C2410C] hover:bg-[#C2410C]/90 text-white shadow-lg flex items-center justify-center transition-colors"
        aria-label="Create Estimate"
      >
        <Plus className="w-6 h-6" />
      </Link>
    </div>
  );
}

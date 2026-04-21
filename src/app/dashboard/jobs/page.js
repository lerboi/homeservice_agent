'use client';

// Phase 59 Plan 06: Jobs page rewritten to read from /api/jobs (not /api/leads).
// Realtime subscription flipped from `leads` table → `jobs` table (D-15).
// All Lead* component imports replaced with Job* equivalents.
// Batch invoice select preserved (jobs status 'completed' → eligible).

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Wrench, Check } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import JobCard from '@/components/dashboard/JobCard';
import JobFilterBar from '@/components/dashboard/JobFilterBar';
import JobFlyout from '@/components/dashboard/JobFlyout';
import JobStatusPills from '@/components/dashboard/JobStatusPills';
import { EmptyStateJobs, EmptyStateJobsFiltered } from '@/components/dashboard/EmptyStateJobs';
import { ErrorState } from '@/components/ui/error-state';
import { supabase } from '@/lib/supabase-browser';
import { card } from '@/lib/design-tokens';

// Phase 59 Plan 06: Jobs page — source of truth is now /api/jobs + jobs Realtime channel.
// LeadFlyout preserved until Plan 07 replaces it with JobFlyout.

// ─── Realtime animation keyframe (injected once into document) ────────────────

const SLIDE_IN_STYLE_ID = 'job-slide-in-keyframe';

function ensureSlideInKeyframe() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(SLIDE_IN_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = SLIDE_IN_STYLE_ID;
  style.textContent = `
    @keyframes slide-in-from-top {
      from { opacity: 0; transform: translateY(-8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .animate-slide-in-from-top {
      animation: slide-in-from-top 200ms ease-out;
    }
  `;
  document.head.appendChild(style);
}

// ─── Filter helpers ───────────────────────────────────────────────────────────

const DEFAULT_FILTERS = {
  status: '',
  urgency: '',
  dateFrom: '',
  dateTo: '',
  search: '',
  jobType: '',
};

// Status is applied client-side so we can show accurate per-status counts
// on the pill strip without double-fetching.
function buildQueryString(filters) {
  const params = new URLSearchParams();
  if (filters.urgency) params.set('urgency', filters.urgency);
  if (filters.dateFrom) params.set('date_from', filters.dateFrom);
  if (filters.dateTo) params.set('date_to', filters.dateTo);
  if (filters.search) params.set('search', filters.search);
  if (filters.jobType) params.set('job_type', filters.jobType);
  return params.toString();
}

const PIPELINE_STATUSES = ['scheduled', 'completed', 'paid', 'lost', 'cancelled'];

function hasActiveFilters(filters) {
  return Object.values(filters).some(Boolean);
}

// ─── Jobs page ────────────────────────────────────────────────────────────────

export default function JobsPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Flyout state — still uses LeadFlyout until Plan 07 replaces with JobFlyout
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [flyoutOpen, setFlyoutOpen] = useState(false);

  // Tenant ID for Realtime filter
  const [tenantId, setTenantId] = useState(null);

  // Invoice status map for badge indicators on job cards
  const [invoiceStatusMap, setInvoiceStatusMap] = useState({});

  // Batch select state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedJobs, setSelectedJobs] = useState(new Set());
  const [batchCreating, setBatchCreating] = useState(false);

  // Read initial filters from URL search params
  const searchParams = useSearchParams();
  const router = useRouter();
  const openHandled = useRef(false);

  const [filters, setFilters] = useState(() => ({
    status: searchParams.get('status') || '',
    urgency: searchParams.get('urgency') || '',
    dateFrom: searchParams.get('date_from') || '',
    dateTo: searchParams.get('date_to') || '',
    search: searchParams.get('search') || '',
    jobType: searchParams.get('job_type') || '',
  }));

  // Sync filters to URL search params (skip initial mount)
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.urgency) params.set('urgency', filters.urgency);
    if (filters.dateFrom) params.set('date_from', filters.dateFrom);
    if (filters.dateTo) params.set('date_to', filters.dateTo);
    if (filters.search) params.set('search', filters.search);
    if (filters.jobType) params.set('job_type', filters.jobType);
    // Preserve the 'open' param if present
    const openParam = searchParams.get('open');
    if (openParam) params.set('open', openParam);
    const qs = params.toString();
    router.replace(`/dashboard/jobs${qs ? `?${qs}` : ''}`, { scroll: false });
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-open flyout from ?open= param (e.g. from invoice detail "View Job")
  useEffect(() => {
    const openJobId = searchParams.get('open');
    if (openJobId && !openHandled.current) {
      openHandled.current = true;
      setSelectedJobId(openJobId);
      setFlyoutOpen(true);
      router.replace('/dashboard/jobs', { scroll: false });
    }
  }, [searchParams, router]);

  // ── Inject Realtime animation keyframe once ─────────────────────────────
  useEffect(() => { ensureSlideInKeyframe(); }, []);

  // ── Get tenant ID for Realtime subscription ─────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setTenantId(null); return; }
      // Resolve actual tenant_id from tenants table (user.id !== tenant_id)
      supabase
        .from('tenants')
        .select('id')
        .eq('owner_id', user.id)
        .single()
        .then(({ data }) => setTenantId(data?.id ?? null));
    }).catch(() => {
      setTenantId(null);
    });
  }, []);

  // ── Fetch jobs from /api/jobs ─────────────────────────────────────────────

  const fetchJobs = useCallback(async (activeFilters) => {
    setLoading(true);
    setError(null);
    try {
      const qs = buildQueryString(activeFilters);
      const res = await fetch(`/api/jobs${qs ? `?${qs}` : ''}`);
      if (!res.ok) throw new Error('Failed to load jobs');
      const data = await res.json();
      // Sort by urgency: emergency first, then urgent, then routine
      const URGENCY_WEIGHT = { emergency: 3, urgent: 2, routine: 1 };
      const sorted = (data.jobs || []).sort((a, b) => {
        const wa = URGENCY_WEIGHT[a.urgency] || 0;
        const wb = URGENCY_WEIGHT[b.urgency] || 0;
        if (wa !== wb) return wb - wa;
        return new Date(b.created_at) - new Date(a.created_at);
      });
      setJobs(sorted);
    } catch {
      setError("We couldn't load your jobs. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Only refetch when server-side filters change. Status is applied client-side,
  // so toggling status pills doesn't trigger a network round-trip / loading flash.
  const serverQueryKey = useMemo(
    () => buildQueryString(filters),
    [filters.urgency, filters.dateFrom, filters.dateTo, filters.search, filters.jobType] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    fetchJobs(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverQueryKey, fetchJobs]);

  // ── Batch-fetch invoice statuses for job cards ─────────────────────────
  const jobIdKey = useMemo(() => jobs.map((j) => j.id).join(','), [jobs]);

  useEffect(() => {
    if (!jobIdKey) return;
    fetch(`/api/invoices?lead_ids=${jobIdKey}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data?.invoices) return;
        const map = {};
        for (const inv of data.invoices) {
          if (inv.lead_id) map[inv.lead_id] = inv.status;
          if (inv.job_id) map[inv.job_id] = inv.status;
        }
        setInvoiceStatusMap(map);
      })
      .catch(() => {});
  }, [jobIdKey]);

  // ── Supabase Realtime subscription — subscribed to `jobs` table (D-15) ──
  // Use a ref for filters so the INSERT callback reads the latest values
  // without including filters in the effect deps (which would destroy and
  // recreate the WebSocket channel on every filter change).
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel('jobs-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'jobs',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          const newJob = { ...payload.new, _isNew: true };
          const f = filtersRef.current;
          // Status is applied client-side (via pill strip), so don't filter INSERTs by status here.
          const matchesServerFilters = (
            (!f.urgency || f.urgency === newJob.urgency) &&
            (!f.jobType || f.jobType === newJob.job_type) &&
            (!f.search || (newJob.caller_name || '').toLowerCase().includes(f.search.toLowerCase()))
          );
          if (matchesServerFilters) {
            setJobs((prev) => [newJob, ...prev]);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'jobs',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          setJobs((prev) =>
            prev.map((j) =>
              j.id === payload.new.id ? { ...payload.new, _isNew: false } : j
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId]);

  // ── Client-side status filtering + pipeline counts ─────────────────────
  const pipelineCounts = useMemo(() => {
    const counts = PIPELINE_STATUSES.reduce((acc, s) => ({ ...acc, [s]: 0 }), {});
    for (const job of jobs) {
      if (counts[job.status] !== undefined) counts[job.status] += 1;
    }
    return counts;
  }, [jobs]);

  const displayedJobs = useMemo(
    () => (filters.status ? jobs.filter((j) => j.status === filters.status) : jobs),
    [jobs, filters.status]
  );

  // ── Batch eligibility ──────────────────────────────────────────────────

  /** A job is eligible for batch invoicing if completed AND has no existing invoice */
  function isEligibleForBatch(job) {
    return job.status === 'completed' && !invoiceStatusMap[job.id];
  }

  const eligibleJobs = useMemo(
    () => displayedJobs.filter(isEligibleForBatch),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [displayedJobs, invoiceStatusMap]
  );

  function toggleJobSelection(jobId) {
    setSelectedJobs((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  }

  function toggleSelectAllEligible() {
    if (selectedJobs.size === eligibleJobs.length && eligibleJobs.length > 0) {
      setSelectedJobs(new Set());
    } else {
      setSelectedJobs(new Set(eligibleJobs.map((j) => j.id)));
    }
  }

  // ── Batch create handler ───────────────────────────────────────────────

  async function handleBatchCreate() {
    setBatchCreating(true);
    try {
      const res = await fetch('/api/invoices/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_ids: Array.from(selectedJobs) }),
      });
      if (!res.ok) throw new Error('Batch creation failed');
      const data = await res.json();
      const invoiceIds = (data.invoices || []).map((inv) => inv.id);
      setSelectedJobs(new Set());
      if (invoiceIds.length > 0) {
        router.push(`/dashboard/invoices/batch-review?ids=${invoiceIds.join(',')}`);
      }
    } catch {
      setError("Couldn't create batch invoices. Try again.");
      setTimeout(() => setError(null), 5000);
    } finally {
      setBatchCreating(false);
    }
  }

  // ── Event handlers ──────────────────────────────────────────────────────

  function handleFilterChange(partial) {
    setFilters((prev) => ({ ...prev, ...partial }));
  }

  function handleClearFilters() {
    setFilters(DEFAULT_FILTERS);
  }

  function handleView(jobId) {
    setSelectedJobId(jobId);
    setFlyoutOpen(true);
  }

  function handleStatusChange(updatedJob) {
    setJobs((prev) =>
      prev.map((j) => (j.id === updatedJob.id ? { ...updatedJob, _isNew: false } : j))
    );
  }

  // ── Loading state ───────────────────────────────────────────────────────

  const skeletonCards = (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-[72px] w-full rounded-xl" />
      ))}
    </div>
  );

  // ── Error state ─────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className={`${card.base} p-0`} data-tour="jobs-page">
        <div className="p-6">
          <JobFilterBar
            filters={filters}
            onFilterChange={handleFilterChange}
            onClear={handleClearFilters}
          />
          <ErrorState message={error} onRetry={() => fetchJobs(filters)} />
        </div>
      </div>
    );
  }

  // ── Page header ─────────────────────────────────────────────────────────

  const pageHeader = (
    <div className="flex items-center justify-between px-6 pt-6 pb-4">
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center size-8 rounded-lg bg-muted">
          <Wrench className="size-4 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-semibold text-foreground">Jobs</h1>
        {!loading && (
          <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-2.5 py-0.5 text-xs font-medium">
            {jobs.length}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Select mode toggle — only when there are eligible jobs to batch-invoice */}
        {eligibleJobs.length > 0 && (
          <button
            type="button"
            onClick={() => { setSelectMode((prev) => { if (prev) setSelectedJobs(new Set()); return !prev; }); }}
            className={`flex items-center gap-1 h-8 px-3 rounded-lg text-xs font-medium transition-colors ${
              selectMode
                ? 'bg-[var(--brand-accent)] text-white hover:bg-[var(--brand-accent-hover)]'
                : 'border border-border text-muted-foreground bg-card hover:bg-muted'
            }`}
            aria-pressed={selectMode}
          >
            {selectMode ? <><Check className="h-3.5 w-3.5" /> Done</> : 'Select'}
          </button>
        )}
      </div>
    </div>
  );

  // ── Job list content ────────────────────────────────────────────────────

  const isFiltered = hasActiveFilters(filters);

  let mainContent;
  if (loading) {
    mainContent = skeletonCards;
  } else if (displayedJobs.length === 0 && !isFiltered) {
    mainContent = <EmptyStateJobs />;
  } else if (displayedJobs.length === 0 && isFiltered) {
    mainContent = <EmptyStateJobsFiltered onClear={handleClearFilters} />;
  } else {
    mainContent = (
      <div className="space-y-3">
        {displayedJobs.map((job) => (
          <div
            key={job.id}
            className={job._isNew ? 'animate-slide-in-from-top' : ''}
          >
            <JobCard
              job={job}
              onView={handleView}
              invoiceStatus={invoiceStatusMap[job.id]}
              selectable={selectMode && isEligibleForBatch(job)}
              selected={selectedJobs.has(job.id)}
              onToggle={() => toggleJobSelection(job.id)}
            />
          </div>
        ))}
      </div>
    );
  }

  // ── Batch select bar ───────────────────────────────────────────────────

  const selectedRevenue = useMemo(() => {
    return jobs
      .filter((j) => selectedJobs.has(j.id))
      .reduce((sum, j) => sum + Number(j.revenue_amount || 0), 0);
  }, [jobs, selectedJobs]);

  const selectedJobDetails = useMemo(() => {
    return jobs.filter((j) => selectedJobs.has(j.id));
  }, [jobs, selectedJobs]);

  const batchSelectBar = selectedJobs.size > 0 && (
    <div className="fixed bottom-16 lg:bottom-0 left-0 right-0 z-50 bg-card border-t border-border shadow-[0_-4px_12px_0_rgba(0,0,0,0.06)] px-6 py-3 flex items-center justify-between animate-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-center gap-3 min-w-0">
        {eligibleJobs.length > 1 && (
          <Checkbox
            checked={selectedJobs.size === eligibleJobs.length}
            onCheckedChange={toggleSelectAllEligible}
            aria-label="Select all eligible jobs"
          />
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            {selectedJobs.size} of {eligibleJobs.length} selected
          </p>
          {selectedRevenue > 0 && (
            <p className="text-xs text-muted-foreground">
              ${selectedRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} estimated revenue
            </p>
          )}
        </div>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            type="button"
            disabled={batchCreating}
            className="bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 shrink-0"
          >
            {batchCreating ? 'Creating...' : 'Review & Create'}
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create {selectedJobs.size} draft {selectedJobs.size === 1 ? 'invoice' : 'invoices'}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p className="mb-3">Draft invoices will be created with pre-filled customer information. You can review and edit each one before sending.</p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {selectedJobDetails.map((job) => (
                    <div key={job.id} className="flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-muted">
                      <span className="font-medium text-foreground truncate">{job.customer?.name || job.caller_name || job.from_number || 'Unknown'}</span>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">{job.job_type || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBatchCreate}
              className="bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)] text-white"
            >
              Create {selectedJobs.size} {selectedJobs.size === 1 ? 'Draft' : 'Drafts'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  return (
    <>
      <div className={`${card.base} p-0`} data-tour="jobs-page">
        {pageHeader}

        <JobStatusPills
          counts={pipelineCounts}
          activeStatus={filters.status}
          onStatusChange={(status) => handleFilterChange({ status })}
        />

        <JobFilterBar
          filters={filters}
          onFilterChange={handleFilterChange}
          onClear={handleClearFilters}
        />

        <div className="px-6 py-4">
          {mainContent}
        </div>
      </div>

      {batchSelectBar}

      {/* Plan 07: JobFlyout replaces LeadFlyout (Phase 59 D-09 status enum swap) */}
      <JobFlyout
        jobId={selectedJobId}
        open={flyoutOpen}
        onOpenChange={setFlyoutOpen}
        onStatusChange={handleStatusChange}
      />
    </>
  );
}

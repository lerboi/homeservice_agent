'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Users, Check } from 'lucide-react';
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
import LeadCard from '@/components/dashboard/LeadCard';
import LeadFilterBar from '@/components/dashboard/LeadFilterBar';
import LeadFlyout from '@/components/dashboard/LeadFlyout';
import LeadStatusPills from '@/components/dashboard/LeadStatusPills';
import { EmptyStateLeads } from '@/components/dashboard/EmptyStateLeads';
import { ErrorState } from '@/components/ui/error-state';
import { supabase } from '@/lib/supabase-browser';
import { card } from '@/lib/design-tokens';

// Phase 58 Plan 58-05 (POLISH-01 / POLISH-04):
//   - EmptyStateLeads (wrapped <EmptyState icon={Users} headline="No jobs yet" .../>)
//     renders when the jobs list is empty and no filters are active.
//   - <ErrorState onRetry={...} /> replaces the ad-hoc red-text block on fetch
//     failure; retry re-runs fetchLeads with the current filters.

// ─── Realtime animation keyframe (injected once into document) ────────────────

const SLIDE_IN_STYLE_ID = 'lead-slide-in-keyframe';

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

const PIPELINE_STATUSES = ['new', 'booked', 'completed', 'paid', 'lost'];

function hasActiveFilters(filters) {
  return Object.values(filters).some(Boolean);
}

// ─── Leads page ───────────────────────────────────────────────────────────────

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Flyout state
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [flyoutOpen, setFlyoutOpen] = useState(false);

  // Tenant ID for Realtime filter
  const [tenantId, setTenantId] = useState(null);

  // Invoice status map for badge indicators on lead cards
  const [invoiceStatusMap, setInvoiceStatusMap] = useState({});

  // Batch select state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState(new Set());
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

  // Auto-open flyout from ?open= param (e.g. from invoice detail "View Lead")

  useEffect(() => {
    const openLeadId = searchParams.get('open');
    if (openLeadId && !openHandled.current) {
      openHandled.current = true;
      setSelectedLeadId(openLeadId);
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

  // ── Fetch leads ─────────────────────────────────────────────────────────

  const fetchLeads = useCallback(async (activeFilters) => {
    setLoading(true);
    setError(null);
    try {
      const qs = buildQueryString(activeFilters);
      const res = await fetch(`/api/leads${qs ? `?${qs}` : ''}`);
      if (!res.ok) throw new Error('Failed to load leads');
      const data = await res.json();
      // Sort by urgency: emergency first, then urgent, then routine
      const URGENCY_WEIGHT = { emergency: 3, urgent: 2, routine: 1 };
      const sorted = (data.leads || []).sort((a, b) => {
        const wa = URGENCY_WEIGHT[a.urgency] || 0;
        const wb = URGENCY_WEIGHT[b.urgency] || 0;
        if (wa !== wb) return wb - wa;
        return new Date(b.created_at) - new Date(a.created_at);
      });
      setLeads(sorted);
    } catch {
      setError("Couldn't load leads. Check your connection and refresh the page.");
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
    fetchLeads(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverQueryKey, fetchLeads]);

  // ── Batch-fetch invoice statuses for lead cards ────────────────────────
  // Use a stable string key derived from lead IDs so the effect only re-runs
  // when leads are actually added/removed, not on every Realtime UPDATE
  // (which creates a new array reference via .map() even if content is unchanged).
  const leadIdKey = useMemo(() => leads.map((l) => l.id).join(','), [leads]);

  useEffect(() => {
    if (!leadIdKey) return;
    fetch(`/api/invoices?lead_ids=${leadIdKey}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data?.invoices) return;
        const map = {};
        for (const inv of data.invoices) {
          if (inv.lead_id) map[inv.lead_id] = inv.status;
        }
        setInvoiceStatusMap(map);
      })
      .catch(() => {});
  }, [leadIdKey]);

  // ── Supabase Realtime subscription ─────────────────────────────────────
  // Use a ref for filters so the INSERT callback reads the latest values
  // without including filters in the effect deps (which would destroy and
  // recreate the WebSocket channel on every filter change).
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel('leads-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'leads',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          const newLead = { ...payload.new, _isNew: true };
          const f = filtersRef.current;
          // Status is applied client-side (via pill strip), so don't filter INSERTs by status here.
          const matchesServerFilters = (
            (!f.urgency || f.urgency === newLead.urgency_tag) &&
            (!f.jobType || f.jobType === newLead.job_type) &&
            (!f.search || (newLead.caller_name || '').toLowerCase().includes(f.search.toLowerCase()))
          );
          if (matchesServerFilters) {
            setLeads((prev) => [newLead, ...prev]);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'leads',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          setLeads((prev) =>
            prev.map((l) =>
              l.id === payload.new.id ? { ...payload.new, _isNew: false } : l
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
  // `leads` holds everything matching the server-side filters (urgency, date, etc.)
  // except status, which is applied here so the pill strip can show true counts.

  const pipelineCounts = useMemo(() => {
    const counts = PIPELINE_STATUSES.reduce((acc, s) => ({ ...acc, [s]: 0 }), {});
    for (const lead of leads) {
      if (counts[lead.status] !== undefined) counts[lead.status] += 1;
    }
    return counts;
  }, [leads]);

  const displayedLeads = useMemo(
    () => (filters.status ? leads.filter((l) => l.status === filters.status) : leads),
    [leads, filters.status]
  );

  // ── Batch eligibility ──────────────────────────────────────────────────

  /** A lead is eligible for batch invoicing if completed AND has no existing invoice */
  function isEligibleForBatch(lead) {
    return lead.status === 'completed' && !invoiceStatusMap[lead.id];
  }

  const eligibleLeads = useMemo(
    () => displayedLeads.filter(isEligibleForBatch),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [displayedLeads, invoiceStatusMap]
  );

  function toggleLeadSelection(leadId) {
    setSelectedLeads((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) {
        next.delete(leadId);
      } else {
        next.add(leadId);
      }
      return next;
    });
  }

  function toggleSelectAllEligible() {
    if (selectedLeads.size === eligibleLeads.length && eligibleLeads.length > 0) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(eligibleLeads.map((l) => l.id)));
    }
  }

  // ── Batch create handler ───────────────────────────────────────────────

  async function handleBatchCreate() {
    setBatchCreating(true);
    try {
      const res = await fetch('/api/invoices/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_ids: Array.from(selectedLeads) }),
      });
      if (!res.ok) throw new Error('Batch creation failed');
      const data = await res.json();
      const invoiceIds = (data.invoices || []).map((inv) => inv.id);
      setSelectedLeads(new Set());
      if (invoiceIds.length > 0) {
        router.push(`/dashboard/invoices/batch-review?ids=${invoiceIds.join(',')}`);
      }
    } catch {
      // Show inline error — toast not imported, keep simple
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

  function handleView(leadId) {
    setSelectedLeadId(leadId);
    setFlyoutOpen(true);
  }

  function handleStatusChange(updatedLead) {
    // Update the lead in the local list after a status change in the flyout
    setLeads((prev) =>
      prev.map((l) => (l.id === updatedLead.id ? { ...updatedLead, _isNew: false } : l))
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

  // ── Error state (POLISH-04) ─────────────────────────────────────────────
  // <ErrorState onRetry={...} /> replaces the prior red-text block. Retry
  // re-runs fetchLeads with current filters (clearing `error` on success).

  if (error) {
    return (
      <div className={`${card.base} p-0`} data-tour="leads-page">
        <div className="p-6">
          <LeadFilterBar
            filters={filters}
            onFilterChange={handleFilterChange}
            onClear={handleClearFilters}
          />
          <ErrorState message={error} onRetry={() => fetchLeads(filters)} />
        </div>
      </div>
    );
  }

  // ── Page header ─────────────────────────────────────────────────────────

  const pageHeader = (
    <div className="flex items-center justify-between px-6 pt-6 pb-4">
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center size-8 rounded-lg bg-muted">
          <Users className="size-4 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-semibold text-foreground">Jobs</h1>
        {!loading && (
          <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-2.5 py-0.5 text-xs font-medium">
            {leads.length}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Select mode toggle — only when there are eligible leads to batch-invoice */}
        {eligibleLeads.length > 0 && (
          <button
            type="button"
            onClick={() => { setSelectMode((prev) => { if (prev) setSelectedLeads(new Set()); return !prev; }); }}
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

  // ── Lead list content ──────────────────────────────────────────────────

  const isFiltered = hasActiveFilters(filters);

  let mainContent;
  if (loading) {
    mainContent = skeletonCards;
  } else if (displayedLeads.length === 0 && !isFiltered) {
    mainContent = <EmptyStateLeads />;
  } else if (displayedLeads.length === 0 && isFiltered) {
    mainContent = (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-muted-foreground mb-2">No leads match your filters.</p>
        <button
          type="button"
          onClick={handleClearFilters}
          className="text-sm text-[var(--brand-accent)] hover:text-[var(--brand-accent-hover)] font-medium"
        >
          Clear filters
        </button>
      </div>
    );
  } else {
    mainContent = (
      <div className="space-y-3">
        {displayedLeads.map((lead) => (
          <div
            key={lead.id}
            className={lead._isNew ? 'animate-slide-in-from-top' : ''}
          >
            <LeadCard
              lead={lead}
              onView={handleView}
              invoiceStatus={invoiceStatusMap[lead.id]}
              selectable={selectMode && isEligibleForBatch(lead)}
              selected={selectedLeads.has(lead.id)}
              onToggle={() => toggleLeadSelection(lead.id)}
            />
          </div>
        ))}
      </div>
    );
  }

  // ── Batch select bar ───────────────────────────────────────────────────

  // Compute estimated revenue for selected leads (use `leads` so selection
  // survives status-pill changes — a user can select then switch views).
  const selectedRevenue = useMemo(() => {
    return leads
      .filter((l) => selectedLeads.has(l.id))
      .reduce((sum, l) => sum + Number(l.revenue_amount || 0), 0);
  }, [leads, selectedLeads]);

  const selectedLeadDetails = useMemo(() => {
    return leads.filter((l) => selectedLeads.has(l.id));
  }, [leads, selectedLeads]);

  const batchSelectBar = selectedLeads.size > 0 && (
    <div className="fixed bottom-16 lg:bottom-0 left-0 right-0 z-50 bg-card border-t border-border shadow-[0_-4px_12px_0_rgba(0,0,0,0.06)] px-6 py-3 flex items-center justify-between animate-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-center gap-3 min-w-0">
        {eligibleLeads.length > 1 && (
          <Checkbox
            checked={selectedLeads.size === eligibleLeads.length}
            onCheckedChange={toggleSelectAllEligible}
            aria-label="Select all eligible leads"
          />
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            {selectedLeads.size} of {eligibleLeads.length} selected
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
            <AlertDialogTitle>Create {selectedLeads.size} draft {selectedLeads.size === 1 ? 'invoice' : 'invoices'}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p className="mb-3">Draft invoices will be created with pre-filled customer information. You can review and edit each one before sending.</p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {selectedLeadDetails.map((lead) => (
                    <div key={lead.id} className="flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-muted">
                      <span className="font-medium text-foreground truncate">{lead.caller_name || lead.from_number || 'Unknown'}</span>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">{lead.job_type || '—'}</span>
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
              Create {selectedLeads.size} {selectedLeads.size === 1 ? 'Draft' : 'Drafts'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  return (
    <>
      <div className={`${card.base} p-0`} data-tour="leads-page">
        {pageHeader}

        <LeadStatusPills
          counts={pipelineCounts}
          activeStatus={filters.status}
          onStatusChange={(status) => handleFilterChange({ status })}
        />

        <LeadFilterBar
          filters={filters}
          onFilterChange={handleFilterChange}
          onClear={handleClearFilters}
        />

        <div className="px-6 py-4">
          {mainContent}
        </div>
      </div>

      {batchSelectBar}

      {/* LeadFlyout — rendered outside the card stack to avoid stacking context issues */}
      <LeadFlyout
        leadId={selectedLeadId}
        open={flyoutOpen}
        onOpenChange={setFlyoutOpen}
        onStatusChange={handleStatusChange}
      />
    </>
  );
}

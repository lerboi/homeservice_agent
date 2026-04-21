'use client';

// Phase 59 Plan 06: Inquiries page — new tab sourced from /api/inquiries.
// Realtime subscribes to `inquiries` table with tenant_id filter (D-15).
// Default filter: status=open (inbox model — see D-07a).
//
// D-07a INVARIANT — this file MUST NOT contain:
//   - Any useEffect/setInterval that mutates inquiry rows based on age
//   - Any cron-trigger endpoint called on page load
//   - Any staleness flag, dim treatment, or "N days idle" indicator
//   - Any auto-lost scheduler
// Open inquiries stay open indefinitely. Owner acts on them at their own pace.
//
// InquiryFlyout is stubbed (Plan 07 ships the real flyout).

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { PhoneIncoming } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import InquiryCard from '@/components/dashboard/InquiryCard';
import InquiryFilterBar from '@/components/dashboard/InquiryFilterBar';
import InquiryStatusPills from '@/components/dashboard/InquiryStatusPills';
import { EmptyStateInquiries } from '@/components/dashboard/EmptyStateInquiries';
import { ErrorState } from '@/components/ui/error-state';
import InquiryFlyout from '@/components/dashboard/InquiryFlyout';
import { supabase } from '@/lib/supabase-browser';
import { card } from '@/lib/design-tokens';

// ─── Realtime animation keyframe ──────────────────────────────────────────────

const SLIDE_IN_STYLE_ID = 'inquiry-slide-in-keyframe';

function ensureSlideInKeyframe() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(SLIDE_IN_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = SLIDE_IN_STYLE_ID;
  style.textContent = `
    @keyframes inquiry-slide-in {
      from { opacity: 0; transform: translateY(-8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .animate-inquiry-slide-in {
      animation: inquiry-slide-in 200ms ease-out;
    }
  `;
  document.head.appendChild(style);
}

// ─── Filter helpers ───────────────────────────────────────────────────────────

const DEFAULT_FILTERS = {
  status: 'open', // Default filter: Open (inbox model — D-07a)
  urgency: '',
  dateFrom: '',
  dateTo: '',
  search: '',
  jobType: '',
};

function buildQueryString(filters) {
  const params = new URLSearchParams();
  if (filters.urgency) params.set('urgency', filters.urgency);
  if (filters.dateFrom) params.set('date_from', filters.dateFrom);
  if (filters.dateTo) params.set('date_to', filters.dateTo);
  if (filters.search) params.set('search', filters.search);
  if (filters.jobType) params.set('job_type', filters.jobType);
  return params.toString();
}

const INQUIRY_STATUSES = ['open', 'converted', 'lost'];

function hasNonStatusFilters(filters) {
  return !!(filters.urgency || filters.dateFrom || filters.dateTo || filters.search || filters.jobType);
}

function hasActiveFilters(filters) {
  return Object.values(filters).some(Boolean);
}

// ─── Inquiries page ───────────────────────────────────────────────────────────

export default function InquiriesPage() {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Flyout state — Plan 07: InquiryFlyout wired (replaces Plan 06 console.debug stub)
  const [selectedInquiryId, setSelectedInquiryId] = useState(null);
  const [flyoutOpen, setFlyoutOpen] = useState(false);

  // Tenant ID for Realtime filter
  const [tenantId, setTenantId] = useState(null);

  const searchParams = useSearchParams();
  const router = useRouter();

  const [filters, setFilters] = useState(() => ({
    status: searchParams.get('status') || 'open',
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
    const qs = params.toString();
    router.replace(`/dashboard/inquiries${qs ? `?${qs}` : ''}`, { scroll: false });
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Inject Realtime animation keyframe once ─────────────────────────────
  useEffect(() => { ensureSlideInKeyframe(); }, []);

  // ── Get tenant ID for Realtime subscription ─────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setTenantId(null); return; }
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

  // ── Fetch inquiries from /api/inquiries ───────────────────────────────────

  const fetchInquiries = useCallback(async (activeFilters) => {
    setLoading(true);
    setError(null);
    try {
      const qs = buildQueryString(activeFilters);
      const res = await fetch(`/api/inquiries${qs ? `?${qs}` : ''}`);
      if (!res.ok) throw new Error('Failed to load inquiries');
      const data = await res.json();
      const URGENCY_WEIGHT = { emergency: 3, urgent: 2, routine: 1 };
      const sorted = (data.inquiries || []).sort((a, b) => {
        const wa = URGENCY_WEIGHT[a.urgency] || 0;
        const wb = URGENCY_WEIGHT[b.urgency] || 0;
        if (wa !== wb) return wb - wa;
        return new Date(b.created_at) - new Date(a.created_at);
      });
      setInquiries(sorted);
    } catch {
      setError("We couldn't load your inquiries. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const serverQueryKey = useMemo(
    () => buildQueryString(filters),
    [filters.urgency, filters.dateFrom, filters.dateTo, filters.search, filters.jobType] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    fetchInquiries(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverQueryKey, fetchInquiries]);

  // ── Supabase Realtime subscription — subscribed to `inquiries` table (D-15) ──
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel('inquiries-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'inquiries',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          const newInquiry = { ...payload.new, _isNew: true };
          const f = filtersRef.current;
          const matchesServerFilters = (
            (!f.urgency || f.urgency === newInquiry.urgency) &&
            (!f.jobType || f.jobType === newInquiry.job_type) &&
            (!f.search || (newInquiry.caller_name || '').toLowerCase().includes(f.search.toLowerCase()))
          );
          if (matchesServerFilters) {
            setInquiries((prev) => [newInquiry, ...prev]);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'inquiries',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          setInquiries((prev) =>
            prev.map((inq) =>
              inq.id === payload.new.id ? { ...payload.new, _isNew: false } : inq
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId]);

  // ── Client-side status filtering + counts ─────────────────────────────────
  const statusCounts = useMemo(() => {
    const counts = INQUIRY_STATUSES.reduce((acc, s) => ({ ...acc, [s]: 0 }), {});
    for (const inq of inquiries) {
      if (counts[inq.status] !== undefined) counts[inq.status] += 1;
    }
    return counts;
  }, [inquiries]);

  const displayedInquiries = useMemo(
    () => (filters.status ? inquiries.filter((inq) => inq.status === filters.status) : inquiries),
    [inquiries, filters.status]
  );

  // ── Event handlers ──────────────────────────────────────────────────────

  function handleFilterChange(partial) {
    setFilters((prev) => ({ ...prev, ...partial }));
  }

  function handleClearFilters() {
    setFilters(DEFAULT_FILTERS);
  }

  // Plan 07: InquiryFlyout wired — replaces Plan 06 stub
  function handleView(inquiryId) {
    setSelectedInquiryId(inquiryId);
    setFlyoutOpen(true);
  }

  function handleStatusChange(updatedInquiry) {
    setInquiries((prev) =>
      prev.map((inq) => inq.id === updatedInquiry.id ? { ...inq, ...updatedInquiry } : inq)
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
      <div className={`${card.base} p-0`} data-page="inquiries-page">
        <div className="p-6">
          <InquiryFilterBar
            filters={filters}
            onFilterChange={handleFilterChange}
            onClear={handleClearFilters}
          />
          <ErrorState message={error} onRetry={() => fetchInquiries(filters)} />
        </div>
      </div>
    );
  }

  // ── Page header ─────────────────────────────────────────────────────────

  const pageHeader = (
    <div className="flex items-center justify-between px-6 pt-6 pb-4">
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center size-8 rounded-lg bg-muted">
          <PhoneIncoming className="size-4 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-semibold text-foreground">Inquiries</h1>
        {!loading && (
          <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-2.5 py-0.5 text-xs font-medium">
            {inquiries.length}
          </span>
        )}
      </div>
    </div>
  );

  // ── Inquiry list content ────────────────────────────────────────────────

  const isFiltered = hasNonStatusFilters(filters);

  let mainContent;
  if (loading) {
    mainContent = skeletonCards;
  } else if (displayedInquiries.length === 0 && !hasActiveFilters(filters)) {
    mainContent = <EmptyStateInquiries />;
  } else if (displayedInquiries.length === 0 && isFiltered) {
    mainContent = (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-muted-foreground mb-2">No inquiries match these filters.</p>
        <button
          type="button"
          onClick={handleClearFilters}
          className="text-sm text-[var(--brand-accent)] hover:text-[var(--brand-accent-hover)] font-medium"
        >
          Clear filters
        </button>
      </div>
    );
  } else if (displayedInquiries.length === 0 && filters.status) {
    // Status pill active but no results
    mainContent = (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-muted-foreground">
          No {filters.status} inquiries right now.
        </p>
      </div>
    );
  } else {
    mainContent = (
      <div className="space-y-3">
        {displayedInquiries.map((inquiry) => (
          <div
            key={inquiry.id}
            className={inquiry._isNew ? 'animate-inquiry-slide-in' : ''}
          >
            <InquiryCard
              inquiry={inquiry}
              onView={handleView}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className={`${card.base} p-0`} data-page="inquiries-page">
        {pageHeader}

        <InquiryStatusPills
          counts={statusCounts}
          activeStatus={filters.status}
          onStatusChange={(status) => handleFilterChange({ status })}
        />

        <InquiryFilterBar
          filters={filters}
          onFilterChange={handleFilterChange}
          onClear={handleClearFilters}
        />

        <div className="px-6 py-4">
          {mainContent}
        </div>
      </div>

      {/* Plan 07: InquiryFlyout — D-10 offline convert + Mark as Lost */}
      <InquiryFlyout
        inquiryId={selectedInquiryId}
        open={flyoutOpen}
        onOpenChange={setFlyoutOpen}
        onStatusChange={handleStatusChange}
      />
    </>
  );
}

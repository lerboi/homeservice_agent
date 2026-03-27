'use client';

import { useState, useEffect, useCallback } from 'react';
import { LayoutList, Columns3 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import LeadCard from '@/components/dashboard/LeadCard';
import LeadFilterBar from '@/components/dashboard/LeadFilterBar';
import LeadFlyout from '@/components/dashboard/LeadFlyout';
import KanbanBoard from '@/components/dashboard/KanbanBoard';
import { EmptyStateLeads } from '@/components/dashboard/EmptyStateLeads';
import { supabase } from '@/lib/supabase-browser';
import { card } from '@/lib/design-tokens';

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

function buildQueryString(filters) {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.urgency) params.set('urgency', filters.urgency);
  if (filters.dateFrom) params.set('date_from', filters.dateFrom);
  if (filters.dateTo) params.set('date_to', filters.dateTo);
  if (filters.search) params.set('search', filters.search);
  if (filters.jobType) params.set('job_type', filters.jobType);
  return params.toString();
}

function hasActiveFilters(filters) {
  return Object.values(filters).some(Boolean);
}

// ─── Leads page ───────────────────────────────────────────────────────────────

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [viewMode, setViewMode] = useState('list');

  // Flyout state
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [flyoutOpen, setFlyoutOpen] = useState(false);

  // Tenant ID for Realtime filter
  const [tenantId, setTenantId] = useState(null);

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
      setLeads(data.leads || []);
    } catch {
      setError("Couldn't load leads. Check your connection and refresh the page.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads(filters);
  }, [filters, fetchLeads]);

  // ── Supabase Realtime subscription ─────────────────────────────────────

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
          // Only animate Realtime inserts, not initial page load
          setLeads((prev) => [{ ...payload.new, _isNew: true }, ...prev]);
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

  // ── Error state ─────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className={`${card.base} p-0`} data-tour="leads-page">
        <div className="p-6">
          <LeadFilterBar
            filters={filters}
            onFilterChange={handleFilterChange}
            onClear={handleClearFilters}
          />
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Page header ─────────────────────────────────────────────────────────

  const pageHeader = (
    <div className="flex items-center justify-between px-6 pt-6 pb-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-[#0F172A]">Leads</h1>
        {!loading && (
          <span className="inline-flex items-center rounded-full bg-stone-100 text-stone-600 px-2.5 py-0.5 text-xs font-medium">
            {leads.length}
          </span>
        )}
      </div>

      {/* View toggle */}
      <div className="flex items-center rounded-lg overflow-hidden border border-stone-200">
        <button
          type="button"
          onClick={() => setViewMode('list')}
          className={`flex items-center justify-center h-8 w-9 transition-colors ${
            viewMode === 'list'
              ? 'bg-[#0F172A] text-white'
              : 'bg-white text-stone-500 hover:bg-stone-50'
          }`}
          aria-label="List view"
          aria-pressed={viewMode === 'list'}
        >
          <LayoutList className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setViewMode('kanban')}
          className={`flex items-center justify-center h-8 w-9 transition-colors border-l border-stone-200 ${
            viewMode === 'kanban'
              ? 'bg-[#0F172A] text-white'
              : 'bg-white text-stone-500 hover:bg-stone-50'
          }`}
          aria-label="Kanban view"
          aria-pressed={viewMode === 'kanban'}
        >
          <Columns3 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  // ── Lead list / kanban content ──────────────────────────────────────────

  const isFiltered = hasActiveFilters(filters);

  let mainContent;
  if (loading) {
    mainContent = skeletonCards;
  } else if (viewMode === 'kanban') {
    mainContent = (
      <KanbanBoard
        leads={leads}
        onViewLead={handleView}
      />
    );
  } else if (leads.length === 0 && !isFiltered) {
    mainContent = <EmptyStateLeads />;
  } else if (leads.length === 0 && isFiltered) {
    mainContent = (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-[#475569] mb-2">No leads match your filters.</p>
        <button
          type="button"
          onClick={handleClearFilters}
          className="text-sm text-[#C2410C] hover:text-[#9A3412] font-medium"
        >
          Clear filters
        </button>
      </div>
    );
  } else {
    mainContent = (
      <div className="space-y-3">
        {leads.map((lead) => (
          <div
            key={lead.id}
            className={lead._isNew ? 'animate-slide-in-from-top' : ''}
          >
            <LeadCard
              lead={lead}
              onView={handleView}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className={`${card.base} p-0`} data-tour="leads-page">
        {pageHeader}

        <LeadFilterBar
          filters={filters}
          onFilterChange={handleFilterChange}
          onClear={handleClearFilters}
        />

        <div className="px-6 py-4">
          {mainContent}
        </div>
      </div>

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

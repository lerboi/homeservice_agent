'use client';

import { useState, useEffect, useCallback } from 'react';
import { LayoutList, Columns3 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import LeadCard from '@/components/dashboard/LeadCard';
import LeadFilterBar from '@/components/dashboard/LeadFilterBar';

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

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [viewMode, setViewMode] = useState('list');
  const [selectedLeadId, setSelectedLeadId] = useState(null);

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

  function handleFilterChange(partial) {
    setFilters((prev) => ({ ...prev, ...partial }));
  }

  function handleClearFilters() {
    setFilters(DEFAULT_FILTERS);
  }

  function handleView(leadId) {
    setSelectedLeadId(leadId);
    // LeadFlyout coming in Plan 05
  }

  // ─── Loading state ─────────────────────────────────────────────────────────

  const skeletonCards = (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-[72px] w-full rounded-xl" />
      ))}
    </div>
  );

  // ─── Error state ────────────────────────────────────────────────────────────

  if (error) {
    return (
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
    );
  }

  // ─── Page header ────────────────────────────────────────────────────────────

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

  // ─── Lead list ─────────────────────────────────────────────────────────────

  const isFiltered = hasActiveFilters(filters);

  let listContent;
  if (loading) {
    listContent = skeletonCards;
  } else if (leads.length === 0 && !isFiltered) {
    listContent = (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <h2 className="text-xl font-semibold text-[#0F172A] mb-2">No leads yet</h2>
        <p className="text-sm text-[#475569] max-w-sm">
          Your AI receptionist will capture leads here as calls come in. New leads appear within seconds of a call ending.
        </p>
      </div>
    );
  } else if (leads.length === 0 && isFiltered) {
    listContent = (
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
    listContent = (
      <div className="space-y-3">
        {leads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            onView={handleView}
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      {pageHeader}

      <LeadFilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        onClear={handleClearFilters}
      />

      <div className="px-6 py-4">
        {listContent}
      </div>
    </div>
  );
}

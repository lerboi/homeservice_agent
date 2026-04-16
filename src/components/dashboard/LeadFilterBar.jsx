'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, X, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

// Radix Select doesn't support empty string values — use sentinel "all" to mean "no filter"
const URGENCY_OPTIONS = [
  { value: 'all', label: 'All Urgencies' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'routine', label: 'Routine' },
  { value: 'urgent', label: 'Urgent' },
];

// Status is handled by the LeadStatusPills strip above the filter bar — it has
// its own visual representation, so it is intentionally absent from this bar
// (and from the active-filter pills row below).
const PILL_LABELS = {
  urgency: (v) => `Urgency: ${URGENCY_OPTIONS.find((o) => o.value === v)?.label || v}`,
  jobType: (v) => `Job: ${v}`,
  dateFrom: (v) => `From: ${v}`,
  dateTo: (v) => `To: ${v}`,
  search: (v) => `"${v}"`,
};

export default function LeadFilterBar({ filters, onFilterChange, onClear }) {
  const searchTimerRef = useRef(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  function handleSearchChange(e) {
    const value = e.target.value;
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      onFilterChange({ search: value });
    }, 300);
  }

  useEffect(() => {
    return () => clearTimeout(searchTimerRef.current);
  }, []);

  function handleUrgencyChange(value) {
    onFilterChange({ urgency: value === 'all' ? '' : value });
  }

  // Determine active filters for pills — status deliberately excluded (pills strip).
  const activePills = [];
  if (filters.urgency) activePills.push({ key: 'urgency', label: PILL_LABELS.urgency(filters.urgency) });
  if (filters.jobType) activePills.push({ key: 'jobType', label: PILL_LABELS.jobType(filters.jobType) });
  if (filters.dateFrom) activePills.push({ key: 'dateFrom', label: PILL_LABELS.dateFrom(filters.dateFrom) });
  if (filters.dateTo) activePills.push({ key: 'dateTo', label: PILL_LABELS.dateTo(filters.dateTo) });
  if (filters.search) activePills.push({ key: 'search', label: PILL_LABELS.search(filters.search) });

  const hasActiveFilters = activePills.length > 0;

  // Count filters that live inside the mobile sheet (search stays visible on
  // mobile, so it isn't counted on the Filters-button badge).
  const sheetFilterCount =
    (filters.urgency ? 1 : 0) +
    (filters.jobType ? 1 : 0) +
    (filters.dateFrom ? 1 : 0) +
    (filters.dateTo ? 1 : 0);

  function removePill(key) {
    onFilterChange({ [key]: '' });
  }

  // ─── Filter control renderers (reused inline on desktop + inside sheet on mobile) ───

  const urgencySelect = (
    <Select value={filters.urgency || 'all'} onValueChange={handleUrgencyChange}>
      <SelectTrigger className="h-9 text-sm border-border bg-muted" aria-label="Filter by urgency">
        <SelectValue placeholder="All Urgencies" />
      </SelectTrigger>
      <SelectContent>
        {URGENCY_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const jobTypeInput = (
    <Input
      type="text"
      placeholder="Job type..."
      value={filters.jobType || ''}
      onChange={(e) => onFilterChange({ jobType: e.target.value })}
      className="h-9 text-sm border-border bg-muted focus:bg-card"
      aria-label="Filter by job type"
    />
  );

  const dateRange = (
    <div className="flex items-center gap-1.5">
      <input
        type="date"
        value={filters.dateFrom || ''}
        onChange={(e) => onFilterChange({ dateFrom: e.target.value })}
        className="h-9 px-2 text-sm border border-border rounded-md bg-muted focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] focus:ring-offset-1 flex-1 min-w-0"
        aria-label="Filter from date"
      />
      <span className="text-xs text-muted-foreground shrink-0">to</span>
      <input
        type="date"
        value={filters.dateTo || ''}
        onChange={(e) => onFilterChange({ dateTo: e.target.value })}
        className="h-9 px-2 text-sm border border-border rounded-md bg-muted focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] focus:ring-offset-1 flex-1 min-w-0"
        aria-label="Filter to date"
      />
    </div>
  );

  return (
    <div className="bg-card border-b border-border px-4 py-3 sticky top-14 z-10">
      {/* Primary row */}
      <div className="flex items-center gap-3">
        {/* Search — always visible */}
        <div className="relative flex-1 min-w-0 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="Search name or phone..."
            defaultValue={filters.search}
            onChange={handleSearchChange}
            className="pl-9 h-9 text-sm border-border bg-muted focus:bg-card"
            aria-label="Search jobs"
          />
        </div>

        {/* Desktop: inline filter controls */}
        <div className="hidden sm:flex items-center gap-3 flex-wrap">
          <div className="w-36">{urgencySelect}</div>
          <div className="w-32">{jobTypeInput}</div>
          {dateRange}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onClear}
              className="text-sm text-[var(--brand-accent)] hover:text-[var(--brand-accent-hover)] font-medium shrink-0"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Mobile: filters button + bottom sheet */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className="sm:hidden inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-muted text-sm text-foreground font-medium shrink-0 hover:bg-card transition-colors"
              aria-label="Open filters"
            >
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              Filters
              {sheetFilterCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-[var(--brand-accent)] text-[var(--brand-accent-fg)] text-[11px] font-semibold px-1 leading-none">
                  {sheetFilterCount}
                </span>
              )}
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl pb-6">
            <SheetHeader>
              <SheetTitle>Filter jobs</SheetTitle>
            </SheetHeader>
            <div className="px-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Urgency</label>
                {urgencySelect}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Job type</label>
                {jobTypeInput}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Date range</label>
                {dateRange}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 px-6 pt-2">
              <button
                type="button"
                onClick={() => { onClear(); setSheetOpen(false); }}
                disabled={!hasActiveFilters}
                className="text-sm text-[var(--brand-accent)] hover:text-[var(--brand-accent-hover)] font-medium disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Clear all
              </button>
              <SheetClose asChild>
                <button
                  type="button"
                  className="bg-foreground hover:bg-foreground/90 text-background h-10 px-5 rounded-lg text-sm font-medium transition-colors"
                >
                  Done
                </button>
              </SheetClose>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Active filter pills (both layouts) */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap mt-2">
          {activePills.map((pill) => (
            <span
              key={pill.key}
              className="inline-flex items-center h-7 gap-1.5 bg-muted text-muted-foreground rounded-full px-3 text-xs"
            >
              {pill.label}
              <button
                type="button"
                onClick={() => removePill(pill.key)}
                className="text-muted-foreground hover:text-foreground ml-0.5"
                aria-label={`Remove ${pill.key} filter`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

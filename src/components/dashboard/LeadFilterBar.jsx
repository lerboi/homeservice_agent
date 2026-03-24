'use client';

import { useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Radix Select doesn't support empty string values — use sentinel "all" to mean "no filter"
const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'new', label: 'New' },
  { value: 'booked', label: 'Booked' },
  { value: 'completed', label: 'Completed' },
  { value: 'paid', label: 'Paid' },
  { value: 'lost', label: 'Lost' },
];

const URGENCY_OPTIONS = [
  { value: 'all', label: 'All Urgencies' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'routine', label: 'Routine' },
  { value: 'high_ticket', label: 'High Ticket' },
];

const PILL_LABELS = {
  status: (v) => `Status: ${STATUS_OPTIONS.find((o) => o.value === v)?.label || v}`,
  urgency: (v) => `Urgency: ${URGENCY_OPTIONS.find((o) => o.value === v)?.label || v}`,
  jobType: (v) => `Job: ${v}`,
  dateFrom: (v) => `From: ${v}`,
  dateTo: (v) => `To: ${v}`,
  search: (v) => `"${v}"`,
};

export default function LeadFilterBar({ filters, onFilterChange, onClear }) {
  const searchTimerRef = useRef(null);

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

  function handleStatusChange(value) {
    // "all" sentinel means clear the filter
    onFilterChange({ status: value === 'all' ? '' : value });
  }

  function handleUrgencyChange(value) {
    onFilterChange({ urgency: value === 'all' ? '' : value });
  }

  // Determine active filters for pills
  const activePills = [];
  if (filters.status) activePills.push({ key: 'status', label: PILL_LABELS.status(filters.status) });
  if (filters.urgency) activePills.push({ key: 'urgency', label: PILL_LABELS.urgency(filters.urgency) });
  if (filters.jobType) activePills.push({ key: 'jobType', label: PILL_LABELS.jobType(filters.jobType) });
  if (filters.dateFrom) activePills.push({ key: 'dateFrom', label: PILL_LABELS.dateFrom(filters.dateFrom) });
  if (filters.dateTo) activePills.push({ key: 'dateTo', label: PILL_LABELS.dateTo(filters.dateTo) });
  if (filters.search) activePills.push({ key: 'search', label: PILL_LABELS.search(filters.search) });

  const hasActiveFilters = activePills.length > 0;

  function removePill(key) {
    onFilterChange({ [key]: '' });
  }

  return (
    <div className="bg-white border-b border-stone-200/60 px-4 py-3 sticky top-14 z-10">
      {/* Filter controls row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 pointer-events-none" />
          <Input
            type="text"
            placeholder="Search name or phone..."
            defaultValue={filters.search}
            onChange={handleSearchChange}
            className="pl-9 h-9 text-sm border-stone-200 bg-stone-50 focus:bg-white"
            aria-label="Search leads"
          />
        </div>

        {/* Status select */}
        <Select
          value={filters.status || 'all'}
          onValueChange={handleStatusChange}
        >
          <SelectTrigger className="h-9 w-36 text-sm border-stone-200 bg-stone-50" aria-label="Filter by status">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Urgency select */}
        <Select
          value={filters.urgency || 'all'}
          onValueChange={handleUrgencyChange}
        >
          <SelectTrigger className="h-9 w-36 text-sm border-stone-200 bg-stone-50" aria-label="Filter by urgency">
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

        {/* Job type (free-form) */}
        <Input
          type="text"
          placeholder="Job type..."
          value={filters.jobType || ''}
          onChange={(e) => onFilterChange({ jobType: e.target.value })}
          className="h-9 w-32 text-sm border-stone-200 bg-stone-50 focus:bg-white"
          aria-label="Filter by job type"
        />

        {/* Date range */}
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={filters.dateFrom || ''}
            onChange={(e) => onFilterChange({ dateFrom: e.target.value })}
            className="h-9 px-2 text-sm border border-stone-200 rounded-md bg-stone-50 focus:outline-none focus:ring-2 focus:ring-[#C2410C] focus:ring-offset-1"
            aria-label="Filter from date"
          />
          <span className="text-xs text-stone-400">to</span>
          <input
            type="date"
            value={filters.dateTo || ''}
            onChange={(e) => onFilterChange({ dateTo: e.target.value })}
            className="h-9 px-2 text-sm border border-stone-200 rounded-md bg-stone-50 focus:outline-none focus:ring-2 focus:ring-[#C2410C] focus:ring-offset-1"
            aria-label="Filter to date"
          />
        </div>

        {/* Clear all */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClear}
            className="text-sm text-[#C2410C] hover:text-[#9A3412] font-medium shrink-0"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Active filter pills */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap mt-2">
          {activePills.map((pill) => (
            <span
              key={pill.key}
              className="inline-flex items-center h-[36px] gap-1.5 bg-stone-100 text-stone-700 rounded-full px-3 text-sm"
            >
              {pill.label}
              <button
                type="button"
                onClick={() => removePill(pill.key)}
                className="text-stone-500 hover:text-stone-800 ml-0.5"
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

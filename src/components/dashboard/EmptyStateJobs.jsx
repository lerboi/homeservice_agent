// Phase 59 Plan 06: EmptyStateJobs — clone of EmptyStateLeads for new jobs model.
// Uses UI-SPEC §Empty states copy verbatim.

import { Wrench, SearchX } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

// Default (no jobs at all)
export function EmptyStateJobs() {
  return (
    <EmptyState
      icon={Wrench}
      headline="No jobs yet"
      description="When Voco books an appointment, it shows up here. Check call history to see recent inquiries."
      ctaLabel="View call history"
      ctaHref="/dashboard/calls"
    />
  );
}

// Filter-zero variant (filter active but no results)
export function EmptyStateJobsFiltered({ onClear }) {
  return (
    <EmptyState
      icon={SearchX}
      headline="No jobs match these filters"
      description="Try clearing a filter or widening the date range."
      ctaLabel="Clear filters"
      ctaOnClick={onClear}
    />
  );
}

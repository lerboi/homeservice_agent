'use client';

// Phase 59 Plan 07 — D-17 Customer Jobs tab list
// Renders jobs for a specific customer using JobCard.
// Empty state per UI-SPEC: "No jobs for this customer"
// Loaded via /api/jobs?customer_id=<id>

import { Wrench, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import JobCard from '@/components/dashboard/JobCard';

// ─── Loading skeleton ─────────────────────────────────────────────────────────

export function CustomerJobsListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-[72px] w-full rounded-xl" />
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * CustomerJobsList — jobs tab for customer detail page.
 * Accepts jobs array directly (fetched + Realtime-updated in parent page).
 *
 * @param {{ jobs: Array|null, loading: boolean, onView: function }} props
 */
export default function CustomerJobsList({ jobs, loading, onView }) {
  const router = useRouter();

  if (loading) {
    return <CustomerJobsListSkeleton />;
  }

  if (!jobs || jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <div className="rounded-full bg-muted p-3">
          <Wrench className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">No jobs for this customer</p>
          <p className="text-sm text-muted-foreground mt-1">
            Once this customer books a service, their jobs show up here.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push('/dashboard/calls')}
          className="text-sm text-[var(--brand-accent)] hover:text-[var(--brand-accent-hover)] font-medium transition-colors"
        >
          View call history
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {jobs.map((job) => (
        <JobCard
          key={job.id}
          job={job}
          onView={() => onView?.(job.id)}
        />
      ))}
    </div>
  );
}

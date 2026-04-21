'use client';

/**
 * HotJobsTile — medium tile in the DailyOpsHub bento grid.
 * Phase 59 Plan 06: clone of HotLeadsTile; query source shifts to jobs table
 * with urgency=emergency + status=scheduled (D-15).
 * This tile reads from /api/dashboard/stats which the dashboard stats route
 * will be updated to include hotJobsCount + hotJobsPreview (scheduled+emergency).
 * Until that backend update ships, falls back to newLeadsCount/newLeadsPreview
 * from the existing stats shape.
 */

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Flame, AlertTriangle } from 'lucide-react';
import { useSWRFetch } from '@/hooks/useSWRFetch';
import { card, btn, focus } from '@/lib/design-tokens';
import { Skeleton } from '@/components/ui/skeleton';

function relativeTime(iso) {
  if (!iso) return '';
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return '';
  }
}

export default function HotJobsTile() {
  const { data, error, isLoading } = useSWRFetch('/api/dashboard/stats');

  const cardClass = `${card.base} ${card.hover} p-6 w-full flex flex-col gap-4`;
  const titleClass = 'font-semibold text-base text-foreground leading-[1.4]';
  const ctaClass = `${btn.primary} ${focus.ring} inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-semibold min-h-[44px] md:min-h-0`;

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className={cardClass} aria-busy="true">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-muted-foreground" />
          <h2 className={titleClass}>Scheduled jobs</h2>
        </div>
        <Skeleton className="h-9 w-20" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className={cardClass}>
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-muted-foreground" />
          <h2 className={titleClass}>Scheduled jobs</h2>
        </div>
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-border bg-muted p-4"
        >
          <AlertTriangle className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div className="flex flex-col gap-1">
            <p className="font-semibold text-sm text-foreground leading-[1.4]">
              Couldn&apos;t load jobs.
            </p>
            <p className="font-normal text-sm text-muted-foreground leading-normal">
              Check your connection and try again.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Prefer new hotJobs shape; fall back to legacy newLeads shape during transition
  const count = data?.hotJobsCount ?? data?.newLeadsCount ?? 0;
  const preview = data?.hotJobsPreview ?? data?.newLeadsPreview ?? [];

  // ── Empty state — only when there are no scheduled emergency jobs at all ───
  if (preview.length === 0) {
    return (
      <div className={cardClass}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-muted-foreground" />
            <h2 className={titleClass}>Scheduled jobs</h2>
          </div>
          <Link href="/dashboard/jobs" className={ctaClass}>
            View all jobs
          </Link>
        </div>
        <div className="flex flex-col gap-2 py-2">
          <p className="font-semibold text-base text-foreground leading-[1.4]">
            No urgent jobs scheduled.
          </p>
          <p className="font-normal text-sm text-muted-foreground leading-normal">
            Emergency jobs that are scheduled will appear here. Check back
            after your next call.
          </p>
        </div>
      </div>
    );
  }

  // ── Default state — count in Display + up to 5 preview rows ──────────────
  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-muted-foreground" />
          <h2 className={titleClass}>Scheduled jobs</h2>
        </div>
        <Link href="/dashboard/jobs" className={ctaClass}>
          View all jobs
        </Link>
      </div>

      {count > 0 && (
        <p className="font-semibold text-2xl text-foreground leading-tight tabular-nums">
          {count.toLocaleString('en-US')}
          <span className="font-normal text-sm text-muted-foreground ml-2">
            {count === 1 ? 'scheduled job' : 'scheduled jobs'}
          </span>
        </p>
      )}

      <ul className="flex flex-col divide-y divide-border">
        {preview.slice(0, 5).map((job) => (
          <li
            key={job.id}
            className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
          >
            <div className="min-w-0 flex flex-col">
              <p className="font-normal text-sm text-foreground leading-normal truncate">
                {job.caller_name || job.customer?.name || job.from_number || 'Unknown caller'}
              </p>
              <p className="font-normal text-xs text-muted-foreground leading-[1.4]">
                {job.job_type || 'No job type'} &bull;{' '}
                {relativeTime(job.created_at)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

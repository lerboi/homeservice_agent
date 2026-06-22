'use client';

/**
 * HotJobsTile — medium "Needs follow-up" tile in the DailyOpsHub bento grid.
 *
 * Reads newLeadsCount/newLeadsPreview from GET /api/dashboard/stats, which
 * (post-Phase-59 repointing) counts OPEN INQUIRIES — callers waiting for a
 * callback. Since the Inquiries → Calls merge (2026-06-10) that work queue
 * lives inside the Calls tab as the "Callbacks" view, so the CTA points
 * at /dashboard/calls?view=callbacks. (Originally planned as a
 * scheduled-emergency-jobs tile; the hotJobsCount/hotJobsPreview backend
 * fields never shipped.)
 */

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { PhoneIncoming, AlertTriangle } from 'lucide-react';
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
          <PhoneIncoming className="h-5 w-5 text-[var(--accent-violet)]" />
          <h2 className={titleClass}>Needs follow-up</h2>
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
          <PhoneIncoming className="h-5 w-5 text-[var(--accent-violet)]" />
          <h2 className={titleClass}>Needs follow-up</h2>
        </div>
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-border bg-muted p-4"
        >
          <AlertTriangle className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div className="flex flex-col gap-1">
            <p className="font-semibold text-sm text-foreground leading-[1.4]">
              Couldn&apos;t load callbacks.
            </p>
            <p className="font-normal text-sm text-muted-foreground leading-normal">
              Check your connection and try again.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Stats "new" fields = open inquiries (Phase 59 repointing of /api/dashboard/stats)
  const count = data?.newLeadsCount ?? 0;
  const preview = data?.newLeadsPreview ?? [];

  // ── Empty state — no open inquiries waiting for a callback ────────────────
  if (preview.length === 0) {
    return (
      <div className={cardClass}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <PhoneIncoming className="h-5 w-5 text-[var(--accent-violet)]" />
            <h2 className={titleClass}>Needs follow-up</h2>
          </div>
          <Link href="/dashboard/calls?view=callbacks" className={ctaClass}>
            View callbacks
          </Link>
        </div>
        <div className="flex flex-col gap-2 py-2">
          <p className="font-semibold text-base text-foreground leading-[1.4]">
            No callers waiting for a callback.
          </p>
          <p className="font-normal text-sm text-muted-foreground leading-normal">
            When a caller needs a callback, they&apos;ll appear here. Check
            back after your next call.
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
          <PhoneIncoming className="h-5 w-5 text-[var(--accent-violet)]" />
          <h2 className={titleClass}>Needs follow-up</h2>
        </div>
        <Link href="/dashboard/calls?view=callbacks" className={ctaClass}>
          View callbacks
        </Link>
      </div>

      {count > 0 && (
        <p className="font-semibold text-2xl text-foreground leading-tight tabular-nums">
          {count.toLocaleString('en-US')}
          <span className="font-normal text-sm text-muted-foreground ml-2">
            {count === 1 ? 'caller waiting for a callback' : 'callers waiting for a callback'}
          </span>
        </p>
      )}

      <ul className="flex flex-col divide-y divide-border">
        {preview.slice(0, 5).map((inquiry) => (
          <li
            key={inquiry.id}
            className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
          >
            <div className="min-w-0 flex flex-col">
              <p className="font-normal text-sm text-foreground leading-normal truncate">
                {inquiry.caller_name || inquiry.customer?.name || inquiry.from_number || 'Unknown caller'}
              </p>
              <p className="font-normal text-xs text-muted-foreground leading-[1.4]">
                {inquiry.job_type || 'No job type'} &bull;{' '}
                {relativeTime(inquiry.created_at)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

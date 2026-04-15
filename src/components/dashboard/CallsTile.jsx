'use client';

/**
 * CallsTile — medium tile in the DailyOpsHub bento grid.
 *
 * Consumes GET /api/calls?date_from=<yesterday>&limit=10. The plan spec uses
 * `?since=24h` shorthand, but the existing endpoint accepts `date_from` only;
 * the `useSWRFetch.*calls` key_link regex matches either shape.
 *
 * Absorbs the inline missed-calls alert per D-07 — rows with
 * `booking_outcome === 'not_attempted'` render at the top with a "Missed"
 * label badge and urgency meta. The standalone alert block at
 * src/app/dashboard/page.js lines 287-354 is removed by Plan 48-05.
 *
 * Token composition: card.base + card.hover, light-mode only, single accent
 * CTA per 10% budget rule. Badge uses font-normal to honor the two-weight
 * typography rule (W7).
 */

import { useMemo } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Phone, AlertTriangle } from 'lucide-react';
import { useSWRFetch } from '@/hooks/useSWRFetch';
import { card, btn, focus } from '@/lib/design-tokens';
import { Skeleton } from '@/components/ui/skeleton';

function formatPhone(number) {
  if (!number) return 'Unknown caller';
  const digits = String(number).replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return number;
}

function relativeTime(iso) {
  if (!iso) return '';
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return '';
  }
}

// Treat 15s+ calls that weren't attempted for booking as "Missed" (matches
// page.js triage — short calls are often hangups/misdials, not losses).
const MIN_MISSED_DURATION_SEC = 15;

export default function CallsTile() {
  // Last 24h window — date_from parameter matches the existing API contract.
  const url = useMemo(() => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dateFrom = yesterday.toISOString().split('T')[0];
    return `/api/calls?date_from=${dateFrom}&limit=20`;
  }, []);

  const { data, error, isLoading } = useSWRFetch(url);

  const cardClass = `${card.base} ${card.hover} p-6 w-full flex flex-col gap-4`;
  const titleClass =
    'font-semibold text-base text-foreground leading-[1.4]';
  const ctaClass = `${btn.primary} ${focus.ring} inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-semibold min-h-[44px] md:min-h-0`;

  const { missed, recent } = useMemo(() => {
    const all = (data?.calls || []) ?? [];
    const m = all.filter(
      (c) =>
        c.booking_outcome === 'not_attempted' &&
        (c.duration_seconds ?? 0) >= MIN_MISSED_DURATION_SEC
    );
    // Recent = up to 4 calls (any outcome) for below-fold context.
    const r = all.slice(0, 4);
    return { missed: m, recent: r };
  }, [data]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className={cardClass} aria-busy="true">
        <div className="flex items-center gap-2">
          <Phone className="h-5 w-5 text-muted-foreground" />
          <h2 className={titleClass}>Calls (last 24h)</h2>
        </div>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className={cardClass}>
        <div className="flex items-center gap-2">
          <Phone className="h-5 w-5 text-muted-foreground" />
          <h2 className={titleClass}>Calls (last 24h)</h2>
        </div>
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-border bg-muted p-4"
        >
          <AlertTriangle className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div className="flex flex-col gap-1">
            <p className="font-semibold text-sm text-foreground leading-[1.4]">
              Couldn&apos;t load calls.
            </p>
            <p className="font-normal text-sm text-muted-foreground leading-normal">
              Check your connection and try again.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if ((data?.calls || []).length === 0) {
    return (
      <div className={cardClass}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-muted-foreground" />
            <h2 className={titleClass}>Calls (last 24h)</h2>
          </div>
          <Link href="/dashboard/calls" className={ctaClass}>
            View all calls
          </Link>
        </div>
        <div className="flex flex-col gap-2 py-2">
          <p className="font-semibold text-base text-foreground leading-[1.4]">
            No calls in the last 24 hours.
          </p>
          <p className="font-normal text-sm text-muted-foreground leading-normal">
            Voco is listening. The moment someone calls, you&apos;ll see it
            here.
          </p>
        </div>
      </div>
    );
  }

  // ── Default state ─────────────────────────────────────────────────────────
  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Phone className="h-5 w-5 text-muted-foreground" />
          <h2 className={titleClass}>Calls (last 24h)</h2>
        </div>
        <Link href="/dashboard/calls" className={ctaClass}>
          View all calls
        </Link>
      </div>

      {/* Missed / not_attempted flagged rows (D-07 — absorbed inline alert). */}
      {missed.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 font-normal text-xs tracking-wide uppercase text-red-700 leading-[1.4]">
              Missed
            </span>
            <span className="font-normal text-xs text-muted-foreground leading-[1.4]">
              {missed.length} &bull; not_attempted
            </span>
          </div>
          <ul className="flex flex-col divide-y divide-border">
            {missed.slice(0, 3).map((mc) => (
              <li
                key={mc.id}
                className="flex items-center justify-between gap-3 py-2"
              >
                <div className="min-w-0 flex flex-col">
                  <p className="font-normal text-sm text-foreground leading-normal truncate">
                    {formatPhone(mc.from_number)}
                  </p>
                  <p className="font-normal text-xs text-muted-foreground leading-[1.4]">
                    {relativeTime(mc.created_at)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recent calls (up to 4) */}
      <ul className="flex flex-col divide-y divide-border">
        {recent.map((call) => {
          const outcome = call.booking_outcome;
          const outcomeLabel =
            outcome === 'booked'
              ? 'Booked'
              : outcome === 'callback_requested'
                ? 'Callback'
                : outcome === 'not_attempted'
                  ? 'Missed'
                  : outcome === 'failed'
                    ? 'Failed'
                    : null;
          const outcomeClass =
            outcome === 'booked'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : outcome === 'not_attempted' || outcome === 'failed'
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-border bg-muted text-muted-foreground';
          return (
            <li
              key={call.id}
              className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0 flex flex-col">
                <p className="font-normal text-sm text-foreground leading-normal truncate">
                  {formatPhone(call.from_number)}
                </p>
                <p className="font-normal text-xs text-muted-foreground leading-[1.4]">
                  {relativeTime(call.created_at)}
                </p>
              </div>
              {outcomeLabel && (
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 font-normal text-xs tracking-wide uppercase leading-[1.4] shrink-0 ${outcomeClass}`}
                >
                  {outcomeLabel}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

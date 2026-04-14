'use client';

/**
 * UsageTile — full-width tile in the DailyOpsHub bento grid.
 *
 * Consumes GET /api/usage → { callsUsed, callsIncluded, cycleDaysLeft, overageDollars }.
 *
 * Visual contract (D-13 / UI-SPEC):
 *   - percent < 75   → copper   (bg-[#C2410C])
 *   - 75 <= percent < 100 → amber-600
 *   - percent >= 100 → red-700
 *
 * Token composition: card.base + card.hover only (no raw surface classes, light-mode only — Phase 49 owns the theme migration).
 */

import Link from 'next/link';
import { useSWRFetch } from '@/hooks/useSWRFetch';
import { card, btn, focus } from '@/lib/design-tokens';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle } from 'lucide-react';

/**
 * Pure helper — derive Tailwind classes from usage percent.
 *
 * Mirrored in ./usage-threshold.js for unit-test consumption (Jest is not
 * configured with @babel/preset-react, so tests cannot import from a .jsx
 * file). Keep the two copies identical; any change here must also update
 * ./usage-threshold.js.
 *
 * @param {number} percent — 0..Infinity (not clamped)
 * @returns {{ fill: string, tone: string }}
 */
export function usageThresholdClass(percent) {
  if (percent >= 100) return { fill: 'bg-red-700', tone: 'text-red-700' };
  if (percent >= 75) return { fill: 'bg-amber-600', tone: 'text-amber-700' };
  return { fill: 'bg-[#C2410C]', tone: 'text-stone-600' };
}

function formatCycleStartHint(daysLeft) {
  // Empty-state helper: approximate cycle start date (best-effort display).
  // Real cycle start could be derived server-side in a follow-up; for now we
  // show only what the API guarantees (daysLeft) plus a soft sentence.
  if (typeof daysLeft !== 'number') return '';
  return `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left in this cycle.`;
}

export default function UsageTile() {
  const { data, error, isLoading } = useSWRFetch('/api/usage');

  const cardClass = `${card.base} ${card.hover} p-6 w-full flex flex-col gap-4`;
  const titleClass =
    'font-semibold text-base text-[#0F172A] leading-[1.4]';

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className={cardClass} aria-busy="true">
        <div className="flex items-center justify-between">
          <h2 className={titleClass}>Usage</h2>
        </div>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-4 w-48" />
      </div>
    );
  }

  // ── Error state (fetch failed — 5xx or network) ───────────────────────────
  if (error || !data) {
    return (
      <div className={cardClass}>
        <div className="flex items-center justify-between">
          <h2 className={titleClass}>Usage</h2>
        </div>
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-stone-200 bg-stone-50 p-4"
        >
          <AlertTriangle className="h-5 w-5 text-stone-500 mt-0.5" />
          <div className="flex flex-col gap-1">
            <p className="font-semibold text-sm text-[#0F172A] leading-[1.4]">
              Usage data is temporarily unavailable.
            </p>
            <p className="font-normal text-sm text-[#475569] leading-normal">
              Your plan is still active. Refresh to retry.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const {
    callsUsed = 0,
    callsIncluded = 0,
    cycleDaysLeft = 0,
    overageDollars = 0,
  } = data;

  const percent =
    callsIncluded > 0 ? (callsUsed / callsIncluded) * 100 : 0;
  const clamped = Math.min(percent, 100);
  const { fill, tone } = usageThresholdClass(percent);

  // ── Empty state (fresh cycle — plan active but 0 included) ────────────────
  if (callsIncluded === 0) {
    return (
      <div className={cardClass}>
        <div className="flex items-center justify-between">
          <h2 className={titleClass}>Usage</h2>
          <Link
            href="/dashboard/more/billing"
            className={`${btn.primary} ${focus.ring} inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-semibold min-h-[44px] md:min-h-0`}
          >
            Manage plan
          </Link>
        </div>
        <p className="font-semibold text-2xl text-[#0F172A] leading-tight tabular-nums">
          0 of 0 calls used
        </p>
        <p className="font-normal text-sm text-[#475569] leading-normal">
          Your cycle is starting. {formatCycleStartHint(cycleDaysLeft)}
        </p>
      </div>
    );
  }

  // ── Default state — progress bar + fraction + caption ─────────────────────
  const captionBase = `${cycleDaysLeft} ${
    cycleDaysLeft === 1 ? 'day' : 'days'
  } left`;
  const overageSuffix =
    overageDollars > 0 ? ` • $${overageDollars.toFixed(2)} over` : '';

  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className={titleClass}>Usage</h2>
        <Link
          href="/dashboard/more/billing"
          className={`${btn.primary} ${focus.ring} inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-semibold min-h-[44px] md:min-h-0`}
        >
          Manage plan
        </Link>
      </div>

      <p
        className="font-semibold text-2xl text-[#0F172A] leading-tight tabular-nums"
        aria-hidden="false"
      >
        {callsUsed.toLocaleString('en-US')} /{' '}
        {callsIncluded.toLocaleString('en-US')}
      </p>

      {/* Progress bar — custom div so we can override indicator color per threshold. */}
      <div
        role="progressbar"
        aria-valuenow={callsUsed}
        aria-valuemin={0}
        aria-valuemax={callsIncluded}
        aria-label="Calls used this cycle"
        className="relative h-2 w-full overflow-hidden rounded-full bg-stone-200"
      >
        <div
          className={`h-full ${fill} transition-[width] duration-[400ms] ease-out`}
          style={{ width: `${clamped}%` }}
        />
      </div>

      <p
        className={`font-normal text-xs leading-[1.4] ${tone} tabular-nums`}
      >
        {captionBase}
        {overageSuffix}
      </p>
    </div>
  );
}

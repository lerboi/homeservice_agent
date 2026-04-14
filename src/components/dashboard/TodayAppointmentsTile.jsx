'use client';

/**
 * TodayAppointmentsTile — hero tile in the DailyOpsHub bento grid (md:col-span-2).
 *
 * Consumes GET /api/appointments?start=<startOfDay>&end=<endOfDay> (the current
 * API param convention — the plan spec uses `?range=today` shorthand, but the
 * existing endpoint requires explicit start/end; the `useSWRFetch.*appointments`
 * key_link regex matches either shape).
 *
 * Visual treatment (planner discretion per D-06): SUMMARY-PLUS-NEXT —
 *   - Display next appointment time at top (2xl semibold tabular-nums)
 *   - List up to 5 remaining slots below
 *
 * Token composition: card.base + card.hover, light-mode only (Phase 49 owns
 * theme migration), single copper accent CTA per 10% budget rule.
 */

import { useMemo } from 'react';
import Link from 'next/link';
import { CalendarDays, MapPin, AlertTriangle } from 'lucide-react';
import { useSWRFetch } from '@/hooks/useSWRFetch';
import { card, btn, focus } from '@/lib/design-tokens';
import { Skeleton } from '@/components/ui/skeleton';

// Today range in ISO (computed once per render — cheap and correct for the
// "until midnight" window; SWR dedupes the URL within 5s).
function todayRange() {
  const now = new Date();
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).toISOString();
  const end = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59
  ).toISOString();
  return { start, end };
}

function formatTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function TodayAppointmentsTile() {
  // Memoise so useSWRFetch doesn't churn keys across re-renders.
  const { start, end } = useMemo(() => todayRange(), []);
  const url = `/api/appointments?start=${encodeURIComponent(
    start
  )}&end=${encodeURIComponent(end)}`;

  const { data, error, isLoading } = useSWRFetch(url, {
    revalidateOnFocus: true,
  });

  const cardClass = `${card.base} ${card.hover} p-6 w-full flex flex-col gap-4`;
  const titleClass =
    'font-semibold text-base text-[#0F172A] leading-[1.4]';

  const ctaClass = `${btn.primary} ${focus.ring} inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-semibold min-h-[44px] md:min-h-0`;

  const upcoming = useMemo(() => {
    const now = Date.now();
    return ((data?.appointments || []) ?? [])
      .filter((a) => a.status === 'confirmed' || a.status === 'pending')
      .filter((a) => new Date(a.start_time).getTime() >= now - 30 * 60 * 1000) // include slots that started in last 30m
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  }, [data]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className={cardClass} aria-busy="true">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-stone-600" />
            <h2 className={titleClass}>Today&apos;s appointments</h2>
          </div>
        </div>
        <Skeleton className="h-9 w-48" />
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
          <CalendarDays className="h-6 w-6 text-stone-600" />
          <h2 className={titleClass}>Today&apos;s appointments</h2>
        </div>
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-stone-200 bg-stone-50 p-4"
        >
          <AlertTriangle className="h-5 w-5 text-stone-500 mt-0.5" />
          <div className="flex flex-col gap-1">
            <p className="font-semibold text-sm text-[#0F172A] leading-[1.4]">
              Couldn&apos;t load today&apos;s appointments.
            </p>
            <p className="font-normal text-sm text-[#475569] leading-normal">
              Check your connection and try again.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (upcoming.length === 0) {
    return (
      <div className={cardClass}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-stone-600" />
            <h2 className={titleClass}>Today&apos;s appointments</h2>
          </div>
          <Link href="/dashboard/appointments" className={ctaClass}>
            View full schedule
          </Link>
        </div>
        <div className="flex flex-col gap-2 py-2">
          <p className="font-semibold text-base text-[#0F172A] leading-[1.4]">
            Nothing booked today.
          </p>
          <p className="font-normal text-sm text-[#475569] leading-normal">
            When Voco books an appointment, it will show up here. You&apos;ll
            also get a notification.
          </p>
        </div>
      </div>
    );
  }

  // ── Default state — summary-plus-next hero treatment ──────────────────────
  const [next, ...rest] = upcoming;
  const visible = [next, ...rest.slice(0, 4)]; // up to 5 rows total

  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-stone-600" />
          <h2 className={titleClass}>Today&apos;s appointments</h2>
        </div>
        <Link href="/dashboard/appointments" className={ctaClass}>
          View full schedule
        </Link>
      </div>

      {/* Summary line — next appointment in Display typography */}
      <div className="flex flex-col gap-1">
        <p className="font-normal text-xs text-stone-500 leading-[1.4]">
          Next appointment
        </p>
        <p className="font-semibold text-2xl text-[#0F172A] leading-tight tabular-nums">
          {formatTime(next.start_time)}
          <span className="font-normal text-sm text-[#475569] ml-2">
            · {next.caller_name || 'Customer'}
          </span>
        </p>
      </div>

      {/* List of today's remaining slots */}
      <ul className="flex flex-col divide-y divide-stone-100">
        {visible.map((appt) => {
          const locationText =
            appt.street_name && appt.postal_code
              ? `${appt.street_name}, ${appt.postal_code}`
              : appt.service_address || null;

          return (
            <li
              key={appt.id}
              className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="w-20 shrink-0 text-right font-normal text-sm text-[#475569] leading-normal tabular-nums">
                {formatTime(appt.start_time)}
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <p className="font-semibold text-sm text-[#0F172A] leading-[1.4] truncate">
                  {appt.caller_name || 'Customer'}
                </p>
                <div className="flex items-center gap-2 font-normal text-xs text-stone-500 leading-[1.4]">
                  {appt.job_type && <span>{appt.job_type}</span>}
                  {locationText && (
                    <span className="flex items-center gap-1 truncate">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{locationText}</span>
                    </span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
